import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AdPlacement, CampaignWithAdvertiser } from '@m-ensemble/shared';
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
import { Meter } from '@/ui/charts';
import { count, date, money, percent } from '@/lib/format';

/**
 * Partner campaigns — the flights that put a partner's card in the feed.
 *
 * A campaign never goes live by being saved. It moves `draft → pending →
 * active`, and only a super admin approves it, because "what appears in a
 * mosque's feed" is the single most trust-sensitive thing this platform does.
 */

export const CAMPAIGN_TONE: Record<string, Tone> = {
  draft: 'neutral',
  pending: 'warning',
  active: 'good',
  paused: 'serious',
  completed: 'neutral',
  rejected: 'critical',
};

export function Campaigns(): React.JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const list = useListState(
    { status: '', advertiserId: params.get('advertiserId') ?? '' },
    'createdAt',
  );
  const state = useAsync(() => api.campaigns(list.query), [JSON.stringify(list.query)]);
  const advertisers = useAsync(() => api.advertisers({ pageSize: 200, status: 'active' }), []);
  const [creating, setCreating] = useState(false);
  const { canWrite, reason } = useWriteGuard();

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Paid placement in the feed. Nothing runs until a super admin approves it."
        actions={
          <button
            className="btn primary"
            disabled={!canWrite}
            title={reason}
            onClick={() => setCreating(true)}
          >
            New campaign
          </button>
        }
      />

      <Card padded={false}>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by name or headline"
            value={list.q}
            onChange={(event) => list.setQ(event.target.value)}
          />
          <FilterSelect
            label="Status"
            value={list.filters.status}
            onChange={(value) => list.setFilter('status', value)}
            options={[
              { value: 'pending', label: 'Awaiting approval' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'draft', label: 'Draft' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
          <FilterSelect
            label="Partner"
            value={list.filters.advertiserId}
            onChange={(value) => list.setFilter('advertiserId', value)}
            options={(advertisers.data?.items ?? []).map((a) => ({ value: a._id, label: a.name }))}
          />
        </div>

        <Async state={state}>
          {(result) => (
            <>
              <DataTable<CampaignWithAdvertiser>
                columns={[
                  {
                    key: 'name',
                    header: 'Campaign',
                    render: (row) => (
                      <>
                        <div className="cell-main">{row.name}</div>
                        <div className="cell-sub">{row.advertiserName}</div>
                      </>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => (
                      <Badge tone={CAMPAIGN_TONE[row.status] ?? 'neutral'}>{row.status}</Badge>
                    ),
                  },
                  {
                    key: 'startAt',
                    header: 'Flight',
                    sortable: true,
                    render: (row) => (
                      <span className="cell-sub">
                        {date(row.startAt)} → {date(row.endAt)}
                      </span>
                    ),
                  },
                  {
                    key: 'impressions',
                    header: 'Impressions',
                    sortable: true,
                    align: 'right',
                    render: (row) => count(row.impressions),
                  },
                  {
                    key: 'clicks',
                    header: 'Clicks',
                    sortable: true,
                    align: 'right',
                    render: (row) => count(row.clicks),
                  },
                  {
                    key: 'ctr',
                    header: 'CTR',
                    align: 'right',
                    render: (row) =>
                      row.impressions ? percent(row.ctr, 1) : <span className="muted">—</span>,
                  },
                  {
                    key: 'budgetCents',
                    header: 'Budget',
                    sortable: true,
                    align: 'right',
                    render: (row) => (
                      <div style={{ minWidth: 110 }}>
                        <Meter
                          value={row.spentCents}
                          max={row.budgetCents}
                          format={money}
                          tone={row.spentCents >= row.budgetCents ? 'critical' : 'default'}
                        />
                      </div>
                    ),
                  },
                ]}
                rows={result.items}
                sort={list.sort}
                dir={list.dir}
                onSort={list.toggleSort}
                onRowClick={(row) => navigate(`/campaigns/${row._id}`)}
                empty="No campaign matches those filters."
              />
              <Pager page={list.page} result={result} onPage={list.setPage} />
            </>
          )}
        </Async>
      </Card>

      {creating && (
        <NewCampaignDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            navigate(`/campaigns/${id}`);
          }}
        />
      )}
    </>
  );
}

const PLACEMENTS: { value: AdPlacement; label: string }[] = [
  { value: 'feed', label: 'Feed' },
  { value: 'mosque-profile', label: 'Mosque profile' },
  { value: 'post-detail', label: 'Post detail' },
];

const CITIES = [
  { value: 'montreal', label: 'Montréal' },
  { value: 'quebec', label: 'Québec' },
  { value: 'ottawa', label: 'Ottawa' },
  { value: 'toronto', label: 'Toronto' },
];

/**
 * Compose a flight.
 *
 * The creative fields are short by design and the form says why: a partner card
 * that outweighs the mosque posts around it is a product mistake, not a revenue
 * win. Targeting left empty means "everyone" on that axis — stated on the
 * control rather than left for someone to discover.
 */
function NewCampaignDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}): React.JSX.Element {
  const advertisers = useAsync(() => api.advertisers({ pageSize: 200, status: 'active' }), []);
  const { busy, run } = useAction();

  const today = new Date();
  const inThirtyDays = new Date(Date.now() + 30 * 86_400_000);

  const [form, setForm] = useState({
    advertiserId: '',
    name: '',
    headline: '',
    body: '',
    ctaLabel: 'Learn more',
    ctaUrl: '',
    startAt: today.toISOString().slice(0, 10),
    endAt: inThirtyDays.toISOString().slice(0, 10),
    budget: '500',
    pricing: 'cpm' as 'flat' | 'cpm' | 'cpc',
    rate: '8',
  });
  const [cities, setCities] = useState<string[]>([]);
  const [placements, setPlacements] = useState<AdPlacement[]>(['feed']);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) =>
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const valid =
    form.advertiserId &&
    form.name.trim().length > 1 &&
    form.headline.trim().length > 1 &&
    form.body.trim().length > 1 &&
    /^https?:\/\//i.test(form.ctaUrl) &&
    Number(form.budget) > 0 &&
    new Date(form.endAt) > new Date(form.startAt);

  return (
    <Modal
      title="New campaign"
      onClose={onClose}
      wide
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
                const created = await api.createCampaign({
                  advertiserId: form.advertiserId,
                  name: form.name,
                  creative: {
                    headline: form.headline,
                    body: form.body,
                    ctaLabel: form.ctaLabel,
                    ctaUrl: form.ctaUrl,
                  },
                  targeting: { cities, placements, mosqueIds: [], interests: [] },
                  // Dates arrive as calendar days; a flight runs from the start
                  // of its first day to the end of its last.
                  startAt: new Date(`${form.startAt}T00:00:00`).toISOString(),
                  endAt: new Date(`${form.endAt}T23:59:59`).toISOString(),
                  budgetCents: Math.round(Number(form.budget) * 100),
                  pricing: form.pricing,
                  rateCents: Math.round(Number(form.rate) * 100),
                });
                onCreated(created._id);
              }, 'Campaign created as a draft.')
            }
          >
            {busy ? 'Creating…' : 'Create draft'}
          </button>
        </>
      }
    >
      <div className="grid cols-2">
        <Field label="Partner">
          <select
            value={form.advertiserId}
            onChange={(event) => set('advertiserId', event.target.value)}
          >
            <option value="">Choose a partner…</option>
            {(advertisers.data?.items ?? []).map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Campaign name" hint="Internal — never shown to readers.">
          <input
            type="text"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </Field>
      </div>

      <h3 style={{ margin: '14px 0 8px' }}>The card</h3>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 12.5 }}>
        Kept deliberately small. The feed is a mosque&apos;s noticeboard; a partner card that
        outweighs the posts around it costs more trust than it earns. Every card is labelled as a
        paid partnership automatically.
      </p>

      <Field label="Headline" hint={`${form.headline.length}/80`}>
        <input
          type="text"
          maxLength={80}
          value={form.headline}
          onChange={(event) => set('headline', event.target.value)}
        />
      </Field>
      <Field label="Body" hint={`${form.body.length}/200`}>
        <textarea
          maxLength={200}
          value={form.body}
          onChange={(event) => set('body', event.target.value)}
        />
      </Field>

      <div className="grid cols-2">
        <Field label="Button label">
          <input
            type="text"
            maxLength={30}
            value={form.ctaLabel}
            onChange={(event) => set('ctaLabel', event.target.value)}
          />
        </Field>
        <Field label="Link" hint="Must start with https://">
          <input
            type="url"
            placeholder="https://"
            value={form.ctaUrl}
            onChange={(event) => set('ctaUrl', event.target.value)}
          />
        </Field>
      </div>

      <h3 style={{ margin: '14px 0 8px' }}>Flight and budget</h3>

      <div className="grid cols-2">
        <Field label="Starts">
          <input
            type="date"
            value={form.startAt}
            onChange={(event) => set('startAt', event.target.value)}
          />
        </Field>
        <Field label="Ends">
          <input
            type="date"
            value={form.endAt}
            onChange={(event) => set('endAt', event.target.value)}
          />
        </Field>
      </div>

      <div className="grid cols-3">
        <Field label="Budget (CAD)">
          <input
            type="number"
            step="1"
            value={form.budget}
            onChange={(event) => set('budget', event.target.value)}
          />
        </Field>
        <Field label="Priced on">
          <select
            value={form.pricing}
            onChange={(event) => set('pricing', event.target.value as typeof form.pricing)}
          >
            <option value="cpm">Per 1,000 impressions</option>
            <option value="cpc">Per click</option>
            <option value="flat">Flat fee</option>
          </select>
        </Field>
        <Field
          label="Rate (CAD)"
          hint={form.pricing === 'flat' ? 'Not used for a flat fee.' : undefined}
        >
          <input
            type="number"
            step="0.01"
            disabled={form.pricing === 'flat'}
            value={form.rate}
            onChange={(event) => set('rate', event.target.value)}
          />
        </Field>
      </div>

      <h3 style={{ margin: '14px 0 8px' }}>Who sees it</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 12.5 }}>
        Leave a row empty for no restriction on that axis. Targeting matches a reader&apos;s city
        and their own declared interests — nothing is inferred, and no identifier for the reader
        ever reaches the partner.
      </p>

      <Field label="Cities">
        <div className="row">
          {CITIES.map((city) => (
            <label key={city.value} className="row" style={{ gap: 5 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={cities.includes(city.value)}
                onChange={() => toggle(cities, city.value, setCities)}
              />
              {city.label}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Placements">
        <div className="row">
          {PLACEMENTS.map((placement) => (
            <label key={placement.value} className="row" style={{ gap: 5 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={placements.includes(placement.value)}
                onChange={() => toggle(placements, placement.value, setPlacements)}
              />
              {placement.label}
            </label>
          ))}
        </div>
      </Field>
    </Modal>
  );
}
