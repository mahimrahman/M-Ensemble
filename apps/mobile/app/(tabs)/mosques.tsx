/**
 * Mosques — the prototype's map screen: a gradient header, the OSM map beneath
 * it, and the mosque list. Tapping a pin selects its row and vice versa;
 * tapping the selected row again puts it away.
 *
 * Three ways to narrow a city's directory, and they compose:
 *   the search box   by name or address, accents ignored
 *   All / Following  the short list you actually come back to
 *   Near me          sorted by how far it is, with your dot on the map
 */

import { useRouter } from 'expo-router';
import { Crosshair, ExternalLink, Search, Star, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  Button,
  EmptyState,
  ErrorState,
  GradientHeader,
  Loading,
  LocationPill,
  MosqueMap,
  Screen,
  Segmented,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { fill, useLang } from '@/i18n';
import { cityName, distanceKm, mosqueCity } from '@/lib/cities';
import { useLocation } from '@/store/location';
import { useStarred } from '@/store/starred';
import { tap } from '@/lib/haptics';
import { colors, icon as iconSize, radius, rule, screenPadding, spacing, type } from '@/theme';
import type { Mosque } from '@/types';

/**
 * Search key for a mosque: lower-cased with its accents decomposed and
 * dropped, so "Khadija" finds "Khadîja" and "montreal" finds "Montréal".
 * Nobody reaches for the accent keys while searching on a phone.
 */
function searchKey(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function MosquesScreen() {
  const router = useRouter();
  const { t, lang, isAr, align, row, font } = useLang();
  const { browsingCity, coords, detectedCity, setBrowsingCity, status, requestLocation } =
    useLocation();
  const { isStarred, toggleStarred } = useStarred();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<'all' | 'following'>('all');
  const [query, setQuery] = useState('');
  const [nearMe, setNearMe] = useState(false);
  /** Bumped to ask the map to fly back to the blue dot. */
  const [focusMe, setFocusMe] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<string, number>>({});

  const mosques = useApi(() => api.getMosques(), []);
  const followed = useApi(() => api.getFollowedMosques(), []);
  const followedIds = new Set((followed.data ?? []).map((m) => m._id));

  // "All" is every mosque in the city you're browsing — the directory is large,
  // so "Following" is the short list people actually come back to.
  const inCity = (mosques.data ?? []).filter((m) => mosqueCity(m).id === browsingCity.id);
  const inScope = scope === 'following' ? inCity.filter((m) => followedIds.has(m._id)) : inCity;

  const needle = searchKey(query);
  const matched = needle
    ? inScope.filter((m) => searchKey(`${m.name} ${m.address}`).includes(needle))
    : inScope;

  /** How far a mosque is, once there's a fix to measure from. */
  function kmFrom(mosque: Mosque): number | null {
    return coords ? distanceKm(coords, mosque.coordinates) : null;
  }

  const list =
    nearMe && coords ? [...matched].sort((a, b) => (kmFrom(a) ?? 0) - (kmFrom(b) ?? 0)) : matched;

  // Prayer times are not here any more: they live on the mosque's own page,
  // where the name at the top says whose times these are. On this list a table
  // pinned under a selection kept answering a question nobody had asked yet.

  // A selection only survives while its mosque is still in the list — search it
  // away and the open row would linger as an invisible one.
  useEffect(() => {
    if (selectedId && !list.some((m) => m._id === selectedId)) setSelectedId(null);
  }, [list, selectedId]);

  /** Tapping the open row closes it — the same tap, undone. */
  function selectMosque(id: string) {
    tap();
    if (id === selectedId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    const y = rowOffsets.current[id];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(y - 80, 0), animated: true });
    }
  }

  /**
   * "Near me" needs a fix, and may not have one yet. Asking is the same call
   * the first-run prompt makes, so a reader who dismissed that one is asked
   * again here — by pressing a button that says what it wants it for.
   */
  async function toggleNearMe() {
    tap();
    if (nearMe) {
      setNearMe(false);
      return;
    }
    if (!coords) await requestLocation();
    setNearMe(true);
    setFocusMe((n) => n + 1);
  }

  // Once a fix lands with "near me" on: if the reader is standing in a
  // different city from the one on screen, show them theirs. Sorting Toronto's
  // mosques by distance from Montréal is a list of equally wrong answers.
  useEffect(() => {
    if (!nearMe || !detectedCity || detectedCity.id === browsingCity.id) return;
    setBrowsingCity(detectedCity);
  }, [nearMe, detectedCity, browsingCity.id, setBrowsingCity]);

  async function toggleFollow(mosque: Mosque) {
    setBusyId(mosque._id);
    try {
      if (followedIds.has(mosque._id)) await api.unfollowMosque(mosque._id);
      else await api.followMosque(mosque._id);
      await followed.reload();
    } catch {
      Alert.alert(t.couldNotUpdate, t.tryAgain);
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Directions, in Google Maps.
   *
   * The tap leaves the app, so it asks first — being thrown into another app
   * is the one thing this row can do that tapping again won't undo. `?api=1`
   * is Google's documented cross-platform URL: it opens the Maps app where one
   * is installed and the website where none is, so there is no per-platform
   * scheme to get wrong.
   */
  function openDirections(mosque: Mosque) {
    const { lat, lng } = mosque.coordinates;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    Alert.alert(t.openInMaps, fill(t.openInMapsBody, { name: mosque.name }), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.openMaps,
        onPress: () => {
          void Linking.openURL(url).catch(() => {
            Alert.alert(t.couldNotOpenMaps, t.tryAgain);
          });
        },
      },
    ]);
  }

  if (mosques.loading) {
    return (
      <Screen>
        <Loading label={t.loading} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        title={t.mosques}
        subtitle={t.nearbyMosques + ' · ' + cityName(browsingCity, lang)}
        right={<LocationPill tone="onDark" />}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <MosqueMap
          mosques={list}
          selectedId={selectedId}
          onSelect={selectMosque}
          me={coords}
          meLabel={t.youAreHere}
          focusMe={focusMe}
          centreOnMe={nearMe && !!coords}
          height={220}
          style={styles.map}
        />

        <View style={styles.padded}>
          <View style={[styles.searchRow, row]}>
            <View style={[styles.search, row]}>
              <Search color={colors.inkFaint} size={iconSize.md} strokeWidth={2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t.searchMosques}
                placeholderTextColor={colors.inkFaint}
                style={[font(styles.searchInput), align]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {/* Android draws no clear button of its own, so here is one. */}
              {query ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.clearSearch}
                  hitSlop={8}
                  onPress={() => {
                    tap();
                    setQuery('');
                  }}
                >
                  <X color={colors.inkFaint} size={iconSize.sm} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.nearMe}
              accessibilityState={{ selected: nearMe }}
              onPress={() => void toggleNearMe()}
              style={({ pressed }) => [
                styles.nearBtn,
                nearMe && styles.nearBtnOn,
                pressed && styles.pressed,
              ]}
            >
              <Crosshair
                color={nearMe ? colors.inkInverse : colors.accent}
                size={iconSize.md}
                strokeWidth={2}
              />
            </Pressable>
          </View>

          <View style={styles.scopeRow}>
            <Segmented
              options={[
                { value: 'all', label: `${t.all} (${inCity.length})` },
                {
                  value: 'following',
                  label: `${t.following} (${inCity.filter((m) => followedIds.has(m._id)).length})`,
                },
              ]}
              value={scope}
              onChange={(next) => {
                tap();
                setScope(next);
              }}
            />
          </View>

          {/* What the list is doing, said only when it isn't the default. */}
          {nearMe ? (
            <Text style={[font(styles.sortNote), align]}>
              {status === 'locating' ? t.locating : coords ? t.showingNearest : t.locationDenied}
            </Text>
          ) : null}

          {list.length === 0 && mosques.error ? (
            <ErrorState message={mosques.error} onRetry={() => void mosques.reload()} />
          ) : list.length === 0 && needle ? (
            <EmptyState
              title={t.noMatches}
              message={fill(t.noMatchesBody, { query })}
              actionLabel={t.clearSearch}
              onAction={() => setQuery('')}
            />
          ) : list.length === 0 ? (
            <EmptyState
              title={scope === 'following' ? t.notFollowingAny : t.noMosques}
              {...(scope === 'following' ? { message: t.nearbyMosques } : {})}
            />
          ) : (
            list.map((mosque) => {
              const isFollowed = followedIds.has(mosque._id);
              const isSelected = mosque._id === selectedId;
              const km = nearMe ? kmFrom(mosque) : null;
              return (
                <View
                  key={mosque._id}
                  onLayout={(e) => {
                    rowOffsets.current[mosque._id] = e.nativeEvent.layout.y;
                  }}
                >
                  {/*
                    A plain View, not a Pressable: the star and directions
                    buttons live inside it, and on web a Pressable with a
                    button role becomes a real <button>, which HTML forbids
                    nesting. The selectable part is the sibling Pressable
                    beside them, stretched to take the rest of the row.
                  */}
                  <View style={[styles.row, row, isSelected && styles.rowSelected]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={mosque.name}
                      accessibilityState={{ selected: isSelected, expanded: isSelected }}
                      onPress={() => selectMosque(mosque._id)}
                      onLongPress={() =>
                        router.push({ pathname: '/mosque/[id]', params: { id: mosque._id } })
                      }
                      style={({ pressed }) => [styles.rowMain, row, pressed && styles.pressed]}
                    >
                      <View style={[styles.icon, isSelected && styles.iconSelected]}>
                        <Text style={styles.iconGlyph}>🕌</Text>
                      </View>

                      <View style={styles.rowText}>
                        {isFollowed ? (
                          <Text style={font(styles.following)}>{t.following.toUpperCase()}</Text>
                        ) : null}
                        <Text
                          style={[font(styles.name), align, isSelected && styles.nameSelected]}
                          numberOfLines={1}
                        >
                          {mosque.name}
                        </Text>
                        <Text style={[font(styles.address), align]} numberOfLines={1}>
                          {km === null
                            ? mosque.address
                            : `${fill(t.kmAway, { km: km.toFixed(1) })} · ${mosque.address}`}
                        </Text>
                      </View>
                    </Pressable>

                    {/*
                      Starring picks whose prayer times the home screen shows.
                      Separate from following on purpose: you follow a mosque
                      for its posts, you star the one you actually pray at.
                    */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.starForPrayerTimes}
                      accessibilityState={{ selected: isStarred(mosque._id) }}
                      hitSlop={8}
                      onPress={() => {
                        tap();
                        toggleStarred(mosque._id);
                      }}
                      style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                    >
                      <Star
                        color={isStarred(mosque._id) ? colors.star : colors.inkFaint}
                        fill={isStarred(mosque._id) ? colors.star : 'none'}
                        size={iconSize.sm}
                        strokeWidth={2}
                      />
                    </Pressable>

                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={t.directions}
                      hitSlop={8}
                      onPress={() => openDirections(mosque)}
                      style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                    >
                      <ExternalLink
                        color={colors.accent}
                        size={iconSize.sm}
                        strokeWidth={2}
                        style={isAr ? styles.flip : undefined}
                      />
                    </Pressable>
                  </View>

                  {/* Follow / open sit under the row so the row itself selects. */}
                  {isSelected ? (
                    <View style={[styles.rowActions, row]}>
                      <Button
                        label={isFollowed ? t.unfollow : t.follow}
                        variant={isFollowed ? 'secondary' : 'primary'}
                        size="sm"
                        fullWidth={false}
                        loading={busyId === mosque._id}
                        onPress={() => void toggleFollow(mosque)}
                      />
                      <Button
                        label={t.details}
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        onPress={() =>
                          router.push({ pathname: '/mosque/[id]', params: { id: mosque._id } })
                        }
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxxl },
  searchRow: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  search: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 14,
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  searchInput: { ...type.small, lineHeight: undefined, color: colors.ink, flex: 1, padding: 0 },
  nearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: rule,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
  },
  nearBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  scopeRow: { marginTop: spacing.md, marginBottom: spacing.md },
  sortNote: { ...type.caption, color: colors.inkMuted, marginBottom: 2 },
  padded: { paddingHorizontal: screenPadding },
  map: { marginHorizontal: 0, borderRadius: 0, borderWidth: 0 },

  row: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    marginTop: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  /** The tappable name-and-address part; takes every pixel the buttons leave. */
  rowMain: { flex: 1, alignItems: 'center', gap: spacing.md },
  rowSelected: { backgroundColor: '#EDF7F6', borderColor: colors.ruleStrong },
  pressed: { opacity: 0.75 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md + 2,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelected: { backgroundColor: colors.accentWashStrong },
  iconGlyph: { fontSize: 18 },
  rowText: { flex: 1, gap: 1 },
  following: { ...type.overline, fontSize: 9, color: colors.accent },
  name: { ...type.bodyStrong, color: colors.ink },
  nameSelected: { color: colors.accent },
  address: { ...type.caption, color: colors.inkMuted },
  linkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  flip: { transform: [{ scaleX: -1 }] },
  rowActions: { gap: spacing.sm, paddingTop: spacing.sm, paddingHorizontal: 2 },
});
