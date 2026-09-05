/**
 * Push registration. Wired in PHASE 1 on purpose — a push stack that first gets
 * tested at hour 18 is a push stack that doesn't ship.
 *
 * Three things that bite:
 *   - Simulators never receive remote push. Test on a physical device.
 *   - `getExpoPushTokenAsync` needs an EAS project id. Run `npx eas init` once
 *     and it lands in app.json under `extra.eas.projectId`.
 *   - Since SDK 53, Expo Go on Android does not receive remote push at all.
 *     Local notifications still work there; for a real push on Android use a
 *     development build (`npx expo run:android`). Expo Go on iOS still gets it.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { colors } from '@/theme';

/** Show the banner even when the app is foregrounded — that's the demo moment. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushRegistration =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; reason: string };

function projectId(): string | undefined {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const fromEas = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromConfig ?? fromEas;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'M’Ensemble',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.accent,
  });
}

/**
 * Asks for permission and returns an Expo push token.
 * Safe to call more than once; the OS prompt only appears the first time.
 */
export async function registerForPushNotifications(): Promise<PushRegistration> {
  if (!Device.isDevice) {
    return {
      status: 'unsupported',
      reason: 'Push only works on a physical device — simulators never receive it.',
    };
  }

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }

    if (!granted) {
      return { status: 'denied' };
    }

    const id = projectId();
    const result = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : {});
    return { status: 'granted', token: result.data };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Could not get a push token.';
    return { status: 'error', reason };
  }
}

/** Fires a local notification so you can prove delivery without a server. */
export async function sendLocalTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Centre Islamique Khadija',
      body: 'Iftar setup — 3 slots left for Saturday.',
      data: { postId: 'post_001' },
    },
    trigger: null,
  });
}
