/**
 * `npm run seed --workspace @m-ensemble/server`
 *
 * Wipes the eight collections and rewrites them from the shared fixtures.
 * Fixture dates hang off the moment the module is imported, so run this on the
 * morning of the demo — and again if the laptop slept overnight.
 */

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedAll, syncAllIndexes } from './seedData.js';

async function main(): Promise<void> {
  await connectDatabase();
  console.log(`[seed] writing to "${mongoose.connection.name}"`);

  await syncAllIndexes();
  const counts = await seedAll();

  for (const [collection, rows] of Object.entries(counts)) {
    console.log(`[seed] ${collection.padEnd(15)} ${rows}`);
  }

  await disconnectDatabase();
  console.log('[seed] done');
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
