/**
 * The mosque's pages elsewhere, as a row of round icon buttons in the brand
 * teal — the shape this pattern takes everywhere, so it needs no explaining.
 *
 * Most of what a mosque announces never becomes a post — the funeral prayer
 * after asr, the class that moved rooms. This is the row that says where the
 * rest of it lives, so the app can be honest about not being the whole story.
 *
 * **The glyphs are drawn here rather than imported.** Lucide dropped its brand
 * icons in v1, and pasting the official logo paths would put filled brand marks
 * next to the app's outline set. These are outline marks in lucide's own
 * language — 24 viewBox, 1.8 stroke, round joins — so the row reads as part of
 * the app rather than as seven pasted logos.
 *
 * No text beside them: at this size the marks carry themselves, and a screen
 * reader gets the platform name from `accessibilityLabel` either way.
 */

import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { SOCIAL_LABEL, socialLinks, type MosqueSocial, type SocialPlatform } from '@/types';
import { useLang } from '@/i18n';
import { tap } from '@/lib/haptics';
import { colors, radius, spacing } from '@/theme';

/** The teal disc, and the glyph drawn on it. */
const BUTTON = 40;
const GLYPH_SIZE = 20;

interface GlyphProps {
  size: number;
  color: string;
}

const STROKE = {
  fill: 'none',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Frame({ size, color, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...STROKE}>
      {children}
    </Svg>
  );
}

const GLYPH: Record<SocialPlatform, (props: GlyphProps) => React.ReactElement> = {
  facebook: (p) => (
    <Frame {...p}>
      <Path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Frame>
  ),
  instagram: (p) => (
    <Frame {...p}>
      <Rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <Path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <Line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </Frame>
  ),
  youtube: (p) => (
    <Frame {...p}>
      <Path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <Path d="m10 15 5-3-5-3z" />
    </Frame>
  ),
  tiktok: (p) => (
    <Frame {...p}>
      {/* The descender and its hook, then the flick to the top right. */}
      <Path d="M14 4v11a4 4 0 1 1-4-4" />
      <Path d="M14 4c.4 2.5 2.4 4.3 5 4.5" />
    </Frame>
  ),
  x: (p) => (
    <Frame {...p}>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Frame>
  ),
  whatsapp: (p) => (
    <Frame {...p}>
      <Path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z" />
    </Frame>
  ),
  telegram: (p) => (
    <Frame {...p}>
      <Path d="m22 2-7 20-4-9-9-4z" />
      <Path d="M22 2 11 13" />
    </Frame>
  ),
};

interface SocialLinksProps {
  social?: MosqueSocial;
}

/** Renders nothing at all when the mosque has told us about no pages. */
export function SocialLinks({ social }: SocialLinksProps) {
  const { row } = useLang();
  const links = socialLinks(social);
  if (links.length === 0) return null;

  return (
    <View style={[styles.wrap, row]}>
      {links.map(({ platform, url }) => {
        const Glyph = GLYPH[platform];
        return (
          <Pressable
            key={platform}
            accessibilityRole="link"
            accessibilityLabel={SOCIAL_LABEL[platform]}
            onPress={() => {
              tap();
              void Linking.openURL(url).catch(() => {});
            }}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Glyph size={GLYPH_SIZE} color={colors.inkInverse} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // A mosque running all seven would overflow one line of a phone; wrapping is
  // the layout, not a fallback for it.
  wrap: { flexWrap: 'wrap', gap: spacing.sm },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    // Solid brand teal with a white mark — the same weight a primary Button
    // carries, because tapping one leaves the app and that is worth looking
    // like a real control rather than a tinted label.
    backgroundColor: colors.accent,
  },
  pressed: { opacity: 0.75 },
});
