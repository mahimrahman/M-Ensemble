/**
 * Settings — the coordinator's account and the mosque they are running.
 *
 * The member Profile is about you as an attendee (interests, service hours,
 * notifications). This is about you as an operator: which mosque you are
 * managing, its published details, and the way out.
 */

import { useRouter } from 'expo-router';
import { Clock, ListPlus, LogOut, MapPin, QrCode } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Button, Card, GradientHeader, LangSwitcher, Screen, SectionTitle } from '@/components';
import { useLang } from '@/i18n';
import { tap } from '@/lib/haptics';
import { useAdminMosque } from '@/store/adminMosque';
import { useAuth } from '@/store/auth';
import { colors, icon, numeric, radius, rule, screenPadding, spacing, type } from '@/theme';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { t, align, row, font } = useLang();
  const { user, signOut } = useAuth();
  const { mosqueId, mosque, mosques, setMosqueId } = useAdminMosque();

  function confirmSignOut() {
    Alert.alert(t.signOut, '', [
      { text: t.cancel, style: 'cancel' },
      { text: t.signOut, style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        eyebrow={t.mosqueSide}
        title={user?.name ?? t.adminSettings}
        subtitle={t.adminSettingsSub}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Which mosque, when they coordinate more than one ── */}
        {mosques.length > 1 ? (
          <>
            <SectionTitle title={t.switchMosque} />
            {mosques.map((m) => {
              const active = m._id === mosqueId;
              return (
                <Pressable
                  key={m._id}
                  onPress={() => {
                    tap();
                    setMosqueId(m._id);
                  }}
                  style={({ pressed }) => [
                    styles.mosqueRow,
                    row,
                    active && styles.mosqueRowOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={[font(styles.mosqueName), align]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={[font(styles.meta), align]} numberOfLines={1}>
                      {m.address}
                    </Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioOn]} />
                </Pressable>
              );
            })}
          </>
        ) : null}

        {/* ── The mosque as the congregation sees it ── */}
        <SectionTitle title={t.mosqueProfile} />
        <Card style={styles.card}>
          <Text style={[font(styles.mosqueName), align]} numberOfLines={2}>
            {mosque?.name ?? '—'}
          </Text>
          <View style={[styles.line, row]}>
            <MapPin color={colors.inkFaint} size={icon.sm} strokeWidth={2} />
            <Text style={[font(styles.meta), align]} numberOfLines={2}>
              {mosque?.address ?? '—'}
            </Text>
          </View>
          <View style={[styles.line, row]}>
            <QrCode color={colors.inkFaint} size={icon.sm} strokeWidth={2} />
            <Text style={[font(styles.meta), align]}>{t.joinCode}</Text>
            <Text style={styles.code}>{mosque?.joinCode ?? '—'}</Text>
          </View>
        </Card>

        {/* ── Doors to the things settings owns ── */}
        <SectionTitle title={t.manage} />
        <Button
          label={t.managePosts}
          icon={ListPlus}
          variant="secondary"
          onPress={() => {
            tap();
            router.push({ pathname: '/manage/posts', params: { mosqueId: mosqueId ?? '' } });
          }}
        />
        <Button
          label={t.manageIqamah}
          icon={Clock}
          variant="secondary"
          onPress={() => {
            tap();
            router.push({ pathname: '/manage/iqamah', params: { mosqueId: mosqueId ?? '' } });
          }}
        />

        <SectionTitle title={t.language} />
        <LangSwitcher />

        <View style={styles.signOut}>
          <Button label={t.signOut} icon={LogOut} variant="danger" onPress={confirmSignOut} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.7 },

  mosqueRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  mosqueRowOn: { borderColor: colors.ruleStrong, backgroundColor: colors.accentWash },
  rowText: { flex: 1, gap: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: radius.circle,
    borderWidth: 2,
    borderColor: colors.rule,
  },
  radioOn: { borderColor: colors.accent, backgroundColor: colors.accent },

  card: { gap: spacing.sm },
  line: { alignItems: 'center', gap: spacing.sm },
  mosqueName: { ...type.h3, color: colors.ink },
  meta: { ...type.small, color: colors.inkMuted, flex: 1 },
  code: { ...type.mono, ...numeric, fontSize: 13, color: colors.accent, letterSpacing: 1 },

  signOut: { marginTop: spacing.xl },
});
