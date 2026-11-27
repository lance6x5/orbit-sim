# Changelog

All notable changes to Gravitas are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-11-27

### Added

- N-body Newtonian gravity with softening, a fixed-timestep accumulator loop, and velocity Verlet integration with an Euler toggle.
- Merge, bounce and pass-through collision modes.
- Drag-to-launch with a velocity arrow and trajectory preview, a log-scale mass slider, and an "Add orbiting body" button.
- Pan, zoom, pinch, touch support, body selection with an info card, and camera follow.
- Play/pause, step, time scale, gravity and softening sliders. Toggles for trails, velocity vectors, and the center-of-mass marker.
- Presets: Sun + planets, Binary star, Figure-eight, Earth-Moon, Random chaos.
- Twinkling parallax starfield, glowing bodies colored by mass, and an FPS / body count / energy drift HUD.
- Share links encoded in the URL hash, saved scenarios, autosave, JSON export/import, and reset-all with confirmation.
- "How it works" panel explaining gravity, softening, the loop and the integrators.
- Installable offline PWA with light and dark themes and the Gravitas logo and icons.
- In-app feedback menu that opens pre-filled GitHub issues, plus bug report and feature request issue templates.
- GitHub Actions deployment to GitHub Pages.

[Unreleased]: https://github.com/lance6x5/orbit-sim/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lance6x5/orbit-sim/releases/tag/v1.0.0
