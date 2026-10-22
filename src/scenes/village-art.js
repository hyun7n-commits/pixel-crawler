// The village's own pictures: cottages drawn to their footprint, and the dirt paths between them.

import { TILE, N, E, S, W_ } from './textures.js';
import { ZONES } from '../data/enemies.js';

const mixHex = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// The little board over a door says what the house is for, as a picture.
const SIGNS = {
  flag: ['..k.....', '..krrr..', '..krrrrr', '..krr...', '..k.....', '..k.....'],
  coin: ['..kkkk..', '.kyyyyk.', 'kyyYyyyk', 'kyyYyyyk', '.kyyyyk.', '..kkkk..'],
  hammer: ['.kkkkkk.', '.kLLLLk.', '.kkLLkk.', '...nk...', '...nk...', '...nk...'],
  heart: ['.kk..kk.', 'kqqkkqqk', 'kqqqqqqk', '.kqqqqk.', '..kqqk..', '...kk...'],
  cross: ['...kk...', '..krrk..', '.kkrrkk.', 'krrrrrrk', '.kkrrkk.', '..krrk..'],
  star: ['...kk...', '...yy...', 'kyyyyyyk', '.kyyyyk.', '.kyk.yk.', '.k....k.'],
};
const SIGN_PAL = { k: '#1b1424', r: '#d9454a', y: '#f4cf4f', Y: '#c99a2b', L: '#b8bccb', n: '#a0703f', q: '#f29bb2' };

// A cottage seen from above and in front: a shingled roof over most of it, a cream wall with the door
// in the middle, windows on a wide house. `lived` lights the windows; an empty house has its door
// boarded up and its windows dark until somebody moves in.
export function houseCanvas(h, lived) {
  const W = h.w * TILE, H = h.h * TILE;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const fill = (col, x, y, w = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, w, hh); };
  const ink = '#1b1424', roof = lived ? h.roof : mixHex(h.roof, '#8a8794', 0.55);
  const dark = mixHex(h.roof, lived ? '#000000' : '#3a3646', lived ? 0.3 : 0.6), light = mixHex(h.roof, lived ? '#ffffff' : '#c9c2b6', lived ? 0.3 : 0.6);
  const rh = Math.round(H * 0.55);
  // the wall
  fill(ink, 1, rh - 1, W - 2, H - rh + 1);
  fill('#f1e3c6', 2, rh, W - 4, H - rh - 1);
  fill('#d8c49c', 2, H - 3, W - 4, 2);
  for (const x of [2, W - 4]) fill('#a0703f', x, rh, 2, H - rh - 1); // corner beams
  // the roof, rounded at the top, its eaves hanging past the wall
  fill(ink, 2, 0, W - 4, rh + 1); fill(ink, 0, 3, W, rh - 2);
  fill(roof, 3, 1, W - 6, rh - 1); fill(roof, 1, 4, W - 2, rh - 4);
  for (let y = 5; y < rh - 1; y += 4) {
    fill(dark, 1, y, W - 2, 1);
    for (let x = 2 + ((y / 4) % 2) * 3; x < W - 2; x += 6) fill(dark, x, y - 3, 1, 3);
  }
  fill(light, 3, 1, W - 6, 1);
  fill(dark, 1, rh - 2, W - 2, 1);
  // windows: lit when someone lives here
  const win = (x) => {
    const y = rh + 3;
    fill(ink, x - 1, y - 1, 9, 8);
    fill(lived ? '#ffe08a' : '#3a3646', x, y, 7, 6);
    fill(ink, x + 3, y, 1, 6); fill(ink, x, y + 2, 7, 1);
    if (lived) { fill('#fff3b0', x, y, 2, 1); fill('#f29bb2', x - 1, y + 7, 9, 1); } // a curtain-pink sill
    else { fill('#a0703f', x - 1, y + 2, 9, 1); }
  };
  if (W >= 64) { win(6); win(W - 13); }
  // the door, arched, with a knob; boarded across while nobody lives here
  const dx = Math.floor(W / 2) - 5, dy = H - 13;
  fill(ink, dx, dy + 1, 10, 12); fill(ink, dx + 1, dy, 8, 1);
  fill('#8a5634', dx + 1, dy + 1, 8, 11);
  fill('#a0703f', dx + 1, dy + 1, 2, 11); fill('#5a3520', dx + 5, dy + 2, 1, 10);
  fill('#f4cf4f', dx + 7, dy + 7, 1, 1);
  if (!lived) for (let k = 0; k < 8; k++) { fill('#c9a878', dx + 1 + k, dy + 3 + k, 2, 1); fill('#c9a878', dx + 8 - k, dy + 3 + k, 1, 1); }
  // the sign over the door: what the house is for (blank while empty)
  const sx = Math.floor(W / 2) - 6, sy = rh - 8;
  fill(ink, sx, sy, 12, 9); fill('#c9a878', sx + 1, sy + 1, 10, 7);
  if (lived) SIGNS[h.sign].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') fill(SIGN_PAL[ch], sx + 2 + i, sy + 1 + j); }));
  // a striped awning over the shop door
  if (h.awning && lived) for (let i = 0; i < 14; i++) { fill(i % 4 < 2 ? '#d9454a' : '#f4f0e8', dx - 2 + i, dy - 3, 1, 3); fill(ink, dx - 2 + i, dy, 1, 1); }
  // a chimney
  if (h.chimney) { fill(ink, W - 13, 0, 6, 6); fill('#7d8398', W - 12, 1, 4, 5); fill('#b8bccb', W - 12, 1, 4, 1); }
  return c;
}

// A dirt path. Bits in `mask` are the sides where grass meets it: the grass fringe overlaps a little there.
function pathTile(mask) {
  const c = document.createElement('canvas');
  c.width = TILE; c.height = TILE;
  const g = c.getContext('2d'), z = ZONES[0];
  let s = mask * 31 + 7;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  g.fillStyle = '#c9a878'; g.fillRect(0, 0, TILE, TILE);
  for (let k = 0; k < 8; k++) { g.fillStyle = r() < 0.6 ? '#b08f60' : '#dcc196'; g.fillRect(Math.floor(r() * 15), Math.floor(r() * 15), r() < 0.3 ? 2 : 1, 1); }
  g.fillStyle = z.floor;
  for (let i = 0; i < TILE; i++) {
    const d = (i * 7 + mask) % 3 === 0 ? 2 : 1;
    if (mask & N) g.fillRect(i, 0, 1, d);
    if (mask & S) g.fillRect(i, TILE - d, 1, d);
    if (mask & W_) g.fillRect(0, i, d, 1);
    if (mask & E) g.fillRect(TILE - d, i, d, 1);
  }
  return c;
}
export function pathKey(scene, mask) {
  const key = `village_path_${mask}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pathTile(mask));
  return key;
}
