import type { LucideIcon } from 'lucide-react-native';
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useLang } from '@/i18n';
import { tap } from '@/lib/haptics';
import {
  colors,
  ctaShadow,
  hitSize,
  icon as iconSize,
  radius,
  rule,
  spacing,
  type,
} from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'muted';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the width of the parent — the default for primary actions. */
  fullWidth?: boolean;
  /** Primary buttons cast the one shadow in the app. Off for buttons in rows. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

const fills: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.accent },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.rule,
  },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: spacing.sm },
  danger: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.dangerBorder },
  /** For use on a dark gradient. */
  inverse: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: rule, borderColor: 'rgba(255,255,255,0.22)' },
  /** A filled-but-inert action — "Full", or withdraw. */
  muted: { backgroundColor: colors.surfaceSunken },
};

const labelColors: Record<ButtonVariant, string> = {
  primary: colors.inkInverse,
  secondary: colors.accent,
  ghost: colors.accent,
  danger: colors.danger,
  inverse: colors.inkInverse,
  muted: colors.inkMuted,
};

/**
 * The prototype's button: a 14px-radius pill of teal that dips very slightly
 * when you press it, with the one soft shadow in the design.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  elevated,
  style,
}: ButtonProps) {
  const { font, isAr } = useLang();
  const inactive = disabled || loading;
  const tint = labelColors[variant];
  const scale = useRef(new Animated.Value(1)).current;

  const lifts = elevated ?? (variant === 'primary' && size === 'lg');

  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();

  const labelStyle = font(size === 'sm' ? styles.labelSm : styles.label);

  return (
    <Animated.View
      style={[
        fullWidth && styles.fullWidth,
        { transform: [{ scale }] },
        lifts && !inactive && ctaShadow,
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy: loading }}
        accessibilityLabel={label}
        onPress={() => {
          tap();
          onPress();
        }}
        onPressIn={() => spring(0.97)}
        onPressOut={() => spring(1)}
        disabled={inactive}
        style={({ pressed }) => [
          styles.base,
          fills[variant],
          size === 'lg' && styles.lg,
          size === 'sm' && styles.sm,
          pressed && styles.pressed,
          inactive && styles.inactive,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={tint} size="small" />
        ) : (
          <View style={[styles.content, isAr && styles.contentAr]}>
            {Icon ? <Icon color={tint} size={size === 'sm' ? iconSize.sm : iconSize.md} strokeWidth={2} /> : null}
            <Text style={[labelStyle, { color: tint }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hitSize,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: { minHeight: 52, borderRadius: radius.xl },
  sm: { minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radius.md },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contentAr: { flexDirection: 'row-reverse' },
  label: { ...type.title, fontSize: 15 },
  labelSm: { ...type.captionStrong },
});
