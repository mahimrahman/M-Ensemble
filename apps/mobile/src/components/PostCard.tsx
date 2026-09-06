import { Bookmark, Heart, MoveRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLang, type Strings } from '@/i18n';
import { formatAgo } from '@/lib/datetime';
import { formatTime } from '@/lib/format';
import { select, tap } from '@/lib/haptics';
import { useSaved } from '@/store/saved';
import {
  colors,
  feedPadding,
  icon as iconSize,
  numeric,
  postTypeColors,
  radius,
  rule,
  spacing,
  type,
} from '@/theme';
import type { Post, PostType } from '@/types';
import { Meter } from './Meter';
import { hasPosterArt, Poster } from './Poster';

/** The type tag's label, in the active language. */
export function postTypeLabel(t: Strings, postType: PostType): string {
  return t[postType];
}

/**
 * True only when the post has real artwork to show.
 *
 * It used to mean "is an event or a class", on the assumption those always got
 * a picture - but a post with no poster then rendered a generated geometric
 * panel that said nothing. Now the type doesn't decide it; having a poster
 * does, and everything else is a text post.
 */
export function isPosterPost(post: Post): boolean {
  return hasPosterArt(post);
}

interface PostCardProps {
  post: Post;
  /** Shown next to the avatar. Omit on a mosque's own page. */
  mosqueName?: string;
  /** Adds the "you're in" mark. */
  committed?: boolean;
  onPress: () => void;
}

/**
 * One post in the feed, in the prototype's social shape:
 *
 *   avatar + mosque + "in 23 min" + type tag        header
 *   title, two lines of description, a time pill    body
 *   the poster image, full-bleed                    media
 *   the slot bar, if it's a volunteer request       status
 *   ♡  |  → sign me up                              actions
 *
 * The unfilled-volunteer dot in the header is the one bit of urgency in the
 * design — a teal pip with a halo, so a shift that still needs people is
 * visible while scrolling past at speed.
 */
export function PostCard({ post, mosqueName, committed = false, onPress }: PostCardProps) {
  const { t, lang, isAr, align, row, font } = useLang();
  const { isLiked, isSaved, toggleLiked, toggleSaved } = useSaved();
  const liked = isLiked(post._id);
  const saved = isSaved(post._id);

  const cfg = postTypeColors[post.type];
  const initial = (mosqueName ?? '?').trim().charAt(0).toUpperCase();
  const needed = post.type === 'volunteer' ? (post.slotsNeeded ?? null) : null;
  const short = needed !== null && post.slotsFilled < needed;
  const cancelled = !!post.cancelledAt;

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <View style={[styles.header, row]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.headerText}>
          <Text style={[font(styles.mosque), align]} numberOfLines={1}>
            {mosqueName ?? '-'}
          </Text>
          <View style={[styles.metaRow, row]}>
            <Text style={font(styles.ago)}>
              {t.in} {formatAgo(post.createdAt, lang)}
            </Text>
            <Text style={styles.dot}>·</Text>
            <View style={[styles.tag, { backgroundColor: cfg.bg }]}>
              <Text style={[font(styles.tagText), { color: cfg.color }]}>
                {postTypeLabel(t, post.type)}
              </Text>
            </View>
            {committed ? (
              <View style={[styles.tag, styles.youreInTag]}>
                <Text style={font(styles.youreInText)}>{t.youreIn} ✓</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Still needs people. */}
        {short && !cancelled ? (
          <View style={styles.urgentHalo}>
            <View style={styles.urgentDot} />
          </View>
        ) : null}
      </View>

      {/* ── Title + description + time pill ── */}
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <Text style={[font(styles.title), align, cancelled && styles.struck]} numberOfLines={3}>
          {post.title}
        </Text>
        <Text style={[font(styles.desc), align]} numberOfLines={2}>
          {post.description}
        </Text>

        {post.type !== 'announcement' ? (
          <View style={[styles.timePill, row]}>
            <Text style={styles.timeIcon}>🕐</Text>
            <Text style={styles.timeText}>
              {formatTime(post.startAt, lang)} – {formatTime(post.endAt, lang)}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* ── Poster ── */}
      {isPosterPost(post) ? (
        <Pressable
          onPress={() => {
            tap();
            onPress();
          }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Poster imageUrl={post.imageUrl} posterKey={post.posterKey} height={200} radius={0} />
        </Pressable>
      ) : null}

      {/* ── Slot bar ── */}
      {needed !== null ? (
        <View style={styles.meter}>
          <Meter filled={post.slotsFilled} total={needed} />
        </View>
      ) : null}

      {/* ── Actions ── */}
      <View style={[styles.actions, row]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.details}
          accessibilityState={{ selected: liked }}
          onPress={() => {
            select();
            toggleLiked(post._id);
          }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Heart
            color={liked ? colors.accent : colors.inkMuted}
            fill={liked ? colors.accent : 'transparent'}
            size={iconSize.md}
            strokeWidth={1.8}
          />
        </Pressable>

        <View style={styles.actionDivider} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.bookmark}
          accessibilityState={{ selected: saved }}
          onPress={() => {
            select();
            toggleSaved(post._id);
          }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Bookmark
            color={saved ? colors.accent : colors.inkMuted}
            fill={saved ? colors.accent : 'transparent'}
            size={iconSize.md}
            strokeWidth={1.8}
          />
        </Pressable>

        <View style={styles.actionDivider} />

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            onPress();
          }}
          style={({ pressed }) => [
            styles.action,
            styles.actionWide,
            isAr && styles.actionAr,
            pressed && styles.pressed,
          ]}
        >
          <MoveRight
            color={colors.inkMuted}
            size={iconSize.sm}
            strokeWidth={2}
            style={isAr ? styles.flip : undefined}
          />
          <Text style={font(styles.actionLabel)}>
            {post.type === 'volunteer' ? t.signup : t.details}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },

  header: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: feedPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.circle,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.h3, fontSize: 15, color: colors.inkInverse },
  headerText: { flex: 1, gap: 1 },
  mosque: { ...type.bodyStrong, color: colors.ink },
  metaRow: { alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ago: { ...type.tiny, fontFamily: type.caption.fontFamily, color: colors.inkMuted },
  dot: { ...type.caption, fontSize: 9, color: colors.inkMuted },
  tag: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1.5 },
  tagText: { ...type.tiny },
  youreInTag: { backgroundColor: colors.accentWashStrong },
  youreInText: { ...type.tiny, color: colors.accent },
  /** The prototype's pip is 8px with a 3px halo painted around it. */
  urgentHalo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.attention,
  },

  body: { paddingHorizontal: feedPadding, paddingBottom: 10, gap: 4 },
  title: { ...type.h3, color: colors.ink },
  struck: { textDecorationLine: 'line-through', color: colors.inkMuted },
  desc: { ...type.small, fontSize: 13.5, color: colors.inkMuted, lineHeight: 20 },
  timePill: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
  },
  timeIcon: { fontSize: 12 },
  timeText: { ...type.monoSmall, ...numeric, color: colors.ink },

  meter: { paddingHorizontal: feedPadding, paddingVertical: 10 },

  actions: {
    marginHorizontal: feedPadding,
    borderTopWidth: rule,
    borderTopColor: colors.rule,
  },
  action: {
    flex: 1,
    minWidth: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  actionWide: { flex: 2 },
  actionAr: { flexDirection: 'row-reverse' },
  actionDivider: { width: rule, backgroundColor: colors.rule, marginVertical: 6 },
  actionLabel: { ...type.smallStrong, color: colors.inkMuted },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { opacity: 0.6 },
});
