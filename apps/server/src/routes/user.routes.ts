import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { createUser, listUsers } from '../controllers/user.controller.js';

export const userRouter = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
});

userRouter.get('/', listUsers);
userRouter.post('/', validate(createUserSchema), createUser);
