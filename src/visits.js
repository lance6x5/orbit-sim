/**
 * visits.js - anonymous page-load counter via the open-source Abacus service
 * (https://github.com/JasonLovesDoggo/abacus). No signup, no key, no cookies.
 *
 * - Only the first load per browser session calls /hit (increments); later
 *   loads in the same session call /get (read-only).
 * - Never counts on localhost / 127.0.0.1, or when Do Not Track or Global
 *   Privacy Control is on (then it only reads the current count).
 * - Sends no app or user data: a plain GET with no query, headers or
 *   credentials. Never reads or touches the URL hash (used for share links).
 * - Fails silently: any error, timeout or non-OK response resolves to null.
 */
export const COUNTER_ORIGIN = 'https://abacus.jasoncameron.dev';
export const COUNTER_KEY = 'lance6x5.github.io/orbit-sim';
export const SESSION_FLAG = 'orbit-sim:visit-counted';
const TIMEOUT_MS = 4000;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function readFlag(store) {
  try {
    return store?.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

function writeFlag(store) {
  try {
    store?.setItem(SESSION_FLAG, '1');
  } catch {
    /* storage unavailable (private mode, quota) - ignore */
  }
}

/** True when the browser asks not to be tracked (DNT or GPC). */
export function privacyOptOut(nav) {
  if (!nav) return false;
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

/** Format a count like "12,345 visits" (or "1 visit"). */
export function formatVisits(value, locale) {
  const n = new Intl.NumberFormat(locale).format(value);
  return `${n} ${value === 1 ? 'visit' : 'visits'}`;
}

/**
 * Fetch (and, once per session, increment) the visit count.
 * All environment pieces are injectable for tests.
 * @returns {Promise<number|null>}
 */
export async function getVisitCount({
  fetchImpl = globalThis.fetch,
  storage = (() => {
    try {
      return globalThis.sessionStorage;
    } catch {
      return undefined;
    }
  })(),
  hostname = globalThis.location?.hostname ?? '',
  nav = globalThis.navigator,
  timeoutMs = TIMEOUT_MS,
} = {}) {
  try {
    if (typeof fetchImpl !== 'function') return null;
    if (LOCAL_HOSTS.has(hostname)) return null; // dev: don't count or call out

    const mayCount = !privacyOptOut(nav) && !readFlag(storage);
    const action = mayCount ? 'hit' : 'get';

    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await fetchImpl(`${COUNTER_ORIGIN}/${action}/${COUNTER_KEY}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: ctrl?.signal,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res || !res.ok) return null;
    if (action === 'hit') writeFlag(storage);
    const data = await res.json();
    const value = Number(data?.value);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

/** Show the count in `el` (kept hidden until a value arrives). */
export async function showVisitCount(el, opts) {
  if (!el) return;
  const value = await getVisitCount(opts);
  if (value === null) return;
  el.textContent = formatVisits(value);
  el.hidden = false;
}
