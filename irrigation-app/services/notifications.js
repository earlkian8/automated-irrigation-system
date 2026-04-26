import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('[notifications] Push notifications require a physical device');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('irrigation', {
      name: 'Irrigation Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4DB6AC',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission not granted');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  try {
    await registerPushToken(token, Platform.OS);
    console.log('[notifications] Token registered:', token);
  } catch (err) {
    console.warn('[notifications] Token registration failed:', err.message);
  }

  return token;
}

export function setupNotificationHandlers() {
  const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
    console.log('[notifications] Foreground:', notification.request.content.title);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    console.log('[notifications] Tapped:', data);
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
