/**
 * `Alert.alert`, drawn by the app rather than by the OS.
 *
 * Every confirmation and error in the app comes through here. It used to hand
 * off to the platform: an iOS sheet, an Android Material box, and on web a
 * `window.confirm` that prints the page URL above the message. Three different
 * dialogs, none of them in the app's typeface, colours, or reading direction —
 * and a confirmation is part of the product, not a system service.
 *
 * So this now routes to `<DialogProvider>` (see `components/AppDialog.tsx`),
 * which draws them in the app's own design. The signature is React Native's,
 * unchanged, so no screen had to be rewritten.
 *
 * The platform path stays as a fallback for the window before the provider
 * mounts — an error thrown during boot still has to reach somebody.
 */

import { Alert as NativeAlert, Platform, type AlertButton, type AlertOptions } from 'react-native';
import { requestDialog } from '@/components/AppDialog';

/** Last resort: the provider isn't mounted yet (a failure during boot). */
function platformFallback(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    NativeAlert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];

  if (list.length <= 1) {
    window.alert(text);
    list[0]?.onPress?.();
    return;
  }

  const cancel = list.find((b) => b.style === 'cancel');
  const confirm = [...list].reverse().find((b) => b !== cancel) ?? list[list.length - 1];

  if (window.confirm(text)) confirm?.onPress?.();
  else cancel?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], _options?: AlertOptions): void {
    if (requestDialog({ title, message, buttons })) return;
    platformFallback(title, message, buttons);
  },

  /**
   * The amber variant, for something that is not an error but goes on the
   * record — a late cancellation, mainly. Same shape as `alert`.
   */
  warn(title: string, message?: string, buttons?: AlertButton[]): void {
    if (requestDialog({ title, message, buttons, tone: 'warn' })) return;
    platformFallback(title, message, buttons);
  },
};

export type { AlertButton };
