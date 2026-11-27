<p align="center"><img src="public/logo.svg" alt="Gravitas logo" width="280" /></p>

# Gravitas

![Visits](https://abacus.jasoncameron.dev/get/lance6x5.github.io/orbit-sim/shield)

**Every body attracts.** Gravitas is an interactive N-body gravity sandbox where the simulation runs entirely in your browser. Launch planets with a flick, build binary stars, watch the famous figure-eight three-body orbit, and switch integrators to see why physics engines care about numerical methods. The source is commented so it doubles as a learning resource for simulation loops.

Live: https://lance6x5.github.io/orbit-sim/

## Features

- **Physics:** N-body Newtonian gravity with a softening factor, a fixed-timestep loop (accumulator pattern) decoupled from `requestAnimationFrame` rendering, velocity Verlet integration with an Euler toggle, and merge / bounce / pass-through collisions. An energy-drift readout shows how well each integrator conserves energy.
- **Interaction:** drag on empty space to launch a body (the arrow sets velocity, and a dashed line previews its trajectory). A log-scale mass slider sets the mass. Pan with right-drag or Shift+drag, zoom with the wheel or a pinch, and click a body to inspect it or make the camera follow it. Touch is supported.
- **Controls:** play/pause, step one frame, time scale, gravity constant G, softening, trails, velocity vectors, center-of-mass marker, "fit all" and "add orbiting body".
- **Presets:** Sun + planets, Binary star, Figure-eight, Earth-Moon, Random chaos.
- **Visuals:** a twinkling parallax starfield and glowing bodies colored by mass. FPS and body count are shown, and it stays smooth with about 200 bodies.
- **Sharing:** "Copy share link" encodes the current bodies into the URL hash (`#s=...`).
- **Your data:** saved scenarios, settings, and an autosave of the last scene are kept in `localStorage`. You can export or import everything as JSON, and "Reset all data" asks for confirmation first.
- **PWA:** installable and works offline (vite-plugin-pwa). Light and dark themes follow your system setting.
- **In-app feedback:** the header's Feedback menu opens a pre-filled GitHub issue.
- **Visit count:** a small anonymous page-load count in the Controls panel footer (see [Privacy & analytics](#privacy--analytics)).

### Keyboard

| Key | Action |
| --- | --- |
| Space | Play / pause |
| `.` | Step one frame |
| Arrow keys | Pan |
| `+` / `-` | Zoom |
| `[` / `]` | Select previous / next body |
| `F` | Toggle camera follow |
| Delete | Remove selected body |
| Esc | Cancel launch / deselect |

## Privacy & analytics

Your scenarios and settings never leave your device. The only outside request is an anonymous visit count: one page-load count per browser session via the open-source [Abacus](https://github.com/JasonLovesDoggo/abacus) counter.

- No cookies and no personal data are stored. No app or scenario data is sent (the share-link hash is never read by the counter).
- Do Not Track and Global Privacy Control are respected: with either on, the page is not counted (it only reads the current total). Nothing is counted on `localhost`.
- Like any web request, it reveals your IP address to the counter service.
- The count is approximate (it includes bots and is not unique visitors) and public.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run unit tests once (Vitest)
npm run build    # production build into dist/
npm run preview  # serve the production build
```

Project layout:

```
src/physics.js   gravity, integrators, collisions, energy, trajectory prediction (pure, tested)
src/loop.js      fixed-timestep accumulator loop
src/world.js     body list, stepping, trails, energy drift
src/camera.js    world <-> screen transforms, pan/zoom/fit
src/renderer.js  canvas drawing (starfield, trails, bodies, overlays)
src/input.js     mouse / touch / pinch handling
src/presets.js   built-in scenarios
src/scenario.js  validation, URL-hash sharing, JSON export/import
src/settings.js  defaults + localStorage persistence
src/feedback.js  GitHub issue URL builder
src/visits.js    anonymous visit counter (Abacus)
src/main.js      wiring and DOM controls
```

## Deploy (GitHub Pages)

1. Push to `main`. The workflow in `.github/workflows/deploy.yml` installs dependencies, runs the tests, builds, and deploys.
2. One-time setup: **Repo Settings → Pages → Source: "GitHub Actions"**.
3. The app is served at `https://<user>.github.io/orbit-sim/`. `vite.config.js` sets `base: '/orbit-sim/'`, so change it if you rename the repo.

## Feedback & issues

- Browse or search [Issues](https://github.com/lance6x5/orbit-sim/issues).
- [Report a bug](https://github.com/lance6x5/orbit-sim/issues/new?template=bug_report.yml) or [request a feature](https://github.com/lance6x5/orbit-sim/issues/new?template=feature_request.yml).
- Inside the app, the **Feedback** menu in the header opens these forms with the app version (and, for bugs, your browser) filled in. No scenario data is ever sent. You need a free GitHub account to submit.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the triage flow.

## Versioning

Gravitas follows [Semantic Versioning](https://semver.org/). The version lives in `package.json` and is shown in the Controls panel footer and the "How it works" dialog.

- **MAJOR**: a breaking data or schema change, such as old exports or share links no longer loading.
- **MINOR**: new features that stay backward compatible.
- **PATCH**: bug fixes.

Changes are recorded in [CHANGELOG.md](CHANGELOG.md), and each release is tagged `vX.Y.Z` with a matching GitHub release.
