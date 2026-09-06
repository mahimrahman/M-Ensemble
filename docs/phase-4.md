# Phase 4 — Backend + DB

The frontend is finished and frozen against the contract in `packages/shared`.
This phase builds the server it already talks to. Nothing in `apps/mobile`
should need to change for Phase 5 except one `.env` flag.

Two people, one contract:

| Owner           | Delivers                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **DB engineer** | Mongoose models + indexes, the seed script, the derived-view services (dashboard, members, roster, outcomes), the prayer-times service |
| **Backend dev** | Auth (JWT + bcrypt), `requireAuth` / `requireAdmin`, every route + controller, the push fan-out, the vitest suite                      |

Both read the same three files before writing a line:

- [packages/shared/src/types.ts](../packages/shared/src/types.ts) — the shapes
- [packages/shared/src/api.ts](../packages/shared/src/api.ts) — `MEnsembleApi`, error codes, filters
- [apps/mobile/src/api/mock/mockClient.ts](../apps/mobile/src/api/mock/mockClient.ts) — **the reference implementation.** Every rule below is what the mock already does. If the mock and this document disagree, the mock wins and this document has a bug.

The HTTP client the app will use is [apps/mobile/src/api/http.ts](../apps/mobile/src/api/http.ts). Its paths, query strings and bodies are the ones listed here; do not rename a route without changing that file in the same PR.

## What already exists in `apps/server`

A working scaffold: Express + helmet + cors + morgan, Mongoose connection, a zod
`validate(schema, source)` middleware, `HttpError(status, code, message)`, and
an error handler that writes the `ApiResponse` envelope. Keep all of it.

Three things in the scaffold contradict the contract and must go:

1. `models/User.ts` has `displayName`. The contract says `name`, plus
   `interests`, `pushToken`, and (server-only) `passwordHash`, `notificationPrefs`.
2. `routes/user.routes.ts` exposes `GET /users` (paginated dump) and
   `POST /users`. Replace with `GET /users?ids=` (below). Account creation is
   `POST /auth/signup` only.
3. `errorHandler.ts` emits `not_found` / `internal_error` / `validation_error`
   in lowercase. The app branches on the **uppercase** constants in `API_ERROR`.
   Use `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, `UNAUTHORIZED`.

Conventions to keep: ESM with `.js` suffixes on relative imports, one file per
concern under `routes/`, `controllers/`, `services/`, `models/`, `middleware/`.

## Ground rules

- **Envelope.** Every response is `{ ok: true, data }` or
  `{ ok: false, error: { code, message } }`. Void endpoints return
  `{ ok: true, data: null }` with 200 — the client calls `res.json()` on every
  response, so never send 204.
- **String ids.** Fixture ids are strings (`mosque_khadija`, `post_001`,
  `user_002`) and the demo script, the QR deep link (`/checkin/post_001`) and
  the docs all use them. Declare `_id: { type: String, required: true }` on
  every schema and generate new ids with `crypto.randomUUID()`. Do not let
  Mongoose mint ObjectIds anywhere.
- **Timestamps are ISO strings.** The contract's `Timestamp` is
  `"2026-09-05T13:21:00.000Z"`. Store as `Date`, serialise with `toISOString()`
  (a `toJSON` transform on each schema). `DateString` (`"2026-09-05"`) and
  `WallClock` (`"20:30"`) are stored as plain strings and **never** converted.
- **Auth everywhere.** Only `/health` and `/auth/*` are open. Everything else
  runs `requireAuth`. The app is fully gated behind login, so there is no
  anonymous read path.
- **Error codes** come from `API_ERROR` in the shared package. The pairs the
  app actually branches on:

| Code                | Status  | When                                                                                                                                       |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `BAD_CREDENTIALS`   | 401     | login                                                                                                                                      |
| `EMAIL_TAKEN`       | 409     | signup                                                                                                                                     |
| `UNAUTHORIZED`      | 401     | missing / expired / malformed bearer. **Status 401 is what the app checks** on cold start to sign the user out; the code is informational. |
| `FORBIDDEN`         | 403     | `requireAdmin` failed, or self-demotion                                                                                                    |
| `NOT_FOUND`         | 404     | unknown post / mosque / user; withdraw with no signup; check-in with no confirmed signup                                                   |
| `NOT_FOUND`         | **410** | signup on a cancelled post (yes, 410 with code `NOT_FOUND` — the mock does this and the app copes)                                         |
| `ALREADY_SIGNED_UP` | 409     | signup when a confirmed row exists                                                                                                         |
| `FULL`              | 409     | signup when `slotsFilled >= limit`                                                                                                         |
| `VALIDATION_ERROR`  | 400     | zod rejected the body / query                                                                                                              |

## Models (DB engineer)

All collections use string `_id`.

**Do not use `timestamps: true` anywhere.** `createdAt` is contract surface on
`Post`, `Follow`, `Membership` and `Signup`, and Mongoose-managed timestamps
break it three ways: the 19 fixture posts carry meaningful `createdAt` values
spanning two days back and would all flatten to seed time ("just now" on every
card); `Signup.createdAt` is optional and two fixture rows omit it on purpose;
and the re-signup-after-withdraw flow rewrites it to now, which the plugin
forbids. Declare `createdAt: Date` explicitly on those four and omit it
entirely from `User`, `Mosque`, `IqamahConfig` and `JummahSession`.

| Model           | Fields                                                                                                                                                                                | Indexes                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `User`          | `name`, `email` (lowercase, trim), `passwordHash`, `interests: string[]`, `pushToken?`, `notificationPrefs` (embedded, defaults = `defaultNotificationPrefs` in fixtures)             | `email` unique                                                          |
| `Mosque`        | `name`, `address`, `coordinates {lat,lng}`, `joinCode` (uppercase), `prayerConfig {calculationMethod, madhab, highLatitudeRule}`, `timezone` (default `America/Toronto`, server-only) | `joinCode` unique                                                       |
| `Follow`        | `userId`, `mosqueId`, `createdAt`                                                                                                                                                     | `{userId, mosqueId}` unique · `{mosqueId}`                              |
| `Membership`    | `userId`, `mosqueId`, `role: 'member' \| 'admin'`, `createdAt`                                                                                                                        | `{userId, mosqueId}` unique · `{userId}`                                |
| `Post`          | everything in `Post` incl. `slotsFilled` (default 0), `imageUrl?`, `cancelledAt?`                                                                                                     | `{mosqueId, startAt}` · `{mosqueId, endAt}` · `{endAt}`                 |
| `Signup`        | `postId`, `userId`, `status`, `checkedInAt?`, `createdAt`                                                                                                                             | `{postId, userId}` **unique** · `{userId, status}` · `{postId, status}` |
| `IqamahConfig`  | `mosqueId`, `prayer`, `mode`, `fixedTime?`, `offsetMinutes?`, `effectiveFrom`                                                                                                         | `{mosqueId, prayer, effectiveFrom}`                                     |
| `JummahSession` | `mosqueId`, `label`, `khutbahTime`, `iqamahTime`                                                                                                                                      | `{mosqueId}`                                                            |

`Follow` and `Membership` stay separate. Follow is public and drives the feed;
Membership carries the role and drives permissions. A coordinator need not
follow the mosque they run — `buildMembers` in the mock handles that case and
the server must too.

`User.toJSON` strips `passwordHash` and `notificationPrefs`. The `User` shape
that crosses the wire is exactly `{ _id, name, email, interests, pushToken? }`.

## Seed script (DB engineer)

`apps/server/src/scripts/seed.ts`, run with `npm run seed --workspace @m-ensemble/server`
(add the script: `tsx src/scripts/seed.ts`).

The fixtures now live in the shared package precisely so this script can import
them instead of retyping them:

```ts
import {
  mockMosques,
  mockUsers,
  mockFollows,
  mockMemberships,
  mockPosts,
  mockPastPosts,
  mockSignups,
  mockIqamah,
  mockJummah,
  defaultNotificationPrefs,
  MOCK_PASSWORD,
} from '@m-ensemble/shared';
```

Steps:

1. Drop the eight collections.
2. Insert users with `passwordHash = bcrypt(MOCK_PASSWORD, 10)` and
   `notificationPrefs = defaultNotificationPrefs`. Keep the fixture `_id`s.
3. Insert everything else verbatim. `Post.slotsFilled` is inserted as given —
   it is a counter, **not** recomputed from signups (an event can be 84/200 with
   no rows behind it).
4. Print counts and exit 0.

Expected counts after a seed:

| Collection     | Rows | Notes                                                                         |
| -------------- | ---- | ----------------------------------------------------------------------------- |
| mosques        | 6    | Khadija, Madina, Al-Rawdah, Laval, Ottawa, Toronto                            |
| users          | 20   | all sign in with `mensemble`                                                  |
| follows        | 20   | user_001 follows Khadija + Madina                                             |
| memberships    | 3    | user_002 admin @ Khadija, user_003 admin @ Madina, user_001 member @ Khadija  |
| posts          | 19   | 14 upcoming (incl. 1 Ottawa + 1 Toronto), 5 past                              |
| signups        | 41   | 40 confirmed, 1 withdrawn, 23 with `checkedInAt`                              |
| iqamahconfigs  | 30   | 5 Khadija · 5 Madina (incl. Madina Isha `effectiveFrom: 2026-09-08`) · 5 each for the other four mosques, generated by the `flatMap` at the end of `mockIqamah` |
| jummahsessions | 3    | 2 Khadija · 1 Madina                                                          |

Every fixture date is computed from "today" **when the module is imported**, so
the seed is only right for the day it was run. Re-seed on the morning of the
demo. If you change a fixture, change it in `packages/shared/src/fixtures.ts`
and nowhere else — the mobile mock reads the same file.

## Auth (backend dev)

- `POST /auth/signup` body `{ email, password, name }` (zod: email, password
  ≥ 8, name 1–80). 201 → `{ token, user }`. Duplicate email → 409 `EMAIL_TAKEN`.
  New users start with `interests: []`; the app's onboarding fills them.
- `POST /auth/login` body `{ email, password }`. 200 → `{ token, user }`. Any
  failure → 401 `BAD_CREDENTIALS` (never say which half was wrong).
- JWT HS256, payload `{ sub: userId }`, expiry 30 days (demo-friendly),
  secret from `JWT_SECRET`. Bearer header only.
- `requireAuth`: verifies the token, loads the user, sets `req.user`. Missing or
  bad → 401 `UNAUTHORIZED`. A token whose user no longer exists is also 401.
- `requireAdmin(getMosqueId)`: after `requireAuth`, checks
  `Membership { userId, mosqueId, role: 'admin' }`. Else 403 `FORBIDDEN`. The
  mosque id comes from the route param for `/mosques/:id/*`, from `body.mosqueId`
  for `POST /posts`, and from the loaded post for `/posts/:id/*` admin actions.

Add to `config/env.ts` and `.env.example`:

```
JWT_SECRET=change-me
EXPO_ACCESS_TOKEN=          # optional; only if the Expo push API starts rate-limiting
```

## Routes (backend dev)

Base path `/api`. "Admin" means `requireAdmin` for the mosque in question.

### Me

| Method | Path                     | Body / query                        | Returns                             | Rules                                                                                                                                                       |
| ------ | ------------------------ | ----------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/me`                    |                                     | `User`                              |                                                                                                                                                             |
| PATCH  | `/me`                    | `{ name?, interests?, pushToken? }` | `User`                              | zod: at most those three keys                                                                                                                               |
| GET    | `/users?ids=a,b,c`       |                                     | `PublicUser[]` = `{ _id, name }[]`  | **never** email. Unknown ids are silently dropped. Cap at 200 ids.                                                                                          |
| GET    | `/me/mosques`            |                                     | `Mosque[]`                          | mosques the user follows                                                                                                                                    |
| GET    | `/me/memberships`        |                                     | `Membership[]`                      | every role row for the user; `[]` for a plain member. Called on every cold start — keep it one indexed query.                                               |
| GET    | `/me/commitments`        |                                     | `Signup[]`                          | `status: 'confirmed'`, all time; the app splits past/upcoming itself                                                                                        |
| GET    | `/me/hours`              |                                     | `{ totalMinutes, shiftsCompleted }` | over the user's signups with `checkedInAt`, **any post type** (mirror the mock; see "Known quirks") · minutes = `round((endAt − startAt) / 60000)` per post |
| GET    | `/me/notification-prefs` |                                     | `NotificationPrefs`                 |                                                                                                                                                             |
| PUT    | `/me/notification-prefs` | `NotificationPrefs`                 | `NotificationPrefs`                 | whole replace, all five booleans required                                                                                                                   |
| POST   | `/me/push-token`         | `{ token }`                         | `null`                              | sets `User.pushToken`. Called each launch; idempotent.                                                                                                      |

### Mosques

| Method | Path                                                  | Body / query        | Returns                                         | Rules                                                                                                                                                                          |
| ------ | ----------------------------------------------------- | ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/mosques`                                            |                     | `Mosque[]`                                      | all of them, any order                                                                                                                                                         |
| GET    | `/mosques/:id`                                        |                     | `Mosque`                                        | 404                                                                                                                                                                            |
| POST   | `/mosques/:id/follow`                                 |                     | `null`                                          | idempotent (upsert)                                                                                                                                                            |
| DELETE | `/mosques/:id/follow`                                 |                     | `null`                                          | idempotent                                                                                                                                                                     |
| GET    | `/mosques/:id/posts`                                  |                     | `Post[]`                                        | **live** posts only: `cancelledAt` unset and `endAt >= now`. Sort `startAt` asc.                                                                                               |
| GET    | `/mosques/:id/posts?all=true`                         |                     | `Post[]`                                        | admin · every post incl. past and cancelled, `startAt` asc                                                                                                                     |
| GET    | `/mosques/:id/prayer-times?date=YYYY-MM-DD`           |                     | `PrayerTable`                                   | see "Prayer times"                                                                                                                                                             |
| GET    | `/mosques/:id/iqamah`                                 |                     | `{ iqamah: Iqamah[], jummah: JummahSession[] }` | any signed-in user                                                                                                                                                             |
| PUT    | `/mosques/:id/iqamah`                                 | `IqamahConfigInput` | `MosqueIqamahConfig`                            | admin · **whole replace**: delete every `IqamahConfig` and `JummahSession` for the mosque, insert the body with `mosqueId` stamped on. The app resends historical rows itself. |
| GET    | `/mosques/:id/dashboard`                              |                     | `MosqueDashboard`                               | admin · formulas below                                                                                                                                                         |
| GET    | `/mosques/:id/roster?upcoming=true&types=a,b&post=id` |                     | `RosterEntry[]`                                 | admin · formulas below                                                                                                                                                         |
| GET    | `/mosques/:id/members`                                |                     | `MosqueMember[]`                                | admin · formulas below                                                                                                                                                         |
| GET    | `/mosques/:id/members/:userId`                        |                     | `MemberDetail`                                  | admin · 404 if not in the members list                                                                                                                                         |
| PUT    | `/mosques/:id/members/:userId/role`                   | `{ role }`          | `MosqueMember`                                  | admin · 403 `FORBIDDEN` if `userId === req.user._id` and `role !== 'admin'` · upserts the `Membership` row · never touches `Follow`                                            |
| GET    | `/mosques/:id/outcomes`                               |                     | `EventOutcome[]`                                | admin · formulas below                                                                                                                                                         |

### Feed and posts

| Method | Path                          | Body / query      | Returns        | Rules                                                                                                                                                             |
| ------ | ----------------------------- | ----------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/feed?types=a,b&mosques=x,y` |                   | `Post[]`       | scope = `mosques` if given, else the user's followed mosque ids · live posts only · optional `types` filter · `startAt` asc                                       |
| GET    | `/posts/:id`                  |                   | `Post`         | 404. Cancelled posts **are** returned (the detail screen shows "Cancelled").                                                                                      |
| POST   | `/posts`                      | `CreatePostInput` | `Post` (201)   | admin of `body.mosqueId` · `slotsFilled: 0`, `createdBy: req.user._id`, `createdAt: now` · then fan-out (below)                                                   |
| PATCH  | `/posts/:id`                  | `UpdatePostInput` | `Post`         | admin of the post's mosque · zod must **reject** `type` and `mosqueId`                                                                                            |
| POST   | `/posts/:id/cancel`           |                   | `Post`         | admin · sets `cancelledAt = now` if unset; idempotent                                                                                                             |
| POST   | `/posts/:id/signup`           |                   | `Signup` (201) | see "Atomic slot claim"                                                                                                                                           |
| DELETE | `/posts/:id/signup`           |                   | `null`         | 404 `NOT_FOUND` if no confirmed row · `status = 'withdrawn'`, unset `checkedInAt` · `$inc slotsFilled −1`, floored at 0                                           |
| GET    | `/posts/:id/signups`          |                   | `Signup[]`     | **all statuses**; the app filters `confirmed` itself                                                                                                              |
| POST   | `/posts/:id/checkin`          | `{ userId }`      | `null`         | allowed if `userId === req.user._id` (QR self check-in) **or** admin of the post's mosque · 404 if no confirmed signup · sets `checkedInAt` if unset (idempotent) |

### Atomic slot claim

Never read-then-write. `limit = slotsNeeded ?? capacity`; posts with neither
(announcements, open events) have no limit.

```ts
// 1. Cheap early-outs.
const post = await Post.findById(postId);              // 404 if missing
if (post.cancelledAt) throw new HttpError(410, 'NOT_FOUND', 'This post was cancelled.');
const existing = await Signup.findOne({ postId, userId });
if (existing?.status === 'confirmed') throw new HttpError(409, 'ALREADY_SIGNED_UP', ...);

// 2. The one write that decides the race.
const claimed = await Post.findOneAndUpdate(
  {
    _id: postId,
    cancelledAt: { $exists: false },
    $expr: {
      $lt: ['$slotsFilled', { $ifNull: ['$slotsNeeded', { $ifNull: ['$capacity', Number.MAX_SAFE_INTEGER] }] }],
    },
  },
  { $inc: { slotsFilled: 1 } },
  { new: true },
);
if (!claimed) throw new HttpError(409, 'FULL', 'That filled up while you were looking.');

// 3. Record it. The unique index is the second guard against a double claim.
try {
  if (existing) {
    // Re-signup after a withdraw: flip the row, fresh createdAt, no check-in.
    existing.status = 'confirmed'; existing.createdAt = new Date(); existing.checkedInAt = undefined;
    await existing.save();
    return existing;
  }
  return await Signup.create({ _id: randomUUID(), postId, userId, status: 'confirmed', createdAt: new Date() });
} catch (err) {
  if (isDuplicateKey(err)) {                           // lost a race with ourselves
    await Post.updateOne({ _id: postId }, { $inc: { slotsFilled: -1 } });
    throw new HttpError(409, 'ALREADY_SIGNED_UP', ...);
  }
  throw err;
}
```

Phase 5's race test is two phones tapping the last slot at once: exactly one
201, one 409 `FULL`, and `slotsFilled` ends equal to `slotsNeeded`.

## Derived views (DB engineer)

The admin screens read views computed from posts, signups, follows and
memberships. They are **never** a second source of truth. Data volume is tiny;
implement each as a few indexed `find`s plus an in-memory reduce in
`services/`, and only reach for an aggregation pipeline if a screen is slow.
`now` is server time. "Live" = `cancelledAt` unset and `endAt >= now`. "Ended"
= `cancelledAt` unset and `endAt < now`. `postMinutes = max(0, round((endAt − startAt)/60000))`.

**`MosqueDashboard`** (posts of the mosque; `live`, `ended` as above):

| Field            | Formula                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `upcomingCount`  | live posts with `startAt <= now + 7 days`                                                              |
| `slotsNeeded`    | Σ `slotsNeeded` over live posts of type `volunteer` that have `slotsNeeded`                            |
| `slotsUnfilled`  | Σ `max(0, slotsNeeded − slotsFilled)` over the same posts                                              |
| `newSignups24h`  | confirmed signups on live posts with `createdAt` within the last 24h                                   |
| `activePeople`   | distinct `userId` among confirmed signups on live posts                                                |
| `followerCount`  | `Follow` rows for the mosque                                                                           |
| `attendanceRate` | over confirmed signups on **ended** posts: `round(checkedIn / confirmed × 100)`, 0 when there are none |
| `minutesServed`  | Σ `postMinutes` for checked-in signups on ended posts **of type `volunteer`**                          |

**`MosqueMember[]`** — the directory. The set of people is the union of: users
who follow the mosque, users with any `Membership` at it, and users with any
signup on one of its posts. For each:

| Field           | Formula                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `role`          | `Membership.role` if a row exists, else `'member'`                                                                   |
| `joinedAt`      | earliest of `Follow.createdAt` and `Membership.createdAt`; for signup-only people, their earliest signup `createdAt` |
| `signupCount`   | confirmed signups on this mosque's posts, all time (past posts included)                                             |
| `attendedCount` | of those, with `checkedInAt`                                                                                         |
| `minutesServed` | Σ `postMinutes` of attended signups on `volunteer` posts                                                             |
| `lastSeenAt`    | latest `checkedInAt`, omitted if none                                                                                |
| `interests`     | `User.interests`                                                                                                     |

Sort: admins first, then `attendedCount` desc, then name.

**`MemberDetail`** — `{ member, history }` where `member` is that user's row
from the list above (404 if absent) and `history` is every confirmed signup of
theirs on this mosque's posts as `RosterEntry`, `startAt` **desc**.

**`RosterEntry[]`** — confirmed signups joined to their post, for posts of the
mosque that are not cancelled, filtered by `?post=`, `?types=`, and
`?upcoming=true` (drops posts with `endAt < now`). `userName` from `User`,
`'—'` if the user is gone. Sort `startAt` asc.

**`EventOutcome[]`** — ended posts of the mosque, excluding `announcement`:
`confirmed` = confirmed signups, `attended` = of those with `checkedInAt`,
`target = slotsNeeded ?? capacity ?? null`. Sort `startAt` desc.

## Prayer times (DB engineer, with the app owner)

`GET /mosques/:id/prayer-times?date=` must return the same table the app
computes today. The maths lives in
[apps/mobile/src/lib/prayer.ts](../apps/mobile/src/lib/prayer.ts):
`adhanTimes`, `resolveIqamah`, `buildPrayerTable`, and the wall-clock helpers
(`toWallClock`, `fromWallClock`, `tzOffsetMinutes`, `addMinutes`,
`dateStringIn`). They depend only on `adhan` and the shared types.

Do this rather than copying: move those functions into
`packages/shared/src/prayer.ts`, add `adhan` to the shared package's
dependencies, and have the mobile file re-export them (the UI-only halves —
labels, `nextPrayerFrom`, `formatCountdown` — stay in the app). Then the
service is one call:

```ts
buildPrayerTable(
  mosque,
  date,
  await IqamahConfig.find({ mosqueId }),
  await JummahSession.find({ mosqueId }),
);
```

Rules the function already enforces, restated so nobody "simplifies" them:
iqamah rows are wall-clock strings and never converted; the row in force is the
latest `effectiveFrom <= date`; `offset` mode adds minutes to that day's adhan.
The month screen calls this endpoint once per day of the month (≈31 requests);
that is fine for the demo but the endpoint must be cheap — no per-request
`Mosque` lookups beyond one.

## Push fan-out (backend dev)

After `POST /posts` has responded 201 (do not block the response on it):

1. Recipients = users who **follow** `post.mosqueId` **and** whose `interests`
   include `post.category` **and** have a `pushToken` **and** whose
   `notificationPrefs` allow the type:
   `volunteer → volunteerRequests`, `event → events`, `class → classes`,
   `announcement → announcements`. Exclude the creator.
2. Send via `expo-server-sdk` (`Expo.chunkPushNotifications`). Title = mosque
   name, body = post title, `data: { postId }`. Log the tickets; a receipt check
   is out of scope.
3. Categories and interests are the English keys in `INTEREST_OPTIONS`
   ([apps/mobile/src/lib/interests.ts](../apps/mobile/src/lib/interests.ts)).
   They never get translated on the wire.

The app already opens `post/[id]` when a notification with `data.postId` is
tapped (see `usePushToken`), so there is nothing to build on the client.

## Tests (backend dev)

`vitest` is wired; add `mongodb-memory-server` and a `beforeEach` that seeds
from the shared fixtures. The suite that earns the "every endpoint returns
correct shapes" exit criterion:

- signup → login → `/me` round-trip; duplicate email 409; wrong password 401
- `requireAdmin`: user_001 gets 403 on `POST /posts` for Khadija; user_002 gets 201
- `/feed` for user_001 returns Khadija + Madina live posts only, none cancelled, none past, sorted
- **race:** seed `post_001` at 3/4, fire 10 concurrent `POST /posts/post_001/signup` as 10 different users → exactly one 201, nine 409 `FULL`, `slotsFilled === 4`
- withdraw then re-signup: one `Signup` row, `status` flips, `checkedInAt` gone
- check-in: self OK; another member 403; admin OK; unknown signup 404; second call is a no-op
- cancel: post leaves `/feed` and `/mosques/:id/posts`, stays in `?all=true`, `POST …/signup` → 410
- `PUT /mosques/:id/iqamah` replaces, then `prayer-times` reflects the new row on and after `effectiveFrom` and not before
- dashboard / members / outcomes on the seeded Khadija match what the app shows on mocks (open the app with `EXPO_PUBLIC_USE_MOCKS=true` as amina@example.com and compare the numbers by hand — the mock is the oracle)

## Known quirks — keep, don't fix

- `/me/hours` counts every checked-in signup regardless of post type, while
  `MosqueMember.minutesServed` and the dashboard count only `volunteer` posts.
  The mock does both; the app's copy is written around both. Mirror it. If the
  team wants them unified, that is a contract change for after the demo.
- Cancelled-post signup is 410 with code `NOT_FOUND`.
- `slotsFilled` is a counter that can exceed the number of signup rows. Never
  recompute it.

## Exit criteria

- [x] `npm run seed` prints the counts in the table above
- [x] every route in this document answers with the right shape from Postman /
      a `.http` file checked into `apps/server/requests.http`
- [x] the vitest suite above is green, including the race
- [x] `npm run typecheck` and `npm test` pass at the repo root
- [ ] a post created through `POST /posts` lands as a push on one physical
      phone whose token was registered through `POST /me/push-token`

Then hand over to [phase-5.md](phase-5.md).
