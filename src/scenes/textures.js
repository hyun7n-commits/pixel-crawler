// Builds Phaser textures from the pixel-art strings and draws the floor and wall tiles for each zone.

import { PAL, SPR, TER_SPR } from '../data/sprites.js';
import { FACES, faceRows, faceKey } from '../data/faces.js';
import { ZONES, VILLAGE_GROUND } from '../data/enemies.js';
import { ORES } from '../data/ores.js';
import { RES } from '../art/ink.js';
import { oreArt, dropArt } from '../art/ores.js';
import { artDraw, artCanvas } from '../art/index.js';
import { N, E, S, W_, NE, SE, SW, NW, FLOOR_VARIANTS, floorArt, wallArt, waterArt, shadeArt, tallGrassArt, flatGrassArt } from '../art/tiles.js';

// Neighbour masks for walls, water and floor shading: bit set = that side is open.
export { N, E, S, W_, NE, SE, SW, NW };

export const TILE = 16; // world pixels per tile
// Textures are drawn RES canvas pixels to each world pixel, so they stay smooth however close the
// camera gets; an image shows its texture at its world size with this scale.
export const ART = 1 / RES;
// particle settings written in world px, for the 'dot' texture (RES canvas px across)
export function dotScale(cfg) {
  const k = v => typeof v === 'number' ? v * ART : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([n, x]) => [n, typeof x === 'number' && ['start', 'end', 'min', 'max'].includes(n) ? x * ART : x])) : v;
  const out = { ...cfg };
  for (const n of ['scale', 'scaleX', 'scaleY']) if (n in cfg) out[n] = k(cfg[n]);
  return out;
}

const charRows = name => SPR[name] || TER_SPR[name];
// how much to scale a sprite so it takes one tile whatever its texture size
export const texScale = s => TILE / s.frame.height;

// `recolor(ch, i, j)` may return a different colour for a pixel (used for the ore grades).
// Pixel art not yet redrawn is blown up to the same resolution, each pixel a crisp block.
function spriteCanvas(rows, recolor, k = RES) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * k; c.height = h * k;
  const g = c.getContext('2d');
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      const col = ch !== '.' && (recolor?.(ch, i, j) || PAL[ch]);
      if (col) { g.fillStyle = col; g.fillRect(i * k, j * k, k, k); }
    }
  }
  return c;
}
// a named picture: drawn in code when it has been, else its pixel art
function namedCanvas(name, k = RES, rows = null) {
  const art = artDraw(name);
  if (art) return artCanvas(art, k);
  const [base, expr] = name.split('~');
  rows ||= charRows(base);
  return spriteCanvas(expr ? faceRows(rows, expr) : rows, null, k);
}

// The big ore in each grade, what a broken one leaves, and a chip of it (src/art/ores.js)
const oreCanvas = (grade, k = RES) => oreArt(grade, { seed: 7 + ORES.indexOf(grade), k });
const dropCanvas = (grade, chip) => dropArt(grade, chip);
export const dropKey = tier => `t_drop_${ORES[tier].id}`;
export const chipKey = tier => `t_chip_${ORES[tier].id}`;

// The texture and frame for one tile of an ore: [key, frame]. One-tile ores use the plain sprite.
export function oreFrame(scene, ore, x, y, tier = ore.tier) {
  const grade = ORES[tier];
  if (!ore.cells || ore.cells.length < 2) return [`t_ore_${grade.id}`, undefined];
  const x0 = Math.min(...ore.cells.map(c => c.x)), y0 = Math.min(...ore.cells.map(c => c.y));
  const shape = ore.cells.map(c => `${c.x - x0}${c.y - y0}`).join('');
  const key = `t_vein_${x0}_${y0}_${shape}_${grade.id}`;
  const tx = scene.textures;
  if (!tx.exists(key)) {
    const cells = ore.cells.map(c => ({ x: c.x - x0, y: c.y - y0 }));
    const tex = tx.addCanvas(key, oreArt(grade, { cells, seed: x0 * 7919 + y0 * 104729 + cells.length * 31 }));
    for (const c of ore.cells) tex.add(`${c.x - x0}_${c.y - y0}`, 0, (c.x - x0) * TILE * RES, (c.y - y0) * TILE * RES, TILE * RES, TILE * RES);
  }
  return [key, `${x - x0}_${y - y0}`];
}

// The same pictures for the DOM (HUD icons, hub cards, choice cards), drawn bigger so they stay sharp.
const domCache = {};
const DOM_RES = 10, DOM_PX = 160; // a drawn picture is this wide in the menus, however small it is on the map
export function spriteForDom(name) {
  const grade = name.startsWith('t_ore_') && ORES.find(o => `t_ore_${o.id}` === name);
  const art = !grade && artDraw(name);
  return (domCache[name] ||= grade ? oreCanvas(grade, DOM_PX / 16) : art ? artCanvas(art, DOM_PX / art.w) : namedCanvas(name, DOM_RES));
}
// true when the picture is smooth (drawn in code), so the DOM shows it without pixel sharpening
export const isSmooth = name => name.startsWith('t_ore_') || !!artDraw(name);

// A hero's faces (every frame times every expression) are drawn when the hero first appears.
export function ensureHero(scene, base) {
  const tx = scene.textures;
  for (const frame of [base, `${base}_walk1`, `${base}_walk2`]) {
    if (!charRows(frame) && !artDraw(frame)) continue;
    for (const expr of Object.keys(FACES)) {
      const key = faceKey(frame, expr);
      if (!tx.exists(key)) tx.addCanvas(key, namedCanvas(key));
    }
  }
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

// The glass cloche a secret-garden relic sits under (drawn over the relic, so it looks shut inside):
// 12 x 14 world px, a round glass bell on a little base.
function crystalCanvas() {
  const c = document.createElement('canvas');
  c.width = 12 * RES; c.height = 14 * RES;
  const g = c.getContext('2d');
  g.scale(RES, RES); g.lineJoin = 'round';
  const bell = () => { g.beginPath(); g.moveTo(0.8, 12); g.lineTo(0.8, 7); g.arc(6, 7, 5.2, Math.PI, 0); g.lineTo(11.2, 12); g.closePath(); };
  bell(); g.fillStyle = 'rgba(190,236,255,0.28)'; g.fill();
  g.lineWidth = 0.7; g.strokeStyle = 'rgba(74,42,60,0.75)'; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.9; g.beginPath(); g.arc(6, 7, 3.6, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
  g.beginPath(); g.moveTo(2.4, 8); g.lineTo(2.4, 10.4); g.stroke();
  g.beginPath(); g.roundRect(4.6, 0.6, 2.8, 1.8, 0.8); g.fillStyle = '#c8f0fa'; g.fill(); g.lineWidth = 0.5; g.strokeStyle = 'rgba(74,42,60,0.75)'; g.stroke();
  g.beginPath(); g.roundRect(0, 11.6, 12, 2.2, 1); g.fillStyle = '#c98a55'; g.fill(); g.lineWidth = 0.6; g.stroke();
  return c;
}

// Wall, water and shade tiles depend on their neighbours, so they are made the first time a
// combination is needed and then reused.
// the field zones, then the village's own daytime palette at HOME_ZI
const GROUNDS = [...ZONES, VILLAGE_GROUND];
export const HOME_ZI = ZONES.length;
// `mask`: sides facing open ground, `dark`: sides facing solid wall that is never drawn
export function wallKey(scene, zi, mask, v = 0, dark = 0) {
  const key = `z${zi}_wall_${mask}_${dark}_${v}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, wallArt(GROUNDS[zi], zi, mask, dark, v));
  return key;
}
// `warm`: a hot spring's pool, milky jade instead of the zone's blue
export function waterKey(scene, zi, frame, mask, warm = false) {
  const key = `z${zi}_water${frame}_${mask}${warm ? '_warm' : ''}`;
  const z = warm ? { ...GROUNDS[zi], water: '#8fd6c4', waterLight: '#e0f7ef' } : GROUNDS[zi];
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, waterArt(z, frame, mask));
  return key;
}
export function shadeKey(scene, mask) {
  const key = `shade_${mask}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, shadeArt(mask));
  return key;
}
export function floorKey(zi, h) {
  // mostly plain slabs, now and then a crack or a detail
  const v = h < 18 ? 0 : h < 24 ? 1 : h < 28 ? 2 : h < 30 ? 3 : 4 + (h % 4);
  return `z${zi}_floor${v}`;
}


export function buildTextures(scene) {
  const tx = scene.textures;
  for (const name of Object.keys(SPR)) if (!tx.exists(name)) tx.addCanvas(name, namedCanvas(name));
  // a hero's faces are drawn when the hero shows up (ensureHero)
  for (const [name, rows] of Object.entries(TER_SPR)) if (!tx.exists(`t_${name}`)) tx.addCanvas(`t_${name}`, namedCanvas(`t_${name}`, RES, rows));
  for (const grade of ORES) {
    if (!tx.exists(`t_ore_${grade.id}`)) tx.addCanvas(`t_ore_${grade.id}`, oreCanvas(grade));
    if (!tx.exists(`t_drop_${grade.id}`)) tx.addCanvas(`t_drop_${grade.id}`, dropCanvas(grade, false));
    if (!tx.exists(`t_chip_${grade.id}`)) tx.addCanvas(`t_chip_${grade.id}`, dropCanvas(grade, true));
  }
  // the scene can be built again (a trip picked up after a visit home); what exists stays
  const add = (key, make) => { if (!tx.exists(key)) tx.addCanvas(key, make()); };
  for (let v = 0; v < 3; v++) {
    add(`t_brush${v}`, () => tallGrassArt(v));
    add(`t_grass${v}`, () => flatGrassArt(v));
  }
  GROUNDS.forEach((z, zi) => {
    for (let v = 0; v < FLOOR_VARIANTS; v++) add(`z${zi}_floor${v}`, () => floorArt(z, zi, v));
  });
  add('t_lamp', () => namedCanvas('t_lamp', RES, LAMP));
  add('glow', glowCanvas);
  add('crystalShell', crystalCanvas);
  // a round speck for the particles: 1 world px across, drawn at full resolution (show it at ART times the scale)
  add('dot', () => {
    const c = document.createElement('canvas');
    c.width = c.height = RES;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(RES / 2, RES / 2, RES / 2 - 0.3, 0, Math.PI * 2); g.fill();
    return c;
  });
  add('px', () => {
    const px = document.createElement('canvas');
    px.width = 1; px.height = 1;
    const g = px.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
    return px;
  });
}
