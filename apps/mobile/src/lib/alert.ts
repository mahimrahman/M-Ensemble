/**
 * `Alert.alert` that also works on web.
 *
 * react-native-web ships `Alert` as a no-op, so on the web preview every
 * confirmation ("Cancel this post?", "Give up your slot?") silently did
 * nothing and every error toast vanished. The review happens on web, so
 * that is a broken app, not a platform quirk.
 *
 * Same signature as React Native's. On native it *is* React Native's. On web:
 *   - no buttons / one button → `window.alert`, then that button's handler
 *   - two or more            → `window.confirm`; OK runs the affirmative
 *                              button (the non-cancel one), Cancel runs the
 *                              cancel-styled one if it has a handler
 */

import { Alert as NativeAlert, Platform, type AlertButton, type AlertOptions } from 'react-native';

function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];

  if (list.length <= 1) {
    window.alert(text);
    list[0]?.onPress?.();
    return;
  }

  const cancel = list.find((b) => b.style === 'cancel');
  // The affirmative action: the last button that isn't the cancel one, which is
  // where the destructive/confirm button sits in every call in the app.
  const confirm = [...list].reverse().find((b) => b !== cancel) ?? list[list.length - 1];

  if (window.confirm(text)) {
    confirm?.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
    if (Platform.OS === 'web') {
      webAlert(title, message, buttons);
      return;
    }
    NativeAlert.alert(title, message, buttons, options);
  },
};

export type { AlertButton };
