import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LANGS, LANG_LABEL, useLang, type Lang } from '@/i18n';
import { select } from '@/lib/haptics';
import { colors, radius, spacing, type } from '@/theme';

interface LangSwitcherProps {
  /** `onDark` for the gradient header, `onLight` for a settings row. */
  tone?: 'onDark' | 'onLight';
  /**
   * `pill` is the compact FR · EN · عر cluster for a header corner.
   * `block` fills the width with one row per language, each labelled in its
   * own language - what a settings card wants. The pill version squeezed three
   * two-letter chips against one edge of a wide card, which read as leftover
   * space rather than a control.
   */
  layout?: 'pill' | 'block';
  style?: StyleProp<ViewStyle>;
}

/** Each language named in itself - nobody should have to read a foreign word to find their own. */
const LANG_NATIVE: Record<Lang, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

/**
 * FR · EN · عر. The prototype floats this above the phone frame; on a real
 * device it belongs in the header of the profile screen and in the corner of
 * the feed masthead, which is where the two callers put it.
 */
export function LangSwitcher({ tone = 'onDark', layout = 'pill', style }: LangSwitcherProps) {
  const { lang, setLang } = useLang();
  const dark = tone === 'onDark';

  if (layout === 'block') {
    return (
      <View style={[styles.block, style]} accessibilityRole="radiogroup">
        {LANGS.map((value: Lang) => {
          const on = value === lang;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={LANG_NATIVE[value]}
              onPress={() => {
                select();
                setLang(value);
              }}
              style={({ pressed }) => [
                styles.blockRow,
                on && styles.blockRowOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.blockName, on && styles.blockNameOn]}>{LANG_NATIVE[value]}</Text>
              <Text style={[styles.blockCode, on && styles.blockCodeOn]}>{LANG_LABEL[value]}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

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
  block: { flexDirection: 'row', gap: spacing.sm },
  blockRow: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
  },
  blockRowOn: { borderColor: colors.accent, backgroundColor: colors.accentWash },
  blockName: { ...type.bodyStrong, color: colors.inkMuted },
  blockNameOn: { color: colors.accent },
  blockCode: { ...type.tiny, fontSize: 11, letterSpacing: 0.5, color: colors.inkFaint },
  blockCodeOn: { color: colors.accent },
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
