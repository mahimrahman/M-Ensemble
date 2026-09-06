import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PageResult } from '@m-ensemble/shared';
import { ApiError } from '@/api';

/**
 * The dozen pieces every screen in the console is built from.
 *
 * Deliberately small and unstyled-by-prop: they render semantic markup and let
 * `styles.css` do the work, so a change to how a table looks is one selector
 * rather than forty call sites.
 */

// ─── Async data ─────────────────────────────────────────────────────────────

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  /** Refetch — pass this to anything that writes, so the screen catches up. */
  reload: () => void;
}

/**
 * Fetch on mount and whenever `deps` change.
 *
 * The guard against a stale response overwriting a fresh one is a sequence
 * number, not a cleanup flag: a fast second request can settle *before* a slow
 * first one, and a boolean only catches the unmounted case, not that one.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  // The caller passes a fresh closure every render; `deps` is what decides when
  // to re-run, exactly as with `useEffect`.
  const run = useRef(fn);
  run.current = fn;

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    run
      .current()
      .then((result) => {
        if (seq.current !== id) return;
        setData(result);
        setError(undefined);
      })
      .catch((err: Error) => {
        if (seq.current !== id) return;
        setError(err);
      })
      .finally(() => {
        if (seq.current === id) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/** Debounced value, so a search box is one request per pause, not per keypress. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

// ─── Toasts ─────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  tone: 'good' | 'critical' | 'neutral';
  message: string;
}

const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast['tone'] = 'good') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        style={{ position: 'fixed', right: 20, bottom: 20, display: 'grid', gap: 8, zIndex: 100 }}
        // Announced rather than merely shown: a confirmation nobody can see is
        // not a confirmation.
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div key={t.id} className={`alert ${t.tone === 'neutral' ? '' : t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): ((message: string, tone?: Toast['tone']) => void) =>
  useContext(ToastContext);

/**
 * What to show when a write is rejected.
 *
 * A rejected write is usually one bad field, and the server already says which
 * — `validate` sends Zod's flattened errors as `details`. Dropping them leaves
 * the toast reading "Invalid request", which says nothing about the form the
 * person is looking at, so the field errors are appended when there are any.
 */
function actionMessage(err: ApiError): string {
  const details = err.details as
    { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> } | undefined;
  if (!details || typeof details !== 'object') return err.message;
  const fields = Object.entries(details.fieldErrors ?? {}).map(([field, messages]) =>
    messages?.[0] ? `${field}: ${messages[0]}` : field,
  );
  const parts = [...fields, ...(details.formErrors ?? [])].filter(Boolean);
  return parts.length ? `${err.message} — ${parts.join('; ')}` : err.message;
}

/** Runs a write, toasts the outcome, and hands back a pending flag for buttons. */
export function useAction(): {
  busy: boolean;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
} {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await fn();
        if (success) toast(success, 'good');
        return true;
      } catch (err) {
        // The server writes these messages for people, so show the server's
        // sentence rather than a generic one — "That is the last super admin"
        // is far more use than "Something went wrong".
        toast(err instanceof ApiError ? actionMessage(err) : 'Something went wrong.', 'critical');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  return { busy, run };
}

// ─── Primitives ─────────────────────────────────────────────────────────────

export function Card({
  title,
  actions,
  children,
  padded = true,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}): React.JSX.Element {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          <span className="spacer" />
          {actions}
        </header>
      )}
      {padded ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral' | 'brand';

/**
 * A coloured dot **and** a word, always. Colour never carries the meaning on its
 * own — that is what makes the two low-contrast hues in the light palette
 * legible, and what makes a screenshot of a table readable.
 */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }): React.JSX.Element {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Loading({ label = 'Loading' }: { label?: string }): React.JSX.Element {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ErrorNote({ error }: { error: Error }): React.JSX.Element {
  return (
    <div className="alert critical">
      <div>
        <b>Could not load this.</b>
        {error.message}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="empty">{children}</p>;
}

/** Renders whichever of loading / error / empty / content applies. */
export function Async<T>({
  state,
  children,
  empty,
}: {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  empty?: (data: T) => boolean;
}): React.JSX.Element {
  if (state.error) return <ErrorNote error={state.error} />;
  // Keeps the previous data on screen while a filter refetches, so the page
  // does not flash to a spinner on every keystroke.
  if (state.data === undefined) return <Loading />;
  if (empty?.(state.data)) return <Empty>Nothing here yet.</Empty>;
  return <>{children(state.data)}</>;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}): React.JSX.Element {
  // Escape closes. A dialog with no keyboard exit is a trap for anyone not
  // using a mouse, and the click-outside below does not help them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Pager({
  page,
  result,
  onPage,
}: {
  page: number;
  result: PageResult<unknown>;
  onPage: (page: number) => void;
}): React.JSX.Element {
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  return (
    <div className="pager">
      <span>
        {from}–{to} of {result.total.toLocaleString('en-CA')}
      </span>
      <span className="spacer" />
      <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="num">
        {result.page} / {result.pages}
      </span>
      <button
        className="btn sm"
        disabled={result.page >= result.pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  /** Server-side sortable. Omitted columns render a plain header. */
  sortable?: boolean;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  sort,
  dir,
  onSort,
  onRowClick,
  empty = 'Nothing here yet.',
}: {
  columns: Column<T>[];
  rows: T[];
  sort?: string;
  dir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  empty?: string;
}): React.JSX.Element {
  if (!rows.length) return <Empty>{empty}</Empty>;

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={[
                  column.sortable && onSort ? 'sortable' : '',
                  column.align === 'right' ? 'num' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={column.sortable && onSort ? () => onSort(column.key) : undefined}
                aria-sort={
                  sort === column.key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined
                }
              >
                {column.header}
                {sort === column.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className={onRowClick ? 'clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'num' : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * List-screen state: page, search, sort and any number of extra filters, all
 * kept together so a page component is a table and a toolbar rather than eight
 * `useState` calls and a stale-page bug.
 *
 * Changing a filter resets to page 1 — staying on page 7 of a result set that
 * now has two pages shows an empty table and looks like a bug.
 */
export function useListState<F extends Record<string, string>>(
  initialFilters: F,
  initialSort?: string,
) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<F>(initialFilters);
  const [sort, setSort] = useState(initialSort);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const debouncedQ = useDebounced(q);

  const setFilter = useCallback((key: keyof F, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  const toggleSort = useCallback((key: string) => {
    setSort((current) => {
      // Same column flips direction; a new column starts descending, which is
      // what somebody scanning a table for the biggest number expects.
      if (current === key) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setDir('desc');
      return key;
    });
    setPage(1);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const query = useMemo(
    () => ({ page, q: debouncedQ, sort, dir, ...filters }),
    [page, debouncedQ, sort, dir, filters],
  );

  return { page, setPage, q, setQ, filters, setFilter, sort, dir, toggleSort, query };
}

/** A labelled `<select>` for the toolbar. `''` always means "no filter". */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}): React.JSX.Element {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{label}: any</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function PageHeader({
  crumb,
  title,
  subtitle,
  actions,
}: {
  crumb?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="row" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {crumb && <p className="crumb">{crumb}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
