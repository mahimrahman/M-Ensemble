/**
 * Onboarding — runs once after account creation.
 *   1. Find and follow at least one mosque (by name or join code).
 *   2. Pick interests, which is what PHASE 4's push fan-out filters on.
 *
 * Both steps take the gradient header and a progress rail, so the two feel
 * like one flow rather than two screens that happen to follow each other.
 */

import { Check, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '@/hooks/useTopInset';
import { api } from '@/api/client';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  GradientHeader,
  Loading,
  Screen,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { useLang } from '@/i18n';
import { success, warn } from '@/lib/haptics';
import { INTEREST_OPTIONS, interestLabel } from '@/lib/interests';
import { useAuth } from '@/store/auth';
import { colors, radius, screenPadding, spacing, type } from '@/theme';
import type { Mosque } from '@/types';

type Step = 'mosques' | 'interests';

export default function OnboardingScreen() {
  const { user, setUser, completeOnboarding } = useAuth();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { t, lang, align, row, font } = useLang();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();
  const [step, setStep] = useState<Step>('mosques');
  const [query, setQuery] = useState('');
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [interests, setInterests] = useState<Set<string>>(new Set(user?.interests ?? []));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mosques = useApi(() => api.getMosques(), []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = mosques.data ?? [];
    if (!q) return all;
    return all.filter((m) => m.name.toLowerCase().includes(q) || m.joinCode.toLowerCase() === q);
  }, [mosques.data, query]);

  async function toggleFollow(mosque: Mosque) {
    setBusyId(mosque._id);
    try {
      if (followed.has(mosque._id)) {
        await api.unfollowMosque(mosque._id);
        setFollowed((prev) => {
          const next = new Set(prev);
          next.delete(mosque._id);
          return next;
        });
      } else {
        await api.followMosque(mosque._id);
        success();
        setFollowed((prev) => new Set(prev).add(mosque._id));
      }
    } catch {
      warn();
      Alert.alert(t.couldNotUpdate, t.tryAgain);
    } finally {
      setBusyId(null);
    }
  }

  function toggleInterest(interest: string) {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(interest)) next.delete(interest);
      else next.add(interest);
      return next;
    });
  }

  async function finish() {
    setSaving(true);
    try {
      const updated = await api.updateMe({ interests: [...interests] });
      setUser(updated);
      success();
      await completeOnboarding();
    } catch {
      // The mosques are already followed; interests can be set from Profile.
      Alert.alert(t.couldNotSave, t.tryAgain);
      await completeOnboarding();
    } finally {
      setSaving(false);
    }
  }

  /** Two dots: which step you're on and how many there are. */
  const rail = (
    <View style={[styles.rail, row]}>
      <View style={[styles.pip, styles.pipOn]} />
      <View style={[styles.pip, step === 'interests' && styles.pipOn]} />
    </View>
  );

  // ── Step 2: interests ──
  if (step === 'interests') {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader tall>
          <View>
            {rail}
            <Text style={[font(styles.headTitle), align]}>{t.pickInterests}</Text>
            <Text style={[font(styles.headSub), align]}>{t.pickInterestsSub}</Text>
          </View>
        </GradientHeader>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.chips, row]}>
            {INTEREST_OPTIONS.map((interest) => (
              <Chip
                key={interest}
                variant="wash"
                label={interestLabel(interest, lang)}
                selected={interests.has(interest)}
                onPress={() => toggleInterest(interest)}
              />
            ))}
          </View>
          <Text style={[font(styles.hint), align]}>{t.interestsHint}</Text>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button label={t.finish} size="lg" loading={saving} onPress={() => void finish()} />
          <Button
            label={t.back}
            variant="ghost"
            disabled={saving}
            onPress={() => setStep('mosques')}
          />
        </View>
      </Screen>
    );
  }

  // ── Step 1: mosques ──
  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader tall>
        <View>
          {rail}
          <Text style={[font(styles.headTitle), align]}>{t.followAMosque}</Text>
          <Text style={[font(styles.headSub), align]}>{t.followAMosqueSub}</Text>
        </View>
      </GradientHeader>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl + keyboardPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Field
          label={t.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t.joinCode}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {mosques.loading ? (
          <Loading label={t.loading} />
        ) : mosques.error && !mosques.data ? (
          // Without the list nothing can be followed and Continue stays
          // disabled - so the failure must be visible and retryable.
          <EmptyState
            title={t.somethingWrong}
            message={mosques.error}
            actionLabel={t.retry}
            onAction={() => void mosques.reload()}
          />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <Search color={colors.inkMuted} size={20} strokeWidth={1.8} />
            <Text style={font(styles.hint)}>{t.noMosques}</Text>
          </View>
        ) : (
          visible.map((mosque) => {
            const isFollowed = followed.has(mosque._id);
            return (
              <Card key={mosque._id} selected={isFollowed}>
                <Text style={[font(styles.mosqueName), align]} numberOfLines={1}>
                  {mosque.name}
                </Text>
                <Text style={[font(styles.address), align]} numberOfLines={1}>
                  {mosque.address}
                </Text>
                <Button
                  label={isFollowed ? t.following : t.follow}
                  icon={isFollowed ? Check : undefined}
                  variant={isFollowed ? 'secondary' : 'primary'}
                  loading={busyId === mosque._id}
                  onPress={() => void toggleFollow(mosque)}
                />
              </Card>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={t.continue}
          size="lg"
          disabled={followed.size === 0}
          onPress={() => setStep('interests')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rail: { gap: 6, marginBottom: spacing.lg },
  pip: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pipOn: { backgroundColor: colors.live },
  headTitle: { ...type.h1, color: colors.inkInverse },
  headSub: { ...type.caption, color: colors.inkOnDark, marginTop: 2 },

  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  chips: { flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...type.small, color: colors.inkMuted },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  mosqueName: { ...type.h3, color: colors.ink },
  address: { ...type.caption, color: colors.inkMuted },

  footer: {
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});
