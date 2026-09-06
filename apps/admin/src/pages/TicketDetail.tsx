import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { TicketPriority, TicketStatus } from '@m-ensemble/shared';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { Async, Badge, Card, Field, PageHeader, useAction, useAsync } from '@/ui';
import { PRIORITY_TONE, STATUS_TONE } from '@/pages/Support';
import { dateTime, humanise, relative } from '@/lib/format';

/**
 * One ticket, whole.
 *
 * Two kinds of message, and the difference is visible at a glance rather than
 * behind a label: a **reply** the reporter will read, and an **internal note**
 * only the team sees. Getting those two confused is the single worst thing that
 * can happen on a support screen, so the note editor is a different colour, is
 * marked with a dashed border in the thread, and says who can see it.
 */
export function TicketDetail(): React.JSX.Element {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const state = useAsync(() => api.ticket(id), [id]);
  const { busy, run } = useAction();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);

  const send = () =>
    run(
      async () => {
        await api.replyToTicket(id, body, internal);
        setBody('');
        state.reload();
      },
      internal ? 'Note added.' : 'Reply sent.',
    );

  return (
    <Async state={state}>
      {(ticket) => (
        <>
          <PageHeader
            crumb={`Support · ${ticket.reference}`}
            title={ticket.subject}
            subtitle={`Opened ${dateTime(ticket.createdAt)}${
              ticket.userName ? ` by ${ticket.userName}` : ''
            }`}
            actions={
              <div className="row">
                {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => api.updateTicket(id, { status: 'resolved' }).then(state.reload),
                        'Marked resolved.',
                      )
                    }
                  >
                    Mark resolved
                  </button>
                )}
                {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => api.updateTicket(id, { status: 'open' }).then(state.reload),
                        'Reopened.',
                      )
                    }
                  >
                    Reopen
                  </button>
                )}
              </div>
            }
          />

          <div className="grid split">
            <div className="stack">
              <Card title={`Thread (${ticket.messages.length})`}>
                <div className="thread">
                  {ticket.messages.map((message) => (
                    <article
                      key={message._id}
                      className={`msg${message.internal ? ' internal' : message.fromStaff ? ' staff' : ''}`}
                    >
                      <header>
                        <b>{message.authorName}</b>
                        {message.internal ? (
                          <Badge tone="warning">Internal note</Badge>
                        ) : message.fromStaff ? (
                          <Badge tone="brand">Us</Badge>
                        ) : (
                          <Badge tone="neutral">Reporter</Badge>
                        )}
                        <span style={{ marginLeft: 'auto' }}>{relative(message.createdAt)}</span>
                      </header>
                      <p>{message.body}</p>
                    </article>
                  ))}
                </div>
              </Card>

              <Card title={internal ? 'Internal note' : 'Reply to the reporter'}>
                <label className="row" style={{ gap: 8, marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={internal}
                    onChange={(event) => setInternal(event.target.checked)}
                  />
                  <span>
                    Internal note — <span className="muted">only the team sees this</span>
                  </span>
                </label>

                <textarea
                  value={body}
                  rows={5}
                  placeholder={
                    internal
                      ? 'What you found, what you tried, what to do next.'
                      : 'What you are doing about it.'
                  }
                  onChange={(event) => setBody(event.target.value)}
                  style={
                    internal
                      ? { borderColor: 'var(--warning)', background: 'var(--warning-soft)' }
                      : undefined
                  }
                />

                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    className="btn primary"
                    disabled={busy || body.trim().length < 1}
                    onClick={send}
                  >
                    {busy ? 'Sending…' : internal ? 'Add note' : 'Send reply'}
                  </button>
                </div>

                {!internal && (
                  <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
                    A reply moves an open ticket to <strong>pending</strong> — the ball is with the
                    reporter. Them writing back reopens it.
                  </p>
                )}
              </Card>
            </div>

            <Card title="Details">
              <Field label="Status">
                <select
                  value={ticket.status}
                  disabled={busy}
                  onChange={(event) =>
                    run(
                      () =>
                        api
                          .updateTicket(id, { status: event.target.value as TicketStatus })
                          .then(state.reload),
                      'Status updated.',
                    )
                  }
                >
                  {['open', 'pending', 'resolved', 'closed'].map((status) => (
                    <option key={status} value={status}>
                      {humanise(status)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Priority">
                <select
                  value={ticket.priority}
                  disabled={busy}
                  onChange={(event) =>
                    run(
                      () =>
                        api
                          .updateTicket(id, { priority: event.target.value as TicketPriority })
                          .then(state.reload),
                      'Priority updated.',
                    )
                  }
                >
                  {['low', 'normal', 'high', 'urgent'].map((priority) => (
                    <option key={priority} value={priority}>
                      {humanise(priority)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="row" style={{ marginBottom: 14 }}>
                <Badge tone={STATUS_TONE[ticket.status] ?? 'neutral'}>{ticket.status}</Badge>
                <Badge tone={PRIORITY_TONE[ticket.priority] ?? 'neutral'}>{ticket.priority}</Badge>
                <Badge tone="neutral">{humanise(ticket.category)}</Badge>
              </div>

              <dl className="kv">
                <dt>Reference</dt>
                <dd className="mono">{ticket.reference}</dd>
                <dt>Reporter</dt>
                <dd>
                  {ticket.userId ? (
                    <Link to={`/users/${ticket.userId}`}>{ticket.userName}</Link>
                  ) : (
                    <span className="muted">Not linked to an account</span>
                  )}
                </dd>
                <dt>Email</dt>
                <dd>{ticket.userEmail ?? '—'}</dd>
                <dt>Mosque</dt>
                <dd>
                  {ticket.mosqueId ? (
                    <Link to={`/mosques/${ticket.mosqueId}`}>Open mosque →</Link>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </dd>
                <dt>Assigned to</dt>
                <dd>{ticket.assignedToName ?? <span className="muted">Nobody</span>}</dd>
                <dt>Opened</dt>
                <dd>{dateTime(ticket.createdAt)}</dd>
                {ticket.resolvedAt && (
                  <>
                    <dt>Resolved</dt>
                    <dd>
                      {dateTime(ticket.resolvedAt)}
                      {ticket.resolutionHours ? (
                        <span className="muted"> · {ticket.resolutionHours}h</span>
                      ) : null}
                    </dd>
                  </>
                )}
              </dl>

              {ticket.assignedTo !== session?.userId && (
                <button
                  className="btn"
                  style={{ marginTop: 14, width: '100%' }}
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api.updateTicket(id, { assignedTo: session?.userId }).then(state.reload),
                      'Assigned to you.',
                    )
                  }
                >
                  Assign to me
                </button>
              )}
            </Card>
          </div>
        </>
      )}
    </Async>
  );
}
