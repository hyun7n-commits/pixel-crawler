// Builds Phaser textures from the pixel-art strings and draws the floor and wall tiles for each zone.

import { PAL, SPR, TER_SPR } from '../data/sprites.js';
import { FACES, faceRows, faceKey } from '../data/faces.js';
import { CHARACTERS } from '../data/characters.js';
import { ZONES, VILLAGE_GROUND } from '../data/enemies.js';
import { ORES, RAINBOW } from '../data/ores.js';

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
const pieceColor = grade => (ch, i, j) => {
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
function oreCanvas(grade) {
  const rows = TER_SPR.bigOre.map(r => [...r.replace(/y/g, 'L').replace(/Y/g, 'l')]);
  stampPieces(rows, grade, grade.metal ? 4 : 3, seeded(7 + ORES.indexOf(grade)));
  return spriteCanvas(rows.map(r => r.join('')), pieceColor(grade));
}
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
// colours as the one-tile ore (outline k, rock L, light l, shadow d, veins y/Y, sparkle w),
// with more veins the bigger it is. Seeded by where it lies, so it looks the same every time.
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
  return { rows: rows.map(r => r.join('')), x0, y0 };
}

// The texture and frame for one tile of an ore: [key, frame]. One-tile ores use the plain sprite.
export function oreFrame(scene, ore, x, y, tier = ore.tier) {
  const grade = ORES[tier];
  if (!ore.cells || ore.cells.length < 2) return [`t_ore_${grade.id}`, undefined];
  const x0 = Math.min(...ore.cells.map(c => c.x)), y0 = Math.min(...ore.cells.map(c => c.y));
  const shape = ore.cells.map(c => `${c.x - x0}${c.y - y0}`).join('');
  const key = `t_vein_${x0}_${y0}_${shape}_${grade.id}`;
  const tx = scene.textures;
  if (!tx.exists(key)) {
    const { rows } = veinRows(ore.cells, grade);
    const tex = tx.addCanvas(key, spriteCanvas(rows, pieceColor(grade)));
    for (const c of ore.cells) tex.add(`${c.x - x0}_${c.y - y0}`, 0, (c.x - x0) * TILE, (c.y - y0) * TILE, TILE, TILE);
  }
  return [key, `${x - x0}_${y - y0}`];
}

// Same canvases for the DOM (HUD icons, hub cards, choice cards).
const domCache = {};
export function spriteForDom(name) {
  const grade = name.startsWith('t_ore_') && ORES.find(o => `t_ore_${o.id}` === name);
  return (domCache[name] ||= grade ? oreCanvas(grade) : spriteCanvas(charRows(name)));
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
  rock: [null, null, null,
    (px, z) => px(z.floorDark, [[3, 3], [4, 4], [5, 4], [6, 5], [7, 6], [7, 7], [8, 8], [9, 8], [10, 9]]), // a crack
    (px, z) => { px(z.floorDark, [[4, 11], [5, 11], [10, 5], [11, 5], [12, 12]]); px(z.floorLight, [[4, 10], [5, 10], [10, 4], [11, 4], [12, 11]]); },
    px => { px('#2f7a43', [[6, 10], [8, 10], [7, 10]]); px('#6cc45a', [[5, 8], [6, 9], [8, 9], [9, 8], [7, 8]]); }, // a tuft
    px => { px('#c9c2b6', [[6, 7], [7, 7], [8, 7]]); px('#9a958c', [[5, 8], [6, 8], [7, 8], [8, 8], [9, 8]]); px('#5e5a52', [[5, 9], [6, 9], [7, 9], [8, 9], [9, 9]]); },
    px => { px('#3d8fb3', [[6, 9], [7, 9], [7, 8], [10, 10], [11, 10]]); px('#8fd8f0', [[6, 8], [7, 7], [10, 9]]); px('#c49aff', [[11, 9]]); },
  ],
};
function floorTile(z, zi, variant) {
  const [c, g] = canvas(), r = noise(variant * 17 + 3 + zi * 101);
  const px = (col, list) => { g.fillStyle = col; list.forEach(([x, y]) => g.fillRect(x, y, 1, 1)); };
  g.fillStyle = z.floor; g.fillRect(0, 0, TILE, TILE);
  for (let k = 0; k < 4 + (variant % 3); k++) {
    const x = 1 + Math.floor(r() * 14), y = 1 + Math.floor(r() * 14);
    if (z.style === 'rock') px(r() < 0.6 ? z.floorDark : z.floorLight, r() < 0.4 ? [[x, y], [x + 1, y]] : [[x, y]]);
    else { px(z.floorDark, [[x, y], [x, y - 1]]); px(z.floorDark, [[x + 2, y], [x + 2, y - 1], [x + 1, y + 1]]); } // a blade or two
  }
  for (let k = 0; k < 5; k++) px(z.floorLight, [[Math.floor(r() * TILE), Math.floor(r() * TILE)]]);
  DETAILS[z.style][variant]?.(px, z);
  return c;
}

const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
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

// A wall seen from above. Its top fills the tile; where floor lies below it, its front shows on the
// lower part of the tile. A dark line marks every side that faces open ground.
//   meadow: a clipped hedge, leafy on top and in front
//   forest: the canopy on top, and in front tree trunks standing in the dark under it
//   rock:   a cliff, cracked on top, with a face of rough blocks
// `v` (0-2) shifts the leaves, trunks and seams so a long wall does not look stamped.
function wallTile(z, zi, mask, v) {
  const [c, g] = canvas(), r = noise(mask * 7 + v * 131 + zi * 977 + 1);
  const fill = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const face = mask & S, topH = face ? (z.style === 'forest' ? 7 : 5) : TILE;
  // the top: rows of round leaf clumps (or boulders on the mountain), lit from the top left
  fill(z.wallTop, 0, 0, TILE, topH);
  const hi = mix(z.wallLight, '#ffffff', 0.3);
  clumps(fill, r, v, 0, topH, z.style === 'rock' ? BOULDER : LEAVES, { h: hi, l: z.wallLight, d: z.wallDark });
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
    } else {
      fill(z.wallFace, 0, topH, TILE, TILE - topH);
      fill(z.wallLight, 0, topH, TILE, 1);
      // rough blocks: two rows, the seams shifted per tile
      const s1 = 4 + v * 3, s2 = (s1 + 6) % 13 + 1;
      fill(z.wallDark, 0, topH + 5, TILE, 1);
      fill(z.wallDark, s1, topH + 1, 1, 4); fill(z.wallDark, s2, topH + 6, 1, 4);
      fill(mix(z.wallFace, '#ffffff', 0.15), s1 + 1, topH + 1, 4, 1); fill(mix(z.wallFace, '#ffffff', 0.15), 0, topH + 6, s2, 1);
      fill(z.wallDark, 0, TILE - 3, TILE, 1);
      fill(z.wallLine, 0, TILE - 2, TILE, 2);
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
function waterTile(z, frame, mask) {
  const [c, g] = canvas();
  g.fillStyle = z.water; g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = z.waterLight;
  const o = frame ? 3 : 0;
  [[2 + o, 4, 4], [9 - o, 7, 5], [4 + o, 11, 4], [12 - o, 13, 3]].forEach(([x, y, w]) => g.fillRect(x, y, w, 1));
  g.fillStyle = '#ffffff';
  g.fillRect(3 + o, 4, 1, 1); g.fillRect(10 - o, 7, 1, 1);
  const deep = mix(z.water, '#000000', 0.35), bank = mix(z.floorDark, '#000000', 0.25), lip = z.floorLight;
  // foam: a few soft specks along the waterline that drift between the two frames
  const foam = 'rgba(210,235,248,0.45)', specks = [1, 2, 6, 10, 11, 14];
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
  return c;
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
function glowCanvas() {
  const c = document.createElement('canvas'), R = 14;
  c.width = c.height = R * 2;
  const g = c.getContext('2d'), grad = g.createRadialGradient(R, R, 0, R, R, R);
  grad.addColorStop(0, 'rgba(230,255,150,0.7)');
  grad.addColorStop(0.5, 'rgba(200,240,110,0.22)');
  grad.addColorStop(1, 'rgba(180,230,90,0)');
  g.fillStyle = grad; g.fillRect(0, 0, R * 2, R * 2);
  return c;
}

// The glass cloche a secret-garden relic sits under (drawn over the relic, so it looks shut inside).
const CRYSTAL = [
  '.....oo.....', '.....oo.....', '...oooooo...', '..o.h....o..', '.o.h......o.', '.o.h......o.', 'o.h........o',
  'o.h........o', 'o..........o', 'o.........so', 'o........sso', 'o.......ss.o', 'oooooooooooo', '.oooooooooo.',
];
function crystalCanvas() {
  const c = document.createElement('canvas'), w = CRYSTAL[0].length, h = CRYSTAL.length;
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  CRYSTAL.forEach((row, j) => {
    const a = row.indexOf('o'), b = row.lastIndexOf('o');
    g.fillStyle = 'rgba(150,220,255,0.26)'; g.fillRect(a, j, b - a + 1, 1);
    for (let i = 0; i < w; i++) {
      const col = { o: 'rgba(200,244,255,0.95)', h: 'rgba(255,255,255,0.8)', s: 'rgba(80,170,220,0.6)' }[row[i]];
      if (col) { g.fillStyle = col; g.fillRect(i, j, 1, 1); }
    }
  });
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
export function waterKey(scene, zi, frame, mask, warm = false) {
  const key = `z${zi}_water${frame}_${mask}${warm ? '_warm' : ''}`;
  const z = warm ? { ...GROUNDS[zi], water: '#4f9a93', waterLight: '#a9d8ce' } : GROUNDS[zi];
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, waterTile(z, frame, mask));
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
function tallGrass(variant) {
  const [c, g] = canvas(), r = noise(variant * 31 + 7);
  const dark = '#1c3a24', mid = '#2a5233', light = '#3d6c44', tip = '#7fa267';
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
function flatGrass(variant) {
  const [c, g] = canvas(), r = noise(variant * 13 + 5);
  for (let k = 0; k < 11; k++) {
    let x = Math.floor(r() * 14) + 1, y = 2 + Math.floor(r() * 13);
    const dir = r() < 0.5 ? -1 : 1, len = 3 + Math.floor(r() * 4);
    for (let j = 0; j < len; j++) {
      g.fillStyle = j === len - 1 ? '#5f8a50' : j % 2 ? '#3b6340' : '#2d5234';
      g.fillRect(x, y, 1, 1);
      x += dir;
      if (j % 2) y -= 1;
      if (x < 0 || x >= TILE || y < 0) break;
    }
  }
  return c;
}


export function buildTextures(scene) {
  const tx = scene.textures;
  for (const name of Object.keys(SPR)) if (!tx.exists(name)) tx.addCanvas(name, spriteCanvas(charRows(name)));
  // every hero frame (standing and both walk steps) gets one copy per face: hit, grit, teary, sparkle, shock
  for (const [name, rows] of Object.entries(SPR)) {
    if (!HEROES.has(name.replace(/_walk\d$/, ''))) continue;
    for (const expr of Object.keys(FACES)) if (!tx.exists(faceKey(name, expr))) tx.addCanvas(faceKey(name, expr), spriteCanvas(faceRows(rows, expr)));
  }
  for (const [name, rows] of Object.entries(TER_SPR)) if (!tx.exists(`t_${name}`)) tx.addCanvas(`t_${name}`, spriteCanvas(rows));
  for (const grade of ORES) {
    if (!tx.exists(`t_ore_${grade.id}`)) tx.addCanvas(`t_ore_${grade.id}`, oreCanvas(grade));
    if (!tx.exists(`t_drop_${grade.id}`)) tx.addCanvas(`t_drop_${grade.id}`, dropCanvas(grade, false));
    if (!tx.exists(`t_chip_${grade.id}`)) tx.addCanvas(`t_chip_${grade.id}`, dropCanvas(grade, true));
  }
  for (let v = 0; v < 3; v++) {
    tx.addCanvas(`t_brush${v}`, tallGrass(v));
    tx.addCanvas(`t_grass${v}`, flatGrass(v));
  }
  GROUNDS.forEach((z, zi) => {
    for (let v = 0; v < FLOOR_VARIANTS; v++) tx.addCanvas(`z${zi}_floor${v}`, floorTile(z, zi, v));
  });
  tx.addCanvas('t_lamp', spriteCanvas(LAMP));
  tx.addCanvas('glow', glowCanvas());
  tx.addCanvas('crystalShell', crystalCanvas());
  const px = document.createElement('canvas');
  px.width = 1; px.height = 1;
  const g = px.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
  tx.addCanvas('px', px);
}
