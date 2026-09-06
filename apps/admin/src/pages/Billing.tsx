import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CreateInvoiceInput, Invoice } from '@m-ensemble/shared';
import { api } from '@/api';
import { useWriteGuard } from '@/auth';
import {
  Async,
  Badge,
  Card,
  DataTable,
  Field,
  FilterSelect,
  Modal,
  PageHeader,
  Pager,
  useAction,
  useAsync,
  useListState,
  type Tone,
} from '@/ui';
import { RampBars, StackedBars, StatTile, type Series } from '@/ui/charts';
import { PLAN_LABELS, date, money, monthLabel, relative } from '@/lib/format';

/**
 * The money screen — all three flows in one place.
 *
 * **Nothing here charges anybody.** No payment processor is connected: invoices
 * are issued, payments are recorded by hand, and every status moves because
 * somebody moved it. That is stated on the screen rather than only in the code,
 * because a billing page that looks automated and is not is how a mosque ends
 * up thinking it has paid.
 *
 * Revenue is recognised on the date money **arrived**, not the date it was
 * invoiced — the only version of the number that reconciles against a bank
 * statement.
 */

const REVENUE_SERIES: Series[] = [
  { key: 'subscriptionCents', label: 'Subscriptions', slot: 0 },
  { key: 'campaignCents', label: 'Campaigns', slot: 1 },
  { key: 'donationFeeCents', label: 'Donation fees', slot: 2 },
];

const INVOICE_TONE: Record<string, Tone> = {
  paid: 'good',
  open: 'warning',
  draft: 'neutral',
  void: 'neutral',
  uncollectible: 'critical',
};

type Tab = 'invoices' | 'subscriptions' | 'donations';

export function Billing(): React.JSX.Element {
  const summary = useAsync(() => api.billingSummary(), []);
  const [tab, setTab] = useState<Tab>('invoices');
  const [creating, setCreating] = useState(false);
  const { canWrite, reason } = useWriteGuard();

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Subscriptions, campaign invoices and donation passthrough."
        actions={
          <button
            className="btn primary"
            disabled={!canWrite}
            title={reason}
            onClick={() => setCreating(true)}
          >
            New invoice
          </button>
        }
      />

      <div className="stack">
        <div className="alert">
          <div>
            <b>No payment processor is connected.</b>
            Invoices are issued and payments are recorded by hand. Nothing on this page charges a
            card or moves real money — it records money that moved somewhere else.
          </div>
        </div>

        <Async state={summary}>
          {(data) => (
            <>
              <div className="grid cols-4">
                <StatTile
                  label="Monthly recurring revenue"
                  value={money(data.mrrCents)}
                  deltaLabel={`${money(data.arrCents)} annualised`}
                />
                <StatTile
                  label="Outstanding"
                  value={money(data.outstandingCents)}
                  deltaLabel={
                    data.overdueCents > 0
                      ? `${money(data.overdueCents)} overdue`
                      : 'nothing overdue'
                  }
                  tone="down-good"
                />
                <StatTile
                  label="Collected, last 30 days"
                  value={money(data.collected30dCents)}
                  deltaLabel="payments recorded"
                />
                <StatTile
                  label="Donations, last 30 days"
                  value={money(data.donationVolume30dCents)}
                  deltaLabel={`${money(data.donationFees30dCents)} of it our fee`}
                />
              </div>

              <div className="grid split">
                <Card title="Revenue by month, on the date it arrived">
                  <StackedBars
                    points={data.revenue.map((point) => ({
                      label: monthLabel(point.month),
                      values: {
                        subscriptionCents: point.subscriptionCents,
                        campaignCents: point.campaignCents,
                        donationFeeCents: point.donationFeeCents,
                      },
                    }))}
                    series={REVENUE_SERIES}
                  />
                </Card>

                <Card title="Mosques by plan">
                  <RampBars
                    rows={data.byPlan.map((row) => ({
                      label: PLAN_LABELS[row.plan],
                      value: row.mosques,
                      caption: money(row.mrrCents),
                    }))}
                  />
                </Card>
              </div>
            </>
          )}
        </Async>

        <div className="row">
          {(['invoices', 'subscriptions', 'donations'] as Tab[]).map((key) => (
            <button
              key={key}
              className={`btn ${tab === key ? 'primary' : ''}`}
              onClick={() => setTab(key)}
            >
              {key[0]!.toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'invoices' && <InvoicesTable />}
        {tab === 'subscriptions' && <SubscriptionsTable />}
        {tab === 'donations' && <DonationsTable />}
      </div>

      {creating && (
        <NewInvoiceDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            summary.reload();
          }}
        />
      )}
    </>
  );
}

function InvoicesTable(): React.JSX.Element {
  const navigate = useNavigate();
  const list = useListState({ status: '', kind: '', overdue: '' }, 'issuedAt');
  const state = useAsync(() => api.invoices(list.query), [JSON.stringify(list.query)]);

  return (
    <Card padded={false}>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search by number"
          value={list.q}
          onChange={(event) => list.setQ(event.target.value)}
        />
        <FilterSelect
          label="Status"
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value)}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'open', label: 'Open' },
            { value: 'paid', label: 'Paid' },
            { value: 'void', label: 'Void' },
          ]}
        />
        <FilterSelect
          label="Kind"
          value={list.filters.kind}
          onChange={(value) => list.setFilter('kind', value)}
          options={[
            { value: 'subscription', label: 'Subscription' },
            { value: 'campaign', label: 'Campaign' },
            { value: 'donation_fee', label: 'Donation fee' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={list.filters.overdue === 'true'}
            onChange={(event) => list.setFilter('overdue', event.target.checked ? 'true' : '')}
          />
          Overdue only
        </label>
      </div>

      <Async state={state}>
        {(result) => (
          <>
            <DataTable<Invoice>
              columns={[
                {
                  key: 'number',
                  header: 'Invoice',
                  sortable: true,
                  render: (row) => (
                    <>
                      <div className="cell-main mono">{row.number}</div>
                      <div className="cell-sub">{row.lines[0]?.description}</div>
                    </>
                  ),
                },
                { key: 'kind', header: 'Kind', render: (row) => row.kind.replace('_', ' ') },
                {
                  key: 'issuedAt',
                  header: 'Issued',
                  sortable: true,
                  render: (row) => date(row.issuedAt),
                },
                {
                  key: 'dueAt',
                  header: 'Due',
                  sortable: true,
                  render: (row) =>
                    row.status === 'open' && new Date(row.dueAt) < new Date() ? (
                      <Badge tone="critical">{relative(row.dueAt)}</Badge>
                    ) : (
                      date(row.dueAt)
                    ),
                },
                {
                  key: 'totalCents',
                  header: 'Total',
                  sortable: true,
                  align: 'right',
                  render: (row) => money(row.totalCents),
                },
                {
                  key: 'dueCents',
                  header: 'Owing',
                  sortable: true,
                  align: 'right',
                  render: (row) =>
                    row.dueCents > 0 ? (
                      <strong>{money(row.dueCents)}</strong>
                    ) : (
                      <span className="muted">—</span>
                    ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={INVOICE_TONE[row.status] ?? 'neutral'}>{row.status}</Badge>
                  ),
                },
              ]}
              rows={result.items}
              sort={list.sort}
              dir={list.dir}
              onSort={list.toggleSort}
              onRowClick={(row) => navigate(`/billing/invoices/${row._id}`)}
              empty="No invoice matches those filters."
            />
            <Pager page={list.page} result={result} onPage={list.setPage} />
          </>
        )}
      </Async>
    </Card>
  );
}

function SubscriptionsTable(): React.JSX.Element {
  const state = useAsync(() => api.subscriptions(), []);
  const mosques = useAsync(() => api.mosques({ pageSize: 200 }), []);
  const names = new Map((mosques.data?.items ?? []).map((m) => [m.mosqueId, m.name]));

  return (
    <Card padded={false}>
      <Async state={state}>
        {(rows) => (
          <DataTable
            columns={[
              {
                key: 'mosque',
                header: 'Mosque',
                render: (row) => (
                  <Link to={`/mosques/${row.mosqueId}`} className="cell-main">
                    {names.get(row.mosqueId) ?? row.mosqueId}
                  </Link>
                ),
              },
              {
                key: 'plan',
                header: 'Plan',
                render: (row) => (
                  <Badge tone={row.plan === 'free' ? 'neutral' : 'brand'}>
                    {PLAN_LABELS[row.plan]}
                  </Badge>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge
                    tone={
                      row.status === 'active'
                        ? 'good'
                        : row.status === 'trialing'
                          ? 'warning'
                          : row.status === 'past_due'
                            ? 'critical'
                            : 'neutral'
                    }
                  >
                    {row.status.replace('_', ' ')}
                  </Badge>
                ),
              },
              {
                key: 'priceCents',
                header: 'Price',
                align: 'right',
                render: (row) => (
                  <>
                    {money(row.priceCents)}
                    <span className="muted"> / {row.interval === 'yearly' ? 'yr' : 'mo'}</span>
                  </>
                ),
              },
              {
                key: 'currentPeriodEnd',
                header: 'Renews',
                render: (row) => date(row.currentPeriodEnd),
              },
              {
                key: 'note',
                header: 'Note',
                render: (row) => <span className="cell-sub">{row.note ?? '—'}</span>,
              },
            ]}
            rows={rows}
            empty="No subscriptions."
          />
        )}
      </Async>
    </Card>
  );
}

function DonationsTable(): React.JSX.Element {
  const list = useListState({ status: '', unpaidOut: '' }, 'createdAt');
  const state = useAsync(() => api.donations(list.query), [JSON.stringify(list.query)]);
  const mosques = useAsync(() => api.mosques({ pageSize: 200 }), []);
  const names = new Map((mosques.data?.items ?? []).map((m) => [m.mosqueId, m.name]));
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();

  return (
    <Card padded={false}>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search donor or reference"
          value={list.q}
          onChange={(event) => list.setQ(event.target.value)}
        />
        <FilterSelect
          label="Status"
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value)}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'settled', label: 'Settled' },
            { value: 'refunded', label: 'Refunded' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={list.filters.unpaidOut === 'true'}
            onChange={(event) => list.setFilter('unpaidOut', event.target.checked ? 'true' : '')}
          />
          Owed to a mosque
        </label>
      </div>

      <Async state={state}>
        {(result) => (
          <>
            <DataTable
              columns={[
                { key: 'createdAt', header: 'Date', render: (row) => date(row.createdAt) },
                {
                  key: 'mosque',
                  header: 'Mosque',
                  render: (row) => (
                    <Link to={`/mosques/${row.mosqueId}`}>
                      {names.get(row.mosqueId) ?? row.mosqueId}
                    </Link>
                  ),
                },
                {
                  key: 'donorName',
                  header: 'Donor',
                  render: (row) => row.donorName ?? <span className="muted">Anonymous</span>,
                },
                {
                  key: 'amountCents',
                  header: 'Amount',
                  sortable: true,
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
                  key: 'payout',
                  header: 'Payout',
                  render: (row) =>
                    row.payoutAt ? (
                      <span className="muted">{relative(row.payoutAt)}</span>
                    ) : (
                      <button
                        className="btn sm"
                        disabled={!canWrite || busy || row.status !== 'settled'}
                        title={
                          row.status !== 'settled'
                            ? 'Only a settled donation can be paid out.'
                            : reason
                        }
                        onClick={() =>
                          run(
                            () =>
                              api.updateDonation(row._id, { markPaidOut: true }).then(state.reload),
                            'Marked as paid out.',
                          )
                        }
                      >
                        Mark paid out
                      </button>
                    ),
                },
              ]}
              rows={result.items}
              sort={list.sort}
              dir={list.dir}
              onSort={list.toggleSort}
              empty="No donations match those filters."
            />
            <Pager page={list.page} result={result} onPage={list.setPage} />
          </>
        )}
      </Async>
    </Card>
  );
}

/**
 * Raise an invoice against a mosque or a partner.
 *
 * The payer is exclusive — one or the other, never both, which the server also
 * enforces. Tax is entered in dollars rather than as a rate: GST and QST differ
 * by province and by what is being sold, and a hardcoded rate would be quietly
 * wrong for somebody.
 */
function NewInvoiceDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const mosques = useAsync(() => api.mosques({ pageSize: 200, sort: 'name', dir: 'asc' }), []);
  const advertisers = useAsync(() => api.advertisers({ pageSize: 200 }), []);
  const { busy, run } = useAction();

  const [kind, setKind] = useState<CreateInvoiceInput['kind']>('subscription');
  const [payerId, setPayerId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [tax, setTax] = useState('');
  const [dueInDays, setDueInDays] = useState('30');
  const [issue, setIssue] = useState(true);

  const againstMosque = kind === 'subscription' || kind === 'donation_fee';
  const dollars = Number(amount) || 0;
  const taxDollars = Number(tax) || 0;

  return (
    <Modal
      title="New invoice"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || !payerId || dollars <= 0 || description.trim().length < 2}
            onClick={() =>
              run(async () => {
                await api.createInvoice({
                  kind,
                  mosqueId: againstMosque ? payerId : undefined,
                  advertiserId: againstMosque ? undefined : payerId,
                  lines: [{ description, quantity: 1, unitCents: Math.round(dollars * 100) }],
                  taxCents: Math.round(taxDollars * 100),
                  dueInDays: Number(dueInDays) || 30,
                  issue,
                });
                onCreated();
              }, 'Invoice created.')
            }
          >
            {busy ? 'Creating…' : issue ? 'Create and issue' : 'Save as draft'}
          </button>
        </>
      }
    >
      <Field label="Kind">
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as CreateInvoiceInput['kind']);
            // The payer list changes with the kind, so a stale selection would
            // point at an id from the other collection.
            setPayerId('');
          }}
        >
          <option value="subscription">Subscription — a mosque pays us</option>
          <option value="campaign">Campaign — a partner pays us</option>
          <option value="donation_fee">Donation fee — a mosque pays us</option>
          <option value="other">Other</option>
        </select>
      </Field>

      <Field label={againstMosque ? 'Mosque' : 'Partner'}>
        <select value={payerId} onChange={(event) => setPayerId(event.target.value)}>
          <option value="">Choose…</option>
          {againstMosque
            ? (mosques.data?.items ?? []).map((m) => (
                <option key={m.mosqueId} value={m.mosqueId}>
                  {m.name}
                </option>
              ))
            : (advertisers.data?.items ?? []).map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
        </select>
      </Field>

      <Field label="Description">
        <input
          type="text"
          value={description}
          placeholder="M'Ensemble Standard — monthly"
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <div className="grid cols-3">
        <Field label="Amount (CAD)">
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Tax (CAD)" hint="GST + QST is 14.975%">
          <input
            type="number"
            step="0.01"
            value={tax}
            onChange={(event) => setTax(event.target.value)}
          />
        </Field>
        <Field label="Due in (days)">
          <input
            type="number"
            value={dueInDays}
            onChange={(event) => setDueInDays(event.target.value)}
          />
        </Field>
      </div>

      <p className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
        <span className="muted">Total</span>
        <strong className="num">{money(Math.round((dollars + taxDollars) * 100))}</strong>
      </p>

      <label className="row" style={{ gap: 8, marginTop: 8 }}>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={issue}
          onChange={(event) => setIssue(event.target.checked)}
        />
        <span>Issue it now (otherwise it stays a draft)</span>
      </label>
    </Modal>
  );
}
