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
  await connectDatabase();
  console.log(`[seed] writing to "${mongoose.connection.name}"`);

  await syncAllIndexes();

  if (reset) {
    const real = await countRealAccounts();
    console.log(`[seed] --reset will DELETE everything, including ${real} real account(s).`);

    if (!force && !(await confirm('[seed] type "yes" to continue: '))) {
      console.log('[seed] cancelled, nothing was deleted.');
      await disconnectDatabase();
      return;
    }
    await clearAll();
    console.log('[seed] collections emptied');
  }

  const counts = await seedAll();

  for (const [collection, rows] of Object.entries(counts)) {
    console.log(`[seed] ${collection.padEnd(15)} ${rows}`);
  }

  if (!reset) {
    const real = await countRealAccounts();
    if (real > 0) console.log(`[seed] kept ${real} account(s) created outside the fixtures`);
  }

  await disconnectDatabase();
  console.log('[seed] done');
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
