/**
 * Check-in — a QR the coordinator holds up. Members scan it with their camera,
 * the app opens on `/checkin/:postId` and checks them in. The list underneath
 * refreshes every few seconds so arrivals appear as they scan, and it doubles
 * as the manual fallback for anyone whose camera won't cooperate.
 */

import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { UserCheck } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import QRCode from 'react-native-qrcode-svg';
import { api } from '@/api/client';
import { BackBar, Badge, Button, Card, GradientHeader, Loading, Screen } from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { formatTime } from '@/lib/format';
import { success, warn } from '@/lib/haptics';
import { colors, numeric, radius, rule, screenPadding, spacing, type } from '@/theme';
import type { Signup } from '@/types';

const POLL_MS = 4000;

export default function CheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, align, row, font } = useLang();
  const [busyId, setBusyId] = useState<string | null>(null);

  const post = useApi(() => api.getPost(id), [id]);
  const signups = useApi(() => api.getSignups(id), [id]);

  useEffect(() => {
    const timer = setInterval(() => void signups.reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [signups.reload]);

  const confirmed = useMemo(
    () => (signups.data ?? []).filter((s) => s.status === 'confirmed'),
    [signups.data],
  );
  const people = useApi(
    async () => (confirmed.length ? api.getUsers(confirmed.map((s) => s.userId)) : []),
    [confirmed.map((s) => s.userId).join(',')],
  );
  const nameOf = (userId: string) => people.data?.find((u) => u._id === userId)?.name ?? '—';

  // Expo Go gets an exp:// link, a standalone build gets mensemble://. Same route.
  const url = Linking.createURL(`/checkin/${id}`);
  const here = confirmed.filter((s) => s.checkedInAt).length;

  async function checkIn(signup: Signup) {
    setBusyId(signup._id);
    try {
      await api.checkIn(id, signup.userId);
      success();
      await signups.reload();
    } catch {
      warn();
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setBusyId(null);
    }
  }

  async function checkInAll() {
    const pending = confirmed.filter((s) => !s.checkedInAt);
    setBusyId('all');
    try {
      await Promise.all(pending.map((s) => api.checkIn(id, s.userId)));
      success();
      await signups.reload();
    } catch {
      warn();
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setBusyId(null);
    }
  }

  if (post.loading) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.checkin} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        back={<BackBar />}
        eyebrow={t.coordinator}
        title={post.data?.title ?? t.checkin}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* The QR itself, on plain white so a camera can actually read it. */}
        <View style={styles.qrCard}>
          <View style={styles.qrWrap}>
            <QRCode value={url} size={216} color={colors.dark} backgroundColor="#FFFFFF" />
          </View>
          <Text style={font(styles.qrLead)}>{t.qrDisplay}</Text>
          <Text style={font(styles.qrHint)}>{t.qrSub}</Text>

          <View style={[styles.counter, row]}>
            <Text style={styles.counterValue}>
              {here}
              <Text style={styles.counterOf}> / {confirmed.length}</Text>
            </Text>
            <Text style={font(styles.counterLabel)}>{t.present}</Text>
          </View>
        </View>

        <View style={[styles.sectionRow, row]}>
          <Text style={[font(styles.section), align]}>{t.presencelist.toUpperCase()}</Text>
          <Button
            label={t.checkin}
            icon={UserCheck}
            variant="ghost"
            size="sm"
            fullWidth={false}
            disabled={confirmed.length === 0 || confirmed.every((s) => s.checkedInAt)}
            loading={busyId === 'all'}
            onPress={() => void checkInAll()}
          />
        </View>

        {confirmed.length === 0 ? (
          <Card>
            <Text style={font(styles.empty)}>{t.nobodyYet}</Text>
          </Card>
        ) : (
          <Card padded={false}>
            {confirmed.map((signup, index) => (
              <View key={signup._id} style={[styles.row, row, index > 0 && styles.divider]}>
                <Text style={[font(styles.name), align]} numberOfLines={1}>
                  {nameOf(signup.userId)}
                </Text>
                {signup.checkedInAt ? (
                  <Badge
                    label={`✓ ${formatTime(signup.checkedInAt, lang)}`}
                    tone="accent"
                    shape="pill"
                  />
                ) : (
                  <Button
                    label={t.checkin}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    loading={busyId === signup._id}
                    onPress={() => void checkIn(signup)}
                  />
                )}
              </View>
            ))}
          </Card>
        )}

        <Text style={styles.footnote} selectable>
          {url}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: 14,
  },
  qrCard: {
    alignItems: 'center',
    gap: 6,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: rule,
    borderColor: colors.rule,
  },
  qrWrap: {
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  qrLead: { ...type.h3, color: colors.ink, textAlign: 'center' },
  qrHint: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
  counter: { marginTop: spacing.md, alignItems: 'baseline', gap: spacing.sm },
  counterValue: { ...type.monoHero, ...numeric, color: colors.accent },
  counterOf: { ...type.h3, color: colors.inkFaint },
  counterLabel: { ...type.small, color: colors.inkMuted },
  sectionRow: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  section: { ...type.overline, color: colors.inkMuted },
  empty: { ...type.small, color: colors.inkMuted },
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: rule, borderTopColor: colors.rule },
  name: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  footnote: { ...type.monoSmall, fontSize: 10, color: colors.inkFaint, textAlign: 'center' },
});
