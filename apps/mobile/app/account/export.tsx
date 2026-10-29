/**
 * Download my data — the Law 25 / PIPEDA access request, answered by the app.
 *
 * The export is fetched, summarised as counts so the reader can see what is
 * in it before sharing, and handed to the system share sheet as JSON text.
 * A file would be nicer; for v1 the sheet is what every platform has.
 */

import { Share as ShareIcon } from 'lucide-react-native';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from '@/api/client';
import { BackBar, Button, Card, ErrorState, GradientHeader, Loading, Screen } from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { Alert } from '@/lib/alert';
import { formatDay } from '@/lib/format';
import { colors, numeric, rule, screenPadding, spacing, type } from '@/theme';

export default function ExportAccountScreen() {
  const { t, lang, align, row, font } = useLang();
  const data = useApi(() => api.exportAccount(), []);

  async function share() {
    if (!data.data) return;
    const json = JSON.stringify(data.data, null, 2);
    try {
      await Share.share({ message: json, title: t.yourData });
    } catch {
      // No share sheet here (a desktop browser, mostly): the clipboard is the
      // next best place for a few kilobytes of JSON.
      await Clipboard.setStringAsync(json);
      Alert.alert(t.yourData, t.copied);
    }
  }

  const counts = data.data
    ? [
        [t.followedMosques, data.data.follows.length],
        [t.roles, data.data.memberships.length],
        [t.signups, data.data.signups.length],
        [t.likes, data.data.likes.length],
        [t.notifications, data.data.notifications.length],
        [t.donations, data.data.donations.length],
      ]
    : [];

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} title={t.yourData} subtitle={t.exportBody} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {data.loading ? (
          <Loading label={t.loading} />
        ) : !data.data ? (
          <ErrorState message={data.error} onRetry={() => void data.reload()} />
        ) : (
          <>
            <Card>
              <Text style={[font(styles.meta), align]}>
                {t.exportedAt} {formatDay(data.data.exportedAt, lang)}
              </Text>
              <Text style={[font(styles.name), align]}>{data.data.user.name}</Text>
              <Text style={[font(styles.meta), align]}>{data.data.user.email}</Text>
            </Card>
            <Card>
              {counts.map(([label, count], i) => (
                <View
                  key={String(label)}
                  style={[styles.row, row, i === counts.length - 1 && styles.rowLast]}
                >
                  <Text style={[font(styles.label), align]}>{label}</Text>
                  <Text style={styles.count}>{count}</Text>
                </View>
              ))}
            </Card>
            <Button label={t.shareJson} icon={ShareIcon} size="lg" onPress={() => void share()} />
          </>
        )}
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
  name: { ...type.h3, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 40,
    paddingVertical: spacing.xs,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { ...type.small, color: colors.ink, flex: 1 },
  count: { ...type.mono, ...numeric, color: colors.accent },
});
