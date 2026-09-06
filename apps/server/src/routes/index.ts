import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { meRouter } from './me.routes.js';
import { usersRouter } from './users.routes.js';
import { mosqueRouter } from './mosque.routes.js';
import { postRouter } from './post.routes.js';
import { feedRouter } from './feed.routes.js';
import { uploadRouter } from './upload.routes.js';
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

// Multipart, not JSON — the one endpoint that takes a file.
apiRouter.use('/uploads', uploadRouter);
