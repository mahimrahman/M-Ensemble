# Phase 1 — Shell

What landed, and the two steps only a human with a phone in their hand can finish.

## What's in the repo

| Plan item                                                                | Where                                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Locked types (Phase 0)                                                   | [packages/shared/src/types.ts](../packages/shared/src/types.ts)                     |
| Locked `api` interface (Phase 0)                                         | `MEnsembleApi` in [packages/shared/src/api.ts](../packages/shared/src/api.ts)       |
| Mock client                                                              | [apps/mobile/src/api/mock/mockClient.ts](../apps/mobile/src/api/mock/mockClient.ts) |
| Fixtures — 6 mosques, 19 posts, 20 members (shared with the seed script) | [packages/shared/src/fixtures.ts](../packages/shared/src/fixtures.ts)               |
| Design tokens, one file                                                  | [apps/mobile/src/theme/index.ts](../apps/mobile/src/theme/index.ts)                 |
| `Card` `Button` `Badge` `EmptyState` `Loading` (+ `Field`, `Screen`)     | [apps/mobile/src/components/](../apps/mobile/src/components/)                       |
| Auth stack → main tabs                                                   | [apps/mobile/app/](../apps/mobile/app/)                                             |
| Push registration                                                        | [apps/mobile/src/push/notifications.ts](../apps/mobile/src/push/notifications.ts)   |

Tabs are **Feed · Mosques · My Stuff · Profile**, exactly the Phase 2 split. Each
tab screen is a working shell reading through `api` — proof the whole chain runs
on device, not a placeholder to be preserved. Phase 2 and 3 replace the bodies.

## The rule

Every screen imports `api` from `@/api/client`. Nothing else. `USING_MOCKS` picks
the implementation:

```
EXPO_PUBLIC_USE_MOCKS=true    # phases 1–4: in-memory fixtures
EXPO_PUBLIC_USE_MOCKS=false   # phase 5: the real server
```

The HTTP client ([src/api/http.ts](../apps/mobile/src/api/http.ts)) is already
written against the Phase 4 route list, so the Phase 5 switch is a `.env` edit.
Both clients throw the same `ApiRequestError` with the same codes (`FULL`,
`ALREADY_SIGNED_UP`, `BAD_CREDENTIALS`, …), so error handling written now
survives the swap.

Five routes the plan's list doesn't name are assumed by the HTTP client:
`GET /me/mosques`, `GET /mosques/:id/posts`, `GET|PUT /me/notification-prefs`,
`POST /me/push-token`, `GET /users?ids=`. Server owner: add them, or tell the app owner and we
adjust `http.ts`.

## Run it

```bash
npm install
cp apps/mobile/.env.example apps/mobile/.env
npm run dev:mobile
```

Scan the QR with Expo Go. Sign in with **yusuf@example.com / mensemble**, or tap
_Continue as demo member_. Any seeded member signs in with the same password.

## Step 0 — sign in, once, on both ends

Current Expo Go refuses to open a project unless the dev server signs the
manifest with a development certificate, and the CLI can only do that when the
project has an EAS project id **and** the CLI is logged in to the account that
owns it. Skip this and every scan ends in _"There was a problem running the
requested project. You need to sign in to Expo Go and Expo CLI"_ — regardless
of Wi-Fi, firewall, or QR mode.

From `apps/mobile`, one time:

```bash
npx expo login          # the Expo account the project will belong to
npx eas-cli init        # writes extra.eas.projectId into app.json — commit it
npx expo whoami         # must print the username, not "Not logged in"
```

Then in **Expo Go** on every phone: Profile tab → sign in with the **same**
account. Restart `npx expo start` after logging in; the first scan fetches and
caches the certificate.

Only the person who owns the Expo account can do this; teammates who start the
dev server on their own laptops must be logged in to an account that has access
to the same EAS project (add them as members on expo.dev).

## Step 1 — get it on a physical phone

Not a simulator. Simulators never receive remote push, and finding that out at
hour 18 is the failure mode the plan is written to avoid.

- Phone and laptop on the same Wi-Fi.
- If the QR won't connect, run `npx expo start --tunnel`.
- The project is on **Expo SDK 57** — install current Expo Go from the store.
- Leave the CLI in **Expo Go** mode. Pressing `s` in the terminal switches to
  development-build mode, which prints a `mensemble://` link Expo Go can't open.
- **Android + remote push needs a development build.** Since SDK 53, Expo Go on
  Android doesn't receive remote push (local notifications still fire). Expo Go
  on iOS still does. For the two-phone demo, put the _member_ on an iPhone with
  Expo Go, or build Android once: `cd apps/mobile && npx expo run:android`
  (needs Android Studio / an SDK on the laptop, ~10 min first time).

## Step 2 — prove a push arrives

Push tokens need the same EAS project id Step 0 wrote into `app.json`. On the
phone:

1. Open **Profile**. Accept the notification prompt.
2. The push panel should read **Registered** and show an `ExponentPushToken[…]`.
3. Tap **Fire a local test notification** — a banner proves the notification
   handler and the Android channel are wired.
4. Tap **Copy token**, paste it into <https://expo.dev/notifications>, send.
   A banner arriving from Expo's servers is the real Phase 1 exit criterion.

If the panel says _Unavailable_, read the reason it prints:

| Reason             | Fix                                                                               |
| ------------------ | --------------------------------------------------------------------------------- |
| "physical device"  | You're on a simulator.                                                            |
| Missing project id | Do Step 0 (`npx eas-cli init`), restart the dev server.                           |
| _Denied_           | Enable notifications for Expo Go in system settings, then **Retry registration**. |

Phase 4 sends to these tokens; `api.registerPushToken` already hands each one to
the client, so the fan-out has somewhere to read them from.

## Exit criteria

- [x] Navigation: auth stack → four main tabs
- [x] Design tokens in one file
- [x] lucide-react-native wired
- [x] `Card` `Button` `Badge` `EmptyState` `Loading`
- [x] Fixtures — Khadija + Madina (+ 4 more to browse), 19 posts, 20 members
- [x] Cards render from the mock client; `npm run typecheck` and the Android
      bundle both build clean
- [ ] **Runs on a physical phone** — step 1
- [ ] **A test push arrives on that phone** — step 2

## Notes for the next phases

- **Prayer times.** Real since Phase 2 — see [phase-2.md](phase-2.md).
- **Iqamah is wall-clock.** `"20:30"`, never UTC. The `WallClock` type says so.
- **Slot claims.** The mock checks the confirmed count and increments together,
  and throws `FULL` — the same shape as Phase 4's `findOneAndUpdate` guard, so
  the two-phone race test exercises UI that already handles the error.
- **`Follow` vs `Membership`** are separate types already. Keep them that way.
