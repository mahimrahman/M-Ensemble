/**
 * Send a notification to the mosque's followers.
 *
 * Deliberately not a post. A post is an event with a date, a place and often
 * slots to fill; this is the mosque saying something — the hall is closed on
 * Saturday, the fundraiser hit its target — that nobody signs up for and that
 * belongs in nobody's calendar. Writing it as an announcement post to get the
 * fan-out was the workaround this replaces.
 *
 * The reach is shown before the send and confirmed before it goes, because
 * this is the one screen in the coordinator's app whose action reaches every
 * follower's phone and cannot be undone.
 */

import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { BackBar, Button, EmptyState, Field, GradientHeader, Screen } from '@/components';
import { useApi } from '@/hooks/useApi';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { Alert } from '@/lib/alert';
import { fill, useLang } from '@/i18n';
import { success, warn } from '@/lib/haptics';
import { useAdminMosque } from '@/store/adminMosque';
import { colors, radius, rule, screenPadding, spacing, type } from '@/theme';

export default function NotifyScreen() {
  const router = useRouter();
  const { t, align, font } = useLang();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();
  const { mosqueId, mosque } = useAdminMosque();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [sending, setSending] = useState(false);

  // The follower count is already on the dashboard, and this is the same
  // number — one source, so the two screens can never disagree about how many
  // people a message reaches.
  const stats = useApi(
    async () => (mosqueId ? api.getMosqueDashboard(mosqueId) : null),
    [mosqueId],
  );
  const followers = stats.data?.followerCount ?? 0;

  if (!mosqueId) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.sendNotification} />
        <View style={styles.guard}>
          <EmptyState title={t.noMosques} message={t.noMosqueAssignedBody} />
        </View>
      </Screen>
    );
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!title.trim()) next.title = t.errMessageTitle;
    if (!body.trim()) next.body = t.errMessageBody;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function send() {
    if (!mosqueId) return;
    setSending(true);
    try {
      const result = await api.broadcast(mosqueId, { title: title.trim(), body: body.trim() });
      success();
      Alert.alert(
        t.notificationSent,
        result.recipients === 0
          ? t.sentToNobody
          : fill(t.sentToCount, {
              count: `${result.recipients}`,
              pushed: `${result.pushed}`,
            }),
        [{ text: t.ok, onPress: () => router.back() }],
      );
    } catch {
      warn();
      Alert.alert(t.couldNotSend, t.tryAgain);
    } finally {
      setSending(false);
    }
  }

  function confirm() {
    if (!validate()) return;
    Alert.alert(t.confirmSendTitle, fill(t.confirmSendBody, { count: `${followers}` }), [
      { text: t.cancel, style: 'cancel' },
      { text: t.send, onPress: () => void send() },
    ]);
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        back={<BackBar />}
        title={t.sendNotification}
        subtitle={mosque?.name ?? t.sendNotificationSub}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxxl + keyboardPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Text style={[font(styles.lead), align]}>{t.sendNotificationSub}</Text>

        <Field
          label={t.messageTitle}
          value={title}
          onChangeText={setTitle}
          placeholder={t.phNotifyTitle}
          maxLength={120}
          error={errors.title}
        />
        <Field
          label={t.messageBody}
          value={body}
          onChangeText={setBody}
          placeholder={t.phNotifyBody}
          multiline
          numberOfLines={5}
          maxLength={600}
          style={styles.multiline}
          error={errors.body}
        />

        <View style={styles.reach}>
          <Text style={[font(styles.reachText), align]}>
            {fill(t.notifyReach, { count: `${followers}` })}
          </Text>
        </View>

        <Button
          label={sending ? t.sending : t.send}
          icon={Send}
          size="lg"
          loading={sending}
          disabled={sending}
          onPress={confirm}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  guard: { paddingHorizontal: screenPadding, paddingTop: spacing.xl },
  lead: { ...type.small, color: colors.inkMuted },
  multiline: { minHeight: 120, textAlignVertical: 'top' },

  reach: {
    backgroundColor: colors.accentWash,
    borderWidth: rule,
    borderColor: colors.ruleStrong,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  reachText: { ...type.captionStrong, color: colors.accent },
});
