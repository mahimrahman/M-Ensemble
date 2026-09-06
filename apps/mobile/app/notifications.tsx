/**
 * The inbox behind the bell.
 *
 * Everything the mosques you follow have told you, newest first: posts they
 * published in a category you care about, and messages a coordinator wrote by
 * hand. A post row opens the post; a written message has nowhere to go, so it
 * shows its whole text here rather than a teaser with no "more".
 *
 * Opening the screen marks everything read — there is no per-row tap to track,
 * because the row already shows the message. The badge on the bell therefore
 * clears the moment you look, which is what "unread" is supposed to mean.
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { BackBar, EmptyState, ErrorState, GradientHeader, Loading, Screen } from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { formatAgo } from '@/lib/datetime';
import { tap } from '@/lib/haptics';
import { colors, feedPadding, radius, rule, screenPadding, spacing, type } from '@/theme';
import type { AppNotification } from '@/types';

export default function NotificationsScreen() {
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const [refreshing, setRefreshing] = useState(false);

  const feed = useApi(() => api.getNotifications(), []);
  const mosques = useApi(() => api.getMosques(), []);

  /**
   * Whether a row was unread when the screen opened.
   *
   * Captured once, before the read receipt goes out, so the "New" markers stay
   * put while you are reading. Recomputing from `readAt` would clear them out
   * from under you the instant the mark-read response landed.
   */
  const [wasUnread, setWasUnread] = useState<Set<string>>(new Set());
  const marked = useRef(false);

  useEffect(() => {
    if (!feed.data || marked.current) return;
    marked.current = true;

    setWasUnread(new Set(feed.data.items.filter((n) => !n.readAt).map((n) => n._id)));
    if (feed.data.unread === 0) return;

    // Fire and forget: the list is already correct on screen, and a failed
    // receipt only means the badge is still there next time — no worse than
    // not having opened it.
    void api.markNotificationsRead().catch(() => {});
  }, [feed.data]);

  const mosqueName = useCallback(
    (id: string) => mosques.data?.find((m) => m._id === id)?.name,
    [mosques.data],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([feed.reload(), mosques.reload()]).finally(() => setRefreshing(false));
  }, [feed, mosques]);

  const open = (item: AppNotification) => {
    if (!item.postId) return;
    tap();
    router.push({ pathname: '/post/[id]', params: { id: item.postId } });
  };

  const items = feed.data?.items ?? [];

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} title={t.notifications} />

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.padded}>
            {feed.loading ? (
              <Loading variant="inline" label={t.loading} />
            ) : feed.error ? (
              <ErrorState message={feed.error} onRetry={() => void feed.reload()} />
            ) : (
              <EmptyState title={t.noNotifications} message={t.noNotificationsBody} />
            )}
          </View>
        }
        renderItem={({ item }) => {
          const unread = wasUnread.has(item._id);
          const openable = !!item.postId;

          return (
            <Pressable
              accessibilityRole={openable ? 'button' : 'text'}
              disabled={!openable}
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.card,
                unread && styles.cardUnread,
                pressed && openable && styles.pressed,
              ]}
            >
              <View style={[styles.meta, row]}>
                <Text style={[font(styles.mosque), align]} numberOfLines={1}>
                  {mosqueName(item.mosqueId) ?? '—'}
                </Text>
                <Text style={styles.when}>{formatAgo(item.createdAt, lang)}</Text>
              </View>

              <Text style={[font(styles.title), align]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text
                style={[font(styles.body), align]}
                // A post's row is a pointer to the post, so three lines is
                // plenty. A written message has no detail screen behind it,
                // so it is shown whole.
                numberOfLines={openable ? 3 : undefined}
              >
                {item.body}
              </Text>

              {unread ? (
                <View style={[styles.newRow, row]}>
                  <View style={styles.dot} />
                  <Text style={font(styles.newLabel)}>{t.newNotification.toUpperCase()}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: spacing.lg,
    paddingHorizontal: feedPadding,
    gap: spacing.sm,
    flexGrow: 1,
  },
  padded: { paddingHorizontal: screenPadding - feedPadding },
  pressed: { opacity: 0.7 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.xl,
    padding: 14,
    gap: 4,
  },
  // Unread is a tint and a stronger edge, not a coloured card: the difference
  // has to survive a list where most rows are unread on a first visit.
  cardUnread: { backgroundColor: colors.accentWash, borderColor: colors.ruleStrong },

  meta: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  mosque: { ...type.captionStrong, color: colors.accent, flex: 1 },
  when: { ...type.monoSmall, color: colors.inkFaint },

  title: { ...type.title, color: colors.ink },
  body: { ...type.small, color: colors.inkMuted },

  newRow: { alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: radius.circle, backgroundColor: colors.star },
  newLabel: { ...type.overline, color: colors.starDeep },
});
