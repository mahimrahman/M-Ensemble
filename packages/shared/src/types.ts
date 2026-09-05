/** Domain models shared between the mobile app and the API. */

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export type ID = string;

/** ISO-8601 timestamp string, e.g. "2026-09-05T13:21:00.000Z". */
export type Timestamp = string;
