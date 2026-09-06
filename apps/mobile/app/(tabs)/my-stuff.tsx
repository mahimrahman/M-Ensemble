/**
 * My Stuff — the prototype's "À venir": a gradient header carrying two stat
 * tiles, then the upcoming commitments as cards and the history as a ruled
 * list with an hours pill on each row.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  Button,
  EmptyState,
  PostCard,
  GradientHeader,
  Loading,
  Screen,
  SectionTitle,
  Stat,
  StatRow,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { useSaved } from '@/store/saved';
import { formatDay, formatHours, formatTime } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { colors, feedPadding, numeric, radius, rule, spacing, type } from '@/theme';
import type { Post, Signup } from '@/types';

interface Commitment {
  signup: Signup;
  post: Post;
}

/** Minutes a shift ran for — what the history pill counts. */
function minutesOf(post: Post): number {
  return Math.max(
    0,
    Math.round((new Date(post.endAt).getTime() - new Date(post.startAt).getTime()) / 60000),
  );
}

export default function MyStuffScreen() {
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const [busyId, setBusyId] = useState<string | null>(null);

  const hours = useApi(() => api.getServiceHours(), []);
  const record = useApi(() => api.getMyReliability(), []);
  const mosques = useApi(() => api.getMosques(), []);
  const { savedIds } = useSaved();
  const savedKey = [...savedIds].sort().join(',');
  const savedPosts = useApi<Post[]>(async () => {
    const posts = await Promise.all([...savedIds].map((id) => api.getPost(id).catch(() => null)));
    return posts.filter((p): p is Post => p !== null && !p.cancelledAt);
  }, [savedKey]);
  const mosqueName = (id: string) => mosques.data?.find((m) => m._id === id)?.name;
  const commitments = useApi<Commitment[]>(async () => {
    const signups = await api.getCommitments();
    const entries = await Promise.all(
      signups.map((signup) =>
        api
          .getPost(signup.postId)
          .then((post) => ({ signup, post }))
          .catch(() => null),
      ),
    );
    return entries
      .filter((entry): entry is Commitment => entry !== null)
      .sort((a, b) => new Date(a.post.startAt).getTime() - new Date(b.post.startAt).getTime());
  }, []);

  function confirmWithdraw({ post }: Commitment) {
    Alert.alert(post.type === 'volunteer' ? t.giveUpSlot : t.notGoing, post.title, [
      { text: t.keepIt, style: 'cancel' },
      {
        text: post.type === 'volunteer' ? t.withdraw : t.cantMakeIt,
        style: 'destructive',
        onPress: () => void withdraw(post._id),
      },
    ]);
  }

  async function withdraw(postId: string) {
    setBusyId(postId);
    try {
      await api.withdraw(postId);
      await commitments.reload();
    } catch {
      Alert.alert(t.couldNotWithdraw, t.tryAgain);
    } finally {
      setBusyId(null);
    }
  }

  if (commitments.loading) {
    return (
      <Screen>
        <Loading label={t.loading} />
      </Screen>
    );
  }

  const now = Date.now();
  const all = commitments.data ?? [];
  const upcoming = all.filter((c) => new Date(c.post.endAt).getTime() >= now);
  const past = all.filter((c) => new Date(c.post.endAt).getTime() < now).reverse();

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader tall>
        <View>
          <Text style={[font(styles.headTitle), align]}>{t.next}</Text>
          <StatRow>
            <Stat value={formatHours(hours.data?.totalMinutes ?? 0)} label={t.hoursTotal} />
            <Stat value={`${upcoming.length}`} label={t.activitiesMonth} />
            <Stat
              value={`${record.data?.reliabilityRate ?? 100}%`}
              label={t.reliabilityRate}
            />
          </StatRow>
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/*
          Accountability cuts both ways: the same card that shows a late
          cancellation shows a clean record when there is one. It sits above
          the lists because it is about the person, not about one booking.
        */}
        {record.data && record.data.commitments > 0 ? (
          <>
            <SectionTitle title={t.reliability} />
            <View style={styles.recordCard}>
              <View style={[styles.recordRow, row]}>
                <Text style={font(styles.recordLabel)}>{t.commitmentsKept}</Text>
                <Text style={styles.recordValue}>
                  {record.data.attended}/{record.data.commitments}
                </Text>
              </View>
              <View style={[styles.recordRow, row]}>
                <Text style={font(styles.recordLabel)}>{t.lateCancellations}</Text>
                <Text style={styles.recordValue}>{record.data.lateCancellations}</Text>
              </View>
              <View style={[styles.recordRow, row]}>
                <Text style={font(styles.recordLabel)}>{t.noShows}</Text>
                <Text style={styles.recordValue}>{record.data.noShows}</Text>
              </View>

              {record.data.recent.length === 0 ? (
                <Text style={[font(styles.recordClean), align]}>{t.noIncidents}</Text>
              ) : (
                record.data.recent.slice(0, 3).map((incident) => (
                  <Text
                    key={`${incident.postId}-${incident.kind}`}
                    style={[font(styles.recordIncident), align]}
                    numberOfLines={1}
                  >
                    {incident.kind === 'late-cancel' ? t.incidentLateCancel : t.incidentNoShow} ·{' '}
                    {incident.postTitle}
                  </Text>
                ))
              )}
            </View>
          </>
        ) : null}

        <SectionTitle title={t.next} />

        {upcoming.length === 0 ? (
          <EmptyState
            title={t.nothingBooked}
            message={t.nothingBookedBody}
            actionLabel={t.openFeed}
            onAction={() => router.push('/')}
          />
        ) : (
          upcoming.map((entry) => (
            <View key={entry.signup._id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={entry.post.title}
                onPress={() => {
                  tap();
                  router.push({ pathname: '/post/[id]', params: { id: entry.post._id } });
                }}
                style={({ pressed }) => [styles.cardRow, row, pressed && styles.pressed]}
              >
                <View style={styles.cardIcon}>
                  <Text style={styles.cardGlyph}>🕌</Text>
                </View>
                <View style={styles.cardText}>
                  <Text style={[font(styles.cardTitle), align]} numberOfLines={2}>
                    {entry.post.title}
                  </Text>
                  <Text style={[font(styles.cardMeta), align]} numberOfLines={1}>
                    {[mosqueName(entry.post.mosqueId), formatDay(entry.post.startAt, lang)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.cardTime}>
                    {formatTime(entry.post.startAt, lang)} ·{' '}
                    {entry.signup.checkedInAt ? `✓ ${t.checkedIn}` : '✓'}
                  </Text>
                </View>
              </Pressable>

              <View style={[styles.cardActions, row]}>
                <Button
                  label={entry.post.type === 'volunteer' ? t.withdraw : t.cantMakeIt}
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  loading={busyId === entry.post._id}
                  onPress={() => confirmWithdraw(entry)}
                />
                {entry.post.type === 'volunteer' ? (
                  <Button
                    label={t.myQr}
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={() =>
                      router.push({
                        pathname: '/checkin/[postId]',
                        params: { postId: entry.post._id, show: '1' },
                      })
                    }
                  />
                ) : null}
              </View>
            </View>
          ))
        )}

        <SectionTitle title={t.saved} style={styles.historyTitle} />
        {(savedPosts.data ?? []).length === 0 ? (
          <EmptyState title={t.saved} message={t.savedEmpty} />
        ) : (
          <View style={styles.savedList}>
            {(savedPosts.data ?? []).map((post) => (
              <PostCard
                key={post._id}
                post={post}
                mosqueName={mosqueName(post.mosqueId)}
                committed={all.some((c) => c.post._id === post._id)}
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: post._id } })}
              />
            ))}
          </View>
        )}

        {past.length > 0 ? (
          <>
            <SectionTitle title={t.history} style={styles.historyTitle} />
            {past.map(({ signup, post }, i) => (
              <View
                key={signup._id}
                style={[styles.pastRow, row, i === past.length - 1 && styles.pastRowLast]}
              >
                <View style={styles.pastText}>
                  <Text style={[font(styles.pastTitle), align]} numberOfLines={1}>
                    {post.title}
                  </Text>
                  <Text style={[font(styles.pastMeta), align]} numberOfLines={1}>
                    {[
                      mosqueName(post.mosqueId),
                      formatDay(post.startAt, lang),
                      signup.checkedInAt ? null : t.notCheckedIn,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text style={styles.pastHours}>{formatHours(minutesOf(post))}h</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headTitle: { ...type.h1, color: colors.inkInverse, marginBottom: 14 },
  scroll: {
    paddingHorizontal: feedPadding + 4,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  recordCard: {
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  recordRow: { justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  recordLabel: { ...type.small, color: colors.inkMuted },
  recordValue: { ...type.h3, ...numeric, color: colors.ink },
  recordClean: { ...type.small, color: colors.inkMuted, marginTop: spacing.xs },
  recordIncident: { ...type.small, color: colors.warn, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardRow: { alignItems: 'flex-start', gap: spacing.md, padding: 14 },
  pressed: { opacity: 0.75 },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md + 2,
    backgroundColor: colors.accentWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGlyph: { fontSize: 18 },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...type.bodyStrong, color: colors.ink },
  cardMeta: { ...type.caption, color: colors.inkMuted },
  cardTime: { ...type.monoSmall, ...numeric, color: colors.accent, marginTop: 2 },
  cardActions: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },

  historyTitle: { marginTop: spacing.xl },
  /** Feed cards are full-bleed; pull them out to the screen edge and round the stack. */
  savedList: {
    marginHorizontal: -(feedPadding + 4),
    borderTopWidth: rule,
    borderTopColor: colors.rule,
  },
  pastRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  pastRowLast: { borderBottomWidth: 0 },
  pastText: { flex: 1, gap: 2 },
  pastTitle: { ...type.smallStrong, fontSize: 13.5, color: colors.ink },
  pastMeta: { ...type.caption, color: colors.inkMuted },
  pastHours: {
    ...type.mono,
    ...numeric,
    fontSize: 14,
    color: colors.accent,
    backgroundColor: colors.accentWash,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
