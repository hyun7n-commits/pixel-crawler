// What the village builds as it grows (data/village.js BUILDINGS), nearly all of it wood: log
// cottages for the friends you bring home, the bakery and its windmill, a gazebo by the pond, the inn,
// the greenhouse, a lookout tower, the bandstand and the carousel. Drawn like the houses
// (village-houses.js): each on its footprint, rising `up` pixels above it, lit from the upper left, an
// outline only round the outside, grass over the foot of the walls. `smoke` is where a chimney's top
// is, in the picture's pixels.

import {
  Pix, mixc, ramp, tone, hash, seeded, shingles, planks, logs, logEnds, clapboard, stones, plaster, foliage, sprinkle,
  tufts, windowBox, roundWindow, flowerBox, doorway, lantern, signboard, inPoly, maker, wallLit, roundLit, domeLit, WOOD, WOOD_WARM, STONE,
} from './pixkit.js';

// wood for walls: the logs' own colours
export const LOG = { brown: ramp('#9a6238'), honey: ramp('#b8844c'), dark: ramp('#7c4c30'), grey: ramp('#8c7866') };
const PINE = ramp('#c9965a');
const IRON = ramp('#5e5c6c');
const CREAM = ramp('#f1e4c8');
const GLASS = ['#f2fbff', '#c8ecf8', '#9ed4ec', '#78b4d4', '#5a90b4'];
const LEAF = ['#a6df6e', '#71c452', '#4aa446', '#33833d', '#215f30'];
const inP = P => (x, y) => inPoly(P, x + 0.5, y + 0.5);

// ---------- parts ----------

// a log wall from x0 to x1, the logs' cut ends sticking out at both corners
export function logWall(p, x0, x1, y0, y1, R, o = {}) {
  const lh = o.lh || 4;
  logs(p, [x0, y0, x1, y1], o.inside || null, R, o.lit || wallLit(x0, x1, y0, y1 + 3), { lh, seed: o.seed || 81 });
  if (o.ends !== false) { logEnds(p, x0 - 2, y0, y1, lh, R); logEnds(p, x1 - lh + 3, y0, y1, lh, R); }
}

// A front gable: two thick slopes meeting at the top (apex at cx, top) and running down to the eaves
// at `eave`, `half` wide each side. `gable` works out where it goes; `gableRoof` draws it (last, over
// the gable's face and the chimney).
export function gable(cx, top, eave, half, thick) {
  const s = (eave - top) / half, out = x => top + s * Math.abs(x + 0.5 - cx);
  return { cx, top, eave, half, thick, out, under: x => Math.ceil(out(x) + thick), inside: (x, y) => Math.abs(x + 0.5 - cx) <= half && y >= out(x) && y < out(x) + thick && y <= eave };
}
export function gableRoof(p, g, R, o = {}) {
  const { cx, top, eave, half, out } = g;
  const lit = (x, y) => (x + 0.5 < cx ? -0.55 : 0.65) + (y - top) / (eave - top) * 0.25;
  shingles(p, [Math.floor(cx - half), top, Math.ceil(cx + half), eave], g.inside, R, lit, { sw: o.sw || 5, rh: o.rh || 3, seed: o.seed || 82, moss: o.moss });
  // the barge boards along the top edges catch the light on the left and sit in shade on the right
  for (let x = Math.floor(cx - half); x <= cx + half; x++) {
    const y = Math.ceil(out(x) - 0.01);
    if (y <= eave) p.set(x, y, x + 0.5 < cx ? R[0] : R[3]);
  }
  // the underside of the eaves at the ends
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) p.set(Math.round(cx + sx * half - (sx > 0 ? 1 : 0) - sx * k), eave, R[4]);
}

// a gable's triangle under its roof, in upright boards, its top in the roof's shadow
export function gableFace(p, x0, x1, g, wallTop, R, o = {}) {
  planks(p, [x0, g.top, x1, wallTop - 1], (x, y) => y >= g.under(x) - 1, R, (x, y) => (x - x0) / (x1 - x0) * 0.8 - 0.3 + (y < g.under(x) + 2 ? 1.1 : 0), { pw: o.pw || 3, seed: o.seed || 83 });
  for (let x = x0; x <= x1; x++) p.set(x, wallTop - 1, R[4]);
}

// three logs stacked by a wall
function woodpile(p, x, gy, R = LOG.brown) {
  for (const [dx, dy] of [[0, 0], [4, 0], [2, -3]]) logEnds(p, x + dx, gy - 3 + dy, gy - 1 + dy, 4, R);
}

// a stone chimney standing up behind the roof, a cap of flat stones on top
export function chimney(p, x, top, bottom, w, R = STONE) {
  stones(p, [x, top + 2, x + w - 1, bottom], null, R, (px) => (px - x) / w * 1.1 - 0.35, { ch: 3, wmin: 3, wmax: 4, seed: x * 7 + top });
  p.rect(x - 1, top, w + 2, 2, (px, py, i, j) => tone(R, j === 0 ? 0.6 : 3, px, py));
}

// A roof seen from the front with its ends sloping back (hipped): eaves from x0 to x1 at `eave`, the
// ridge `inset` in from each end at `top`
export function hipRoof(p, x0, x1, top, eave, inset, R, o = {}) {
  const P = [[x0, eave + 1], [x0 + inset, top], [x1 - inset + 1, top], [x1 + 1, eave + 1]];
  shingles(p, [x0, top, x1, eave], inP(P), R, (x, y) => {
    const t = (y - top) / (eave - top), l = x0 + inset * (1 - t), r = x1 - inset * (1 - t);
    return (x < l + inset * 0.7 ? -0.7 : x > r - inset * 0.7 ? 0.85 : 0) + t * 0.3;
  }, { sw: o.sw || 6, rh: o.rh || 4, seed: o.seed || 84, moss: o.moss });
  for (let x = x0 + inset; x <= x1 - inset; x++) p.set(x, top, R[0]);
  p.rect(x0 + 1, eave, x1 - x0 - 1, 1, (x, y, i) => tone(R, 4 + (i > (x1 - x0) * 0.6 ? 0.5 : 0), x, y));
  return P;
}

// a striped awning, scalloped along its lower edge, its shadow on the wall under it
export function awning(p, x0, x1, y0, depth, cols, o = {}) {
  const sw = o.sw || 4;
  for (let x = x0; x <= x1; x++) {
    const k = Math.floor((x - x0) / sw), R = ramp(cols[k % 2]), lx = (x - x0) % sw;
    const d = depth + (lx === 1 || lx === 2 ? 1 : 0);
    for (let j = 0; j < d; j++) p.set(x, y0 + j, j === 0 ? R[4] : tone(R, (j === 1 ? 0.6 : 1.5) + (x - x0) / (x1 - x0) * 1.1 - 0.4 + (j === d - 1 ? 0.8 : 0), x, y0 + j));
    if (o.shade) for (let j = d; j < d + 2; j++) { const c = p.get(x, y0 + j); if (c) p.set(x, y0 + j, mixc(c, '#2a1f44', j === d ? 0.35 : 0.18)); }
  }
}

// a wooden crate (an X of battens on its face), a barrel with two hoops, a sack tied at the top
export function crate(p, x, gy, w = 9, h = 7, R = WOOD_WARM) {
  planks(p, [x, gy - h, x + w - 1, gy - 1], null, R, (px, py) => (py === gy - h ? -0.8 : 0) + (px > x + w - 3 ? 0.6 : 0), { pw: 3, vert: false, seed: x });
  p.line(x, gy - h + 1, x + w - 1, gy - 1, R[3]); p.line(x + w - 1, gy - h + 1, x, gy - 1, R[3]);
}
export function barrel(p, x, gy, h = 9, fill) {
  planks(p, [x, gy - h, x + 6, gy - 1], null, WOOD, (px) => (px - x) / 6 * 1.1 - 0.4, { pw: 2, seed: x + 3 });
  for (const y of [gy - h + 2, gy - 3]) p.rect(x, y, 7, 1, '#4b4858');
  if (fill) p.rect(x + 1, gy - h, 5, 1, fill);
}
export function sack(p, x, gy, col = '#c9a878') {
  const R = ramp(col);
  p.ell(x + 4, gy - 4, 4.2, 4.2, (px, py, nx, ny) => tone(R, 2 + nx * 0.8 + ny * 0.6, px, py), (px, py) => py < gy);
  p.rect(x + 3, gy - 10, 3, 2, R[3]); p.rect(x + 2, gy - 9, 5, 1, R[4]);
}
// a notice board on two posts under a little roof, notes pinned on it
export function noticeBoard(p, x, gy, lived = true) {
  for (const px of [x + 1, x + 11]) planks(p, [px, gy - 17, px + 1, gy - 1], null, WOOD, () => (px > x + 5 ? 0.8 : 0), { pw: 2 });
  planks(p, [x, gy - 15, x + 12, gy - 7], null, WOOD_WARM, (px, py) => (py === gy - 15 ? -0.6 : 0.4), { pw: 13, vert: false });
  p.rect(x - 1, gy - 18, 15, 2, (px, py, i, j) => tone(WOOD, j ? 3 : 1, px, py));
  if (!lived) return;
  for (const [nx, ny, c] of [[x + 2, gy - 14, '#fff7f0'], [x + 6, gy - 13, '#f6e7b4'], [x + 9, gy - 14, '#fff7f0'], [x + 3, gy - 10, '#f8d8e4']]) {
    p.rect(nx, ny, 3, 4, c); p.rect(nx + 1, ny + 1, 1, 1, '#9a8a8a'); p.set(nx + 1, ny, '#d9454a');
  }
}
// a flagpole with a pennant (thin, so drawn after the outline: call it last)
export function flagpole(p, x, top, gy, col = '#d9454a') {
  const R = ramp(col);
  for (let y = top; y <= gy; y++) p.front(x, y, y === top ? '#f4cf4f' : y > gy - 2 ? '#4b4858' : '#6e4a2a');
  for (let i = 0; i < 7; i++) for (let j = 0; j < 4 - Math.floor(i / 2.5); j++) p.front(x + 1 + i, top + 1 + j + Math.floor(i / 3), tone(R, 1.3 + j * 0.5 + (i > 4 ? 0.5 : 0), i, j));
}

// a little painted window in a gable: round, a heart or four square panes
function gableWindow(p, cx, cy, kind, lived, frame) {
  if (kind === 'round') return roundWindow(p, cx, cy, 2.6, { lived, frame });
  if (kind === 'heart') {
    p.stamp(Math.round(cx - 3.5), Math.round(cy - 3), ['.kk.kk.', 'kyykyyk', 'kyyyyyk', '.kyyyk.', '..kyk..', '...k...'], { k: frame[3], y: lived ? '#ffe28a' : '#4f4e64' });
    return;
  }
  windowBox(p, Math.round(cx - 2.5), Math.round(cy - 2.5), 5, 5, { lived, frame });
}

// a pot of flowers by a door
function pot(p, x, gy, cols, seed) {
  const r = seeded(seed);
  p.rect(x, gy - 3, 5, 3, (px, py, i, j) => tone(ramp('#c9764a'), j === 0 ? 1 : 2 + (i > 2 ? 0.8 : 0), px, py));
  for (let i = 0; i < 5; i++) { const h = 1 + Math.floor(r() * 3); for (let k = 1; k <= h; k++) p.set(x + i, gy - 3 - k, LEAF[1 + Math.min(2, k - 1)]); if (r() < 0.6) p.set(x + i, gy - 4 - h, cols[Math.floor(r() * cols.length)]); }
}

// ---------- the buildings ----------

export const BUILDING_ART = {
  // The guild while the village is small (P 0-9): a log cabin under a blue roof, its sign on the roof,
  // a notice board of jobs on the left and the guild's pennant on a pole on the right.
  guild: { up: 8, draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = gy - 22, x0 = 16, x1 = W - 17, mk = maker(lived), roof = mk(h.roof);
    logWall(p, x0, x1, wallTop, gy - 3, LOG.brown, { seed: 101 });
    stones(p, [x0 - 1, gy - 2, x1 + 1, gy], null, STONE, (x) => (x - x0) / (x1 - x0) * 0.8 - 0.1, { ch: 3, wmin: 4, wmax: 7, seed: 102 });
    hipRoof(p, x0 - 5, x1 + 5, wallTop - 17, wallTop + 2, 9, roof, { seed: 103 });
    signboard(p, W / 2, wallTop - 12, h.sign, lived);
    doorway(p, W / 2, gy, 10, 15, { boarded: !lived, frame: WOOD });
    windowBox(p, x0 + 5, wallTop + 5, 7, 6, { lived, frame: WOOD });
    windowBox(p, x1 - 11, wallTop + 5, 7, 6, { lived, frame: WOOD });
    lantern(p, W / 2 + 7, gy - 16, lived);
    noticeBoard(p, 1, gy, lived);
    p.outline();
    flagpole(p, W - 7, gy - 44, gy);
    tufts(p, 0, W - 1, gy, 104);
  } },

  // The guild once the village has grown a little (P 10-19): a long log hall, a bell in a little
  // tower on its ridge, a double door between lanterns, four windows with flower boxes.
  guild1: { up: 26, draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = gy - 27, x0 = 5, x1 = W - 6, mk = maker(lived), roof = mk(h.roof), cx = W / 2;
    // the bell tower, behind the roof: boards, an arched opening with the bell, a pointed cap, the flag
    const bx0 = cx - 6, bx1 = cx + 5, bTop = 15;
    planks(p, [bx0, bTop, bx1, wallTop - 20], null, LOG.honey, (x) => (x - bx0) / 11 * 1.1 - 0.4, { pw: 3, seed: 105 });
    p.fill(bx0 + 3, bTop + 3, bx1 - 3, bTop + 11, (x, y) => y > bTop + 5 || Math.hypot(x + 0.5 - cx, y + 0.5 - (bTop + 6)) <= 3.2, '#3a2a3a');
    if (lived) { p.ell(cx, bTop + 9, 2.6, 2.6, (x, y, nx, ny) => tone(ramp('#f4cf4f'), 1.6 + nx * 0.9 + ny * 0.4, x, y), (x, y) => y <= bTop + 10); p.set(cx - 0.5, bTop + 11, '#c99a2b'); }
    shingles(p, [bx0 - 2, 3, bx1 + 2, bTop], inP([[bx0 - 2, bTop + 1], [cx, 3], [bx1 + 3, bTop + 1]]), roof, (x) => (x < cx ? -0.5 : 0.8), { sw: 4, rh: 3, seed: 106 });
    p.rect(bx0 - 2, bTop, bx1 - bx0 + 5, 1, roof[4]);
    // the hall
    logWall(p, x0, x1, wallTop, gy - 4, LOG.brown, { seed: 107 });
    stones(p, [x0 - 1, gy - 3, x1 + 1, gy], null, STONE, (x) => (x - x0) / (x1 - x0) * 0.8 - 0.1, { ch: 4, wmin: 4, wmax: 8, seed: 108 });
    hipRoof(p, 0, W - 1, wallTop - 24, wallTop + 2, 14, roof, { seed: 109 });
    signboard(p, cx, wallTop - 13, h.sign, lived);
    doorway(p, cx, gy, 14, 19, { arch: true, pw: 3, boarded: !lived, frame: WOOD });
    p.rect(cx - 0.5, gy - 16, 1, 16, WOOD[4]);
    lantern(p, cx - 11, gy - 19, lived); lantern(p, cx + 9, gy - 19, lived);
    for (const [x, box] of [[10, ['#f29bb2', '#fff7f0', '#f4cf4f']], [23, null], [W - 30, null], [W - 17, ['#e0646e', '#f4cf4f', '#9fc2ff']]]) windowBox(p, x, wallTop + 6, 7, 7, { lived, frame: WOOD, box: lived ? box : null });
    p.outline();
    for (let y = 0; y < 4; y++) p.front(cx - 0.5, y, '#3d3a48');
    p.front(cx + 0.5, 0, lived ? '#f06a6a' : '#a3a2ad'); for (let i = 1; i < 6; i++) for (let j = 0; j < 3 - (i > 3 ? 1 : 0); j++) p.front(cx + i - 0.5, j, lived ? (j ? '#d9454a' : '#f06a6a') : '#8a8794');
    tufts(p, 0, W - 1, gy, 110);
  } },

  // The shop while the village is small (P 0-9): a plank kiosk under a red gable, a striped awning
  // over its counter, jars on the shelves and fruit on the counter, crates and a sack outside.
  shop: { up: 6, draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = gy - 26, x0 = 20, x1 = W - 21, cx = W / 2, mk = maker(lived), roof = mk(h.roof);
    const g = gable(cx, wallTop - 22, wallTop + 2, 25, 8);
    gableFace(p, x0 + 2, x1 - 2, g, wallTop, ramp('#b98a56'), { seed: 111 });
    planks(p, [x0, wallTop, x1, gy], null, PINE, wallLit(x0, x1, wallTop, gy), { pw: 4, seed: 112 });
    gableRoof(p, g, roof, { seed: 113 });
    signboard(p, cx, wallTop - 11, h.sign, lived);
    // the counter's opening: shelves of jars in the dark behind it
    const oy0 = wallTop + 6, oy1 = gy - 10;
    p.rect(x0 + 4, oy0, x1 - x0 - 7, oy1 - oy0 + 1, (x, y, i, j) => (j < 2 ? '#2e2232' : '#3d2c34'));
    if (lived) for (const sy of [oy0 + 4, oy0 + 8]) {
      p.rect(x0 + 4, sy, x1 - x0 - 7, 1, WOOD[3]);
      for (let x = x0 + 6, k = 0; x < x1 - 4; x += 4, k++) { const c = ['#e0646e', '#f4cf4f', '#7cc0dc', '#9be07a', '#f29bb2'][(k + sy) % 5]; p.rect(x, sy - 3, 2, 3, c); p.set(x, sy - 3, '#fff7f0'); }
    }
    // the counter board, then what is on it
    p.rect(x0 - 2, oy1 + 1, x1 - x0 + 5, 2, (x, y, i, j) => tone(PINE, j ? 3 : 0.6, x, y));
    if (lived) {
      for (const [ax, ay] of [[x0 + 5, 0], [x0 + 7, 0], [x0 + 6, -1]]) { p.rect(ax, oy1 - 1 + ay, 2, 2, '#d9454a'); p.set(ax, oy1 - 1 + ay, '#f06a6a'); }
      p.rect(cx - 2, oy1 - 1, 5, 2, '#d9944a'); p.rect(cx - 1, oy1 - 2, 3, 1, '#e8b070'); p.set(cx, oy1 - 1, '#f6dca6');
      p.rect(x1 - 9, oy1 - 3, 3, 4, '#f4cf4f'); p.rect(x1 - 9, oy1 - 4, 3, 1, '#a0703f'); p.set(x1 - 9, oy1 - 2, '#fff3b0');
    } else for (let k = 0; k < 2; k++) p.line(x0 + 3, oy0 + 1 + k * 6, x1 - 3, oy0 + 4 + k * 6, '#c9a878');
    if (lived) awning(p, x0 - 2, x1 + 2, wallTop + 2, 4, ['#d9454a', '#fff3e6'], { shade: true });
    // outside: crates stacked on the left, a sack, a barrel of apples on the right
    crate(p, 3, gy, 9, 7); crate(p, 5, gy - 7, 8, 6); sack(p, 11, gy);
    barrel(p, W - 14, gy, 9, lived ? '#d9454a' : null); crate(p, W - 7, gy, 7, 5);
    p.outline();
    tufts(p, 0, W - 1, gy, 114);
  } },

  // The shop once the village has grown (P 10 on): a proper store in red-brown boards under a wide
  // gable, big windows full of goods, a striped awning across the front, the sign in the gable.
  shop1: { up: 12, draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = gy - 30, x0 = 4, x1 = W - 5, cx = W / 2, mk = maker(lived), roof = mk(h.roof);
    const boards = mk('#b8703e'), trim = ramp('#f1e4c8');
    const g = gable(cx, 6, wallTop + 2, W / 2, 9);
    if (lived) chimney(p, x1 - 16, 8, 30, 6);
    gableFace(p, x0 + 6, x1 - 6, g, wallTop, mk('#c98a52'), { seed: 115 });
    clapboard(p, [x0, wallTop, x1, gy - 3], null, boards, wallLit(x0, x1, wallTop, gy), { bh: 3, seed: 116 });
    for (const x of [x0, x1 - 1]) p.rect(x, wallTop, 2, gy - wallTop - 2, (px, py) => tone(trim, x > cx ? 2.6 : 1.2, px, py));
    stones(p, [x0 - 1, gy - 2, x1 + 1, gy], null, STONE, (x) => (x - x0) / (x1 - x0) * 0.8 - 0.1, { ch: 3, wmin: 4, wmax: 8, seed: 117 });
    gableRoof(p, g, roof, { seed: 118, sw: 6 });
    // up in the gable: a round window and the sign
    roundWindow(p, cx, wallTop - 20, 2.6, { lived, frame: WOOD });
    signboard(p, cx, wallTop - 13, h.sign, lived);
    // the shop windows, goods behind the glass, the door between them
    for (const wx of [x0 + 5, x1 - 21]) {
      windowBox(p, wx, wallTop + 9, 17, 10, { lived, frame: trim });
      if (lived) for (let k = 0; k < 4; k++) { const gx = wx + 1 + k * 4, c = ['#e0646e', '#9be07a', '#f4cf4f', '#7aa4ff'][(k + wx) % 4]; p.rect(gx, wallTop + 15, 3, 4, c); p.rect(gx, wallTop + 15, 3, 1, mixc(c, '#ffffff', 0.4)); }
    }
    doorway(p, cx, gy, 11, 18, { boarded: !lived, frame: trim, wood: ramp('#5d8a5a') });
    p.rect(cx - 3, gy - 14, 5, 4, (x, y, i, j) => (lived ? GLASS[1 + (j > 1 ? 1 : 0)] : '#4f4e64'));
    if (lived) awning(p, x0 - 1, x1 + 1, wallTop + 2, 4, ['#d9454a', '#fff3e6'], { shade: true, sw: 5 });
    // goods outside: a barrel of apples, crates of cabbages, a sack, a broom by the door
    barrel(p, 0, gy, 9, lived ? '#d9454a' : null);
    crate(p, W - 11, gy, 10, 7);
    if (lived) for (let k = 0; k < 3; k++) { p.ell(W - 8 + k * 3, gy - 8, 1.6, 1.4, '#7cc45a'); p.set(W - 8 + k * 3, gy - 9, '#b4e48a'); }
    sack(p, W - 20, gy, '#d8c49c');
    p.outline();
    tufts(p, 0, W - 1, gy, 119);
  } },

  // The carpenter's workshop (the beaver moves in once you have a house): a cabin of fresh honey logs
  // with a wide barn door, the saw on its sign, a stone chimney, and an open shed beside it stacked
  // with planks, a log waiting on the sawhorse.
  carpenter: { up: 16, smoke: [12, 33], draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = gy - 22, x0 = 4, x1 = 56, mk = maker(lived), roof = mk(h.roof), cx = (x0 + x1 + 1) / 2;
    const g = gable(cx, wallTop - 30, wallTop + 2, 31, 9);
    chimney(p, 9, wallTop - 26, wallTop - 8, 7);
    // the shed: dark inside, planks stacked on end and lying in a pile, two posts, a sloping roof of boards
    const sx0 = 58, sx1 = W - 2;
    p.rect(sx0, wallTop - 4, sx1 - sx0, gy - wallTop + 3, (x, y, i, j) => tone(LOG.dark, 3.8 + (j < 4 ? 0.7 : 0), x, y));
    for (let k = 0; k < 5; k++) planks(p, [sx0 + 3 + k * 3, wallTop - 1 + (k % 2), sx0 + 4 + k * 3, gy - 12], null, PINE, () => (k % 2) * 0.5 - 0.2, { pw: 2, seed: 128 + k });
    for (let k = 0; k < 3; k++) {
      planks(p, [sx0 + 1, gy - 4 - k * 3, sx1 - 2, gy - 2 - k * 3], null, PINE, (x) => (x - sx0) / 20 * 0.9 - 0.5 + (k & 1) * 0.3, { pw: 3, vert: false, seed: 120 + k });
      for (let e = sx1 - 4; e <= sx1 - 2; e += 2) p.set(e, gy - 3 - k * 3, '#f6dca6');
    }
    for (const px of [sx0, sx1 - 1]) planks(p, [px, wallTop - 6, px + 1, gy], null, LOG.honey, () => (px > 60 ? 0.9 : 0), { pw: 2 });
    planks(p, [sx0 - 2, wallTop - 13, sx1 + 1, wallTop - 4], (x, y) => y >= wallTop - 13 + (x - sx0 + 2) * 0.3 && y <= wallTop - 9 + (x - sx0 + 2) * 0.3, PINE, (x) => (x - sx0) / 22 * 0.9 - 0.2, { pw: 4, seed: 127 });
    // the cabin
    gableFace(p, x0 + 3, x1 - 3, g, wallTop, LOG.honey, { seed: 121 });
    logWall(p, x0, x1, wallTop, gy - 3, LOG.honey, { seed: 122 });
    stones(p, [x0 - 1, gy - 2, x1 + 1, gy], null, STONE, (x) => (x - x0) / (x1 - x0) * 0.8 - 0.1, { ch: 3, wmin: 4, wmax: 7, seed: 123 });
    gableRoof(p, g, roof, { seed: 124, sw: 6 });
    signboard(p, cx, wallTop - 14, h.sign, lived);
    roundWindow(p, cx, wallTop - 22, 2.4, { lived, frame: WOOD });
    // a wide barn door with a brace (the house's door tile is under it) and a window
    const dx0 = W / 2 - 7, dx1 = W / 2 + 6;
    p.rect(dx0 - 1, gy - 18, dx1 - dx0 + 3, 19, (x, y, i, j) => tone(WOOD, i === 0 || j === 0 ? 1.6 : 3.2, x, y));
    planks(p, [dx0, gy - 17, dx1, gy], null, WOOD_WARM, (x, y) => (y - gy + 17) / 18 * 0.6, { pw: 3, seed: 125 });
    p.line(dx0, gy - 1, dx1, gy - 16, WOOD_WARM[4]); p.rect(dx0, gy - 9, dx1 - dx0 + 1, 1, WOOD_WARM[4]);
    p.set(dx1 - 1, gy - 9, '#f4cf4f');
    windowBox(p, x0 + 6, wallTop + 5, 8, 7, { lived, frame: WOOD, box: lived ? ['#f4cf4f', '#fff7f0', '#e0646e'] : null });
    // in front of the shed: a sawhorse with a log on it, shavings on the grass
    p.outline();
    for (const [fx, fy] of [[60, gy], [64, gy - 1], [70, gy], [73, gy - 1], [67, gy]]) p.front(fx, fy, '#f6dca6');
    tufts(p, 0, W - 1, gy, 127, { gap: 0.5 });
  } },

  // The bakery (P 7): cream boards under a chocolate roof, a brick oven bulging out of its side with
  // the fire glowing in its mouth, loaves in the window under a striped awning, flour sacks outside.
  bakery: { up: 16, smoke: [11, 41], draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = gy - 24, x0 = 20, x1 = W - 5, roof = ramp(h.roof), cream = ramp('#f1dcb0'), trim = ramp('#7a4a3a');
    clapboard(p, [x0, wallTop, x1, gy - 3], null, cream, wallLit(x0, x1, wallTop, gy), { bh: 3, seed: 131 });
    for (const x of [x0, x1 - 1]) p.rect(x, wallTop, 2, gy - wallTop - 2, (px, py) => tone(trim, x > 40 ? 3 : 1.6, px, py));
    stones(p, [x0 - 1, gy - 2, x1 + 1, gy], null, STONE, (x) => (x - x0) / (x1 - x0) * 0.8 - 0.1, { ch: 3, wmin: 4, wmax: 7, seed: 133 });
    hipRoof(p, x0 - 4, W - 1, wallTop - 20, wallTop + 2, 10, roof, { seed: 132 });
    signboard(p, 48, wallTop - 12, h.sign, lived);
    // the shop window full of loaves under an awning, a little window by the door
    windowBox(p, 53, wallTop + 9, 15, 8, { frame: trim });
    for (let k = 0; k < 4; k++) { const lx = 55 + k * 4; p.ell(lx, wallTop + 14, 1.9, 1.3, (x, y, nx, ny) => tone(ramp('#d9944a'), 1.6 + nx * 0.6 + ny * 0.9, x, y)); p.set(lx - 1, wallTop + 13, '#f6dca6'); }
    awning(p, 50, x1 + 1, wallTop + 3, 4, ['#f29bb2', '#fff3e6'], { shade: true });
    windowBox(p, 24, wallTop + 7, 6, 7, { frame: trim, box: ['#f4cf4f', '#fff7f0', '#e0646e'] });
    doorway(p, W / 2, gy, 10, 16, { arch: true, frame: trim, wood: ramp('#c9764a') });
    // the oven: a dome of bricks with its own chimney, the fire in its mouth
    const BRICK = ramp('#c0684a'), ocx = 11, ocy = gy - 2;
    p.rect(8, gy - 36, 7, 22, (x, y, i, j) => { const row = Math.floor(j / 3); let v = 2 + i / 6 * 1.1 - 0.4; if (j % 3 === 2 || (i + (row & 1) * 2) % 4 === 0) v += 1.3; if (j < 5 && hash(x, y, 134) < 0.5 - j * 0.08) v += 1.2; return tone(BRICK, v, x, y); });
    p.rect(7, gy - 38, 9, 2, (x, y, i, j) => tone(STONE, j ? 3 : 0.8, x, y));
    p.ell(ocx, ocy, 11, 15, (x, y, nx, ny) => {
      const row = Math.floor((y - ocy + 15) / 3), off = (row & 1) * 2;
      let v = 2 + nx * 1.1 + ny * 0.3 - 0.2;
      if ((y - ocy + 15) % 3 === 2 || (x + off) % 5 === 0) v += 1.2;
      return tone(BRICK, v, x, y);
    }, (x, y) => y <= gy);
    p.ell(ocx, gy, 5, 7, (x, y, nx, ny) => {
      if (ny > -0.2) return ['#fff3b0', '#ffd25a', '#f59a3a', '#ffd25a'][Math.floor(hash(x, y, 135) * 4)];
      return ['#d9542e', '#9a3a2a', '#5a2424'][Math.max(0, Math.min(2, Math.floor((-0.2 - ny) * 3)))];
    }, (x, y) => y <= gy - 1);
    if (!lived) p.ell(ocx, gy, 5, 7, '#2e2c3e', (x, y) => y <= gy - 1);
    p.ell(ocx, gy, 6.4, 8.4, (x, y, nx, ny) => (Math.hypot(nx, ny) > 0.82 ? tone(STONE, nx < 0 ? 1 : 2.6, x, y) : p.get(x, y)), (x, y) => y <= gy);
    // flour sacks and a basket of rolls
    sack(p, W - 10, gy, '#d8c49c');
    p.rect(x0 + 2, gy - 4, 8, 4, (x, y, i, j) => tone(ramp('#c9965a'), (i + j) % 2 ? 1.4 : 2.6, x, y));
    for (let k = 0; k < 3; k++) { p.ell(x0 + 3.5 + k * 2.5, gy - 5, 1.6, 1.2, '#d9944a'); p.set(x0 + 3 + k * 2.5, gy - 6, '#f6dca6'); }
    p.outline();
    tufts(p, 0, W - 1, gy, 136);
  } },

  // The windmill (P 9) that grinds the bakery's flour: a tower of white boards tapering up to a brown
  // hood, a gallery round its middle, sacks of flour at its foot. Its sails turn over the hood (a
  // picture of their own: village-growth-art.js SAILS_AT is where their middle is).
  windmill: { up: 8, draw(p, W, H, lived, h) {
    const gy = H - 1, cx = W / 2, hub = H - 40, boards = ramp('#efe2c4'), cap = ramp('#8a5a3a');
    const half = y => 8 + (y - hub) / (gy - 4 - hub) * 9;
    planks(p, [cx - 18, hub, cx + 18, gy - 4], (x, y) => Math.abs(x + 0.5 - cx) <= half(y), boards, (x, y) => ((x + 0.5 - cx) / half(y)) * 1.2 - 0.15, { pw: 3, seed: 141 });
    stones(p, [cx - 19, gy - 4, cx + 18, gy], null, STONE, (x) => (x - cx + 19) / 37 * 0.9 - 0.2, { ch: 3, wmin: 4, wmax: 7, seed: 142 });
    // the hood
    shingles(p, [cx - 13, hub - 13, cx + 13, hub + 3], (x, y) => ((x + 0.5 - cx) / 12.5) ** 2 + ((y + 0.5 - hub - 3) / 15) ** 2 <= 1 && y <= hub + 3, cap, domeLit(cx - 5, hub - 8, 12.5, 15, 1.5), { sw: 4, rh: 3, seed: 143 });
    p.rect(cx - 12, hub + 3, 24, 2, (x, y, i, j) => tone(cap, j ? 4.5 : 3.5, x, y));
    // a little window, the gallery, the door
    windowBox(p, cx - 2, hub + 9, 4, 5, { lived, frame: WOOD });
    const gl = gy - 15;
    p.rect(cx - 21, gl, 42, 2, (x, y, i, j) => tone(PINE, j ? 3.2 : 1.2 + i / 41, x, y));
    for (let x = cx - 21; x <= cx + 20; x += 4) p.rect(x, gl - 5, 1, 5, PINE[x > cx ? 3 : 2]);
    p.rect(cx - 21, gl - 6, 42, 1, (x, y, i) => tone(PINE, 1 + i / 41 * 1.5, x, y));
    doorway(p, cx, gy, 8, 11, { arch: true, boarded: !lived, frame: WOOD });
    sack(p, 1, gy, '#d8c49c'); sack(p, W - 10, gy, '#d8c49c'); sack(p, W - 16, gy, '#cbb48a');
    p.outline();
    tufts(p, 0, W - 1, gy, 144);
  } },

  // The inn (P 21) for travellers from the far fields: a big chalet, dark logs below and honey boards
  // up in its wide gable, a balcony across the front heavy with red flowers, the moon on its sign.
  inn: { up: 30, smoke: [64, 30], draw(p, W, H, lived, h) {
    const gy = H - 1, floor1 = gy - 22, cx = W / 2, x0 = 4, x1 = W - 5, roof = ramp(h.roof), trim = ramp('#f1e4c8');
    const g = gable(cx, 6, floor1 - 1, W / 2, 10);
    chimney(p, 61, 30, 52, 7);
    gableFace(p, x0 + 2, x1 - 2, g, floor1, LOG.honey, { pw: 4, seed: 151 });
    logWall(p, x0, x1, floor1, gy - 4, LOG.dark, { seed: 152 });
    stones(p, [x0 - 1, gy - 3, x1 + 1, gy], null, STONE, (x) => (x - x0) / (x1 - x0) * 0.8 - 0.1, { ch: 4, wmin: 4, wmax: 8, seed: 153 });
    gableRoof(p, g, roof, { seed: 154, sw: 6 });
    // up in the gable: a round window, the sign, two windows with shutters
    roundWindow(p, cx, g.top + 17, 2.6, { lived, frame: WOOD });
    signboard(p, cx, floor1 - 21, h.sign, lived);
    for (const wx of [17, W - 24]) windowBox(p, wx, floor1 - 20, 7, 8, { lived, frame: WOOD, shutters: ramp('#c0563a'), curtain: ['#fff7f0', '#e8dcd0'] });
    // the balcony: a plank floor, a railing of cut boards, boxes of red flowers
    p.rect(x0 + 1, floor1 - 2, x1 - x0 - 1, 3, (x, y, i, j) => tone(WOOD, j === 0 ? 1.2 : j === 1 ? 2.4 : 4, x, y));
    p.rect(x0 + 2, floor1 - 9, x1 - x0 - 3, 7, (x, y, i, j) => { const k = (x - x0) % 4; return k === 3 ? tone(LOG.dark, 4.2, x, y) : tone(PINE, 1.4 + (k === 2 ? 0.8 : 0) + i / (x1 - x0) * 0.8 + (j === 6 ? 0.8 : 0), x, y); });
    p.rect(x0 + 1, floor1 - 10, x1 - x0 - 1, 2, (x, y, i, j) => tone(PINE, j ? 2.6 : 0.8, x, y));
    for (const bx of [x0 + 4, cx - 8, x1 - 19]) flowerBox(p, bx, floor1 - 13, 16, ['#e0646e', '#d9454a', '#f8b4cc', '#fff7f0'], bx);
    // the ground floor: the arched double door between lanterns, windows with flower boxes
    doorway(p, cx, gy, 13, 17, { arch: true, pw: 3, boarded: !lived, frame: WOOD });
    p.rect(cx - 0.5, gy - 14, 1, 14, WOOD[4]);
    lantern(p, cx - 11, gy - 18, lived); lantern(p, cx + 9, gy - 18, lived);
    for (const [wx, box] of [[11, ['#f4cf4f', '#fff7f0']], [W - 19, ['#9fc2ff', '#fff7f0']]]) windowBox(p, wx, floor1 + 5, 8, 7, { lived, frame: WOOD, box });
    // a traveller's bag by the door
    p.rect(cx + 11, gy - 5, 6, 5, (x, y, i, j) => tone(ramp('#8a5a7a'), j === 0 ? 1 : 2 + (i > 3 ? 0.7 : 0), x, y));
    p.rect(cx + 12, gy - 7, 4, 2, (x, y, i, j) => (j === 0 || i === 0 || i === 3 ? '#5a3a4a' : null));
    p.outline();
    tufts(p, 0, W - 1, gy, 155);
  } },

  // The gazebo by the pond (P 18): a wooden deck raised a step off the grass, white posts and a
  // railing, an eight-sided roof of green shingles with a gold ball on top, a lantern hanging inside.
  gazebo: { up: 14, draw(p, W, H, lived, h) {
    const gy = H - 1, cx = W / 2, roof = ramp('#4fae8a'), white = ramp('#f4ead8'), eave = 23, dy = gy - 9;
    // the back posts, in the shade under the roof
    for (const x of [10, W - 12]) p.rect(x, eave, 2, dy - eave - 2, (px, py, i) => tone(white, 3.2 + i * 0.4, px, py));
    // the deck: its floor, then its front edge and two steps
    const edge = x => dy + 4 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / 22) ** 2));
    planks(p, [2, dy - 5, W - 3, gy], (x, y) => ((x + 0.5 - cx) / 22) ** 2 + ((y + 0.5 - dy) / 5) ** 2 <= 1, PINE, (x) => (x - 2) / 44 * 0.8 - 0.2, { pw: 3, vert: false, seed: 161 });
    p.fill(2, dy, W - 3, gy, (x, y) => Math.abs(x + 0.5 - cx) <= 22 && y >= edge(x) && y < edge(x) + 4, (x, y) => tone(WOOD, 2 + (x - 2) / 44 * 0.9 - 0.3 + (y >= gy - 1 ? 0.6 : 0), x, y));
    for (let k = 0; k < 2; k++) p.rect(cx - 6 + k, gy - 3 + k * 2, 12 - k * 2, 2, (x, y, i, j) => tone(STONE, j === 0 ? 1 : 2.8, x, y));
    // the front posts and the railing between them, open in the middle
    const posts = [4, 15, W - 17, W - 6];
    for (const x of posts) p.rect(x, eave, 2, Math.round(edge(x)) - eave, (px, py, i) => tone(white, 1.2 + i * 0.9, px, py));
    for (const [a, b] of [[posts[0] + 2, posts[1] - 1], [posts[2] + 2, posts[3] - 1]]) {
      for (let x = a; x <= b; x++) { const top = Math.round(edge(x)) - 8; p.set(x, top, white[1]); if (x % 2 === 0) for (let y = top + 1; y < Math.round(edge(x)); y++) p.set(x, y, white[2]); }
    }
    // the lantern hanging from the middle of the roof
    for (let y = eave; y < eave + 5; y++) p.set(cx - 0.5, y, '#4b4858');
    lantern(p, cx - 1.5, eave + 4, lived);
    // the roof: eight sides seen from the front (ridges where they meet), a scalloped edge, a gold ball
    const top = 4, R = [[0, eave], [cx, top], [W, eave]];
    shingles(p, [0, top, W - 1, eave], inP(R), roof, (x) => { const u = (x + 0.5 - cx) / cx; return u < -0.45 ? -0.7 : u > 0.45 ? 1.0 : u * 0.6; }, { sw: 4, rh: 3, seed: 162 });
    for (const u of [-0.45, 0.45]) p.line(cx + u * 3, top + 2, cx + u * cx, eave, (k) => roof[u < 0 ? 1 : 4]);
    for (let x = 0; x < W; x++) { const lx = x % 4; p.set(x, eave + 1, tone(roof, 3.4 + (x / W), x, eave + 1)); if (lx === 1 || lx === 2) p.set(x, eave + 2, roof[4]); }
    p.ell(cx, top - 1, 2.4, 2.4, (x, y, nx, ny) => (nx + ny < -0.4 ? '#fff3b0' : nx + ny < 0.5 ? '#f4cf4f' : '#c99a2b'));
    p.outline();
    tufts(p, 0, W - 1, gy, 163, { gap: 0.5 });
  } },

  // The greenhouse (P 22) where strawberries ripen even in winter: a wooden frame of glass panes on a
  // brick footing, rows of plants and red berries seen through the glass, the sky shining on the roof.
  greenhouse: { up: 14, draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = gy - 25, x0 = 3, x1 = W - 4, cx = W / 2, top = wallTop - 18, frame = ramp('#f4ead8');
    const BRICK = ramp('#b8644a'), inside = [];
    // inside first: the dim green room, tables of pots, leaves and berries, vines hanging from the roof
    const roofP = [[x0 - 2, wallTop + 1], [x0 + 11, top], [x1 - 10, top], [x1 + 3, wallTop + 1]];
    p.fill(x0, top, x1, gy - 5, (x, y) => y >= wallTop || inP(roofP)(x, y), (x, y) => tone(ramp('#3f7a64'), 2.6 + (y - top) / (gy - top) * 1.4, x, y));
    const r = seeded(164);
    for (const ty of [gy - 12]) {
      p.rect(x0 + 2, ty, x1 - x0 - 3, 2, (x, y, i, j) => tone(WOOD_WARM, j ? 3 : 1.4, x, y));
      for (let x = x0 + 3; x < x1 - 3; x += 5) { p.rect(x, ty - 3, 3, 3, '#c9764a'); for (let k = 0; k < 7; k++) { const lx = x - 1 + Math.floor(r() * 5), ly = ty - 4 - Math.floor(r() * 6); p.set(lx, ly, LEAF[Math.floor(r() * 3)]); } }
    }
    for (let k = 0; k < 18; k++) { const bx = x0 + 3 + Math.floor(r() * (x1 - x0 - 6)), by = gy - 21 + Math.floor(r() * 7); p.set(bx, by, '#e0464a'); p.set(bx, by - 1, '#7cc45a'); }
    for (let x = x0 + 6; x < x1 - 6; x += 7) for (let y = wallTop - 2, n = 3 + Math.floor(r() * 6); n > 0; y++, n--) p.set(x + ((y >> 1) & 1), y, LEAF[1 + (n & 1)]);
    // the glass over it all: tinted, brighter on the roof, a streak of light across each pane
    const glassAt = (x, y) => p.get(x, y);
    p.fill(x0, top, x1, gy - 5, (x, y) => !!glassAt(x, y), (x, y) => {
      const roofy = y < wallTop, c = glassAt(x, y);
      const streak = ((x - y * (roofy ? 0.6 : 1.4)) % 13 + 13) % 13;
      if (streak < 1.5) return roofy ? GLASS[0] : GLASS[1];
      return mixc(c, roofy ? '#d8f0ff' : '#b8e4f4', roofy ? 0.62 : 0.3);
    });
    // the frame: posts and bars, the roof's rafters, a bar along the ridge and the eaves
    for (let x = x0; x <= x1; x += 9) p.rect(Math.min(x, x1 - 1), wallTop, 2, gy - 4 - wallTop, (px, py, i) => tone(frame, 1.2 + i, px, py));
    p.rect(x0, wallTop + 10, x1 - x0 + 1, 1, frame[2]);
    for (let k = 0; k <= 8; k++) { const xb = x0 + (x1 - x0) * k / 8, xt = x0 + 11 + (x1 - 10 - x0 - 11) * k / 8; p.line(xt, top, xb, wallTop, frame[k < 4 ? 1 : 3]); }
    p.rect(x0 + 10, top, x1 - x0 - 19, 2, (x, y, i, j) => tone(frame, j ? 2.6 : 0.8, x, y));
    p.rect(x0 - 2, wallTop, x1 - x0 + 5, 2, (x, y, i, j) => tone(frame, j ? 3 : 1.2, x, y));
    // the brick footing, the glass door
    p.rect(x0 - 1, gy - 4, x1 - x0 + 3, 5, (x, y, i, j) => { let v = 2 + i / (x1 - x0) * 0.9 - 0.3; if (j === 0) v -= 0.9; if (j % 2 === 1 || (i + (j >> 1) * 2) % 5 === 0) v += 1.2; return tone(BRICK, v, x, y); });
    p.rect(cx - 6, gy - 20, 12, 21, (x, y, i, j) => (i < 2 || i > 9 || j < 2 ? tone(frame, i > 9 ? 3 : 1.2, x, y) : null));
    p.rect(cx - 4, gy - 18, 8, 19, (x, y, i, j) => mixc('#3f7a64', '#b8e4f4', 0.35 + (i + j) % 9 === 0 ? 0.3 : 0.35));
    p.set(cx + 2, gy - 9, '#f4cf4f');
    // pots of seedlings and a watering can by the door
    for (const px of [cx - 15, cx + 11]) { p.rect(px, gy - 3, 4, 3, '#c9764a'); p.set(px + 1, gy - 4, '#7cc45a'); p.set(px + 2, gy - 5, '#5aad58'); p.set(px + 2, gy - 4, '#7cc45a'); }
    p.rect(W - 11, gy - 5, 6, 5, (x, y, i, j) => tone(ramp('#7a9ab8'), 1.6 + i * 0.3, x, y)); p.line(W - 5, gy - 4, W - 2, gy - 7, '#5a7a98'); p.rect(W - 10, gy - 7, 4, 1, '#5a7a98');
    p.outline();
    tufts(p, 0, W - 1, gy, 165);
  } },

  // The lookout tower (P 25) on the hill: four log legs braced crosswise, a ladder up the middle, a
  // railed platform under a little red roof, a spyglass pointing out over the fields.
  tower: { up: 58, draw(p, W, H, lived, h) {
    const gy = H - 1, cx = W / 2, plat = 44, roof = ramp('#d9573a');
    const leg = (xb, xt, yb, yt, R, k) => { for (let y = yt; y <= yb; y++) { const t = (y - yt) / (yb - yt), x = Math.round(xt + (xb - xt) * t); for (let i = 0; i < 3; i++) p.set(x + i, y, tone(R, 1.4 + i * 0.8 + k + ((y + i) % 5 === 0 ? 0.6 : 0), x + i, y)); } };
    // back legs in the shade, then the bracing, the front legs, the ladder
    leg(15, 17, gy - 8, plat, LOG.brown, 1.2); leg(W - 18, W - 20, gy - 8, plat, LOG.brown, 1.2);
    for (const [ya, yb] of [[plat + 6, plat + 28], [plat + 28, gy - 6]]) {
      const xa = t => Math.round(11 - (ya + (yb - ya) * t - plat) / (gy - plat) * 5) + 3;
      p.line(xa(0), ya, W - xa(1) - 1, yb, (k) => LOG.dark[2]); p.line(W - xa(0) - 1, ya, xa(1), yb, (k) => LOG.dark[3]);
    }
    leg(5, 10, gy, plat, LOG.honey, 0); leg(W - 8, W - 13, gy, plat, LOG.honey, 0);
    for (const x of [cx - 4, cx + 3]) p.rect(x, plat + 2, 1, gy - plat - 2, PINE[x < cx ? 2 : 3]);
    for (let y = plat + 5; y < gy; y += 4) p.rect(cx - 3, y, 6, 1, PINE[1]);
    for (const x of [4, W - 9]) p.rect(x, gy - 1, 6, 2, (px, py, i, j) => tone(STONE, j ? 3 : 1, px, py));
    // the platform: its floor's edge, the railing, the corner posts holding up the roof
    p.rect(2, plat - 2, W - 4, 4, (x, y, i, j) => tone(PINE, j === 0 ? 0.8 : j === 3 ? 3.6 : 2 + i / W, x, y));
    for (const x of [3, W - 5]) p.rect(x, 17, 2, plat - 19, (px, py, i) => tone(LOG.honey, 1.4 + i, px, py));
    for (let x = 6; x < W - 6; x += 3) p.rect(x, plat - 9, 1, 7, PINE[x < cx ? 2 : 3]);
    p.rect(2, plat - 10, W - 4, 2, (x, y, i, j) => tone(PINE, j ? 2.6 : 0.8, x, y));
    // the spyglass on the rail
    p.line(W - 15, plat - 11, W - 8, plat - 14, (k) => (k < 2 ? '#c99a2b' : '#f4cf4f'));
    p.set(W - 8, plat - 14, '#fff3b0');
    // the roof
    const top = 3, eave = 18;
    shingles(p, [0, top, W - 1, eave], inP([[0, eave], [cx, top], [W, eave]]), roof, (x) => (x + 0.5 < cx ? -0.6 : 0.8), { sw: 4, rh: 3, seed: 171 });
    for (let x = 0; x < W; x++) { p.set(x, eave + 1, tone(roof, 3.4 + x / W, x, eave + 1)); if (x % 4 === 1 || x % 4 === 2) p.set(x, eave + 2, roof[4]); }
    p.outline();
    for (let y = 0; y < top + 1; y++) p.front(cx - 0.5, y - 2 < 0 ? 0 : y - 2, '#3d3a48');
    tufts(p, 0, W - 1, gy, 172, { gap: 0.6 });
  } },

  // The bandstand (P 31): a raised stage on a stone base, white posts and railings, a striped roof with
  // a scalloped edge, a drum and a horn waiting for the village band.
  bandstand: { up: 26, draw(p, W, H, lived, h) {
    const gy = H - 1, cx = W / 2, white = ramp('#f4ead8'), eave = 34, dk = gy - 13, roofR = ramp('#4fae8a'), cream = ramp('#fff3e6');
    const edge = x => dk + 5 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / 37) ** 2));
    // back posts and the stage's floor
    for (const x of [16, W - 18]) p.rect(x, eave, 2, dk - eave - 4, (px, py, i) => tone(white, 3.2 + i * 0.4, px, py));
    planks(p, [3, dk - 7, W - 4, gy], (x, y) => ((x + 0.5 - cx) / 37) ** 2 + ((y + 0.5 - dk) / 7) ** 2 <= 1, PINE, (x) => (x - 3) / 74 * 0.8 - 0.2, { pw: 3, vert: false, seed: 181 });
    // the stone base under its front edge, steps up the middle
    stones(p, [3, dk, W - 4, gy], (x, y) => Math.abs(x + 0.5 - cx) <= 37 && y >= edge(x), STONE, (x) => (x - 3) / 74 * 0.9 - 0.25, { ch: 3, wmin: 4, wmax: 7, seed: 182 });
    for (let k = 0; k < 3; k++) p.rect(cx - 8 + k, gy - 5 + k * 2, 16 - k * 2, 2, (x, y, i, j) => tone(PINE, j === 0 ? 0.8 : 2.6, x, y));
    // the band's things: a big drum, a horn on a chair, a music stand
    p.ell(22, dk - 4, 5, 4.5, (x, y, nx, ny) => (Math.abs(nx) > 0.8 ? '#f4ead8' : tone(ramp('#d9454a'), 2 + nx * 0.8, x, y)));
    p.rect(19, dk - 9, 7, 1, '#f4ead8');
    p.rect(W - 26, dk - 6, 6, 4, (x, y, i, j) => tone(WOOD_WARM, j ? 3 : 1.4, x, y));
    p.ell(W - 23, dk - 9, 3.4, 2.4, (x, y, nx, ny) => tone(ramp('#f4cf4f'), 1.4 + nx + ny, x, y));
    p.ell(W - 19, dk - 12, 2, 2.6, (x, y, nx) => tone(ramp('#f4cf4f'), 1 + nx, x, y));
    p.rect(cx + 3, dk - 13, 1, 11, IRON[2]); p.rect(cx + 1, dk - 15, 5, 3, '#fff7f0'); p.rect(cx + 2, dk - 14, 3, 1, '#9a8a8a');
    // front posts and railings, open over the steps
    const posts = [6, 26, W - 28, W - 8];
    for (const x of posts) p.rect(x, eave, 2, Math.round(edge(x)) - eave - 1, (px, py, i) => tone(white, 1.2 + i * 0.9, px, py));
    for (const [a, b] of [[posts[0] + 2, posts[1] - 1], [posts[2] + 2, posts[3] - 1]]) {
      for (let x = a; x <= b; x++) { const bot = Math.round(edge(x)) - 1, top = bot - 7; p.set(x, top, white[1]); p.set(x, top + 1, white[3]); if (x % 2 === 0) for (let y = top + 2; y <= bot; y++) p.set(x, y, white[2]); }
    }
    // the roof: a low striped cone with a scalloped valance, a flag on top
    const top = 6;
    p.poly([[0, eave], [cx, top], [W, eave]], (x, y) => {
      const t = (y - top) / (eave - top), u = (x + 0.5 - cx) / (cx * Math.max(0.05, t));
      const k = Math.floor((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 10);
      return tone(k & 1 ? cream : roofR, 2 + u * 1.2 - 0.2, x, y);
    });
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / 6), lx = x % 6, R = sx & 1 ? cream : ramp('#d9454a'), d = lx === 0 || lx === 5 ? 2 : lx === 1 || lx === 4 ? 3 : 4;
      for (let j = 0; j < d; j++) p.set(x, eave + j, tone(R, 1.6 + (x - cx) / cx + (j === d - 1 ? 0.7 : 0), x, j));
    }
    p.outline();
    for (let y = 0; y < top; y++) p.front(cx - 0.5, y, '#3d3a48');
    for (let i = 1; i < 6; i++) for (let j = 0; j < 3 - (i > 3 ? 1 : 0); j++) p.front(cx + i - 0.5, j, j ? '#f4cf4f' : '#fff3b0');
    tufts(p, 0, W - 1, gy, 183, { gap: 0.5 });
  } },

  // The carousel (P 32): a round platform going round and round, a striped canopy with lights along
  // its edge, a mirrored column in the middle, and the village's critters to ride on brass poles.
  carousel: { up: 28, draw(p, W, H, lived, h) {
    const gy = H - 1, cx = W / 2, eave = 36, dk = gy - 9, red = ramp('#e0646e'), cream = ramp('#fff3e6'), gold = ramp('#f4cf4f');
    const edge = x => dk + 4 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / 38) ** 2));
    // the platform, its rim of painted panels
    planks(p, [2, dk - 6, W - 3, gy], (x, y) => ((x + 0.5 - cx) / 38) ** 2 + ((y + 0.5 - dk) / 6) ** 2 <= 1, PINE, (x) => (x - 2) / 76 * 0.8 - 0.2, { pw: 3, vert: false, seed: 191 });
    p.fill(2, dk, W - 3, gy, (x, y) => Math.abs(x + 0.5 - cx) <= 38 && y >= edge(x) && y < edge(x) + 6, (x, y) => {
      const k = Math.floor((x - 2) / 8), ly = y - Math.round(edge(x));
      if (ly === 0 || ly === 5) return tone(gold, 1.6 + (x - cx) / cx * 0.8, x, y);
      return tone(k & 1 ? cream : red, 1.8 + (x - cx) / cx, x, y);
    });
    // the column in the middle: mirrors framed in gold
    p.rect(cx - 6, eave + 2, 12, dk - eave - 4, (x, y, i, j) => (i === 0 || i === 11 || j % 9 === 0 ? tone(gold, 1.4 + i / 11 * 1.4, x, y) : tone(ramp('#9ec8e8'), 1 + i / 11 * 1.6 + ((i + j) % 7 === 0 ? -1 : 0), x, y)));
    // the riders: brass poles, a pony, a bunny, a duck and a pig at different heights
    const RIDERS = [
      { x: 8, dy: -2, art: ['.mm.......', 'mWWm......', 'WkWWm.....', 'WWWWWWWWW.', '.rrWWWWWWm', '..WWWWWW.m', '..W.W.W.W.'], pal: { W: '#fff7f0', m: '#f29bb2', k: '#3a2a2a', r: '#e0646e' } },
      { x: 24, dy: 3, art: ['.W.W......', '.W.W......', 'WWWWW.....', 'WkWWWWWW..', 'WWWWrrWWW.', '.WWWWWWWWW', '..W.W..W.W'], pal: { W: '#f8d0de', k: '#3a2a2a', r: '#7aa4ff' } },
      { x: W - 34, dy: -1, art: ['.yyy......', 'yykyo.....', 'yyyyoo....', '.yyyyyyyy.', '.yyrryyyyy', '..yyyyyyy.', '...o..o...'], pal: { y: '#f4cf4f', k: '#3a2a2a', o: '#f08c3a', r: '#4fae8a' } },
      { x: W - 18, dy: 2, art: ['..pp......', '.pppp.....', 'pkpppppp..', 'ppppprrpp.', 'nnppppppp.', '.ppppppppq', '..p.p.p.p.'], pal: { p: '#f8b4cc', k: '#3a2a2a', n: '#e58aa5', r: '#f4cf4f', q: '#e58aa5' } },
    ];
    for (const rd of RIDERS) {
      const px = rd.x + 4;
      p.rect(px, eave + 1, 1, Math.round(edge(px)) - eave - 1, (x, y) => tone(gold, 1 + ((y >> 1) & 1) * 1.2, x, y));
      p.stamp(rd.x, dk - 16 + rd.dy, rd.art, rd.pal);
    }
    // the canopy: a cone striped red and cream, its scalloped edge hung with lights, a flag on top
    const top = 6;
    p.poly([[0, eave], [cx, top], [W, eave]], (x, y) => {
      const t = (y - top) / (eave - top), u = (x + 0.5 - cx) / (cx * Math.max(0.05, t));
      const k = Math.floor((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 12);
      return tone(k & 1 ? cream : red, 2 + u * 1.2 - 0.2 + (1 - t) * -0.3, x, y);
    });
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / 6), lx = x % 6, R = sx & 1 ? cream : red, d = lx === 0 || lx === 5 ? 2 : lx === 1 || lx === 4 ? 3 : 4;
      for (let j = 0; j < d; j++) p.set(x, eave + j, tone(R, 1.6 + (x - cx) / cx + (j === d - 1 ? 0.7 : 0), x, j));
      if (lx === 3) p.set(x, eave + d, lived ? '#fff3b0' : '#c9c4c8');
    }
    p.outline();
    for (let y = 0; y < top; y++) p.front(cx - 0.5, y, '#3d3a48');
    for (let i = 1; i < 6; i++) for (let j = 0; j < 3 - (i > 3 ? 1 : 0); j++) p.front(cx + i - 0.5, j, j ? '#e0646e' : '#f06a6a');
    tufts(p, 0, W - 1, gy, 192, { gap: 0.5 });
  } },

  // A friend's log cottage (one for each stage's pair of friends): a steep front gable in the stage's
  // own colour, a little window up in the gable, a stone chimney on some, pots or a bench by the door.
  cottage: { up: 4, smoke: h => (COT[h.cot % COT.length].chim ? [COT[h.cot % COT.length].chim + 3, 10] : null), draw(p, W, H, lived, h) {
    const v = COT[h.cot % COT.length], gy = H - 1, wallTop = gy - 18, x0 = 7, x1 = W - 8, cx = W / 2;
    const roof = ramp(h.roof), wood = LOG[v.log], trim = ramp(mixc(h.roof, '#5a3a2a', 0.45));
    const g = gable(cx, 8, wallTop + 2, W / 2, 8);
    if (v.chim) chimney(p, v.chim, 10, 26, 6);
    // the gable in boards, the log walls on a stone footing, the roof over the gable's top
    gableFace(p, x0 + 3, x1 - 3, g, wallTop, ramp(mixc(wood[2], '#e8d0a0', 0.25)), { seed: 91 + h.cot });
    logWall(p, x0, x1, wallTop, gy - 3, wood, { seed: 92 + h.cot });
    stones(p, [x0 - 1, gy - 2, x1 + 1, gy], null, STONE, (x) => (x - x0) / (x1 - x0) * 0.8 - 0.1, { ch: 3, wmin: 3, wmax: 6, seed: 93 + h.cot });
    gableRoof(p, g, roof, { seed: 90 + h.cot });
    // a window up in the gable, the door, a window each side
    gableWindow(p, cx, wallTop - 8, v.gwin, lived, trim);
    doorway(p, cx, gy, 10, 14, { arch: v.arch, frame: trim, wood: ramp(mixc(h.roof, '#a5683c', 0.55)), seed: h.cot });
    windowBox(p, x0 + 3, wallTop + 4, 6, 6, { lived, frame: trim, box: v.box ? [h.roof, '#fff7f0', '#f4cf4f'] : null });
    windowBox(p, x1 - 8, wallTop + 4, 6, 6, { lived, frame: trim, box: v.box ? [h.roof, '#f8b4cc', '#fff7f0'] : null });
    if (v.lamp) lantern(p, cx + 7, gy - 15, lived);
    // by the door
    if (v.yard === 'pots') { pot(p, 0, gy, [h.roof, '#fff7f0'], h.cot); pot(p, W - 5, gy, ['#f4cf4f', h.roof], h.cot + 5); }
    if (v.yard === 'logs') woodpile(p, W - 9, gy);
    if (v.yard === 'barrel') { planks(p, [W - 6, gy - 7, W - 1, gy - 1], null, WOOD, (x) => (x - W + 6) / 5 - 0.3, { pw: 2 }); for (const y of [gy - 6, gy - 2]) p.rect(W - 6, y, 6, 1, '#4b4858'); }
    p.outline();
    tufts(p, 1, W - 2, gy, 94 + h.cot);
  } },
};

// how the friends' cottages differ (by stage): the logs, a chimney (its x), the window up in the gable,
// an arched door, flower boxes, a lantern, what stands by the door
const COT = [
  { log: 'brown', chim: 33, gwin: 'round', arch: true, box: true, yard: 'pots' },
  { log: 'honey', chim: 0, gwin: 'heart', arch: false, box: false, lamp: true, yard: 'barrel' },
  { log: 'dark', chim: 9, gwin: 'square', arch: true, box: true, yard: 'logs' },
  { log: 'honey', chim: 33, gwin: 'round', arch: false, box: true, yard: 'pots' },
  { log: 'grey', chim: 0, gwin: 'square', arch: true, box: false, lamp: true, yard: 'logs' },
  { log: 'brown', chim: 9, gwin: 'heart', arch: true, box: true, yard: 'pots' },
  { log: 'honey', chim: 0, gwin: 'round', arch: true, box: true, lamp: true, yard: 'barrel' },
  { log: 'dark', chim: 33, gwin: 'square', arch: false, box: false, yard: 'barrel' },
  { log: 'brown', chim: 0, gwin: 'heart', arch: false, box: true, lamp: true, yard: 'logs' },
  { log: 'honey', chim: 9, gwin: 'round', arch: true, box: true, yard: 'pots' },
];
