/**
 * Reset password — the landing page for `mensemble://reset-password?token=…`.
 *
 * The token comes from the email link, is single-use and short-lived, and is
 * all the server needs besides the new password. A signed-in user can land
 * here too (tapping the link on the phone that is already logged in), which
 * is why the root navigator leaves this route alone — see `app/_layout.tsx`.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { PASSWORD_MIN_LENGTH } from '@m-ensemble/shared';
import { api } from '@/api/client';
import { AuthCover, Button, Field } from '@/components';
import { fill, useLang } from '@/i18n';
import { describeApiError } from '@/lib/apiError';
import { success, warn } from '@/lib/haptics';
import { passwordProblemMessage } from '@/lib/password';
import { colors, type } from '@/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t, align, font } = useLang();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token) return;
    const problem = passwordProblemMessage(password, t);
    if (problem) {
      warn();
      setError(problem);
      return;
    }
    if (password !== confirm) {
      warn();
      setError(t.passwordsDontMatch);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      success();
      // Login shows the "updated" notice; `replace` so Back cannot return to a
      // form whose token is now spent.
      router.replace({ pathname: '/login', params: { reset: '1' } });
    } catch (err) {
      warn();
      // A dead token is the overwhelmingly common failure here, and the
      // server's generic 400 does not tell the reader what to do about it.
      setError(describeApiError(err, t, t.resetLinkInvalid));
    } finally {
      setBusy(false);
    }
  }

  // Opened without a token — a stale bookmark, or the scheme typed by hand.
  if (!token) {
    return (
      <AuthCover title={t.resetPasswordTitle}>
        <Text style={[font(styles.body), align]}>{t.resetLinkInvalid}</Text>
        <Button
          label={t.forgotPassword}
          size="lg"
          onPress={() => router.replace('/forgot-password')}
        />
        <Button label={t.backToLogin} variant="ghost" onPress={() => router.replace('/login')} />
      </AuthCover>
    );
  }

  return (
    <AuthCover title={t.resetPasswordTitle}>
      <Field
        label={t.newPassword}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        placeholder="••••••••"
        hint={fill(t.passwordTooShort, { min: String(PASSWORD_MIN_LENGTH) })}
      />
      <Field
        label={t.confirmPassword}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        placeholder="••••••••"
        error={error ?? undefined}
      />
      <Button
        label={t.resetPassword}
        size="lg"
        loading={busy}
        disabled={!password || !confirm}
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
