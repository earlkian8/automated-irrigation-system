import { DAYS_OF_WEEK } from '@/constants/analytics';
import Colors from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function WeeklyChart({ data }) {
  const maxVal = Math.max(...data, 1);
  const todayIndex = new Date().getDay() - 1;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Weekly Water Usage</Text>
      <View style={styles.bars}>
        {data.map((val, i) => (
          <View key={i} style={styles.barCol}>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${(val / maxVal) * 100}%`,
                    backgroundColor:
                      i === todayIndex ? Colors.primary : Colors.primary + '50',
                  },
                ]}
              />
            </View>
            <Text style={[styles.label, i === todayIndex && styles.labelActive]}>
              {DAYS_OF_WEEK[i]}
            </Text>
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
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  barCol: { alignItems: 'center', flex: 1, marginHorizontal: 4 },
  barBg: { width: 24, height: 100, backgroundColor: Colors.border, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6 },
  label: { fontSize: 11, color: Colors.textSecondary },
  labelActive: { color: Colors.primary, fontWeight: '700' },
});