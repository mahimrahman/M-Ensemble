import { randomUUID } from 'node:crypto';

/**
 * Every `_id` in this database is a string. The fixtures use meaningful ones
 * (`mosque_khadija`, `post_001`) because the QR deep link, the demo script and
 * the docs all spell them out; rows created at runtime get a UUID. Mongoose
 * must never mint an ObjectId — every schema declares `_id: String`.
 */
export function newId(): string {
  return randomUUID();
}
