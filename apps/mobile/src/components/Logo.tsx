/**
 * The M'Ensemble mark.
 *
 * Two artworks, each in a light and a dark cut:
 *
 *   `lockup`  crescent + figures + wordmark + "Répondre présent". The cover
 *             art — auth screens and anywhere the brand introduces itself.
 *   `mark`    crescent + figures alone. For tight spots: a header, a tab bar,
 *             an avatar-sized slot where the wordmark would be unreadable.
 *
 * `tone` picks the cut. `onDark` is the one recoloured for the teal gradient —
 * the master's black crescent becomes white there, so the shape survives.
 * Pass a `height`; the width follows from the artwork's own aspect ratio.
 */

import {
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { screenPadding } from '@/theme';

const ART = {
  lockup: {
    onLight: require('../../assets/logo.png'),
    onDark: require('../../assets/logo-on-dark.png'),
    aspect: 1343 / 337,
  },
  mark: {
    onLight: require('../../assets/logo-mark.png'),
    onDark: require('../../assets/logo-mark-on-dark.png'),
    aspect: 349 / 337,
  },
} as const;

export type LogoVariant = keyof typeof ART;
export type LogoTone = 'onLight' | 'onDark';

interface LogoProps {
  variant?: LogoVariant;
  /** `onDark` for the gradient, `onLight` for paper. Mirrors LangSwitcher. */
  tone?: LogoTone;
  /** Rendered height in px. Width is derived so the artwork never distorts. */
  height?: number;
  /**
   * The widest the artwork may draw, as a fraction of the screen. The lockup
   * is nearly 4:1, so a height that looks modest becomes wider than a phone —
   * `height={92}` alone is 366px on a 390px screen. Height gives way when it
   * would breach this; the aspect ratio is preserved either way.
   */
  maxWidthRatio?: number;
  style?: StyleProp<ViewStyle>;
  /** Screen readers announce the brand once per screen; hide the rest. */
  label?: string;
}

export function Logo({
  variant = 'lockup',
  tone = 'onDark',
  height = 64,
  maxWidthRatio = 0.62,
  style,
  label,
}: LogoProps) {
  const art = ART[variant];
  const { width: screenWidth } = useWindowDimensions();

  // Fit to whichever runs out first — the height asked for, or the width the
  // screen can spare. Both stay on the artwork's own ratio, so it never
  // distorts and never runs into the gutters.
  const maxWidth = Math.max(0, screenWidth - screenPadding * 2) * maxWidthRatio;
  const drawnHeight = Math.min(height, maxWidth / art.aspect);

  return (
    <View
      style={[styles.frame, { height: drawnHeight, width: drawnHeight * art.aspect }, style]}
      accessibilityRole="image"
      {...(label
        ? { accessibilityLabel: label }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' })}
    >
      <Image source={art[tone]} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
