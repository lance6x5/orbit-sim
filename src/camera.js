/**
 * camera.js - converts between world coordinates and screen (CSS pixel)
 * coordinates. (x, y) is the world point at the center of the screen.
 */
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.width = 1; // viewport size in CSS pixels
    this.height = 1;
  }

  setViewport(w, h) {
    this.width = w;
    this.height = h;
  }

  worldToScreen(wx, wy) {
    return [(wx - this.x) * this.zoom + this.width / 2, (wy - this.y) * this.zoom + this.height / 2];
  }

  screenToWorld(sx, sy) {
    return [(sx - this.width / 2) / this.zoom + this.x, (sy - this.height / 2) / this.zoom + this.y];
  }

  /** Move the view by a screen-space delta (drag to pan). */
  pan(dxPx, dyPx) {
    this.x -= dxPx / this.zoom;
    this.y -= dyPx / this.zoom;
  }

  /** Zoom by `factor`, keeping the world point under (sx, sy) fixed. */
  zoomAt(sx, sy, factor) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    const [nx, ny] = this.screenToWorld(sx, sy);
    this.x += wx - nx;
    this.y += wy - ny;
  }

  /** Center and zoom so all bodies are visible with some padding. */
  fit(bodies, padding = 60) {
    if (!bodies.length) {
      this.x = 0;
      this.y = 0;
      this.zoom = 1;
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of bodies) {
      minX = Math.min(minX, b.x - b.r);
      minY = Math.min(minY, b.y - b.r);
      maxX = Math.max(maxX, b.x + b.r);
      maxY = Math.max(maxY, b.y + b.r);
    }
    this.x = (minX + maxX) / 2;
    this.y = (minY + maxY) / 2;
    const w = Math.max(maxX - minX, 50);
    const h = Math.max(maxY - minY, 50);
    const z = Math.min((this.width - padding * 2) / w, (this.height - padding * 2) / h);
    this.zoom = Math.min(2, Math.max(MIN_ZOOM, z));
  }
}
