import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { api } from '@/api/client';
import { registerForPushNotifications, type PushRegistration } from '@/push/notifications';

/**
 * Registers for push once the user is signed in and hands the token to the API,
 * which is what PHASE 4's fan-out will send to.
 *
 * Returns the raw registration result so the Profile screen can show what
 * happened — a silent failure here is how you find out at hour 18.
 */
export function usePushToken(enabled: boolean) {
  const [registration, setRegistration] = useState<PushRegistration | null>(null);
  const [busy, setBusy] = useState(false);

  const register = useCallback(async () => {
    setBusy(true);
    try {
      const result = await registerForPushNotifications();
      setRegistration(result);

      if (result.status === 'granted') {
        try {
          await api.registerPushToken(result.token);
        } catch {
          // The token is still valid locally; the server just didn't take it.
        }
      }
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || registration) return;
    void register();
  }, [enabled, registration, register]);

  return { registration, busy, register };
}

/** Runs `handler` whenever a notification is tapped. Used for deep links later. */
export function useNotificationTap(handler: (data: Record<string, unknown>) => void) {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handler(response.notification.request.content.data ?? {});
    });
    return () => sub.remove();
  }, [handler]);
}
