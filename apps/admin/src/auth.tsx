import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ApiError,
  UNAUTHORIZED_EVENT,
  api,
  storeToken,
  storedToken,
  type AdminSession,
} from '@/api';

/**
 * Who is signed in to the console.
 *
 * Sign-in goes through the **same** `POST /api/auth/login` the mobile app uses —
 * there is one account system, and a second one for staff would be a second
 * password to lose. What separates the console is what happens next:
 * `GET /admin/me` is behind `requirePlatform`, so an ordinary member's token
 * gets a 403 there and never reaches a screen.
 *
 * That check is a courtesy, not the security boundary. Every admin endpoint
 * carries its own guard, so a console rendered by a tampered client would still
 * be a wall of 403s.
 */

interface AuthValue {
  session: AdminSession | null;
  /** True until the stored token has been checked, so the app can hold its render. */
  checking: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  /** `superadmin` — the tier that may change anything. */
  canWrite: boolean;
}

const AuthContext = createContext<AuthValue>({
  session: null,
  checking: true,
  signIn: async () => {},
  signOut: () => {},
  canWrite: false,
});

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);

  const signOut = useCallback(() => {
    storeToken(null);
    setSession(null);
  }, []);

  // Validate whatever token survived the last visit. A token that is expired,
  // revoked, or belongs to an account since suspended must not leave the console
  // sitting on a shell whose every request fails.
  useEffect(() => {
    if (!storedToken()) {
      setChecking(false);
      return;
    }
    api
      .session()
      .then(setSession)
      .catch(() => storeToken(null))
      .finally(() => setChecking(false));
  }, []);

  // One listener for the whole app: any 401 from any request signs out once,
  // rather than each screen inventing its own handling.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    storeToken(result.token);
    try {
      setSession(await api.session());
    } catch (err) {
      // A correct password on an account with no platform role. Drop the token
      // rather than leave one behind that opens nothing, and say plainly what
      // happened — "wrong password" here would send someone hunting for hours.
      storeToken(null);
      if (err instanceof ApiError && err.status === 403) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'That account is not a platform administrator. Mosque coordinators sign in through the app.',
        );
      }
      throw err;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        checking,
        signIn,
        signOut,
        canWrite: session?.platformRole === 'superadmin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthValue => useContext(AuthContext);

/**
 * Guards a control that only `superadmin` may use.
 *
 * Renders the control disabled with an explanation for a `support` account
 * rather than hiding it — a button that is missing looks like a bug, and a
 * support user who cannot see the action cannot know to ask for it.
 */
export function useWriteGuard(): { canWrite: boolean; reason: string | undefined } {
  const { canWrite } = useAuth();
  return {
    canWrite,
    reason: canWrite ? undefined : 'Only a super admin can do this.',
  };
}
