// The village's houses, each its own shape: the guild's tall hall with a clock tower, a mushroom shop,
// the smith's stone kiln, a tree you live inside, the rescue team's striped tent, the rival's
// witch-hat tower, and your own straw-roofed cottage. Each stands on its footprint (h.w x h.h tiles,
// the door in the middle of the bottom row) and may rise above it by `up` pixels, so the canvas is
// placed by its bottom edge. Drawn on a pixel grid with one dark outline round the whole outside.

import { TILE } from './textures.js';

const INK = '#1b1424';
const hex = n => `#${n.toString(16).padStart(6, '0')}`;
const toInt = c => parseInt(c.slice(1), 16);
// blend two #rrggbb colours
export const mixc = (a, b, t) => {
  const pa = toInt(a), pb = toInt(b);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return hex((ch(16) << 16) | (ch(8) << 8) | ch(0));
};

// a little pixel buffer: shapes are filled in, then `outline` draws the dark edge just outside them
export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
  set(x, y, col) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null; }
  rect(x, y, w, h, col) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, typeof col === 'function' ? col(x + i, y + j, i, j) : col);
  }
  // pixels whose centres fall inside the ellipse; `col` may be a function of (x, y, nx, ny), nx/ny in -1..1
  ell(cx, cy, rx, ry, col, clip) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1 || (clip && !clip(x, y))) continue;
      this.set(x, y, typeof col === 'function' ? col(x, y, nx, ny) : col);
    }
  }
  poly(P, col) {
    const ys = P.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) for (let x = 0; x < this.w; x++) {
      let inside = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i], [xj, yj] = P[j], px = x + 0.5, py = y + 0.5;
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y, typeof col === 'function' ? col(x, y) : col);
    }
  }
  line(x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, col);
  }
  outline(col = INK) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, col);
  }
  // rows of text art (palette letters) stamped at (x, y)
  stamp(x, y, rows, pal) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') this.set(x + i, y + j, pal[ch]); })); }
  draw(g, ox = 0, oy = 0) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.c[y * this.w + x];
      if (c) { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); }
    }
  }
}

// The little board over a door says what the house is for, as a picture.
const SIGNS = {
  flag: ['..k.....', '..krrr..', '..krrrrr', '..krr...', '..k.....', '..k.....'],
  coin: ['..kkkk..', '.kyyyyk.', 'kyyYyyyk', 'kyyYyyyk', '.kyyyyk.', '..kkkk..'],
  hammer: ['.kkkkkk.', '.kLLLLk.', '.kkLLkk.', '...nk...', '...nk...', '...nk...'],
  heart: ['.kk..kk.', 'kqqkkqqk', 'kqqqqqqk', '.kqqqqk.', '..kqqk..', '...kk...'],
  cross: ['...kk...', '..krrk..', '.kkrrkk.', 'krrrrrrk', '.kkrrkk.', '..krrk..'],
  star: ['...kk...', '...yy...', 'kyyyyyyk', '.kyyyyk.', '.kyk.yk.', '.k....k.'],
};
const SIGN_PAL = { k: INK, r: '#d9454a', y: '#f4cf4f', Y: '#c99a2b', L: '#b8bccb', n: '#a0703f', q: '#f29bb2' };

const WOOD = '#8a5634', WOOD_L = '#a0703f', WOOD_D = '#5a3520', CREAM = '#f1e3c6', CREAM_D = '#d8c49c';
const LIT = '#ffe08a', LIT_L = '#fff3b0', DARK_WIN = '#3a3646';

// the parts every house shares
function door(p, cx, gy, lived, round = false) {
  const x = cx - 5, y = gy - 13;
  p.rect(x, y + 1, 10, 13, INK); p.rect(x + 1, y, 8, 1, INK);
  if (round) { p.rect(x + 2, y - 1, 6, 1, INK); p.set(x + 1, y, INK); p.set(x + 8, y, INK); }
  p.rect(x + 1, y + 1, 8, 12, WOOD);
  if (round) p.rect(x + 2, y, 6, 1, WOOD);
  p.rect(x + 1, y + 1, 2, 12, WOOD_L); p.rect(x + 5, y + 2, 1, 11, WOOD_D);
  p.set(x + 7, y + 7, '#f4cf4f');
  if (!lived) for (let k = 0; k < 8; k++) { p.rect(x + 1 + k, y + 3 + k, 2, 1, '#c9a878'); p.set(x + 8 - k, y + 3 + k, '#c9a878'); }
}
function windowSq(p, x, y, lived, w = 7, h = 6) {
  p.rect(x - 1, y - 1, w + 2, h + 2, INK);
  p.rect(x, y, w, h, lived ? LIT : DARK_WIN);
  p.rect(x + (w >> 1), y, 1, h, INK); p.rect(x, y + (h >> 1) - 1, w, 1, INK);
  if (lived) p.rect(x, y, 2, 1, LIT_L);
  else p.rect(x - 1, y + 2, w + 2, 1, WOOD_L);
}
function windowRound(p, cx, cy, r, lived) {
  p.ell(cx, cy, r + 1, r + 1, INK);
  p.ell(cx, cy, r, r, (x, y, nx, ny) => lived ? (nx < -0.2 && ny < -0.2 ? LIT_L : LIT) : DARK_WIN);
  p.rect(Math.round(cx - 0.5), Math.round(cy - r), 1, Math.round(r * 2), INK);
  if (!lived) p.rect(Math.round(cx - r - 1), Math.round(cy - 0.5), Math.round(r * 2 + 2), 1, WOOD_L);
}
function sign(p, cx, y, kind, lived) {
  const sx = cx - 6;
  p.rect(sx, y, 12, 9, INK); p.rect(sx + 1, y + 1, 10, 7, '#c9a878');
  if (lived) p.stamp(sx + 2, y + 1, SIGNS[kind], SIGN_PAL);
}
// roof colours: an empty house's are faded grey until somebody moves in
const tones = (base, lived) => {
  const b = lived ? base : mixc(base, '#8a8794', 0.55);
  return { b, d: mixc(b, '#000000', 0.28), dd: mixc(b, '#000000', 0.45), l: mixc(b, '#ffffff', 0.3) };
};

// ---------- the houses ----------
// each draws into a Pix of the footprint's width and footprint height + up; gy is the ground row
const HOUSE_ART = {
  // the guild: a big timber-framed hall, a clock tower in the middle with one round window like an
  // eye, and the guild's flag on top. The tallest thing in the village.
  guild: { up: 44, draw(p, W, H, lived, h) {
    const t = tones(h.roof, lived), gy = H - 1, wallTop = H - 30;
    // tower
    const tx = W / 2 - 9;
    p.rect(tx, 14, 18, wallTop - 14, CREAM);
    p.rect(tx, 14, 2, wallTop - 14, WOOD); p.rect(tx + 16, 14, 2, wallTop - 14, WOOD);
    p.poly([[tx - 3, 15], [W / 2, 2], [tx + 21, 15]], (x, y) => (x < W / 2 ? t.b : t.d));
    p.rect(tx - 3, 14, 24, 2, t.dd);
    windowRound(p, W / 2, 26, 4, lived);
    // the flag on its pole
    p.rect(W / 2, 0, 1, 4, INK);
    // the hall's roof, steep, shingled
    p.poly([[0, wallTop + 2], [10, wallTop - 18], [W - 10, wallTop - 18], [W, wallTop + 2]], (x, y) => {
      const row = Math.floor((y - (wallTop - 18)) / 4);
      return (y - (wallTop - 18)) % 4 === 3 ? t.d : (x + row * 3) % 6 === 0 ? t.d : x < 16 ? t.l : t.b;
    });
    // walls with beams
    p.rect(3, wallTop + 2, W - 6, gy - wallTop - 2, CREAM);
    p.rect(3, gy - 2, W - 6, 2, CREAM_D);
    for (const x of [3, 21, W - 23, W - 5]) p.rect(x, wallTop + 2, 2, gy - wallTop - 2, WOOD);
    p.rect(3, wallTop + 2, W - 6, 2, WOOD);
    windowSq(p, 9, wallTop + 9, lived); windowSq(p, W - 16, wallTop + 9, lived);
    door(p, W / 2, gy + 1, lived);
    sign(p, W / 2, wallTop - 6, h.sign, lived);
    p.outline();
    // the flag itself, after the outline so it stays thin
    p.rect(W / 2 + 1, 0, 6, 3, lived ? '#d9454a' : '#8a8794'); p.rect(W / 2 + 1, 3, 3, 1, lived ? '#d9454a' : '#8a8794');
  } },

  // the shop: a giant red mushroom, the cap spotted white, the door and windows in its fat stem
  shop: { up: 18, draw(p, W, H, lived, h) {
    const t = tones(h.roof, lived), gy = H - 1, capY = H - 36;
    // stem, bulging a little at the foot
    p.poly([[12, gy + 1], [14, capY + 6], [W - 14, capY + 6], [W - 12, gy + 1]], (x, y) => x < 20 ? '#fbf3e2' : x > W - 22 ? CREAM_D : CREAM);
    // the cap: a wide dome, its underside showing gills
    p.ell(W / 2, capY + 6, W / 2 + 1, 8, (x, y) => (x % 3 === 0 ? '#c9a878' : '#e8d3a8'), (x, y) => y >= capY + 5);
    p.ell(W / 2, capY + 4, W / 2, capY + 4, (x, y, nx, ny) => {
      const T = -(0.6 * nx + 0.8 * ny);
      return T > 0.75 ? t.l : T > -0.1 ? t.b : t.d;
    }, (x, y) => y <= capY + 5);
    // white spots
    for (const [cx, cy, r] of [[22, capY - 8, 4], [44, capY - 14, 5], [61, capY - 4, 3.5], [33, capY - 1, 2.5], [10, capY - 1, 2.5], [54, capY - 19, 2]]) {
      p.ell(cx, cy, r, r * 0.85, (x, y, nx, ny) => (nx > 0.3 && ny > 0.3 ? '#e8ddd4' : '#fff7f0'));
    }
    windowRound(p, 22, gy - 13, 3.5, lived); windowRound(p, W - 22, gy - 13, 3.5, lived);
    door(p, W / 2, gy + 1, lived, true);
    // a striped awning over the door
    if (lived) for (let i = 0; i < 16; i++) { p.rect(W / 2 - 8 + i, gy - 18, 1, 3, i % 4 < 2 ? '#d9454a' : '#f4f0e8'); }
    sign(p, W / 2, capY - 2 + 2, h.sign, lived);
    p.outline();
  } },

  // the smith: a squat round kiln of stone blocks under a slate dome, a fat brick chimney with the
  // forge glowing orange at its foot
  smith: { up: 20, draw(p, W, H, lived, h) {
    const t = tones(h.roof, lived), gy = H - 1, wallTop = H - 34;
    const stone = lived ? '#a3a7b4' : '#8f8d98', mortar = mixc(stone, '#000000', 0.35), stoneL = mixc(stone, '#ffffff', 0.25);
    // chimney (behind the dome)
    p.rect(W - 22, 0, 13, wallTop + 8, (x, y, i, j) => (j % 4 === 3 || (i + (j >> 2) * 3) % 6 === 0 ? '#7a3b2a' : '#a8553c'));
    p.rect(W - 23, 0, 15, 3, '#5e5a66');
    // walls of stone blocks
    p.ell(W / 2, gy - 2, W / 2 - 4, 6, stone);
    p.rect(4, wallTop + 4, W - 8, gy - wallTop - 6, (x, y, i, j) => {
      const row = j >> 2, off = (row % 2) * 4;
      if (j % 4 === 3 || (i + off) % 8 === 0) return mortar;
      return i < 10 ? stoneL : stone;
    });
    // slate dome
    p.ell(W / 2, wallTop + 5, W / 2 - 2, 18, (x, y, nx, ny) => {
      const ring = Math.floor((y - wallTop + 13) / 4);
      if ((y - wallTop + 13) % 4 === 0) return t.d;
      return nx < -0.4 && ny < -0.2 ? t.l : (x + ring * 2) % 7 === 0 ? t.d : t.b;
    }, (x, y) => y <= wallTop + 5);
    p.rect(2, wallTop + 4, W - 4, 2, t.dd);
    // the forge mouth, glowing
    p.ell(W - 16, gy - 5, 6, 5, INK, (x, y) => y <= gy);
    p.ell(W - 16, gy - 4, 4.5, 4, (x, y, nx, ny) => (lived ? (ny > 0.2 ? '#f4cf4f' : '#f08c3a') : '#3a3646'), (x, y) => y <= gy);
    windowSq(p, 10, wallTop + 12, lived, 6, 6);
    door(p, W / 2 - 4, gy + 1, lived);
    sign(p, W / 2 - 4, wallTop - 4, h.sign, lived);
    p.outline();
  } },

  // the neighbour lives inside a cherry tree: a fat trunk with a round door and round windows,
  // roots spreading over the grass, the blossom crown for a roof
  neighbor: { up: 44, draw(p, W, H, lived, h) {
    const gy = H - 1, trunkTop = H - 56;
    const bark = lived ? '#8a5634' : '#7a6656', barkL = mixc(bark, '#ffffff', 0.2), barkD = mixc(bark, '#000000', 0.32);
    // trunk with roots
    p.poly([[4, gy + 1], [12, gy - 3], [17, gy - 12], [21, trunkTop], [W - 21, trunkTop], [W - 17, gy - 12], [W - 12, gy - 3], [W - 4, gy + 1]], (x, y) => {
      if (x < 22) return barkL;
      if (x > W - 24) return barkD;
      return (x * 7 + (y >> 3) * 5) % 13 === 0 ? barkD : bark;
    });
    for (let y = trunkTop + 4; y < gy - 4; y += 7) { p.rect(26 + (y % 3), y, 1, 4, barkD); p.rect(W - 28 - (y % 2), y + 2, 1, 4, barkD); }
    // blossom crown: clumps lit from the top left
    const leaf = lived ? ['#ffe1ec', '#f8b4cc', '#ec8db0', '#cc6b93', '#9a4a72'] : ['#e6dde2', '#cbbfc6', '#ada0a8', '#8d8189', '#6d6269'];
    const clumps = [[12, 40, 11], [W - 12, 40, 11], [W / 2, 26, 14], [24, 25, 11], [W - 24, 25, 11], [W / 2 - 17, 46, 10], [W / 2 + 17, 46, 10], [W / 2, 46, 12]];
    p.ell(W / 2, 38, W / 2 - 6, 14, leaf[3]);
    for (const [cx, cy, r] of clumps) p.ell(cx, cy, r, r * 0.9, (x, y, nx, ny) => {
      const T = -(0.55 * nx + 0.8 * ny);
      return leaf[T > 0.6 ? 0 : T > 0.1 ? 1 : T > -0.4 ? 2 : 3];
    });
    // petals sprinkled on the crown
    for (let k = 0, sd = 7; k < 30; k++) { sd = (sd * 9301 + 49297) % 233280; const x = 4 + sd % (W - 8), y = 14 + (sd >> 7) % 44; if (p.get(x, y) && p.get(x, y) !== bark) p.set(x, y, '#fff7fa'); }
    windowRound(p, 26, gy - 22, 3.5, lived); windowRound(p, W - 26, gy - 26, 3, lived);
    door(p, W / 2, gy + 1, lived, true);
    sign(p, W / 2, gy - 25, h.sign, lived);
    p.outline();
  } },

  // the rescue team: a big round tent striped orange and cream, a red-cross pennant on the pole
  rescue: { up: 14, draw(p, W, H, lived, h) {
    const t = tones(h.roof, lived), gy = H - 1, eave = H - 28;
    const cream = lived ? '#f4f0e8' : '#cfc9c4';
    p.rect(W / 2, 0, 1, 12, INK);
    // the cone
    p.poly([[2, eave + 2], [W / 2, 8], [W - 2, eave + 2]], (x, y) => {
      const k = Math.floor((x - W / 2) / ((y - 7) * 0.32 + 1));
      return (k & 1) ? (x < W / 2 ? cream : mixc(cream, '#000000', 0.12)) : (x < W / 2 ? t.b : t.d);
    });
    // scalloped eave
    for (let x = 2; x < W - 2; x++) { const s = Math.floor(x / 6); p.rect(x, eave + 2, 1, 2 + ((x % 6 > 0 && x % 6 < 5) ? 1 : 0), s & 1 ? cream : t.b); }
    // the round wall
    p.rect(5, eave + 4, W - 10, gy - eave - 4, (x, y, i) => (Math.floor(i / 7) & 1 ? cream : t.b));
    p.rect(5, gy - 1, W - 10, 1, t.dd);
    // the door flap, tied back
    p.poly([[W / 2 - 9, gy + 1], [W / 2, eave + 6], [W / 2 + 9, gy + 1]], t.dd);
    p.poly([[W / 2 - 6, gy + 1], [W / 2, eave + 10], [W / 2 + 6, gy + 1]], lived ? '#5a3a2a' : '#3a3646');
    if (!lived) for (let k = 0; k < 6; k++) p.rect(W / 2 - 5 + k * 2, gy - 9 + (k & 1), 2, 1, '#c9a878');
    sign(p, W / 2, eave - 10, h.sign, lived);
    p.outline();
    p.rect(W / 2 + 1, 0, 5, 4, lived ? '#f4f0e8' : '#8a8794'); if (lived) { p.rect(W / 2 + 3, 0, 1, 4, '#d9454a'); p.rect(W / 2 + 2, 1, 3, 1, '#d9454a'); }
  } },

  // the rival: a round tower under a tall pointed witch-hat roof, the tip bent over, a star on it
  rival: { up: 46, draw(p, W, H, lived, h) {
    const t = tones(h.roof, lived), gy = H - 1, wallTop = H - 30;
    p.rect(14, wallTop, W - 28, gy - wallTop, (x, y, i, j) => (j % 6 === 5 || (i + ((j / 6) | 0) * 4) % 9 === 0 ? CREAM_D : CREAM));
    p.rect(14, wallTop, 3, gy - wallTop, WOOD_L); p.rect(W - 17, wallTop, 3, gy - wallTop, WOOD);
    // the hat: brim, cone, the bent tip
    p.ell(W / 2, wallTop + 1, W / 2 - 4, 5, (x, y, nx) => (nx < -0.3 ? t.l : t.d));
    p.poly([[12, wallTop - 1], [W / 2 - 2, 6], [W / 2 + 6, 4], [W - 12, wallTop - 1]], (x, y) => (x < W / 2 - 6 + (y / 6) ? t.l : x < W / 2 + 10 ? t.b : t.d));
    p.poly([[W / 2 - 2, 7], [W / 2 + 6, 3], [W / 2 + 14, 9], [W / 2 + 12, 11], [W / 2 + 5, 7]], t.b);
    p.rect(14, wallTop - 4, W - 28, 3, lived ? '#f4cf4f' : '#a8a296');
    windowSq(p, 20, wallTop + 9, lived, 5, 6); windowSq(p, W - 25, wallTop + 9, lived, 5, 6);
    door(p, W / 2, gy + 1, lived, true);
    sign(p, W / 2, wallTop - 14, h.sign, lived);
    p.outline();
    // the star on the tip
    p.stamp(W / 2 + 12, 6, ['.y.', 'yyy', '.y.'], { y: lived ? '#f4cf4f' : '#a8a296' });
  } },

  // your own house: a round cottage under a thick straw roof, a heart over the door, a round
  // chimney, flower boxes under the windows
  home: { up: 16, draw(p, W, H, lived, h) {
    const gy = H - 1, eave = H - 26;
    const straw = '#e9c35a', strawL = '#f8e08a', strawD = '#b8913a', strawDD = '#8a6a2a';
    // chimney
    p.rect(W - 22, 2, 9, 16, (x, y, i, j) => (j % 4 === 3 ? '#7d8398' : i < 2 ? '#c9ccd8' : '#a3a7b4'));
    // walls
    p.rect(6, eave, W - 12, gy - eave, (x, y, i) => (i < 4 ? '#fbf3e2' : x > W - 12 ? CREAM_D : CREAM));
    p.rect(6, gy - 2, W - 12, 2, CREAM_D);
    // the straw dome, with a ragged fringe at the eave
    p.ell(W / 2, eave + 2, W / 2, eave - 2, (x, y, nx, ny) => {
      const T = -(0.6 * nx + 0.8 * ny), streak = (x * 5 + Math.floor(y / 3) * 3) % 7 === 0;
      return streak ? strawD : T > 0.7 ? strawL : T > -0.2 ? straw : strawD;
    }, (x, y) => y <= eave + 2);
    for (let x = 1; x < W - 1; x++) { const d = (x * 7) % 3; p.rect(x, eave + 3, 1, d, x < W / 2 ? straw : strawD); p.set(x, eave + 3 + d, strawDD); }
    windowRound(p, 18, gy - 12, 3.5, true); windowRound(p, W - 18, gy - 12, 3.5, true);
    for (const cx of [18, W - 18]) { p.rect(cx - 5, gy - 7, 11, 3, WOOD); for (let k = 0; k < 5; k++) p.set(cx - 4 + k * 2, gy - 8, ['#f29bb2', '#f4cf4f', '#d9454a'][k % 3]); }
    door(p, W / 2, gy + 1, true, true);
    sign(p, W / 2, eave - 9, h.sign, true);
    p.outline();
  } },
};

// how far above its footprint a house rises
export const houseUp = h => HOUSE_ART[h.id]?.up || 0;
// where the chimney smoke comes out, from the house's footprint top-left in pixels
export const chimneyAt = h => ({ smith: [h.w * TILE - 15, -20], home: [h.w * TILE - 17, -14] })[h.id];

export function houseArt(h, lived) {
  const art = HOUSE_ART[h.id];
  const W = h.w * TILE, H = h.h * TILE + art.up;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // a soft shadow on the grass under it
  g.fillStyle = 'rgba(16,28,18,0.22)';
  for (let k = 0; k < 4; k++) g.fillRect(4 + k * 2, H - 4 + k, W - 8 - k * 4, 1);
  const p = new Pix(W, H);
  art.draw(p, W, H, lived, h);
  p.draw(g);
  return c;
}
export const hasHouseArt = h => !!HOUSE_ART[h.id];
