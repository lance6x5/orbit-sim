/**
 * main.js - wires the simulation, renderer, input and DOM controls together.
 */
import './style.css';
import { World, DT, TICKS_PER_SEC } from './world.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { startLoop } from './loop.js';
import { attachInput, isFormTarget } from './input.js';
import { predictTrajectory, radiusForMass } from './physics.js';
import { colorForMass, sliderToMass, massToSlider } from './bodies.js';
import { PRESETS, buildPreset } from './presets.js';
import { storage, sanitizeSettings, DEFAULT_SETTINGS } from './settings.js';
import { validateScenario, encodeScenario, scenarioFromHash, buildExport, parseImport, MAX_BODIES } from './scenario.js';
import { buildIssueUrl } from './feedback.js';
import { $, toast, confirmDialog, downloadJson, fmt } from './ui.js';

/* global __APP_VERSION__ */
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

/** Launch speed per world unit of drag distance. */
const LAUNCH_SCALE = 0.02;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const settings = { ...storage.loadSettings() };
let saved = storage.loadSaved();
let running = true;
let selected = null;
let follow = false;
let create = null; // launch-in-progress: { sx, sy, ex, ey, path, pathAt }

const canvas = $('#sim');
const world = new World(settings);
const camera = new Camera();
const renderer = new Renderer(canvas);

world.onMerge = (survivor, absorbed) => {
  if (selected === absorbed) selected = survivor;
};

// ---------------------------------------------------------------------------
// Sizing and theme
// ---------------------------------------------------------------------------
function resize() {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  camera.setViewport(w, h);
  renderer.resize(w, h);
}
new ResizeObserver(resize).observe(canvas);
resize();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => renderer.readTheme());

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
function loadScenario(scn, message) {
  settings.G = scn.G;
  settings.softening = scn.softening;
  world.load(scn);
  selected = null;
  follow = false;
  create = null;
  camera.fit(world.bodies);
  syncControls();
  persistSettings();
  if (message) toast(message);
}

function loadPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  loadScenario(buildPreset(id), `Loaded "${p ? p.name : id}"`);
}

function initialScenario() {
  try {
    const fromHash = scenarioFromHash(location.hash);
    if (fromHash) return loadScenario(fromHash, 'Loaded shared scenario');
  } catch (err) {
    toast(err.message);
  }
  const last = storage.loadLast();
  if (last) {
    try {
      return loadScenario(validateScenario(last));
    } catch {
      /* fall through to the default preset */
    }
  }
  loadScenario(buildPreset('solar'));
}

window.addEventListener('hashchange', () => {
  try {
    const scn = scenarioFromHash(location.hash);
    if (scn) loadScenario(scn, 'Loaded shared scenario');
  } catch (err) {
    toast(err.message);
  }
});

function autosave() {
  storage.saveLast(world.toScenario());
}
setInterval(autosave, 10000);
window.addEventListener('pagehide', autosave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosave();
});

// ---------------------------------------------------------------------------
// Interaction callbacks (used by input.js)
// ---------------------------------------------------------------------------
const app = {
  camera,
  hitTest(sx, sy) {
    let best = null;
    let bestD = Infinity;
    for (const b of world.bodies) {
      const [bx, by] = camera.worldToScreen(b.x, b.y);
      const d = Math.hypot(bx - sx, by - sy);
      const reach = Math.max(b.r * camera.zoom, 10) + 4;
      if (d <= reach && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  },
  select,
  beginCreate(sx, sy) {
    const [wx, wy] = camera.screenToWorld(sx, sy);
    create = { sx: wx, sy: wy, ex: wx, ey: wy, path: null, pathAt: 0, dirty: true };
  },
  updateCreate(sx, sy) {
    if (!create) return;
    [create.ex, create.ey] = camera.screenToWorld(sx, sy);
    create.dirty = true;
  },
  commitCreate() {
    if (!create) return;
    const b = world.add(launchBody());
    create = null;
    if (!b) toast(`Body limit reached (${MAX_BODIES}).`);
  },
  cancelCreate() {
    create = null;
  },
  onCameraMoved(isZoom) {
    if (!isZoom && follow) setFollow(false);
  },
};

/** The body described by the current drag: velocity = drag vector * scale. */
function launchBody() {
  let vx = (create.ex - create.sx) * LAUNCH_SCALE;
  let vy = (create.ey - create.sy) * LAUNCH_SCALE;
  // When following a body, launch relative to it (handy for moons).
  if (follow && selected) {
    vx += selected.vx;
    vy += selected.vy;
  }
  return { x: create.sx, y: create.sy, vx, vy, m: settings.newMass };
}

function select(b) {
  selected = b;
  if (!b && follow) setFollow(false);
  updateSelectionCard();
}

function setFollow(on) {
  follow = on && !!selected;
  $('#sel-follow').checked = follow;
}

attachInput(canvas, app);

// ---------------------------------------------------------------------------
// Simulation loop
// ---------------------------------------------------------------------------
let fps = 0;
let frames = 0;
let fpsTime = 0;

function render(frameDt) {
  // Drop the selection if the body is gone (deleted or cleared).
  if (selected && !world.bodies.includes(selected)) select(null);
  if (follow && selected) {
    camera.x = selected.x;
    camera.y = selected.y;
  }

  let preview = null;
  if (create) {
    const desc = launchBody();
    const now = performance.now();
    // Re-predict when the drag moves, or every 120 ms as the others move.
    if (create.dirty || now - create.pathAt > 120) {
      const probe = { ...desc, r: radiusForMass(desc.m) };
      create.path = predictTrajectory(world.bodies, probe, { G: settings.G, softening: settings.softening, dt: DT * 2, steps: 500 });
      create.pathAt = now;
      create.dirty = false;
    }
    preview = {
      ...desc,
      r: radiusForMass(desc.m),
      color: colorForMass(desc.m),
      endX: create.ex,
      endY: create.ey,
      path: create.path,
    };
  }

  renderer.render(world, camera, {
    trails: settings.trails,
    vectors: settings.vectors,
    com: settings.com,
    selected,
    preview,
    frameDt,
  });

  frames++;
  fpsTime += frameDt;
  if (fpsTime >= 0.5) {
    fps = Math.round(frames / fpsTime);
    frames = 0;
    fpsTime = 0;
    updateHud();
    updateSelectionCard();
  }
}

startLoop({
  dt: DT,
  ticksPerSec: TICKS_PER_SEC,
  getTimeScale: () => settings.timeScale,
  isRunning: () => running,
  step: () => world.step(),
  render,
});

function updateHud() {
  $('#hud-fps').textContent = fps;
  $('#hud-count').textContent = world.bodies.length;
  const drift = world.energyDrift();
  $('#hud-energy').textContent = drift === null ? '-' : `${(drift * 100).toFixed(drift > 0.1 ? 0 : 2)}%`;
  $('#hud-integrator').textContent = settings.integrator === 'euler' ? 'Euler' : 'Verlet';
}

function updateSelectionCard() {
  const card = $('#selection');
  if (!selected) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  $('#sel-title').textContent = `Body #${selected.id}`;
  $('#sel-mass').textContent = fmt(selected.m, 1);
  $('#sel-speed').textContent = fmt(Math.hypot(selected.vx, selected.vy), 3);
  $('#sel-pos').textContent = `${fmt(selected.x, 0)}, ${fmt(selected.y, 0)}`;
  $('#sel-follow').checked = follow;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
function persistSettings() {
  storage.saveSettings(settings);
}

function syncControls() {
  $('#in-timeScale').value = settings.timeScale;
  $('#out-timeScale').textContent = `${settings.timeScale}x`;
  $('#in-G').value = settings.G;
  $('#out-G').textContent = settings.G;
  $('#in-softening').value = settings.softening;
  $('#out-softening').textContent = settings.softening;
  $('#in-newMass').value = massToSlider(settings.newMass);
  $('#out-newMass').textContent = settings.newMass;
  $('#in-collision').value = settings.collision;
  for (const r of document.querySelectorAll('input[name="integrator"]')) r.checked = r.value === settings.integrator;
  $('#in-trails').checked = settings.trails;
  $('#in-vectors').checked = settings.vectors;
  $('#in-com').checked = settings.com;
  updateHud();
}

function bindSlider(key, { parse = Number, label = (v) => v, invalidate = false } = {}) {
  const input = $(`#in-${key}`);
  input.addEventListener('input', () => {
    settings[key] = parse(input.value);
    $(`#out-${key}`).textContent = label(settings[key]);
    if (invalidate) world.invalidate();
    persistSettings();
  });
}
bindSlider('timeScale', { label: (v) => `${v}x` });
bindSlider('G', { invalidate: true });
bindSlider('softening', { invalidate: true });
bindSlider('newMass', { parse: (v) => sliderToMass(Number(v)) });

for (const r of document.querySelectorAll('input[name="integrator"]')) {
  r.addEventListener('change', () => {
    settings.integrator = r.value;
    world.accDirty = true;
    persistSettings();
    updateHud();
    toast(r.value === 'euler' ? 'Euler: watch orbits drift outward' : 'Velocity Verlet: orbits stay closed');
  });
}
$('#in-collision').addEventListener('change', (e) => {
  settings.collision = e.target.value;
  persistSettings();
});
for (const key of ['trails', 'vectors', 'com']) {
  $(`#in-${key}`).addEventListener('change', (e) => {
    settings[key] = e.target.checked;
    if (key === 'trails' && !settings.trails) world.clearTrails();
    persistSettings();
  });
}

function setRunning(on) {
  running = on;
  const btn = $('#btn-play');
  btn.textContent = on ? 'Pause' : 'Play';
  btn.setAttribute('aria-pressed', String(on));
}
$('#btn-play').addEventListener('click', () => setRunning(!running));

/** Advance one rendered frame's worth of simulation time, then pause. */
function stepFrame() {
  setRunning(false);
  const steps = Math.max(1, Math.round((TICKS_PER_SEC * settings.timeScale) / 60 / DT));
  for (let i = 0; i < steps; i++) world.step();
}
$('#btn-step').addEventListener('click', stepFrame);

$('#btn-fit').addEventListener('click', () => {
  setFollow(false);
  camera.fit(world.bodies);
});

/** Add a body in a circular orbit around the heaviest body (keyboard friendly). */
$('#btn-add-orbit').addEventListener('click', () => {
  const m = settings.newMass;
  if (!world.bodies.length) {
    world.add({ x: camera.x, y: camera.y, vx: 0, vy: 0, m });
    return;
  }
  const host = world.bodies.reduce((a, b) => (b.m > a.m ? b : a));
  const r = host.r * 3 + 30 + Math.random() * 300;
  const ang = Math.random() * Math.PI * 2;
  const v = Math.sqrt((settings.G * (host.m + m)) / r);
  const b = world.add({
    x: host.x + r * Math.cos(ang),
    y: host.y + r * Math.sin(ang),
    vx: host.vx - v * Math.sin(ang),
    vy: host.vy + v * Math.cos(ang),
    m,
  });
  if (!b) toast(`Body limit reached (${MAX_BODIES}).`);
  else toast(`Added body #${b.id} orbiting body #${host.id}`);
});

// Selection card
$('#sel-close').addEventListener('click', () => select(null));
$('#sel-follow').addEventListener('change', (e) => setFollow(e.target.checked));
$('#sel-delete').addEventListener('click', () => {
  if (!selected) return;
  world.remove(selected);
  select(null);
});

// Presets
const presetList = $('#preset-list');
for (const p of PRESETS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = p.name;
  btn.addEventListener('click', () => loadPreset(p.id));
  presetList.appendChild(btn);
}

$('#btn-clear').addEventListener('click', () => {
  world.clear();
  select(null);
  toast('Cleared all bodies');
});

// Share link
$('#btn-share').addEventListener('click', async () => {
  const hash = `#s=${encodeScenario(world.toScenario())}`;
  history.replaceState(null, '', hash);
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Share link copied to clipboard');
  } catch {
    toast('Share link is in the address bar');
  }
});

// ---------------------------------------------------------------------------
// Saved scenarios
// ---------------------------------------------------------------------------
function renderSaved() {
  const list = $('#saved-list');
  list.textContent = '';
  $('#saved-empty').hidden = saved.length > 0;
  saved.forEach((s, i) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'saved-name';
    name.textContent = `${s.name} (${s.scenario.bodies.length})`;
    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'btn btn-small';
    load.textContent = 'Load';
    load.setAttribute('aria-label', `Load ${s.name}`);
    load.addEventListener('click', () => {
      try {
        loadScenario(validateScenario(s.scenario), `Loaded "${s.name}"`);
      } catch (err) {
        toast(err.message);
      }
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-small btn-danger';
    del.textContent = 'Delete';
    del.setAttribute('aria-label', `Delete ${s.name}`);
    del.addEventListener('click', async () => {
      if (!(await confirmDialog(`Delete saved scenario "${s.name}"?`, 'Delete'))) return;
      saved.splice(i, 1);
      storage.saveSaved(saved);
      renderSaved();
    });
    li.append(name, load, del);
    list.appendChild(li);
  });
}

$('#save-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#save-name');
  const name = input.value.trim().slice(0, 60);
  if (!name) return;
  const entry = { name, savedAt: new Date().toISOString(), scenario: world.toScenario() };
  const idx = saved.findIndex((s) => s.name === name);
  if (idx >= 0) saved[idx] = entry;
  else saved.push(entry);
  if (!storage.saveSaved(saved)) toast('Could not save (storage unavailable or full)');
  else toast(`Saved "${name}"`);
  input.value = '';
  renderSaved();
});

// ---------------------------------------------------------------------------
// Export / import / reset
// ---------------------------------------------------------------------------
$('#btn-export').addEventListener('click', () => {
  const data = buildExport({ appVersion: VERSION, settings, scenario: world.toScenario(), saved });
  downloadJson(`gravitas-${new Date().toISOString().slice(0, 10)}.json`, data);
  toast('Exported JSON');
});

$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = parseImport(await file.text());
    Object.assign(settings, sanitizeSettings({ ...settings, ...data.settings }));
    for (const s of data.saved) {
      const idx = saved.findIndex((x) => x.name === s.name);
      if (idx >= 0) saved[idx] = s;
      else saved.push(s);
    }
    storage.saveSaved(saved);
    renderSaved();
    if (data.scenario) loadScenario(data.scenario);
    syncControls();
    persistSettings();
    toast(`Imported ${data.saved.length} saved scenario(s)`);
  } catch (err) {
    toast(`Import failed: ${err.message}`);
  }
});

$('#btn-reset').addEventListener('click', async () => {
  const ok = await confirmDialog(
    'This deletes your settings, saved scenarios and the autosaved scene from this browser. Export first if you want a backup.',
    'Reset everything',
  );
  if (!ok) return;
  storage.clearAll();
  Object.assign(settings, DEFAULT_SETTINGS);
  saved = [];
  renderSaved();
  history.replaceState(null, '', location.pathname + location.search);
  loadScenario(buildPreset('solar'));
  storage.clearAll(); // loadScenario re-persisted settings; leave storage empty
  setRunning(true);
  toast('All data reset');
});

// ---------------------------------------------------------------------------
// Panel, dialogs, keyboard
// ---------------------------------------------------------------------------
const panel = $('#panel');
const panelBtn = $('#btn-panel');
function setPanel(open) {
  panel.classList.toggle('open', open);
  panelBtn.setAttribute('aria-expanded', String(open));
}
panelBtn.addEventListener('click', () => {
  const open = !panel.classList.contains('open');
  setPanel(open);
  if (open) panel.focus();
});
setPanel(window.matchMedia('(min-width: 900px)').matches);
$('.skip-link').addEventListener('click', () => setPanel(true));

const help = $('#help-dialog');
$('#btn-help').addEventListener('click', () => help.showModal());
help.querySelector('[data-close]').addEventListener('click', () => help.close());
help.addEventListener('click', (e) => {
  if (e.target === help) help.close(); // click on the backdrop
});

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isFormTarget(e.target)) return;
  const PAN = 60;
  switch (e.key) {
    case ' ':
      setRunning(!running);
      break;
    case '.':
      stepFrame();
      break;
    case 'ArrowLeft':
      camera.pan(PAN, 0);
      setFollow(false);
      break;
    case 'ArrowRight':
      camera.pan(-PAN, 0);
      setFollow(false);
      break;
    case 'ArrowUp':
      camera.pan(0, PAN);
      setFollow(false);
      break;
    case 'ArrowDown':
      camera.pan(0, -PAN);
      setFollow(false);
      break;
    case '+':
    case '=':
      camera.zoomAt(camera.width / 2, camera.height / 2, 1.2);
      break;
    case '-':
    case '_':
      camera.zoomAt(camera.width / 2, camera.height / 2, 1 / 1.2);
      break;
    case '[':
    case ']': {
      const n = world.bodies.length;
      if (!n) return;
      const i = selected ? world.bodies.indexOf(selected) : -1;
      const next = e.key === ']' ? (i + 1) % n : (i - 1 + n) % n;
      select(world.bodies[next]);
      break;
    }
    case 'f':
    case 'F':
      setFollow(!follow);
      break;
    case 'Delete':
    case 'Backspace':
      if (!selected) return;
      world.remove(selected);
      select(null);
      break;
    case 'Escape':
      if (create) create = null;
      else select(null);
      break;
    default:
      return;
  }
  e.preventDefault();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
for (const el of document.querySelectorAll('.app-version')) el.textContent = `v${VERSION}`;
// Feedback links: only the app version and browser info, never user data.
const fbInfo = { version: VERSION, userAgent: navigator.userAgent };
$('#fb-bug').href = buildIssueUrl('bug', fbInfo);
$('#fb-feature').href = buildIssueUrl('feature', fbInfo);
const fbMenu = $('#feedback-menu');
fbMenu.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fbMenu.open) {
    fbMenu.open = false;
    fbMenu.querySelector('summary').focus();
    e.stopPropagation();
  }
});
document.addEventListener('click', (e) => {
  if (fbMenu.open && !fbMenu.contains(e.target)) fbMenu.open = false;
});
renderSaved();
initialScenario();
syncControls();
