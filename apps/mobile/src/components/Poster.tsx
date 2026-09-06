import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

/**
 * The posters that ship in the bundle, keyed by `Post.posterKey`.
 *
 * Metro resolves `require` at build time, so the paths have to be literal —
 * a key indirects to one instead of building the path from data. These are the
 * ten programme posters designed with the mosques; a mosque that uploads its
 * own gets an `imageUrl` and never comes through here.
 *
 * **Two formats on purpose.** The seven flat, few-colour designs stay PNG,
 * which encodes them smaller than JPEG can and without ringing around their
 * hard-edged text. The three photographs are JPEG: as PNG they were 2.6MB of
 * the bundle between them and are 262KB as JPEG, with nothing visible lost at
 * the size they render. Sort by what the artwork is, not by tidiness.
 */
const POSTER_ART = {
  'arabic-school': require('../../assets/posters/arabic-school.png'),
  'friday-dinner': require('../../assets/posters/friday-dinner.png'),
  'halaqat-dars': require('../../assets/posters/halaqat-dars.png'),
  'quran-classes': require('../../assets/posters/quran-classes.jpg'),
  'ramadan-iftar': require('../../assets/posters/ramadan-iftar.png'),
  'self-defence': require('../../assets/posters/self-defence.jpg'),
  'sisters-brunch': require('../../assets/posters/sisters-brunch.png'),
  soccer: require('../../assets/posters/soccer.jpg'),
  'summer-camp': require('../../assets/posters/summer-camp.png'),
  'zikr-madih': require('../../assets/posters/zikr-madih.png'),
} as const;

export type PosterKey = keyof typeof POSTER_ART;

/** True when this post has real artwork. Everything else is a text post. */
export function hasPosterArt(post: { imageUrl?: string; posterKey?: string }): boolean {
  return Boolean(post.imageUrl) || (!!post.posterKey && post.posterKey in POSTER_ART);
}

interface PosterProps {
  /** A poster the mosque uploaded. Takes precedence over `posterKey`. */
  imageUrl?: string;
  /** One of the bundled posters. Ignored when it names artwork we don't ship. */
  posterKey?: string;
  /** Kept so existing call sites compile; nothing depends on it any more. */
  seed?: string;
  aspect?: number;
  /** A fixed height instead of an aspect ratio — the feed's 200px band. */
  height?: number;
  /** Override the corner radius. The feed's full-bleed poster passes 0. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Poster({
  imageUrl,
  posterKey,
  aspect = 16 / 9,
  height,
  radius: corner,
  style,
}: PosterProps) {
  // An uploaded poster wins; a bundled one is what the fixtures name.
  const source = imageUrl
    ? { uri: imageUrl }
    : posterKey && posterKey in POSTER_ART
      ? POSTER_ART[posterKey as PosterKey]
      : null;

  // No artwork, no band. There used to be a generated geometric motif here,
  // but a decorative panel with no words in it takes a card's worth of screen
  // and tells the reader nothing - a post with no poster is simply a text
  // post, and reads better as one. Callers gate on `hasPosterArt` anyway;
  // this null is the backstop.
  if (!source) return null;

  return (
    <View
      style={[
        styles.frame,
        height !== undefined ? { height } : { aspectRatio: aspect },
        corner !== undefined && { borderRadius: corner },
        style,
      ]}
    >
      <Image source={source} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
  image: { width: '100%', height: '100%' },
});
