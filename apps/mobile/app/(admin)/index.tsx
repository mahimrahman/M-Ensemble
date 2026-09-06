/**
 * Dashboard — what a coordinator needs in the first five seconds:
 * how the mosque is doing, what is short of people, and what is happening
 * today. Everything else is one tap away.
 *
 * Deliberately not a feed. Nothing here is browsable content; every row is
 * something the coordinator can act on.
 */

import { useRouter } from 'expo-router';
import { ChevronRight, Clock, Plus, QrCode, TriangleAlert, Users } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import {
  Button,
  EmptyState,
  GradientHeader,
  Loading,
  Meter,
  Screen,
  SectionTitle,
  Stat,
  StatRow,
  postTypeLabel,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { fill, useLang } from '@/i18n';
import { formatAgo } from '@/lib/datetime';
import { formatHours, formatTime, formatWhen } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { useAdminMosque } from '@/store/adminMosque';
import { colors, numeric, radius, rule, screenPadding, spacing, type } from '@/theme';
import type { Post, RosterEntry } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

function greeting(t: ReturnType<typeof useLang>['t']): string {
  const hour = new Date().getHours();
  if (hour < 12) return t.goodMorning;
  if (hour < 18) return t.goodAfternoon;
  return t.goodEvening;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const { mosqueId, mosque, loading: mosqueLoading } = useAdminMosque();

  const stats = useApi(
    async () => (mosqueId ? api.getMosqueDashboard(mosqueId) : null),
    [mosqueId],
  );
  const posts = useApi(
    async () => (mosqueId ? api.getMosquePostsForAdmin(mosqueId) : null),
    [mosqueId],
  );
  const roster = useApi(
    async () => (mosqueId ? api.getMosqueRoster(mosqueId, { upcoming: true }) : null),
    [mosqueId],
  );

  const now = Date.now();

  /** Live posts, soonest first — the spine of both lists below. */
  const live = useMemo(
    () =>
      (posts.data ?? [])
        .filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() >= now)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [posts.data],
  );

  /** Anything running today — the list you actually work from. */
  const todays = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return live.filter(
      (p) => p.type !== 'announcement' && new Date(p.startAt).getTime() <= end.getTime(),
    );
  }, [live]);

  /** Volunteer posts still short of hands, most short first. */
  const short = useMemo(
    () =>
      live
        .filter(
          (p) =>
            p.type === 'volunteer' && p.slotsNeeded !== undefined && p.slotsFilled < p.slotsNeeded,
        )
        .sort(
          (a, b) => (b.slotsNeeded ?? 0) - b.slotsFilled - ((a.slotsNeeded ?? 0) - a.slotsFilled),
        ),
    [live],
  );

  /** Who signed up in the last day, newest first. */
  const recent = useMemo(
    () =>
      (roster.data ?? [])
        .filter((e) => e.signup.createdAt && now - new Date(e.signup.createdAt).getTime() < DAY_MS)
        .sort(
          (a, b) =>
            new Date(b.signup.createdAt ?? 0).getTime() -
            new Date(a.signup.createdAt ?? 0).getTime(),
        )
        .slice(0, 6),
    [roster.data],
  );

  if (mosqueLoading && !mosque) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader title={t.dashboard} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  if (!mosqueId) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader title={t.dashboard} />
        <View style={styles.guard}>
          <EmptyState title={t.noMosques} message={t.everythingCoveredBody} />
        </View>
      </Screen>
    );
  }

  const d = stats.data;

  const openPost = (post: Post) => {
    tap();
    if (post.type === 'announcement') {
      router.push({ pathname: '/post/[id]', params: { id: post._id } });
    } else {
      router.push({ pathname: '/manage/coverage/[id]', params: { id: post._id } });
    }
  };

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader tall variant="masthead">
        <View>
          <Text style={[font(styles.eyebrow), align]}>{greeting(t).toUpperCase()}</Text>
          <Text style={[font(styles.headTitle), align]} numberOfLines={1}>
            {mosque?.name ?? t.dashboard}
          </Text>

          <StatRow>
            <Stat value={`${d?.slotsUnfilled ?? 0}`} label={t.slotsToFill} />
            <Stat value={`${d?.upcomingCount ?? 0}`} label={t.thisWeek} />
            <Stat value={`${d?.newSignups24h ?? 0}`} label={t.newSignups} />
          </StatRow>
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── The three actions a coordinator takes most ── */}
        <Button
          label={t.createPost}
          icon={Plus}
          size="lg"
          onPress={() => {
            tap();
            router.push({ pathname: '/manage/create', params: { mosqueId } });
          }}
        />

        {/*
          ── Anything that needs a decision today ──
          Above the metrics on purpose. A tile you can only nod at is worth
          less than a sentence that tells you to go and do something, so the
          things that are actually wrong come first — and disappear entirely
          when nothing is wrong, rather than sitting there reading zero.
        */}
        {d && (d.postsWithNoSignups > 0 || d.startingSoon > 0) ? (
          <View style={styles.alerts}>
            {d.postsWithNoSignups > 0 ? (
              <Pressable
                onPress={() => {
                  tap();
                  router.push('/(admin)/events');
                }}
                style={({ pressed }) => [styles.alertRow, row, pressed && styles.pressed]}
              >
                <TriangleAlert color={colors.danger} size={18} strokeWidth={2} />
                <Text style={[font(styles.alertText), align]}>
                  {fill(t.noSignupsAlert, { count: `${d.postsWithNoSignups}` })}
                </Text>
              </Pressable>
            ) : null}
            {d.startingSoon > 0 ? (
              <View style={[styles.alertRow, row]}>
                <Clock color={colors.accent} size={18} strokeWidth={2} />
                <Text style={[font(styles.alertText), align]}>
                  {fill(t.startingSoonAlert, { count: `${d.startingSoon}` })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Health of the mosque, at a glance ── */}
        <View style={[styles.tiles, row]}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{d ? `${d.attendanceRate30d}%` : '-'}</Text>
            <Text style={[font(styles.tileLabel), align]}>{t.attendance30d}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{d ? formatHours(d.minutesServed) : '-'}</Text>
            <Text style={[font(styles.tileLabel), align]}>{t.hoursServed}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{d?.activeVolunteers30d ?? '-'}</Text>
            <Text style={[font(styles.tileLabel), align]}>{t.activeVolunteers}</Text>
          </View>
        </View>

        <View style={[styles.tiles, row]}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{d?.followerCount ?? '-'}</Text>
            <Text style={[font(styles.tileLabel), align]}>{t.followers}</Text>
            {/* Growth needs a direction, not just a level. */}
            {d && d.newFollowers7d > 0 ? (
              <Text style={font(styles.tileDelta)}>+{d.newFollowers7d}</Text>
            ) : null}
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{d?.firstTimeVolunteers30d ?? '-'}</Text>
            <Text style={[font(styles.tileLabel), align]}>{t.firstTimers}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>
              {d ? d.lateCancellations30d + d.noShows30d : '-'}
            </Text>
            <Text style={[font(styles.tileLabel), align]}>{t.droppedOut}</Text>
          </View>
        </View>

        {/* Coverage across every live volunteer post, as one bar. */}
        {d && d.slotsNeeded > 0 ? (
          <View style={styles.coverage}>
            <View style={[styles.coverageHead, row]}>
              <Text style={[font(styles.coverageLabel), align]}>{t.coverage}</Text>
              <Text style={styles.coverageValue}>
                {d.slotsNeeded - d.slotsUnfilled}/{d.slotsNeeded}
              </Text>
            </View>
            <Meter filled={d.slotsNeeded - d.slotsUnfilled} total={d.slotsNeeded} />
          </View>
        ) : null}

        {/* ── Today ── */}
        <SectionTitle title={t.todaySchedule} />
        {posts.loading && !posts.data ? (
          <Loading variant="inline" />
        ) : todays.length === 0 ? (
          <Text style={[font(styles.calm), align]}>{t.nothingToday}</Text>
        ) : (
          todays.map((post) => (
            <Pressable
              key={post._id}
              onPress={() => openPost(post)}
              style={({ pressed }) => [styles.todayRow, row, pressed && styles.pressed]}
            >
              <Text style={styles.todayTime}>{formatTime(post.startAt, lang)}</Text>
              <View style={styles.rowText}>
                <Text style={[font(styles.rowTitle), align]} numberOfLines={1}>
                  {post.title}
                </Text>
                <Text style={[font(styles.rowMeta), align]} numberOfLines={1}>
                  {postTypeLabel(t, post.type).toUpperCase()}
                  {post.location ? ` · ${post.location}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.runCheckin}
                hitSlop={8}
                onPress={() => {
                  tap();
                  router.push({ pathname: '/manage/checkin/[id]', params: { id: post._id } });
                }}
                style={({ pressed }) => [styles.qr, pressed && styles.pressed]}
              >
                <QrCode color={colors.accent} size={18} strokeWidth={2} />
              </Pressable>
            </Pressable>
          ))
        )}

        {/* ── Short of people ── */}
        <SectionTitle
          title={t.needsPeople}
          right={short.length > 0 ? <Text style={styles.count}>{short.length}</Text> : null}
        />
        {posts.loading && !posts.data ? null : short.length === 0 ? (
          <Text style={[font(styles.calm), align]}>{t.fullyStaffed}</Text>
        ) : (
          short.slice(0, 4).map((post) => (
            <Pressable
              key={post._id}
              onPress={() => openPost(post)}
              style={({ pressed }) => [styles.shortCard, pressed && styles.pressed]}
            >
              <Text style={[font(styles.rowTitle), align]} numberOfLines={1}>
                {post.title}
              </Text>
              <Text style={[font(styles.rowMeta), align]}>
                {formatWhen(post.startAt, post.endAt, lang)}
              </Text>
              <Meter filled={post.slotsFilled} total={post.slotsNeeded ?? 0} />
            </Pressable>
          ))
        )}

        {/* ── Who just signed up ── */}
        <SectionTitle
          title={t.newSignups}
          right={
            recent.length > 0 ? (
              <Pressable
                onPress={() => {
                  tap();
                  router.push('/(admin)/people');
                }}
                hitSlop={8}
              >
                <Text style={styles.link}>{t.viewAll}</Text>
              </Pressable>
            ) : null
          }
        />
        {roster.loading && !roster.data ? null : recent.length === 0 ? (
          <Text style={[font(styles.calm), align]}>{t.nobodyYet}</Text>
        ) : (
          recent.map((entry: RosterEntry) => (
            <Pressable
              key={entry.signup._id}
              onPress={() => {
                tap();
                router.push({
                  pathname: '/manage/member/[id]',
                  params: { id: entry.userId },
                });
              }}
              style={({ pressed }) => [styles.signupRow, row, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {entry.userName.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowText}>
                <Text style={[font(styles.rowTitle), align]} numberOfLines={1}>
                  {entry.userName}
                </Text>
                <Text style={[font(styles.rowMeta), align]} numberOfLines={1}>
                  {entry.postTitle}
                </Text>
              </View>
              <Text style={styles.ago}>
                {entry.signup.createdAt ? formatAgo(entry.signup.createdAt, lang) : ''}
              </Text>
            </Pressable>
          ))
        )}

        {/* ── The rest of the app ── */}
        <View style={[styles.doors, row]}>
          <Pressable
            onPress={() => {
              tap();
              router.push('/(admin)/people');
            }}
            style={({ pressed }) => [styles.door, row, pressed && styles.pressed]}
          >
            <Users color={colors.accent} size={18} strokeWidth={2} />
            <Text style={[font(styles.doorLabel), align]}>{t.directory}</Text>
            <ChevronRight color={colors.inkFaint} size={16} strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.overline, color: colors.inkOnDarkFaint },
  headTitle: { ...type.h1, color: colors.inkInverse, marginBottom: 14, marginTop: 2 },
  guard: { paddingHorizontal: screenPadding, paddingTop: spacing.xl },
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  calm: { ...type.small, color: colors.inkMuted },
  pressed: { opacity: 0.7 },
  count: { ...type.monoSmall, ...numeric, color: colors.attention },
  link: { ...type.captionStrong, color: colors.accent },

  alerts: { gap: spacing.sm, marginBottom: spacing.md },
  alertRow: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  alertText: { ...type.small, color: colors.ink, flex: 1 },
  tileDelta: { ...type.caption, color: colors.accent },
  coverage: {
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  coverageHead: { justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  coverageLabel: { ...type.overline, color: colors.inkMuted },
  coverageValue: { ...type.h3, ...numeric, color: colors.ink },
  tiles: { gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  tileValue: { ...type.monoLarge, ...numeric, fontSize: 19, color: colors.accent },
  tileLabel: { ...type.caption, fontSize: 11, color: colors.inkMuted, textAlign: 'center' },

  todayRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  todayTime: { ...type.mono, ...numeric, fontSize: 13, color: colors.accent, width: 44 },
  qr: { padding: spacing.xs },

  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.smallStrong, color: colors.ink },
  rowMeta: { ...type.caption, color: colors.inkMuted },

  shortCard: {
    gap: spacing.xs,
    padding: 14,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },

  signupRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.circle,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.title, fontSize: 14, color: colors.inkMuted },
  ago: { ...type.monoSmall, ...numeric, fontSize: 11, color: colors.inkFaint },

  doors: { gap: spacing.sm, marginTop: spacing.sm },
  door: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  doorLabel: { ...type.smallStrong, color: colors.ink, flex: 1 },
});
