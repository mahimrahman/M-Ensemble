import { Tabs } from 'expo-router';
import {
  CalendarCheck,
  CircleUser,
  LayoutGrid,
  Landmark,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '@/i18n';
import { colors, icon, rule, type } from '@/theme';

/** The bar's own height. What survives of the home-indicator inset is added on top. */
const BAR_HEIGHT = 78;

/**
 * How much of the home-indicator inset the bar gives back. The full inset put a
 * visibly deep gap under the icons; keeping most of it stays clear of the
 * indicator without the bar looking bottom-heavy. Floors at 0, so a phone with
 * no inset is untouched.
 */
const INSET_TRIM = 10;

/**
 * The bottom bar. The prototype draws an icon, a label, and a short teal
 * underline beneath the active tab — that underline is the whole reason this
 * renders its own tab items instead of taking the default ones.
 */
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

export default function TabLayout() {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom - INSET_TRIM, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // An explicit height is the bar's *total* height, so the inset the
        // navigator pads inside it has to be added here or the icon slot is
        // squeezed on home-indicator phones. The paddingBottom is not
        // redundant: the navigator pads the *full* inset by default, and only
        // a value of our own overrides it with the trimmed one.
        tabBarStyle: [styles.bar, { height: BAR_HEIGHT + bottomInset, paddingBottom: bottomInset }],
        tabBarItemStyle: styles.barItem,
        tabBarIconStyle: styles.iconSlot,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.feed,
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={LayoutGrid} label={t.feed} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mosques"
        options={{
          title: t.mosques,
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={Landmark} label={t.mosques} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-stuff"
        options={{
          title: t.myStuff,
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={CalendarCheck} label={t.myStuff} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile,
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={CircleUser} label={t.profile} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: rule,
    borderTopColor: colors.rule,
    paddingTop: 10,
    elevation: 0,
  },
  barItem: { paddingTop: 0 },
  /** The custom item draws its own label, so the icon slot has to fit it. */
  iconSlot: { height: 46, width: 76, overflow: 'visible' },
  item: { alignItems: 'center', gap: 3, width: 76 },
  label: { ...type.caption, fontSize: 10.5 },
  labelOn: { ...type.captionStrong, fontSize: 10.5 },
  underline: { width: 18, height: 2.5, borderRadius: 2, backgroundColor: 'transparent' },
  underlineOn: { backgroundColor: colors.accent },
});
