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

| Command              | What it does                       |
| -------------------- | ---------------------------------- |
| `npm run dev:server` | Express API in watch mode          |
| `npm run dev:mobile` | Expo dev server                    |
| `npm run build`      | Compile shared + server to `dist/` |
| `npm run typecheck`  | Type-check every workspace         |
| `npm test`           | Run workspace tests                |
| `npm run format`     | Prettier across the repo           |

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

Everyone in the seed signs in with `mensemble` — `yusuf@example.com` is a
member, `amina@example.com` coordinates Khadija. Fixture dates are computed when
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

## License

MIT — see [LICENSE](LICENSE).
