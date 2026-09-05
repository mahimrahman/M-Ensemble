import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { tap } from '@/lib/haptics';
import { colors, icon, spacing, type } from '@/theme';

interface BackBarProps {
  /** `onDark` sits on a gradient header; `onLight` on the page body. */
  tone?: 'onDark' | 'onLight';
  label?: string;
  onPress?: () => void;
}

/**
 * The prototype's "← Retour" — a text link, not a chrome button, sitting at
 * the top-left of the gradient header. In Arabic it becomes "رجوع →" and
 * moves to the right, which is why the arrow is a component and not a glyph
 * baked into the string.
 */
export function BackBar({ tone = 'onDark', label, onPress }: BackBarProps) {
  const router = useRouter();
  const { t, isAr } = useLang();
  const dark = tone === 'onDark';
  const Arrow = isAr ? ArrowRight : ArrowLeft;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? t.back}
      hitSlop={12}
      onPress={() => {
        tap();
        if (onPress) onPress();
        else if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <View style={[styles.row, isAr && styles.rowAr]}>
        <Arrow color={dark ? 'rgba(255,255,255,0.7)' : colors.inkMuted} size={icon.sm} strokeWidth={2} />
        <Text style={[styles.label, dark ? styles.onDark : styles.onLight]}>
          {label ?? t.back}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { alignSelf: 'flex-start', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowAr: { flexDirection: 'row-reverse' },
  pressed: { opacity: 0.6 },
  label: { ...type.small },
  onDark: { color: 'rgba(255,255,255,0.7)' },
  onLight: { color: colors.inkMuted },
});
