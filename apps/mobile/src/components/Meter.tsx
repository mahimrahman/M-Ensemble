import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { colors, numeric, radius, spacing, type } from '@/theme';
import { Badge } from './Badge';

interface MeterProps {
  filled: number;
  total: number;
  /** "volunteers" for slots, "going" for event capacity. */
  noun?: string;
  /** Just the bar, no caption — for a row that already says the numbers. */
  bare?: boolean;
}

/**
 * The prototype's `SlotBar`: a mono count on the left, a "Complet ✓" pill on
 * the right once it's covered, and a 4px track that animates as it fills.
 */
export function Meter({ filled, total, noun, bare = false }: MeterProps) {
  const { t, row, font } = useLang();
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(filled / safeTotal, 1);
  const covered = filled >= total;

  const width = useRef(new Animated.Value(ratio)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: ratio,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [ratio, width]);

  const pct = width.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.wrap}>
      {!bare ? (
        <View style={[styles.row, row]}>
          <Text style={[styles.figure, covered && styles.figureCovered]}>
            {filled}/{total} <Text style={font(styles.noun)}>{noun ?? t.volunteers}</Text>
          </Text>
          {covered ? <Badge label={`${t.full} ✓`} tone="accent" shape="pill" /> : null}
        </View>
      ) : null}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: pct }, covered && styles.fillCovered]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  row: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  figure: { ...type.monoSmall, ...numeric, color: colors.inkMuted },
  figureCovered: { color: colors.accent },
  noun: { ...type.caption, color: colors.inkMuted },
  track: {
    height: 4,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm + 6,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.attention, borderRadius: radius.sm + 6 },
  fillCovered: { backgroundColor: colors.accent },
});
