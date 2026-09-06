import type { PageQuery, PageResult } from '@m-ensemble/shared';

/** Anything bigger than this is someone scripting against the table by hand. */
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 25;

export interface ResolvedPage {
  page: number;
  pageSize: number;
  skip: number;
  limit: number;
}

/**
 * Clamps a `PageQuery` into numbers a Mongo query can be handed directly.
 *
 * Every admin table pages through here so a hand-typed `?pageSize=100000` is a
 * capped read rather than a database stall — these endpoints are behind a
 * platform role, but "the caller is trusted" is not a reason to let one
 * request load the whole collection into memory.
 */
export function resolvePage(query: PageQuery): ResolvedPage {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(query.pageSize) || DEFAULT_PAGE_SIZE)),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, limit: pageSize };
}

/** Wraps a page of rows in the envelope every admin table reads. */
export function pageResult<T>(items: T[], total: number, resolved: ResolvedPage): PageResult<T> {
  return {
    items,
    page: resolved.page,
    pageSize: resolved.pageSize,
    total,
    // At least 1 so the pager renders "1 of 1" rather than "1 of 0" on empty.
    pages: Math.max(1, Math.ceil(total / resolved.pageSize)),
  };
}

/**
 * A Mongo sort document from `?sort=name&dir=desc`, restricted to the fields
 * the endpoint says are sortable.
 *
 * The allowlist is the point: `sort` arrives from a query string and lands in a
 * database call, and an unbounded field name lets a caller sort by anything in
 * the document — including one with no index, which is a table scan per click.
 */
export function sortSpec(
  query: PageQuery,
  allowed: readonly string[],
  fallback: Record<string, 1 | -1>,
): Record<string, 1 | -1> {
  const field = query.sort;
  if (!field || !allowed.includes(field)) return fallback;
  return { [field]: query.dir === 'asc' ? 1 : -1 };
}

/**
 * Escapes a user's search box so it can go into a `RegExp` as literal text.
 *
 * Without this, a `q` of `(` throws and a `.*.*.*` is a query that never
 * returns — both reachable from a text input on a page anyone with a platform
 * role can open.
 */
export function searchRegex(q: string | undefined): RegExp | null {
  const trimmed = (q ?? '').trim();
  if (!trimmed) return null;
  return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
