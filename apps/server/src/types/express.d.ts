import type { UserDocument } from '../models/User.js';
import type { PostDocument } from '../models/Post.js';

/**
 * `requireAuth` sets `user` on every request below `/api` except `/health` and
 * `/auth/*`. `requireAdmin(fromPost)` additionally stashes the post it had to
 * load, so the controller behind it doesn't fetch the same row twice.
 *
 * Both are declared optional: the type says "after the middleware ran", and the
 * few handlers that mount before it would otherwise lie.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDocument;
      post?: PostDocument;
      mosqueId?: string;
    }
  }
}

export {};
