// The fields as illustrations: soft grass and stone underfoot, hedges, trees, reeds and cliffs drawn
// as round outlined shapes, water with a bank and drifting ripples. Every tile is drawn on its own
// canvas (0-100 units), but the shapes are worked out from the neighbours, so a wall made of many
// tiles reads as one bush line with one outline round it.
//
// Wall masks (textures.js): bit set = that side is open. `open` sides face ground you can see, `dark`
// sides face solid wall that is never drawn (the void around a field); both get an edge.

import { INK, LW, C, unit, rng, ellipse, circle, paint, within, mix, hexA } from './ink.js';

export const N = 1, E = 2, S = 4, W_ = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const M = 7;            // how far an edge stands back from the side of its tile
const FACE_TOP = 42;    // where a wall's top ends and its front begins
const TW = LW * 0.92;   // outline width on the ground

// ---------- shapes ----------
// The outline of a region that reaches past its closed sides and stops at l/t/r/b on its exposed
// ones, rounded where two exposed sides meet. Exposed edges are shaped by bump(u): u runs along the
// edge in tile units, and every bump repeats a whole number of times per tile, so two tiles agree
// where they meet.
function region(g, { l, t, r, b, ex, R = 24, bump = () => 0, arcBump = 0 }) {
  const pts = [], step = 2;
  const nw = ex.n && ex.w, ne = ex.n && ex.e, se = ex.s && ex.e, sw = ex.s && ex.w;
  const line = (x0, y0, x1, y1, nx, ny, on) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      const d = on ? bump(ny ? x : y) : 0;
      pts.push([x + nx * d, y + ny * d]);
    }
  };
  const arc = (cx, cy, a0) => {
    const n = 12;
    for (let k = 0; k <= n; k++) {
      const a = a0 + (Math.PI / 2) * k / n, d = arcBump * Math.abs(Math.sin(Math.PI * 2 * k / n));
      pts.push([cx + Math.cos(a) * (R + d), cy + Math.sin(a) * (R + d)]);
    }
  };
  line(nw ? l + R : l, t, ne ? r - R : r, t, 0, -1, ex.n);
  if (ne) arc(r - R, t + R, -Math.PI / 2);
  line(r, ne ? t + R : t, r, se ? b - R : b, 1, 0, ex.e);
  if (se) arc(r - R, b - R, 0);
  line(se ? r - R : r, b, sw ? l + R : l, b, 0, 1, ex.s);
  if (sw) arc(l + R, b - R, Math.PI / 2);
  line(l, sw ? b - R : b, l, nw ? t + R : t, -1, 0, ex.w);
  if (nw) arc(l + R, t + R, Math.PI);
  g.beginPath();
  pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
}

// edge shapes
const scallop = (amp, per) => u => amp * Math.abs(Math.sin(Math.PI * u / per));
const wave = (amp, per) => u => amp * (0.5 + 0.5 * Math.sin(Math.PI * 2 * u / per));
const rocky = amp => u => amp * (0.55 + 0.25 * Math.sin(Math.PI * 2 * u / 50) + 0.2 * Math.sin(Math.PI * 2 * u / 20 + 1));
const flat = () => 0;

// which sides are exposed (open ground or the dark), as booleans
const sides = m => ({ n: !!(m & N), e: !!(m & E), s: !!(m & S), w: !!(m & W_) });

// fill the area outside a region with `col` (or clear it), within the tile
function outside(g, path, col) {
  g.save();
  g.beginPath(); g.rect(-5, -5, 110, 110);
  path();
  g.clip('evenodd');
  if (col) { g.fillStyle = col; g.fillRect(-5, -5, 110, 110); } else g.clearRect(-5, -5, 110, 110);
  g.restore();
}

// ---------- ground ----------
// little grass blades: two or three strokes from one root
function tuft(g, x, y, col, s = 1) {
  g.strokeStyle = col; g.lineWidth = 2.2 * s; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y); g.quadraticCurveTo(x - 1.5 * s, y - 3 * s, x - 3.5 * s, y - 5 * s);
  g.moveTo(x, y); g.quadraticCurveTo(x + 0.3 * s, y - 4 * s, x + 0.8 * s, y - 6.5 * s);
  g.moveTo(x, y); g.quadraticCurveTo(x + 2 * s, y - 2.5 * s, x + 4 * s, y - 4 * s);
  g.stroke();
}
function flower(g, x, y, petal, mid, r = 2.6) {
  g.fillStyle = petal;
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; circle(g, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.85); g.fill(); }
  g.lineWidth = 1.2; g.strokeStyle = hexA(INK, 0.55);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; circle(g, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.85); g.stroke(); }
  circle(g, x, y, r * 0.75); g.fillStyle = mid; g.fill();
}
function pebble(g, x, y, rx, ry, col) {
  ellipse(g, x, y, rx, ry); g.fillStyle = col; g.fill();
  g.lineWidth = 1.6; g.strokeStyle = hexA(INK, 0.6); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(g, x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.25); g.fill();
}
function leafBit(g, x, y, col, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(0, -3.4, 4, 0); g.quadraticCurveTo(0, 3.4, -4, 0); g.closePath();
  g.fillStyle = col; g.fill(); g.lineWidth = 1.1; g.strokeStyle = hexA(INK, 0.5); g.stroke();
  g.restore();
}
function crystal(g, x, y, s, light, dark) {
  g.beginPath(); g.moveTo(x, y - 7 * s); g.lineTo(x + 3.4 * s, y - 2 * s); g.lineTo(x + 2.4 * s, y + 2 * s); g.lineTo(x - 2.4 * s, y + 2 * s); g.lineTo(x - 3.4 * s, y - 2 * s); g.closePath();
  g.fillStyle = light; g.fill();
  g.beginPath(); g.moveTo(x, y - 7 * s); g.lineTo(x + 3.4 * s, y - 2 * s); g.lineTo(x + 2.4 * s, y + 2 * s); g.lineTo(x, y + 2 * s); g.closePath(); g.fillStyle = dark; g.fill();
  g.beginPath(); g.moveTo(x, y - 7 * s); g.lineTo(x + 3.4 * s, y - 2 * s); g.lineTo(x + 2.4 * s, y + 2 * s); g.lineTo(x - 2.4 * s, y + 2 * s); g.lineTo(x - 3.4 * s, y - 2 * s); g.closePath();
  g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
}

// the plain ground of a zone: its colour with soft flecks, never touching the sides (tiles meet seamlessly)
function groundBase(g, z, r) {
  g.fillStyle = z.floor; g.fillRect(0, 0, 100, 100);
  if (z.style === 'rock' || z.style === 'cave') {
    // flagstones, like the cat school's stone floor: one big slab per tile, a lighter top
    const k = r();
    g.fillStyle = z.floorDark; g.fillRect(0, 0, 100, 100);
    g.beginPath(); g.roundRect(3, 3, 94, 94, 14); g.fillStyle = z.floor; g.fill();
    g.beginPath(); g.roundRect(3, 3, 94, 88, 14); g.fillStyle = mix(z.floor, z.floorLight, 0.45); g.fill();
    if (k < 0.5) { g.strokeStyle = hexA(z.floorDark, 0.9); g.lineWidth = 1.6; g.beginPath(); g.moveTo(20 + k * 40, 3); g.lineTo(26 + k * 30, 22); g.lineTo(22 + k * 30, 34); g.stroke(); }
    for (let n = 0; n < 4; n++) { g.fillStyle = hexA(z.floorDark, 0.55); circle(g, 14 + r() * 72, 14 + r() * 70, 1.4 + r() * 1.4); g.fill(); }
    return;
  }
  // grass, moss and sedge: soft lighter patches and a few blade tufts
  for (let n = 0; n < 3; n++) { g.fillStyle = hexA(z.floorLight, 0.35); ellipse(g, 18 + r() * 64, 18 + r() * 64, 9 + r() * 8, 5 + r() * 4); g.fill(); }
  for (let n = 0; n < 4; n++) tuft(g, 14 + r() * 72, 22 + r() * 66, z.floorDark, 0.9 + r() * 0.3);
}

// Details on some tiles (variants 3-7 of FLOOR_VARIANTS), per style.
const DETAILS = {
  meadow: [
    (g, z) => { leafBit(g, 38, 52, '#7cc35a', -0.4); leafBit(g, 46, 48, '#7cc35a', 0.5); leafBit(g, 44, 58, '#6cb34f', 1.4); }, // clover
    (g) => flower(g, 52, 50, '#ffffff', '#ffd45a', 3.4), // a daisy
    (g) => { flower(g, 34, 38, '#f9b3c8', '#ffd45a', 2.6); flower(g, 64, 66, '#f9b3c8', '#ffd45a', 2.2); },
    (g) => { flower(g, 30, 64, '#ffd45a', '#fff3b0', 2.4); flower(g, 66, 34, '#ffd45a', '#fff3b0', 2.6); }, // buttercups
    (g, z) => { ellipse(g, 50, 56, 18, 10); g.fillStyle = '#d9b98a'; g.fill(); pebble(g, 46, 55, 4.5, 3.4, '#c9c0b4'); pebble(g, 57, 59, 2.8, 2.2, '#c9c0b4'); },
  ],
  forest: [
    (g) => { g.strokeStyle = INK; g.lineWidth = 4.4; g.beginPath(); g.moveTo(28, 66); g.quadraticCurveTo(46, 54, 66, 52); g.stroke(); g.strokeStyle = '#a8764e'; g.lineWidth = 2.4; g.stroke(); }, // a twig
    (g) => { // a red toadstool
      g.beginPath(); g.roundRect(46, 52, 8, 12, 3); paint(g, '#f6ecd8', { w: 1.8 });
      g.beginPath(); g.moveTo(38, 54); g.quadraticCurveTo(38, 38, 50, 38); g.quadraticCurveTo(62, 38, 62, 54); g.closePath(); paint(g, '#e8555e', { w: 1.8 });
      g.fillStyle = '#ffffff'; circle(g, 46, 46, 2); g.fill(); circle(g, 55, 44, 1.6); g.fill(); circle(g, 57, 50, 1.3); g.fill();
    },
    (g) => { leafBit(g, 32, 34, '#f29a52', 0.6); leafBit(g, 64, 62, '#ffd45a', -0.8); leafBit(g, 58, 30, '#e8555e', 2.2); }, // fallen leaves
    (g) => { // a fern
      g.strokeStyle = '#5fa84a'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(40, 70); g.quadraticCurveTo(48, 50, 66, 42); g.stroke();
      for (let k = 0; k < 5; k++) leafBit(g, 44 + k * 4.6, 64 - k * 5, '#7cc35a', -0.9 + k * 0.1);
    },
    (g) => { for (const [x, y, s] of [[40, 56, 1], [58, 62, 0.8]]) { g.beginPath(); g.roundRect(x - 2.2 * s, y - 2, 4.4 * s, 8 * s, 2); paint(g, '#f6ecd8', { w: 1.6 }); g.beginPath(); g.ellipse(x, y - 2, 6.4 * s, 4.4 * s, 0, Math.PI, 0); g.closePath(); paint(g, '#c9905a', { w: 1.6 }); } },
  ],
  marsh: [
    (g, z) => { ellipse(g, 50, 56, 20, 10); paint(g, z.water, { w: 1.8 }); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(42, 54); g.lineTo(52, 54); g.stroke(); }, // a puddle
    (g) => { // two cattails
      for (const [x, h] of [[42, 30], [56, 24]]) {
        g.strokeStyle = '#6f8a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 74); g.lineTo(x, 74 - h - 10); g.stroke();
        g.beginPath(); g.roundRect(x - 3, 74 - h - 4, 6, 12, 3); paint(g, '#9a6a48', { w: 1.6 });
      }
    },
    (g) => { g.fillStyle = 'rgba(230,255,160,0.9)'; for (const [x, y] of [[30, 34], [66, 58], [44, 72]]) { circle(g, x, y, 1.8); g.fill(); } }, // firefly specks
    (g) => { g.beginPath(); g.roundRect(47, 52, 6, 9, 2); paint(g, '#f6ecd8', { w: 1.6 }); g.beginPath(); g.ellipse(50, 52, 8, 5.4, 0, Math.PI, 0); g.closePath(); paint(g, '#e8a7bd', { w: 1.6 }); }, // a pink mushroom
    (g, z) => { ellipse(g, 38, 44, 9, 6); g.fillStyle = z.floorDark; g.fill(); ellipse(g, 62, 64, 7, 5); g.fill(); }, // moss lumps
  ],
  rock: [
    (g, z) => { g.strokeStyle = z.floorDark; g.lineWidth = 1.8; g.beginPath(); g.moveTo(30, 28); g.lineTo(42, 40); g.lineTo(40, 52); g.lineTo(56, 64); g.stroke(); }, // a crack
    (g) => { pebble(g, 36, 62, 5, 3.8, '#c9c0b4'); pebble(g, 64, 38, 4, 3, '#b8b0a4'); },
    (g) => { tuft(g, 46, 62, '#7cc35a', 1.3); tuft(g, 56, 60, '#5fa84a', 1.1); },
    (g) => { pebble(g, 50, 54, 10, 6, '#bfb7ab'); },
    (g) => { crystal(g, 44, 60, 1.4, '#8fd3f2', '#5aaed6'); crystal(g, 56, 62, 1, '#d9c8f2', '#a891d4'); },
  ],
  cave: [
    (g, z) => { g.strokeStyle = z.floorDark; g.lineWidth = 1.8; g.beginPath(); g.moveTo(26, 30); g.lineTo(40, 44); g.lineTo(38, 56); g.stroke(); },
    (g) => { pebble(g, 38, 60, 5, 3.6, '#8a82a3'); pebble(g, 62, 40, 3.6, 2.8, '#8a82a3'); },
    (g) => crystal(g, 50, 60, 1.6, '#8fd3f2', '#4ea6d6'),
    (g) => crystal(g, 52, 58, 1.4, '#d9c8f2', '#9a6fd6'),
    (g) => { g.fillStyle = 'rgba(140,255,220,0.85)'; for (const [x, y] of [[36, 40], [62, 64], [56, 34]]) { circle(g, x, y, 2); g.fill(); } }, // glowing moss
  ],
};

export const FLOOR_VARIANTS = 8;
export function floorArt(z, zi, variant) {
  const [c, g] = unit();
  const r = rng(variant * 17 + 3 + zi * 101);
  groundBase(g, z, r);
  if (variant >= 3) DETAILS[z.style][variant - 3]?.(g, z);
  return c;
}

// ---------- walls ----------
// how each style's walls are shaped and coloured
const STYLE = {
  meadow: { bump: scallop(3.6, 25), arc: 2.6, R: 22 },
  forest: { bump: scallop(4.2, 33.34), arc: 3.4, R: 26 },
  marsh: { bump: wave(3, 12.5), arc: 1.6, R: 20 },
  rock: { bump: rocky(3.2), arc: 0, R: 16 },
  cave: { bump: rocky(3.2), arc: 0, R: 18 },
};

// leafy clumps over the top of a hedge or a canopy: a lighter round on the upper left of each
function clumps(g, z, r, v, big) {
  const step = big ? 34 : 26, rad = big ? 13 : 10;
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
    const x = 14 + gx * step + (gy % 2 ? step / 2 : 0) + ((v * 7 + gy * 5) % 9) - 4, y = 14 + gy * step * 0.8 + ((v * 3 + gx * 7) % 7) - 3;
    if (x > 92 || y > 96) continue;
    g.fillStyle = z.wallLight;
    g.beginPath(); g.arc(x, y, rad, Math.PI * 0.95, Math.PI * 1.85); g.quadraticCurveTo(x + rad * 0.2, y - rad * 0.1, x - rad * 0.97, y + rad * 0.2); g.fill();
    g.strokeStyle = hexA(INK, 0.28); g.lineWidth = 1.5;
    g.beginPath(); g.arc(x + 2, y + 3, rad, Math.PI * 0.15, Math.PI * 0.75); g.stroke();
  }
  if (r() < 0.35) { // a few berries or blossoms here and there
    const x = 24 + r() * 52, y = 20 + r() * 50, col = z.style === 'forest' ? '#ffd45a' : '#f9b3c8';
    for (const [dx, dy] of [[0, 0], [4, 2], [1, 5]]) { circle(g, x + dx, y + dy, 2.2); paint(g, col, { w: 1.2 }); }
  }
}

function reedTop(g, z, r) {
  for (let k = 0; k < 26; k++) {
    const x = 4 + r() * 92, y = 8 + r() * 90, h = 7 + r() * 8, lean = (r() - 0.5) * 5;
    g.strokeStyle = r() < 0.5 ? z.wallLight : z.wallDark; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h); g.stroke();
  }
  if (r() < 0.6) { const x = 20 + r() * 60, y = 22 + r() * 40; g.beginPath(); g.roundRect(x - 3, y - 6, 6, 12, 3); paint(g, '#9a6a48', { w: 1.6 }); }
}

function rockTop(g, z, r) {
  // a heap of round boulders, each lit on its upper left
  const spots = [[26, 28], [66, 24], [44, 60], [80, 64], [16, 74]];
  for (const [x0, y0] of spots) {
    const x = x0 + (r() - 0.5) * 8, y = y0 + (r() - 0.5) * 8, rx = 11 + r() * 6, ry = rx * (0.7 + r() * 0.15), rot = (r() - 0.5) * 0.6;
    const path = () => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
    path(); g.fillStyle = mix(z.wallTop, z.wallLight, 0.3); g.fill();
    g.save(); path(); g.clip();
    g.fillStyle = hexA(z.wallLight, 0.9); ellipse(g, x - rx * 0.35, y - ry * 0.4, rx * 0.55, ry * 0.4); g.fill();
    g.fillStyle = hexA(z.wallDark, 0.35); ellipse(g, x + rx * 0.3, y + ry * 0.6, rx * 0.9, ry * 0.45); g.fill();
    g.restore();
    path(); g.lineWidth = 1.8; g.strokeStyle = hexA(INK, 0.55); g.stroke();
  }
  if (z.style === 'cave') for (let k = 0; k < 2; k++) if (r() < 0.6) crystal(g, 20 + r() * 60, 26 + r() * 50, 1.2, r() < 0.6 ? '#8fd3f2' : '#d9c8f2', r() < 0.6 ? '#4ea6d6' : '#9a6fd6');
}

// the front of a wall, inside its outline
function faceDetail(g, z, r, v, x0, x1) {
  const y0 = FACE_TOP, y1 = 100 - M;
  if (z.style === 'meadow') {
    // leaves in rows on the hedge's front
    g.fillStyle = hexA(z.wallTop, 0.9);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) {
      const x = -4 + k * 22 + (row % 2) * 11 + v * 3, y = y0 + 12 + row * 14;
      g.beginPath(); g.arc(x, y, 8, Math.PI, 0); g.fill();
    }
    g.fillStyle = hexA(INK, 0.18); g.fillRect(-5, y1 - 8, 110, 8);
  } else if (z.style === 'forest') {
    // dark under the trees, a trunk standing in it
    g.fillStyle = z.wallDark; g.fillRect(-5, y0 - 5, 110, 70);
    const tx = 34 + v * 8;
    g.beginPath(); g.moveTo(tx, y0); g.lineTo(tx + 26, y0); g.lineTo(tx + 28, y1 - 2); g.quadraticCurveTo(tx + 36, y1 + 2, tx + 40, y1 + 4); g.lineTo(tx - 14, y1 + 4); g.quadraticCurveTo(tx - 10, y1 + 2, tx - 2, y1 - 2); g.closePath();
    paint(g, z.wallFace, { w: TW });
    g.strokeStyle = hexA(INK, 0.4); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(tx + 8, y0 + 8); g.lineTo(tx + 9, y0 + 22); g.moveTo(tx + 18, y0 + 20); g.lineTo(tx + 17, y0 + 36); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(tx + 3, y0, 5, y1 - y0 - 4);
  } else if (z.style === 'marsh') {
    for (let k = 0; k < 9; k++) {
      const x = 4 + k * 11.5 + ((k * 7 + v * 5) % 5), top = y0 + ((k * 13 + v * 3) % 9);
      g.strokeStyle = k % 3 ? z.wallFace : z.wallLight; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x, y1); g.lineTo(x + ((k % 2) ? 1.5 : -1.5), top); g.stroke();
    }
    for (let k = 0; k < 2; k++) { const x = 18 + ((v * 23 + k * 41) % 64); g.beginPath(); g.roundRect(x - 3, y0 + 6, 6, 13, 3); paint(g, '#9a6a48', { w: 1.6 }); }
  } else {
    // a rock face: blocks with seams, lit on the top edge
    g.fillStyle = hexA(z.wallLight, 0.6); g.fillRect(-5, y0, 110, 5);
    g.strokeStyle = hexA(INK, 0.45); g.lineWidth = 1.8;
    const s1 = 22 + v * 17, s2 = (s1 + 38) % 90 + 5;
    g.beginPath(); g.moveTo(-5, y0 + 26); g.lineTo(105, y0 + 25); g.moveTo(s1, y0 + 5); g.lineTo(s1 + 2, y0 + 25); g.moveTo(s2, y0 + 26); g.lineTo(s2 - 2, y1); g.stroke();
    if (z.style === 'cave') {
      // stalactites hanging off the brow
      for (const x of [s1 + 12, s2 + 18]) { if (x > 90) continue; g.beginPath(); g.moveTo(x - 4, y0); g.lineTo(x, y0 + 12); g.lineTo(x + 4, y0); g.closePath(); paint(g, z.wallLight, { w: 1.6 }); }
    }
    g.fillStyle = hexA(INK, 0.15); g.fillRect(-5, y1 - 7, 110, 7);
  }
}

// A wall tile. `open`: sides facing ground (bits), `dark`: sides facing the never-drawn wall beyond.
export function wallArt(z, zi, open, dark, v) {
  const [c, g] = unit();
  const st = STYLE[z.style] || STYLE.meadow, r = rng(open * 7 + dark * 3 + v * 131 + zi * 977 + 1);
  const ex = sides(open | dark), ground = sides(open);
  const face = ground.s;
  const L = ex.w ? M : -30, R = ex.e ? 100 - M : 130, T = ex.n ? M : -30, B = ex.s ? 100 - M : 130;
  // the ground showing round the wall, where it faces ground (the dark stays clear)
  const groundFill = () => {
    g.fillStyle = z.floor;
    if (ground.n) g.fillRect(0, 0, 100, M + 4);
    if (ground.s) g.fillRect(0, 100 - M - 6, 100, M + 6);
    if (ground.w) g.fillRect(0, 0, M + 4, 100);
    if (ground.e) g.fillRect(100 - M - 4, 0, M + 4, 100);
    for (const [bit, x, y] of [[NE, 100, 0], [SE, 100, 100], [SW, 0, 100], [NW, 0, 0]]) if (open & bit) { circle(g, x, y, M + 6); g.fill(); }
  };
  groundFill();
  // a soft shadow at the foot of the wall's front
  if (face) { g.fillStyle = hexA('#3a2040', 0.16); ellipse(g, 50, 100 - M + 1, 60, 6); g.fill(); }

  const bump = st.bump;
  if (face) {
    const fr = { l: L, t: FACE_TOP - 12, r: R, b: 100 - M, ex: { n: false, e: ex.e, s: true, w: ex.w }, R: Math.min(st.R, 16), bump: z.style === 'rock' || z.style === 'cave' ? flat : bump };
    region(g, fr); g.fillStyle = z.wallFace; g.fill();
    within(g, () => region(g, fr), () => faceDetail(g, z, r, v, L, R));
    region(g, fr); paint(g, null, { w: TW });
    // the front stops against a wall that goes on down beside it
    g.lineWidth = TW; g.strokeStyle = INK;
    if (!ex.e && !(open & SE) && !(dark & SE)) { g.beginPath(); g.moveTo(100 - TW / 2, FACE_TOP); g.lineTo(100 - TW / 2, 100 - M); g.stroke(); }
    if (!ex.w && !(open & SW) && !(dark & SW)) { g.beginPath(); g.moveTo(TW / 2, FACE_TOP); g.lineTo(TW / 2, 100 - M); g.stroke(); }
  }
  const top = { l: L, t: T, r: R, b: face ? FACE_TOP : B, ex: { n: ex.n, e: ex.e, s: ex.s, w: ex.w }, R: st.R, bump, arcBump: st.arc };
  region(g, top); g.fillStyle = z.wallTop; g.fill();
  within(g, () => region(g, top), () => {
    if (z.style === 'marsh') reedTop(g, z, r);
    else if (z.style === 'rock' || z.style === 'cave') rockTop(g, z, r);
    else clumps(g, z, r, v, z.style === 'forest');
    // the lower edge of the top in a soft shade
    if (face) { g.fillStyle = hexA(z.wallDark, 0.45); g.fillRect(-5, FACE_TOP - 6, 110, 8); }
  });
  region(g, top); paint(g, null, { w: TW });
  // inner corners: where the wall turns, the ground (or the dark) bites a round notch out of the corner
  for (const [bit, x, y, a, n1, n2] of [[NE, 100, 0, Math.PI / 2, N, E], [SE, 100, 100, Math.PI, S, E], [SW, 0, 100, -Math.PI / 2, S, W_], [NW, 0, 0, 0, N, W_]]) {
    if (!((open | dark) & bit) || ((open | dark) & (n1 | n2))) continue;
    g.save();
    circle(g, x, y, M);
    if (open & bit) { g.fillStyle = z.floor; g.fill(); } else { g.globalCompositeOperation = 'destination-out'; g.fill(); }
    g.restore();
    g.beginPath(); g.arc(x, y, M, a, a + Math.PI / 2); g.lineWidth = TW; g.strokeStyle = INK; g.stroke();
  }
  return c;
}

// ---------- shade on the ground at the foot of walls ----------
// Only the wall above casts one, a soft band that thins out under the wall's rounded end when the
// wall does not go on to that side (no hard-edged strips beside a hedge).
export function shadeArt(mask) {
  const [c, g] = unit();
  const grad = g.createLinearGradient(0, 0, 0, 30);
  grad.addColorStop(0, 'rgba(58,32,64,0.28)'); grad.addColorStop(1, 'rgba(58,32,64,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 100, 30);
  const taper = (x0, x1) => {
    const t = g.createLinearGradient(x0, 0, x1, 0);
    t.addColorStop(0, 'rgba(0,0,0,0)'); t.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = t;
    g.fillRect(0, 0, 100, 30);
    g.globalCompositeOperation = 'source-over';
  };
  if (!(mask & (W_ | NW))) taper(4, 34);
  if (!(mask & (E | NE))) taper(96, 66);
  return c;
}

// ---------- water ----------
// `mask`: neighbours that are NOT water. The bank above stands over the water (an earth lip with an
// outline); the other shores are a rounded edge; ripples drift between the two frames.
export function waterArt(z, frame, mask) {
  const [c, g] = unit();
  const ex = sides(mask);
  const deep = mix(z.water, '#2a5a9a', 0.25);
  g.fillStyle = z.floor; g.fillRect(0, 0, 100, 100);
  const shape = { l: ex.w ? 5 : -30, t: ex.n ? 10 : -30, r: ex.e ? 95 : 130, b: ex.s ? 95 : 130, ex, R: 18, bump: flat };
  region(g, shape); g.fillStyle = z.water; g.fill();
  within(g, () => region(g, shape), () => {
    // deeper water away from the banks, ripples and a glint or two
    g.fillStyle = hexA(deep, 0.35);
    ellipse(g, 50, 60, 40, 30); g.fill();
    g.strokeStyle = hexA(z.waterLight, 0.95); g.lineWidth = 2.4; g.lineCap = 'round';
    const o = frame ? 9 : 0;
    for (const [x, y, w] of [[18 + o, 34, 16], [56 - o, 54, 18], [26 + o, 76, 14], [70 - o, 84, 10]]) {
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke();
    }
    if (ex.n) { g.fillStyle = hexA(INK, 0.22); g.fillRect(-5, 10, 110, 7); }
  });
  region(g, shape); paint(g, null, { w: TW });
  // the bank above: an earth lip standing over the water
  if (ex.n) {
    g.beginPath(); g.rect(-5, -5, 110, 15); g.fillStyle = z.floor; g.fill();
    g.beginPath(); g.moveTo(ex.w ? 18 : -5, 10); g.lineTo(ex.e ? 82 : 105, 10); g.lineWidth = TW; g.strokeStyle = INK; g.stroke();
  }
  for (const [bit, x, y, a, n1, n2] of [[NE, 100, 0, Math.PI / 2, N, E], [SE, 100, 100, Math.PI, S, E], [SW, 0, 100, -Math.PI / 2, S, W_], [NW, 0, 0, 0, N, W_]]) {
    if (!(mask & bit) || (mask & (n1 | n2))) continue;
    const rr = bit === NE || bit === NW ? 10 : 5;
    circle(g, x, y, rr); g.fillStyle = z.floor; g.fill();
    g.beginPath(); g.arc(x, y, rr, a, a + Math.PI / 2); g.lineWidth = TW; g.strokeStyle = INK; g.stroke();
  }
  return c;
}

// ---------- grass ----------
// Tall grass, like Shattered Pixel Dungeon's: a thick clump of broad blades that hides what is behind.
export function tallGrassArt(variant) {
  const [c, g] = unit();
  const r = rng(variant * 31 + 7);
  const blade = (x, h, lean, w, col, tip) => {
    const path = () => {
      g.beginPath(); g.moveTo(x - w, 99);
      g.bezierCurveTo(x - w * 0.8, 99 - h * 0.5, x + lean * 0.5 - w * 0.3, 99 - h * 0.8, x + lean, 99 - h);
      g.bezierCurveTo(x + lean * 0.5 + w * 0.4, 99 - h * 0.75, x + w * 0.8, 99 - h * 0.45, x + w, 99);
      g.closePath();
    };
    path(); g.fillStyle = col; g.fill();
    if (tip) within(g, path, () => { g.fillStyle = tip; ellipse(g, x + lean, 99 - h, w * 1.4, h * 0.22); g.fill(); });
    path(); paint(g, null, { w: LW * 0.62 });
  };
  const rows = [['#3f8a44', null], ['#56a84e', null], ['#6fc05a', '#9edb7a']];
  rows.forEach(([col, tip], layer) => {
    for (let k = 0; k < 4; k++) {
      const x = 14 + k * 24 + (r() - 0.5) * 12 + (layer % 2) * 10, h = 66 - layer * 12 + r() * 22, lean = (r() - 0.5) * 30;
      blade(x, h, lean, 9 + r() * 3, col, tip);
    }
  });
  return c;
}
// Grass someone walked through: blades lying flat, no outline, just a lighter tangle.
export function flatGrassArt(variant) {
  const [c, g] = unit();
  const r = rng(variant * 13 + 5);
  for (let k = 0; k < 8; k++) {
    const x = 14 + r() * 66, y = 22 + r() * 64, dir = r() < 0.5 ? -1 : 1, len = 16 + r() * 12;
    g.beginPath(); g.moveTo(x, y + 2.6); g.quadraticCurveTo(x + dir * len * 0.5, y - 4, x + dir * len, y - 1.5); g.quadraticCurveTo(x + dir * len * 0.5, y + 0.6, x, y + 5);
    g.closePath(); g.fillStyle = r() < 0.5 ? '#6cb34f' : '#8ccc66'; g.fill();
  }
  return c;
}
