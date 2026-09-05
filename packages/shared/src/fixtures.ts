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

import type {
  Follow,
  ID,
  Iqamah,
  JummahSession,
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

export const mockMosques: Mosque[] = [
  {
    _id: KHADIJA_ID,
    name: 'Mosquée Khadija',
    address: '3456 rue Jean-Talon Est',
    coordinates: { lat: 45.564, lng: -73.587 },
    joinCode: 'KHADIJA',
    prayerConfig: {
      calculationMethod: 'NorthAmerica',
      madhab: 'hanafi',
      highLatitudeRule: 'TwilightAngle',
    },
  },
  {
    _id: MADINA_ID,
    name: 'Mosquée Madina',
    address: '5890 boul. Saint-Laurent',
    coordinates: { lat: 45.524, lng: -73.61 },
    joinCode: 'MADINA',
    prayerConfig: {
      calculationMethod: 'NorthAmerica',
      madhab: 'shafi',
      highLatitudeRule: 'TwilightAngle',
    },
  },
  {
    _id: RAWDAH_ID,
    name: 'Mosquée Al-Rawdah',
    address: '1248 av. Décarie',
    coordinates: { lat: 45.485, lng: -73.65 },
    joinCode: 'RAWDAH',
    prayerConfig: {
      calculationMethod: 'NorthAmerica',
      madhab: 'shafi',
      highLatitudeRule: 'TwilightAngle',
    },
  },
  {
    _id: LAVAL_ID,
    name: 'Centre islamique de Laval',
    address: '3325 boul. Dagenais O.',
    coordinates: { lat: 45.567, lng: -73.72 },
    joinCode: 'LAVAL',
    prayerConfig: {
      calculationMethod: 'NorthAmerica',
      madhab: 'hanafi',
      highLatitudeRule: 'TwilightAngle',
    },
  },
  {
    _id: OTTAWA_ID,
    name: 'Ottawa Mosque',
    address: '251 Northwestern Ave, Ottawa',
    coordinates: { lat: 45.4038, lng: -75.7285 },
    joinCode: 'OTTAWA',
    prayerConfig: {
      calculationMethod: 'NorthAmerica',
      madhab: 'shafi',
      highLatitudeRule: 'TwilightAngle',
    },
  },
  {
    _id: TORONTO_ID,
    name: 'Masjid Toronto',
    address: '168 Dundas St W, Toronto',
    coordinates: { lat: 43.6559, lng: -79.386 },
    joinCode: 'TORONTO',
    prayerConfig: {
      calculationMethod: 'NorthAmerica',
      madhab: 'hanafi',
      highLatitudeRule: 'TwilightAngle',
    },
  },
];

// ----------------------------------------------------------------- people ---

/** The account the app is signed in as while we're on mocks. */
export const CURRENT_USER_ID: ID = 'user_001';

/** Khadija's coordinator — creator of the Khadija posts, owner of admin screens. */
export const KHADIJA_ADMIN_ID: ID = 'user_002';
export const MADINA_ADMIN_ID: ID = 'user_003';

export const mockUsers: User[] = [
  {
    _id: 'user_001',
    name: 'Yusuf Benali',
    email: 'yusuf@example.com',
    interests: ['Volunteering', 'Community meals', 'Youth'],
  },
  {
    _id: 'user_002',
    name: 'Amina Cherkaoui',
    email: 'amina@example.com',
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

/** Any mock account signs in with this. */
export const MOCK_PASSWORD = 'mensemble';

// -------------------------------------------------- follows & memberships ---

export const mockFollows: Follow[] = [
  {
    _id: 'follow_001',
    userId: CURRENT_USER_ID,
    mosqueId: KHADIJA_ID,
    createdAt: iso(-30, '09:00'),
  },
  { _id: 'follow_002', userId: CURRENT_USER_ID, mosqueId: MADINA_ID, createdAt: iso(-12, '19:40') },

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
    userId: CURRENT_USER_ID,
    mosqueId: KHADIJA_ID,
    role: 'member',
    createdAt: iso(-30, '09:00'),
  },
];

// ------------------------------------------------------------------ posts ---

export const mockPosts: Post[] = [
  {
    _id: 'post_ottawa_1',
    mosqueId: OTTAWA_ID,
    type: 'event',
    title: 'Community iftar — open to all',
    description:
      'A shared iftar in the main hall. Bring a dish if you can; everyone is welcome regardless.',
    category: 'Community meals',
    startAt: nextWeekday(5, '19:30'),
    endAt: nextWeekday(5, '21:30'),
    location: 'Main hall',
    capacity: 200,
    slotsFilled: 84,
    imageUrl:
      'https://images.unsplash.com/photo-1547119879-c379a507fd2a?w=800&h=420&fit=crop&auto=format',
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-2, '10:00'),
  },
  {
    _id: 'post_toronto_1',
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
  {
    _id: 'post_001',
    mosqueId: KHADIJA_ID,
    type: 'volunteer',
    title: 'Iftar setup — Saturday community dinner',
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
    _id: 'post_002',
    mosqueId: KHADIJA_ID,
    type: 'volunteer',
    title: 'Jummah parking marshals',
    description:
      'Two entrances, two exits. Keep the lane by the fire door clear and help the elders find a spot near the ramp. Vests provided.',
    category: 'Facilities',
    startAt: nextWeekday(5, '12:00'),
    endAt: nextWeekday(5, '14:00'),
    location: 'Saint-Urbain parking lot',
    slotsNeeded: 6,
    slotsFilled: 2,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-3, '11:05'),
  },
  {
    _id: 'post_003',
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
    _id: 'post_004',
    mosqueId: KHADIJA_ID,
    type: 'event',
    title: 'Neighbourhood BBQ',
    description:
      'Open to the whole street, not just the community. Halal grill, a bouncy castle for the kids, and a table for questions about the mosque.',
    category: 'Outreach',
    startAt: nextWeekday(0, '13:00'),
    endAt: nextWeekday(0, '17:00'),
    location: 'Courtyard',
    capacity: 150,
    slotsFilled: 68,
    imageUrl:
      'https://images.unsplash.com/photo-1573939705721-9fa2cdcda901?w=800&h=420&fit=crop&auto=format',
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-8, '18:00'),
  },
  {
    _id: 'post_005',
    mosqueId: KHADIJA_ID,
    type: 'class',
    title: 'Tajweed for beginners',
    description:
      'Six weekly sessions with Ustadh Anas, starting from the makharij. No prior study needed. Bring your own mushaf.',
    category: 'Education',
    startAt: nextWeekday(2, '19:00'),
    endAt: nextWeekday(2, '20:30'),
    location: 'Classroom B',
    capacity: 25,
    slotsFilled: 17,
    sessions: [
      { startAt: nextWeekday(2, '19:00', 0), endAt: nextWeekday(2, '20:30', 0) },
      { startAt: nextWeekday(2, '19:00', 1), endAt: nextWeekday(2, '20:30', 1) },
      { startAt: nextWeekday(2, '19:00', 2), endAt: nextWeekday(2, '20:30', 2) },
      { startAt: nextWeekday(2, '19:00', 3), endAt: nextWeekday(2, '20:30', 3) },
      { startAt: nextWeekday(2, '19:00', 4), endAt: nextWeekday(2, '20:30', 4) },
      { startAt: nextWeekday(2, '19:00', 5), endAt: nextWeekday(2, '20:30', 5) },
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1712249239061-7d4f49ec9d44?w=800&h=420&fit=crop&auto=format',
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-14, '09:30'),
  },
  {
    _id: 'post_006',
    mosqueId: KHADIJA_ID,
    type: 'announcement',
    title: 'Roof repair fund — 62% of the way there',
    description:
      'Jazakum Allahu khayran. We have $41,300 of the $67,000 needed. The contractor holds our September slot until the end of the month.',
    category: 'Fundraising',
    startAt: iso(-2, '10:00'),
    endAt: iso(28, '23:59'),
    location: 'Centre Islamique Khadija',
    slotsFilled: 0,
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-2, '10:00'),
  },
  {
    _id: 'post_007',
    mosqueId: KHADIJA_ID,
    type: 'class',
    title: 'Sunday youth halaqa',
    description:
      'Ages 12–17. Seerah this term, then a games hour in the gym. Parents are welcome to sit in on the first session.',
    category: 'Youth',
    startAt: nextWeekday(0, '11:00'),
    endAt: nextWeekday(0, '12:30'),
    location: 'Classroom A',
    capacity: 30,
    slotsFilled: 22,
    sessions: [
      { startAt: nextWeekday(0, '11:00', 0), endAt: nextWeekday(0, '12:30', 0) },
      { startAt: nextWeekday(0, '11:00', 1), endAt: nextWeekday(0, '12:30', 1) },
      { startAt: nextWeekday(0, '11:00', 2), endAt: nextWeekday(0, '12:30', 2) },
      { startAt: nextWeekday(0, '11:00', 3), endAt: nextWeekday(0, '12:30', 3) },
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1547119879-c379a507fd2a?w=800&h=420&fit=crop&auto=format',
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-10, '14:45'),
  },
  {
    _id: 'post_008',
    mosqueId: KHADIJA_ID,
    type: 'event',
    title: 'Sisters brunch and halaqa',
    description:
      'Potluck brunch followed by a short talk on the fiqh of everyday transactions. Childcare available in the back room.',
    category: 'Sisters',
    startAt: nextWeekday(6, '10:00'),
    endAt: nextWeekday(6, '12:30'),
    location: 'Sisters hall, second floor',
    capacity: 60,
    slotsFilled: 34,
    imageUrl:
      'https://images.unsplash.com/photo-1600096194534-95cf5ece04cf?w=800&h=420&fit=crop&auto=format',
    createdBy: KHADIJA_ADMIN_ID,
    createdAt: iso(-6, '21:10'),
  },
  {
    _id: 'post_009',
    mosqueId: MADINA_ID,
    type: 'volunteer',
    title: 'Food bank packing night',
    description:
      'We pack 200 boxes for the Décarie food bank. Standing work for two hours; bring gloves if you have them.',
    category: 'Outreach',
    startAt: iso(2, '18:30'),
    endAt: iso(2, '20:30'),
    location: 'Madina community room',
    slotsNeeded: 8,
    slotsFilled: 5,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-4, '16:20'),
  },
  {
    _id: 'post_010',
    mosqueId: MADINA_ID,
    type: 'volunteer',
    title: 'New carpet installation — lifting help',
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
    _id: 'post_011',
    mosqueId: MADINA_ID,
    type: 'announcement',
    title: 'Isha iqamah moves to 21:15 from Monday',
    description:
      'With the nights drawing in we are moving Isha iqamah fifteen minutes earlier. The prayer table in the app updates on its own.',
    category: 'Prayer times',
    startAt: iso(-1, '19:00'),
    endAt: iso(14, '23:59'),
    location: 'Masjid Madina',
    slotsFilled: 0,
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-1, '19:00'),
  },
  {
    _id: 'post_012',
    mosqueId: MADINA_ID,
    type: 'event',
    title: 'Open house — meet your neighbours',
    description:
      'Guided tour of the masjid, tea, and a short talk. Bring a neighbour who has never been inside a mosque.',
    category: 'Outreach',
    startAt: iso(9, '14:00'),
    endAt: iso(9, '18:00'),
    location: 'Masjid Madina, main entrance',
    capacity: 200,
    slotsFilled: 41,
    imageUrl:
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&h=420&fit=crop&auto=format',
    createdBy: MADINA_ADMIN_ID,
    createdAt: iso(-7, '12:00'),
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
];

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
