/**
 * Likes and saves. Both are a personal mark on a post — "I care about this",
 * "I'll come back to this" — and neither is anything the server needs to know
 * about yet, so they live on the device, keyed by the signed-in user so two
 * accounts on one phone don't share a bookmark list.
 *
 * If PHASE 4 ever wants likes as a signal for the coordinator, this is the
 * one place that changes: same `toggle` API, backed by the client instead.
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

type Kind = 'liked' | 'saved';

interface SavedContextValue {
  savedIds: ReadonlySet<ID>;
  likedIds: ReadonlySet<ID>;
  isSaved: (postId: ID) => boolean;
  isLiked: (postId: ID) => boolean;
  toggleSaved: (postId: ID) => void;
  toggleLiked: (postId: ID) => void;
}

const SavedContext = createContext<SavedContextValue | null>(null);

function storageKey(kind: Kind, userId: string): string {
  return `mensemble.${kind}.${userId}`;
}

async function read(kind: Kind, userId: string): Promise<Set<ID>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(kind, userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((x): x is ID => typeof x === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?._id ?? null;
  const [saved, setSaved] = useState<Set<ID>>(new Set());
  const [liked, setLiked] = useState<Set<ID>>(new Set());

  // Reload whenever the account changes; clear on sign-out.
  useEffect(() => {
    if (!userId) {
      setSaved(new Set());
      setLiked(new Set());
      return;
    }
    let cancelled = false;
    void Promise.all([read('saved', userId), read('liked', userId)]).then(([s, l]) => {
      if (cancelled) return;
      setSaved(s);
      setLiked(l);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    (kind: Kind, postId: ID) => {
      const setter = kind === 'saved' ? setSaved : setLiked;
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        if (userId) {
          void AsyncStorage.setItem(storageKey(kind, userId), JSON.stringify([...next])).catch(
            () => {},
          );
        }
        return next;
      });
    },
    [userId],
  );

  const value = useMemo<SavedContextValue>(
    () => ({
      savedIds: saved,
      likedIds: liked,
      isSaved: (id) => saved.has(id),
      isLiked: (id) => liked.has(id),
      toggleSaved: (id) => toggle('saved', id),
      toggleLiked: (id) => toggle('liked', id),
    }),
    [saved, liked, toggle],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>.');
  return ctx;
}
