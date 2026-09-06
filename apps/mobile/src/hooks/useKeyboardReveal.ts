import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
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

interface Form {
  scroll: RefObject<ScrollView | null>;
  offset: RefObject<number>;
}

/**
 * Every form using the hook, in mount order — the last one is the screen on
 * top, and so the only one whose fields can be focused.
 *
 * A module-level list rather than a React context because `Field` has to reach
 * it from anywhere in the tree, and a context would mean every form
 * remembering to wrap itself in a provider.
 */
const forms: Form[] = [];

/** The keyboard's top edge while it is open, and null while it is not. */
let keyboardTop: number | null = null;

/** Scrolls the form until the focused input sits clear of the keyboard. */
function reveal(form: Form, top: number): void {
  const input = TextInput.State.currentlyFocusedInput();
  if (!input) return;
  input.measureInWindow((_x, y, _w, h) => {
    const overflow = y + h + MARGIN - top;
    if (overflow <= 0) return;
    form.scroll.current?.scrollTo({ y: form.offset.current + overflow, animated: true });
  });
}

/**
 * Brings the field that has just taken focus above the keyboard.
 *
 * Moving from one field to the next fires no keyboard event — the keyboard
 * never went away — so the listener below never runs, and on a long form the
 * second field tapped stays under the keyboard. `Field` calls this on focus.
 * With the keyboard closed, or on a screen that does not use the hook, it does
 * nothing and the listener does the work instead.
 */
export function revealFocusedField(): void {
  const top = keyboardTop;
  const form = forms[forms.length - 1];
  if (Platform.OS === 'web' || top === null || !form) return;
  // A frame later: focus has moved, but the input it moved to has not
  // necessarily been laid out where it will finally sit.
  requestAnimationFrame(() => reveal(form, top));
}

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

    const form: Form = { scroll: scrollRef, offset };
    forms.push(form);

    // iOS announces the keyboard before it animates in, so the content can
    // move with it. Android only fires the "did" events, and fires them after
    // any window resize, which is exactly when measuring is safe.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      const top = e.endCoordinates.screenY;
      keyboardTop = top;
      requestAnimationFrame(() => {
        const scroll = scrollRef.current?.getNativeScrollRef();
        if (!scroll) return;
        scroll.measureInWindow((_x, y, _w, h) => {
          setKeyboardPad(Math.max(0, Math.ceil(y + h - top)));
          // Next frame, so the padding above has landed and the scroll view
          // is tall enough to reach the target.
          requestAnimationFrame(() => reveal(form, top));
        });
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardTop = null;
      setKeyboardPad(0);
    });

    return () => {
      show.remove();
      hide.remove();
      forms.splice(forms.indexOf(form), 1);
    };
  }, []);

  return { scrollRef, keyboardPad, onScroll };
}
