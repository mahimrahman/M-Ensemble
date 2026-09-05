import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';

interface LoadingProps {
  label?: string;
  /** `inline` sits in a list; `block` fills the space it is given. */
  variant?: 'block' | 'inline';
}

export function Loading({ label, variant = 'block' }: LoadingProps) {
  return (
    <View style={variant === 'block' ? styles.block : styles.inline}>
      <ActivityIndicator color={colors.accent} size="small" />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

/** Grey bar to hold a shape while its data arrives. */
export function Skeleton({
  height = 16,
  width = '100%',
}: {
  height?: number;
  width?: number | `${number}%`;
}) {
  return <View style={[styles.skeleton, { height, width }]} />;
}

const styles = StyleSheet.create({
  block: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  label: { ...type.small, color: colors.inkMuted },
  skeleton: { backgroundColor: colors.surfaceSunken, borderRadius: radius.sm },
});
