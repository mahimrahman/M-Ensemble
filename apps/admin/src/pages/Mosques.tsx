import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IssuedCredential, MosqueSummary } from '@m-ensemble/shared';
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
  type Column,
} from '@/ui';
import { CredentialSlip } from '@/pages/CredentialSlip';
import { count, moneyShort, percent, priceLabel, relative } from '@/lib/format';

/**
 * Every mosque on the platform, operated or merely listed.
 *
 * The `operated` column is the one that matters: a directory row is public data
 * we hold about a real mosque nobody has claimed, and it has no coordinator, no
 * posts and nothing agreed to pay. Sorting and filtering on it is how you find
 * the mosques worth calling.
 */

/**
 * The same shape the server accepts. A looser check here — anything with an
 * @ in it — lets `admin@localhost` through the button and back as a 400.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const columns = (): Column<MosqueSummary>[] => [
  {
    key: 'name',
    header: 'Mosque',
    sortable: true,
    render: (row) => (
      <>
        <div className="cell-main">{row.name}</div>
        <div className="cell-sub">{row.city}</div>
      </>
    ),
  },
  {
    key: 'operated',
    header: 'Status',
    render: (row) =>
      row.operated ? (
        <Badge tone="good">Operated</Badge>
      ) : (
        <Badge tone="neutral">Directory only</Badge>
      ),
  },
  {
    key: 'priceCents',
    header: 'Billing',
    sortable: true,
    render: (row) => (
      <>
        <Badge tone={row.priceCents === 0 ? 'neutral' : 'brand'}>
          {priceLabel(row.priceCents)}
        </Badge>
        {row.subscriptionStatus === 'past_due' && (
          <div style={{ marginTop: 3 }}>
            <Badge tone="critical">Past due</Badge>
          </div>
        )}
        {row.subscriptionStatus === 'trialing' && (
          <div style={{ marginTop: 3 }}>
            <Badge tone="warning">Trial</Badge>
          </div>
        )}
      </>
    ),
  },
  {
    key: 'followerCount',
    header: 'Followers',
    sortable: true,
    align: 'right',
    render: (row) => count(row.followerCount),
  },
  {
    key: 'livePostCount',
    header: 'Live posts',
    sortable: true,
    align: 'right',
    render: (row) => count(row.livePostCount),
  },
  {
    key: 'signupCount',
    header: 'Signups',
    sortable: true,
    align: 'right',
    render: (row) => count(row.signupCount),
  },
  {
    key: 'attendanceRate',
    header: 'Attendance',
    sortable: true,
    align: 'right',
    render: (row) =>
      row.signupCount ? percent(row.attendanceRate) : <span className="muted">—</span>,
  },
  {
    key: 'outstandingCents',
    header: 'Owing',
    sortable: true,
    align: 'right',
    render: (row) =>
      row.outstandingCents > 0 ? (
        <strong>{moneyShort(row.outstandingCents)}</strong>
      ) : (
        <span className="muted">—</span>
      ),
  },
  {
    key: 'lastActivityAt',
    header: 'Last activity',
    render: (row) => <span className="muted">{relative(row.lastActivityAt)}</span>,
  },
];

export function Mosques(): React.JSX.Element {
  const navigate = useNavigate();
  const list = useListState({ operated: '', billing: '' }, 'signupCount');
  const state = useAsync(() => api.mosques(list.query), [JSON.stringify(list.query)]);
  const [creating, setCreating] = useState(false);
  const [credential, setCredential] = useState<IssuedCredential>();
  const { canWrite, reason } = useWriteGuard();

  return (
    <>
      <PageHeader
        title="Mosques"
        subtitle="Onboard a mosque, issue its coordinator credentials, and see how it is doing."
        actions={
          <button
            className="btn primary"
            disabled={!canWrite}
            title={reason}
            onClick={() => setCreating(true)}
          >
            Add a mosque
          </button>
        }
      />

      <Card padded={false}>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by name or city"
            value={list.q}
            onChange={(event) => list.setQ(event.target.value)}
          />
          <FilterSelect
            label="Status"
            value={list.filters.operated}
            onChange={(value) => list.setFilter('operated', value)}
            options={[
              { value: 'true', label: 'Operated' },
              { value: 'false', label: 'Directory only' },
            ]}
          />
          <FilterSelect
            label="Billing"
            value={list.filters.billing}
            onChange={(value) => list.setFilter('billing', value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'trialing', label: 'Trialing' },
              { value: 'past_due', label: 'Past due' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <Async state={state}>
          {(result) => (
            <>
              <DataTable
                columns={columns()}
                rows={result.items}
                sort={list.sort}
                dir={list.dir}
                onSort={list.toggleSort}
                onRowClick={(row) => navigate(`/mosques/${row.mosqueId}`)}
                empty="No mosque matches those filters."
              />
              <Pager page={list.page} result={result} onPage={list.setPage} />
            </>
          )}
        </Async>
      </Card>

      {creating && (
        <CreateMosqueDialog
          onClose={() => setCreating(false)}
          onCreated={(issued) => {
            setCreating(false);
            state.reload();
            if (issued) setCredential(issued);
          }}
        />
      )}

      {credential && (
        <CredentialSlip credential={credential} onClose={() => setCredential(undefined)} />
      )}
    </>
  );
}

/**
 * Create a mosque and, optionally, the account that runs it — in one step.
 *
 * The coordinator half is optional because a mosque is often added from a
 * directory listing weeks before anyone there agrees to run it. When it is
 * filled in, the password field is left blank by default and the server
 * generates one, which is the safer path: a human-chosen password typed into a
 * form gets reused.
 */
function CreateMosqueDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (credential?: IssuedCredential) => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [form, setForm] = useState({
    name: '',
    address: '',
    lat: '',
    lng: '',
    phone: '',
    website: '',
    bio: '',
    priceDollars: '0',
    joinCode: '',
    withCoordinator: true,
    coordinatorName: '',
    coordinatorEmail: '',
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const ok = await run(async () => {
      const created = await api.createMosque({
        name: form.name,
        address: form.address,
        coordinates: { lat: Number(form.lat), lng: Number(form.lng) },
        phone: form.phone || undefined,
        website: form.website || undefined,
        bio: form.bio || undefined,
        joinCode: form.joinCode || undefined,
        priceCents: Math.round(Number(form.priceDollars) * 100),
        coordinator:
          form.withCoordinator && form.coordinatorEmail
            ? { name: form.coordinatorName, email: form.coordinatorEmail }
            : undefined,
      });
      onCreated(created.credential);
    }, `${form.name} added.`);
    if (!ok) return;
  };

  // Mirrors `createMosqueSchema`. Anything looser here is a round trip that
  // comes back as a rejection the form could have caught itself.
  const valid =
    form.name.trim().length > 1 &&
    form.address.trim().length > 3 &&
    form.lat !== '' &&
    form.lng !== '' &&
    Number.isFinite(Number(form.lat)) &&
    Number.isFinite(Number(form.lng)) &&
    Number.isFinite(Number(form.priceDollars)) &&
    Number(form.priceDollars) >= 0 &&
    (form.joinCode === '' || /^[A-Za-z0-9]{4,12}$/.test(form.joinCode.trim())) &&
    (!form.withCoordinator ||
      (form.coordinatorName.trim().length > 1 && EMAIL.test(form.coordinatorEmail.trim())));

  return (
    <Modal
      title="Add a mosque"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create mosque'}
          </button>
        </>
      }
    >
      <Field label="Name">
        <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Address">
        <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} />
      </Field>

      <div className="grid cols-2">
        <Field
          label="Latitude"
          hint="The city is worked out from this — no city field to keep in step."
        >
          <input
            type="number"
            step="0.000001"
            value={form.lat}
            onChange={(e) => set('lat', e.target.value)}
          />
        </Field>
        <Field label="Longitude">
          <input
            type="number"
            step="0.000001"
            value={form.lng}
            onChange={(e) => set('lng', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid cols-2">
        <Field label="Phone">
          <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Website" hint="Bare host, no https://">
          <input
            type="text"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid cols-2">
        <Field
          label="Price per month"
          hint="In dollars. Leave at 0 — a mosque onboarded just now has agreed to nothing yet."
        >
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.priceDollars}
            onChange={(e) => set('priceDollars', e.target.value)}
          />
        </Field>
        <Field label="Join code" hint="Leave blank and the server mints one.">
          <input
            type="text"
            value={form.joinCode}
            onChange={(e) => set('joinCode', e.target.value.toUpperCase())}
          />
        </Field>
      </div>

      <Field label="About">
        <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} />
      </Field>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0 14px' }} />

      <label className="row" style={{ marginBottom: 12, gap: 8 }}>
        <input
          type="checkbox"
          checked={form.withCoordinator}
          onChange={(e) => set('withCoordinator', e.target.checked)}
          style={{ width: 'auto' }}
        />
        <span>Create the coordinator account now</span>
      </label>

      {form.withCoordinator && (
        <div className="grid cols-2">
          <Field label="Coordinator name">
            <input
              type="text"
              value={form.coordinatorName}
              onChange={(e) => set('coordinatorName', e.target.value)}
            />
          </Field>
          <Field label="Coordinator email" hint="A password is generated and shown once.">
            <input
              type="email"
              value={form.coordinatorEmail}
              onChange={(e) => set('coordinatorEmail', e.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
