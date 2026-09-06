import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CampaignStatus } from '@m-ensemble/shared';
import { api } from '@/api';
import { useWriteGuard } from '@/auth';
import { Async, Badge, Card, Field, Modal, PageHeader, useAction, useAsync } from '@/ui';
import { AreaChart, Meter, StatTile } from '@/ui/charts';
import { CAMPAIGN_TONE } from '@/pages/Campaigns';
import { count, date, dayLabel, humanise, money, percent } from '@/lib/format';

/**
 * One flight: what it looks like, how it is doing, and the buttons that move it
 * through its lifecycle.
 *
 * **Impressions and clicks are two charts, never one.** They differ by two
 * orders of magnitude, and a second y-axis to fit both on one plot would draw a
 * relationship the numbers do not contain — the single most common way a
 * dashboard chart misleads.
 */
export function CampaignDetail(): React.JSX.Element {
  const { id = '' } = useParams();
  const state = useAsync(() => api.campaign(id), [id]);
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();
  const [rejecting, setRejecting] = useState(false);

  const move = (status: CampaignStatus, message: string) =>
    run(() => api.setCampaignStatus(id, status).then(state.reload), message);

  return (
    <Async state={state}>
      {(campaign) => {
        const daily = campaign.daily ?? [];
        const overspent = campaign.spentCents >= campaign.budgetCents && campaign.budgetCents > 0;

        return (
          <>
            <PageHeader
              crumb={`Campaigns · ${campaign.advertiserName}`}
              title={campaign.name}
              subtitle={`${date(campaign.startAt)} → ${date(campaign.endAt)} · ${humanise(campaign.pricing)}${
                campaign.pricing === 'flat' ? '' : ` at ${money(campaign.rateCents)}`
              }`}
              actions={
                <div className="row">
                  {(campaign.status === 'draft' || campaign.status === 'pending') && (
                    <>
                      <button
                        className="btn danger"
                        disabled={!canWrite}
                        title={reason}
                        onClick={() => setRejecting(true)}
                      >
                        Reject
                      </button>
                      <button
                        className="btn primary"
                        disabled={!canWrite || busy}
                        title={reason}
                        onClick={() => move('active', 'Campaign approved — it is live.')}
                      >
                        Approve and run
                      </button>
                    </>
                  )}
                  {campaign.status === 'active' && (
                    <>
                      <button
                        className="btn"
                        disabled={!canWrite || busy}
                        title={reason}
                        onClick={() => move('paused', 'Campaign paused.')}
                      >
                        Pause
                      </button>
                      <button
                        className="btn"
                        disabled={!canWrite || busy}
                        title={reason}
                        onClick={() => move('completed', 'Campaign completed.')}
                      >
                        Complete
                      </button>
                    </>
                  )}
                  {campaign.status === 'paused' && (
                    <button
                      className="btn primary"
                      disabled={!canWrite || busy}
                      title={reason}
                      onClick={() => move('active', 'Campaign resumed.')}
                    >
                      Resume
                    </button>
                  )}
                </div>
              }
            />

            <div className="stack">
              <div className="row">
                <Badge tone={CAMPAIGN_TONE[campaign.status] ?? 'neutral'}>{campaign.status}</Badge>
                {campaign.approvedAt && (
                  <span className="muted">Approved {date(campaign.approvedAt)}</span>
                )}
                {campaign.rejectionReason && (
                  <span className="muted">Rejected: {campaign.rejectionReason}</span>
                )}
              </div>

              {campaign.status === 'pending' && (
                <div className="alert warning">
                  <div>
                    <b>Waiting for approval.</b>
                    Nothing is being served. Read the card below as a member would see it before
                    approving — it goes into the feed beside a mosque&apos;s own posts.
                  </div>
                </div>
              )}

              {overspent && campaign.status === 'active' && (
                <div className="alert critical">
                  <div>
                    <b>Budget spent.</b>
                    Delivery stops on its own at the budget, so this is no longer being served.
                    Raise the budget or complete the flight.
                  </div>
                </div>
              )}

              <div className="grid cols-4">
                <StatTile
                  label="Impressions"
                  value={count(campaign.impressions)}
                  spark={daily.map((d) => d.impressions)}
                />
                <StatTile
                  label="Clicks"
                  value={count(campaign.clicks)}
                  spark={daily.map((d) => d.clicks)}
                />
                <StatTile
                  label="Click-through rate"
                  value={campaign.impressions ? percent(campaign.ctr, 1) : '—'}
                  deltaLabel="clicks ÷ impressions"
                />
                <StatTile
                  label="Spent"
                  value={money(campaign.spentCents)}
                  deltaLabel={`of ${money(campaign.budgetCents)}`}
                  tone="down-good"
                />
              </div>

              <Card title="Budget">
                <Meter
                  label="Consumed"
                  value={campaign.spentCents}
                  max={campaign.budgetCents}
                  format={money}
                  tone={
                    overspent
                      ? 'critical'
                      : campaign.spentCents / (campaign.budgetCents || 1) > 0.8
                        ? 'warning'
                        : 'default'
                  }
                />
              </Card>

              {daily.length > 0 && (
                <div className="grid cols-2">
                  <Card title="Impressions per day">
                    <AreaChart
                      points={daily.map((d) => ({ label: dayLabel(d.date), value: d.impressions }))}
                      label="Impressions"
                      slot={0}
                    />
                  </Card>
                  <Card title="Clicks per day">
                    <AreaChart
                      points={daily.map((d) => ({ label: dayLabel(d.date), value: d.clicks }))}
                      label="Clicks"
                      slot={1}
                    />
                  </Card>
                </div>
              )}

              <div className="grid split">
                <Card title="The card, as a member sees it">
                  <CreativePreview
                    headline={campaign.creative.headline}
                    body={campaign.creative.body}
                    imageUrl={campaign.creative.imageUrl}
                    ctaLabel={campaign.creative.ctaLabel}
                    disclosure={
                      campaign.creative.disclosure ??
                      `Paid partnership · ${campaign.advertiserName}`
                    }
                  />
                  <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
                    Links to{' '}
                    <a
                      href={campaign.creative.ctaUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{ color: 'var(--brand)' }}
                    >
                      {campaign.creative.ctaUrl}
                    </a>
                  </p>
                </Card>

                <Card title="Targeting">
                  <dl className="kv">
                    <dt>Cities</dt>
                    <dd>
                      {campaign.targeting.cities.length
                        ? campaign.targeting.cities.map(humanise).join(', ')
                        : 'Everywhere'}
                    </dd>
                    <dt>Mosques</dt>
                    <dd>
                      {campaign.targeting.mosqueIds.length
                        ? `${campaign.targeting.mosqueIds.length} selected`
                        : 'All mosques'}
                    </dd>
                    <dt>Interests</dt>
                    <dd>
                      {campaign.targeting.interests.length
                        ? campaign.targeting.interests.join(', ')
                        : 'Anyone'}
                    </dd>
                    <dt>Placements</dt>
                    <dd>{campaign.targeting.placements.map(humanise).join(', ')}</dd>
                  </dl>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
                    Targeting reads a member&apos;s city and the interests they set themselves.
                    Nothing is inferred from behaviour, and no identifier for a reader is ever sent
                    to the partner.
                  </p>
                </Card>
              </div>
            </div>

            {rejecting && (
              <Modal
                title="Reject this campaign"
                onClose={() => setRejecting(false)}
                footer={
                  <RejectFooter
                    id={id}
                    onCancel={() => setRejecting(false)}
                    onDone={() => {
                      setRejecting(false);
                      state.reload();
                    }}
                  />
                }
              >
                <p style={{ marginTop: 0 }}>
                  The reason is kept on the campaign and in the audit log, so whoever talks to the
                  partner next knows what was said.
                </p>
              </Modal>
            )}
          </>
        );
      }}
    </Async>
  );
}

/**
 * What the member's feed will show.
 *
 * A real preview rather than a description, because approving a card without
 * seeing it is how something lands in a mosque's feed that nobody would have
 * approved on sight.
 */
function CreativePreview({
  headline,
  body,
  imageUrl,
  ctaLabel,
  disclosure,
}: {
  headline: string;
  body: string;
  imageUrl?: string;
  ctaLabel: string;
  disclosure: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 14,
        background: 'var(--surface-2)',
        maxWidth: 380,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          marginBottom: 7,
        }}
      >
        {disclosure}
      </div>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: '16 / 9',
            objectFit: 'cover',
            borderRadius: 8,
            marginBottom: 10,
          }}
        />
      ) : null}
      <div style={{ fontWeight: 650, fontSize: 15, marginBottom: 4 }}>{headline}</div>
      <div style={{ color: 'var(--ink-2)', marginBottom: 12 }}>{body}</div>
      <span className="btn sm primary" style={{ pointerEvents: 'none' }}>
        {ctaLabel}
      </span>
    </div>
  );
}

function RejectFooter({
  id,
  onCancel,
  onDone,
}: {
  id: string;
  onCancel: () => void;
  onDone: () => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [reason, setReason] = useState('');

  return (
    <div style={{ width: '100%' }}>
      <Field label="Reason">
        <input
          type="text"
          value={reason}
          placeholder="Creative overpromises; asked for a rewrite"
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn danger"
          disabled={busy || reason.trim().length < 3}
          onClick={() =>
            run(async () => {
              await api.setCampaignStatus(id, 'rejected', reason);
              onDone();
            }, 'Campaign rejected.')
          }
        >
          Reject
        </button>
      </div>
    </div>
  );
}
