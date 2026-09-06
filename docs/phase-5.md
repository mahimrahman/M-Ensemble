# Phase 5 — Integration

Point the finished app at the finished server and walk every screen. If Phase 4
matched the mock, this is a `.env` edit and an afternoon of checking shapes.

## The flip

**Done.** `apps/mobile/.env` now reads:

```bash
# apps/mobile/.env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_URL=http://<laptop LAN ip>:4000/api   # never localhost on a phone
```

The IP in the committed-adjacent `.env` is this laptop's Wi-Fi address at the
time of writing. **Re-check it whenever the network changes** — the hotspot
fallback hands out a different one, and a stale IP looks exactly like a dead
server from the phone.

The server needs `JWT_SECRET` in `apps/server/.env`; the Atlas onboarding
rewrote that file and dropped it, which makes the process throw on boot rather
than start and fail later. It has been added back. `.env` is gitignored, so
anyone cloning fresh copies `.env.example` and fills in both.

Restart the dev server after changing `.env` — Expo inlines `EXPO_PUBLIC_*` at
bundle time. `CORS_ORIGIN=*` on the server is fine for the demo (the web
preview needs it).

Nothing in the app imports the mock client except `api/client.ts`. With the
flag off, `resetMockState` becomes a no-op and the "Continue as demo member"
buttons on the auth screens sign in through the real `POST /auth/login` with
the seeded credentials, so they keep working.

## What the app already does for you

These landed while the frontend was being finished; they are the reasons the
integration is a flag flip rather than a rewrite.

- **Token persistence and validation.** `store/auth.tsx` restores the token and
  user from AsyncStorage, opens on the cached session immediately, then calls
  `GET /me`. A **401** signs the user out cleanly; any other failure (server
  unreachable) keeps the cached session so the app still opens. Make sure the
  server really returns 401, not 403, for a dead token.
- **Roles.** `GET /me/memberships` runs on every cold start and after login;
  `adminMosqueIds` decides which shell (member tabs or coordinator tabs) the
  session lands in. An admin briefly sees the member tabs while that request is
  in flight, then gets moved. Keep the endpoint fast.
- **Every error is one type.** `ApiRequestError { code, message, status }` is
  what the HTTP client throws from the envelope. Screens branch on
  `API_ERROR.FULL`, `ALREADY_SIGNED_UP`, `BAD_CREDENTIALS`, `EMAIL_TAKEN`,
  `NOT_FOUND`, `FORBIDDEN`. A code the app doesn't know falls through to a
  generic "Couldn't save — try again" alert, which also works on web now.
- **Refetch on focus.** `useApi` reloads when a screen regains focus. There is
  no cache to invalidate; the two-phone demo works because of this.
- **Push.** `usePushToken` registers on launch once signed in and posts the
  token to `POST /me/push-token`. Tapping a notification with `data.postId`
  opens the post.

## Walk every screen

Do this in order, one person on a phone, one watching the server log. Each row
is a screen and the endpoints it hits; a wrong shape shows up as a blank
section or a crash on that screen and nowhere else.

| Screen                                  | Endpoints                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Login / Signup                          | `POST /auth/login`, `POST /auth/signup`, then `GET /me/memberships`                                                       |
| Onboarding                              | `GET /mosques`, `POST /mosques/:id/follow`, `PATCH /me` (interests)                                                       |
| Feed                                    | `GET /feed`, `GET /me/mosques`, `GET /mosques/:id/prayer-times` (today + tomorrow)                                        |
| Post detail                             | `GET /posts/:id`, `GET /posts/:id/signups`, `GET /users?ids=`, `POST`/`DELETE /posts/:id/signup`                          |
| Mosques tab, mosque profile, month view | `GET /mosques`, `GET /mosques/:id`, `GET /mosques/:id/posts`, `GET /mosques/:id/prayer-times` (one per day for the month) |
| My Stuff                                | `GET /me/commitments`, `GET /posts/:id` per commitment, `GET /me/hours`, `DELETE /posts/:id/signup`                       |
| Profile                                 | `PATCH /me`, `GET`/`PUT /me/notification-prefs`, `POST /me/push-token`, `GET /me/mosques`, `DELETE /mosques/:id/follow`   |
| Member check-in (QR target)             | `POST /posts/:id/checkin` with own id                                                                                     |
| Dashboard (admin)                       | `GET /mosques/:id/dashboard`, `GET /mosques/:id/posts?all=true`, `GET /mosques/:id/roster?upcoming=true`                  |
| Events (admin)                          | `GET /mosques/:id/posts?all=true`, `GET /mosques/:id/outcomes`, `POST /posts/:id/cancel`                                  |
| People (admin) + member detail          | `GET /mosques/:id/members`, `GET /mosques/:id/members/:userId`, `PUT /mosques/:id/members/:userId/role`                   |
| Prayer (admin) + Iqamah editor          | `GET /mosques/:id/prayer-times`, `GET`/`PUT /mosques/:id/iqamah`                                                          |
| Settings (admin)                        | `GET /mosques/:id` per coordinated mosque (the switcher)                                                                  |
| Create / edit post                      | `POST /posts`, `PATCH /posts/:id`                                                                                         |
| Coverage + check-in (admin)             | `GET /posts/:id/signups` (polls every 4s on the check-in screen), `GET /users?ids=`, `POST /posts/:id/checkin`            |

Shape mismatches are fixed **on the server**. The contract in
`packages/shared` is locked; if a field genuinely has to change, change the
type, the mock, and the server in one PR.

### What has already been walked, off-device

Every endpoint in the table above was driven against the running server on the
LAN URL and answered with the right status and the right shape — the member
surface, the six admin views, and the writes (`PATCH /me`, push-token,
notification prefs, follow/unfollow, the signup lifecycle, create/patch/cancel,
the role change). The quirks were checked rather than assumed:

- a signup on a cancelled post answers **410** with code `NOT_FOUND`
- a coordinator demoting **themselves** is **403**
- a dead token is **401**, which is the status `store/auth.tsx` signs out on —
  a 403 there would strand the user on a cached session
- `GET /me` carries no `passwordHash` and `GET /users?ids=` no email
- follow, unfollow and check-in are all idempotent on the second call

What that does **not** cover, and what the three tests below are still for: two
real handsets, a real Expo push token, and the camera opening the QR link.

## The three tests that matter

1. **Two phones.** Coordinator (amina@example.com) on phone A creates a
   volunteer shift with category _Community meals_. Phone B is yusuf@example.com,
   who follows Khadija and has that interest: the push lands within seconds.
   Tap it, claim a slot, and phone A's coverage screen updates on its next
   focus. This is the demo sentence; rehearse it until it is boring.
2. **Race.** Seed a post at one slot remaining (`post_002`, the Iftar setup
   shift, starts at 1/4 — claim two, then race the fourth). Two phones tap
   _Claim a slot_ together.
   One gets "You're in", the other gets _Just filled up_ and the screen reloads
   to _All slots filled_. `slotsFilled` on the server equals `slotsNeeded`.
3. **QR check-in.** Coordinator opens _Show check-in QR_ on the shift. Member
   scans it with the phone camera. The link is `exp://…/--/checkin/post_xxx` in
   Expo Go, `mensemble://checkin/post_xxx` in a build; both open the same route.
   The member's row flips to _Here HH:MM_ on the coordinator's screen within a
   poll. Fallback if the camera won't open the link: _Check in_ on the row.

## Verify prayer times against Khadija

Open Khadija's profile as a member and compare the iqamah column with what the
mosque actually posts this week. Adhan is computed and was checked against the
real sky; **iqamah is configuration**, and only a human can confirm the config
is right. Fix it through the coordinator's Iqamah screen, not the seed.

## Device notes

- `npx eas init` in `apps/mobile` once, commit the `extra.eas.projectId` it
  writes into `app.json`. Without it there is no push token.
- Expo Go on **Android** does not receive remote push since SDK 53. Put the
  member on an iPhone with Expo Go, or build Android once with
  `npx expo run:android`. The coordinator's phone can be anything.
- The web preview (`npx expo start --web`, Chrome device frame at 390×844) is
  the review surface for layout. It runs against the real server too; CORS is
  the only thing that can block it.

## Known gaps — say them on the honesty slide

- Scanning the check-in QR while signed out sends you to login and then the
  feed; the check-in intent is lost. Sign in first.
- Notification preferences are honoured by the fan-out only; there are no
  prayer reminders (`prayerReminders` is stored and ignored).
- Accounts created on the mock client don't survive a reload (in-memory). On the
  real server they do.
- One timezone. Every mosque is `America/Toronto`; Ottawa and Toronto are in the
  fixtures as cities to browse, not as mosques with real times.

## Code freeze checklist (hour 20)

- [ ] Re-run the seed the morning of the demo (fixture dates are relative to seed time)
- [ ] Both phones signed in, tokens registered, one test push received on each
- [ ] Happy path rehearsed three times on real devices, screen-recorded once as the backup
- [ ] `npm run typecheck` and `npm test` green at the root
- [ ] Laptop hotspot works as the fallback network; `EXPO_PUBLIC_API_URL` matches its IP
