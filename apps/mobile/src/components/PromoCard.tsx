import { useEffect, useRef } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import type { ServedAd } from '@m-ensemble/shared';
import { reportAdEvent } from '@/api/ads';
import { resolveMediaUrl } from '@/api/http';
import { tap } from '@/lib/haptics';
import { colors, feedPadding, icon as iconSize, radius, rule, spacing, type } from '@/theme';

/**
 * A partner's card in the feed.
 *
 * **It must never be mistaken for a mosque's own post,** which is the entire
 * design constraint. So it is deliberately *unlike* a `PostCard`: no avatar, no
 * mosque name, a flat sunken ground instead of a white card, and a disclosure
 * line above the headline rather than tucked underneath it. If a reader has to
 * look twice to tell whether the mosque is recommending a restaurant, the card
 * has failed however well it performs.
 *
 * It is also smaller than the posts around it on purpose. The feed is a
 * noticeboard; a partner card that outweighs what the mosque published costs
 * more trust than the placement earns.
 */
export function PromoCard({ ad }: { ad: ServedAd }): React.JSX.Element {
  const counted = useRef(false);

  /**
   * One impression per card per mount.
   *
   * The ref rather than component state because a re-render must not count
   * again — the feed re-renders on every filter change and every refresh, and
   * a counter that moved with them would bill a partner for one reader many
   * times over.
   */
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    reportAdEvent(ad.campaignId, 'impression');
  }, [ad.campaignId]);

  const open = () => {
    tap();
    reportAdEvent(ad.campaignId, 'click');
    // The link leaves the app by design, and the reader is told so by the
    // arrow on the button. `canOpenURL` is skipped: the server has already
    // pinned the scheme to http(s), and a false negative from a platform
    // handler check would silently do nothing on a tap.
    void Linking.openURL(ad.ctaUrl).catch(() => {
      /* nothing useful to say to the reader if the browser will not open */
    });
  };

  const image = resolveMediaUrl(ad.imageUrl);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.card}
        onPress={open}
        accessibilityRole="link"
        accessibilityLabel={`${ad.disclosure}. ${ad.headline}. ${ad.body}`}
        accessibilityHint="Opens in your browser"
      >
        <Text style={styles.disclosure} numberOfLines={1}>
          {ad.disclosure.toUpperCase()}
        </Text>

        {image ? <Image source={{ uri: image }} style={styles.image} resizeMode="cover" /> : null}

        <Text style={styles.headline} numberOfLines={2}>
          {ad.headline}
        </Text>
        <Text style={styles.body} numberOfLines={3}>
          {ad.body}
        </Text>

        <View style={styles.cta}>
          <Text style={styles.ctaLabel}>{ad.ctaLabel}</Text>
          <ArrowUpRight size={iconSize.sm} color={colors.accent} strokeWidth={2.2} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: feedPadding, paddingVertical: spacing.sm },
  card: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.lg,
    borderWidth: rule,
    borderColor: colors.rule,
    padding: spacing.md,
  },
  disclosure: {
    ...type.overline,
    color: colors.inkFaint,
    marginBottom: spacing.xs,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.rule,
  },
  headline: { ...type.title, color: colors.ink, marginBottom: 2 },
  body: { ...type.small, color: colors.inkMuted },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  ctaLabel: { ...type.smallStrong, color: colors.accent },
});
