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
import type { ServedAd } from '@m-ensemble/shared';
import { api } from '@/api/client';
import { getAds } from '@/api/ads';
import {
  Chip,
  EmptyState,
  ErrorState,
  LocationPill,
  LocationPrompt,
  Loading,
  NotificationBell,
  PostCard,
  hasPosterArt,
  PrayerCard,
  PromoCard,
  Screen,
  postTypeLabel,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { fill, useLang } from '@/i18n';
import { cityName, mosqueCity } from '@/lib/cities';
import { useLocation } from '@/store/location';
import { useStarred } from '@/store/starred';
import { colors, feedPadding, rule, spacing } from '@/theme';
import type { Post, PostType } from '@/types';

type Filter = 'all' | PostType;

const FILTERS: Filter[] = ['all', 'volunteer', 'event', 'class', 'announcement'];

/** Text posts between one poster and the next. */
const TEXT_BETWEEN_POSTERS = 2;

/**
 * Where a partner card may appear, counted in posts from the top.
 *
 * Never first: the mosque's own noticeboard opens the feed, and an advert in
 * that position reads as the mosque endorsing it. Three posts in is far enough
 * down that the reader has already had what they came for.
 */
const AD_SLOTS = [3, 11];

/** One row of the feed. A post, or a partner card between two of them. */
type FeedRow = { kind: 'post'; post: Post } | { kind: 'ad'; ad: ServedAd };

export default function FeedScreen() {
  const router = useRouter();
  const { t, lang, row } = useLang();
  const { browsingCity } = useLocation();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { starredId } = useStarred();

  const allMosques = useApi(() => api.getMosques(), []);
  const followed = useApi(() => api.getFollowedMosques(), []);
  const commitments = useApi(() => api.getCommitments(), []);

  const cityMosques = useMemo(
    () => (allMosques.data ?? []).filter((m) => mosqueCity(m).id === browsingCity.id),
    [allMosques.data, browsingCity.id],
  );
  const cityKey = cityMosques.map((m) => m._id).join(',');

  const feed = useApi(async () => {
    if (!cityMosques.length) return [];
    return api.getFeed({
      mosqueIds: cityMosques.map((m) => m._id),
      ...(filter === 'all' ? {} : { types: [filter] }),
    });
  }, [filter, cityKey]);

  const committedIds = useMemo(
    () => new Set((commitments.data ?? []).map((s) => s.postId)),
    [commitments.data],
  );
  const mosqueName = useCallback(
    (id: string) => allMosques.data?.find((m) => m._id === id)?.name,
    [allMosques.data],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([
      feed.reload(),
      allMosques.reload(),
      followed.reload(),
      commitments.reload(),
    ]).finally(() => setRefreshing(false));
  }, [feed, allMosques, followed, commitments]);

  /**
   * Whose prayer times the masthead shows.
   *
   * The star wins outright, wherever that mosque is - somebody who starred the
   * mosque they pray at should keep seeing its times while browsing another
   * city. Failing that, a mosque they follow here; failing that, any mosque in
   * the city, which is the generic default.
   */
  const starredMosque = (allMosques.data ?? []).find((m) => m._id === starredId) ?? null;
  const primaryMosque =
    starredMosque ??
    cityMosques.find((m) => (followed.data ?? []).some((f) => f._id === m._id)) ??
    cityMosques[0] ??
    null;
  /**
   * The feed, arranged so it doesn't read as a wall of notices.
   *
   * A poster leads, then roughly two text posts before the next one. Chronology
   * still governs within each group - this only decides how the two kinds are
   * woven together, so the eye gets a picture early and then again before it
   * tires. Once either kind runs out the rest follows in date order.
   */
  const posts = useMemo(() => {
    const chronological = feed.data ?? [];
    const withArt = chronological.filter((post) => hasPosterArt(post));
    const textOnly = chronological.filter((post) => !hasPosterArt(post));

    const woven: typeof chronological = [];
    let i = 0;
    let j = 0;
    while (i < withArt.length || j < textOnly.length) {
      if (i < withArt.length) woven.push(withArt[i++]!);
      for (let k = 0; k < TEXT_BETWEEN_POSTERS && j < textOnly.length; k += 1) {
        woven.push(textOnly[j++]!);
      }
      // Nothing left to break up the images with: the remaining posters follow.
      if (j >= textOnly.length) {
        while (i < withArt.length) woven.push(withArt[i++]!);
      }
    }
    return woven;
  }, [feed.data]);

  /**
   * Partner cards for this city.
   *
   * Fetched separately from the feed and never awaited alongside it: an advert
   * is the least important thing on this screen, and the posts must not wait on
   * one. `getAds` swallows its own failures, so there is no error state here
   * either — no ads simply means no ad rows.
   */
  const ads = useApi(
    () => getAds({ placement: 'feed', city: browsingCity.id, limit: AD_SLOTS.length }),
    [browsingCity.id],
  );

  /**
   * The posts with partner cards woven in at fixed depths.
   *
   * A slot past the end of the feed is dropped rather than pushed to the
   * bottom: an advert below the last post, with nothing after it, is the most
   * prominent thing on the screen — the opposite of what the slot positions are
   * for.
   */
  const rows = useMemo<FeedRow[]>(() => {
    const out: FeedRow[] = posts.map((post) => ({ kind: 'post', post }));
    const available = ads.data ?? [];

    // Inserted back to front so an earlier insertion does not shift the index
    // of a later one.
    for (let slot = AD_SLOTS.length - 1; slot >= 0; slot -= 1) {
      const ad = available[slot];
      const at = AD_SLOTS[slot]!;
      if (!ad || at >= posts.length) continue;
      out.splice(at, 0, { kind: 'ad', ad });
    }
    return out;
  }, [posts, ads.data]);

  if (allMosques.loading) {
    return (
      <Screen>
        <Loading label={t.loading} />
      </Screen>
    );
  }

  // Without the mosque list there is no city, no filter and no feed, so this
  // failure takes the whole screen rather than showing an empty one.
  if (!allMosques.data && allMosques.error) {
    return (
      <Screen>
        <ErrorState message={allMosques.error} onRetry={() => void allMosques.reload()} />
      </Screen>
    );
  }

  if (allMosques.data && cityMosques.length === 0) {
    return (
      <Screen padded={false} edges={['top', 'left', 'right']}>
        <LocationPrompt />
        <View style={styles.padded}>
          {/* No mosques here means no masthead, so the bell — which normally
              lives on it — comes down to the pill row rather than vanishing. */}
          <View style={[styles.pillRow, row]}>
            <LocationPill />
            <NotificationBell tone="onLight" />
          </View>
          <EmptyState
            title={fill(t.noMosquesInCity, { city: cityName(browsingCity, lang) })}
            message={t.nothingComingUpBody}
            actionLabel={t.changeCity}
            onAction={() => router.push('/cities')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <LocationPrompt />
      <FlatList
        data={rows}
        keyExtractor={(item) => (item.kind === 'post' ? item.post._id : `ad_${item.ad.campaignId}`)}
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
                <LocationPill />
                <View style={styles.chipDivider} />
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
            ) : feed.error ? (
              // "Nothing coming up" would be a lie when the request failed.
              <ErrorState message={feed.error} onRetry={() => void feed.reload()} />
            ) : (
              <EmptyState
                title={t.nothingComingUp}
                message={filter === 'all' ? t.nothingComingUpBody : t.tryAnotherFilter}
              />
            )}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'ad' ? (
            <PromoCard ad={item.ad} />
          ) : (
            <PostCard
              post={item.post}
              mosqueName={mosqueName(item.post.mosqueId)}
              committed={committedIds.has(item.post._id)}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.post._id } })}
            />
          )
        }
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
  chips: { gap: spacing.sm, paddingHorizontal: 14, alignItems: 'center' },
  chipDivider: { width: rule, height: 20, backgroundColor: colors.rule, marginHorizontal: 2 },
  pillRow: { paddingTop: spacing.lg, alignItems: 'center', justifyContent: 'space-between' },
});
