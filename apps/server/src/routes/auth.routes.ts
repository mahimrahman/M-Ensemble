import { Router } from 'express';
import { login, signup } from '../controllers/auth.controller.js';
import { loginSchema, signupSchema } from '../schemas/auth.schema.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** The only routes below `/api` that don't run `requireAuth`. */
export const authRouter = Router();

authRouter.post('/signup', validate(signupSchema), asyncHandler(signup));
authRouter.post('/login', validate(loginSchema), asyncHandler(login));
