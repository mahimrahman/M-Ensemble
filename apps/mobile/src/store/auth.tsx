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
import { api, setAuthToken } from '@/api/client';
import type { ID, Membership, SignupInput, User } from '@/types';

const TOKEN_KEY = 'mensemble.token';
const USER_KEY = 'mensemble.user';
const ONBOARDING_KEY = 'mensemble.needsOnboarding';

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

        if (token && raw) {
          setAuthToken(token);
          setUserState(JSON.parse(raw) as User);
          setNeedsOnboarding(onboarding === 'true');
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      } catch {
        if (!cancelled) setStatus('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Roles ride along with the session. On mocks the mock client has to know
  // who's signed in before this resolves — `persist` runs after `api.login`,
  // so it does.
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
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ONBOARDING_KEY]);
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
