import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  BillingInterval,
  CheckoutLink,
  IssuedCredential,
  PayoutAccountStatus,
  Subscription,
} from '@m-ensemble/shared';
import { SOCIAL_LABEL, socialLinks } from '@m-ensemble/shared';
import { api } from '@/api';
import { useWriteGuard } from '@/auth';
import {
  Async,
  Badge,
  Card,
  DataTable,
  Field,
  Modal,
  PageHeader,
  useAction,
  useAsync,
  type Tone,
} from '@/ui';
import { LineChart, StatTile, type Series } from '@/ui/charts';
import { CredentialIssued } from '@/pages/CredentialIssued';
import {
  CollectionBadge,
  StripeInvoiceBadge,
  SubscriptionActions,
} from '@/pages/billing/SubscriptionActions';
import {
  count,
  date,
  dayLabel,
  dateTime,
  humanise,
  money,
  percent,
  priceLabel,
  relative,
} from '@/lib/format';
import { openInNewTab, viaStripe } from '@/lib/stripe';

/**
 * One mosque, in full: how it is doing, who runs it, what it owes, what it has
 * published.
 *
 * This is the screen someone opens before ringing a mosque, so it answers the
 * questions that call is about — is anyone using it, are they paid up, who do I
 * actually speak to.
 */

const ACTIVITY: Series[] = [
  { key: 'signups', label: 'Signups', slot: 0 },
  { key: 'checkIns', label: 'Check-ins', slot: 1 },
  { key: 'posts', label: 'Posts', slot: 2 },
];

const SUB_TONE: Record<string, Tone> = {
  active: 'good',
  trialing: 'warning',
  past_due: 'critical',
  cancelled: 'neutral',
};

export function MosqueDetail(): React.JSX.Element {
  const { id = '' } = useParams();
  const state = useAsync(() => api.mosque(id), [id]);
  const [issuing, setIssuing] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [credential, setCredential] = useState<IssuedCredential>();
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();

  return (
    <Async state={state}>
      {(data) => (
        <>
          <PageHeader
            crumb="Mosques"
            title={data.mosque.name}
            subtitle={`${data.mosque.address} · ${data.summary.city} · join code ${data.mosque.joinCode}`}
            actions={
              <div className="row">
                <button
                  className="btn"
                  disabled={!canWrite}
                  title={reason}
                  onClick={() => setPlanOpen(true)}
                >
                  Change price
                </button>
                <button
                  className="btn primary"
                  disabled={!canWrite}
                  title={reason}
                  onClick={() => setIssuing(true)}
                >
                  Issue credentials
                </button>
              </div>
            }
          />

          <div className="stack">
            {!data.summary.operated && (
              <div className="alert warning">
                <div>
                  <b>Nobody runs this mosque yet.</b>
                  It is a directory listing — browsable and followable, with no coordinator and no
                  posts. Issue credentials to hand it to someone.
                </div>
              </div>
            )}

            <div className="grid cols-4">
              <StatTile label="Followers" value={count(data.summary.followerCount)} />
              <StatTile
                label="Posts"
                value={count(data.summary.postCount)}
                deltaLabel={`${data.summary.livePostCount} live now`}
              />
              <StatTile
                label="Signups"
                value={count(data.summary.signupCount)}
                deltaLabel={`${percent(data.summary.attendanceRate)} attendance`}
              />
              <StatTile
                label="Owing"
                value={money(data.summary.outstandingCents)}
                tone="down-good"
                deltaLabel={
                  data.subscription
                    ? priceLabel(data.subscription.priceCents, data.subscription.interval)
                    : 'No subscription'
                }
              />
            </div>

            <div className="grid split">
              <Card title="Activity, last 30 days">
                <LineChart
                  points={data.daily.map((day) => ({
                    label: dayLabel(day.date),
                    values: { signups: day.signups, checkIns: day.checkIns, posts: day.posts },
                  }))}
                  series={ACTIVITY}
                  height={200}
                />
              </Card>

              <div className="stack">
                <Card title="Subscription">
                  {data.subscription ? (
                    <dl className="kv">
                      <dt>Status</dt>
                      <dd>
                        <Badge tone={SUB_TONE[data.subscription.status] ?? 'neutral'}>
                          {data.subscription.status.replace('_', ' ')}
                        </Badge>
                      </dd>
                      <dt>Price</dt>
                      <dd className="num">
                        {money(data.subscription.priceCents)} /{' '}
                        {data.subscription.interval === 'yearly' ? 'year' : 'month'}
                      </dd>
                      <dt>Renews</dt>
                      <dd>{date(data.subscription.currentPeriodEnd)}</dd>
                      <dt>Collected</dt>
                      <dd>
                        <CollectionBadge collection={data.subscription.collection} />
                        {data.subscription.province && (
                          <span className="muted"> · tax {data.subscription.province}</span>
                        )}
                      </dd>
                      {data.subscription.lastStripeInvoiceStatus && (
                        <>
                          <dt>Last Stripe invoice</dt>
                          <dd>
                            <StripeInvoiceBadge
                              status={data.subscription.lastStripeInvoiceStatus}
                            />
                          </dd>
                        </>
                      )}
                      {data.subscription.note && (
                        <>
                          <dt>Note</dt>
                          <dd>{data.subscription.note}</dd>
                        </>
                      )}
                    </dl>
                  ) : (
                    <p className="muted">No subscription on record.</p>
                  )}
                  {/* The same three buttons as the billing table, so collecting
                      from the mosque you are already looking at is not a trip
                      to another screen and a search for its row. */}
                  {data.subscription && (
                    <div style={{ marginTop: 14 }}>
                      <SubscriptionActions
                        subscription={data.subscription}
                        onChanged={state.reload}
                        size="sm"
                      />
                    </div>
                  )}
                </Card>

                <PayoutsCard mosqueId={id} payouts={data.payouts} onChanged={state.reload} />

                <Card title="Contact">
                  <dl className="kv">
                    <dt>Phone</dt>
                    <dd>{data.mosque.phone ?? <span className="muted">—</span>}</dd>
                    <dt>Website</dt>
                    <dd>
                      {data.mosque.website ? (
                        <a
                          href={`https://${data.mosque.website}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{ color: 'var(--brand)' }}
                        >
                          {data.mosque.website}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </dd>
                    {/*
                      The mosque's own pages. Read-only here — a coordinator
                      edits these from the app, and this screen is the one
                      someone reads before ringing them, so knowing where else
                      the mosque publishes belongs beside the phone number.
                    */}
                    <dt>Social</dt>
                    <dd>
                      {socialLinks(data.mosque.social).length ? (
                        <span className="social-links">
                          {socialLinks(data.mosque.social).map(({ platform, url }) => (
                            <a
                              key={platform}
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                              style={{ color: 'var(--brand)' }}
                            >
                              {SOCIAL_LABEL[platform]}
                            </a>
                          ))}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </dd>
                    <dt>Timezone</dt>
                    <dd>{data.mosque.timezone ?? '—'}</dd>
                    <dt>Onboarded</dt>
                    <dd>
                      {data.summary.createdAt ? date(data.summary.createdAt) : 'Before records'}
                    </dd>
                  </dl>
                </Card>
              </div>
            </div>

            <Card title={`Coordinators (${data.coordinators.length})`} padded={false}>
              <DataTable
                columns={[
                  {
                    key: 'name',
                    header: 'Name',
                    render: (row) => (
                      <Link to={`/users/${row.userId}`} className="cell-main">
                        {row.name}
                      </Link>
                    ),
                  },
                  { key: 'email', header: 'Email', render: (row) => row.email },
                  { key: 'joinedAt', header: 'Since', render: (row) => date(row.joinedAt) },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (row) => (
                      <button
                        className="btn danger sm"
                        disabled={!canWrite || busy}
                        title={reason}
                        onClick={() =>
                          run(
                            () => api.revokeCoordinator(id, row.userId).then(state.reload),
                            `${row.name} is no longer a coordinator here.`,
                          )
                        }
                      >
                        Revoke
                      </button>
                    ),
                  },
                ]}
                rows={data.coordinators}
                empty="Nobody coordinates this mosque."
              />
            </Card>

            <div className="grid cols-2">
              <Card title="Recent posts" padded={false}>
                <DataTable
                  columns={[
                    {
                      key: 'title',
                      header: 'Post',
                      render: (row) => (
                        <>
                          <div className="cell-main">{row.title}</div>
                          <div className="cell-sub">
                            {row.type} · {date(row.startAt)}
                          </div>
                        </>
                      ),
                    },
                    {
                      key: 'signupCount',
                      header: 'Signups',
                      align: 'right',
                      render: (row) => count(row.signupCount),
                    },
                    {
                      key: 'state',
                      header: '',
                      render: (row) =>
                        row.cancelledAt ? <Badge tone="critical">Cancelled</Badge> : null,
                    },
                  ]}
                  rows={data.recentPosts}
                  empty="Nothing published yet."
                />
              </Card>

              <Card title="Invoices" padded={false}>
                <DataTable
                  columns={[
                    {
                      key: 'number',
                      header: 'Invoice',
                      render: (row) => (
                        <Link to={`/billing/invoices/${row._id}`} className="cell-main mono">
                          {row.number}
                        </Link>
                      ),
                    },
                    { key: 'issuedAt', header: 'Issued', render: (row) => date(row.issuedAt) },
                    {
                      key: 'totalCents',
                      header: 'Total',
                      align: 'right',
                      render: (row) => money(row.totalCents),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (row) => (
                        <Badge
                          tone={
                            row.status === 'paid'
                              ? 'good'
                              : row.status === 'open'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {row.status}
                        </Badge>
                      ),
                    },
                  ]}
                  rows={data.invoices}
                  empty="No invoices."
                />
              </Card>
            </div>

            <Card
              title="Donations"
              padded={false}
              actions={
                <span className="muted">
                  Paid to the mosque’s own Stripe account; our fee is kept.
                </span>
              }
            >
              <DataTable
                columns={[
                  { key: 'createdAt', header: 'Date', render: (row) => date(row.createdAt) },
                  {
                    key: 'donorName',
                    header: 'Donor',
                    render: (row) => row.donorName ?? <span className="muted">Anonymous</span>,
                  },
                  {
                    key: 'amountCents',
                    header: 'Amount',
                    align: 'right',
                    render: (row) => money(row.amountCents),
                  },
                  {
                    key: 'feeCents',
                    header: 'Our fee',
                    align: 'right',
                    render: (row) => <span className="muted">{money(row.feeCents)}</span>,
                  },
                  {
                    key: 'netCents',
                    header: 'To the mosque',
                    align: 'right',
                    render: (row) => money(row.netCents),
                  },
                  {
                    key: 'payoutAt',
                    header: 'Paid out',
                    render: (row) =>
                      row.payoutAt ? (
                        <span className="muted">{relative(row.payoutAt)}</span>
                      ) : (
                        <Badge tone="warning">Owed</Badge>
                      ),
                  },
                ]}
                rows={data.donations}
                empty="No donations recorded."
              />
            </Card>
          </div>

          {issuing && (
            <IssueDialog
              mosqueId={id}
              onClose={() => setIssuing(false)}
              onIssued={(issued) => {
                setIssuing(false);
                setCredential(issued);
                state.reload();
              }}
            />
          )}

          {planOpen && (
            <PriceDialog
              mosqueId={id}
              current={data.subscription}
              onClose={() => setPlanOpen(false)}
              onSaved={() => {
                setPlanOpen(false);
                state.reload();
              }}
            />
          )}

          {credential && (
            <CredentialIssued credential={credential} onClose={() => setCredential(undefined)} />
          )}
        </>
      )}
    </Async>
  );
}

/**
 * Where the mosque's donation money goes.
 *
 * A mosque receives donations through its own Stripe Connect account, which the
 * mosque — not us — sets up, on Stripe's hosted form. The console's job is to
 * start that, hand over the link, and afterwards read back where Stripe says
 * the account stands. The three flags are shown separately because they turn
 * on separately: a mosque can be accepting charges for a week before Stripe
 * has verified the bank account it pays out to.
 */
function PayoutsCard({
  mosqueId,
  payouts,
  onChanged,
}: {
  mosqueId: string;
  payouts: PayoutAccountStatus | null;
  onChanged: () => void;
}): React.JSX.Element {
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();
  const [blocked, setBlocked] = useState<CheckoutLink>();

  const onboard = () =>
    run(async () => {
      const link = await viaStripe(() => api.payoutsOnboard(mosqueId));
      // Popup blockers can refuse a tab opened after an `await`. Keep the link
      // on screen rather than losing it — it was minted for this click.
      if (!openInNewTab(link.url)) setBlocked(link);
      onChanged();
    });

  const refresh = () =>
    run(
      () => viaStripe(() => api.payoutsRefresh(mosqueId)).then(onChanged),
      'Payout status refreshed.',
    );

  const flag = (on: boolean, label: string) => (
    <Badge tone={on ? 'good' : 'warning'}>
      {label}: {on ? 'yes' : 'not yet'}
    </Badge>
  );

  return (
    <Card
      title="Payouts (donations)"
      actions={
        payouts ? (
          <div className="row" style={{ gap: 6 }}>
            <button
              className="btn sm"
              disabled={!canWrite || busy}
              title={reason}
              onClick={refresh}
            >
              Refresh status
            </button>
            <button
              className="btn sm"
              disabled={!canWrite || busy}
              title={reason}
              onClick={onboard}
            >
              Continue onboarding
            </button>
          </div>
        ) : undefined
      }
    >
      {payouts ? (
        <>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {flag(payouts.chargesEnabled, 'Charges')}
            {flag(payouts.payoutsEnabled, 'Payouts')}
            {flag(payouts.detailsSubmitted, 'Details submitted')}
          </div>
          <dl className="kv">
            <dt>Stripe account</dt>
            <dd className="mono">{payouts.stripeAccountId}</dd>
            <dt>Stripe still needs</dt>
            <dd>
              {payouts.requirementsDue.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {payouts.requirementsDue.map((item) => (
                    // Stripe's requirement keys are dotted paths like
                    // `individual.verification.document`. Readable enough once
                    // the dots become spaces; a translation table would rot.
                    <li key={item} className="mono">
                      {humanise(item.replace(/\./g, ' '))}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="muted">Nothing — the account is complete.</span>
              )}
            </dd>
            <dt>Last checked</dt>
            <dd>{dateTime(payouts.updatedAt)}</dd>
          </dl>
          {payouts.requirementsDue.length > 0 && (
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
              <strong>Continue onboarding</strong> opens Stripe’s form where the mosque supplies
              what is missing. Send them the tab, or walk them through it on a call.
            </p>
          )}
        </>
      ) : (
        <>
          <p style={{ marginTop: 0 }} className="muted">
            This mosque cannot receive donations yet. Donations go straight to a Stripe account the
            mosque owns — we never hold the money — and setting one up is a form on Stripe’s side
            that asks for the mosque’s legal details and bank account.
          </p>
          <button
            className="btn primary"
            disabled={!canWrite || busy}
            title={reason}
            onClick={onboard}
          >
            {busy ? 'Starting…' : 'Start Stripe onboarding'}
          </button>
        </>
      )}

      {blocked && (
        <Modal
          title="Stripe onboarding"
          onClose={() => setBlocked(undefined)}
          footer={
            <>
              <button className="btn" onClick={() => setBlocked(undefined)}>
                Close
              </button>
              <a
                className="btn primary"
                style={{ textDecoration: 'none' }}
                href={blocked.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => setBlocked(undefined)}
              >
                Open the form
              </a>
            </>
          }
        >
          <p style={{ marginTop: 0 }} className="muted">
            Your browser blocked the new tab. The link is below — it works once and expires within
            minutes, so open it now or mint another.
            {blocked.expiresAt && <> It stops working {dateTime(blocked.expiresAt)}.</>}
          </p>
          <div className="credential">{blocked.url}</div>
        </Modal>
      )}
    </Card>
  );
}

/**
 * Mint or reset the coordinator account.
 *
 * The dialog is explicit that an email which already has an account keeps its
 * existing password and simply gains the role — otherwise somebody grants
 * access to a volunteer who has been using the app for a year and assumes the
 * password on the slip is the one that now works.
 */
function IssueDialog({
  mosqueId,
  onClose,
  onIssued,
}: {
  mosqueId: string;
  onClose: () => void;
  onIssued: (credential: IssuedCredential) => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <Modal
      title="Issue coordinator credentials"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || !email.includes('@') || name.trim().length < 2}
            onClick={() =>
              run(async () => {
                const issued = await api.issueCredential(mosqueId, { name, email });
                onIssued(issued);
              })
            }
          >
            {busy ? 'Issuing…' : 'Issue'}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }} className="muted">
        A new email gets a fresh account with a generated password. An email that already has an
        account <strong>keeps the password it has</strong> and simply gains the coordinator role —
        we never reset a password somebody is already using.
      </p>

      <Field label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
    </Modal>
  );
}

/**
 * Set what this mosque is charged.
 *
 * There is no tier to pick — every mosque gets the whole product — so the only
 * decisions are the number, how often, and why. The **why** is the field that
 * matters: a price that disagrees with the standard one is a promise somebody
 * made, and six months later `note` is the only record of who and on what
 * terms.
 *
 * The price is typed in dollars and stored in cents, because a console that
 * asks a human for cents eventually gets billed 4900 dollars.
 */
function PriceDialog({
  mosqueId,
  current,
  onClose,
  onSaved,
}: {
  mosqueId: string;
  /** Null for a mosque nobody has agreed a price with yet. */
  current: Subscription | null;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [dollars, setDollars] = useState(((current?.priceCents ?? 0) / 100).toFixed(2));
  const [interval, setInterval] = useState<BillingInterval>(current?.interval ?? 'monthly');
  const [note, setNote] = useState(current?.note ?? '');

  const amount = Number(dollars);
  const valid = dollars.trim() !== '' && Number.isFinite(amount) && amount >= 0;

  return (
    <Modal
      title={current ? 'Change price' : 'Start billing'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || !valid}
            onClick={() =>
              run(async () => {
                await api.upsertSubscription({
                  mosqueId,
                  priceCents: Math.round(amount * 100),
                  interval,
                  note: note.trim() || undefined,
                });
                onSaved();
              }, 'Price updated.')
            }
          >
            Save
          </button>
        </>
      }
    >
      <Field
        label="Price"
        hint="In dollars. Zero for a waived, sponsored or not-yet-agreed mosque."
      >
        <input
          type="number"
          min="0"
          step="0.01"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
        />
      </Field>
      <Field label="Billed">
        <select value={interval} onChange={(e) => setInterval(e.target.value as BillingInterval)}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </Field>
      <Field
        label="Note"
        hint="Why this mosque pays this — a discount, a sponsor, a pilot. Shows on their record."
      >
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="muted" style={{ fontSize: 12.5 }}>
        This changes what they are billed from the next invoice. It does not charge anything now —
        send a payment link from the Subscription card when they are ready to pay.
      </p>
    </Modal>
  );
}
