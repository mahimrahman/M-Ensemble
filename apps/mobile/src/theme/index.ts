/**
 * Design tokens — ported verbatim from the Figma prototype.
 *
 * Three colours and a red:
 *
 *   teal    the brand. Dark teals carry the gradients, mid teals the actions.
 *   ink     #0D1F1C  near-black green — body text
 *   paper   #F2F7F6  the page; #FFFFFF the cards
 *   danger  #DC2626  destructive only, nothing else
 *
 * Rules the prototype follows and so do we:
 *   1. Every masthead is a dark teal gradient. Every page body is paper.
 *   2. Cards are white, 12–14px radius, 1px --border, no shadow except CTAs.
 *   3. Display type is Fraunces, body is Outfit, every number is DM Mono.
 *   4. Arabic swaps the family to Noto Sans Arabic and the direction to RTL.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// ─── Raw palette (matches :root in the prototype's index.css) ────────────────
export const teal = {
  950: '#061E1B',
  900: '#0A3530',
  700: '#0A5247',
  600: '#0C6358',
  400: '#2A9E8C',
  300: '#4EC9B8',
  200: '#A8D8D2',
  100: '#D4EDEA',
  50: '#EDF7F6',
} as const;

/**
 * The logo's orange, and a ramp built around it.
 *
 * `500` is sampled straight from "RÉPONDRE PRÉSENT" in `assets/logo.png`
 * (#F3952F) — the second colour the brand already owns. Teal stays the action
 * colour; amber is the *attention* colour, for the things that want a person's
 * eye without shouting danger: a starred mosque, a warning, the live prayer.
 *
 * Do not use it for destructive actions. That is `danger`, and the difference
 * has to stay legible.
 */
export const amber = {
  700: '#8A4B0C',
  600: '#B86A12',
  500: '#F3952F',
  400: '#F7AE5C',
  300: '#FAC98F',
  100: '#FDEBD6',
  50: '#FEF6EC',
} as const;

export const colors = {
  /** The action colour — buttons, links, live counts. */
  accent: '#0A5247',
  accentPressed: '#0C6358',
  /** A tinted block or a selected row. */
  accentWash: '#E2F0EE',
  accentWashStrong: '#D4EDEA',

  background: '#F2F7F6',
  surface: '#FFFFFF',
  surfaceSunken: '#E4EFED',

  /** The darkest gradient stop — status bar, coverage masthead. */
  dark: '#061E1B',

  ink: '#0D1F1C',
  inkMuted: '#527570',
  inkFaint: '#7E9C97',
  inkInverse: '#FFFFFF',
  /** Muted text on a dark surface. */
  inkOnDark: 'rgba(255,255,255,0.55)',
  inkOnDarkFaint: 'rgba(255,255,255,0.4)',

  rule: '#D0E5E2',
  ruleStrong: '#A8D8D2',

  /** A shift that still needs people. */
  attention: '#0C6358',
  danger: '#DC2626',
  dangerBorder: '#FCA5A5',
  dangerWash: '#FEF2F2',

  /**
   * The logo's orange. Reach for it when something should catch the eye but is
   * not a failure: a starred mosque, a warning worth reading, a highlight on a
   * dark masthead. Never for destructive actions — that is `danger`.
   */
  star: '#F3952F',
  starDeep: '#B86A12',
  starWash: '#FEF6EC',
  starBorder: '#FAC98F',

  /** A caution that is not an error — the late-cancellation warning. */
  warn: '#B86A12',
  warnWash: '#FEF6EC',
  warnBorder: '#FAC98F',

  /** The live dot on the active prayer. */
  live: '#4EC9B8',

  overlay: 'rgba(6,30,27,0.45)',
} as const;

export type ColorName = keyof typeof colors;

/** The gradients. Two stops on RN, three where the prototype used three. */
export const gradients = {
  /** The feed masthead — 145deg in CSS, top-left to bottom-right here. */
  masthead: ['#061E1B', '#0A3530', '#0A5247'] as const,
  /** Every other page header — 135deg, two stops. */
  header: ['#061E1B', '#0A5247'] as const,
  /** Coverage / coordinator surfaces — flat darkest. */
  flat: ['#061E1B', '#061E1B'] as const,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 44,
} as const;

/** Horizontal margin on every screen body. The prototype uses 20. */
export const screenPadding = 20;

/** Feed posts run full-bleed with 16px of internal padding. */
export const feedPadding = 16;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 14,
  pill: 20,
  circle: 999,
} as const;

export const rule = 1;

// ─── Font families ───────────────────────────────────────────────────────────
// Keys match what `useAppFonts` loads. Never hardcode these strings elsewhere.
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  displayRegular: 'Fraunces_400Regular',

  body: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemi: 'Outfit_600SemiBold',
  bodyLight: 'Outfit_300Light',

  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',

  arabic: 'NotoSansArabic_400Regular',
  arabicMedium: 'NotoSansArabic_500Medium',
  arabicSemi: 'NotoSansArabic_600SemiBold',
} as const;

/**
 * Type scale. Sizes are the prototype's exact px values.
 *
 * `fontWeight` is deliberately absent — the weight lives in the family, which
 * is how custom fonts work on Android. Setting both gets you a synthetic bold
 * on top of a real one.
 */
export const type = {
  /** Fraunces. Screen titles and post titles. */
  display: { fontFamily: fonts.display, fontSize: 26, lineHeight: 29 },
  h1: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27 },
  h2: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25 },
  h3: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21 },

  /** Outfit. Everything that isn't a headline or a number. */
  title: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 21 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  smallStrong: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  captionStrong: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 17 },
  tiny: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 15 },

  /** Section labels. Uppercase at the call site, 0.1em tracking. */
  overline: { fontFamily: fonts.bodySemi, fontSize: 10, lineHeight: 14, letterSpacing: 1 },

  /** DM Mono. Times, counts, countdowns — anything that must not jitter. */
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
  monoSmall: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 },
  monoLarge: { fontFamily: fonts.monoMedium, fontSize: 22, lineHeight: 26, letterSpacing: 0.4 },
  monoHero: { fontFamily: fonts.monoMedium, fontSize: 30, lineHeight: 34 },
} as const satisfies Record<string, TextStyle>;

export type TypeName = keyof typeof type;

/** Tabular figures on top of DM Mono, so digits never reflow. */
export const numeric = { fontVariant: ['tabular-nums'] } as const satisfies TextStyle;

/** Minimum tap target. Never go below this on a pressable. */
export const hitSize = 44;

export const icon = {
  xs: 13,
  sm: 15,
  md: 18,
  lg: 22,
  xl: 26,
} as const;

/**
 * The one shadow in the app: a primary CTA lifting off the page.
 * react-native-web deprecated the `shadow*` props in favour of `boxShadow`;
 * native still wants the individual props (plus Android's elevation).
 */
export const ctaShadow: ViewStyle = Platform.select<ViewStyle>({
  web: { boxShadow: '0 6px 16px rgba(10, 82, 71, 0.35)' },
  default: {
    shadowColor: '#0A5247',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
}) as ViewStyle;

/** Post-type accents, straight from TYPE_CFG in the prototype. */
export const postTypeColors = {
  volunteer: { color: '#0A5247', bg: '#E2F0EE' },
  event: { color: '#0C6358', bg: '#D6EDE9' },
  class: { color: '#0A3530', bg: '#D0E7E4' },
  announcement: { color: '#527570', bg: '#E4EFED' },
} as const;
