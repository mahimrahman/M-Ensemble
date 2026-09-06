/**
 * One person, as the mosque knows them.
 *
 * Everything a coordinator needs before asking someone to take a shift: what
 * they said they care about, what they have committed to, and — the part that
 * matters — how much of it they actually showed up for.
 *
 * Promoting to coordinator lives here rather than in a separate roles screen,
 * because the decision is made while looking at exactly this record.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheck, ShieldMinus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  BackBar,
  Badge,
  Button,
  EmptyState,
  GradientHeader,
  Loading,
  Screen,
  SectionTitle,
  Stat,
  StatRow,
  postTypeLabel,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { formatAgo } from '@/lib/datetime';
import { formatHours, formatWhen } from '@/lib/format';
import { success, tap, warn } from '@/lib/haptics';
import { useAdminMosque } from '@/store/adminMosque';
import { useAuth } from '@/store/auth';
import { colors, numeric, radius, rule, screenPadding, spacing, type } from '@/theme';

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const { user } = useAuth();
  const { mosqueId } = useAdminMosque();
  const [busy, setBusy] = useState(false);

  const detail = useApi(
    async () => (mosqueId ? api.getMemberDetail(mosqueId, id) : null),
    [mosqueId, id],
  );

  const member = detail.data?.member ?? null;
  const history = detail.data?.history ?? [];
  const isAdmin = member?.role === 'admin';
  /** You cannot demote yourself — the API refuses it, so don't offer it. */
  const isSelf = member?.userId === user?._id;

  async function changeRole(next: 'admin' | 'member') {
    if (!mosqueId || !member) return;
    setBusy(true);
    try {
      await api.setMemberRole(mosqueId, member.userId, next);
      success();
      await detail.reload();
    } catch {
      warn();
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  function confirmRole() {
    const promoting = !isAdmin;
    Alert.alert(
      promoting ? t.confirmPromote : t.confirmDemote,
      promoting ? t.confirmPromoteBody : t.confirmDemoteBody,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: promoting ? t.makeCoordinator : t.removeCoordinator,
          style: promoting ? 'default' : 'destructive',
          onPress: () => void changeRole(promoting ? 'admin' : 'member'),
        },
      ],
    );
  }

  if (detail.loading && !detail.data) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.people} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  if (!member) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.people} />
        <View style={styles.guard}>
          <EmptyState title={t.noPeople} message={detail.error ?? t.somethingWrong} />
        </View>
      </Screen>
    );
  }

  const rate = member.signupCount
    ? Math.round((member.attendedCount / member.signupCount) * 100)
    : null;

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader tall back={<BackBar />}>
        <View>
          <View style={[styles.identity, row]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{member.name.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={[font(styles.name), align]} numberOfLines={2}>
                {member.name}
              </Text>
              <Text style={[font(styles.since), align]}>
                {t.memberSince} {new Date(member.joinedAt).getFullYear()}
              </Text>
            </View>
            {isAdmin ? <Badge label={t.coordinatorRole} tone="onDark" shape="pill" /> : null}
          </View>

          <StatRow>
            <Stat value={`${member.attendedCount}`} label={t.attended} />
            <Stat value={rate === null ? '—' : `${rate}%`} label={t.reliability} />
            <Stat value={formatHours(member.minutesServed)} label={t.hoursServed} />
          </StatRow>
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── What they told us they care about ── */}
        {member.interests.length > 0 ? (
          <>
            <SectionTitle title={t.pickInterests} />
            <View style={[styles.chips, row]}>
              {member.interests.map((interest) => (
                <Badge key={interest} label={interest} tone="accent" />
              ))}
            </View>
          </>
        ) : null}

        {/* ── The role decision ── */}
        {isSelf ? null : (
          <View style={styles.roleAction}>
            <Button
              label={isAdmin ? t.removeCoordinator : t.makeCoordinator}
              icon={isAdmin ? ShieldMinus : ShieldCheck}
              variant={isAdmin ? 'ghost' : 'secondary'}
              loading={busy}
              onPress={confirmRole}
            />
          </View>
        )}

        {/*
          The reliability record. Shown only when there is something on it —
          a clean volunteer should not be presented to their coordinator
          underneath a heading about failures.
        */}
        {member.lateCancellations > 0 || member.noShows > 0 ? (
          <>
            <SectionTitle title={t.reliability} />
            <View style={styles.recordCard}>
              <View style={[styles.recordRow, row]}>
                <Text style={font(styles.recordLabel)}>{t.lateCancellations}</Text>
                <Text style={styles.recordValue}>{member.lateCancellations}</Text>
              </View>
              <View style={[styles.recordRow, row]}>
                <Text style={font(styles.recordLabel)}>{t.noShows}</Text>
                <Text style={styles.recordValue}>{member.noShows}</Text>
              </View>
              {(detail.data?.incidents ?? []).slice(0, 4).map((incident) => (
                <Text
                  key={`${incident.postId}-${incident.kind}`}
                  style={[font(styles.recordIncident), align]}
                  numberOfLines={1}
                >
                  {incident.kind === 'late-cancel' ? t.incidentLateCancel : t.incidentNoShow} ·{' '}
                  {incident.postTitle}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Everything they've signed up for here ── */}
        <SectionTitle
          title={t.history}
          right={<Text style={styles.count}>{history.length}</Text>}
        />
        {history.length === 0 ? (
          <Text style={[font(styles.calm), align]}>{t.noSignupsYet}</Text>
        ) : (
          history.map((entry) => {
            const attended = !!entry.signup.checkedInAt;
            return (
              <Pressable
                key={entry.signup._id}
                onPress={() => {
                  tap();
                  router.push({
                    pathname: '/manage/coverage/[id]',
                    params: { id: entry.postId },
                  });
                }}
                style={({ pressed }) => [styles.historyRow, row, pressed && styles.pressed]}
              >
                <View style={[styles.dot, attended && styles.dotOn]} />
                <View style={styles.rowText}>
                  <Text style={[font(styles.rowTitle), align]} numberOfLines={1}>
                    {entry.postTitle}
                  </Text>
                  <Text style={[font(styles.meta), align]} numberOfLines={1}>
                    {postTypeLabel(t, entry.postType).toUpperCase()} ·{' '}
                    {formatWhen(entry.startAt, entry.endAt, lang)}
                  </Text>
                </View>
                <Text style={[styles.status, attended && styles.statusOn]}>
                  {attended
                    ? `✓ ${t.present}`
                    : entry.signup.createdAt
                      ? formatAgo(entry.signup.createdAt, lang)
                      : ''}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  recordCard: {
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  recordRow: { justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  recordLabel: { ...type.small, color: colors.inkMuted },
  recordValue: { ...type.h3, ...numeric, color: colors.ink },
  recordIncident: { ...type.small, color: colors.danger, marginTop: 2 },

  guard: { paddingHorizontal: screenPadding, paddingTop: spacing.xl },

  identity: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.circle,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.h2, color: colors.inkInverse },
  identityText: { flex: 1, gap: 2 },
  name: { ...type.h1, color: colors.inkInverse },
  since: { ...type.caption, color: colors.inkOnDark },

  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  chips: { flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  roleAction: { marginTop: spacing.md, marginBottom: spacing.sm },
  calm: { ...type.small, color: colors.inkMuted },
  count: { ...type.monoSmall, ...numeric, color: colors.inkMuted },
  pressed: { opacity: 0.7 },

  historyRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.circle,
    backgroundColor: colors.rule,
  },
  dotOn: { backgroundColor: colors.accent },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.smallStrong, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  status: { ...type.monoSmall, ...numeric, fontSize: 11, color: colors.inkFaint },
  statusOn: { color: colors.accent },
});
