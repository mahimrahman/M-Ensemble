import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { dayLabel, mosqueDate } from '@/lib/datetime';
import { colors, numeric, radius, rule, spacing, type } from '@/theme';
import type { DateString } from '@/types';

interface DayChipsProps {
  value: DateString;
  onChange: (date: DateString) => void;
  /** How many days ahead to offer. */
  days?: number;
}

/** Horizontal strip of the next N days — the date picker we can afford. */
export function DayChips({ value, onChange, days = 14 }: DayChipsProps) {
  const options = Array.from({ length: days }, (_, i) => mosqueDate(i));
  // An edit may sit on a date outside the strip; keep it selectable.
  if (!options.includes(value)) options.unshift(value);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((date) => {
        const selected = date === value;
        const { weekday, day } = dayLabel(date);
        return (
          <Pressable
            key={date}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(date)}
            style={[styles.chip, selected && styles.selected]}
          >
            <Text style={[styles.weekday, selected && styles.selectedText]}>
              {weekday.toUpperCase()}
            </Text>
            <Text style={[styles.day, selected && styles.selectedText]}>{day}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  chip: {
    width: 52,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xxs,
    borderRadius: radius.lg,
    borderWidth: rule,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekday: { ...type.overline, fontSize: 10, color: colors.inkFaint },
  day: { ...type.title, ...numeric, color: colors.ink },
  selectedText: { color: colors.inkInverse },
});
