import type { DateString, MosqueIqamahConfig, PrayerTable } from '@m-ensemble/shared';
import { IqamahConfigModel } from '../models/IqamahConfig.js';
import { JummahSessionModel } from '../models/JummahSession.js';
import { MosqueModel } from '../models/Mosque.js';
import { buildPrayerTable } from '../shared.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';

async function mosqueOr404(mosqueId: string) {
  const mosque = await MosqueModel.findById(mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'Mosque not found.');
  return mosque;
}

/**
 * The same table the app computes for itself, from the same function in
 * `@m-ensemble/shared` — that is the point of having moved it there.
 *
 * The month screen fires roughly 31 of these in parallel, so this stays at one
 * mosque lookup plus two indexed finds. Deliberately uncached: a cache would
 * have to be invalidated by `PUT /mosques/:id/iqamah`, and getting that wrong
 * means a coordinator changes iqamah and the screen doesn't move.
 */
export async function getPrayerTable(mosqueId: string, date: DateString): Promise<PrayerTable> {
  const mosque = await mosqueOr404(mosqueId);
  const [iqamah, jummah] = await Promise.all([
    IqamahConfigModel.find({ mosqueId }),
    JummahSessionModel.find({ mosqueId }),
  ]);

  return buildPrayerTable(
    mosque.toJSON(),
    date,
    iqamah.map((i) => i.toJSON()),
    jummah.map((j) => j.toJSON()),
  );
}

export async function getIqamahConfig(mosqueId: string): Promise<MosqueIqamahConfig> {
  await mosqueOr404(mosqueId);
  const [iqamah, jummah] = await Promise.all([
    IqamahConfigModel.find({ mosqueId }),
    JummahSessionModel.find({ mosqueId }),
  ]);

  return {
    iqamah: iqamah.map((i) => i.toJSON()),
    jummah: jummah.map((j) => j.toJSON()),
  };
}

/**
 * Whole replace: every row for the mosque goes, and the body becomes the new
 * config with `mosqueId` stamped on.
 *
 * This is not lossy. The iqamah editor keeps history itself — it re-sends every
 * row whose `effectiveFrom` predates the change alongside the five new ones —
 * so a partial merge here would double up rows instead of preserving them.
 */
export async function setIqamahConfig(
  mosqueId: string,
  input: MosqueIqamahConfig,
): Promise<MosqueIqamahConfig> {
  await mosqueOr404(mosqueId);

  await Promise.all([
    IqamahConfigModel.deleteMany({ mosqueId }),
    JummahSessionModel.deleteMany({ mosqueId }),
  ]);

  if (input.iqamah.length) {
    await IqamahConfigModel.insertMany(
      input.iqamah.map((row) => ({ ...row, _id: newId(), mosqueId })),
    );
  }
  if (input.jummah.length) {
    await JummahSessionModel.insertMany(
      input.jummah.map((row) => ({ ...row, _id: newId(), mosqueId })),
    );
  }

  return getIqamahConfig(mosqueId);
}
