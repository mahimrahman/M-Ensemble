import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { meRouter } from './me.routes.js';
import { usersRouter } from './users.routes.js';
import { mosqueRouter } from './mosque.routes.js';
import { postRouter } from './post.routes.js';
import { feedRouter } from './feed.routes.js';
import { uploadRouter } from './upload.routes.js';
import { adsRouter } from './ads.routes.js';
import { adminRouter } from './admin.routes.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const apiRouter = Router();

// Open: liveness, and the two ways to get a token.
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

// Everything below is gated. The app is fully behind login — there is no
// anonymous read path, so this is one line rather than forty.
apiRouter.use(requireAuth);

apiRouter.use('/me', meRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/mosques', mosqueRouter);
apiRouter.use('/posts', postRouter);
apiRouter.use('/feed', feedRouter);

// Partner ads, for the app: ask for a slot, report that it was seen or tapped.
apiRouter.use('/ads', adsRouter);

// Multipart, not JSON — the one endpoint that takes a file.
apiRouter.use('/uploads', uploadRouter);

/**
 * The super admin console. Behind `requireAuth` like everything else, and then
 * behind a platform role of its own — the router applies `requirePlatform` to
 * every route and `requireSuperAdmin` to every write.
 *
 * A mosque coordinator reaching any of this gets a 403: `Membership.role` and
 * `User.platformRole` are different things, and holding the first at six
 * mosques still grants none of the second.
 */
apiRouter.use('/admin', adminRouter);
