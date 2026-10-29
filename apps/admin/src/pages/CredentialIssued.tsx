import { useState } from 'react';
import { Modal } from '@/ui';

/**
 * What the operator sees after a password is minted.
 *
 * The server emails the person their sign-in details, so the normal outcome of
 * this dialog is reading one line and closing it. The plaintext is still in the
 * response — nothing stores it, not the database, not the audit log — and it
 * is here behind a disclosure for the one case that matters: the email did not
 * arrive, and the coordinator is on the phone. Collapsed by default because a
 * password on screen gets photographed, and read aloud from a screen is the
 * only way it should travel if it travels at all.
 *
 * Works the same whether or not the server actually sent the email: the
 * response shape is identical, so the operator has the password either way and
 * the wording only promises what the server is meant to do.
 */
export function CredentialIssued({
  credential,
  onClose,
  title = 'Coordinator credentials',
}: {
  credential: { email: string; password: string; name?: string };
  onClose: () => void;
  title?: string;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credential.password);
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
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="alert good" style={{ marginBottom: 16 }}>
        <div>
          <b>Credentials were emailed to {credential.email}</b>
          {credential.name ? `${credential.name} signs` : 'They sign'} in with that address and the
          one-time password in the email, and chooses a new password on first sign-in.
        </div>
      </div>

      <details>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>
          Show password (only if the email didn’t arrive)
        </summary>

        <div className="alert warning" style={{ margin: '12px 0' }}>
          <div>
            <b>This is the only time it is shown.</b>
            It is not stored anywhere in readable form, so it cannot be looked up later — if it is
            lost, reset it. Read it to them; don’t paste it into a chat.
          </div>
        </div>

        <p className="muted" style={{ margin: '0 0 4px', fontSize: 12 }}>
          One-time password
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
          <div className="credential" style={{ flex: 1 }}>
            {credential.password}
          </div>
          <button className="btn" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </details>
    </Modal>
  );
}
