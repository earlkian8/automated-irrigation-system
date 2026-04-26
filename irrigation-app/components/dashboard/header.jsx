import Colors from '@/constants/colors';
import { PlantContext } from '@/context/PlantContext';
import { AlertCircle, CheckCircle2, Droplets, Leaf, Zap } from 'lucide-react-native';
import { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function StatTile({ icon: Icon, iconColor, value, label, bg }) {
  return (
    <View style={[styles.statTile, { backgroundColor: bg }]}>
      <Icon size={16} color={iconColor} />
      <Text style={[styles.statValue, { color: iconColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HeaderDashboard() {
  const { plants } = useContext(PlantContext);

  const total         = plants.length;
  const healthy       = plants.filter(p => (p.moisture ?? 0) >= 50 && (p.moisture ?? 0) < 75).length;
  const needsWater    = plants.filter(p => (p.moisture ?? 0) < 50).length;
  const autoCount     = plants.filter(p => p.config?.irrigationMode?.toLowerCase() === 'automatic').length;
  const allGood       = needsWater === 0 && total > 0;

  return (
    <View style={styles.container}>
      {/* Greeting + date + status pill */}
      <View style={styles.topRow}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
        {total > 0 && (
          <View style={[styles.statusPill, { backgroundColor: allGood ? Colors.primary + '18' : '#FF904020' }]}>
            {allGood
              ? <CheckCircle2 size={13} color={Colors.primary} />
              : <AlertCircle size={13} color="#FF8040" />}
            <Text style={[styles.statusText, { color: allGood ? Colors.primary : '#FF8040' }]}>
              {allGood
                ? 'All good'
                : `${needsWater} need${needsWater !== 1 ? 's' : ''} water`}
            </Text>
          </View>
        )}
      </View>

      {/* Stat tiles */}
      {total > 0 && (
        <View style={styles.statsRow}>
          <StatTile
            icon={Leaf}
            iconColor={Colors.primary}
            value={total}
            label="Plants"
            bg={Colors.primary + '12'}
          />
          <StatTile
            icon={CheckCircle2}
            iconColor="#4DB6AC"
            value={healthy}
            label="Healthy"
            bg="#4DB6AC12"
          />
          <StatTile
            icon={Droplets}
            iconColor="#42A5F5"
            value={needsWater}
            label="Need water"
            bg="#42A5F512"
          />
          <StatTile
            icon={Zap}
            iconColor="#AB47BC"
            value={autoCount}
            label="Auto mode"
            bg="#AB47BC12"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  greetingBlock: {
    flex: 1,
    marginRight: 10,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 14,
    gap: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
