/**
 * scenario.js - validation, URL-hash sharing, and JSON export/import.
 *
 * A scenario is { G, softening, bodies: [{ x, y, vx, vy, m }] }.
 */

export const MAX_BODIES = 400;
export const SCHEMA_VERSION = 1;
export const EXPORT_FORMAT = 'gravitas';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Validate and normalize an untrusted scenario object. Throws on bad input. */
export function validateScenario(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Scenario must be an object.');
  const G = raw.G === undefined ? 1 : raw.G;
  const softening = raw.softening === undefined ? 2 : raw.softening;
  if (!isNum(G) || G < 0 || G > 100) throw new Error('Invalid gravity constant G.');
  if (!isNum(softening) || softening < 0 || softening > 1000) throw new Error('Invalid softening value.');
  if (!Array.isArray(raw.bodies)) throw new Error('Scenario needs a "bodies" array.');
  if (raw.bodies.length > MAX_BODIES) throw new Error(`Too many bodies (max ${MAX_BODIES}).`);
  const bodies = raw.bodies.map((b, i) => {
    if (!b || typeof b !== 'object') throw new Error(`Body ${i + 1} is not an object.`);
    const { x, y, vx = 0, vy = 0, m } = b;
    if (![x, y, vx, vy, m].every(isNum)) throw new Error(`Body ${i + 1} has non-numeric fields.`);
    if (m <= 0) throw new Error(`Body ${i + 1} must have positive mass.`);
    return { x, y, vx, vy, m };
  });
  return { G, softening, bodies };
}

// ---------------------------------------------------------------------------
// URL hash sharing: #s=<base64url(JSON)>
// Bodies are stored as compact [x, y, vx, vy, m] arrays rounded to 3 decimals.
// ---------------------------------------------------------------------------

const round = (v) => Math.round(v * 1000) / 1000;

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeScenario(scn) {
  const compact = {
    v: SCHEMA_VERSION,
    G: round(scn.G),
    e: round(scn.softening),
    b: scn.bodies.map((b) => [round(b.x), round(b.y), round(b.vx), round(b.vy), round(b.m)]),
  };
  return toBase64Url(JSON.stringify(compact));
}

export function decodeScenario(str) {
  let data;
  try {
    data = JSON.parse(fromBase64Url(str));
  } catch {
    throw new Error('Shared link is corrupted.');
  }
  if (!data || !Array.isArray(data.b)) throw new Error('Shared link has no bodies.');
  return validateScenario({
    G: data.G,
    softening: data.e,
    bodies: data.b.map((a) => (Array.isArray(a) ? { x: a[0], y: a[1], vx: a[2], vy: a[3], m: a[4] } : null)),
  });
}

/** Extract the scenario payload from a location hash like "#s=abc". */
export function scenarioFromHash(hash) {
  const m = /^#?s=([A-Za-z0-9_-]+)$/.exec(hash || '');
  return m ? decodeScenario(m[1]) : null;
}

// ---------------------------------------------------------------------------
// JSON export / import of everything the user owns.
// ---------------------------------------------------------------------------

export function buildExport({ appVersion, settings, scenario, saved }) {
  return {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    settings,
    scenario,
    saved,
  };
}

/** Parse and validate an imported file. Returns { settings, scenario, saved }. */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!data || data.format !== EXPORT_FORMAT) throw new Error('Not a Gravitas export file.');
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This file was made by a newer version of Gravitas.');
  }
  const scenario = data.scenario ? validateScenario(data.scenario) : null;
  const saved = Array.isArray(data.saved)
    ? data.saved.map((s, i) => {
        if (!s || typeof s.name !== 'string' || !s.name.trim()) throw new Error(`Saved scenario ${i + 1} has no name.`);
        return {
          name: s.name.trim().slice(0, 60),
          savedAt: typeof s.savedAt === 'string' ? s.savedAt : new Date().toISOString(),
          scenario: validateScenario(s.scenario),
        };
      })
    : [];
  const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
  return { settings, scenario, saved };
}
