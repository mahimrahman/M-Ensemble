import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Advertiser } from '@m-ensemble/shared';
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
} from '@/ui';
import { ImageUpload } from '@/ui/ImageUpload';
import { date } from '@/lib/format';

/**
 * Partner advertisers — the halal restaurant, the grocer, the driving school.
 *
 * A partner is not a mosque and never inherits a mosque's standing. Their
 * content appears as a clearly-labelled card in the feed, they pay for it, and
 * pausing the partner here stops **every** campaign they have without anyone
 * having to remember each one.
 */
export function Partners(): React.JSX.Element {
  const list = useListState({ status: '' }, 'createdAt');
  const state = useAsync(() => api.advertisers(list.query), [JSON.stringify(list.query)]);
  const [editing, setEditing] = useState<Advertiser | 'new' | null>(null);
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();

  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Businesses buying placement in the app. Their campaigns live on the Campaigns page."
        actions={
          <button
            className="btn primary"
            disabled={!canWrite}
            title={reason}
            onClick={() => setEditing('new')}
          >
            Add a partner
          </button>
        }
      />

      <Card padded={false}>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by name, category or contact"
            value={list.q}
            onChange={(event) => list.setQ(event.target.value)}
          />
          <FilterSelect
            label="Status"
            value={list.filters.status}
            onChange={(value) => list.setFilter('status', value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        <Async state={state}>
          {(result) => (
            <>
              <DataTable<Advertiser>
                columns={[
                  {
                    key: 'name',
                    header: 'Partner',
                    sortable: true,
                    render: (row) => (
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
                        {row.logoUrl ? (
                          <img
                            src={row.logoUrl}
                            alt=""
                            style={{
                              width: 34,
                              height: 34,
                              objectFit: 'contain',
                              borderRadius: 6,
                              background: 'var(--surface-sunken)',
                              flex: 'none',
                            }}
                          />
                        ) : null}
                        <div>
                          <div className="cell-main">{row.name}</div>
                          <div className="cell-sub">{row.category}</div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'contact',
                    header: 'Contact',
                    render: (row) => (
                      <>
                        <div>{row.contactName ?? <span className="muted">—</span>}</div>
                        <div className="cell-sub">{row.contactEmail ?? row.contactPhone ?? ''}</div>
                      </>
                    ),
                  },
                  {
                    key: 'website',
                    header: 'Website',
                    render: (row) =>
                      row.website ? (
                        <a
                          href={`https://${row.website.replace(/^https?:\/\//, '')}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{ color: 'var(--brand)' }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.website}
                        </a>
                      ) : (
                        <span className="muted">—</span>
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
                            : row.status === 'paused'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {row.status}
                      </Badge>
                    ),
                  },
                  {
                    key: 'createdAt',
                    header: 'Since',
                    sortable: true,
                    render: (row) => date(row.createdAt),
                  },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (row) => (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <Link className="btn sm" to={`/campaigns?advertiserId=${row._id}`}>
                          Campaigns
                        </Link>
                        <button
                          className="btn sm"
                          disabled={!canWrite}
                          title={reason}
                          onClick={() => setEditing(row)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn sm"
                          disabled={!canWrite || busy}
                          title={
                            row.status === 'active'
                              ? 'Pausing a partner stops every campaign they have.'
                              : reason
                          }
                          onClick={() =>
                            run(
                              () =>
                                api
                                  .updateAdvertiser(row._id, {
                                    status: row.status === 'active' ? 'paused' : 'active',
                                  })
                                  .then(state.reload),
                              row.status === 'active' ? 'Partner paused.' : 'Partner resumed.',
                            )
                          }
                        >
                          {row.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                    ),
                  },
                ]}
                rows={result.items}
                sort={list.sort}
                dir={list.dir}
                onSort={list.toggleSort}
                empty="No partners yet."
              />
              <Pager page={list.page} result={result} onPage={list.setPage} />
            </>
          )}
        </Async>
      </Card>

      {editing && (
        <PartnerDialog
          advertiser={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}

function PartnerDialog({
  advertiser,
  onClose,
  onSaved,
}: {
  advertiser?: Advertiser;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [form, setForm] = useState({
    name: advertiser?.name ?? '',
    category: advertiser?.category ?? 'Restaurant',
    contactName: advertiser?.contactName ?? '',
    contactEmail: advertiser?.contactEmail ?? '',
    contactPhone: advertiser?.contactPhone ?? '',
    website: advertiser?.website ?? '',
    note: advertiser?.note ?? '',
  });
  const [logoUrl, setLogoUrl] = useState(advertiser?.logoUrl);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      title={advertiser ? `Edit ${advertiser.name}` : 'Add a partner'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || form.name.trim().length < 2}
            onClick={() =>
              run(
                async () => {
                  const payload = {
                    name: form.name,
                    category: form.category,
                    contactName: form.contactName || undefined,
                    contactEmail: form.contactEmail || undefined,
                    contactPhone: form.contactPhone || undefined,
                    website: form.website || undefined,
                    note: form.note || undefined,
                  };
                  if (advertiser) await api.updateAdvertiser(advertiser._id, payload);
                  else await api.createAdvertiser(payload);
                  onSaved();
                },
                advertiser ? 'Partner updated.' : 'Partner added.',
              )
            }
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Field label="Name">
        <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Category" hint="Restaurant, Grocery, Education, Retail, Services…">
        <input
          type="text"
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
        />
      </Field>

      <div className="grid cols-2">
        <Field label="Contact name">
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid cols-2">
        <Field label="Phone">
          <input
            type="text"
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
          />
        </Field>
        <Field label="Website" hint="Bare host, no https://">
          <input
            type="text"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
          />
        </Field>
      </div>

      <ImageUpload
        label="Logo"
        shape="logo"
        value={logoUrl}
        onChange={setLogoUrl}
        hint="Shown on the partner's record. Square or wide both work."
      />

      <Field label="Note" hint="What they want out of this, when they renew, who introduced them.">
        <textarea value={form.note} onChange={(e) => set('note', e.target.value)} />
      </Field>
    </Modal>
  );
}
