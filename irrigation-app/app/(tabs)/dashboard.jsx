import HeaderDashboard from '@/components/dashboard/header';
import PlantDashboard from '@/components/dashboard/plant';
import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { Calendar } from 'lucide-react-native';
import { useContext } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

function formatNextWatering(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d >= today && d < tomorrow) return `Today at ${time}`;
  if (d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000)) return `Tomorrow at ${time}`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${time}`;
}

export default function Dashboard() {
  const { plants, loading, error } = useContext(PlantContext);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>
          Make sure your server is running and your phone is on the same WiFi
        </Text>
      </View>
    );
  }

  // Find the soonest upcoming irrigation across all plants
  const soonestNext = plants
    .map(p => p.nextIrrigation)
    .filter(Boolean)
    .map(ts => new Date(ts))
    .filter(d => d > new Date())
    .sort((a, b) => a - b)[0] ?? null;

  const nextLabel = formatNextWatering(soonestNext);

  return (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <HeaderDashboard />

      {/* Next watering banner */}
      {nextLabel && (
        <View style={styles.nextWateringBanner}>
          <Calendar size={14} color={Colors.primary} />
          <Text style={styles.nextWateringText}>
            Next watering: <Text style={styles.nextWateringBold}>{nextLabel}</Text>
          </Text>
        </View>
      )}

      {/* Plants section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Plants</Text>
        <Text style={styles.sectionCount}>{plants.length}</Text>
      </View>

      <View style={styles.cardsContainer}>
        {plants.map((plant) => (
          <PlantDashboard
            key={plant.id}
            plant={{
              id: plant.id,
              name: plant.name,
              config: plant.config,
              moisture: plant.moisture,
              status: plant.status,
              nextIrrigation: plant.nextIrrigation,
              lastWatered: plant.lastWatered,
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.needsWater,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  nextWateringBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primary + '0E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  nextWateringText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  nextWateringBold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardsContainer: {
    marginBottom: 24,
  },
});
