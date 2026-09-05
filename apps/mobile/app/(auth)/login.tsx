/** Sign in. Two one-tap demo accounts for the two-phone walkthrough. */

import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { ApiRequestError } from '@/api/client';
import { Button, Field, Screen } from '@/components';
import { useAuth } from '@/store/auth';
import { colors, rule, spacing, type } from '@/theme';

const DEMO_EMAIL = 'yusuf@example.com';
const COORDINATOR_EMAIL = 'amina@example.com';
const DEMO_PASSWORD = 'mensemble';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(withEmail = email, withPassword = password) {
    setBusy(true);
    setError(null);
    try {
      await signIn(withEmail, withPassword);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not sign in. Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <Text style={styles.wordmark}>M’Ensemble</Text>
          <Text style={styles.tagline}>au service de votre mosquée</Text>
        </View>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            error={error ?? undefined}
          />

          <Button label="Sign in" size="lg" loading={busy} onPress={() => void submit()} />

          <Link href="/signup" style={styles.link}>
            <Text style={styles.linkText}>New here? Create an account</Text>
          </Link>
        </View>

        <View style={styles.demo}>
          <Text style={styles.demoLabel}>OR TRY THE DEMO</Text>
          <View style={styles.demoRow}>
            <Button
              label="As a member"
              variant="secondary"
              fullWidth={false}
              disabled={busy}
              onPress={() => void submit(DEMO_EMAIL, DEMO_PASSWORD)}
              style={styles.demoButton}
            />
            <Button
              label="As a coordinator"
              variant="secondary"
              fullWidth={false}
              disabled={busy}
              onPress={() => void submit(COORDINATOR_EMAIL, DEMO_PASSWORD)}
              style={styles.demoButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { paddingTop: spacing.xxxl, paddingBottom: spacing.xxl, gap: spacing.xs },
  wordmark: { ...type.display, color: colors.accent },
  tagline: { ...type.body, color: colors.inkMuted },
  form: { gap: spacing.lg },
  link: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  linkText: { ...type.small, color: colors.accent },
  demo: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: rule,
    borderTopColor: colors.rule,
    gap: spacing.md,
  },
  demoLabel: { ...type.overline, color: colors.inkFaint },
  demoRow: { flexDirection: 'row', gap: spacing.sm },
  demoButton: { flex: 1 },
});
