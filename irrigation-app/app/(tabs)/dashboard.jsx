// app/(tabs)/dashboard.jsx  — single-plant view
import AppHeader from '@/components/AppHeader';
import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { triggerManualWater } from '@/services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Calendar, Clock, Droplet, Droplets, Settings, Sprout,
} from 'lucide-react-native';
import React, { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinear, Stop } from 'react-native-svg';

// ── Helpers ────────────────────────────────────────────────────────────────────
function getStatus(moisture) {
  if (moisture < 30) return { color: '#E57373', label: 'Dry' };
  if (moisture < 50) return { color: '#FFB74D', label: 'Needs Water' };
  if (moisture < 75) return { color: '#4DB6AC', label: 'Healthy' };
  return               { color: '#AF97E5', label: 'Too Wet' };
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function timeUntil(ts) {
  const d = ts - Date.now();
  if (d <= 0) return 'Due now';
  const m = Math.floor(d / 60000);
  if (m < 60)   return `In ${m}m`;
  if (m < 1440) return `In ${Math.floor(m / 60)}h`;
  return `In ${Math.floor(m / 1440)}d`;
}

function fmtShort(ts) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
}

// ── Moisture Ring ──────────────────────────────────────────────────────────────
function MoistureRing({ moisture, color }) {
  const SIZE   = 210;
  const STROKE = 13;
  const r      = (SIZE - STROKE) / 2;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.min(100, Math.max(0, moisture ?? 0));
  const arc    = (pct / 100) * circ;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute',
        width: SIZE * 0.62,
        height: SIZE * 0.62,
        borderRadius: SIZE,
        backgroundColor: color + '10',
      }} />

      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Defs>
          <SvgLinear id="arc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%"   stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </SvgLinear>
        </Defs>
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={r}
          stroke={color} strokeOpacity={0.12}
          strokeWidth={STROKE} fill="none"
        />
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={r}
          stroke="url(#arc)"
          strokeWidth={STROKE} fill="none"
          strokeDasharray={`${arc} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>

      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.ringPct, { color: Colors.text }]}>{pct.toFixed(0)}</Text>
        <Text style={[styles.ringUnit, { color }]}>% moisture</Text>
      </View>
    </View>
  );
}

// ── Sensor Chip ────────────────────────────────────────────────────────────────
function Chip({ icon: Icon, iconColor, value, label }) {
  return (
    <View style={[styles.chip, { borderColor: iconColor + '25', backgroundColor: iconColor + '0C' }]}>
      <Icon size={14} color={iconColor} />
      <Text style={styles.chipVal}>{value ?? '—'}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ── Info Row ───────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, accent, last }) {
  return (
    <>
      <View style={styles.infoRow}>
        <View style={[styles.infoIcon, { backgroundColor: accent + '15' }]}>
          <Icon size={13} color={accent} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoVal}>{value}</Text>
      </View>
      {!last && <View style={styles.infoDivider} />}
    </>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plants, loading, error, refreshPlant } = useContext(PlantContext);

  const [watering, setWatering] = useState(false);
  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const plant = plants[0] ?? null;

  const handleWater = useCallback(async () => {
    if (!plant || watering) return;
    setWatering(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    btnScale.value = withSequence(withSpring(1.1), withSpring(1));
    try {
      await triggerManualWater(plant.id, plant.config?.waterAmount ?? 150);
      await refreshPlant(plant.id);
    } catch (e) {
      console.warn('Water failed:', e.message);
    } finally {
      setWatering(false);
    }
  }, [plant, watering, refreshPlant]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connecting to plant…</Text>
      </View>
    );
  }

  if (error || !plant) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errTitle}>{error ?? 'No plant found'}</Text>
        <Text style={styles.errSub}>Make sure the server is reachable</Text>
      </View>
    );
  }

  const moisture = plant.moisture ?? 0;
  const status   = getStatus(moisture);
  const temp     = plant.temperature != null ? `${plant.temperature.toFixed(1)}°C` : null;
  const hum      = plant.humidity    != null ? `${plant.humidity.toFixed(0)}%`     : null;

  const scheduleStr =
    plant.config?.scheduleType === 'Daily'
      ? `Daily · ${plant.config.scheduleTime}`
      : plant.config?.scheduleType === 'Every X Days'
      ? `Every ${plant.config.scheduleDays}d · ${plant.config.scheduleTime}`
      : (plant.config?.scheduleType ?? '—');

  const history = [...(plant.waterHistory ?? [])].reverse().slice(0, 5);

  return (
    <View style={[styles.screen, { paddingTop: 10 }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 },
        ]}
      >
        {/* ── App brand header ── */}
        <AppHeader
          title="Dashboard"
          subtitle="Your plant's live status"
        />

        {/* ── Plant bar ── */}
        <View style={styles.topBar}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.plantName} numberOfLines={1}>{plant.name}</Text>
            <Text style={styles.plantMeta}>
              {plant.config?.plantType ?? 'Plant'} · {plant.config?.potSize ?? ''} pot
            </Text>
          </View>
          <Pressable
            hitSlop={12}
            style={styles.settingsBtn}
            onPress={() =>
              router.push({ pathname: '/configure/[id]', params: { id: plant.id } })
            }
          >
            <Settings size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* ── Status + mode ── */}
        <View style={styles.pillRow}>
          <View style={[styles.statusPill, { backgroundColor: status.color + '18', borderColor: status.color + '40' }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          </View>
          <View style={styles.modePill}>
            <Text style={styles.modeText}>{plant.config?.irrigationMode ?? 'Hybrid'}</Text>
          </View>
        </View>

        {/* ── Ring ── */}
        <View style={styles.ringSection}>
          <MoistureRing moisture={moisture} color={status.color} />
          <Text style={styles.ringSub}>
            {plant.lastWatered ? `Last watered ${timeAgo(plant.lastWatered)}` : 'Never watered'}
          </Text>
        </View>

        {/* ── Sensor chips — only real data from ESP32 ── */}
        <View style={styles.chipRow}>
          <Chip icon={Droplets} iconColor={Colors.moisture} value={`${moisture.toFixed(0)}%`} label="Soil moisture" />
          <Chip icon={Sprout}   iconColor={Colors.primary}  value={plant.config?.potSize ?? '—'} label="Pot size" />
          <Chip icon={Droplet}  iconColor="#FFB74D"         value={plant.config?.waterAmount ? `${plant.config.waterAmount}ml` : '—'} label="Per session" />
        </View>

        {/* ── Irrigation ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Irrigation</Text>
          <InfoRow
            icon={Clock}    label="Last watered"
            value={plant.lastWatered ? timeAgo(plant.lastWatered) : 'Never'}
            accent={Colors.moisture}
          />
          <InfoRow
            icon={Calendar} label="Next scheduled"
            value={plant.nextIrrigation ? timeUntil(plant.nextIrrigation) : '—'}
            accent={Colors.primary}
          />
          <InfoRow
            icon={Sprout}   label="Schedule"
            value={scheduleStr}
            accent="#FFB74D"
            last
          />
        </View>

        {/* ── Water history ── */}
        {history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Water History</Text>
            {history.map((ev, i) => {
              const isManual = ev.type === 'manual';
              const evColor  = isManual ? Colors.moisture : Colors.primary;
              return (
                <View
                  key={ev.id}
                  style={[styles.histRow, i < history.length - 1 && styles.histBorder]}
                >
                  <View style={[styles.histDot, { backgroundColor: evColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histType}>{isManual ? 'Manual' : 'Automatic'}</Text>
                    <Text style={styles.histTime}>{fmtShort(ev.timestamp)}</Text>
                  </View>
                  <Text style={[styles.histAmount, { color: evColor }]}>{ev.amount}ml</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Water Now ── */}
        <Pressable
          style={[styles.waterBtn, watering && styles.waterBtnDisabled]}
          onPress={handleWater}
          disabled={watering}
        >
          <Animated.View style={[btnStyle, styles.waterBtnInner]}>
            {watering
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Droplets size={20} color={Colors.white} />}
            <Text style={styles.waterBtnText}>
              {watering ? 'Watering…' : 'Water Now'}
            </Text>
          </Animated.View>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const CARD = {
  backgroundColor: Colors.card,
  borderRadius: 18,
  padding: 18,
  marginBottom: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 10,
  elevation: 2,
};

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll:   { paddingHorizontal: 20 },

  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  errTitle: { fontSize: 16, fontWeight: '700', color: Colors.critical, textAlign: 'center', marginBottom: 8 },
  errSub:   { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  topBar:     { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 18, marginBottom: 12 },
  plantName:  { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.6, lineHeight: 30 },
  plantMeta:  { fontSize: 13, color: Colors.textSecondary, marginTop: 3, fontWeight: '500' },
  settingsBtn:{
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },

  pillRow:     { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 13, fontWeight: '700' },
  modePill:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  modeText:    { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  ringSection: { alignItems: 'center', marginBottom: 18, gap: 10 },
  ringPct:     { fontSize: 54, fontWeight: '900', letterSpacing: -2, lineHeight: 58 },
  ringUnit:    { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  ringSub:     { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },

  chipRow:   { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip:      { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  chipVal:   { fontSize: 15, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  chipLabel: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7 },

  card: { ...CARD },
  cardTitle: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 4 },

  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  infoIcon:   { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  infoLabel:  { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  infoVal:    { fontSize: 14, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },
  infoDivider:{ height: 1, backgroundColor: Colors.border, marginLeft: 38 },

  histRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  histDot:    { width: 8, height: 8, borderRadius: 4 },
  histType:   { fontSize: 14, fontWeight: '600', color: Colors.text },
  histTime:   { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  histAmount: { fontSize: 14, fontWeight: '800' },

  waterBtn:        { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 8 },
  waterBtnDisabled:{ opacity: 0.6 },
  waterBtnInner:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waterBtnText:    { fontSize: 16, fontWeight: '800', color: Colors.white, letterSpacing: -0.2 },
});
