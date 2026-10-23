// The village's own pictures, drawn in world pixels (16 a tile) on canvases RES times finer: the
// cottages, the paths, the trees round the edge, the firefly post, the lot for your house, and what
// you put up round it (집 꾸미기) with the puppy. Same ink and soft shading as everything else.

import { RES, INK, mix, hexA, within, rng } from './ink.js';
import { N, E, S, W_, NE, SE, SW, NW } from './tiles.js';

const L = 0.8; // outline, world px

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * RES); c.height = Math.round(h * RES);
  const g = c.getContext('2d');
  g.scale(RES, RES); g.lineJoin = 'round'; g.lineCap = 'round';
  return [c, g];
}
const paint = (g, fill, w = L) => { if (fill) { g.fillStyle = fill; g.fill(); } if (w) { g.lineWidth = w; g.strokeStyle = INK; g.stroke(); } };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
const groundShadow = (g, x, y, rx, ry = rx * 0.28) => { ell(g, x, y, rx, ry); g.fillStyle = 'rgba(58,32,64,0.18)'; g.fill(); };
const glint = (g, x, y, rx, ry, a = 0.7) => { ell(g, x, y, rx, ry, -0.5); g.fillStyle = `rgba(255,255,255,${a})`; g.fill(); };

// ---------- the little pictures on the shop signs ----------
const SIGN = {
  flag: g => { g.strokeStyle = INK; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-2.4, 3.4); g.lineTo(-2.4, -3.6); g.stroke(); g.beginPath(); g.moveTo(-2.4, -3.6); g.lineTo(3.4, -2.2); g.lineTo(-2.4, -0.6); g.closePath(); paint(g, '#e8555e', 0.5); },
  coin: g => { circ(g, 0, 0, 3.2); paint(g, '#ffd45a', 0.6); g.fillStyle = '#e5ab2e'; g.fillRect(-0.5, -1.8, 1, 3.6); },
  hammer: g => { g.save(); g.rotate(-0.6); rr(g, -0.6, -1, 1.2, 5, 0.5); paint(g, '#c98a55', 0.5); rr(g, -3, -3.4, 6, 2.8, 0.8); paint(g, '#a8a2b8', 0.5); g.restore(); },
  heart: g => { g.beginPath(); g.moveTo(0, 3.2); g.bezierCurveTo(-5, 0, -3.4, -4.2, 0, -1.8); g.bezierCurveTo(3.4, -4.2, 5, 0, 0, 3.2); g.closePath(); paint(g, '#f48aa6', 0.6); },
  cross: g => { rr(g, -1.2, -3.4, 2.4, 6.8, 0.6); paint(g, '#e8555e', 0.5); rr(g, -3.4, -1.2, 6.8, 2.4, 0.6); paint(g, '#e8555e', 0.5); rr(g, -1.2, -1.2, 2.4, 2.4, 0); g.fillStyle = '#e8555e'; g.fill(); },
  star: g => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, d = k % 2 ? 1.5 : 3.6; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.closePath(); paint(g, '#ffd45a', 0.6); },
};

// ---------- cottages ----------
// A round-roofed cottage filling its footprint: a big scalloped roof over most of it, a cream wall,
// round windows, an arched door in the middle with a sign over it. `lived` lights it; an empty house is
// greyed, its windows dark and its door boarded until somebody moves in.
export function houseArt(h, lived) {
  const W = h.w * 16, H = h.h * 16;
  const [c, g] = cnv(W, H);
  const roofCol = lived ? h.roof : mix(h.roof, '#a8a2b0', 0.6);
  const wall = lived ? '#fbefd5' : '#e4dccd', beam = lived ? '#b07a4c' : '#a49482';
  const cx = W / 2, eave = H * 0.5;
  groundShadow(g, cx, H - 2.2, W * 0.46, 2.6);
  // the wall
  rr(g, 7, eave - 4, W - 14, H - eave + 2.4, 2.6); paint(g, wall);
  within(g, () => rr(g, 7, eave - 4, W - 14, H - eave + 2.4, 2.6), () => {
    g.fillStyle = 'rgba(160,110,70,0.16)'; g.fillRect(0, H - 6, W, 6);
    g.fillStyle = 'rgba(74,42,60,0.22)'; g.fillRect(0, eave - 4, W, 5); // the eave's shadow
  });
  for (const x of [8.2, W - 10.6]) { rr(g, x, eave, 2.4, H - eave - 2, 1); g.fillStyle = beam; g.fill(); }
  // windows: round, warm when someone is home, with a flower box under each
  if (W >= 64) for (const x of [17, W - 17]) {
    const y = eave + 9;
    circ(g, x, y, 5.2); paint(g, '#c98a55');
    circ(g, x, y, 3.8); g.fillStyle = lived ? '#ffe08a' : '#5d566e'; g.fill();
    if (lived) { glint(g, x - 1.4, y - 1.4, 1, 1.6, 0.8); }
    g.strokeStyle = lived ? '#c98a55' : '#7a6f86'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 3.8, y); g.lineTo(x + 3.8, y); g.moveTo(x, y - 3.8); g.lineTo(x, y + 3.8); g.stroke();
    circ(g, x, y, 3.8); g.lineWidth = 0.6; g.strokeStyle = INK; g.stroke();
    if (lived) {
      rr(g, x - 5.4, y + 5, 10.8, 3.2, 1.2); paint(g, '#c98a55', 0.6);
      for (const [dx, col] of [[-3.4, '#f48aa6'], [0, '#ffd45a'], [3.4, '#f48aa6']]) { circ(g, x + dx, y + 4.2, 1.5); paint(g, col, 0.45); }
    } else { g.strokeStyle = '#b08a64'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 4.6, y - 2); g.lineTo(x + 4.6, y + 2); g.stroke(); }
  }
  // the door: arched, planked, a gold knob; boards across while nobody lives here
  const dw = 11, dh = 15.5, dx = cx - dw / 2, dy = H - 3 - dh;
  const door = () => { g.beginPath(); g.moveTo(dx, dy + dh); g.lineTo(dx, dy + dw / 2); g.arc(cx, dy + dw / 2, dw / 2, Math.PI, 0); g.lineTo(dx + dw, dy + dh); g.closePath(); };
  door(); paint(g, lived ? '#a8693f' : '#8f7b6a');
  within(g, door, () => { g.strokeStyle = 'rgba(74,42,60,0.35)'; g.lineWidth = 0.6; for (const x of [dx + dw / 3, dx + dw * 2 / 3]) { g.beginPath(); g.moveTo(x, dy); g.lineTo(x, dy + dh); g.stroke(); } });
  circ(g, dx + dw - 2.6, dy + dh * 0.58, 0.9); paint(g, '#ffd45a', 0.45);
  rr(g, dx - 2, H - 3.6, dw + 4, 2.4, 1); paint(g, '#c9b7a0', 0.6); // the step
  if (!lived) for (const [a, y] of [[-0.25, dy + 6], [0.2, dy + 11]]) {
    g.save(); g.translate(cx, y); g.rotate(a); rr(g, -dw / 2 - 1.6, -1.3, dw + 3.2, 2.6, 0.6); paint(g, '#d2b48a', 0.6); g.restore();
  }
  // the roof: a big round-shouldered cap of scalloped shingles, hanging past the wall
  const roof = () => {
    g.beginPath();
    g.moveTo(1.5, eave + 1);
    g.bezierCurveTo(0, eave - 10, 6, 8, 18, 3.5);
    g.quadraticCurveTo(cx, -0.5, W - 18, 3.5);
    g.bezierCurveTo(W - 6, 8, W, eave - 10, W - 1.5, eave + 1);
    g.quadraticCurveTo(cx, eave + 4.5, 1.5, eave + 1);
    g.closePath();
  };
  roof(); paint(g, roofCol);
  within(g, roof, () => {
    const dark = mix(roofCol, '#4a2a3c', 0.28), light = mix(roofCol, '#ffffff', 0.35);
    g.strokeStyle = dark; g.lineWidth = 0.8;
    for (let row = 0, y = 9; y < eave + 2; row++, y += 6.5) {
      for (let x = -4 + (row % 2) * 4; x < W + 4; x += 8) { g.beginPath(); g.arc(x + 4, y, 4, 0.15, Math.PI - 0.15); g.stroke(); }
    }
    g.fillStyle = hexA('#4a2a3c', 0.16); g.beginPath(); g.ellipse(W * 0.82, eave - 2, W * 0.32, eave * 0.7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = hexA(light, 0.75); ell(g, W * 0.28, 7, W * 0.16, 2.6, -0.12); g.fill();
  });
  roof(); paint(g, null);
  // a chimney with a little cap
  if (h.chimney) {
    const x = W - 21;
    rr(g, x, 0.6, 7, 9, 1.2); paint(g, lived ? '#c98a6a' : '#a89a94');
    rr(g, x - 1, 0, 9, 3, 1.2); paint(g, lived ? '#8e5636' : '#857870');
  }
  // the shop's striped awning over the door
  if (h.awning && lived) {
    const ax = cx - 11, ay = dy - 4.4, aw = 22;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + aw, ay); g.lineTo(ax + aw, ay + 3.4);
    for (let k = 4; k >= 0; k--) g.arc(ax + aw * (k + 0.5) / 5, ay + 3.4, aw / 10, 0, Math.PI);
    g.closePath();
    within(g, () => { g.beginPath(); g.rect(ax, ay - 1, aw, 8); }, () => { for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? '#fff6e4' : '#e8555e'; g.fillRect(ax + aw * k / 5, ay - 1, aw / 5, 8); } });
    g.lineWidth = L; g.strokeStyle = INK; g.stroke();
  }
  // the sign over the door: a round board on two strings saying what the house is for
  const sy = h.awning && lived ? dy - 11 : dy - 7.5;
  g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.moveTo(cx - 3, eave + 1.6); g.lineTo(cx - 3, sy - 3); g.moveTo(cx + 3, eave + 1.6); g.lineTo(cx + 3, sy - 3); g.stroke();
  rr(g, cx - 6, sy - 4.4, 12, 8.8, 3); paint(g, lived ? '#f2d7a6' : '#d8ccb8');
  if (lived) { g.save(); g.translate(cx, sy); g.scale(0.95, 0.95); SIGN[h.sign](g); g.restore(); }
  return c;
}

// ---------- the dirt paths ----------
// One tile of path laid over the grass: soft-edged dirt that stops short of the sides where grass is
// (`mask`, the 8 neighbour bits that are not path), with a nibble of grass in a corner where only the
// diagonal is grass.
export function pathArt(mask, v = 0) {
  const [c, g] = cnv(16, 16);
  const r = rng(mask * 13 + v * 7 + 3);
  const inset = 1.8, R = 5;
  const n = mask & N, e = mask & E, s = mask & S, w = mask & W_;
  const l = w ? inset : -1, t = n ? inset : -1, rt = e ? 16 - inset : 17, b = s ? 16 - inset : 17;
  const shape = () => {
    g.beginPath();
    const tl = n && w ? R : 0, tr = n && e ? R : 0, br = s && e ? R : 0, bl = s && w ? R : 0;
    g.roundRect(l, t, rt - l, b - t, [tl, tr, br, bl]);
  };
  shape(); g.fillStyle = '#e6c58f'; g.fill();
  within(g, shape, () => {
    // now and then a pebble or two
    const n = r() < 0.5 ? 0 : r() < 0.7 ? 1 : 2;
    for (let k = 0; k < n; k++) { ell(g, 3 + r() * 10, 3 + r() * 10, 0.8 + r() * 0.4, 0.5 + r() * 0.3); g.fillStyle = r() < 0.5 ? '#d4ae78' : '#f2d9aa'; g.fill(); }
  });
  // where the grass meets it: a soft darker rim
  shape(); g.lineWidth = 0.9; g.strokeStyle = '#c99e66'; g.stroke();
  // grass nibbling an inside corner
  const nib = (x, y) => { circ(g, x, y, 3.2); g.fillStyle = '#afdc72'; g.fill(); g.lineWidth = 0.9; g.strokeStyle = '#c99e66'; g.stroke(); };
  if ((mask & NE) && !n && !e) nib(16, 0);
  if ((mask & SE) && !s && !e) nib(16, 16);
  if ((mask & SW) && !s && !w) nib(0, 16);
  if ((mask & NW) && !n && !w) nib(0, 0);
  return c;
}

// ---------- trees ----------
// A round, leafy tree three tiles wide and four high, its trunk on the bottom tile's middle.
// v: 0 plain, 1 taller, 2 with red fruit, 3 pink blossom.
const TREE_COLS = [
  ['#5cb85a', '#84d26a', '#3f9c56'],
  ['#4fae62', '#7cc872', '#368a52'],
  ['#5cb85a', '#84d26a', '#3f9c56'],
  ['#f4a7c8', '#fbd0e0', '#d982a8'],
];
export function treeArt(v = 0) {
  const W = 48, H = 64;
  const [c, g] = cnv(W, H);
  const r = rng(v * 31 + 5);
  const [leaf, light, dark] = TREE_COLS[v % 4];
  groundShadow(g, 24, 59.5, 13, 3.6);
  // the trunk, a little flared at the foot
  g.beginPath(); g.moveTo(20.5, 60); g.quadraticCurveTo(22, 50, 21.5, 38); g.lineTo(26.5, 38); g.quadraticCurveTo(26, 50, 27.5, 60); g.quadraticCurveTo(24, 61.4, 20.5, 60); g.closePath();
  paint(g, '#a8693f');
  g.fillStyle = 'rgba(74,42,60,0.22)'; g.fillRect(24.4, 40, 2, 19);
  // the crown: a ring of clumps round a big middle one
  const top = v === 1 ? 4 : 9;
  const blobs = [[24, top + 16, 15], [12, top + 24, 10], [36, top + 24, 10], [16, top + 11, 10], [32, top + 11, 10], [24, top + 30, 11]];
  const crown = () => { g.beginPath(); for (const [x, y, rad] of blobs) { g.moveTo(x + rad, y); g.arc(x, y, rad, 0, Math.PI * 2); } };
  g.lineWidth = L * 2; g.strokeStyle = INK; crown(); g.stroke();
  crown(); g.fillStyle = leaf; g.fill();
  within(g, crown, () => {
    g.fillStyle = dark; ell(g, 30, top + 34, 18, 9); g.fill();
    for (const [x, y, rad] of blobs) { g.fillStyle = hexA(light, 0.9); ell(g, x - rad * 0.3, y - rad * 0.35, rad * 0.5, rad * 0.36, -0.4); g.fill(); }
  });
  if (v === 2) for (let k = 0; k < 6; k++) { const x = 10 + r() * 28, y = top + 8 + r() * 26; circ(g, x, y, 1.7); paint(g, '#e8555e', 0.5); circ(g, x - 0.5, y - 0.5, 0.5); g.fillStyle = '#fff'; g.fill(); }
  if (v === 3) for (let k = 0; k < 8; k++) { circ(g, 9 + r() * 30, top + 6 + r() * 28, 1.1); g.fillStyle = '#fff'; g.fill(); }
  return c;
}

// ---------- the firefly post on the plaza ----------
export function postArt() {
  const W = 16, H = 21;
  const [c, g] = cnv(W, H);
  groundShadow(g, 11.5, 19.6, 4, 1.2);
  rr(g, 10.2, 1.4, 2.6, 18.4, 1); paint(g, '#a8693f');
  rr(g, 4, 0.6, 9.4, 2.2, 1); paint(g, '#8e5636');
  rr(g, 8.4, 18.2, 6.2, 2, 1); paint(g, '#8e5636');
  g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.moveTo(6, 2.8); g.lineTo(6, 4.6); g.stroke();
  // the jar
  rr(g, 3.6, 4.4, 4.8, 1.6, 0.6); paint(g, '#c98a55', 0.6);
  g.beginPath(); g.moveTo(3.6, 6); g.lineTo(8.4, 6); g.quadraticCurveTo(9.8, 8.6, 8.4, 11.2); g.quadraticCurveTo(6, 12.2, 3.6, 11.2); g.quadraticCurveTo(2.2, 8.6, 3.6, 6); g.closePath();
  paint(g, 'rgba(226,250,200,0.95)', 0.6);
  for (const [x, y] of [[5, 8.4], [7, 9.6], [6.4, 7.4]]) { circ(g, x, y, 0.7); g.fillStyle = '#f2ff8a'; g.fill(); }
  return c;
}

// ---------- the lot for your house-to-be ----------
export function lotArt(w, h) {
  const W = w * 16, H = h * 16;
  const [c, g] = cnv(W, H);
  const top = 18;
  rr(g, 5, top + 1, W - 10, H - top - 4, 6); paint(g, '#c99e66', 0);
  rr(g, 5, top + 1, W - 10, H - top - 4, 6); g.fillStyle = '#d9b47c'; g.fill();
  within(g, () => rr(g, 5, top + 1, W - 10, H - top - 4, 6), () => {
    g.strokeStyle = '#b98d58'; g.lineWidth = 1.4;
    for (let y = top + 7; y < H - 5; y += 6) { g.beginPath(); g.moveTo(9, y); g.quadraticCurveTo(W / 2, y + 1.4, W - 9, y); g.stroke(); }
  });
  // stakes and a rope between them
  const stakes = [[6, top], [W - 6, top], [6, H - 4], [W - 6, H - 4]];
  g.strokeStyle = '#fff6e4'; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(6, top - 2); g.quadraticCurveTo(W / 2, top + 1.6, W - 6, top - 2); g.quadraticCurveTo(W - 4, H / 2 + 6, W - 6, H - 6); g.quadraticCurveTo(W / 2, H - 2.4, 6, H - 6); g.quadraticCurveTo(4, H / 2 + 6, 6, top - 2); g.stroke();
  for (const [x, y] of stakes) { rr(g, x - 1.2, y - 5, 2.4, 7, 0.8); paint(g, '#a8693f', 0.6); }
  // the board on its post, a heart on it
  const bx = W / 2;
  rr(g, bx - 1, 9, 2, top - 6, 0.8); paint(g, '#8e5636', 0.6);
  rr(g, bx - 8, 1.4, 16, 10, 2.6); paint(g, '#f2d7a6');
  g.save(); g.translate(bx, 6.4); g.scale(1.05, 1.05); SIGN.heart(g); g.restore();
  return c;
}

// ---------- 집 꾸미기 ----------
// Each piece at its pixel picture's old size (world px), bottom on the ground.
export const DECOR_SIZE = { flowers: [32, 16], mailbox: [16, 19], pots: [16, 16], garden: [32, 32], laundry: [52, 22], bench: [32, 16], dog: [16, 17], statue: [16, 24], swing: [32, 42] };
const flowerHead = (g, x, y, col, r = 1.8) => {
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; circ(g, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, r * 0.75); g.fillStyle = col; g.fill(); }
  circ(g, x, y, r * 0.55); g.fillStyle = '#ffd45a'; g.fill();
};
const DECOR = {
  flowers: g => {
    rr(g, 1, 9, 30, 6, 2.4); paint(g, '#a8693f');
    rr(g, 1, 9, 30, 2.2, 1.2); paint(g, '#c98a55', 0.6);
    const cols = ['#f48aa6', '#ffd45a', '#fff', '#b58ae0', '#f29a52', '#f48aa6'];
    g.strokeStyle = '#4f9a3a'; g.lineWidth = 0.7;
    for (let k = 0; k < 6; k++) { const x = 4 + k * 4.8, y = 4 + (k % 2) * 2; g.beginPath(); g.moveTo(x, 9.5); g.lineTo(x, y); g.stroke(); }
    for (let k = 0; k < 6; k++) { const x = 4 + k * 4.8, y = 4 + (k % 2) * 2; flowerHead(g, x, y, cols[k]); }
  },
  mailbox: g => {
    groundShadow(g, 8, 17.6, 4, 1.2);
    rr(g, 7, 9, 2.2, 9, 0.8); paint(g, '#a8693f', 0.6);
    g.beginPath(); g.moveTo(2.4, 11); g.lineTo(2.4, 7.4); g.arc(7.6, 7.4, 5.2, Math.PI, 0); g.lineTo(12.8, 11); g.closePath(); paint(g, '#e8555e');
    rr(g, 4.6, 8, 6, 1.4, 0.6); g.fillStyle = INK; g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.moveTo(12.6, 7); g.lineTo(12.6, 1.6); g.stroke(); g.beginPath(); g.moveTo(12.6, 1.6); g.lineTo(15.2, 2.4); g.lineTo(12.6, 3.4); g.closePath(); paint(g, '#ffd45a', 0.5);
  },
  pots: g => {
    for (const [x, col, f] of [[4.4, '#c98a55', '#f48aa6'], [11.6, '#e0a070', '#ffd45a']]) {
      groundShadow(g, x, 15, 3.6, 1);
      g.strokeStyle = '#4f9a3a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, 9); g.lineTo(x - 1, 4); g.moveTo(x, 9); g.lineTo(x + 1.6, 5.4); g.stroke();
      ell(g, x - 2, 6.4, 1.6, 0.9, -0.5); paint(g, '#7cc35a', 0.45);
      flowerHead(g, x - 1, 3.6, f, 1.5); flowerHead(g, x + 1.6, 5, f, 1.2);
      g.beginPath(); g.moveTo(x - 3.4, 9); g.lineTo(x + 3.4, 9); g.lineTo(x + 2.6, 14.6); g.lineTo(x - 2.6, 14.6); g.closePath(); paint(g, col, 0.7);
      rr(g, x - 3.8, 8.4, 7.6, 2, 0.8); paint(g, mix(col, '#ffffff', 0.2), 0.6);
    }
  },
  garden: g => {
    rr(g, 1, 3, 30, 28, 4); paint(g, '#a8693f');
    rr(g, 3, 5, 26, 24, 3); g.fillStyle = '#8e5a36'; g.fill();
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) {
      const x = 7 + k * 6.2, y = 10 + row * 7.4;
      if (row === 1) { circ(g, x, y, 2.6); paint(g, '#a8dc7a', 0.6); circ(g, x, y, 1.2); g.fillStyle = '#d8f2b4'; g.fill(); }
      else { for (const a of [-0.5, 0, 0.5]) { g.save(); g.translate(x, y); g.rotate(a); ell(g, 0, -2.4, 0.9, 2.2); paint(g, '#5fa84a', 0.45); g.restore(); } g.beginPath(); g.moveTo(x - 1.4, y); g.lineTo(x + 1.4, y); g.lineTo(x, y + 2.4); g.closePath(); paint(g, '#f29a52', 0.45); }
    }
  },
  laundry: g => {
    for (const x of [2.4, 49.6]) { groundShadow(g, x, 20.6, 2.4, 0.8); rr(g, x - 1, 2, 2, 19, 0.8); paint(g, '#a8693f', 0.6); }
    g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.moveTo(3, 4); g.quadraticCurveTo(26, 8, 49, 4); g.stroke();
    const shirt = (x, y, col) => { g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x + 6, y + 3); g.lineTo(x + 4, y + 4); g.lineTo(x + 3.4, y + 10); g.lineTo(x - 3.4, y + 10); g.lineTo(x - 4, y + 4); g.lineTo(x - 6, y + 3); g.closePath(); paint(g, col, 0.7); };
    shirt(13, 5.4, '#8fd3f2'); shirt(26, 6.4, '#fff6e4');
    g.beginPath(); g.moveTo(35, 6.2); g.lineTo(43, 5.6); g.lineTo(43.4, 15); g.lineTo(39.8, 15); g.lineTo(39.2, 10); g.lineTo(38.6, 15); g.lineTo(35, 15); g.closePath(); paint(g, '#f2b35a', 0.7);
    for (const x of [13, 26, 39]) { circ(g, x, 5.6, 0.7); g.fillStyle = '#e8555e'; g.fill(); }
  },
  bench: g => {
    groundShadow(g, 16, 14.8, 13, 1.4);
    for (const x of [5, 25]) { rr(g, x, 8, 2.2, 7, 0.8); paint(g, '#8e5636', 0.6); }
    rr(g, 1.4, 1.6, 29.2, 3.6, 1.4); paint(g, '#c98a55', 0.7);
    rr(g, 1, 7, 30, 3.6, 1.4); paint(g, '#d9a06a', 0.7);
    g.strokeStyle = 'rgba(74,42,60,0.3)'; g.lineWidth = 0.5; for (const x of [11, 21]) { g.beginPath(); g.moveTo(x, 7.4); g.lineTo(x, 10.2); g.stroke(); }
  },
  dog: g => {
    groundShadow(g, 8, 16, 7, 1.2);
    g.beginPath(); g.moveTo(1.4, 16); g.lineTo(1.4, 8); g.lineTo(8, 2); g.lineTo(14.6, 8); g.lineTo(14.6, 16); g.closePath(); paint(g, '#e8b47a');
    g.beginPath(); g.moveTo(0, 8.6); g.lineTo(8, 1); g.lineTo(16, 8.6); g.lineWidth = 2.4 + L * 2; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.4; g.strokeStyle = '#e8555e'; g.stroke();
    g.beginPath(); g.moveTo(5, 16); g.lineTo(5, 11.6); g.arc(8, 11.6, 3, Math.PI, 0); g.lineTo(11, 16); g.closePath(); paint(g, '#4a3040', 0.6);
    rr(g, 5.4, 5.6, 5.2, 2.4, 0.8); paint(g, '#fff6e4', 0.5);
  },
  statue: g => {
    groundShadow(g, 8, 23, 6, 1.2);
    rr(g, 2.6, 17, 10.8, 6, 1.4); paint(g, '#c8c3d4');
    rr(g, 2, 16, 12, 2.4, 1); paint(g, '#a8a2b8', 0.6);
    g.beginPath(); g.moveTo(8, 1); g.lineTo(13.4, 7); g.lineTo(11, 16); g.lineTo(5, 16); g.lineTo(2.6, 7); g.closePath(); paint(g, '#8fd3f2');
    g.beginPath(); g.moveTo(8, 1); g.lineTo(6.4, 7); g.lineTo(8, 16); g.lineTo(5, 16); g.lineTo(2.6, 7); g.closePath(); g.fillStyle = '#c8f0fa'; g.fill();
    g.beginPath(); g.moveTo(8, 1); g.lineTo(13.4, 7); g.lineTo(11, 16); g.lineTo(5, 16); g.lineTo(2.6, 7); g.closePath(); paint(g, null);
    for (const [x, y] of [[13, 3], [3, 12]]) { g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, d = k % 2 ? 0.5 : 1.6; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } g.closePath(); g.fillStyle = '#fff'; g.fill(); }
  },
  swing: g => {
    // a big tree with a swing hanging off a branch
    groundShadow(g, 14, 40.4, 13, 1.8);
    g.beginPath(); g.moveTo(11, 41); g.quadraticCurveTo(12.4, 30, 12, 18); g.lineTo(16, 18); g.quadraticCurveTo(15.6, 30, 17, 41); g.closePath(); paint(g, '#a8693f');
    const blobs = [[16, 10.6, 9], [8.2, 14.4, 6.4], [24.4, 14.4, 6.6], [16, 17, 7.4]];
    const crown = () => { g.beginPath(); for (const [x, y, rad] of blobs) { g.moveTo(x + rad, y); g.arc(x, y, rad, 0, Math.PI * 2); } };
    g.lineWidth = L * 2; g.strokeStyle = INK; crown(); g.stroke(); crown(); g.fillStyle = '#5cb85a'; g.fill();
    within(g, crown, () => { g.fillStyle = '#3f9c56'; ell(g, 20, 22, 14, 6); g.fill(); for (const [x, y, rad] of blobs) { g.fillStyle = '#84d26a'; ell(g, x - rad * 0.3, y - rad * 0.35, rad * 0.5, rad * 0.36, -0.4); g.fill(); } });
    g.beginPath(); g.moveTo(17, 19); g.lineTo(30, 19.4); g.lineWidth = 1.8 + L * 2; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.8; g.strokeStyle = '#a8693f'; g.stroke();
    g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.moveTo(21, 19.6); g.lineTo(21, 33); g.moveTo(28, 19.6); g.lineTo(28, 33); g.stroke();
    rr(g, 19.4, 32.6, 10.2, 2.2, 0.8); paint(g, '#c98a55', 0.6);
  },
};
export function decorArt(id) {
  const [w, h] = DECOR_SIZE[id];
  const [c, g] = cnv(w, h);
  DECOR[id](g);
  return c;
}

// ---------- the puppy ----------
// at its own size (24 x 20 world-ish units; the village scales it by its height)
export function pupArt(frame = 0) {
  const [c, g] = cnv(24, 20);
  groundShadow(g, 11, 18.8, 8, 1.4);
  // tail
  g.beginPath(); g.moveTo(17, 13); g.quadraticCurveTo(22, 11, 21.4, 7.4 + frame); g.lineWidth = 2.2 + L * 2; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.2; g.strokeStyle = '#fbf6ee'; g.stroke();
  // body and head
  ell(g, 11, 14.4, 7.4, 4.4); paint(g, '#fbf6ee');
  for (const x of [6.4, 9.6, 13, 16]) { rr(g, x - 1.2, 15.6, 2.4, 3.2, 1.2); paint(g, '#fbf6ee', 0.6); }
  ell(g, 10, 8.4, 7, 6); paint(g, '#fbf6ee');
  for (const s of [-1, 1]) { ell(g, 10 + s * 6.4, 6.6, 2.2, 3.6, s * 0.4); paint(g, '#e8a25a', 0.7); }
  for (const x of [7.4, 12.6]) { circ(g, x, 8.2, 0.9); g.fillStyle = INK; g.fill(); }
  ell(g, 10, 10, 1.2, 0.8); g.fillStyle = INK; g.fill();
  for (const x of [5.6, 14.4]) { ell(g, x, 10, 1.3, 0.8); g.fillStyle = 'rgba(244,138,166,0.7)'; g.fill(); }
  ell(g, 15, 13.4, 2.4, 1.8); g.fillStyle = '#f2c48c'; g.fill();
  return c;
}
