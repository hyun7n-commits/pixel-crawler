// Pictures for 마을의 하루 (v0.30, scenes/village-days.js): the wandering peddler's mat, the bundle on their
// back and the parcel they send to the shop, the bit of a shooting star that comes down, the little light
// in the fog, the light round the big tree's tiny door, the campfire night's flames and log seats, and the
// lit windows of a house picture (for the night). Drawn with pixkit at the village's scale and in its light
// (from the upper left), outlined in a dark version of what they wrap; what gives off light is left
// without a line. (The puddles, the rainbow, the shooting star itself, the fog and the moon on the pond
// are in village-play-art.js; the campfire's stones and logs are the plaza's old campfire,
// village-growth-art.js.)

import { Pix, ramp, tone, hash, WOOD } from './pixkit.js';

const done = p => { p.outline(); return p.canvas(); };

// ---------- 장날 ----------
// the peddler's mat on the ground, a little over two tiles wide: a blue cloth with a border of white
// dots, and on it a basket of eggs, a jar of honey, two little seed sacks and a map rolled up and tied
// with red string
export function matCanvas() {
  const p = new Pix(36, 16), CLOTH = ramp('#5a6fb0'), BASKET = ramp('#b0804a'), HONEY = ramp('#e8a030'), LID = ramp('#d9454a'), SACK = ramp('#d8c49c');
  p.rect(1, 5, 34, 10, (x, y, i, j) => {
    if (i === 0 || j === 0 || i === 33 || j === 9) return tone(CLOTH, j === 0 ? 2.2 : 3.2, x, y);
    if (i === 1 || j === 1 || i === 32 || j === 8) return (i + j) % 3 === 0 ? '#e8ecf8' : tone(CLOTH, 2.6, x, y);
    return tone(CLOTH, 1.7 + (j / 9) * 0.8 + ((i + j * 2) % 7 === 0 ? -0.8 : 0), x, y);
  });
  p.ell(7, 11, 5, 2.6, (x, y, nx, ny) => tone(BASKET, 1.8 + nx * 0.8 + ny * 0.8 + ((x + y) % 2 ? 0.4 : 0), x, y));
  for (const [x, y] of [[5, 8], [8, 7], [9, 9]]) p.ell(x, y, 1.7, 2, (px, py, nx, ny) => (nx + ny < -0.6 ? '#ffffff' : nx + ny > 0.7 ? '#e8dcc8' : '#f8f2e6'));
  p.rect(14, 6, 5, 7, (x, y, i, j) => tone(HONEY, 1.4 + i * 0.35 + (j > 4 ? 0.6 : 0), x, y));
  p.set(15, 7, '#fff3b0'); p.set(15, 8, '#ffe28a');
  p.rect(13, 4, 7, 2, (x, y, i, j) => tone(LID, j ? 2.6 : 1.4, x, y));
  for (const cx of [22.5, 26.5]) {
    p.ell(cx, 10.5, 2.4, 2.6, (x, y, nx, ny) => tone(SACK, 1.6 + nx * 0.9 + ny * 0.6, x, y));
    p.rect(Math.round(cx) - 1, 6, 2, 2, (x, y) => tone(SACK, 2.6, x, y));
    p.set(Math.round(cx), 10, '#5aad58');
  }
  p.rect(29, 9, 5, 3, (x, y, i, j) => ['#f8eccc', '#f1e4c0', '#d8c49c'][j]);
  p.set(31, 9, '#d23a44'); p.set(31, 10, '#d23a44'); p.set(31, 11, '#8a1e28');
  return done(p);
}

// the big cloth bundle the peddler carries on their back: brick red with cream dots, its corners knotted
// on top
export function packCanvas() {
  const p = new Pix(15, 15), C = ramp('#c8604a');
  p.ell(7.5, 9, 6.6, 5.8, (x, y, nx, ny) => ((x * 3 + y * 5) % 7 === 0 && nx * nx + ny * ny < 0.7 ? '#f6e8cc' : tone(C, 1.8 + nx + ny * 0.9, x, y)));
  p.ell(5, 3.5, 1.8, 1.6, (x, y) => tone(C, 1.3, x, y));
  p.ell(10, 3.5, 1.8, 1.6, (x, y) => tone(C, 1.9, x, y));
  p.rect(6, 3, 3, 2, (x, y) => tone(C, 2.5, x, y));
  return done(p);
}

// a parcel wrapped in a yellow cloth, knotted on top (side dishes from home, for the shopkeeper)
export function parcelCanvas() {
  const p = new Pix(12, 11), C = ramp('#f4cf4f');
  p.rect(1, 4, 10, 6, (x, y, i, j) => tone(C, 1.5 + i * 0.16 + (j > 3 ? 0.7 : 0) + (i === 5 ? 0.6 : 0), x, y));
  p.ell(4, 2.5, 1.6, 1.4, (x, y) => tone(C, 1.2, x, y));
  p.ell(8, 2.5, 1.6, 1.4, (x, y) => tone(C, 1.8, x, y));
  p.rect(5, 3, 2, 2, (x, y) => tone(C, 2.6, x, y));
  return done(p);
}

// ---------- 별똥별 내리는 밤 ----------
// the bit of a star that comes down: a little four-pointed twinkle, white at the heart
export function starBitCanvas() {
  const p = new Pix(7, 7);
  p.stamp(0, 0, ['...y...', '...Y...', '..YWY..', 'yYWWWYy', '..YWY..', '...Y...', '...y...'], { y: '#f4cf4f', Y: '#fff3b0', W: '#ffffff' });
  return p.canvas();
}

// ---------- 안개 낀 아침 ----------
// the little light in the fog: a pale blue ball, white at the middle, ragged at its edge
export function wispCanvas() {
  const p = new Pix(7, 7);
  p.ell(3.5, 3.5, 3.4, 3.4, (x, y, nx, ny) => { const d = nx * nx + ny * ny; return d < 0.2 ? '#ffffff' : d < 0.55 ? '#e0f6ff' : hash(x, y, 4) < 0.6 ? '#9fd4f0' : null; });
  return p.canvas();
}

// ---------- 보름달 ----------
// the light leaking round the big tree's tiny door (6 by 10, its top left at (5, 1) here): a line down
// each side and over the top, a speck through the keyhole, and a fan of light on the ground in front
export function doorLightCanvas() {
  const p = new Pix(16, 18), L = '#ffe9a0';
  for (let y = 1; y <= 10; y++) { p.set(4, y, L); p.set(11, y, L); }
  for (let x = 4; x <= 11; x++) p.set(x, 0, L);
  p.set(9, 6, '#fff6c8');
  for (let j = 0; j < 7; j++) {
    const half = 4 + j * 0.6;
    for (let x = Math.round(7.5 - half); x <= Math.round(7.5 + half); x++) if (hash(x, j, 9) < 0.85 - j * 0.11) p.set(x, 11 + j, '#ffd88a');
  }
  return p.canvas();
}

// ---------- 모닥불 밤 ----------
// the flames, FLAME_FRAMES of them, on the plaza's old campfire picture (16 by 18; the first is the flame
// it has), laid over it so that they burn bright in the dark
export const FLAME_FRAMES = 3;
const FLAMES = [
  [[[4, 13], [6, 8], [7, 9], [8, 3], [9, 7], [10, 6], [12, 13]], [[6, 13], [8, 7], [10, 13]]],
  [[[4, 13], [5, 9], [7, 8], [9, 2], [10, 7], [11, 8], [12, 13]], [[6, 13], [9, 6], [10, 13]]],
  [[[4, 13], [6, 7], [7, 10], [8, 4], [10, 8], [11, 5], [12, 13]], [[6, 13], [7, 8], [9, 9], [10, 13]]],
];
export function flameCanvas(f = 0) {
  const p = new Pix(16, 18), [outer, inner] = FLAMES[f % FLAME_FRAMES];
  p.poly(outer, (x, y) => (y < 7 ? '#ffd25a' : y < 10 ? '#f59a3a' : '#d9542e'));
  p.poly(inner, (x, y) => (y < 10 ? '#fff3b0' : '#ffd25a'));
  return p.canvas();
}
// a log to sit on by the fire, lying on its side, the cut end showing its rings (a little wider than
// whoever sits on it, so that it shows either side)
export function seatCanvas() {
  const p = new Pix(21, 7);
  p.rect(2, 1, 18, 5, (x, y, i, j) => tone(WOOD, (j === 0 ? 1.1 : j === 4 ? 3.1 : 2) + (hash(Math.floor(x / 3), j, 5) < 0.25 ? 0.5 : 0), x, y));
  p.ell(2.5, 3.5, 2, 2.5, (x, y, nx, ny) => (nx * nx + ny * ny < 0.3 ? '#8a6038' : Math.round((nx * nx + ny * ny) * 3) % 2 ? '#d9b27a' : '#c49a62'));
  return done(p);
}

// ---------- the night's lit windows ----------
// The lit glass of a house picture (the windows, the lanterns by the door) and nothing else: the same
// pixels in the same colours, to lay over the house once it is dark. `lit` on the canvas: how many.
const LIT = new Set([0xfff6c8, 0xffe28a, 0xf8c45a, 0xe6963e, 0xffe08a, 0xfff3b0]);
export function litCanvas(src) {
  const W = src.width, H = src.height, c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.lit = 0;
  let g = src.getContext?.('2d');
  if (!g) {
    const t = document.createElement('canvas');
    t.width = W; t.height = H;
    g = t.getContext('2d');
    g.drawImage(src, 0, 0);
  }
  const d = g.getImageData(0, 0, W, H).data, out = c.getContext('2d'), img = out.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const k = i * 4;
    if (d[k + 3] < 255 || !LIT.has((d[k] << 16) | (d[k + 1] << 8) | d[k + 2])) continue;
    img.data[k] = d[k]; img.data[k + 1] = d[k + 1]; img.data[k + 2] = d[k + 2]; img.data[k + 3] = 255;
    c.lit++;
  }
  out.putImageData(img, 0, 0);
  return c;
}
