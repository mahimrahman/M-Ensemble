/**
 * Push, wired once for the whole app.
 *
 * Two bugs this exists to fix:
 *
 *   1. Registration used to live on the Profile tab. A coordinator never opens
 *      Profile - they live in the admin shell - so their token was never sent
 *      and the fan-out had nobody to notify. Registration belongs at the root,
 *      where every session passes through.
 *
 *   2. Nothing listened for a tap. The server sends `data: { postId }` so
 *      tapping a notification should open that post; without a listener the
 *      notification opened the app on whatever screen it was last on, which
 *      looks like the link is broken.
 *
 * Both a cold start (app killed, notification taps it awake) and a warm tap are
 * handled: `getLastNotificationResponseAsync` covers the first, the listener
 * covers the second.
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { api } from '@/api/client';
import { registerForPushNotifications, type PushRegistration } from '@/push/notifications';

/** Pull a post id out of a notification's data payload, if it carries one. */
function postIdFrom(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const id = (data as { postId?: unknown }).postId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function usePushSetup(signedIn: boolean): void {
  const router = useRouter();

  // Register once per session. Without this a re-render storm would ask the OS
  // for a token on every pass.
  const registered = useRef(false);

  useEffect(() => {
    if (!signedIn) {
      registered.current = false;
      return;
    }
    if (registered.current) return;
    registered.current = true;

    void (async () => {
      const result: PushRegistration = await registerForPushNotifications();
      if (result.status !== 'granted') {
        // Not fatal, and not worth a dialog on launch: Profile shows the real
        // reason, and the console line is what you actually read while
        // debugging a device that isn't getting pushes.
        console.warn(
          '[push] not registered:',
          result.status,
          'reason' in result ? result.reason : '',
        );
        return;
      }
      try {
        await api.registerPushToken(result.token);
      } catch (err) {
        console.warn('[push] server rejected the token', err);
      }
    })();
  }, [signedIn]);

  // A tap while the app is running.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const postId = postIdFrom(response.notification.request.content.data);
      if (postId) router.push({ pathname: '/post/[id]', params: { id: postId } });
    });
    return () => sub.remove();
  }, [router]);

  // A tap that launched the app from cold. Runs once the session is up, so the
  // navigator is mounted and the push doesn't race the auth redirect.
  const handledColdStart = useRef(false);
  useEffect(() => {
    if (!signedIn || handledColdStart.current) return;
    handledColdStart.current = true;

    // Not implemented on web, where it throws synchronously; a preview in a
    // browser must not surface an error for a feature it cannot have.
    if (Platform.OS === 'web') return;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const postId = postIdFrom(response?.notification.request.content.data);
        if (postId) router.push({ pathname: '/post/[id]', params: { id: postId } });
      })
      .catch(() => {});
  }, [signedIn, router]);
}
