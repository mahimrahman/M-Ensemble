/** Create an account. Same gradient cover as sign-in, the mark above one card. */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '@/hooks/useTopInset';
import { ApiRequestError } from '@/api/client';
import { Button, Field, Logo } from '@/components';
import { useLang } from '@/i18n';
import { warn } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, gradients, radius, screenPadding, spacing, type } from '@/theme';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { t, align, font } = useLang();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      warn();
      setError(t.fillAllFields);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signUp({ name, email, password });
    } catch (err) {
      warn();
      setError(err instanceof ApiRequestError ? err.message : t.emailTaken);
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
              placeholder="••••••••"
              error={error ?? undefined}
            />

            <Button
              label={t.createAccount}
              size="lg"
              loading={busy}
              onPress={() => void submit()}
            />
            <Button
              label={t.haveAccount}
              variant="ghost"
              disabled={busy}
              onPress={() => router.back()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
});
