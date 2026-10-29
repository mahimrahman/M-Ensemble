/**
 * Change password, signed in. The current password is asked for again —
 * an unlocked phone must not be enough to lock its owner out — and the
 * server revokes every other session on success, which the message says.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { PASSWORD_MIN_LENGTH } from '@m-ensemble/shared';
import { API_ERROR, api, isApiError } from '@/api/client';
import { BackBar, Button, Card, Field, GradientHeader, Screen } from '@/components';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { fill, useLang } from '@/i18n';
import { Alert } from '@/lib/alert';
import { describeApiError } from '@/lib/apiError';
import { success, warn } from '@/lib/haptics';
import { passwordProblemMessage } from '@/lib/password';
import { screenPadding, spacing } from '@/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useLang();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setCurrentError(null);
    setNextError(null);

    const problem = passwordProblemMessage(next, t);
    if (problem) {
      warn();
      setNextError(problem);
      return;
    }
    if (next !== confirm) {
      warn();
      setNextError(t.passwordsDontMatch);
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(current, next);
      success();
      Alert.alert(t.changePassword, t.passwordChanged, [
        { text: t.ok, onPress: () => router.back() },
      ]);
    } catch (err) {
      warn();
      if (isApiError(err, API_ERROR.BAD_CREDENTIALS)) setCurrentError(t.wrongCurrentPassword);
      else setNextError(describeApiError(err, t, t.somethingWrong));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} title={t.changePassword} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxxl + keyboardPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Card>
          <Field
            label={t.currentPassword}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            error={currentError ?? undefined}
          />
          <Field
            label={t.newPassword}
            value={next}
            onChangeText={setNext}
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
            error={nextError ?? undefined}
          />
        </Card>
        <Button
          label={t.save}
          size="lg"
          loading={busy}
          disabled={!current || !next || !confirm}
          onPress={() => void submit()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: screenPadding, paddingTop: spacing.lg, gap: spacing.lg },
});
