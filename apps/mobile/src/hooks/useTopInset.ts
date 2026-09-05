import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The prototype's phone frame keeps a 44px status bar above every masthead.
 * A real device reports that through the safe-area inset; a browser preview
 * reports zero, which lands the title hard against the top edge. This floors
 * the inset so the gradient always breathes the way the prototype does.
 */
const MIN_TOP = Platform.OS === 'web' ? 28 : 0;

export function useTopInset(): number {
  const { top } = useSafeAreaInsets();
  return Math.max(top, MIN_TOP);
}
