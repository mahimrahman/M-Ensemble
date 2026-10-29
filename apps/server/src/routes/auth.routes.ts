import { Router } from 'express';
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail,
} from '../controllers/auth.controller.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from '../schemas/auth.schema.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Mounted above the router-wide `requireAuth`, so every route here is open
 * unless it says otherwise. The three that act on a signed-in session apply
 * `requireAuth` themselves.
 */
export const authRouter = Router();

authRouter.post('/signup', authLimiter, validate(signupSchema), asyncHandler(signup));
authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(login));

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(forgotPassword),
);
authRouter.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(resetPassword),
);
authRouter.post('/verify-email', authLimiter, validate(verifyEmailSchema), asyncHandler(verifyEmail));

authRouter.post('/resend-verification', requireAuth, asyncHandler(resendVerification));
authRouter.post('/logout', requireAuth, asyncHandler(logout));
authRouter.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(changePassword),
);
