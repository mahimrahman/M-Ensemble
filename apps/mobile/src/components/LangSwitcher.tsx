import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LANGS, LANG_LABEL, useLang, type Lang } from '@/i18n';
import { select } from '@/lib/haptics';
import { colors, radius, spacing, type } from '@/theme';

interface LangSwitcherProps {
  /** `onDark` for the gradient header, `onLight` for a settings row. */
  tone?: 'onDark' | 'onLight';
  style?: StyleProp<ViewStyle>;
}

/**
 * FR · EN · عر. The prototype floats this above the phone frame; on a real
 * device it belongs in the header of the profile screen and in the corner of
 * the feed masthead, which is where the two callers put it.
 */
export function LangSwitcher({ tone = 'onDark', style }: LangSwitcherProps) {
  const { lang, setLang } = useLang();
  const dark = tone === 'onDark';

  return (
    <View style={[styles.track, dark ? styles.trackDark : styles.trackLight, style]}>
      {LANGS.map((value: Lang) => {
        const on = value === lang;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={LANG_LABEL[value]}
            onPress={() => {
              select();
              setLang(value);
            }}
            style={({ pressed }) => [
              styles.pill,
              on && (dark ? styles.pillOnDark : styles.pillOnLight),
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                on
                  ? dark
                    ? styles.labelOnDark
                    : styles.labelOnLight
                  : dark
                    ? styles.labelOffDark
                    : styles.labelOffLight,
              ]}
            >
              {LANG_LABEL[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  trackDark: { backgroundColor: 'rgba(6,30,27,0.55)' },
  trackLight: { backgroundColor: colors.surfaceSunken },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill - 4,
  },
  pillOnDark: { backgroundColor: colors.accent },
  pillOnLight: { backgroundColor: colors.accent },
  pressed: { opacity: 0.7 },
  label: { ...type.tiny, fontSize: 12, letterSpacing: 0.5 },
  labelOnDark: { color: colors.inkInverse },
  labelOnLight: { color: colors.inkInverse },
  labelOffDark: { color: 'rgba(255,255,255,0.55)' },
  labelOffLight: { color: colors.inkMuted },
});
