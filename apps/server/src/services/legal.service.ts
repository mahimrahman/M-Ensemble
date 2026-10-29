import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { LegalDocument, LegalDocumentKind } from '@m-ensemble/shared';
import { env } from '../config/env.js';
import { LEGAL_DOCUMENTS } from '../shared.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';

/**
 * The privacy policy and terms, served from markdown files checked into
 * `apps/server/legal/`. One source for the app, the website and the store
 * listings, so none of them can drift.
 *
 * Bump these two when the text changes materially. The app shows them at the
 * top of the document; a future "accept the new terms" prompt keys off them.
 */
export const LEGAL_VERSION = '1.0';
export const LEGAL_EFFECTIVE_AT = '2026-11-01';

export type LegalLang = 'en' | 'fr';

/** `apps/server/legal`, resolved from this file rather than the cwd — tsx may be started from the repo root. */
const LEGAL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../legal');

const cache = new Map<string, LegalDocument>();

export function isLegalKind(value: string): value is LegalDocumentKind {
  return (LEGAL_DOCUMENTS as readonly string[]).includes(value);
}

export function legalLang(value: unknown): LegalLang {
  return value === 'fr' ? 'fr' : 'en';
}

export async function loadLegalDocument(
  kind: LegalDocumentKind,
  lang: LegalLang,
): Promise<LegalDocument> {
  const key = `${kind}.${lang}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let markdown: string;
  try {
    markdown = await readFile(path.join(LEGAL_DIR, `${key}.md`), 'utf8');
  } catch {
    throw new HttpError(404, ERROR.NOT_FOUND, 'No such document.');
  }

  // The first H1 is the title; everything after it is the body. The privacy
  // officer's address is whatever the operator configured, not a fixed string.
  const lines = markdown
    .replace(/\r\n/g, '\n')
    .replaceAll('{{SUPPORT_EMAIL}}', env.SUPPORT_EMAIL)
    .split('\n');
  const titleAt = lines.findIndex((l) => l.startsWith('# '));
  const title = titleAt >= 0 ? lines[titleAt]!.slice(2).trim() : kind;
  const body = lines
    .slice(titleAt + 1)
    .join('\n')
    .trim();

  const doc: LegalDocument = {
    kind,
    lang,
    title,
    body,
    effectiveAt: LEGAL_EFFECTIVE_AT,
    version: LEGAL_VERSION,
  };
  cache.set(key, doc);
  return doc;
}

// ─── Markdown → HTML ────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `**bold**` and `[text](url)`; everything else is escaped text. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Just enough markdown for a legal document: `#`–`###` headings, `-` bullet
 * lists, paragraphs, bold and links. Written by hand rather than pulling in a
 * parser, because the input is four files we wrote ourselves.
 */
export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  let inList = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);

    if (!line.trim()) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
    } else if (bullet) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1]!)}</li>`);
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  closeList();
  return out.join('\n');
}
