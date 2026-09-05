# Phase 1 — Shell

What landed, and the two steps only a human with a phone in their hand can finish.

## What's in the repo

| Plan item | Where |
| --- | --- |
| Locked types (Phase 0) | [packages/shared/src/types.ts](../packages/shared/src/types.ts) |
| Locked `api` interface (Phase 0) | `MEnsembleApi` in [packages/shared/src/api.ts](../packages/shared/src/api.ts) |
| Mock client | [apps/mobile/src/api/mock/mockClient.ts](../apps/mobile/src/api/mock/mockClient.ts) |
| `mockData.ts` — 2 mosques, 12 posts, 20 members | [apps/mobile/src/api/mock/mockData.ts](../apps/mobile/src/api/mock/mockData.ts) |
| Design tokens, one file | [apps/mobile/src/theme/index.ts](../apps/mobile/src/theme/index.ts) |
| `Card` `Button` `Badge` `EmptyState` `Loading` (+ `Field`, `Screen`) | [apps/mobile/src/components/](../apps/mobile/src/components/) |
| Auth stack → main tabs | [apps/mobile/app/](../apps/mobile/app/) |
| Push registration | [apps/mobile/src/push/notifications.ts](../apps/mobile/src/push/notifications.ts) |

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
*Continue as demo member*. Any seeded member signs in with the same password.

## Step 1 — get it on a physical phone

Not a simulator. Simulators never receive remote push, and finding that out at
hour 18 is the failure mode the plan is written to avoid.

- Phone and laptop on the same Wi-Fi.
- If the QR won't connect, run `npx expo start --tunnel`.
- The project is on **Expo SDK 57** — install current Expo Go from the store.
- **Android + remote push needs a development build.** Since SDK 53, Expo Go on
  Android doesn't receive remote push (local notifications still fire). Expo Go
  on iOS still does. For the two-phone demo, put the *member* on an iPhone with
  Expo Go, or build Android once: `cd apps/mobile && npx expo run:android`
  (needs Android Studio / an SDK on the laptop, ~10 min first time).

## Step 2 — prove a push arrives

Push tokens need an EAS project id. Once, from `apps/mobile`:

```bash
npx eas init      # writes extra.eas.projectId into app.json — commit it
```

Then on the phone:

1. Open **Profile**. Accept the notification prompt.
2. The push panel should read **Registered** and show an `ExponentPushToken[…]`.
3. Tap **Fire a local test notification** — a banner proves the notification
   handler and the Android channel are wired.
4. Tap **Copy token**, paste it into <https://expo.dev/notifications>, send.
   A banner arriving from Expo's servers is the real Phase 1 exit criterion.

If the panel says *Unavailable*, read the reason it prints:

| Reason | Fix |
| --- | --- |
| "physical device" | You're on a simulator. |
| Missing project id | Run `npx eas init`, restart the dev server. |
| *Denied* | Enable notifications for Expo Go in system settings, then **Retry registration**. |

Phase 4 sends to these tokens; `api.registerPushToken` already hands each one to
the client, so the fan-out has somewhere to read them from.

## Exit criteria

- [x] Navigation: auth stack → four main tabs
- [x] Design tokens in one file
- [x] lucide-react-native wired
- [x] `Card` `Button` `Badge` `EmptyState` `Loading`
- [x] `mockData.ts` — Khadija + Madina, 12 posts, 20 members
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
