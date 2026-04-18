import HeaderDashboard from '@/components/dashboard/header';
import PlantDashboard from '@/components/dashboard/plant';
import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { useContext } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

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

  return (
    <ScrollView style={styles.scrollContainer}>
      <HeaderDashboard />
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
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { padding: 20, backgroundColor: Colors.background },
  cardsContainer:  { marginVertical: 15 },
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
});