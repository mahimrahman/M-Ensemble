import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { clearAll, seedAll, syncAllIndexes } from '../src/scripts/seedData.js';

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: 'mensemble_test' });

  // Third guard against writing to the real cluster: the vitest env overrides
  // MONGODB_URI, `createApp()` never calls `connectDatabase()`, and this
  // asserts what we actually connected to.
  const { host } = mongoose.connection;
  if (!/^(127\.0\.0\.1|localhost)$/.test(host ?? '')) {
    throw new Error(`Tests must run against a local mongod, got "${host}"`);
  }

  // The unique {postId, userId} index is the second guard on the slot race, so
  // it has to exist before the race test means anything.
  await syncAllIndexes();
});

beforeEach(async () => {
  // Wipe first. `seedAll` deliberately no longer does this — it upserts, so
  // that re-seeding a live database can never delete a real account — but a
  // test needs a clean slate, or rows the previous test created (a signup, a
  // check-in) leak into the next one and it passes or fails for the wrong
  // reason.
  await clearAll();

  // Cost 4, not 10. Twenty bcrypt hashes at cost 10 before every test is
  // minutes of wall clock; nothing here is checking bcrypt's work factor.
  await seedAll({ bcryptRounds: 4 });
});

afterAll(async () => {
  await mongoose.disconnect();
});
