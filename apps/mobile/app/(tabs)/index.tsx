import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/theme';

export default function HomeScreen() {
  return (
    <Screen>
      <Text style={styles.title}>M-Ensemble</Text>
      <Text style={styles.subtitle}>Project scaffold is ready.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 16, color: colors.textMuted, marginTop: spacing.xs },
});
