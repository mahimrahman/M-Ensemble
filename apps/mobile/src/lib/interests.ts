/**
 * The interest taxonomy. Posts carry a `category` from this list; a member's
 * `interests` are a subset of it; PHASE 4's push fan-out matches the two.
 *
 * The stored value is always the English key — it crosses the API and must not
 * change when the user switches language. `interestLabel` is the display side.
 */

import type { Lang } from '@/i18n/strings';

export const INTEREST_OPTIONS = [
  'Volunteering',
  'Community meals',
  'Education',
  'Youth',
  'Sisters',
  'Facilities',
  'Outreach',
  'Fundraising',
] as const;

export type Interest = (typeof INTEREST_OPTIONS)[number];

const LABELS: Record<Interest, Record<Lang, string>> = {
  Volunteering: { fr: 'Bénévolat', en: 'Volunteering', ar: 'تطوع' },
  'Community meals': { fr: 'Repas communautaires', en: 'Community meals', ar: 'إفطار' },
  Education: { fr: 'Éducation', en: 'Education', ar: 'تعليم' },
  Youth: { fr: 'Jeunesse', en: 'Youth', ar: 'شباب' },
  Sisters: { fr: 'Sœurs', en: 'Sisters', ar: 'أخوات' },
  Facilities: { fr: 'Entretien', en: 'Facilities', ar: 'نظافة' },
  Outreach: { fr: 'Rayonnement', en: 'Outreach', ar: 'تواصل' },
  Fundraising: { fr: 'Collecte de fonds', en: 'Fundraising', ar: 'تبرعات' },
};

/** The display name for an interest. Falls through for unknown categories. */
export function interestLabel(interest: string, lang: Lang): string {
  return LABELS[interest as Interest]?.[lang] ?? interest;
}
