import { describe, it, expect } from 'vitest';
import {
  computeAccelerations,
  stepVerlet,
  stepEuler,
  resolveCollisions,
  totalEnergy,
  totalMomentum,
  centerOfMass,
  radiusForMass,
  predictTrajectory,
} from '../src/physics.js';
import { buildPreset, PRESETS, mulberry32 } from '../src/presets.js';
import { consumeTime } from '../src/loop.js';

const body = (x, y, vx, vy, m) => ({ x, y, vx, vy, m, r: radiusForMass(m), ax: 0, ay: 0 });

/** Sun + one planet in a circular orbit at radius 200. */
function twoBody() {
  const M = 1000, m = 1, r = 200;
  const v = Math.sqrt(M / r);
  return [body(0, 0, 0, 0, M), body(r, 0, 0, v, m)];
}

function run(bodies, integrator, steps, dt = 0.5) {
  if (integrator === 'verlet') computeAccelerations(bodies, 1, 0);
  for (let i = 0; i < steps; i++) {
    if (integrator === 'verlet') stepVerlet(bodies, dt, 1, 0);
    else stepEuler(bodies, dt, 1, 0);
  }
}

describe('gravity', () => {
  it('obeys Newton: a = G m / d^2 toward the other body', () => {
    const bs = [body(0, 0, 0, 0, 100), body(10, 0, 0, 0, 1)];
    computeAccelerations(bs, 1, 0);
    expect(bs[1].ax).toBeCloseTo(-1, 10); // 100 / 10^2 toward origin
    expect(bs[0].ax).toBeCloseTo(0.01, 10); // 1 / 10^2 toward +x
  });

  it('softening keeps forces finite at zero distance', () => {
    const bs = [body(0, 0, 0, 0, 100), body(0, 0, 0, 0, 100)];
    computeAccelerations(bs, 1, 2);
    expect(Number.isFinite(bs[0].ax)).toBe(true);
    expect(bs[0].ax).toBe(0);
  });
});

describe('integrators', () => {
  it('velocity Verlet conserves energy far better than Euler', () => {
    const a = twoBody();
    const b = twoBody();
    const E0 = totalEnergy(a, 1, 0);
    run(a, 'verlet', 4000);
    run(b, 'euler', 4000);
    const verletDrift = Math.abs((totalEnergy(a, 1, 0) - E0) / E0);
    const eulerDrift = Math.abs((totalEnergy(b, 1, 0) - E0) / E0);
    expect(verletDrift).toBeLessThan(1e-3);
    expect(eulerDrift).toBeGreaterThan(verletDrift * 50);
  });

  it('Euler orbits spiral outward', () => {
    const b = twoBody();
    run(b, 'euler', 4000);
    expect(Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y)).toBeGreaterThan(220);
  });

  it('conserves total momentum', () => {
    const bs = [body(0, 0, 0.1, 0, 50), body(80, 10, 0, 0.7, 20), body(-60, 40, 0.3, -0.2, 5)];
    const p0 = totalMomentum(bs);
    run(bs, 'verlet', 500);
    const p1 = totalMomentum(bs);
    expect(p1.px).toBeCloseTo(p0.px, 8);
    expect(p1.py).toBeCloseTo(p0.py, 8);
  });
});

describe('collisions', () => {
  it('merge conserves mass and momentum', () => {
    const bs = [body(0, 0, 1, 0, 10), body(1, 0, -1, 2, 30)];
    const p0 = totalMomentum(bs);
    const res = resolveCollisions(bs, 'merge');
    expect(res.changed).toBe(true);
    expect(res.bodies).toHaveLength(1);
    const [m] = res.bodies;
    expect(m.m).toBe(40);
    expect(m.m * m.vx).toBeCloseTo(p0.px, 10);
    expect(m.m * m.vy).toBeCloseTo(p0.py, 10);
    expect(res.merges[0].survivor).toBe(bs[1]); // heavier survives
  });

  it('bounce conserves momentum and kinetic energy', () => {
    const bs = [body(0, 0, 1, 0, 10), body(5, 0, -1, 0, 10)];
    const ke = (b) => b.reduce((s, x) => s + 0.5 * x.m * (x.vx ** 2 + x.vy ** 2), 0);
    const k0 = ke(bs);
    const res = resolveCollisions(bs, 'bounce');
    expect(res.bodies).toHaveLength(2);
    expect(bs[0].vx).toBeCloseTo(-1, 10);
    expect(bs[1].vx).toBeCloseTo(1, 10);
    expect(ke(bs)).toBeCloseTo(k0, 10);
    expect(Math.abs(bs[1].x - bs[0].x)).toBeGreaterThanOrEqual(bs[0].r + bs[1].r - 1e-9);
  });

  it('pass-through leaves bodies alone', () => {
    const bs = [body(0, 0, 1, 0, 10), body(1, 0, -1, 0, 10)];
    expect(resolveCollisions(bs, 'pass').changed).toBe(false);
  });
});

describe('presets', () => {
  it('every preset builds valid bodies with ~zero net momentum', () => {
    for (const p of PRESETS) {
      const scn = buildPreset(p.id, mulberry32(1));
      expect(scn.bodies.length).toBeGreaterThan(1);
      const bs = scn.bodies.map((b) => body(b.x, b.y, b.vx, b.vy, b.m));
      const { px, py } = totalMomentum(bs);
      expect(Math.abs(px) + Math.abs(py)).toBeLessThan(1e-6);
    }
  });

  it('figure-eight returns close to its start after one period', () => {
    const scn = buildPreset('figure8');
    const bs = scn.bodies.map((b) => body(b.x, b.y, b.vx, b.vy, b.m));
    const start = bs.map((b) => [b.x, b.y]);
    // Period is 6.3259 in normalized units; time scale = L / sqrt(G M / L).
    const T = 6.3259 * (150 / Math.sqrt(300 / 150));
    const dt = 0.25;
    computeAccelerations(bs, 1, scn.softening);
    for (let i = 0; i < Math.round(T / dt); i++) stepVerlet(bs, dt, 1, scn.softening);
    bs.forEach((b, i) => expect(Math.hypot(b.x - start[i][0], b.y - start[i][1])).toBeLessThan(15));
    expect(centerOfMass(bs).m).toBe(900);
  });
});

describe('trajectory prediction', () => {
  it('predicts a closed-ish orbit for a circular launch', () => {
    const sun = body(0, 0, 0, 0, 1000);
    const probe = body(200, 0, 0, Math.sqrt(1000 / 200), 1);
    const { points, hit } = predictTrajectory([sun], probe, { G: 1, softening: 0, dt: 1, steps: 300 });
    expect(hit).toBe(false);
    for (let k = 0; k < points.length; k += 2) {
      expect(Math.hypot(points[k], points[k + 1])).toBeCloseTo(200, -1);
    }
  });

  it('flags a collision course', () => {
    const sun = body(0, 0, 0, 0, 1000);
    const probe = body(200, 0, -2, 0, 1);
    expect(predictTrajectory([sun], probe, { G: 1, softening: 2, dt: 1, steps: 400 }).hit).toBe(true);
  });
});

describe('fixed timestep accumulator', () => {
  it('runs whole steps and carries the remainder', () => {
    expect(consumeTime(0, 1.3, 0.5, 10)).toEqual({ steps: 2, accumulator: expect.closeTo(0.3, 10) });
  });
  it('drops the backlog when it cannot keep up', () => {
    expect(consumeTime(0, 100, 0.5, 10)).toEqual({ steps: 10, accumulator: 0 });
  });
});
