import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { tap } from '@/lib/haptics';
import { colors, radius, rule, spacing } from '@/theme';

interface CardProps {
  children: ReactNode;
  /** Pass to make the whole card a tap target. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Draws the card as selected (map ↔ list linkage). */
  selected?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A white 12px-radius block on the pale body, hairline-bordered. This is the
 * shape every panel in the prototype takes — schedule, slots, description,
 * interests, notifications.
 */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  selected = false,
  padded = true,
  style,
}: CardProps) {
  const body = <View style={padded ? styles.padding : undefined}>{children}</View>;

  if (!onPress) {
    return <View style={[styles.card, selected && styles.selected, style]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: rule,
    borderColor: colors.rule,
    overflow: 'hidden',
  },
  selected: { borderColor: colors.ruleStrong, borderWidth: 1.5, backgroundColor: '#EDF7F6' },
  pressed: { opacity: 0.85 },
  padding: { padding: spacing.lg, gap: spacing.md },
});
