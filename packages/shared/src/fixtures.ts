/**
 * Fixture data. Khadija + Madina, the two mosques we're demoing.
 *
 * Lives in the shared package so it has exactly two readers and one truth:
 *   - the mobile mock client (PHASE 1–4) serves it from memory
 *   - the server seed script (PHASE 4) writes it to Mongo
 * If the demo walkthrough and the rehearsal ever show different data, one of
 * those two has stopped importing this file.
 *
 * Every date hangs off "today" at import time, so the seed script must be run
 * on the morning of the demo (and re-run if the laptop sleeps overnight).
 */

import { directoryMosques } from './directory';
import { withPlaceholderSocial } from './social';
import type {
  Follow,
  ID,
  Iqamah,
  JummahSession,
  Like,
  Membership,
  Mosque,
  NotificationPrefs,
  Post,
  Signup,
  User,
} from './types';

// Members' interests and posts' categories both draw from INTEREST_OPTIONS in
// apps/mobile/src/lib/interests.ts.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight today, local time — every fixture date hangs off this. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** `iso(2, '18:30')` → the instant 18:30 local, two days from now. */
function iso(dayOffset: number, wallClock: string): string {
  const [h = '0', m = '0'] = wallClock.split(':');
  const d = new Date(startOfToday().getTime() + dayOffset * DAY_MS);
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toISOString();
}

/**
 * `fromNow(-40)` → forty minutes ago. The only fixture clock that is not
 * pinned to a wall time, and it exists for one row: the shift that has to be
 * *in progress* whenever the seed runs, so the check-in flow can be walked
 * through without waiting for a Saturday.
 */
function fromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/** Next occurrence of a weekday (0 = Sunday) at `wallClock`; today counts as 0. */
function nextWeekday(weekday: number, wallClock: string, weeksAhead = 0): string {
  const today = startOfToday();
  const delta = (weekday - today.getDay() + 7) % 7;
  return iso(delta + weeksAhead * 7, wallClock);
}

// ---------------------------------------------------------------- mosques ---

export const KHADIJA_ID: ID = 'mosque_khadija';
export const MADINA_ID: ID = 'mosque_madina';
export const RAWDAH_ID: ID = 'mosque_rawdah';
export const LAVAL_ID: ID = 'mosque_laval';
export const OTTAWA_ID: ID = 'mosque_ottawa';
export const TORONTO_ID: ID = 'mosque_toronto';
export const SALAHOUDDINE_ID: ID = 'mosque_salahouddine';
export const CIIC_ID: ID = 'mosque_ciic';
export const VERDUN_ID: ID = 'mosque_verdun';
export const FATIMA_ID: ID = 'mosque_fatima';

/** North American calc with the Twilight Angle rule — right for this latitude. */
const QC_PRAYER = {
  calculationMethod: 'NorthAmerica',
  madhab: 'shafi',
  highLatitudeRule: 'TwilightAngle',
} as const;

export const mockMosques: Mosque[] = [
  {
    _id: KHADIJA_ID,
    name: 'Khadijah Islamic Center',
    address: '2385 Rue Centre, Montréal, QC H3K 1J6',
    coordinates: { lat: 45.4799461, lng: -73.5671381 },
    joinCode: 'KHADIJA',
    prayerConfig: { ...QC_PRAYER, madhab: 'hanafi' },
    phone: '+1 514-934-7684',
    website: 'khadijahmtl.org',
    rating: { score: 4.9, count: 245 },
    bio: 'A Point-Saint-Charles masjid that has grown into the neighbourhood’s front door. Weekend Quran classes have run here for nine years, and the doors stay open through Ramadan for iftars advertised to Muslims and non-Muslims alike.',
    history:
      'The centre began as a weekend school in rented rooms and took the Rue Centre building to give the classes a permanent home. It is now licensed by the Government of Quebec to perform Islamic marriages, and runs a marriage and family counselling program alongside a full-time Islamic library.',
    services: [
      'Weekend Quran classes, ages 5–12',
      'Weekly family halaqahs',
      'Summer and winter camps',
      'Marriage services and family counselling',
      'New-immigrant settlement help',
      'Islamic library and hall rental',
    ],
    social: {
      facebook: 'https://facebook.com/khadijahmosquemontreal',
      instagram: 'https://instagram.com/khadijah_centre',
    },
  },
  {
    _id: MADINA_ID,
    name: 'Al-Madinah Center',
    address: '1260 Rue Mackay, Montréal, QC H3G 2H4',
    coordinates: { lat: 45.4953827, lng: -73.5765974 },
    joinCode: 'MADINA',
    prayerConfig: QC_PRAYER,
    phone: '514-360-3175',
    website: 'almadinah-center.org',
    rating: { score: 4.7, count: 230 },
    bio: 'Downtown on Mackay, a few minutes from Concordia. The Quran Academy runs circles at every level with teachers holding Ijaza in all Qira’at, and the eight-week summer camp has become the thing families plan their July around.',
    history:
      'Founded as the Association Salam Paix de Montréal to serve students and families in the downtown core. What started as a prayer space now carries a library, a conference room and a multi-purpose hall, alongside a zakat desk, orphan sponsorship and a food bank.',
    services: [
      'Arabic School - language, recitation, manners',
      'Quran Academy - Hifz and Tajweed, all levels',
      'Eight-week summer camp with robotics',
      'Zakat support and orphan sponsorship',
      'Food bank and scholarships',
      'Eid prayers at 6:00 and 7:00 AM',
    ],
    social: { facebook: 'https://facebook.com/AlMadinahCenter' },
  },
  {
    _id: SALAHOUDDINE_ID,
    name: 'Salahouddine Mosque',
    address: '6691 Av. du Parc, Montréal, QC H2V 4J1',
    coordinates: { lat: 45.5285181, lng: -73.6158974 },
    joinCode: 'SALAH',
    prayerConfig: QC_PRAYER,
    phone: '+1 514-274-6194',
    website: 'aicp.ca',
    rating: { score: 4.7, count: 179 },
    bio: 'One of the busiest program calendars in the city. There is a lesson and a free dinner every Friday, zikr and madih every Saturday, soccer and free self-defence for the youth, and a Mawlid parade that goes out through the streets once a year.',
    history:
      'The Av. du Parc mosque of the Association of Islamic Charitable Projects. It built its reputation on the Friday lesson and the dinner that follows it - open to anyone who walks in, no registration, running for years without a break.',
    services: [
      'Friday lesson and free dinner, 7:00 PM',
      'Zikr and madih, Saturdays 7:30 PM',
      'Cultural School An-Nour, Saturdays',
      'Men’s soccer training and adult team',
      'Free self-defence classes',
      'Scouts, summer camp and Hajj trips',
    ],
    social: { facebook: 'https://facebook.com/AicpCanada' },
  },
  {
    _id: CIIC_ID,
    name: 'Canadian Institute of Islamic Civilization',
    address: '615 Rue Belmont, Montréal, QC H3B 2L8',
    coordinates: { lat: 45.5020208, lng: -73.5656974 },
    joinCode: 'CIIC',
    prayerConfig: QC_PRAYER,
    phone: '+1 514-508-2444',
    website: 'theciic.com',
    rating: { score: 4.9, count: 274 },
    bio: 'MAC’s flagship downtown centre, six floors with a café on the ground level. Three jummah services run back to back to get everyone through, and the Sisters Youth Team and CIIC Juniors keep their own calendars.',
    history:
      'Opened by the Muslim Association of Canada to give downtown Montreal a centre rather than only a prayer hall. It hosts the Al-Huda weekend school, welcomes McGill and Concordia groups on interfaith visits, and programs heritage and arts alongside its social services.',
    services: [
      'Three jummah services - 11:45, 12:30, 1:15',
      'MAC Al-Huda weekend Islamic school',
      'Sisters’ potluck brunch, monthly',
      'CIIC Juniors children’s workshops',
      'Ramadan halaqa and taraweeh',
      'Rawasi Café and interfaith visits',
    ],
    social: {
      facebook: 'https://facebook.com/CIICMAC',
      instagram: 'https://instagram.com/ciicmac',
    },
  },
  {
    _id: VERDUN_ID,
    name: 'Centre Islamique de Verdun',
    address: '4538 Rue de Verdun, Montréal, QC H4G 1M3',
    coordinates: { lat: 45.4590693, lng: -73.57144 },
    joinCode: 'VERDUN',
    prayerConfig: QC_PRAYER,
    phone: '+1 514-508-9419',
    website: 'civmac.ca',
    rating: { score: 4.9, count: 311 },
    bio: 'MAC’s mosque and community centre in Verdun, known across the city for the homemade Algerian iftar buffet it puts on every night of Ramadan, cooked by the community and free to whoever comes.',
    history:
      'Established to serve Verdun’s growing Muslim families, with a separate women’s musallah from the start. It anchors the MAC Al-Huda Verdun weekend school and runs family and youth programming through the year.',
    services: [
      'Free Algerian iftar buffet through Ramadan',
      'Separate women’s musallah',
      'Al-Huda Verdun weekend school',
      'Family and youth programs',
    ],
    social: {
      facebook: 'https://facebook.com/CentreIslamiqueVerdun',
      instagram: 'https://instagram.com/maccivmac',
    },
  },
  {
    _id: FATIMA_ID,
    name: 'Mosquée Fatima',
    address: '2012 Rue Saint-Dominique, Montréal, QC H2X 1G9',
    coordinates: { lat: 45.5118625, lng: -73.5669616 },
    joinCode: 'FATIMA',
    prayerConfig: QC_PRAYER,
    phone: '514-285-1893',
    rating: { score: 4.6, count: 87 },
    bio: 'Two minutes’ walk from métro Saint-Laurent, open for every salat. Small, plain and reliable - the early fajr congregation is the reason a lot of people know it.',
    history:
      'A downtown mosque that has kept to what it does well: the five prayers on time, and regular halaqat and dars at the mosque. Free and donation-based, with no programming it cannot sustain.',
    services: ['Open for every salat', 'Regular halaqat and dars', 'Early fajr congregation'],
  },
  {
    _id: RAWDAH_ID,
    name: 'Mosquée Al-Rawdah',
    address: '12253 Blvd. Laurentien, Montréal, QC H4K 1N5',
    coordinates: { lat: 45.5292443, lng: -73.7222824 },
    joinCode: 'RAWDAH',
    prayerConfig: QC_PRAYER,
    phone: '+1 514-227-5000',
    website: 'alrawdah.ca',
    rating: { score: 4.8, count: 596 },
    bio: 'A MAC neighbourhood masjid in Ahuntsic-Cartierville, paired with the Centre Communautaire Laurentien next door. Daily prayers, jummah, and a separate sisters’ section.',
    history:
      'Built to serve the families spreading north along Boulevard Laurentien, and run alongside the community centre next door so the prayer hall and the programming have room apart from each other.',
    services: [
      'Daily prayers and jummah',
      'Separate sisters’ section',
      'Al-Huda weekend school',
      'Ramadan iftars and taraweeh',
    ],
    social: {
      facebook: 'https://facebook.com/alrawdah.ca',
      x: 'https://x.com/alrawdah',
    },
  },
  {
    _id: LAVAL_ID,
    name: 'Laval Islamic Cultural Centre',
    address: '3325 boul. Dagenais O., Laval, QC',
    coordinates: { lat: 45.567, lng: -73.72 },
    joinCode: 'LAVAL',
    prayerConfig: { ...QC_PRAYER, madhab: 'hanafi' },
    bio: 'The cultural centre serving Laval’s families north of the river, with weekend classes and a hall that carries the community’s weddings and funerals alike.',
    services: ['Daily prayers and jummah', 'Weekend Islamic school', 'Community hall'],
  },
  {
    _id: OTTAWA_ID,
    name: 'Ottawa Muslim Association',
    address: '251 Northwestern Ave, Ottawa, ON',
    coordinates: { lat: 45.4038, lng: -75.7285 },
    joinCode: 'OTTAWA',
    prayerConfig: QC_PRAYER,
    bio: 'The oldest mosque in Ottawa and still the one most of the city’s families pass through, with a full-time school on the same grounds.',
    services: ['Daily prayers and jummah', 'Full-time Islamic school', 'Community iftars'],
  },
  {
    _id: TORONTO_ID,
    name: 'Masjid Toronto',
    address: '168 Dundas St W, Toronto, ON',
    coordinates: { lat: 43.6559, lng: -79.386 },
    joinCode: 'TORONTO',
    prayerConfig: { ...QC_PRAYER, madhab: 'hanafi' },
    bio: 'A downtown masjid built around the working day - several jummah services so people can get back, and a steady stream of walk-ins between prayers.',
    services: ['Multiple jummah services', 'Daily prayers downtown', 'Weekly halaqas'],
  },
];

/**
 * Every mosque the app can show: the ten above, plus the generated directory.
 *
 * The ten are *operated* — they have coordinators, posts, iqamah times and a
 * demo walkthrough. The directory ones are real mosques we hold public data
 * for but that nobody has claimed: browsable, followable, with no posts and no
 * prayer configuration of their own.
 *
 * The mock client and the server seed both read this, so a mosque added to the
 * directory shows up in the app and in Mongo without touching either.
 */
export const allMosques: Mosque[] = [...mockMosques, ...directoryMosques].map((mosque) => ({
  ...mosque,
  // Verified handles win; the placeholders only fill the platforms we have
  // nothing for, so Khadijah keeps its own Facebook and Instagram. A
  // coordinator replaces theirs from **Edit mosque profile**.
  social: withPlaceholderSocial(mosque.social),
}));

/** True when a mosque has a coordinator and real content behind it. */
export function isOperatedMosque(mosqueId: ID): boolean {
  return mockMosques.some((m) => m._id === mosqueId);
}

// ----------------------------------------------------------------- people ---

/** The account the app is signed in as while we're on mocks. */
export const CURRENT_USER_ID: ID = 'user_001';

/**
 * The coordinators. Each one creates their mosque's posts and owns its admin
 * screens; every id here also appears in COORDINATOR_EMAILS below, because a
 * coordinator is exactly someone whose email was pre-approved.
 */
export const KHADIJA_ADMIN_ID: ID = 'user_002';
export const MADINA_ADMIN_ID: ID = 'user_003';
export const SALAH_ADMIN_ID: ID = 'user_004';
export const CIIC_ADMIN_ID: ID = 'user_008';
export const VERDUN_ADMIN_ID: ID = 'user_012';
export const FATIMA_ADMIN_ID: ID = 'user_016';

/** Every seeded account signs in with this, except the ones in `PASSWORDS`. */
export const MOCK_PASSWORD = 'mensemble';

/**
 * The account handed out for demos, and the one the login screen offers.
 *
 * Its password is deliberately short and memorable because it gets typed on a
 * borrowed phone in front of an audience. That is a demo trade-off, not a
 * standard: it clears the app's six-character floor and nothing more, and it
 * should be rotated before this reaches anyone real.
 */
export const DEMO_COORDINATOR_EMAIL = 'khadija.mosque@gmail.com';
export const DEMO_COORDINATOR_PASSWORD = '123456';

/**
 * Per-account passwords. Anything absent here uses `MOCK_PASSWORD`, so the
 * twenty seeded volunteers keep one shared password and only the accounts
 * someone actually types get their own.
 */
export const PASSWORDS: Readonly<Record<string, string>> = {
  [DEMO_COORDINATOR_EMAIL]: DEMO_COORDINATOR_PASSWORD,
};

/** The password a seeded account signs in with. */
export function passwordFor(email: string): string {
  return PASSWORDS[email.trim().toLowerCase()] ?? MOCK_PASSWORD;
}

export const mockUsers: User[] = [
  {
    _id: 'user_001',
    name: 'Yusuf Benali',
    email: 'yusuf@example.com',
    interests: ['Volunteering', 'Community meals', 'Youth'],
  },
  {
    // The Khadijah coordinator, and the account the demo signs in as. A real
    // address rather than @example.com: it is handed out, typed on a phone,
    // and has to survive being a genuine mailbox.
    _id: 'user_002',
    name: 'Khadijah Islamic Center',
    email: DEMO_COORDINATOR_EMAIL,
    interests: ['Volunteering', 'Facilities', 'Fundraising'],
  },
  {
    _id: 'user_003',
    name: 'Bilal Osman',
    email: 'bilal@example.com',
    interests: ['Outreach', 'Education'],
  },
  {
    _id: 'user_004',
    name: 'Fatima Zahra Idrissi',
    email: 'fatima@example.com',
    interests: ['Sisters', 'Education'],
  },
  {
    _id: 'user_005',
    name: 'Omar Haddad',
    email: 'omar@example.com',
    interests: ['Volunteering', 'Facilities'],
  },
  {
    _id: 'user_006',
    name: 'Khadija Sow',
    email: 'khadija.s@example.com',
    interests: ['Community meals', 'Sisters'],
  },
  {
    _id: 'user_007',
    name: 'Ibrahim Diallo',
    email: 'ibrahim@example.com',
    interests: ['Youth', 'Volunteering'],
  },
  {
    _id: 'user_008',
    name: 'Sumaya Rahman',
    email: 'sumaya@example.com',
    interests: ['Education', 'Sisters', 'Fundraising'],
  },
  {
    _id: 'user_009',
    name: 'Mustafa Kaya',
    email: 'mustafa@example.com',
    interests: ['Facilities', 'Outreach'],
  },
  {
    _id: 'user_010',
    name: 'Layla Mansour',
    email: 'layla@example.com',
    interests: ['Community meals', 'Youth'],
  },
  {
    _id: 'user_011',
    name: 'Hamza Touré',
    email: 'hamza@example.com',
    interests: ['Volunteering'],
  },
  {
    _id: 'user_012',
    name: 'Nadia Belkacem',
    email: 'nadia@example.com',
    interests: ['Sisters', 'Outreach'],
  },
  {
    _id: 'user_013',
    name: 'Rayan Chowdhury',
    email: 'rayan@example.com',
    interests: ['Youth', 'Education'],
  },
  {
    _id: 'user_014',
    name: 'Zainab Ali',
    email: 'zainab@example.com',
    interests: ['Community meals', 'Fundraising'],
  },
  {
    _id: 'user_015',
    name: 'Adam Ndiaye',
    email: 'adam@example.com',
    interests: ['Volunteering', 'Facilities'],
  },
  {
    _id: 'user_016',
    name: 'Mariam Hussein',
    email: 'mariam@example.com',
    interests: ['Sisters', 'Education'],
  },
  {
    _id: 'user_017',
    name: 'Tariq Amrani',
    email: 'tariq@example.com',
    interests: ['Outreach', 'Volunteering'],
  },
  {
    _id: 'user_018',
    name: 'Hafsa Karim',
    email: 'hafsa@example.com',
    interests: ['Youth', 'Community meals'],
  },
  {
    _id: 'user_019',
    name: 'Salman Sheikh',
    email: 'salman@example.com',
    interests: ['Education', 'Facilities'],
  },
  {
    _id: 'user_020',
    name: 'Aisha Ndoye',
    email: 'aisha@example.com',
    interests: ['Sisters', 'Fundraising', 'Volunteering'],
  },
];

// ------------------------------------------------- coordinator allowlist ---

/**
 * Who may coordinate a mosque, and which one.
 *
 * A mosque's admin screens are not something you can sign up for. The mosque
 * gives us an email, it goes on this list, and the account that email creates
 * gets the admin role on that mosque the moment it is made — before then, the
 * same email signing up is an ordinary member like anyone else.
 *
 * This is the whole gate. `signupAccount` reads it, the server's seed reads it,
 * and nothing else grants an `admin` membership except a coordinator promoting
 * someone from the People screen, which is itself an admin-only action.
 *
 * In production this table lives in the database and is edited by whoever
 * administers the platform; the shape is the same.
 */
export interface CoordinatorGrant {
  email: string;
  mosqueId: ID;
}

export const COORDINATOR_EMAILS: CoordinatorGrant[] = [
  { email: DEMO_COORDINATOR_EMAIL, mosqueId: KHADIJA_ID },
  { email: 'bilal@example.com', mosqueId: MADINA_ID },
  { email: 'fatima@example.com', mosqueId: SALAHOUDDINE_ID },
  { email: 'sumaya@example.com', mosqueId: CIIC_ID },
  { email: 'nadia@example.com', mosqueId: VERDUN_ID },
  { email: 'mariam@example.com', mosqueId: FATIMA_ID },
  // Pre-approved but not yet signed up — creating this account hands it the
  // Al-Rawdah admin screens straight away. It's the one to demo the gate with.
  { email: 'coordinator@alrawdah.ca', mosqueId: RAWDAH_ID },
];

/** The mosque a pre-approved email coordinates, or null for everyone else. */
export function coordinatorMosqueFor(email: string): ID | null {
  const match = email.trim().toLowerCase();
  return COORDINATOR_EMAILS.find((c) => c.email === match)?.mosqueId ?? null;
}

// -------------------------------------------------- follows & memberships ---

export const mockFollows: Follow[] = [
  {
    _id: 'follow_001',
    userId: CURRENT_USER_ID,
    mosqueId: KHADIJA_ID,
    createdAt: iso(-30, '09:00'),
  },
  { _id: 'follow_002', userId: CURRENT_USER_ID, mosqueId: MADINA_ID, createdAt: iso(-12, '19:40') },
  // Four mosques is what an actual Montrealer's feed looks like — the one they
  // pray at, the one near work, and the two that run the programs their kids go
  // to. It's also what puts a poster in the feed rather than a wall of notices.
  {
    _id: 'follow_021',
    userId: CURRENT_USER_ID,
    mosqueId: SALAHOUDDINE_ID,
    createdAt: iso(-70, '18:30'),
  },
  { _id: 'follow_022', userId: CURRENT_USER_ID, mosqueId: CIIC_ID, createdAt: iso(-25, '12:10') },
  { _id: 'follow_023', userId: CURRENT_USER_ID, mosqueId: VERDUN_ID, createdAt: iso(-8, '20:05') },

  // Khadija's congregation. Spread over two years so "member since" varies.
  { _id: 'follow_003', userId: 'user_005', mosqueId: KHADIJA_ID, createdAt: iso(-620, '11:00') },
  { _id: 'follow_004', userId: 'user_006', mosqueId: KHADIJA_ID, createdAt: iso(-540, '18:20') },
  { _id: 'follow_005', userId: 'user_007', mosqueId: KHADIJA_ID, createdAt: iso(-410, '09:15') },
  { _id: 'follow_006', userId: 'user_010', mosqueId: KHADIJA_ID, createdAt: iso(-380, '20:00') },
  { _id: 'follow_007', userId: 'user_011', mosqueId: KHADIJA_ID, createdAt: iso(-300, '13:45') },
  { _id: 'follow_008', userId: 'user_013', mosqueId: KHADIJA_ID, createdAt: iso(-260, '17:30') },
  { _id: 'follow_009', userId: 'user_014', mosqueId: KHADIJA_ID, createdAt: iso(-190, '08:50') },
  { _id: 'follow_010', userId: 'user_015', mosqueId: KHADIJA_ID, createdAt: iso(-150, '19:10') },
  { _id: 'follow_011', userId: 'user_016', mosqueId: KHADIJA_ID, createdAt: iso(-120, '12:00') },
  { _id: 'follow_012', userId: 'user_018', mosqueId: KHADIJA_ID, createdAt: iso(-95, '16:40') },
  { _id: 'follow_013', userId: 'user_020', mosqueId: KHADIJA_ID, createdAt: iso(-60, '10:25') },
  { _id: 'follow_014', userId: 'user_004', mosqueId: KHADIJA_ID, createdAt: iso(-45, '21:05') },
  { _id: 'follow_015', userId: 'user_008', mosqueId: KHADIJA_ID, createdAt: iso(-20, '14:15') },

  // Madina's.
  { _id: 'follow_016', userId: 'user_009', mosqueId: MADINA_ID, createdAt: iso(-500, '10:00') },
  { _id: 'follow_017', userId: 'user_012', mosqueId: MADINA_ID, createdAt: iso(-330, '15:30') },
  { _id: 'follow_018', userId: 'user_017', mosqueId: MADINA_ID, createdAt: iso(-210, '18:00') },
  { _id: 'follow_019', userId: 'user_019', mosqueId: MADINA_ID, createdAt: iso(-80, '09:40') },
  { _id: 'follow_020', userId: 'user_020', mosqueId: MADINA_ID, createdAt: iso(-35, '20:30') },
];

export const mockMemberships: Membership[] = [
  {
    _id: 'member_001',
    userId: KHADIJA_ADMIN_ID,
    mosqueId: KHADIJA_ID,
    role: 'admin',
    createdAt: iso(-400, '09:00'),
  },
  {
    _id: 'member_002',
    userId: MADINA_ADMIN_ID,
    mosqueId: MADINA_ID,
    role: 'admin',
    createdAt: iso(-380, '09:00'),
  },
  {
    _id: 'member_003',
    userId: SALAH_ADMIN_ID,
    mosqueId: SALAHOUDDINE_ID,
    role: 'admin',
    createdAt: iso(-360, '09:00'),
  },
  {
    _id: 'member_004',
    userId: CIIC_ADMIN_ID,
    mosqueId: CIIC_ID,
    role: 'admin',
    createdAt: iso(-340, '09:00'),
  },
  {
    _id: 'member_005',
    userId: VERDUN_ADMIN_ID,
    mosqueId: VERDUN_ID,
    role: 'admin',
    createdAt: iso(-320, '09:00'),
  },
  {
    _id: 'member_006',
    userId: FATIMA_ADMIN_ID,
    mosqueId: FATIMA_ID,
    role: 'admin',
    createdAt: iso(-300, '09:00'),
  },
  {
    _id: 'member_007',
    userId: CURRENT_USER_ID,
    mosqueId: KHADIJA_ID,
    role: 'member',
    createdAt: iso(-30, '09:00'),
  },
];

// ------------------------------------------------------------------ posts ---

/**
 * The ten poster programs, plus the volunteer shifts and announcements that
 * surround them.
 *
 * Every dated program here is a real listing from the Montreal mosque
 * database, and the ones carrying a poster carry the poster designed for it —
 * same mosque, same schedule, same price. The posterKey field names artwork
 * bundled with the app; POSTER_ART in components/Poster.tsx maps it to a file.
 */
export const mockPosts: Post[] = [
  // ── Khadijah ──────────────────────────────────────────────────────────────
  {
    _id: 'post_001',
    mosqueId: KHADIJA_ID,
    type: 'class',
    title: 'Weekend Quran classes',
    description:
      'Registration is open for the weekend Quran school, running its ninth year. Saturdays and Sundays, 10:30 to 1:30, ages 5 to 12 - reading and memorization, September through June. $75 a month, with $20 off for each additional sibling.',
    category: 'Education',
    startAt: nextWeekday(6, '10:30'),
    endAt: nextWeekday(6, '13:30'),
    location: '2385 Rue Centre',
    capacity: 60,
    slotsFilled: 41,
    posterKey: 'quran-classes',
    sessions: [
      { startAt: nextWeekday(6, '10:30', 0), endAt: nextWeekday(6, '13:30', 0) },
      { startAt: nextWeekday(0, '10:30', 0), endAt: nextWeekday(0, '13:30', 0) },
      { startAt: nextWeekday(6, '10:30', 1), endAt: nextWeekday(6, '13:30', 1) },
      { startAt: nextWeekday(0, '10:30', 1), endAt: nextWeekday(0, '13:30', 1) },
    ],
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-9, '19:20'),
  },
  {
    _id: 'post_002',
    mosqueId: KHADIJA_ID,
    type: 'volunteer',
    title: 'Iftar setup - Saturday community dinner',
    description:
      'We need four people to lay out tables, set the serving line and fill the water jugs before maghrib. Arrive 90 minutes early. Food after, obviously.',
    category: 'Community meals',
    startAt: nextWeekday(6, '17:00'),
    endAt: nextWeekday(6, '19:30'),
    location: 'Main hall, basement level',
    slotsNeeded: 4,
    slotsFilled: 1,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-1, '20:15'),
  },
  {
    _id: 'post_003',
    mosqueId: KHADIJA_ID,
    type: 'volunteer',
    title: 'Jummah parking marshals',
    description:
      'Two jummah services back to back at 1:00 and 2:00, so the lot turns over completely in between. Keep the lane by the fire door clear and help the elders find a spot near the ramp. Vests provided.',
    category: 'Facilities',
    startAt: nextWeekday(5, '12:30'),
    endAt: nextWeekday(5, '14:30'),
    location: 'Rue Centre parking lot',
    slotsNeeded: 6,
    slotsFilled: 2,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-3, '11:05'),
  },
  {
    _id: 'post_004',
    mosqueId: KHADIJA_ID,
    type: 'volunteer',
    title: 'Kitchen cleanup crew',
    description:
      'After the dinner: dishes, floors, and the bins out to the curb. About an hour with three people.',
    category: 'Community meals',
    startAt: nextWeekday(6, '20:30'),
    endAt: nextWeekday(6, '21:30'),
    location: 'Kitchen',
    slotsNeeded: 3,
    slotsFilled: 3,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-3, '11:20'),
  },
  {
    _id: 'post_005',
    mosqueId: KHADIJA_ID,
    type: 'event',
    title: 'Weekly family halaqah',
    description:
      'The whole family in one room - a short talk, then tea and questions. Children welcome; there is no separate program, that is the point of it.',
    category: 'Education',
    startAt: nextWeekday(3, '19:00'),
    endAt: nextWeekday(3, '20:30'),
    location: 'Islamic library',
    capacity: 50,
    slotsFilled: 28,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-6, '17:40'),
  },
  {
    _id: 'post_006',
    mosqueId: KHADIJA_ID,
    type: 'announcement',
    title: 'Marriage and family counselling - now booking',
    description:
      'The counselling program has openings again. Sessions are confidential and free to the community. The centre is licensed by the Government of Quebec for Islamic marriages; call 514-934-7684 to arrange either.',
    category: 'Outreach',
    startAt: iso(-2, '10:00'),
    endAt: iso(30, '23:59'),
    location: 'Khadijah Islamic Center',
    slotsFilled: 0,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-2, '10:00'),
  },

  // ── Al-Madinah ────────────────────────────────────────────────────────────
  {
    _id: 'post_007',
    mosqueId: MADINA_ID,
    type: 'class',
    title: 'Arabic School 2025–26 - registration open',
    description:
      'Three streams on Sundays: Arabic Language, Quranic Recitation, and Islamic Manners. Pay in full for $700, or $650 on the early bird with registration waived. There is also a register-now-pay-later option: $50 deposit, then $250 in September, $200 in January, $200 in March. Optional lunch is $150 for the year.',
    category: 'Education',
    startAt: nextWeekday(0, '09:30'),
    endAt: nextWeekday(0, '13:00'),
    location: '1260 Rue Mackay',
    capacity: 120,
    slotsFilled: 87,
    posterKey: 'arabic-school',
    sessions: [
      { startAt: nextWeekday(0, '09:30', 0), endAt: nextWeekday(0, '13:00', 0) },
      { startAt: nextWeekday(0, '09:30', 1), endAt: nextWeekday(0, '13:00', 1) },
      { startAt: nextWeekday(0, '09:30', 2), endAt: nextWeekday(0, '13:00', 2) },
      { startAt: nextWeekday(0, '09:30', 3), endAt: nextWeekday(0, '13:00', 3) },
    ],
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-16, '09:30'),
  },
  {
    _id: 'post_008',
    mosqueId: MADINA_ID,
    type: 'event',
    title: 'Summer camp 2026 - eight weeks, deposits open',
    description:
      'Robotics and coding for the kids, a pool visit every week, skating at the arena down the street, a group restaurant meal on Fridays and something outdoors every day. $150 a week, or $1,100 for all eight weeks - which saves you $100. Hold a place with a $50 deposit. Early drop-off and late pick-up are $25 each.',
    category: 'Youth',
    startAt: iso(12, '09:00'),
    endAt: iso(12, '16:00'),
    location: 'Al-Madinah Center',
    capacity: 80,
    slotsFilled: 52,
    posterKey: 'summer-camp',
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-11, '12:15'),
  },
  {
    _id: 'post_009',
    mosqueId: MADINA_ID,
    type: 'volunteer',
    title: 'Food bank packing night',
    description:
      'We pack 200 boxes for the food bank. Standing work for two hours; bring gloves if you have them.',
    category: 'Outreach',
    startAt: iso(2, '18:30'),
    endAt: iso(2, '20:30'),
    location: 'Multi-purpose hall',
    slotsNeeded: 8,
    slotsFilled: 5,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-4, '16:20'),
  },
  {
    _id: 'post_010',
    mosqueId: MADINA_ID,
    type: 'class',
    title: 'Quran Academy - Hifz and Tajweed circles',
    description:
      'Weekly circles at every level and every age, with teachers holding Ijaza in all Qira’at. The schedule is flexible - tell us when you can come and we will place you in a circle. Free.',
    category: 'Education',
    startAt: nextWeekday(1, '18:00'),
    endAt: nextWeekday(1, '19:30'),
    location: 'Conference room',
    capacity: 40,
    slotsFilled: 31,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-13, '10:40'),
  },
  {
    _id: 'post_011',
    mosqueId: MADINA_ID,
    type: 'announcement',
    title: 'Zakat-ul-Fitr set at $15 per person',
    description:
      'Zakat-ul-Fitr is $15 per head this year, and fidya or kaffara the same. The zakat desk is open after dhuhr and maghrib, or give through the website. Orphan sponsorship and the seniors’ support fund take donations at the same desk.',
    category: 'Fundraising',
    startAt: iso(-1, '12:00'),
    endAt: iso(21, '23:59'),
    location: 'Al-Madinah Center',
    slotsFilled: 0,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-1, '12:00'),
  },

  // ── Salahouddine ──────────────────────────────────────────────────────────
  {
    _id: 'post_012',
    mosqueId: SALAHOUDDINE_ID,
    type: 'event',
    title: 'Friday lesson, then dinner',
    description:
      'The lesson on belief and religious themes at 7:00, as it is every Friday, and dinner served straight after. Free, no registration, everyone welcome - just come.',
    category: 'Community meals',
    startAt: nextWeekday(5, '19:00'),
    endAt: nextWeekday(5, '21:00'),
    location: '6691 Av. du Parc',
    capacity: 150,
    slotsFilled: 96,
    posterKey: 'friday-dinner',
    createdBy: SALAH_ADMIN_ID,
    createdAt: iso(-5, '14:00'),
  },
  {
    _id: 'post_013',
    mosqueId: SALAHOUDDINE_ID,
    type: 'event',
    title: 'Zikr and madih, Saturday evening',
    description:
      'Zikr and madih followed by an Islamic lesson, every Saturday at 7:30. The madih groups for men, women and children all sing; come to listen or come to join in.',
    category: 'Community',
    startAt: nextWeekday(6, '19:30'),
    endAt: nextWeekday(6, '21:00'),
    location: 'Main hall',
    capacity: 120,
    slotsFilled: 63,
    posterKey: 'zikr-madih',
    createdBy: SALAH_ADMIN_ID,
    createdAt: iso(-8, '20:30'),
  },
  {
    _id: 'post_014',
    mosqueId: SALAHOUDDINE_ID,
    type: 'class',
    title: 'Free self-defence classes',
    description:
      'Free self-defence, taught by instructors from the community. Open to youth and adults. Times shift with the season - call 514-274-6194 for the current schedule before your first session.',
    category: 'Youth',
    startAt: nextWeekday(2, '18:30'),
    endAt: nextWeekday(2, '20:00'),
    location: 'Gymnasium',
    capacity: 30,
    slotsFilled: 19,
    posterKey: 'self-defence',
    createdBy: SALAH_ADMIN_ID,
    createdAt: iso(-7, '16:45'),
  },
  {
    _id: 'post_015',
    mosqueId: SALAHOUDDINE_ID,
    type: 'event',
    title: 'Soccer training - men’s team and open sessions',
    description:
      'Training for the adult team plus open sessions for anyone who wants a game. Boots and shin pads; we have the rest. Call the mosque for this week’s pitch and time.',
    category: 'Youth',
    startAt: nextWeekday(0, '15:00'),
    endAt: nextWeekday(0, '17:00'),
    location: 'Parc Jarry pitch',
    capacity: 40,
    slotsFilled: 24,
    posterKey: 'soccer',
    createdBy: SALAH_ADMIN_ID,
    createdAt: iso(-4, '11:10'),
  },
  {
    _id: 'post_016',
    mosqueId: SALAHOUDDINE_ID,
    type: 'volunteer',
    title: 'Friday dinner serving line',
    description:
      'Six people on the line and two on the washing-up. The dinner runs every week and it only works because this shift fills - take one Friday a month if you can.',
    category: 'Community meals',
    startAt: nextWeekday(5, '18:30'),
    endAt: nextWeekday(5, '21:30'),
    location: 'Kitchen and main hall',
    slotsNeeded: 8,
    slotsFilled: 3,
    createdBy: SALAH_ADMIN_ID,
    createdAt: iso(-2, '09:50'),
  },
  {
    _id: 'post_017',
    mosqueId: SALAHOUDDINE_ID,
    type: 'announcement',
    title: 'Mawlid parade - route and stewards',
    description:
      'The annual parade goes out through the streets next month. We need stewards along the route and drivers for the sound van. The Ma’had institute semester starts the same week - sign-up sheets are on the noticeboard for both.',
    category: 'Community',
    startAt: iso(-3, '18:00'),
    endAt: iso(25, '23:59'),
    location: 'Salahouddine Mosque',
    slotsFilled: 0,
    createdBy: SALAH_ADMIN_ID,
    createdAt: iso(-3, '18:00'),
  },

  // ── CIIC ──────────────────────────────────────────────────────────────────
  {
    _id: 'post_018',
    mosqueId: CIIC_ID,
    type: 'event',
    title: 'Sisters’ potluck brunch',
    description:
      'The Sisters Youth Team’s monthly brunch, 10:30 to 1:00 on the sixth floor. Bring a dish to share. There is a short halaqa in the middle and the rest is company.',
    category: 'Sisters',
    startAt: nextWeekday(6, '10:30'),
    endAt: nextWeekday(6, '13:00'),
    location: '615 Rue Belmont, 6th floor',
    capacity: 70,
    slotsFilled: 44,
    posterKey: 'sisters-brunch',
    createdBy: CIIC_ADMIN_ID,
    createdAt: iso(-6, '21:10'),
  },
  {
    _id: 'post_019',
    mosqueId: CIIC_ID,
    type: 'class',
    title: 'MAC Al-Huda weekend Islamic school',
    description:
      'The weekend school runs here through the academic year. Registration is $60 and non-refundable; tuition can be paid in full or by two post-dated cheques. A rejected cheque carries a $50 penalty.',
    category: 'Education',
    startAt: nextWeekday(6, '09:00'),
    endAt: nextWeekday(6, '12:30'),
    location: 'CIIC classrooms',
    capacity: 150,
    slotsFilled: 118,
    createdBy: CIIC_ADMIN_ID,
    createdAt: iso(-20, '08:30'),
  },
  {
    _id: 'post_020',
    mosqueId: CIIC_ID,
    type: 'event',
    title: 'CIIC Juniors - Ramadan fiqh workshop',
    description:
      'A workshop for the children on the fiqh of fasting, run by the Juniors Team. Ages 7 to 12, two hours with a break, and they go home with a workbook.',
    category: 'Youth',
    startAt: iso(6, '14:00'),
    endAt: iso(6, '16:00'),
    location: '3rd floor, CIIC',
    capacity: 45,
    slotsFilled: 29,
    createdBy: CIIC_ADMIN_ID,
    createdAt: iso(-9, '13:20'),
  },
  {
    _id: 'post_021',
    mosqueId: CIIC_ID,
    type: 'volunteer',
    title: 'Jummah welcome team - three services',
    description:
      'Three jummah services at 11:45, 12:30 and 1:15 means three turnovers in ninety minutes. Four people on the doors and the shoe racks keeps it moving.',
    category: 'Volunteering',
    startAt: nextWeekday(5, '11:15'),
    endAt: nextWeekday(5, '14:00'),
    location: 'Ground floor entrance',
    slotsNeeded: 4,
    slotsFilled: 2,
    createdBy: CIIC_ADMIN_ID,
    createdAt: iso(-2, '15:00'),
  },
  {
    _id: 'post_022',
    mosqueId: CIIC_ID,
    type: 'announcement',
    title: 'Interfaith visit - McGill and Concordia groups',
    description:
      'We are hosting the My Neighbour’s Faith groups from both universities this month. If you can help show people round after jummah, tell the office - it is an hour and it does more good than most things we run.',
    category: 'Outreach',
    startAt: iso(-1, '11:00'),
    endAt: iso(18, '23:59'),
    location: 'CIIC',
    slotsFilled: 0,
    createdBy: CIIC_ADMIN_ID,
    createdAt: iso(-1, '11:00'),
  },

  // ── Verdun ────────────────────────────────────────────────────────────────
  {
    _id: 'post_023',
    mosqueId: VERDUN_ID,
    type: 'event',
    title: 'Ramadan iftar buffet - every night',
    description:
      'The homemade Algerian buffet runs every night of Ramadan, cooked by the community and free to everyone. Bring your family, bring a neighbour. Taraweeh follows.',
    category: 'Community meals',
    startAt: nextWeekday(4, '19:30'),
    endAt: nextWeekday(4, '21:30'),
    location: '4538 Rue de Verdun',
    capacity: 250,
    slotsFilled: 163,
    posterKey: 'ramadan-iftar',
    createdBy: VERDUN_ADMIN_ID,
    createdAt: iso(-5, '10:00'),
  },
  {
    _id: 'post_024',
    mosqueId: VERDUN_ID,
    type: 'volunteer',
    title: 'Iftar kitchen - cooking and serving',
    description:
      'The buffet is cooked here, not catered. Ten people across the evening: prep from four, serving from seven, clearing after. Take one night or take a week.',
    category: 'Community meals',
    startAt: nextWeekday(4, '16:00'),
    endAt: nextWeekday(4, '22:00'),
    location: 'Kitchen',
    slotsNeeded: 10,
    slotsFilled: 6,
    createdBy: VERDUN_ADMIN_ID,
    createdAt: iso(-5, '10:30'),
  },
  {
    _id: 'post_025',
    mosqueId: VERDUN_ID,
    type: 'class',
    title: 'Al-Huda Verdun weekend school',
    description:
      'Registration is $60, non-refundable. Tuition in full online or by two post-dated cheques to the Muslim Association of Canada. Fees are non-refundable after 30 September. Questions: (438) 308-9735.',
    category: 'Education',
    startAt: nextWeekday(0, '09:30'),
    endAt: nextWeekday(0, '12:30'),
    location: 'Centre Islamique de Verdun',
    capacity: 90,
    slotsFilled: 74,
    createdBy: VERDUN_ADMIN_ID,
    createdAt: iso(-18, '11:00'),
  },

  // ── Fatima ────────────────────────────────────────────────────────────────
  {
    _id: 'post_026',
    mosqueId: FATIMA_ID,
    type: 'class',
    title: 'Halaqat and dars',
    description:
      'Regular study circles at the mosque, two minutes from métro Saint-Laurent. Free and donation-based, as everything here is. Come to one and see.',
    category: 'Education',
    startAt: nextWeekday(1, '19:30'),
    endAt: nextWeekday(1, '20:45'),
    location: '2012 Rue Saint-Dominique',
    capacity: 35,
    slotsFilled: 21,
    posterKey: 'halaqat-dars',
    sessions: [
      { startAt: nextWeekday(1, '19:30', 0), endAt: nextWeekday(1, '20:45', 0) },
      { startAt: nextWeekday(1, '19:30', 1), endAt: nextWeekday(1, '20:45', 1) },
      { startAt: nextWeekday(1, '19:30', 2), endAt: nextWeekday(1, '20:45', 2) },
    ],
    createdBy: FATIMA_ADMIN_ID,
    createdAt: iso(-10, '18:00'),
  },
  {
    _id: 'post_027',
    mosqueId: FATIMA_ID,
    type: 'announcement',
    title: 'Fajr congregation - the early one',
    description:
      'People come across town for the fajr jama’ah here. Doors open twenty minutes before; there is tea afterwards and nobody is in a hurry.',
    category: 'Prayer times',
    startAt: iso(-4, '05:00'),
    endAt: iso(26, '23:59'),
    location: 'Mosquée Fatima',
    slotsFilled: 0,
    createdBy: FATIMA_ADMIN_ID,
    createdAt: iso(-4, '05:00'),
  },

  // ── Al-Rawdah, Ottawa, Toronto ────────────────────────────────────────────
  {
    _id: 'post_028',
    mosqueId: RAWDAH_ID,
    type: 'volunteer',
    title: 'New carpet installation - lifting help',
    description:
      'The installers need five of us to move the old rolls out and hold the underlay. Heavy lifting; wear shoes you can ruin.',
    category: 'Facilities',
    startAt: iso(5, '09:00'),
    endAt: iso(5, '13:00'),
    location: 'Prayer hall',
    slotsNeeded: 5,
    slotsFilled: 1,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-1, '08:05'),
  },
  {
    _id: 'post_029',
    mosqueId: OTTAWA_ID,
    type: 'event',
    title: 'Community iftar - open to all',
    description:
      'A shared iftar in the main hall. Bring a dish if you can; everyone is welcome regardless.',
    category: 'Community meals',
    startAt: nextWeekday(5, '19:30'),
    endAt: nextWeekday(5, '21:30'),
    location: 'Main hall',
    capacity: 200,
    slotsFilled: 84,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-2, '10:00'),
  },
  {
    _id: 'post_030',
    mosqueId: TORONTO_ID,
    type: 'volunteer',
    title: 'Friday parking and welcome team',
    description: 'Four people to direct parking and greet at the door for jummah.',
    category: 'Volunteering',
    startAt: nextWeekday(5, '12:30'),
    endAt: nextWeekday(5, '14:30'),
    location: 'Front entrance',
    slotsNeeded: 4,
    slotsFilled: 1,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-1, '09:00'),
  },

  /*
   * ── Happening right now ────────────────────────────────────────────────
   *
   * Every other fixture hangs off a wall time, which means the check-in flow
   * is only demonstrable on the day its shift happens to fall. This one is
   * measured from the seed instead: it started forty minutes ago and runs for
   * another five hours, so from the moment `npm run seed` finishes there is a
   * shift in progress, with the signed-in user on it and un-checked-in.
   *
   * That is the whole path in one row — the card says "on now", "My QR" opens
   * a code, the coordinator's coverage screen has four names to mark off, and
   * one of them (user_005) is already in so the screen isn't empty either.
   */
  {
    _id: 'post_now',
    mosqueId: KHADIJA_ID,
    type: 'volunteer',
    title: 'Community kitchen - service in progress',
    description:
      'The kitchen is open and the line is moving. Two on the serving counter, one on drinks, one clearing tables and running dishes back. Check in with the coordinator when you arrive - scan the code by the door or show yours at the counter.',
    category: 'Community meals',
    startAt: fromNow(-40),
    endAt: fromNow(300),
    location: 'Main hall, basement level',
    slotsNeeded: 6,
    slotsFilled: 4,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: fromNow(-2880),
  },
];

/** Finished shifts the signed-in user served — feeds "My Stuff": past + hours. */
export const mockPastPosts: Post[] = [
  {
    _id: 'post_101',
    mosqueId: KHADIJA_ID,
    type: 'volunteer',
    title: 'Ramadan iftar serving line',
    description: 'Serving 180 plates on the line.',
    category: 'Community meals',
    startAt: iso(-7, '17:00'),
    endAt: iso(-7, '20:00'),
    location: 'Main hall',
    slotsNeeded: 6,
    slotsFilled: 5,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-14, '10:00'),
  },
  {
    _id: 'post_102',
    mosqueId: MADINA_ID,
    type: 'volunteer',
    title: 'Winter coat drive sorting',
    description: 'Sorting and bagging donated coats by size.',
    category: 'Outreach',
    startAt: iso(-21, '09:00'),
    endAt: iso(-21, '12:00'),
    location: 'Madina community room',
    slotsNeeded: 4,
    slotsFilled: 4,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-28, '10:00'),
  },
  {
    _id: 'post_103',
    mosqueId: KHADIJA_ID,
    type: 'event',
    title: 'Eid al-Fitr community breakfast',
    description: 'Breakfast in the main hall after the Eid prayer.',
    category: 'Community meals',
    startAt: iso(-34, '08:00'),
    endAt: iso(-34, '11:00'),
    location: 'Main hall',
    capacity: 12,
    slotsFilled: 10,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-48, '09:00'),
  },
  {
    _id: 'post_104',
    mosqueId: KHADIJA_ID,
    type: 'volunteer',
    title: 'Food bank packing',
    description: 'Packing weekly hampers for forty families.',
    category: 'Volunteering',
    startAt: iso(-14, '10:00'),
    endAt: iso(-14, '13:00'),
    location: 'Basement',
    slotsNeeded: 5,
    slotsFilled: 5,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-25, '11:30'),
  },
  {
    _id: 'post_105',
    mosqueId: KHADIJA_ID,
    type: 'class',
    title: 'Tajweed for beginners',
    description: 'Six-week introduction to recitation.',
    category: 'Education',
    startAt: iso(-10, '18:30'),
    endAt: iso(-10, '20:00'),
    location: 'Classroom 2',
    capacity: 8,
    slotsFilled: 6,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-30, '14:00'),
  },
];

// ---------------------------------------------------------------- signups ---

export const mockSignups: Signup[] = [
  // post_001 — one of four taken. This is the demo post; leave room to claim.
  {
    _id: 'signup_001',
    postId: 'post_001',
    userId: 'user_006',
    status: 'confirmed',
    createdAt: iso(0, '08:40'),
  },

  // post_002 — two of six.
  {
    _id: 'signup_002',
    postId: 'post_002',
    userId: 'user_005',
    status: 'confirmed',
    createdAt: iso(-2, '13:10'),
  },
  {
    _id: 'signup_003',
    postId: 'post_002',
    userId: 'user_015',
    status: 'confirmed',
    createdAt: iso(-1, '21:30'),
  },

  // post_003 — full, plus one withdrawal so the count has to be computed honestly.
  {
    _id: 'signup_004',
    postId: 'post_003',
    userId: 'user_010',
    status: 'confirmed',
    createdAt: iso(-3, '12:00'),
  },
  {
    _id: 'signup_005',
    postId: 'post_003',
    userId: 'user_014',
    status: 'confirmed',
    createdAt: iso(-2, '19:45'),
  },
  {
    _id: 'signup_006',
    postId: 'post_003',
    userId: 'user_018',
    status: 'confirmed',
    createdAt: iso(-1, '07:15'),
  },
  {
    _id: 'signup_007',
    postId: 'post_003',
    userId: 'user_011',
    status: 'withdrawn',
    createdAt: iso(-2, '10:00'),
  },

  // post_009 — five of eight at Madina.
  {
    _id: 'signup_008',
    postId: 'post_009',
    userId: 'user_003',
    status: 'confirmed',
    createdAt: iso(-3, '18:00'),
  },
  {
    _id: 'signup_009',
    postId: 'post_009',
    userId: 'user_009',
    status: 'confirmed',
    createdAt: iso(-2, '09:30'),
  },
  {
    _id: 'signup_010',
    postId: 'post_009',
    userId: 'user_012',
    status: 'confirmed',
    createdAt: iso(-2, '14:20'),
  },
  {
    _id: 'signup_011',
    postId: 'post_009',
    userId: 'user_017',
    status: 'confirmed',
    createdAt: iso(-1, '20:05'),
  },
  {
    _id: 'signup_012',
    postId: 'post_009',
    userId: 'user_020',
    status: 'confirmed',
    createdAt: iso(0, '07:55'),
  },

  // post_010 — one of five.
  {
    _id: 'signup_013',
    postId: 'post_010',
    userId: 'user_019',
    status: 'confirmed',
    createdAt: iso(0, '09:12'),
  },

  // The signed-in user's own history: two past shifts, both checked in.
  {
    _id: 'signup_014',
    postId: 'post_101',
    userId: CURRENT_USER_ID,
    status: 'confirmed',
    checkedInAt: iso(-7, '17:05'),
  },
  {
    _id: 'signup_015',
    postId: 'post_102',
    userId: CURRENT_USER_ID,
    status: 'confirmed',
    checkedInAt: iso(-21, '09:02'),
  },

  // post_101 — the iftar line, six claimed. Five turned up; one did not, which
  // is what makes the coordinator's reliability column worth reading.
  {
    _id: 'signup_101',
    postId: 'post_101',
    userId: 'user_005',
    status: 'confirmed',
    createdAt: iso(-12, '10:00'),
    checkedInAt: iso(-7, '16:58'),
  },
  {
    _id: 'signup_102',
    postId: 'post_101',
    userId: 'user_006',
    status: 'confirmed',
    createdAt: iso(-12, '14:30'),
    checkedInAt: iso(-7, '17:03'),
  },
  {
    _id: 'signup_103',
    postId: 'post_101',
    userId: 'user_010',
    status: 'confirmed',
    createdAt: iso(-11, '09:20'),
    checkedInAt: iso(-7, '17:12'),
  },
  {
    _id: 'signup_104',
    postId: 'post_101',
    userId: 'user_015',
    status: 'confirmed',
    createdAt: iso(-10, '19:40'),
    checkedInAt: iso(-7, '17:20'),
  },
  {
    _id: 'signup_105',
    postId: 'post_101',
    userId: 'user_011',
    status: 'confirmed',
    createdAt: iso(-9, '08:15'),
  },

  // post_104 — food bank packing, all five present.
  {
    _id: 'signup_106',
    postId: 'post_104',
    userId: 'user_005',
    status: 'confirmed',
    createdAt: iso(-20, '11:00'),
    checkedInAt: iso(-14, '09:55'),
  },
  {
    _id: 'signup_107',
    postId: 'post_104',
    userId: 'user_015',
    status: 'confirmed',
    createdAt: iso(-19, '16:20'),
    checkedInAt: iso(-14, '10:02'),
  },
  {
    _id: 'signup_108',
    postId: 'post_104',
    userId: 'user_020',
    status: 'confirmed',
    createdAt: iso(-19, '20:10'),
    checkedInAt: iso(-14, '10:00'),
  },
  {
    _id: 'signup_109',
    postId: 'post_104',
    userId: 'user_007',
    status: 'confirmed',
    createdAt: iso(-18, '07:45'),
    checkedInAt: iso(-14, '10:08'),
  },
  {
    _id: 'signup_110',
    postId: 'post_104',
    userId: 'user_013',
    status: 'confirmed',
    createdAt: iso(-17, '13:00'),
    checkedInAt: iso(-14, '10:15'),
  },

  // post_103 — Eid breakfast. Ten said yes, seven came: a turnout gap that is
  // normal for an open event and worth seeing on the outcomes list.
  {
    _id: 'signup_111',
    postId: 'post_103',
    userId: 'user_006',
    status: 'confirmed',
    createdAt: iso(-40, '12:00'),
    checkedInAt: iso(-34, '08:10'),
  },
  {
    _id: 'signup_112',
    postId: 'post_103',
    userId: 'user_010',
    status: 'confirmed',
    createdAt: iso(-40, '18:30'),
    checkedInAt: iso(-34, '08:15'),
  },
  {
    _id: 'signup_113',
    postId: 'post_103',
    userId: 'user_014',
    status: 'confirmed',
    createdAt: iso(-39, '09:00'),
    checkedInAt: iso(-34, '08:22'),
  },
  {
    _id: 'signup_114',
    postId: 'post_103',
    userId: 'user_016',
    status: 'confirmed',
    createdAt: iso(-39, '20:45'),
    checkedInAt: iso(-34, '08:30'),
  },
  {
    _id: 'signup_115',
    postId: 'post_103',
    userId: 'user_018',
    status: 'confirmed',
    createdAt: iso(-38, '11:15'),
    checkedInAt: iso(-34, '08:40'),
  },
  {
    _id: 'signup_116',
    postId: 'post_103',
    userId: 'user_020',
    status: 'confirmed',
    createdAt: iso(-38, '15:00'),
    checkedInAt: iso(-34, '08:05'),
  },
  {
    _id: 'signup_117',
    postId: 'post_103',
    userId: 'user_004',
    status: 'confirmed',
    createdAt: iso(-37, '10:30'),
    checkedInAt: iso(-34, '08:55'),
  },
  {
    _id: 'signup_118',
    postId: 'post_103',
    userId: 'user_011',
    status: 'confirmed',
    createdAt: iso(-37, '19:20'),
  },
  {
    _id: 'signup_119',
    postId: 'post_103',
    userId: 'user_013',
    status: 'confirmed',
    createdAt: iso(-36, '08:40'),
  },
  {
    _id: 'signup_120',
    postId: 'post_103',
    userId: 'user_008',
    status: 'confirmed',
    createdAt: iso(-36, '21:00'),
  },

  // post_105 — Tajweed class, six enrolled, five attended the session.
  {
    _id: 'signup_121',
    postId: 'post_105',
    userId: 'user_008',
    status: 'confirmed',
    createdAt: iso(-28, '10:00'),
    checkedInAt: iso(-10, '18:25'),
  },
  {
    _id: 'signup_122',
    postId: 'post_105',
    userId: 'user_016',
    status: 'confirmed',
    createdAt: iso(-27, '14:20'),
    checkedInAt: iso(-10, '18:28'),
  },
  {
    _id: 'signup_123',
    postId: 'post_105',
    userId: 'user_004',
    status: 'confirmed',
    createdAt: iso(-26, '09:10'),
    checkedInAt: iso(-10, '18:32'),
  },
  {
    _id: 'signup_124',
    postId: 'post_105',
    userId: 'user_013',
    status: 'confirmed',
    createdAt: iso(-25, '17:45'),
    checkedInAt: iso(-10, '18:35'),
  },
  {
    _id: 'signup_125',
    postId: 'post_105',
    userId: 'user_018',
    status: 'confirmed',
    createdAt: iso(-24, '20:00'),
    checkedInAt: iso(-10, '18:40'),
  },
  {
    _id: 'signup_126',
    postId: 'post_105',
    userId: 'user_007',
    status: 'confirmed',
    createdAt: iso(-23, '12:30'),
  },

  // post_now — the shift in progress. Four of six claimed, matching
  // `slotsFilled`. One person is already in; the signed-in user is not, which
  // is the state the check-in demo starts from.
  {
    _id: 'signup_now_1',
    postId: 'post_now',
    userId: CURRENT_USER_ID,
    status: 'confirmed',
    createdAt: fromNow(-2400),
  },
  {
    _id: 'signup_now_2',
    postId: 'post_now',
    userId: 'user_005',
    status: 'confirmed',
    createdAt: fromNow(-2600),
    checkedInAt: fromNow(-35),
  },
  {
    _id: 'signup_now_3',
    postId: 'post_now',
    userId: 'user_010',
    status: 'confirmed',
    createdAt: fromNow(-1500),
  },
  {
    _id: 'signup_now_4',
    postId: 'post_now',
    userId: 'user_014',
    status: 'confirmed',
    createdAt: fromNow(-600),
  },
];

// ------------------------------------------------------------------ likes ---

/**
 * Who liked what.
 *
 * Written as a rule rather than three hundred literal rows: every seeded
 * volunteer likes a post when `(userIndex * 7 + postIndex * 3) % 11` clears a
 * threshold that varies by post type. The point is only that the counts differ
 * plausibly across the feed - a poster-led event picks up more hearts than a
 * parking rota - while staying identical on every machine that seeds, so a
 * screenshot taken on one laptop matches the app on another.
 *
 * The seed derives each post's `likeCount` from these rows, so the number on a
 * card and the rows behind it can't disagree.
 */
function buildLikes(): Like[] {
  /** Roughly what share of the congregation hearts each kind of post. */
  const appetite: Record<Post['type'], number> = {
    event: 8,
    class: 6,
    announcement: 4,
    volunteer: 3,
  };

  const likes: Like[] = [];
  const posts = [...mockPosts, ...mockPastPosts];

  posts.forEach((post, postIndex) => {
    mockUsers.forEach((user, userIndex) => {
      if ((userIndex * 7 + postIndex * 3) % 11 >= appetite[post.type]) return;
      likes.push({
        _id: `like_${post._id}_${user._id}`,
        userId: user._id,
        postId: post._id,
        // Somewhere between the post going up and now, deterministically.
        createdAt: iso(-((userIndex + postIndex) % 9), '13:00'),
      });
    });
  });

  return likes;
}

export const mockLikes: Like[] = buildLikes();

/** The likes on one post — what the seed writes into `Post.likeCount`. */
export function likeCountFor(postId: ID): number {
  return mockLikes.filter((like) => like.postId === postId).length;
}

// -------------------------------------------------------- iqamah & jummah ---

/**
 * Wall-clock strings only. Never store these as UTC — the mosque prays at 20:30
 * by the clock on its wall, whatever the offset is that month.
 */
export const mockIqamah: Iqamah[] = [
  {
    mosqueId: KHADIJA_ID,
    prayer: 'fajr',
    mode: 'fixed',
    fixedTime: '05:45',
    effectiveFrom: '2026-09-01',
  },
  {
    mosqueId: KHADIJA_ID,
    prayer: 'dhuhr',
    mode: 'fixed',
    fixedTime: '13:30',
    effectiveFrom: '2026-09-01',
  },
  {
    mosqueId: KHADIJA_ID,
    prayer: 'asr',
    mode: 'offset',
    offsetMinutes: 15,
    effectiveFrom: '2026-09-01',
  },
  {
    mosqueId: KHADIJA_ID,
    prayer: 'maghrib',
    mode: 'offset',
    offsetMinutes: 5,
    effectiveFrom: '2026-09-01',
  },
  {
    mosqueId: KHADIJA_ID,
    prayer: 'isha',
    mode: 'fixed',
    fixedTime: '21:30',
    effectiveFrom: '2026-09-01',
  },

  {
    mosqueId: MADINA_ID,
    prayer: 'fajr',
    mode: 'offset',
    offsetMinutes: 20,
    effectiveFrom: '2026-09-01',
  },
  {
    mosqueId: MADINA_ID,
    prayer: 'dhuhr',
    mode: 'fixed',
    fixedTime: '13:15',
    effectiveFrom: '2026-09-01',
  },
  {
    mosqueId: MADINA_ID,
    prayer: 'asr',
    mode: 'offset',
    offsetMinutes: 10,
    effectiveFrom: '2026-09-01',
  },
  {
    mosqueId: MADINA_ID,
    prayer: 'maghrib',
    mode: 'offset',
    offsetMinutes: 5,
    effectiveFrom: '2026-09-01',
  },
  {
    mosqueId: MADINA_ID,
    prayer: 'isha',
    mode: 'fixed',
    fixedTime: '21:15',
    effectiveFrom: '2026-09-08',
  },
  ...(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).flatMap((prayer) =>
    [RAWDAH_ID, LAVAL_ID, OTTAWA_ID, TORONTO_ID].map((mosqueId) => ({
      mosqueId,
      prayer,
      mode: 'offset' as const,
      offsetMinutes: prayer === 'maghrib' ? 5 : prayer === 'fajr' ? 20 : 15,
      effectiveFrom: '2026-09-01',
    })),
  ),
];

export const mockJummah: JummahSession[] = [
  { mosqueId: KHADIJA_ID, label: 'First jummah', khutbahTime: '13:00', iqamahTime: '13:20' },
  { mosqueId: KHADIJA_ID, label: 'Second jummah', khutbahTime: '14:15', iqamahTime: '14:35' },
  { mosqueId: MADINA_ID, label: 'Jummah', khutbahTime: '13:15', iqamahTime: '13:35' },
];

export const defaultNotificationPrefs: NotificationPrefs = {
  volunteerRequests: true,
  events: true,
  classes: true,
  announcements: true,
  prayerReminders: false,
};
