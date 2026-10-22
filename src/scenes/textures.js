// Builds Phaser textures from the pixel-art strings and draws the floor and wall tiles for each zone.

import { PAL, SPR, TER_SPR } from '../data/sprites.js';
import { ZONES } from '../data/enemies.js';
import { ORES, RAINBOW } from '../data/ores.js';

export const TILE = 16; // world pixels per tile

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

// The big ore in each grade: same rock, veins in the grade's colours (rainbow stripes for the top one).
const veinColor = grade => (ch, i, j) => {
  if (ch !== 'y' && ch !== 'Y') return null;
  if (!grade.vein) return RAINBOW[(i + j) % RAINBOW.length];
  return grade.vein[ch === 'y' ? 0 : 1];
};
function oreCanvas(grade) {
  return spriteCanvas(TER_SPR.bigOre, veinColor(grade));
}

// A vein spanning two to four tiles is drawn as one big rock over the whole shape, in the same
// colours as the one-tile ore (outline k, rock L, light l, shadow d, veins y/Y, sparkle w),
// with more veins the bigger it is. Seeded by where it lies, so it looks the same every time.
function veinRows(cells) {
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
  // the veins: clusters of ore glinting out of the rock, more of them the bigger it is
  const PATTERNS = [['.yy.', 'yYYy', '.yYy'], ['yy..', 'yYY.', '.YYy', '..y.'], ['.y', 'yY', 'YY', 'y.'], ['yyY', 'YY.'], ['.yy', 'yYY', 'yY.']];
  for (let n = 0, tries = 0; n < cells.length * 4 && tries < 600; tries++) {
    const pat = PATTERNS[Math.floor(rnd() * PATTERNS.length)];
    const px = Math.floor(rnd() * (W - 4)), py = Math.floor(rnd() * (H - 4));
    if (!pat.every((r, j) => [...r].every((ch, i) => ch === '.' || face(px + i, py + j) || rows[py + j]?.[px + i] === 'l'))) continue;
    pat.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') rows[py + j][px + i] = ch; }));
    n++;
  }
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
    const { rows } = veinRows(ore.cells);
    const tex = tx.addCanvas(key, spriteCanvas(rows, veinColor(grade)));
    for (const c of ore.cells) tex.add(`${c.x - x0}_${c.y - y0}`, 0, (c.x - x0) * TILE, (c.y - y0) * TILE, TILE, TILE);
  }
  return [key, `${x - x0}_${y - y0}`];
}

// Same canvases for the DOM (HUD icons, hub cards, choice cards).
const domCache = {};
export function spriteForDom(name) {
  const grade = name.startsWith('t_ore_') && ORES.find(o => `t_ore_${o.id}` === name);
  return (domCache[name] ||= grade ? oreCanvas(grade) : spriteCanvas(SPR[name]));
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

// Stone floor: four slabs with dark seams and a few chips. Variants 4+ carry a small detail
// that fits the zone (pebbles, coal and planks up top, crystal shards in the caves, rubble in the ruins).
const FLOOR_VARIANTS = 8;
function floorTile(z, zi, variant) {
  const [c, g] = canvas(), r = noise(variant * 17 + 3 + zi * 101);
  g.fillStyle = z.floor; g.fillRect(0, 0, TILE, TILE);
  const off = variant % 2 ? 4 : 0;
  g.fillStyle = z.floorDark;
  g.fillRect(0, 7, TILE, 1); g.fillRect(0, 15, TILE, 1);
  g.fillRect((7 + off) % TILE, 0, 1, 7); g.fillRect((11 + off) % TILE, 8, 1, 7);
  g.fillStyle = z.floorLight;
  g.fillRect(0, 0, TILE, 1); g.fillRect(0, 8, TILE, 1);
  for (let i = 0; i < 5 + (variant % 4) * 2; i++) {
    g.fillStyle = r() < 0.5 ? z.floorDark : z.floorLight;
    g.fillRect(Math.floor(r() * 15), 1 + Math.floor(r() * 14), 1, 1);
  }
  const px = (col, list) => { g.fillStyle = col; list.forEach(([x, y]) => g.fillRect(x, y, 1, 1)); };
  if (variant === 3) px(z.floorDark, [[3, 3], [4, 4], [5, 4], [6, 5], [7, 6], [7, 9], [8, 10], [9, 10], [10, 11]]);
  if (variant === 4) { // pebbles
    px(z.floorDark, [[4, 11], [5, 11], [10, 5], [11, 5], [12, 12]]);
    px(z.floorLight, [[4, 10], [5, 10], [10, 4], [11, 4], [12, 11]]);
  }
  if (variant === 5) {
    if (zi === 1) { px('#3d8fb3', [[5, 12], [6, 11], [6, 12], [7, 12]]); px('#8fd8f0', [[6, 10], [5, 11]]); }
    else if (zi === 2) { px(z.floorDark, [[3, 4], [4, 4], [4, 5], [11, 10], [12, 10], [12, 11], [11, 11]]); px(z.floorLight, [[3, 3], [11, 9], [12, 9]]); }
    else { px('#1b1424', [[5, 5], [6, 5], [6, 6], [11, 11], [12, 11]]); px('#2c2536', [[5, 4], [11, 10]]); } // coal
  }
  if (variant === 6) {
    if (zi === 1) { px('#3d8fb3', [[10, 6], [10, 7], [11, 7], [9, 7]]); px('#c8f6ff', [[10, 5]]); }
    else if (zi === 2) { px('#c9c2b6', [[4, 9], [5, 9], [6, 9], [7, 10]]); px('#f4f0e8', [[4, 8], [7, 9]]); } // a bone
    else { px('#5e3d24', [[3, 10], [4, 10], [5, 10], [6, 10], [7, 10]]); px('#a0703f', [[3, 9], [4, 9], [5, 9], [6, 9]]); } // plank bit
  }
  if (variant === 7) { // a damp patch
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(4, 5, 7, 5); g.fillRect(3, 6, 9, 3);
  }
  return c;
}

const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// Neighbour masks for walls, water and floor shading: bit set = that side is open.
export const N = 1, E = 2, S = 4, W_ = 8, NE = 16, SE = 32, SW = 64, NW = 128;

// A wall seen from above. Where floor lies below it, its stone face shows (blocks with a lit top
// edge); where floor lies beside or behind it, a pale rim marks the edge of the wall's top.
function wallTile(z, zi, mask) {
  const [c, g] = canvas();
  const top = mix(z.wall, z.wallTop, 0.18), rim = mix(z.wall, z.wallTop, 0.7), line = z.wallLine;
  g.fillStyle = top; g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = line;
  g.fillRect(3, 3, 2, 1); g.fillRect(10, 8, 2, 1); g.fillRect(6, 12, 1, 1);
  const face = mask & S, topH = face ? 4 : TILE;
  g.fillStyle = rim;
  if (mask & N) g.fillRect(0, 0, TILE, 1);
  if (mask & W_) g.fillRect(0, 0, 1, topH);
  if (mask & E) g.fillRect(TILE - 1, 0, 1, topH);
  if (!face) {
    if ((mask & NE) && !(mask & (N | E))) g.fillRect(TILE - 1, 0, 1, 1);
    if ((mask & NW) && !(mask & (N | W_))) g.fillRect(0, 0, 1, 1);
    if ((mask & SE) && !(mask & E)) g.fillRect(TILE - 1, TILE - 1, 1, 1);
    if ((mask & SW) && !(mask & W_)) g.fillRect(0, TILE - 1, 1, 1);
    return c;
  }
  // the face: two rows of blocks, lit from above, darkest where it meets the floor
  const faceCol = z.wallTop, faceDark = mix(z.wallTop, z.wallLine, 0.45), faceLight = mix(z.wallTop, '#ffffff', 0.18);
  g.fillStyle = rim; g.fillRect(0, 3, TILE, 1);
  g.fillStyle = faceCol; g.fillRect(0, 4, TILE, 12);
  g.fillStyle = line;
  g.fillRect(0, 4, TILE, 1); g.fillRect(0, 9, TILE, 1);
  g.fillRect(5, 5, 1, 4); g.fillRect(12, 5, 1, 4); g.fillRect(2, 10, 1, 4); g.fillRect(9, 10, 1, 4);
  g.fillStyle = faceLight;
  g.fillRect(0, 5, 5, 1); g.fillRect(6, 5, 6, 1); g.fillRect(13, 5, 3, 1);
  g.fillRect(0, 10, 2, 1); g.fillRect(3, 10, 6, 1); g.fillRect(10, 10, 6, 1);
  g.fillStyle = faceDark;
  g.fillRect(0, 8, TILE, 1); g.fillRect(0, 13, TILE, 1);
  g.fillStyle = line; g.fillRect(0, 14, TILE, 2);
  if (zi === 1) { // crystals poking out of the cave wall
    g.fillStyle = '#3d8fb3'; g.fillRect(7, 6, 2, 3); g.fillRect(8, 5, 1, 1);
    g.fillStyle = '#8fd8f0'; g.fillRect(7, 6, 1, 2);
  }
  // an outer corner: the face ends with a dark edge
  g.fillStyle = line;
  if (mask & W_) g.fillRect(0, 4, 1, 12);
  if (mask & E) g.fillRect(TILE - 1, 4, 1, 12);
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

// A miner's lamp hanging on a wall face, and the warm glow around it.
const LAMP = [
  '................',
  '.......kk.......',
  '........k.......',
  '......kkkk......',
  '.....kLllLk.....',
  '.....kyywyk.....',
  '.....kyoyyk.....',
  '.....koyyok.....',
  '.....kLLLLk.....',
  '......kkkk......',
  '................',
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
  grad.addColorStop(0, 'rgba(255,200,120,0.7)');
  grad.addColorStop(0.5, 'rgba(255,160,80,0.22)');
  grad.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = grad; g.fillRect(0, 0, R * 2, R * 2);
  return c;
}

// The see-through crystal a vault relic sits in (drawn over the relic, so it looks shut inside).
const CRYSTAL = [
  '....oooo....', '...o....o...', '..o.h....o..', '.o.h......o.', 'o.h........o', 'o.h........o', 'o..........o',
  'o..........o', 'o..........o', 'o.........so', '.o.......so.', '..o....sso..', '...o.ss.o...', '....oooo....',
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
export function wallKey(scene, zi, mask) {
  const key = `z${zi}_wall_${mask}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, wallTile(ZONES[zi], zi, mask));
  return key;
}
export function waterKey(scene, zi, frame, mask) {
  const key = `z${zi}_water${frame}_${mask}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, waterTile(ZONES[zi], frame, mask));
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
  const dark = '#1f5a32', mid = '#2f7a43', light = '#4fa35a', tip = '#9fd67a';
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
      g.fillStyle = j === len - 1 ? '#6cb85e' : j % 2 ? '#3f8c4b' : '#2f7a43';
      g.fillRect(x, y, 1, 1);
      x += dir;
      if (j % 2) y -= 1;
      if (x < 0 || x >= TILE || y < 0) break;
    }
  }
  return c;
}

// A pressure plate with the trap's sign in the middle, readable at a glance.
const TRAP_SIGNS = {
  trapSpike: ['#e6e9f2', ['.w..w..w', 'www.www.', '........', '..w..w..', '.wwwwww.', '........', '.w..w..w', 'www.www.']],
  trapSleep: ['#c49af2', ['wwwww...', '...w....', '..w.....', '.w......', 'wwwww...', '....www.', '.....w..', '....www.']],
  trapAlarm: ['#f4cf4f', ['...ww...', '..wwww..', '.wwwwww.', '.wwwwww.', '.wwwwww.', 'wwwwwwww', '........', '...ww...']],
  trapSummon: ['#ff6b8a', ['..wwww..', '.w....w.', 'w..ww..w', 'w.wwww.w', 'w.wwww.w', 'w..ww..w', '.w....w.', '..wwww..']],
  trapOff: [null, []],
};
function trapPlate(color, sign) {
  const [c, g] = canvas();
  g.fillStyle = '#15111c'; g.fillRect(2, 2, 12, 12);
  g.fillStyle = '#3a3646'; g.fillRect(3, 3, 10, 10);
  g.fillStyle = '#58536a'; g.fillRect(3, 3, 10, 1); g.fillRect(3, 3, 1, 10);
  g.fillStyle = '#26222f'; g.fillRect(4, 12, 9, 1); g.fillRect(12, 4, 1, 9);
  if (!color) { // spent: a dull cracked plate
    g.fillStyle = '#15111c';
    [[5, 5], [6, 6], [7, 6], [8, 7], [8, 8], [9, 9], [10, 9]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
    return c;
  }
  g.fillStyle = color;
  sign.forEach((row, j) => { for (let i = 0; i < 8; i++) if (row[i] === 'w') g.fillRect(4 + i, 4 + j, 1, 1); });
  return c;
}

export function buildTextures(scene) {
  const tx = scene.textures;
  for (const [name, rows] of Object.entries(SPR)) if (!tx.exists(name)) tx.addCanvas(name, spriteCanvas(rows));
  for (const [name, rows] of Object.entries(TER_SPR)) if (!tx.exists(`t_${name}`)) tx.addCanvas(`t_${name}`, spriteCanvas(rows));
  for (const grade of ORES) if (!tx.exists(`t_ore_${grade.id}`)) tx.addCanvas(`t_ore_${grade.id}`, oreCanvas(grade));
  for (let v = 0; v < 3; v++) {
    tx.addCanvas(`t_brush${v}`, tallGrass(v));
    tx.addCanvas(`t_grass${v}`, flatGrass(v));
  }
  for (const [name, [color, sign]] of Object.entries(TRAP_SIGNS)) tx.addCanvas(`t_${name}`, trapPlate(color, sign));
  ZONES.forEach((z, zi) => {
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
