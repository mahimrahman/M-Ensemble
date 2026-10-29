/**
 * Outbound email — password resets, verification links, receipts, coordinator
 * credentials.
 *
 * One function, `sendEmail`, and three transports behind it:
 *
 *   - `resend`  — HTTPS to Resend's API. No SDK; one `fetch`.
 *   - `smtp`    — nodemailer, for a mailbox provider or Postmark/SES over SMTP.
 *   - `console` — prints the message to the log. The default on a laptop and
 *                 under test; `assertProductionConfig` refuses it in production.
 *
 * **Sending never throws into a request.** A reset email that fails to go out
 * is logged loudly and the endpoint still answers 200 — the alternative is
 * telling an attacker which addresses exist by which ones error. Callers that
 * need to know (a receipt, say) read the returned boolean.
 *
 * Templates are plain functions returning `{ subject, text, html }`, bilingual
 * where the recipient's language is known. HTML is kept to inline-styled
 * paragraphs so it renders the same in every client.
 */

import { env, isTest } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export type EmailLang = 'en' | 'fr';

let smtpTransport: { sendMail(opts: Record<string, unknown>): Promise<unknown> } | null = null;

async function viaResend(message: EmailMessage): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    logger.error('[email] EMAIL_PROVIDER=resend but RESEND_API_KEY is unset');
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      reply_to: message.replyTo ?? env.SUPPORT_EMAIL,
    }),
  });
  if (!res.ok) {
    logger.error({ status: res.status, body: await res.text() }, '[email] resend rejected');
    return false;
  }
  return true;
}

async function viaSmtp(message: EmailMessage): Promise<boolean> {
  if (!smtpTransport) {
    if (!env.SMTP_HOST || !env.SMTP_PORT) {
      logger.error('[email] EMAIL_PROVIDER=smtp but SMTP_HOST/SMTP_PORT are unset');
      return false;
    }
    // Loaded lazily so the dependency is only paid for when SMTP is in use.
    const nodemailer = await import('nodemailer');
    smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  await smtpTransport.sendMail({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: message.replyTo ?? env.SUPPORT_EMAIL,
  });
  return true;
}

/** Every message sent under test, newest last. Tests read it instead of a mailbox. */
export const sentEmails: EmailMessage[] = [];

function viaConsole(message: EmailMessage): boolean {
  if (isTest) {
    sentEmails.push(message);
    return true;
  }
  logger.info(
    { to: message.to, subject: message.subject },
    `[email] (console transport)\n${message.text}`,
  );
  return true;
}

/** Sends one message. Resolves to whether the transport accepted it. */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    switch (env.EMAIL_PROVIDER) {
      case 'resend':
        return await viaResend(message);
      case 'smtp':
        return await viaSmtp(message);
      default:
        return viaConsole(message);
    }
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, '[email] send failed');
    return false;
  }
}

// ─── Layout ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wraps paragraphs in the one layout every email uses. `paragraphs` are plain
 * text; a `{ button }` entry becomes a link styled as a button, with the raw
 * URL repeated underneath for clients that strip styles.
 */
export function renderEmail(
  title: string,
  paragraphs: (string | { button: string; url: string })[],
  lang: EmailLang = 'en',
): { text: string; html: string } {
  const footer =
    lang === 'fr'
      ? `Vous recevez ce courriel parce qu’un compte M’Ensemble utilise cette adresse. Questions : ${env.SUPPORT_EMAIL}`
      : `You are receiving this because an M’Ensemble account uses this address. Questions: ${env.SUPPORT_EMAIL}`;

  const text =
    paragraphs
      .map((p) => (typeof p === 'string' ? p : `${p.button}: ${p.url}`))
      .join('\n\n') + `\n\n—\n${footer}`;

  const body = paragraphs
    .map((p) =>
      typeof p === 'string'
        ? `<p style="margin:0 0 16px;font:16px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b2a28">${escapeHtml(p)}</p>`
        : `<p style="margin:0 0 16px"><a href="${escapeHtml(p.url)}" style="display:inline-block;padding:12px 20px;background:#0A5247;color:#fff;text-decoration:none;border-radius:8px;font:600 15px -apple-system,Segoe UI,Helvetica,Arial,sans-serif">${escapeHtml(p.button)}</a></p>` +
          `<p style="margin:0 0 16px;font:12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#6b7a78;word-break:break-all">${escapeHtml(p.url)}</p>`,
    )
    .join('');

  const html =
    `<!doctype html><html lang="${lang}"><body style="margin:0;background:#F7F7EF;padding:24px">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">` +
    `<h1 style="margin:0 0 20px;font:600 22px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#061E1B">${escapeHtml(title)}</h1>` +
    body +
    `<hr style="border:0;border-top:1px solid #e6e8e3;margin:24px 0">` +
    `<p style="margin:0;font:12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#6b7a78">${escapeHtml(footer)}</p>` +
    `</div></body></html>`;

  return { text, html };
}

/** The public website, for links in emails. Falls back to the API origin. */
export function webUrl(path = ''): string {
  const base = env.PUBLIC_WEB_URL ?? env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`;
  return `${base.replace(/\/$/, '')}${path}`;
}

/** The API origin, for links that land on the server (verification, reset). */
export function apiUrl(path = ''): string {
  const base = env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`;
  return `${base.replace(/\/$/, '')}${path}`;
}
