import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PostType } from '@m-ensemble/shared';
import { api } from '@/api';
import { useWriteGuard } from '@/auth';
import { Async, Badge, Card, DataTable, Field, Modal, PageHeader, useAction, useAsync } from '@/ui';
import { ImageUpload } from '@/ui/ImageUpload';
import { count, dateTime, humanise } from '@/lib/format';

/**
 * Publish on a mosque's behalf.
 *
 * This is how a mosque gets its first three events without anyone having to sit
 * with them and teach the app on day one, and how a listing that went out wrong
 * gets fixed before two thousand phones act on it.
 *
 * The post shows as the **mosque's**, because that is whose noticeboard it is.
 * Who actually typed it is kept honestly on the record: `createdBy` is the
 * super admin, and the audit log says "published X for Y".
 */

const TYPES: { value: PostType; label: string; hint: string }[] = [
  { value: 'event', label: 'Event', hint: 'A one-off gathering. Capacity optional.' },
  { value: 'class', label: 'Class', hint: 'A programme people enrol in.' },
  { value: 'volunteer', label: 'Volunteer request', hint: 'Asks for a number of people.' },
  { value: 'announcement', label: 'Announcement', hint: 'Information. Nothing to sign up to.' },
];

export function Events(): React.JSX.Element {
  const mosques = useAsync(
    () => api.mosques({ pageSize: 200, operated: 'true', sort: 'name', dir: 'asc' }),
    [],
  );
  const [mosqueId, setMosqueId] = useState('');
  const [composing, setComposing] = useState(false);
  const detail = useAsync(
    () => (mosqueId ? api.mosque(mosqueId) : Promise.resolve(null)),
    [mosqueId],
  );
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Publish for a mosque, or cancel something that should not be up."
        actions={
          <button
            className="btn primary"
            disabled={!canWrite}
            title={reason}
            onClick={() => setComposing(true)}
          >
            Publish for a mosque
          </button>
        }
      />

      <div className="stack">
        <Card>
          <Field label="Mosque" hint="Only mosques with a coordinator can be published for.">
            <select value={mosqueId} onChange={(event) => setMosqueId(event.target.value)}>
              <option value="">Choose a mosque to see what it has published…</option>
              {(mosques.data?.items ?? []).map((mosque) => (
                <option key={mosque.mosqueId} value={mosque.mosqueId}>
                  {mosque.name} — {mosque.city}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        {mosqueId && (
          <Async state={detail}>
            {(data) =>
              data ? (
                <Card
                  title={`${data.mosque.name} — recent posts`}
                  padded={false}
                  actions={
                    <Link className="btn sm" to={`/mosques/${mosqueId}`}>
                      Open mosque
                    </Link>
                  }
                >
                  <DataTable
                    columns={[
                      {
                        key: 'title',
                        header: 'Post',
                        render: (row) => (
                          <>
                            <div className="cell-main">{row.title}</div>
                            <div className="cell-sub">
                              {humanise(row.type)} · starts {dateTime(row.startAt)}
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
                        header: 'Status',
                        render: (row) =>
                          row.cancelledAt ? (
                            <Badge tone="critical">Cancelled</Badge>
                          ) : new Date(row.startAt) > new Date() ? (
                            <Badge tone="good">Upcoming</Badge>
                          ) : (
                            <Badge tone="neutral">Past</Badge>
                          ),
                      },
                      {
                        key: 'actions',
                        header: '',
                        align: 'right',
                        render: (row) =>
                          row.cancelledAt ? null : (
                            <button
                              className="btn danger sm"
                              disabled={!canWrite || busy}
                              title={reason}
                              onClick={() =>
                                run(
                                  () => api.cancelPost(row._id).then(detail.reload),
                                  'Post cancelled.',
                                )
                              }
                            >
                              Cancel
                            </button>
                          ),
                      },
                    ]}
                    rows={data.recentPosts}
                    empty="This mosque has published nothing yet."
                  />
                </Card>
              ) : (
                <></>
              )
            }
          </Async>
        )}
      </div>

      {composing && (
        <ComposeDialog
          mosques={(mosques.data?.items ?? []).map((m) => ({ id: m.mosqueId, name: m.name }))}
          defaultMosqueId={mosqueId}
          onClose={() => setComposing(false)}
          onCreated={() => {
            setComposing(false);
            detail.reload();
          }}
        />
      )}
    </>
  );
}

function ComposeDialog({
  mosques,
  defaultMosqueId,
  onClose,
  onCreated,
}: {
  mosques: { id: string; name: string }[];
  defaultMosqueId: string;
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const { busy, run } = useAction();

  const start = new Date(Date.now() + 7 * 86_400_000);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  const toInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    mosqueId: defaultMosqueId,
    type: 'event' as PostType,
    title: '',
    description: '',
    category: 'Community',
    location: '',
    startAt: toInput(start),
    endAt: toInput(end),
    slotsNeeded: '',
    capacity: '',
    notify: true,
  });
  const [imageUrl, setImageUrl] = useState<string>();

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const valid =
    form.mosqueId &&
    form.title.trim().length > 1 &&
    form.description.trim().length > 0 &&
    form.location.trim().length > 0 &&
    new Date(form.endAt) > new Date(form.startAt);

  const selected = TYPES.find((t) => t.value === form.type);

  return (
    <Modal
      title="Publish for a mosque"
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
                await api.createEvent({
                  mosqueId: form.mosqueId,
                  type: form.type,
                  title: form.title,
                  description: form.description,
                  category: form.category,
                  location: form.location,
                  startAt: new Date(form.startAt).toISOString(),
                  endAt: new Date(form.endAt).toISOString(),
                  slotsNeeded:
                    form.type === 'volunteer' && form.slotsNeeded
                      ? Number(form.slotsNeeded)
                      : undefined,
                  capacity:
                    (form.type === 'event' || form.type === 'class') && form.capacity
                      ? Number(form.capacity)
                      : undefined,
                  imageUrl,
                  notify: form.notify,
                });
                onCreated();
              }, 'Published.')
            }
          >
            {busy ? 'Publishing…' : form.notify ? 'Publish and notify' : 'Publish'}
          </button>
        </>
      }
    >
      <div className="alert" style={{ marginBottom: 16 }}>
        <div>
          <b>This posts as the mosque.</b>
          Members will see it on the mosque&apos;s noticeboard exactly as if a coordinator wrote it.
          The record of who actually published it stays in the audit log.
        </div>
      </div>

      <div className="grid cols-2">
        <Field label="Mosque">
          <select value={form.mosqueId} onChange={(e) => set('mosqueId', e.target.value)}>
            <option value="">Choose…</option>
            {mosques.map((mosque) => (
              <option key={mosque.id} value={mosque.id}>
                {mosque.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type" hint={selected?.hint}>
          <select value={form.type} onChange={(e) => set('type', e.target.value as PostType)}>
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Title">
        <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>

      <div className="grid cols-2">
        <Field label="Category" hint="Community, Education, Youth, Sisters, Charity…">
          <input
            type="text"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input
            type="text"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid cols-2">
        <Field label="Starts">
          <input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => set('startAt', e.target.value)}
          />
        </Field>
        <Field label="Ends">
          <input
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => set('endAt', e.target.value)}
          />
        </Field>
      </div>

      {form.type === 'volunteer' && (
        <Field label="People needed">
          <input
            type="number"
            min={1}
            value={form.slotsNeeded}
            onChange={(e) => set('slotsNeeded', e.target.value)}
          />
        </Field>
      )}

      {(form.type === 'event' || form.type === 'class') && (
        <Field label="Capacity" hint="Leave blank for no cap.">
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
          />
        </Field>
      )}

      <label className="row" style={{ gap: 8, marginTop: 4 }}>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={form.notify}
          onChange={(e) => set('notify', e.target.checked)}
        />
        <span>
          Send a push notification to the mosque&apos;s followers{' '}
          <span className="muted">— filtered by their interests and notification settings</span>
        </span>
      </label>
    </Modal>
  );
}
