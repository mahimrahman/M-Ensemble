import type { Request, Response } from 'express';
import type {
  AdPlacement,
  CampaignStatus,
  CreateAdvertiserInput,
  CreateCampaignInput,
  UpdateAdvertiserInput,
  UpdateCampaignInput,
} from '@m-ensemble/shared';
import { currentUser } from '../middleware/requireAuth.js';
import * as campaigns from '../services/campaign.service.js';
import { ok, okNull } from '../utils/respond.js';

/**
 * Partner advertisers and their campaigns, plus the two endpoints the *mobile
 * app* calls: one to ask for an ad, one to say it was seen or tapped.
 *
 * Those last two are the only routes in this file that are not behind a
 * platform role — they sit under `/api/ads` for signed-in members. See
 * `admin.routes.ts` and `ads.routes.ts`.
 */

// ─── Advertisers ────────────────────────────────────────────────────────────

export async function listAdvertisers(req: Request, res: Response): Promise<void> {
  ok(res, await campaigns.listAdvertisers(req.query as never));
}

export async function createAdvertiser(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateAdvertiserInput;
  ok(res, await campaigns.createAdvertiser(input, currentUser(req), req), 201);
}

export async function updateAdvertiser(req: Request, res: Response): Promise<void> {
  const patch = req.body as UpdateAdvertiserInput;
  ok(res, await campaigns.updateAdvertiser(String(req.params.id), patch, currentUser(req), req));
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export async function listCampaigns(req: Request, res: Response): Promise<void> {
  ok(res, await campaigns.listCampaigns(req.query as never));
}

export async function getCampaign(req: Request, res: Response): Promise<void> {
  ok(res, await campaigns.getCampaign(String(req.params.id)));
}

export async function createCampaign(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateCampaignInput;
  ok(res, await campaigns.createCampaign(input, currentUser(req), req), 201);
}

export async function updateCampaign(req: Request, res: Response): Promise<void> {
  const patch = req.body as UpdateCampaignInput;
  ok(res, await campaigns.updateCampaign(String(req.params.id), patch, currentUser(req), req));
}

export async function setCampaignStatus(req: Request, res: Response): Promise<void> {
  const { status, reason } = req.body as { status: CampaignStatus; reason?: string };
  ok(
    res,
    await campaigns.setCampaignStatus(String(req.params.id), status, reason, currentUser(req), req),
  );
}

// ─── Delivery, called by the app ────────────────────────────────────────────

/**
 * The ads to show in one slot.
 *
 * **Interests come off the signed-in account, never off the query string.** A
 * client that could name its own targeting could enumerate every campaign on
 * the platform by asking for one interest at a time — and worse, would let a
 * caller pull the creative for audiences it is not in.
 */
export async function getAdSlot(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const query = req.query as unknown as {
    placement: AdPlacement;
    city?: string;
    mosqueId?: string;
    limit?: number;
  };

  ok(
    res,
    await campaigns.serveAds({
      placement: query.placement,
      city: query.city,
      mosqueId: query.mosqueId,
      interests: user.interests,
      limit: query.limit,
    }),
  );
}

/**
 * Count an impression or a click.
 *
 * Always `{ ok: true, data: null }`, even for a campaign that has since been
 * paused or deleted. There is no screen on the other end that could act on a
 * failure here, and a 404 would only turn a race with an ad being paused into
 * an error in someone's logs.
 */
export async function postAdEvent(req: Request, res: Response): Promise<void> {
  const { kind } = req.body as { kind: 'impression' | 'click' };
  await campaigns.recordAdEvent(String(req.params.id), kind);
  okNull(res);
}
