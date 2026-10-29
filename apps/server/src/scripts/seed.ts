/**
 * `npm run seed --workspace @m-ensemble/server`
 *
 * Writes the shared fixtures into the database as **upserts**: the demo content
 * is refreshed, and anything the fixtures don't name - an account someone
 * signed up with, a shift they claimed, a post a coordinator wrote - is left
 * alone. Safe to run against a live database, and safe to run twice.
 *
 * Fixture dates hang off the moment the module is imported, so run this on the
 * morning of the demo, and again if the laptop slept overnight.
 *
 *   npm run seed:reset
 *
 * is the destructive one: it empties all eight collections first, so every real
 * account is deleted along with the demo data. It exists for a clean rebuild
 * and asks before doing it.
 */

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env, isProduction } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { clearAll, seedAll, syncAllIndexes } from './seedData.js';
import { UserModel } from '../models/index.js';
import { mockUsers } from '../shared.js';

const reset = process.argv.includes('--reset');
/** Skips the confirmation, for CI or a scripted rebuild. */
const force = process.argv.includes('--yes') || process.argv.includes('-y');

/** Accounts in the database that the fixtures did not create. */
async function countRealAccounts(): Promise<number> {
  const seeded = mockUsers.map((u) => u._id);
  return UserModel.countDocuments({ _id: { $nin: seeded } });
}

/** A yes/no on stdin. Returns false when there is no TTY to ask on. */
async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  process.stdout.write(question);
  return new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      resolve(String(data).trim().toLowerCase() === 'yes');
    });
  });
}

async function main(): Promise<void> {
  // The fixtures are demo content with published passwords. Writing them into
  // a production database is almost always a mistyped environment, so it takes
  // an explicit opt-in — and `--reset` there deletes every real account.
  if (isProduction && !env.ALLOW_SEED_IN_PRODUCTION) {
    logger.error(
      '[seed] refusing to run with NODE_ENV=production. The fixtures are demo accounts with known passwords. ' +
        'If you really mean to seed this database, set ALLOW_SEED_IN_PRODUCTION=true for this one run.',
    );
    process.exit(1);
  }

  await connectDatabase();
  logger.info(`[seed] writing to "${mongoose.connection.name}"`);

  await syncAllIndexes();

  if (reset) {
    const real = await countRealAccounts();
    logger.info(`[seed] --reset will DELETE everything, including ${real} real account(s).`);

    if (!force && !(await confirm('[seed] type "yes" to continue: '))) {
      logger.info('[seed] cancelled, nothing was deleted.');
      await disconnectDatabase();
      return;
    }
    await clearAll();
    logger.info('[seed] collections emptied');
  }

  const counts = await seedAll();

  for (const [collection, rows] of Object.entries(counts)) {
    logger.info(`[seed] ${collection.padEnd(15)} ${rows}`);
  }

  // The console's own login. Printed rather than assumed, because the email is
  // configurable and the first thing anyone does after seeding is try to sign
  // in to the dashboard.
  logger.info(`[seed] ${'super admin'.padEnd(15)} ${env.SUPERADMIN_EMAIL}`);

  if (!reset) {
    const real = await countRealAccounts();
    if (real > 0) logger.info(`[seed] kept ${real} account(s) created outside the fixtures`);
  }

  await disconnectDatabase();
  logger.info('[seed] done');
}

main().catch(async (err) => {
  logger.error({ err }, '[seed] failed');
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
