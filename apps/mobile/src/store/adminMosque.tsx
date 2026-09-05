/**
 * Which mosque the coordinator is currently running.
 *
 * The member app is about many mosques; the admin app is about exactly one at
 * a time. Every admin screen reads the id from here rather than passing it
 * down through route params, so switching mosque in Settings re-points the
 * whole shell at once.
 *
 * A coordinator of a single mosque never sees this — it just resolves.
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
import { useAuth } from '@/store/auth';
import type { ID, Mosque } from '@/types';

const ACTIVE_KEY = 'mensemble.adminMosque';

interface AdminMosqueValue {
  /** Null only while the ids are still loading, or if this user runs none. */
  mosqueId: ID | null;
  mosque: Mosque | null;
  /** Every mosque this user coordinates — what the switcher lists. */
  mosques: Mosque[];
  loading: boolean;
  setMosqueId: (id: ID) => void;
}

const AdminMosqueContext = createContext<AdminMosqueValue | null>(null);

export function AdminMosqueProvider({ children }: { children: ReactNode }) {
  const { adminMosqueIds } = useAuth();
  const key = adminMosqueIds.join(',');

  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ID | null>(null);

  // Restore the last mosque they were running, if they still coordinate it.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(ACTIVE_KEY).then((stored) => {
      if (!cancelled && stored && adminMosqueIds.includes(stored)) setSelected(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    let cancelled = false;

    if (adminMosqueIds.length === 0) {
      setMosques([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void Promise.all(adminMosqueIds.map((id) => api.getMosque(id)))
      .then((list) => {
        if (!cancelled) setMosques(list);
      })
      .catch(() => {
        if (!cancelled) setMosques([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const setMosqueId = useCallback((id: ID) => {
    setSelected(id);
    void AsyncStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const value = useMemo<AdminMosqueValue>(() => {
    // A stale stored id (role revoked since) falls back to the first one.
    const mosqueId =
      selected && adminMosqueIds.includes(selected) ? selected : (adminMosqueIds[0] ?? null);
    return {
      mosqueId,
      mosque: mosques.find((m) => m._id === mosqueId) ?? null,
      mosques,
      loading,
      setMosqueId,
    };
  }, [selected, key, mosques, loading, setMosqueId]);

  return <AdminMosqueContext.Provider value={value}>{children}</AdminMosqueContext.Provider>;
}

export function useAdminMosque(): AdminMosqueValue {
  const ctx = useContext(AdminMosqueContext);
  if (!ctx) throw new Error('useAdminMosque must be used inside <AdminMosqueProvider>.');
  return ctx;
}
