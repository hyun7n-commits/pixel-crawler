// Sparkle boulders: a round lumpy rock with its grade's pieces stuck in it (round nuggets for the
// metals, faceted crystals for the gems), the heap a broken one leaves, and one chip flying off.
// Drawn in world px (16 a tile) on canvases `k` times finer.

import { RES, INK, mix, within, rng } from './ink.js';
import { RAINBOW } from '../data/ores.js';

const L = 0.8;
const ROCK = ['#c7c0d6', '#e2ddec', '#9d95b5']; // face, light, shadow

function cnv(w, h, k) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext('2d');
  g.scale(k, k); g.lineJoin = 'round'; g.lineCap = 'round';
  return [c, g];
}
const ink = (g, w = L) => { g.lineWidth = w; g.strokeStyle = INK; g.stroke(); };
const colours = (grade, n) => grade.vein || [RAINBOW[n % RAINBOW.length], mix(RAINBOW[(n + 2) % RAINBOW.length], '#000000', 0.3)];

function nugget(g, x, y, r, [light, dark], rot) {
  g.beginPath(); g.ellipse(x, y, r, r * 0.8, rot, 0, Math.PI * 2);
  g.fillStyle = light; g.fill();
  within(g, () => { g.beginPath(); g.ellipse(x, y, r, r * 0.8, rot, 0, Math.PI * 2); }, () => {
    g.fillStyle = dark; g.beginPath(); g.ellipse(x + r * 0.4, y + r * 0.45, r * 0.9, r * 0.6, rot, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.3, r * 0.32, r * 0.2, -0.5, 0, Math.PI * 2); g.fill();
  });
  g.beginPath(); g.ellipse(x, y, r, r * 0.8, rot, 0, Math.PI * 2); ink(g, L * 0.8);
}
function crystal(g, x, y, s, [light, dark], rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  const shape = () => { g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(s * 0.7, -s * 0.7); g.lineTo(s * 0.7, s * 0.8); g.lineTo(0, s * 1.2); g.lineTo(-s * 0.7, s * 0.8); g.lineTo(-s * 0.7, -s * 0.7); g.closePath(); };
  shape(); g.fillStyle = light; g.fill();
  g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(s * 0.7, -s * 0.7); g.lineTo(s * 0.7, s * 0.8); g.lineTo(0, s * 1.2); g.closePath(); g.fillStyle = dark; g.fill();
  g.beginPath(); g.moveTo(-s * 0.35, -s * 0.8); g.lineTo(-s * 0.35, s * 0.5); g.lineWidth = s * 0.28; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
  shape(); ink(g, L * 0.8);
  g.restore();
}
function piece(g, grade, x, y, size, n, r) {
  const col = colours(grade, n);
  if (grade.metal) nugget(g, x, y, size, col, r() * Math.PI);
  else crystal(g, x, y, size * 0.85, col, (r() - 0.5) * 0.7);
}
function twinkle(g, x, y, s) {
  g.beginPath();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, d = k % 2 ? s * 0.3 : s; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  g.closePath(); g.fillStyle = '#fff'; g.fill();
}

// A rock over the cells (tile coords relative to its corner): each cell a rounded block that runs
// on into its neighbours, the union outlined once.
function rock(g, cells, r) {
  const has = (x, y) => cells.some(c => c.x === x && c.y === y);
  const block = c => {
    const l = has(c.x - 1, c.y) ? -2 : 1.2, rt = has(c.x + 1, c.y) ? 18 : 14.8;
    const t = has(c.x, c.y - 1) ? -2 : 2.4 + r() * 1.2, b = has(c.x, c.y + 1) ? 18 : 15;
    const rad = [has(c.x - 1, c.y) || has(c.x, c.y - 1) ? 1 : 6, has(c.x + 1, c.y) || has(c.x, c.y - 1) ? 1 : 6, has(c.x + 1, c.y) || has(c.x, c.y + 1) ? 1 : 3.4, has(c.x - 1, c.y) || has(c.x, c.y + 1) ? 1 : 3.4];
    g.roundRect(c.x * 16 + l, c.y * 16 + t, rt - l, b - t, rad);
  };
  const all = () => { g.beginPath(); for (const c of cells) block(c); };
  // shadow on the ground, the ink rim, then the rock
  g.fillStyle = 'rgba(58,32,64,0.2)';
  for (const c of cells) if (!has(c.x, c.y + 1)) { g.beginPath(); g.ellipse(c.x * 16 + 8, c.y * 16 + 15.2, 7.6, 1.6, 0, 0, Math.PI * 2); g.fill(); }
  all(); g.lineWidth = L * 2; g.strokeStyle = INK; g.stroke();
  all(); g.fillStyle = ROCK[0]; g.fill();
  within(g, all, () => {
    // a lit top and a shaded foot, a few soft facets
    for (const c of cells) {
      const x = c.x * 16, y = c.y * 16;
      if (!has(c.x, c.y + 1)) { g.fillStyle = ROCK[2]; g.beginPath(); g.ellipse(x + 10, y + 16, 11, 4.6, 0, 0, Math.PI * 2); g.fill(); }
      if (!has(c.x, c.y - 1)) { g.fillStyle = ROCK[1]; g.beginPath(); g.ellipse(x + 6, y + 5, 5.6, 2.4, -0.2, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(90,70,120,0.35)'; g.lineWidth = 0.6;
      g.beginPath(); const fx = x + 4 + r() * 8; g.moveTo(fx, y + 3 + r() * 3); g.quadraticCurveTo(fx + 1.5, y + 8, fx + (r() - 0.5) * 3, y + 12); g.stroke();
    }
  });
}

// one tile of ore, or (with cells) a whole vein; returns the canvas
export function oreArt(grade, { cells = [{ x: 0, y: 0 }], seed = 1, k = RES } = {}) {
  const bw = Math.max(...cells.map(c => c.x)) + 1, bh = Math.max(...cells.map(c => c.y)) + 1;
  const [c, g] = cnv(bw * 16, bh * 16, k);
  const r = rng(seed);
  rock(g, cells, r);
  // the grade's pieces: two or three a tile, the first big
  let n = 0;
  for (const cell of cells) {
    const per = grade.metal ? 3 : 2;
    for (let i = 0; i < per; i++, n++) {
      const big = i === 0, x = cell.x * 16 + (big ? 6 + r() * 4 : 3.6 + r() * 9), y = cell.y * 16 + (big ? 8.4 + r() * 2 : 6 + r() * 6);
      piece(g, grade, x, y, big ? 3.3 : 2.1, n, r);
    }
    twinkle(g, cell.x * 16 + 3 + r() * 10, cell.y * 16 + 4 + r() * 4, 1.4);
  }
  return c;
}

// what a broken one leaves on the floor (a little heap of its pieces), or one chip in the air
export function dropArt(grade, chip, k = RES) {
  const S = chip ? 6 : 16;
  const [c, g] = cnv(S, S, k);
  const r = rng(chip ? 3 : 5);
  if (chip) { piece(g, grade, 3, 3.2, 1.9, 0, r); return c; }
  g.fillStyle = 'rgba(58,32,64,0.18)'; g.beginPath(); g.ellipse(8, 12.6, 6, 1.6, 0, 0, Math.PI * 2); g.fill();
  piece(g, grade, 5.2, 10, 2.2, 1, r);
  piece(g, grade, 10.8, 10.4, 2.1, 2, r);
  piece(g, grade, 8, 7.4, 2.5, 0, r);
  twinkle(g, 12.4, 5, 1.3);
  return c;
}
