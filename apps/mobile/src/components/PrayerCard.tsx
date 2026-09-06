import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTopInset } from '@/hooks/useTopInset';
import { useLang } from '@/i18n';
import { useNextPrayer } from '@/hooks/useNextPrayer';
import { tap } from '@/lib/haptics';
import { prayerLabel } from '@/lib/prayer';
import { colors, gradients, icon, numeric, radius, screenPadding, spacing, type } from '@/theme';
import type { Mosque, Prayer } from '@/types';
import { NotificationBell } from './NotificationBell';

interface PrayerCardProps {
  mosque: Mosque;
}

/** hh:mm:ss, the prototype's countdown format. Always three fields. */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/**
 * The masthead. A three-stop teal gradient running up under the status bar,
 * carrying the next prayer, a live hh:mm:ss countdown in a frosted badge, and
 * the whole day as a scrolling strip beneath.
 *
 * Full-bleed by design — the feed gives it no horizontal padding of its own.
 */
export function PrayerCard({ mosque }: PrayerCardProps) {
  const router = useRouter();
  const top = useTopInset();
  const { t, lang, isAr, align, row, font } = useLang();
  const { next, now, today, loading } = useNextPrayer(mosque._id);

  const padTop = top + spacing.md;

  if (loading && !next) {
    return (
      <LinearGradient
        colors={[...gradients.masthead]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.panel, { paddingTop: padTop, height: 210 }]}
      >
        {/* The bell is not waiting on prayer times, so it shows straight away
            rather than popping in a second later — and in the same place it
            will occupy once they arrive, so it doesn't jump. */}
        <View style={[styles.head, styles.headLoading, row]}>
          <NotificationBell />
        </View>
      </LinearGradient>
    );
  }
  if (!next) return null;

  const isTomorrow = next.date !== today?.date;
  const row_ = today?.rows.find((r) => r.prayer === next.prayer);

  return (
    <LinearGradient
      colors={[...gradients.masthead]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.panel, { paddingTop: padTop }]}
      accessibilityRole="summary"
    >
      {/*
        Header row: the prayer on the left, the bell and the countdown stacked
        against the trailing edge on the right.

        The bell used to have a line of its own above this row, where it read
        as a floating afterthought. Here it starts level with "NEXT PRAYER" and
        shares an edge with the countdown, so the right side is one column
        rather than two loose objects — and the masthead is no taller for it,
        since the bell and the countdown were already stacked either way.

        Not a third column beside the countdown: on a 320pt screen that leaves
        the prayer name about 80pt and "Maghrib" starts truncating.
      */}
      <View style={[styles.head, row]}>
        <View style={styles.headText}>
          <Text style={[styles.eyebrow, align, font(styles.eyebrow)]}>
            {t.nextPrayer.toUpperCase()}
          </Text>
          <Text style={[styles.prayerName, align, font(styles.prayerName)]}>
            {prayerLabel(next.prayer, lang)}
          </Text>
          <Text style={[styles.times, align]}>
            {row_?.adhan ?? '-'} → {row_?.iqamah ?? '-'}
          </Text>
          {isTomorrow ? (
            <Text style={[styles.tomorrow, align, font(styles.tomorrow)]}>{t.tomorrow}</Text>
          ) : null}
        </View>

        <View style={[styles.headRight, isAr && styles.headRightAr]}>
          <NotificationBell />

          <View style={styles.countdown}>
            <Text style={font(styles.countdownLabel)}>{t.in.toUpperCase()}</Text>
            <Text style={styles.countdownValue}>{clock(next.at.getTime() - now.getTime())}</Text>
          </View>
        </View>
      </View>

      {/* The day as a strip. The next prayer is lifted, past ones fade out. */}
      {today ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.strip, isAr && styles.stripAr]}
        >
          {today.rows.map((r, i) => {
            const active = !isTomorrow && r.prayer === next.prayer;
            const activeIndex = today.rows.findIndex((x) => x.prayer === next.prayer);
            const past = !isTomorrow && activeIndex >= 0 && i < activeIndex;
            return (
              <PrayerPip
                key={r.prayer}
                prayer={r.prayer}
                time={r.adhan}
                active={active}
                past={past}
              />
            );
          })}
        </ScrollView>
      ) : null}

      <View style={[styles.monthRow, row]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.seeFullMonth}
          hitSlop={6}
          onPress={() => {
            tap();
            router.push({ pathname: '/prayer-month/[mosqueId]', params: { mosqueId: mosque._id } });
          }}
          style={({ pressed }) => [
            styles.monthLink,
            isAr && styles.monthLinkAr,
            pressed && styles.pressed,
          ]}
        >
          <CalendarDays color={colors.inkInverse} size={icon.sm} strokeWidth={2} />
          <Text style={font(styles.monthText)}>{t.seeFullMonth}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function PrayerPip({
  prayer,
  time,
  active,
  past,
}: {
  prayer: Prayer;
  time: string;
  active: boolean;
  past: boolean;
}) {
  const { lang, isAr, font } = useLang();

  return (
    <View style={[styles.pip, active && styles.pipActive]}>
      <Text
        style={[
          font(styles.pipName),
          isAr && styles.pipNameAr,
          active ? styles.pipTextActive : past ? styles.pipTextPast : undefined,
        ]}
        numberOfLines={1}
      >
        {prayerLabel(prayer, lang)}
      </Text>
      <Text
        style={[
          styles.pipTime,
          active ? styles.pipTimeActive : past ? styles.pipTextPast : undefined,
        ]}
      >
        {time}
      </Text>
      {active ? <View style={styles.pipDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.lg,
  },
  head: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: 18,
  },
  // The loading placeholder has only the bell in this row, and `space-between`
  // would park it at the leading edge. `flex-end` on a row that mirrors in
  // Arabic puts it against the trailing edge in both directions.
  headLoading: { justifyContent: 'flex-end' },
  // The bell is narrower than the countdown, so which edge of this column it
  // hugs is a real choice: it has to be the screen's, not the one facing the
  // prayer name. The parent row flips for Arabic but `alignItems` is a
  // cross-axis property and doesn't come with it, hence the explicit pair.
  headRight: { alignItems: 'flex-end', gap: spacing.sm },
  headRightAr: { alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
  eyebrow: { ...type.tiny, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.1 },
  prayerName: { ...type.display, color: colors.inkInverse, lineHeight: 30 },
  times: { ...type.mono, ...numeric, color: 'rgba(255,255,255,0.55)', marginTop: 3 },
  tomorrow: { ...type.caption, color: 'rgba(255,255,255,0.45)' },

  countdown: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  countdownLabel: {
    ...type.overline,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 4,
  },
  countdownValue: { ...type.monoLarge, ...numeric, color: colors.inkInverse },

  strip: { gap: 4, paddingRight: screenPadding },
  monthRow: { marginTop: spacing.md, justifyContent: 'flex-end' },
  monthLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  monthLinkAr: { flexDirection: 'row-reverse' },
  monthText: { ...type.captionStrong, color: colors.inkInverse },
  pressed: { opacity: 0.7 },
  stripAr: { flexDirection: 'row-reverse' },
  pip: {
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg - 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  pipActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pipName: { ...type.tiny, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 3 },
  pipNameAr: { fontSize: 12 },
  pipTime: { ...type.mono, ...numeric, color: 'rgba(255,255,255,0.55)' },
  pipTimeActive: { color: colors.star, fontFamily: type.monoLarge.fontFamily },
  pipTextActive: { color: colors.inkInverse },
  pipTextPast: { color: 'rgba(255,255,255,0.28)' },
  pipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    // The logo's orange, on the surface the app shows most. Teal on a teal
    // gradient was the one accent that had nothing to push against.
    backgroundColor: colors.star,
    marginTop: 4,
  },
});
