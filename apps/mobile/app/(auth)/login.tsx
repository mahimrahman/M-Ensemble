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
import { ApiRequestError } from '@/api/client';
import { Button, Field, LangSwitcher, Logo } from '@/components';
import { useLang } from '@/i18n';
import { warn } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, gradients, radius, screenPadding, spacing, type } from '@/theme';

const DEMO_EMAIL = 'yusuf@example.com';
const COORDINATOR_EMAIL = 'amina@example.com';
const DEMO_PASSWORD = 'mensemble';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { t, align, row, font } = useLang();
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
      warn();
      setError(err instanceof ApiRequestError ? err.message : t.badCredentials);
    } finally {
      setBusy(false);
    }
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

          <View style={styles.brand}>
            <Logo tone="onDark" height={92} label={t.welcome} />
            <Text style={[font(styles.tagline), align]}>{t.welcomeSub}</Text>
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

            <Button label={t.login} size="lg" loading={busy} onPress={() => void submit()} />

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
                onPress={() => void submit(DEMO_EMAIL, DEMO_PASSWORD)}
                style={styles.demoButton}
              />
              <Button
                label={t.coordinator}
                variant="inverse"
                fullWidth={false}
                disabled={busy}
                onPress={() => void submit(COORDINATOR_EMAIL, DEMO_PASSWORD)}
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
