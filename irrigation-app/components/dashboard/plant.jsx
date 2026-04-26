import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';
import { Clock, Droplet, Flower2, Leaf, Repeat, Sliders, Zap } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function getPlantStatus(moisture) {
  if (moisture < 30) return { color: '#E57373', label: 'Dry' };
  if (moisture < 50) return { color: '#FFB74D', label: 'Needs Water' };
  if (moisture < 75) return { color: '#4DB6AC', label: 'Healthy' };
  return { color: '#AF97E5', label: 'Too Wet' };
}

function getModeIcon(mode) {
  switch (mode?.toLowerCase()) {
    case 'auto':   return { Icon: Zap,     color: '#4DB6AC', label: 'Auto' };
    case 'manual': return { Icon: Sliders, color: '#FFB74D', label: 'Manual' };
    case 'hybrid': return { Icon: Repeat,  color: '#AF97E5', label: 'Hybrid' };
    default:       return { Icon: Sliders, color: Colors.textSecondary, label: mode ?? '—' };
  }
}

function getNextWateringShort(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  if (d <= now) return null;
  const diffMs = d - now;
  const diffH = diffMs / 3600000;
  if (diffH > 48) return null; // only show if within 2 days
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  if (d >= today && d < tomorrow) return `Today ${time}`;
  return `Tomorrow ${time}`;
}

const PlantDashboard = ({ plant }) => {
  const router = useRouter();
  const moisture = plant.moisture ?? 0;
  const status = plant.status ?? getPlantStatus(moisture);
  const clamped = Math.min(100, Math.max(0, moisture));
  const { plantType, potSize, irrigationMode } = plant.config ?? {};
  const { Icon, color: modeColor, label: modeLabel } = getModeIcon(irrigationMode);
  const nextLabel = getNextWateringShort(plant.nextIrrigation);

  return (
    <Pressable
      onPress={() => router.push(`/plants/${plant.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.strip, { backgroundColor: status.color }]} />

      <View style={styles.body}>
        {/* Top row: name + status badge */}
        <View style={styles.topRow}>
          <View style={[styles.iconBox, { backgroundColor: status.color + '20' }]}>
            <Leaf size={16} color={status.color} />
          </View>
          <Text style={styles.name} numberOfLines={1}>{plant.name}</Text>
          <View style={[styles.badge, { backgroundColor: status.color + '1A' }]}>
            <View style={[styles.dot, { backgroundColor: status.color }]} />
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Middle row: moisture + meta */}
        <View style={styles.midRow}>
          <View style={styles.moistureBlock}>
            <Droplet size={12} color={status.color} />
            <Text style={[styles.moistureVal, { color: status.color }]}>{clamped.toFixed(0)}%</Text>
          </View>

          <View style={styles.divider} />

          {plantType ? (
            <View style={styles.metaItem}>
              <Leaf size={11} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{plantType}</Text>
            </View>
          ) : null}

          {potSize ? (
            <View style={styles.metaItem}>
              <Flower2 size={11} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{potSize}</Text>
            </View>
          ) : null}

          {irrigationMode ? (
            <View style={[styles.metaItem, styles.modePill, { backgroundColor: modeColor + '18' }]}>
              <Icon size={11} color={modeColor} />
              <Text style={[styles.metaText, { color: modeColor }]}>{modeLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Progress bar */}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: status.color }]} />
        </View>

        {/* Next watering chip */}
        {nextLabel && (
          <View style={styles.nextRow}>
            <Clock size={10} color={Colors.primary} />
            <Text style={styles.nextText}>{nextLabel}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export default PlantDashboard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: { opacity: 0.82 },
  strip: { width: 3 },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  moistureBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  moistureVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  modePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  track: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  nextText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
});