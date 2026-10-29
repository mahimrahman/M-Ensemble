# Store submission kit

Everything the App Store and Google Play ask for that is not code. The
listing copy itself is in `listing.en.md` and `listing.fr.md`.

## Screenshots

Taken from a release build (`eas build --profile preview`) with the seeded
demo data, in both languages. Suggested set, in order: feed, mosque profile with
prayer table, event detail, volunteer sign-up, coordinator dashboard, donate.

| Target                   | Size (px)                    | Required                     |
| ------------------------ | ---------------------------- | ---------------------------- |
| iPhone 6.9" (16 Pro Max) | 1320 × 2868 or 1290 × 2796   | Yes                          |
| iPhone 6.7" (15 Plus)    | 1290 × 2796                  | Yes (or 6.9" set)            |
| iPhone 6.5" (11 Pro Max) | 1242 × 2688                  | Optional                     |
| iPhone 5.5" (8 Plus)     | 1242 × 2208                  | Optional                     |
| iPad 13" (Pro M4)        | 2064 × 2752                  | Yes (`supportsTablet`)       |
| Android phone            | 1080 × 1920 min, 16:9 / 9:16 | 2–8 required                 |
| Android 7" tablet        | 1200 × 1920 or similar       | Recommended                  |
| Android 10" tablet       | 1600 × 2560 or similar       | Recommended                  |
| Play feature graphic     | 1024 × 500                   | Yes                          |
| Play app icon            | 512 × 512                    | Yes                          |
| App Store icon           | 1024 × 1024 (no alpha)       | Yes (from `assets/icon.png`) |

PNG or JPEG, no transparency, no device frames needed.

## Privacy labels

Same answers on both stores (App Privacy / Data safety). Collected by the app
and sent to our own API unless noted.

| Data                   | Collected          | Linked to user | Purpose                                 | Notes                                                                                                            |
| ---------------------- | ------------------ | -------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Coarse location        | Yes                | No             | App functionality (pick the city)       | Resolved to a city on-device; the city id is sent, not coordinates. Not stored.                                  |
| Precise location       | No                 | —              | —                                       | `ACCESS_FINE_LOCATION` is requested only because Android grants coarse through the same dialog.                  |
| Camera                 | No                 | —              | App functionality (QR check-in)         | Frames never leave the device.                                                                                   |
| Photos / media         | Yes (user content) | Yes            | App functionality (event posters)       | Coordinators only; the chosen image is uploaded as a poster.                                                     |
| Email address          | Yes                | Yes            | Account management                      |                                                                                                                  |
| Name                   | Yes                | Yes            | Account management, shown to the mosque |                                                                                                                  |
| User ID                | Yes                | Yes            | App functionality, crash reporting      | Sentry receives the id only, never the email.                                                                    |
| Device ID / push token | Yes                | Yes            | App functionality (notifications)       | Expo push token.                                                                                                 |
| Purchase history       | Yes                | Yes            | App functionality (donation receipts)   | Donations are processed by Stripe Checkout in the browser — not in-app purchases. We store amount, mosque, date. |
| Crash data             | Yes                | No             | Analytics (crash reporting)             | Sentry, only in release builds with a DSN.                                                                       |
| Advertising data       | No                 | —              | —                                       | Sponsored cards are contextual (city / placement). No ad SDK, no tracking, no identifiers shared with partners.  |
| Tracking (ATT)         | No                 | —              | —                                       | No `NSUserTrackingUsageDescription`; the app does not track.                                                     |

Data deletion: in-app (`Profile → Account → Delete account`) and by email.
Data export: in-app (`Profile → Account → Download my data`).

## App Review notes (template)

```
M’Ensemble connects members of Muslim communities in Canada with their local
mosques: prayer times, events, classes, volunteer shifts and announcements.

DEMO ACCOUNT
  Member:      <reviewer-member@example.com> / <password>
  Coordinator: <reviewer-coordinator@example.com> / <password>
  (Both are seeded on the production API for review; they see real public
  mosque data and a demo mosque the coordinator account manages.)

PERMISSIONS
  Location (when in use): used once to choose the reader's city so the feed
    shows nearby mosques. The app works without it — pick a city manually.
  Camera: scans a QR code to check a volunteer in at an event. Coordinator
    accounts only; see Manage → Events → Check-in.
  Photos: a coordinator may choose a poster image for an event or class.

DONATIONS
  Mosques on the platform are registered Canadian non-profits. "Donate"
  opens Stripe Checkout in the system browser (SFSafariViewController /
  Custom Tab), not an in-app purchase sheet. M’Ensemble takes a 2.5%
  platform fee, disclosed on the donate screen. No digital goods or
  app features are sold; this falls under guideline 3.1.3(d)/3.2.1(vi)
  (donations to registered non-profits). Test mode card: 4242 4242 4242 4242.

ACCOUNT
  Sign-up requires only name, email and password. Password reset, email
  verification, account deletion and data export are all reachable from
  Profile → Account. Legal texts are in-app (Profile → Account) and at
  https://api.mensemble.app/legal/privacy and /legal/terms.

SPONSORED CARDS
  Occasional cards in the feed are labelled "Sponsored" / "Commandité".
  They are contextual (city), served by our own API; no third-party ad SDK.
```

## Store description drafts

### English (short)

M’Ensemble brings your mosque into your pocket. Follow the mosques you attend,
see today's prayer and iqamah times, and never miss an event, a class or a call
for volunteers.

Sign up for a shift in one tap, check in with a QR code at the door, and keep a
record of the hours you've given. Coordinators publish events, manage sign-ups
and send announcements to everyone who follows the mosque.

Available in French, English and Arabic. Built in Quebec, for communities
across Canada.

### Français (court)

M’Ensemble met votre mosquée dans votre poche. Suivez les mosquées que vous
fréquentez, consultez les horaires de prière et d'iqamah du jour, et ne manquez
plus aucun événement, cours ou appel aux bénévoles.

Inscrivez-vous à un quart de bénévolat en un geste, pointez à l'entrée avec un
code QR et gardez la trace des heures données. Les coordinateurs publient les
événements, gèrent les inscriptions et envoient des annonces à toute la
communauté.

Offert en français, en anglais et en arabe. Conçu au Québec, pour les
communautés de partout au Canada.

## Checklist before `eas submit`

- [ ] `EAS_PROJECT_ID` set (or `eas init` run) and `eas.json` submit block filled in
- [ ] `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` in EAS secrets
- [ ] APNs key uploaded to EAS (`eas credentials`)
- [ ] `google-services.json` (FCM) in `apps/mobile/`
- [ ] `google-play-service-account.json` in `apps/mobile/`
- [ ] Privacy policy and terms live at `/legal/*` on the production API
- [ ] Reviewer demo accounts seeded on production
- [ ] Age rating questionnaires answered (4+ / Everyone; no UGC beyond posters)
- [ ] Support URL and marketing URL on the listing
