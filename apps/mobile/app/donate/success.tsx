/**
 * `mensemble://donate/success` — where the server's post-payment page sends
 * the reader back. Stripe has already taken the money and emailed the
 * receipt; this screen only says thank you and offers a way on.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button, GradientHeader, Screen } from '@/components';
import { useLang } from '@/i18n';
import { colors, screenPadding, spacing, type } from '@/theme';

export default function DonationSuccessScreen() {
  const router = useRouter();
  const { mosqueId } = useLocalSearchParams<{ mosqueId?: string }>();
  const { t, font } = useLang();

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader title={t.thankYou} />
      <View style={styles.center}>
        <View style={styles.ring}>
          <CircleCheck color={colors.accent} size={52} strokeWidth={1.8} />
        </View>
        <Text style={font(styles.body)}>{t.donationSuccessBody}</Text>
        {mosqueId ? (
          <Button
            label={t.backToMosque}
            size="lg"
            onPress={() => router.replace({ pathname: '/mosque/[id]', params: { id: mosqueId } })}
          />
        ) : null}
        <Button
          label={t.goHome}
          variant={mosqueId ? 'secondary' : 'primary'}
          size="lg"
          onPress={() => router.replace('/')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.xxxl,
  },
  ring: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentWash,
  },
  body: { ...type.body, color: colors.ink, textAlign: 'center' },
});
