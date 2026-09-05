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
