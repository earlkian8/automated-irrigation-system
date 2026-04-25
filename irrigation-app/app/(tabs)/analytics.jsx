import PlantHealthOverview from '@/components/analytics/planthealthoverview';
import StatCard from '@/components/analytics/statscard';
import WeeklyChart from '@/components/analytics/weeklychart';
import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { fetchAnalyticsSummary } from '@/services/api';
import { Droplet, Droplets, Leaf } from 'lucide-react-native';
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

export default function Analytics() {
  const insets = useSafeAreaInsets();
  const { plants } = useContext(PlantContext);  // live moisture for health overview

  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchAnalyticsSummary();
      setSummary(data);
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
});
