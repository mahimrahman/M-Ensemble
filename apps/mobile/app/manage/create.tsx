/**
 * Create / edit a post. Pick the type, then the fields that type needs:
 * slots for a volunteer shift, capacity for an event, weekly sessions for a
 * class, nothing extra for an announcement.
 *
 * Route params: `mosqueId` (create) or `editId` (edit — type is then fixed).
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import {
  BackBar,
  Button,
  Chip,
  DayChips,
  Field,
  GradientHeader,
  Loading,
  Screen,
  Segmented,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang, type Strings } from '@/i18n';
import { fromInstant, isWallClock, mosqueDate, toInstant, weeklySessions } from '@/lib/datetime';
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

const CATEGORIES = [...INTEREST_OPTIONS, 'Prayer times'];

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
  const { t, align, row, font } = useLang();
  const TYPES = typeOptions(t);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState<'type' | 'details'>(editId ? 'details' : 'type');
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const existing = useApi(async () => (editId ? api.getPost(editId) : null), [editId]);

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
    if (!form.title.trim()) next.title = 'Give it a title.';
    if (!form.description.trim())
      next.description = 'A sentence or two so people know what to expect.';
    if (form.type !== 'announcement') {
      if (!form.location.trim()) next.location = 'Where should people show up?';
      if (!isWallClock(form.startTime)) next.startTime = 'Use HH:MM, e.g. 17:00';
      if (!isWallClock(form.endTime)) next.endTime = 'Use HH:MM, e.g. 19:30';
      if (
        isWallClock(form.startTime) &&
        isWallClock(form.endTime) &&
        form.endTime <= form.startTime
      ) {
        next.endTime = 'Ends before it starts.';
      }
    }
    if (form.type === 'volunteer' && !(Number(form.slotsNeeded) >= 1)) {
      next.slotsNeeded = 'How many people do you need?';
    }
    if (form.type !== 'volunteer' && form.capacity && !(Number(form.capacity) >= 1)) {
      next.capacity = 'A number, or leave it blank for no cap.';
    }
    if (form.type === 'class' && !(Number(form.sessionCount) >= 1)) {
      next.sessionCount = 'At least one session.';
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
                style={({ pressed }) => [styles.typeRow, pressed && styles.pressed]}
              >
                <View style={styles.typeText}>
                  <Text style={styles.typeLabel}>{label}</Text>
                  <Text style={styles.typeHint}>{hint}</Text>
                </View>
                <Text style={styles.typeArrow}>→</Text>
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
      <GradientHeader back={<BackBar />} title={editId ? t.edit : (typeMeta?.label ?? t.createPost)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
            ? 'Iftar setup — Saturday dinner'
            : form.type === 'class'
              ? 'Tajweed for beginners'
              : 'Neighbourhood BBQ'
        }
        error={errors.title}
      />
      <Field
        label={t.postDescription}
        value={form.description}
        onChangeText={(v) => set('description', v)}
        placeholder="What, why, and anything people should bring."
        multiline
        numberOfLines={4}
        style={styles.multiline}
        error={errors.description}
      />

      <View style={styles.group}>
        <Text style={styles.label}>Category</Text>
        <Text style={styles.hint}>Members who picked this interest get the push.</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={form.category === c}
              onPress={() => set('category', c)}
            />
          ))}
        </View>
      </View>

      {!isAnnouncement ? (
        <>
          <View style={styles.group}>
            <Text style={styles.label}>{form.type === 'class' ? 'First session' : 'Day'}</Text>
            <DayChips value={form.date} onChange={(d) => set('date', d)} />
          </View>

          <View style={styles.timeRow}>
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

          <Field
            label={t.location}
            value={form.location}
            onChangeText={(v) => set('location', v)}
            placeholder="Main hall, basement level"
            error={errors.location}
          />
        </>
      ) : null}

      {form.type === 'volunteer' ? (
        <Field
          label="People needed"
          value={form.slotsNeeded}
          onChangeText={(v) => set('slotsNeeded', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          error={errors.slotsNeeded}
          hint="Each person claims one slot."
        />
      ) : null}

      {form.type === 'event' || form.type === 'class' ? (
        <Field
          label={t.capacity}
          value={form.capacity}
          onChangeText={(v) => set('capacity', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="Leave blank for no cap"
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
          hint="Same day and time each week from the first session."
        />
      ) : null}

      <Button
        label={saving ? t.publishing : editId ? t.save : t.publish}
        size="lg"
        loading={saving}
        onPress={() => void submit()}
      />
      {!editId ? (
        <Text style={styles.footnote}>
          {form.type === 'volunteer'
            ? 'Followers who care about this category get notified the moment you post.'
            : 'It goes to the feed of everyone following the mosque.'}
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
  hint: { ...type.small, color: colors.inkMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  timeRow: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  footnote: { ...type.small, color: colors.inkMuted, textAlign: 'center' },
});
