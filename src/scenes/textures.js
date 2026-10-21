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
function oreCanvas(grade) {
  return spriteCanvas(TER_SPR.bigOre, (ch, i, j) => {
    if (ch !== 'y' && ch !== 'Y') return null;
    if (!grade.vein) return RAINBOW[(i + j) % RAINBOW.length];
    return grade.vein[ch === 'y' ? 0 : 1];
  });
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

// Stone floor: four slabs with dark seams and a few chips.
function floorTile(z, variant) {
  const [c, g] = canvas(), r = noise(variant * 17 + 3);
  g.fillStyle = z.floor; g.fillRect(0, 0, TILE, TILE);
  const off = variant % 2 ? 4 : 0;
  g.fillStyle = z.floorDark;
  g.fillRect(0, 7, TILE, 1); g.fillRect(0, 15, TILE, 1);
  g.fillRect((7 + off) % TILE, 0, 1, 7); g.fillRect((11 + off) % TILE, 8, 1, 7);
  g.fillStyle = z.floorLight;
  g.fillRect(0, 0, TILE, 1); g.fillRect(0, 8, TILE, 1);
  for (let i = 0; i < 5 + variant * 2; i++) {
    g.fillStyle = r() < 0.5 ? z.floorDark : z.floorLight;
    g.fillRect(Math.floor(r() * 15), 1 + Math.floor(r() * 14), 1, 1);
  }
  if (variant === 3) { // a crack
    g.fillStyle = z.floorDark;
    [[3, 3], [4, 4], [5, 4], [6, 5], [7, 6], [7, 9], [8, 10], [9, 10], [10, 11]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  }
  return c;
}

function wallTile(z, withFace) {
  const [c, g] = canvas();
  g.fillStyle = z.wall; g.fillRect(0, 0, TILE, TILE);
  if (withFace) {
    // the visible front of a wall: rough stone blocks
    g.fillStyle = z.wallTop; g.fillRect(0, 4, TILE, TILE - 4);
    g.fillStyle = z.wallLine;
    g.fillRect(0, 4, TILE, 1); g.fillRect(0, 9, TILE, 1); g.fillRect(0, 14, TILE, 2);
    g.fillRect(5, 5, 1, 4); g.fillRect(12, 5, 1, 4); g.fillRect(2, 10, 1, 4); g.fillRect(9, 10, 1, 4);
    g.fillStyle = z.floorLight;
    g.fillRect(1, 5, 3, 1); g.fillRect(7, 5, 4, 1); g.fillRect(3, 10, 5, 1); g.fillRect(10, 10, 4, 1);
  } else {
    g.fillStyle = z.wallLine;
    g.fillRect(0, TILE - 1, TILE, 1);
    g.fillRect(3, 4, 2, 1); g.fillRect(10, 9, 2, 1);
  }
  return c;
}

function waterTile(z, frame) {
  const [c, g] = canvas();
  g.fillStyle = z.water; g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = z.waterLight;
  const o = frame ? 3 : 0;
  [[2 + o, 3, 4], [9 - o, 7, 5], [4 + o, 12, 4], [12 - o, 13, 3]].forEach(([x, y, w]) => g.fillRect(x, y, w, 1));
  g.fillStyle = '#ffffff';
  g.fillRect(3 + o, 3, 1, 1); g.fillRect(10 - o, 7, 1, 1);
  return c;
}

export function buildTextures(scene) {
  const tx = scene.textures;
  for (const [name, rows] of Object.entries(SPR)) if (!tx.exists(name)) tx.addCanvas(name, spriteCanvas(rows));
  for (const [name, rows] of Object.entries(TER_SPR)) if (!tx.exists(`t_${name}`)) tx.addCanvas(`t_${name}`, spriteCanvas(rows));
  for (const grade of ORES) if (!tx.exists(`t_ore_${grade.id}`)) tx.addCanvas(`t_ore_${grade.id}`, oreCanvas(grade));
  ZONES.forEach((z, zi) => {
    for (let v = 0; v < 4; v++) tx.addCanvas(`z${zi}_floor${v}`, floorTile(z, v));
    tx.addCanvas(`z${zi}_wall`, wallTile(z, false));
    tx.addCanvas(`z${zi}_face`, wallTile(z, true));
    tx.addCanvas(`z${zi}_water0`, waterTile(z, 0));
    tx.addCanvas(`z${zi}_water1`, waterTile(z, 1));
  });
  const px = document.createElement('canvas');
  px.width = 1; px.height = 1;
  const g = px.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
  tx.addCanvas('px', px);
}
