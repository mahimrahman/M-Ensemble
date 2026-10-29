/**
 * Privacy policy and terms of service, read from the API so the text in the
 * app is the text on the website and in the store listing — one source.
 *
 * Open to everyone: the root navigator lets an unauthenticated visitor in, so
 * the policy can be read before an account exists. Arabic readers get the
 * English text; the document is published in the two official languages.
 */

import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LegalDocumentKind } from '@m-ensemble/shared';
import { api } from '@/api/client';
import { BackBar, Card, ErrorState, GradientHeader, Loading, Screen } from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { formatDay } from '@/lib/format';
import { Markdown } from '@/lib/markdown';
import { colors, screenPadding, spacing, type } from '@/theme';

function isKind(value: string | undefined): value is LegalDocumentKind {
  return value === 'privacy' || value === 'terms';
}

export default function LegalScreen() {
  const { kind: raw } = useLocalSearchParams<{ kind: string }>();
  const { t, lang, align, row, font } = useLang();
  const kind: LegalDocumentKind = isKind(raw) ? raw : 'privacy';
  const docLang = lang === 'fr' ? 'fr' : 'en';

  const doc = useApi(() => api.getLegalDocument(kind, docLang), [kind, docLang]);
  const title = kind === 'terms' ? t.termsOfService : t.privacyPolicy;

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader back={<BackBar />} title={doc.data?.title ?? title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {doc.loading ? (
          <Loading label={t.loading} />
        ) : !doc.data ? (
          <ErrorState message={doc.error} onRetry={() => void doc.reload()} />
        ) : (
          <>
            <View style={[styles.meta, row]}>
              <Text style={[font(styles.metaText), align]}>
                {t.legalEffective} {formatDay(doc.data.effectiveAt, lang)}
              </Text>
              <Text style={font(styles.metaText)}>
                {t.version} {doc.data.version}
              </Text>
            </View>
            <Card>
              <Markdown source={doc.data.body} />
            </Card>
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
    gap: spacing.md,
  },
  meta: { justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.xs },
  metaText: { ...type.caption, color: colors.inkMuted },
});
