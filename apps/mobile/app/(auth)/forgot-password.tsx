/**
 * Forgot password — one field, one button, and a success state that says the
 * same thing whether or not the address exists. Confirming "no account here"
 * would let anyone test a list of emails against our users.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { api } from '@/api/client';
import { AuthCover, Button, Field } from '@/components';
import { useLang } from '@/i18n';
import { describeApiError } from '@/lib/apiError';
import { success, warn } from '@/lib/haptics';
import { colors, type } from '@/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t, align, font } = useLang();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      success();
      setSent(true);
    } catch (err) {
      warn();
      setError(describeApiError(err, t, t.somethingWrong));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthCover title={t.resetLinkSentTitle}>
        <Text style={[font(styles.body), align]}>{t.resetLinkSentBody}</Text>
        <Button label={t.backToLogin} size="lg" onPress={() => router.replace('/login')} />
      </AuthCover>
    );
  }

  return (
    <AuthCover back title={t.forgotPasswordTitle} subtitle={t.forgotPasswordBody}>
      <Field
        label={t.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        error={error ?? undefined}
      />
      <Button
        label={t.sendResetLink}
        size="lg"
        loading={busy}
        disabled={!email.trim()}
        onPress={() => void submit()}
      />
      <Button
        label={t.backToLogin}
        variant="ghost"
        disabled={busy}
        onPress={() => router.replace('/login')}
      />
    </AuthCover>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, color: colors.ink },
});
