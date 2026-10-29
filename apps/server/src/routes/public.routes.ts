import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import {
  escapeHtml,
  isLegalKind,
  legalLang,
  loadLegalDocument,
  markdownToHtml,
  type LegalLang,
} from '../services/legal.service.js';
import { verifyEmail } from '../services/account.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';

/**
 * The handful of pages a browser lands on — the two email links and the legal
 * documents — plus the legal JSON the app reads. Open, no token.
 *
 * Mounted at `/` inside the API router, so the paths are `/api/verify-email`,
 * `/api/reset-password` and `/api/legal/:kind`. Mount it again at the app root
 * and the same handlers answer `/legal/:kind` for the store listings.
 *
 * HTML is inline strings, no template engine: three pages, none of which will
 * grow. Helmet's default CSP blocks inline script and style, so each page sets
 * its own policy with a per-request nonce rather than loosening the global one.
 */
export const publicRouter = Router();

const copy = {
  en: {
    verified: 'Email confirmed',
    verifiedBody: 'Thanks — your address is confirmed. You can close this page and return to the app.',
    openApp: 'Open M’Ensemble',
    badLink: 'This link has expired or was already used.',
    badLinkBody: 'Open the app and ask for a new one from your profile.',
    reset: 'Choose a new password',
    newPassword: 'New password',
    confirm: 'Confirm password',
    submit: 'Save password',
    mismatch: 'The two passwords don’t match.',
    done: 'Your password has been changed. Sign in to the app with the new one.',
    failed: 'Something went wrong. Try again, or request a new link.',
    effective: 'Effective',
    version: 'Version',
  },
  fr: {
    verified: 'Courriel confirmé',
    verifiedBody: 'Merci — votre adresse est confirmée. Vous pouvez fermer cette page et retourner dans l’application.',
    openApp: 'Ouvrir M’Ensemble',
    badLink: 'Ce lien a expiré ou a déjà été utilisé.',
    badLinkBody: 'Ouvrez l’application et demandez-en un nouveau depuis votre profil.',
    reset: 'Choisissez un nouveau mot de passe',
    newPassword: 'Nouveau mot de passe',
    confirm: 'Confirmez le mot de passe',
    submit: 'Enregistrer',
    mismatch: 'Les deux mots de passe ne correspondent pas.',
    done: 'Votre mot de passe a été changé. Connectez-vous à l’application avec le nouveau.',
    failed: 'Une erreur est survenue. Réessayez, ou demandez un nouveau lien.',
    effective: 'En vigueur le',
    version: 'Version',
  },
} as const;

/** `?lang=fr` wins; otherwise the browser's preference; English when it has none. */
function pageLang(req: Request): LegalLang {
  if (req.query.lang === 'fr' || req.query.lang === 'en') return req.query.lang;
  // `acceptsLanguages` returns its first argument when no header was sent.
  if (!req.headers['accept-language']) return 'en';
  return req.acceptsLanguages('fr', 'en') === 'fr' ? 'fr' : 'en';
}

function sendPage(res: Response, lang: LegalLang, title: string, body: string, script = ''): void {
  const nonce = randomBytes(16).toString('base64');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; base-uri 'none'`,
  );
  res.type('html').send(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapeHtml(title)} · M’Ensemble</title>` +
      `<style nonce="${nonce}">` +
      `body{margin:0;background:#F7F7EF;font:16px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b2a28}` +
      `main{max-width:640px;margin:0 auto;padding:32px 20px}` +
      `.card{background:#fff;border-radius:12px;padding:28px}` +
      `h1{margin:0 0 16px;font-size:22px;color:#061E1B}h2{font-size:18px;margin:28px 0 8px}h3{font-size:16px;margin:20px 0 6px}` +
      `label{display:block;margin:12px 0 4px;font-weight:600}input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd4cf;border-radius:8px;font-size:16px}` +
      `button,.btn{display:inline-block;margin-top:16px;padding:12px 20px;background:#0A5247;color:#fff;border:0;border-radius:8px;font:600 15px inherit;text-decoration:none;cursor:pointer}` +
      `.err{color:#9b1c1c}.ok{color:#0A5247}.meta{color:#6b7a78;font-size:13px}` +
      `</style></head><body><main><div class="card">${body}</div></main>` +
      (script ? `<script nonce="${nonce}">${script}</script>` : '') +
      `</body></html>`,
  );
}

// ─── Email links ────────────────────────────────────────────────────────────

publicRouter.get(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const lang = pageLang(req);
    const t = copy[lang];
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const appLink = `<p><a class="btn" href="${escapeHtml(env.APP_SCHEME)}://">${t.openApp}</a></p>`;

    try {
      if (!token) throw new HttpError(400, ERROR.INVALID_TOKEN, t.badLink);
      await verifyEmail(token);
      sendPage(res, lang, t.verified, `<h1>${t.verified}</h1><p>${t.verifiedBody}</p>${appLink}`);
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      res.status(err.status);
      sendPage(res, lang, t.badLink, `<h1>${t.badLink}</h1><p>${t.badLinkBody}</p>${appLink}`);
    }
  }),
);

publicRouter.get('/reset-password', (req, res) => {
  const lang = pageLang(req);
  const t = copy[lang];
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  if (!token) {
    res.status(400);
    sendPage(res, lang, t.badLink, `<h1>${t.badLink}</h1><p>${t.badLinkBody}</p>`);
    return;
  }

  const body =
    `<h1>${t.reset}</h1>` +
    `<form id="f" autocomplete="off">` +
    `<label for="p1">${t.newPassword}</label><input id="p1" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>` +
    `<label for="p2">${t.confirm}</label><input id="p2" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>` +
    `<p id="msg" role="status"></p>` +
    `<button type="submit">${t.submit}</button>` +
    `</form>`;

  // The token and strings reach the script as JSON; `<` is escaped so a crafted
  // token can never close the script tag.
  const data = JSON.stringify({
    token,
    url: '/api/auth/reset-password',
    mismatch: t.mismatch,
    done: t.done,
    failed: t.failed,
  }).replace(/</g, '\\u003c');

  const script =
    `(function(){var d=${data};var f=document.getElementById('f'),m=document.getElementById('msg');` +
    `f.addEventListener('submit',function(e){e.preventDefault();m.className='';m.textContent='';` +
    `var a=document.getElementById('p1').value,b=document.getElementById('p2').value;` +
    `if(a!==b){m.className='err';m.textContent=d.mismatch;return;}` +
    `fetch(d.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:d.token,password:a})})` +
    `.then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})` +
    `.then(function(x){if(x.ok){f.innerHTML='<p class="ok">'+d.done+'</p>';}else{m.className='err';m.textContent=(x.j&&x.j.error&&x.j.error.message)||d.failed;}})` +
    `.catch(function(){m.className='err';m.textContent=d.failed;});});})();`;

  sendPage(res, lang, t.reset, body, script);
});

// ─── Legal documents ────────────────────────────────────────────────────────

/**
 * JSON for the app, HTML for a browser. One route, decided by `Accept`
 * (`?format=html` forces the page) — a store reviewer pastes the URL into a
 * browser, the app's client asks for JSON, and both get the same text.
 */
publicRouter.get(
  '/legal/:kind',
  asyncHandler(async (req, res) => {
    const kind = String(req.params.kind);
    if (!isLegalKind(kind)) throw new HttpError(404, ERROR.NOT_FOUND, 'No such document.');

    const lang = legalLang(req.query.lang);
    const doc = await loadLegalDocument(kind, lang);

    const wantsHtml =
      req.query.format === 'html' ||
      (req.query.format !== 'json' && req.accepts(['json', 'html']) === 'html');
    if (!wantsHtml) {
      ok(res, doc);
      return;
    }

    const t = copy[lang];
    sendPage(
      res,
      lang,
      doc.title,
      `<h1>${escapeHtml(doc.title)}</h1>` +
        `<p class="meta">${t.version} ${escapeHtml(doc.version)} · ${t.effective} ${escapeHtml(doc.effectiveAt)}</p>` +
        markdownToHtml(doc.body),
    );
  }),
);
