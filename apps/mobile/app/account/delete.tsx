/**
 * Delete account. Says exactly what goes, asks for the password, asks once
 * more, and then signs out — the token is dead the moment the server answers.
 *
 * The one refusal with its own message is `LAST_COORDINATOR`: a mosque must
 * not be left with nobody who can run it, so the role has to be handed on
 * first. Everything else is the server's words or the generic fallback.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { API_ERROR, api, isApiError, ApiRequestError } from '@/api/client';
import { BackBar, Button, Card, Field, GradientHeader, Screen } from '@/components';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { useLang } from '@/i18n';
import { Alert } from '@/lib/alert';
import { describeApiError } from '@/lib/apiError';
import { warn } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, screenPadding, spacing, type } from '@/theme';

export default function DeleteAccountScreen() {
  const { t, align, font } = useLang();
  const { signOut } = useAuth();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function confirmDelete() {
    Alert.alert(t.deleteAccountConfirmTitle, t.deleteAccountConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteAccount, style: 'destructive', onPress: () => void remove() },
    ]);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      // `signOut` tries `/auth/logout` first; with the account gone that 401s
      // and is ignored, then the local session is cleared and the navigator
      // sends us to the sign-in screen.
      await signOut();
    } catch (err) {
      warn();
      if (isApiError(err, API_ERROR.BAD_CREDENTIALS)) {
        setError(t.wrongPassword);
      } else if (err instanceof ApiRequestError && err.code === 'LAST_COORDINATOR') {
        Alert.alert(t.couldNotDelete, t.lastCoordinator);
      } else {
        Alert.alert(t.couldNotDelete, describeApiError(err, t, t.tryAgain));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} title={t.deleteAccount} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxxl + keyboardPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Card>
          <Text style={[font(styles.body), align]}>{t.deleteAccountBody}</Text>
        </Card>
        <Card>
          <Text style={[font(styles.hint), align]}>{t.enterPasswordToConfirm}</Text>
          <Field
            label={t.password}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            error={error ?? undefined}
          />
        </Card>
        <Button
          label={t.deleteAccount}
          icon={Trash2}
          variant="danger"
          size="lg"
          loading={busy}
          disabled={!password}
          onPress={confirmDelete}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: screenPadding, paddingTop: spacing.lg, gap: spacing.lg },
  body: { ...type.body, color: colors.ink },
  hint: { ...type.small, color: colors.inkMuted },
});
