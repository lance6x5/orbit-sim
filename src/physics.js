/**
 * physics.js - the heart of the simulation. Pure functions, no DOM.
 *
 * UNITS
 *   Everything is in arbitrary "simulation units": distance ~ screen pixels at
 *   zoom 1, mass is a unitless number, and time is measured in "ticks" of
 *   simulation time. The gravitational constant G is a slider, so units only
 *   need to be self-consistent.
 *
 * A BODY is a plain object: { x, y, vx, vy, ax, ay, m, r }
 *   (x, y)   position
 *   (vx, vy) velocity
 *   (ax, ay) acceleration from the most recent force evaluation
 *   m        mass, r collision radius
 */

/**
 * NEWTON'S LAW OF GRAVITATION
 *
 *   F = G * m1 * m2 / d^2      (attractive, along the line joining the bodies)
 *
 * Dividing by the body's own mass gives its acceleration. As a vector, the
 * acceleration of body i caused by body j is:
 *
 *   a_i = G * m_j * (r_j - r_i) / |r_j - r_i|^3
 *
 * (the extra power of |r| in the denominator normalizes the direction vector).
 *
 * SOFTENING: when two bodies get very close, d -> 0 and the force -> infinity,
 * which makes the integrator fling bodies off at absurd speeds. We replace
 * d^2 with (d^2 + eps^2). Far away (d >> eps) nothing changes; up close the
 * force smoothly levels off instead of exploding.
 *
 *   a_i = G * m_j * (r_j - r_i) / (d^2 + eps^2)^(3/2)
 *
 * Every pair is visited once (j > i) and Newton's third law applied, which
 * halves the work: O(n^2 / 2) pair evaluations per call.
 */
export function computeAccelerations(bodies, G, softening) {
  const n = bodies.length;
  const eps2 = softening * softening;
  for (let i = 0; i < n; i++) {
    bodies[i].ax = 0;
    bodies[i].ay = 0;
  }
  for (let i = 0; i < n; i++) {
    const bi = bodies[i];
    for (let j = i + 1; j < n; j++) {
      const bj = bodies[j];
      const dx = bj.x - bi.x;
      const dy = bj.y - bi.y;
      const d2 = dx * dx + dy * dy + eps2;
      if (d2 === 0) continue; // exactly coincident with zero softening: skip
      const invD = 1 / Math.sqrt(d2);
      const s = G * invD * invD * invD; // G / d^3
      // Equal and opposite: i is pulled toward j, j toward i.
      bi.ax += s * bj.m * dx;
      bi.ay += s * bj.m * dy;
      bj.ax -= s * bi.m * dx;
      bj.ay -= s * bi.m * dy;
    }
  }
}

/**
 * EXPLICIT (FORWARD) EULER - the simplest possible integrator.
 *
 *   x(t+dt) = x(t) + v(t) * dt
 *   v(t+dt) = v(t) + a(t) * dt
 *
 * It assumes velocity and acceleration stay constant for the whole step. For
 * a circular orbit the velocity is always tangent to the circle, so stepping
 * along the tangent always lands slightly *outside* the circle. Each step adds
 * a little energy, and the orbit spirals outward - visibly within a few laps.
 * Euler is "first order": halving dt only halves the error.
 */
export function stepEuler(bodies, dt, G, softening) {
  computeAccelerations(bodies, G, softening);
  for (const b of bodies) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx += b.ax * dt;
    b.vy += b.ay * dt;
  }
}

/**
 * VELOCITY VERLET - the workhorse of orbital and molecular dynamics.
 *
 *   x(t+dt) = x(t) + v(t)*dt + 1/2 * a(t) * dt^2
 *   a(t+dt) = forces at the new positions
 *   v(t+dt) = v(t) + 1/2 * (a(t) + a(t+dt)) * dt
 *
 * Why it beats Euler for orbits:
 *   1. It is second order: the position update includes the curvature term
 *      (1/2 a dt^2), and the velocity uses the *average* of the old and new
 *      accelerations, so errors are much smaller for the same dt.
 *   2. It is "symplectic" and time-reversible. Energy is not exactly
 *      conserved, but the error oscillates around the true value instead of
 *      drifting away. Orbits stay closed for millions of steps.
 *   3. It costs the same as Euler: one force evaluation per step, because the
 *      a(t+dt) we compute is reused as a(t) of the next step.
 *
 * PRECONDITION: b.ax / b.ay must hold the accelerations at the current
 * positions (call computeAccelerations once after the scene changes).
 */
export function stepVerlet(bodies, dt, G, softening) {
  const halfDt2 = 0.5 * dt * dt;
  for (const b of bodies) {
    b.x += b.vx * dt + b.ax * halfDt2;
    b.y += b.vy * dt + b.ay * halfDt2;
    b.pax = b.ax; // remember a(t) for the velocity average
    b.pay = b.ay;
  }
  computeAccelerations(bodies, G, softening); // a(t+dt)
  const halfDt = 0.5 * dt;
  for (const b of bodies) {
    b.vx += (b.pax + b.ax) * halfDt;
    b.vy += (b.pay + b.ay) * halfDt;
  }
}

/** Radius of a body of mass m: volume ~ mass, so radius ~ cube root of mass. */
export function radiusForMass(m) {
  return 2 * Math.cbrt(Math.max(m, 0));
}

/**
 * COLLISIONS. Checked after every integration step. Modes:
 *   'merge'  - perfectly inelastic: the two bodies become one. Mass and
 *              momentum (m*v) are conserved; kinetic energy is not (it would
 *              become heat in real life).
 *   'bounce' - elastic: an impulse along the line of centers reverses the
 *              approaching part of the relative velocity. Momentum and kinetic
 *              energy are conserved (restitution = 1).
 *   'pass'   - bodies fly through each other (only softened gravity acts).
 *
 * Returns { bodies, changed, merges } where `merges` lists
 * { survivor, absorbed } pairs so callers can transfer selection, etc.
 * The input array is not mutated in length; a new array is returned when
 * bodies are removed.
 */
export function resolveCollisions(bodies, mode, restitution = 1) {
  const result = { bodies, changed: false, merges: [] };
  if (mode === 'pass' || bodies.length < 2) return result;

  const n = bodies.length;
  const dead = mode === 'merge' ? new Uint8Array(n) : null;

  for (let i = 0; i < n; i++) {
    if (dead && dead[i]) continue;
    const a = bodies[i];
    for (let j = i + 1; j < n; j++) {
      if (dead && dead[j]) continue;
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rsum = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rsum * rsum) continue; // not touching

      result.changed = true;
      if (mode === 'merge') {
        // The heavier body survives (keeps its id, trail and selection).
        const [keep, gone, gi] = a.m >= b.m ? [a, b, j] : [b, a, i];
        const m = keep.m + gone.m;
        // Center of mass position and momentum-conserving velocity:
        //   v = (m1*v1 + m2*v2) / (m1 + m2)
        keep.x = (keep.x * keep.m + gone.x * gone.m) / m;
        keep.y = (keep.y * keep.m + gone.y * gone.m) / m;
        keep.vx = (keep.vx * keep.m + gone.vx * gone.m) / m;
        keep.vy = (keep.vy * keep.m + gone.vy * gone.m) / m;
        keep.m = m;
        keep.r = radiusForMass(m);
        dead[gi] = 1;
        result.merges.push({ survivor: keep, absorbed: gone });
        if (gi === i) break; // body i no longer exists; move to the next i
      } else {
        bounce(a, b, dx, dy, Math.sqrt(d2), rsum, restitution);
      }
    }
  }

  if (dead) result.bodies = bodies.filter((_, k) => !dead[k]);
  return result;
}

/**
 * Elastic bounce between a and b. n is the unit normal from a to b.
 * Relative normal velocity vn = (vb - va) . n ; if vn < 0 they approach.
 * Impulse J = -(1 + e) * vn / (1/ma + 1/mb), applied as +J to b, -J to a.
 */
function bounce(a, b, dx, dy, d, rsum, e) {
  let nx = 1;
  let ny = 0;
  if (d > 1e-9) {
    nx = dx / d;
    ny = dy / d;
  }
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0) {
    const J = (-(1 + e) * vn) / (1 / a.m + 1 / b.m);
    a.vx -= (J / a.m) * nx;
    a.vy -= (J / a.m) * ny;
    b.vx += (J / b.m) * nx;
    b.vy += (J / b.m) * ny;
  }
  // Push the bodies apart so they no longer overlap (lighter body moves more).
  const overlap = rsum - d;
  const total = a.m + b.m;
  a.x -= nx * overlap * (b.m / total);
  a.y -= ny * overlap * (b.m / total);
  b.x += nx * overlap * (a.m / total);
  b.y += ny * overlap * (a.m / total);
}

/** Center of mass position and velocity of the whole system. */
export function centerOfMass(bodies) {
  let m = 0, x = 0, y = 0, vx = 0, vy = 0;
  for (const b of bodies) {
    m += b.m;
    x += b.x * b.m;
    y += b.y * b.m;
    vx += b.vx * b.m;
    vy += b.vy * b.m;
  }
  if (m === 0) return { m: 0, x: 0, y: 0, vx: 0, vy: 0 };
  return { m, x: x / m, y: y / m, vx: vx / m, vy: vy / m };
}

/** Total linear momentum (should stay constant without external forces). */
export function totalMomentum(bodies) {
  let px = 0, py = 0;
  for (const b of bodies) {
    px += b.m * b.vx;
    py += b.m * b.vy;
  }
  return { px, py };
}

/**
 * Total mechanical energy = kinetic + potential.
 *   KE = sum 1/2 m v^2
 *   PE = sum over pairs  -G m_i m_j / sqrt(d^2 + eps^2)   (softened)
 * A good integrator keeps this nearly constant; Euler lets it climb.
 */
export function totalEnergy(bodies, G, softening) {
  const eps2 = softening * softening;
  let ke = 0, pe = 0;
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    ke += 0.5 * a.m * (a.vx * a.vx + a.vy * a.vy);
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy + eps2);
      if (d > 0) pe -= (G * a.m * b.m) / d;
    }
  }
  return ke + pe;
}

/**
 * Predict where a new body would travel, for the drag-to-launch preview.
 * For small systems every body is simulated (the others move too). For big
 * systems that would be too slow per frame, so the others are frozen in place
 * and only the probe moves - a good approximation for a short look-ahead.
 *
 * Returns { points: [x0, y0, x1, y1, ...], hit: boolean }.
 */
export function predictTrajectory(bodies, probe, { G, softening, dt, steps = 600, sampleEvery = 2, fullLimit = 40 }) {
  const points = [probe.x, probe.y];
  const clone = (b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, m: b.m, r: b.r, ax: 0, ay: 0 });
  const p = clone(probe);
  const full = bodies.length <= fullLimit;
  const others = bodies.map(clone);
  const sim = full ? [...others, p] : null;
  const eps2 = softening * softening;

  // Acceleration on the probe only, others frozen.
  const probeAccel = () => {
    p.ax = 0;
    p.ay = 0;
    for (const o of others) {
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const d2 = dx * dx + dy * dy + eps2;
      if (d2 === 0) continue;
      const inv = 1 / Math.sqrt(d2);
      const s = G * o.m * inv * inv * inv;
      p.ax += s * dx;
      p.ay += s * dy;
    }
  };

  if (full) computeAccelerations(sim, G, softening);
  else probeAccel();

  let hit = false;
  for (let s = 1; s <= steps; s++) {
    if (full) {
      stepVerlet(sim, dt, G, softening);
    } else {
      // Velocity Verlet for the single probe.
      const pax = p.ax, pay = p.ay;
      p.x += p.vx * dt + 0.5 * pax * dt * dt;
      p.y += p.vy * dt + 0.5 * pay * dt * dt;
      probeAccel();
      p.vx += 0.5 * (pax + p.ax) * dt;
      p.vy += 0.5 * (pay + p.ay) * dt;
    }
    if (s % sampleEvery === 0) points.push(p.x, p.y);
    // Stop at the first collision with another body.
    for (const o of others) {
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const rs = o.r + p.r;
      if (dx * dx + dy * dy < rs * rs) {
        hit = true;
        break;
      }
    }
    if (hit) {
      points.push(p.x, p.y);
      break;
    }
  }
  return { points, hit };
}
