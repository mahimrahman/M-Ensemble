import express, { Router } from 'express';
import { env } from '../config/env.js';
import { requireStripe, webhookSecret } from '../services/stripe.service.js';
import { handleStripeEvent } from '../services/billing.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

/**
 * The two routes Stripe talks to without a token. Mounted at the app root,
 * **before** `express.json()`, because the webhook signature is computed over
 * the exact bytes Stripe sent and a re-serialised body would never match.
 */
export const webhooksRouter = Router();

/**
 * `POST /webhooks/stripe`. Verify, record, dispatch, answer 200.
 *
 * The 400 for a bad signature is the only non-2xx on purpose: Stripe retries
 * everything else, and a handler bug should not turn into three days of
 * retries. What went wrong is on the `StripeEvent` row.
 */
webhooksRouter.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    const stripe = requireStripe();
    const secret = webhookSecret();
    if (!secret) {
      throw new HttpError(503, 'STRIPE_UNAVAILABLE', 'Webhook secret is not configured.');
    }

    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || !Buffer.isBuffer(req.body)) {
      throw new HttpError(400, 'BAD_SIGNATURE', 'Missing Stripe signature.');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, secret);
    } catch (err) {
      logger.warn({ err }, '[stripe] webhook signature rejected');
      throw new HttpError(400, 'BAD_SIGNATURE', 'Invalid Stripe signature.');
    }

    const outcome = await handleStripeEvent(event);
    res.status(200).json({ received: true, outcome });
  }),
);

/**
 * `GET /donations/return?status=success|cancelled`. Where Checkout sends the
 * donor's browser afterwards. Stripe only accepts http(s) here, so this page
 * exists to hand the person back to the app through its deep link. Nothing on
 * it is trusted for money — the webhook already settled (or did not).
 */
webhooksRouter.get('/donations/return', (req, res) => {
  const status = req.query.status === 'success' ? 'success' : 'cancelled';
  const deepLink = `${env.APP_SCHEME}://donate/${status}`;
  const title = status === 'success' ? 'Merci · Thank you' : 'Don annulé · Donation cancelled';
  const line =
    status === 'success'
      ? 'Votre don a bien été reçu. Un reçu vous a été envoyé par courriel.<br>Your donation was received. A receipt is on its way by email.'
      : 'Aucun montant n’a été prélevé.<br>Nothing was charged.';

  res
    .status(200)
    .type('html')
    .send(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
        `<body style="margin:0;background:#F7F7EF;font:16px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b2a28">` +
        `<div style="max-width:480px;margin:48px auto;background:#fff;border-radius:12px;padding:32px;text-align:center">` +
        `<h1 style="margin:0 0 16px;font-size:22px;color:#061E1B">${title}</h1>` +
        `<p style="margin:0 0 24px">${line}</p>` +
        `<a href="${deepLink}" style="display:inline-block;padding:12px 20px;background:#0A5247;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Retour à l’application · Back to the app</a>` +
        `</div></body></html>`,
    );
});
