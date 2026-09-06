/**
 * The mosque's own profile, edited by its coordinator.
 *
 * What people read on the mosque page — the description, the history, the
 * standing programmes, how to get in touch, and the mosque's pages elsewhere.
 * Deliberately *not* here: name, address, coordinates and join code. Those are
 * identity; a mosque renaming itself into another one is not an edit, and the
 * server rejects them too.
 *
 * The services list is a textarea rather than a row editor on purpose. A
 * coordinator adding six programmes at a kitchen table wants to type six lines,
 * not tap "add" six times.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  BackBar,
  Button,
  ErrorState,
  Field,
  GradientHeader,
  Loading,
  Screen,
  SectionTitle,
} from '@/components';
import { useLang } from '@/i18n';
import { success, warn } from '@/lib/haptics';
import { useAdminMosque } from '@/store/adminMosque';
import { SOCIAL_LABEL, SOCIAL_PLATFORMS, type MosqueSocial, type SocialPlatform } from '@/types';
import { colors, screenPadding, spacing, type } from '@/theme';

/** What to type, per platform — a handle for most, an invite for the rest. */
const SOCIAL_PLACEHOLDER: Record<SocialPlatform, string> = {
  facebook: 'yourmosquepage',
  instagram: '@yourmosque',
  youtube: '@yourmosque',
  tiktok: '@yourmosque',
  x: '@yourmosque',
  whatsapp: 'chat.whatsapp.com/… or +1 514-000-0000',
  telegram: '@yourmosque',
};

export default function MosqueProfileScreen() {
  const router = useRouter();
  const { t, align, font } = useLang();
  const { mosqueId, mosque, loading, reload } = useAdminMosque();

  const [bio, setBio] = useState('');
  const [history, setHistory] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [services, setServices] = useState('');
  /**
   * Every platform gets a slot whether or not the mosque uses it, so adding a
   * page later means typing into the blank rather than hunting for an "add".
   * Blanks go up as empty strings and the server drops them — which is also
   * how a link that should no longer be there gets removed.
   */
  const [social, setSocial] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [saving, setSaving] = useState(false);

  // Fill from whatever is published now, once it arrives.
  useEffect(() => {
    if (!mosque) return;
    setBio(mosque.bio ?? '');
    setHistory(mosque.history ?? '');
    setWebsite(mosque.website ?? '');
    setPhone(mosque.phone ?? '');
    setServices((mosque.services ?? []).join('\n'));
    setSocial(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, mosque.social?.[p] ?? ''])));
  }, [mosque?._id]);

  async function save() {
    if (!mosqueId) return;
    setSaving(true);
    try {
      await api.updateMosque(mosqueId, {
        bio,
        history,
        website,
        phone,
        // One per line; the server drops the blanks a trailing newline leaves.
        services: services.split('\n'),
        // Sent whole rather than as a diff: the server replaces the set, so an
        // emptied field is what removes a link.
        social: Object.fromEntries(
          SOCIAL_PLATFORMS.map((p) => [p, social[p] ?? '']),
        ) as MosqueSocial,
      });
      success();
      await reload();
      Alert.alert(t.profileSaved, '');
      router.back();
    } catch {
      warn();
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setSaving(false);
    }
  }

  if (!mosque) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.editMosqueProfile} />
        {/*
          The mosque comes from the admin context, which does not surface an
          error - so a failed load is indistinguishable from a slow one until
          it stops loading. Once it has, offer the retry rather than spinning
          for ever.
        */}
        {loading ? (
          <Loading label={t.loading} />
        ) : (
          <View style={styles.guard}>
            <ErrorState onRetry={() => void reload()} />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} eyebrow={mosque.name} title={t.editMosqueProfile} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity, shown but not editable — so it's clear it isn't missing. */}
        <View style={styles.fixed}>
          <Text style={[font(styles.fixedName), align]}>{mosque.name}</Text>
          <Text style={[font(styles.fixedAddress), align]}>{mosque.address}</Text>
        </View>

        <SectionTitle title={t.mosqueBio} />
        <Field
          label={t.mosqueBio}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          placeholder={t.mosqueBio}
        />

        <SectionTitle title={t.mosqueHistory} />
        <Field
          label={t.mosqueHistory}
          value={history}
          onChangeText={setHistory}
          multiline
          numberOfLines={4}
          placeholder={t.mosqueHistory}
        />

        <SectionTitle title={t.mosqueServices} />
        <Field
          label={t.mosqueServices}
          value={services}
          onChangeText={setServices}
          multiline
          numberOfLines={6}
          hint={t.servicesHint}
        />

        <SectionTitle title={t.contactDetails} />
        <Field
          label={t.visitWebsite}
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="example.org"
        />
        <Field
          label={t.callMosque}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+1 514-000-0000"
        />

        <SectionTitle title={t.mosqueSocial} />
        <Text style={[font(styles.socialHint), align]}>{t.socialHint}</Text>
        {SOCIAL_PLATFORMS.map((platform) => (
          <Field
            key={platform}
            label={SOCIAL_LABEL[platform]}
            value={social[platform] ?? ''}
            onChangeText={(value) => setSocial((prev) => ({ ...prev, [platform]: value }))}
            autoCapitalize="none"
            keyboardType="url"
            placeholder={SOCIAL_PLACEHOLDER[platform]}
          />
        ))}

        <Button label={t.save} size="lg" loading={saving} onPress={() => void save()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  guard: { paddingHorizontal: screenPadding, paddingTop: spacing.xl },
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  fixed: { gap: 2 },
  fixedName: { ...type.h3, color: colors.ink },
  fixedAddress: { ...type.small, color: colors.inkMuted },
  socialHint: { ...type.small, color: colors.inkMuted },
});
