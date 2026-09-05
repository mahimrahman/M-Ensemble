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

Base path `/api`. Today the server exposes `GET /health` plus a scaffold; the
full route list the app already calls, and the rules behind each, is in
[docs/phase-4.md](docs/phase-4.md).

Every response uses the `ApiResponse<T>` envelope from `@m-ensemble/shared`:
`{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Error codes
are the uppercase constants in `API_ERROR`.

## License

MIT — see [LICENSE](LICENSE).
