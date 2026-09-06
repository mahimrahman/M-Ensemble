import type { Request } from 'express';
import type {
  AdPlacement,
  Advertiser,
  AdvertiserStatus,
  Campaign,
  CampaignStat,
  CampaignStatus,
  CampaignWithAdvertiser,
  CreateAdvertiserInput,
  CreateCampaignInput,
  PageQuery,
  PageResult,
  ServedAd,
  UpdateAdvertiserInput,
  UpdateCampaignInput,
} from '@m-ensemble/shared';
import { AdvertiserModel } from '../models/Advertiser.js';
import { CampaignModel, type CampaignDocument } from '../models/Campaign.js';
import { CampaignStatModel } from '../models/CampaignStat.js';
import { MosqueModel } from '../models/Mosque.js';
import type { UserDocument } from '../models/User.js';
import { CAMPAIGN_TRANSITIONS, campaignSpentCents, mosqueCityId } from '../shared.js';
import * as audit from './audit.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { asContract } from '../utils/serialize.js';
import { pageResult, resolvePage, searchRegex, sortSpec } from '../utils/paging.js';

/**
 * Partner campaigns — a restaurant, a modest-wear brand, a driving school
 * buying a card in the feed.
 *
 * We are the ad server. Nothing here talks to Meta or Google: the creative
 * lives in our database, the targeting is matched against our own users and
 * mosques, and the counters are ours. That is the only version of this that
 * can promise a mosque what its members will and will not be shown.
 *
 * **The reader is never the product.** Delivery matches on city, mosque and
 * declared interests — facts the app already holds — and `ServedAd` carries no
 * commercial data back to the phone. No identifier for the viewer is sent to
 * the advertiser, and no per-person impression row is kept: the smallest thing
 * this counts is one campaign on one day.
 */

// ─── Advertisers ────────────────────────────────────────────────────────────

const ADVERTISER_SORTABLE = ['name', 'createdAt', 'category'] as const;

export async function listAdvertisers(
  query: PageQuery & { status?: AdvertiserStatus },
): Promise<PageResult<Advertiser>> {
  const resolved = resolvePage(query);
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  const rx = searchRegex(query.q);
  if (rx) filter.$or = [{ name: rx }, { category: rx }, { contactEmail: rx }];

  const [rows, total] = await Promise.all([
    AdvertiserModel.find(filter)
      .sort(sortSpec(query, ADVERTISER_SORTABLE, { createdAt: -1 }))
      .skip(resolved.skip)
      .limit(resolved.limit),
    AdvertiserModel.countDocuments(filter),
  ]);

  return pageResult(
    rows.map((r) => asContract<Advertiser>(r)),
    total,
    resolved,
  );
}

export async function createAdvertiser(
  input: CreateAdvertiserInput,
  actor: UserDocument,
  req?: Request,
): Promise<Advertiser> {
  const now = new Date();
  const doc = await AdvertiserModel.create({
    _id: newId(),
    ...input,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  });

  await audit.record(
    actor,
    {
      action: 'advertiser.created',
      targetType: 'advertiser',
      targetId: doc._id,
      summary: `Added partner ${doc.name} (${doc.category})`,
    },
    req,
  );
  return asContract<Advertiser>(doc);
}

export async function updateAdvertiser(
  id: string,
  patch: UpdateAdvertiserInput,
  actor: UserDocument,
  req?: Request,
): Promise<Advertiser> {
  const doc = await AdvertiserModel.findById(id);
  if (!doc) throw new HttpError(404, ERROR.NOT_FOUND, 'No such advertiser.');

  Object.assign(doc, patch);
  doc.updatedAt = new Date();
  await doc.save();

  await audit.record(
    actor,
    {
      action: 'advertiser.updated',
      targetType: 'advertiser',
      targetId: doc._id,
      summary: `Updated partner ${doc.name}`,
      meta: { fields: Object.keys(patch) },
    },
    req,
  );
  return asContract<Advertiser>(doc);
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

const CAMPAIGN_SORTABLE = ['createdAt', 'startAt', 'endAt', 'budgetCents', 'impressions', 'clicks'];

/** `clicks / impressions` as a percentage, one decimal. Zero when unserved. */
function ctrOf(c: { impressions: number; clicks: number }): number {
  return c.impressions ? Math.round((c.clicks / c.impressions) * 1000) / 10 : 0;
}

async function withAdvertisers(rows: CampaignDocument[]): Promise<CampaignWithAdvertiser[]> {
  const advertisers = await AdvertiserModel.find({
    _id: { $in: [...new Set(rows.map((r) => r.advertiserId))] },
  });
  const nameById = new Map(advertisers.map((a) => [a._id, a.name]));

  return rows.map((r) => ({
    ...asContract<Campaign>(r),
    advertiserName: nameById.get(r.advertiserId) ?? 'Unknown partner',
    ctr: ctrOf(r),
  }));
}

export async function listCampaigns(
  query: PageQuery & { status?: CampaignStatus; advertiserId?: string },
): Promise<PageResult<CampaignWithAdvertiser>> {
  const resolved = resolvePage(query);
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.advertiserId) filter.advertiserId = query.advertiserId;

  const rx = searchRegex(query.q);
  if (rx) filter.$or = [{ name: rx }, { 'creative.headline': rx }];

  const [rows, total] = await Promise.all([
    CampaignModel.find(filter)
      .sort(sortSpec(query, CAMPAIGN_SORTABLE, { createdAt: -1 }))
      .skip(resolved.skip)
      .limit(resolved.limit),
    CampaignModel.countDocuments(filter),
  ]);

  return pageResult(await withAdvertisers(rows), total, resolved);
}

export async function getCampaign(id: string): Promise<CampaignWithAdvertiser> {
  const doc = await CampaignModel.findById(id);
  if (!doc) throw new HttpError(404, ERROR.NOT_FOUND, 'No such campaign.');

  const [withName] = await withAdvertisers([doc]);
  const daily = await CampaignStatModel.find({ campaignId: id }).sort({ date: 1 });
  return { ...withName!, daily: daily.map((d) => asContract<CampaignStat>(d)) };
}

export async function createCampaign(
  input: CreateCampaignInput,
  actor: UserDocument,
  req?: Request,
): Promise<CampaignWithAdvertiser> {
  const advertiser = await AdvertiserModel.findById(input.advertiserId);
  if (!advertiser) throw new HttpError(404, ERROR.NOT_FOUND, 'No such advertiser.');

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (endAt.getTime() <= startAt.getTime()) {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'endAt must be after startAt.');
  }

  const now = new Date();
  const doc = await CampaignModel.create({
    _id: newId(),
    advertiserId: input.advertiserId,
    name: input.name.trim(),
    status: 'draft',
    creative: {
      ...input.creative,
      // Every card says who paid for it, whether or not the partner supplied
      // wording. A promoted card that is indistinguishable from a mosque's own
      // post is the failure mode this whole feature has to avoid.
      disclosure: input.creative.disclosure?.trim() || `Paid partnership · ${advertiser.name}`,
    },
    targeting: {
      cities: input.targeting?.cities ?? [],
      mosqueIds: input.targeting?.mosqueIds ?? [],
      interests: input.targeting?.interests ?? [],
      placements: input.targeting?.placements?.length ? input.targeting.placements : ['feed'],
    },
    startAt,
    endAt,
    budgetCents: input.budgetCents,
    pricing: input.pricing ?? 'flat',
    rateCents: input.rateCents ?? 0,
    currency: 'CAD',
    impressions: 0,
    clicks: 0,
    spentCents: 0,
    createdBy: actor._id,
    createdAt: now,
    updatedAt: now,
  });

  await audit.record(
    actor,
    {
      action: 'campaign.created',
      targetType: 'campaign',
      targetId: doc._id,
      summary: `Created campaign "${doc.name}" for ${advertiser.name}`,
      meta: { advertiserId: advertiser._id, budgetCents: input.budgetCents },
    },
    req,
  );
  return getCampaign(doc._id);
}

export async function updateCampaign(
  id: string,
  patch: UpdateCampaignInput,
  actor: UserDocument,
  req?: Request,
): Promise<CampaignWithAdvertiser> {
  const doc = await CampaignModel.findById(id);
  if (!doc) throw new HttpError(404, ERROR.NOT_FOUND, 'No such campaign.');

  if (patch.name !== undefined) doc.name = patch.name.trim();
  if (patch.creative) doc.creative = { ...doc.creative, ...patch.creative };
  if (patch.targeting) doc.targeting = { ...doc.targeting, ...patch.targeting };
  if (patch.startAt) doc.startAt = new Date(patch.startAt);
  if (patch.endAt) doc.endAt = new Date(patch.endAt);
  if (patch.budgetCents !== undefined) doc.budgetCents = patch.budgetCents;
  if (patch.pricing !== undefined) doc.pricing = patch.pricing;
  if (patch.rateCents !== undefined) doc.rateCents = patch.rateCents;

  if (doc.endAt.getTime() <= doc.startAt.getTime()) {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'endAt must be after startAt.');
  }

  // The budget or the rate moving changes what has been consumed, so the
  // derived total is recomputed rather than left at whatever it was.
  doc.spentCents = campaignSpentCents(doc);
  doc.updatedAt = new Date();
  await doc.save();

  await audit.record(
    actor,
    {
      action: 'campaign.updated',
      targetType: 'campaign',
      targetId: doc._id,
      summary: `Updated campaign "${doc.name}"`,
      meta: { fields: Object.keys(patch) },
    },
    req,
  );
  return getCampaign(id);
}

/**
 * Move a campaign through its lifecycle.
 *
 * The legal moves are in `CAMPAIGN_TRANSITIONS` in the contract, and they are
 * checked **here** rather than in the dashboard. A status field a client can
 * set freely is one where a stale tab resurrects a finished flight.
 */
export async function setCampaignStatus(
  id: string,
  status: CampaignStatus,
  reason: string | undefined,
  actor: UserDocument,
  req?: Request,
): Promise<CampaignWithAdvertiser> {
  const doc = await CampaignModel.findById(id);
  if (!doc) throw new HttpError(404, ERROR.NOT_FOUND, 'No such campaign.');

  const allowed = CAMPAIGN_TRANSITIONS[doc.status];
  if (!allowed.includes(status)) {
    throw new HttpError(
      400,
      ERROR.VALIDATION_ERROR,
      `A ${doc.status} campaign cannot become ${status}.`,
    );
  }

  const previous = doc.status;
  doc.status = status;
  if (status === 'active') {
    doc.approvedBy = actor._id;
    doc.approvedAt = new Date();
    doc.rejectionReason = undefined;
  }
  if (status === 'rejected') doc.rejectionReason = reason;
  doc.updatedAt = new Date();
  await doc.save();

  await audit.record(
    actor,
    {
      action: `campaign.${status}`,
      targetType: 'campaign',
      targetId: doc._id,
      summary: `Campaign "${doc.name}": ${previous} → ${status}${reason ? ` (${reason})` : ''}`,
      meta: { previous, status, reason },
    },
    req,
  );
  return getCampaign(id);
}

// ─── Delivery ───────────────────────────────────────────────────────────────

export interface AdRequest {
  placement: AdPlacement;
  /** The city the reader is browsing, as the app already knows it. */
  city?: string;
  /** Set on a mosque profile or a post detail. */
  mosqueId?: string;
  /** The reader's declared interests — from their own account, never inferred. */
  interests: string[];
  limit?: number;
}

/**
 * The ads to show, at most `limit` of them.
 *
 * The date-and-status window is an indexed Mongo query; targeting is matched in
 * memory afterwards, because the candidate set is a handful of rows and four
 * array-intersection filters in a query would need an index per axis to be
 * worth anything.
 *
 * A campaign that has spent its budget stops serving here rather than being
 * switched off by a job — that way it stops the moment the counter crosses,
 * with nothing scheduled to go wrong overnight.
 */
export async function serveAds(request: AdRequest): Promise<ServedAd[]> {
  const now = new Date();
  const candidates = await CampaignModel.find({
    status: 'active',
    startAt: { $lte: now },
    endAt: { $gte: now },
  });

  // The mosque's city, when the placement is one. Saves the app from having to
  // know a mosque's city to ask for an ad on its profile.
  let city = request.city;
  if (!city && request.mosqueId) {
    const mosque = await MosqueModel.findById(request.mosqueId);
    if (mosque) city = mosqueCityId(mosque);
  }

  const matching = candidates.filter((c) => {
    if (c.spentCents >= c.budgetCents && c.budgetCents > 0) return false;
    if (!c.targeting.placements.includes(request.placement)) return false;

    // Empty means "no restriction on this axis" — which is why an absent and
    // an empty list behave identically, and why the check is on length first.
    if (c.targeting.cities.length && (!city || !c.targeting.cities.includes(city))) return false;
    if (
      c.targeting.mosqueIds.length &&
      (!request.mosqueId || !c.targeting.mosqueIds.includes(request.mosqueId))
    ) {
      return false;
    }
    if (
      c.targeting.interests.length &&
      !c.targeting.interests.some((i) => request.interests.includes(i))
    ) {
      return false;
    }
    return true;
  });

  const advertisers = await AdvertiserModel.find({
    _id: { $in: [...new Set(matching.map((c) => c.advertiserId))] },
    status: 'active',
  });
  const nameById = new Map(advertisers.map((a) => [a._id, a.name]));

  return (
    matching
      // A paused partner takes its whole book of campaigns with it, without
      // anyone having to remember to pause each one.
      .filter((c) => nameById.has(c.advertiserId))
      // Least-served first, so a flight that has barely run catches up rather
      // than the same card winning every slot for a month.
      .sort((a, b) => a.impressions - b.impressions)
      .slice(0, Math.min(request.limit ?? 1, 5))
      .map((c) => ({
        campaignId: c._id,
        advertiserName: nameById.get(c.advertiserId)!,
        placement: request.placement,
        headline: c.creative.headline,
        body: c.creative.body,
        imageUrl: c.creative.imageUrl,
        ctaLabel: c.creative.ctaLabel,
        ctaUrl: c.creative.ctaUrl,
        disclosure: c.creative.disclosure ?? `Paid partnership · ${nameById.get(c.advertiserId)}`,
      }))
  );
}

/**
 * Count an impression or a click.
 *
 * Two writes, both `$inc` and neither of which reads first: the lifetime
 * counters on the campaign, and the row for today. Concurrent calls are safe
 * because `$inc` is atomic — which matters, since this is the one endpoint in
 * the API that fires on every feed render.
 *
 * `spentCents` is recomputed from the counters afterwards rather than
 * incremented alongside them, so it can never drift from the numbers it is
 * derived from.
 */
export async function recordAdEvent(
  campaignId: string,
  kind: 'impression' | 'click',
): Promise<void> {
  const field = kind === 'click' ? 'clicks' : 'impressions';
  const campaign = await CampaignModel.findOneAndUpdate(
    { _id: campaignId, status: 'active' },
    { $inc: { [field]: 1 } },
    { new: true },
  );
  // Silently ignored rather than a 404: a phone that rendered a card a second
  // before the campaign was paused is not a client error, and there is no
  // screen on the other end that could do anything with the failure.
  if (!campaign) return;

  const date = new Date().toISOString().slice(0, 10);
  const spent = campaignSpentCents(campaign);
  const deltaCents = Math.max(0, spent - campaign.spentCents);

  await Promise.all([
    CampaignModel.updateOne({ _id: campaignId }, { $set: { spentCents: spent } }),
    CampaignStatModel.updateOne(
      { _id: `${campaignId}:${date}` },
      {
        $inc: { [field]: 1, spentCents: deltaCents },
        $setOnInsert: { campaignId, date },
      },
      { upsert: true },
    ),
  ]);
}
