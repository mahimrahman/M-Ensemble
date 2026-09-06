/**
 * The one `toJSON` transform every schema uses, so what leaves the server is
 * exactly the shape in `packages/shared/src/types.ts`.
 *
 * Three rules, each of which the app depends on:
 *
 *   - `Date` fields serialise as ISO strings (the contract's `Timestamp`).
 *     `DateString` and `WallClock` fields are stored as `String` and pass
 *     through untouched — an iqamah must never become UTC.
 *   - **Null and undefined keys are deleted, not emitted.** The contract marks
 *     `slotsNeeded`, `capacity`, `sessions`, `cancelledAt`, `checkedInAt` and
 *     `pushToken` optional, and the admin dashboard filters on
 *     `slotsNeeded !== undefined`. A stored `null` would pass that test and
 *     silently corrupt the coverage numbers.
 *   - `__v` goes; the string `_id` stays (except where `strip` says otherwise —
 *     `Iqamah` and `JummahSession` have no `_id` in the contract, and the
 *     iqamah editor posts back whatever extra keys we hand it).
 *
 * This runs on documents only. A `.lean()` query bypasses `toJSON` entirely and
 * would emit raw `Date`s and `null`s, so route handlers return documents;
 * services that read in bulk go through `toContract` instead.
 */
export function toContract(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toContract);

  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (inner === null || inner === undefined) continue;
      out[key] = toContract(inner);
    }
    return out;
  }

  return value;
}

/**
 * Schema options that serialise to the contract shape. The return type is
 * inferred rather than annotated `SchemaOptions` — that type is generic over the
 * document type, so a bare annotation pins it to `unknown` and stops unifying
 * with each schema's own generic.
 */
export function contractJson(strip: string[] = []) {
  return {
    versionKey: false as const,
    toJSON: {
      virtuals: false as const,
      versionKey: false as const,
      transform(_doc: unknown, ret: Record<string, unknown>) {
        for (const key of strip) delete ret[key];
        return toContract(ret) as Record<string, unknown>;
      },
    },
  };
}

/**
 * Options for a subdocument schema. Mongoose mints an ObjectId `_id` inside
 * array subdocuments by default, which would leak
 * `sessions: [{ _id, startAt, endAt }]` into a locked contract shape.
 */
export const SUBDOCUMENT = { _id: false } as const;

/**
 * `doc.toJSON()`, typed as the contract shape the transform actually produces.
 *
 * Mongoose types `toJSON()` from the schema — `Date` where the transform emits
 * an ISO string — so it cannot see through `contractJson`. Needed only where
 * the result is assigned into a contract-typed field; `res.json` infers fine.
 */
export function asContract<T>(doc: { toJSON(): unknown }): T {
  return doc.toJSON() as T;
}
