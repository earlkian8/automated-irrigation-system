// components/PlantScanModal.jsx
import Colors from '@/constants/colors';
import { identifyPlant } from '@/services/gemini';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  CalendarDays, Camera, Check, ChevronRight,
  Leaf, Settings2, ScanLine, TriangleAlert, X,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

// ── Step config ───────────────────────────────────���────────
const STEPS = [
  { key: 'read',   label: 'Reading image',      icon: Camera },
  { key: 'identify', label: 'Identifying plant', icon: Leaf },
  { key: 'config', label: 'Generating config',   icon: Settings2 },
];

// Step timings (ms) — advance through steps while API call runs
const STEP_DELAYS = [0, 1600, 3200];

// ── Animated step indicator ────────────────────────────────
function StepRow({ step, state }) {
  // state: 'pending' | 'active' | 'done'
  const Icon = step.icon;
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (state === 'active') {
      pulse.value = withRepeat(
        withSequence(withTiming(0.5, { duration: 600 }), withTiming(1, { duration: 600 })),
        -1, true
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [state]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const isDone    = state === 'done';
  const isActive  = state === 'active';
  const isPending = state === 'pending';

  const circleColor = isDone
    ? Colors.primary
    : isActive
    ? Colors.primary
    : Colors.border;

  return (
    <View style={styles.stepRow}>
      {/* Circle indicator */}
      <View style={[styles.stepCircle, { backgroundColor: circleColor }]}>
        {isDone ? (
          <Check size={13} color="#fff" strokeWidth={3} />
        ) : isActive ? (
          <Animated.View style={dotStyle}>
            <ActivityIndicator size="small" color="#fff" />
          </Animated.View>
        ) : (
          <Icon size={12} color={isPending ? Colors.textSecondary : '#fff'} />
        )}
      </View>

      {/* Label */}
      <Text style={[
        styles.stepLabel,
        isDone  && styles.stepLabelDone,
        isActive && styles.stepLabelActive,
      ]}>
        {step.label}
      </Text>

      {/* Right status */}
      {isDone   && <Text style={styles.stepDoneText}>Done</Text>}
      {isActive && <Text style={styles.stepActiveText}>In progress…</Text>}
    </View>
  );
}

// ── Result row ─────────────────────────────────────────────
function ResultRow({ icon: Icon, iconColor, label, value, last }) {
  return (
    <>
      <View style={styles.resultRow}>
        <View style={[styles.resultIcon, { backgroundColor: iconColor + '15' }]}>
          <Icon size={13} color={iconColor} />
        </View>
        <Text style={styles.resultLabel}>{label}</Text>
        <Text style={styles.resultVal}>{value}</Text>
      </View>
      {!last && <View style={styles.resultDivider} />}
    </>
  );
}

// ── Main modal ─────────────────────────────────────────────
// phase: 'source' | 'detecting' | 'done' | 'error'
export default function PlantScanModal({ visible, onClose, onApply }) {
  const [phase,   setPhase]  = useState('source');
  const [photo,   setPhoto]  = useState(null);     // { uri, base64, mimeType }
  const [result,  setResult] = useState(null);
  const [errMsg,  setErrMsg] = useState('');
  const [steps,   setSteps]  = useState(['pending', 'pending', 'pending']);
  const timersRef = useRef([]);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setPhase('source');
      setPhoto(null);
      setResult(null);
      setErrMsg('');
      setSteps(['pending', 'pending', 'pending']);
    }
  }, [visible]);

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  async function pickImage(useCamera) {
    // Request permissions
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to take photos.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is needed to select photos.');
        return;
      }
    }

    const opts = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.75,
      base64: true,
    };

    const res = useCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhoto({ uri: asset.uri, base64: asset.base64, mimeType });
    startDetection(asset.base64, mimeType);
  }

  function startDetection(base64, mimeType) {
    setPhase('detecting');
    setSteps(['active', 'pending', 'pending']);
    clearTimers();

    // Advance steps on a timer
    STEP_DELAYS.forEach((delay, i) => {
      const t = setTimeout(() => {
        setSteps(prev => {
          const next = [...prev];
          if (i > 0) next[i - 1] = 'done';
          next[i] = 'active';
          return next;
        });
      }, delay);
      timersRef.current.push(t);
    });

    // Fire API call
    identifyPlant(base64, mimeType)
      .then(data => {
        clearTimers();
        setSteps(['done', 'done', 'done']);
        setResult(data);
        setPhase('done');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch(err => {
        clearTimers();
        setErrMsg(err.message ?? 'Something went wrong');
        setPhase('error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      });
  }

  function handleApply() {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply({
      plantType:    result.plantType,
      potSize:      result.potSize,
      irrigationMode: result.irrigationMode,
      scheduleType: result.scheduleType,
      scheduleDays: String(result.scheduleDays ?? 1),
      scheduleTime: result.scheduleTime ?? '08:00',
      name:         result.plantName,
    });
    onClose();
  }

  function handleRetry() {
    setPhase('source');
    setPhoto(null);
    setResult(null);
    setErrMsg('');
    setSteps(['pending', 'pending', 'pending']);
  }

  // ── Render ──
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={phase === 'source' ? onClose : undefined}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <ScanLine size={16} color={Colors.primary} />
              </View>
              <Text style={styles.headerTitle}>Plant Scanner</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {/* ── Photo preview (detecting / done / error) ── */}
          {photo && (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
              {phase === 'detecting' && (
                <View style={styles.photoOverlay}>
                  <View style={styles.scanLine} />
                </View>
              )}
            </View>
          )}

          {/* ── SOURCE PICK ── */}
          {phase === 'source' && (
            <View style={styles.body}>
              <Text style={styles.sourceHint}>
                Take a photo or upload one to auto-fill your plant configuration using AI.
              </Text>
              <Pressable style={styles.sourceBtn} onPress={() => pickImage(true)}>
                <View style={[styles.sourceBtnIcon, { backgroundColor: Colors.primary + '15' }]}>
                  <Camera size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sourceBtnLabel}>Take a Photo</Text>
                  <Text style={styles.sourceBtnSub}>Use your camera</Text>
                </View>
                <ChevronRight size={16} color={Colors.textSecondary} />
              </Pressable>

              <Pressable style={styles.sourceBtn} onPress={() => pickImage(false)}>
                <View style={[styles.sourceBtnIcon, { backgroundColor: Colors.moisture + '15' }]}>
                  <Leaf size={22} color={Colors.moisture} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sourceBtnLabel}>Upload from Library</Text>
                  <Text style={styles.sourceBtnSub}>Choose an existing photo</Text>
                </View>
                <ChevronRight size={16} color={Colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {/* ── DETECTING ── */}
          {phase === 'detecting' && (
            <View style={styles.body}>
              <Text style={styles.detectingTitle}>Analyzing your plant…</Text>
              <View style={styles.stepList}>
                {STEPS.map((step, i) => (
                  <StepRow key={step.key} step={step} state={steps[i]} />
                ))}
              </View>
            </View>
          )}

          {/* ── DONE ── */}
          {phase === 'done' && result && (
            <View style={styles.body}>
              {/* Confidence badge */}
              <View style={styles.confidenceRow}>
                <View style={[styles.confidenceBadge, {
                  backgroundColor: result.confidence >= 70
                    ? Colors.primary + '18'
                    : '#FFB74D18',
                  borderColor: result.confidence >= 70
                    ? Colors.primary + '40'
                    : '#FFB74D40',
                }]}>
                  <Check size={12} color={result.confidence >= 70 ? Colors.primary : '#FFB74D'} strokeWidth={3} />
                  <Text style={[styles.confidenceText, {
                    color: result.confidence >= 70 ? Colors.primary : '#FFB74D',
                  }]}>
                    {result.confidence}% confidence
                  </Text>
                </View>
                {result.plantName ? (
                  <Text style={styles.plantNameDetected} numberOfLines={1}>
                    {result.plantName}
                  </Text>
                ) : null}
              </View>

              {/* Detected fields */}
              <View style={styles.resultCard}>
                <ResultRow
                  icon={Leaf}        iconColor={Colors.primary}
                  label="Plant type"  value={result.plantType ?? '—'}
                />
                <ResultRow
                  icon={Settings2}   iconColor="#FFB74D"
                  label="Pot size"    value={result.potSize ?? '—'}
                />
                <ResultRow
                  icon={CalendarDays} iconColor={Colors.moisture}
                  label="Schedule"
                  value={
                    result.scheduleType === 'Daily'
                      ? `Daily · ${result.scheduleTime ?? '08:00'}`
                      : `Every ${result.scheduleDays}d · ${result.scheduleTime ?? '08:00'}`
                  }
                />
                <ResultRow
                  icon={Settings2}   iconColor="#AB47BC"
                  label="Mode"        value={result.irrigationMode ?? '—'}
                  last
                />
              </View>

              {/* Care note */}
              {result.notes ? (
                <Text style={styles.notes}>{result.notes}</Text>
              ) : null}

              {/* Actions */}
              <Pressable style={styles.applyBtn} onPress={handleApply}>
                <Check size={17} color="#fff" strokeWidth={3} />
                <Text style={styles.applyBtnText}>Apply Configuration</Text>
              </Pressable>
              <Pressable style={styles.skipBtn} onPress={onClose}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </Pressable>
            </View>
          )}

          {/* ── ERROR ── */}
          {phase === 'error' && (
            <View style={styles.body}>
              <View style={styles.errorBox}>
                <TriangleAlert size={28} color={Colors.critical} />
                <Text style={styles.errorTitle}>Detection failed</Text>
                <Text style={styles.errorMsg}>{errMsg}</Text>
              </View>
              <Pressable style={styles.applyBtn} onPress={handleRetry}>
                <Text style={styles.applyBtnText}>Try Again</Text>
              </Pressable>
              <Pressable style={styles.skipBtn} onPress={onClose}>
                <Text style={styles.skipBtnText}>Cancel</Text>
              </Pressable>
            </View>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 12, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },

  // Photo preview
  photoWrap: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
    height: 160,
  },
  photo: { width: '100%', height: '100%' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    width: '85%', height: 2,
    backgroundColor: Colors.primary,
    opacity: 0.6,
    borderRadius: 1,
  },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },

  // Source pick
  sourceHint: {
    fontSize: 13, color: Colors.textSecondary, lineHeight: 19,
    marginBottom: 16, fontWeight: '500',
  },
  sourceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 10,
  },
  sourceBtnIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  sourceBtnLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sourceBtnSub:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Detecting
  detectingTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.text,
    marginBottom: 16, marginTop: 4,
  },
  stepList: { gap: 4 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  stepCircle: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  stepLabel:       { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  stepLabelActive: { color: Colors.text, fontWeight: '700' },
  stepLabelDone:   { color: Colors.text, fontWeight: '600' },
  stepDoneText:    { fontSize: 12, fontWeight: '600', color: Colors.primary },
  stepActiveText:  { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  // Confidence + name
  confidenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  confidenceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  confidenceText:   { fontSize: 12, fontWeight: '700' },
  plantNameDetected:{ flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text },

  // Result card
  resultCard: {
    backgroundColor: Colors.background,
    borderRadius: 14, padding: 4,
    marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  resultIcon: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  resultLabel:   { flex: 1, fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  resultVal:     { fontSize: 13, fontWeight: '700', color: Colors.text },
  resultDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 50 },

  // Care notes
  notes: {
    fontSize: 12, color: Colors.textSecondary, lineHeight: 18,
    fontStyle: 'italic', marginBottom: 16, paddingHorizontal: 2,
  },

  // Buttons
  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 10,
  },
  applyBtnText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  skipBtn:      { alignItems: 'center', paddingVertical: 10 },
  skipBtnText:  { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  // Error
  errorBox: {
    alignItems: 'center', paddingVertical: 20, gap: 8, marginBottom: 20,
  },
  errorTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  errorMsg:   { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
});
