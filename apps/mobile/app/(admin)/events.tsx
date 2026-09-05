/**
 * Events — everything this mosque runs, in the three states a coordinator
 * thinks in: what's coming, what's finished (and how it went), and what was
 * called off.
 *
 * The member app shows an event to decide whether to attend. This shows the
 * same event to decide whether it is adequately staffed — so every row leads
 * with coverage, not with a poster.
 */

import { useRouter } from 'expo-router';
import { Pencil, Plus, Users, XCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import {
  Badge,
  Button,
  EmptyState,
  GradientHeader,
  Loading,
  Meter,
  Screen,
  Segmented,
  postTypeLabel,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { formatWhen } from '@/lib/format';
import { success, tap, warn } from '@/lib/haptics';
import { useAdminMosque } from '@/store/adminMosque';
import { colors, numeric, radius, rule, screenPadding, spacing, type } from '@/theme';
import type { EventOutcome, Post } from '@/types';

type View = 'upcoming' | 'history' | 'cancelled';

export default function EventsScreen() {
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const { mosqueId } = useAdminMosque();
  const [view, setView] = useState<View>('upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);

  const posts = useApi(
    async () => (mosqueId ? api.getMosquePostsForAdmin(mosqueId) : null),
    [mosqueId],
  );
  const outcomes = useApi(
    async () => (mosqueId ? api.getEventOutcomes(mosqueId) : null),
    [mosqueId],
  );

  const now = Date.now();
  const all = posts.data ?? [];

  const upcoming = useMemo(
    () =>
      all
        .filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() >= now)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [all],
  );
  const cancelled = useMemo(() => all.filter((p) => p.cancelledAt), [all]);

  function confirmCancel(post: Post) {
    Alert.alert(t.cancelPostConfirm, `${post.title}\n\n${t.cancelPostBody}`, [
      { text: t.keepIt, style: 'cancel' },
      { text: t.cancelPost, style: 'destructive', onPress: () => void cancel(post._id) },
    ]);
  }

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await api.cancelPost(id);
      success();
      await Promise.all([posts.reload(), outcomes.reload()]);
    } catch {
      warn();
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setBusyId(null);
    }
  }

  const openCoverage = (post: Post) => {
    tap();
    if (post.type === 'announcement') {
      router.push({ pathname: '/post/[id]', params: { id: post._id } });
    } else {
      router.push({ pathname: '/manage/coverage/[id]', params: { id: post._id } });
    }
  };

  /** An upcoming post: coverage first, then the actions on it. */
  const UpcomingRow = ({ post }: { post: Post }) => {
    const target = post.type === 'volunteer' ? post.slotsNeeded : post.capacity;

    return (
      <Pressable
        onPress={() => openCoverage(post)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={[styles.badges, row]}>
          <Badge label={postTypeLabel(t, post.type)} />
          {post.type === 'volunteer' && post.slotsNeeded !== undefined ? (
            <Badge
              label={post.slotsFilled >= post.slotsNeeded ? t.fullyStaffed : t.needsPeople}
              tone={post.slotsFilled >= post.slotsNeeded ? 'accent' : 'attention'}
            />
          ) : null}
        </View>

        <Text style={[font(styles.title), align]} numberOfLines={2}>
          {post.title}
        </Text>
        <Text style={[font(styles.meta), align]} numberOfLines={1}>
          {post.type === 'announcement'
            ? postTypeLabel(t, post.type)
            : formatWhen(post.startAt, post.endAt, lang)}
        </Text>

        {target !== undefined && target > 0 ? (
          <Meter filled={post.slotsFilled} total={target} />
        ) : null}

        <View style={[styles.actions, row]}>
          {post.type !== 'announcement' ? (
            <Button
              label={t.coverage}
              icon={Users}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => openCoverage(post)}
            />
          ) : null}
          <Button
            label={t.edit}
            icon={Pencil}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => {
              tap();
              router.push({ pathname: '/manage/create', params: { editId: post._id } });
            }}
          />
          <Button
            label={t.cancel}
            icon={XCircle}
            variant="ghost"
            size="sm"
            fullWidth={false}
            loading={busyId === post._id}
            onPress={() => confirmCancel(post)}
          />
        </View>
      </Pressable>
    );
  };

  /** A finished post: how many actually turned up against how many said they would. */
  const OutcomeRow = ({ outcome }: { outcome: EventOutcome }) => {
    const rate = outcome.confirmed
      ? Math.round((outcome.attended / outcome.confirmed) * 100)
      : 0;
    const weak = outcome.confirmed > 0 && rate < 60;

    return (
      <Pressable
        onPress={() => {
          tap();
          router.push({ pathname: '/manage/coverage/[id]', params: { id: outcome.postId } });
        }}
        style={({ pressed }) => [styles.outcomeRow, row, pressed && styles.pressed]}
      >
        <View style={styles.rowText}>
          <Text style={[font(styles.rowTitle), align]} numberOfLines={1}>
            {outcome.title}
          </Text>
          <Text style={[font(styles.meta), align]} numberOfLines={1}>
            {postTypeLabel(t, outcome.type).toUpperCase()} ·{' '}
            {formatWhen(outcome.startAt, outcome.endAt, lang)}
          </Text>
        </View>

        <View style={styles.turnout}>
          <Text style={[styles.turnoutPct, weak && styles.turnoutWeak]}>
            {outcome.confirmed ? `${rate}%` : '—'}
          </Text>
          <Text style={styles.turnoutCount}>
            {outcome.attended}/{outcome.confirmed}
          </Text>
        </View>
      </Pressable>
    );
  };

  const CancelledRow = ({ post }: { post: Post }) => (
    <View style={styles.cancelledRow}>
      <View style={[styles.badges, row]}>
        <Badge label={postTypeLabel(t, post.type)} />
        <Badge label={t.cancelled} tone="danger" />
      </View>
      <Text style={[font(styles.rowTitle), align]} numberOfLines={2}>
        {post.title}
      </Text>
      <Text style={[font(styles.meta), align]} numberOfLines={1}>
        {formatWhen(post.startAt, post.endAt, lang)}
      </Text>
    </View>
  );

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        title={t.allEvents}
        subtitle={`${upcoming.length} ${t.upcoming.toLowerCase()}`}
        right={
          <Button
            label={t.createPost}
            icon={Plus}
            variant="inverse"
            size="sm"
            fullWidth={false}
            onPress={() => {
              tap();
              router.push({ pathname: '/manage/create', params: { mosqueId: mosqueId ?? '' } });
            }}
          />
        }
      />

      <View style={styles.switcher}>
        <Segmented
          options={[
            { value: 'upcoming', label: t.upcoming },
            { value: 'history', label: t.outcomes },
            { value: 'cancelled', label: t.cancelled },
          ]}
          value={view}
          onChange={(next) => setView(next as View)}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {posts.loading && !posts.data ? (
          <Loading variant="inline" />
        ) : view === 'upcoming' ? (
          upcoming.length === 0 ? (
            <EmptyState
              title={t.noPosts}
              message={t.nothingComingUpBody}
              actionLabel={t.createPost}
              onAction={() =>
                router.push({ pathname: '/manage/create', params: { mosqueId: mosqueId ?? '' } })
              }
            />
          ) : (
            upcoming.map((post) => <UpcomingRow key={post._id} post={post} />)
          )
        ) : view === 'history' ? (
          (outcomes.data ?? []).length === 0 ? (
            <EmptyState title={t.outcomes} message={t.noOutcomes} />
          ) : (
            <>
              <View style={[styles.legend, row]}>
                <Text style={[font(styles.legendText), align]}>{t.turnout}</Text>
                <Text style={styles.legendText}>
                  {t.attended} / {t.registered}
                </Text>
              </View>
              {(outcomes.data ?? []).map((outcome) => (
                <OutcomeRow key={outcome.postId} outcome={outcome} />
              ))}
            </>
          )
        ) : cancelled.length === 0 ? (
          <EmptyState title={t.cancelled} message={t.everythingCoveredBody} />
        ) : (
          cancelled.map((post) => <CancelledRow key={post._id} post={post} />)
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { paddingHorizontal: screenPadding, paddingTop: spacing.md },
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  pressed: { opacity: 0.7 },

  card: {
    gap: spacing.xs,
    padding: 14,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  badges: { gap: spacing.sm, flexWrap: 'wrap' },
  title: { ...type.h3, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  actions: { flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },

  legend: {
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  legendText: { ...type.overline, color: colors.inkFaint },

  outcomeRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.smallStrong, color: colors.ink },
  turnout: { alignItems: 'flex-end' },
  turnoutPct: { ...type.mono, ...numeric, fontSize: 15, color: colors.accent },
  turnoutWeak: { color: colors.danger },
  turnoutCount: { ...type.monoSmall, ...numeric, fontSize: 11, color: colors.inkFaint },

  cancelledRow: {
    gap: spacing.xs,
    padding: 14,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    opacity: 0.75,
  },
});
