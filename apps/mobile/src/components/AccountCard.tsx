import { useRouter, type Href } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  KeyRound,
  MailWarning,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { useLang } from '@/i18n';
import { tap } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, icon as iconSize, radius, rule, spacing, type } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';

interface Row {
  label: string;
  Icon: LucideIcon;
  href: Href;
  danger?: boolean;
}

/**
 * The account rows both shells show — the member's Profile and the
 * coordinator's Settings. One component so the two can never drift: the
 * stores require every one of these to be reachable from inside the app, and
 * a row missing from one side would fail review for both.
 *
 * The "email not verified" banner sits on top when it applies. Nothing is
 * locked behind verification, so it nags once per visit and no more.
 */
export function AccountCard() {
  const router = useRouter();
  const { t, isAr, align, row, font } = useLang();
  const { user } = useAuth();
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const Chevron = isAr ? ChevronLeft : ChevronRight;

  const rows: Row[] = [
    { label: t.changePassword, Icon: KeyRound, href: '/account/change-password' },
    { label: t.downloadMyData, Icon: Download, href: '/account/export' },
    {
      label: t.privacyPolicy,
      Icon: ShieldCheck,
      href: { pathname: '/legal/[kind]', params: { kind: 'privacy' } },
    },
    {
      label: t.termsOfService,
      Icon: FileText,
      href: { pathname: '/legal/[kind]', params: { kind: 'terms' } },
    },
    { label: t.deleteAccount, Icon: Trash2, href: '/account/delete', danger: true },
  ];

  async function resendVerification() {
    setResend('sending');
    try {
      await api.resendVerification();
      setResend('sent');
    } catch {
      setResend('failed');
    }
  }

  return (
    <Card>
      <Text style={[font(styles.cardTitle), align]}>{t.account}</Text>

      {user?.emailVerified === false ? (
        <View style={[styles.banner, row]}>
          <MailWarning color={colors.warn} size={iconSize.md} strokeWidth={2} />
          <Text style={[font(styles.bannerText), align]}>
            {resend === 'failed' ? t.somethingWrong : t.emailNotVerified}
          </Text>
          {resend === 'sent' ? (
            <Text style={font(styles.sent)}>{t.verificationSent}</Text>
          ) : (
            <Button
              label={t.resendVerification}
              variant="secondary"
              size="sm"
              fullWidth={false}
              loading={resend === 'sending'}
              onPress={() => void resendVerification()}
            />
          )}
        </View>
      ) : null}

      {rows.map(({ label, Icon, href, danger }, i) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            tap();
            router.push(href);
          }}
          style={({ pressed }) => [
            styles.row,
            row,
            i === rows.length - 1 && styles.rowLast,
            pressed && styles.pressed,
          ]}
        >
          <Icon
            color={danger ? colors.danger : colors.inkMuted}
            size={iconSize.md}
            strokeWidth={2}
          />
          <Text style={[font(styles.label), danger && styles.labelDanger, align]}>{label}</Text>
          <Chevron color={colors.inkFaint} size={iconSize.md} strokeWidth={2} />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.captionStrong, color: colors.ink },
  banner: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warnWash,
    borderWidth: rule,
    borderColor: colors.warnBorder,
    borderRadius: radius.md,
  },
  bannerText: { ...type.caption, color: colors.warn, flex: 1 },
  sent: { ...type.captionStrong, color: colors.warn },
  row: {
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  rowLast: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  label: { ...type.small, color: colors.ink, flex: 1 },
  labelDanger: { color: colors.danger },
});
