/**
 * The app's own dialog, replacing the OS one.
 *
 * `Alert.alert` gave three different-looking dialogs on three platforms — an
 * iOS sheet, an Android Material box, and a browser `window.confirm` with the
 * page's URL printed above the message. None of them are the app: not its
 * typeface, not its teal, not its Arabic. A confirmation is part of the
 * product, so it is drawn here.
 *
 * `lib/alert.ts` keeps React Native's exact signature and routes through this,
 * so no screen had to change. The queue matters because the old API is
 * fire-and-forget: two `Alert.alert` calls in the same tick used to stack as
 * two OS dialogs, and here the second waits rather than replacing the first.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AlertButton } from 'react-native';
import { useLang } from '@/i18n';
import { colors, radius, rule, spacing, type } from '@/theme';

export interface DialogRequest {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  /**
   * Tints the dialog. `danger` for anything destructive, `warn` for the
   * amber "this goes on your record" cases, `info` for the rest. Inferred
   * from the buttons when not given.
   */
  tone?: 'info' | 'warn' | 'danger';
}

type Show = (request: DialogRequest) => void;

const DialogContext = createContext<Show | null>(null);

/**
 * The imperative handle `lib/alert.ts` calls into.
 *
 * A module-level binding rather than a hook, because the call sites are
 * `Alert.alert(...)` inside async handlers and `catch` blocks where there is no
 * component to hang a hook on. Set once when the provider mounts.
 */
let showDialog: Show | null = null;

export function requestDialog(request: DialogRequest): boolean {
  if (!showDialog) return false;
  showDialog(request);
  return true;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const { t, align, font } = useLang();

  // Guards against a double-tap firing a button's handler twice while the
  // dismiss animation is still running.
  const closing = useRef(false);

  const show = useCallback<Show>((request) => {
    setQueue((prev) => [...prev, request]);
  }, []);

  showDialog = show;

  const current = queue[0] ?? null;

  const dismiss = useCallback((button?: AlertButton) => {
    if (closing.current) return;
    closing.current = true;
    setQueue((prev) => prev.slice(1));
    // Run the handler after the dialog is gone, so a handler that opens
    // another dialog doesn't fight the one still on screen.
    setTimeout(() => {
      closing.current = false;
      button?.onPress?.();
    }, 0);
  }, []);

  const value = useMemo(() => show, [show]);

  // A dialog with no buttons still needs a way out.
  const buttons: AlertButton[] =
    current?.buttons && current.buttons.length > 0 ? current.buttons : [{ text: t.ok }];

  // Destructive styling propagates from the button to the whole dialog, so the
  // title reads as a warning before anyone gets to the buttons.
  const tone =
    current?.tone ?? (buttons.some((b) => b.style === 'destructive') ? 'danger' : 'info');

  const accent = tone === 'danger' ? colors.danger : tone === 'warn' ? colors.warn : colors.accent;

  return (
    <DialogContext.Provider value={value}>
      {children}

      <Modal
        visible={current !== null}
        transparent
        animationType="fade"
        // Android's back button and the web's Escape both land here.
        onRequestClose={() => dismiss(buttons.find((b) => b.style === 'cancel') ?? buttons[0])}
      >
        <View style={styles.scrim}>
          <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
            <View style={[styles.stripe, { backgroundColor: accent }]} />

            <View style={styles.body}>
              <Text style={[font(styles.title), align]}>{current?.title}</Text>
              {current?.message ? (
                <Text style={[font(styles.message), align]}>{current.message}</Text>
              ) : null}
            </View>

            <View style={styles.actions}>
              {buttons.map((button, index) => {
                const destructive = button.style === 'destructive';
                const cancel = button.style === 'cancel';
                return (
                  <Pressable
                    key={`${button.text ?? index}`}
                    accessibilityRole="button"
                    onPress={() => dismiss(button)}
                    style={({ pressed }) => [
                      styles.action,
                      index > 0 && styles.actionDivided,
                      pressed && styles.actionPressed,
                    ]}
                  >
                    <Text
                      style={[
                        font(styles.actionText),
                        destructive && { color: colors.danger },
                        cancel && { color: colors.inkMuted },
                        !destructive && !cancel && { color: accent },
                      ]}
                      numberOfLines={1}
                    >
                      {button.text ?? t.ok}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

/** For a screen that wants to raise a dialog with a hook rather than the shim. */
export function useDialog(): Show {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>.');
  return ctx;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: rule,
    borderColor: colors.rule,
  },
  /** The tone, stated before a word is read. */
  stripe: { height: 4, width: '100%' },
  body: { padding: spacing.xl, gap: spacing.sm },
  title: { ...type.h3, color: colors.ink },
  message: { ...type.body, color: colors.inkMuted },
  actions: { flexDirection: 'row', borderTopWidth: rule, borderTopColor: colors.rule },
  action: { flex: 1, paddingVertical: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  actionDivided: { borderLeftWidth: rule, borderLeftColor: colors.rule },
  actionPressed: { backgroundColor: colors.accentWash },
  actionText: { ...type.bodyStrong, textAlign: 'center' },
});
