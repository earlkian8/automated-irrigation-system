import PlantHealthOverview from '@/components/analytics/planthealthoverview';
import StatCard from '@/components/analytics/statscard';
import WeeklyChart from '@/components/analytics/weeklychart';
import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { fetchActivityLog, fetchAnalyticsSummary } from '@/services/api';
import { Activity, Droplet, Droplets, Leaf, Settings, Server, Zap } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function activityMeta(eventType) {
  switch (eventType) {
    case 'manual_irrigation':    return { icon: Droplet,   label: 'Manual Water',     color: Colors.moisture };
    case 'auto_irrigation':      return { icon: Zap,       label: 'Auto Water',       color: Colors.primary };
    case 'scheduled_irrigation': return { icon: Zap,       label: 'Scheduled Water',  color: Colors.primary };
    case 'config_change':        return { icon: Settings,  label: 'Config Updated',   color: '#FFB74D' };
    case 'trigger_cleared':      return { icon: Droplets,  label: 'Trigger Cleared',  color: '#89b4fa' };
    case 'server_start':         return { icon: Server,    label: 'Server Start',     color: '#A0A0A0' };
    default:                     return { icon: Activity,  label: eventType,          color: '#A0A0A0' };
  }
}

export default function Analytics() {
  const insets = useSafeAreaInsets();
  const { plants } = useContext(PlantContext);  // live moisture for health overview

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
      setActivity(log);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Aggregate stats across all plants
  const totalWater = summary?.perPlant?.reduce((s, p) => s + p.totalWaterUsed, 0) ?? 0;
  const totalSessions = summary?.perPlant?.reduce((s, p) => s + p.weeklyCount, 0) ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={Colors.primary}
        />
      }
    >
      <Text style={styles.heading}>Analytics</Text>
      <Text style={styles.subheading}>From your database — pull down to refresh</Text>

      {/* ── Plant health (uses live IoT moisture, not DB) ── */}
      <PlantHealthOverview plants={plants} />

      {loading && !summary ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : summary ? (
        <>
          {/* ── Weekly water chart ── */}
          <WeeklyChart data={summary.combinedWeeklyWater} />

          {/* ── Stat cards ── */}
          <View style={styles.statRow}>
            <StatCard
              icon={<Droplet size={20} color={Colors.moisture} />}
              iconColor={Colors.moisture}
              label="Total water used"
              value={totalWater >= 1000 ? (totalWater / 1000).toFixed(1) : totalWater}
              unit={totalWater >= 1000 ? 'L' : 'ml'}
            />
            <StatCard
              icon={<Droplets size={20} color={Colors.primary} />}
              iconColor={Colors.primary}
              label="Sessions this week"
              value={totalSessions}
            />
          </View>

          {/* ── Per-plant breakdown ── */}
          {summary.perPlant.map(p => {
            const plant = plants.find(pl => pl.id === p.plantId);
            if (!plant) return null;
            return (
              <View key={p.plantId} style={styles.plantCard}>
                <View style={styles.plantCardHeader}>
                  <Leaf size={15} color={Colors.primary} />
                  <Text style={styles.plantCardTitle}>{plant.name}</Text>
                </View>
                <View style={styles.plantCardRow}>
                  <Text style={styles.plantCardLabel}>Water this week</Text>
                  <Text style={styles.plantCardValue}>
                    {p.weeklyWater.reduce((s, v) => s + v, 0)} ml
                  </Text>
                </View>
                <View style={styles.plantCardRow}>
                  <Text style={styles.plantCardLabel}>Sessions this week</Text>
                  <Text style={styles.plantCardValue}>{p.weeklyCount}</Text>
                </View>
                <View style={styles.plantCardRow}>
                  <Text style={styles.plantCardLabel}>Total water ever</Text>
                  <Text style={styles.plantCardValue}>{p.totalWaterUsed} ml</Text>
                </View>
              </View>
            );
          })}

          {/* ── Recent activity log ── */}
          {activity.length > 0 && (
            <View style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <Activity size={15} color={Colors.primary} />
                <Text style={styles.activityTitle}>Recent Activity</Text>
              </View>
              {activity.map((entry) => {
                const { icon: Icon, label, color } = activityMeta(entry.event_type);
                return (
                  <View key={entry.id} style={styles.activityRow}>
                    <View style={[styles.activityDot, { backgroundColor: color + '20' }]}>
                      <Icon size={13} color={color} />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityLabel}>{label}</Text>
                      <Text style={styles.activityTime}>
                        {new Date(entry.occurred_at).toLocaleDateString()} {' '}
                        {new Date(entry.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  content:          { paddingHorizontal: 20, paddingTop: 16 },
  heading:          { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  subheading:       { fontSize: 12, color: Colors.textSecondary, marginBottom: 20 },
  centered:         { alignItems: 'center', paddingVertical: 32 },
  statRow:          { flexDirection: 'row', justifyContent: 'space-between' },
  errorCard:        { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  errorText:        { color: Colors.critical, fontSize: 13 },
  plantCard:        { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  plantCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  plantCardTitle:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  plantCardRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  plantCardLabel:   { fontSize: 13, color: Colors.textSecondary },
  plantCardValue:   { fontSize: 13, fontWeight: '600', color: Colors.text },
  activityCard:     { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  activityHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  activityTitle:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  activityRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  activityDot:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activityInfo:     { flex: 1 },
  activityLabel:    { fontSize: 13, fontWeight: '600', color: Colors.text },
  activityTime:     { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
});
