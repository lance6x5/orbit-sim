/**
 * input.js - mouse, touch and keyboard handling for the canvas.
 *
 * Mouse:  left-drag on empty space = launch a body; click a body = select;
 *         right/middle-drag or Shift+drag = pan; wheel = zoom.
 * Touch:  one finger drag = launch, tap a body = select;
 *         two fingers = pinch to zoom and drag to pan.
 *
 * `app` provides: camera, hitTest(sx, sy), select(body|null), beginCreate,
 * updateCreate, commitCreate, cancelCreate, onCameraMoved().
 */

const TAP_SLOP = 6; // px of movement still treated as a click/tap

export function attachInput(canvas, app) {
  const pointers = new Map(); // pointerId -> { x, y }
  let mode = null; // 'create' | 'pan' | 'pinch' | 'select' | 'idle'
  let start = null;
  let last = null;
  let pinch = null;

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pinchInfo = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const p = local(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 2) {
      // Second finger: switch to pinch, abandon any launch in progress.
      if (mode === 'create') app.cancelCreate();
      mode = 'pinch';
      pinch = pinchInfo();
      return;
    }
    if (pointers.size > 2) return;

    start = p;
    last = p;
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      mode = 'pan';
      return;
    }
    if (e.button !== 0) return;
    const hit = app.hitTest(p.x, p.y);
    if (hit) {
      mode = 'select';
      app.select(hit);
      return;
    }
    mode = 'create';
    app.beginCreate(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);

    if (mode === 'pinch' && pointers.size === 2) {
      const now = pinchInfo();
      app.camera.pan(now.cx - pinch.cx, now.cy - pinch.cy);
      app.camera.zoomAt(now.cx, now.cy, now.dist / pinch.dist);
      pinch = now;
      app.onCameraMoved();
    } else if (mode === 'pan') {
      app.camera.pan(p.x - last.x, p.y - last.y);
      app.onCameraMoved();
    } else if (mode === 'create') {
      app.updateCreate(p.x, p.y);
    }
    last = p;
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.delete(e.pointerId);
    if (mode === 'create') {
      const moved = Math.hypot(p.x - start.x, p.y - start.y);
      if (e.type === 'pointercancel') app.cancelCreate();
      else if (moved < TAP_SLOP) {
        app.cancelCreate();
        app.select(null); // tap on empty space deselects
      } else {
        app.updateCreate(p.x, p.y);
        app.commitCreate();
      }
    }
    // After a pinch, wait until every finger lifts before doing anything else.
    mode = pointers.size ? 'idle' : null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      app.camera.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
      app.onCameraMoved(true);
    },
    { passive: false },
  );
}

/** True when the keyboard event belongs to a form control or button. */
export function isFormTarget(t) {
  return !!t && t instanceof Element && !!t.closest('input, select, textarea, button, summary, a, dialog, [contenteditable]');
}
