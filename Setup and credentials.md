# Setup and credentials

Everything a judge needs to run M-Ensemble and sign in to all three surfaces:
the phone app, the mosque-coordinator shell inside it, and the super-admin web
console.

Every account in this file was signed in against a running API and its role
checked end to end on **2026-09-06**. Nothing here is a placeholder.

---

## 1. What you need

|             |                                                                   |
| ----------- | ----------------------------------------------------------------- |
| **Node**    | 20 or newer (`.nvmrc` pins 20 — `nvm use` picks it up)            |
| **MongoDB** | a local `mongod`, or an Atlas connection string                   |
| Optional    | the **Expo Go** app on a phone, to run the mobile app on a device |

No Mongo? The quickest local one is Docker:

```bash
docker run -d --name m-ensemble-mongo -p 27017:27017 mongo:7
```

## 2. Set up

```bash
npm install                                # installs all workspaces at once

cp apps/server/.env.example apps/server/.env
cp apps/mobile/.env.example apps/mobile/.env

npm run seed                               # demo data + the platform tier
```

`apps/server/.env` is the only file you may need to edit. Point `MONGODB_URI` at
your Mongo (`mongodb://127.0.0.1:27017/m_ensemble` for a local one) and set
`JWT_SECRET` to any non-empty string. Everything else has a working default.

**Leave `apps/mobile/.env` alone.** With `EXPO_PUBLIC_API_URL` unset, the app
derives the API host from whichever dev server the bundle came from, so it
follows the laptop onto a new network by itself. A pinned IP does the opposite:
it survives the network change that invalidated it, and then hangs rather than
failing, which is what leaves every screen spinning.

### About the seed

`npm run seed` writes ten mosques, twenty volunteers, the posts, signups and
prayer configs, plus the platform tier — invoices, campaigns, tickets, the audit
log — so no screen opens empty.

Every write is an **upsert keyed by `_id`**, so seeding deletes nothing: run it
twice and it refreshes the demo content while leaving any account created since
alone. (`npm run seed:reset --workspace @m-ensemble/server` is the destructive
one, and it asks first.)

**Re-seed the morning of the demo.** Fixture dates are computed when the module
is imported, so in a week-old seed "tomorrow's event" is last week's.

## 3. Start

```bash
npm run dev        # API, console and mobile bundler in one terminal
```

| Surface                 | URL                     | Notes                                                  |
| ----------------------- | ----------------------- | ------------------------------------------------------ |
| API                     | <http://localhost:4000> |                                                        |
| **Super-admin console** | <http://localhost:5173> | opens in a browser automatically                       |
| Mobile (Expo)           | <http://localhost:8081> | scan the QR with Expo Go, or press `w` for the browser |

`Ctrl-C` stops all three. The runner waits for `/api/health` to answer before
starting the other two — Expo and the console both make requests within a second
of booting, and against a server still connecting to Mongo those come back
refused, which looks like an empty dashboard rather than the race it is.

Flags: `--no-mobile` (skip the slow, loud one), `--no-admin`, `--no-open`,
`--tunnel` (Expo over a tunnel, for a phone on another Wi-Fi). Or run the pieces
separately with `npm run dev:server`, `dev:admin`, `dev:mobile`.

**On a physical phone**, scan the Expo QR with the phone on the same Wi-Fi.
`localhost` on a phone means the phone itself, so if you must hard-code an
address, set `EXPO_PUBLIC_API_URL` to the laptop's LAN IP.

---

## 4. Credentials

There is **one account system**. The same `POST /api/auth/login` serves the phone
app and the web console; what differs is what the account holds afterwards — a
mosque `Membership.role` (member / admin), or a `User.platformRole` (none /
support / superadmin). A coordinator at six mosques still gets a 403 from every
`/api/admin` route. That split is the point.

The login fields start **empty**. The two demo accounts are one tap away at the
bottom of the sign-in screen.

### Member — the phone app

The member shell: feed, mosque profiles, event signup, check-in, prayer times,
volunteer hours and reliability.

| Name         | Email               | Password    |
| ------------ | ------------------- | ----------- |
| Yusuf Benali | `yusuf@example.com` | `mensemble` |

Two spares, same password, if two judges want to be signed in at once:

| Name        | Email               | Password    |
| ----------- | ------------------- | ----------- |
| Omar Haddad | `omar@example.com`  | `mensemble` |
| Aisha Ndoye | `aisha@example.com` | `mensemble` |

Every other seeded volunteer (`layla`, `hamza`, `zainab`, `tariq`, `hafsa`,
`salman` … `@example.com`) also signs in with `mensemble`.

### Mosque coordinator — the app's `(admin)` shell

Same app, same login screen. Holding `admin` at a mosque unlocks the coordinator
shell instead of the member one: create and edit posts, the volunteer roster,
check-in, and the mosque's iqamah times.

| Mosque                                     | Email                      | Password    |
| ------------------------------------------ | -------------------------- | ----------- |
| **Khadijah Islamic Center** — the demo one | `khadija.mosque@gmail.com` | `123456`    |
| Al-Madinah Center                          | `bilal@example.com`        | `mensemble` |
| Salahouddine Mosque                        | `fatima@example.com`       | `mensemble` |
| Canadian Institute of Islamic Civilization | `sumaya@example.com`       | `mensemble` |
| Centre Islamique de Verdun                 | `nadia@example.com`        | `mensemble` |
| Mosquée Fatima                             | `mariam@example.com`       | `mensemble` |

**Use `khadija.mosque@gmail.com` for the walkthrough** — Khadijah carries the
richest seeded content. Its password is short on purpose: it gets typed on a
borrowed phone in front of a room. It clears the app's six-character floor and
nothing more, and it is a demo trade-off rather than a standard.

#### The access gate, if you want to see it

`coordinator@alrawdah.ca` is **pre-approved but has no account yet** (confirmed:
no such user in the database). Sign _up_ with that email and any password of six
characters or more, and the account lands in the Mosquée Al-Rawdah coordinator
screens on its first session — the role is derived from the email, never read
off the request body. Sign up with any other address and you get an ordinary
member. It is the cleanest way to show that coordinator access is granted, not
requested.

### Super admin — the web console at :5173

Runs the platform: onboard mosques and mint their coordinator logins, people and
roles, billing, partners and campaigns, the support inbox, the audit log.

| Name           | Email                 | Password          |
| -------------- | --------------------- | ----------------- |
| Platform Admin | `admin@mensemble.app` | `mensemble-admin` |

Verified: `GET /api/admin/me` returns `platformRole: superadmin`, so the console
guard passes and every write route is open.

This one is not a literal in the seed — it comes from `SUPERADMIN_EMAIL` and
`SUPERADMIN_PASSWORD` in `apps/server/.env`, which are unset by default, so the
values above apply. Change those and this row changes with them.

There is no seeded `support` account. To show the read-only staff tier, sign in
as the super admin and grant `support` to any member from **People → user →
platform role**. That account can then read every console screen and answer the
support inbox, but cannot move money or approve a campaign.

### Verified

| Account                    | Login | Role check                                  |
| -------------------------- | ----- | ------------------------------------------- |
| `yusuf@example.com`        | ok    | `/me/memberships` → `mosque_khadija:member` |
| `omar@example.com`         | ok    | member                                      |
| `aisha@example.com`        | ok    | member                                      |
| `khadija.mosque@gmail.com` | ok    | `mosque_khadija:admin`                      |
| `bilal@example.com`        | ok    | `mosque_madina:admin`                       |
| `fatima@example.com`       | ok    | `mosque_salahouddine:admin`                 |
| `sumaya@example.com`       | ok    | `mosque_ciic:admin`                         |
| `nadia@example.com`        | ok    | `mosque_verdun:admin`                       |
| `mariam@example.com`       | ok    | `mosque_fatima:admin`                       |
| `admin@mensemble.app`      | ok    | `/admin/me` → `platformRole: superadmin`    |

All ten are `status: active` — none suspended.

---

## 5. How to test

### The automated suites

```bash
npm test            # the API suite — routes, guards, lifecycles, the maths
npm run smoke       # boots the real server process end to end
npm run typecheck   # every workspace
npm run build       # type-gates shared + server, bundles the console
```

Both suites are **hermetic**. `npm test` runs against its own in-memory mongod
and overrides `MONGODB_URI` from the vitest config, so it cannot reach a real
cluster even with an `.env` pointing at one. `npm run smoke` starts its own
mongod _and_ the actual `index.ts` on **port 4100** — never 4000 — so it proves
the boot path rather than only the routes, and cannot collide with a dev server.

The first `npm test` downloads a mongod binary, so allow a few minutes; later
runs are quick. Worth knowing what a few of them assert, since they are the
claims most worth checking:

- `admin-platform.test.ts` — a coordinator, however many mosques they run, is
  refused by every `/api/admin` route.
- `seed-preserves-accounts.test.ts` — re-seeding does not clobber accounts.
- `signup-race.test.ts` — two people taking the last spot at once.
- `reliability.test.ts`, `iqamah-prayer.test.ts` — the derived numbers.

### The five-minute walkthrough

1. **Member** — sign in as `yusuf@example.com` / `mensemble`. Browse the feed,
   open a mosque, sign up for an event, then find it under _My stuff_.
2. **Coordinator** — sign out, sign in as `khadija.mosque@gmail.com` / `123456`.
   The app opens the coordinator shell instead, and the roster now shows Yusuf on
   that event. Publish a post, then check the member account's feed for it.
3. **Check-in** — the coordinator's check-in screen scans the member's QR off the
   other phone, or takes the code by hand.
4. **Console** — open <http://localhost:5173> and sign in as
   `admin@mensemble.app` / `mensemble-admin`. Onboard a mosque and watch it mint
   that mosque's coordinator login (shown once, never stored readably), then find
   both actions already written into the audit log.
5. **The gate** — sign up in the app as `coordinator@alrawdah.ca`, and land in the
   Al-Rawdah coordinator screens with no further step.

Two phones make steps 1–3 much better than one; failing that, run the app in two
browser tabs by pressing `w` in the Expo terminal.

### Checking the API directly

`apps/server/requests.http` walks every endpoint in order and captures its own
tokens — open it in VS Code with the REST Client extension. Or by hand:

```bash
curl http://localhost:4000/api/health
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"yusuf@example.com","password":"mensemble"}'
```

---

## 6. If something looks wrong

- **Every screen spinning, or "Network request failed"** — the API is not up, or
  the phone cannot route to the laptop. Check
  <http://localhost:4000/api/health>, and that the phone is on the same Wi-Fi
  (or use `npm run dev -- --tunnel`).
- **Dashboard empty, events in the past** — the seed is stale. `npm run seed`.
- **`BAD_CREDENTIALS`** — the API returns the same message for a wrong email and
  a wrong password, by design; it never confirms whether an address has an
  account. Check the spelling against the tables above, and that you seeded.
- **The console rejects a correct password** — that account has no platform role.
  Only `admin@mensemble.app` does, unless you granted one.
- **Re-seeding did not restore the super-admin password** — it never does. That
  password is written only when the account is created, so a re-seed cannot
  silently reset one an operator has since changed. Change it in the console, or
  set `SUPERADMIN_*` in `apps/server/.env` against a fresh database.
- **Port already in use** — something else holds 4000, 5173 or 8081. Stop it, or
  set `PORT` in `apps/server/.env`.
