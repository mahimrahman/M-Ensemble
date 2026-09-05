import { StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { prayerLabel } from '@/lib/prayer';
import { colors, numeric, radius, rule, spacing, type } from '@/theme';
import type { Prayer, PrayerTable as PrayerTableData } from '@/types';

interface PrayerTableProps {
  table: PrayerTableData;
  /** Marks the row the countdown is pointing at. */
  highlight?: Prayer | null;
}

/**
 * The printed timetable, exactly as the prototype draws it: a white card with
 * a tinted header strip, three columns, hairlines between rows, and the next
 * prayer's row washed teal with a dot beside its name.
 */
export function PrayerTable({ table, highlight = null }: PrayerTableProps) {
  const { t, lang, isAr, row: rowDir, font } = useLang();

  const headings = [t.prayer, t.adhan, t.iqamah];

  return (
    <View style={styles.card}>
      <View style={[styles.head, rowDir]}>
        {headings.map((h) => (
          <Text key={h} style={[font(styles.headText), styles.cell]} numberOfLines={1}>
            {h.toUpperCase()}
          </Text>
        ))}
      </View>

      {table.rows.map((r, i) => {
        const active = r.prayer === highlight;
        const last = i === table.rows.length - 1 && table.jummah.length === 0;
        return (
          <View
            key={r.prayer}
            style={[styles.row, rowDir, active && styles.rowActive, last && styles.rowLast]}
          >
            <View style={[styles.cell, styles.nameCell, rowDir]}>
              {active ? <View style={styles.dot} /> : null}
              <Text style={[font(styles.name), active && styles.nameActive]} numberOfLines={1}>
                {prayerLabel(r.prayer, lang)}
              </Text>
            </View>
            <Text style={[styles.cell, styles.adhan, isAr && styles.rtlText]}>{r.adhan}</Text>
            <Text style={[styles.cell, styles.iqamah, isAr && styles.rtlText]}>
              {r.iqamah ?? '—'}
            </Text>
          </View>
        );
      })}

      {table.jummah.length > 0 ? (
        <>
          <View style={[styles.head, styles.jummahHead, rowDir]}>
            <Text style={[font(styles.headText), styles.cell]}>{t.jummah.toUpperCase()}</Text>
            <Text style={[font(styles.headText), styles.cell]}>{t.khutbah.toUpperCase()}</Text>
            <Text style={[font(styles.headText), styles.cell]}>{t.iqamah.toUpperCase()}</Text>
          </View>
          {table.jummah.map((session, i) => (
            <View
              key={session.label}
              style={[styles.row, rowDir, i === table.jummah.length - 1 && styles.rowLast]}
            >
              <Text style={[styles.cell, font(styles.name)]} numberOfLines={1}>
                {session.label}
              </Text>
              <Text style={[styles.cell, styles.adhan, isAr && styles.rtlText]}>
                {session.khutbahTime}
              </Text>
              <Text style={[styles.cell, styles.iqamah, isAr && styles.rtlText]}>
                {session.iqamahTime}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: rule,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  head: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  jummahHead: { borderTopWidth: rule, borderTopColor: colors.rule },
  headText: { ...type.overline, color: colors.inkMuted, flex: 1, letterSpacing: 0.5 },
  row: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderBottomWidth: rule,
    borderBottomColor: colors.rule,
  },
  rowActive: { backgroundColor: colors.accentWash },
  rowLast: { borderBottomWidth: 0 },
  cell: { flex: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  name: { ...type.small, fontSize: 13.5, color: colors.ink },
  nameActive: { fontFamily: type.smallStrong.fontFamily, color: colors.accent },
  adhan: { ...type.mono, ...numeric, color: colors.ink },
  iqamah: { ...type.mono, ...numeric, color: colors.accent },
  rtlText: { textAlign: 'right' },
});
