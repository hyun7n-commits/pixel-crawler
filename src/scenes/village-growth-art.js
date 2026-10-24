// The pieces the village puts up as it grows (data/village.js PROPS and BUILD): benches, the fountain,
// market stalls, flower arches, the playground, the orchard, the flower clock, the balloon, the fair's
// gate and food stalls, the hero's statue, the rose garden, the maypole, the strings of flags and
// lanterns over the plaza, the plank bridges, the windmill's sails, the festival flags on the roofs.
// Drawn with pixkit at the props' detail: light from the upper left, an outline in a dark version of
// what it wraps, grass growing over the foot of whatever stands on the ground.

import { TILE } from './textures.js';
import { Pix, ramp, tone, hash, seeded, planks, stones, foliage, sprinkle, tufts, groundShadow, mixc, WOOD, WOOD_WARM, STONE } from './pixkit.js';

const PINE = ramp('#c9965a');          // light planks: benches, stalls, the bridge
const IRON = ramp('#5e5c6c');
const LEAF = ['#a6df6e', '#71c452', '#4aa446', '#33833d', '#215f30'];
const WATER = ['#e6f7ff', '#b4e2f4', '#7cc0dc', '#4f98bc', '#3a7398'];
const FLOWER = { white: '#fff7f0', pink: '#f8b4cc', rose: '#e0646e', yellow: '#f4cf4f', blue: '#9fc2ff', violet: '#b48ade', orange: '#f08c3a' };
const STRIPES = [['#d9454a', '#fff3e6'], ['#4fae8a', '#fff3e6'], ['#f4cf4f', '#fff3e6'], ['#5a8fd8', '#fff3e6'], ['#f29bb2', '#fff7f0']];

// a picture of w x h drawn by `draw(p)`, outlined, with a shadow on the grass under its foot
function pic(w, h, draw, o = {}) {
  const p = new Pix(w, h);
  draw(p, w, h);
  if (o.outline !== false) p.outline();
  o.front?.(p, w, h);
  return p.canvas(o.shadow ? g => groundShadow(g, o.shadow[0], o.shadow[1], h - 1, o.shadow[2] || 4, o.shadow[3] || 4, 0.22) : null);
}

// a striped canopy, scalloped along its lower edge, lit from the left
function canopy(p, x0, x1, y0, depth, cols, o = {}) {
  const sw = o.sw || 4;
  for (let x = x0; x <= x1; x++) {
    const k = Math.floor((x - x0) / sw), R = ramp(cols[k % 2]), lx = (x - x0) % sw;
    const d = depth + (lx === 1 || lx === 2 ? 1 : 0);
    for (let j = 0; j < d; j++) {
      const v = (j === 0 ? 0.6 : 1.6) + (x - x0) / (x1 - x0) * 1.1 - 0.4 + (j === d - 1 ? 0.8 : 0);
      p.set(x, y0 + j, tone(R, v, x, y0 + j));
    }
  }
}

// ---------- the small things ----------
const PROPS = {
  // the camp's fire in the middle of the clearing: a ring of stones, crossed logs, a flame
  campfire: () => pic(16, 18, p => {
    p.ell(8, 14.5, 7, 3, (x, y, nx, ny) => tone(STONE, 2 + nx * 0.9 + (hash(x, 0, 3) < 0.3 ? 0.8 : 0) + (ny > 0.2 ? 0.6 : -0.4), x, y));
    p.ell(8, 14, 5, 1.8, '#3d2a2a');
    p.line(3, 15, 12, 11, (k) => WOOD[k % 3 === 0 ? 3 : 2]);
    p.line(13, 15, 4, 11, (k) => WOOD[k % 3 === 0 ? 3 : 1]);
    const flame = [[7, 4], [8, 3], [9, 5], [6, 6], [10, 6]];
    p.poly([[4, 13], [6, 8], [7, 9], [8, 3], [9, 7], [10, 6], [12, 13]], (x, y) => (y < 7 ? '#ffd25a' : y < 10 ? '#f59a3a' : '#d9542e'));
    p.poly([[6, 13], [8, 7], [10, 13]], (x, y) => (y < 10 ? '#fff3b0' : '#ffd25a'));
    flame.length = 0;
  }, { shadow: [1, 15, 3, 3] }),

  // a wooden bench for two, a backrest of two boards
  bench: () => pic(32, 18, p => {
    for (const x of [4, 26]) { p.rect(x, 9, 2, 8, (px, py, i) => WOOD[i ? 3 : 2]); p.rect(x, 2, 2, 8, (px, py, i) => WOOD[i ? 3 : 2]); }
    planks(p, [2, 3, 29, 7], null, PINE, (x, y) => (x - 2) / 27 * 0.8 - 0.3, { pw: 2, vert: false, seed: 11 });
    planks(p, [1, 10, 30, 12], null, PINE, (x, y) => (x - 1) / 29 * 0.8 - 0.6 + (y === 12 ? 0.9 : 0), { pw: 3, vert: false, seed: 12 });
    p.rect(1, 13, 30, 1, PINE[4]);
  }, { shadow: [1, 30, 3, 3], front: (p, w, h) => tufts(p, 1, w - 2, h - 1, 13, { gap: 0.55, tall: 2 }) }),

  // the fountain on the plaza: a round stone basin, a column with a bowl on top, water arching out
  fountain: () => pic(48, 50, p => {
    const cx = 24, by = 39;
    p.ell(cx, by, 22, 9.5, (x, y, nx, ny) => tone(STONE, 2 + nx * 0.8 + (ny > 0 ? 0.6 : -0.6) + (hash(Math.floor(x / 3), Math.floor(y / 2), 5) < 0.2 ? 0.6 : 0), x, y));
    p.ell(cx, by - 1, 19, 7, (x, y, nx, ny) => {
      let v = 1.6 + ny * 1.2 + nx * 0.4;
      if (hash(x, y, 6) < 0.05) v = 0;
      return WATER[Math.max(0, Math.min(4, Math.round(v + (Math.sin(x * 0.9 + y) > 0.85 ? -1 : 0))))];
    });
    // the column and its bowl
    stones(p, [cx - 3, 18, cx + 2, by - 2], null, STONE, (x) => (x - cx + 3) / 5 * 1.1 - 0.4, { ch: 3, wmin: 3, wmax: 5, seed: 7 });
    p.ell(cx, 17, 9, 3.2, (x, y, nx, ny) => tone(STONE, 2 + nx * 0.9 + (ny > 0 ? 0.7 : -0.5), x, y));
    p.ell(cx, 16.5, 7, 2, (x, y, nx) => WATER[nx < -0.3 ? 1 : 2]);
    // a little spout of water on top, falling over the bowl's lip into the basin
    p.rect(cx - 1, 9, 2, 7, (x, y, i, j) => WATER[j < 2 ? 0 : 1 + (i & 1)]);
    p.set(cx - 2, 9, WATER[1]); p.set(cx + 1, 9, WATER[1]);
    for (const s of [-1, 1]) for (let k = 0; k < 15; k++) {
      const x = cx + s * (8 + k * 0.62), y = 18 + k * k * 0.075 + k * 0.6;
      p.set(x, y, WATER[k % 4 === 0 ? 0 : 1]);
      if (k > 3) p.set(x + s, y, WATER[2]);
    }
  }, { shadow: [2, 46, 5, 5] }),

  // a market stall: two posts, a striped canopy, a counter of goods (`v`: what it sells)
  stall: v => pic(32, 32, p => {
    const goods = STALL_GOODS[v % STALL_GOODS.length];
    for (const x of [2, 28]) p.rect(x, 6, 2, 25, (px, py, i) => WOOD[i ? 3 : 1]);
    canopy(p, 0, 31, 2, 6, goods.canopy, { sw: 4 });
    p.rect(1, 0, 30, 2, (x, y, i, j) => tone(ramp(goods.canopy[0]), j ? 2 : 0.8, x, y));
    // the counter
    planks(p, [3, 19, 28, 30], null, PINE, (x, y) => (x - 3) / 25 * 0.9 - 0.3 + (y < 21 ? -0.7 : 0), { pw: 3, seed: 21 + v });
    p.rect(2, 18, 28, 2, (x, y, i, j) => tone(PINE, j ? 1.4 : 0.6, x, y));
    goods.draw(p);
  }, { shadow: [1, 31, 3, 4], front: (p, w, h) => tufts(p, 1, w - 2, h - 1, 23 + v, { gap: 0.5, tall: 2 }) }),

  // a flower arch over the road: two posts and a hoop of leaves and roses
  arch: () => pic(48, 42, p => {
    for (const x of [5, 40]) planks(p, [x, 14, x + 2, 41], null, WOOD_WARM, (px) => (px - x) * 0.6 - 0.2, { pw: 3 });
    const inHoop = (x, y) => { const d = Math.hypot((x + 0.5 - 24) / 20, (y + 0.5 - 18) / 16); return d <= 1 && d >= 0.72 && y <= 22; };
    foliage(p, [2, 0, 45, 24], (x, y) => inHoop(x, y) || ((x <= 9 || x >= 38) && y > 14 && y < 40 && (x <= 9 ? x >= 3 : x <= 44) && hash(x, Math.floor(y / 5), 31) < 0.85), LEAF, { seed: 32, step: 4.4, rmin: 2.6, rmax: 3.6, mid: 0.3 });
    const r = seeded(33);
    for (let k = 0; k < 36; k++) {
      const a = Math.PI * (r() * 1.05 - 0.025), x = 24 - Math.cos(a) * 17.5, y = 18 - Math.sin(a) * 14;
      if (p.get(Math.round(x), Math.round(y))) { const c = [FLOWER.pink, FLOWER.rose, FLOWER.white, FLOWER.pink][k % 4]; p.set(x, y, c); if (k % 3 === 0) p.set(x + 1, y, mixc(c, '#ffffff', 0.4)); }
    }
    for (let k = 0; k < 14; k++) { const x = r() < 0.5 ? 4 + Math.floor(r() * 6) : 38 + Math.floor(r() * 6), y = 16 + Math.floor(r() * 22); if (p.get(x, y)) p.set(x, y, [FLOWER.pink, FLOWER.rose, FLOWER.white][k % 3]); }
  }, { front: (p, w, h) => { tufts(p, 2, 11, h - 1, 34, { gap: 0.3 }); tufts(p, 36, 45, h - 1, 35, { gap: 0.3 }); } }),

  // a swing set: an A-frame of poles, two seats on ropes (`v` 1: the left seat is out swinging, drawn
  // on its own by scenes/village-play.js)
  swings: (v = 0) => pic(32, 32, p => {
    for (const [x0, x1] of [[2, 6], [29, 25]]) { p.line(x0, 31, (x0 + x1) / 2, 3, (k) => WOOD[k % 4 ? 2 : 3]); p.line(x1, 31, (x0 + x1) / 2, 3, (k) => WOOD[k % 4 ? 1 : 2]); }
    planks(p, [3, 2, 28, 4], null, WOOD_WARM, (x, y) => (y === 2 ? -0.6 : 0.5) + (x - 3) / 25 * 0.6, { pw: 3, vert: false });
    for (const [x, sx] of [[10, 0], [20, 1]]) {
      if (v === 1 && !sx) continue;
      for (let y = 5; y < 23; y++) { p.set(x, y, '#d8c49c'); p.set(x + 4, y, '#c9b088'); }
      p.rect(x - 1, 23, 7, 2, (px, py, i, j) => tone(sx ? ramp('#5a8fd8') : ramp('#e0646e'), j ? 3 : 1.2, px, py));
    }
  }, { shadow: [2, 30, 3, 4], front: (p, w, h) => tufts(p, 1, w - 2, h - 1, 41, { gap: 0.4 }) }),

  // a seesaw: a plank on a red pivot, one end down in the grass (`v`: how far over it has tipped, 0 the
  // left end down to SEESAW_TILT the right end down)
  seesaw: (v = 0) => pic(32, 16, p => {
    const yl = 12 - 2 * v, yr = 4 + 2 * v, at = x => yl + (yr - yl) * (x - 1) / 29;
    p.poly([[12, 15], [16, 8], [20, 15]], (x, y) => tone(ramp('#d9454a'), 2 + (x - 16) / 4 * 0.9, x, y));
    p.line(1, yl, 30, yr, (k, n) => PINE[1]);
    p.line(1, yl + 1, 30, yr + 1, (k, n) => PINE[3]);
    p.line(2, yl + 2, 30, yr + 2, (k, n) => PINE[4]);
    for (const x of [5, 26]) { const y = Math.round(at(x)) - 2; p.rect(x, y, 1, 3, IRON[1]); p.rect(x - 1, y, 3, 1, IRON[2]); }
  }, { shadow: [1, 30, 3, 3], front: (p, w, h) => tufts(p, 1, w - 2, h - 1, 42, { gap: 0.5, tall: 2 }) }),

  // an apple tree in the orchard: a short trunk, a round crown hung with red apples
  fruittree: () => pic(26, 34, p => {
    p.fill(10, 20, 15, 33, (x, y) => Math.abs(x + 0.5 - 13) <= 2 + (y > 30 ? (y - 30) * 0.8 : 0), (x, y) => tone(WOOD, 2 + (x - 13) * 0.45 + (hash(x, Math.floor(y / 3), 51) < 0.2 ? 0.7 : 0), x, y));
    const shape = (x, y) => Math.hypot((x + 0.5 - 13) / 12, (y + 0.5 - 12) / 11) <= 1;
    const { own } = foliage(p, [0, 0, 25, 23], shape, LEAF, { seed: 52, step: 5.2, rmin: 3.4, rmax: 4.6, mid: 0.4 });
    sprinkle(p, [2, 2, 23, 21], own, 9, 53, (x, y) => { p.set(x, y, '#e0464e'); p.set(x + 1, y, '#b02f3a'); p.set(x, y + 1, '#b02f3a'); p.set(x + 1, y + 1, '#8e2433'); p.set(x, y - 1, '#ff9a8a'); });
  }, { shadow: [3, 23, 4, 4], front: (p, w, h) => tufts(p, 5, 20, h - 1, 54, { gap: 0.4 }) }),

  // a flower bed laid out as a clock: twelve clumps of flowers round a ring of white stones, two hands
  // of clipped box hedge pointing at ten past ten
  flowerclock: () => pic(48, 32, p => {
    const cx = 24, cy = 15.5;
    p.ell(cx, cy, 22.5, 14, (x, y, nx, ny) => tone(ramp('#e9e2d4'), 1.6 + nx * 0.6 + ny * 0.7 + (hash(Math.floor(x / 2), y, 61) < 0.25 ? 0.8 : 0), x, y));
    p.ell(cx, cy, 20.5, 12.4, (x, y) => (hash(x, y, 62) < 0.5 ? '#7cc45a' : '#5aad58'));
    const cols = [FLOWER.rose, FLOWER.orange, FLOWER.yellow, '#a6df6e', FLOWER.blue, FLOWER.violet, FLOWER.pink, FLOWER.white];
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, x = cx + Math.sin(a) * 16.5, y = cy - Math.cos(a) * 9.8, c = cols[k % cols.length];
      p.ell(x, y, 2.3, 1.6, (px, py, nx, ny) => (nx + ny < -0.4 ? mixc(c, '#ffffff', 0.45) : nx + ny > 0.6 ? mixc(c, '#2a1f44', 0.25) : c));
    }
    const hand = (a, l) => { for (let k = 0; k <= l; k++) { const x = cx + Math.sin(a) * k * 1.3, y = cy - Math.cos(a) * k * 0.8; p.set(x, y, '#2f6d39'); p.set(x, y + 1, '#215f30'); } };
    hand(-Math.PI / 3, 8); hand(Math.PI / 3 - 0.3, 11);
    p.ell(cx, cy, 1.6, 1.2, '#f4cf4f');
  }),

  // a hot-air balloon tied to a peg on the hilltop, its basket just off the grass
  balloon: () => pic(30, 60, p => {
    const cx = 15;
    p.fill(2, 0, 28, 28, (x, y) => {
      const ny = (y + 0.5 - 13) / 13.5, half = 13 * Math.sqrt(Math.max(0, 1 - Math.min(1, ny) ** 2)) * (ny > 0.35 ? 1 - (ny - 0.35) * 0.95 : 1);
      return Math.abs(x + 0.5 - cx) <= half;
    }, (x, y) => {
      const u = (x + 0.5 - cx) / 13, k = Math.floor((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 7);
      const R = ramp(['#d9454a', '#fff3e6', '#f4cf4f', '#fff3e6'][k % 4]);
      return tone(R, 2 + u * 1.3 - 0.3 + (y - 13) / 13 * 0.6, x, y);
    });
    p.rect(cx - 4, 27, 8, 2, '#c9a878');
    for (const s of [-1, 1]) for (let y = 29; y < 34; y++) p.set(cx + s * (4 - (y - 29) * 0.4), y, '#8a6a4a');
    planks(p, [cx - 4, 34, cx + 3, 40], null, ramp('#c9a060'), (x, y) => (x - cx) / 4 * 0.7 + (y === 34 ? -0.8 : 0), { pw: 2, seed: 71 });
    for (let y = 41; y < 58; y++) p.set(cx + Math.round(Math.sin(y * 0.5) * 0.6), y, '#a08060');
    p.rect(cx - 1, 57, 3, 3, WOOD[2]);
  }),

  // the fair's gate over the road: two tall posts, a beam with a banner and a row of pennants
  gate: () => pic(48, 44, p => {
    for (const x of [3, 41]) planks(p, [x, 8, x + 3, 43], null, WOOD_WARM, (px) => (px - x) * 0.45 - 0.3, { pw: 4 });
    planks(p, [0, 6, 47, 10], null, WOOD, (x, y) => (y === 6 ? -0.8 : 0.4) + x / 47 * 0.5, { pw: 3, vert: false, seed: 81 });
    p.rect(9, 11, 30, 9, (x, y, i, j) => tone(ramp('#fff3e6'), 1.4 + (j > 6 ? 0.8 : 0) + i / 30 * 0.6, x, y));
    for (let i = 0; i < 6; i++) { const x = 12 + i * 4.5; p.ell(x + 1, 15.5, 1.6, 1.6, ['#e0646e', '#f4cf4f', '#7cc45a', '#5a8fd8', '#f29bb2', '#f08c3a'][i]); }
    for (let i = 0; i < 9; i++) {
      const x = 4 + i * 4.6, c = ramp(['#e0646e', '#f4cf4f', '#5a8fd8'][i % 3]);
      for (let j = 0; j < 4; j++) for (let k = j; k < 4 - j + (j ? 0 : 0); k++) p.set(x + k, 21 + j, tone(c, 1.5 + j * 0.5, x + k, 21 + j));
    }
    for (const x of [4, 42]) { p.rect(x, 2, 2, 5, WOOD[1]); p.rect(x + 2, 2, 4, 2, x < 20 ? '#e0646e' : '#5a8fd8'); }
  }, { front: (p, w, h) => { tufts(p, 1, 9, h - 1, 82, { gap: 0.3 }); tufts(p, 39, 47, h - 1, 83, { gap: 0.3 }); } }),

  // a food stall at the fair (`v`): skewers on a grill, candy floss, cold drinks
  foodstall: v => pic(32, 32, p => {
    const f = FOOD[v % FOOD.length];
    for (const x of [3, 27]) p.rect(x, 7, 2, 24, (px, py, i) => WOOD[i ? 3 : 1]);
    canopy(p, 1, 30, 3, 5, f.canopy, { sw: 5 });
    p.poly([[1, 4], [16, -1], [30, 4]], (x, y) => tone(ramp(f.canopy[0]), 1.4 + (x - 16) / 15 * 0.9, x, y));
    planks(p, [3, 20, 28, 30], null, PINE, (x, y) => (x - 3) / 25 * 0.9 - 0.3 + (y < 22 ? -0.7 : 0), { pw: 3, seed: 91 + v });
    p.rect(2, 19, 28, 2, (x, y, i, j) => tone(PINE, j ? 1.4 : 0.6, x, y));
    f.draw(p);
  }, { shadow: [1, 31, 3, 4], front: (p, w, h) => tufts(p, 1, w - 2, h - 1, 92 + v, { gap: 0.5, tall: 2 }) }),

  // the hero's statue in the middle of the plaza: a little worker in bronze on a stone plinth, holding
  // up the biggest sparkle-stone
  statue: () => pic(18, 36, p => {
    stones(p, [2, 25, 15, 35], null, STONE, (x, y) => (x - 2) / 13 * 1 - 0.4 + (y < 27 ? -0.6 : 0), { ch: 4, wmin: 4, wmax: 7, seed: 101 });
    p.rect(1, 24, 16, 2, (x, y, i, j) => tone(STONE, j ? 2.6 : 0.6, x, y));
    const B = ramp('#b8864a');
    p.ell(9, 18.5, 5.4, 5.4, (x, y, nx, ny) => tone(B, 2 + (nx * 0.6 + ny * 0.8) * 1.3, x, y));
    p.ell(6.5, 13.5, 1.4, 2, (x, y, nx) => tone(B, 1.4 + nx, x, y));
    p.ell(11.5, 13.5, 1.4, 2, (x, y, nx) => tone(B, 2 + nx, x, y));
    p.rect(12, 9, 2, 8, (x, y, i) => tone(B, 1.6 + i * 0.8, x, y));
    p.poly([[11, 8], [13, 3], [15, 8], [13, 10]], (x, y) => (x < 13 ? '#c8f4ff' : y < 6 ? '#ffffff' : '#7ad0f0'));
    p.set(7, 18, B[5]); p.set(10, 18, B[5]); p.set(8, 20, B[4]); p.set(9, 20, B[4]);
  }, { shadow: [1, 17, 3, 3], front: (p, w, h) => { p.front(12, 2, '#ffffff'); p.front(15, 5, '#ffffff'); tufts(p, 1, 16, h - 1, 102, { gap: 0.4, tall: 2 }); } }),

  // a rose trellis: a lattice of laths, roses climbing over it
  trellis: () => pic(18, 30, p => {
    for (const x of [2, 14]) p.rect(x, 4, 2, 26, (px, py, i) => WOOD_WARM[i ? 3 : 1]);
    for (let y = 6; y < 28; y += 5) for (let x = 3; x < 15; x++) p.set(x, y, WOOD_WARM[2]);
    for (let x = 5; x < 14; x += 4) for (let y = 4; y < 29; y++) p.set(x, y, WOOD_WARM[2]);
    p.poly([[1, 5], [9, 0], [17, 5]], (x, y) => tone(WOOD_WARM, 1.4 + (x - 9) / 8, x, y));
    const r = seeded(111);
    for (let k = 0; k < 22; k++) {
      const x = 2 + Math.floor(r() * 14), y = 4 + Math.floor(r() * 23);
      p.set(x, y, LEAF[2]); p.set(x + 1, y, LEAF[1]); p.set(x, y + 1, LEAF[3]);
      if (k % 2 === 0) { const c = [FLOWER.rose, FLOWER.pink, '#ff8a9a'][k % 3]; p.set(x, y - 1, c); p.set(x + 1, y - 1, mixc(c, '#ffffff', 0.4)); }
    }
  }, { shadow: [1, 17, 3, 3], front: (p, w, h) => tufts(p, 1, 16, h - 1, 112, { gap: 0.2, flowers: 0.3 }) }),

  // a bed of flowers in rainbow bands, laid in a hump with stones round it
  rainbow: () => pic(64, 32, p => {
    const cx = 32, cy = 30;
    const bands = [FLOWER.rose, FLOWER.orange, FLOWER.yellow, '#8fdc6a', FLOWER.blue, FLOWER.violet];
    p.fill(0, 0, 63, 31, (x, y) => Math.hypot((x + 0.5 - cx) / 31, (y + 0.5 - cy) / 29) <= 1, (x, y) => {
      const d = Math.hypot((x + 0.5 - cx) / 31, (y + 0.5 - cy) / 29), k = Math.floor((1 - d) / 0.12);
      if (k >= bands.length) return hash(x, y, 121) < 0.5 ? '#7cc45a' : '#5aad58';
      const c = bands[k], h = hash(x, y, 122);
      return h < 0.18 ? '#3a8448' : h < 0.3 ? '#5aad58' : h > 0.9 ? mixc(c, '#ffffff', 0.5) : c;
    });
  }),

  // a box hedge clipped into a rabbit
  topiary: () => pic(18, 30, p => {
    planks(p, [4, 22, 13, 29], null, ramp('#c0704a'), (x, y) => (x - 4) / 9 * 0.9 - 0.3 + (y === 22 ? -0.6 : 0), { pw: 10, seed: 131 });
    const shape = (x, y) => Math.hypot((x + 0.5 - 9) / 6.5, (y + 0.5 - 16.5) / 5.6) <= 1 || Math.hypot((x + 0.5 - 9) / 4.2, (y + 0.5 - 9) / 3.8) <= 1 ||
      Math.hypot((x + 0.5 - 7) / 1.4, (y + 0.5 - 3.5) / 3.4) <= 1 || Math.hypot((x + 0.5 - 11) / 1.4, (y + 0.5 - 3.5) / 3.4) <= 1;
    foliage(p, [1, 0, 16, 22], shape, ['#9ed86a', '#6cbf50', '#479e45', '#317d3b', '#215f30'], { seed: 132, step: 3.2, rmin: 1.8, rmax: 2.6, mid: 0.35, line: 1 });
    p.set(7, 9, '#215f30'); p.set(11, 9, '#215f30');
  }, { shadow: [2, 15, 3, 3] }),
};

// what each market stall sells: its canopy, and the goods on its counter
const STALL_GOODS = [
  { canopy: STRIPES[0], draw: p => { for (let k = 0; k < 6; k++) { const x = 5 + k * 4; p.ell(x + 1.5, 16.5, 1.8, 1.8, (px, py, nx, ny) => (nx + ny < -0.6 ? '#ffd0a0' : k % 2 ? '#f08c3a' : '#e0646e')); } basket(p, 7, 17); basket(p, 19, 17); } },
  { canopy: STRIPES[1], draw: p => { for (let k = 0; k < 5; k++) { const x = 5 + k * 5; potOf(p, x, 17, [FLOWER.pink, FLOWER.yellow, FLOWER.white, FLOWER.violet, FLOWER.rose][k]); } } },
  { canopy: STRIPES[2], draw: p => { for (let k = 0; k < 3; k++) { basket(p, 4 + k * 8, 17); for (let j = 0; j < 4; j++) p.set(6 + k * 8 + j, 15 + (j & 1), k === 1 ? '#7a4bb0' : '#e0464e'); } } },
  { canopy: STRIPES[4], draw: p => { for (let k = 0; k < 5; k++) { const x = 5 + k * 5; p.rect(x, 13, 3, 5, (px, py, i, j) => (j === 0 ? '#f4f0e8' : i === 0 ? '#ffd25a' : '#e6a83a')); p.set(x + 1, 13, '#d9454a'); } } },
];
function basket(p, x, y) { p.rect(x, y, 6, 2, (px, py, i, j) => tone(ramp('#c9a060'), (i + j) % 2 ? 2.6 : 1.6, px, py)); }
function potOf(p, x, y, c) {
  p.rect(x, y - 1, 3, 2, (px, py, i, j) => tone(ramp('#c0704a'), j ? 2.6 : 1.4, px, py));
  p.set(x + 1, y - 2, LEAF[2]); p.set(x, y - 3, c); p.set(x + 2, y - 3, c); p.set(x + 1, y - 4, mixc(c, '#ffffff', 0.4)); p.set(x + 1, y - 3, '#f4cf4f');
}
const FOOD = [
  { canopy: STRIPES[0], draw: p => {
    p.rect(6, 15, 20, 3, (x, y, i, j) => (j === 2 ? '#3d3a48' : (i + j) % 2 ? '#d9542e' : '#f59a3a'));
    for (let k = 0; k < 5; k++) { const x = 8 + k * 4; p.rect(x, 11, 1, 4, '#c9a878'); p.rect(x - 1, 12, 3, 2, k % 2 ? '#b0603a' : '#c87a4a'); }
  } },
  { canopy: STRIPES[4], draw: p => { for (let k = 0; k < 3; k++) { const x = 8 + k * 7; p.rect(x + 1, 14, 1, 5, '#f4f0e8'); p.ell(x + 1.5, 12, 3, 3, (px, py, nx, ny) => (nx + ny < -0.4 ? '#fff0f6' : nx + ny > 0.6 ? '#e58aa5' : '#f8b4cc')); } } },
  { canopy: STRIPES[3], draw: p => {
    for (let k = 0; k < 4; k++) { const x = 6 + k * 5; p.rect(x, 13, 3, 5, (px, py, i, j) => (j === 0 ? '#e6f7ff' : ['#f4cf4f', '#f29bb2', '#9fe07a', '#f08c3a'][k])); p.set(x + 1, 11, '#f4f0e8'); p.set(x + 1, 12, '#f4f0e8'); }
  } },
];

// ---------- pictures with frames ----------
// the plank bridge over the stream (`v` 0: you cross it left to right, 1: up and down)
function bridge(v) {
  const p = new Pix(TILE, TILE), across = v === 0;
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const a = across ? j : i, b = across ? i : j;
    if (a === 0 || a === 15) continue;
    if (a <= 2 || a >= 13) {
      // the rails: a beam, a post in the middle of each tile
      const post = b >= 7 && b <= 8, top = a === 1 || a === 13;
      p.set(i, j, post ? WOOD[top ? 2 : 3] : WOOD_WARM[top ? 1 : a === 2 || a === 14 ? 3 : 2]);
      continue;
    }
    const k = Math.floor(b / 3), lb = b % 3;
    let t = 1.8 + (hash(k, 0, across ? 141 : 142) - 0.5) * 0.9 + (a === 3 ? 1.2 : a === 12 ? 0.9 : 0);
    if (lb === 2) t += 1.3;
    p.set(i, j, tone(PINE, t, i, j));
  }
  return p.canvas();
}

// the windmill's four sails (`v`: one of six steps through a quarter turn)
export const SAIL_FRAMES = 6;
function sails(v) {
  const S = 46, c = (S - 1) / 2, p = new Pix(S, S), a0 = Math.PI / 4 + v / SAIL_FRAMES * Math.PI / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - c, dy = y - c;
    for (let k = 0; k < 4; k++) {
      const a = a0 + k * Math.PI / 2, u = dx * Math.cos(a) + dy * Math.sin(a), w = -dx * Math.sin(a) + dy * Math.cos(a);
      if (u < 2 || u > 22) continue;
      if (Math.abs(w) <= 0.7) { p.set(x, y, WOOD[2]); break; }
      if (u > 5 && w > 0.7 && w < 6) {
        const lattice = Math.round(u) % 4 === 0 || Math.round(w) === 3;
        p.set(x, y, lattice ? WOOD_WARM[2] : tone(ramp('#f4ead8'), 1.6 + (k % 2) * 0.6 + w / 6 * 0.6, x, y));
        break;
      }
    }
  }
  p.ell(c + 0.5, c + 0.5, 2.6, 2.6, (x, y, nx, ny) => WOOD[nx + ny < -0.4 ? 1 : 3]);
  p.outline();
  return p.canvas();
}
// where the sails' middle goes, from the windmill's footprint corner (bottom left), in pixels
export const SAILS_AT = [24, -40];

// a little festival flag on a pole for a roof (`v`: colour * 2 + which way it flaps)
function flag(v) {
  const c = ramp(['#e0646e', '#f4cf4f', '#7aa4ff', '#f29bb2'][v >> 1]), p = new Pix(9, 12);
  for (let y = 1; y < 12; y++) p.set(1, y, y < 2 ? '#f4cf4f' : '#6e4a2a');
  const wave = v & 1;
  for (let i = 0; i < 6; i++) {
    const h = 4 - Math.floor(i * 0.6), y0 = 2 + (wave && i > 2 ? 1 : 0) - (wave && i === 5 ? 1 : 0);
    for (let j = 0; j < h; j++) p.set(2 + i, y0 + j + Math.floor(i * 0.3), tone(c, 1.4 + j * 0.5 + (i > 3 ? 0.6 : 0), i, j));
  }
  p.outline();
  return p.canvas();
}

// the maypole: a striped pole crowned with flowers, ribbons fanning down to pegs in the grass, a ring
// of flowers round its foot (`v`: the ribbons a step further round)
function maypole(v) {
  const W = 34, H = 56, cx = 17, p = new Pix(W, H);
  const cols = ['#e0646e', '#f4cf4f', '#5a8fd8', '#7cc45a', '#f29bb2', '#b48ade'];
  for (let k = 0; k < 6; k++) {
    const t = (k + v * 0.5) / 6 * Math.PI * 2, ex = cx + Math.cos(t) * 15, ey = H - 6 + Math.sin(t) * 3;
    if (Math.sin(t) < 0) p.line(cx, 8, ex, ey, cols[k]);
  }
  for (let y = 6; y < H - 2; y++) { const s = Math.floor((y + v * 2) / 3) % 2; p.set(cx, y, s ? '#fff3e6' : '#d9454a'); p.set(cx + 1, y, s ? '#d8c8b8' : '#a3142f'); }
  for (let k = 0; k < 6; k++) {
    const t = (k + v * 0.5) / 6 * Math.PI * 2, ex = cx + Math.cos(t) * 15, ey = H - 6 + Math.sin(t) * 3;
    if (Math.sin(t) >= 0) p.line(cx + 1, 8, ex, ey, cols[k]);
    p.rect(ex, ey, 2, 2, WOOD[2]);
  }
  p.ell(cx + 0.5, 6, 4.5, 3, (x, y, nx, ny) => (hash(x, y, 151) < 0.4 ? [FLOWER.pink, FLOWER.yellow, FLOWER.white][Math.floor(hash(x, y, 152) * 3)] : LEAF[nx + ny < 0 ? 1 : 3]));
  p.outline();
  tufts(p, 2, W - 3, H - 1, 153, { gap: 0.1, flowers: 0.6 });
  return p.canvas(g => groundShadow(g, 8, 26, H - 1, 3, 3, 0.2));
}

// a paper lantern floating on a lily pad (`v`: pink or white)
function pondlantern(v) {
  const p = new Pix(11, 10);
  p.ell(5.5, 7.5, 5.2, 2, (x, y, nx) => LEAF[nx < -0.3 ? 1 : 2]);
  p.set(5, 6, LEAF[4]);
  const L = v ? ['#ffffff', '#fff7f0', '#f4e4d0'] : ['#ffe6ef', '#f8b4cc', '#e58aa5'];
  p.rect(3, 2, 5, 5, (x, y, i, j) => (i === 0 || j === 4 ? L[2] : i + j < 3 ? L[0] : L[1]));
  p.rect(4, 1, 3, 1, '#c9a060');
  p.set(5, 4, '#fff3b0');
  p.outline();
  return p.canvas();
}

// the seesaw's steps from one end down to the other
export const SEESAW_TILT = 4;
const FRAMES = { bridge, sails, flag, maypole, pondlantern };
// every kind of picture here, the ones with frames too
export const GROWTH_PROPS = Object.fromEntries([...Object.keys(PROPS), ...Object.keys(FRAMES)].map(k => [k, true]));
export function growthPropCanvas(kind, v = 0) {
  if (FRAMES[kind]) return FRAMES[kind](v);
  return PROPS[kind](v);
}

// ---------- strings over the plaza ----------
// A string hung from one point to another `w` pixels to the right, the picture reaching `STRING_PAD`
// past each end. 'bunting': little flags between two poles of its own. 'lanterns': paper lanterns
// between the tops of two lamp posts (village-art.js lampPostCanvas: their arm is 3 pixels right of
// the middle of their tile, 20 pixels up).
export const STRING_PAD = 4;
export function stringCanvas(kind, w) {
  const W = w + 2 * STRING_PAD + 6, H = kind === 'bunting' ? 34 : 26, p = new Pix(W, H);
  const lantern = kind === 'lanterns', x0 = STRING_PAD + (lantern ? 3 : 0), x1 = x0 + w, top = lantern ? H - 18 : 4, sag = Math.min(8, 3 + w / 40);
  const yAt = x => top + sag * (1 - ((x - x0) / (x1 - x0) * 2 - 1) ** 2);
  if (!lantern) for (const x of [x0, x1]) { for (let y = top - 1; y < H; y++) p.set(x, y, WOOD[y % 5 ? 2 : 3]); p.set(x, top - 2, '#f4cf4f'); }
  for (let x = x0 + 1; x < x1; x++) p.set(x, yAt(x), '#8a6a4a');
  const step = lantern ? 12 : 6, cols = lantern ? ['#e0464e', '#f4cf4f', '#f29bb2'] : ['#e0646e', '#f4cf4f', '#5a8fd8', '#7cc45a', '#f29bb2'];
  for (let x = x0 + step / 2, k = 0; x < x1 - 2; x += step, k++) {
    const y = Math.round(yAt(x)) + 1, c = ramp(cols[k % cols.length]);
    if (lantern) {
      p.set(x + 1, y, '#3d3a48');
      p.ell(x + 1.5, y + 3.5, 2.6, 2.8, (px, py, nx, ny) => tone(c, 1.5 + nx * 0.8 + ny * 0.5, px, py));
      p.set(x + 1, y + 2, mixc(cols[k % cols.length], '#fff3b0', 0.6));
      p.rect(x, y + 6, 3, 1, '#3d3a48');
    } else for (let j = 0; j < 5; j++) for (let i = j >> 1; i < 5 - (j >> 1); i++) p.set(x - 2 + i, y + j, tone(c, 1.3 + j * 0.45 + (i > 2 ? 0.5 : 0), x + i, y + j));
  }
  p.outline();
  return p.canvas();
}
