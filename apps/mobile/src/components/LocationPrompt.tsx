import { MapPin } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '@/i18n';
import { useLocation } from '@/store/location';
import { colors, radius, spacing, type } from '@/theme';
import { Button } from './Button';

/**
 * The first-run ask. A sheet that rises from the bottom of the home screen
 * the first time you land there: why we want your location, one button to
 * say yes, a quiet way to say not now. It never comes back once answered —
 * the cities screen is where you change your mind.
 */
export function LocationPrompt() {
  const insets = useSafeAreaInsets();
  const { t, align, font } = useLang();
  const { promptSeen, status, requestLocation, dismissPrompt } = useLocation();

  const visible = !promptSeen;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismissPrompt}>
      {/* Tapping the dim backdrop is "not now". */}
      <Pressable style={styles.backdrop} onPress={dismissPrompt} accessibilityRole="button" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.iconRing}>
          <MapPin color={colors.accent} size={26} strokeWidth={1.8} />
        </View>
        <Text style={[font(styles.title), align]}>{t.locationTitle}</Text>
        <Text style={[font(styles.body), align]}>{t.locationBody}</Text>

        <Button
          label={status === 'locating' ? t.locating : t.allowLocation}
          size="lg"
          loading={status === 'locating'}
          onPress={() => void requestLocation()}
        />
        <Button label={t.notNow} variant="ghost" onPress={dismissPrompt} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 8,
    borderTopRightRadius: radius.xl + 8,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
    alignItems: 'stretch',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.rule,
    marginBottom: spacing.sm,
  },
  iconRing: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: radius.circle,
    backgroundColor: colors.accentWashStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...type.h2, color: colors.ink, textAlign: 'center' },
  body: { ...type.small, color: colors.inkMuted, textAlign: 'center', marginBottom: spacing.sm },
});
