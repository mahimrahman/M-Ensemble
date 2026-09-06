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

import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
  style?: StyleProp<ViewStyle>;
  /** Screen readers announce the brand once per screen; hide the rest. */
  label?: string;
}

export function Logo({
  variant = 'lockup',
  tone = 'onDark',
  height = 64,
  style,
  label,
}: LogoProps) {
  const art = ART[variant];

  return (
    <View
      style={[styles.frame, { height, width: height * art.aspect }, style]}
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
