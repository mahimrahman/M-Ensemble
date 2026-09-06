# Judge access — M-Ensemble

Every account below was signed in against the running API and its role checked
end to end on **2026-09-06**. Nothing here is a placeholder.

There is **one account system**. The same `POST /api/auth/login` serves the phone
app and the web console; what differs is what the account holds afterwards —
a mosque `Membership.role` (member / admin) or a `User.platformRole`
(none / support / superadmin). A coordinator at six mosques still gets a 403
from every `/api/admin` route. That split is the point of the architecture.

## Where to sign in

| Surface                     | URL                       | Who signs in there                   |
| --------------------------- | ------------------------- | ------------------------------------ |
| Mobile app (Expo)           | <http://localhost:8081>   | members and mosque coordinators      |
| Super-admin console         | <http://localhost:5173>   | platform staff only                  |
| API                         | <http://localhost:4000>   | —                                    |

Start everything with `npm run dev` from the repo root. On a physical phone,
scan the Expo QR; `localhost` on a phone points at the phone itself, so set
`EXPO_PUBLIC_API_URL` to the machine's LAN IP if you go that route.

---

## 1. Member — the phone app

Signs in to the member shell: feed, mosque profiles, event signup, check-in,
prayer times, hours and reliability.

| Name         | Email                | Password    |
| ------------ | -------------------- | ----------- |
| Yusuf Benali | `yusuf@example.com`  | `mensemble` |

This is the account the login screen offers by default. Two spare members, same
password, if two judges want to sign in at once:

| Name        | Email                | Password    |
| ----------- | -------------------- | ----------- |
| Omar Haddad | `omar@example.com`   | `mensemble` |
| Aisha Ndoye | `aisha@example.com`  | `mensemble` |

Every other seeded volunteer (`bilal`, `layla`, `hamza`, `zainab`, `tariq`,
`hafsa`, `salman` … `@example.com`) also signs in with `mensemble`.

## 2. Mosque coordinator — the app's `(admin)` shell

Same app, same login screen. Holding `admin` at a mosque unlocks the
coordinator shell: create and edit posts, the roster, check-in, iqamah times.

| Mosque                                    | Email                       | Password    |
| ----------------------------------------- | --------------------------- | ----------- |
| **Khadijah Islamic Center** — the demo one| `khadija.mosque@gmail.com`  | `123456`    |
| Al-Madinah Center                         | `bilal@example.com`         | `mensemble` |
| Salahouddine Mosque                       | `fatima@example.com`        | `mensemble` |
| Canadian Institute of Islamic Civilization| `sumaya@example.com`        | `mensemble` |
| Centre Islamique de Verdun                | `nadia@example.com`         | `mensemble` |
| Mosquée Fatima                            | `mariam@example.com`        | `mensemble` |

**Use `khadija.mosque@gmail.com` for the walkthrough** — Khadijah carries the
richest seeded content. Its password is short on purpose: it gets typed on a
borrowed phone in front of a room. It clears the app's six-character floor and
nothing more, and it is a demo trade-off rather than a standard.

### The access gate, if a judge wants to see it

`coordinator@alrawdah.ca` is **pre-approved but has no account yet** (confirmed:
no such user in the database). Sign *up* with that email and any password of six
characters or more, and the account lands in the Mosquée Al-Rawdah coordinator
screens on its first session — the role is derived from the email, never read
off the request body. Sign up with any other address and you get an ordinary
member. That is the cleanest way to show that coordinator access is granted,
not requested.

## 3. Super admin — the web console at :5173

Runs the platform: onboard mosques and mint their coordinator logins, people
and roles, billing, partners and campaigns, the support inbox, the audit log.

| Name           | Email                 | Password          |
| -------------- | --------------------- | ----------------- |
| Platform Admin | `admin@mensemble.app` | `mensemble-admin` |

Verified: `GET /api/admin/me` returns `platformRole: superadmin`, so the console
guard passes and every write route is open.

This one is not a literal in the seed — it comes from `SUPERADMIN_EMAIL` /
`SUPERADMIN_PASSWORD` in `apps/server/.env`, which are currently unset, so the
defaults above apply. If someone changes those, this row changes with them.

There is no seeded `support` account. To show the read-only staff tier, sign in
as the super admin and grant `support` to any member from **People → user →
platform role**; that account can then read every console screen and answer the
support inbox, but cannot move money or approve a campaign.

---

## Before the judges arrive

```bash
npm run seed     # upserts fixtures + the platform tier; deletes nothing
npm run dev      # API :4000, console :5173, Expo :8081
```

**Re-seed the morning of the demo.** Fixture dates are computed when the module
is imported, so "tomorrow's event" in a week-old seed is last week's. Seeding is
all upserts keyed by `_id`, so re-running it refreshes the demo content and
leaves any account created during the demo alone.

Two things that would otherwise look like bugs:

- Re-seeding **does not reset a password** on an account that already exists —
  the super admin's password is written only when the account is created. If
  someone changes it in the console, this file is stale, not the seed.
- A wrong email and a wrong password return the same `BAD_CREDENTIALS` message,
  by design; the API never confirms whether an address has an account.

## Verified

| Account                     | Login | Role check                                 |
| --------------------------- | ----- | ------------------------------------------ |
| `yusuf@example.com`         | ok    | `/me/memberships` → `mosque_khadija:member`|
| `omar@example.com`          | ok    | member                                     |
| `aisha@example.com`         | ok    | member                                     |
| `khadija.mosque@gmail.com`  | ok    | `mosque_khadija:admin`                     |
| `bilal@example.com`         | ok    | `mosque_madina:admin`                      |
| `fatima@example.com`        | ok    | `mosque_salahouddine:admin`                |
| `sumaya@example.com`        | ok    | `mosque_ciic:admin`                        |
| `nadia@example.com`         | ok    | `mosque_verdun:admin`                      |
| `mariam@example.com`        | ok    | `mosque_fatima:admin`                      |
| `admin@mensemble.app`       | ok    | `/admin/me` → `platformRole: superadmin`   |

All ten accounts are `status: active` — none suspended.
