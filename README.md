# M-Ensemble

React Native (Expo) mobile app with an Express + MongoDB API, all TypeScript.

## Layout

```
M-Ensemble/
├── apps/
│   ├── mobile/            Expo + expo-router app (lucide-react-native icons)
│   │   ├── app/           File-based routes: (auth) · (tabs) member shell · (admin) coordinator shell · manage/* · post/ mosque/ checkin/ …
│   │   └── src/           api (+ mock client), components, hooks, i18n (EN/FR/AR), lib, push, store, theme, types
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

npm run dev:server               # API on http://localhost:4000
npm run dev:mobile               # Expo dev server
```

The app ships on mocks: `EXPO_PUBLIC_USE_MOCKS=true` makes every screen read
in-memory fixtures for Khadija and Madina, so the mobile app needs neither the
server nor Mongo. Sign in as **yusuf@example.com / mensemble**. Set the flag to
`false` to point the same screens at the API — see [docs/phase-1.md](docs/phase-1.md).

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

## Scripts

| Command                           | What it does                           |
| --------------------------------- | -------------------------------------- |
| `npm run dev:server`              | Express API in watch mode              |
| `npm run dev:mobile`              | Expo dev server                        |
| `npm run build`                   | Compile shared + server to `dist/`     |
| `npm run typecheck`               | Type-check every workspace             |
| `npm test`                        | Run workspace tests                    |
| `npm run format`                  | Prettier across the repo               |
| `node scripts/build-app-icons.js` | Launcher, splash and web-install icons |

## API

Base path `/api`. Every route in [docs/phase-4.md](docs/phase-4.md) is built:
auth, `/me`, mosques, feed, posts, signups and check-in, the four admin derived
views, prayer times and iqamah, and the Expo push fan-out.
[apps/server/requests.http](apps/server/requests.http) walks all of them in
order and captures its own tokens.

```bash
npm run seed --workspace @m-ensemble/server   # wipes and rewrites the 8 collections
npm run dev:server                            # http://localhost:4000
```

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
