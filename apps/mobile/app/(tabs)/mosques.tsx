/**
 * Mosques — the prototype's map screen: a gradient header, the OSM map beneath
 * it, the mosque list, and today's prayer table for whichever mosque is
 * selected. Tapping a pin selects its row and vice versa.
 */

import { useRouter } from 'expo-router';
import { CalendarDays, ExternalLink } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  Button,
  EmptyState,
  GradientHeader,
  Loading,
  LocationPill,
  MosqueMap,
  PrayerTable,
  Screen,
  SectionTitle,
  Segmented,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useNextPrayer } from '@/hooks/useNextPrayer';
import { useLang } from '@/i18n';
import { cityName, mosqueCity } from '@/lib/cities';
import { useLocation } from '@/store/location';
import { todayDateString } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { colors, feedPadding, icon as iconSize, radius, spacing, type } from '@/theme';
import type { Mosque } from '@/types';

export default function MosquesScreen() {
  const router = useRouter();
  const { t, lang, isAr, align, row, font } = useLang();
  const { browsingCity } = useLocation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<'all' | 'following'>('all');
  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<string, number>>({});

  const mosques = useApi(() => api.getMosques(), []);
  const followed = useApi(() => api.getFollowedMosques(), []);
  const followedIds = new Set((followed.data ?? []).map((m) => m._id));

  // "All" is every mosque in the city you're browsing — the directory is large,
  // so "Following" is the short list people actually come back to.
  const inCity = (mosques.data ?? []).filter((m) => mosqueCity(m).id === browsingCity.id);
  const list = scope === 'following' ? inCity.filter((m) => followedIds.has(m._id)) : inCity;
  const active = list.find((m) => m._id === selectedId) ?? list[0] ?? null;

  // The table under the list follows whichever mosque is selected.
  const table = useApi(
    async () => (active ? api.getPrayerTimes(active._id, todayDateString()) : null),
    [active?._id],
  );
  const { next } = useNextPrayer(active?._id ?? null);

  // Default the selection to the first mosque once the list arrives.
  useEffect(() => {
    if (list.length === 0) return;
    if (!selectedId || !list.some((m) => m._id === selectedId)) setSelectedId(list[0]!._id);
  }, [list, selectedId]);

  function selectMosque(id: string) {
    tap();
    setSelectedId(id);
    const y = rowOffsets.current[id];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(y - 80, 0), animated: true });
    }
  }

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

  function openDirections(mosque: Mosque) {
    const { lat, lng } = mosque.coordinates;
    void Linking.openURL(`https://www.openstreetmap.org/directions?from=&to=${lat}%2C${lng}`).catch(
      () => {},
    );
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
      >
        <MosqueMap
          mosques={list}
          selectedId={selectedId}
          onSelect={selectMosque}
          height={220}
          style={styles.map}
        />

        <View style={styles.padded}>
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

          {list.length === 0 ? (
            <EmptyState
              title={scope === 'following' ? t.notFollowingAny : t.noMosques}
              {...(scope === 'following' ? { message: t.nearbyMosques } : {})}
            />
          ) : (
            list.map((mosque) => {
              const isFollowed = followedIds.has(mosque._id);
              const isSelected = mosque._id === active?._id;
              return (
                <View
                  key={mosque._id}
                  onLayout={(e) => {
                    rowOffsets.current[mosque._id] = e.nativeEvent.layout.y;
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={mosque.name}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => selectMosque(mosque._id)}
                    onLongPress={() =>
                      router.push({ pathname: '/mosque/[id]', params: { id: mosque._id } })
                    }
                    style={({ pressed }) => [
                      styles.row,
                      row,
                      isSelected && styles.rowSelected,
                      pressed && styles.pressed,
                    ]}
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
                        {mosque.address}
                      </Text>
                    </View>

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
                  </Pressable>

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

          {/* Today's table for the selected mosque. */}
          {active ? (
            <View style={styles.tableBlock}>
              <SectionTitle title={`${t.todayPrayers} · ${active.name}`} />
              {table.data ? (
                <PrayerTable table={table.data} highlight={next?.prayer ?? null} />
              ) : (
                <Loading variant="inline" label={t.loading} />
              )}
              <Button
                label={t.seeFullMonth}
                icon={CalendarDays}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/prayer-month/[mosqueId]',
                    params: { mosqueId: active._id },
                  })
                }
                style={styles.monthButton}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxxl },
  scopeRow: { marginBottom: spacing.md },
  padded: { paddingHorizontal: feedPadding },
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

  tableBlock: { marginTop: spacing.xl },
  monthButton: { marginTop: spacing.md },
});
