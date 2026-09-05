/**
 * A month of prayer times for one mosque — the printed calendar a mosque
 * pins by the door. Every day as a row, five prayers across, today washed
 * teal, with a toggle between adhan and the iqamah this mosque actually
 * prays at. Chevrons walk to the neighbouring months.
 */

import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { BackBar, GradientHeader, Loading, Screen, Segmented } from '@/components';
import { useApi } from '@/hooks/useApi';
import { usePrayerMonth } from '@/hooks/usePrayerMonth';
import { useLang } from '@/i18n';
import { todayDateString } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { prayerLabel } from '@/lib/prayer';
import { colors, icon, numeric, radius, rule, screenPadding, spacing, type } from '@/theme';
import { PRAYERS } from '@/types';

const LOCALE = { en: 'en-CA', fr: 'fr-CA', ar: 'ar' } as const;

type Column = 'adhan' | 'iqamah';

export default function PrayerMonthScreen() {
  const { mosqueId } = useLocalSearchParams<{ mosqueId: string }>();
  const { t, lang, isAr, align, row, font } = useLang();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [column, setColumn] = useState<Column>('adhan');

  const mosque = useApi(() => api.getMosque(mosqueId), [mosqueId]);
  const tables = usePrayerMonth(mosqueId, year, month);

  const today = todayDateString();
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(LOCALE[lang], {
    month: 'long',
    year: 'numeric',
  });

  function step(delta: number) {
    tap();
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  /** "Mon 7" — a weekday and a day number, in the active language. */
  function dayLabel(date: string): { weekday: string; day: string } {
    const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
    const at = new Date(y, m - 1, d, 12);
    return {
      weekday: at.toLocaleDateString(LOCALE[lang], { weekday: 'short' }),
      day: `${d}`,
    };
  }

  const Prev = isAr ? ChevronRight : ChevronLeft;
  const Next = isAr ? ChevronLeft : ChevronRight;

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} eyebrow={mosque.data?.name ?? ' '} title={t.monthTimes} />

      {/* Month navigator + adhan/iqamah toggle stay put while the table scrolls. */}
      <View style={styles.controls}>
        <View style={[styles.monthRow, row]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.previousMonth}
            hitSlop={8}
            onPress={() => step(-1)}
            style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}
          >
            <Prev color={colors.accent} size={icon.lg} strokeWidth={2} />
          </Pressable>
          <Text style={[font(styles.monthLabel), align]} numberOfLines={1}>
            {monthLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.nextMonth}
            hitSlop={8}
            onPress={() => step(1)}
            style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}
          >
            <Next color={colors.accent} size={icon.lg} strokeWidth={2} />
          </Pressable>
        </View>
        <Segmented
          options={[
            { value: 'adhan' as const, label: t.adhan },
            { value: 'iqamah' as const, label: t.iqamah },
          ]}
          value={column}
          onChange={setColumn}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={[styles.head, row]}>
            <Text style={[font(styles.headText), styles.dateCell, align]}>
              {t.date.toUpperCase()}
            </Text>
            {PRAYERS.map((prayer) => (
              <Text key={prayer} style={[font(styles.headText), styles.cell]} numberOfLines={1}>
                {prayerLabel(prayer, lang)}
              </Text>
            ))}
          </View>

          {tables.loading && !tables.data ? (
            <View style={styles.loading}>
              <Loading variant="inline" label={t.loading} />
            </View>
          ) : (
            (tables.data ?? []).map((table, i, all) => {
              const isToday = table.date === today;
              const { weekday, day } = dayLabel(table.date);
              return (
                <View
                  key={table.date}
                  style={[
                    styles.row,
                    row,
                    isToday && styles.rowToday,
                    i === all.length - 1 && styles.rowLast,
                  ]}
                >
                  <View style={[styles.dateCell, styles.dateInner, row]}>
                    <Text style={[styles.day, isToday && styles.dayToday]}>{day}</Text>
                    <Text
                      style={[font(styles.weekday), isToday && styles.weekdayToday]}
                      numberOfLines={1}
                    >
                      {isToday ? t.today : weekday}
                    </Text>
                  </View>
                  {table.rows.map((r) => (
                    <Text
                      key={r.prayer}
                      style={[
                        styles.cell,
                        styles.time,
                        column === 'iqamah' && styles.timeIqamah,
                        isToday && styles.timeToday,
                      ]}
                    >
                      {column === 'adhan' ? r.adhan : (r.iqamah ?? '—')}
                    </Text>
                  ))}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  monthRow: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chevron: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  monthLabel: { ...type.h3, color: colors.ink, flex: 1, textAlign: 'center' },

  scroll: { paddingHorizontal: screenPadding, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  head: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
    alignItems: 'center',
  },
  headText: {
    ...type.overline,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  loading: { paddingHorizontal: spacing.lg },

  row: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  rowToday: { backgroundColor: colors.accentWash },
  rowLast: { borderBottomWidth: 0 },
  /** The date column is wider than the five time columns. */
  dateCell: { flex: 1.35 },
  dateInner: { alignItems: 'baseline', gap: 5 },
  cell: { flex: 1 },
  day: { ...type.mono, ...numeric, fontSize: 12.5, color: colors.ink },
  dayToday: { fontFamily: type.monoLarge.fontFamily, color: colors.accent },
  weekday: { ...type.caption, fontSize: 10.5, color: colors.inkMuted },
  weekdayToday: { color: colors.accent, fontFamily: type.captionStrong.fontFamily },
  time: { ...type.monoSmall, ...numeric, fontSize: 11.5, color: colors.ink, textAlign: 'center' },
  timeIqamah: { color: colors.accent },
  timeToday: { fontFamily: type.monoLarge.fontFamily },
});
