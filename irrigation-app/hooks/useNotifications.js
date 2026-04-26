import { useEffect } from 'react';
import { registerForPushNotifications, setupNotificationHandlers } from '@/services/notifications';

export function useNotifications() {
  useEffect(() => {
    registerForPushNotifications();
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);
}
