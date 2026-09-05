import { Pressable, StyleSheet, Text } from 'react-native';
import { useLang } from '@/i18n';
import { select } from '@/lib/haptics';
import { colors, radius, spacing, type } from '@/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** The filled-teal treatment (feed filters) vs. the washed one (interests). */
  variant?: 'solid' | 'wash';
}

/**
 * The prototype's pill filter: 20px radius, 1.5px border, teal fill when on.
 */
export function Chip({ label, selected, onPress, variant = 'solid' }: ChipProps) {
  const { font } = useLang();
  const on = selected;
  const solid = variant === 'solid';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        on && (solid ? styles.solidOn : styles.washOn),
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          font(styles.label),
          on && (solid ? styles.solidLabel : styles.washLabel),
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg - 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.rule,
    backgroundColor: 'transparent',
  },
  solidOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  washOn: { backgroundColor: colors.accentWash, borderColor: colors.accent },
  pressed: { opacity: 0.7 },
  label: { ...type.captionStrong, fontSize: 12.5, color: colors.inkMuted },
  solidLabel: { color: colors.inkInverse },
  washLabel: { color: colors.accent },
});
