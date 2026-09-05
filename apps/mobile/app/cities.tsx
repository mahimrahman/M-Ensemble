/**
 * Cities — the "location place". Where you are at the top, every city we
 * cover underneath with how many mosques it has, and a tap to look at any of
 * them. Browsing is free; the sign-up gate lives on the post itself.
 */

import { useRouter } from 'expo-router';
import { Check, LocateFixed, MapPin } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { BackBar, Badge, Button, GradientHeader, Loading, Screen, SectionTitle } from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { CITIES, cityName, mosqueCity } from '@/lib/cities';
import { tap } from '@/lib/haptics';
import { useLocation } from '@/store/location';
import { colors, icon, radius, screenPadding, spacing, type } from '@/theme';

export default function CitiesScreen() {
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const { status, detectedCity, browsingCity, setBrowsingCity, requestLocation } = useLocation();

  const mosques = useApi(() => api.getMosques(), []);

  /** Mosque count per city, from the same nearest-centre rule the feed uses. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mosques.data ?? []) {
      const id = mosqueCity(m).id;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [mosques.data]);

  const hereLabel =
    status === 'locating'
      ? t.locating
      : detectedCity
        ? cityName(detectedCity, lang)
        : t.unknownCity;

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader tall>
        <View>
          <BackBar />
          <Text style={[font(styles.eyebrow), align]}>{t.yourCity.toUpperCase()}</Text>
          <View style={[styles.hereRow, row]}>
            <MapPin color={colors.live} size={icon.md} strokeWidth={2} />
            <Text style={[font(styles.hereName), align]} numberOfLines={1}>
              {hereLabel}
            </Text>
          </View>
          {status !== 'granted' ? (
            <Button
              label={status === 'locating' ? t.locating : t.useMyLocation}
              icon={LocateFixed}
              variant="inverse"
              size="sm"
              fullWidth={false}
              loading={status === 'locating'}
              onPress={() => void requestLocation()}
              style={styles.locateButton}
            />
          ) : null}
          {status === 'denied' ? (
            <Text style={[font(styles.hint), align]}>{t.locationDenied}</Text>
          ) : null}
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionTitle title={t.cities} />

        {mosques.loading ? <Loading variant="inline" label={t.loading} /> : null}

        {CITIES.map((city) => {
          const isHere = detectedCity?.id === city.id;
          const isBrowsing = browsingCity.id === city.id;
          const count = counts.get(city.id) ?? 0;
          return (
            <Pressable
              key={city.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isBrowsing }}
              onPress={() => {
                tap();
                setBrowsingCity(city);
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              style={({ pressed }) => [
                styles.cityRow,
                row,
                isBrowsing && styles.cityRowOn,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.cityIcon, isBrowsing && styles.cityIconOn]}>
                <MapPin
                  color={isBrowsing ? colors.inkInverse : colors.accent}
                  size={icon.md}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.cityText}>
                <View style={[styles.nameRow, row]}>
                  <Text style={[font(styles.cityName), isBrowsing && styles.cityNameOn]}>
                    {cityName(city, lang)}
                  </Text>
                  {isHere ? <Badge label={t.youAreHere} tone="accent" shape="pill" /> : null}
                </View>
                <Text style={[font(styles.cityMeta), align]}>
                  {count} {count === 1 ? t.mosqueOne : t.mosqueMany}
                </Text>
              </View>
              {isBrowsing ? <Check color={colors.accent} size={icon.md} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.overline, color: colors.inkOnDarkFaint, marginBottom: 4 },
  hereRow: { alignItems: 'center', gap: spacing.sm },
  hereName: { ...type.h1, color: colors.inkInverse, flex: 1 },
  locateButton: { marginTop: spacing.md },
  hint: { ...type.caption, color: colors.inkOnDark, marginTop: spacing.sm },

  scroll: { paddingHorizontal: screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  cityRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.lg,
  },
  cityRowOn: { backgroundColor: '#EDF7F6', borderColor: colors.ruleStrong },
  pressed: { opacity: 0.75 },
  cityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md + 2,
    backgroundColor: colors.accentWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityIconOn: { backgroundColor: colors.accent },
  cityText: { flex: 1, gap: 2 },
  nameRow: { alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cityName: { ...type.bodyStrong, color: colors.ink },
  cityNameOn: { color: colors.accent },
  cityMeta: { ...type.caption, color: colors.inkMuted },
});
