import { Tabs } from "expo-router";
import { ChartColumn, LayoutDashboard } from 'lucide-react-native';
export default function TabLayout(){
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: "#348c14",
                tabBarInactiveTintColor: "#888",
                tabBarStyle: {
                backgroundColor: "#f7f7f7",
                height: 60,
                borderTopWidth: 0.5,
                paddingBottom: 8,
                borderTopColor: '#a1a1a1'
                },
                tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: "600",
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen name="dashboard" options={{ 
                title: "Dashboard",
                tabBarIcon: ({color, size}) => (
                    <LayoutDashboard size={size} color={color} />
                )
                }} />
            <Tabs.Screen name="analytics" options={{ 
                title: "Analytics",
                tabBarIcon: ({color, size}) => (
                    <ChartColumn size={size} color={color} />
                )
                }}/>
        </Tabs>
    );
}