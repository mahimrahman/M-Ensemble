/**
 * Likes and saves. Both are a personal mark on a post — "I care about this",
 * "I'll come back to this" — but they are not the same kind of thing, and they
 * are no longer stored the same way.
 *
 * **Saves are private and stay on the device**, keyed by the signed-in user so
 * two accounts on one phone don't share a bookmark list. Nobody counts them
 * and nobody else can see them, so there is nothing for the server to hold.
 *
 * **Likes are public and live on the server.** A count on a card is a claim
 * about other people, so it has to be the server's number: a device-local
 * heart could only ever count itself, and it forgot itself on reinstall. The
 * ids come back in one request on launch, and each tap posts.
 *
 * Taps are optimistic — the heart fills and the number moves on touch, and the
 * server's answer replaces the guess when it lands. A failed write puts both
 * back, because a heart that stayed filled through a dropped request is a lie
 * the next launch would quietly correct.
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
import { api } from '@/api/client';
import { useAuth } from './auth';
import type { ID, Post } from '@/types';

interface SavedContextValue {
  savedIds: ReadonlySet<ID>;
  likedIds: ReadonlySet<ID>;
  isSaved: (postId: ID) => boolean;
  isLiked: (postId: ID) => boolean;
  toggleSaved: (postId: ID) => void;
  /** Takes the post, not the id: the count moves with the heart. */
  toggleLiked: (post: Post) => void;
  /**
   * What to render next to the heart — the newest number we have, which is
   * whatever the last like/unlike settled on, falling back to the count the
   * post was fetched with.
   */
  likeCount: (post: Post) => number;
}

const SavedContext = createContext<SavedContextValue | null>(null);

function savedKey(userId: string): string {
  return `mensemble.saved.${userId}`;
}

async function readSaved(userId: string): Promise<Set<ID>> {
  try {
    const raw = await AsyncStorage.getItem(savedKey(userId));
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
  /** Counts we've been told since the posts were fetched, by post id. */
  const [counts, setCounts] = useState<Record<ID, number>>({});

  // Reload whenever the account changes; clear on sign-out. The like list is a
  // request rather than a read, and a failure leaves the hearts empty rather
  // than wrong — an unfilled heart invites a tap, which corrects itself.
  useEffect(() => {
    if (!userId) {
      setSaved(new Set());
      setLiked(new Set());
      setCounts({});
      return;
    }
    let cancelled = false;
    void readSaved(userId).then((ids) => {
      if (!cancelled) setSaved(ids);
    });
    void api
      .getMyLikes()
      .then((ids) => {
        if (!cancelled) setLiked(new Set(ids));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleSaved = useCallback(
    (postId: ID) => {
      setSaved((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        if (userId) {
          void AsyncStorage.setItem(savedKey(userId), JSON.stringify([...next])).catch(() => {});
        }
        return next;
      });
    },
    [userId],
  );

  const toggleLiked = useCallback(
    (post: Post) => {
      const id = post._id;
      const wasLiked = liked.has(id);
      // Whatever the card is showing right now, which is what we move from.
      const shown = counts[id] ?? post.likeCount ?? 0;

      setLiked((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(id);
        else next.add(id);
        return next;
      });
      setCounts((prev) => ({ ...prev, [id]: Math.max(0, shown + (wasLiked ? -1 : 1)) }));

      const write = wasLiked ? api.unlikePost(id) : api.likePost(id);
      void write
        .then((result) => {
          // The server's number wins over the guess, always.
          setCounts((prev) => ({ ...prev, [id]: result.likeCount }));
          setLiked((prev) => {
            const settled = new Set(prev);
            if (result.liked) settled.add(id);
            else settled.delete(id);
            return settled;
          });
        })
        .catch(() => {
          setLiked((prev) => {
            const reverted = new Set(prev);
            if (wasLiked) reverted.add(id);
            else reverted.delete(id);
            return reverted;
          });
          setCounts((prev) => ({ ...prev, [id]: shown }));
        });
    },
    [liked, counts],
  );

  const value = useMemo<SavedContextValue>(
    () => ({
      savedIds: saved,
      likedIds: liked,
      isSaved: (id) => saved.has(id),
      isLiked: (id) => liked.has(id),
      toggleSaved,
      toggleLiked,
      likeCount: (post) => counts[post._id] ?? post.likeCount ?? 0,
    }),
    [saved, liked, counts, toggleSaved, toggleLiked],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>.');
  return ctx;
}
