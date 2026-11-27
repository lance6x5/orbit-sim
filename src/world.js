/**
 * world.js - owns the list of bodies and advances it one fixed step at a time.
 * Ties together integration, collisions, trails and energy bookkeeping.
 */
import { computeAccelerations, stepVerlet, stepEuler, resolveCollisions, totalEnergy, centerOfMass } from './physics.js';
import { createBody, colorForMass, describeBody } from './bodies.js';
import { MAX_BODIES } from './scenario.js';

/** Fixed physics step, in simulation time units. */
export const DT = 0.5;
/** Simulation time units per real second at time scale 1 (=> 120 steps/s). */
export const TICKS_PER_SEC = 60;

const TRAIL_POINTS = 160; // points kept per trail
const TRAIL_EVERY = 3; // record a trail point every N steps

export class World {
  /** @param {object} settings live settings object (read every step) */
  constructor(settings) {
    this.settings = settings;
    this.bodies = [];
    this.time = 0;
    this.steps = 0;
    this.accDirty = true; // Verlet needs a(t) before its first step
    this.baselineEnergy = null;
    this.onMerge = null; // optional callback(survivor, absorbed)
  }

  /** Replace everything with a scenario's bodies. */
  load(scenario) {
    this.bodies = scenario.bodies.slice(0, MAX_BODIES).map((b) => this.decorate(createBody(b)));
    this.time = 0;
    this.steps = 0;
    this.invalidate();
  }

  /** Current state as a plain scenario object (for sharing, saving, export). */
  toScenario() {
    return { G: this.settings.G, softening: this.settings.softening, bodies: this.bodies.map(describeBody) };
  }

  decorate(b) {
    b.color = colorForMass(b.m);
    return b;
  }

  /** Add a body; returns it, or null if the cap is reached. */
  add(desc) {
    if (this.bodies.length >= MAX_BODIES) return null;
    const b = this.decorate(createBody(desc));
    this.bodies.push(b);
    this.invalidate();
    return b;
  }

  remove(body) {
    this.bodies = this.bodies.filter((b) => b !== body);
    this.invalidate();
  }

  clear() {
    this.bodies = [];
    this.invalidate();
  }

  /**
   * Call after anything changes that affects forces (bodies added/removed,
   * G or softening changed). Re-evaluates accelerations lazily and restarts
   * the energy-drift baseline.
   */
  invalidate() {
    this.accDirty = true;
    this.baselineEnergy = null;
  }

  /** Advance the simulation by one fixed step DT. */
  step() {
    const { G, softening, integrator, collision } = this.settings;
    if (integrator === 'euler') {
      stepEuler(this.bodies, DT, G, softening);
      this.accDirty = true; // Euler's stored a(t) is now stale for Verlet
    } else {
      if (this.accDirty) {
        computeAccelerations(this.bodies, G, softening);
        this.accDirty = false;
      }
      stepVerlet(this.bodies, DT, G, softening);
    }

    const res = resolveCollisions(this.bodies, collision);
    if (res.changed) {
      this.bodies = res.bodies;
      for (const { survivor, absorbed } of res.merges) {
        survivor.color = colorForMass(survivor.m);
        if (this.onMerge) this.onMerge(survivor, absorbed);
      }
      // Positions/masses changed, so stored accelerations are stale.
      this.accDirty = true;
      if (res.merges.length) this.baselineEnergy = null; // merging is inelastic
    }

    this.time += DT;
    this.steps++;
    if (this.steps % TRAIL_EVERY === 0) this.recordTrails();
  }

  recordTrails() {
    for (const b of this.bodies) {
      b.trail.push(b.x, b.y);
      if (b.trail.length > TRAIL_POINTS * 2 + 40) b.trail.splice(0, b.trail.length - TRAIL_POINTS * 2);
    }
  }

  clearTrails() {
    for (const b of this.bodies) b.trail.length = 0;
  }

  centerOfMass() {
    return centerOfMass(this.bodies);
  }

  /**
   * Relative energy drift since the last structural change. With Verlet it
   * should hover near 0; switch to Euler and watch it climb.
   */
  energyDrift() {
    if (this.bodies.length < 2) return null;
    const E = totalEnergy(this.bodies, this.settings.G, this.settings.softening);
    if (this.baselineEnergy === null) {
      this.baselineEnergy = E;
      return 0;
    }
    if (this.baselineEnergy === 0) return null;
    return (E - this.baselineEnergy) / Math.abs(this.baselineEnergy);
  }
}
