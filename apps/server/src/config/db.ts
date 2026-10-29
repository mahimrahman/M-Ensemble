import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  logger.info({ db: mongoose.connection.name }, '[db] connected');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
