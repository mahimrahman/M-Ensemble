import type { NextFunction, Request, Response } from 'express';
import { UserModel } from '../models/User.js';

export async function listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await UserModel.find().sort({ createdAt: -1 }).limit(50);
    res.json({ ok: true, data: { items: users, page: 1, pageSize: 50, total: users.length } });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserModel.create(req.body);
    res.status(201).json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
}
