/**
 * bodies.js - creating bodies and deriving their look from mass.
 */
import { radiusForMass } from './physics.js';

export const MIN_MASS = 0.1;
export const MAX_MASS = 100000;

let nextId = 1;

/** Create a full simulation body from a minimal description {x, y, vx, vy, m}. */
export function createBody({ x, y, vx = 0, vy = 0, m }) {
  const mass = Math.min(MAX_MASS, Math.max(MIN_MASS, m));
  return {
    id: nextId++,
    x,
    y,
    vx,
    vy,
    ax: 0,
    ay: 0,
    m: mass,
    r: radiusForMass(mass),
    trail: [], // flat [x0, y0, x1, y1, ...] in world coordinates
  };
}

/** Strip runtime-only fields, keeping only what defines the scenario. */
export function describeBody(b) {
  return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, m: b.m };
}

/**
 * Color by mass: small bodies are icy blue, medium ones green-gold, and big
 * stars glow orange then white-hot. Interpolated on log10(mass) and quantized
 * to 0.1 steps so the renderer can cache one glow sprite per color.
 */
const STOPS = [
  [0, [89, 168, 255]], //   1     icy blue
  [1, [123, 227, 196]], //  10     teal
  [2, [255, 209, 102]], //  100    gold
  [3, [255, 154, 60]], //   1000   orange star
  [4, [255, 241, 214]], //  10000  white-hot giant
];

const colorCache = new Map();

export function colorForMass(m) {
  const t = Math.round(Math.min(4, Math.max(0, Math.log10(Math.max(m, 1)))) * 10) / 10;
  const cached = colorCache.get(t);
  if (cached) return cached;
  let k = 0;
  while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
  const [t0, c0] = STOPS[k];
  const [t1, c1] = STOPS[k + 1];
  const f = (t - t0) / (t1 - t0);
  const rgb = c0.map((v, i) => Math.round(v + (c1[i] - v) * f));
  const hex = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  colorCache.set(t, hex);
  return hex;
}

/** Map a 0..100 slider value to mass on a log scale (1 .. 10,000). */
export function sliderToMass(v) {
  return Math.round(Math.pow(10, v / 25) * 10) / 10;
}

/** Inverse of sliderToMass. */
export function massToSlider(m) {
  return Math.round(25 * Math.log10(Math.max(1, m)));
}
