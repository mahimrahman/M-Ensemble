/**
 * Domain contract for M'Ensemble. Locked in PHASE 0.
 *
 * One owner. Changing a shape here changes it for the mobile app, the mock
 * client and the API at the same time — open a PR, don't edit in passing.
 */

export type ID = string;

/** ISO-8601 instant, always UTC, e.g. "2026-09-05T13:21:00.000Z". */
export type Timestamp = string;

/** Calendar day in the mosque's local timezone, e.g. "2026-09-05". */
export type DateString = string;

/**
 * Wall-clock time in the mosque's local timezone, e.g. "20:30".
 * Iqamah is ALWAYS stored like this and never as UTC — a UTC iqamah shifts
 * every mosque by an hour twice a year.
 */
export type WallClock = string;

export type PostType = 'event' | 'class' | 'volunteer' | 'announcement';

export type Prayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export const PRAYERS: readonly Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type Madhab = 'shafi' | 'hanafi';

/** Names mirror `adhan`'s CalculationMethod factories. */
export type CalculationMethodName =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Turkey'
  | 'Tehran';

/** Names mirror `adhan`'s HighLatitudeRule. */
export type HighLatitudeRule = 'MiddleOfTheNight' | 'SeventhOfTheNight' | 'TwilightAngle';

export type SignupStatus = 'confirmed' | 'withdrawn';

export type MemberRole = 'member' | 'admin';

export type IqamahMode = 'fixed' | 'offset';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface User {
  _id: ID;
  name: string;
  email: string;
  interests: string[];
  pushToken?: string;
}

export interface PrayerConfig {
  calculationMethod: CalculationMethodName;
  madhab: Madhab;
  highLatitudeRule: HighLatitudeRule;
}

export interface Mosque {
  _id: ID;
  name: string;
  address: string;
  coordinates: Coordinates;
  joinCode: string;
  prayerConfig: PrayerConfig;
  /** A paragraph in the mosque's own voice — what it is and who it serves. */
  bio?: string;
  /** Bare host, no scheme: 'khadijahmtl.org'. The UI adds the https://. */
  website?: string;
  /** Phone as the mosque publishes it, dialled verbatim. */
  phone?: string;
  /** When it was founded and how it got here. A short paragraph, not an essay. */
  history?: string;
  /** Google rating out of 5 and how many reviews it came from. */
  rating?: { score: number; count: number };
  /** Standing programs — the things that run every week, not dated posts. */
  services?: string[];
}

/** One meeting of a multi-session post (a class that runs six Saturdays). */
export interface PostSession {
  startAt: Timestamp;
  endAt: Timestamp;
}

export interface Post {
  _id: ID;
  mosqueId: ID;
  type: PostType;
  title: string;
  description: string;
  category: string;
  startAt: Timestamp;
  endAt: Timestamp;
  location: string;
  /** volunteer only — how many people are needed. */
  slotsNeeded?: number;
  slotsFilled: number;
  /** event/class only — attendance cap. */
  capacity?: number;
  /** class only. */
  sessions?: PostSession[];
  /**
   * A poster the mosque uploaded. Events and classes get promoted with one;
   * when it's absent the app draws a geometric placeholder instead.
   */
  imageUrl?: string;
  /**
   * A poster that ships inside the app bundle, named rather than fetched —
   * see POSTER_ART in the mobile app. Fixtures use this so the demo has real
   * artwork with no network; a mosque uploading its own gets `imageUrl`.
   * When both are set, `imageUrl` wins.
   */
  posterKey?: string;
  createdBy: ID;
  createdAt: Timestamp;
  /** Set when an admin cancels. Cancelled posts leave the feed but keep history. */
  cancelledAt?: Timestamp;
}

export interface Signup {
  _id: ID;
  postId: ID;
  userId: ID;
  status: SignupStatus;
  checkedInAt?: Timestamp;
  /** When the slot was claimed — drives "new signups" on the admin home. */
  createdAt?: Timestamp;
  /**
   * Set when the volunteer withdrew inside `LATE_CANCEL_HOURS` of the start.
   * Withdrawing early is free and leaves no trace; this close in, the mosque
   * has to find someone else, so it goes on the record.
   */
  lateCancelledAt?: Timestamp;
  /**
   * Set when a post ended and this confirmed signup was never checked in.
   * Written by the server as posts end, never by the client.
   */
  noShowAt?: Timestamp;
}

/**
 * Withdrawing less than this many hours before the start counts as a late
 * cancellation. One number, shared by the warning the app shows and the rule
 * the server enforces, so they can never drift apart.
 */
export const LATE_CANCEL_HOURS = 24;

/**
 * How dependable someone has been. Shown to the volunteer on their own profile
 * and to the coordinator on the member screen — the same numbers both sides,
 * so a conversation about them starts from one set of facts.
 */
export interface ReliabilityRecord {
  /** Confirmed signups on posts that have already ended. */
  commitments: number;
  /** Of those, the ones they were checked in for. */
  attended: number;
  /** Withdrawals inside the late window. */
  lateCancellations: number;
  /** Ended posts they were confirmed for and never checked in to. */
  noShows: number;
  /** `attended / commitments` as 0–100. 100 when there is nothing to judge. */
  reliabilityRate: number;
  /** Most recent incidents, newest first — the detail behind the counts. */
  recent: ReliabilityIncident[];
}

export interface ReliabilityIncident {
  postId: ID;
  postTitle: string;
  mosqueId: ID;
  startAt: Timestamp;
  kind: 'late-cancel' | 'no-show';
  at: Timestamp;
}

/**
 * `fixed` — iqamah is at `fixedTime` regardless of adhan.
 * `offset` — iqamah is `offsetMinutes` after that day's adhan.
 */
export interface Iqamah {
  mosqueId: ID;
  prayer: Prayer;
  mode: IqamahMode;
  fixedTime?: WallClock;
  offsetMinutes?: number;
  effectiveFrom: DateString;
}

export interface JummahSession {
  mosqueId: ID;
  label: string;
  khutbahTime: WallClock;
  iqamahTime: WallClock;
}

/** Public, drives the feed. Deliberately separate from `Membership`. */
export interface Follow {
  _id: ID;
  userId: ID;
  mosqueId: ID;
  createdAt: Timestamp;
}

/** Role-bearing, drives permissions. Never merged into `Follow`. */
export interface Membership {
  _id: ID;
  userId: ID;
  mosqueId: ID;
  role: MemberRole;
  createdAt: Timestamp;
}

export interface PrayerTimeRow {
  prayer: Prayer;
  /** Computed locally by `adhan`, rendered as mosque wall-clock. */
  adhan: WallClock;
  /** Null when the mosque hasn't configured an iqamah for this prayer. */
  iqamah: WallClock | null;
}

export interface PrayerTable {
  mosqueId: ID;
  date: DateString;
  timezone: string;
  rows: PrayerTimeRow[];
  jummah: JummahSession[];
}

export interface NotificationPrefs {
  volunteerRequests: boolean;
  events: boolean;
  classes: boolean;
  announcements: boolean;
  prayerReminders: boolean;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface CreatePostInput {
  mosqueId: ID;
  type: PostType;
  title: string;
  description: string;
  category: string;
  startAt: Timestamp;
  endAt: Timestamp;
  location: string;
  slotsNeeded?: number;
  capacity?: number;
  sessions?: PostSession[];
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

// ─── Admin (mosque-side) ────────────────────────────────────────────────────
// The coordinator's app reads these. They are derived views over the same
// posts/signups/memberships above — never a second source of truth.

/** A person as the mosque sees them: name plus how they've actually shown up. */
export interface MosqueMember {
  userId: ID;
  name: string;
  role: MemberRole;
  /** When they first followed or were given a role here. */
  joinedAt: Timestamp;
  /** Confirmed signups at this mosque, all time. */
  signupCount: number;
  /** Of those, the ones they were checked in for. */
  attendedCount: number;
  /** Minutes served on volunteer posts they attended. */
  minutesServed: number;
  /** Last time they were checked in anywhere at this mosque. */
  lastSeenAt?: Timestamp;
  /** What they told us they care about — drives who to ask next. */
  interests: string[];
  /** Late cancellations at this mosque, all time. */
  lateCancellations: number;
  /** Ended posts they were confirmed for and never checked in to. */
  noShows: number;
}

/** One person's signup, flattened with the post it belongs to. */
export interface RosterEntry {
  signup: Signup;
  postId: ID;
  postTitle: string;
  postType: PostType;
  startAt: Timestamp;
  endAt: Timestamp;
  userId: ID;
  userName: string;
}

/** The numbers on the dashboard. One call, so the home screen isn't an N+1. */
export interface MosqueDashboard {
  mosqueId: ID;
  /** Live posts starting within the next 7 days. */
  upcomingCount: number;
  /** Volunteer slots still unfilled across every live post. */
  slotsUnfilled: number;
  /** Total volunteer slots requested across those posts. */
  slotsNeeded: number;
  /** Confirmed signups created in the last 24h. */
  newSignups24h: number;
  /** Distinct people with a confirmed signup at a live post. */
  activePeople: number;
  /** Everyone who follows this mosque. */
  followerCount: number;
  /** Checked-in ÷ confirmed across posts that have already ended, 0–100. */
  attendanceRate: number;
  /** Volunteer minutes served across all past posts. */
  minutesServed: number;

  // ── Added for the coordinator's home. Every one of these answers a question
  // someone actually asked while standing in a mosque office.

  /** Live posts starting in the next 24h — "what do I run today". */
  startingSoon: number;
  /** Live volunteer posts with nobody signed up at all. The urgent list. */
  postsWithNoSignups: number;
  /** New followers in the last 7 days — is the audience growing. */
  newFollowers7d: number;
  /** People with a confirmed signup in the last 30 days. */
  activeVolunteers30d: number;
  /**
   * People who signed up here for the first time in the last 30 days. The
   * number that says whether the mosque is reaching anyone new.
   */
  firstTimeVolunteers30d: number;
  /** Late cancellations across the mosque in the last 30 days. */
  lateCancellations30d: number;
  /** No-shows across the mosque in the last 30 days. */
  noShows30d: number;
  /**
   * Attendance rate over posts that ended in the last 30 days, 0–100.
   * `attendanceRate` is all-time; this one shows whether it is moving.
   */
  attendanceRate30d: number;
}

/** A post that has already ended, with how the turnout actually went. */
export interface EventOutcome {
  postId: ID;
  title: string;
  type: PostType;
  startAt: Timestamp;
  endAt: Timestamp;
  confirmed: number;
  attended: number;
  /** Slots or capacity — whatever the post asked for. Null when open-ended. */
  target: number | null;
}

// ─── Notifications ──────────────────────────────────────────────────────────

/**
 * Why a notification exists.
 *
 * `post` is the automatic fan-out when a mosque publishes something; `mosque`
 * is a coordinator writing to their followers directly. The app renders the
 * two differently — an automatic one opens the post it came from, a written
 * one has nowhere to go but the mosque.
 */
export type NotificationKind = 'post' | 'mosque';

/**
 * One line in a user's inbox.
 *
 * Written per recipient, not per send: `readAt` belongs to the person, and a
 * shared row would make one reader's tap mark it read for everybody. The
 * mosque's name is deliberately NOT copied in — the app already holds the
 * mosque list and resolves it the same way the feed resolves a post's mosque.
 */
export interface AppNotification {
  _id: ID;
  userId: ID;
  mosqueId: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Set when the notification came from a post — tapping it opens that post. */
  postId?: ID;
  createdAt: Timestamp;
  /** Absent until the user opens the inbox. */
  readAt?: Timestamp;
}
