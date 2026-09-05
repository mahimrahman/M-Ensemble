/**
 * Haptics. The prototype is a web mockup so it has none, but on a phone a
 * signup that buzzes reads as real in a way a colour change never does.
 *
 * Every call is fire-and-forget and swallows its own failure — haptics are
 * unavailable on web and on some Android devices, and a missing buzz must
 * never break the interaction it was decorating.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** Any ordinary press — a button, a chip, a tab. */
export function tap(): void {
  if (!enabled) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A toggle landing on — a filter, a switch, a check-in. */
export function select(): void {
  if (!enabled) return;
  void Haptics.selectionAsync().catch(() => {});
}

/** A commitment went through — you claimed a slot, a post published. */
export function success(): void {
  if (!enabled) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Something didn't work. */
export function warn(): void {
  if (!enabled) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
