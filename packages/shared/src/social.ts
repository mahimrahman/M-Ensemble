/**
 * A mosque's pages elsewhere — the ones people follow for the announcement
 * that never made it into the app.
 *
 * **Stored as full https URLs**, unlike `Mosque.website`, which is a bare host
 * the UI prefixes. The two differ because a website is always `host` + nothing,
 * while a social page is whatever the platform hands out: `/profile.php?id=…`
 * on Facebook, an opaque invite code on WhatsApp, a numeric channel on
 * Telegram. No template reproduces those, so the link is stored whole and the
 * UI opens it verbatim.
 *
 * Coordinators still type handles, because that is what they know their page
 * by — `normalizeSocial` turns `@ciicmac`, `instagram.com/ciicmac` and the full
 * URL into the same stored value, so pasting the address bar works and so does
 * typing four characters.
 */

/**
 * The platforms mosques here actually use, in the order they are shown.
 * Facebook and Instagram first because that is where the announcements are;
 * the messaging channels last, because joining one is a bigger ask than
 * following a page.
 */
export const SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'x',
  'whatsapp',
  'telegram',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Every field optional: most mosques run two of these, not seven. */
export type MosqueSocial = Partial<Record<SocialPlatform, string>>;

/** Platform names are brand names — not translated, in any language. */
export const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

/**
 * Where a bare handle goes on each platform.
 *
 * WhatsApp is the odd one: a phone number is a `wa.me` chat, anything else is
 * a group invite code. Getting that wrong sends people to a dead link, so it
 * branches on the shape rather than guessing.
 */
const HANDLE_URL: Record<SocialPlatform, (handle: string) => string> = {
  facebook: (h) => `https://facebook.com/${h}`,
  instagram: (h) => `https://instagram.com/${h}`,
  youtube: (h) => `https://youtube.com/@${h}`,
  tiktok: (h) => `https://tiktok.com/@${h}`,
  x: (h) => `https://x.com/${h}`,
  whatsapp: (h) =>
    /^\+?[\d\s().-]+$/.test(h)
      ? `https://wa.me/${h.replace(/\D/g, '')}`
      : `https://chat.whatsapp.com/${h}`,
  telegram: (h) => `https://t.me/${h}`,
};

/** A host, a dot, a TLD, then a path — `facebook.com/khadijahmtl`. */
const BARE_URL = /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i;

/**
 * One social field as it should be stored, or `null` if there is nothing in it.
 *
 * Accepts the three things a coordinator plausibly pastes — a full URL, a URL
 * without the scheme, a handle with or without its `@` — and returns the same
 * canonical `https://…` for all three. Anything that survives is a link; the
 * app never validates that the page exists, which is the mosque's business.
 */
export function normalizeSocial(platform: SocialPlatform, raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    // Force https rather than keeping an http the mosque wrote years ago.
    return `https://${trimmed.replace(/^https?:\/\//i, '')}`;
  }
  if (BARE_URL.test(trimmed)) return `https://${trimmed}`;

  const handle = trimmed.replace(/^@+/, '');
  return handle ? HANDLE_URL[platform](handle) : null;
}

/**
 * Placeholder pages, so every mosque profile has the row.
 *
 * These point at each platform's own front page rather than at an account. We
 * hold verified handles for six mosques and none for the other sixty-four, and
 * a plausible-looking invented handle is worse than an obvious placeholder: it
 * opens some stranger's profile under a mosque's name.
 */
export const DEMO_SOCIAL: MosqueSocial = {
  facebook: 'https://facebook.com',
  instagram: 'https://instagram.com',
  x: 'https://x.com',
};

/**
 * A mosque's pages with the placeholders filled in underneath — the real
 * handle wins wherever there is one. The seed applies this on the way into
 * the database, and the profile screens apply it again on the way out, so a
 * database seeded before the field existed still draws the row.
 */
export function withPlaceholderSocial(social: MosqueSocial | undefined): MosqueSocial {
  return { ...DEMO_SOCIAL, ...social };
}

/**
 * The stored links in display order, dropping the platforms this mosque has
 * nothing on. What every surface iterates instead of re-deriving the order.
 */
export function socialLinks(
  social: MosqueSocial | undefined,
): { platform: SocialPlatform; url: string }[] {
  if (!social) return [];
  return SOCIAL_PLATFORMS.filter((p) => !!social[p]).map((platform) => ({
    platform,
    url: social[platform] as string,
  }));
}
