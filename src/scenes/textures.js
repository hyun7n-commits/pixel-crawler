// Builds Phaser textures from the pixel-art strings and draws the floor and wall tiles for each zone.

import { PAL, SPR, TER_SPR } from '../data/sprites.js';
import { FACES, faceRows, faceKey } from '../data/faces.js';
import { CHARACTERS } from '../data/characters.js';
import { ZONES, VILLAGE_GROUND } from '../data/enemies.js';
import { ORES, RAINBOW } from '../data/ores.js';
import { dressRows, wearTag } from '../data/wear.js';
import { findIcon } from '../data/finds-art.js';
import { TRINKET } from '../data/trinkets.js';

export const TILE = 16; // world pixels per tile

// Everything is drawn at one pixel size, 16px to a tile, characters a little smaller than their tile.
const HEROES = new Set(Object.values(CHARACTERS).map(c => c.sprite));
const charRows = name => SPR[name] || TER_SPR[name];
// how much to scale a sprite so it takes one tile whatever its texture size
export const texScale = s => TILE / s.frame.height;

// `recolor(ch, i, j)` may return a different colour for a pixel (used for the ore grades).
function spriteCanvas(rows, recolor) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      const col = ch !== '.' && (recolor?.(ch, i, j) || PAL[ch]);
      if (col) { g.fillStyle = col; g.fillRect(i, j, 1, 1); }
    }
  }
  return c;
}

// The big ore in each grade: the same rock with the grade's own pieces stuck in it, so you can tell
// at a glance what it is: round nuggets for copper, silver and gold, faceted crystals for diamond and
// the gems (in every colour for the rainbow stone). Pieces use 1 highlight, 2 light, 3 dark, 4 glint.
const NUGGETS = [['.12.', '1223', '.233'], ['.12', '123', '233'], ['12', '23']];
const CRYSTALS = [['..4..', '.122.', '12223', '.233.', '..3..'], ['.4.', '122', '123', '233', '.3.'], ['.1.', '123', '.3.']];
// the rock takes on a little of its grade's colour too (v0.28), so it is not one more grey stone on a
// grey hillside: rusty for copper, warm for gold, bluish for diamond, reddish for ruby
const ROCK = { L: true, l: true, d: true };
const pieceColor = grade => (ch, i, j) => {
  if (ROCK[ch]) return mix(PAL[ch], grade.vein ? grade.vein[1] : '#9a7fd0', 0.22);
  if (ch < '1' || ch > '4') return null;
  if (ch === '4') return '#ffffff';
  const [light, dark] = grade.vein || [RAINBOW[(i + j) % RAINBOW.length], mix(RAINBOW[(i + j + 2) % RAINBOW.length], '#000000', 0.35)];
  return ch === '1' ? mix(light, '#ffffff', 0.55) : ch === '2' ? light : dark;
};
// Stamps the grade's pieces onto rock rows (arrays of chars) wherever they sit fully on the rock face.
function stampPieces(rows, grade, n, rnd, onRock = ch => ch === 'L' || ch === 'l' || ch === 'd') {
  const shapes = grade.metal ? NUGGETS : CRYSTALS;
  const H = rows.length, W = rows[0].length;
  for (let k = 0, tries = 0; k < n && tries < 500; tries++) {
    // the first pieces are the big ones
    const pat = shapes[Math.min(shapes.length - 1, k < Math.ceil(n / 3) ? 0 : 1 + Math.floor(rnd() * (shapes.length - 1)))];
    const px = Math.floor(rnd() * (W - pat[0].length + 1)), py = Math.floor(rnd() * (H - pat.length + 1));
    if (!pat.every((r, j) => [...r].every((ch, i) => ch === '.' || onRock(rows[py + j][px + i])))) continue;
    pat.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') rows[py + j][px + i] = ch; }));
    k++;
  }
  return rows;
}
const seeded = seed => () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff);
// The sparkle rock (v0.28: bigger, it had too little presence): a boulder standing ORE_TALL pixels up
// over the tile above it with its grade on show: a heap of nuggets bulging out of the top for the metals,
// a cluster of crystals for the rest, a crack down its face where the colour shows through, and one more
// piece low on the side (never two level with each other, or the rock looks back at you).
export const ORE_TALL = 4;
const PRISMS = [[5, 1, ['..k..', '.k4k.', 'k412k', 'k123k', 'k123k', 'k123k', 'k223k']], [2, 4, ['.k.', 'k4k', 'k2k', 'k3k']], [10, 3, ['.k.', 'k4k', 'k2k', 'k3k']]];
const HEAP = [[5, 2, ['.kkk..', 'k412k.', 'k1223k', 'k2233k']], [9, 4, ['.kk.', 'k42k', 'k23k']], [3, 5, ['.kk', 'k4k', 'k2k']]];
const SIDE = { metal: [2, 12, ['.kk.', 'k42k', 'k23k', '.kk.']], gem: [3, 13, ['k4k', 'k2k', 'k3k']] };
const CRACK = [[8, 9, '3'], [9, 10, '2'], [9, 11, '3'], [10, 12, '2'], [11, 13, '1'], [11, 14, '3'], [12, 15, '2']];
const lay = (rows, x0, y0, pat) => pat.forEach((r, j) => [...r].forEach((ch, i) => {
  if (ch !== '.' && rows[y0 + j] && rows[y0 + j][x0 + i] !== undefined) rows[y0 + j][x0 + i] = ch;
}));
// the cluster on top of a rock whose top edge is about 5 rows down from (x0, y0)
const crown = (rows, grade, x0, y0) => { for (const [x, y, pat] of grade.metal ? HEAP : PRISMS) lay(rows, x0 + x, y0 + y, pat); };
function oreCanvas(grade) {
  const rows = TER_SPR.bigOre.map(r => [...r]);
  crown(rows, grade, 0, 0);
  for (const [x, y, ch] of CRACK) if (rows[y][x] !== 'k') rows[y][x] = ch;
  lay(rows, ...SIDE[grade.metal ? 'metal' : 'gem']);
  return spriteCanvas(rows.map(r => r.join('')), pieceColor(grade));
}
// 반짝돌 왕관's pebble: the small lump with two of the grade's smallest pieces in it
function pebbleCanvas(grade) {
  const rows = TER_SPR.pebble.map(r => [...r]);
  const [pat, spots] = grade.metal ? [NUGGETS[2], [[5, 9], [9, 11]]] : [CRYSTALS[2], [[5, 9], [9, 10]]];
  for (const [px, py] of spots) pat.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') rows[py + j][px + i] = ch; }));
  return spriteCanvas(rows.map(r => r.join('')), pieceColor(grade));
}
export const pebbleKey = tier => `t_pebble_${ORES[tier].id}`;
// What a grade looks like lying on the floor (a little heap of its pieces), and one chip of it in the air.
function dropCanvas(grade, chip) {
  const S = chip ? 6 : 14, rows = Array.from({ length: S }, () => Array(S).fill('o'));
  stampPieces(rows, grade, chip ? 1 : 3, seeded(3 + ORES.indexOf(grade)), ch => ch === 'o');
  // a dark rim around the pieces so they read on any floor
  const out = rows.map((r, j) => r.map((ch, i) => (ch !== 'o' ? ch : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => rows[j + dy]?.[i + dx] > '0' && rows[j + dy]?.[i + dx] <= '4') ? 'k' : '.')));
  const pad = chip ? 0 : 1;
  return spriteCanvas([...Array(pad).fill('.'.repeat(S + 2 * pad)), ...out.map(r => '.'.repeat(pad) + r.join('') + '.'.repeat(pad))], pieceColor(grade));
}
export const dropKey = tier => `t_drop_${ORES[tier].id}`;
export const chipKey = tier => `t_chip_${ORES[tier].id}`;

// A vein spanning two to four tiles is drawn as one big rock over the whole shape, in the same
// colours as the one-tile ore (outline k, rock L, light l, shadow d, sparkle w), with more pieces the
// bigger it is, and like it standing ORE_TALL pixels up over the row above with the grade's crystals or
// nuggets bursting out of the top (one cluster, two on a big one). Seeded by where it lies, so it looks
// the same every time.
function veinRows(cells, grade) {
  const x0 = Math.min(...cells.map(c => c.x)), y0 = Math.min(...cells.map(c => c.y));
  const bw = Math.max(...cells.map(c => c.x)) - x0 + 1, bh = Math.max(...cells.map(c => c.y)) - y0 + 1;
  const W = bw * TILE, H = bh * TILE;
  let seed = (x0 * 7919 + y0 * 104729 + cells.length * 31) | 0;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff);
  const has = (cx, cy) => cells.some(c => c.x - x0 === cx && c.y - y0 === cy);
  // a lumpy top edge, so the rock is not a box
  const bump = Array.from({ length: Math.ceil(W / 3) + 1 }, () => (rnd() < 0.4 ? 1 : 0));
  // the rock: the vein's tiles pulled in from the outside, a round dome on top, smaller corners below
  const inside = (px, py) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return false;
    const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE), lx = px % TILE, ly = py % TILE;
    if (!has(cx, cy)) return false;
    const l = has(cx - 1, cy) ? 99 : lx - 1, r = has(cx + 1, cy) ? 99 : TILE - 2 - lx;
    const u = has(cx, cy - 1) ? 99 : ly - 2 - bump[Math.floor(px / 3)], d = has(cx, cy + 1) ? 99 : TILE - 3 - ly;
    if (Math.min(l, r, u, d) < 0) return false;
    const round = (a, b, rad) => a < rad && b < rad && (rad - a) ** 2 + (rad - b) ** 2 > rad * rad;
    return !(round(l, u, 6) || round(r, u, 6) || round(l, d, 3) || round(r, d, 3));
  };
  const out = (px, py) => !inside(px, py);
  const rows = [];
  for (let py = 0; py < H; py++) {
    const row = [];
    for (let px = 0; px < W; px++) {
      if (out(px, py)) row.push('.');
      else if (out(px - 1, py) || out(px + 1, py) || out(px, py - 1) || out(px, py + 1)) row.push('k');
      else if (out(px, py + 2) || out(px + 2, py) || (out(px + 3, py) && rnd() < 0.6)) row.push('d');
      else if (out(px, py - 2) || out(px - 2, py)) row.push(rnd() < 0.7 ? 'l' : 'L');
      else row.push('L');
    }
    rows.push(row);
  }
  const face = (px, py) => inside(px, py) && rows[py][px] === 'L';
  // facets: shadow lines running down from the top, like cracks between the rock's faces
  for (let n = 0; n < cells.length * 2; n++) {
    let px = 3 + Math.floor(rnd() * (W - 6)), py = 2;
    while (py < H && !face(px, py)) py++;
    const slope = rnd() < 0.5 ? -1 : 1;
    for (let k = 0; k < 5 + rnd() * 6 && face(px, py); k++) {
      rows[py][px] = 'd';
      py++;
      if (rnd() < 0.5) px += slope;
    }
  }
  // light patches
  for (let n = 0; n < cells.length * 5; n++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    if (face(px, py) && face(px + 1, py)) { rows[py][px] = 'l'; rows[py][px + 1] = 'l'; }
  }
  // the grade's pieces stuck in the rock, more of them the bigger it is
  stampPieces(rows, grade, cells.length * 3, rnd);
  for (let n = 0, tries = 0; n < cells.length * 2 && tries < 300; tries++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    if (face(px, py)) { rows[py][px] = 'w'; n++; }
  }
  const tall = [...Array.from({ length: ORE_TALL }, () => Array(W).fill('.')), ...rows];
  const tops = cells.filter(c => !has(c.x - x0, c.y - y0 - 1)).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of cells.length >= 3 && tops.length >= 2 ? [tops[0], tops[tops.length - 1]] : tops.slice(0, 1)) crown(tall, grade, (c.x - x0) * TILE, (c.y - y0) * TILE + 1);
  return { rows: tall.map(r => r.join('')), x0, y0 };
}

// The 2x2 jackpot (v0.29): a giant, a hill of rock with the grade's crystals bursting up out of the back
// of it in a fan, the middle one GIANT_TALL pixels up over the row above, and gems big and small set in
// the rock's face (nuggets for the metals). Each thing gets its own dark edge against what stands behind
// it, so the shards read one by one. The rainbow stone's shards and gems take one colour each.
export const GIANT_TALL = 18;
const SET = {
  gem: [
    ['...k...', '..k4k..', '.k412k.', 'k11223k', '.k233k.', '..k3k..', '...k...'],
    ['.kkk.', 'k412k', 'k123k', 'k233k', '.kkk.'],
    ['.k.', 'k4k', 'k3k', '.k.'],
  ],
  metal: [
    ['.kkkk.', 'k4122k', 'k12233', 'k2233k', '.kkkk.'],
    ['.kkk.', 'k412k', 'k223k', '.kkk.'],
    ['.kk.', 'k42k', '.kk.'],
  ],
};
// [base x, base y, tip x, tip y, half width] from the top of the picture, back to front
const SHARDS = [[7, 16, 1.5, 2, 2.3], [25, 16, 30.5, 0, 2.3], [11, 16, 5, -10, 3.7], [21, 16, 26.5, -13, 3.7], [16, 16, 15.5, -GIANT_TALL, 4.7]];
const SIDE_SHARDS = [[5, 24, 0.5, 18, 1.7], [27, 22, 31, 15, 1.7]];
// the rock's top edge, (x, y below the top of the 2x2)
const HILL = [[0, 26], [2, 21], [4, 18], [5, 15], [7, 17], [9, 15], [11, 13], [13, 14], [16, 11], [19, 13], [21, 12], [23, 15], [25, 13], [27, 16], [28, 14], [30, 20], [32, 26]];
function giantRows(grade, seed) {
  const T = GIANT_TALL, W = 2 * TILE, H = 2 * TILE + T;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff);
  const id = Array.from({ length: H }, () => Array(W).fill(0)), hue = Array.from({ length: H }, () => Array(W).fill(0));
  const ch = Array.from({ length: H }, () => Array(W).fill('.'));
  const order = [];
  const shard = ([bx, by, tx, ty, hw], name, front) => {
    order.push(name);
    by += T; ty += T;
    const ax = tx - bx, ay = ty - by, len = Math.hypot(ax, ay), ux = ax / len, uy = ay / len, tip = Math.min(0.42, (hw * 2.2) / len);
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const vx = px + 0.5 - bx, vy = py + 0.5 - by, t = (vx * ux + vy * uy) / len, sd = vx * -uy + vy * ux;
      const w = t < 1 - tip ? hw : hw * (1 - t) / tip;
      if (t < -0.3 || t > 1 || Math.abs(sd) > w) continue;
      // three faces: lit on the left with a bright edge, the ridge bright near the point, dark on the right
      const f = sd / Math.max(1, w);
      id[py][px] = name; hue[py][px] = order.length;
      ch[py][px] = front ? (sd < 0 ? (t > 0.45 ? '1' : '2') : '3')
        : f < -0.34 ? (f < -0.7 && t > 0.2 ? '1' : '2') : f <= 0.22 ? (t > 0.5 ? '1' : '2') : '3';
    }
  };
  SHARDS.forEach((sh, k) => shard(sh, `s${k}`));
  const top = x => {
    for (let k = 0; k < HILL.length - 1; k++) {
      const [x0, y0] = HILL[k], [x1, y1] = HILL[k + 1];
      if (x >= x0 && x <= x1) return T + y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return H;
  };
  order.push('r');
  for (let py = 0; py < H - 1; py++) for (let px = 0; px < W; px++) {
    if (py + 0.5 < top(px + 0.5)) continue;
    const r = 4, cx = px < r ? r - px - 0.5 : px > W - 1 - r ? px + 0.5 - (W - r) : 0, cy = py > H - 2 - r ? py + 0.5 - (H - 1 - r) : 0;
    if (cx * cx + cy * cy <= r * r) { id[py][px] = 'r'; ch[py][px] = 'L'; }
  }
  const isR = (x, y) => id[y]?.[x] === 'r';
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    if (!isR(px, py)) continue;
    if (!isR(px, py - 2) || !isR(px - 2, py)) ch[py][px] = rnd() < 0.8 ? 'l' : 'L';
    if (!isR(px, py + 2) || !isR(px + 2, py) || (!isR(px + 3, py) && rnd() < 0.6)) ch[py][px] = 'd';
  }
  // cracks between the rock's faces, down from the dips in its top
  for (const sx of [7, 13, 19, 23]) {
    let x = sx, y = Math.ceil(top(sx + 0.5)) + 2;
    for (let k = 0; k < 6 + rnd() * 6 && isR(x, y + 1); k++) {
      if (ch[y][x] === 'L' || ch[y][x] === 'l') ch[y][x] = 'd';
      y++;
      if (rnd() < 0.45) x += sx < 16 ? -1 : 1;
    }
  }
  // gems big and small set in its face, each wholly inside the rock
  const face = (x, y) => isR(x, y) && 'Lld'.includes(ch[y][x]) && isR(x - 1, y) && isR(x + 1, y) && isR(x, y - 1) && isR(x, y + 1);
  const sets = SET[grade.metal ? 'metal' : 'gem'];
  let gems = 0;
  for (const k of [0, 0, 1, 1, 2, 2, 2]) for (let tries = 0; tries < 300; tries++) {
    const pat = sets[k], x0 = 1 + Math.floor(rnd() * (W - 7)), y0 = T + 14 + Math.floor(rnd() * 14);
    if (!pat.every((r, j) => [...r].every((c, i) => c === '.' || face(x0 + i, y0 + j)))) continue;
    gems++;
    pat.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') { ch[y0 + j][x0 + i] = c; hue[y0 + j][x0 + i] = 7 + gems; } }));
    break;
  }
  SIDE_SHARDS.forEach((sh, k) => shard(sh, `f${k}`, true));
  // outlines: each thing's edge against the air or against what stands behind it
  const rank = o => order.indexOf(o), out = ch.map(r => r.slice());
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const me = id[py][px];
    if (me && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = id[py + dy]?.[px + dx]; return !n || rank(n) < rank(me); })) out[py][px] = 'k';
  }
  // a glint on each big shard, white sparks on the rock
  for (const [x, y] of [[13, 6], [6, T - 4], [24, T - 7]]) if (out[y][x] !== 'k' && out[y][x] !== '.') out[y][x] = '4';
  for (let n = 0, tries = 0; n < 4 && tries < 300; tries++) {
    const x = Math.floor(rnd() * W), y = T + 12 + Math.floor(rnd() * 16);
    if (out[y][x] === 'L') { out[y][x] = 'w'; n++; }
  }
  const base = pieceColor(grade);
  const recolor = grade.vein ? base : (c, i, j) => {
    if (c < '1' || c > '3') return base(c, i, j);
    const light = RAINBOW[hue[j][i] % RAINBOW.length], dark = mix(light, '#000000', 0.35);
    return c === '1' ? mix(light, '#ffffff', 0.55) : c === '2' ? light : dark;
  };
  return { rows: out.map(r => r.join('')), recolor };
}
export const isGiant = ore => ore.cells?.length === 4 && new Set(ore.cells.map(c => c.x)).size === 2 && new Set(ore.cells.map(c => c.y)).size === 2;
// how far an ore stands up over the row above it
export const oreTall = ore => (ore.pebble ? 0 : isGiant(ore) ? GIANT_TALL : ORE_TALL);

// The texture and frame for one tile of an ore: [key, frame]. One-tile ores use the plain sprite.
export function oreFrame(scene, ore, x, y, tier = ore.tier) {
  const grade = ORES[tier];
  if (!ore.cells || ore.cells.length < 2) return [`t_ore_${grade.id}`, undefined];
  const x0 = Math.min(...ore.cells.map(c => c.x)), y0 = Math.min(...ore.cells.map(c => c.y));
  if (isGiant(ore)) {
    const key = `t_giant_${x0}_${y0}_${grade.id}`;
    if (!scene.textures.exists(key)) {
      const { rows, recolor } = giantRows(grade, x0 * 7919 + y0 * 104729 + 17);
      const tex = scene.textures.addCanvas(key, spriteCanvas(rows, recolor));
      for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) tex.add(`${cx}_${cy}`, 0, cx * TILE, cy ? TILE + GIANT_TALL : 0, TILE, TILE + (cy ? 0 : GIANT_TALL));
    }
    return [key, `${x - x0}_${y - y0}`];
  }
  const shape = ore.cells.map(c => `${c.x - x0}${c.y - y0}`).join('');
  const key = `t_vein_${x0}_${y0}_${shape}_${grade.id}`;
  const tx = scene.textures;
  if (!tx.exists(key)) {
    const { rows } = veinRows(ore.cells, grade);
    const tex = tx.addCanvas(key, spriteCanvas(rows, pieceColor(grade)));
    // a tile with none of the rock above it takes the bit that stands up over the row above as well
    for (const c of ore.cells) {
      const top = !ore.cells.some(o => o.x === c.x && o.y === c.y - 1);
      tex.add(`${c.x - x0}_${c.y - y0}`, 0, (c.x - x0) * TILE, (c.y - y0) * TILE + (top ? 0 : ORE_TALL), TILE, TILE + (top ? ORE_TALL : 0));
    }
  }
  return [key, `${x - x0}_${y - y0}`];
}

// 꾸미기 (data/wear.js): a hero frame (`key`: a sprite or a walk step, with or without a face, see
// data/faces.js faceKey) with what the player wears stamped on, made the first time it is asked for.
// Nothing worn: the frame itself.
export function dressKey(scene, key, wear) {
  const tag = wearTag(wear);
  if (!tag) return key;
  const out = `${key}^${tag}`;
  if (scene.textures.exists(out)) return out;
  const [name, expr] = key.split('~'), rows = SPR[name];
  if (!rows) return key;
  scene.textures.addCanvas(out, spriteCanvas(dressRows(expr ? faceRows(rows, expr) : rows, wear, SPR[name.replace(/_walk\d$/, '')] || rows)));
  return out;
}
// the same for the shop's little pictures
export const dressedCanvas = (sprite, wear) => spriteCanvas(dressRows(SPR[sprite], wear));

// Same canvases for the DOM (HUD icons, hub cards, choice cards).
const domCache = {};
export function spriteForDom(name) {
  const grade = name.startsWith('t_ore_') && ORES.find(o => `t_ore_${o.id}` === name);
  return (domCache[name] ||= grade ? oreCanvas(grade) : spriteCanvas(charRows(name)));
}
// a little picture made from rows that are not a sprite of their own (data/finds-art.js), for the DOM
export const rowsCanvas = rows => spriteCanvas(rows);

// 별난 친구 (v0.30, data/odd.js): a critter's picture as one of the odd ones. 황금: every colour turned to
// gold by how light it is (the outline and the eyes stay dark); 아기: paler (and drawn smaller where it
// stands); 꽃단장: a little garland of flowers on top of its head; 잠꾸러기: a nightcap; 꼬부랑: faded, with
// white brows over its eyes and a walking stick.
const GOLD_RAMP = ['#fff3b0', '#f4cf4f', '#dcb75a', '#c99a2b', '#8f6a1c'];
const DARKS = new Set(['k', 'x']);
const lum = c => { const n = rgbInt(c); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const solidAt = (g, x, y) => (g[y]?.[x] ?? '.') !== '.';
// stamps `pat` (rows; '.' leaves what is there) with its top-left at x, y, then outlines what it added
function stamp(g, pat, x, y) {
  const added = [];
  pat.forEach((r, j) => [...r].forEach((ch, i) => {
    const gx = x + i, gy = y + j;
    if (ch === '.' || gy < 0 || gy >= g.length || gx < 0 || gx >= g[0].length) return;
    g[gy][gx] = ch;
    added.push([gx, gy]);
  }));
  for (const [ax, ay] of added) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = ax + dx, ny = ay + dy;
    if (ny >= 0 && ny < g.length && nx >= 0 && nx < g[0].length && g[ny][nx] === '.') g[ny][nx] = 'k';
  }
}
export function oddRows(rows, variant) {
  const g = rows.map(r => [...r]);
  const top = g.findIndex(r => r.some(c => c !== '.'));
  const xs = g.slice(top, top + 2).flatMap(r => r.map((c, i) => (c !== '.' ? i : -1)).filter(i => i >= 0));
  const cx = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  if (variant === 'flower') stamp(g, ['q.w.q', 'GqyqG'], cx - 2, Math.max(1, top - 2));
  if (variant === 'sleepy') stamp(g, ['......w', '.....bk', '....bbk', '...bbBk', '..bbbBk', 'wwwwwww'], cx - 3, Math.max(0, top - 4));
  if (variant === 'old') {
    // white brows over the eyes: a dark pixel with face on both sides of it
    for (let y = 1; y < g.length; y++) for (let x = 1; x < g[0].length - 1; x++) {
      const face = c => c !== '.' && !DARKS.has(c);
      if (g[y][x] === 'k' && face(g[y][x - 1]) && face(g[y][x + 1]) && face(g[y - 1][x])) g[y - 1][x] = 'w';
    }
    // a stick at its side, as tall as its body
    const right = Math.max(...g.map(r => r.reduce((m, c, i) => (c !== '.' ? i : m), -1)));
    const bottom = g.length - 1 - [...g].reverse().findIndex(r => r.some(c => c !== '.'));
    const sx = Math.min(g[0].length - 2, right + 1), h = Math.max(4, Math.round((bottom - top) * 0.6));
    stamp(g, ['nn', ...Array(h - 1).fill('.n')], sx - 1, bottom - h + 1);
  }
  return g.map(r => r.join(''));
}
export function oddRecolor(variant) {
  if (variant === 'gold') return ch => { if (DARKS.has(ch) || !PAL[ch]) return null; const i = [0.85, 0.66, 0.46, 0.28].findIndex(t => lum(PAL[ch]) > t); return GOLD_RAMP[i < 0 ? 4 : i]; };
  if (variant === 'baby') return ch => (DARKS.has(ch) || !PAL[ch] ? null : mix(PAL[ch], '#ffffff', 0.3));
  if (variant === 'old') return ch => (DARKS.has(ch) || !PAL[ch] || ch === 'w' ? null : mix(PAL[ch], '#b8ad9e', 0.45));
  return null;
}
export const oddCanvas = (name, variant) => (domCache[`${name}~odd${variant}`] ||= spriteCanvas(oddRows(charRows(name), variant), oddRecolor(variant)));
// the same as a texture for the fields, made the first time one turns up
export function oddKey(scene, name, variant) {
  const key = `${name}~odd${variant}`;
  if (!scene.textures.exists(key) && charRows(name)) scene.textures.addCanvas(key, spriteCanvas(oddRows(charRows(name), variant), oddRecolor(variant)));
  return key;
}

// 주운 것 (v0.30, data/trinkets.js): a little thing lying in the field, as a texture
export function findKey(scene, id) {
  const key = `find_${id}`, t = TRINKET[id];
  if (!scene.textures.exists(key) && t) scene.textures.addCanvas(key, spriteCanvas(findIcon(t.shape, t.pal)));
  return key;
}

// Small deterministic noise so tiles look hand-drawn but never flicker.
function noise(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = TILE; c.height = TILE;
  return [c, c.getContext('2d')];
}

// Ground: the zone's colour with little marks so it never looks like flat paint (grass tufts on the
// meadow and in the forest, grit on the mountain). Variants 3+ carry a detail of the place:
// flowers and clover on the meadow, mushrooms, twigs and fallen leaves in the forest,
// pebbles, tufts and small crystals on the mountain.
const FLOOR_VARIANTS = 8;
const DETAILS = {
  meadow: [null, null, null,
    px => px('#4f9a3e', [[5, 6], [6, 6], [5, 7], [8, 6], [9, 6], [9, 7], [6, 9], [7, 9], [7, 10], [8, 9]]), // clover
    px => { px('#f4f0e8', [[7, 7], [9, 7], [8, 6], [8, 8], [3, 12], [12, 3]]); px('#f4cf4f', [[8, 7]]); }, // a daisy
    px => { px('#f29bb2', [[4, 5], [6, 5], [5, 4], [5, 6], [11, 11], [10, 10], [12, 10]]); px('#f4cf4f', [[5, 5], [11, 10]]); },
    px => { px('#f4cf4f', [[4, 10], [5, 9], [10, 5], [11, 4], [12, 12]]); px('#fff3b0', [[5, 10], [11, 5]]); }, // buttercups
    (px, z) => { // a bare patch of earth with a pebble
      px('#a08458', [[6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [6, 9], [7, 9], [8, 9], [9, 9]]);
      px('#c9a878', [[7, 8]]); px(z.floorDark, [[5, 9], [10, 9]]);
    }],
  forest: [null, null, null,
    px => px('#6b4a2e', [[3, 11], [4, 10], [5, 10], [6, 9], [7, 8], [8, 8], [9, 7], [6, 10]]), // a twig
    px => { // a red toadstool
      px('#1b1424', [[6, 11], [7, 12], [8, 12], [9, 11]]);
      px('#d9454a', [[6, 8], [7, 7], [8, 7], [9, 8], [6, 9], [7, 9], [8, 9], [9, 9], [7, 8], [8, 8]]);
      px('#f4f0e8', [[7, 8], [9, 9], [7, 10], [8, 10], [8, 11], [7, 11]]);
    },
    px => { px('#f08c3a', [[3, 4], [4, 4], [11, 9], [12, 10]]); px('#f4cf4f', [[9, 3], [10, 3], [5, 12]]); px('#b4581f', [[4, 5], [12, 9]]); },
    px => px('#7fb35a', [[4, 9], [5, 8], [6, 7], [7, 8], [8, 9], [6, 8], [10, 5], [11, 4], [12, 5]]), // a fern
    px => { px('#a0703f', [[4, 6], [5, 6], [10, 10], [11, 10], [9, 11]]); px('#f4f0e8', [[4, 7], [5, 7], [10, 11], [11, 11]]); },
  ],
  marsh: [null, null, null,
    (px, z) => { px(z.water, [[5, 8], [6, 8], [7, 8], [8, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [5, 10], [6, 10], [7, 10], [8, 10]]); px(z.waterLight, [[6, 9], [7, 9]]); }, // a puddle
    px => { px('#6f7d3a', [[4, 12], [5, 11], [5, 10], [6, 9], [10, 12], [10, 11], [11, 10], [7, 12], [7, 11]]); px('#7a5230', [[5, 8], [5, 9], [11, 8], [11, 9]]); }, // two cattails
    px => { px('#c8f07a', [[4, 5], [11, 9], [7, 12]]); px('#f4ffb8', [[4, 5]]); }, // firefly specks
    px => { px('#d8c9a0', [[6, 9], [7, 9], [8, 9], [7, 8]]); px('#9a8c66', [[6, 10], [7, 10], [8, 10]]); px('#e58aa5', [[7, 8]]); }, // a little mushroom
    (px, z) => { px(z.floorDark, [[4, 6], [5, 6], [6, 7], [10, 10], [11, 10], [9, 11]]); px('#7f8f5a', [[5, 5], [10, 9]]); }, // moss lumps
  ],
  cave: [null, null, null,
    (px, z) => px(z.floorDark, [[3, 4], [4, 5], [5, 5], [6, 6], [7, 7], [8, 7], [9, 8], [9, 9]]), // a crack
    (px, z) => { px(z.floorDark, [[4, 11], [5, 11], [11, 6], [12, 6]]); px(z.floorLight, [[4, 10], [5, 10], [11, 5], [12, 5]]); }, // pebbles
    px => { px('#3d8fb3', [[6, 10], [7, 10], [7, 9], [8, 10]]); px('#8fd8f0', [[7, 8], [6, 9]]); px('#e8fbff', [[7, 8]]); }, // a blue crystal
    px => { px('#7a4fb0', [[9, 9], [10, 9], [10, 8], [11, 9]]); px('#c49aff', [[10, 7], [9, 8]]); }, // a violet crystal
    px => { px('#6fe0c8', [[5, 6], [11, 11]]); px('#2f8a7a', [[5, 7], [11, 12], [4, 7], [12, 12]]); }, // glowing moss
  ],
  rock: [null, null, null,
    (px, z) => px(z.floorDark, [[3, 3], [4, 4], [5, 4], [6, 5], [7, 6], [7, 7], [8, 8], [9, 8], [10, 9]]), // a crack
    (px, z) => { px(z.floorDark, [[4, 11], [5, 11], [10, 5], [11, 5], [12, 12]]); px(z.floorLight, [[4, 10], [5, 10], [10, 4], [11, 4], [12, 11]]); },
    px => { px('#2f7a43', [[6, 10], [8, 10], [7, 10]]); px('#6cc45a', [[5, 8], [6, 9], [8, 9], [9, 8], [7, 8]]); }, // a tuft
    px => { px('#c9c2b6', [[6, 7], [7, 7], [8, 7]]); px('#9a958c', [[5, 8], [6, 8], [7, 8], [8, 8], [9, 8]]); px('#5e5a52', [[5, 9], [6, 9], [7, 9], [8, 9], [9, 9]]); },
    px => { px('#3d8fb3', [[6, 9], [7, 9], [7, 8], [10, 10], [11, 10]]); px('#8fd8f0', [[6, 8], [7, 7], [10, 9]]); px('#c49aff', [[11, 9]]); },
  ],
};
// v0.23's five new grounds
Object.assign(DETAILS, {
  sea: [null, null, null,
    px => { px('#f2d2c8', [[6, 8], [7, 7], [8, 8], [7, 8]]); px('#c99a8c', [[6, 9], [7, 9], [8, 9]]); }, // a shell
    px => { px('#e0884a', [[7, 6], [6, 8], [7, 8], [8, 8], [5, 9], [9, 9], [7, 7], [7, 9], [6, 10], [8, 10]]); px('#f4b070', [[7, 8]]); }, // a starfish
    px => { px('#4f7a4a', [[4, 11], [5, 10], [5, 9], [6, 8], [10, 12], [10, 11], [11, 10]]); px('#6f9a5a', [[6, 7], [11, 9]]); }, // seaweed
    (px, z) => { px(z.floorDark, [[4, 5], [6, 5], [5, 6], [9, 9], [11, 9], [10, 10], [5, 12], [7, 12], [6, 13]]); }, // little crab tracks
    (px, z) => { px('#9a958c', [[9, 10], [10, 10], [11, 10]]); px('#c9c2b6', [[9, 9], [10, 9]]); px(z.floorDark, [[9, 11], [10, 11], [11, 11]]); },
  ],
  garden: [null, null, null,
    px => { px('#e6a0b8', [[5, 6], [6, 6], [6, 7]]); px('#f4cf4f', [[10, 10], [11, 10], [11, 11]]); px('#e6a0b8', [[12, 4]]); }, // fallen petals
    px => { px('#f4f0e8', [[6, 6], [8, 6], [7, 5], [7, 7]]); px('#f4cf4f', [[7, 6]]); px('#4f9a3e', [[7, 8], [7, 9], [8, 10]]); }, // a little daisy
    px => { px('#5f9a48', [[6, 10], [7, 9], [8, 10], [7, 10]]); px('#8fcf72', [[6, 9], [8, 9]]); }, // a sprout
    px => { px('#f4d98a', [[4, 4], [9, 7], [12, 11], [6, 12], [11, 5]]); }, // pollen dust
    px => { px('#a0703f', [[5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]]); px('#6f9a5a', [[6, 8], [9, 8], [8, 7]]); }, // a dropped twig with a leaf
  ],
  snow: [null, null, null,
    (px, z) => { px(z.floorDark, [[5, 5], [6, 5], [5, 6], [9, 9], [10, 9], [9, 10], [6, 12], [7, 12]]); }, // footprints
    px => { px('#6b4a2e', [[4, 10], [5, 9], [6, 9], [7, 8], [8, 8], [6, 10]]); }, // a twig poking out of the snow
    (px, z) => { px('#ffffff', [[6, 7], [7, 7], [8, 7]]); px(z.floorLight, [[5, 8], [6, 8], [7, 8], [8, 8], [9, 8]]); px(z.floorDark, [[5, 9], [6, 9], [7, 9], [8, 9], [9, 9]]); }, // a lump
    px => { px('#ffffff', [[4, 4], [11, 7], [7, 12]]); px('#dff4ff', [[5, 4], [11, 8]]); }, // sparkles
    (px, z) => { px(z.floorDark, [[4, 7], [5, 7], [6, 8], [7, 8], [8, 9], [9, 9], [10, 10]]); }, // a crack in the crust
  ],
  volcano: [null, null, null,
    px => { px('#ff9a3a', [[7, 8]]); px('#c4501f', [[6, 8], [8, 8], [7, 9]]); }, // an ember
    (px, z) => { px(z.floorDark, [[3, 5], [4, 6], [5, 6], [6, 7], [7, 8], [8, 8], [9, 9]]); px('#c4501f', [[5, 6], [7, 8]]); }, // a glowing crack
    px => { px('#1b1424', [[6, 9], [7, 8], [8, 9], [7, 9]]); px('#5a4a6a', [[7, 8]]); }, // an obsidian shard
    (px, z) => { px(z.floorLight, [[4, 10], [5, 10], [10, 5], [11, 5], [12, 12]]); px(z.floorDark, [[4, 11], [5, 11], [10, 6], [11, 6]]); },
    px => { px('#8a7e70', [[6, 7], [7, 7], [8, 8], [6, 8], [7, 8]]); px('#a89c8c', [[6, 7]]); }, // pumice
  ],
  ruins: [null, null, null,
    px => { px('#c9c2b6', [[6, 8], [7, 8], [8, 8], [9, 8], [6, 9], [9, 9], [6, 10], [7, 10], [8, 10], [9, 10]]); px('#7a4e57', [[7, 9], [8, 9]]); px('#a0703f', [[7, 6], [8, 7]]); }, // a worker's name tag on its string
    (px, z) => { px(z.floorDark, [[4, 4], [5, 5], [6, 5], [7, 6], [7, 7], [8, 8]]); }, // a cracked flagstone
    px => { px('#5f8a4a', [[5, 10], [6, 9], [6, 10], [7, 10], [10, 6], [11, 5]]); }, // weeds between the stones
    px => { px('#f4cf4f', [[7, 8]]); px('#c99a2b', [[8, 8], [7, 9]]); }, // a lost button
    (px, z) => { px('#7a6a60', [[5, 7], [6, 7], [7, 7], [5, 8], [6, 8]]); px(z.floorDark, [[5, 9], [6, 9], [7, 8]]); }, // a bit of brick
  ],
});

function floorTile(z, zi, variant) {
  const [c, g] = canvas(), r = noise(variant * 17 + 3 + zi * 101);
  const px = (col, list) => { g.fillStyle = col; list.forEach(([x, y]) => g.fillRect(x, y, 1, 1)); };
  g.fillStyle = z.floor; g.fillRect(0, 0, TILE, TILE);
  const stony = ['rock', 'cave', 'volcano', 'ruins'].includes(z.style), soft = z.style === 'sea' || z.style === 'snow';
  // flagstones in the ruins: a few seams
  if (z.style === 'ruins') {
    g.fillStyle = z.floorDark;
    g.fillRect(0, 7 + (variant % 2), TILE, 1); g.fillRect(4 + variant, 0, 1, 7 + (variant % 2)); g.fillRect((10 + variant * 3) % 15, 8, 1, 8);
  }
  for (let k = 0; k < (stony ? 7 : soft ? 5 : 6) + (variant % 3); k++) {
    const x = 1 + Math.floor(r() * 14), y = 1 + Math.floor(r() * 14);
    if (stony || soft) px(r() < 0.6 ? z.floorDark : z.floorLight, r() < 0.4 && !soft ? [[x, y], [x + 1, y]] : [[x, y]]);
    else { px(z.floorDark, [[x, y], [x, y - 1]]); px(z.floorDark, [[x + 2, y], [x + 2, y - 1], [x + 1, y + 1]]); } // a blade or two
  }
  // a few lighter blades in front, so the ground has some depth to it
  if (!stony && !soft) for (let k = 0; k < 4; k++) {
    const x = 1 + Math.floor(r() * 14), y = 2 + Math.floor(r() * 13);
    px(z.floorLight, [[x, y], [x + (k % 2 ? 1 : -1), y - 1]]);
  }
  for (let k = 0; k < 6; k++) px(z.floorLight, [[Math.floor(r() * TILE), Math.floor(r() * TILE)]]);
  DETAILS[z.style]?.[variant]?.(px, z);
  return c;
}

// `a` and `b` are '#rrggbb', or 'rgb(r,g,b)' from an earlier mix
const rgbInt = c => (c[0] === '#' ? parseInt(c.slice(1), 16) : c.match(/\d+/g).reduce((n, v) => (n << 8) | +v, 0));
const mix = (a, b, t) => {
  const pa = rgbInt(a), pb = rgbInt(b);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// Neighbour masks for walls, water and floor shading: bit set = that side is open.
export const N = 1, E = 2, S = 4, W_ = 8, NE = 16, SE = 32, SW = 64, NW = 128;

// Clumps for the top of a wall: a staggered grid of little shapes (h highlight, l light, d shadow),
// a few left out at random, clipped to rows y0..y1.
const LEAVES = ['.hl.', 'hll.', 'l..d', '.dd.'];
const BOULDER = ['.hhl.', 'hll.d', '.ddd.'];
function clumps(fill, r, v, y0, y1, shape, col) {
  for (let gy = -1; gy < 5; gy++) for (let gx = -1; gx < 5; gx++) {
    if (r() < 0.25) continue;
    const ox = gx * 4 + (gy % 2 ? 2 : 0) + ((v + gy) % 3) - 1, oy = y0 + gy * 4 + (gx % 2);
    shape.forEach((row, j) => [...row].forEach((ch, i) => {
      const x = ox + i, y = oy + j;
      if (ch !== '.' && x >= 0 && x < TILE && y >= y0 && y < y1) fill(col[ch], x, y);
    }));
  }
}

// The giant garden's top: one huge leaf over the tile, a pale vein down it, and now and then the
// edge of a giant petal.
function leafTop(fill, r, v, y1, z, hi) {
  clumps(fill, r, v, 0, y1, LEAVES, { h: hi, l: z.wallLight, d: z.wallDark });
  const vx = 3 + ((v * 5) % 9);
  for (let y = 0; y < y1; y++) fill(mix(z.wallLight, '#ffffff', 0.35), vx + (y >> 2), y);
  if (r() < 0.22) {
    const col = mix(['#e48aa8', '#f4cf4f', '#f4f0e8', '#c49aff'][Math.floor(r() * 4)], z.wallTop, 0.4), x = Math.floor(r() * 10), y = Math.floor(r() * Math.max(1, y1 - 5));
    fill(col, x, y, 5, 3); fill(col, x + 1, y + 3, 3, 1); fill(mix(col, '#000000', 0.2), x, y + 2, 5, 1);
  }
}

// The ruins' top: broken brick courses seen from above, moss and ivy creeping over them.
function brickTop(fill, r, v, y1, z) {
  const mortar = mix(z.wallTop, '#000000', 0.3);
  for (let y = 0; y < y1; y += 4) {
    fill(mortar, 0, y + 3, TILE, 1);
    for (let x = ((y >> 2) % 2) * 4 + v; x < TILE; x += 8) fill(mortar, x, y, 1, 3);
    fill(z.wallLight, 0, y, TILE, 1);
  }
  for (let k = 0; k < 3; k++) if (r() < 0.5) { const x = Math.floor(r() * 13), y = Math.floor(r() * Math.max(1, y1 - 2)); fill('#4f7a42', x, y, 3, 2); fill('#6f9a5a', x, y); }
}

// The top of a reed bed: tufts of blades fanning up from a dark root, pale at the tips, in loose
// staggered rows, and now and then a cattail. (Single blades on every third pixel read as static
// over a big reed bed, v0.26.)
const TUFTS = [['h...h', 'l.h.l', '.lll.', '.ddd.'], ['.h.h.', '.lhl.', '.lll.', '.ddd.'], ['h.h..', 'l.lh.', '.lll.', '.ddd.'], ['..h.h', '.hl.l', '.lll.', '.ddd.']];
function reedTops(fill, r, v, y1, z, hi) {
  const lit = { h: hi, l: z.wallLight, d: z.wallDark }, shade = { h: z.wallLight, l: mix(z.wallTop, z.wallDark, 0.5), d: z.wallDark };
  for (let gy = -1; gy < 4; gy++) for (let gx = -1; gx < 2; gx++) {
    if (r() < 0.25) continue;
    // a few shapes, some tufts in the shade of the others, so the bed never looks stamped
    const tuft = TUFTS[Math.floor(r() * TUFTS.length)], col = r() < 0.3 ? shade : lit;
    const ox = gx * 8 + (gy % 2 ? 4 : 0) + ((v + gy + 3) % 3) - 1, oy = gy * 4 + (gx % 2) + (r() < 0.3 ? 1 : 0);
    tuft.forEach((row, j) => [...row].forEach((ch, i) => {
      const x = ox + i, y = oy + j;
      if (ch !== '.' && x >= 0 && x < TILE && y >= 0 && y < y1) fill(col[ch], x, y);
    }));
  }
  if (r() < 0.5) { const x = 2 + Math.floor(r() * 11), y = Math.floor(r() * Math.max(1, y1 - 3)); fill('#7a5230', x, y, 1, 2); fill('#4f331d', x, y + 1); }
}

// The plateau's top: snow lying over the rocks in soft drifts, white where the light catches them and
// blue in the hollows between, a dark stone with a cap of snow poking out now and then, a glint of
// frost. (The mountain's boulders recoloured white read as cobbles, v0.26.)
const DRIFTS = [['h......', 'x.....x', '.xdddx.'], ['.h...', 'x...x', '.ddd.'], ['h........', 'x.......x', '.xddddddx']];
function driftTop(fill, r, v, y1, z) {
  const col = { h: '#ffffff', x: mix(z.wallLight, z.wallTop, 0.6), d: mix(z.wallTop, '#5a6a8a', 0.35) };
  fill(z.wallLight, 0, 0, TILE, y1);
  for (let gy = -1; gy < 4; gy++) for (let gx = -1; gx < 2; gx++) {
    if (r() < 0.3) continue;
    const shape = DRIFTS[Math.floor(r() * DRIFTS.length)];
    const ox = gx * 8 + (gy % 2 ? 4 : 0) + ((v + gy + 3) % 3) - 1, oy = gy * 5 + (gx % 2) + 1;
    shape.forEach((row, j) => [...row].forEach((ch, i) => {
      const x = ox + i, y = oy + j;
      if (ch !== '.' && x >= 0 && x < TILE && y >= 0 && y < y1) fill(col[ch], x, y);
    }));
  }
  if (y1 > 6 && r() < 0.35) {
    const x = 2 + Math.floor(r() * 10), y = 1 + Math.floor(r() * (y1 - 5));
    fill(z.wallFace, x, y + 1, 3, 2); fill(z.wallDark, x, y + 2, 3, 1); fill(mix(z.wallFace, '#ffffff', 0.25), x, y + 1);
    fill('#ffffff', x, y, 3, 1);
  }
  if (r() < 0.5) { const x = 1 + Math.floor(r() * 13), y = Math.floor(r() * Math.max(1, y1 - 1)); fill('#ffffff', x, y); fill('#dff4ff', x + 1, y); }
}

// The mountain's and the sea cliffs' top: bare rock with a few boulders of different sizes lying on
// it, each lit from the top left with its shadow on the rock, and a crack or two between them. (A
// close mosaic of one size of boulder read as cobbles, a paved road, v0.26.)
const STONES = [['.hhh.', 'hlllx', 'lllxx', '.xxx.'], ['..hhh..', '.hlllll', 'hllllxx', 'lllllxx', '.xxxxx.'], ['.hh', 'hlx', '.x.']];
function rockTop(fill, r, v, y1, z, hi) {
  const col = { h: hi, l: z.wallLight, x: mix(z.wallLight, z.wallTop, 0.5) }, shadow = z.wallDark, crack = mix(z.wallTop, z.wallDark, 0.6);
  for (let k = 0; k < 2; k++) {
    let x = 1 + Math.floor(r() * 14), y = Math.floor(r() * y1);
    const dx = r() < 0.5 ? 1 : -1;
    for (let n = 0; n < 3 + Math.floor(r() * 4) && x >= 0 && x < TILE && y < y1; n++) { fill(crack, x, y); if (r() < 0.55) x += dx; else y++; }
  }
  for (let gy = -1; gy < 4; gy++) for (let gx = -1; gx < 3; gx++) {
    if (r() < 0.45) continue;
    const st = STONES[Math.floor(r() * STONES.length)];
    const ox = gx * 6 + (gy % 2 ? 3 : 0) + ((v + gy + 3) % 3) - 1, oy = gy * 5 + (gx % 2) + Math.floor(r() * 2);
    st.forEach((row, j) => [...row].forEach((ch, i) => {
      const x = ox + i, y = oy + j;
      if (ch === '.' || x < 0 || x >= TILE || y < 0 || y >= y1) return;
      fill(col[ch], x, y);
      if (y + 1 < y1 && (j === st.length - 1 || st[j + 1][i] === '.')) fill(shadow, x, y + 1);
    }));
  }
}

// A wall seen from above. Its top fills the tile; where floor lies below it, its front shows on the
// lower part of the tile. A dark line marks every side that faces open ground.
//   meadow: a clipped hedge, leafy on top and in front
//   forest: the canopy on top, and in front tree trunks standing in the dark under it
//   marsh:  a reed bed, blades on top, stalks and cattails in front
//   rock:   a cliff, cracked on top, with a face of rough blocks
//   cave:   dark rock flecked with crystals, stalactites hanging off its face
// `v` (0-2) shifts the leaves, trunks and seams so a long wall does not look stamped.
// Out on the meadow the hedges are only a row thick: what lies beyond them is open pasture, tall grass
// swaying in the wind with seed heads and a flower here and there, so the meadow looks like rolling
// fields between hedgerows and not a wood.
function pastureTile(z, v) {
  const [c, g] = canvas(), r = noise(v * 53 + 11);
  const fill = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // uncut grass beyond the hedgerows: a touch of straw gold and tufts of tall blades,
  // so it never reads as the mown grass you walk on
  // (in the night's shade, a step darker than the mown ground you walk on, v0.28: the field you can walk
  // is the lightest ground in sight, and the pasture past the hedge reads as beyond it)
  const base = mix(mix(mix(z.floorLight, z.wallLight, 0.3), '#a8975a', 0.3), z.wallDark, 0.3), soft = mix(base, '#0a1408', 0.22);
  const light = mix(base, '#eef4b8', 0.2), seed = mix(base, '#efe2a0', 0.42);
  fill(base, 0, 0, TILE, TILE);
  for (let k = 0; k < 3; k++) {
    const x = 1 + Math.floor(r() * 11), y = 5 + Math.floor(r() * 9);
    // a tuft: thin blades of different heights, the tall ones bending over at the tip
    for (const [dx, h, lean] of [[0, 2, -1], [2, 4, 1], [4, 3, 0]]) {
      fill(soft, x + dx, y + 1);
      fill(light, x + dx, y - h + 2, 1, h - 1);
      fill(light, x + dx + lean, y - h + 1);
    }
    if (r() < 0.5) fill(seed, x + 3, y - 3);
  }
  return c;
}

function wallTile(z, zi, mask, v) {
  if (!mask && z.style === 'meadow' && !z.day) return pastureTile(z, v);
  const [c, g] = canvas(), r = noise(mask * 7 + v * 131 + zi * 977 + 1);
  const fill = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const face = mask & S, topH = face ? ({ forest: 7, marsh: 6, garden: 6, ruins: 4 })[z.style] || 5 : TILE;
  // the top: rows of round leaf clumps (or boulders on the mountain), lit from the top left
  fill(z.wallTop, 0, 0, TILE, topH);
  // (the tops kept a little quieter than they were, v0.28, so a wall reads as one mass, not as more of the ground)
  const hi = mix(z.wallLight, '#ffffff', 0.2);
  if (z.style === 'marsh') reedTops(fill, r, v, topH, z, hi);
  else if (z.style === 'garden') leafTop(fill, r, v, topH, z, hi);
  else if (z.style === 'ruins') brickTop(fill, r, v, topH, z);
  else if (z.style === 'snow') driftTop(fill, r, v, topH, z);
  else if (z.style === 'rock' || z.style === 'sea') rockTop(fill, r, v, topH, z, hi);
  else clumps(fill, r, v, 0, topH, ['cave', 'volcano'].includes(z.style) ? BOULDER : LEAVES, { h: hi, l: z.wallLight, d: z.wallDark });
  // tufts of sea grass cling to the clifftop rocks
  if (z.style === 'sea') for (let k = 0; k < 2; k++) if (r() < 0.55) {
    const x = 1 + Math.floor(r() * 12), y = 1 + Math.floor(r() * Math.max(1, topH - 3));
    fill('#4f7a46', x, y + 1, 3, 1); fill('#6f9a58', x, y); fill('#6f9a58', x + 2, y); fill('#8fb86a', x + 1, y - 1 < 0 ? 0 : y - 1);
  }
  // the volcano's rock glows through its cracks
  if (z.style === 'volcano' && r() < 0.5) {
    const x = 2 + Math.floor(r() * 11), y = 1 + Math.floor(r() * Math.max(1, topH - 3));
    fill('#c4501f', x, y, 2, 1); fill('#ff9a3a', x + 1, y); fill('#c4501f', x + 2, y + 1);
  }
  // the cave's rock is flecked with crystals that catch the light
  if (z.style === 'cave') for (let k = 0; k < 2; k++) if (r() < 0.45) {
    const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * Math.max(1, topH - 3));
    const blue = r() < 0.6;
    const lit = mix(blue ? '#8fd8f0' : '#c49aff', z.wallTop, 0.35), deep = mix(blue ? '#3d8fb3' : '#7a4fb0', z.wallTop, 0.35);
    fill(lit, x, y); fill(deep, x, y + 1); fill(deep, x + 1, y + 1);
  }
  // the front
  if (face) {
    if (z.style === 'meadow') {
      fill(z.wallFace, 0, topH, TILE, TILE - topH);
      clumps(fill, r, v + 1, topH + 1, TILE - 3, LEAVES, { h: z.wallLight, l: z.wallTop, d: z.wallDark });
      // the top's leaves hang over the edge in little bumps
      for (let x = 0; x < TILE; x++) if ((x + v) % 4 < 2) fill(z.wallTop, x, topH, 1, 1);
      fill(z.wallDark, 0, TILE - 3, TILE, 1);
      fill(z.wallLine, 0, TILE - 2, TILE, 2);
    } else if (z.style === 'forest') {
      // dark between the trees, one trunk per tile with roots spreading at the foot
      fill(z.wallLine, 0, topH, TILE, TILE - topH);
      const tx = 4 + v;
      fill(z.wallFace, tx, topH, 6, TILE - topH);
      fill(mix(z.wallFace, '#ffffff', 0.2), tx, topH, 1, TILE - topH);
      const bark = mix(z.wallFace, '#000000', 0.35);
      fill(bark, tx + 2, topH + 2, 1, 4); fill(bark, tx + 4, topH + 4, 1, 3); fill(bark, tx + 5, topH, 1, TILE - topH);
      fill(z.wallFace, tx - 1, TILE - 2, 1, 1); fill(z.wallFace, tx + 6, TILE - 2, 1, 1); fill(bark, tx - 2, TILE - 1, 2, 1); fill(bark, tx + 6, TILE - 1, 2, 1);
      // the canopy's lower edge hangs down in leafy bumps
      for (let x = 0; x < TILE; x++) {
        const d = (x + v * 2) % 5 < 3 ? 1 : 0;
        fill(z.wallTop, x, topH, 1, d + 1);
        if (d) fill(z.wallDark, x, topH + 2, 1, 1);
      }
    } else if (z.style === 'marsh') {
      // reeds standing in the dark: stalks of two shades, a few cattails with brown heads
      fill(z.wallLine, 0, topH, TILE, TILE - topH);
      for (let x = (v % 2); x < TILE; x += 2) {
        const tall = (x * 7 + v * 3) % 5, col = (x + v) % 4 === 0 ? z.wallLight : z.wallFace;
        fill(col, x, topH, 1, TILE - topH - 1);
        if (tall === 0) { fill('#7a5230', x, topH + 1, 1, 3); fill('#4f331d', x, topH + 3, 1, 1); }
      }
      for (let x = 0; x < TILE; x++) if ((x + v) % 3 === 0) fill(z.wallTop, x, topH, 1, 1);
      fill(mix(z.water, '#000000', 0.3), 0, TILE - 2, TILE, 1);
      fill(z.wallLine, 0, TILE - 1, TILE, 1);
    } else if (z.style === 'cave') {
      // a rough rock face with stalactites hanging from the brow
      fill(z.wallFace, 0, topH, TILE, TILE - topH);
      fill(z.wallLight, 0, topH, TILE, 1);
      const sx = 2 + v * 4, sx2 = (sx + 7) % 14 + 1;
      fill(z.wallDark, sx, topH + 1, 1, 6); fill(z.wallDark, sx2, topH + 3, 1, 5);
      fill(mix(z.wallFace, '#ffffff', 0.12), sx + 1, topH + 1, 1, 5);
      for (const [x, len] of [[sx + 3, 3], [sx2 - 2, 2]]) if (x >= 0 && x < TILE) { fill(z.wallLight, x, topH + 1, 1, len); fill(z.wallLight, x - 1, topH + 1, 3, 1); }
      fill(z.wallDark, 0, TILE - 3, TILE, 1);
      fill(z.wallLine, 0, TILE - 2, TILE, 2);
    } else if (z.style === 'sea') {
      // a sea cliff: bands of rock laid down in layers, a fringe of the clifftop grass hanging over
      fill(z.wallFace, 0, topH, TILE, TILE - topH);
      const band = mix(z.wallFace, '#ffffff', 0.14), deep = mix(z.wallFace, '#000000', 0.25);
      for (const [y, col] of [[topH + 2, band], [topH + 3, deep], [topH + 6, band], [topH + 7, deep]]) if (y < TILE - 3) fill(col, 0, y, TILE, 1);
      fill(deep, (v * 5 + 3) % 14, topH + 3, 1, 4);
      for (let x = 0; x < TILE; x++) if ((x + v) % 3 < 2) fill(z.wallTop, x, topH, 1, 1 + ((x + v) % 5 === 0 ? 1 : 0));
      fill(z.wallDark, 0, TILE - 3, TILE, 1);
      fill(z.wallLine, 0, TILE - 2, TILE, 2);
    } else if (z.style === 'garden') {
      // under the giant leaves: thick green flower stalks standing in the shade
      fill(z.wallLine, 0, topH, TILE, TILE - topH);
      for (const sx of [1 + v, 8 + ((v * 2) % 3)]) {
        fill(z.wallFace, sx, topH, 4, TILE - topH);
        fill(mix(z.wallFace, '#ffffff', 0.22), sx, topH, 1, TILE - topH);
        fill(mix(z.wallFace, '#000000', 0.3), sx + 3, topH, 1, TILE - topH);
      }
      for (let x = 0; x < TILE; x++) if ((x + v) % 4 < 3) fill(z.wallTop, x, topH, 1, 1 + ((x + v) % 4 === 1 ? 1 : 0));
      fill(z.wallLine, 0, TILE - 1, TILE, 1);
    } else if (z.style === 'volcano') {
      // basalt in columns, a red glow seeping out at the foot
      fill(z.wallFace, 0, topH, TILE, TILE - topH);
      for (let x = (v * 2) % 5; x < TILE; x += 5) { fill(z.wallDark, x, topH, 1, TILE - topH - 2); fill(z.wallLight, x + 1, topH, 1, TILE - topH - 3); }
      fill(z.wallLight, 0, topH, TILE, 1);
      fill('#7a2a14', 0, TILE - 3, TILE, 1);
      fill(z.wallLine, 0, TILE - 2, TILE, 2);
      if (v === 1) fill('#c4501f', 6, TILE - 3, 3, 1);
    } else if (z.style === 'ruins') {
      // an old brick wall, ivy hanging down it here and there
      fill(z.wallFace, 0, topH, TILE, TILE - topH);
      const mortar = mix(z.wallFace, '#000000', 0.3), lit = mix(z.wallFace, '#ffffff', 0.12);
      for (let y = topH + 2, row = 0; y < TILE - 2; y += 3, row++) {
        fill(mortar, 0, y, TILE, 1);
        for (let x = (row % 2) * 3 + v; x < TILE; x += 6) fill(mortar, x, y - 2, 1, 2);
        fill(lit, 0, y + 1, TILE, 1);
      }
      if (v !== 1) { const ix = v * 6 + 2; fill('#3f5f3a', ix, topH, 2, 6); fill('#5f8a4a', ix, topH, 1, 4); fill('#3f5f3a', ix + 2, topH, 1, 3); }
      fill(z.wallDark, 0, TILE - 3, TILE, 1);
      fill(z.wallLine, 0, TILE - 2, TILE, 2);
    } else {
      fill(z.wallFace, 0, topH, TILE, TILE - topH);
      fill(z.wallLight, 0, topH, TILE, 1);
      // the snow on the plateau's rocks slumps over the edge
      if (z.style === 'snow') for (let x = 0; x < TILE; x++) fill(z.wallTop, x, topH, 1, 1 + ((x * 3 + v) % 4 === 0 ? 2 : (x + v) % 3 === 0 ? 1 : 0));
      // rough blocks: two rows, the seams shifted per tile
      const s1 = 4 + v * 3, s2 = (s1 + 6) % 13 + 1;
      fill(z.wallDark, 0, topH + 5, TILE, 1);
      fill(z.wallDark, s1, topH + 1, 1, 4); fill(z.wallDark, s2, topH + 6, 1, 4);
      fill(mix(z.wallFace, '#ffffff', 0.15), s1 + 1, topH + 1, 4, 1); fill(mix(z.wallFace, '#ffffff', 0.15), 0, topH + 6, s2, 1);
      fill(z.wallDark, 0, TILE - 3, TILE, 1);
      fill(z.wallLine, 0, TILE - 2, TILE, 2);
      // icicles hang from the snow's lip, one or two a tile
      if (z.style === 'snow') for (const [x, len] of [[(v * 5 + 2) % 14 + 1, 3 + (v % 2)], [(v * 5 + 9) % 14 + 1, 2]].slice(0, v === 2 ? 1 : 2)) {
        fill('#dff4ff', x, topH + 1, 1, len); fill('#a8cfe6', x, topH + 1 + len, 1, 1); fill('#a8cfe6', x + 1, topH + 1, 1, 1);
      }
    }
  }
  // dark edges along every side that faces open ground
  const line = z.wallLine;
  if (mask & N) fill(line, 0, 0, TILE, 1);
  if (mask & W_) fill(line, 0, 0, 1, TILE);
  if (mask & E) fill(line, TILE - 1, 0, 1, TILE);
  if (!face) {
    if ((mask & NE) && !(mask & (N | E))) fill(line, TILE - 1, 0);
    if ((mask & NW) && !(mask & (N | W_))) fill(line, 0, 0);
    if ((mask & SE) && !(mask & E)) fill(line, TILE - 1, TILE - 1);
    if ((mask & SW) && !(mask & W_)) fill(line, 0, TILE - 1);
  }
  return c;
}

// Soft shadow on a floor tile from the walls around it (bits: N, E, W are walls).
function shadeTile(mask) {
  const [c, g] = canvas();
  const band = (x, y, w, h, a) => { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(x, y, w, h); };
  if (mask & N) { band(0, 0, TILE, 1, 0.42); band(0, 1, TILE, 1, 0.28); band(0, 2, TILE, 1, 0.14); }
  if (mask & W_) { band(0, 0, 1, TILE, 0.26); band(1, 0, 1, TILE, 0.12); }
  if (mask & E) { band(TILE - 1, 0, 1, TILE, 0.26); band(TILE - 2, 0, 1, TILE, 0.12); }
  if ((mask & NW) && !(mask & (N | W_))) { band(0, 0, 2, 2, 0.3); }
  if ((mask & NE) && !(mask & (N | E))) { band(TILE - 2, 0, 2, 2, 0.3); }
  return c;
}

// Water with its shore: the bank's dark lip along the top (it stands above the water), a thin dark
// edge on the sides, a pale rim at the bottom, and foam that drifts along every edge.
// Bits in `mask` are the neighbours that are NOT water.
function waterTile(z, frame, mask, kind, round = false) {
  const [c, g] = canvas();
  g.fillStyle = z.water; g.fillRect(0, 0, TILE, TILE);
  // molten rock: dark crust floating on it, bright where it cracks open
  if (kind === 'lava') {
    // soft plates of crust drifting on it, glowing at their seams and white hot between them; made of
    // waves that repeat every tile, so a pool has no seams of its own
    const crust = mix(z.water, '#2a0f08', 0.62), crustTop = mix(z.water, '#4a1c0c', 0.5), seam = mix(z.water, '#ff3a10', 0.3);
    const tau = Math.PI * 2, ph = frame * 0.5;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const v = Math.sin(tau * (x + y) / 16 + ph) + 0.6 * Math.cos(tau * (2 * x - y) / 16 + 1.3 - ph) + 0.4 * Math.sin(tau * 2 * y / 16 + 0.7);
      g.fillStyle = v > 0.55 ? (v > 1.2 ? crustTop : crust) : v > 0.3 ? seam : v < -0.9 ? '#ffd56a' : z.water;
      g.fillRect(x, y, 1, 1);
    }
  }
  g.fillStyle = z.waterLight;
  const o = frame ? 3 : 0;
  if (kind === 'ice') {
    // a sheet of ice: long glints on the slant and a crack or two, no ripples
    for (const [x, y, n] of [[2, 9, 5], [8, 4, 4], [10, 13, 4]]) for (let k = 0; k < n; k++) g.fillRect(x + k, y - k, 1, 1);
    g.fillStyle = mix(z.water, '#1a2a3a', 0.35);
    for (const [x, y] of [[5, 2], [6, 3], [6, 4], [7, 5], [12, 8], [11, 9], [11, 10]]) g.fillRect(x, y, 1, 1);
    g.fillStyle = '#ffffff';
    g.fillRect(4, 7, 1, 1); g.fillRect(9, 3, 1, 1);
  } else if (kind !== 'lava') {
    [[2 + o, 4, 4], [9 - o, 7, 5], [4 + o, 11, 4], [12 - o, 13, 3]].forEach(([x, y, w]) => g.fillRect(x, y, w, 1));
    g.fillStyle = '#ffffff';
    g.fillRect(3 + o, 4, 1, 1); g.fillRect(10 - o, 7, 1, 1);
  }
  const deep = mix(z.water, '#000000', 0.35), bank = mix(z.floorDark, '#000000', 0.25), lip = z.floorLight;
  // foam: a few soft specks along the waterline that drift between the two frames
  const foam = kind === 'lava' ? 'rgba(255,224,138,0.7)' : kind === 'ice' ? 'rgba(255,255,255,0.6)' : 'rgba(210,235,248,0.45)', specks = [1, 2, 6, 10, 11, 14];
  const dots = at => specks.forEach(i => at((i + frame * 3) % TILE));
  if (mask & N) {
    g.fillStyle = bank; g.fillRect(0, 0, TILE, 2);
    g.fillStyle = deep; g.fillRect(0, 2, TILE, 2);
    g.fillStyle = foam; dots(i => g.fillRect(i, 4, 1, 1));
  }
  if (mask & S) { g.fillStyle = lip; g.fillRect(0, TILE - 1, TILE, 1); }
  if (mask & W_) {
    g.fillStyle = bank; g.fillRect(0, 0, 1, TILE);
    g.fillStyle = deep; g.fillRect(1, mask & N ? 2 : 0, 1, TILE);
  }
  if (mask & E) {
    g.fillStyle = bank; g.fillRect(TILE - 1, 0, 1, TILE);
    g.fillStyle = deep; g.fillRect(TILE - 2, mask & N ? 2 : 0, 1, TILE);
  }
  // inside corners: the bank pokes in diagonally
  g.fillStyle = bank;
  if ((mask & NW) && !(mask & (N | W_))) { g.fillRect(0, 0, 2, 2); g.fillRect(0, 2, 1, 1); }
  if ((mask & NE) && !(mask & (N | E))) { g.fillRect(TILE - 2, 0, 2, 2); g.fillRect(TILE - 1, 2, 1, 1); }
  g.fillStyle = lip;
  if ((mask & SW) && !(mask & (S | W_))) g.fillRect(0, TILE - 1, 2, 1);
  if ((mask & SE) && !(mask & (S | E))) g.fillRect(TILE - 2, TILE - 1, 2, 1);
  if (round) roundCorners(g, mask, { bank, deep, lip });
  return c;
}

// v0.29: a pool's outer corners curve round instead of meeting square. The bank (dark, two thick along
// the top, one down the sides) and the pale near lip follow the curve, and what is outside it is left
// clear for the ground drawn underneath. `mask`: the neighbours that are not water.
const ROUND_R = 6;
function roundCorners(g, mask, { bank, deep, lip }) {
  const R = ROUND_R;
  const corners = [[N, W_, 0, 0, 1, 1], [N, E, TILE - 1, 0, -1, 1], [S, W_, 0, TILE - 1, 1, -1], [S, E, TILE - 1, TILE - 1, -1, -1]];
  for (const [a, b, cx, cy, sx, sy] of corners) {
    if (!(mask & a) || !(mask & b)) continue;
    const top = a === N;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const ux = R - i - 0.5, uy = R - j - 0.5, d = Math.hypot(ux, uy), side = ux / (ux + uy);
      const x = cx + sx * i, y = cy + sy * j;
      if (d > R) { g.clearRect(x, y, 1, 1); continue; }
      // how thick the bank and the dark water under it are at this point of the curve
      const tb = top ? 1 + (1 - side) : 1, td = top ? 1 + (1 - side) : side >= 0.5 ? 1 : 0;
      if (d > R - tb) { g.fillStyle = !top && side < 0.5 ? lip : bank; g.fillRect(x, y, 1, 1); }
      else if (d > R - tb - td) { g.fillStyle = deep; g.fillRect(x, y, 1, 1); }
    }
  }
}
export const roundedWater = mask => ((mask & N) && (mask & (W_ | E))) || ((mask & S) && (mask & (W_ | E)));

// 반짝 광맥 (v0.29): gems set in a bit of rock wall (or golden acorns caught in a hedge), drawn over the
// wall tile; `left` of the four are still there. The small ones come out first, the big one at the back
// last. `kind`: 'gem' or 'acorn'.
export const SEAM_SPOTS = [[2, 8], [10, 3], [3, 1], [8, 8]];   // top-left corner of each, the big one last
const SEAM_ART = {
  gem: {
    small: ['..k..', '.kck.', 'kcwck', '.kCk.', '..k..'],
    big: ['...k...', '..kck..', '.kcwck.', 'kcccCCk', '.kcCCk.', '..kCk..', '...k...'],
    tints: [['#8fd8f0', '#3d8fb3'], ['#f29bb2', '#a02c3e'], ['#f4cf4f', '#c99a2b'], ['#d8f6ff', '#4f8de0']],
  },
  acorn: {
    small: ['.HH.', 'HhhH', 'kyyk', 'kyYk', '.kk.'],
    big: ['..HH..', '.HhhH.', 'HhhhhH', 'kyyyyk', 'kyzyYk', '.kyYk.', '..kk..'],
    tints: [['#f4cf4f', '#c99a2b'], ['#f4cf4f', '#c99a2b'], ['#f4cf4f', '#c99a2b'], ['#fff3b0', '#d6a531']],
  },
};
function seamCanvas(kind, left) {
  const [c, g] = canvas(), art = SEAM_ART[kind];
  for (let n = SEAM_ART.gem.tints.length - left; n < SEAM_SPOTS.length; n++) {
    const rows = n === SEAM_SPOTS.length - 1 ? art.big : art.small, [x0, y0] = SEAM_SPOTS[n], [lit, dark] = art.tints[n];
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      g.fillStyle = ch === 'c' || ch === 'y' ? lit : ch === 'C' || ch === 'Y' ? dark : PAL[ch];
      g.fillRect(x0 + i, y0 + j, 1, 1);
    }));
  }
  return c;
}
export function seamKey(scene, kind, left) {
  const key = `seam_${kind}_${left}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, seamCanvas(kind, left));
  return key;
}

// A jar of fireflies hanging from the wall, and the soft glow around it.
const LAMP = [
  '................',
  '.......kk.......',
  '........k.......',
  '......kkkk......',
  '.....kNnnNk.....',
  '.....kcvccck....',
  '....kcczcvck....',
  '....kcvcczck....',
  '....kcccvcck....',
  '.....kcccck.....',
  '......kkkk......',
  '................',
  '................',
  '................',
  '................',
  '................',
];
// A small halo around the flame. The light on the room itself is a warm tint on the tiles the
// lamp can see (DungeonScene.buildLamps), so it never spills through walls into the dark.
// a soft round light (the fireflies' and lamps' yellow-green, or white to be tinted: the sparkle rocks')
function glowCanvas(R = 14, rgb = null) {
  const c = document.createElement('canvas');
  c.width = c.height = R * 2;
  const g = c.getContext('2d'), grad = g.createRadialGradient(R, R, 0, R, R, R);
  grad.addColorStop(0, `rgba(${rgb || '230,255,150'},0.7)`);
  grad.addColorStop(0.5, `rgba(${rgb || '200,240,110'},0.22)`);
  grad.addColorStop(1, `rgba(${rgb || '180,230,90'},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, R * 2, R * 2);
  return c;
}

// The glass bubble a secret-garden relic floats in, on a little brass stand (drawn over the relic, so it
// looks shut inside): a faint fill, a bright rim, light caught on the upper left, a cool shade lower right.
function crystalCanvas() {
  const W = 22, H = 23, cx = 11, cy = 10, R = 10;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const dot = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (d > R) continue;
    dot(x, y, 'rgba(150,220,255,0.16)');
    if (d > R - 1) dot(x, y, 'rgba(205,246,255,0.92)');
    else if (d > R - 2.4 && a > -160 && a < -110) dot(x, y, 'rgba(255,255,255,0.85)');
    else if (d > R - 2 && a > 20 && a < 75) dot(x, y, 'rgba(70,160,215,0.55)');
  }
  // a glint, and the stand
  dot(6, 4, 'rgba(255,255,255,0.95)'); dot(5, 5, 'rgba(255,255,255,0.7)');
  g.fillStyle = '#1b1424'; g.fillRect(6, 19, 10, 4);
  g.fillStyle = '#c99a2b'; g.fillRect(7, 19, 8, 3);
  g.fillStyle = '#f4cf4f'; g.fillRect(7, 19, 8, 1);
  g.fillStyle = '#7d6127'; g.fillRect(7, 21, 8, 1);
  return c;
}

// Wall, water and shade tiles depend on their neighbours, so they are made the first time a
// combination is needed and then reused.
// the field zones, then the village's own daytime palette at HOME_ZI
const GROUNDS = [...ZONES, VILLAGE_GROUND];
export const HOME_ZI = ZONES.length;
export function wallKey(scene, zi, mask, v = 0) {
  const key = `z${zi}_wall_${mask}_${v}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, wallTile(GROUNDS[zi], zi, mask, v));
  return key;
}
// `warm`: a hot spring's pool, milky jade instead of the zone's blue
// `round`: the pool's outer corners curve (v0.29); the caller draws ground under such a tile (roundedWater)
export function waterKey(scene, zi, frame, mask, warm = false, kind = null, round = false) {
  const r = round && roundedWater(mask);
  const key = `z${zi}_water${frame}_${mask}${warm ? '_warm' : ''}${kind ? '_' + kind : ''}${r ? '_r' : ''}`;
  const z = warm ? { ...GROUNDS[zi], water: '#4f9a93', waterLight: '#a9d8ce' } : GROUNDS[zi];
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, waterTile(z, frame, mask, kind, r));
  return key;
}

// 낭떠러지 (v0.23): a drop seen from above. Where ground meets it on the near (top) side the cliff
// face shows, rock strata falling away into the dark; the far side and the flanks have a thin lip.
// By the sea, foam on the waves far below; in the ruins, only dark. `mask`: neighbours that are ground.
function chasmTile(z, mask, v) {
  if (z.style === 'sea') return seaTile(z, mask, v, 0);
  const [c, g] = canvas(), deep = mix(z.void, '#000000', 0.2);
  g.fillStyle = deep; g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect((3 + v * 5) % TILE, 11, 1, 1); g.fillRect((11 + v * 3) % TILE, 14, 1, 1);
  if (mask & N) {
    // the near cliff: the ground's edge, then the rock face dropping into shadow
    const face = z.wallFace, dark = z.wallDark;
    for (let y = 0; y < 9; y++) {
      g.fillStyle = mix(y % 3 === 2 ? dark : face, deep, Math.min(1, y / 9));
      g.fillRect(0, y, TILE, 1);
    }
    g.fillStyle = z.floorLight; g.fillRect(0, 0, TILE, 1);
    g.fillStyle = mix(dark, deep, 0.3);
    for (const x of [3, 9, 13]) g.fillRect((x + v) % TILE, 2, 1, 4);
  }
  g.fillStyle = mix(z.floorDark, '#000000', 0.3);
  if (mask & S) { g.fillRect(0, TILE - 2, TILE, 2); g.fillStyle = z.floorLight; g.fillRect(0, TILE - 1, TILE, 1); }
  g.fillStyle = mix(z.floorDark, '#000000', 0.3);
  if (mask & W_) g.fillRect(0, 0, 2, TILE);
  if (mask & E) g.fillRect(TILE - 2, 0, 2, TILE);
  return c;
}

// 바닷가 절벽: the sea far down below the cliffs, seen past the edge of a drop or beyond the rocks
// around the paths. `mask`: the sides where land is (rock or ground). Where land lies to the north
// its cliff face drops into the water and the surf breaks white at its foot; along the other sides
// the foam just laps. `v` 0-3 shifts the swell, and 4 puts a little sea stack in it. Two frames.
function seaTile(z, mask, v, frame) {
  const [c, g] = canvas();
  const fill = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const sea = mix(z.water, '#0b1c2c', 0.3), swell = mix(z.water, z.waterLight, 0.35), glint = mix(z.waterLight, '#ffffff', 0.4);
  const foam = '#e8f4f8', foamDim = mix(foam, sea, 0.45);
  fill(sea, 0, 0, TILE, TILE);
  // long low swells, drifting a pixel each frame
  for (const [x, y, w] of [[1, 4, 5], [9, 7, 4], [3, 11, 6], [11, 14, 4], [12, 2, 3]]) {
    const sx = (x + v * 5 + frame) % TILE;
    fill(swell, sx, y, w, 1);
    if (sx + w > TILE) fill(swell, 0, y, sx + w - TILE, 1);
  }
  fill(glint, (6 + v * 3 + frame * 2) % TILE, (9 + v) % 14 + 1);
  if (v === 4 && !mask) {
    // a sea stack: a lump of the cliff rock left standing in the water, foam around its foot
    fill(z.wallDark, 5, 6, 6, 5); fill(z.wallFace, 6, 5, 4, 5); fill(z.wallLight, 6, 5, 2, 1); fill(z.wallTop, 7, 4, 2, 1);
    for (let x = 4; x < 12; x++) if ((x + frame) % 2 === 0) fill(foam, x, 11); else fill(foamDim, x, 11);
    fill(foamDim, 4, 10); fill(foamDim, 11, 10);
  }
  if (mask & N) {
    // the cliff face: rock in layers, darker as it goes down, then the surf at its foot
    const face = z.wallFace, dark = z.wallDark, band = mix(face, '#ffffff', 0.14);
    for (let y = 0; y < 8; y++) fill(mix(y % 3 === 1 ? band : y % 3 === 2 ? dark : face, sea, y / 14), 0, y, TILE, 1);
    for (const x of [2, 8, 13]) fill(mix(dark, sea, 0.2), (x + v * 3) % TILE, 1 + (x % 3), 1, 4);
    fill(z.wallLine, 0, 0, TILE, 1);
    for (let x = 0; x < TILE; x++) {
      const up = (x + v + frame) % 4 === 0;
      fill(foam, x, up ? 7 : 8);
      if ((x + frame * 2 + v) % 3 === 0) fill(foamDim, x, 9);
    }
  }
  // foam lapping along the other shores
  for (let k = 0; k < TILE; k++) {
    const on = (k + frame + v) % 3 !== 0;
    if (mask & S) fill(on ? foam : foamDim, k, TILE - 1);
    if (mask & W_) fill(on ? foam : foamDim, 0, k);
    if (mask & E) fill(on ? foam : foamDim, TILE - 1, k);
  }
  return c;
}
export function seaKey(scene, zi, mask, v, frame) {
  const key = `z${zi}_sea${mask}_${v}_${frame}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, seaTile(GROUNDS[zi], mask, v, frame));
  return key;
}
export function chasmKey(scene, zi, mask, v) {
  const key = `z${zi}_chasm${mask}_${v}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, chasmTile(GROUNDS[zi], mask, v));
  return key;
}

// The one narrow bridge: planks tied with rope. `ns`: you cross it going north and south.
function bridgeTile(ns, v) {
  const [c, g] = canvas();
  const plank = ['#a0703f', '#8a5f34', '#b07c48'], gap = '#3a2516', rope = '#d8bd7a', ropeDark = '#8e7440';
  for (let k = 0; k < 4; k++) {
    g.fillStyle = plank[(k + v) % 3];
    if (ns) g.fillRect(2, k * 4, 12, 3); else g.fillRect(k * 4, 2, 3, 12);
    g.fillStyle = gap;
    if (ns) g.fillRect(2, k * 4 + 3, 12, 1); else g.fillRect(k * 4 + 3, 2, 1, 12);
  }
  // rope rails along both sides
  g.fillStyle = ropeDark;
  if (ns) { g.fillRect(1, 0, 1, TILE); g.fillRect(14, 0, 1, TILE); } else { g.fillRect(0, 1, TILE, 1); g.fillRect(0, 14, TILE, 1); }
  g.fillStyle = rope;
  for (let k = 0; k < TILE; k += 2) { if (ns) { g.fillRect(1, k, 1, 1); g.fillRect(14, k + 1, 1, 1); } else { g.fillRect(k, 1, 1, 1); g.fillRect(k + 1, 14, 1, 1); } }
  return c;
}
export function bridgeKey(scene, ns, v) {
  const key = `bridge_${ns ? 'ns' : 'ew'}${v}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, bridgeTile(ns, v));
  return key;
}
export function shadeKey(scene, mask) {
  const key = `shade_${mask}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, shadeTile(mask));
  return key;
}
export function floorKey(zi, h) {
  // mostly plain slabs, now and then a crack or a detail
  const v = h < 18 ? 0 : h < 24 ? 1 : h < 28 ? 2 : h < 30 ? 3 : 4 + (h % 4);
  return `z${zi}_floor${v}`;
}

// Tall grass, like Shattered Pixel Dungeon's: blades from edge to edge that hide what is behind.
// Back blades are darker, front ones lighter with pale tips.
// Grass of the new grounds (v0.23): dune grass on the clifftops, frosted grass on the plateau,
// dry scorched grass on the volcano. Everywhere else it is green.
export const GRASS_PAL = {
  sea: { dark: '#3d4a26', mid: '#5e6a33', light: '#87904a', tip: '#cfc488', flat: ['#55602f', '#6f7a3c', '#a8a160'] },
  snow: { dark: '#3f5a62', mid: '#6a8a92', light: '#a3bec4', tip: '#f2fbff', flat: ['#5f7c84', '#86a2a8', '#d8eaee'] },
  volcano: { dark: '#3a2618', mid: '#644026', light: '#94622f', tip: '#e0a050', flat: ['#4f3420', '#6e4a28', '#b07a3a'] },
};
function tallGrass(variant, pal) {
  const [c, g] = canvas(), r = noise(variant * 31 + 7);
  const { dark, mid, light, tip } = pal || { dark: '#1c3a24', mid: '#2a5233', light: '#3d6c44', tip: '#7fa267' };
  g.fillStyle = dark; g.fillRect(0, 11, TILE, 5);
  for (let layer = 0; layer < 3; layer++) {
    for (let k = 0; k < 9; k++) {
      let x = Math.floor(r() * TILE);
      const h = 7 + Math.floor(r() * 7) - layer, lean = r() < 0.5 ? -1 : 1, bend = 3 + Math.floor(r() * 3);
      const base = TILE - 1 - Math.floor(r() * 2) + (layer === 2 ? 0 : -1);
      for (let j = 0; j < h; j++) {
        const y = base - j;
        if (j && j % bend === 0) x += lean;
        if (x < 0 || x >= TILE || y < 0) break;
        g.fillStyle = j >= h - 2 ? (layer === 2 ? tip : light) : [dark, mid, light][layer];
        g.fillRect(x, y, 1, 1);
        if (j < h / 2 && layer > 0) { g.fillStyle = [dark, dark, mid][layer]; g.fillRect(x - lean, y, 1, 1); }
      }
    }
  }
  return c;
}

// Grass someone walked through: blades lying flat.
function flatGrass(variant, pal) {
  const [c, g] = canvas(), r = noise(variant * 13 + 5);
  const [a, b, tip] = pal?.flat || ['#2d5234', '#3b6340', '#5f8a50'];
  for (let k = 0; k < 11; k++) {
    let x = Math.floor(r() * 14) + 1, y = 2 + Math.floor(r() * 13);
    const dir = r() < 0.5 ? -1 : 1, len = 3 + Math.floor(r() * 4);
    for (let j = 0; j < len; j++) {
      g.fillStyle = j === len - 1 ? tip : j % 2 ? b : a;
      g.fillRect(x, y, 1, 1);
      x += dir;
      if (j % 2) y -= 1;
      if (x < 0 || x >= TILE || y < 0) break;
    }
  }
  return c;
}


// see-through colours for a few things lying on the ground: a snail's slime is a wet sheen with a
// glint, darker at its edge, so the ground shows through it (v0.29)
const GLAZE = { goo: { A: 'rgba(196,236,216,0.26)', D: 'rgba(10,22,18,0.22)', w: 'rgba(255,255,255,0.85)' } };
// the way into a hidden room (sprites.js hide_*): shadow and light laid over the zone's own hedge or rock
const LEAF_GAP = { k: 'rgba(8,14,10,0.88)', x: 'rgba(8,14,10,0.42)', w: 'rgba(240,255,200,0.42)' };
const ROCK_GAP = { k: 'rgba(22,16,26,0.86)', x: 'rgba(22,16,26,0.42)', w: 'rgba(255,248,232,0.5)' };
for (let n = 0; n < 3; n++) { GLAZE[`hide_leaf${n}`] = LEAF_GAP; GLAZE[`hide_rock${n}`] = ROCK_GAP; }

export function buildTextures(scene) {
  const tx = scene.textures;
  for (const name of Object.keys(SPR)) if (!tx.exists(name)) tx.addCanvas(name, spriteCanvas(charRows(name)));
  // every hero frame (standing and both walk steps) gets one copy per face: hit, grit, teary, sparkle, shock
  for (const [name, rows] of Object.entries(SPR)) {
    if (!HEROES.has(name.replace(/_walk\d$/, ''))) continue;
    for (const expr of Object.keys(FACES)) if (!tx.exists(faceKey(name, expr))) tx.addCanvas(faceKey(name, expr), spriteCanvas(faceRows(rows, expr)));
  }
  for (const [name, rows] of Object.entries(TER_SPR)) if (!tx.exists(`t_${name}`)) tx.addCanvas(`t_${name}`, spriteCanvas(rows, GLAZE[name] && (ch => GLAZE[name][ch])));
  for (const grade of ORES) {
    if (!tx.exists(`t_ore_${grade.id}`)) tx.addCanvas(`t_ore_${grade.id}`, oreCanvas(grade));
    if (!tx.exists(`t_pebble_${grade.id}`)) tx.addCanvas(`t_pebble_${grade.id}`, pebbleCanvas(grade));
    if (!tx.exists(`t_drop_${grade.id}`)) tx.addCanvas(`t_drop_${grade.id}`, dropCanvas(grade, false));
    if (!tx.exists(`t_chip_${grade.id}`)) tx.addCanvas(`t_chip_${grade.id}`, dropCanvas(grade, true));
  }
  // the scene can be built again (a trip picked up after a visit home); what exists stays
  const add = (key, make) => { if (!tx.exists(key)) tx.addCanvas(key, make()); };
  for (let v = 0; v < 3; v++) {
    add(`t_brush${v}`, () => tallGrass(v));
    add(`t_grass${v}`, () => flatGrass(v));
    for (const [style, pal] of Object.entries(GRASS_PAL)) {
      add(`t_brush${v}_${style}`, () => tallGrass(v, pal));
      add(`t_grass${v}_${style}`, () => flatGrass(v, pal));
    }
  }
  GROUNDS.forEach((z, zi) => {
    for (let v = 0; v < FLOOR_VARIANTS; v++) add(`z${zi}_floor${v}`, () => floorTile(z, zi, v));
  });
  add('t_lamp', () => spriteCanvas(LAMP));
  add('glow', glowCanvas);
  add('oreGlow', () => glowCanvas(18, '255,255,255'));
  add('glint', () => spriteCanvas(['...w...', '...w...', '..wWw..', 'wwWWWww', '..wWw..', '...w...', '...w...'], ch => (ch === 'W' ? '#ffffff' : '#fff6d8')));
  add('crystalShell', crystalCanvas);
  add('px', () => {
    const px = document.createElement('canvas');
    px.width = 1; px.height = 1;
    const g = px.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
    return px;
  });
}
