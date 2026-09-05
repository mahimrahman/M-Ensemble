/** PHASE 1 shell — enough to create a session. PHASE 2 adds onboarding after it. */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { ApiRequestError } from '@/api/client';
import { Button, Field, Screen, ScreenHeader } from '@/components';
import { useAuth } from '@/store/auth';
import { colors, spacing, type } from '@/theme';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Name, email, and a password of at least 6 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signUp({ name, email, password });
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not create the account just now.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="Create an account" subtitle="Then pick the mosques you follow." />

        <View style={styles.form}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 6 characters"
            error={error ?? undefined}
          />

          <Button label="Create account" size="lg" loading={busy} onPress={() => void submit()} />
          <Button
            label="Back to sign in"
            variant="ghost"
            disabled={busy}
            onPress={() => router.back()}
          />

          <Text style={styles.note}>
            While we’re on mocks, any of the seeded members sign in with the password “mensemble”.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg, paddingTop: spacing.md },
  note: { ...type.small, color: colors.inkMuted, textAlign: 'center' },
});
