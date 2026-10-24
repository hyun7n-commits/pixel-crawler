// Pictures for 마을 놀이 (v0.30, scenes/village-play.js and village-days.js): the flat stones by the
// pond, puddles and a rainbow after the rain, a shooting star, the giant turnip, the neighbour's washing
// line, the hen, a picnic blanket, morning fog, the moon on the pond, a lute. Drawn with pixkit at the
// village's scale and in its light (from the upper left), outlined in a dark version of what they wrap.

import { Pix, ramp, tone, hash, mixc, WOOD, STONE } from './pixkit.js';
import { VILLAGE_MAP, HOUSES, BUILDINGS, PROPS, FOLK, HOME, BIG_TREE, WALK, shownIn, propCells, villageState, regionOpen, ownsHome } from '../data/village.js';
import { REGION } from '../data/village-map.js';
import { TREASURES } from '../data/play.js';

const LEAF = ['#a6df6e', '#71c452', '#4aa446', '#33833d', '#215f30'];
const WATER = ['#e6f7ff', '#b4e2f4', '#7cc0dc', '#4f98bc', '#3a7398'];
const done = (p, o = {}) => { if (o.outline !== false) p.outline(); return p.canvas(); };

// a little pile of flat skipping stones at the water's edge
export function stonesCanvas() {
  const p = new Pix(15, 9);
  const flat = (cx, cy, rx, ry, k) => p.ell(cx, cy, rx, ry, (x, y, nx, ny) => tone(STONE, 1.6 + k + nx * 0.7 + ny * 1.1, x, y));
  flat(5, 5.5, 4.5, 2.2, 0.3);
  flat(10.5, 5.8, 3.6, 1.9, 0.5);
  flat(7.5, 3.2, 3.8, 1.7, -0.3);
  return done(p);
}

// a puddle on the path after the rain (`v`: three sizes)
export function puddleCanvas(v = 0) {
  const rx = [4.5, 6, 3.5][v % 3], ry = [1.8, 2.2, 1.5][v % 3], w = Math.ceil(rx * 2) + 2, h = Math.ceil(ry * 2) + 2;
  const p = new Pix(w, h);
  p.ell(w / 2, h / 2, rx, ry, (x, y, nx, ny) => (nx * nx + ny * ny > 0.62 ? '#5f8fae' : ny < -0.1 && nx < 0.2 ? WATER[1] : WATER[2]));
  p.set(Math.round(w / 2 - rx / 2), Math.round(h / 2 - 0.5), WATER[0]);
  return p.canvas();
}

// a rainbow, its two feet on the ground `w` pixels apart
export function rainbowCanvas(w = 112) {
  const h = Math.ceil(w / 2) + 2, p = new Pix(w, h), cx = w / 2, cy = h;
  const bands = ['#e0646e', '#f08c3a', '#f4cf4f', '#7cc45a', '#5a8fd8', '#7a6ad8', '#b48ade'];
  const r0 = w / 2 - 1, bw = 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), k = Math.floor((r0 - r) / bw);
    if (k >= 0 && k < bands.length) p.set(x, y, bands[k]);
  }
  return p.canvas();
}

// a shooting star: a bright head and a tail that fades out behind it (it flies down to the left)
export function starCanvas() {
  const p = new Pix(18, 8);
  const tail = ['#fff7c0', '#fff0a0', '#f8e6a0', '#e8d8b0', '#c8c0d8', '#a8a8c8'];
  for (let k = 0; k < 14; k++) { const x = 3 + k, y = 2 + Math.floor(k * 0.32); p.set(x, y, tail[Math.min(tail.length - 1, Math.floor(k / 2.4))]); if (k < 6) p.set(x, y + 1, tail[Math.min(tail.length - 1, 2 + Math.floor(k / 2))]); }
  p.rect(1, 1, 3, 3, '#fff7c0');
  p.set(2, 0, '#ffffff'); p.set(0, 2, '#ffffff'); p.set(2, 2, '#ffffff'); p.set(4, 2, '#ffffff'); p.set(2, 4, '#ffffff');
  return p.canvas();
}

// the turnip that grew too big: a fat bulb half out of the ground, a sheaf of leaves on top
export function bigTurnipCanvas() {
  const p = new Pix(30, 34), cx = 15;
  const PURPLE = ramp('#b65fa0'), WHITE = ramp('#f4efe6');
  // the leaves, three big ones and two small, fanning out of the crown
  const leaf = (x0, y0, x1, y1, wd) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, r = wd * Math.sin(Math.PI * Math.min(1, t * 1.1));
      p.ell(x, y, Math.max(0.6, r), Math.max(0.6, r * 0.8), (px, py, nx) => LEAF[nx < -0.2 ? 1 : nx > 0.4 ? 3 : 2]);
    }
    p.line(x0, y0, x1, y1, LEAF[3]);
  };
  leaf(cx, 12, cx - 9, 2, 3.2);
  leaf(cx, 12, cx + 9, 1, 3.2);
  leaf(cx, 12, cx, 0, 3.4);
  leaf(cx, 13, cx - 13, 9, 2.2);
  leaf(cx, 13, cx + 13, 8, 2.2);
  // the bulb: purple shoulders, white below
  p.ell(cx, 23, 12, 10, (x, y, nx, ny) => (y < 20 + nx * 2 ? tone(PURPLE, 2 + nx * 1.2 + ny * 0.8, x, y) : tone(WHITE, 1.8 + nx * 1.3 + ny * 0.6, x, y)));
  p.set(cx - 6, 17, mixc('#b65fa0', '#ffffff', 0.5)); p.set(cx - 5, 16, mixc('#b65fa0', '#ffffff', 0.5));
  p.outline();
  // the ground it sits in, over the bulb's foot
  p.ell(cx, 31.5, 13.5, 2.6, (x, y, nx) => tone(ramp('#8a6a44'), 2 + nx * 0.8 + (hash(x, y, 7) < 0.25 ? 0.8 : 0), x, y));
  return p.canvas();
}

// the neighbour's washing line: two posts, a sagging rope, a shirt, a towel, one sock (and an empty peg
// where the other one was); `full`: both socks there
export function washingCanvas(full = false) {
  const W = 46, p = new Pix(W, 26);
  for (const x of [1, W - 3]) p.rect(x, 3, 2, 23, (px, py, i) => WOOD[i ? 3 : 1]);
  const ropeY = x => 5 + Math.round(2.2 * Math.sin(Math.PI * (x - 2) / (W - 5)));
  for (let x = 3; x < W - 3; x++) p.set(x, ropeY(x), '#d8c49c');
  const cloth = (x0, w, h, col) => p.rect(x0, ropeY(x0 + w / 2) + 1, w, h, (x, y, i, j) => tone(ramp(col), 1.4 + i / w * 1.2 + (j === 0 ? -0.6 : 0), x, y));
  cloth(6, 9, 9, '#5a8fd8');        // a shirt
  p.rect(5, ropeY(10) + 1, 2, 3, mixc('#5a8fd8', '#1b1424', 0.2)); p.rect(14, ropeY(10) + 1, 2, 3, mixc('#5a8fd8', '#1b1424', 0.2));
  cloth(18, 7, 11, '#f29bb2');      // a towel
  for (let k = 0; k < 3; k++) p.set(19 + k * 2, ropeY(21) + 11, '#fff3e6');
  const sock = x0 => { p.rect(x0, ropeY(x0) + 1, 3, 6, (x, y, i, j) => tone(ramp('#f4cf4f'), 1.6 + i * 0.5 + (j > 3 ? 0.4 : 0), x, y)); p.rect(x0 + 1, ropeY(x0) + 6, 3, 2, (x, y) => tone(ramp('#f4cf4f'), 2.2, x, y)); };
  sock(31);
  if (full) sock(37);
  p.set(38, ropeY(38), '#a07040');  // a peg
  return done(p);
}

// a white hen, fluffed up and fussing
export function henCanvas() {
  const p = new Pix(16, 14), W = ramp('#f4efe6');
  p.ell(8, 9, 6, 4.2, (x, y, nx, ny) => tone(W, 1.6 + nx * 1.2 + ny * 0.8, x, y));
  p.ell(11.5, 5, 2.8, 2.8, (x, y, nx, ny) => tone(W, 1.4 + nx + ny * 0.6, x, y));
  p.poly([[1, 6], [4, 7], [3, 10]], (x, y) => tone(W, 2.4, x, y));     // the tail
  p.rect(11, 1, 2, 2, '#d9454a'); p.set(13, 2, '#d9454a');           // the comb
  p.set(13, 6, '#d9454a');                                             // the wattle
  p.outline();
  p.set(12, 4, '#1b1424');                                             // an eye
  p.set(14, 5, '#f4a83a'); p.set(15, 5, '#f4a83a');                    // the beak
  p.set(7, 13, '#f08c3a'); p.set(10, 13, '#f08c3a');                   // the feet
  return p.canvas();
}

// a picnic blanket, red and white checks, a basket and two rice balls on it
export function blanketCanvas() {
  const p = new Pix(34, 22);
  p.poly([[3, 5], [31, 5], [33, 20], [1, 20]], (x, y) => {
    const cx = Math.floor((x - 1) / 4), cy = Math.floor((y - 5) / 3), on = (cx + cy) % 2 === 0;
    return on ? (y > 17 ? '#b8323c' : '#d9454a') : (y > 17 ? '#e8dcd0' : '#fff3e6');
  });
  p.outline();
  // the basket
  p.rect(20, 7, 9, 6, (x, y, i, j) => tone(ramp('#c9a060'), 1.4 + (j === 0 ? -0.8 : 0) + i / 9 + ((i + j) % 2 ? 0.4 : 0), x, y));
  p.line(20, 7, 24, 3, '#8a6a44'); p.line(24, 3, 28, 7, '#8a6a44');
  // two rice balls
  for (const [x, y] of [[8, 10], [13, 12]]) {
    p.poly([[x, y + 4], [x + 2, y], [x + 4, y + 4]], '#fff7f0');
    p.rect(x + 1, y + 3, 3, 2, '#2f3a2f');
  }
  return p.canvas();
}

// a bank of morning fog, white and dithered thin at its edges (laid over the village at low alpha)
export function fogCanvas() {
  const p = new Pix(64, 26);
  for (let y = 0; y < 26; y++) for (let x = 0; x < 64; x++) {
    const nx = (x + 0.5 - 32) / 32, ny = (y + 0.5 - 13) / 13, d = nx * nx + ny * ny;
    if (d < 1 && hash(x, y, 31) < 1.15 - d) p.set(x, y, '#ffffff');
  }
  return p.canvas();
}

// the full moon on the pond, broken up by the ripples
export function moonCanvas() {
  const p = new Pix(20, 9);
  p.ell(10, 4.5, 9, 3.6, (x, y, nx, ny) => ((y % 3 === 2 && hash(x, y, 5) < 0.6) ? null : nx * nx + ny * ny > 0.6 ? '#f4e6a8' : '#fff7d0'));
  return p.canvas();
}

// a little lute for the plaza concert
export function luteCanvas() {
  const p = new Pix(8, 13), W = ramp('#c08040');
  p.ell(4, 9, 3.5, 3.5, (x, y, nx, ny) => tone(W, 1.6 + nx + ny * 0.6, x, y));
  p.rect(3, 1, 2, 6, W[3]);
  p.rect(2, 0, 4, 2, W[4]);
  p.outline();
  p.set(4, 9, '#3a2616');
  return p.canvas();
}

// the flag at the end of the race track: a pole and a red pennant
export function flagCanvas() {
  const p = new Pix(10, 22);
  p.rect(1, 2, 2, 20, (x, y, i) => WOOD[i ? 3 : 1]);
  p.poly([[3, 2], [9, 5], [3, 8]], (x, y) => (y < 5 ? '#e0646e' : '#c8414a'));
  p.set(2, 1, '#f4cf4f');
  return done(p);
}

// a fat little toad that pops out of the fountain instead of a wish
export function toadCanvas() {
  const p = new Pix(12, 9), G = ramp('#7c9a4a');
  p.ell(6, 5.5, 5, 3.2, (x, y, nx, ny) => tone(G, 1.8 + nx * 1.1 + ny * 0.7, x, y));
  p.ell(3.5, 2.5, 1.6, 1.6, (x, y) => tone(G, 1.4, x, y));
  p.ell(8.5, 2.5, 1.6, 1.6, (x, y) => tone(G, 1.6, x, y));
  p.outline();
  p.set(3, 2, '#1b1424'); p.set(8, 2, '#1b1424');
  p.set(5, 6, '#3f5a2a'); p.set(6, 6, '#3f5a2a');
  p.set(2, 8, '#5e7a3a'); p.set(9, 8, '#5e7a3a');
  return p.canvas();
}

// a round bush to hide behind (숨바꼭질): leafy, lit from the upper left, a darker skirt at the bottom
export function bushCanvas() {
  const p = new Pix(18, 13);
  const blob = (cx, cy, rx, ry) => p.ell(cx, cy, rx, ry, (x, y, nx, ny) => LEAF[Math.max(0, Math.min(4, Math.round(1.6 + nx * 1.1 + ny * 1.3 + (hash(x, y, 3) < 0.2 ? 0.7 : 0))))]);
  blob(5.5, 8, 5, 4.5);
  blob(12.5, 8, 5, 4.5);
  blob(9, 5.5, 5.5, 5);
  p.outline();
  return p.canvas();
}

// a bit of stone in flight (물수제비)
export function pebbleCanvas() {
  const p = new Pix(4, 3);
  p.rect(0, 0, 4, 2, (x, y, i, j) => tone(STONE, 1.4 + i * 0.3 + j * 0.8, x, y));
  p.set(0, 2, null);
  return p.canvas();
}

// a marshmallow on a stick, by how far it has toasted (0 white .. 4 black)
export const MALLOW = ['#fbf7ee', '#f7e3b0', '#e2a456', '#8a5426', '#2a1c18'];
export function mallowCanvas(stage) {
  const p = new Pix(6, 6), c = MALLOW[stage];
  p.rect(1, 1, 4, 4, (x, y, i, j) => (stage < 4 && i + j < 2 ? mixc(c, '#ffffff', 0.45) : c));
  p.clear(1, 1); p.clear(4, 1); p.clear(1, 4); p.clear(4, 4);
  p.outline(undefined, 0.6);
  return p.canvas();
}

// ---------- the treasure maps ----------
// A corner of the village drawn in ink on old paper the way it is now (what has not opened yet is woods
// on it too): the woods hatched, trees as little crowns, the water blue with ripples, paths dotted,
// houses and what the village has put up as little blocks; a red X on the spot. 15 by 11 cells at four
// pixels a cell, and the X never quite in the middle: each map sits its own way.
const PAPER = ['#f1e4c0', '#eadab0', '#e0cc9a'];
const INKD = '#5e4126', INKL = '#a88a5c', WOODS = '#7b8448', TREE = '#5e6b34', WET = '#bcd0c6', WAVE = '#6f93a0', RED = '#d23a44', RED2 = '#8a1e28';
export const MAP_VIEW = { w: 15, h: 11, s: 4 };
export function mapCanvas(meta, id) {
  const t = TREASURES[id], MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
  if (!t) return null;
  const st = villageState(meta), [sx, sy] = t.spot, { w: CW, h: CH, s: S } = MAP_VIEW;
  const k = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const ox = Math.max(0, Math.min(MW - CW, sx - 7 + (k % 5) - 2)), oy = Math.max(0, Math.min(MH - CH, sy - 5 + ((k >> 4) % 3) - 1));
  const W = CW * S + 4, H = CH * S + 4, p = new Pix(W, H);
  const ch = (x, y) => (x >= 0 && y >= 0 && x < MW && y < MH && regionOpen(REGION[y][x], st) ? VILLAGE_MAP[y][x] : '#');
  // the paper, blotchy, its corners worn off
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.set(x, y, PAPER[hash(x >> 1, y >> 1, k & 255) < 0.16 ? 2 : hash(x, y, 5) < 0.3 ? 1 : 0]);
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [W - 1, 0], [W - 2, 0], [W - 1, 1], [0, H - 1], [1, H - 1], [0, H - 2], [W - 1, H - 1], [W - 2, H - 1], [W - 1, H - 2]]) p.clear(x, y);
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
    const x = ox + cx, y = oy + cy, c = ch(x, y), px = 2 + cx * S, py = 2 + cy * S;
    if (c === '#') {
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) if ((i + j) % 2 === 0 && hash(px + i, py + j, 9) < 0.7) p.set(px + i, py + j, WOODS);
    } else if (c === 'T') {
      p.rect(px + 1, py, 2, 3, TREE); p.set(px, py + 1, TREE); p.set(px + 3, py + 1, TREE); p.set(px + 1, py + 3, INKD);
    } else if (c === '~' || c === '=') {
      p.rect(px, py, S, S, WET);
      if (c === '=') p.rect(px, py + 1, S, 2, INKL);
      else { p.set(px + (cy % 2), py + 1, WAVE); p.set(px + 1 + (cy % 2), py + 1, WAVE); }
    } else if (c === ':') {
      p.set(px + 1, py + 1, INKL); p.set(px + 3, py + 3, INKL);
    } else if (c === '*') p.set(px + 2, py + 2, '#c47a88');
    else if (c === '>') { p.rect(px + 1, py + 1, 2, 2, INKD); }
  }
  // the places on it
  const block = (x0, y0, w, h, fill) => {
    const px = 2 + (x0 - ox) * S, py = 2 + (y0 - oy) * S, pw = w * S, ph = h * S;
    p.rect(px + 1, py + 1, pw - 2, ph - 2, fill);
    p.rect(px + 1, py + 1, pw - 2, 1, INKD); p.rect(px + 1, py + ph - 2, pw - 2, 1, INKD);
    p.rect(px + 1, py + 1, 1, ph - 2, INKD); p.rect(px + pw - 2, py + 1, 1, ph - 2, INKD);
    p.rect(px + Math.floor(pw / 2) - 1, py + ph - 4, 2, 2, INKD);
  };
  for (const h of HOUSES) if (FOLK[h.id].when(meta)) block(h.x, h.y, h.w, h.h, '#c98a5a');
  for (const b of BUILDINGS) if (shownIn(b, st)) block(b.x, b.y, b.w, b.h, '#c98a5a');
  if (ownsHome(meta)) block(HOME.x, HOME.y, HOME.w, HOME.h, '#d0705a');
  for (const pr of PROPS) {
    if (!shownIn(pr, st) || WALK.has(pr.kind) || pr.kind === 'lamp' || pr.kind === 'bunting' || pr.kind === 'lanterns' || pr.kind === 'lights' || pr.kind === 'pondlanterns') continue;
    for (const [i, j] of propCells(pr)) { const px = 2 + (pr.x + i - ox) * S, py = 2 + (pr.y + j - oy) * S; p.rect(px + 1, py + 1, 2, 2, INKL); }
  }
  if (shownIn(BIG_TREE, st)) for (const [bx, by] of BIG_TREE.block) { const px = 2 + (bx - ox) * S, py = 2 + (by - oy) * S; p.rect(px, py, S, S, TREE); }
  // the X
  const px = 2 + (sx - ox) * S, py = 2 + (sy - oy) * S;
  for (let d = 0; d < 6; d++) { p.set(px - 1 + d, py + d, RED2); p.set(px + 4 - d, py + d, RED2); }
  for (let d = 0; d < 6; d++) { p.set(px - 1 + d, py - 1 + d, RED); p.set(px + 4 - d, py - 1 + d, RED); }
  // a frame of ink round the edge
  for (let x = 2; x < W - 2; x++) { p.set(x, 1, INKL); p.set(x, H - 2, INKL); }
  for (let y = 2; y < H - 2; y++) { p.set(1, y, INKL); p.set(W - 2, y, INKL); }
  return p.canvas();
}
