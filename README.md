# M-Ensemble

React Native (Expo) mobile app, a super-admin web console, and an
Express + MongoDB API behind both. All TypeScript.

Three audiences, three surfaces, one database:

| Who              | Where                     | What they can do                                        |
| ---------------- | ------------------------- | ------------------------------------------------------- |
| **Members**      | the phone app             | follow mosques, sign up for events, check in            |
| **Coordinators** | the app's `(admin)` shell | run _their_ mosque — posts, roster, iqamah              |
| **Us**           | the web console at :5173  | run the _platform_ — mosques, money, campaigns, support |

## Layout

```
M-Ensemble/
├── apps/
│   ├── mobile/            Expo + expo-router app (lucide-react-native icons)
│   │   ├── app/           File-based routes: (auth) · (tabs) member shell · (admin) coordinator shell · manage/* · post/ mosque/ checkin/ …
│   │   └── src/           api (+ mock client), components, hooks, i18n (EN/FR/AR), lib, push, store, theme, types
│   ├── admin/             The super-admin console — Vite + React, plain CSS
│   │   └── src/           api, auth, ui (primitives + inline-SVG charts), pages
│   └── server/            Express + Mongoose API
│       ├── src/           config, models, routes, controllers, middleware, services, utils
│       └── tests/
├── packages/
│   └── shared/            The contract: types, the `MEnsembleApi` interface, and the fixtures (mock + seed)
├── docs/
└── tsconfig.base.json     Shared compiler options
```

## Getting started

Requires Node 20+ and a MongoDB instance (local or Atlas).

```bash
npm install                      # installs all workspaces

cp apps/server/.env.example apps/server/.env
cp apps/mobile/.env.example apps/mobile/.env

npm run seed                     # writes the fixtures + the platform tier
npm run dev                      # all three, one terminal
```

`npm run dev` starts the API, waits for `/api/health` to answer, then brings up
the mobile bundler and the console and opens the console in a browser:

|             |                                                   |
| ----------- | ------------------------------------------------- |
| API         | <http://localhost:4000>                           |
| **Console** | <http://localhost:5173> — opens automatically     |
| Mobile      | <http://localhost:8081> — scan the QR for a phone |

The wait is not politeness. Expo and the console both make requests within a
second of booting, and against a server still connecting to Mongo those come
back refused — which looks like an empty dashboard and a "Network request
failed" toast rather than the race it is. Ctrl-C stops all three.

Flags: `--no-mobile` (skip the slow, loud one), `--no-admin`, `--no-open`,
`--tunnel` (Expo over a tunnel, for a phone on another network). The individual
`dev:server`, `dev:mobile` and `dev:admin` scripts still exist — reach for
`dev:mobile` when you need Expo's interactive keys, which the combined runner
cannot forward.

Sign in to the app as **yusuf@example.com / mensemble**; the demo coordinator is
**khadija.mosque@gmail.com / 123456**. The console is
**admin@mensemble.app / mensemble-admin** unless you changed `SUPERADMIN_*` in
`apps/server/.env`.
Every demo account — members, the six mosque coordinators and the console —
is in [Setup and credentials.md](<Setup and credentials.md>), alongside setup,
start and test instructions written for someone seeing the repo for the first
time.

On a physical device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP —
`localhost` points at the phone itself.

Build order and what's done lives in [plan.md](plan.md). Per-phase notes:

| Doc                                | What it covers                                                       |
| ---------------------------------- | -------------------------------------------------------------------- |
| [docs/phase-1.md](docs/phase-1.md) | Shell, push-token setup on a real phone                              |
| [docs/phase-2.md](docs/phase-2.md) | Member screens, prayer-time maths                                    |
| [docs/phase-3.md](docs/phase-3.md) | Coordinator shell and admin screens                                  |
| [docs/phase-4.md](docs/phase-4.md) | **Backend + DB spec** — every route, model, index, formula, the seed |
| [docs/phase-5.md](docs/phase-5.md) | Integration checklist, per-screen endpoint map                       |

## Maps

The Mosques tab and mosque profiles render **OpenStreetMap**, via Leaflet inside
a `react-native-webview`. No API key and no native map SDK — it behaves the same
in Expo Go on both platforms and in a standalone build. Tiles come from OSM's
public servers, so the map needs network (nothing else in the app does). On web
the map falls back to a list (`MosqueMap.web.tsx`).

## The super-admin console

`apps/admin` — a separate Vite + React app on :5173, sharing the contract in
`packages/shared` as **types only**.

It wears the app's clothes on purpose: every colour token in `styles.css` is
copied from `apps/mobile/src/theme/index.ts` value for value, the sidebar is the
app's own masthead gradient, the type is the app's Fraunces / Outfit / DM Mono,
and the logo is the same artwork in its on-dark cut. **Light only, like the
app** — there is no dark theme and no toggle, because the app has one look and a
console that flipped to near-black on a machine set to dark was showing a
product nobody designed.

Separate from the mobile app on purpose:
the console is dense tables and money on a wide screen, the app is a phone, and
one bundle would mean either react-native-web rendering data grids badly or
shipping every invoice screen to phones that will never open one.

### Two roles above the mosque

`Membership.role` says what you can do at _one mosque_. `User.platformRole` is a
tier above it and is not mosque-scoped:

| `platformRole` | Can                                                                             |
| -------------- | ------------------------------------------------------------------------------- |
| `none`         | nothing here — the default for every account                                    |
| `support`      | read every screen, and answer the support inbox                                 |
| `superadmin`   | everything: mint mosque credentials, move money, approve campaigns, grant roles |

**A coordinator is not a platform admin.** Someone holding `admin` at six
mosques still gets a 403 from every `/api/admin` route; the split is the point,
and [`tests/admin-platform.test.ts`](apps/server/tests/admin-platform.test.ts)
asserts it directly. `requirePlatform` guards the whole router and
`requireSuperAdmin` is added per-route, so reading
[`admin.routes.ts`](apps/server/src/routes/admin.routes.ts) tells you exactly
what a support account can and cannot do.

Every write goes through `audit.service`, which is append-only — there is no
update or delete path to that collection, and the log is readable by `support`
as well, since a log only the people it records can read is not much of a check
on them.

### What it does

- **Mosques** — onboard one, and mint its coordinator account in the same call.
  This replaces `COORDINATOR_EMAILS`, the literal in the fixtures that used to
  mean onboarding a mosque required editing source and shipping. The allowlist
  still works for the demo accounts; it is just no longer the only door.
  The issued password is shown **once** and never stored in readable form.
- **People** — search, inspect, suspend (never delete — that would orphan
  signups and silently change six mosques' attendance), reset a password, grant
  a mosque role or a platform role.
- **Billing** — subscriptions, invoices with payments, and donation passthrough
  with our fee split out. See the honesty note below.
- **Partners & campaigns** — advertisers, their flights, approval, and the
  delivery counters. We are the ad server; nothing talks to Meta or Google.
- **Support** — a ticket inbox with replies and internal notes.
- **Events** — publish or cancel on a mosque's behalf. The post shows as the
  mosque's; `createdBy` and the activity log keep who actually typed it honest.
- **Activity log** — every platform write, newest first. Append-only.

### The money is modelled, not processed

**No payment processor is connected.** Invoices are issued, payments are
recorded by hand, and every status moves because a person moved it. The shapes
are the ones a processor would write into — `externalRef` on a subscription,
`reference` and `method` on a payment — so connecting Stripe later is new code
at the edges rather than a migration through the middle. The billing screen says
so on the screen, not only in the source, because a page that looks automated
and is not is how a mosque ends up thinking it has paid.

Amounts are integer cents everywhere. A payment entered in error is corrected
with a **negative row**, never an edit — cash reconciled once and then quietly
changed is exactly what an audit trail exists to catch.

### Partner ads in the feed

A campaign carries a creative, a flight, a budget and targeting on city, mosque
and declared interests. `GET /api/ads/slot` serves it to the app and
`POST /api/ads/:id/events` counts an impression or a click; a campaign stops
serving the moment its spend crosses its budget, rather than waiting for a job.

Three things worth not undoing:

- **The card is unlike a post on purpose.** `PromoCard` has no avatar, no mosque
  name, a sunken ground rather than a white card, and a disclosure line _above_
  the headline. If a reader has to look twice to tell whether the mosque is
  recommending a restaurant, the card has failed however well it performs.
- **Never the first row.** `AD_SLOTS` puts it three posts down. An advert at the
  top of a mosque's noticeboard reads as the mosque endorsing it.
- **Interests come off the token, never the query string.** A client that could
  name its own targeting could enumerate every campaign on the platform. And
  `ServedAd` carries no budget, rate or targeting — those are facts about a deal
  the reader is not party to.

### Uploads

One image pipeline, two doors. Both re-encode through `sharp` to a JPEG at up
to 1200px, apply the EXIF rotation and drop the rest of the metadata — including
the GPS coordinates a phone writes into a photo.

| Endpoint                   | Who                                             | For                               |
| -------------------------- | ----------------------------------------------- | --------------------------------- |
| `POST /api/uploads/poster` | that mosque's coordinator, **or** a super admin | post posters                      |
| `POST /api/uploads/image`  | super admin                                     | partner logos, campaign creatives |

The super-admin case on the first row is the seam worth knowing about: a
platform admin holds no `Membership` anywhere, so the plain mosque guard would
refuse them on every mosque there is — and the poster field would be
permanently broken on the one screen that publishes for a mosque.

Every image field — `Post.imageUrl`, `Advertiser.logoUrl`,
`Campaign.creative.imageUrl` — accepts **only a path this server minted**. These
are rendered by clients we do not control, so a free-form URL would let one
operator point every reader's app at a host they own.

Uploading happens **on pick, not on save**, in the console and in the app alike.
The slow part is over while the form is still being filled in, so the Save
button only ever sends JSON and cannot fail for a reason unrelated to what was
typed. The cost is an orphan file when somebody abandons a form; there is no
sweep for those yet.

### The activity log

Every change made from the console is written to it automatically: a mosque
created, credentials issued, an invoice voided, a campaign approved, an account
suspended. **Append-only** — there is no edit and no delete, in the console or
in the API, because a record the people it describes can change answers no
question worth asking it. Support accounts can read it, for the same reason.

The seed writes a history so a fresh database does not open on an empty screen
that reads as a broken feature.

### The charts

Inline SVG, no chart library. The palette is not a taste call: it was run
through the data-viz validator against this app's own light and dark surfaces
and clears the lightness band, chroma floor, CVD separation and normal-vision
separation on the adjacent pairlist in both modes. Slots 1 and 2 are the brand's
teal and orange, stepped until they cleared the chroma floor — `#0C6358` reads
as grey to the validator at chart size.

In light mode two hues sit below 3:1 against the surface. That is a WARN with an
obligation attached, which is why **every chart ships a table view** — the
"Table" toggle is part of the chart frame, not a per-chart choice. Two other
rules the file holds to: never a dual axis (impressions and clicks are two
charts, not two scales), and colour follows the entity rather than its rank.

## Scripts

| Command                           | What it does                                  |
| --------------------------------- | --------------------------------------------- |
| `npm run dev`                     | **API + console + mobile, one terminal**      |
| `npm run dev:server`              | Express API in watch mode                     |
| `npm run dev:mobile`              | Expo dev server                               |
| `npm run dev:admin`               | The console alone (needs the API running)     |
| `npm run seed`                    | Fixtures + the platform tier, as upserts      |
| `npm run build`                   | Type-gate shared + server, bundle the console |
| `npm run typecheck`               | Type-check every workspace                    |
| `npm test`                        | Run workspace tests                           |
| `npm run format`                  | Prettier across the repo                      |
| `node scripts/build-app-icons.js` | Launcher, splash and web-install icons        |

## API

Base path `/api`. Every route in [docs/phase-4.md](docs/phase-4.md) is built:
auth, `/me`, mosques, feed, posts, signups and check-in, the four admin derived
views, prayer times and iqamah, and the Expo push fan-out.
[apps/server/requests.http](apps/server/requests.http) walks all of them in
order and captures its own tokens.

The console adds `/api/admin/*` (behind a platform role) and `/api/ads/*` (the
two endpoints the app calls) on top of that.

```bash
npm run seed        # upserts the fixtures and the platform tier
npm run dev:server  # http://localhost:4000
```

Seeding **deletes nothing** — every write is an upsert keyed by `_id`, so a
re-seed refreshes the demo content and leaves real accounts alone.
`npm run seed:reset --workspace @m-ensemble/server` is the destructive one and
asks before doing it.

Every seeded volunteer signs in with `mensemble` — `yusuf@example.com` is a
member; the demo coordinator is `khadija.mosque@gmail.com` / `123456` and
coordinates Khadija. Fixture dates are computed when
the module is imported, so **re-seed on the morning of the demo**.

Two things about the server workspace worth knowing before you edit it:

- It runs from `tsx`, not from an emitted `dist/`. `@m-ensemble/shared` is
  consumed as TypeScript source, which `tsc` cannot emit through, so `build` is
  a type gate and `start` runs the sources.
- Runtime values from the shared package come through
  [apps/server/src/shared.ts](apps/server/src/shared.ts); `import type` from
  `@m-ensemble/shared` directly. That file explains why.

Every response uses the `ApiResponse<T>` envelope from `@m-ensemble/shared`:
`{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Error codes
are the uppercase constants in `API_ERROR`.

## Posters and image uploads

Two different things share one slot on a post, and it is worth keeping them
apart.

**Bundled posters** are the ten programme designs made with the mosques. The
masters live in `event posters/` (1200×675 at 2×) and
`node scripts/build-poster-assets.js` writes the display copies into
`apps/mobile/assets/posters/`, where they ship inside the app bundle. A post
names one with `posterKey`, which indexes a literal `require` map in
[Poster.tsx](apps/mobile/src/components/Poster.tsx) — Metro resolves requires
at build time, so the path cannot be built from data. The seed uses these, and
they need no network.

**Uploaded posters** are what a mosque adds from the create/edit form.
`POST /api/uploads/poster` takes one multipart image, and the coordinator has
to administer the `mosqueId` in the body. `sharp` re-encodes it to JPEG at up
to 1200px wide, applying the EXIF rotation and dropping the rest of the
metadata — including the GPS coordinates a phone writes into a photo. The
result is written to `UPLOAD_DIR` (`apps/server/uploads/`, gitignored) under a
UUID and served by `express.static` at `/uploads/<id>.jpg`.

Three decisions in there that are easy to undo by accident:

- **The stored path is server-relative, never absolute.** This API answers on a
  different address from every machine that reaches it — localhost, a LAN IP
  from a phone, 4100 under test — so an absolute URL in the database is right
  exactly once. `resolveMediaUrl` in [http.ts](apps/mobile/src/api/http.ts)
  resolves it against whichever base the app is already using.
- **`imageUrl` only accepts a path this server minted.** It is rendered by
  every client that shows the post, so a free-form URL would let one admin
  point every reader's app at a host they control. The regex is in
  [post.schema.ts](apps/server/src/schemas/post.schema.ts).
- **`/uploads` sets `Cross-Origin-Resource-Policy: cross-origin`.** Helmet
  defaults it to `same-origin`, and the app is never same-origin with the API.
  Without the override the fetch succeeds and the browser then refuses to paint
  the image, which reads as a broken file rather than a header.

The upload happens when the poster is picked, not when the post is published,
so the slow part is over before anyone presses Publish. The cost is that a
poster picked for a post nobody goes on to publish leaves an orphan file;
there is no sweep for those yet.

**Local disk means the files live with the process.** A container with an
ephemeral filesystem loses them on redeploy — point `UPLOAD_DIR` at a mounted
volume, or swap `storePoster` for a bucket, which is why every byte goes
through that one function rather than being written from the route.

## Icons and splash screens

`splash_screens/` is the export from a PWA asset generator: the 512px app icon
and one startup image per device. `node scripts/build-app-icons.js` turns it
into everything the app actually ships —

- `apps/mobile/assets/` — the 1024² launcher icon (RGB, no alpha, which is what
  the App Store requires), the Android adaptive-icon foreground, the splash
  image, a white notification silhouette for the Android tray, and a favicon.
- `apps/mobile/public/` — `manifest.json`, the touch icon, the PWA icons and
  the 22 portrait startup images. The landscape ones are dropped: the app is
  portrait-only, so they could never match.
- `apps/mobile/src/web/appleStartupImages.ts` — generated, and read by
  [app/+html.tsx](apps/mobile/app/+html.tsx). Do not edit it by hand.

One ground colour throughout — the cream the icon was drawn on, `#F7F7EF`, for
the launcher, the Android background and the splash. Keeping the artwork on the
colour it was flattened onto is what avoids a pale fringe on every
anti-aliased edge.

**The web build is statically rendered** (`web.output` is `static` in
app.json), which is what lets `+html.tsx` set the install tags at all. Every
route exports its own HTML file; the dynamic ones (`/post/[id]`) still need the
host to fall back to `index.html`, so set that up wherever it is deployed.

## License

MIT — see [LICENSE](LICENSE).
