/**
 * Mosque profile — where it is, a follow button, today's prayer table (adhan
 * beside the iqamah this mosque actually prays at), and its upcoming posts.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Check, KeyRound, MapPin, Navigation } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  BackBar,
  Button,
  Card,
  EmptyState,
  GradientHeader,
  Loading,
  MosqueMap,
  PostCard,
  PrayerTable,
  Screen,
  SectionTitle,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useNextPrayer } from '@/hooks/useNextPrayer';
import { useLang } from '@/i18n';
import { success, warn } from '@/lib/haptics';
import { colors, feedPadding, icon, screenPadding, spacing, type } from '@/theme';

export default function MosqueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, align, row, font } = useLang();
  const [busy, setBusy] = useState(false);

  const mosque = useApi(() => api.getMosque(id), [id]);
  const followed = useApi(() => api.getFollowedMosques(), []);
  const posts = useApi(() => api.getMosquePosts(id), [id]);
  const { next, today } = useNextPrayer(id);

  const isFollowed = followed.data?.some((m) => m._id === id) ?? false;

  async function toggleFollow() {
    setBusy(true);
    try {
      if (isFollowed) await api.unfollowMosque(id);
      else {
        await api.followMosque(id);
        success();
      }
      await followed.reload();
    } catch {
      warn();
      Alert.alert(t.couldNotUpdate, t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  if (mosque.loading) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  if (!mosque.data) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} />
        <View style={styles.body}>
          <EmptyState title={t.noMosques} message={mosque.error ?? t.postRemoved} />
        </View>
      </Screen>
    );
  }

  const m = mosque.data;

  function openDirections() {
    const { lat, lng } = m.coordinates;
    void Linking.openURL(`https://www.openstreetmap.org/directions?from=&to=${lat}%2C${lng}`).catch(
      () => {},
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} title={m.name} subtitle={m.address} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <MosqueMap mosques={[m]} selectedId={m._id} height={180} interactive={false} />

        <View style={styles.body}>
          <Card>
            <View style={[styles.row, row]}>
              <MapPin color={colors.inkMuted} size={icon.sm} strokeWidth={1.8} />
              <Text style={[font(styles.rowText), align]} numberOfLines={2}>
                {m.address}
              </Text>
            </View>
            <View style={[styles.row, row]}>
              <KeyRound color={colors.inkMuted} size={icon.sm} strokeWidth={1.8} />
              <Text style={[font(styles.rowText), align]}>
                {t.joinCode} {m.joinCode}
              </Text>
            </View>
          </Card>

          <View style={[styles.actions, row]}>
            <Button
              label={isFollowed ? t.following : t.follow}
              icon={isFollowed ? Check : undefined}
              variant={isFollowed ? 'secondary' : 'primary'}
              size="lg"
              loading={busy || followed.loading}
              onPress={() => void toggleFollow()}
              style={styles.grow}
            />
            <Button
              label={t.directions}
              icon={Navigation}
              variant="secondary"
              size="lg"
              fullWidth={false}
              onPress={openDirections}
            />
          </View>

          <SectionTitle title={t.todayPrayers} style={styles.sectionGap} />
          {today ? (
            <PrayerTable table={today} highlight={next?.prayer ?? null} />
          ) : (
            <Card>
              <Loading variant="inline" label={t.loading} />
            </Card>
          )}
          <Button
            label={t.seeFullMonth}
            icon={CalendarDays}
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/prayer-month/[mosqueId]', params: { mosqueId: m._id } })
            }
          />

          <SectionTitle title={t.comingUp} style={styles.sectionGap} />
        </View>

        {/* Posts run full-bleed like the feed — same card, same rhythm. */}
        {posts.loading ? (
          <View style={styles.body}>
            <Loading variant="inline" />
          </View>
        ) : (posts.data ?? []).length === 0 ? (
          <View style={styles.body}>
            <EmptyState title={t.nothingComingUp} message={t.nothingComingUpBody} />
          </View>
        ) : (
          (posts.data ?? []).map((post) => (
            <PostCard
              key={post._id}
              post={post}
              mosqueName={m.name}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: post._id } })}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: screenPadding, paddingTop: spacing.lg, gap: 14 },
  row: { alignItems: 'center', gap: spacing.sm },
  rowText: { ...type.small, color: colors.ink, flex: 1 },
  actions: { gap: spacing.sm },
  grow: { flex: 1 },
  sectionGap: { marginTop: spacing.md },
});
