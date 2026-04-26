import StatCard from '@/components/analytics/statscard';
import WeeklyChart from '@/components/analytics/weeklychart';
import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { fetchActivityLog, fetchAnalyticsSummary } from '@/services/api';
import { Activity, Droplet, Droplets, Settings, Server, Zap } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function activityMeta(eventType) {
  switch (eventType) {
    case 'manual_irrigation':    return { icon: Droplet,  label: 'Manual Water',    color: Colors.moisture };
    case 'auto_irrigation':      return { icon: Zap,      label: 'Auto Water',      color: Colors.primary };
    case 'scheduled_irrigation': return { icon: Zap,      label: 'Scheduled Water', color: Colors.primary };
    case 'config_change':        return { icon: Settings, label: 'Config Updated',  color: '#FFB74D' };
    case 'trigger_cleared':      return { icon: Droplets, label: 'Trigger Cleared', color: '#89b4fa' };
    case 'server_start':         return { icon: Server,   label: 'Server Start',    color: Colors.textSecondary };
    default:                     return { icon: Activity, label: eventType,         color: Colors.textSecondary };
  }
}

function getMoistureStatus(moisture) {
  if (moisture < 30) return { color: '#E57373', label: 'Dry' };
  if (moisture < 50) return { color: '#FFB74D', label: 'Needs Water' };
  if (moisture < 75) return { color: '#4DB6AC', label: 'Healthy' };
  return               { color: '#AF97E5', label: 'Too Wet' };
}

export default function Analytics() {
  const insets = useSafeAreaInsets();
  const { plants } = useContext(PlantContext);
  const plant = plants[0] ?? null;

  const [summary, setSummary]       = useState(null);
  const [activity, setActivity]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [data, log] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchActivityLog(50),
      ]);
      setSummary(data);
      setActivity(log.filter(e => e.event_type !== 'sensor_reading'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Single plant stats
  const plantStats = summary?.perPlant?.[0] ?? null;
  const weeklyWater = plantStats?.weeklyWater?.reduce((s, v) => s + v, 0) ?? 0;
  const weeklySessions = plantStats?.weeklyCount ?? 0;
  const totalWater = plantStats?.totalWaterUsed ?? 0;

  const moisture = plant?.moisture ?? null;
  const moistureStatus = getMoistureStatus(moisture ?? 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={Colors.primary}
        />
      }
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.pageTitle}>Analytics</Text>
        <Text style={styles.pageSub}>Pull down to refresh</Text>
      </View>

      {/* ── Live plant health ── */}
      {plant && moisture !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Plant Health</Text>
          <View style={styles.healthRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.healthPlantName}>{plant.name}</Text>
              <Text style={styles.healthMeta}>
                {plant.config?.plantType} · {plant.config?.potSize} pot
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: moistureStatus.color + '18', borderColor: moistureStatus.color + '40' }]}>
              <View style={[styles.statusDot, { backgroundColor: moistureStatus.color }]} />
              <Text style={[styles.statusLabel, { color: moistureStatus.color }]}>{moistureStatus.label}</Text>
            </View>
          </View>

          <View style={styles.moistureBarBg}>
            <View style={[styles.moistureBarFill, {
              width: `${Math.min(100, Math.max(0, moisture))}%`,
              backgroundColor: moistureStatus.color,
            }]} />
          </View>
          <View style={styles.moistureBarLabels}>
            <Text style={styles.moistureBarLabel}>0%</Text>
            <Text style={[styles.moistureBarVal, { color: moistureStatus.color }]}>
              {moisture.toFixed(0)}%
            </Text>
            <Text style={styles.moistureBarLabel}>100%</Text>
          </View>
        </View>
      )}

      {loading && !summary ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={[styles.card, styles.errorCard]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : summary ? (
        <>
          {/* ── Weekly chart ── */}
          <WeeklyChart data={summary.combinedWeeklyWater} />

          {/* ── Stat cards ── */}
          <View style={styles.statRow}>
            <StatCard
              icon={<Droplet size={20} color={Colors.moisture} />}
              iconColor={Colors.moisture}
              label="This week"
              value={weeklyWater >= 1000 ? (weeklyWater / 1000).toFixed(1) : weeklyWater}
              unit={weeklyWater >= 1000 ? 'L' : 'ml'}
            />
            <StatCard
              icon={<Droplets size={20} color={Colors.primary} />}
              iconColor={Colors.primary}
              label="Sessions this week"
              value={weeklySessions}
            />
          </View>

          {/* ── Plant water summary ── */}
          {plantStats && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Water Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>This week</Text>
                <Text style={styles.summaryVal}>{weeklyWater} ml</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sessions this week</Text>
                <Text style={styles.summaryVal}>{weeklySessions}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total water ever</Text>
                <Text style={styles.summaryVal}>{totalWater} ml</Text>
              </View>
            </View>
          )}

          {/* ── Activity log ── */}
          {activity.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Activity</Text>
              {activity.map((entry, i) => {
                const { icon: Icon, label, color } = activityMeta(entry.event_type);
                return (
                  <View
                    key={entry.id}
                    style={[styles.activityRow, i < activity.length - 1 && styles.activityBorder]}
                  >
                    <View style={[styles.activityIconBox, { backgroundColor: color + '15' }]}>
                      <Icon size={13} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityLabel}>{label}</Text>
                      <Text style={styles.activityTime}>
                        {new Date(entry.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}
                        {new Date(entry.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
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
  scroll:   { paddingHorizontal: 20 },
  centered: { alignItems: 'center', paddingVertical: 32 },

  header:    { marginBottom: 20 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.6 },
  pageSub:   { fontSize: 13, color: Colors.textSecondary, marginTop: 3, fontWeight: '500' },

  card:      { ...CARD },
  cardTitle: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 14 },

  errorCard: { borderWidth: 1, borderColor: Colors.critical + '30' },
  errorText: { fontSize: 13, color: Colors.critical, fontWeight: '600' },

  // Health card
  healthRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  healthPlantName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  healthMeta:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusLabel:     { fontSize: 12, fontWeight: '700' },
  moistureBarBg:   { height: 8, backgroundColor: Colors.border, borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  moistureBarFill: { height: '100%', borderRadius: 6 },
  moistureBarLabels:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moistureBarLabel: { fontSize: 11, color: Colors.textSecondary },
  moistureBarVal:   { fontSize: 13, fontWeight: '800' },

  statRow: { flexDirection: 'row', justifyContent: 'space-between' },

  // Summary card
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  summaryDivider: { height: 1, backgroundColor: Colors.border },
  summaryLabel:   { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  summaryVal:     { fontSize: 14, fontWeight: '700', color: Colors.text },

  // Activity
  activityRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  activityBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.border },
  activityIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityLabel:   { fontSize: 14, fontWeight: '600', color: Colors.text },
  activityTime:    { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
});
