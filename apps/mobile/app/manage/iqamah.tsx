/**
 * Iqamah config — the five prayers, each fixed to a wall-clock time or offset
 * from that day's adhan, plus jummah sessions, all taking effect from a date
 * you choose. This is the thing no prayer-times app has: when the mosque
 * actually prays, because the mosque said so.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  BackBar,
  Button,
  Card,
  DayChips,
  EmptyState,
  Field,
  GradientHeader,
  Loading,
  Screen,
  Segmented,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useKeyboardReveal } from '@/hooks/useKeyboardReveal';
import { fill, useLang } from '@/i18n';
import { isWallClock, mosqueDate } from '@/lib/datetime';
import { success, warn } from '@/lib/haptics';
import { addMinutes, prayerLabel } from '@/lib/prayer';
import { colors, icon, numeric, screenPadding, spacing, type } from '@/theme';
import { PRAYERS, type IqamahConfigInput, type IqamahMode, type Prayer } from '@/types';

interface RowState {
  mode: IqamahMode;
  fixedTime: string;
  offsetMinutes: string;
}

interface JummahState {
  label: string;
  khutbahTime: string;
  iqamahTime: string;
}

const DEFAULT_ROW: RowState = { mode: 'offset', fixedTime: '', offsetMinutes: '10' };

export default function IqamahScreen() {
  const { mosqueId } = useLocalSearchParams<{ mosqueId: string }>();
  const router = useRouter();
  const { t, lang, align, row: rowDir, font } = useLang();
  const { scrollRef, keyboardPad, onScroll } = useKeyboardReveal();
  const [rows, setRows] = useState<Record<Prayer, RowState> | null>(null);
  const [jummah, setJummah] = useState<JummahState[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(mosqueDate(0));
  const [saving, setSaving] = useState(false);

  const config = useApi(() => api.getIqamahConfig(mosqueId), [mosqueId]);
  const today = useApi(() => api.getPrayerTimes(mosqueId, mosqueDate(0)), [mosqueId]);

  // Prefill from whatever is in force right now for each prayer.
  useEffect(() => {
    if (!config.data || rows) return;
    const now = mosqueDate(0);
    const next = {} as Record<Prayer, RowState>;
    for (const prayer of PRAYERS) {
      const current = config.data.iqamah
        .filter((i) => i.prayer === prayer && i.effectiveFrom <= now)
        .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
        .pop();
      next[prayer] = current
        ? {
            mode: current.mode,
            fixedTime: current.fixedTime ?? '',
            offsetMinutes: (current.offsetMinutes ?? 10).toString(),
          }
        : { ...DEFAULT_ROW };
    }
    setRows(next);
    setJummah(
      config.data.jummah.map((j) => ({
        label: j.label,
        khutbahTime: j.khutbahTime,
        iqamahTime: j.iqamahTime,
      })),
    );
  }, [config.data, rows]);

  const adhanFor = (prayer: Prayer) => today.data?.rows.find((r) => r.prayer === prayer)?.adhan;

  function update(prayer: Prayer, patch: Partial<RowState>) {
    setRows((prev) => (prev ? { ...prev, [prayer]: { ...prev[prayer], ...patch } } : prev));
  }

  function preview(prayer: Prayer): string {
    const row = rows?.[prayer];
    const adhan = adhanFor(prayer);
    if (!row) return '-';
    if (row.mode === 'fixed') return isWallClock(row.fixedTime) ? row.fixedTime : '-';
    const mins = Number(row.offsetMinutes);
    return adhan && Number.isFinite(mins) ? addMinutes(adhan, mins) : '-';
  }

  function validate(): string | null {
    if (!rows) return t.stillLoading;
    for (const prayer of PRAYERS) {
      const row = rows[prayer];
      if (row.mode === 'fixed' && !isWallClock(row.fixedTime)) {
        return fill(t.errFixedTime, { prayer: prayerLabel(prayer, lang) });
      }
      if (row.mode === 'offset' && !(Number(row.offsetMinutes) >= 0)) {
        return `${prayerLabel(prayer, lang)}: ${t.minutesAfterAdhan}`;
      }
    }
    for (const [i, j] of jummah.entries()) {
      if (!j.label.trim()) return fill(t.errJummahLabel, { n: String(i + 1) });
      if (!isWallClock(j.khutbahTime) || !isWallClock(j.iqamahTime)) {
        return fill(t.errJummahTimes, { n: String(i + 1) });
      }
    }
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem || !rows || !config.data) {
      Alert.alert(t.checkForm, problem ?? t.stillLoading);
      return;
    }
    setSaving(true);
    try {
      // Keep history: rows that took effect before this date stay; anything on
      // or after it is replaced by what's on screen.
      const kept = config.data.iqamah
        .filter((i) => i.effectiveFrom < effectiveFrom)
        .map(({ mosqueId: _m, ...rest }) => rest);
      const fresh = PRAYERS.map((prayer) => {
        const row = rows[prayer];
        return row.mode === 'fixed'
          ? { prayer, mode: 'fixed' as const, fixedTime: row.fixedTime, effectiveFrom }
          : {
              prayer,
              mode: 'offset' as const,
              offsetMinutes: Number(row.offsetMinutes),
              effectiveFrom,
            };
      });
      const input: IqamahConfigInput = {
        iqamah: [...kept, ...fresh],
        jummah: jummah.map((j) => ({
          label: j.label.trim(),
          khutbahTime: j.khutbahTime,
          iqamahTime: j.iqamahTime,
        })),
      };
      await api.setIqamahConfig(mosqueId, input);
      Alert.alert(
        t.savedTitle,
        fill(t.iqamahSavedBody, {
          when: effectiveFrom === mosqueDate(0) ? t.today.toLowerCase() : effectiveFrom,
        }),
        [{ text: t.done, onPress: () => router.back() }],
      );
    } catch {
      warn();
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setSaving(false);
    }
  }

  // The config never arrived: say so and offer a retry, instead of a spinner
  // that never ends.
  if (!rows && config.error) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.manageIqamah} />
        <View style={styles.guard}>
          <EmptyState
            title={t.somethingWrong}
            message={config.error}
            actionLabel={t.retry}
            onAction={() => void config.reload()}
          />
        </View>
      </Screen>
    );
  }

  if (!rows) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.manageIqamah} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} title={t.manageIqamah} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxxl + keyboardPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Text style={[font(styles.lead), align]}>{t.manageIqamah}</Text>

        {PRAYERS.map((prayer) => {
          const row = rows[prayer];
          return (
            <Card key={prayer}>
              <View style={[styles.rowHead, rowDir]}>
                <Text style={font(styles.prayer)}>{prayerLabel(prayer, lang)}</Text>
                <Text style={styles.adhan}>
                  {t.adhan} {adhanFor(prayer) ?? '-'}
                </Text>
              </View>
              <Segmented
                options={[
                  { value: 'fixed' as const, label: t.fixed },
                  { value: 'offset' as const, label: t.offset },
                ]}
                value={row.mode}
                onChange={(mode) => update(prayer, { mode })}
              />
              <View style={[styles.inputRow, rowDir]}>
                {row.mode === 'fixed' ? (
                  <View style={styles.grow}>
                    <Field
                      label={t.iqamah}
                      value={row.fixedTime}
                      onChangeText={(v) => update(prayer, { fixedTime: v })}
                      placeholder="13:30"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                ) : (
                  <View style={styles.grow}>
                    <Field
                      label={t.minutesAfterAdhan}
                      value={row.offsetMinutes}
                      onChangeText={(v) =>
                        update(prayer, { offsetMinutes: v.replace(/[^0-9]/g, '') })
                      }
                      placeholder="15"
                      keyboardType="number-pad"
                    />
                  </View>
                )}
                <View style={styles.preview}>
                  <Text style={font(styles.previewLabel)}>{t.iqamah}</Text>
                  <Text style={styles.previewValue}>{preview(prayer)}</Text>
                </View>
              </View>
            </Card>
          );
        })}

        <View style={[styles.sectionRow, rowDir]}>
          <Text style={[font(styles.section), align]}>{t.jummah}</Text>
          <Button
            label={t.addSession}
            icon={Plus}
            variant="ghost"
            fullWidth={false}
            onPress={() =>
              setJummah((prev) => [
                ...prev,
                {
                  label: prev.length ? `${t.jummah} ${prev.length + 1}` : t.jummah,
                  khutbahTime: '13:00',
                  iqamahTime: '13:20',
                },
              ])
            }
          />
        </View>
        {jummah.length === 0 ? (
          <Card>
            <Text style={[font(styles.muted), align]}>{t.noJummahSessions}</Text>
          </Card>
        ) : (
          jummah.map((session, index) => (
            <Card key={index}>
              <View style={[styles.rowHead, rowDir]}>
                <View style={styles.grow}>
                  <Field
                    label={t.sessionLabel}
                    value={session.label}
                    onChangeText={(v) =>
                      setJummah((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, label: v } : s)),
                      )
                    }
                    placeholder={t.phFirstJummah}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.removeSession}
                  hitSlop={8}
                  onPress={() => setJummah((prev) => prev.filter((_, i) => i !== index))}
                  style={styles.trash}
                >
                  <Trash2 color={colors.danger} size={icon.md} />
                </Pressable>
              </View>
              <View style={[styles.inputRow, rowDir]}>
                <View style={styles.grow}>
                  <Field
                    label={t.khutbah}
                    value={session.khutbahTime}
                    onChangeText={(v) =>
                      setJummah((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, khutbahTime: v } : s)),
                      )
                    }
                    placeholder="13:00"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.grow}>
                  <Field
                    label={t.iqamah}
                    value={session.iqamahTime}
                    onChangeText={(v) =>
                      setJummah((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, iqamahTime: v } : s)),
                      )
                    }
                    placeholder="13:20"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
            </Card>
          ))
        )}

        <View style={styles.group}>
          <Text style={[font(styles.section), align]}>{t.effectiveFrom}</Text>
          <Text style={[font(styles.muted), align]}>{t.effectiveFromHint}</Text>
          <DayChips value={effectiveFrom} onChange={setEffectiveFrom} days={21} />
        </View>

        <Button
          label={saving ? t.saving : t.save}
          size="lg"
          loading={saving}
          onPress={() => void save()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  lead: { ...type.body, color: colors.inkMuted },
  guard: { paddingHorizontal: screenPadding, paddingTop: spacing.xl },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  prayer: { ...type.title, color: colors.ink },
  adhan: { ...type.monoSmall, ...numeric, color: colors.inkMuted },
  inputRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  grow: { flex: 1 },
  preview: { alignItems: 'flex-end', paddingBottom: spacing.sm, minWidth: 64 },
  previewLabel: { ...type.caption, color: colors.inkMuted, textTransform: 'uppercase' },
  previewValue: { ...type.monoLarge, ...numeric, fontSize: 18, color: colors.accent },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  section: { ...type.h2, color: colors.ink },
  muted: { ...type.small, color: colors.inkMuted },
  trash: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  group: { gap: spacing.sm, marginTop: spacing.sm },
});
