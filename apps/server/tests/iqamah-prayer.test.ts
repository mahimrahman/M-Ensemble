import { describe, expect, it } from 'vitest';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

interface Row {
  prayer: string;
  adhan: string;
  iqamah: string | null;
}

async function table(token: string, mosqueId: string, date: string): Promise<Row[]> {
  const res = await api
    .get(`/api/mosques/${mosqueId}/prayer-times?date=${date}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return res.body.data.rows;
}

describe('prayer times', () => {
  it('resolves fixed and offset iqamah against that day\'s adhan', async () => {
    const rows = await table(await tokenFor(YUSUF), 'mosque_khadija', '2026-09-06');

    const fajr = rows.find((r) => r.prayer === 'fajr');
    expect(fajr?.iqamah).toBe('05:45'); // fixed

    // asr is offset +15 in the fixtures.
    const asr = rows.find((r) => r.prayer === 'asr');
    const [h, m] = (asr?.adhan ?? '').split(':').map(Number);
    const expected = new Date(0);
    expected.setUTCHours(h ?? 0, (m ?? 0) + 15);
    expect(asr?.iqamah).toBe(
      `${String(expected.getUTCHours()).padStart(2, '0')}:${String(expected.getUTCMinutes()).padStart(2, '0')}`,
    );
  });

  it('honours effectiveFrom — not before the date, yes on and after it', async () => {
    const token = await tokenFor(YUSUF);

    // Madina Isha is fixed at 21:15 from 2026-09-08 and has no earlier row.
    const before = await table(token, 'mosque_madina', '2026-09-07');
    const on = await table(token, 'mosque_madina', '2026-09-08');
    const after = await table(token, 'mosque_madina', '2026-09-20');

    expect(before.find((r) => r.prayer === 'isha')?.iqamah).toBeNull();
    expect(on.find((r) => r.prayer === 'isha')?.iqamah).toBe('21:15');
    expect(after.find((r) => r.prayer === 'isha')?.iqamah).toBe('21:15');
  });

  it('rejects a malformed date', async () => {
    await api
      .get('/api/mosques/mosque_khadija/prayer-times?date=not-a-date')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .expect(400);
  });
});

describe('iqamah config', () => {
  it('never emits an _id, so the editor can post rows straight back', async () => {
    const res = await api
      .get('/api/mosques/mosque_khadija/iqamah')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .expect(200);

    const rows = [...res.body.data.iqamah, ...res.body.data.jummah];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r: Record<string, unknown>) => '_id' in r)).toBe(false);
  });

  it('round-trips what GET returned without a 400', async () => {
    const member = await tokenFor(YUSUF);
    const admin = await tokenFor(AMINA);

    const before = await api
      .get('/api/mosques/mosque_khadija/iqamah')
      .set('Authorization', `Bearer ${member}`)
      .expect(200);

    // Exactly what the editor does: strip mosqueId, send everything else back.
    const echo = {
      iqamah: before.body.data.iqamah.map(
        ({ mosqueId: _m, ...rest }: Record<string, unknown>) => rest,
      ),
      jummah: before.body.data.jummah.map(
        ({ mosqueId: _m, ...rest }: Record<string, unknown>) => rest,
      ),
    };

    const after = await api
      .put('/api/mosques/mosque_khadija/iqamah')
      .set('Authorization', `Bearer ${admin}`)
      .send(echo)
      .expect(200);

    expect(after.body.data.iqamah).toHaveLength(before.body.data.iqamah.length);
  });

  it('whole-replaces, and the new row shows up in prayer-times', async () => {
    const admin = await tokenFor(AMINA);
    const member = await tokenFor(YUSUF);

    await api
      .put('/api/mosques/mosque_khadija/iqamah')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        iqamah: [
          { prayer: 'fajr', mode: 'fixed', fixedTime: '05:00', effectiveFrom: '2026-01-01' },
          { prayer: 'fajr', mode: 'fixed', fixedTime: '06:15', effectiveFrom: '2026-09-10' },
        ],
        jummah: [{ label: 'Only jummah', khutbahTime: '13:05', iqamahTime: '13:25' }],
      })
      .expect(200);

    const config = await api
      .get('/api/mosques/mosque_khadija/iqamah')
      .set('Authorization', `Bearer ${member}`)
      .expect(200);
    expect(config.body.data.iqamah).toHaveLength(2);
    expect(config.body.data.jummah).toHaveLength(1);

    // The later row takes over exactly on its effectiveFrom, not before.
    const day9 = await table(member, 'mosque_khadija', '2026-09-09');
    const day10 = await table(member, 'mosque_khadija', '2026-09-10');
    expect(day9.find((r) => r.prayer === 'fajr')?.iqamah).toBe('05:00');
    expect(day10.find((r) => r.prayer === 'fajr')?.iqamah).toBe('06:15');

    // The prayers whose rows we dropped now have no iqamah at all.
    expect(day10.find((r) => r.prayer === 'isha')?.iqamah).toBeNull();
  });

  it('403s a plain member trying to save', async () => {
    await api
      .put('/api/mosques/mosque_khadija/iqamah')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .send({ iqamah: [], jummah: [] })
      .expect(403);
  });
});
