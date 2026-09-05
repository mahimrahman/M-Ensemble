/**
 * The mosque-side shell.
 *
 * A coordinator's job is not browsing — it is knowing what is happening at
 * their mosque today, who is coming, and who never showed. So this bar is
 * Dashboard / Events / People / Prayer / Settings, and there is deliberately
 * no feed and no other-mosques tab anywhere in it.
 *
 * Drawn to match the member bar exactly (icon, label, teal underline) so the
 * two apps read as one product.
 */

import { Redirect, Tabs } from 'expo-router';
import {
  CalendarRange,
  LayoutDashboard,
  Moon,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { AdminMosqueProvider } from '@/store/adminMosque';
import { useAuth } from '@/store/auth';
import { colors, icon, rule, type } from '@/theme';

function TabItem({ Icon, label, focused }: { Icon: LucideIcon; label: string; focused: boolean }) {
  const { font } = useLang();
  const tint = focused ? colors.accent : colors.inkFaint;

  return (
    <View style={styles.item}>
      <Icon color={tint} size={icon.lg} strokeWidth={focused ? 2.2 : 1.8} />
      <Text
        style={[font(focused ? styles.labelOn : styles.label), { color: tint }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={[styles.underline, focused && styles.underlineOn]} />
    </View>
  );
}

export default function AdminLayout() {
  const { adminMosqueIds, status } = useAuth();
  const { t } = useLang();

  // Losing the role mid-session (or deep-linking in without it) drops you back
  // to the member app rather than showing an empty coordinator shell.
  if (status === 'authenticated' && adminMosqueIds.length === 0) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <AdminMosqueProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: styles.bar,
          tabBarItemStyle: styles.barItem,
          tabBarIconStyle: styles.iconSlot,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t.dashboard,
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={LayoutDashboard} label={t.dashboard} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            title: t.events,
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={CalendarRange} label={t.events} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="people"
          options={{
            title: t.people,
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={Users} label={t.people} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="prayer"
          options={{
            title: t.adminPrayer,
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={Moon} label={t.adminPrayer} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t.adminSettings,
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={Settings} label={t.adminSettings} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </AdminMosqueProvider>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: rule,
    borderTopColor: colors.rule,
    height: 78,
    paddingTop: 10,
    elevation: 0,
  },
  barItem: { paddingTop: 0 },
  iconSlot: { height: 46, width: 72, overflow: 'visible' },
  item: { alignItems: 'center', gap: 3, width: 72 },
  label: { ...type.caption, fontSize: 10.5 },
  labelOn: { ...type.captionStrong, fontSize: 10.5 },
  underline: { width: 18, height: 2.5, borderRadius: 2, backgroundColor: 'transparent' },
  underlineOn: { backgroundColor: colors.accent },
});
