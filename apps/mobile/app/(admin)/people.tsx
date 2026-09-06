/**
 * People — the mosque's directory, ranked by who actually turns up.
 *
 * This is the screen that answers "who can I ask?". A name on its own is
 * useless for that, so every row carries the record behind it: how many
 * commitments, how many kept, and when they were last seen.
 */

import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import {
  Badge,
  EmptyState,
  ErrorState,
  GradientHeader,
  Loading,
  Screen,
  Segmented,
  Stat,
  StatRow,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { formatAgo } from '@/lib/datetime';
import { formatHours } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { useAdminMosque } from '@/store/adminMosque';
import { colors, icon, numeric, radius, rule, screenPadding, spacing, type } from '@/theme';
import type { MosqueMember } from '@/types';

type Filter = 'all' | 'volunteers' | 'coordinators';

/** Kept commitments as a percentage — the number that decides who to ask. */
function reliability(member: MosqueMember): number | null {
  if (member.signupCount === 0) return null;
  return Math.round((member.attendedCount / member.signupCount) * 100);
}

export default function PeopleScreen() {
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const { mosqueId } = useAdminMosque();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const members = useApi(
    async () => (mosqueId ? api.getMosqueMembers(mosqueId) : null),
    [mosqueId],
  );

  const all = members.data ?? [];

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all.filter((m) => {
      if (filter === 'coordinators' && m.role !== 'admin') return false;
      // "Volunteers" means people who have actually committed to something,
      // not everyone who happens to follow the mosque.
      if (filter === 'volunteers' && m.signupCount === 0) return false;
      if (needle && !m.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [all, filter, query]);

  const totals = useMemo(
    () => ({
      people: all.length,
      active: all.filter((m) => m.signupCount > 0).length,
      hours: all.reduce((sum, m) => sum + m.minutesServed, 0),
    }),
    [all],
  );

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader tall>
        <View>
          <Text style={[font(styles.eyebrow), align]}>{t.directory.toUpperCase()}</Text>
          <Text style={[font(styles.headTitle), align]}>{t.people}</Text>
          <StatRow>
            <Stat value={`${totals.people}`} label={t.followers} />
            <Stat value={`${totals.active}`} label={t.volunteersTab} />
            <Stat value={formatHours(totals.hours)} label={t.hoursServed} />
          </StatRow>
        </View>
      </GradientHeader>

      <View style={styles.controls}>
        <View style={[styles.search, row]}>
          <Search color={colors.inkFaint} size={icon.md} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.searchPeople}
            placeholderTextColor={colors.inkFaint}
            style={[font(styles.searchInput), align]}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        <Segmented
          options={[
            { value: 'all', label: t.all },
            { value: 'volunteers', label: t.volunteersTab },
            { value: 'coordinators', label: t.coordinators },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {members.loading && !members.data ? (
          <Loading variant="inline" />
        ) : members.error && !members.data ? (
          <ErrorState message={members.error} onRetry={() => void members.reload()} />
        ) : shown.length === 0 ? (
          <EmptyState title={t.noPeople} message={t.noPeopleBody} />
        ) : (
          shown.map((member) => {
            const rate = reliability(member);
            return (
              <Pressable
                key={member.userId}
                onPress={() => {
                  tap();
                  router.push({
                    pathname: '/manage/member/[id]',
                    params: { id: member.userId },
                  });
                }}
                style={({ pressed }) => [styles.row, row, pressed && styles.pressed]}
              >
                <View style={[styles.avatar, member.role === 'admin' && styles.avatarAdmin]}>
                  <Text
                    style={[styles.avatarText, member.role === 'admin' && styles.avatarTextAdmin]}
                  >
                    {member.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.rowText}>
                  <View style={[styles.nameLine, row]}>
                    <Text style={[font(styles.name), align]} numberOfLines={1}>
                      {member.name}
                    </Text>
                    {member.role === 'admin' ? (
                      <Badge label={t.coordinatorRole} tone="accent" />
                    ) : null}
                  </View>

                  <Text style={[font(styles.meta), align]} numberOfLines={1}>
                    {member.signupCount === 0
                      ? t.neverAttended
                      : `${member.attendedCount}/${member.signupCount} ${t.shifts}` +
                        (member.lastSeenAt ? ` · ${formatAgo(member.lastSeenAt, lang)}` : '')}
                  </Text>
                </View>

                {rate === null ? null : (
                  <View style={styles.score}>
                    <Text style={[styles.scoreValue, rate < 60 && styles.scoreWeak]}>{rate}%</Text>
                    <Text style={styles.scoreLabel}>
                      {formatHours(member.minutesServed)}
                      {t.hoursShort}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.overline, color: colors.inkOnDarkFaint },
  headTitle: { ...type.h1, color: colors.inkInverse, marginBottom: 14, marginTop: 2 },

  controls: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  search: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 14,
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  searchInput: { ...type.small, lineHeight: undefined, color: colors.ink, flex: 1, padding: 0 },

  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  pressed: { opacity: 0.7 },

  row: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.circle,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: { backgroundColor: colors.accent },
  avatarText: { ...type.title, fontSize: 16, color: colors.inkMuted },
  avatarTextAdmin: { color: colors.inkInverse },

  rowText: { flex: 1, gap: 2 },
  nameLine: { alignItems: 'center', gap: spacing.sm },
  name: { ...type.smallStrong, fontSize: 14.5, color: colors.ink, flexShrink: 1 },
  meta: { ...type.caption, color: colors.inkMuted },

  score: { alignItems: 'flex-end' },
  scoreValue: { ...type.mono, ...numeric, fontSize: 14, color: colors.accent },
  scoreWeak: { color: colors.danger },
  scoreLabel: { ...type.monoSmall, ...numeric, fontSize: 11, color: colors.inkFaint },
});
