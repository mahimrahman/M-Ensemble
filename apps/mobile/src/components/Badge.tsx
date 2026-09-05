import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLang } from '@/i18n';
import { colors, radius, spacing, type } from '@/theme';

export type BadgeTone = 'neutral' | 'accent' | 'attention' | 'danger' | 'onDark';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Small rounded rect (post types) vs. full pill ("Covered ✓"). */
  shape?: 'tag' | 'pill';
  style?: StyleProp<ViewStyle>;
}

const tones: Record<BadgeTone, { fg: string; bg: string }> = {
  neutral: { fg: colors.inkMuted, bg: colors.surfaceSunken },
  accent: { fg: colors.accent, bg: colors.accentWashStrong },
  attention: { fg: colors.attention, bg: colors.accentWash },
  danger: { fg: colors.danger, bg: colors.dangerWash },
  onDark: { fg: colors.dark, bg: colors.live },
};

/**
 * A filled label. The prototype uses these for the post-type tag next to the
 * mosque name and for the "Complet ✓" pill on a covered shift.
 */
export function Badge({ label, tone = 'neutral', shape = 'tag', style }: BadgeProps) {
  const { font } = useLang();
  const { fg, bg } = tones[tone];

  return (
    <View
      style={[
        styles.badge,
        shape === 'pill' ? styles.pill : styles.tag,
        { backgroundColor: bg },
        style,
      ]}
    >
      <Text style={[font(styles.label), { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', justifyContent: 'center' },
  tag: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: radius.sm },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2.5, borderRadius: radius.pill },
  label: { ...type.tiny },
});
