/**
 * Donate to a mosque. Pick an amount, add a word if you like, and the app
 * hands you to Stripe Checkout in the system browser — never an in-app
 * payment sheet. A gift to a registered charity is outside Apple's IAP rules
 * only while the purchase happens outside the app, which is the whole reason
 * the browser opens.
 *
 * `postId` is set when the screen was reached from an event ("Support this
 * event"); the mosque sees it on the receipt.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DONATION_MAX_CENTS, DONATION_MIN_CENTS, DONATION_PRESETS_CENTS } from '@m-ensemble/shared';
import { ApiRequestError, api } from '@/api/client';
import {
  BackBar,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  GradientHeader,
  Loading,
  Screen,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { fill, useLang } from '@/i18n';
import { Alert } from '@/lib/alert';
import { describeApiError } from '@/lib/apiError';
import { tap, warn } from '@/lib/haptics';
import { formatCad, parseCad } from '@/lib/money';
import { colors, screenPadding, spacing, type } from '@/theme';

const MESSAGE_MAX = 200;

export default function DonateScreen() {
  const { mosqueId, postId } = useLocalSearchParams<{ mosqueId: string; postId?: string }>();
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();

  const mosque = useApi(() => api.getMosque(mosqueId), [mosqueId]);

  const [preset, setPreset] = useState<number | null>(DONATION_PRESETS_CENTS[1] ?? null);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A typed amount wins over the chips; clearing it hands back to them.
  const customCents = custom.trim() ? parseCad(custom) : null;
  const amountCents = custom.trim() ? customCents : preset;
  const inRange =
    amountCents !== null && amountCents >= DONATION_MIN_CENTS && amountCents <= DONATION_MAX_CENTS;

  async function checkout() {
    if (amountCents === null || !inRange) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.createDonationCheckout(mosqueId, {
        amountCents,
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(postId ? { postId } : {}),
      });
      // Stripe's page, in the system browser. On web the tab is the browser.
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && !window.open(url, '_blank')) {
          await Linking.openURL(url);
        }
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (err) {
      warn();
      if (err instanceof ApiRequestError && err.code === 'DONATIONS_DISABLED') {
        setError(t.donationsDisabled);
      } else if (err instanceof ApiRequestError && err.code === 'STRIPE_UNAVAILABLE') {
        setError(t.paymentsUnavailable);
      } else {
        Alert.alert(t.couldNotStartPayment, describeApiError(err, t, t.tryAgain));
      }
    } finally {
      setBusy(false);
    }
  }

  if (mosque.loading) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.donate} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  if (!mosque.data) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.donate} />
        <View style={styles.body}>
          <ErrorState message={mosque.error} onRetry={() => void mosque.reload()} />
        </View>
      </Screen>
    );
  }

  const m = mosque.data;

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        back={<BackBar />}
        title={fill(t.donateTo, { mosque: m.name })}
        subtitle={m.address}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.body, { paddingBottom: spacing.xxxl + keyboardPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {m.donationsEnabled === false ? (
          <Card>
            <Text style={[font(styles.prose), align]}>{t.donationsDisabled}</Text>
            <Button label={t.backToMosque} variant="secondary" onPress={() => router.back()} />
          </Card>
        ) : (
          <>
            <Card>
              <Text style={[font(styles.cardTitle), align]}>{t.amount.toUpperCase()}</Text>
              <View style={[styles.chips, row]}>
                {DONATION_PRESETS_CENTS.map((cents) => (
                  <Chip
                    key={cents}
                    label={formatCad(cents, lang)}
                    selected={!custom.trim() && preset === cents}
                    onPress={() => {
                      setPreset(cents);
                      setCustom('');
                    }}
                  />
                ))}
              </View>
              <Field
                label={t.customAmount}
                value={custom}
                onChangeText={setCustom}
                keyboardType="decimal-pad"
                placeholder={formatCad(DONATION_PRESETS_CENTS[0] ?? DONATION_MIN_CENTS, lang)}
                error={
                  custom.trim() && !inRange
                    ? fill(t.donationAmountRange, {
                        min: formatCad(DONATION_MIN_CENTS, lang),
                        max: formatCad(DONATION_MAX_CENTS, lang),
                      })
                    : undefined
                }
              />
              <Field
                label={t.donationMessage}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={MESSAGE_MAX}
                hint={`${message.length}/${MESSAGE_MAX}`}
              />
            </Card>

            {error ? <Text style={[font(styles.error), align]}>{error}</Text> : null}

            <Button
              label={
                amountCents !== null && inRange
                  ? `${t.continueToPayment} · ${formatCad(amountCents, lang)}`
                  : t.continueToPayment
              }
              icon={Lock}
              size="lg"
              loading={busy}
              disabled={!inRange}
              onPress={() => {
                tap();
                void checkout();
              }}
            />

            {/* The disclosure the stores and the mosques both want in writing:
                who takes the money, what we keep, who issues the receipt. */}
            <Text style={[font(styles.note), align]}>{t.donationNote}</Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: screenPadding, paddingTop: spacing.lg, gap: spacing.lg },
  cardTitle: { ...type.overline, color: colors.inkMuted },
  chips: { flexWrap: 'wrap', gap: spacing.sm },
  prose: { ...type.body, color: colors.ink },
  error: { ...type.small, color: colors.danger },
  note: { ...type.caption, color: colors.inkMuted },
});
