import { useRouter } from 'expo-router';
import { ChevronDown, MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLang } from '@/i18n';
import { cityName } from '@/lib/cities';
import { tap } from '@/lib/haptics';
import { useLocation } from '@/store/location';
import { colors, icon, radius, spacing, type } from '@/theme';

interface LocationPillProps {
  /** `onDark` sits on a gradient header; `onLight` on the filter strip. */
  tone?: 'onDark' | 'onLight';
  style?: StyleProp<ViewStyle>;
}

/**
 * "📍 Montréal ⌄" — which city the screen is showing. Tinted when it isn't
 * the one you're standing in, so browsing never gets mistaken for home.
 * Tapping opens the cities screen.
 */
export function LocationPill({ tone = 'onLight', style }: LocationPillProps) {
  const router = useRouter();
  const { t, lang, isAr, font } = useLang();
  const { browsingCity, isBrowsingElsewhere } = useLocation();
  const dark = tone === 'onDark';

  const tint = dark ? colors.inkInverse : isBrowsingElsewhere ? colors.attention : colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.changeCity}
      hitSlop={6}
      onPress={() => {
        tap();
        router.push('/cities');
      }}
      style={({ pressed }) => [
        styles.pill,
        dark ? styles.pillDark : isBrowsingElsewhere ? styles.pillElsewhere : styles.pillLight,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.row, isAr && styles.rowAr]}>
        <MapPin color={tint} size={icon.sm} strokeWidth={2} />
        <Text style={[font(styles.label), { color: tint }]} numberOfLines={1}>
          {cityName(browsingCity, lang)}
        </Text>
        <ChevronDown color={tint} size={icon.xs} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  pillLight: { borderColor: colors.accent, backgroundColor: colors.accentWash },
  pillElsewhere: { borderColor: colors.attention, backgroundColor: colors.accentWash },
  pillDark: { borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.12)' },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowAr: { flexDirection: 'row-reverse' },
  label: { ...type.captionStrong, fontSize: 12.5 },
});
