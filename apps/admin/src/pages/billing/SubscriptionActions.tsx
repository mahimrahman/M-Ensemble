import { useState } from 'react';
import type { CheckoutLink, Province, Subscription } from '@m-ensemble/shared';
import { ApiError, api } from '@/api';
import { useWriteGuard } from '@/auth';
import { Badge, Modal, useAction, useToast } from '@/ui';
import { PROVINCES, dateTime } from '@/lib/format';
import { openInNewTab, viaStripe } from '@/lib/stripe';

/**
 * The Stripe side of one subscription, as buttons.
 *
 * Lives in one file because it appears in two places — the billing table and
 * the mosque's own page — and the two must not drift: an operator who learns
 * "Payment link" on one screen expects the same button to do the same thing on
 * the other. Every action is a write and so is gated behind `useWriteGuard`.
 *
 * Nothing here charges anybody. Each button fetches a hosted Stripe page and
 * either hands the link to the operator or opens it; the mosque does the
 * paying, and the webhook does the bookkeeping.
 */

/** `stripe` / `manual` as a badge. Unset means nobody has paid by card yet. */
export function CollectionBadge({
  collection,
}: {
  collection: Subscription['collection'];
}): React.JSX.Element {
  return collection === 'stripe' ? (
    <Badge tone="brand">Stripe</Badge>
  ) : (
    <Badge tone="neutral">Manual</Badge>
  );
}

/**
 * Stripe's own invoice statuses, coloured the way the invoices tab colours
 * ours. A dash rather than a badge when there has never been one — most
 * manually-collected mosques will never have one, and a column of "none"
 * badges is noise.
 */
export function StripeInvoiceBadge({ status }: { status?: string }): React.JSX.Element {
  if (!status) return <span className="muted">—</span>;
  const tone =
    status === 'paid'
      ? 'good'
      : status === 'open' || status === 'draft'
        ? 'warning'
        : status === 'uncollectible'
          ? 'critical'
          : 'neutral';
  return <Badge tone={tone}>{status}</Badge>;
}

/** The tax province for a subscription's invoices. Saves on change. */
export function ProvinceSelect({
  subscription,
  onChanged,
}: {
  subscription: Subscription;
  onChanged: () => void;
}): React.JSX.Element {
  const { canWrite } = useWriteGuard();
  const { busy, run } = useAction();
  return (
    <select
      aria-label="Tax province"
      // QC is the server's default when the field is unset, so show that
      // rather than a blank the operator thinks they still have to fill.
      value={subscription.province ?? 'QC'}
      disabled={!canWrite || busy}
      onChange={(event) =>
        run(
          () =>
            api
              .updateSubscription(subscription._id, {
                province: event.target.value as Province,
              })
              .then(onChanged),
          'Province updated.',
        )
      }
    >
      {PROVINCES.map((p) => (
        <option key={p.code} value={p.code}>
          {p.code} — {p.label}
        </option>
      ))}
    </select>
  );
}

export function SubscriptionActions({
  subscription,
  onChanged,
  size,
}: {
  subscription: Subscription;
  /** Called after a write, so the owning screen refetches. */
  onChanged: () => void;
  /** `sm` inside a table row; default elsewhere. */
  size?: 'sm';
}): React.JSX.Element {
  const { canWrite, reason } = useWriteGuard();
  const { busy, run } = useAction();
  const [link, setLink] = useState<CheckoutLink>();
  const [blocked, setBlocked] = useState<CheckoutLink>();
  const cls = `btn${size === 'sm' ? ' sm' : ''}`;
  const manual = subscription.collection !== 'stripe';

  const paymentLink = () =>
    run(async () => {
      setLink(await viaStripe(() => api.subscriptionCheckout(subscription._id)));
    });

  const portal = () =>
    run(async () => {
      const page = await viaStripe(() => api.subscriptionPortal(subscription._id)).catch(
        (err: unknown) => {
          // The server's 409 is accurate but terse. Say what to do instead.
          if (err instanceof ApiError && err.status === 409) {
            throw new ApiError(
              409,
              err.code,
              'The customer portal opens once the mosque has paid through Stripe at least once. Send them a payment link first.',
            );
          }
          throw err;
        },
      );
      if (!openInNewTab(page.url)) setBlocked(page);
    });

  const switchCollection = () =>
    run(
      () =>
        api
          .updateSubscription(subscription._id, { collection: manual ? 'stripe' : 'manual' })
          .then(onChanged),
      manual ? 'Now collected by Stripe.' : 'Now collected manually.',
    );

  return (
    <>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className={cls} disabled={!canWrite || busy} title={reason} onClick={paymentLink}>
          Payment link
        </button>
        <button
          className={cls}
          disabled={!canWrite || busy}
          title={reason ?? 'Opens Stripe’s portal, where the mosque manages its card and invoices.'}
          onClick={portal}
        >
          Customer portal
        </button>
        <button
          className={cls}
          disabled={!canWrite || busy}
          title={reason}
          onClick={switchCollection}
        >
          {manual ? 'Switch to Stripe' : 'Switch to manual'}
        </button>
      </div>

      {link && (
        <PaymentLinkDialog
          subscription={subscription}
          link={link}
          onClose={() => setLink(undefined)}
        />
      )}

      {blocked && (
        <Modal
          title="Customer portal"
          onClose={() => setBlocked(undefined)}
          footer={
            <>
              <button className="btn" onClick={() => setBlocked(undefined)}>
                Close
              </button>
              <a
                className="btn primary"
                style={{ textDecoration: 'none' }}
                href={blocked.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => setBlocked(undefined)}
              >
                Open the portal
              </a>
            </>
          }
        >
          <p style={{ marginTop: 0 }} className="muted">
            Your browser blocked the new tab. The link is below — it is for the mosque, so do not
            change anything in there on their behalf.
          </p>
          <div className="credential">{blocked.url}</div>
        </Modal>
      )}
    </>
  );
}

/**
 * The Checkout link, ready to hand over.
 *
 * Two ways out: copy it into whatever channel you already use with that
 * mosque, or have the server email it to every coordinator. The second is the
 * default path and the first is for the mosque whose coordinator email bounces.
 */
function PaymentLinkDialog({
  subscription,
  link,
  onClose,
}: {
  subscription: Subscription;
  link: CheckoutLink;
  onClose: () => void;
}): React.JSX.Element {
  const toast = useToast();
  const { busy, run } = useAction();
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<number>();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard is blocked outside a secure context. The URL is selectable
      // text either way, so this is a convenience failing, not the feature.
      setCopied(false);
    }
  };

  const email = () =>
    run(async () => {
      const result = await viaStripe(() => api.subscriptionSendCheckout(subscription._id));
      setSent(result.sent);
      toast(`Sent to ${result.sent} coordinator${result.sent === 1 ? '' : 's'}.`);
    });

  return (
    <Modal
      title="Payment link"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button className="btn primary" disabled={busy || sent !== undefined} onClick={email}>
            {busy ? 'Sending…' : sent !== undefined ? 'Emailed' : 'Email to mosque'}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }} className="muted">
        A Stripe Checkout page for this mosque’s subscription. Whoever opens it pays by card, and
        the subscription updates itself when Stripe confirms.
        {link.expiresAt && <> It stops working {dateTime(link.expiresAt)}.</>}
      </p>
      <div className="credential">{link.url}</div>
      {sent === 0 && (
        <div className="alert warning" style={{ marginTop: 12 }}>
          <div>
            <b>Nobody to send it to.</b>
            This mosque has no coordinator with an email address. Copy the link and send it another
            way, or issue credentials first.
          </div>
        </div>
      )}
    </Modal>
  );
}
