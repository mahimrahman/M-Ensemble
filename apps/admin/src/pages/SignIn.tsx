import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth';
import { ApiError } from '@/api';

/**
 * The console's front door.
 *
 * Deliberately the **same screen as the app's login**, at desk scale: the whole
 * page is the masthead gradient, the lockup sits over it, and the form floats
 * on a white card. Somebody who signs in to both should not feel they have
 * arrived at a different company — so the measurements here (52px controls,
 * 1.5px borders that go teal on focus, 18px card radius, the overline labels)
 * are the app's own, not approximations of them.
 *
 * It says nothing about what is behind it, and nothing is prefilled. The app's
 * login has one-tap demo buttons; this one must not, because the accounts it
 * opens can move money and mint mosque logins.
 */
export function SignIn(): React.JSX.Element {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  /**
   * Three failures worth telling apart, because each sends you somewhere else:
   * the server is not running, the credentials are wrong, or the account is
   * real but not a platform one. The last message is written in `auth.tsx`.
   */
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <div className="signin-inner">
        {/* The on-dark cut — the master's black crescent becomes white there,
            so the shape survives the gradient. */}
        <img className="signin-logo" src="/logo-on-dark.png" alt="M'Ensemble" />

        <form className="signin-card" onSubmit={submit} noValidate>
          <div className="signin-head">
            <span className="signin-badge">
              <ShieldCheck size={15} strokeWidth={2.2} />
              Platform console
            </span>
            <h1>Sign in</h1>
            <p>For platform administrators and support staff.</p>
          </div>

          {/* Announced, not merely shown — a failure nobody's screen reader
              reads is a form that silently does nothing. */}
          <div role="alert" aria-live="polite">
            {error && <div className="alert critical signin-error">{error}</div>}
          </div>

          <label className="signin-field">
            <span>Email</span>
            <input
              type="email"
              inputMode="email"
              value={email}
              autoComplete="username"
              autoFocus
              required
              placeholder="you@example.com"
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="signin-field">
            <span>Password</span>
            <span className="signin-secret">
              <input
                type={reveal ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="signin-reveal"
                onClick={() => setReveal((r) => !r)}
                // A provisioned password is fourteen characters of mixed case
                // typed off a slip. Being able to see it is the difference
                // between one attempt and four.
                aria-label={reveal ? 'Hide password' : 'Show password'}
                title={reveal ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>

          <button
            className="btn primary signin-submit"
            disabled={busy || !email.trim() || !password}
          >
            {busy ? (
              <>
                <span className="spinner on-dark" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="signin-note">
          Mosque coordinators sign in through the M&apos;Ensemble app, not here.
        </p>
      </div>
    </div>
  );
}
