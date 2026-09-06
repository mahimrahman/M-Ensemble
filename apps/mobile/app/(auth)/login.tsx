/**
 * Sign in — the app's cover. The whole screen is the gradient, with the
 * M'Ensemble lockup over it and the form on a white card that floats up from
 * the bottom. Two one-tap demo accounts for the two-phone walkthrough.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '@/hooks/useTopInset';
import {
  DEMO_COORDINATOR_EMAIL,
  DEMO_COORDINATOR_PASSWORD,
  MOCK_PASSWORD,
} from '@m-ensemble/shared';
import { ApiRequestError } from '@/api/client';
import { Button, Field, LangSwitcher, Logo } from '@/components';
import { useLang } from '@/i18n';
import { warn } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, gradients, radius, screenPadding, spacing, type } from '@/theme';

/**
 * The two accounts the demo signs in as, taken from the shared fixtures so the
 * buttons cannot drift from what the seed actually wrote. The coordinator is a
 * real address on the allowlist; the member is one of the seeded volunteers.
 */
const MEMBER_EMAIL = 'yusuf@example.com';
const MEMBER_PASSWORD = MOCK_PASSWORD;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { t, align, row, font } = useLang();
  // Empty on purpose. The demo accounts are one tap away at the bottom of the
  // screen, so prefilling the fields only meant clearing them to type a real
  // address — and left a password on screen for anyone signing in as themself.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(withEmail = email, withPassword = password) {
    setBusy(true);
    setError(null);
    try {
      await signIn(withEmail, withPassword);
    } catch (err) {
      warn();
      setError(err instanceof ApiRequestError ? err.message : t.badCredentials);
    } finally {
      setBusy(false);
    }
  }

  /**
   * The demo doors. Fills the form as well as signing in, so the room can see
   * which account went in — the fields start empty now, and a tap that moved
   * straight to the feed left nothing on screen to say who you were.
   *
   * The values are passed to submit() explicitly rather than read back from
   * state: the two setters above do not touch this closure, so submit() would
   * otherwise send the empty strings it captured on this render.
   */
  function signInAs(withEmail: string, withPassword: string) {
    setEmail(withEmail);
    setPassword(withPassword);
    void submit(withEmail, withPassword);
  }

  return (
    <LinearGradient
      colors={[...gradients.masthead]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.langRow, row]}>
            <LangSwitcher />
          </View>

          {/* Logo only. The lockup already carries "Répondre présent" as
              artwork; a second tagline underneath said the same thing twice. */}
          <View style={styles.brand}>
            <Logo tone="onDark" height={64} label={t.welcome} />
          </View>

          <View style={styles.card}>
            <Field
              label={t.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Field
              label={t.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••"
              error={error ?? undefined}
            />

            {/* Held until both fields have something. An empty form used to
                reach the server and come back as a validation error, which
                reads as a failure rather than as nothing typed yet. */}
            <Button
              label={t.login}
              size="lg"
              loading={busy}
              disabled={!email.trim() || !password}
              onPress={() => void submit()}
            />

            <Link href="/signup" style={styles.link}>
              <Text style={font(styles.linkText)}>
                {t.noAccount} {t.createAccount}
              </Text>
            </Link>
          </View>

          {/* The demo doors — how the walkthrough gets two phones signed in fast. */}
          <View style={styles.demo}>
            <Text style={font(styles.demoLabel)}>{t.signIn.toUpperCase()}</Text>
            <View style={[styles.demoRow, row]}>
              <Button
                label={t.member}
                variant="inverse"
                fullWidth={false}
                disabled={busy}
                onPress={() => signInAs(MEMBER_EMAIL, MEMBER_PASSWORD)}
                style={styles.demoButton}
              />
              <Button
                label={t.coordinator}
                variant="inverse"
                fullWidth={false}
                disabled={busy}
                onPress={() => signInAs(DEMO_COORDINATOR_EMAIL, DEMO_COORDINATOR_PASSWORD)}
                style={styles.demoButton}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: screenPadding, justifyContent: 'center' },
  langRow: { justifyContent: 'center', marginBottom: spacing.xl },

  brand: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xxl },
  tagline: { ...type.body, color: colors.inkOnDark, textAlign: 'center' },

  card: {
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl + 4,
  },
  link: { alignSelf: 'center', paddingVertical: spacing.xs },
  linkText: { ...type.small, color: colors.accent },

  demo: {
    marginTop: spacing.xxl,
    gap: spacing.md,
    alignItems: 'center',
  },
  demoLabel: { ...type.overline, color: colors.inkOnDarkFaint },
  demoRow: { gap: spacing.sm, alignSelf: 'stretch' },
  demoButton: { flex: 1 },
});
