/**
 * Mosque profile — where it is and how to reach it, a follow button, what the
 * mosque says about itself (about, services, history), today's prayer table
 * (adhan beside the iqamah this mosque actually prays at), and its posts.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarDays,
  Check,
  Globe,
  KeyRound,
  MapPin,
  Navigation,
  Phone,
  Star,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useStarred } from '@/store/starred';
import { success, tap, warn } from '@/lib/haptics';
import { colors, feedPadding, icon, screenPadding, spacing, type } from '@/theme';

export default function MosqueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, align, row, font } = useLang();
  const [busy, setBusy] = useState(false);
  const { isStarred, toggleStarred } = useStarred();

  const mosque = useApi(() => api.getMosque(id), [id]);
  const followed = useApi(() => api.getFollowedMosques(), []);
  const posts = useApi(() => api.getMosquePosts(id), [id]);
  const { next, today } = useNextPrayer(id);

  const isFollowed = followed.data?.some((m) => m._id === id) ?? false;

  /**
   * Nobody runs this mosque in the app yet. Read off the prayer table we
   * already fetched rather than asking the server a second question: a mosque
   * with a coordinator has entered iqamah times, and one without has none.
   */
  const isUnclaimed = !!today && today.rows.every((r) => r.iqamah === null);

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
            {m.rating ? (
              <View style={[styles.row, row]}>
                <Star color={colors.inkMuted} size={icon.sm} strokeWidth={1.8} />
                {/* Two Texts, not one interpolated string: the score keeps its
                    own weight, and the pair reorders under RTL on its own. */}
                <Text style={font(styles.ratingScore)}>{m.rating.score.toFixed(1)}</Text>
                <Text style={[font(styles.rowText), align]}>
                  {m.rating.count} {t.reviews}
                </Text>
              </View>
            ) : null}
            {m.phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.callMosque} ${m.phone}`}
                onPress={() => void Linking.openURL(`tel:${m.phone}`).catch(() => {})}
                style={[styles.row, row]}
              >
                <Phone color={colors.inkMuted} size={icon.sm} strokeWidth={1.8} />
                <Text style={[font(styles.linkText), align]}>{m.phone}</Text>
              </Pressable>
            ) : null}
            {m.website ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${t.visitWebsite} ${m.website}`}
                onPress={() => void Linking.openURL(`https://${m.website}`).catch(() => {})}
                style={[styles.row, row]}
              >
                <Globe color={colors.inkMuted} size={icon.sm} strokeWidth={1.8} />
                <Text style={[font(styles.linkText), align]} numberOfLines={1}>
                  {m.website}
                </Text>
              </Pressable>
            ) : null}
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

          {/* The mosque in its own words. Every field is optional, so each
              section disappears rather than rendering an empty heading. */}
          {m.bio ? (
            <>
              <SectionTitle title={t.about} style={styles.sectionGap} />
              <Card>
                <Text style={[font(styles.prose), align]}>{m.bio}</Text>
              </Card>
            </>
          ) : null}

          {m.services?.length ? (
            <>
              <SectionTitle title={t.whatWeOffer} style={styles.sectionGap} />
              <Card>
                <View style={styles.services}>
                  {m.services.map((service) => (
                    <View key={service} style={[styles.serviceRow, row]}>
                      <View style={styles.bullet} />
                      <Text style={[font(styles.serviceText), align]}>{service}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {m.history ? (
            <>
              <SectionTitle title={t.ourHistory} style={styles.sectionGap} />
              <Card>
                <Text style={[font(styles.prose), align]}>{m.history}</Text>
              </Card>
            </>
          ) : null}

          {/*
            Most of the directory is mosques nobody has claimed in the app. Say
            so once, here, rather than letting an empty iqamah column and an
            empty events list read as a bug. The prayer table below is still
            real — adhan is computed from coordinates — it is only the iqamah
            that needs a mosque to have entered it.
          */}
          {isUnclaimed ? (
            <Card>
              <Text style={[font(styles.unclaimedTitle), align]}>{t.unclaimedMosque}</Text>
              <Text style={[font(styles.prose), align]}>{t.unclaimedMosqueBody}</Text>
            </Card>
          ) : null}

          <SectionTitle title={t.todayPrayers} style={styles.sectionGap} />

          {/*
            Starring is about the clock, not the feed - so it lives beside the
            prayer table rather than next to Follow. One mosque at a time; the
            home screen shows generic times when none is starred.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isStarred(id) }}
            onPress={() => {
              tap();
              toggleStarred(id);
            }}
            style={({ pressed }) => [
              styles.starRow,
              row,
              isStarred(id) && styles.starRowOn,
              pressed && styles.pressedRow,
            ]}
          >
            <Star
              color={isStarred(id) ? colors.star : colors.inkFaint}
              fill={isStarred(id) ? colors.star : 'none'}
              size={icon.md}
              strokeWidth={2}
            />
            <View style={styles.starText}>
              <Text style={[font(styles.starTitle), align]}>
                {isStarred(id) ? t.starredMosque : t.starForPrayerTimes}
              </Text>
              <Text style={[font(styles.starHint), align]}>{t.starHint}</Text>
            </View>
          </Pressable>
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
  linkText: { ...type.small, color: colors.accent, flex: 1 },
  starRow: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.rule,
    marginBottom: spacing.md,
  },
  starRowOn: { borderColor: colors.starBorder, backgroundColor: colors.starWash },
  pressedRow: { opacity: 0.75 },
  starText: { flex: 1, gap: 2 },
  starTitle: { ...type.bodyStrong, color: colors.ink },
  starHint: { ...type.small, color: colors.inkMuted },
  unclaimedTitle: { ...type.h3, color: colors.ink, marginBottom: spacing.xs },
  ratingScore: { ...type.smallStrong, color: colors.ink },

  /** Body copy the mosque wrote. Looser leading than a data row. */
  prose: { ...type.body, color: colors.ink },
  services: { gap: spacing.sm },
  serviceRow: { alignItems: 'flex-start', gap: spacing.md },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.accent,
    // Sits on the first line's optical centre rather than its top.
    marginTop: 9,
  },
  serviceText: { ...type.small, color: colors.ink, flex: 1 },
  actions: { gap: spacing.sm },
  grow: { flex: 1 },
  sectionGap: { marginTop: spacing.md },
});
