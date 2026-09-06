import { useState } from 'react';
import type { IssuedCredential } from '@m-ensemble/shared';
import { Modal } from '@/ui';

/**
 * The one and only time a provisioned password is readable.
 *
 * Nothing stores the plaintext — not the database, not the audit log, not this
 * component beyond the life of the dialog. A password that is lost is reset, not
 * looked up, and the dialog says so plainly rather than letting somebody close
 * it assuming they can come back for it.
 *
 * There is no "email this to them" button, because there is no mail transport
 * wired yet and a button that silently does nothing is worse than none. Copy it
 * and send it however you already talk to that mosque.
 */
export function CredentialSlip({
  credential,
  onClose,
  title = 'Coordinator credentials',
}: {
  credential: IssuedCredential | { email: string; password: string; name?: string };
  onClose: () => void;
  title?: string;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = `M'Ensemble sign-in\nEmail: ${credential.email}\nPassword: ${credential.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard is blocked outside a secure context and in some browsers.
      // The value is selectable text either way, so this is a convenience
      // failing, not the feature failing.
      setCopied(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={copy}>
            {copied ? 'Copied' : 'Copy both'}
          </button>
          <button className="btn primary" onClick={onClose}>
            I have saved this
          </button>
        </>
      }
    >
      <div className="alert warning" style={{ marginBottom: 16 }}>
        <div>
          <b>This password is shown once.</b>
          It is not stored anywhere in readable form, so it cannot be looked up later — if it is
          lost, issue a new one.
        </div>
      </div>

      {'name' in credential && credential.name && (
        <p style={{ marginTop: 0 }}>
          For <strong>{credential.name}</strong>. They will be asked to choose their own password on
          first sign-in.
        </p>
      )}

      <p className="muted" style={{ margin: '0 0 4px', fontSize: 12 }}>
        Email
      </p>
      <div className="credential" style={{ marginBottom: 12 }}>
        {credential.email}
      </div>

      <p className="muted" style={{ margin: '0 0 4px', fontSize: 12 }}>
        Password
      </p>
      <div className="credential">{credential.password}</div>
    </Modal>
  );
}
