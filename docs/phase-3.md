# Phase 3 — Admin screens

The coordinator's side, on the same mocks. Post a shift, watch coverage fill,
check people in, set when the mosque actually prays.

## What landed

| Plan item | Where |
| --- | --- |
| Admin home / needs attention | [app/(tabs)/admin.tsx](../apps/mobile/app/(tabs)/admin.tsx) — the **Manage** tab |
| Create post (type → type-specific fields) | [app/manage/create.tsx](../apps/mobile/app/manage/create.tsx) — also the edit form |
| Manage posts: list, edit, cancel | [app/manage/posts.tsx](../apps/mobile/app/manage/posts.tsx) |
| Coverage view | [app/manage/coverage/[id].tsx](../apps/mobile/app/manage/coverage/[id].tsx) |
| Check-in: QR + manual/bulk | [app/manage/checkin/[id].tsx](../apps/mobile/app/manage/checkin/[id].tsx) |
| Member side of the QR | [app/checkin/[postId].tsx](../apps/mobile/app/checkin/[postId].tsx) |
| Iqamah config | [app/manage/iqamah.tsx](../apps/mobile/app/manage/iqamah.tsx) |

New kit: `Segmented`, `DayChips`. New lib: [datetime.ts](../apps/mobile/src/lib/datetime.ts)
(wall-clock ↔ instant, weekly sessions, "2h ago"). New dep: `react-native-qrcode-svg`.

## Who is an admin

A `Membership` with `role: 'admin'`. The auth store loads memberships after
sign-in; `adminMosqueIds` gates the Manage tab (`href: null` hides it entirely
for members). Every admin call also re-checks the role in the API — the mock's
`requireAdmin` throws `FORBIDDEN` the same way the server's middleware will.

Admin routes live under `/manage/*`, not `/admin/*`, so they can't collide with
the tab at `/admin`.

## Walk it

Sign in as **Demo coordinator** (amina@example.com — Khadija's admin).

1. **Manage** tab. *Needs attention* lists Iftar setup (1/4) and the parking
   marshals (2/6). *New signups* shows who claimed what in the last 24h.
2. **New post** → Volunteer shift → fill it in, pick a day from the strip, post.
   You land on its **coverage** screen at 0 of N.
3. Second phone (or sign out → Demo member): the post is in the feed. Claim a
   slot. Back on the coordinator's phone, coverage refetches on focus: 1 of N,
   with a name and "Claimed just now".
4. **Show check-in QR.** The member's camera opens `/checkin/:id`, which checks
   them in. The coordinator's list polls every 4s and flips the row to
   *Here 17:05*. No camera? Tap **Check in** on the row, or **Check in all**.
5. **Iqamah** → switch Isha to *Fixed time* 21:15, pick Monday under *Takes
   effect*, save. Open Khadija's profile as a member: the
   table changes on that date, not before.
6. **All posts** → Cancel one. It leaves the feed; the detail screen shows
   *Cancelled* if someone had it open.

## QR mechanics

`Linking.createURL('/checkin/' + postId)` — `exp://…/--/checkin/post_001` in
Expo Go, `mensemble://checkin/post_001` in a build. Both open the same route.
The member checks *themselves* in: `checkIn(postId, me)`. The mock allows self
check-in for any confirmed signup and requires the admin role for anyone else;
the server's `POST /posts/:id/checkin` should do the same.

If the member isn't signed in when they scan, the auth gate sends them to login
and then to the feed — the check-in intent is lost. Acceptable for the demo;
noted for after.

## Contract changes (owner's hat)

Two optional fields, six methods. Optional means nothing already written breaks.

```ts
Post.cancelledAt?: Timestamp      // cancelled posts leave the feed, keep history
Signup.createdAt?: Timestamp      // "new signups" on the admin home

getMyMemberships(): Membership[]                            GET  /me/memberships
getMosquePostsForAdmin(mosqueId): Post[]                    GET  /mosques/:id/posts?all=true
updatePost(id, UpdatePostInput): Post                       PATCH /posts/:id
cancelPost(id): Post                                        POST /posts/:id/cancel
getIqamahConfig(mosqueId): MosqueIqamahConfig               GET  /mosques/:id/iqamah
setIqamahConfig(mosqueId, IqamahConfigInput): MosqueIqamahConfig   PUT /mosques/:id/iqamah
```

`UpdatePostInput` can't change `type` or `mosqueId`. `setIqamahConfig` replaces
the mosque's whole config; the screen preserves history itself by resending
rows whose `effectiveFrom` predates the chosen date.

## For Phase 4

- **Push fan-out** goes in `createPost`, filtered by followers whose
  `interests` include `post.category`. The mock has a comment where.
- **Cancelled posts** are excluded from `/feed` and `/mosques/:id/posts`, included
  in `?all=true`. `signup` on a cancelled post is a 410.
- **Check-in authorisation**: self, or admin of the post's mosque.
- **Seed script** must include `Membership { user_002, mosque_khadija, admin }`
  and `{ user_003, mosque_madina, admin }` or nobody gets a Manage tab.
