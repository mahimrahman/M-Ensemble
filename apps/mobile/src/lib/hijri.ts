/**
 * Today's Hijri date, via Intl's Umm al-Qura calendar.
 *
 * Returns null when the runtime can't actually do it — Hermes on some Android
 * builds accepts the calendar option and silently formats Gregorian anyway,
 * which would be worse than showing nothing. We check what it resolved to.
 */
export function hijriDateLabel(date: Date = new Date()): string | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    if (formatter.resolvedOptions().calendar !== 'islamic-umalqura') return null;
    // "12 Rabiʻ I 1448 AH" → drop the era suffix, we know what year it is.
    return formatter.format(date).replace(/\s*AH$/, '');
  } catch {
    return null;
  }
}
