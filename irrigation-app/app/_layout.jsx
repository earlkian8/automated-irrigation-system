import { PlantProvider } from '@/context/PlantContext';
import { Stack } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useNotifications } from '@/hooks/useNotifications';

export default function RootLayout() {
  useNotifications();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1}}>
        <PlantProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false}}/>
          </Stack>
        </PlantProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
