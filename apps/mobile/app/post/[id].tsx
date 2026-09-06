/**
 * Post detail — three variants on one route, in the prototype's shape:
 *   gradient header with the title, the poster, then white cards on pale,
 *   and a volunteer CTA floating above the bottom edge.
 *
 *   volunteer     slot meter, who's in, claim / withdraw
 *   event, class  capacity, sessions for a class, going / can't make it
 *   announcement  just the message
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '@/hooks/useTopInset';
import { LATE_CANCEL_HOURS } from '@m-ensemble/shared';
import { API_ERROR, api, isApiError } from '@/api/client';
import {
  BackBar,
  Button,
  Card,
  EmptyState,
  Loading,
  Meter,
  People,
  Poster,
  Screen,
  isPosterPost,
  postTypeLabel,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { fill, useLang } from '@/i18n';
import { cityName, mosqueCity } from '@/lib/cities';
import { useLocation } from '@/store/location';
import { formatDay, formatTime, formatWhen } from '@/lib/format';
import { success, warn } from '@/lib/haptics';
import { toWallClock } from '@/lib/prayer';
import { useAuth } from '@/store/auth';
import {
  colors,
  gradients,
  icon as iconSize,
  numeric,
  radius,
  screenPadding,
  spacing,
  type,
} from '@/theme';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { user, adminMosqueIds } = useAuth();
  const { t, lang, isAr, align, row, font } = useLang();
  const { status, canActIn, requestLocation } = useLocation();
  const [busy, setBusy] = useState(false);

  const post = useApi(() => api.getPost(id), [id]);
  const signups = useApi(() => api.getSignups(id), [id]);
  const mosque = useApi(
    async () => (post.data ? api.getMosque(post.data.mosqueId) : null),
    [post.data?.mosqueId],
  );

  const confirmed = useMemo(
    () => (signups.data ?? []).filter((s) => s.status === 'confirmed'),
    [signups.data],
  );
  const mine = confirmed.find((s) => s.userId === user?._id) ?? null;

  const people = useApi(
    async () => (confirmed.length ? api.getUsers(confirmed.map((s) => s.userId)) : []),
    [confirmed.map((s) => s.userId).join(',')],
  );

  /** Wall-clock check-in stamps, keyed by user, for the attendance line. */
  const checkedInAt = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of confirmed) {
      if (s.checkedInAt) map[s.userId] = toWallClock(new Date(s.checkedInAt));
    }
    return map;
  }, [confirmed]);

  async function reloadAll() {
    await Promise.all([post.reload(), signups.reload()]);
  }

  async function claim() {
    setBusy(true);
    try {
      await api.signup(id);
      success();
      await reloadAll();
    } catch (err) {
      if (isApiError(err, API_ERROR.FULL)) {
        warn();
        Alert.alert(t.slotTaken, t.slotTakenBody);
      } else if (isApiError(err, API_ERROR.ALREADY_SIGNED_UP)) {
        // Already in — the reload below will show it.
      } else {
        warn();
        Alert.alert(t.couldNotSignUp, t.tryAgain);
      }
      await reloadAll();
    } finally {
      setBusy(false);
    }
  }

  function confirmWithdraw() {
    const isVolunteer = post.data?.type === 'volunteer';

    // Inside the window the mosque can no longer replace you easily, so say
    // plainly what it costs before asking again. Outside it, withdrawing is
    // free and the prompt stays the gentle one — we want early notice.
    const hoursBefore = post.data
      ? (new Date(post.data.startAt).getTime() - Date.now()) / 3_600_000
      : Number.POSITIVE_INFINITY;
    const isLate = hoursBefore < LATE_CANCEL_HOURS;

    Alert.alert(
      isLate ? t.lateCancelTitle : isVolunteer ? t.giveUpSlot : t.notGoing,
      isLate ? t.lateCancelBody : isVolunteer ? t.giveUpBody : t.notGoingBody,
      [
        { text: t.keepIt, style: 'cancel' },
        {
          text: isLate ? t.lateCancelConfirm : isVolunteer ? t.withdraw : t.cantMakeIt,
          style: 'destructive',
          onPress: () => void withdraw(),
        },
      ],
    );
  }

  async function withdraw() {
    setBusy(true);
    try {
      // The server decides whether this counted as late — it re-reads the clock
      // at the write. Report what it actually recorded, not what we predicted.
      const result = await api.withdraw(id);
      if (result.lateCancelled) {
        warn();
        Alert.alert(t.lateCancelRecorded, t.lateCancelBody);
      }
    } catch {
      warn();
      Alert.alert(t.couldNotWithdraw, t.tryAgain);
    } finally {
      await reloadAll();
      setBusy(false);
    }
  }

  if (post.loading) {
    return (
      <Screen>
        <Loading label={t.loading} />
      </Screen>
    );
  }

  if (!post.data) {
    return (
      <Screen padded={false}>
        <LinearGradient
          colors={[...gradients.header]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: top + spacing.md }]}
        >
          <BackBar />
        </LinearGradient>
        <View style={styles.body}>
          <EmptyState title={t.postNotFound} message={post.error ?? t.postRemoved} />
        </View>
      </Screen>
    );
  }

  const p = post.data;
  const isVolunteer = p.type === 'volunteer';
  const isAnnouncement = p.type === 'announcement';
  const limit = p.slotsNeeded ?? p.capacity;
  const full = limit !== undefined && p.slotsFilled >= limit && !mine;
  const cancelled = !!p.cancelledAt;
  const isAdmin = adminMosqueIds.includes(p.mosqueId);
  const showCta = !cancelled && !isAnnouncement;
  const postCity = mosque.data ? mosqueCity(mosque.data) : null;
  const here = postCity ? canActIn(postCity.id) : false;
  const located = status === 'granted';

  return (
    <Screen padded={false} edges={['left', 'right']}>
      {/* ── Gradient header ── */}
      <LinearGradient
        colors={[...gradients.header]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: top + spacing.md }]}
      >
        <BackBar />
        <Text style={[font(styles.title), align]}>{p.title}</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/mosque/[id]', params: { id: p.mosqueId } })}
          style={({ pressed }) => [styles.mosqueRow, row, pressed && styles.pressed]}
        >
          <Text style={font(styles.mosqueName)}>{mosque.data?.name ?? '—'}</Text>
          <ArrowRight
            color={colors.inkOnDark}
            size={iconSize.xs}
            strokeWidth={2}
            style={isAr ? styles.flip : undefined}
          />
        </Pressable>
        <View style={[styles.tags, row]}>
          <Text style={font(styles.tag)}>{postTypeLabel(t, p.type).toUpperCase()}</Text>
          {cancelled ? (
            <Text style={[font(styles.tag), styles.tagCancelled]}>
              · {t.cancelled.toUpperCase()}
            </Text>
          ) : null}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, showCta && styles.scrollWithCta]}
        showsVerticalScrollIndicator={false}
      >
        {isPosterPost(p) ? (
          <Poster imageUrl={p.imageUrl} posterKey={p.posterKey} seed={p._id} height={180} radius={0} />
        ) : null}

        <View style={styles.body}>
          {/* ── When / where ── */}
          {!isAnnouncement ? (
            <Card>
              <View style={[styles.facts, row]}>
                <View style={styles.fact}>
                  <Text style={[font(styles.factLabel), align]}>{t.schedule.toUpperCase()}</Text>
                  <Text style={styles.factTime}>
                    {formatTime(p.startAt, lang)} – {formatTime(p.endAt, lang)}
                  </Text>
                  <Text style={[font(styles.factDay), align]}>{formatDay(p.startAt, lang)}</Text>
                </View>
                <View style={styles.factDivider} />
                <View style={styles.fact}>
                  <Text style={[font(styles.factLabel), align]}>{t.location.toUpperCase()}</Text>
                  <Text style={[font(styles.factValue), align]}>{p.location}</Text>
                </View>
              </View>
            </Card>
          ) : (
            <Text style={[font(styles.posted), align]}>
              {t.postedOn} {formatDay(p.createdAt, lang).toLowerCase()}
            </Text>
          )}

          {/* ── Slots + who's in ── */}
          {isVolunteer && p.slotsNeeded !== undefined ? (
            <Card>
              <Meter filled={p.slotsFilled} total={p.slotsNeeded} />
              <People
                people={people.data ?? []}
                total={confirmed.length}
                meId={user?._id}
                checkedInAt={checkedInAt}
              />
              {isAdmin ? (
                <Button
                  label={`${t.coordinator} →`}
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/manage/coverage/[id]', params: { id: p._id } })
                  }
                />
              ) : null}
            </Card>
          ) : null}

          {/* ── Capacity + sessions ── */}
          {!isVolunteer && !isAnnouncement ? (
            <Card>
              {p.capacity !== undefined ? (
                <Meter filled={p.slotsFilled} total={p.capacity} noun={t.going} />
              ) : (
                <Text style={font(styles.body_)}>
                  {p.slotsFilled} {t.going}
                </Text>
              )}
              {p.sessions && p.sessions.length > 0 ? (
                <View style={styles.sessions}>
                  <Text style={[font(styles.factLabel), align]}>
                    {p.sessions.length} {t.sessions.toUpperCase()}
                  </Text>
                  {p.sessions.map((session, index) => (
                    <View key={session.startAt} style={[styles.session, row]}>
                      <Text style={styles.sessionIndex}>{index + 1}</Text>
                      <Text style={[font(styles.sessionText), align]}>
                        {formatWhen(session.startAt, session.endAt, lang)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* ── Description ── */}
          <Card>
            <Text style={[font(styles.factLabel), align]}>{t.description.toUpperCase()}</Text>
            <Text style={[font(styles.desc), align]}>{p.description}</Text>
          </Card>

          {cancelled ? (
            <Text style={[font(styles.note), align]}>{t.cancelledByMosque}</Text>
          ) : mine ? (
            <Text style={[font(styles.note), align]}>
              {isVolunteer ? t.youHaveSlot : t.youreOnList}
            </Text>
          ) : null}

          {/* Your own QR, once you're in a volunteer shift. */}
          {mine && isVolunteer && !cancelled ? (
            <Button
              label={t.myQr}
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/checkin/[postId]', params: { postId: p._id, show: '1' } })
              }
            />
          ) : null}
        </View>
      </ScrollView>

      {/* ── Floating CTA ── */}
      {showCta ? (
        <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
          {mine ? (
            <Button
              label={isVolunteer ? t.withdraw : t.cantMakeIt}
              variant="muted"
              size="lg"
              loading={busy}
              onPress={confirmWithdraw}
            />
          ) : !here && postCity ? (
            <View style={styles.gate}>
              <Text style={[font(styles.gateNote), align]}>
                {located
                  ? fill(t.notInCity, { city: cityName(postCity, lang) })
                  : status === 'denied'
                    ? t.locationDenied
                    : t.locationBody}
              </Text>
              <Button
                label={
                  located
                    ? fill(t.onlyInCity, { city: cityName(postCity, lang) })
                    : status === 'locating'
                      ? t.locating
                      : t.enableLocationToSignUp
                }
                variant={located ? 'muted' : 'primary'}
                size="lg"
                disabled={located}
                loading={status === 'locating'}
                onPress={() => void requestLocation()}
              />
            </View>
          ) : (
            <Button
              label={
                full ? (isVolunteer ? t.allFilled : t.full) : isVolunteer ? t.signup : t.imGoing
              }
              variant={full ? 'muted' : 'primary'}
              size="lg"
              disabled={full}
              loading={busy}
              onPress={() => void claim()}
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl },
  title: { ...type.h2, color: colors.inkInverse, marginBottom: 4 },
  mosqueRow: { alignItems: 'center', gap: 5 },
  mosqueName: { ...type.caption, fontSize: 12.5, color: colors.inkOnDark },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { opacity: 0.6 },
  tags: { gap: 4, marginTop: spacing.sm },
  tag: { ...type.overline, color: colors.inkOnDarkFaint },
  tagCancelled: { color: colors.dangerBorder },

  scroll: { paddingBottom: spacing.xxl },
  scrollWithCta: { paddingBottom: 150 },
  body: { paddingHorizontal: screenPadding, paddingTop: spacing.lg, gap: 14 },

  facts: { gap: spacing.lg },
  fact: { flex: 1, gap: 3 },
  factDivider: { width: 1, backgroundColor: colors.rule },
  factLabel: { ...type.overline, color: colors.inkMuted, letterSpacing: 0.8 },
  factTime: { ...type.monoLarge, ...numeric, fontSize: 15, lineHeight: 20, color: colors.ink },
  factDay: { ...type.caption, color: colors.inkMuted },
  factValue: { ...type.small, fontSize: 13.5, color: colors.ink },
  posted: { ...type.small, color: colors.inkMuted },

  body_: { ...type.body, color: colors.ink },
  desc: { ...type.body, lineHeight: 23, color: colors.ink },
  note: { ...type.small, color: colors.inkMuted },

  sessions: { gap: spacing.sm },
  session: { alignItems: 'center', gap: spacing.md },
  sessionIndex: { ...type.monoSmall, ...numeric, color: colors.inkFaint, width: 16 },
  sessionText: { ...type.small, color: colors.ink, flex: 1 },

  gate: { gap: spacing.sm },
  gateNote: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  cta: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    paddingTop: spacing.md,
  },
});
