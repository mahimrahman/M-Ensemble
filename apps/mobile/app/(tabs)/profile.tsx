/**
 * Profile — the prototype's settings page: an avatar over the gradient, then
 * white cards for interests, notifications and language.
 *
 * The push panel and the mosque list are ours, not the prototype's, and take
 * the same card shape so they don't read as bolted on.
 */

import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { BellRing, ChevronRight, Copy, LogOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { USING_MOCKS, api } from '@/api/client';
import {
  Button,
  Card,
  Chip,
  GradientHeader,
  LangSwitcher,
  Loading,
  Screen,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { usePushToken } from '@/hooks/usePushToken';
import { useLang } from '@/i18n';
import { INTEREST_OPTIONS, interestLabel } from '@/lib/interests';
import { tap } from '@/lib/haptics';
import { sendLocalTestNotification } from '@/push/notifications';
import { useAuth } from '@/store/auth';
import { colors, icon as iconSize, radius, rule, screenPadding, spacing, type } from '@/theme';
import type { NotificationPrefs } from '@/types';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, adminMosqueIds, setUser, signOut } = useAuth();
  const { t, lang, align, row, font } = useLang();
  const { registration, busy, register } = usePushToken(!!user);
  const [copied, setCopied] = useState(false);
  const [savingInterest, setSavingInterest] = useState<string | null>(null);

  const followed = useApi(() => api.getFollowedMosques(), []);
  const prefs = useApi(() => api.getNotificationPrefs(), []);
  const [localPrefs, setLocalPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    if (prefs.data) setLocalPrefs(prefs.data);
  }, [prefs.data]);

  const prefLabels: Record<keyof NotificationPrefs, string> = {
    volunteerRequests: t.newVolunteer,
    events: t.eventsPref,
    classes: t.classesPref,
    announcements: t.mosqueAnnounce,
    prayerReminders: t.reminder,
  };

  async function toggleInterest(interest: string) {
    if (!user) return;
    const has = user.interests.includes(interest);
    const next = has ? user.interests.filter((i) => i !== interest) : [...user.interests, interest];

    setSavingInterest(interest);
    try {
      const updated = await api.updateMe({ interests: next });
      setUser(updated);
    } catch {
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setSavingInterest(null);
    }
  }

  async function togglePref(key: keyof NotificationPrefs, value: boolean) {
    if (!localPrefs) return;
    const next = { ...localPrefs, [key]: value };
    setLocalPrefs(next);
    try {
      await api.updateNotificationPrefs(next);
    } catch {
      setLocalPrefs(localPrefs);
      Alert.alert(t.couldNotSave, t.tryAgain);
    }
  }

  async function copyToken() {
    if (registration?.status !== 'granted') return;
    await Clipboard.setStringAsync(registration.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pushStatus =
    registration?.status === 'granted'
      ? 'REGISTERED'
      : registration?.status === 'denied'
        ? 'DENIED'
        : registration
          ? 'UNAVAILABLE'
          : '…';

  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader tall>
        <View style={[styles.head, row]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.headText}>
            <Text style={[font(styles.name), align]} numberOfLines={1}>
              {user?.name ?? '—'}
            </Text>
            <Text style={[styles.email, align]} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
            {adminMosqueIds.length > 0 ? (
              <Text style={[font(styles.role), align]}>{t.coordinator.toUpperCase()}</Text>
            ) : null}
          </View>
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Language ── */}
        <Card>
          <Text style={[font(styles.cardTitle), align]}>{t.language}</Text>
          <LangSwitcher tone="onLight" />
        </Card>

        {/* ── Interests ── */}
        <Card>
          <Text style={[font(styles.cardTitle), align]}>{t.interests}</Text>
          <Text style={[font(styles.hint), align]}>{t.interestsHint}</Text>
          <View style={[styles.chips, row]}>
            {INTEREST_OPTIONS.map((interest) => (
              <Chip
                key={interest}
                variant="wash"
                label={savingInterest === interest ? '…' : interestLabel(interest, lang)}
                selected={user?.interests.includes(interest) ?? false}
                onPress={() => void toggleInterest(interest)}
              />
            ))}
          </View>
        </Card>

        {/* ── Notifications ── */}
        <Card>
          <Text style={[font(styles.cardTitle), align]}>{t.notifications}</Text>
          {localPrefs ? (
            (Object.keys(prefLabels) as (keyof NotificationPrefs)[]).map((key, i, arr) => (
              <View
                key={key}
                style={[styles.prefRow, row, i === arr.length - 1 && styles.prefRowLast]}
              >
                <Text style={[font(styles.prefLabel), align]}>{prefLabels[key]}</Text>
                <Switch
                  value={localPrefs[key]}
                  onValueChange={(value) => void togglePref(key, value)}
                  trackColor={{ true: colors.accent, false: colors.surfaceSunken }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.surfaceSunken}
                />
              </View>
            ))
          ) : (
            <Loading variant="inline" />
          )}
        </Card>

        {/* ── Mosques you follow ── */}
        <Card>
          <Text style={[font(styles.cardTitle), align]}>{t.followedMosques}</Text>
          {followed.loading ? (
            <Loading variant="inline" />
          ) : (followed.data ?? []).length === 0 ? (
            <Pressable
              onPress={() => {
                tap();
                router.push('/mosques');
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[font(styles.link), align]}>{t.notFollowingAny} →</Text>
            </Pressable>
          ) : (
            (followed.data ?? []).map((mosque, i, arr) => (
              <Pressable
                key={mosque._id}
                accessibilityRole="link"
                onPress={() => {
                  tap();
                  router.push({ pathname: '/mosque/[id]', params: { id: mosque._id } });
                }}
                style={({ pressed }) => [
                  styles.prefRow,
                  row,
                  i === arr.length - 1 && styles.prefRowLast,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.mosqueText}>
                  <Text style={[font(styles.prefLabel), align]} numberOfLines={1}>
                    {mosque.name}
                  </Text>
                  <Text style={[font(styles.hint), align]} numberOfLines={1}>
                    {mosque.address}
                  </Text>
                </View>
                <ChevronRight color={colors.inkFaint} size={iconSize.md} strokeWidth={2} />
              </Pressable>
            ))
          )}
        </Card>

        {/* ── Push ── */}
        <Card>
          <View style={[styles.cardHead, row]}>
            <Text style={[font(styles.cardTitle), align]}>{t.pushDelivery}</Text>
            <Text style={styles.status}>{pushStatus}</Text>
          </View>
          {registration?.status === 'granted' ? (
            <>
              <Text style={styles.token} selectable numberOfLines={2}>
                {registration.token}
              </Text>
              <View style={[styles.pushActions, row]}>
                <Button
                  label={copied ? t.copied : t.copyToken}
                  icon={Copy}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => void copyToken()}
                />
                <Button
                  label={t.testNotification}
                  icon={BellRing}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => void sendLocalTestNotification()}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[font(styles.hint), align]}>
                {registration && 'reason' in registration ? registration.reason : t.loading}
              </Text>
              <Button
                label={t.retry}
                variant="secondary"
                size="sm"
                fullWidth={false}
                loading={busy}
                onPress={() => void register()}
              />
            </>
          )}
        </Card>

        {/* ── Sign out ── */}
        <Button label={t.signout} icon={LogOut} variant="danger" onPress={() => void signOut()} />

        <Text style={styles.footnote}>
          {t.dataSource} · {USING_MOCKS ? t.mockClient : t.liveServer}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 14 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.circle,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.h1, fontSize: 22, color: colors.inkInverse },
  headText: { flex: 1, gap: 1 },
  name: { ...type.h2, color: colors.inkInverse },
  email: { ...type.caption, fontSize: 12.5, color: colors.inkOnDark },
  role: { ...type.overline, fontSize: 9, color: colors.live, marginTop: 2 },

  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: 14,
  },
  cardHead: { alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...type.captionStrong, color: colors.ink },
  hint: { ...type.caption, color: colors.inkMuted },
  chips: { flexWrap: 'wrap', gap: spacing.sm },

  prefRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  prefRowLast: { borderBottomWidth: 0 },
  prefLabel: { ...type.small, color: colors.ink, flex: 1 },
  mosqueText: { flex: 1, gap: 1 },
  pressed: { opacity: 0.6 },
  link: { ...type.small, color: colors.accent },

  status: { ...type.overline, fontSize: 9, color: colors.inkFaint },
  token: { ...type.monoSmall, fontSize: 11, color: colors.inkMuted },
  pushActions: { gap: spacing.sm, flexWrap: 'wrap' },
  footnote: { ...type.caption, fontSize: 11, color: colors.inkFaint, textAlign: 'center' },
});
