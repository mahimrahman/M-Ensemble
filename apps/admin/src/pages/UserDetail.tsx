import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PlatformRole } from '@m-ensemble/shared';
import { api } from '@/api';
import { useAuth, useWriteGuard } from '@/auth';
import { Async, Badge, Card, DataTable, Field, Modal, PageHeader, useAction, useAsync } from '@/ui';
import { StatTile } from '@/ui/charts';
import { CredentialSlip } from '@/pages/CredentialSlip';
import { count, date, dateTime, relative } from '@/lib/format';

/**
 * One person: what they have done, where they hold a role, and the four things
 * a super admin can do about them.
 *
 * Suspension rather than deletion. Deleting an account would orphan the signups
 * behind it and silently change six mosques' attendance numbers — a suspended
 * account keeps every row it created and simply cannot sign in.
 */
export function UserDetail(): React.JSX.Element {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const state = useAsync(() => api.user(id), [id]);
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();
  const [credential, setCredential] = useState<{ email: string; password: string }>();
  const [grantOpen, setGrantOpen] = useState(false);

  const isSelf = session?.userId === id;

  return (
    <Async state={state}>
      {(user) => (
        <>
          <PageHeader
            crumb="People"
            title={user.name}
            subtitle={user.email}
            actions={
              <div className="row">
                <button
                  className="btn"
                  disabled={!canWrite || busy}
                  title={reason}
                  onClick={() =>
                    run(async () => {
                      const issued = await api.resetPassword(id);
                      setCredential(issued);
                      state.reload();
                    })
                  }
                >
                  Reset password
                </button>
                <button
                  className="btn"
                  disabled={!canWrite}
                  title={reason}
                  onClick={() => setGrantOpen(true)}
                >
                  Mosque role
                </button>
                <button
                  className={user.status === 'suspended' ? 'btn primary' : 'btn danger'}
                  // Suspending yourself signs you out of the console you did it
                  // from. The server refuses too; this is the earlier, kinder no.
                  disabled={!canWrite || busy || (isSelf && user.status === 'active')}
                  title={isSelf ? 'You cannot suspend your own account.' : reason}
                  onClick={() =>
                    run(
                      () =>
                        api
                          .setUserStatus(id, user.status === 'suspended' ? 'active' : 'suspended')
                          .then(state.reload),
                      user.status === 'suspended' ? 'Account reinstated.' : 'Account suspended.',
                    )
                  }
                >
                  {user.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                </button>
              </div>
            }
          />

          <div className="stack">
            {user.status === 'suspended' && (
              <div className="alert critical">
                <div>
                  <b>This account is suspended.</b>
                  They cannot sign in, and any device still holding a token is signed out on its
                  next request. Everything they created is untouched.
                </div>
              </div>
            )}

            {user.mustChangePassword && (
              <div className="alert warning">
                <div>
                  <b>Provisioned password.</b>
                  This account was given a password by an administrator and has not chosen its own
                  yet.
                </div>
              </div>
            )}

            <div className="grid cols-4">
              <StatTile label="Signups" value={count(user.signupCount)} />
              <StatTile label="Mosques followed" value={count(user.followCount)} />
              <StatTile label="Joined" value={date(user.createdAt)} />
              <StatTile
                label="Last signed in"
                value={user.lastLoginAt ? relative(user.lastLoginAt) : 'Never'}
                deltaLabel={user.lastLoginAt ? dateTime(user.lastLoginAt) : undefined}
              />
            </div>

            <div className="grid split">
              <Card title="Mosque roles" padded={false}>
                <DataTable
                  columns={[
                    {
                      key: 'mosque',
                      header: 'Mosque',
                      render: (row) => (
                        <Link to={`/mosques/${row.mosqueId}`} className="cell-main">
                          {row.mosqueName}
                        </Link>
                      ),
                    },
                    {
                      key: 'role',
                      header: 'Role',
                      render: (row) =>
                        row.role === 'admin' ? (
                          <Badge tone="good">Coordinator</Badge>
                        ) : (
                          <Badge tone="neutral">Member</Badge>
                        ),
                    },
                    {
                      key: 'actions',
                      header: '',
                      align: 'right',
                      render: (row) => (
                        <button
                          className="btn sm"
                          disabled={!canWrite || busy}
                          title={reason}
                          onClick={() =>
                            run(
                              () =>
                                api
                                  .setMembership(
                                    id,
                                    row.mosqueId,
                                    row.role === 'admin' ? 'member' : 'admin',
                                  )
                                  .then(state.reload),
                              'Role updated.',
                            )
                          }
                        >
                          {row.role === 'admin' ? 'Demote' : 'Make coordinator'}
                        </button>
                      ),
                    },
                  ]}
                  rows={user.memberships}
                  empty="No role at any mosque."
                />
              </Card>

              <Card title="Platform access">
                <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
                  A tier above mosque roles. <strong>Support</strong> reads everything and answers
                  the inbox. <strong>Super admin</strong> can additionally move money, issue mosque
                  credentials and grant roles.
                </p>

                <Field label="Platform role">
                  <select
                    value={user.platformRole}
                    disabled={!canWrite || busy}
                    onChange={(event) =>
                      run(
                        () =>
                          api
                            .setPlatformRole(id, event.target.value as PlatformRole)
                            .then(state.reload),
                        'Platform role updated.',
                      )
                    }
                  >
                    <option value="none">None — ordinary account</option>
                    <option value="support">Support</option>
                    <option value="superadmin">Super admin</option>
                  </select>
                </Field>

                {isSelf && (
                  <p className="muted" style={{ fontSize: 12.5 }}>
                    This is your own account. You cannot remove your own platform role — the server
                    refuses, so the console cannot be left with nobody able to run it.
                  </p>
                )}

                <Field
                  label="Interests"
                  hint="What they told us they care about. Drives campaign targeting and push."
                >
                  <div className="row">
                    {user.interests.length ? (
                      user.interests.map((interest) => (
                        <Badge tone="neutral" key={interest}>
                          {interest}
                        </Badge>
                      ))
                    ) : (
                      <span className="muted">None set.</span>
                    )}
                  </div>
                </Field>
              </Card>
            </div>
          </div>

          {credential && (
            <CredentialSlip
              title="New password"
              credential={{ email: user.email, password: credential.password, name: user.name }}
              onClose={() => setCredential(undefined)}
            />
          )}

          {grantOpen && (
            <GrantDialog
              userId={id}
              onClose={() => setGrantOpen(false)}
              onSaved={() => {
                setGrantOpen(false);
                state.reload();
              }}
            />
          )}
        </>
      )}
    </Async>
  );
}

/** Give someone a role at a mosque they hold no membership at yet. */
function GrantDialog({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const mosques = useAsync(() => api.mosques({ pageSize: 200, sort: 'name', dir: 'asc' }), []);
  const { busy, run } = useAction();
  const [mosqueId, setMosqueId] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('admin');

  return (
    <Modal
      title="Set a mosque role"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || !mosqueId}
            onClick={() =>
              run(async () => {
                await api.setMembership(userId, mosqueId, role);
                onSaved();
              }, 'Role granted.')
            }
          >
            Save
          </button>
        </>
      }
    >
      <Field label="Mosque">
        <select value={mosqueId} onChange={(event) => setMosqueId(event.target.value)}>
          <option value="">Choose a mosque…</option>
          {(mosques.data?.items ?? []).map((mosque) => (
            <option key={mosque.mosqueId} value={mosque.mosqueId}>
              {mosque.name} — {mosque.city}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Role">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as 'member' | 'admin')}
        >
          <option value="admin">Coordinator</option>
          <option value="member">Member</option>
        </select>
      </Field>
      <p className="muted" style={{ fontSize: 12.5 }}>
        This grants the role only. It does not change their password — use{' '}
        <strong>Issue credentials</strong> on the mosque if they also need a new account.
      </p>
    </Modal>
  );
}
