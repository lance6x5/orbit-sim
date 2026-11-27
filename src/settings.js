/**
 * settings.js - default settings, sanitizing, and localStorage persistence.
 * Every storage call is wrapped in try/catch (private mode, quota, etc.).
 */

export const DEFAULT_SETTINGS = Object.freeze({
  integrator: 'verlet', // 'verlet' | 'euler'
  collision: 'merge', // 'merge' | 'bounce' | 'pass'
  G: 1,
  softening: 2,
  timeScale: 1,
  newMass: 10,
  trails: true,
  vectors: false,
  com: false,
});

const RANGES = {
  G: [0, 5],
  softening: [0, 20],
  timeScale: [0.1, 8],
  newMass: [1, 10000],
};

/** Merge untrusted input over the defaults, keeping only valid values. */
export function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  if (raw.integrator === 'verlet' || raw.integrator === 'euler') out.integrator = raw.integrator;
  if (['merge', 'bounce', 'pass'].includes(raw.collision)) out.collision = raw.collision;
  for (const [k, [lo, hi]] of Object.entries(RANGES)) {
    const v = raw[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(hi, Math.max(lo, v));
  }
  for (const k of ['trails', 'vectors', 'com']) {
    if (typeof raw[k] === 'boolean') out[k] = raw[k];
  }
  return out;
}

const KEYS = {
  settings: 'gravitas:settings',
  saved: 'gravitas:saved',
  last: 'gravitas:last',
};

function read(key) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  loadSettings: () => sanitizeSettings(read(KEYS.settings)),
  saveSettings: (s) => write(KEYS.settings, s),
  loadSaved: () => {
    const v = read(KEYS.saved);
    return Array.isArray(v) ? v : [];
  },
  saveSaved: (list) => write(KEYS.saved, list),
  loadLast: () => read(KEYS.last),
  saveLast: (scn) => write(KEYS.last, scn),
  clearAll: () => {
    try {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage unavailable: nothing to clear */
    }
  },
};
