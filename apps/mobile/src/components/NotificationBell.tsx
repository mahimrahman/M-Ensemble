import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { tap } from '@/lib/haptics';
import { colors, icon, radius, type } from '@/theme';

/** Past this the badge reads "9+" — the exact number stops meaning anything. */
const BADGE_MAX = 9;

interface NotificationBellProps {
  /** `onDark` sits on the masthead gradient; `onLight` on the page body. */
  tone?: 'onDark' | 'onLight';
}

/**
 * The bell, with the unread count on it.
 *
 * It owns its own fetch rather than taking a count as a prop: `useApi` reloads
 * on focus, so coming back from the inbox — or from anywhere else — recounts
 * without the screen around it having to remember to.
 *
 * The badge is amber, not teal. Teal is the action colour and the masthead is
 * already teal, so a teal dot on it is invisible; amber is the app's attention
 * colour and the one thing on that gradient the eye finds immediately.
 */
export function NotificationBell({ tone = 'onDark' }: NotificationBellProps) {
  const router = useRouter();
  const { t, font } = useLang();
  const feed = useApi(() => api.getNotifications(), []);

  const unread = feed.data?.unread ?? 0;
  const dark = tone === 'onDark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.openNotifications}
      hitSlop={10}
      onPress={() => {
        tap();
        router.push('/notifications');
      }}
      style={({ pressed }) => [
        styles.button,
        dark ? styles.onDark : styles.onLight,
        pressed && styles.pressed,
      ]}
    >
      <Bell
        color={dark ? colors.inkInverse : colors.ink}
        size={icon.lg}
        strokeWidth={dark ? 1.9 : 2}
      />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={font(styles.badgeText)} numberOfLines={1}>
            {unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  onDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  onLight: {
    backgroundColor: colors.surface,
    borderColor: colors.rule,
  },
  pressed: { opacity: 0.7 },

  // Half off the bell's top-trailing corner, the way a badge sits on an app
  // icon. `right` rather than a flipped position in Arabic: the bell is a
  // 38px circle, not a row, so mirroring it moves the badge onto the glyph.
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.circle,
    backgroundColor: colors.star,
    alignItems: 'center',
    justifyContent: 'center',
    // A ring in the masthead's darkest stop, so the badge reads as lifted off
    // the gradient rather than smudged into it.
    borderWidth: 1.5,
    borderColor: colors.dark,
  },
  badgeText: { ...type.tiny, fontSize: 10, lineHeight: 13, color: colors.inkInverse },
});
