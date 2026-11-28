# Changelog

All notable changes to Gravitas are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.1] - 2026-11-27

### Changed
- Footer studio credit now uses the Silverlight DevTech company mark (the "47 Ag" periodic-table tile), replacing the interim crescent mark.

## [1.2.0] - 2026-11-27

### Added

- `LICENSE.md`: Gravitas is now source-available under the PolyForm Noncommercial License 1.0.0.
- Studio credit in the Controls panel footer (and the "How it works" dialog): Silverlight DevTech mark, copyright, a link to the license, and a "More apps" link to the apps homepage (https://lance6x5.github.io/).
- `author` / `copyright` meta tags, plus README License and Trademarks sections and a contribution licensing note.

### Changed

- Licensed under PolyForm Noncommercial 1.0.0 (`license` / `author` fields in `package.json`). Previous versions shipped without a license file (all rights reserved); this is the first license.

## [1.1.0] - 2026-11-27

### Added

- Anonymous visit counter in the Controls panel footer, using the open-source Abacus service: one count per browser session, nothing counted on localhost or with Do Not Track / Global Privacy Control, no cookies or app data sent, and it fails silently. The service worker never caches these requests.
- README visits badge and a "Privacy & analytics" section.

### Changed

- Privacy wording in the README and "How it works" dialog now mentions the anonymous visit count.

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

[Unreleased]: https://github.com/lance6x5/orbit-sim/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/lance6x5/orbit-sim/compare/v1.2.0...v1.2.1
[1.1.0]: https://github.com/lance6x5/orbit-sim/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/lance6x5/orbit-sim/releases/tag/v1.0.0
