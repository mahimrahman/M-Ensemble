import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, hitSize, icon, spacing, type } from '@/theme';

interface BackBarProps {
  title?: string;
  right?: ReactNode;
}

/** Back arrow, optional left-aligned title, optional action. */
export function BackBar({ title, right }: BackBarProps) {
  const router = useRouter();

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <ArrowLeft color={colors.ink} size={icon.lg} strokeWidth={2} />
      </Pressable>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  back: {
    width: hitSize,
    height: hitSize,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    marginLeft: -spacing.md,
    paddingLeft: spacing.md,
  },
  pressed: { opacity: 0.5 },
  title: { ...type.title, color: colors.ink, flex: 1 },
  spacer: { flex: 1 },
});
