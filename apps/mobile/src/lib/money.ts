import type { Lang } from '@/i18n';

const LOCALE: Record<Lang, string> = { en: 'en-CA', fr: 'fr-CA', ar: 'ar' };

/**
 * Cents → "$25.00" / "25,00 $" / "٢٥٫٠٠ CA$", in the reader's locale.
 *
 * Donations are CAD only — every mosque on the platform is Canadian and the
 * Stripe accounts are opened there — so the currency is not a parameter.
 * Hermes ships `Intl` on both platforms; the fallback is for a web build on an
 * engine without the locale data, and prints something rather than throwing.
 */
export function formatCad(cents: number, lang: Lang = 'en'): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(LOCALE[lang], {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * "25", "25.50", "25,50" → cents, or null when it is not an amount.
 * Accepts the comma a French keyboard produces for the decimal separator.
 */
export function parseCad(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, '').replace(',', '.');
  if (!cleaned || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
