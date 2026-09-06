/** Transport envelope + the client interface. Locked in PHASE 0. */

import type {
  AppNotification,
  AuthResult,
  CreatePostInput,
  DateString,
  EventOutcome,
  ID,
  Iqamah,
  JummahSession,
  Membership,
  MemberRole,
  Mosque,
  MosqueDashboard,
  MosqueMember,
  NotificationPrefs,
  Post,
  PostType,
  PrayerTable,
  ReliabilityIncident,
  ReliabilityRecord,
  RosterEntry,
  Signup,
  SignupInput,
  User,
} from './types';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Error codes the UI branches on. Anything else is an unexpected failure. */
export const API_ERROR = {
  BAD_CREDENTIALS: 'BAD_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  NOT_FOUND: 'NOT_FOUND',
  FULL: 'FULL',
  ALREADY_SIGNED_UP: 'ALREADY_SIGNED_UP',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export type ApiErrorCode = (typeof API_ERROR)[keyof typeof API_ERROR];

export interface FeedFilter {
  /** Empty/undefined means every type. */
  types?: PostType[];
  mosqueIds?: ID[];
}

export interface ServiceHours {
  totalMinutes: number;
  shiftsCompleted: number;
}

/** What one member is allowed to see about another. */
export type PublicUser = Pick<User, '_id' | 'name'>;

/** Type and mosque are fixed at creation; everything else an admin can change. */
export type UpdatePostInput = Partial<Omit<CreatePostInput, 'mosqueId' | 'type' | 'imageUrl'>> & {
  /**
   * Three states, not two. Omitting it leaves the poster alone, a path
   * replaces it, and `null` takes it off — which a `string | undefined`
   * cannot express, because "no value" is already what an untouched field
   * sends on a patch.
   */
  imageUrl?: string | null;
};

/**
 * One image on its way up, in the shape each platform hands it to us: a
 * `file://` URI from the native picker, a `blob:` one in the browser. The
 * transport turns this into the multipart part; nothing above it should know
 * that a multipart request is involved.
 */
export interface PosterUpload {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * What the server stored. `url` is **server-relative** (`/uploads/<id>.jpg`)
 * so it stays correct from every address this API is reached at; resolve it
 * against the base URL the client is already using before rendering it.
 */
export interface UploadedPoster {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export interface MosqueIqamahConfig {
  iqamah: Iqamah[];
  jummah: JummahSession[];
}

/** Whole-config replace. The mosque id comes from the route. */
export interface IqamahConfigInput {
  iqamah: Omit<Iqamah, 'mosqueId'>[];
  jummah: Omit<JummahSession, 'mosqueId'>[];
}

export interface RosterFilter {
  /** Only posts that haven't ended yet. */
  upcoming?: boolean;
  types?: PostType[];
  /** Only entries for this post. */
  postId?: ID;
}

/** One member plus everything they've signed up for here. */
export interface MemberDetail {
  member: MosqueMember;
  history: RosterEntry[];
  /** What went on their record here, newest first. */
  incidents: ReliabilityIncident[];
}

/** What withdrawing actually did, so the screen can be honest about it. */
export interface WithdrawResult {
  /** True when it landed inside the late window and went on the record. */
  lateCancelled: boolean;
  /** Hours remaining when the withdrawal was written, for the message. */
  hoursBefore: number;
}

/**
 * The parts of its own profile a mosque may edit. Name, address, coordinates
 * and join code are not here on purpose — those are identity, and changing
 * them from the app would let one mosque impersonate another.
 */
export type UpdateMosqueInput = Partial<
  Pick<Mosque, 'bio' | 'history' | 'website' | 'phone' | 'services' | 'social'>
>;

/**
 * The inbox, as one round trip.
 *
 * `unread` is counted over everything the user has rather than over the page
 * returned, so the bell's badge stays right once the list outgrows one page.
 */
export interface NotificationFeed {
  items: AppNotification[];
  unread: number;
}

/** What a coordinator writes when they message their followers. */
export interface BroadcastInput {
  title: string;
  body: string;
}

/**
 * What the send actually did.
 *
 * Two numbers, because they answer different questions: `recipients` is how
 * many inboxes it landed in, `pushed` how many devices it reached. The second
 * is always the smaller — a follower with no push token still gets the inbox
 * line — and telling the coordinator only the first would claim forty phones
 * buzzed when twelve did.
 */
export interface BroadcastResult {
  recipients: number;
  pushed: number;
}

/** What a like or unlike settled on. */
export interface LikeResult {
  postId: ID;
  likeCount: number;
  /** Where the heart ends up — true after a like, false after an unlike. */
  liked: boolean;
}

/**
 * The single surface every screen talks to.
 *
 * PHASE 1–3 this is fulfilled by the mock client; PHASE 5 by the HTTP client.
 * The signatures do not change between them — that is the whole point.
 */
export interface MEnsembleApi {
  login(email: string, password: string): Promise<AuthResult>;
  signupAccount(input: SignupInput): Promise<AuthResult>;
  me(): Promise<User>;
  updateMe(patch: Partial<Pick<User, 'name' | 'interests' | 'pushToken'>>): Promise<User>;
  /** Names for a list of ids — what a signup list renders. Never exposes email. */
  getUsers(ids: ID[]): Promise<PublicUser[]>;

  getMosques(): Promise<Mosque[]>;
  getMosque(id: ID): Promise<Mosque>;
  getFollowedMosques(): Promise<Mosque[]>;
  followMosque(mosqueId: ID): Promise<void>;
  unfollowMosque(mosqueId: ID): Promise<void>;

  getFeed(filter?: FeedFilter): Promise<Post[]>;
  getPost(id: ID): Promise<Post>;
  getMosquePosts(mosqueId: ID): Promise<Post[]>;
  createPost(input: CreatePostInput): Promise<Post>;

  /**
   * Uploads one poster and returns where it landed, without attaching it to
   * anything. Admin of `mosqueId` only.
   *
   * Separate from `createPost` so the slow part happens while the form is
   * still being filled in, and so editing a post's poster doesn't mean
   * resending every other field. The cost is that an upload nobody goes on to
   * publish leaves an orphan file on the server.
   */
  uploadPoster(mosqueId: ID, file: PosterUpload): Promise<UploadedPoster>;

  // --- admin (requireAdmin(mosqueId) on the server) ---
  /** Every mosque this user holds a role at. Empty for a plain member. */
  getMyMemberships(): Promise<Membership[]>;
  /** Unlike `getMosquePosts`, includes past and cancelled posts. */
  getMosquePostsForAdmin(mosqueId: ID): Promise<Post[]>;
  updatePost(id: ID, patch: UpdatePostInput): Promise<Post>;
  cancelPost(id: ID): Promise<Post>;
  /** Edit the mosque profile — bio, history, contact, services. Admin only. */
  updateMosque(mosqueId: ID, patch: UpdateMosqueInput): Promise<Mosque>;
  getIqamahConfig(mosqueId: ID): Promise<MosqueIqamahConfig>;
  setIqamahConfig(mosqueId: ID, input: IqamahConfigInput): Promise<MosqueIqamahConfig>;

  /** Every number on the coordinator's home, in one round trip. */
  getMosqueDashboard(mosqueId: ID): Promise<MosqueDashboard>;
  /**
   * Everyone who signed up for anything at this mosque, flattened.
   * `filter.upcoming` keeps only posts that haven't ended — the list you work
   * from on the day. Sorted soonest-first.
   */
  getMosqueRoster(mosqueId: ID, filter?: RosterFilter): Promise<RosterEntry[]>;
  /** The mosque's people: followers and role-holders, with their track record. */
  getMosqueMembers(mosqueId: ID): Promise<MosqueMember[]>;
  /** One person's full history at this mosque. */
  getMemberDetail(mosqueId: ID, userId: ID): Promise<MemberDetail>;
  /** Promote to coordinator or demote to member. Never removes the follow. */
  setMemberRole(mosqueId: ID, userId: ID, role: MemberRole): Promise<MosqueMember>;
  /** Posts that have already ended, newest first — how turnout actually went. */
  getEventOutcomes(mosqueId: ID): Promise<EventOutcome[]>;

  /**
   * Like / unlike, and the ids of everything you've liked.
   *
   * Both writes are idempotent and resolve to the post's new count, so the
   * card can settle on the server's number instead of trusting its own
   * optimistic arithmetic. `getMyLikes` is one round trip on launch — the
   * hearts have to be filled in before the first card renders, and asking per
   * post would be one request per row.
   */
  likePost(postId: ID): Promise<LikeResult>;
  unlikePost(postId: ID): Promise<LikeResult>;
  getMyLikes(): Promise<ID[]>;

  signup(postId: ID): Promise<Signup>;
  /**
   * Give the slot back. Resolves to whether it counted as a late cancellation
   * so the screen can say what went on the record — the server decides that,
   * never the client, and it re-checks the clock at the moment of the write.
   */
  withdraw(postId: ID): Promise<WithdrawResult>;
  getSignups(postId: ID): Promise<Signup[]>;
  checkIn(postId: ID, userId: ID): Promise<void>;

  getCommitments(): Promise<Signup[]>;
  getServiceHours(): Promise<ServiceHours>;
  /** The signed-in volunteer's own reliability record, across every mosque. */
  getMyReliability(): Promise<ReliabilityRecord>;

  getPrayerTimes(mosqueId: ID, date: DateString): Promise<PrayerTable>;

  getNotificationPrefs(): Promise<NotificationPrefs>;
  updateNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>;

  /** The signed-in user's inbox, newest first, with the unread count. */
  getNotifications(): Promise<NotificationFeed>;
  /** Marks everything unread as read. Resolves to the feed as it now stands. */
  markNotificationsRead(): Promise<NotificationFeed>;
  /** Admin only — write to everyone who follows this mosque. */
  broadcast(mosqueId: ID, input: BroadcastInput): Promise<BroadcastResult>;

  registerPushToken(token: string): Promise<void>;
}
