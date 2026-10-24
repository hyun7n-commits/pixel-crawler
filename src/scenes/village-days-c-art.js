// Pictures for the third lot of 마을의 하루 (v0.30, scenes/village-days-c.js): the picnic blanket and the
// basket on it, the guild master's cap and the bits that fly about on a windy day, the flowers that come
// out all over the grass and the roses you pick (and the bunch of them you carry), the litter on the paths
// and the bag it goes in, the lute, the notes and the hat at the plaza concert. Drawn with pixkit at the
// village's scale and in its light (from the upper left), outlined in a dark version of what they wrap;
// what lies flat on the ground (the blanket, the flowers) and what is only a few pixels (the notes, the
// wind's bits) goes without a line, like the puddles and the petals.

import { Pix, ramp, tone, hash, mixc, INK } from './pixkit.js';

const done = p => { p.outline(); return p.canvas(); };

// ---------- 연못가 소풍 ----------
// the blanket, three tiles by two, laid flat on the grass: red and cream gingham (the stripes cross
// darker), a darker hem all round and a fringe along the bottom
export function blanketCanvas() {
  const p = new Pix(48, 32), R = ramp('#d9454a');
  p.rect(1, 1, 46, 29, (x, y, i, j) => {
    if (i === 0 || j === 0 || i === 45 || j === 28) return tone(R, 3.3, x, y);
    const a = Math.floor((i - 1) / 4) % 2, b = Math.floor((j - 1) / 4) % 2;
    if (a && b) return tone(R, 2.1 + (j / 28) * 0.6, x, y);
    if (a || b) return (i + j) % 2 ? '#eea0a4' : '#f0aaae';
    return (i + j) % 5 === 0 ? '#eadfc8' : '#f6ecd8';
  });
  for (let x = 2; x < 46; x += 2) p.set(x, 30, '#eadfc8');
  p.outline();
  return p.canvas();
}

// the picnic basket: wicker, a handle over the top, and a row of 김밥 peeking over the rim
export function basketCanvas() {
  const p = new Pix(14, 12), B = ramp('#b0804a');
  p.ell(7, 5, 5.5, 4.5, (x, y, nx, ny) => (nx * nx + ny * ny > 0.62 && y < 5 ? tone(B, 1.5 + ny * 0.8, x, y) : null));
  p.rect(1, 5, 12, 7, (x, y, i, j) => tone(B, 1.4 + (j % 2 ? 0.7 : 0) + ((i + j) % 2 ? 0.5 : 0) + (i === 0 ? 0.7 : 0) - (i === 11 ? 0.3 : 0), x, y));
  p.rect(0, 5, 14, 1, (x, y) => tone(B, 2.9, x, y));
  for (let k = 0; k < 4; k++) {
    const x = 2 + k * 3;
    p.set(x, 4, '#2a2430'); p.set(x + 1, 4, '#2a2430'); p.set(x, 3, '#2a2430'); p.set(x + 1, 3, k % 2 ? '#f6f2e6' : '#5aad58');
  }
  return done(p);
}

// ---------- 바람 부는 날 ----------
// the guild master's cap: a flat blue cap with a band, a peak to the right and a button on top
export function capCanvas() {
  const p = new Pix(13, 8), B = ramp('#3f6fb3');
  p.ell(5.5, 4, 5.2, 3.6, (x, y, nx, ny) => (y < 6 ? tone(B, 1.5 + ny * 0.9 + nx * 0.4, x, y) : null));
  p.rect(1, 5, 10, 2, (x, y, i, j) => tone(B, j ? 3.2 : 2.6, x, y));
  p.rect(8, 6, 5, 1, (x, y) => tone(B, 2.3, x, y));
  p.set(12, 7, tone(B, 3.4, 12, 7));
  p.set(5, 1, '#9fc0ec');
  return done(p);
}

// what the wind carries past: a leaf, a petal, a yellow leaf off the big tree (three by two)
export function windBitCanvas(kind = 0) {
  const p = new Pix(3, 2), [a, b] = [['#8cc45a', '#5f9a3a'], ['#f8c0d0', '#f29bb2'], ['#f0cc5a', '#d8a030']][kind % 3];
  p.set(0, 0, a); p.set(1, 0, a); p.set(2, 1, b); p.set(1, 1, b);
  return p.canvas();
}

// a picture with the rows `y0`..`y1` between the columns `x0`..`x1` nudged to the right by `shift(y)`
// pixels: the laundry on the line swinging in the wind (its poles stay where they are)
export function shiftedCanvas(src, x0, x1, y0, y1, shift) {
  const W = src.width, H = src.height, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  for (let y = y0; y <= y1; y++) {
    const s = shift(y);
    if (!s) continue;
    const row = g.getImageData(x0, y, x1 - x0 + 1 - s, 1);
    g.clearRect(x0, y, x1 - x0 + 1, 1);
    g.putImageData(row, x0 + s, y);
  }
  return c;
}

// ---------- 꽃 잔치 ----------
// the flowers out all over the grass: one sheet the size of the open village (`cells`: [x, y, v] for
// each patch, in tiles from (x0, y0)), each patch two or three little blossoms with a leaf, flat on the
// ground. `v` picks their colours.
const BLOOMS = [['#f8a0c0', '#fff3b0'], ['#f8f4ec', '#f4cf4f'], ['#f4d04a', '#e07030'], ['#9fb8ec', '#f8f4ec'], ['#c08ad8', '#fff3b0']];
export function bloomSheetCanvas(w, h, cells) {
  const p = new Pix(w * 16, h * 16);
  for (const [cx, cy, v] of cells) {
    const [petal, heart] = BLOOMS[v % BLOOMS.length], n = 2 + (hash(cx, cy, 3) < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const x = cx * 16 + 2 + Math.floor(hash(cx + k, cy, 5) * 11), y = cy * 16 + 2 + Math.floor(hash(cx, cy + k, 6) * 11);
      p.set(x, y - 1, petal); p.set(x - 1, y, petal); p.set(x + 1, y, petal); p.set(x, y + 1, petal);
      p.set(x, y, heart);
      p.set(x + 2, y + 1, '#6aa84a');
    }
  }
  return p.canvas();
}

// a wild rose standing up out of the grass, big enough to pick: a red head on a stem with two leaves
export function roseCanvas() {
  const p = new Pix(10, 13), R = ramp('#d9454a'), G = ramp('#5f9a3a');
  p.rect(4, 6, 2, 7, (x, y, i) => tone(G, 2 + i * 0.6, x, y));
  p.poly([[1, 8], [4, 7], [4, 10]], (x, y) => tone(G, 1.5, x, y));
  p.poly([[6, 9], [9, 10], [6, 12]], (x, y) => tone(G, 2.2, x, y));
  p.ell(4.5, 3.5, 3.6, 3.4, (x, y, nx, ny) => { const d = nx * nx + ny * ny; return tone(R, d < 0.2 ? 1 : d < 0.6 ? 1.8 + (Math.atan2(ny, nx) > 0 ? 0.6 : 0) : 2.6 + ny * 0.6, x, y); });
  p.set(4, 3, '#f8b0b8');
  return done(p);
}

// the roses you have picked, held in a bunch: `n` heads over their stems, tied with a yellow ribbon
export function bouquetCanvas(n = 1) {
  const p = new Pix(15, 14), R = ramp('#d9454a'), G = ramp('#5f9a3a');
  const heads = [[7, 4], [4, 6], [10, 6], [6, 1], [10, 2], [2, 3]].slice(0, Math.max(1, Math.min(6, n)));
  for (const [hx, hy] of heads) p.line(hx, hy + 2, 7, 12, (k, m) => tone(G, 1.8 + k / m, hx, hy));
  for (const [hx, hy] of heads) {
    p.ell(hx + 0.5, hy + 0.5, 2.4, 2.4, (x, y, nx, ny) => tone(R, nx * nx + ny * ny < 0.3 ? 1 : 1.9 + ny * 0.7, x, y));
    p.set(hx, hy, '#f8b0b8');
  }
  p.rect(6, 10, 3, 2, (x, y, i, j) => (j ? '#d8a830' : '#f4cf4f'));
  return done(p);
}

// ---------- 대청소 ----------
// the litter along the paths: a tin can, a crumpled bit of paper, a bottle on its side, an apple core
export const LITTER_KINDS = ['can', 'paper', 'bottle', 'core'];
export function litterCanvas(kind) {
  if (kind === 'can') {
    const p = new Pix(7, 9), S = ramp('#b8bcc8');
    p.rect(1, 1, 5, 8, (x, y, i, j) => tone(S, 1.4 + i * 0.5 + (j === 0 ? -0.6 : 0), x, y));
    p.rect(1, 4, 5, 2, (x, y, i) => (i === 1 ? '#f0f0f0' : i === 2 ? '#d9454a' : mixc('#d9454a', INK, 0.2)));
    p.ell(3.5, 1.5, 2.6, 1.2, (x, y) => tone(S, 3.1, x, y));
    p.set(3, 1, tone(S, 1, 3, 1));
    return done(p);
  }
  if (kind === 'paper') {
    const p = new Pix(8, 7), C = ramp('#f0e8d8');
    p.ell(4, 3.5, 3.8, 3.2, (x, y, nx, ny) => tone(C, (hash(x, y, 7) < 0.3 ? 2.8 : 1.5) + ny * 0.7 + nx * 0.3, x, y));
    return done(p);
  }
  if (kind === 'bottle') {
    const p = new Pix(12, 6), G = ramp('#5aa070');
    p.rect(3, 1, 8, 4, (x, y, i, j) => tone(G, 1.3 + j * 0.7 - (i === 7 ? 0.5 : 0), x, y));
    p.rect(0, 2, 3, 2, (x, y, i, j) => tone(G, 2 + j * 0.8, x, y));
    p.set(0, 2, '#8a6038'); p.set(0, 3, '#8a6038');
    p.rect(5, 1, 4, 1, (x, y) => tone(G, 0.6, x, y));
    return done(p);
  }
  const p = new Pix(6, 8), A = ramp('#d9454a');
  p.rect(1, 0, 4, 2, (x, y, i, j) => tone(A, 1.5 + j * 0.8, x, y));
  p.rect(1, 6, 4, 2, (x, y, i, j) => tone(A, 1.8 + j * 0.8, x, y));
  p.rect(2, 2, 2, 4, (x, y, i, j) => (j === 1 || j === 2 ? '#f6ecd8' : '#eadfc8'));
  p.set(2, 3, '#6a4a2a');
  return done(p);
}

// the bag the litter goes in, held over your head: a grey-blue sack tied at the neck; fuller as it fills
export function trashBagCanvas(full = false) {
  const p = new Pix(13, 13), B = ramp('#7a86a8');
  p.ell(6.5, 8.5, full ? 6 : 4.6, full ? 4.4 : 3.8, (x, y, nx, ny) => tone(B, 1.6 + nx * 0.7 + ny * 0.9 + (hash(x, y, 2) < 0.15 ? 0.6 : 0), x, y));
  p.rect(5, 3, 3, 3, (x, y, i) => tone(B, 2.4 + i * 0.3, x, y));
  p.rect(4, 1, 2, 2, (x, y) => tone(B, 2, x, y));
  p.rect(7, 1, 2, 2, (x, y) => tone(B, 2.8, x, y));
  p.rect(5, 5, 3, 1, (x, y) => '#f4cf4f');
  return done(p);
}

// ---------- 광장 연주회 ----------
// the lute: a pear-shaped body of pale wood with a dark sound hole, a neck up with pegs at the top, and
// two strings down the middle
export function luteCanvas() {
  const p = new Pix(10, 14), W = ramp('#c89a5a'), N = ramp('#7a4a2a');
  p.ell(5, 9.5, 4.2, 4.2, (x, y, nx, ny) => tone(W, 1.7 + nx * 0.6 + ny * 0.8, x, y));
  p.rect(4, 1, 2, 7, (x, y, i) => tone(N, 1.6 + i * 0.6, x, y));
  p.rect(3, 0, 4, 2, (x, y) => tone(N, 2.5, x, y));
  p.set(2, 0, tone(N, 1.2, 2, 0)); p.set(7, 1, tone(N, 1.2, 7, 1));
  p.rect(4, 9, 2, 2, () => '#3a2418');
  for (let y = 2; y <= 12; y++) if (y !== 9 && y !== 10) { p.set(4, y, y % 2 ? '#f6ecd8' : null); p.set(5, y, y % 2 ? null : '#f6ecd8'); }
  return done(p);
}

// a note that floats up from the lute (two kinds: one note, two tied)
export function noteCanvas(kind = 0) {
  const p = new Pix(7, 7), pal = { c: '#f29bb2', w: '#ffd8e4' };
  if (kind === 0) p.stamp(1, 0, ['..c..', '..cc.', '..c.c', '..c..', 'wcc..', 'ccc..', '.c...'], pal);
  else p.stamp(0, 0, ['.cccccc', '.c....c', '.c....c', '.c....c', 'cc...cc', 'cc...cc', '......'], pal);
  return done(p);
}

// the coin that goes in the hat (five pixels across, gold with a glint)
export function coinCanvas() {
  const p = new Pix(5, 5);
  p.stamp(0, 0, ['.ggg.', 'gwggg', 'ggggg', 'ggGgg', '.gGg.'], { g: '#f4cf4f', w: '#fff3b0', G: '#e6a030' });
  return done(p);
}

// the hat on the ground in front, brim up, with a few coins in it already
export function hatCanvas() {
  const p = new Pix(13, 8), H = ramp('#6b4a8a');
  p.ell(6.5, 4.5, 6.2, 2.8, (x, y, nx, ny) => tone(H, 1.7 + ny * 0.9, x, y));
  p.ell(6.5, 3.2, 4.6, 1.6, (x, y) => tone(H, 3.4, x, y));
  p.set(5, 3, '#f4cf4f'); p.set(6, 3, '#fff3b0'); p.set(8, 3, '#f4cf4f'); p.set(7, 4, '#e6a030'); p.set(4, 4, '#e6a030');
  return done(p);
}
