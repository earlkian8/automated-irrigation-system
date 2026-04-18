import { HEALTH_THRESHOLDS } from '@/constants/analytics';
import Colors from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PlantHealthOverview({ plants }) {
  const healthy = plants.filter(p => p.moisture >= HEALTH_THRESHOLDS.healthy).length;
  const moderate = plants.filter(p => p.moisture >= HEALTH_THRESHOLDS.moderate && p.moisture < HEALTH_THRESHOLDS.healthy).length;
  const critical = plants.filter(p => p.moisture < HEALTH_THRESHOLDS.moderate).length;
  const total = plants.length || 1;

  const healthData = [
    { label: 'Healthy', count: healthy, color: Colors.healthy },
    { label: 'Moderate', count: moderate, color: Colors.moderate },
    { label: 'Critical', count: critical, color: Colors.critical },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Plant Health Overview</Text>
      <View>
        {healthData.map(item => (
          <View key={item.label} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${(item.count / total) * 100}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={styles.count}>{item.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  label: { fontSize: 13, color: Colors.textSecondary, width: 70 },
  barBg: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginRight: 6 },
  barFill: { height: '100%', borderRadius: 4 },
  count: { fontSize: 14, fontWeight: '700', color: Colors.text, width: 20, textAlign: 'right' },
});