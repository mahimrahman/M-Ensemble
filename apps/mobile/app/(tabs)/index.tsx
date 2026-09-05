/**
 * Feed — the prototype's home screen.
 *
 *   the gradient prayer masthead, running under the status bar
 *   a white strip of filter pills
 *   the posts, each a full-bleed social card on the pale body
 */

import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '@/api/client';
import {
  Chip,
  EmptyState,
  Loading,
  PostCard,
  PrayerCard,
  Screen,
  postTypeLabel,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { colors, feedPadding, rule, spacing } from '@/theme';
import type { PostType } from '@/types';

type Filter = 'all' | PostType;

const FILTERS: Filter[] = ['all', 'volunteer', 'event', 'class', 'announcement'];

export default function FeedScreen() {
  const router = useRouter();
  const { t } = useLang();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const mosques = useApi(() => api.getFollowedMosques(), []);
  const commitments = useApi(() => api.getCommitments(), []);
  const feed = useApi(
    () => api.getFeed(filter === 'all' ? undefined : { types: [filter] }),
    [filter],
  );

  const committedIds = useMemo(
    () => new Set((commitments.data ?? []).map((s) => s.postId)),
    [commitments.data],
  );
  const mosqueName = useCallback(
    (id: string) => mosques.data?.find((m) => m._id === id)?.name,
    [mosques.data],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([feed.reload(), mosques.reload(), commitments.reload()]).finally(() =>
      setRefreshing(false),
    );
  }, [feed, mosques, commitments]);

  const primaryMosque = mosques.data?.[0] ?? null;
  const posts = feed.data ?? [];

  if (feed.loading && mosques.loading) {
    return (
      <Screen>
        <Loading label={t.loading} />
      </Screen>
    );
  }

  if (mosques.data && mosques.data.length === 0) {
    return (
      <Screen padded={false} edges={['top', 'left', 'right']}>
        <View style={styles.padded}>
          <EmptyState
            title={t.followMosqueTitle}
            message={t.followMosqueBody}
            actionLabel={t.findMosques}
            onAction={() => router.push('/mosques')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <FlatList
        data={posts}
        keyExtractor={(post) => post._id}
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
        ListHeaderComponent={
          <View>
            {/* The masthead. Full-bleed, under the status bar. */}
            {primaryMosque ? <PrayerCard mosque={primaryMosque} /> : null}

            {/* Filter pills on a white strip, exactly as the prototype. */}
            <View style={styles.filterBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {FILTERS.map((value) => (
                  <Chip
                    key={value}
                    label={value === 'all' ? t.all : postTypeLabel(t, value)}
                    selected={filter === value}
                    onPress={() => setFilter(value)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.padded}>
            {feed.loading ? (
              <Loading variant="inline" label={t.loading} />
            ) : (
              <EmptyState
                title={filter === 'all' ? t.nothingComingUp : t.nothingComingUp}
                message={filter === 'all' ? t.nothingComingUpBody : t.tryAnotherFilter}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            mosqueName={mosqueName(item.mosqueId)}
            committed={committedIds.has(item._id)}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: item._id } })}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxxl, flexGrow: 1, backgroundColor: colors.background },
  padded: { paddingHorizontal: feedPadding },
  filterBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
    paddingVertical: 10,
  },
  chips: { gap: spacing.sm, paddingHorizontal: 14 },
});
