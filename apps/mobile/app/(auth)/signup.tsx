/** Create an account. Same gradient cover as sign-in, the mark above one card. */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { useTopInset } from '@/hooks/useTopInset';
import { Button, Field, Logo } from '@/components';
import { PASSWORD_MIN_LENGTH } from '@m-ensemble/shared';
import { fill, useLang } from '@/i18n';
import { describeApiError } from '@/lib/apiError';
import { warn } from '@/lib/haptics';
import { passwordProblemMessage } from '@/lib/password';
import { useAuth } from '@/store/auth';
import { colors, gradients, radius, screenPadding, spacing, type } from '@/theme';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();
  const { t, align, font } = useLang();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || !password) {
      warn();
      setError(t.fillAllFields);
      return;
    }
    // The same rule the server applies, checked here first so the answer is
    // specific ("too short", "too common") instead of a round trip and a 400.
    const problem = passwordProblemMessage(password, t);
    if (problem) {
      warn();
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signUp({ name, email, password });
    } catch (err) {
      warn();
      setError(describeApiError(err, t, t.emailTaken));
    } finally {
      setBusy(false);
    }
  }

  /**
   * "By creating an account you agree to the {terms} and the {privacy}." with
   * the two placeholders rendered as links. Split on the placeholders rather
   * than concatenating three strings, so each language keeps its own word
   * order (French puts an article before each; Arabic joins them with و).
   */
  const agreement = t.agreeToTerms.split(/(\{terms\}|\{privacy\})/).map((part, i) => {
    if (part === '{terms}') {
      return (
        <Text
          key={i}
          style={styles.legalLink}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/legal/[kind]', params: { kind: 'terms' } })}
        >
          {t.termsOfService}
        </Text>
      );
    }
    if (part === '{privacy}') {
      return (
        <Text
          key={i}
          style={styles.legalLink}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/legal/[kind]', params: { kind: 'privacy' } })}
        >
          {t.privacyPolicy}
        </Text>
      );
    }
    return part;
  });

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
        <View style={styles.brand}>
          <Logo variant="mark" tone="onDark" height={72} label={t.welcome} />
          <Text style={[font(styles.title), align]}>{t.signUpTitle}</Text>
          <Text style={[font(styles.tagline), align]}>{t.followAMosqueSub}</Text>
        </View>

        <View style={styles.card}>
          <Field
            label={t.name}
            value={name}
            onChangeText={setName}
            placeholder={t.name}
            autoComplete="name"
          />
          <Field
            label={t.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label={t.password}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="••••••••"
            error={error ?? undefined}
            hint={fill(t.passwordTooShort, { min: String(PASSWORD_MIN_LENGTH) })}
          />

          <Button label={t.createAccount} size="lg" loading={busy} onPress={() => void submit()} />
          <Text style={[font(styles.legal), align]}>{agreement}</Text>
          <Button
            label={t.haveAccount}
            variant="ghost"
            disabled={busy}
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: screenPadding, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xxl },
  title: {
    ...type.display,
    fontSize: 32,
    lineHeight: 38,
    color: colors.inkInverse,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  tagline: { ...type.body, color: colors.inkOnDark, textAlign: 'center' },
  card: {
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl + 4,
  },
  legal: { ...type.caption, color: colors.inkMuted, textAlign: 'center', marginTop: -spacing.sm },
  legalLink: { color: colors.accent, textDecorationLine: 'underline' },
});
