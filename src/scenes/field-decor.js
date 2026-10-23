// The little things on the ground that make a field feel full and lived in, like a picture book:
// flowers, clover and pebbles on the meadow; ferns, toadstools and fallen leaves in the forest; reeds
// and mossy stones in the marsh; tufts and edelweiss on the mountain; crystals and glowing caps in the
// cave. Along the foot of every wall a band of leaves and flowers grows up over the edge, so the hedge
// does not stop in a hard line. Nothing here has a dark outline (outlined things are things you can use
// or that can hurt you), and all of it lies on the ground under everyone. Drawn once per zone, by
// seeded noise, so a field looks the same every time you look at it.

import { treeCanvas } from './village-art.js';

const TILE = 16;
const FOOT_UP = 6;   // how far the band at a wall's foot reaches up over the wall's face

// a few colours that read at night under the lantern without shouting
const C = {
  w: '#e9e4d6', W: '#bdb7a6', y: '#e8c44c', Y: '#b8932c', q: '#e391a8', Q: '#b8667f', b: '#86a9e0', B: '#5b7cb8',
  r: '#d0594f', R: '#963a36', o: '#e39a52', O: '#b06a2c', n: '#8a6a44', N: '#5e4630', u: '#c4a878',
  l: '#a5a596', L: '#7f7f72', d: '#55574c', c: '#8fd8f0', C: '#3d8fb3', p: '#b58ae0', P: '#7a4fb0',
  t: '#6fe0c8', T: '#2f8a7a', m: '#9aa860', M: '#6f7d3a',
};

// the village is walked by day: the same little pictures in brighter colours
const DAY = {
  ...C, w: '#ffffff', W: '#dcd6c8', y: '#ffd84a', Y: '#d9a72c', q: '#ff9bbb', Q: '#e0708f', b: '#8fb8ff', B: '#5d86d8',
  r: '#f0504a', R: '#b83a3a', o: '#ffa04a', O: '#c8701e', n: '#a0703f', N: '#6b4a2a', u: '#ecd09a',
  l: '#cfcfc4', L: '#a4a498', d: '#7a7c70',
};

// little pictures, one character per pixel ('.' is empty). 'g', 'G' and 'v' are the zone's own greens.
const STAMPS = {
  daisy: ['.w.', 'wyw', '.w.', '.g.'],
  daisy2: ['.w..', 'wyw.', '.w.w', '.gwy', '..gw'],
  pink: ['q.q', 'qQq', '.g.', '.g.'],
  butter: ['.y.', 'yYy', '.g.'],
  blue: ['b.b', '.B.', 'g.g', '.g.'],
  clover: ['v.v.', 'vvvv', '.vv.', '..g.'],
  tuft: ['g...g', '.g.g.', 'g.gg.', '.ggg.'],
  puff: ['.w.', 'wWw', '.w.', '.g.', '.g.'],
  pebble: ['.ll.', 'lLLd', '.dd.'],
  pebbles: ['l..', 'Ld.', '..l', '.Ld'],
  shroom: ['.rr.', 'rwrr', '.ww.'],
  brown: ['.nn.', 'nnuN', '.uu.'],
  shrooms: ['..nn.', '.nnuN', 'rr.u.', 'rwr..', '.w...'],
  fern: ['g.....g', '.g.g.g.', '..vgv..', 'g.vgv.g', '.g.g.g.', '...g...'],
  leaves: ['o..y.', '.O...', '...o.', 'y..O.'],
  leaf: ['.oo', 'oO.', 'O..'],
  acorn: ['.n.', 'NnN', 'ouo', '.o.'],
  twig: ['N....', '.N...', '..NN.', '...nN'],
  moss: ['.vv.', 'vMMv', 'dlld', '.dd.'],
  reed: ['g..g', 'g.gg', 'gggv', '.gg.'],
  cattail: ['n..', 'n.n', 'g.n', 'ggg', '.g.'],
  puddle: ['.CCC.', 'CcCCC', '.CCC.'],
  pale: ['.ww.', 'wWWw', '.uu.'],
  edel: ['.w.w.', 'wwyww', '.w.w.', '..g..'],
  lichen: ['m.M', '.m.', 'M.m'],
  rubble: ['..l.', '.lLd', 'lLd.', '.d..'],
  crystal: ['.c.', 'cC.', 'CC.'],
  crystalP: ['.p.', '.pP', '.PP'],
  glow: ['.tt.', 'tTTt', '.ww.', '.w..'],
  glow2: ['tt.', 'TT.', '.wtt', '.wTT', '..w.'],
};

// what each kind of place scatters about, the more likely ones listed more than once
const SCATTER = {
  meadow: ['daisy', 'daisy', 'daisy2', 'pink', 'pink', 'butter', 'butter', 'blue', 'clover', 'clover', 'tuft', 'tuft', 'puff', 'pebble', 'shroom'],
  forest: ['fern', 'fern', 'shrooms', 'brown', 'brown', 'shroom', 'leaves', 'leaves', 'leaf', 'acorn', 'twig', 'moss', 'tuft', 'clover'],
  marsh: ['reed', 'reed', 'cattail', 'cattail', 'puddle', 'moss', 'moss', 'pale', 'pale', 'tuft', 'clover', 'blue'],
  rock: ['pebble', 'pebbles', 'pebbles', 'rubble', 'tuft', 'tuft', 'edel', 'edel', 'lichen', 'lichen', 'blue', 'moss'],
  cave: ['crystal', 'crystalP', 'glow', 'glow', 'glow2', 'rubble', 'pebbles', 'lichen', 'puddle', 'moss'],
};
// what crowds the foot of a wall, besides the band of leaves
const FOOT = {
  meadow: ['daisy', 'pink', 'butter', 'blue', 'daisy2', 'puff'],
  forest: ['shrooms', 'brown', 'fern', 'leaves', 'acorn'],
  marsh: ['cattail', 'reed', 'pale', 'moss'],
  rock: ['rubble', 'pebbles', 'edel', 'tuft'],
  cave: ['glow', 'glow2', 'crystal', 'crystalP', 'rubble'],
};

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
};
// smooth 0..1 noise over a map, in blobs a few tiles across (where flower beds and the like grow)
export function patchNoise(x, y, seed) {
  const S = 4, gx = x / S, gy = y / S, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const v = (a, b) => (hash(a * 31 + seed * 7, b * 17 + seed) % 1000) / 1000;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx, bot = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
  return top + (bot - top) * sy;
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
}

function greens(z) {
  return { g: z.wallLight, G: z.wallFace, v: mix(z.wallLight, '#d8f0a0', 0.35) };
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function stamp(g, z, name, x0, y0, flip = false) {
  const rows = STAMPS[name], G = greens(z), w = rows[0].length, P = z.day ? DAY : C;
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    g.fillStyle = G[ch] || P[ch];
    g.fillRect(x0 + (flip ? w - 1 - i : i), y0 + j, 1, 1);
  }));
}
const size = name => [STAMPS[name][0].length, STAMPS[name].length];

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// A floor tile's worth of scattered things: one to three little pictures, kept clear of each other.
function scatterCanvas(z, zi, v) {
  const [c, g] = canvas(TILE, TILE), r = rng(zi * 7919 + v * 104729 + 17);
  const list = SCATTER[z.style], n = 1 + Math.floor(r() * 2.8), boxes = [];
  for (let k = 0, tries = 0; k < n && tries < 20; tries++) {
    const name = list[Math.floor(r() * list.length)], [w, h] = size(name);
    const x = 1 + Math.floor(r() * (TILE - w - 1)), y = 2 + Math.floor(r() * (TILE - h - 2));
    if (boxes.some(b => x < b[0] + b[2] + 1 && b[0] < x + w + 1 && y < b[1] + b[3] + 1 && b[1] < y + h + 1)) continue;
    boxes.push([x, y, w, h]);
    stamp(g, z, name, x, y, r() < 0.5);
    k++;
  }
  return c;
}

// A patch where things grow thick (a flower bed on the meadow, a mushroom ring in the forest, a reed
// bed in the marsh...): four to six little pictures packed close.
const PATCH = {
  meadow: ['daisy', 'pink', 'butter', 'blue', 'daisy', 'pink', 'butter', 'clover', 'tuft'],
  forest: ['fern', 'shroom', 'brown', 'leaves', 'shrooms', 'fern', 'moss'],
  marsh: ['reed', 'cattail', 'reed', 'pale', 'tuft', 'moss'],
  rock: ['edel', 'tuft', 'edel', 'pebbles', 'lichen', 'blue'],
  cave: ['glow', 'glow2', 'crystal', 'glow', 'lichen', 'crystalP'],
};
function patchCanvas(z, zi, v) {
  const [c, g] = canvas(TILE, TILE), r = rng(zi * 2741 + v * 6007 + 41), list = PATCH[z.style];
  const n = 4 + Math.floor(r() * 3), boxes = [];
  for (let k = 0, tries = 0; k < n && tries < 40; tries++) {
    const name = list[Math.floor(r() * list.length)], [w, h] = size(name);
    const x = Math.floor(r() * (TILE - w + 1)), y = 1 + Math.floor(r() * (TILE - h));
    if (boxes.some(b => x < b[0] + b[2] && b[0] < x + w && y < b[1] + b[3] && b[1] < y + h)) continue;
    boxes.push([x, y, w, h]);
    stamp(g, z, name, x, y, r() < 0.5);
    k++;
  }
  return c;
}

// The foot of a wall above: a band of leafy tufts reaching up over the wall's face, with flowers (or
// mushrooms, cattails, rubble, crystals) tucked in. The picture is FOOT_UP pixels taller than a tile.
function footCanvas(z, zi, v) {
  const H = TILE + FOOT_UP, [c, g] = canvas(TILE, H), r = rng(zi * 4513 + v * 7717 + 3);
  const G = greens(z), dark = z.wallDark, base = FOOT_UP + 1;
  const px = (col, x, y) => { if (x >= 0 && x < TILE && y >= 0 && y < H) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } };
  if (z.style === 'rock' || z.style === 'cave') {
    // fallen stones heaped against the cliff
    for (let x = 0; x < TILE; x += 1 + Math.floor(r() * 2)) {
      const h = 1 + Math.floor(r() * 3);
      for (let j = 0; j < h; j++) px(j === h - 1 ? z.wallLight : j ? z.wallFace : z.wallDark, x, base + 1 - j);
    }
  } else {
    // tufts: blades from the ground up, darker at the back, pale tips at the front
    for (let layer = 0; layer < 3; layer++) {
      for (let x = layer % 2; x < TILE; x += 1 + (r() < 0.4 ? 1 : 0)) {
        const h = (layer === 0 ? 5 : layer === 1 ? 4 : 2) + Math.floor(r() * (layer === 2 ? 3 : 4));
        const y0 = base + 1 + layer;
        for (let j = 0; j < h; j++) {
          const col = layer === 0 ? dark : layer === 1 ? (j > h - 2 ? G.g : G.G) : (j > h - 2 ? G.v : G.g);
          px(col, x + (j > 2 && r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0), y0 - j);
        }
      }
    }
  }
  // two or three things tucked in among the leaves
  const list = FOOT[z.style];
  for (let k = 0, n = 2 + Math.floor(r() * 2); k < n; k++) {
    const name = list[Math.floor(r() * list.length)], [w, h] = size(name);
    const x = Math.floor(k * TILE / n + r() * Math.max(1, TILE / n - w)), y = base + 3 - h + Math.floor(r() * 3);
    stamp(g, z, name, Math.min(TILE - w, x), Math.max(0, y), r() < 0.5);
  }
  return c;
}

// Along a wall to the left or right: a few tufts and a flower leaning in from that side.
function sideCanvas(z, zi, v, east) {
  const [c, g] = canvas(TILE, TILE), r = rng(zi * 3301 + v * 911 + (east ? 5 : 9));
  const G = greens(z);
  const px = (col, x, y) => { g.fillStyle = col; g.fillRect(east ? TILE - 1 - x : x, y, 1, 1); };
  if (z.style === 'rock' || z.style === 'cave') {
    for (let y = 2; y < TILE - 1; y += 2 + Math.floor(r() * 3)) { px(z.wallDark, 0, y); px(z.wallFace, 1, y); if (r() < 0.5) px(z.wallLight, 0, y - 1); }
  } else {
    for (let y = 1; y < TILE - 1; y += 1 + Math.floor(r() * 2)) {
      const len = 1 + Math.floor(r() * 3);
      for (let i = 0; i < len; i++) px(i === len - 1 ? G.v : i ? G.g : z.wallDark, i, y - (i > 1 ? 1 : 0));
    }
  }
  const list = FOOT[z.style], name = list[Math.floor(r() * list.length)], [w, h] = size(name);
  const y = 2 + Math.floor(r() * (TILE - h - 3));
  // the picture itself is stamped unmirrored, close to that side
  const [w0] = [w];
  const x = east ? TILE - w0 - 1 - Math.floor(r() * 2) : 1 + Math.floor(r() * 2);
  stamp(g, z, name, x, y, east);
  return c;
}

// On top of a hedge, a canopy, a reed bed or a cliff: flowers, berries, cattail heads, moss, crystals.
const BLOOM = {
  meadow: ['daisy', 'pink', 'butter', 'blue', 'daisy', 'pink'],
  forest: ['leaf', 'leaves', 'acorn', 'shroom'],
  marsh: ['cattail', 'pale', 'daisy', 'puff'],
  rock: ['moss', 'edel', 'tuft', 'lichen'],
  cave: ['crystal', 'crystalP', 'glow', 'crystal'],
};
function bloomCanvas(z, zi, v) {
  const [c, g] = canvas(TILE, TILE), r = rng(zi * 6151 + v * 523 + 29), list = BLOOM[z.style];
  for (let k = 0, n = 1 + Math.floor(r() * 2.5); k < n; k++) {
    const name = list[Math.floor(r() * list.length)], [w, h] = size(name);
    stamp(g, z, name, Math.floor(r() * (TILE - w)), Math.floor(r() * (TILE - h)), r() < 0.5);
  }
  return c;
}

// Trees standing in the thick of a hedge or a wood, darker than the village's, for the night.
const FIELD_TREES = {
  meadow: [
    { leaf: ['#7aa45a', '#5a8a48', '#446e3c', '#33573a', '#22402a'], line: '#0b160e' },
    { leaf: ['#7aa45a', '#5a8a48', '#446e3c', '#33573a', '#22402a'], line: '#0b160e', fruit: true },
    { leaf: ['#e8bccb', '#cf97ad', '#b27690', '#8e5873', '#663c55'], line: '#1e0c18', petals: true },
  ],
  forest: [
    { leaf: ['#5a8a52', '#40704a', '#30583b', '#22442d', '#16301f'], line: '#070d08', tall: true },
    { leaf: ['#6a8a4a', '#4f7040', '#3c5834', '#2c4428', '#1c2e1a'], line: '#070d08', tall: true },
  ],
  marsh: [
    { leaf: ['#9aa45a', '#7d8a46', '#626e38', '#4a542a', '#323a1c'], line: '#0a0f07' },
    { leaf: ['#8a9a62', '#6c7c4a', '#556340', '#3f4a30', '#2a3220'], line: '#0a0f07', tall: true },
  ],
  rock: [
    { leaf: ['#6f8a74', '#55705c', '#42584a', '#314238', '#212d26'], line: '#0d1210', tall: true },
  ],
};
export const fieldTreeCount = style => (FIELD_TREES[style] || []).length;

export const SCATTER_VARIANTS = 12, FOOT_VARIANTS = 6, SIDE_VARIANTS = 4, BLOOM_VARIANTS = 8;

function key(scene, k, make) {
  if (!scene.textures.exists(k)) scene.textures.addCanvas(k, make());
  return k;
}
export const scatterKey = (scene, z, zi, v) => key(scene, `fd${zi}_s${v}`, () => scatterCanvas(z, zi, v));
export const footKey = (scene, z, zi, v) => key(scene, `fd${zi}_f${v}`, () => footCanvas(z, zi, v));
export const sideKey = (scene, z, zi, v, east) => key(scene, `fd${zi}_${east ? 'e' : 'w'}${v}`, () => sideCanvas(z, zi, v, east));
export const patchKey = (scene, z, zi, v) => key(scene, `fd${zi}_p${v}`, () => patchCanvas(z, zi, v));
export const PATCH_VARIANTS = 8;
export const bloomKey = (scene, z, zi, v) => key(scene, `fd${zi}_b${v}`, () => bloomCanvas(z, zi, v));
export const fieldTreeKey = (scene, style, v) => key(scene, `fd_tree_${style}${v}`, () => treeCanvas(0, FIELD_TREES[style][v], v * 7 + 3));
export { FOOT_UP };

// ---------- things in the air ----------
// a petal (meadow), a leaf (forest), a seed fluff (marsh), a snowflake-like spore (rock, cave)
const MOTES = {
  meadow: [['.q', 'qQ'], ['w.', 'ww'], ['y', 'Y']],
  forest: [['o.', 'oO'], ['.y', 'yY'], ['O.', '.o']],
  marsh: [['w', 'W'], ['.w', 'w.']],
  rock: [['w'], ['W']],
  cave: [['t'], ['c']],
};
export function moteKeys(scene, style) {
  return MOTES[style].map((rows, i) => key(scene, `mote_${style}${i}`, () => {
    const [c, g] = canvas(rows[0].length, rows.length);
    rows.forEach((row, j) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = C[ch]; g.fillRect(x, j, 1, 1); } }));
    return c;
  }));
}
