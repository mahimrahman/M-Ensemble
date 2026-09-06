import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { colors, radius, rule, spacing, type } from '@/theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Two-to-four mutually exclusive choices. One outline, divided. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const { font, row } = useLang();
  return (
    <View style={[styles.track, row]} accessibilityRole="radiogroup">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            hitSlop={{ top: 2, bottom: 2 }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, index > 0 && styles.divided, selected && styles.selected]}
          >
            <Text
              style={[font(styles.label), selected && styles.selectedLabel]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  // A start-side rule between segments; `row` may reverse the strip, and the
  // rule stays between neighbours either way.
  divided: { borderStartWidth: rule, borderStartColor: colors.rule },
  selected: { backgroundColor: colors.accent },
  label: { ...type.smallStrong, color: colors.inkMuted },
  selectedLabel: { color: colors.inkInverse },
});
