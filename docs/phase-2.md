# Phase 2 — Member screens

The whole member journey, on a phone, with zero backend. Everything reads through
`api`; the only thing that changed in the contract is one added method.

## What landed

| Plan item                                                | Where                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Auth: login, signup                                      | [app/(auth)/](<../apps/mobile/app/(auth)/>)                          |
| Onboarding: follow mosque, pick interests                | [app/onboarding.tsx](../apps/mobile/app/onboarding.tsx)              |
| Feed: filter chips, mosque badge, prayer card            | [app/(tabs)/index.tsx](<../apps/mobile/app/(tabs)/index.tsx>)        |
| Post detail: volunteer / event+class / announcement      | [app/post/[id].tsx](../apps/mobile/app/post/[id].tsx)                |
| Signup flow: claim, meter, confirmed, withdraw           | same file, plus [My Stuff](<../apps/mobile/app/(tabs)/my-stuff.tsx>) |
| Mosque profile: info, prayer table, upcoming             | [app/mosque/[id].tsx](../apps/mobile/app/mosque/[id].tsx)            |
| Prayer card + live countdown                             | [PrayerCard.tsx](../apps/mobile/src/components/PrayerCard.tsx)       |
| Profile: interests, notification prefs, followed mosques | [app/(tabs)/profile.tsx](<../apps/mobile/app/(tabs)/profile.tsx>)    |

New kit: `Chip`, `Meter`, `PostCard`, `People`, `PrayerCard`, `PrayerTable`, `BackBar`.
New hooks: `useApi` (refetch on focus), `useNow`, `useNextPrayer`.

## Walk it

Sign in as **yusuf@example.com / mensemble** (demo member, follows both mosques).

1. **Feed** — prayer card counts down to Khadija's next iqamah. Filter to
   _Volunteer_. "Iftar setup" reads 1 of 4.
2. Tap it. **Claim a slot** → meter goes 2 of 4, "You're in", your initials
   appear in the row. Back to the feed: the card now says "You're in".
3. **My Stuff** → it's under Upcoming with a Withdraw button. Hours card reads
   6h across 2 shifts (the two past posts with check-ins).
4. Tap the mosque name on any post → **profile**: prayer table with adhan beside
   iqamah, the next prayer highlighted, jummah sessions below.
5. **Kitchen cleanup crew** is full — the button reads _All slots filled_.
6. Sign out → **Create an account** → onboarding: search "MADINA" (join code
   works), follow, pick interests, land on the feed.

Race check without a second phone: on a full post, the mock throws `FULL` the
same way the server will, and the screen shows _Just filled up_ then reloads.

## Prayer times are real

[src/lib/prayer.ts](../apps/mobile/src/lib/prayer.ts) — `adhan` computes from
`mosque.coordinates` and `prayerConfig`; iqamah is layered on from the mosque's
config (`fixed` or `offset`, latest `effectiveFrom` that isn't in the future).

Everything is a wall-clock string in `America/Toronto`. The countdown converts
back to instants with an `Intl`-based offset lookup, so DST is handled and the
device's own timezone doesn't matter. `nextPrayerFrom` only reads the
`PrayerTable` shape the API returns, so it works unchanged against the server.

Verified against the real sky for Montréal on 2026-09-05: sunrise 06:21,
maghrib 19:24. Still do the Phase 5 check against what Khadija actually posts —
that verifies the _iqamah config_, which no library can.

Madina's Isha iqamah moves 21:30 → 21:15 with `effectiveFrom: 2026-09-08`.
Open Madina's profile before and after that date to see it flip.

## Contract change

One method added to `MEnsembleApi`, with the owner's hat on:

```ts
getUsers(ids: ID[]): Promise<PublicUser[]>   // PublicUser = Pick<User, '_id' | 'name'>
```

A signup list has to render names, and `Signup` only carries `userId`. Phase 3's
coverage view needs the same thing. Server side it's `GET /users?ids=a,b,c` and
must never return email. The HTTP client already calls it.

## For Phase 3 and 4

- **Slot counts are increments, not recounts.** `slotsFilled` on an event can be
  68 with no signup rows behind it (people who RSVP'd before the app). Both the
  mock and the server `$inc`; nobody recomputes from signups.
- `useApi` refetches on screen focus. There is no cache to invalidate; if an
  admin screen mutates something, the member screen picks it up on its next
  focus. Keep it that way — it's what makes the two-phone demo honest.
- `INTEREST_OPTIONS` lives in [src/lib/interests.ts](../apps/mobile/src/lib/interests.ts).
  Posts' `category` and users' `interests` both draw from it; the fan-out
  matches them.
