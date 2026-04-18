import PlantHealthOverview from '@/components/analytics/planthealthoverview';
import StatCard from '@/components/analytics/statscard';
import WeeklyChart from '@/components/analytics/weeklychart';
import Colors from '@/constants/colors';
import { analyticsPlants, weeklyWaterData } from '@/data/mockData';
import { Activity, Droplet, Droplets, Leaf } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AnalyticsScreen() {
  const plants = analyticsPlants;

  const avgMoisture = plants.reduce((sum, p) => sum + p.moisture, 0) / plants.length;
  const totalWater = plants.reduce((sum, p) => sum + p.totalWaterUsed, 0);
  const totalEvents = plants.reduce((sum, p) => sum + p.waterHistory.length, 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Your garden at a glance</Text>

        <View style={styles.statsGrid}>
          <StatCard icon={<Leaf color={Colors.primary} size={22} />} iconColor={Colors.primary} label="Plants Connected" value={plants.length.toString()} />
          <StatCard icon={<Droplet color={Colors.moisture} size={22} />} iconColor={Colors.moisture} label="Avg. Moisture" value={avgMoisture.toFixed(0)} unit="%" />
          <StatCard icon={<Droplets color={Colors.accent} size={22} />} iconColor={Colors.accent} label="Total Water Used" value={(totalWater / 1000).toFixed(1)} unit="L" />
          <StatCard icon={<Activity color={Colors.humidity} size={22} />} iconColor={Colors.humidity} label="Water Events" value={totalEvents.toString()} />
        </View>

        <WeeklyChart data={weeklyWaterData} />
        <PlantHealthOverview plants={plants} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
});