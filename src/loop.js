/**
 * loop.js - fixed-timestep simulation loop (the "accumulator pattern").
 *
 * Rendering happens whenever the browser gives us a frame (requestAnimationFrame,
 * usually 60 Hz but could be 30, 120, or stutter). Physics, however, must use a
 * CONSTANT dt: integrator accuracy and stability depend on it, and a variable
 * dt would make the same scenario behave differently on different machines.
 *
 * So each frame we add the real elapsed time (times the time-scale slider) to
 * an "accumulator", then run as many fixed-size physics steps as fit, carrying
 * the remainder to the next frame:
 *
 *   accumulator += elapsed
 *   while (accumulator >= dt) { step(dt); accumulator -= dt }
 *   render()
 *
 * If the machine can't keep up, the accumulator would grow forever (the
 * "spiral of death"). We cap the steps per frame and drop the backlog, so the
 * simulation just runs slower instead of freezing the tab.
 */

/** Pure helper: how many steps to run for this frame. */
export function consumeTime(accumulator, elapsed, dt, maxSteps) {
  let acc = accumulator + elapsed;
  let steps = 0;
  while (acc >= dt && steps < maxSteps) {
    acc -= dt;
    steps++;
  }
  if (acc >= dt) acc = 0; // could not keep up: drop the backlog
  return { steps, accumulator: acc };
}

/**
 * Start the loop.
 *   dt            fixed simulation step (simulation time units)
 *   ticksPerSec   simulation time units per real second at time scale 1
 *   getTimeScale  () => number
 *   isRunning     () => boolean
 *   step          () => void          one physics step
 *   render        (frameSeconds) => void
 */
export function startLoop({ dt, ticksPerSec, maxSteps = 40, getTimeScale, isRunning, step, render }) {
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    // Clamp huge gaps (tab was in the background) to a quarter second.
    const realDt = Math.min((now - last) / 1000, 0.25);
    last = now;
    if (isRunning()) {
      const r = consumeTime(accumulator, realDt * ticksPerSec * getTimeScale(), dt, maxSteps);
      accumulator = r.accumulator;
      for (let i = 0; i < r.steps; i++) step();
    }
    render(realDt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
