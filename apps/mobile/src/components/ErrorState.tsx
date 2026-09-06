import { StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { colors, spacing, type } from '@/theme';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface ErrorStateProps {
  /** The `error` from `useApi` — already the server's own words, translated. */
  message?: string | null;
  onRetry: () => void;
  /** `block` fills a screen body; `inline` sits inside a card or a list. */
  variant?: 'block' | 'inline';
}

/**
 * A request failed and the screen has nothing to show.
 *
 * The distinction this exists to keep is between *empty* and *broken*. Both
 * used to render as `EmptyState` — "Nothing coming up" appeared whether the
 * mosque had posted nothing or the phone had no signal, which is a lie in the
 * second case and, worse, offers no way out of it. An error says so and always
 * carries a retry.
 *
 * Render it only when there is no data at all. A refresh that fails while
 * something is already on screen should leave that content alone rather than
 * replacing it with an apology.
 */
export function ErrorState({ message, onRetry, variant = 'block' }: ErrorStateProps) {
  const { t, font, align } = useLang();

  if (variant === 'inline') {
    return (
      <View style={styles.inline}>
        <Text style={[font(styles.message), align]}>{message ?? t.somethingWrong}</Text>
        <Button label={t.retry} onPress={onRetry} variant="secondary" size="sm" fullWidth={false} />
      </View>
    );
  }

  return (
    <EmptyState
      title={t.somethingWrong}
      message={message ?? undefined}
      actionLabel={t.retry}
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  inline: { gap: spacing.sm, alignItems: 'flex-start', paddingVertical: spacing.sm },
  message: { ...type.small, color: colors.inkMuted },
});
