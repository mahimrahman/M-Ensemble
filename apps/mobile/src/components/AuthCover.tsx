import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { useTopInset } from '@/hooks/useTopInset';
import { useLang } from '@/i18n';
import { colors, gradients, radius, screenPadding, spacing, type } from '@/theme';
import { BackBar } from './BackBar';
import { Logo } from './Logo';

interface AuthCoverProps {
  /** Under the mark, on the gradient. */
  title?: string;
  subtitle?: string;
  /** Show the "← Back" link above the mark. Off on screens reached by deep link. */
  back?: boolean;
  children: ReactNode;
}

/**
 * The sign-in family's shell: the full-screen gradient, the mark, and one
 * white card. Forgot / reset / verify all share it, so they sit beside login
 * and sign-up as the same screen rather than as pages from elsewhere.
 *
 * No KeyboardAvoidingView — see login.tsx. `useKeyboardReveal` scrolls the
 * focused field clear of the keyboard on both platforms.
 */
export function AuthCover({ title, subtitle, back = false, children }: AuthCoverProps) {
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();
  const { t, align, font } = useLang();

  return (
    <LinearGradient
      colors={[...gradients.masthead]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
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
        {back ? <BackBar /> : null}
        <View style={styles.brand}>
          <Logo variant="mark" tone="onDark" height={72} label={t.welcome} />
          {title ? <Text style={[font(styles.title), align]}>{title}</Text> : null}
          {subtitle ? <Text style={[font(styles.tagline), align]}>{subtitle}</Text> : null}
        </View>

        <View style={styles.card}>{children}</View>
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
    fontSize: 28,
    lineHeight: 34,
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
