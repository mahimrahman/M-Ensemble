/**
 * Member check-in. Two ways in and both land here:
 *
 *   scanned the coordinator's QR   → checks you in on arrival
 *   opened "my check-in code"      → shows your own QR for them to scan
 *
 * The `show` param picks which. Everything else is the same screen.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, CircleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { API_ERROR, api, isApiError } from '@/api/client';
import { BackBar, Button, GradientHeader, Loading, Screen } from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { success, warn } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, radius, rule, screenPadding, spacing, type } from '@/theme';

type Outcome = 'checking' | 'done' | 'not-signed-up' | 'error';

export default function SelfCheckInScreen() {
  const { postId, show } = useLocalSearchParams<{ postId: string; show?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t, font } = useLang();
  const [outcome, setOutcome] = useState<Outcome>('checking');
  const [busy, setBusy] = useState(false);

  // Opened from "my check-in code" rather than by scanning: just show the QR.
  const showOnly = show === '1';

  const post = useApi(() => api.getPost(postId), [postId]);

  useEffect(() => {
    if (!user || showOnly) return;
    let cancelled = false;
    api
      .checkIn(postId, user._id)
      .then(() => {
        if (cancelled) return;
        success();
        setOutcome('done');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        warn();
        setOutcome(isApiError(err, API_ERROR.NOT_FOUND) ? 'not-signed-up' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [postId, user?._id, showOnly]);

  async function claimAndCheckIn() {
    if (!user) return;
    setBusy(true);
    try {
      await api.signup(postId);
      await api.checkIn(postId, user._id);
      success();
      setOutcome('done');
    } catch (err) {
      warn();
      setOutcome(isApiError(err, API_ERROR.FULL) ? 'not-signed-up' : 'error');
    } finally {
      setBusy(false);
    }
  }

  const title = post.data?.title ?? '';

  /** Your own code — what the coordinator scans, identifying you and the post. */
  if (showOnly) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} eyebrow={t.myQr} title={title} />
        <View style={styles.center}>
          <View style={styles.qrCard}>
            <View style={styles.qrWrap}>
              <QRCode
                value={`mensemble://checkin/${postId}?user=${user?._id ?? ''}`}
                size={216}
                color={colors.dark}
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={font(styles.hint)}>{t.myQrSub}</Text>
          </View>
          {/*
            Either side can be the one holding the camera. If the coordinator
            is showing the event's code instead, scan that.
          */}
          <Button label={t.scanQr} onPress={() => router.push('/scan')} />
          <Button label={t.close} variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} title={t.checkin} />

      <View style={styles.center}>
        {outcome === 'checking' ? (
          <Loading label={t.loading} />
        ) : outcome === 'done' ? (
          <>
            <View style={[styles.ring, styles.ringOk]}>
              <CheckCircle2 color={colors.accent} size={52} strokeWidth={1.8} />
            </View>
            <Text style={font(styles.title)}>{t.checkedIn} ✓</Text>
            <Text style={font(styles.body)}>{title}</Text>
            <Button label={t.done} onPress={() => router.replace('/my-stuff')} />
          </>
        ) : outcome === 'not-signed-up' ? (
          <>
            <View style={[styles.ring, styles.ringWarn]}>
              <CircleAlert color={colors.attention} size={52} strokeWidth={1.8} />
            </View>
            <Text style={font(styles.title)}>{t.notSignedUpYet}</Text>
            <Text style={font(styles.body)}>{title}</Text>
            <Button label={t.signup} loading={busy} onPress={() => void claimAndCheckIn()} />
            <Button label={t.cancel} variant="ghost" onPress={() => router.replace('/')} />
          </>
        ) : (
          <>
            <View style={[styles.ring, styles.ringDanger]}>
              <CircleAlert color={colors.danger} size={52} strokeWidth={1.8} />
            </View>
            <Text style={font(styles.title)}>{t.couldNotSave}</Text>
            <Text style={font(styles.hint)}>{t.tryAgain}</Text>
            <Button label={t.retry} onPress={() => setOutcome('checking')} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: screenPadding,
  },
  ring: {
    width: 88,
    height: 88,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  ringOk: { backgroundColor: colors.accentWashStrong },
  ringWarn: { backgroundColor: colors.accentWash },
  ringDanger: { backgroundColor: colors.dangerWash },
  title: { ...type.h2, color: colors.ink, textAlign: 'center' },
  body: { ...type.body, color: colors.ink, textAlign: 'center' },
  hint: { ...type.small, color: colors.inkMuted, textAlign: 'center' },

  qrCard: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: rule,
    borderColor: colors.rule,
  },
  qrWrap: { padding: spacing.md, backgroundColor: '#FFFFFF', borderRadius: radius.md },
});
