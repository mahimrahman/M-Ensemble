import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type DependencyList } from 'react';
import { ApiRequestError } from '@/api/client';
import { useLang } from '@/i18n';

export interface ApiState<T> {
  data: T | null;
  /**
   * True while a request is in flight *and there is nothing to show yet* —
   * the first load, and any retry after one failed. A reload that happens
   * with data already on screen leaves this false, so a background refresh
   * never replaces content with a spinner.
   */
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
  // Mirrors `data` so `load` can ask whether the screen is empty without
  // listing it as a dependency and re-running itself on every result.
  const dataRef = useRef<T | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const id = ++requestId.current;
    // Retrying from an error state used to look like a dead button: `loading`
    // had already gone false, so the screen sat on the old message for the
    // whole request — up to the transport's ten-second timeout — with nothing
    // to say it was trying. Going back to the spinner is the honest answer,
    // and it costs nothing, because there is no content to hide behind it.
    if (dataRef.current === null) setLoading(true);
    try {
      const result = await fetcher();
      if (id !== requestId.current) return;
      dataRef.current = result;
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
