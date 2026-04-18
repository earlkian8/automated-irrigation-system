import Colors from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StatCard({ icon, iconColor, label, value, unit }) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrapper, { backgroundColor: iconColor + '15' }]}>
        {icon}
      </View>
      <Text style={styles.value}>
        {value}
        {unit && <Text style={styles.unit}> {unit}</Text>}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  value: { fontSize: 24, fontWeight: '700', color: Colors.text },
  unit: { fontSize: 14, fontWeight: '400', color: Colors.textSecondary },
  label: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary, marginTop: 4 },
});