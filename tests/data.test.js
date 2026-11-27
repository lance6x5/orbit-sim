import { describe, it, expect } from 'vitest';
import { encodeScenario, decodeScenario, scenarioFromHash, validateScenario, buildExport, parseImport } from '../src/scenario.js';
import { sanitizeSettings, DEFAULT_SETTINGS } from '../src/settings.js';
import { buildIssueUrl } from '../src/feedback.js';
import { sliderToMass, massToSlider, colorForMass } from '../src/bodies.js';
import { buildPreset } from '../src/presets.js';

describe('URL hash sharing', () => {
  it('round-trips a scenario', () => {
    const scn = buildPreset('solar');
    const back = decodeScenario(encodeScenario(scn));
    expect(back.bodies).toHaveLength(scn.bodies.length);
    expect(back.G).toBe(1);
    back.bodies.forEach((b, i) => {
      expect(b.x).toBeCloseTo(scn.bodies[i].x, 2);
      expect(b.vy).toBeCloseTo(scn.bodies[i].vy, 2);
    });
  });

  it('reads #s= hashes and ignores others', () => {
    const enc = encodeScenario({ G: 2, softening: 1, bodies: [{ x: 1, y: 2, vx: 0, vy: 0, m: 5 }] });
    expect(scenarioFromHash(`#s=${enc}`).G).toBe(2);
    expect(scenarioFromHash('#/about')).toBeNull();
    expect(scenarioFromHash('')).toBeNull();
    expect(() => scenarioFromHash('#s=garbage')).toThrow();
  });
});

describe('validation', () => {
  it('rejects bad bodies', () => {
    expect(() => validateScenario({ bodies: [{ x: 0, y: 0, m: -1 }] })).toThrow();
    expect(() => validateScenario({ bodies: [{ x: 'a', y: 0, m: 1 }] })).toThrow();
    expect(() => validateScenario({})).toThrow();
  });

  it('sanitizes settings', () => {
    const s = sanitizeSettings({ G: 999, integrator: 'rk4', trails: false, extra: 1 });
    expect(s.G).toBe(5);
    expect(s.integrator).toBe(DEFAULT_SETTINGS.integrator);
    expect(s.trails).toBe(false);
    expect(s.extra).toBeUndefined();
  });
});

describe('export / import', () => {
  it('round-trips an export', () => {
    const data = buildExport({
      appVersion: '1.0.0',
      settings: DEFAULT_SETTINGS,
      scenario: buildPreset('binary'),
      saved: [{ name: 'Mine', savedAt: '2026-01-01T00:00:00.000Z', scenario: buildPreset('earthmoon') }],
    });
    const back = parseImport(JSON.stringify(data));
    expect(back.scenario.bodies).toHaveLength(4);
    expect(back.saved[0].name).toBe('Mine');
  });

  it('rejects foreign files', () => {
    expect(() => parseImport('not json')).toThrow();
    expect(() => parseImport('{"format":"other"}')).toThrow();
    expect(() => parseImport('{"format":"gravitas","schemaVersion":99}')).toThrow();
  });
});

describe('mass helpers', () => {
  it('slider maps log-scale 1..10000', () => {
    expect(sliderToMass(0)).toBe(1);
    expect(sliderToMass(100)).toBe(10000);
    expect(massToSlider(sliderToMass(50))).toBe(50);
  });
  it('colors are hex strings', () => {
    expect(colorForMass(1)).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorForMass(1e6)).toBe(colorForMass(10000));
  });
});

describe('feedback URLs', () => {
  it('builds a bug report URL with version and environment', () => {
    const url = new URL(buildIssueUrl('bug', { version: '1.0.0', userAgent: 'TestAgent/1.0' }));
    expect(url.origin + url.pathname).toBe('https://github.com/lance6x5/orbit-sim/issues/new');
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('title')).toBe('[Bug]: ');
    expect(url.searchParams.get('version')).toBe('1.0.0');
    expect(url.searchParams.get('environment')).toBe('TestAgent/1.0');
  });

  it('builds a feature request URL without environment', () => {
    const url = new URL(buildIssueUrl('feature', { version: '1.0.0', userAgent: 'x' }));
    expect(url.searchParams.get('template')).toBe('feature_request.yml');
    expect(url.searchParams.get('title')).toBe('[Feature]: ');
    expect(url.searchParams.has('environment')).toBe(false);
  });

  it('trims long user agents and rejects unknown kinds', () => {
    const url = new URL(buildIssueUrl('bug', { userAgent: 'a'.repeat(500) }));
    expect(url.searchParams.get('environment')).toHaveLength(160);
    expect(() => buildIssueUrl('spam')).toThrow();
  });
});
