import Colors from '@/constants/colors';
import { Tabs } from 'expo-router';
import { ChartColumn, LayoutDashboard } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.card,
          height: 60,
          borderTopWidth: 1,
          paddingBottom: 8,
          borderTopColor: Colors.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => <ChartColumn size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
