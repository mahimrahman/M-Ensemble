# M'Ensemble

### au service de votre mosquée

**MuslimHacks 2026 — Build Plan (frontend-first, phased)**

**Stack:** React Native (Expo) · TypeScript · Express · MongoDB · lucide-react-native
**Window:** 24 hours · **Demo mosques:** Khadija, Madina
**Repo / bundle id:** `mensemble`

---

## The one sentence

> A coordinator at Khadija posts that they need four people for iftar setup. Everyone who cares gets notified in seconds, four people commit, they check in on arrival, and the coordinator sees it's covered — without a group chat or a notice board.

If a task doesn't serve that sentence, it's P1 or later.

---

## The rule that makes frontend-first safe

**Everything goes through `src/api/client.ts`.**

```ts
// src/api/client.ts — PHASE 1: returns mocks. PHASE 4: same signatures, real fetch.
export const api = {
  login:        (email: string, pw: string): Promise<AuthResult> => ...,
  getFeed:      (): Promise<Post[]> => ...,
  getPost:      (id: string): Promise<Post> => ...,
  signup:       (postId: string): Promise<Signup> => ...,
  withdraw:     (postId: string): Promise<void> => ...,
  getSignups:   (postId: string): Promise<Signup[]> => ...,
  checkIn:      (postId: string, userId: string): Promise<void> => ...,
  createPost:   (input: CreatePostInput): Promise<Post> => ...,
  getPrayerTimes: (mosqueId: string, date: string): Promise<PrayerTable> => ...,
};
```

No screen ever calls `fetch` directly. No screen knows whether data is mocked. Swapping at Phase 4 is a base-URL change plus deleting a file.

**Types live in `src/types/index.ts` and are locked in Phase 0.** One owner. Others open a PR or ask. Four people running Claude Code against a moving schema is how teams lose six hours at 3am.

---

# PHASE 0 — Contract (Hours 0–1) · everyone

**No code. Do not skip this.**

- [x] Lock the type definitions below verbatim
- [x] Lock the `api` interface above
- [x] Repo created, everyone cloned, branch strategy agreed
- [ ] Screen list assigned per dev
- [ ] Decide: Expo Go or dev build (Expo Go is faster; verify push works on it)

```ts
type PostType = 'event' | 'class' | 'volunteer' | 'announcement';

interface User {
  _id;
  name;
  email;
  interests: string[];
  pushToken?: string;
}
interface Mosque {
  _id;
  name;
  address;
  coordinates: { lat; lng };
  joinCode;
  prayerConfig: { calculationMethod; madhab: 'shafi' | 'hanafi'; highLatitudeRule };
}
interface Post {
  _id;
  mosqueId;
  type: PostType;
  title;
  description;
  category;
  startAt;
  endAt;
  location;
  slotsNeeded?;
  slotsFilled;
  capacity?;
  sessions?: { startAt; endAt }[];
  createdBy;
  createdAt;
}
interface Signup {
  _id;
  postId;
  userId;
  status: 'confirmed' | 'withdrawn';
  checkedInAt?;
}
interface Iqamah {
  mosqueId;
  prayer;
  mode: 'fixed' | 'offset';
  fixedTime?;
  offsetMinutes?;
  effectiveFrom;
}
```

**Exit criteria:** types file committed, mock client stubbed, everyone knows their screens.

---

# PHASE 1 — Shell (Hours 1–3) · all four

Get something on a real device immediately.

- [ ] `npx expo login` + `npx eas-cli init` on the laptop, same account signed in to Expo Go — see docs/phase-1.md Step 0
- [ ] Expo app runs **on a physical phone** (not simulator)
- [x] Navigation: auth stack → main tabs (Feed · Mosques · My Stuff · Profile)
- [x] Design tokens: colors, spacing, type scale, in one file
- [x] lucide-react-native wired, icon set chosen
- [x] Reusable components: `Card`, `Button`, `Badge`, `EmptyState`, `Loading`
- [x] Fixtures — Khadija + Madina, 19 realistic posts, 20 fake members (now in `packages/shared/src/fixtures.ts`, shared with the seed script)
- [ ] **Register a push token on the real device.** Confirm a test push arrives. Do this NOW, not at hour 18.

**Exit criteria:** app opens on a phone, tabs navigate, a hardcoded card renders, a test push arrives.

---

# PHASE 2 — Member screens (Hours 3–8) · devs A, B, C

All against mocks.

- [x] **Auth:** login, signup
- [x] **Onboarding:** find/follow mosque, pick interests
- [x] **Feed:** unified across followed mosques, type filter chips, mosque badge per card
- [x] **Post detail:** three variants (volunteer / event+class / announcement)
- [x] **Signup flow:** claim slot, slots-remaining indicator, confirmed state, withdraw
- [x] **My Stuff:** upcoming commitments, past, service hours total
- [x] **Mosque profile:** info, prayer table (adhan + iqamah), upcoming posts
- [x] **Prayer card:** next prayer + live countdown on Feed header
- [x] **Profile:** interests, notification prefs, followed mosques

**Prayer times are real from Phase 2** — `adhan` computes locally, no backend needed:

```bash
npm install adhan
```

```ts
const coords = new Coordinates(45.5017, -73.5673);
const params = CalculationMethod.NorthAmerica();
params.madhab = Madhab.Hanafi;
const times = new PrayerTimes(coords, new Date(), params);
```

Iqamah comes from mock config now, admin-entered later. **Store iqamah as wall-clock strings (`"20:30"`), never UTC** — otherwise DST shifts every mosque by an hour.

**Exit criteria:** you can walk the entire member journey on a phone with zero backend.

---

# PHASE 3 — Admin screens (Hours 3–8, parallel) · dev D

Runs alongside Phase 2, same mocks.

- [x] **Admin home / needs attention:** unfilled shifts, upcoming, new signups
- [x] **Create post:** type picker, then type-specific fields (slots for volunteer, capacity for event, sessions for class)
- [x] **Manage posts:** list, edit, cancel
- [x] **Coverage view:** filled/needed, signup list, check-in buttons — _the screen that kills the WhatsApp comparison; make it look good_
- [x] **Check-in:** QR display + manual/bulk fallback
- [x] **Iqamah config:** 5 prayers, fixed or offset mode, Jummah sessions, effective-from date
- [x] **Coordinator shell:** own tab bar (Dashboard · Events · People · Prayer · Settings), member directory with track record, promote/demote, mosque switcher — see [docs/phase-3.md](docs/phase-3.md)

**Exit criteria:** admin can post a shift and see a coverage screen fill, all mocked.

---

# ⛔ CHECKPOINT — Hour 8

**Full frontend demoable on mocks, or cut P1 features now.** Be ruthless here; it's cheaper than at hour 18.

**Status: passed.** Every member and coordinator screen runs on mocks, in EN/FR/AR, on device and in the web preview; `npm run typecheck` is clean across all three workspaces. The frontend is frozen against the contract in `packages/shared` — Phase 4 builds to it, it does not move.

---

# PHASE 4 — Backend + DB (Hours 8–15) · devs A, B (+ D from hour 10)

C stays on frontend polish so nobody idles.

**The full spec — every route, model, index, formula, error code and the seed — is [docs/phase-4.md](docs/phase-4.md).** The mock client is the reference implementation; the list below is the summary.

**Models:** `User`, `Mosque`, `Follow`, `Membership`, `Post`, `Signup`, `IqamahConfig`, `JummahSession`

Keep `Follow` (public, drives feed) **separate** from `Membership` (role, drives permissions). Mixing them tangles cross-mosque admin rights.

**Routes:**

```
POST /auth/signup · POST /auth/login · GET /me · PATCH /me · GET /users?ids=
GET  /me/mosques · GET /me/memberships · GET /me/commitments · GET /me/hours
GET|PUT /me/notification-prefs · POST /me/push-token
GET  /mosques · GET /mosques/:id · POST|DELETE /mosques/:id/follow
GET  /mosques/:id/posts[?all=true] · GET /mosques/:id/prayer-times?date=
GET|PUT /mosques/:id/iqamah
GET  /mosques/:id/dashboard · /roster · /members · /members/:userId · /outcomes
PUT  /mosques/:id/members/:userId/role
GET  /feed · GET /posts/:id · POST /posts · PATCH /posts/:id · POST /posts/:id/cancel
POST|DELETE /posts/:id/signup · GET /posts/:id/signups · POST /posts/:id/checkin
```

These are exactly the paths `apps/mobile/src/api/http.ts` already calls. Rename nothing.

**Atomic slot claim — never read-then-write:**

```ts
const post = await Post.findOneAndUpdate(
  { _id: postId, $expr: { $lt: ['$slotsFilled', '$slotsNeeded'] } },
  { $inc: { slotsFilled: 1 } },
  { new: true },
);
if (!post) throw new Error('FULL');
```

Plus a unique compound index on `Signup { postId, userId }`.

- [x] Models + indexes, string `_id`s (DB engineer)
- [x] **Seed script** — imports the fixtures from `@m-ensemble/shared`; no retyping (DB engineer)
- [x] Derived views: dashboard, members, roster, outcomes — formulas in docs/phase-4.md (DB engineer)
- [x] Prayer-times service — move the pure half of `lib/prayer.ts` into `packages/shared` (DB engineer + app owner)
- [x] JWT auth, `requireAuth`, `requireAdmin(mosqueId)` (backend dev)
- [x] Every route, uppercase error codes, envelope on every response (backend dev)
- [x] Push fan-out on post creation (Expo push, filtered by follow + interests + prefs) (backend dev)
- [x] vitest suite incl. the concurrent-claim race (backend dev)

**Exit criteria:** every endpoint returns correct shapes in Postman / `requests.http`; the race test passes in vitest; one real push lands.

---

# PHASE 5 — Integration (Hours 15–18) · everyone

**Checklist and the per-screen endpoint map: [docs/phase-5.md](docs/phase-5.md).**

- [ ] `EXPO_PUBLIC_USE_MOCKS=false` + LAN IP; restart the dev server
- [ ] Walk every screen, fix shape mismatches **on the server**
- [x] Token persistence + cold-start validation (`GET /me`, sign out on 401) — done on the app side
- [ ] **Two-phone test:** admin posts → member's phone buzzes → signs up → coverage updates
- [ ] Race test: two phones tap the last slot simultaneously
- [ ] QR check-in on real devices
- [ ] Verify prayer times against what Khadija actually posts

**Exit criteria:** the demo sentence works end to end on two physical devices.

---

# PHASE 6 — Polish & pitch (Hours 18–24)

**18–20 · Polish**

- [x] Empty states, loading states, error alerts (work on web too)
- [x] Icon and spacing consistency pass
- [x] French **and Arabic** strings on every screen, with a switcher (EN default)

**20 · CODE FREEZE.** Seed and hand-verify demo data. Rehearse the happy path 3× on the real device.

**20–22 · Pitch**

1. Problem (45s) — "We're both at Khadija. Requests go out on WhatsApp and Instagram. The website notifies nobody. At Madina we find out from the notice board." Show the photo.
2. Market as proof (30s) — seven products all advertise against WhatsApp, and our mosques are still on WhatsApp. The problem isn't missing software; it's that nobody adopts it.
3. Live demo (2.5m) — two phones. Post → push lands in the room → signup → 4/4 → QR check-in → hours increment.
4. Prayer times (20s) — "Every app calculates adhan. Ours shows when Khadija actually prays, because Khadija told it."
5. Model + roadmap (45s) — free for small musallahs, paid admin tier, sponsor-funded rollout. "We're not selling to strangers. We're building for two mosques we're part of."
6. Honesty slide — what's real vs. mocked. The guide asks for this and it scores.

**22–24 · Buffer.** Something will break.

---

## Roadmap slide only — DO NOT BUILD

Donations · tax receipts · parent portal · facilities booking · janazah coordination · TV displays · governance · cross-city feed

Showing this proves deliberate scope choice, which the challenge guide explicitly rewards.

---

## Risk register

| Risk                    | Mitigation                                                                                                   | By                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------ |
| Push fails              | Test on physical device **Phase 1**. Simulators don't receive push. Fallback: in-app badge + manual trigger. | Hour 3 / ready h18 |
| Integration cliff       | Mock client matches real signatures exactly. One dev on backend from hour 8.                                 | Continuous         |
| Shared types churn      | One owner, PR to change.                                                                                     | Hour 1             |
| Race on last slot       | Atomic update + unique index. Two-phone test.                                                                | Hour 16            |
| DST / prayer time wrong | Wall-clock strings. Verify against Khadija's posted times.                                                   | Hour 17            |
| Demo device dies        | Charged backup phone, hotspot, screen recording of happy path.                                               | Hour 19            |
| Scope creep at hour 15  | Written on the roadmap slide = not built.                                                                    | Continuous         |

---

## Before you open an editor (30 minutes, worth more than any feature)

1. Message whoever handles announcements at Khadija: _how do you tell people you need volunteers, and what usually goes wrong?_ One quote beats anything you can build in that half hour.
2. Screenshot the Madina notice board and a Khadija Instagram announcement. Those two images are your opening slide.
