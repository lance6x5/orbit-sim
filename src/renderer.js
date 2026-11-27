/**
 * renderer.js - draws one frame onto the canvas: starfield, trails, bodies,
 * vectors, center of mass and the launch preview. Never mutates the world.
 */

const VELOCITY_ARROW_SCALE = 18; // world units of arrow per unit of speed

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.width = 1;
    this.height = 1;
    this.sprites = new Map(); // color -> glow sprite canvas
    this.layers = [];
    this.time = 0;
    this.readTheme();
  }

  /** Pick up space background colors from CSS variables (light/dark aware). */
  readTheme() {
    const cs = getComputedStyle(document.documentElement);
    this.space1 = cs.getPropertyValue('--space-1').trim() || '#03020c';
    this.space2 = cs.getPropertyValue('--space-2').trim() || '#0d0a2b';
    this.accent = cs.getPropertyValue('--accent').trim() || '#ffb347';
  }

  resize(w, h) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.buildStarfield();
  }

  /**
   * Three layers of stars. Each layer is a tile the size of the screen that
   * scrolls at a different fraction of the camera movement (parallax): the
   * farthest layer barely moves, the nearest one moves the most.
   */
  buildStarfield() {
    const tile = Math.max(this.width, this.height, 400);
    const area = tile * tile;
    this.tile = tile;
    this.layers = [
      { parallax: 0.02, size: 1, count: Math.round(area / 2600) },
      { parallax: 0.06, size: 1.5, count: Math.round(area / 6000) },
      { parallax: 0.12, size: 2, count: Math.round(area / 16000) },
    ].map((layer) => ({
      ...layer,
      stars: Array.from({ length: layer.count }, () => ({
        x: Math.random() * tile,
        y: Math.random() * tile,
        base: 0.35 + Math.random() * 0.5,
        speed: 0.5 + Math.random() * 2.5, // twinkle rate
        phase: Math.random() * Math.PI * 2,
      })),
    }));
  }

  glowSprite(color) {
    let s = this.sprites.get(color);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, hexA(color, 0.85));
    grd.addColorStop(0.22, hexA(color, 0.4));
    grd.addColorStop(0.5, hexA(color, 0.1));
    grd.addColorStop(1, hexA(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.sprites.set(color, s);
    return s;
  }

  /**
   * @param world   World
   * @param camera  Camera
   * @param view    { trails, vectors, com, selected, preview, frameDt }
   */
  render(world, camera, view) {
    const ctx = this.ctx;
    this.time += view.frameDt || 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(camera);
    if (view.trails) this.drawTrails(world, camera);
    this.drawBodies(world, camera, view.selected);
    if (view.vectors) this.drawVectors(world, camera);
    if (view.com && world.bodies.length) this.drawCenterOfMass(world, camera);
    if (view.preview) this.drawPreview(view.preview, camera);
  }

  drawBackground(camera) {
    const { ctx, width: w, height: h } = this;
    const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    grd.addColorStop(0, this.space2);
    grd.addColorStop(1, this.space1);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    const t = this.time;
    const tile = this.tile;
    ctx.fillStyle = '#ffffff';
    for (const layer of this.layers) {
      // Offset of this layer, wrapped into [0, tile).
      const ox = mod(-camera.x * layer.parallax, tile);
      const oy = mod(-camera.y * layer.parallax, tile);
      for (const s of layer.stars) {
        const x = mod(s.x + ox, tile);
        const y = mod(s.y + oy, tile);
        if (x > w || y > h) continue;
        ctx.globalAlpha = Math.max(0, Math.min(1, s.base + 0.3 * Math.sin(t * s.speed + s.phase)));
        ctx.fillRect(x, y, layer.size, layer.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Trails fade from transparent (oldest) to bright (newest). */
  drawTrails(world, camera) {
    const ctx = this.ctx;
    const CHUNK = 12;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    for (const b of world.bodies) {
      const pts = b.trail;
      const n = pts.length / 2;
      if (n < 2) continue;
      ctx.strokeStyle = b.color;
      for (let c = 0; c < n - 1; c += CHUNK) {
        const end = Math.min(c + CHUNK, n - 1);
        ctx.globalAlpha = 0.55 * (end / n);
        ctx.beginPath();
        let [sx, sy] = camera.worldToScreen(pts[c * 2], pts[c * 2 + 1]);
        ctx.moveTo(sx, sy);
        for (let k = c + 1; k <= end; k++) {
          [sx, sy] = camera.worldToScreen(pts[k * 2], pts[k * 2 + 1]);
          ctx.lineTo(sx, sy);
        }
        if (end === n - 1) {
          [sx, sy] = camera.worldToScreen(b.x, b.y); // connect to the body
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBodies(world, camera, selected) {
    const { ctx, width: w, height: h } = this;
    for (const b of world.bodies) {
      const [sx, sy] = camera.worldToScreen(b.x, b.y);
      const sr = Math.max(1.5, b.r * camera.zoom);
      const glow = sr * 4 + 4;
      if (sx < -glow || sy < -glow || sx > w + glow || sy > h + glow) continue; // off-screen
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.glowSprite(b.color), sx - glow, sy - glow, glow * 2, glow * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      if (sr > 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(sx - sr * 0.25, sy - sr * 0.25, sr * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      if (b === selected) {
        ctx.strokeStyle = this.accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, sr + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  drawVectors(world, camera) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(140, 230, 255, 0.9)';
    ctx.fillStyle = 'rgba(140, 230, 255, 0.9)';
    ctx.lineWidth = 1.5;
    for (const b of world.bodies) {
      const [x1, y1] = camera.worldToScreen(b.x, b.y);
      const [x2, y2] = camera.worldToScreen(b.x + b.vx * VELOCITY_ARROW_SCALE, b.y + b.vy * VELOCITY_ARROW_SCALE);
      arrow(ctx, x1, y1, x2, y2, 6);
    }
  }

  drawCenterOfMass(world, camera) {
    const ctx = this.ctx;
    const com = world.centerOfMass();
    const [x, y] = camera.worldToScreen(com.x, com.y);
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
  }

  /** preview = { x, y, vx, vy, m, r, color, endX, endY, path: {points, hit} } */
  drawPreview(p, camera) {
    const ctx = this.ctx;
    // Predicted trajectory (dashed).
    if (p.path && p.path.points.length >= 4) {
      const pts = p.path.points;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      let [sx, sy] = camera.worldToScreen(pts[0], pts[1]);
      ctx.moveTo(sx, sy);
      for (let k = 2; k < pts.length; k += 2) {
        [sx, sy] = camera.worldToScreen(pts[k], pts[k + 1]);
        ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (p.path.hit) {
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy - 6);
        ctx.lineTo(sx + 6, sy + 6);
        ctx.moveTo(sx + 6, sy - 6);
        ctx.lineTo(sx - 6, sy + 6);
        ctx.stroke();
      }
    }
    // Ghost body.
    const [bx, by] = camera.worldToScreen(p.x, p.y);
    const sr = Math.max(2, p.r * camera.zoom);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(bx, by, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Launch arrow (drag direction and length = velocity).
    const [ex, ey] = camera.worldToScreen(p.endX, p.endY);
    ctx.strokeStyle = this.accent;
    ctx.fillStyle = this.accent;
    ctx.lineWidth = 2.5;
    arrow(ctx, bx, by, ex, ey, 10);
  }
}

function arrow(ctx, x1, y1, x2, y2, head) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len * 0.5);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * h - uy * h * 0.5, y2 - uy * h + ux * h * 0.5);
  ctx.lineTo(x2 - ux * h + uy * h * 0.5, y2 - uy * h - ux * h * 0.5);
  ctx.closePath();
  ctx.fill();
}

const mod = (a, n) => ((a % n) + n) % n;

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
