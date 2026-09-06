import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PaymentMethod } from '@m-ensemble/shared';
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
import { Meter } from '@/ui/charts';
import { date, dateTime, humanise, money } from '@/lib/format';

/**
 * One invoice and the payments against it.
 *
 * The payment form takes a **signed** amount on purpose: a payment recorded in
 * error is corrected with a negative row rather than edited away. Cash that was
 * reconciled once and then quietly changed is exactly what an audit trail is
 * meant to catch.
 */

const TONE: Record<string, Tone> = {
  paid: 'good',
  open: 'warning',
  draft: 'neutral',
  void: 'neutral',
  uncollectible: 'critical',
};

const METHODS: PaymentMethod[] = ['etransfer', 'cheque', 'cash', 'card', 'manual', 'other'];

export function InvoiceDetail(): React.JSX.Element {
  const { id = '' } = useParams();
  const state = useAsync(() => api.invoice(id), [id]);
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);

  return (
    <Async state={state}>
      {({ invoice, payments }) => {
        const overdue = invoice.status === 'open' && new Date(invoice.dueAt) < new Date();

        return (
          <>
            <PageHeader
              crumb="Billing"
              title={invoice.number}
              subtitle={`${humanise(invoice.kind)} · issued ${date(invoice.issuedAt)} · due ${date(invoice.dueAt)}`}
              actions={
                <div className="row">
                  {invoice.status === 'draft' && (
                    <button
                      className="btn"
                      disabled={!canWrite || busy}
                      title={reason}
                      onClick={() =>
                        run(() => api.issueInvoice(id).then(state.reload), 'Invoice issued.')
                      }
                    >
                      Issue
                    </button>
                  )}
                  {invoice.status !== 'void' && invoice.status !== 'paid' && (
                    <button
                      className="btn danger"
                      disabled={!canWrite}
                      title={reason}
                      onClick={() => setVoiding(true)}
                    >
                      Void
                    </button>
                  )}
                  {invoice.status !== 'void' && (
                    <button
                      className="btn primary"
                      disabled={!canWrite}
                      title={reason}
                      onClick={() => setPaying(true)}
                    >
                      Record a payment
                    </button>
                  )}
                </div>
              }
            />

            <div className="stack">
              {overdue && (
                <div className="alert critical">
                  <div>
                    <b>Overdue.</b>
                    {money(invoice.dueCents)} was due on {date(invoice.dueAt)}.
                  </div>
                </div>
              )}

              <div className="grid split">
                <Card title="Lines" padded={false}>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th className="num">Qty</th>
                          <th className="num">Unit</th>
                          <th className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.lines.map((line, index) => (
                          <tr key={index}>
                            <td>{line.description}</td>
                            <td className="num">{line.quantity}</td>
                            <td className="num">{money(line.unitCents)}</td>
                            <td className="num">{money(line.amountCents)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} className="num muted">
                            Subtotal
                          </td>
                          <td className="num">{money(invoice.subtotalCents)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="num muted">
                            Tax
                          </td>
                          <td className="num">{money(invoice.taxCents)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="num">
                            <strong>Total</strong>
                          </td>
                          <td className="num">
                            <strong>{money(invoice.totalCents)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card title="Status">
                  <div style={{ marginBottom: 16 }}>
                    <Badge tone={TONE[invoice.status] ?? 'neutral'}>{invoice.status}</Badge>
                  </div>

                  <Meter
                    label="Paid"
                    value={invoice.paidCents}
                    max={invoice.totalCents}
                    format={money}
                    tone={overdue ? 'critical' : 'default'}
                  />

                  <dl className="kv" style={{ marginTop: 16 }}>
                    <dt>Billed to</dt>
                    <dd>
                      {invoice.mosqueId ? (
                        <Link to={`/mosques/${invoice.mosqueId}`}>A mosque →</Link>
                      ) : invoice.advertiserId ? (
                        <Link to="/partners">A partner →</Link>
                      ) : (
                        '—'
                      )}
                    </dd>
                    <dt>Owing</dt>
                    <dd className="num">{money(invoice.dueCents)}</dd>
                    <dt>Paid on</dt>
                    <dd>{invoice.paidAt ? date(invoice.paidAt) : '—'}</dd>
                    {invoice.note && (
                      <>
                        <dt>Note</dt>
                        <dd>{invoice.note}</dd>
                      </>
                    )}
                  </dl>
                </Card>
              </div>

              <Card title={`Payments (${payments.length})`} padded={false}>
                <DataTable
                  columns={[
                    {
                      key: 'receivedAt',
                      header: 'Received',
                      render: (row) => dateTime(row.receivedAt),
                    },
                    {
                      key: 'amountCents',
                      header: 'Amount',
                      align: 'right',
                      render: (row) =>
                        row.amountCents < 0 ? (
                          <span style={{ color: 'var(--critical)' }}>{money(row.amountCents)}</span>
                        ) : (
                          money(row.amountCents)
                        ),
                    },
                    { key: 'method', header: 'Method', render: (row) => humanise(row.method) },
                    {
                      key: 'reference',
                      header: 'Reference',
                      render: (row) => <span className="mono">{row.reference ?? '—'}</span>,
                    },
                    {
                      key: 'note',
                      header: 'Note',
                      render: (row) => <span className="cell-sub">{row.note ?? '—'}</span>,
                    },
                  ]}
                  rows={payments}
                  empty="Nothing recorded against this invoice yet."
                />
              </Card>
            </div>

            {paying && (
              <Modal
                title="Record a payment"
                onClose={() => setPaying(false)}
                footer={
                  <PaymentFooter
                    invoiceId={id}
                    onDone={() => {
                      setPaying(false);
                      state.reload();
                    }}
                    onCancel={() => setPaying(false)}
                    outstanding={invoice.dueCents}
                  />
                }
              >
                <p className="muted" style={{ marginTop: 0 }}>
                  This records money that arrived somewhere else — a transfer, a cheque, cash in an
                  envelope. Nothing is charged from here.
                </p>
                <p className="muted" style={{ fontSize: 12.5 }}>
                  To correct a payment entered in error, record a <strong>negative</strong> amount
                  rather than editing the original. The original stays on the record.
                </p>
              </Modal>
            )}

            {voiding && (
              <VoidDialog
                invoiceId={id}
                number={invoice.number}
                onClose={() => setVoiding(false)}
                onDone={() => {
                  setVoiding(false);
                  state.reload();
                }}
              />
            )}
          </>
        );
      }}
    </Async>
  );
}

/**
 * The payment form lives in the modal footer because the fields and the submit
 * button share state, and lifting that state above the modal would put a form's
 * internals in the page component.
 */
function PaymentFooter({
  invoiceId,
  outstanding,
  onDone,
  onCancel,
}: {
  invoiceId: string;
  outstanding: number;
  onDone: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [amount, setAmount] = useState((outstanding / 100).toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>('etransfer');
  const [reference, setReference] = useState('');

  return (
    <div style={{ width: '100%' }}>
      <div className="grid cols-3" style={{ marginBottom: 12 }}>
        <Field label="Amount (CAD)">
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Method">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {humanise(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference">
          <input
            type="text"
            placeholder="Cheque no. / confirmation"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={busy || Number(amount) === 0 || Number.isNaN(Number(amount))}
          onClick={() =>
            run(async () => {
              await api.recordPayment(invoiceId, {
                amountCents: Math.round(Number(amount) * 100),
                method,
                reference: reference || undefined,
              });
              onDone();
            }, 'Payment recorded.')
          }
        >
          {busy ? 'Recording…' : 'Record'}
        </button>
      </div>
    </div>
  );
}

function VoidDialog({
  invoiceId,
  number,
  onClose,
  onDone,
}: {
  invoiceId: string;
  number: string;
  onClose: () => void;
  onDone: () => void;
}): React.JSX.Element {
  const { busy, run } = useAction();
  const [reason, setReason] = useState('');

  return (
    <Modal
      title={`Void ${number}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Keep it
          </button>
          <button
            className="btn danger"
            disabled={busy || reason.trim().length < 3}
            onClick={() =>
              run(async () => {
                await api.voidInvoice(invoiceId, reason);
                onDone();
              }, 'Invoice voided.')
            }
          >
            Void it
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>
        Voiding writes off what is owed and takes it out of the outstanding total. The invoice stays
        on the record, and so does this reason and who wrote it.
      </p>
      <Field label="Why" hint="Required — it goes in the audit log.">
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </Modal>
  );
}
