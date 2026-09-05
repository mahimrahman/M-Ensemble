# Phase 3 — Admin screens

The coordinator's side, on the same mocks. Post a shift, watch coverage fill,
check people in, set when the mosque actually prays — and, since the shell was
split, run the whole mosque from a bar of its own.

## Two shells, one bundle

A coordinator has no use for a feed of other mosques and a member has no
business on a dashboard, so the app now has two tab bars and nobody ever sees
the other one's:

| Session                                             | Lands on       | Tabs                                            |
| --------------------------------------------------- | -------------- | ----------------------------------------------- |
| member                                              | `app/(tabs)/`  | Feed · Mosques · My Stuff · Profile             |
| coordinator (any `Membership` with `role: 'admin'`) | `app/(admin)/` | Dashboard · Events · People · Prayer · Settings |

`store/auth.tsx` loads memberships after sign-in; `RootNavigator` in
[app/_layout.tsx](../apps/mobile/app/_layout.tsx) routes on `adminMosqueIds`.
Losing the role mid-session redirects to the member tabs. Which mosque the
coordinator is running comes from
[store/adminMosque.tsx](../apps/mobile/src/store/adminMosque.tsx), mounted in
the **root** layout so the pushed `manage/*` screens can read it too; the
switcher in Settings re-points the whole shell at once.

Every admin call also re-checks the role in the API — the mock's
`requireAdmin` throws `FORBIDDEN` the same way the server's middleware will.

## What landed

| Plan item                                                       | Where                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Dashboard / needs attention                                     | [app/(admin)/index.tsx](<../apps/mobile/app/(admin)/index.tsx>)                    |
| Events: upcoming, finished (with turnout), cancelled            | [app/(admin)/events.tsx](<../apps/mobile/app/(admin)/events.tsx>)                  |
| People: directory ranked by who shows up                        | [app/(admin)/people.tsx](<../apps/mobile/app/(admin)/people.tsx>)                  |
| Member detail + promote / demote                                | [app/manage/member/[id].tsx](../apps/mobile/app/manage/member/[id].tsx)            |
| Prayer: today's table as members see it, missing iqamah flagged | [app/(admin)/prayer.tsx](<../apps/mobile/app/(admin)/prayer.tsx>)                  |
| Settings: mosque switcher, details, sign out                    | [app/(admin)/settings.tsx](<../apps/mobile/app/(admin)/settings.tsx>)              |
| Create post (type → type-specific fields)                       | [app/manage/create.tsx](../apps/mobile/app/manage/create.tsx) — also the edit form |
| Manage posts: list, edit, cancel                                | [app/manage/posts.tsx](../apps/mobile/app/manage/posts.tsx)                        |
| Coverage view                                                   | [app/manage/coverage/[id].tsx](../apps/mobile/app/manage/coverage/[id].tsx)        |
| Check-in: QR + manual/bulk                                      | [app/manage/checkin/[id].tsx](../apps/mobile/app/manage/checkin/[id].tsx)          |
| Member side of the QR                                           | [app/checkin/[postId].tsx](../apps/mobile/app/checkin/[postId].tsx)                |
| Iqamah config                                                   | [app/manage/iqamah.tsx](../apps/mobile/app/manage/iqamah.tsx)                      |

New kit: `Segmented`, `DayChips`, `Stat`/`StatRow`. New lib:
[datetime.ts](../apps/mobile/src/lib/datetime.ts) (wall-clock ↔ instant,
weekly sessions, "2h ago"), [alert.ts](../apps/mobile/src/lib/alert.ts)
(`Alert.alert` that also works on web — react-native-web's is a no-op). New
dep: `react-native-qrcode-svg`.

## Walk it

Sign in as **Demo coordinator** (amina@example.com — Khadija's admin). You land
on the coordinator bar.

1. **Dashboard.** Unfilled slots, followers, attendance rate. _Needs attention_
   lists Iftar setup (1/4) and the parking marshals (2/6). _New signups_ shows
   who claimed what in the last 24h.
2. **New post** → Volunteer shift → fill it in, pick a day from the strip,
   post. You land on its **coverage** screen at 0 of N.
3. Second phone (or sign out → Demo member): the post is in the feed. Claim a
   slot. Back on the coordinator's phone, coverage refetches on focus: 1 of N,
   with a name and "Claimed just now".
4. **Show check-in QR.** The member's camera opens `/checkin/:id`, which checks
   them in. The coordinator's list polls every 4s and flips the row to
   _Here 17:05_. No camera? Tap **Check in** on the row, or **Check in all**.
5. **People** → tap Omar Haddad. Commitments, kept, hours, last seen, and his
   history. **Make coordinator** → confirm. He now shows a shield in the list.
   You cannot demote yourself; the button isn't offered.
6. **Prayer** → _Edit iqamah_ → switch Isha to _Fixed time_ 21:15, pick Monday
   under _Takes effect_, save. Open Khadija's profile as a member: the table
   changes on that date, not before.
7. **Events** → _Finished_ shows each past post's confirmed vs attended.
   _Upcoming_ → Cancel one. It leaves the feed; the detail screen shows
   _Cancelled_ if someone had it open.
8. **Settings** → the mosque switcher lists every mosque you coordinate (one,
   for Amina). Sign out from here.

## QR mechanics

`Linking.createURL('/checkin/' + postId)` — `exp://…/--/checkin/post_001` in
Expo Go, `mensemble://checkin/post_001` in a build. Both open the same route.
The member checks _themselves_ in: `checkIn(postId, me)`. The mock allows self
check-in for any confirmed signup and requires the admin role for anyone else;
the server's `POST /posts/:id/checkin` does the same.

If the member isn't signed in when they scan, the auth gate sends them to login
and then to the feed — the check-in intent is lost. Acceptable for the demo;
noted for after.

## Contract changes (owner's hat)

Two optional fields and twelve methods, all additive. Optional means nothing
already written breaks.

```ts
Post.cancelledAt?: Timestamp      // cancelled posts leave the feed, keep history
Signup.createdAt?: Timestamp      // "new signups" on the dashboard

getMyMemberships(): Membership[]                              GET  /me/memberships
getMosquePostsForAdmin(mosqueId): Post[]                      GET  /mosques/:id/posts?all=true
updatePost(id, UpdatePostInput): Post                         PATCH /posts/:id
cancelPost(id): Post                                          POST /posts/:id/cancel
getIqamahConfig(mosqueId): MosqueIqamahConfig                 GET  /mosques/:id/iqamah
setIqamahConfig(mosqueId, IqamahConfigInput)                  PUT  /mosques/:id/iqamah

getMosqueDashboard(mosqueId): MosqueDashboard                 GET  /mosques/:id/dashboard
getMosqueRoster(mosqueId, RosterFilter?): RosterEntry[]       GET  /mosques/:id/roster
getMosqueMembers(mosqueId): MosqueMember[]                    GET  /mosques/:id/members
getMemberDetail(mosqueId, userId): MemberDetail               GET  /mosques/:id/members/:userId
setMemberRole(mosqueId, userId, role): MosqueMember           PUT  /mosques/:id/members/:userId/role
getEventOutcomes(mosqueId): EventOutcome[]                    GET  /mosques/:id/outcomes
```

`UpdatePostInput` can't change `type` or `mosqueId`. `setIqamahConfig` replaces
the mosque's whole config; the screen preserves history itself by resending
rows whose `effectiveFrom` predates the chosen date. The six derived views are
computed from posts, signups, follows and memberships — never stored. Their
exact formulas are in [phase-4.md](phase-4.md).

## For Phase 4

Everything the server has to mirror is written down in [phase-4.md](phase-4.md).
The short version:

- **Push fan-out** goes in `createPost`, filtered by followers whose
  `interests` include `post.category`. The mock has a comment where.
- **Cancelled posts** are excluded from `/feed` and `/mosques/:id/posts`, included
  in `?all=true`. `signup` on a cancelled post is a 410.
- **Check-in authorisation**: self, or admin of the post's mosque.
- **Seed script** reads the fixtures from `packages/shared` — the same file the
  mock serves — so the walkthrough above and the rehearsal show the same data.
