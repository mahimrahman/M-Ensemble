import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SupportTicket, TicketCategory, TicketPriority } from '@m-ensemble/shared';
import { api } from '@/api';
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
import { StatTile } from '@/ui/charts';
import { humanise, relative } from '@/lib/format';

/**
 * The support inbox — where "solve user issues" actually happens.
 *
 * Reachable and answerable by the `support` tier as well as super admins.
 * A role that can read a complaint but not reply to it would send every
 * question straight back to whoever holds the keys, which defeats the point of
 * having the tier.
 */

export const STATUS_TONE: Record<string, Tone> = {
  open: 'critical',
  pending: 'warning',
  resolved: 'good',
  closed: 'neutral',
};

export const PRIORITY_TONE: Record<string, Tone> = {
  urgent: 'critical',
  high: 'serious',
  normal: 'neutral',
  low: 'neutral',
};

const CATEGORIES: TicketCategory[] = [
  'account',
  'billing',
  'bug',
  'mosque',
  'content',
  'feature',
  'other',
];

const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export function Support(): React.JSX.Element {
  const navigate = useNavigate();
  const stats = useAsync(() => api.supportStats(), []);
  const list = useListState(
    { status: '', priority: '', category: '', openOnly: 'true' },
    'updatedAt',
  );
  const state = useAsync(() => api.tickets(list.query), [JSON.stringify(list.query)]);
  const [opening, setOpening] = useState(false);

  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Problems people have told us about, and what we did."
        actions={
          <button className="btn primary" onClick={() => setOpening(true)}>
            Open a ticket
          </button>
        }
      />

      <div className="stack">
        <Async state={stats}>
          {(data) => (
            <div className="grid cols-4">
              <StatTile
                label="Open"
                value={String(data.open)}
                deltaLabel={`${data.pending} awaiting a reply from the reporter`}
                tone="down-good"
              />
              <StatTile
                label="Urgent"
                value={String(data.urgent)}
                deltaLabel="open or pending"
                tone="down-good"
              />
              <StatTile
                label="Unassigned"
                value={String(data.unassigned)}
                deltaLabel="nobody has picked these up"
                tone="down-good"
              />
              <StatTile
                label="Resolved, last 30 days"
                value={String(data.resolved30d)}
                deltaLabel={
                  data.avgResolutionHours
                    ? `${data.avgResolutionHours}h average to resolve`
                    : 'no resolutions yet'
                }
              />
            </div>
          )}
        </Async>

        <Card padded={false}>
          <div className="toolbar">
            <input
              type="text"
              placeholder="Search subject, reference or reporter"
              value={list.q}
              onChange={(event) => list.setQ(event.target.value)}
            />
            <label className="row" style={{ gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={list.filters.openOnly === 'true'}
                onChange={(event) => {
                  list.setFilter('openOnly', event.target.checked ? 'true' : '');
                  // The two filters contradict each other, so picking one
                  // clears the other rather than returning nothing.
                  if (event.target.checked) list.setFilter('status', '');
                }}
              />
              Unresolved only
            </label>
            <FilterSelect
              label="Status"
              value={list.filters.status}
              onChange={(value) => {
                list.setFilter('status', value);
                if (value) list.setFilter('openOnly', '');
              }}
              options={['open', 'pending', 'resolved', 'closed'].map((s) => ({
                value: s,
                label: humanise(s),
              }))}
            />
            <FilterSelect
              label="Priority"
              value={list.filters.priority}
              onChange={(value) => list.setFilter('priority', value)}
              options={PRIORITIES.map((p) => ({ value: p, label: humanise(p) }))}
            />
            <FilterSelect
              label="Category"
              value={list.filters.category}
              onChange={(value) => list.setFilter('category', value)}
              options={CATEGORIES.map((c) => ({ value: c, label: humanise(c) }))}
            />
          </div>

          <Async state={state}>
            {(result) => (
              <>
                <DataTable<SupportTicket>
                  columns={[
                    {
                      key: 'reference',
                      header: 'Ticket',
                      render: (row) => (
                        <>
                          <div className="cell-main">{row.subject}</div>
                          <div className="cell-sub mono">{row.reference}</div>
                        </>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      sortable: true,
                      render: (row) => (
                        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{row.status}</Badge>
                      ),
                    },
                    {
                      key: 'priority',
                      header: 'Priority',
                      sortable: true,
                      render: (row) =>
                        row.priority === 'normal' || row.priority === 'low' ? (
                          <span className="muted">{humanise(row.priority)}</span>
                        ) : (
                          <Badge tone={PRIORITY_TONE[row.priority] ?? 'neutral'}>
                            {row.priority}
                          </Badge>
                        ),
                    },
                    {
                      key: 'category',
                      header: 'Category',
                      render: (row) => humanise(row.category),
                    },
                    {
                      key: 'userName',
                      header: 'Reporter',
                      render: (row) => (
                        <>
                          <div>{row.userName ?? <span className="muted">—</span>}</div>
                          <div className="cell-sub">{row.userEmail ?? ''}</div>
                        </>
                      ),
                    },
                    {
                      key: 'assignedToName',
                      header: 'Assigned',
                      render: (row) =>
                        row.assignedToName ?? <Badge tone="warning">Unassigned</Badge>,
                    },
                    {
                      key: 'updatedAt',
                      header: 'Last activity',
                      sortable: true,
                      render: (row) => <span className="muted">{relative(row.updatedAt)}</span>,
                    },
                  ]}
                  rows={result.items}
                  sort={list.sort}
                  dir={list.dir}
                  onSort={list.toggleSort}
                  onRowClick={(row) => navigate(`/support/${row._id}`)}
                  empty="Nothing in the inbox. Enjoy it."
                />
                <Pager page={list.page} result={result} onPage={list.setPage} />
              </>
            )}
          </Async>
        </Card>
      </div>

      {opening && (
        <NewTicketDialog
          onClose={() => setOpening(false)}
          onCreated={(id) => {
            setOpening(false);
            navigate(`/support/${id}`);
          }}
        />
      )}
    </>
  );
}

/**
 * Open a ticket on somebody's behalf.
 *
 * The reporter is optional because a phone call about a login that will not
 * work is a real ticket even though the person on the other end could not sign
 * in to file it.
 */
function NewTicketDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [q, setQ] = useState('');
  const users = useAsync(
    () => (q.length > 2 ? api.users({ q, pageSize: 10 }) : Promise.resolve(null)),
    [q],
  );
  const mosques = useAsync(() => api.mosques({ pageSize: 200, sort: 'name', dir: 'asc' }), []);

  const [form, setForm] = useState({
    subject: '',
    body: '',
    category: 'other' as TicketCategory,
    priority: 'normal' as TicketPriority,
    userId: '',
    mosqueId: '',
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      title="Open a ticket"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || form.subject.trim().length < 3 || form.body.trim().length < 1}
            onClick={() =>
              run(async () => {
                const ticket = await api.createTicket({
                  subject: form.subject,
                  body: form.body,
                  category: form.category,
                  priority: form.priority,
                  userId: form.userId || undefined,
                  mosqueId: form.mosqueId || undefined,
                });
                onCreated(ticket._id);
              }, 'Ticket opened.')
            }
          >
            {busy ? 'Opening…' : 'Open'}
          </button>
        </>
      }
    >
      <Field label="Subject">
        <input
          type="text"
          value={form.subject}
          onChange={(event) => set('subject', event.target.value)}
        />
      </Field>
      <Field
        label="What happened"
        hint="In their words if you can — it is the first message on the thread."
      >
        <textarea value={form.body} onChange={(event) => set('body', event.target.value)} />
      </Field>

      <div className="grid cols-2">
        <Field label="Category">
          <select value={form.category} onChange={(event) => set('category', event.target.value)}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {humanise(category)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {humanise(priority)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Reporter" hint="Optional — type a name or email to find them.">
        <input
          type="text"
          placeholder="Search people"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </Field>

      {users.data && users.data.items.length > 0 && (
        <div className="row" style={{ marginBottom: 12 }}>
          {users.data.items.map((user) => (
            <button
              key={user._id}
              className={`btn sm ${form.userId === user._id ? 'primary' : ''}`}
              onClick={() => set('userId', form.userId === user._id ? '' : user._id)}
            >
              {user.name}
            </button>
          ))}
        </div>
      )}

      <Field label="Mosque" hint="Optional — if the problem is about one.">
        <select value={form.mosqueId} onChange={(event) => set('mosqueId', event.target.value)}>
          <option value="">None</option>
          {(mosques.data?.items ?? []).map((mosque) => (
            <option key={mosque.mosqueId} value={mosque.mosqueId}>
              {mosque.name}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}
