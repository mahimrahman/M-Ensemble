/**
 * The starred mosque - whose prayer times the home screen shows.
 *
 * Following a mosque is about its posts; starring one is about its clock. They
 * are different questions, which is why this is not just "the first mosque you
 * follow": someone can follow five mosques for events and still pray at one.
 *
 * Exactly one at a time. "The star mosque" is singular by design - two starred
 * mosques would leave the home screen picking between them, and the person
 * would have no way to tell which it chose.
 *
 * Device-local and keyed by user, like `saved.tsx`: nothing on the server needs
 * to know, and two accounts on one phone should not share a choice. With
 * nothing starred the home screen falls back to generic times for the city,
 * which is why the value is allowed to be null rather than defaulting to
 * something arbitrary.
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
import { useAuth } from './auth';
import type { ID } from '@/types';

interface StarredContextValue {
  /** The mosque whose times the home screen shows, or null for the default. */
  starredId: ID | null;
  isStarred: (mosqueId: ID) => boolean;
  /** Star it, or un-star it if it is already the starred one. */
  toggleStarred: (mosqueId: ID) => void;
  /** True until the stored choice has been read back. */
  loading: boolean;
}

const StarredContext = createContext<StarredContextValue | null>(null);

const storageKey = (userId: string) => `mensemble.starredMosque.${userId}`;

export function StarredProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?._id ?? null;
  const [starredId, setStarredId] = useState<ID | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setStarredId(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void AsyncStorage.getItem(storageKey(userId))
      .then((stored) => {
        if (!cancelled) setStarredId(stored ?? null);
      })
      .catch(() => {
        // A read failure just means no star; the home screen has a fallback.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleStarred = useCallback(
    (mosqueId: ID) => {
      setStarredId((prev) => {
        // Tapping the star on the mosque that already holds it clears it,
        // which is the only way back to the default times.
        const next = prev === mosqueId ? null : mosqueId;
        if (userId) {
          const write = next
            ? AsyncStorage.setItem(storageKey(userId), next)
            : AsyncStorage.removeItem(storageKey(userId));
          void write.catch(() => {});
        }
        return next;
      });
    },
    [userId],
  );

  const value = useMemo<StarredContextValue>(
    () => ({
      starredId,
      isStarred: (id) => id === starredId,
      toggleStarred,
      loading,
    }),
    [starredId, toggleStarred, loading],
  );

  return <StarredContext.Provider value={value}>{children}</StarredContext.Provider>;
}

export function useStarred(): StarredContextValue {
  const ctx = useContext(StarredContext);
  if (!ctx) throw new Error('useStarred must be used inside <StarredProvider>.');
  return ctx;
}
