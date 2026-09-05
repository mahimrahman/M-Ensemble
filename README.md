# M-Ensemble

React Native (Expo) mobile app with an Express + MongoDB API, all TypeScript.

## Layout

```
M-Ensemble/
├── apps/
│   ├── mobile/            Expo + expo-router app (lucide-react-native icons)
│   │   ├── app/           File-based routes
│   │   └── src/           components, api, hooks, theme, store, types
│   └── server/            Express + Mongoose API
│       ├── src/           config, models, routes, controllers, middleware, services, utils
│       └── tests/
├── packages/
│   └── shared/            Types shared by mobile and server
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

On a physical device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP —
`localhost` points at the phone itself.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev:server` | Express API in watch mode |
| `npm run dev:mobile` | Expo dev server |
| `npm run build` | Compile shared + server to `dist/` |
| `npm run typecheck` | Type-check every workspace |
| `npm test` | Run workspace tests |
| `npm run format` | Prettier across the repo |

## API

Base path `/api`.

| Method | Route | Description |
| --- | --- | --- |
| GET | `/health` | Liveness + DB connection state |
| GET | `/users` | List users |
| POST | `/users` | Create a user |

Every response uses the `ApiResponse<T>` envelope from `@m-ensemble/shared`:
`{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

## License

MIT — see [LICENSE](LICENSE).
