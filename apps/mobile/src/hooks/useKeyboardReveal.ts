import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  TextInput,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

/** Breathing room kept between the focused field and the top of the keyboard. */
const MARGIN = 16;

/**
 * Keeps the focused field above the keyboard on a scrolling form.
 *
 * `KeyboardAvoidingView` only ever worked on iOS here, and on Android the
 * window is not reliably resized for the keyboard once the app draws
 * edge-to-edge — so the keyboard simply covered the sign-in fields. This
 * measures instead of guessing: when the keyboard shows, whatever part of the
 * ScrollView it covers becomes bottom padding (so the content can scroll that
 * far), and the focused input is scrolled up until it clears the keyboard.
 * On a platform that did resize the window, the covered part measures as
 * zero and nothing extra is padded.
 *
 * On web the browser already scrolls the focused field into view, so the
 * hook is a no-op there.
 */
export function useKeyboardReveal() {
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [keyboardPad, setKeyboardPad] = useState(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // iOS announces the keyboard before it animates in, so the content can
    // move with it. Android only fires the "did" events, and fires them after
    // any window resize, which is exactly when measuring is safe.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      const keyboardTop = e.endCoordinates.screenY;
      requestAnimationFrame(() => {
        const scroll = scrollRef.current?.getNativeScrollRef();
        if (!scroll) return;
        scroll.measureInWindow((_x, y, _w, h) => {
          setKeyboardPad(Math.max(0, Math.ceil(y + h - keyboardTop)));

          const input = TextInput.State.currentlyFocusedInput();
          if (!input) return;
          input.measureInWindow((_ix, iy, _iw, ih) => {
            const overflow = iy + ih + MARGIN - keyboardTop;
            if (overflow <= 0) return;
            const target = offset.current + overflow;
            // Next frame, so the padding above has landed and the scroll view
            // is tall enough to reach the target.
            requestAnimationFrame(() => {
              scrollRef.current?.scrollTo({ y: target, animated: true });
            });
          });
        });
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardPad(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { scrollRef, keyboardPad, onScroll };
}
