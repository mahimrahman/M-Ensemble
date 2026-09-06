/**
 * Create / edit a post. Pick the type, then the fields that type needs:
 * slots for a volunteer shift, capacity for an event, weekly sessions for a
 * class, nothing extra for an announcement.
 *
 * Route params: `mosqueId` (create) or `editId` (edit — type is then fixed).
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  BackBar,
  Button,
  Chip,
  DayChips,
  EmptyState,
  Field,
  GradientHeader,
  Loading,
  Screen,
  Segmented,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { fill, useLang, type Strings } from '@/i18n';
import { fromInstant, isWallClock, mosqueDate, toInstant, weeklySessions } from '@/lib/datetime';
import { formatHours } from '@/lib/format';
import { success, warn } from '@/lib/haptics';
import { INTEREST_OPTIONS, interestLabel } from '@/lib/interests';
import { colors, rule, screenPadding, spacing, type } from '@/theme';
import type { CreatePostInput, PostType, UpdatePostInput } from '@/types';

function typeOptions(t: Strings): { value: PostType; label: string; hint: string }[] {
  return [
    { value: 'volunteer', label: t.volunteer, hint: t.slotsNeeded },
    { value: 'event', label: t.event, hint: t.capacity },
    { value: 'class', label: t.class, hint: t.sessions },
    { value: 'announcement', label: t.announcement, hint: t.postDescription },
  ];
}

/** The one category that is not an interest: stored in English like the rest. */
const PRAYER_TIMES_CATEGORY = 'Prayer times';
const CATEGORIES = [...INTEREST_OPTIONS, PRAYER_TIMES_CATEGORY];

interface FormState {
  type: PostType;
  title: string;
  description: string;
  category: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  slotsNeeded: string;
  capacity: string;
  sessionCount: string;
}

const EMPTY: FormState = {
  type: 'volunteer',
  title: '',
  description: '',
  category: 'Volunteering',
  date: mosqueDate(1),
  startTime: '17:00',
  endTime: '19:00',
  location: '',
  slotsNeeded: '4',
  capacity: '',
  sessionCount: '6',
};

export default function CreatePostScreen() {
  const { mosqueId, editId } = useLocalSearchParams<{ mosqueId?: string; editId?: string }>();
  const router = useRouter();
  const { t, lang, isAr, align, row, font } = useLang();
  const TYPES = typeOptions(t);
  const categoryLabel = (c: string) =>
    c === PRAYER_TIMES_CATEGORY ? t.prayerTimesCategory : interestLabel(c, lang);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState<'type' | 'details'>(editId ? 'details' : 'type');
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const existing = useApi(async () => (editId ? api.getPost(editId) : null), [editId]);

  /**
   * How long one volunteer is credited for turning up. Only shown once both
   * times parse — a half-typed "1" should not flash a wrong number.
   */
  const shiftLength = (() => {
    if (!isWallClock(form.startTime) || !isWallClock(form.endTime)) return null;
    const [sh = 0, sm = 0] = form.startTime.split(':').map(Number);
    const [eh = 0, em = 0] = form.endTime.split(':').map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return minutes > 0 ? formatHours(minutes) : null;
  })();

  useEffect(() => {
    const post = existing.data;
    if (!post) return;
    const start = fromInstant(post.startAt);
    const end = fromInstant(post.endAt);
    setForm({
      type: post.type,
      title: post.title,
      description: post.description,
      category: post.category,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      location: post.location,
      slotsNeeded: post.slotsNeeded?.toString() ?? '',
      capacity: post.capacity?.toString() ?? '',
      sessionCount: post.sessions?.length.toString() ?? '1',
    });
  }, [existing.data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = t.errTitle;
    if (!form.description.trim()) next.description = t.errDescription;
    if (form.type !== 'announcement') {
      if (!form.location.trim()) next.location = t.errLocation;
      if (!isWallClock(form.startTime)) next.startTime = t.errStartTime;
      if (!isWallClock(form.endTime)) next.endTime = t.errEndTime;
      if (
        isWallClock(form.startTime) &&
        isWallClock(form.endTime) &&
        form.endTime <= form.startTime
      ) {
        next.endTime = t.errEndsBeforeStart;
      }
    }
    if (form.type === 'volunteer' && !(Number(form.slotsNeeded) >= 1)) {
      next.slotsNeeded = t.errSlots;
    }
    if (form.type !== 'volunteer' && form.capacity && !(Number(form.capacity) >= 1)) {
      next.capacity = t.errCapacity;
    }
    if (form.type === 'class' && !(Number(form.sessionCount) >= 1)) {
      next.sessionCount = t.errSessions;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function build(): Omit<CreatePostInput, 'mosqueId' | 'type'> {
    const isAnnouncement = form.type === 'announcement';
    const startAt = isAnnouncement
      ? new Date().toISOString()
      : toInstant(form.date, form.startTime);
    const endAt = isAnnouncement
      ? toInstant(mosqueDate(30), '23:59')
      : toInstant(form.date, form.endTime);

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      startAt,
      endAt,
      location: form.location.trim() || 'Mosque',
      ...(form.type === 'volunteer' ? { slotsNeeded: Number(form.slotsNeeded) } : {}),
      ...(form.type !== 'volunteer' && form.capacity ? { capacity: Number(form.capacity) } : {}),
      ...(form.type === 'class'
        ? {
            sessions: weeklySessions(
              form.date,
              form.startTime,
              form.endTime,
              Number(form.sessionCount),
            ),
          }
        : {}),
    };
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) {
        const patch: UpdatePostInput = build();
        await api.updatePost(editId, patch);
        router.back();
        return;
      }
      if (!mosqueId) throw new Error('missing mosque');
      const post = await api.createPost({ mosqueId, type: form.type, ...build() });
      if (post.type === 'announcement') {
        router.replace({ pathname: '/post/[id]', params: { id: post._id } });
      } else {
        success();
        router.replace({ pathname: '/manage/coverage/[id]', params: { id: post._id } });
      }
    } catch {
      warn();
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setSaving(false);
    }
  }

  if (editId && existing.loading) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.edit} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  // The post could not be loaded. Never show the blank defaults as if they
  // were its values: saving them would overwrite the real post.
  if (editId && !existing.data && existing.error) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.edit} />
        <View style={styles.guard}>
          <EmptyState
            title={t.somethingWrong}
            message={existing.error}
            actionLabel={t.retry}
            onAction={() => void existing.reload()}
          />
        </View>
      </Screen>
    );
  }

  if (step === 'type') {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.createPost} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[font(styles.lead), align]}>{t.postType}</Text>
          <View style={styles.typeList}>
            {TYPES.map(({ value, label, hint }) => {
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  onPress={() => {
                    set('type', value);
                    if (value === 'volunteer') set('category', 'Volunteering');
                    setStep('details');
                  }}
                  style={({ pressed }) => [styles.typeRow, row, pressed && styles.pressed]}
                >
                  <View style={styles.typeText}>
                    <Text style={[font(styles.typeLabel), align]}>{label}</Text>
                    <Text style={[font(styles.typeHint), align]}>{hint}</Text>
                  </View>
                  <Text style={styles.typeArrow}>{isAr ? '←' : '→'}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const isAnnouncement = form.type === 'announcement';
  const typeMeta = TYPES.find((o) => o.value === form.type);

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        back={<BackBar />}
        title={editId ? t.edit : (typeMeta?.label ?? t.createPost)}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!editId ? (
          <Segmented
            options={TYPES.map((o) => ({ value: o.value, label: o.label }))}
            value={form.type}
            onChange={(value) => set('type', value)}
          />
        ) : null}

        <Field
          label={t.postTitle}
          value={form.title}
          onChangeText={(v) => set('title', v)}
          placeholder={
            form.type === 'volunteer'
              ? t.phVolunteerTitle
              : form.type === 'class'
                ? t.phClassTitle
                : t.phEventTitle
          }
          error={errors.title}
        />
        <Field
          label={t.postDescription}
          value={form.description}
          onChangeText={(v) => set('description', v)}
          placeholder={t.phDescription}
          multiline
          numberOfLines={4}
          style={styles.multiline}
          error={errors.description}
        />

        <View style={styles.group}>
          <Text style={[font(styles.label), align]}>{t.category}</Text>
          <Text style={[font(styles.hint), align]}>{t.categoryHint}</Text>
          <View style={[styles.chips, row]}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={categoryLabel(c)}
                selected={form.category === c}
                onPress={() => set('category', c)}
              />
            ))}
          </View>
        </View>

        {!isAnnouncement ? (
          <>
            <View style={styles.group}>
              <Text style={[font(styles.label), align]}>
                {form.type === 'class' ? t.firstSession : t.day}
              </Text>
              <DayChips value={form.date} onChange={(d) => set('date', d)} />
            </View>

            <View style={[styles.timeRow, row]}>
              <View style={styles.grow}>
                <Field
                  label={t.startTime}
                  value={form.startTime}
                  onChangeText={(v) => set('startTime', v)}
                  placeholder="17:00"
                  keyboardType="numbers-and-punctuation"
                  error={errors.startTime}
                />
              </View>
              <View style={styles.grow}>
                <Field
                  label={t.endTime}
                  value={form.endTime}
                  onChangeText={(v) => set('endTime', v)}
                  placeholder="19:30"
                  keyboardType="numbers-and-punctuation"
                  error={errors.endTime}
                />
              </View>
            </View>

            {/*
              Say out loud what these two times are worth. Check-in has no
              check-out — a volunteer who is marked present is credited the
              whole span — so the coordinator setting it should see the number
              they are about to put on someone's record.
            */}
            {form.type === 'volunteer' && shiftLength ? (
              <Text style={font(styles.durationNote)}>
                {fill(t.shiftLengthNote, { length: shiftLength })}
              </Text>
            ) : null}

            <Field
              label={t.location}
              value={form.location}
              onChangeText={(v) => set('location', v)}
              placeholder={t.phLocation}
              error={errors.location}
            />
          </>
        ) : null}

        {form.type === 'volunteer' ? (
          <Field
            label={t.peopleNeeded}
            value={form.slotsNeeded}
            onChangeText={(v) => set('slotsNeeded', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            error={errors.slotsNeeded}
            hint={t.oneSlotEach}
          />
        ) : null}

        {form.type === 'event' || form.type === 'class' ? (
          <Field
            label={t.capacity}
            value={form.capacity}
            onChangeText={(v) => set('capacity', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={t.phNoCap}
            error={errors.capacity}
          />
        ) : null}

        {form.type === 'class' ? (
          <Field
            label={t.sessions}
            value={form.sessionCount}
            onChangeText={(v) => set('sessionCount', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            error={errors.sessionCount}
            hint={t.weeklySessionsHint}
          />
        ) : null}

        <Button
          label={saving ? t.publishing : editId ? t.save : t.publish}
          size="lg"
          loading={saving}
          onPress={() => void submit()}
        />
        {!editId ? (
          <Text style={font(styles.footnote)}>
            {form.type === 'volunteer' ? t.publishNoteVolunteer : t.publishNoteFeed}
          </Text>
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
    gap: spacing.lg,
  },
  lead: { ...type.h2, color: colors.ink },
  guard: { paddingHorizontal: screenPadding, paddingTop: spacing.xl },
  typeList: {},
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  typeText: { flex: 1, gap: spacing.xxs },
  typeArrow: { ...type.body, color: colors.inkFaint },
  typeLabel: { ...type.title, color: colors.ink },
  typeHint: { ...type.small, color: colors.inkMuted },
  pressed: { opacity: 0.7 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  group: { gap: spacing.xs },
  label: { ...type.caption, color: colors.inkMuted, textTransform: 'uppercase' },
  durationNote: { ...type.small, color: colors.inkMuted },
  hint: { ...type.small, color: colors.inkMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  timeRow: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  footnote: { ...type.small, color: colors.inkMuted, textAlign: 'center' },
});
