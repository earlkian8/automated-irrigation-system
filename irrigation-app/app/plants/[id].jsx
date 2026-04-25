import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { triggerManualWater } from '@/services/api';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar, ChevronLeft, Clock,
  Droplet, Droplets, Flower2,
  Settings, Sprout,
} from 'lucide-react-native';
import React, { useCallback, useContext, useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

function getPlantStatus(moisture) {
  if (moisture < 30) return { color: '#E57373', label: 'Dry' };
  if (moisture < 50) return { color: '#FFB74D', label: 'Needs Water' };
  if (moisture < 75) return { color: '#4DB6AC', label: 'Healthy' };
  return { color: '#AF97E5', label: 'Too Wet' };
}

function MoistureRing({ moisture }) {
  const safeMoisture = moisture ?? 0;
  const status = getPlantStatus(safeMoisture);
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.min(100, Math.max(0, safeMoisture)) / 100) * circumference;

  return (
    <View style={styles.ringContainer}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={radius} stroke={Colors.border} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size/2} cy={size/2} r={radius}
          stroke={status.color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{safeMoisture.toFixed(0)}</Text>
        <Text style={styles.ringUnit}>%</Text>
      </View>
    </View>
  );
}

export default function PlantDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const { getPlantById, refreshPlant } = useContext(PlantContext);
  const plant = getPlantById(id);

  const [isWatering, setIsWatering] = useState(false);
  const waterScale = useSharedValue(1);
  const waterAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: waterScale.value }],
  }));

  const handleWater = useCallback(async () => {
    if (!plant || isWatering) return;
    setIsWatering(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    waterScale.value = withSequence(withSpring(1.3), withSpring(1));
    try {
      await triggerManualWater(plant.id, plant.config.waterAmount ?? 150);
      await refreshPlant(plant.id);
    } catch (e) {
      console.warn('Watering failed:', e.message);
    } finally {
      setIsWatering(false);
    }
  }, [plant, isWatering, refreshPlant]);

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

  const moisture = plant.moisture ?? 0;
  const status   = plant.status || getPlantStatus(moisture);
  const lastWateredText = plant.lastWatered ? formatTimeAgo(plant.lastWatered) : 'Never';
  const nextIrrigText   = plant.nextIrrigation ? formatTimeUntil(plant.nextIrrigation) : 'Unknown';

  return (
    <>
      <Stack.Screen options={{
        header: () => (
          <View style={[styles.customHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{plant.name}</Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/configure/[id]', params: { id: plant.id } })}
              style={styles.settingsButton} hitSlop={12}
            >
              <Settings size={20} color={Colors.textSecondary} />
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
        >
          <View style={styles.plantHeader}>
            <View style={[styles.badge, { backgroundColor: status.color + '18' }]}>
              <View style={[styles.badgeDot, { backgroundColor: status.color }]} />
              <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <View style={styles.ringSection}>
            <MoistureRing moisture={moisture} />
            <Text style={styles.ringLabel}>Soil Moisture</Text>
          </View>

          <View style={styles.sensorCards}>
            <View style={styles.sensorCard}>
              <Droplets size={24} color={Colors.moisture} />
              <Text style={styles.sensorCardValue}>{moisture.toFixed(0)}%</Text>
              <Text style={styles.sensorCardLabel}>Moisture</Text>
            </View>
            <View style={styles.sensorCard}>
              <Flower2 size={24} color={Colors.accent} />
              <Text style={styles.sensorCardValue}>{plant.config.potSize}</Text>
              <Text style={styles.sensorCardLabel}>Pot Size</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Irrigation Info</Text>
            <View style={styles.infoRow}>
              <Clock size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>Last Watered</Text>
              <Text style={styles.infoValue}>{lastWateredText}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Calendar size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>Next Scheduled</Text>
              <Text style={styles.infoValue}>{nextIrrigText}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Sprout size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>Mode</Text>
              <Text style={styles.infoValue}>{plant.config.irrigationMode}</Text>
            </View>
          </View>

          <View style={styles.historyCard}>
            <Text style={styles.infoTitle}>Water History</Text>
            {(plant.waterHistory ?? []).slice(-5).reverse().map((event) => (
              <View key={event.id} style={styles.historyRow}>
                <View style={[styles.historyDot, {
                  backgroundColor: event.type === 'manual' ? Colors.moisture : Colors.primary,
                }]} />
                <View style={styles.historyInfo}>
                  <Text style={styles.historyType}>{event.type === 'manual' ? 'Manual' : 'Automatic'}</Text>
                  <Text style={styles.historyTime}>
                    {new Date(event.timestamp).toLocaleDateString()} at{' '}
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.historyAmount}>{event.amount}ml</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.waterButton, isWatering && styles.waterButtonActive]}
            onPress={handleWater}
            disabled={isWatering}
          >
            <Animated.View style={waterAnimStyle}>
              <Droplet size={24} color={Colors.white} />
            </Animated.View>
            <Text style={styles.waterButtonText}>
              {isWatering ? 'Irrigating...' : 'Manual Water'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTimeUntil(timestamp) {
  const diff = timestamp - Date.now();
  if (diff <= 0) return 'Due now';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `In ${Math.floor(diff / 60000)}m`;
  if (hours < 24) return `In ${hours}h`;
  return `In ${Math.floor(hours / 24)}d`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, paddingHorizontal: 16, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border, height: 70 },
  backButton: { padding: 6, width: 34 },
  settingsButton: { padding: 6, width: 34, alignItems: 'flex-end' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  plantHeader: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, gap: 6 },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  ringSection: { alignItems: 'center', marginVertical: 20, gap: 10 },
  ringContainer: { justifyContent: 'center', alignItems: 'center' },
  ringCenter: { position: 'absolute', flexDirection: 'row', alignItems: 'baseline' },
  ringValue: { fontSize: 42, fontWeight: '700', color: Colors.text },
  ringUnit: { fontSize: 18, fontWeight: '500', color: Colors.textSecondary, marginLeft: 2 },
  ringLabel: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  sensorCards: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  sensorCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  sensorCardValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  sensorCardLabel: { fontSize: 11, fontWeight: '400', color: Colors.textSecondary },
  infoCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  infoTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  infoLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  infoDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  historyCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, marginBottom: 20, shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyInfo: { flex: 1 },
  historyType: { fontSize: 14, fontWeight: '600', color: Colors.text },
  historyTime: { fontSize: 12, fontWeight: '400', color: Colors.textSecondary, marginTop: 2 },
  historyAmount: { fontSize: 14, fontWeight: '600', color: Colors.moisture },
  waterButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.moisture, borderRadius: 16, paddingVertical: 16, gap: 10, marginBottom: 8 },
  waterButtonActive: { opacity: 0.7 },
  waterButtonText: { fontSize: 17, fontWeight: '700', color: Colors.white },
  emptyText: { fontSize: 18, fontWeight: '600', color: Colors.text },
  backLink: { marginTop: 16 },
  backLinkText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
});