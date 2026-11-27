/**
 * presets.js - built-in scenarios. Each returns a plain scenario object:
 *   { G, softening, bodies: [{ x, y, vx, vy, m }] }
 *
 * Circular orbit speed: setting gravity equal to the centripetal force,
 *   G M m / r^2 = m v^2 / r   =>   v = sqrt(G M / r)
 */

const G = 1;
const SOFTENING = 2;

/** A body in a circular orbit around `center` at radius r and angle (radians). */
function orbit(center, r, angle, m) {
  const v = Math.sqrt((G * (center.m + m)) / r);
  return {
    x: center.x + r * Math.cos(angle),
    y: center.y + r * Math.sin(angle),
    vx: center.vx - v * Math.sin(angle),
    vy: center.vy + v * Math.cos(angle),
    m,
  };
}

/**
 * Shift velocities so the total momentum is zero, otherwise the whole system
 * slowly drifts off screen (e.g. the Sun recoiling from its planets).
 */
function zeroMomentum(bodies) {
  let m = 0, px = 0, py = 0;
  for (const b of bodies) {
    m += b.m;
    px += b.m * b.vx;
    py += b.m * b.vy;
  }
  for (const b of bodies) {
    b.vx -= px / m;
    b.vy -= py / m;
  }
  return bodies;
}

function solarSystem() {
  const sun = { x: 0, y: 0, vx: 0, vy: 0, m: 1000 };
  const giant = orbit(sun, 300, 2.2, 30);
  const bodies = [
    sun,
    orbit(sun, 80, 0.3, 2),
    orbit(sun, 130, 1.4, 5),
    orbit(sun, 200, 4.0, 8),
    giant,
    orbit(giant, 16, 0, 0.5), // a moon well inside the giant's Hill sphere
    orbit(sun, 420, 5.2, 15),
  ];
  return { G, softening: SOFTENING, bodies: zeroMomentum(bodies) };
}

function binaryStar() {
  // Two equal stars of mass M, separation d, orbiting their common center:
  //   G M^2 / d^2 = M v^2 / (d/2)   =>   v = sqrt(G M / (2 d))
  const M = 500;
  const d = 160;
  const v = Math.sqrt((G * M) / (2 * d));
  const barycenter = { x: 0, y: 0, vx: 0, vy: 0, m: 2 * M };
  const bodies = [
    { x: -d / 2, y: 0, vx: 0, vy: -v, m: M },
    { x: d / 2, y: 0, vx: 0, vy: v, m: M },
    // Circumbinary planets, far enough out (> ~3 d) to stay stable.
    orbit(barycenter, 500, 1.0, 3),
    orbit(barycenter, 660, 3.9, 6),
  ];
  return { G, softening: SOFTENING, bodies: zeroMomentum(bodies) };
}

function figureEight() {
  // Chenciner & Montgomery (2000): three equal masses chasing each other along
  // a figure-eight. Initial conditions in units where G = m = 1, scaled by a
  // length L and mass M; velocities then scale by sqrt(G M / L).
  const L = 150;
  const M = 300;
  const vs = Math.sqrt((G * M) / L);
  const p = [0.97000436, -0.24308753];
  const v3 = [-0.93240737, -0.86473146];
  const bodies = [
    { x: p[0] * L, y: p[1] * L, vx: (-v3[0] / 2) * vs, vy: (-v3[1] / 2) * vs, m: M },
    { x: -p[0] * L, y: -p[1] * L, vx: (-v3[0] / 2) * vs, vy: (-v3[1] / 2) * vs, m: M },
    { x: 0, y: 0, vx: v3[0] * vs, vy: v3[1] * vs, m: M },
  ];
  return { G, softening: 0.5, bodies };
}

function earthMoon() {
  // Real mass ratio is about 81:1.
  const earth = { x: 0, y: 0, vx: 0, vy: 0, m: 1000 };
  const bodies = [earth, orbit(earth, 160, 0, 1000 / 81), orbit(earth, 45, 2.5, 0.2)];
  return { G, softening: SOFTENING, bodies: zeroMomentum(bodies) };
}

/** Small seeded PRNG (mulberry32) so tests can get repeatable chaos. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChaos(rand = Math.random) {
  const bodies = [];
  const count = 120;
  for (let i = 0; i < count; i++) {
    const r = 40 + Math.sqrt(rand()) * 380;
    const ang = rand() * Math.PI * 2;
    const m = Math.round(Math.pow(10, rand() * 1.6) * 10) / 10; // 1 .. 40
    // A gentle swirl plus random jitter.
    const swirl = 0.5 + rand() * 0.6;
    bodies.push({
      x: r * Math.cos(ang),
      y: r * Math.sin(ang),
      vx: -Math.sin(ang) * swirl + (rand() - 0.5) * 0.4,
      vy: Math.cos(ang) * swirl + (rand() - 0.5) * 0.4,
      m,
    });
  }
  return { G, softening: 4, bodies: zeroMomentum(bodies) };
}

export const PRESETS = [
  { id: 'solar', name: 'Sun + planets', build: solarSystem },
  { id: 'binary', name: 'Binary star', build: binaryStar },
  { id: 'figure8', name: 'Figure-eight', build: figureEight },
  { id: 'earthmoon', name: 'Earth-Moon', build: earthMoon },
  { id: 'chaos', name: 'Random chaos', build: randomChaos },
];

export function buildPreset(id, rand) {
  const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
  return p.build(rand);
}
