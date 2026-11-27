import { describe, it, expect, vi } from 'vitest';
import { getVisitCount, formatVisits, SESSION_FLAG, COUNTER_ORIGIN, COUNTER_KEY } from '../src/visits.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const okFetch = (value) => vi.fn(async () => ({ ok: true, json: async () => ({ value }) }));
const base = { hostname: 'lance6x5.github.io', nav: {} };

describe('visit counter', () => {
  it('hits on the first load of a session, then only gets', async () => {
    const storage = memStorage();
    const fetchImpl = okFetch(42);
    expect(await getVisitCount({ ...base, storage, fetchImpl })).toBe(42);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${COUNTER_ORIGIN}/hit/${COUNTER_KEY}`);
    expect(storage.getItem(SESSION_FLAG)).toBe('1');
    expect(await getVisitCount({ ...base, storage, fetchImpl })).toBe(42);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${COUNTER_ORIGIN}/get/${COUNTER_KEY}`);
    const opts = fetchImpl.mock.calls[0][1];
    expect(opts.cache).toBe('no-store');
    expect(opts.credentials).toBe('omit');
    expect(opts.headers).toBeUndefined();
  });

  it('returns null on failure, non-OK responses and bad JSON', async () => {
    const storage = memStorage();
    expect(await getVisitCount({ ...base, storage, fetchImpl: vi.fn(async () => { throw new Error('offline'); }) })).toBeNull();
    expect(await getVisitCount({ ...base, storage, fetchImpl: vi.fn(async () => ({ ok: false, json: async () => ({}) })) })).toBeNull();
    expect(await getVisitCount({ ...base, storage, fetchImpl: vi.fn(async () => ({ ok: true, json: async () => ({ error: 'x' }) })) })).toBeNull();
    expect(storage.getItem(SESSION_FLAG)).toBeNull();
  });

  it('skips /hit when Do Not Track or Global Privacy Control is on', async () => {
    for (const nav of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
      const fetchImpl = okFetch(7);
      expect(await getVisitCount({ ...base, nav, storage: memStorage(), fetchImpl })).toBe(7);
      expect(fetchImpl.mock.calls[0][0]).toContain('/get/');
    }
  });

  it('does nothing on localhost and survives broken storage', async () => {
    const fetchImpl = okFetch(1);
    expect(await getVisitCount({ ...base, hostname: 'localhost', storage: memStorage(), fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(await getVisitCount({ ...base, storage: broken, fetchImpl })).toBe(1);
  });

  it('formats counts', () => {
    expect(formatVisits(12345, 'en-US')).toBe('12,345 visits');
    expect(formatVisits(1, 'en-US')).toBe('1 visit');
  });
});
