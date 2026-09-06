import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { IssuedCredential, PlanId } from '@m-ensemble/shared';
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
import { CredentialSlip } from '@/pages/CredentialSlip';
import { PLAN_LABELS, count, date, dayLabel, money, percent, relative } from '@/lib/format';

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
                  Change plan
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
                    ? `${PLAN_LABELS[data.subscription.plan]} · ${money(data.subscription.priceCents)}/mo`
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
                      <dt>Plan</dt>
                      <dd>
                        <Badge tone={data.subscription.plan === 'free' ? 'neutral' : 'brand'}>
                          {PLAN_LABELS[data.subscription.plan]}
                        </Badge>
                      </dd>
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
                </Card>

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
                <span className="muted">Recorded, not processed — no card is charged here.</span>
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

          {planOpen && data.subscription && (
            <PlanDialog
              mosqueId={id}
              current={data.subscription.plan}
              onClose={() => setPlanOpen(false)}
              onSaved={() => {
                setPlanOpen(false);
                state.reload();
              }}
            />
          )}

          {credential && (
            <CredentialSlip credential={credential} onClose={() => setCredential(undefined)} />
          )}
        </>
      )}
    </Async>
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

function PlanDialog({
  mosqueId,
  current,
  onClose,
  onSaved,
}: {
  mosqueId: string;
  current: PlanId;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [plan, setPlan] = useState<PlanId>(current);
  const [note, setNote] = useState('');

  return (
    <Modal
      title="Change plan"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.upsertSubscription({ mosqueId, plan, note: note || undefined });
                onSaved();
              }, 'Plan updated.')
            }
          >
            Save
          </button>
        </>
      }
    >
      <Field label="Plan">
        <select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
          <option value="free">Free — $0</option>
          <option value="standard">Standard — $49/mo</option>
          <option value="pro">Pro — $129/mo</option>
        </select>
      </Field>
      <Field
        label="Note"
        hint="Why this mosque is on this plan — a discount, a sponsor, a pilot. Shows on their record."
      >
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="muted" style={{ fontSize: 12.5 }}>
        This changes what they are billed from the next invoice. It does not charge anything now —
        no payment processor is connected.
      </p>
    </Modal>
  );
}
