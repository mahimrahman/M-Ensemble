/**
 * Session state. Who is signed in, a token that survives a reload, whether they
 * still owe us onboarding, and which mosques they coordinate. PHASE 5 swaps the
 * mock token for a real JWT without touching anything that reads this context.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiRequestError, api, setAuthToken } from '@/api/client';
import type { ID, Membership, SignupInput, User } from '@/types';

const TOKEN_KEY = 'mensemble.token';
const USER_KEY = 'mensemble.user';
const ONBOARDING_KEY = 'mensemble.needsOnboarding';
const SESSION_KEYS = [TOKEN_KEY, USER_KEY, ONBOARDING_KEY];

/** The API said the token is dead. Anything else (server down) is not this. */
function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === 401;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** True from account creation until the mosque + interests steps are done. */
  needsOnboarding: boolean;
  /** Every role this user holds. Loaded after sign-in; empty for plain members. */
  memberships: Membership[];
  /** Mosques where the role is `admin` — gates the Manage tab. */
  adminMosqueIds: ID[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignupInput) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Refresh the cached user after a profile edit. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUserState] = useState<User | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [token, raw, onboarding] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
        ]);
        if (cancelled) return;

        if (!token || !raw) {
          setStatus('unauthenticated');
          return;
        }

        // Open on the cached session straight away — no spinner on a warm
        // start — then confirm it with the API.
        setAuthToken(token);
        setUserState(JSON.parse(raw) as User);
        setNeedsOnboarding(onboarding === 'true');
        setStatus('authenticated');

        try {
          const fresh = await api.me();
          if (cancelled) return;
          setUserState(fresh);
          void AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
        } catch (err) {
          if (cancelled) return;
          // An expired JWT (or a mock account that didn't survive the reload)
          // signs out cleanly instead of stranding every screen on a 401. A
          // server that's merely unreachable keeps the cached session.
          if (isUnauthorized(err)) {
            setAuthToken(null);
            setUserState(null);
            setNeedsOnboarding(false);
            setStatus('unauthenticated');
            await AsyncStorage.multiRemove(SESSION_KEYS);
          }
        }
      } catch {
        if (!cancelled) setStatus('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Roles ride along with the session. The client knows who's signed in
  // before this runs: `persist` follows `api.login`, and a cold start hands
  // the stored token to `setAuthToken` first.
  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      setMemberships([]);
      return;
    }
    let cancelled = false;
    api
      .getMyMemberships()
      .then((list) => {
        if (!cancelled) setMemberships(list);
      })
      .catch(() => {
        if (!cancelled) setMemberships([]);
      });
    return () => {
      cancelled = true;
    };
  }, [status, user?._id]);

  const persist = useCallback(async (token: string, nextUser: User, onboarding: boolean) => {
    setAuthToken(token);
    setUserState(nextUser);
    setNeedsOnboarding(onboarding);
    setStatus('authenticated');
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(nextUser)],
      [ONBOARDING_KEY, String(onboarding)],
    ]);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password);
      await persist(result.token, result.user, false);
    },
    [persist],
  );

  const signUp = useCallback(
    async (input: SignupInput) => {
      const result = await api.signupAccount(input);
      await persist(result.token, result.user, true);
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUserState(null);
    setNeedsOnboarding(false);
    setMemberships([]);
    setStatus('unauthenticated');
    await AsyncStorage.multiRemove(SESSION_KEYS);
  }, []);

  const completeOnboarding = useCallback(async () => {
    setNeedsOnboarding(false);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'false');
  }, []);

  const setUser = useCallback((next: User) => {
    setUserState(next);
    void AsyncStorage.setItem(USER_KEY, JSON.stringify(next));
  }, []);

  const adminMosqueIds = useMemo(
    () => memberships.filter((m) => m.role === 'admin').map((m) => m.mosqueId),
    [memberships],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      needsOnboarding,
      memberships,
      adminMosqueIds,
      signIn,
      signUp,
      signOut,
      completeOnboarding,
      setUser,
    }),
    [
      status,
      user,
      needsOnboarding,
      memberships,
      adminMosqueIds,
      signIn,
      signUp,
      signOut,
      completeOnboarding,
      setUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}
