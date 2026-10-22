// The village's own pictures: cottages drawn to their footprint, and the dirt paths between them.

import { TILE, N, E, S, W_ } from './textures.js';
import { VILLAGE_GROUND } from '../data/enemies.js';

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
  const g = c.getContext('2d'), z = VILLAGE_GROUND;
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

// A wooden post on the plaza with a jar of fireflies hanging off its arm (the same jar as the lamps
// in the fields), standing on its tile and reaching up into the one above.
const POST = [
  '....kkkkkkkk....',
  '....knnnnnnnk...',
  '....kkkkkknNk...',
  '.......k..knk...',
  '......kkk.knk...',
  '.....kNnnkknk...',
  '.....kcvcckNk...',
  '.....kczvcknk...',
  '.....kcvcckNk...',
  '......kkk.knk...',
  '..........knk...',
  '..........knk...',
  '..........kNk...',
  '..........knk...',
  '..........knk...',
  '..........knk...',
  '..........kNk...',
  '..........knk...',
  '.........kknkk..',
  '........knnnnnk.',
  '........kkkkkkk.',
];
const POST_PAL = { k: '#1b1424', n: '#a0703f', N: '#6e4a2a', c: '#cfe9a8', v: '#f4f7c0', z: '#ffffff' };
export function lampPostCanvas() {
  const c = document.createElement('canvas');
  c.width = TILE; c.height = POST.length;
  const g = c.getContext('2d');
  POST.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { g.fillStyle = POST_PAL[ch]; g.fillRect(i, j, 1, 1); } }));
  return c;
}

// Your house-to-be before you have it: a patch of turned earth roped off on four stakes, with a
// little board on a post (a heart drawn on it). The guild's big prize builds the house here.
export function lotCanvas(w, h) {
  const W = w * TILE, H = h * TILE;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const fill = (col, x, y, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  let s = 7;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const top = 18;
  fill('#b08f60', 6, top + 2, W - 12, H - top - 6);
  fill('#c9a878', 7, top + 3, W - 14, H - top - 8);
  for (let k = 0; k < 70; k++) fill(r() < 0.5 ? '#a08458' : '#dcc196', 8 + Math.floor(r() * (W - 16)), top + 4 + Math.floor(r() * (H - top - 11)), r() < 0.3 ? 2 : 1, 1);
  // furrows
  for (let y = top + 7; y < H - 8; y += 5) fill('#a08458', 10, y, W - 20, 1);
  // stakes and the rope between them
  const stakes = [[5, top], [W - 7, top], [5, H - 6], [W - 7, H - 6]];
  g.fillStyle = '#f4f0e8';
  for (let x = 6; x < W - 6; x++) { fill('#f4f0e8', x, top + 1 + (Math.abs(x - W / 2) < W / 4 ? 1 : 0)); fill('#f4f0e8', x, H - 5 + (Math.abs(x - W / 2) < W / 4 ? 1 : 0)); }
  for (let y = top + 1; y < H - 4; y++) { fill('#f4f0e8', 6, y); fill('#f4f0e8', W - 6, y); }
  for (const [x, y] of stakes) { fill('#1b1424', x - 1, y - 4, 4, 9); fill('#a0703f', x, y - 3, 2, 7); fill('#c9a878', x, y - 3, 2, 1); }
  // the board on its post, a heart on it
  const bx = Math.floor(W / 2) - 7, by = 2;
  fill('#1b1424', bx + 6, by + 10, 3, top - 4); fill('#6e4a2a', bx + 7, by + 10, 1, top - 5);
  fill('#1b1424', bx, by, 15, 11); fill('#c9a878', bx + 1, by + 1, 13, 9); fill('#e0c79c', bx + 1, by + 1, 13, 1);
  for (const [x, y] of [[4, 3], [5, 3], [8, 3], [9, 3], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [5, 6], [6, 6], [7, 6], [8, 6], [6, 7], [7, 7]]) fill('#f29bb2', bx + x, by + y);
  return c;
}
