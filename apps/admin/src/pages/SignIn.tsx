import { useState } from 'react';
import { useAuth } from '@/auth';
import { ApiError } from '@/api';
import { Field } from '@/ui';

/**
 * The console's front door.
 *
 * Deliberately says nothing about what is behind it. The error for "no platform
 * role" is written by `auth.tsx` and is the one case where being specific helps
 * rather than leaks: it tells a mosque coordinator to use the app instead of
 * leaving them retyping a password that was correct all along.
 */
export function SignIn(): React.JSX.Element {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <form className="signin-card" onSubmit={submit}>
        <h1>M&apos;Ensemble Platform</h1>
        <p>Sign in with your platform administrator account.</p>

        {error && (
          <div className="alert critical" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        <Field label="Email">
          <input
            type="email"
            value={email}
            autoComplete="username"
            autoFocus
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <button className="btn primary" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
