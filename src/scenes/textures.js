// Builds Phaser textures from the pixel-art strings and generates tile textures per zone.

import { PAL, SPR } from '../data/sprites.js';
import { ZONES } from '../data/enemies.js';

export const TILE = 8; // world pixels per tile

function spriteCanvas(rows) {
  const c = document.createElement('canvas');
  c.width = TILE; c.height = TILE;
  const g = c.getContext('2d');
  for (let j = 0; j < TILE; j++) {
    const row = (rows[j] || '').padEnd(TILE, '.').slice(0, TILE);
    for (let i = 0; i < TILE; i++) {
      const ch = row[i];
      if (ch !== '.' && PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(i, j, 1, 1); }
    }
  }
  return c;
}

// Same canvases for the DOM (HUD icons, hub cards, choice cards).
const domCache = {};
export function spriteForDom(name) {
  return (domCache[name] ||= spriteCanvas(SPR[name]));
}

// Small deterministic noise so tiles look hand-drawn but never flicker.
function noise(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function floorTile(z, variant) {
  const c = document.createElement('canvas');
  c.width = TILE; c.height = TILE;
  const g = c.getContext('2d'), r = noise(variant * 17 + 3);
  g.fillStyle = z.floor; g.fillRect(0, 0, TILE, TILE);
  // stone slab edges
  g.fillStyle = z.floorDark;
  g.fillRect(0, TILE - 1, TILE, 1);
  g.fillRect(TILE - 1, 0, 1, TILE);
  g.fillStyle = z.floorLight;
  g.fillRect(0, 0, TILE - 1, 1);
  for (let i = 0; i < 3 + variant; i++) {
    g.fillStyle = r() < 0.5 ? z.floorDark : z.floorLight;
    g.fillRect(1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6), 1, 1);
  }
  if (variant === 3) { // a crack
    g.fillStyle = z.floorDark;
    g.fillRect(2, 3, 1, 1); g.fillRect(3, 4, 1, 1); g.fillRect(4, 4, 1, 1); g.fillRect(5, 5, 1, 1);
  }
  return c;
}

function wallTile(z, withFace) {
  const c = document.createElement('canvas');
  c.width = TILE; c.height = TILE;
  const g = c.getContext('2d');
  g.fillStyle = z.wall; g.fillRect(0, 0, TILE, TILE);
  if (withFace) {
    // the visible front of a wall: bricks
    g.fillStyle = z.wallTop; g.fillRect(0, 2, TILE, TILE - 2);
    g.fillStyle = z.wallLine;
    g.fillRect(0, 2, TILE, 1); g.fillRect(0, 5, TILE, 1);
    g.fillRect(3, 3, 1, 2); g.fillRect(6, 6, 1, 2); g.fillRect(1, 6, 1, 2);
  } else {
    g.fillStyle = z.wallLine;
    g.fillRect(0, TILE - 1, TILE, 1);
  }
  return c;
}

export function buildTextures(scene) {
  const tx = scene.textures;
  for (const [name, rows] of Object.entries(SPR)) {
    if (!tx.exists(name)) tx.addCanvas(name, spriteCanvas(rows));
  }
  ZONES.forEach((z, zi) => {
    for (let v = 0; v < 4; v++) tx.addCanvas(`z${zi}_floor${v}`, floorTile(z, v));
    tx.addCanvas(`z${zi}_wall`, wallTile(z, false));
    tx.addCanvas(`z${zi}_face`, wallTile(z, true));
  });
  const px = document.createElement('canvas');
  px.width = 1; px.height = 1;
  const g = px.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
  tx.addCanvas('px', px);
}
