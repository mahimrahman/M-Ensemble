import { Router } from 'express';
import { getAdSlot, postAdEvent } from '../controllers/campaign.controller.js';
import { adEventSchema, adSlotQuerySchema } from '../schemas/admin.schema.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * `/api/ads` — the two endpoints the *mobile app* calls, and the only part of
 * the campaign system that is not behind a platform role.
 *
 * Any signed-in member reaches these; `requireAuth` has already run. That is
 * deliberate rather than lax: the slot endpoint targets on the caller's **own**
 * account interests, which it reads off the token rather than the query string,
 * so there is no version of this call that returns somebody else's ads.
 */
export const adsRouter = Router();

adsRouter.get('/slot', validate(adSlotQuerySchema, 'query'), asyncHandler(getAdSlot));

// Fires on every feed render, so it does the least possible: two `$inc`s and a
// `{ ok: true, data: null }`. Never 404s — see the controller for why.
adsRouter.post('/:id/events', validate(adEventSchema), asyncHandler(postAdEvent));
