/**
 * Language. The prototype ships FR/EN/AR with a switcher; this is the same
 * thing wired to persistence and to React Native's text direction.
 *
 * Two things every screen needs from here:
 *   `t`     the string table for the active language
 *   `isAr`  whether to swap in the Arabic face and flip the row direction
 *
 * We do NOT call `I18nManager.forceRTL` — it requires an app restart to take
 * effect and would strand the user mid-session. Instead the layout primitives
 * (`row`, `textAlign`, `writingDirection`) read `isAr` and flip themselves,
 * which is instant and reversible.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { fonts } from '@/theme';
import { LANGS, STRINGS, type Lang, type Strings } from './strings';

const LANG_KEY = 'mensemble.lang';

interface LangContextValue {
  lang: Lang;
  t: Strings;
  isAr: boolean;
  setLang: (lang: Lang) => void;
  /** `{ textAlign, writingDirection }` — spread onto any <Text>. */
  align: TextStyle;
  /** `{ flexDirection }` — spread onto a row that should mirror in Arabic. */
  row: ViewStyle;
  /**
   * Swaps a Latin family for its Arabic counterpart when the language is
   * Arabic. Pass the style you'd use in French; get back the one to render.
   */
  font: (style: TextStyle) => TextStyle;
}

const LangContext = createContext<LangContextValue | null>(null);

/** Latin face → the Arabic face at the same weight. */
const ARABIC_SUBSTITUTE: Record<string, string> = {
  [fonts.display]: fonts.arabicSemi,
  [fonts.displayBold]: fonts.arabicSemi,
  [fonts.displayRegular]: fonts.arabic,
  [fonts.body]: fonts.arabic,
  [fonts.bodyLight]: fonts.arabic,
  [fonts.bodyMedium]: fonts.arabicMedium,
  [fonts.bodySemi]: fonts.arabicSemi,
  // Numbers stay in DM Mono in every language — a time is a time.
};

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(LANG_KEY).then((stored) => {
      if (!cancelled && isLang(stored)) setLangState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void AsyncStorage.setItem(LANG_KEY, next);
  }, []);

  const value = useMemo<LangContextValue>(() => {
    const isAr = lang === 'ar';
    return {
      lang,
      t: STRINGS[lang],
      isAr,
      setLang,
      align: isAr
        ? { textAlign: 'right', writingDirection: 'rtl' }
        : { textAlign: 'left', writingDirection: 'ltr' },
      row: { flexDirection: isAr ? 'row-reverse' : 'row' },
      font: (style) => {
        if (!isAr) return style;
        const family = style.fontFamily;
        const swap = family ? ARABIC_SUBSTITUTE[family] : undefined;
        if (!swap) return style;
        // Noto Sans Arabic sits taller than the Latin faces it replaces: on a
        // Latin line-height its descenders and marks clip inside single-line
        // labels (buttons, headers). Give it the room the script needs.
        const { fontSize, lineHeight } = style;
        const arabicLineHeight =
          fontSize && lineHeight ? Math.max(lineHeight, Math.round(fontSize * 1.5)) : lineHeight;
        return {
          ...style,
          fontFamily: swap,
          ...(arabicLineHeight ? { lineHeight: arabicLineHeight } : {}),
        };
      },
    };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>.');
  return ctx;
}

export { LANGS, LANG_LABEL, STRINGS, type Lang, type Strings } from './strings';

/** Fills '{city}'-style placeholders in a string from the table. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}
