import { StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { colors, numeric, radius, spacing, type } from '@/theme';
import type { PublicUser } from '@/types';

interface PeopleProps {
  people: PublicUser[];
  /** Total confirmed, when `people` is a subset. */
  total?: number;
  emptyLabel?: string;
  /** Names the current user so their own row reads "You". */
  meId?: string;
  /** Wall-clock check-in times by user id — renders the "✓ Present · 19:48". */
  checkedInAt?: Record<string, string>;
}

/**
 * Who's in, as the prototype draws it: a stack of washed rows, each with a
 * teal initial-avatar, the name, and a mono check-in stamp once they arrive.
 * Your own row is outlined in a dashed teal so you can find yourself at once.
 */
export function People({ people, emptyLabel, meId, checkedInAt }: PeopleProps) {
  const { t, row, font } = useLang();

  if (people.length === 0) {
    return <Text style={font(styles.empty)}>{emptyLabel ?? t.nobodyYet}</Text>;
  }

  return (
    <View style={styles.list}>
      {people.map((person) => {
        const isMe = person._id === meId;
        const at = checkedInAt?.[person._id];
        return (
          <View key={person._id} style={[styles.row, row, isMe && styles.rowMe]}>
            <View style={[styles.avatar, isMe && styles.avatarMe]}>
              <Text style={styles.avatarText}>{initial(person.name)}</Text>
            </View>
            <View style={styles.text}>
              <Text style={[font(styles.name), isMe && styles.nameMe]} numberOfLines={1}>
                {isMe ? t.you : shortName(person.name)}
              </Text>
              {at ? (
                <Text style={styles.stamp}>
                  ✓ {t.present} · {at}
                </Text>
              ) : null}
            </View>
            {isMe ? <Text style={styles.check}>✓</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/** "Fatima B." — the prototype's shape for a volunteer's name. */
function shortName(name: string): string {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last[0]}.` : first;
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
  },
  rowMe: {
    backgroundColor: colors.accentWashStrong,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.circle,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: { backgroundColor: colors.accent },
  avatarText: { ...type.captionStrong, fontSize: 13, color: colors.inkInverse },
  text: { flex: 1, gap: 1 },
  name: { ...type.small, fontSize: 13.5, color: colors.ink },
  nameMe: { fontFamily: type.smallStrong.fontFamily, color: colors.accent },
  stamp: { ...type.monoSmall, ...numeric, fontSize: 11, color: colors.accent },
  check: { ...type.captionStrong, color: colors.accent },
  empty: { ...type.small, color: colors.inkFaint },
});
