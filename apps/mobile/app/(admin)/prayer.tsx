/**
 * Prayer — the mosque's own times as the congregation will see them, plus the
 * door to editing iqamah.
 *
 * A coordinator's question here is not "when is Asr" but "is what we publish
 * correct" — so this shows today's table exactly as the member app renders it,
 * and flags any prayer with no iqamah configured.
 */

import { useRouter } from 'expo-router';
import { Clock, TriangleAlert } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import {
  Button,
  EmptyState,
  GradientHeader,
  Loading,
  PrayerTable,
  Screen,
  SectionTitle,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { todayDateString } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { useAdminMosque } from '@/store/adminMosque';
import { colors, icon, radius, rule, screenPadding, spacing, type } from '@/theme';

export default function AdminPrayerScreen() {
  const router = useRouter();
  const { t, align, row, font } = useLang();
  const { mosqueId, mosque } = useAdminMosque();

  const table = useApi(
    async () => (mosqueId ? api.getPrayerTimes(mosqueId, todayDateString()) : null),
    [mosqueId],
  );
  const config = useApi(
    async () => (mosqueId ? api.getIqamahConfig(mosqueId) : null),
    [mosqueId],
  );

  /** Prayers the congregation would see blank — the one real error state here. */
  const missing = (table.data?.rows ?? []).filter((r) => r.iqamah === null);

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        eyebrow={t.mosqueSide}
        title={t.adminPrayer}
        subtitle={mosque?.name}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Button
          label={t.manageIqamah}
          icon={Clock}
          size="lg"
          onPress={() => {
            tap();
            router.push({ pathname: '/manage/iqamah', params: { mosqueId: mosqueId ?? '' } });
          }}
        />

        {missing.length > 0 ? (
          <View style={[styles.warning, row]}>
            <TriangleAlert color={colors.danger} size={icon.md} strokeWidth={2} />
            <Text style={[font(styles.warningText), align]}>
              {missing.map((r) => t[r.prayer]).join(' · ')}
            </Text>
          </View>
        ) : null}

        <SectionTitle title={t.todayPrayers} />
        {table.loading && !table.data ? (
          <Loading variant="inline" />
        ) : table.data ? (
          <PrayerTable table={table.data} />
        ) : (
          <EmptyState title={t.todayPrayers} message={table.error ?? t.somethingWrong} />
        )}

        {(config.data?.jummah ?? []).length > 0 ? (
          <>
            <SectionTitle title={t.jummah} />
            {(config.data?.jummah ?? []).map((session, i) => (
              <View key={`${session.label}-${i}`} style={[styles.jummahRow, row]}>
                <Text style={[font(styles.jummahLabel), align]} numberOfLines={1}>
                  {session.label}
                </Text>
                <Text style={styles.jummahTime}>
                  {session.khutbahTime} · {session.iqamahTime}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  warning: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: 14,
    backgroundColor: colors.dangerWash,
    borderWidth: rule,
    borderColor: colors.dangerBorder,
    borderRadius: radius.lg,
  },
  warningText: { ...type.small, color: colors.danger, flex: 1 },

  jummahRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  jummahLabel: { ...type.smallStrong, color: colors.ink, flex: 1 },
  jummahTime: { ...type.mono, fontSize: 13, color: colors.accent },
});
