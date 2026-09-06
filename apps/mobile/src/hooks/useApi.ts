import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type DependencyList } from 'react';
import { ApiRequestError } from '@/api/client';
import { useLang } from '@/i18n';

export interface ApiState<T> {
  data: T | null;
  /** True only until the first result — later reloads keep the old data up. */
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Runs `fetcher` when the screen gains focus and again on demand.
 *
 * Refetch-on-focus is what keeps the feed honest after you claim a slot on the
 * detail screen and come back: no cache invalidation to get wrong.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: DependencyList): ApiState<T> {
  const { t } = useLang();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const result = await fetcher();
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      // The server's message when it sent one; otherwise the app's own, in the
      // app's language, so a screen never shows an English fallback to a
      // French or Arabic reader.
      setError(err instanceof ApiRequestError ? err.message : t.somethingWrong);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, loading, error, reload: load };
}
