/**
 * Manage — the coordinator's home, in the prototype's shape: a gradient
 * header with two stat tiles, then the doors to everything else and the three
 * lists that tell you whether tonight is covered.
 */

import { useRouter } from 'expo-router';
import { Clock, ListPlus, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import {
  Button,
  Chip,
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
import { useLang } from '@/i18n';
import { formatAgo } from '@/lib/datetime';
import { formatWhen } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import {
  colors,
  numeric,
  radius,
  rule,
  screenPadding,
  spacing,
  type,
} from '@/theme';
import type { Post, PublicUser, Signup } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Activity {
  signup: Signup;
  post: Post;
  person: PublicUser | undefined;
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const { adminMosqueIds } = useAuth();
  const { t, lang, align, row, font } = useLang();
  const [selected, setSelected] = useState<string | null>(null);
  const mosqueId = selected ?? adminMosqueIds[0] ?? null;

  const mosques = useApi(
    async () => Promise.all(adminMosqueIds.map((id) => api.getMosque(id))),
    [adminMosqueIds.join(',')],
  );
  const mosque = mosques.data?.find((m) => m._id === mosqueId) ?? null;

  const overview = useApi(async () => {
    if (!mosqueId) return null;
    const posts = await api.getMosquePostsForAdmin(mosqueId);
    const now = Date.now();
    const live = posts.filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() >= now);
    const signupLists = await Promise.all(live.map((p) => api.getSignups(p._id)));

    const recent: { signup: Signup; post: Post }[] = [];
    signupLists.forEach((list, i) => {
      const post = live[i];
      if (!post) return;
      for (const signup of list) {
        if (
          signup.status === 'confirmed' &&
          signup.createdAt &&
          now - new Date(signup.createdAt).getTime() < DAY_MS
        ) {
          recent.push({ signup, post });
        }
      }
    });
    recent.sort(
      (a, b) =>
        new Date(b.signup.createdAt ?? 0).getTime() - new Date(a.signup.createdAt ?? 0).getTime(),
    );

    const people = recent.length
      ? await api.getUsers([...new Set(recent.map((r) => r.signup.userId))])
      : [];

    return { live, recent, people };
  }, [mosqueId]);

  const unfilled = useMemo(
    () =>
      (overview.data?.live ?? []).filter(
        (p) =>
          p.type === 'volunteer' && p.slotsNeeded !== undefined && p.slotsFilled < p.slotsNeeded,
      ),
    [overview.data],
  );

  const upcoming = useMemo(() => {
    const cutoff = Date.now() + 7 * DAY_MS;
    return (overview.data?.live ?? []).filter((p) => new Date(p.startAt).getTime() <= cutoff);
  }, [overview.data]);

  const activity: Activity[] = useMemo(
    () =>
      (overview.data?.recent ?? []).slice(0, 8).map(({ signup, post }) => ({
        signup,
        post,
        person: overview.data?.people.find((u) => u._id === signup.userId),
      })),
    [overview.data],
  );

  const slotsMissing = unfilled.reduce((sum, p) => sum + ((p.slotsNeeded ?? 0) - p.slotsFilled), 0);

  if (!mosqueId) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader title={t.manage} />
        <View style={styles.body}>
          <EmptyState title={t.manage} message={t.everythingCoveredBody} />
        </View>
      </Screen>
    );
  }

  const go = (pathname: string, params?: Record<string, string>) => {
    tap();
    router.push({ pathname: pathname as never, params: { mosqueId, ...params } } as never);
  };

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader tall>
        <View>
          <Text style={[font(styles.eyebrow), align]}>{t.coordinator.toUpperCase()}</Text>
          <Text style={[font(styles.headTitle), align]} numberOfLines={1}>
            {mosque?.name ?? t.manage}
          </Text>
          <StatRow>
            <Stat value={`${slotsMissing}`} label={t.needed} />
            <Stat value={`${activity.length}`} label={t.newSignups} />
          </StatRow>
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Which mosque, when you coordinate more than one. */}
        {adminMosqueIds.length > 1 && mosques.data ? (
          <View style={[styles.chips, row]}>
            {mosques.data.map((m) => (
              <Chip
                key={m._id}
                label={m.name}
                selected={m._id === mosqueId}
                onPress={() => setSelected(m._id)}
              />
            ))}
          </View>
        ) : null}

        <Button label={t.createPost} icon={Plus} size="lg" onPress={() => go('/manage/create')} />
        <View style={[styles.actions, row]}>
          <Button
            label={t.managePosts}
            icon={ListPlus}
            variant="secondary"
            fullWidth={false}
            onPress={() => go('/manage/posts')}
            style={styles.grow}
          />
          <Button
            label={t.manageIqamah}
            icon={Clock}
            variant="secondary"
            fullWidth={false}
            onPress={() => go('/manage/iqamah')}
            style={styles.grow}
          />
        </View>

        {/* ── Needs attention ── */}
        <SectionTitle title={t.needsAttention} />
        {overview.loading ? (
          <Loading variant="inline" />
        ) : unfilled.length === 0 ? (
          <Text style={[font(styles.calm), align]}>{t.everythingCovered}</Text>
        ) : (
          unfilled.map((post) => (
            <Pressable
              key={post._id}
              onPress={() => {
                tap();
                router.push({ pathname: '/manage/coverage/[id]', params: { id: post._id } });
              }}
              style={({ pressed }) => [styles.attentionRow, pressed && styles.pressed]}
            >
              <Text style={[font(styles.postTitle), align]} numberOfLines={1}>
                {post.title}
              </Text>
              <Text style={[font(styles.postMeta), align]}>
                {formatWhen(post.startAt, post.endAt, lang)}
              </Text>
              <Meter filled={post.slotsFilled} total={post.slotsNeeded ?? 0} />
            </Pressable>
          ))
        )}

        {/* ── Next 7 days ── */}
        <SectionTitle title={t.comingUp} />
        {overview.loading ? null : upcoming.length === 0 ? (
          <Text style={[font(styles.calm), align]}>{t.nothingComingUp}</Text>
        ) : (
          upcoming.map((post) => (
            <Pressable
              key={post._id}
              onPress={() => {
                tap();
                if (post.type === 'announcement') {
                  router.push({ pathname: '/post/[id]', params: { id: post._id } });
                } else {
                  router.push({ pathname: '/manage/coverage/[id]', params: { id: post._id } });
                }
              }}
              style={({ pressed }) => [styles.listRow, row, pressed && styles.pressed]}
            >
              <View style={styles.listText}>
                <Text style={[font(styles.listTitle), align]} numberOfLines={1}>
                  {post.title}
                </Text>
                <Text style={[font(styles.postMeta), align]} numberOfLines={1}>
                  {postTypeLabel(t, post.type).toUpperCase()} ·{' '}
                  {formatWhen(post.startAt, post.endAt, lang)}
                </Text>
              </View>
              {post.slotsNeeded !== undefined ? (
                <Text
                  style={[
                    styles.listCount,
                    post.slotsFilled < post.slotsNeeded && styles.listCountShort,
                  ]}
                >
                  {post.slotsFilled}/{post.slotsNeeded}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}

        {/* ── New signups ── */}
        <SectionTitle title={t.newSignups} />
        {overview.loading ? null : activity.length === 0 ? (
          <Text style={[font(styles.calm), align]}>{t.nobodyYet}</Text>
        ) : (
          activity.map(({ signup, post, person }) => (
            <Pressable
              key={signup._id}
              onPress={() => {
                tap();
                router.push({ pathname: '/manage/coverage/[id]', params: { id: post._id } });
              }}
              style={({ pressed }) => [styles.listRow, row, pressed && styles.pressed]}
            >
              <View style={styles.listText}>
                <Text style={[font(styles.listTitle), align]}>
                  <Text style={font(styles.person)}>{person?.name ?? '—'}</Text>
                  {' · '}
                  {post.title}
                </Text>
                <Text style={styles.postAgo}>
                  {signup.createdAt ? formatAgo(signup.createdAt, lang) : ''}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.overline, color: colors.inkOnDarkFaint },
  headTitle: { ...type.h1, color: colors.inkInverse, marginBottom: 14, marginTop: 2 },
  body: { paddingHorizontal: screenPadding, paddingTop: spacing.xl },
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  chips: { flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.sm },
  grow: { flex: 1 },
  calm: { ...type.small, color: colors.inkMuted },

  attentionRow: {
    gap: spacing.xs,
    padding: 14,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  pressed: { opacity: 0.7 },
  postTitle: { ...type.bodyStrong, color: colors.ink },
  postMeta: { ...type.caption, color: colors.inkMuted },
  postAgo: { ...type.monoSmall, ...numeric, fontSize: 11, color: colors.inkFaint },

  listRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  listText: { flex: 1, gap: 2 },
  listTitle: { ...type.small, color: colors.ink },
  listCount: { ...type.mono, ...numeric, fontSize: 14, color: colors.accent },
  listCountShort: { color: colors.attention },
  person: { ...type.smallStrong, color: colors.ink },
});
