import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLang } from '@/i18n';
import { colors, numeric, radius, spacing, type } from '@/theme';

interface StatProps {
  value: string;
  label: string;
  /** `onDark` is the frosted tile on a gradient; `onLight` sits on the page. */
  tone?: 'onDark' | 'onLight';
}

/**
 * One big mono figure over a muted label — the pair of tiles under the "À
 * venir" heading in the prototype's My Stuff header.
 */
export function Stat({ value, label, tone = 'onDark' }: StatProps) {
  const { align, font } = useLang();
  const dark = tone === 'onDark';

  return (
    <View style={[styles.tile, dark ? styles.tileDark : styles.tileLight]}>
      <Text style={[styles.value, dark ? styles.valueDark : styles.valueLight]}>{value}</Text>
      <Text
        style={[
          font(styles.label),
          dark ? styles.labelDark : styles.labelLight,
          align,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** Two or three `Stat`s side by side, sharing the width evenly. */
export function StatRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { row } = useLang();
  return <View style={[styles.row, row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { gap: 10 },
  tile: { flex: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  tileDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  tileLight: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule },
  value: { ...type.monoHero, ...numeric },
  valueDark: { color: colors.inkInverse },
  valueLight: { color: colors.accent },
  label: { ...type.caption, marginTop: 2 },
  labelDark: { color: 'rgba(255,255,255,0.55)' },
  labelLight: { color: colors.inkMuted },
});
