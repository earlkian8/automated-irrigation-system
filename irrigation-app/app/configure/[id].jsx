// app/configure/[id].jsx
import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { previewIrrigationParams, saveConfig } from '@/services/api';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Check, ChevronDown, ChevronUp, Clock, Droplet, Info, Leaf, Minus, Plus, Sparkles, Thermometer, X, Zap } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Constants ─────────────────────────────────────────────
const PLANT_TYPES = [
  'Fern', 'Peace Lily', 'Pothos', 'Monstera', 'Spider Plant',
  'Orchid', 'Snake Plant', 'Aloe Vera', 'Succulent', 'Cactus',
];

// Ordered from most water-needy to least — matches PLANT_PROFILES on server
const PLANT_WATER_LEVEL = {
  'Fern': 'High', 'Peace Lily': 'High',
  'Pothos': 'Medium', 'Monstera': 'Medium', 'Spider Plant': 'Medium',
  'Orchid': 'Medium-Low',
  'Snake Plant': 'Low', 'Aloe Vera': 'Low',
  'Succulent': 'Minimal', 'Cactus': 'Minimal',
};

const WATER_LEVEL_COLOR = {
  'High': '#4DB6AC', 'Medium': '#89b4fa', 'Medium-Low': '#FFB74D',
  'Low': '#fab387', 'Minimal': '#E57373',
};

const POT_SIZES        = ['Small', 'Medium', 'Large'];
const IRRIGATION_MODES = ['Automatic', 'Manual', 'Hybrid'];
const SCHEDULE_TYPES   = ['Daily', 'Every X Days', 'Custom'];

// Smart schedule recommendations per plant type (for indoor plants)
const SCHEDULE_RECS = {
  'Fern':         { type: 'Daily',       days: 1,  note: 'Ferns love consistent moisture — water daily to keep soil evenly moist.' },
  'Peace Lily':   { type: 'Daily',       days: 1,  note: 'Peace lilies droop when thirsty — daily watering keeps them happy.' },
  'Pothos':       { type: 'Every X Days', days: 3, note: 'Let soil dry slightly between waterings — every 2-3 days works well.' },
  'Monstera':     { type: 'Every X Days', days: 3, note: 'Water when the top inch of soil is dry, roughly every 3 days.' },
  'Spider Plant': { type: 'Every X Days', days: 2, note: 'Prefer evenly moist soil — every 2 days is ideal indoors.' },
  'Orchid':       { type: 'Every X Days', days: 7, note: 'Orchids need to dry out between waterings — once a week is perfect.' },
  'Snake Plant':  { type: 'Every X Days', days: 7, note: 'Less is more — snake plants hate overwatering. Once a week max.' },
  'Aloe Vera':    { type: 'Every X Days', days: 10, note: 'Allow soil to fully dry before watering again — every 10-14 days.' },
  'Succulent':    { type: 'Every X Days', days: 14, note: 'Succulents store water in their leaves — every 2 weeks is plenty.' },
  'Cactus':       { type: 'Every X Days', days: 21, note: 'Water sparingly — once every 3 weeks in spring/summer.' },
};

function getNextWateringLabel(scheduleType, scheduleTime, scheduleDays) {
  const now  = new Date();
  const [h, m] = scheduleTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;

  const base = new Date();
  base.setHours(h, m, 0, 0);

  let next;
  if (scheduleType === 'Daily') {
    next = base > now ? base : new Date(base.getTime() + 86400000);
  } else if (scheduleType === 'Every X Days') {
    const days = Math.max(1, parseInt(scheduleDays) || 1);
    next = new Date(base);
    while (next <= now) next.setDate(next.getDate() + days);
  } else {
    return null;
  }

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
  const timeStr  = next.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (next >= today && next < tomorrow) return `Today at ${timeStr}`;
  if (next >= tomorrow && next < dayAfter) return `Tomorrow at ${timeStr}`;
  return next.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

// ── Sub-components ────────────────────────────────────────
function OptionPicker({ label, options, selected, onSelect, hint }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <View style={styles.optionRow}>
        {options.map(opt => (
          <Pressable
            key={opt}
            style={[styles.optionChip, selected === opt && styles.optionChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(opt);
            }}
          >
            <Text style={[styles.optionText, selected === opt && styles.optionTextActive]}>
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function StatBadge({ icon: Icon, label, value, color }) {
  return (
    <View style={[styles.statBadge, { borderColor: color + '40', backgroundColor: color + '12' }]}>
      <Icon size={14} color={color} />
      <View>
        <Text style={[styles.statBadgeValue, { color }]}>{value}</Text>
        <Text style={styles.statBadgeLabel}>{label}</Text>
      </View>
    </View>
  );
}

// Live derived-params preview card shown below plant type + soil volume pickers
function SmartDefaultsCard({ plantType, soilVolume, thresholdOverridden, manualThreshold, hoseLengthCm }) {
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!plantType) return;
    setLoading(true);
    try {
      const vol = parseInt(soilVolume) || 500;
      const p = await previewIrrigationParams({
        plantType,
        soilVolume: vol,
        thresholdOverridden,
        moistureThreshold: parseInt(manualThreshold) || 30,
        hoseLengthCm: hoseLengthCm ?? 0,
      });
      setParams(p);
    } catch (_) {
      // server unreachable — silent fail, card stays hidden
    } finally {
      setLoading(false);
    }
  }, [plantType, soilVolume, thresholdOverridden, manualThreshold, hoseLengthCm]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!params && !loading) return null;

  const waterLevel   = PLANT_WATER_LEVEL[plantType] ?? 'Medium';
  const levelColor   = WATER_LEVEL_COLOR[waterLevel] ?? Colors.primary;
  const pumpSec      = params ? (params.pumpDurationMs / 1000).toFixed(1) : '—';

  return (
    <View style={styles.smartCard}>
      <View style={styles.smartCardHeader}>
        <Zap size={15} color={Colors.primary} />
        <Text style={styles.smartCardTitle}>Smart Defaults Preview</Text>
        {loading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 'auto' }} />}
      </View>

      {params && (
        <>
          <View style={[styles.waterLevelBar, { backgroundColor: levelColor + '18' }]}>
            <View style={[styles.waterLevelDot, { backgroundColor: levelColor }]} />
            <Text style={[styles.waterLevelText, { color: levelColor }]}>
              {plantType} — {waterLevel} water needs
            </Text>
          </View>

          {params.profile?.description ? (
            <Text style={styles.profileDesc}>{params.profile.description}</Text>
          ) : null}

          <View style={styles.statRow}>
            <StatBadge
              icon={Thermometer}
              label="Trigger threshold"
              value={`${params.moistureThreshold}%`}
              color="#89b4fa"
            />
            <StatBadge
              icon={Droplet}
              label="Water per session"
              value={`${params.waterAmount} ml`}
              color="#4DB6AC"
            />
            <StatBadge
              icon={Zap}
              label="Pump duration"
              value={`${pumpSec}s`}
              color="#fab387"
            />
          </View>

          {params.hoseDeadVolumeMl > 0 && (
            <View style={styles.infoRow}>
              <Info size={12} color="#fab387" />
              <Text style={[styles.infoText, { color: '#fab387' }]}>
                +{params.hoseDeadVolumeMl} ml hose dead volume included in pump duration.
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Info size={12} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              These values are automatically sent to the ESP32 when you save.
              {thresholdOverridden ? ' Threshold is manually overridden.' : ''}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ── Time picker ───────────────────────────────────────────
function TimeUnit({ value, onUp, onDown }) {
  return (
    <View style={styles.timeUnit}>
      <Pressable onPress={onUp} hitSlop={10} style={styles.timeArrow}>
        <ChevronUp size={16} color={Colors.primary} />
      </Pressable>
      <View style={styles.timeValueBox}>
        <Text style={styles.timeValue}>{value}</Text>
      </View>
      <Pressable onPress={onDown} hitSlop={10} style={styles.timeArrow}>
        <ChevronDown size={16} color={Colors.primary} />
      </Pressable>
    </View>
  );
}

function TimePicker({ value, onChange }) {
  const parts  = value.split(':');
  const hours   = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;

  const setH = (delta) => {
    const newH = ((hours + delta) % 24 + 24) % 24;
    onChange(`${String(newH).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const setM = (delta) => {
    const newM = ((minutes + delta) % 60 + 60) % 60;
    onChange(`${String(hours).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const toggleAmPm = () => {
    setH(hours < 12 ? 12 : -12);
  };

  const displayH = hours % 12 || 12;
  const ampm = hours < 12 ? 'AM' : 'PM';

  return (
    <View style={styles.timePickerWrapper}>
      <Clock size={16} color={Colors.primary} style={{ marginRight: 4 }} />
      <View style={styles.timePicker}>
        <TimeUnit
          value={String(displayH).padStart(2, '0')}
          onUp={() => setH(1)}
          onDown={() => setH(-1)}
        />
        <Text style={styles.timeColon}>:</Text>
        <TimeUnit
          value={String(minutes).padStart(2, '0')}
          onUp={() => setM(5)}
          onDown={() => setM(-5)}
        />
        <Pressable onPress={toggleAmPm} style={styles.ampmBtn}>
          <Text style={styles.ampmText}>{ampm}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Day interval stepper ──────────────────────────────────
function DayStepper({ value, onChange }) {
  const n = parseInt(value) || 1;
  const dec = () => { if (n > 1) { onChange(String(n - 1)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } };
  const inc = () => { onChange(String(n + 1)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  return (
    <View style={styles.stepper}>
      <Pressable onPress={dec} style={[styles.stepBtn, n <= 1 && styles.stepBtnDisabled]} disabled={n <= 1}>
        <Minus size={16} color={n <= 1 ? Colors.border : Colors.primary} />
      </Pressable>
      <View style={styles.stepValue}>
        <Text style={styles.stepValueText}>{n}</Text>
        <Text style={styles.stepValueUnit}>day{n !== 1 ? 's' : ''}</Text>
      </View>
      <Pressable onPress={inc} style={styles.stepBtn}>
        <Plus size={16} color={Colors.primary} />
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────
export default function ConfigureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id }  = useLocalSearchParams();

  const { getPlantById, protectedSave } = useContext(PlantContext);
  const plant = getPlantById(id);

  const [name, setName]                           = useState('');
  const [plantType, setPlantType]                 = useState('Fern');
  const [potSize, setPotSize]                     = useState('Medium');
  const [soilVolume, setSoilVolume]               = useState('500');
  const [hoseLength, setHoseLength]               = useState('0');
  const [hoseLengthUnit, setHoseLengthUnit]       = useState('cm');
  const [irrigationMode, setIrrigationMode]       = useState('Hybrid');
  const [scheduleType, setScheduleType]           = useState('Daily');
  const [scheduleDays, setScheduleDays]           = useState('1');
  const [scheduleTime, setScheduleTime]           = useState('08:00');
  const [thresholdOverridden, setThresholdOverridden] = useState(false);
  const [manualThreshold, setManualThreshold]     = useState('30');
  const [isSaving, setIsSaving]                   = useState(false);

  // Seed form only when navigating to a new plant, not on every 5s poll
  useEffect(() => {
    if (!plant) return;
    setName(plant.name ?? '');
    setPlantType(plant.config.plantType            ?? 'Fern');
    setPotSize(plant.config.potSize                ?? 'Medium');
    setSoilVolume(String(plant.config.soilVolume   ?? 500));
    setHoseLength(String(plant.config.hoseLengthCm ?? 0));
    setHoseLengthUnit(plant.config.hoseLengthUnit  ?? 'cm');
    setIrrigationMode(plant.config.irrigationMode  ?? 'Hybrid');
    setScheduleType(plant.config.scheduleType      ?? 'Daily');
    setScheduleDays(String(plant.config.scheduleDays ?? 1));
    setScheduleTime(plant.config.scheduleTime      ?? '08:00');
    setThresholdOverridden(plant.config.thresholdOverridden ?? false);
    setManualThreshold(String(plant.config.moistureThreshold ?? 30));
  }, [plant?.id]); // only re-seed on plant ID change

  if (!plant) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.emptyText}>Plant not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Convert hose length to cm regardless of which unit the user picked
  const hoseLengthCm = hoseLengthUnit === 'inch'
    ? Math.round((parseFloat(hoseLength) || 0) * 2.54)
    : parseInt(hoseLength) || 0;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await protectedSave(plant.id, () =>
        saveConfig(plant.id, {
          name,
          plantType,
          potSize,
          soilVolume:          parseInt(soilVolume)      || 500,
          hoseLengthCm,
          hoseLengthUnit,
          irrigationMode,
          scheduleType,
          scheduleDays:        parseInt(scheduleDays)    || 1,
          scheduleTime,
          thresholdOverridden,
          moistureThreshold:   parseInt(manualThreshold) || 30,
        })
      );
      router.back();
    } catch (e) {
      console.warn('Save failed:', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{
        header: () => (
          <View style={[styles.customHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} hitSlop={12}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Configure {plant.name}</Text>
            <TouchableOpacity onPress={handleSave} style={styles.headerButton} hitSlop={12} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Check size={24} color={Colors.primary} />}
            </TouchableOpacity>
          </View>
        ),
      }} />

      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, {
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16,
          }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingTop: 8 }}>

            {/* ── Plant identity ──────────────────────────── */}
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Plant Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter plant name"
                  placeholderTextColor={Colors.textSecondary + '80'}
                />
              </View>

              {/* Plant type horizontal scroll */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Plant Type</Text>
                <Text style={styles.fieldHint}>
                  Determines moisture threshold, water amount, and pump duration automatically.
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                  <View style={styles.typeRow}>
                    {PLANT_TYPES.map(type => {
                      const wl    = PLANT_WATER_LEVEL[type] ?? 'Medium';
                      const color = WATER_LEVEL_COLOR[wl] ?? Colors.primary;
                      const active = plantType === type;
                      return (
                        <Pressable
                          key={type}
                          style={[
                            styles.typeChip,
                            { borderColor: color + '60', backgroundColor: color + '14' },
                            active && { backgroundColor: color, borderColor: color },
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setPlantType(type);
                          }}
                        >
                          <Leaf size={13} color={active ? '#fff' : color} />
                          <View>
                            <Text style={[styles.typeChipText, { color: active ? '#fff' : color }]}>
                              {type}
                            </Text>
                            <Text style={[styles.typeChipSub, { color: active ? '#ffffffaa' : color + 'aa' }]}>
                              {wl}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <OptionPicker
                label="Pot Size"
                options={POT_SIZES}
                selected={potSize}
                onSelect={v => {
                  setPotSize(v);
                  const defaults = { Small: 300, Medium: 500, Large: 1000 };
                  setSoilVolume(String(defaults[v]));
                }}
                hint="Selecting a size auto-fills soil volume below."
              />

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Soil Volume (ml)</Text>
                <Text style={styles.fieldHint}>
                  More precise than pot size. Determines exact water amount per session.
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={soilVolume}
                  onChangeText={setSoilVolume}
                  keyboardType="numeric"
                  placeholder="e.g. 500"
                  placeholderTextColor={Colors.textSecondary + '80'}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Hose / Tube Length</Text>
                <Text style={styles.fieldHint}>
                  Pump runs extra time to fill the hose before water reaches the plant.
                  Set to 0 if the pump is directly above the pot.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={hoseLength}
                    onChangeText={setHoseLength}
                    keyboardType="numeric"
                    placeholder="e.g. 100"
                    placeholderTextColor={Colors.textSecondary + '80'}
                  />
                  <View style={[styles.optionRow, { flexWrap: 'nowrap' }]}>
                    {['cm', 'inch'].map(u => (
                      <Pressable
                        key={u}
                        style={[styles.optionChip, hoseLengthUnit === u && styles.optionChipActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setHoseLengthUnit(u);
                        }}
                      >
                        <Text style={[styles.optionText, hoseLengthUnit === u && styles.optionTextActive]}>
                          {u}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {/* ── Smart defaults preview ──────────────────── */}
            <SmartDefaultsCard
              plantType={plantType}
              soilVolume={soilVolume}
              thresholdOverridden={thresholdOverridden}
              manualThreshold={manualThreshold}
              hoseLengthCm={hoseLengthCm}
            />

            {/* ── Irrigation ──────────────────────────────── */}
            <Text style={styles.sectionTitle}>Irrigation</Text>
            <View style={styles.card}>
              <OptionPicker
                label="Mode"
                options={IRRIGATION_MODES}
                selected={irrigationMode}
                onSelect={setIrrigationMode}
                hint={
                  irrigationMode === 'Automatic' ? 'Waters when moisture drops below threshold. Ignores manual triggers.' :
                  irrigationMode === 'Manual'    ? 'Only waters when you press the button. Ignores threshold.' :
                  'Waters when dry AND when you press the button.'
                }
              />
            </View>

            {/* ── Schedule ─────────────────────────────────── */}
            <Text style={styles.sectionTitle}>Schedule</Text>

            {/* Smart recommendation banner */}
            {(() => {
              const rec = SCHEDULE_RECS[plantType];
              if (!rec) return null;
              const alreadyMatches =
                scheduleType === rec.type &&
                (rec.type === 'Daily' || String(scheduleDays) === String(rec.days));
              return (
                <Pressable
                  style={styles.recBanner}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setScheduleType(rec.type);
                    if (rec.days) setScheduleDays(String(rec.days));
                  }}
                >
                  <Sparkles size={14} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recTitle}>
                      Recommended for {plantType}
                      {alreadyMatches ? ' ✓' : '  — tap to apply'}
                    </Text>
                    <Text style={styles.recNote}>{rec.note}</Text>
                  </View>
                </Pressable>
              );
            })()}

            <View style={styles.card}>
              {/* Schedule type picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Frequency</Text>
                <View style={styles.scheduleTypeRow}>
                  {[
                    { key: 'Daily',       icon: CalendarDays, label: 'Daily' },
                    { key: 'Every X Days', icon: CalendarDays, label: 'Interval' },
                    { key: 'Custom',      icon: CalendarDays, label: 'Custom' },
                  ].map(({ key, icon: Icon, label }) => {
                    const active = scheduleType === key;
                    return (
                      <Pressable
                        key={key}
                        style={[styles.scheduleTypeChip, active && styles.scheduleTypeChipActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setScheduleType(key);
                        }}
                      >
                        <Icon size={14} color={active ? Colors.white : Colors.textSecondary} />
                        <Text style={[styles.scheduleTypeLabel, active && styles.scheduleTypeLabelActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Interval stepper */}
              {scheduleType === 'Every X Days' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Water every</Text>
                  <DayStepper value={scheduleDays} onChange={setScheduleDays} />
                </View>
              )}

              {scheduleType === 'Custom' && (
                <View style={[styles.fieldGroup, styles.customPlaceholder]}>
                  <Info size={14} color={Colors.textSecondary} />
                  <Text style={styles.customPlaceholderText}>
                    Custom scheduling coming soon. Use Daily or Interval for now.
                  </Text>
                </View>
              )}

              {/* Time picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Watering time</Text>
                <TimePicker value={scheduleTime} onChange={setScheduleTime} />
              </View>

              {/* Next watering preview */}
              {(() => {
                const label = getNextWateringLabel(scheduleType, scheduleTime, scheduleDays);
                if (!label) return null;
                return (
                  <View style={styles.nextWaterPreview}>
                    <Clock size={12} color={Colors.primary} />
                    <Text style={styles.nextWaterText}>
                      Next watering: <Text style={styles.nextWaterBold}>{label}</Text>
                    </Text>
                  </View>
                );
              })()}

              {/* Threshold override toggle */}
              <View style={[styles.fieldGroup, styles.toggleRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Override Moisture Threshold</Text>
                  <Text style={styles.fieldHint}>
                    Off = use smart default from plant type.{'\n'}
                    On  = set a custom trigger percentage below.
                  </Text>
                </View>
                <Switch
                  value={thresholdOverridden}
                  onValueChange={v => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setThresholdOverridden(v);
                  }}
                  trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                  thumbColor={thresholdOverridden ? Colors.primary : Colors.textSecondary}
                />
              </View>

              {thresholdOverridden && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Custom Threshold (%)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={manualThreshold}
                    onChangeText={setManualThreshold}
                    keyboardType="numeric"
                    placeholder="e.g. 35"
                    placeholderTextColor={Colors.textSecondary + '80'}
                  />
                </View>
              )}
            </View>

            <Pressable
              style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.saveButtonText}>Save Configuration</Text>}
            </Pressable>

          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.background },
  scrollContent:   { paddingHorizontal: 20 },
  customHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, paddingHorizontal: 16, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border, height: 70 },
  headerButton:    { padding: 6, width: 40, alignItems: 'center' },
  headerTitle:     { fontSize: 18, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'center' },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4, marginLeft: 4 },
  card:            { backgroundColor: Colors.card, borderRadius: 18, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  fieldGroup:      { marginBottom: 18 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, marginLeft: 2 },
  fieldHint:       { fontSize: 11, color: Colors.textSecondary, marginBottom: 8, marginLeft: 2, lineHeight: 16 },
  textInput:       { backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontWeight: '500', color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  typeScroll:      { marginHorizontal: -4, marginTop: 4 },
  typeRow:         { flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  typeChip:        { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5 },
  typeChipText:    { fontSize: 13, fontWeight: '700' },
  typeChipSub:     { fontSize: 10, fontWeight: '500', marginTop: 1 },
  optionRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionChip:      { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  optionChipActive:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionText:      { fontSize: 14, fontWeight: '600', color: Colors.text },
  optionTextActive:{ color: Colors.white },
  toggleRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Smart defaults card
  smartCard:       { backgroundColor: Colors.card, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: Colors.primary + '30' },
  smartCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  smartCardTitle:  { fontSize: 13, fontWeight: '700', color: Colors.primary },
  waterLevelBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  waterLevelDot:   { width: 8, height: 8, borderRadius: 4 },
  waterLevelText:  { fontSize: 13, fontWeight: '600' },
  profileDesc:     { fontSize: 12, color: Colors.textSecondary, marginBottom: 12, lineHeight: 17 },
  statRow:         { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statBadge:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1.5, padding: 8 },
  statBadgeValue:  { fontSize: 13, fontWeight: '700' },
  statBadgeLabel:  { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoText:        { fontSize: 11, color: Colors.textSecondary, flex: 1, lineHeight: 16 },
  // Save button
  saveButton:      { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 20 },
  saveButtonText:  { fontSize: 17, fontWeight: '700', color: Colors.white },
  emptyText:       { fontSize: 18, fontWeight: '600', color: Colors.text },
  backLink:        { marginTop: 16 },
  backLinkText:    { fontSize: 16, fontWeight: '600', color: Colors.primary },

  // Smart recommendation banner
  recBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C720',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F59E0B40',
    padding: 14,
    marginBottom: 10,
  },
  recTitle: { fontSize: 12, fontWeight: '700', color: '#B45309', marginBottom: 3 },
  recNote:  { fontSize: 11, color: '#92400E', lineHeight: 16 },

  // Schedule type chips
  scheduleTypeRow: { flexDirection: 'row', gap: 8 },
  scheduleTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scheduleTypeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  scheduleTypeLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  scheduleTypeLabelActive: { color: Colors.white },

  // TimePicker
  timePickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeUnit: { alignItems: 'center', gap: 2 },
  timeArrow: { padding: 4 },
  timeValueBox: {
    backgroundColor: Colors.primary + '12',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 44,
    alignItems: 'center',
  },
  timeValue: { fontSize: 22, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  timeColon: { fontSize: 24, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
  ampmBtn: {
    backgroundColor: Colors.primary + '18',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 4,
  },
  ampmText: { fontSize: 13, fontWeight: '800', color: Colors.primary },

  // Day stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    alignSelf: 'flex-start',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  stepBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepValue: {
    alignItems: 'center',
    paddingHorizontal: 20,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
  },
  stepValueText: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  stepValueUnit: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },

  // Next watering preview
  nextWaterPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '0E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  nextWaterText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  nextWaterBold: { fontWeight: '700', color: Colors.primary },

  // Custom schedule placeholder
  customPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customPlaceholderText: { fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
});