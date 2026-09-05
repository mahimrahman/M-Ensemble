import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { colors } from '@/theme';

export default function SettingsScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
});
