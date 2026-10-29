/**
 * Sign in — the app's cover. The whole screen is the gradient, with the
 * M'Ensemble lockup over it and the form on a white card that floats up from
 * the bottom.
 *
 * The one-tap demo accounts that used to sit under the card are gone: a store
 * build has no seeded users to sign in as, and a button that signs a stranger
 * into somebody's mosque is not a feature.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { useTopInset } from '@/hooks/useTopInset';
import { Button, Field, LangSwitcher, Logo } from '@/components';
import { useLang } from '@/i18n';
import { describeApiError } from '@/lib/apiError';
import { warn } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, gradients, radius, screenPadding, spacing, type } from '@/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();
  const { t, align, row, font } = useLang();
  // `reset=1` is how the reset-password screen says "it worked" on its way
  // back here — the one piece of good news this screen ever shows.
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      warn();
      setError(describeApiError(err, t, t.badCredentials));
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
      {/* No KeyboardAvoidingView: it only ever padded on iOS, and left the
          keyboard sitting over these fields on Android. useKeyboardReveal
          measures what the keyboard covers and scrolls the focused field clear. */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl + keyboardPad,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
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
          {reset === '1' ? (
            <Text style={[font(styles.notice), align]}>{t.passwordResetDone}</Text>
          ) : null}
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

          <Link href="/forgot-password" style={styles.forgot}>
            <Text style={[font(styles.linkText), align]}>{t.forgotPassword}</Text>
          </Link>

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
      </ScrollView>
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
  // Pulled up under the password field, where the eye goes when it fails.
  forgot: { alignSelf: 'stretch', marginTop: -spacing.sm },
  linkText: { ...type.small, color: colors.accent },
  notice: {
    ...type.small,
    color: colors.accent,
    backgroundColor: colors.accentWash,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
