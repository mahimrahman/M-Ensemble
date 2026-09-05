import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { colors, spacing, type } from '@/theme';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  message?: string;
  /** Accepted for call-site convenience; deliberately not rendered. */
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

/** Two lines and a way out. An empty list doesn't need an illustration. */
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const { font } = useLang();

  return (
    <View style={styles.wrap}>
      <Text style={font(styles.title)}>{title}</Text>
      {message ? <Text style={font(styles.message)}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          fullWidth={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.xxl, gap: 6, alignItems: 'center' },
  title: { ...type.h3, color: colors.ink, textAlign: 'center' },
  message: { ...type.small, color: colors.inkMuted, textAlign: 'center' },
  action: { marginTop: spacing.md },
});
