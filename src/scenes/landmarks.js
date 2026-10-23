// Big things, for a sense of scale: a tree as tall as three houses in the village, and one huge
// thing in each zone's fields (a lone tree in the meadow, a giant mushroom in the deep forest, a lotus
// in the marsh, a lighthouse on a sea stack, a stone head on the mountain, a sunflower in the giant
// garden, a snowman on the plateau, a crystal in the cave, a burnt tree on the volcano, a masked
// statue in the ruins). Each is a canvas anchored at its foot; it is only ever looked at, never
// walked into (except the bit right under its trunk).
// v0.24: drawn with pixkit at the fields' own detail: leaf clumps the size of the field trees', bark
// in narrow ridges, stone in small blocks and cracks, so a giant reads as a giant made of ordinary
// things rather than a small thing blown up.

import { Pix, mixc, ramp, tone, hash, smooth, seeded, foliage, sprinkle, stones, shingles, plaster, inPoly } from './pixkit.js';

// ---------- shared parts ----------
// a round body lit from the upper left, flecked; `R` a ramp, `k` how strong the light is
function ball(p, cx, cy, rx, ry, R, o = {}) {
  p.ell(cx, cy, rx, ry, (x, y, nx, ny) => {
    let v = 2 - (-(0.55 * nx + 0.8 * ny)) * (o.k || 1.6) + (o.base || 0);
    if (o.fleck !== false) { const h = hash(x, y, o.seed || 1); if (h < 0.03) v += 0.8; else if (h > 0.975) v -= 0.8; }
    if (o.lumpy) v += (smooth(x, y, 5, o.seed || 1) - 0.5) * o.lumpy;
    return tone(R, v, x, y);
  }, o.clip);
}
// a tapering limb from (x0, y0) to (x1, y1), w0 wide at the start, w1 at the end, shaded round
function limb(p, x0, y0, x1, y1, w0, w1, R, o = {}) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let k = 0; k <= n; k++) {
    const t = k / n, cx = x0 + dx * t, cy = y0 + dy * t, w = w0 + (w1 - w0) * t;
    for (let s = -w / 2; s <= w / 2; s += 0.5) {
      const x = Math.round(cx + nx * s), y = Math.round(cy + ny * s), u = s / Math.max(0.5, w / 2) * Math.sign(nx || 1);
      let v = 2 + u * 1.1 + (o.base || 0);
      if (o.ridges && (Math.round(t * len) + Math.round(s)) % 5 === 0) v += 0.6;
      p.set(x, y, tone(R, v, x, y));
    }
  }
}
// a trunk: bark in plates split by wandering grooves, light on the left, flaring at the foot
function trunk(p, cx, top, gy, w, R, o = {}) {
  const seed = o.seed || 3, bend = o.bend || 0;
  const mid = y => cx + Math.sin((y - top) / (gy - top) * Math.PI) * bend;
  const half = y => { const t = (y - top) / (gy - top); return w / 2 - Math.sin(t * Math.PI) * w * 0.06 + Math.max(0, t - (o.flareAt || 0.72)) ** 2 * (o.flare || 9) * w; };
  p.fill(0, top, p.w - 1, gy, (x, y) => Math.abs(x + 0.5 - mid(y)) <= half(y), (x, y) => {
    const u = (x + 0.5 - mid(y)) / half(y);
    let v = 2 + u * 1.45 - 0.25 + (u > 0.8 ? 0.5 : 0);
    const c = x + Math.round((smooth(x, y, 9, seed) - 0.5) * 6), band = Math.floor(c / 4), lc = ((c % 4) + 4) % 4;
    if (lc === 0) v += 1.1;
    else if (lc === 1) v -= 0.55;
    if (lc > 0 && (y + band * 3) % 7 === 0 && hash(band, Math.floor((y + band * 3) / 7), seed) < 0.4) v += 1;
    if (hash(x, y, seed) < 0.025) v -= 0.8;
    if (o.glow && lc === 0 && smooth(x, y * 0.5, 6, 9) > 0.62) return ['#ffb347', '#f07a2a', '#c4501f'][Math.floor(hash(x, y, 4) * 3)];
    return tone(R, v, x, y);
  });
  return half;
}
// the shade a crown throws on what is just under it (a trunk, limbs)
function shadeUnder(p, own, R, n = 4) {
  for (let x = 0; x < p.w; x++) for (let y = p.h - 2; y > 0; y--) {
    if (own[y * p.w + x] < 0 || own[(y + 1) * p.w + x] >= 0) continue;
    for (let k = 1; k <= n; k++) { const c = p.get(x, y + k), i = R.indexOf(c); if (i < 0) break; p.set(x, y + k, R[Math.min(R.length - 1, i + (k <= n / 2 ? 2 : 1))]); }
  }
}
// rock broken into boulders and slabs: each pixel belongs to the nearest of a jittered set of
// centres, lit on the side toward the upper left, cracked dark where two meet
function rocks(p, box, inside, R, lit, o = {}) {
  const [x0, y0, x1, y1] = box, r = seeded(o.seed || 1), cw = o.cw || 9, ch = o.ch || 6, pts = [];
  for (let y = y0 - ch, row = 0; y <= y1 + ch; y += ch, row++) for (let x = x0 - cw; x <= x1 + cw; x += cw) pts.push([x + (r() - 0.5) * cw * 0.8 + (row & 1 ? cw / 2 : 0), y + (r() - 0.5) * ch * 0.7, r()]);
  p.fill(x0, y0, x1, y1, inside, (x, y) => {
    let b = 1e9, b2 = 1e9, bi = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = ((x + 0.5 - pts[i][0]) / cw) ** 2 + ((y + 0.5 - pts[i][1]) / ch) ** 2;
      if (d < b) { b2 = b; b = d; bi = i; } else if (d < b2) b2 = d;
    }
    const [px, py, q] = pts[bi], edge = Math.sqrt(b2) - Math.sqrt(b);
    const side = (px - x - 0.5) / cw + (py - y - 0.5) / ch * 1.3;
    let v = 2 + lit(x, y) + (q - 0.5) * 0.9 - side * 1.1;
    if (edge < 0.1) v = 4.3 + lit(x, y) * 0.4;
    else if (edge < 0.24) v += side > 0 ? -0.8 : 0.9;
    if (hash(x, y, o.seed || 1) < 0.03) v -= 0.8;
    return tone(R, v, x, y);
  });
}
// a crown of clumps over a few lumps, each lump an ellipse [cx, cy, rx, ry]
function crownOf(p, lumps, pal, seed, o = {}) {
  const shape = (x, y) => lumps.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
  const x0 = Math.min(...lumps.map(l => l[0] - l[2])), x1 = Math.max(...lumps.map(l => l[0] + l[2]));
  const y0 = Math.min(...lumps.map(l => l[1] - l[3])), y1 = Math.max(...lumps.map(l => l[1] + l[3]));
  const box = [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(p.w - 1, Math.ceil(x1)), Math.min(p.h - 1, Math.ceil(y1))];
  const cx = (x0 + x1) / 2, W = x1 - x0;
  return { box, ...foliage(p, box, shape, pal, { seed, mid: o.mid ?? 0.4, step: o.step || 6.4, rmin: o.rmin || 4.2, rmax: o.rmax || 7, side: x => (x - cx) / W * 1.1, line: 1 }) };
}
// grass and little stones round a foot, in the zone's colours (drawn over the outline)
function foot(p, x0, x1, gy, grass, seed, o = {}) {
  const r = seeded(seed);
  for (let x = x0; x <= x1; x++) {
    if (r() < (o.gap ?? 0.4)) continue;
    const h = 1 + Math.floor(r() * (o.tall || 3));
    for (let k = 0; k < h; k++) p.front(x, gy - k, grass[k === h - 1 ? 0 : 1 + (k & 1)]);
    if (o.flowers && r() < 0.08) p.front(x, gy - h, o.flowers[Math.floor(r() * o.flowers.length)]);
  }
}
// the picture onto a canvas over a soft shadow on the ground
function finish(p, sw, shadow = 'rgba(8,14,10,0.32)') {
  return p.canvas(g => {
    g.fillStyle = shadow;
    for (const [dy, f] of [[-5, 0.55], [-4, 0.8], [-3, 0.94], [-2, 1], [-1, 0.9], [0, 0.66]]) g.fillRect(Math.round(p.w / 2 - sw * f / 2 + 3), p.h - 3 + dy, Math.round(sw * f), 1);
  });
}

// ---------- the village's old tree ----------
const VILLAGE_LEAF = ['#a6df6e', '#71c452', '#4aa446', '#33833d', '#215f30'];
const VILLAGE_GROUND_TUFTS = ['#acdc86', '#7cc45a', '#5aad58'];

// The village's old tree: a crown as wide as a house and a half, a trunk you could not hug, limbs
// showing under the crown, and at the foot of it, between two roots, a door far too small for anyone
// you know.
export function bigTreeCanvas(leaf = VILLAGE_LEAF, barkBase = '#8a5634', seed = 3, door = true, W = 144, H = 136, grass = VILLAGE_GROUND_TUFTS) {
  const gy = H - 3, p = new Pix(W, H), k = W / 144, kh = H / 136, bark = ramp(barkBase);
  const top = Math.round(60 * kh), tw = Math.round(28 * k), cx = W / 2;
  // limbs reaching up and out into the crown, under it so they show between its lower lumps
  limb(p, cx - 6 * k, top + 18 * kh, cx - 40 * k, top - 4 * kh, 10 * k, 4 * k, bark, { ridges: true });
  limb(p, cx - 26 * k, top + 4 * kh, cx - 30 * k, top - 14 * kh, 5 * k, 3 * k, bark, { ridges: true });
  limb(p, cx + 6 * k, top + 14 * kh, cx + 42 * k, top - 6 * kh, 10 * k, 4 * k, bark, { ridges: true, base: 0.5 });
  limb(p, cx + 28 * k, top + 1 * kh, cx + 36 * k, top - 16 * kh, 5 * k, 3 * k, bark, { ridges: true, base: 0.5 });
  const half = trunk(p, cx, top - 22 * kh, gy, tw, bark, { seed, flare: 5, flareAt: 0.8, bend: 1.5 });
  // roots running out over the ground
  for (const [x0, x1, w0, b] of [[-0.3, -1.15, 9, 0], [0.32, 1.2, 9, 0.6], [-0.05, -0.55, 6, 0.2], [0.12, 0.62, 5, 0.5]]) {
    limb(p, cx + x0 * tw, gy - 13 * kh + Math.abs(x0) * 4, cx + x1 * tw, gy, w0 * k, 2.5, bark, { base: b, ridges: true });
  }
  // the crown: a dome with lumps round it, lower at the sides, open underneath where the limbs go in
  const lumps = [[cx, 32 * kh, 58 * k, 25 * kh], [24 * k, 54 * kh, 23 * k, 14 * kh], [W - 24 * k, 52 * kh, 23 * k, 15 * kh],
    [cx - 24 * k, 15 * kh, 30 * k, 13 * kh], [cx + 26 * k, 17 * kh, 26 * k, 13 * kh], [cx - 40 * k, 40 * kh, 22 * k, 14 * kh], [cx + 42 * k, 38 * kh, 22 * k, 14 * kh]];
  const { own, box } = crownOf(p, lumps, leaf, seed * 7 + 1);
  shadeUnder(p, own, bark, 5);
  if (leaf === VILLAGE_LEAF) sprinkle(p, box, own, 9, seed + 5, (x, y) => { p.set(x, y, '#ff9a9a'); p.set(x + 1, y, '#e0464e'); p.set(x, y + 1, '#e0464e'); p.set(x + 1, y + 1, '#a42838'); });
  if (door) {
    // the tiny door, set in a dark arch with a step and a lamp the size of a firefly
    const dx = Math.round(cx + 3 * k), dw = 6, dh = 10, dy = gy - dh;
    const frame = (x, y) => (x + 0.5 - (dx + dw / 2)) ** 2 / ((dw / 2 + 1.2) ** 2) + Math.max(0, dy + 3 - y) ** 2 / 16 <= 1;
    p.fill(dx - 2, dy - 2, dx + dw + 1, gy, (x, y) => frame(x, y) && y >= dy - 2, (x, y) => tone(bark, 4.6, x, y));
    const wood = ramp('#c08a50');
    p.fill(dx, dy, dx + dw - 1, gy - 1, (x, y) => (x + 0.5 - (dx + dw / 2)) ** 2 / ((dw / 2) ** 2) + Math.max(0, dy + 3 - y) ** 2 / 9 <= 1,
      (x, y) => tone(wood, 1.6 + (x - dx) * 0.3 + ((x - dx) === 2 ? 1 : 0), x, y));
    p.set(dx + dw - 2, dy + 5, '#f4cf4f');
    p.rect(dx - 1, gy, dw + 2, 1, (x, y, i) => (i === 0 ? '#c9c8d0' : '#a3a2ad'));
    p.set(dx + dw + 3, dy + 1, '#5a4030'); p.set(dx + dw + 3, dy + 2, '#ffe08a'); p.set(dx + dw + 3, dy + 3, '#f4b04a');
  }
  p.outline();
  foot(p, Math.round(cx - half(gy) - 6), Math.round(cx + half(gy) + 6), gy, grass, seed + 9, { flowers: ['#fff7f0', '#f8b4cc', '#f4cf4f'] });
  return finish(p, W * 0.62);
}

// ---------- one big thing in each zone's fields ----------
// the meadow's: one old tree standing alone in the pasture, crown silver-green in the dark, and the
// same tiny door between its roots as the one in the village
const meadowTree = () => bigTreeCanvas(['#8aa86a', '#6a8a52', '#526e42', '#3c5636', '#283c28'], '#6a5442', 11, true, 112, 120, ['#7aa45a', '#5a8a48', '#446e3c']);

// The forest's: a mushroom taller than the trees, its pale cap glowing faintly in the dark, a skirt
// round its stem and a ring of ordinary-sized ones round its foot.
function giantMushroom() {
  const W = 96, H = 112, gy = H - 3, p = new Pix(W, H), rim = 40;
  const cap = ramp('#93aec6'), stem = ramp('#d8cfba'), gill = ramp('#a89c88');
  // the stem, leaning a little, wider at the foot, fibres wandering up it, in the cap's shade at the top
  const stemAt = y => { const k = (y - rim) / (gy - rim); return [W / 2 + 3 - k * 5, 6.5 + k * k * 7]; };
  p.fill(0, rim, W - 1, gy, (x, y) => { const [c, hw] = stemAt(y); return Math.abs(x + 0.5 - c) <= hw; }, (x, y) => {
    const [c, hw] = stemAt(y), u = (x + 0.5 - c) / hw, f = x + Math.round(smooth(x, y, 7, 50) * 2);
    let v = 2 + u * 1.4 - 0.4;
    if (hash(f, Math.floor(y / 6), 51) < 0.22) v += 0.6; else if (hash(f, Math.floor(y / 6), 52) > 0.86) v -= 0.5;
    if (y < rim + 9) v += (rim + 9 - y) * 0.22;
    return tone(stem, v, x, y);
  });
  // a frilled skirt hanging round the stem
  const sy = 60, [sc, shw] = stemAt(sy), sw = shw + 5;
  p.fill(sc - sw - 1, sy - 2, sc + sw + 1, sy + 8, (x, y) => {
    const u = (x + 0.5 - sc) / sw; if (Math.abs(u) > 1) return false;
    const len = 2 + Math.round((1 - u * u) * 3) + ((x & 3) < 2 ? 1 : 0);
    return y >= sy - Math.round(1 - u * u) - 1 && y <= sy + len;
  }, (x, y) => { const u = (x + 0.5 - sc) / sw; return tone(stem, 2 + u * 1.5 - 0.5 + (y <= sy - 1 ? 1 : 0) + ((x & 3) === 0 ? 0.7 : 0), x, y); });
  // gills under the rim, running in to the stem
  p.ell(W / 2, rim + 1, W / 2 - 4, 7, (x, y) => {
    const g = Math.round((x + 0.5 - W / 2) / (1 + (y - rim) * 0.3));
    return tone(gill, 2.4 + (g % 3 === 0 ? 1 : 0) + (y - rim) * 0.15 + (x > W / 2 ? 0.4 : 0), x, y);
  }, (x, y) => y >= rim);
  // the cap: lit from the upper left, faint streaks running out from the top, the rim curling under
  ball(p, W / 2, rim + 2, W / 2 - 2, 38, cap, { clip: (x, y) => y <= rim, k: 1.7, lumpy: 0.5, seed: 53 });
  p.fill(0, 0, W - 1, rim, (x, y) => cap.includes(p.get(x, y)), (x, y) => {
    const i = cap.indexOf(p.get(x, y)), a = Math.atan2(y - rim - 14, x + 0.5 - W / 2);
    let v = i;
    if (hash(Math.floor(a * 40), 0, 55) < 0.25 && smooth(x, y, 6, 56) > 0.45) v += 0.6;
    if (y >= rim - 1) v += 1.1; else if (y === rim - 3) v -= 0.5;
    return tone(cap, v, x, y);
  });
  // pale spots, each raised with a shade on its lower right, flatter toward the edge
  for (const [sx, sy2, rr] of [[30, 15, 5], [56, 10, 4.5], [72, 25, 4], [45, 27, 3.2], [18, 30, 3], [62, 35, 2.6], [40, 7, 2.4], [82, 34, 2.2], [12, 22, 1.8]]) {
    const sq = 1 - ((sx - W / 2) / (W / 2)) ** 2 * 0.5;
    p.ell(sx + 1, sy2 + 1, rr * sq + 0.3, rr * 0.8, (x, y) => tone(cap, 3.6, x, y));
    ball(p, sx, sy2, rr * sq + 0.3, rr * 0.8, ramp('#e2ecf4'), { k: 1.2, fleck: false });
  }
  // a faint glow: a few of the cap's pixels lit like the fireflies
  const r = seeded(54);
  for (let k = 0; k < 14; k++) { const x = 6 + Math.floor(r() * (W - 12)), y = 6 + Math.floor(r() * 30); if (cap.includes(p.get(x, y))) p.set(x, y, '#e8f8ff'); }
  // little mushrooms at the foot, each the size of a hero's head
  for (const [cx, sz] of [[14, 1], [23, 0.75], [76, 1.1], [86, 0.7]]) {
    const top = gy - Math.round(10 * sz);
    p.rect(cx - 1, top + 3, 3, gy - top - 2, (x, y, i) => stem[1 + i]);
    ball(p, cx + 0.5, top + 3, 5 * sz + 1, 4 * sz + 1, ramp('#b85e52'), { clip: (x, y) => y <= top + 3, k: 1.4 });
    p.set(cx - 1, top + 1, '#f4e4d8'); p.set(cx + 2, top + 2, '#f4e4d8');
  }
  p.outline();
  foot(p, 6, W - 7, gy, ['#5a8a52', '#40704a', '#30583b'], 55);
  return finish(p, 60);
}

// The marsh's: a lily pad as wide as a room, and on it a lotus bud as tall as a house, not yet open.
function giantLotus() {
  const W = 96, H = 96, gy = H - 4, p = new Pix(W, H);
  const pad = ramp('#5f7d40'), pale = ramp('#e2b8c8'), deep = ramp('#d07898'), stalk = ramp('#6a8a48');
  // reeds behind, cattails on two of them
  for (const [x, h, cat] of [[8, 34, 1], [12, 26, 0], [84, 38, 1], [88, 28, 0], [80, 22, 0]]) {
    p.line(x, gy - 4, x + (x < W / 2 ? -1 : 1), gy - 4 - h, (k, n) => stalk[k > n * 0.7 ? 1 : 3]);
    if (cat) p.rect(x + (x < W / 2 ? -2 : 0), gy - h - 2, 3, 7, (px, py, i) => tone(ramp('#8a5a3a'), 1.5 + i * 0.8, px, py));
  }
  // the pad: veins running out from the middle, a notch cut out of it, its back edge curling up
  const pcx = W / 2, pcy = gy - 12, prx = W / 2 - 3, pry = 13;
  p.ell(pcx, pcy, prx, pry, (x, y, nx, ny) => {
    const a = Math.atan2(ny, nx), d = Math.hypot(nx, ny), sp = ((a / (Math.PI * 2)) * 18 + 18) % 1;
    let v = 2 + ny * 0.7 + nx * 0.5;
    if (sp < 0.07 && d > 0.12) v += 1; else if (sp > 0.93 && d > 0.12) v -= 0.6;
    if (d > 0.88) v += ny < 0 ? -1.1 : 0.9;
    if (hash(x, y, 61) < 0.03) v -= 0.7;
    return tone(pad, v, x, y);
  }, (x, y) => !inPoly([[pcx + 2, pcy], [pcx + 22, gy + 4], [pcx + 8, gy + 4]], x + 0.5, y + 0.5));
  // drops of water on it
  for (const [x, y] of [[20, gy - 14], [70, gy - 8], [62, gy - 18]]) { p.set(x, y, '#e8f8ff'); p.set(x + 1, y, '#9ad0e0'); p.set(x, y + 1, pad[4]); }
  // little pads floating in front
  for (const [cx, rx] of [[14, 9], [78, 7]]) p.ell(cx, gy + 1, rx, 2.6, (x, y, nx, ny) => tone(pad, 1.6 + ny + nx * 0.4, x, y));
  // the stalk, then the bud: petals overlapping, pale at the base and deep pink at the tips, each with
  // fine veins and an edge where it lies over the one behind
  p.rect(W / 2 - 2, 50, 5, gy - 60, (x, y, i) => tone(stalk, 1 + i * 0.55 + (hash(i, y, 63) < 0.1 ? -0.7 : 0), x, y));
  const petal = (cx, cy, rx, ry, base, lean = 0) => {
    const at = y => { const ny = (y + 0.5 - cy) / ry; return [cx - ny * lean, rx * Math.sqrt(Math.max(0, 1 - ny * ny)) * (ny < 0 ? 1 + ny * 0.6 : 1), ny]; };
    p.fill(cx - rx - 4, cy - ry - 1, cx + rx + 4, cy + ry, (x, y) => { const [c, w, ny] = at(y); return Math.abs(ny) <= 1 && Math.abs(x + 0.5 - c) <= w; }, (x, y) => {
      const [c, w, ny] = at(y), nx = (x + 0.5 - c) / Math.max(1, w);
      let v = base + 2 + nx * 1.1 + ny * 0.4;
      if (Math.abs(nx) > 0.8 || ny > 0.86) v += 1.2;
      else if (Math.abs((nx + 1) * 2.5 % 1 - 0.5) < 0.1 && ny > -0.7) v += 0.45;
      if (ny < -0.82 && Math.abs(nx) < 0.3) v -= 0.8;
      return tone(ny < -0.35 + hash(x, 0, 64) * 0.15 ? deep : pale, v, x, y);
    });
  };
  petal(W / 2 - 11, 38, 10, 19, 0.7, -3); petal(W / 2 + 11, 38, 10, 19, 1, 3);
  petal(W / 2, 30, 12, 27, -0.2);
  petal(W / 2 - 7, 45, 8, 12, -0.5, -2); petal(W / 2 + 7, 46, 8, 11, 0.3, 2);
  // two green sepals cupping it
  for (const d of [-1, 1]) p.poly([[W / 2 + d * 2, 57], [W / 2 + d * 12, 50], [W / 2 + d * 7, 57]], (x, y) => tone(stalk, d < 0 ? 1.2 : 2.6, x, y));
  // a firefly resting on the tip
  p.set(W / 2, 2, '#f4f7c0'); p.set(W / 2 - 1, 2, '#c8d880');
  p.outline();
  return finish(p, 80, 'rgba(6,12,10,0.35)');
}

// The mountain's: a stone head as big as a hut, half sunk into the slope, eyes shut, moss on its
// crown. (Nobody remembers who carved it. Nobody says who it looks like.)
export function stoneHead(open = false) {
  const W = 96, H = 100, gy = H - 3, p = new Pix(W, H);
  const st = ramp('#8f8d84'), moss = ['#8faa70', '#6f8a56', '#56703f', '#40562f', '#2c3c20'];
  // the head: weathered stone, lumpy and flecked, cracks running down it, rain streaks from the moss
  ball(p, W / 2, 54, 40, 46, st, { clip: (x, y) => y <= gy, k: 1.5, lumpy: 0.9, seed: 71 });
  const r = seeded(75);
  for (let k = 0; k < 16; k++) {
    const x = 14 + Math.floor(r() * (W - 28)), y0 = 18 + Math.floor(r() * 10), n = 5 + Math.floor(r() * 14);
    for (let j = 0; j < n; j++) { const c = p.get(x, y0 + j), i = st.indexOf(c); if (i >= 0 && (j < n - 2 || j % 2)) p.set(x, y0 + j, st[Math.min(5, i + 1)]); }
  }
  for (const [x, y, n, d] of [[16, 30, 9, 1], [74, 58, 10, -1], [60, 20, 6, 1], [30, 70, 7, -1], [80, 36, 6, 1]]) for (let k = 0; k < n; k++) { const cx = x + Math.round(Math.sin(k * 1.7) * d), cy = y + k; p.set(cx, cy, st[4]); p.set(cx + 1, cy, st[1]); }
  // lichen: little pale rosettes
  for (let k = 0; k < 9; k++) {
    const x = 12 + Math.floor(r() * (W - 24)), y = 34 + Math.floor(r() * 50);
    if (!st.includes(p.get(x, y)) || !st.includes(p.get(x + 1, y + 1))) continue;
    p.set(x, y, '#c4c69a'); p.set(x + 1, y, '#a8ae7c'); p.set(x, y + 1, '#a8ae7c'); p.set(x + 1, y + 1, '#8a9466');
  }
  // moss over the crown in small clumps, a little hanging down the sides
  const mossShape = (x, y) => st.includes(p.get(x, y)) && y < 20 + smooth(x, 0, 6, 72) * 12;
  foliage(p, [8, 4, W - 9, 34], mossShape, moss, { seed: 73, step: 4.2, rmin: 2.4, rmax: 3.6, mid: 0.3, line: 1 });
  // brow, eyes, nose, a small sad mouth: carved, so each groove has a lit lower lip
  const groove = (x, y, w, h = 2) => { p.rect(x, y, w, h, (px, py) => tone(st, 4.4, px, py)); p.rect(x, y + h, w, 1, (px, py) => tone(st, 0.8, px, py)); };
  groove(22, 40, 20); groove(54, 40, 20);
  if (open) {
    for (const ex of [32, 64]) { p.ell(ex, 50, 7, 6, '#1b1424'); p.ell(ex, 50, 4.5, 4, '#f4e9c0'); p.ell(ex + 1, 51, 2, 2, '#1b1424'); p.set(ex - 1, 49, '#ffffff'); }
  } else {
    for (const ex of [26, 58]) groove(ex, 50, 13, 1);
  }
  p.poly([[W / 2 - 2, 46], [W / 2 + 6, 66], [W / 2 - 6, 66]], (x, y) => tone(st, x < W / 2 ? 1.2 : 3, x, y));
  groove(W / 2 - 6, 66, 12, 1);
  groove(W / 2 - 8, 76, 16); p.set(W / 2 - 9, 78, st[4]); p.set(W / 2 + 8, 78, st[4]);
  // rubble at the foot
  for (const [cx, rr] of [[10, 5], [86, 6], [19, 3.5], [78, 3], [27, 2]]) ball(p, cx, gy - rr + 1, rr + 1, rr, st, { k: 1.3, seed: cx });
  p.outline();
  foot(p, 4, W - 5, gy, ['#6f8a74', '#55705c', '#42584a'], 74, { gap: 0.55 });
  return finish(p, 82);
}

// The cave's: a crystal cluster taller than the bat lord, glowing violet and ice blue, every shard cut
// into facets that catch the light differently.
function giantCrystal() {
  const W = 80, H = 104, gy = H - 3, p = new Pix(W, H);
  const blue = ['#e6f8ff', '#b4e4f6', '#7cc4e0', '#4c92b4', '#336a8a', '#244c66'], violet = ['#f2e4ff', '#d4b0ff', '#a982e6', '#7a58b4', '#56408a', '#3a2c60'];
  const shard = (bx, w, h, lean, R) => {
    const tip = [bx + lean, gy - h], l = [bx - w / 2, gy - h * 0.2], rr = [bx + w / 2, gy - h * 0.17];
    const P = [[bx - w / 2, gy + 1], l, [tip[0] - w * 0.2, tip[1] + w * 0.6], tip, [tip[0] + w * 0.2, tip[1] + w * 0.6], rr, [bx + w / 2, gy + 1]];
    const ridge = x => bx + lean * 0.15 + (x - bx) * 0;
    p.poly(P, (x, y) => {
      const f = (x + 0.5 - (bx - w / 2)) / w, t = (gy - y) / h, mid = 0.42 + lean / w * 0.3 * t;
      let v = f < mid - 0.18 ? 0.8 : f < mid ? 1.6 : f < mid + 0.25 ? 2.8 : 3.8;
      if (y < tip[1] + w * 0.6 + 1) v -= 0.6;
      if (hash(x, Math.floor(y / 3), bx) < 0.05) v -= 1;
      return tone(R, v, x, y);
    });
    p.line(tip[0], tip[1] + 2, ridge(0), gy - 4, (k, n) => (k < n * 0.6 ? R[0] : R[1]));
  };
  // a few rocks it grows out of
  for (const [cx, rr] of [[10, 5], [70, 6], [24, 4], [56, 4]]) ball(p, cx, gy - rr + 1, rr + 1, rr, ramp('#5a5268'), { k: 1.2, seed: cx });
  shard(20, 18, 58, -8, violet);
  shard(61, 16, 50, 9, blue);
  shard(40, 24, 96, 2, blue);
  shard(29, 12, 34, -5, blue);
  shard(52, 12, 30, 4, violet);
  shard(70, 8, 18, 5, violet);
  // sparks inside
  const r = seeded(81);
  for (let k = 0; k < 16; k++) { const x = 10 + Math.floor(r() * 60), y = 10 + Math.floor(r() * 80); if (p.get(x, y)) p.set(x, y, '#ffffff'); }
  p.outline();
  return finish(p, 64, 'rgba(10,6,20,0.35)');
}

// 바닷가 절벽: a sea stack out in the water with a lighthouse on it, its lamp still lit.
function lighthouse() {
  const W = 64, H = 128, gy = H - 4, p = new Pix(W, H);
  const rock = ramp('#8a8370'), white = ramp('#e2dcd0'), red = ramp('#c04a40'), iron = ramp('#4a4448');
  // the stack: boulders and slabs packed together, each lit on its upper left with dark cracks between,
  // its sides ragged; weed and barnacles where the sea reaches
  const half = y => 14 + ((y - 70) / (gy - 70)) * 12 + (smooth(0, y, 5, 91) - 0.5) * 5;
  rocks(p, [2, 70, W - 3, gy], (x, y) => Math.abs(x + 0.5 - W / 2) <= half(y), rock, (x, y) => (x + 0.5 - W / 2) / half(y) * 1.1 - 0.1, { cw: 10, ch: 6, seed: 92 });
  p.fill(2, gy - 9, W - 3, gy, (x, y) => rock.includes(p.get(x, y)) && hash(x, y, 95) < (y - (gy - 9)) / 12, (x, y) => (hash(x, y, 96) < 0.5 ? '#3c5a3a' : '#2a4030'));
  p.ell(W / 2, 71, 16, 4, (x, y, nx) => tone(ramp('#6f9a58'), 1.6 + nx + (hash(x, y, 97) < 0.2 ? -0.8 : 0), x, y), (x, y) => y <= 72);
  for (let x = W / 2 - 15; x <= W / 2 + 15; x++) if (hash(x, 3, 98) < 0.4) p.set(x, 73 + (hash(x, 4, 98) < 0.5 ? 1 : 0), '#4f7a44');
  // surf round the foot
  for (let x = 2; x < W - 2; x++) if (hash(x, 1, 99) < 0.6) p.front(x, gy - 1 + (x % 3 === 0 ? 1 : 0), x % 4 ? '#e8f4f8' : '#a8d4e4');
  // the tower: plastered white with red bands, narrowing as it goes up, a door and two windows
  const tw = y => (11 + ((y - 22) / 48) * 7) / 2;
  plaster(p, [W / 2 - 10, 22, W / 2 + 10, 70], (x, y) => Math.abs(x + 0.5 - W / 2) <= tw(y), white, (x, y) => (x + 0.5 - W / 2) / tw(y) * 1.2 - 0.1, { seed: 94 });
  p.fill(W / 2 - 10, 22, W / 2 + 10, 70, (x, y) => Math.abs(x + 0.5 - W / 2) <= tw(y) && Math.floor((y - 22) / 9) % 2 === 1, (x, y) => tone(red, 2 + (x + 0.5 - W / 2) / tw(y) * 1.2 - 0.1 + (hash(x, y, 95) < 0.04 ? 0.7 : 0), x, y));
  p.ell(W / 2, 59, 2.5, 2.5, '#3a2c2a', (x, y) => y < 59); p.rect(W / 2 - 2, 59, 5, 11, (x, y, i) => (i === 0 ? '#5a4440' : '#3a2c2a'));
  for (const wy of [34, 46]) { p.rect(W / 2 - 1, wy, 3, 4, '#3a2c2a'); p.set(W / 2, wy + 1, '#ffe08a'); }
  // the gallery with its railing, the lamp room glowing, the red cap
  p.rect(W / 2 - 9, 20, 19, 2, (x, y, i, j) => tone(iron, j ? 3 : 1, x, y));
  for (let x = W / 2 - 9; x <= W / 2 + 9; x += 2) p.set(x, 19, iron[2]);
  p.rect(W / 2 - 9, 18, 19, 1, iron[2]);
  p.rect(W / 2 - 6, 9, 13, 10, iron[3]);
  p.rect(W / 2 - 5, 10, 11, 8, (x, y, i) => ['#fff6c8', '#ffe8a0', '#ffd870', '#f4c050'][Math.min(3, Math.abs(i - 5) >> 1)]);
  for (const x of [W / 2 - 2, W / 2 + 2]) p.rect(x, 10, 1, 8, iron[2]);
  shingles(p, [W / 2 - 8, 1, W / 2 + 8, 9], (x, y) => inPoly([[W / 2 - 8.5, 9.5], [W / 2 + 0.5, 1], [W / 2 + 9.5, 9.5]], x + 0.5, y + 0.5), red, (x) => (x < W / 2 ? -0.6 : 0.8), { sw: 4, rh: 3, seed: 96 });
  p.set(W / 2, 0, iron[1]);
  p.outline();
  // the beam, faint, reaching out to the side; a gull asleep on the ledge
  for (let k = 0; k < 22; k++) for (let j = -Math.floor(k / 6); j <= Math.floor(k / 6); j++) if ((k + j) % 2 === 0 && W / 2 + 8 + k < W) p.front(W / 2 + 8 + k, 14 + j, k < 10 ? '#fff6c8' : '#ffe9a0');
  p.front(W / 2 + 12, 68, '#f4f4f0'); p.front(W / 2 + 13, 68, '#f4f4f0'); p.front(W / 2 + 13, 67, '#f4f4f0'); p.front(W / 2 + 14, 68, '#c8ccd0'); p.front(W / 2 + 12, 67, '#f4b04a');
  return finish(p, 50, 'rgba(4,12,20,0.4)');
}

// 거인 꽃밭: a sunflower taller than a house, its head bowed as if looking down at you.
function giantSunflower() {
  const W = 96, H = 128, gy = H - 3, p = new Pix(W, H);
  const stem = ramp('#5f9a48'), leaf = ramp('#5f9a44'), petal = ramp('#f0c43a'), seedR = ramp('#6a4224');
  // the stalk, a little hairy, swaying
  const sx = y => W / 2 + Math.sin(y / 14) * 2;
  p.fill(0, 50, W - 1, gy, (x, y) => Math.abs(x + 0.5 - sx(y)) <= 3, (x, y) => tone(stem, 2 + (x + 0.5 - sx(y)) / 3 * 1.2 + (hash(x, Math.floor(y / 2), 101) < 0.15 ? 0.7 : 0), x, y));
  // two big leaves with a midrib and veins, toothed edges
  for (const [cx, cy, dir] of [[W / 2 - 18, 88, -1], [W / 2 + 18, 72, 1]]) {
    p.ell(cx, cy, 18, 8, (x, y, nx, ny) => {
      let v = 2 + ny * 1 + (dir < 0 ? -0.3 : 0.2);
      if (Math.abs(ny + nx * 0.15 * dir) < 0.1) v += 1.1;
      else if (Math.abs(((nx * dir + 1) * 4 + ny * 2) % 1) < 0.12) v += 0.6;
      return tone(leaf, v, x, y);
    }, (x, y) => !((x + y) % 4 === 0 && Math.hypot((x + 0.5 - cx) / 18, (y + 0.5 - cy) / 8) > 0.9));
  }
  // the head, bowed (seen a little from below): two rings of petals, each with a crease, then the
  // seed disc dotted in a spiral
  const hx = W / 2, hy = 36;
  for (const [ring, n, rr, base] of [[0, 20, 1, 0.9], [1, 20, 0.86, -0.2]]) for (let k = 0; k < n; k++) {
    const a = (k + ring * 0.5) / n * Math.PI * 2, cx = hx + Math.cos(a) * 29 * rr, cy = hy + Math.sin(a) * 24 * rr;
    p.ell(cx, cy, 8, 5, (x, y, nx, ny) => {
      const along = nx * Math.cos(a) + ny * Math.sin(a), across = -nx * Math.sin(a) + ny * Math.cos(a);
      let v = 2 + base + Math.sin(a) * 0.9 - along * 0.5;
      if (Math.abs(across) < 0.14) v += 0.7;
      return tone(petal, v, x, y);
    });
  }
  p.ell(hx, hy, 22, 19, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    let v = 2 + ny * 1.2 + nx * 0.4 + (d > 0.88 ? 1 : 0);
    return tone(seedR, v, x, y);
  });
  for (let k = 0; k < 170; k++) {
    const a = k * 2.39996, d = Math.sqrt(k / 170);
    const x = Math.round(hx + Math.cos(a) * d * 20), y = Math.round(hy + Math.sin(a) * d * 17);
    p.set(x, y, tone(seedR, 0.6 + d * 0.8 + (y > hy ? 0.8 : 0), x, y));
  }
  p.outline();
  foot(p, 20, W - 21, gy, ['#7aa45a', '#5a8a48', '#446e3c'], 102, { flowers: ['#f0b8cc', '#f4e08a', '#d8c8f4'] });
  return finish(p, 56);
}

// 눈 고원: a snowman as tall as a house, with a bucket for a hat, a carrot nose, and a red scarf
// just like the ones the Guild hands out.
function giantSnowman() {
  const W = 80, H = 116, gy = H - 3, p = new Pix(W, H);
  const snow = ['#ffffff', '#eef3fa', '#d2dcea', '#a8b8cf', '#7d8ea8', '#5a6a86'];
  // a drift of snow round the foot, then the three balls, a little lumpy, glinting
  ball(p, W / 2, gy - 1, 36, 5, snow, { clip: (x, y) => y <= gy, k: 1 });
  for (const [cy, rr] of [[gy - 22, 30], [gy - 62, 22], [gy - 92, 16]]) ball(p, W / 2, cy, rr, rr * 0.92, snow, { k: 1.8, lumpy: 0.8, seed: cy, fleck: false });
  const r = seeded(111);
  for (let k = 0; k < 24; k++) { const x = 10 + Math.floor(r() * 60), y = 20 + Math.floor(r() * 90); if (p.get(x, y) && p.get(x, y) !== snow[5]) p.set(x, y, k % 3 ? '#ffffff' : '#c6e4ff'); }
  // stick arms with twigs
  const twig = ramp('#5e3a22');
  limb(p, W / 2 - 19, gy - 66, W / 2 - 36, gy - 80, 3, 1.5, twig); limb(p, W / 2 - 31, gy - 76, W / 2 - 35, gy - 70, 1.5, 1, twig);
  limb(p, W / 2 + 19, gy - 66, W / 2 + 37, gy - 74, 3, 1.5, twig); limb(p, W / 2 + 30, gy - 71, W / 2 + 33, gy - 79, 1.5, 1, twig);
  // the scarf: knitted rows, a tail with a fringe
  const scarf = ramp('#d84a4a');
  p.rect(W / 2 - 16, gy - 81, 32, 6, (x, y, i, j) => tone(scarf, 2 + (i / 31) * 1.4 - 0.5 + (j === 0 ? -0.6 : j === 5 ? 0.8 : 0) + ((i + j) % 3 === 0 ? 0.4 : 0), x, y));
  p.rect(W / 2 + 5, gy - 76, 6, 14, (x, y, i, j) => tone(scarf, 2.2 + i * 0.25 + (j % 4 === 3 ? 0.7 : 0), x, y));
  for (let i = 0; i < 6; i += 2) p.set(W / 2 + 5 + i, gy - 62, scarf[3]);
  // coal buttons and eyes (with a glint), the carrot nose, a smile of pebbles
  for (const y of [gy - 56, gy - 46, gy - 30, gy - 18]) { p.ell(W / 2, y, 2.5, 2.5, '#2a2430'); p.set(W / 2 - 1, y - 1, '#5a5468'); }
  for (const ex of [W / 2 - 6, W / 2 + 6]) { p.ell(ex, gy - 96, 2, 2, '#2a2430'); p.set(ex - 1, gy - 97, '#8a8498'); }
  p.poly([[W / 2 - 1, gy - 93], [W / 2 + 13, gy - 89], [W / 2 - 1, gy - 87]], (x, y) => tone(ramp('#f08c3a'), y < gy - 90 ? 1 : 2.5, x, y));
  for (const gx of [W / 2 + 3, W / 2 + 7]) p.set(gx, gy - 90, '#c4602a');
  for (const dx of [-6, -3, 0, 3, 6]) p.set(W / 2 + dx, gy - 84 + (Math.abs(dx) > 4 ? -1 : 0), '#2a2430');
  // the bucket: a dented tin pail with a rim and a handle
  const tin = ramp('#6a88a8');
  p.poly([[W / 2 - 11, gy - 104], [W / 2 - 8, gy - 115], [W / 2 + 8, gy - 115], [W / 2 + 11, gy - 104]], (x, y) => tone(tin, 2 + (x - W / 2) / 11 * 1.4 + (x === W / 2 - 3 ? -1 : 0) + ((y - gy) % 4 === 0 ? 0.4 : 0), x, y));
  p.rect(W / 2 - 12, gy - 105, 24, 2, (x, y, i, j) => tone(tin, (j ? 3 : 1) + i / 23, x, y));
  p.outline();
  foot(p, 6, W - 7, gy, ['#ffffff', '#d2dcea', '#a8b8cf'], 112, { gap: 0.5, tall: 2 });
  return finish(p, 64, 'rgba(20,28,44,0.35)');
}

// 불꽃 화산: a tree burnt black, still warm, embers glowing in the cracks of its bark.
function emberTree() {
  const W = 96, H = 112, gy = H - 3, p = new Pix(W, H), r = seeded(121);
  const bark = ramp('#3a2e2e');
  // bare branches, forking, thinning out
  const grow = (x, y, a, len, w, d) => {
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    limb(p, x, y, x1, y1, w, Math.max(1, w * 0.62), bark, { ridges: w > 3 });
    if (d <= 0) return;
    grow(x1, y1, a - 0.45 - r() * 0.3, len * 0.72, Math.max(1, w * 0.62), d - 1);
    if (r() < 0.85) grow(x1, y1, a + 0.4 + r() * 0.3, len * 0.66, Math.max(1, w * 0.55), d - 1);
  };
  grow(W / 2 - 4, 50, -Math.PI / 2 - 0.7, 22, 6, 3);
  grow(W / 2 + 4, 48, -Math.PI / 2 + 0.75, 24, 6, 3);
  grow(W / 2, 44, -Math.PI / 2 - 0.05, 22, 5, 3);
  trunk(p, W / 2, 40, gy, 18, bark, { seed: 122, glow: true, flare: 8 });
  // embers floating up
  for (let k = 0; k < 12; k++) p.front(6 + r() * (W - 12), 2 + r() * 44, r() < 0.5 ? '#ffb347' : '#ff7a2a');
  p.outline();
  foot(p, 18, W - 19, gy, ['#6a5a58', '#4a3e3e', '#382e2e'], 123, { gap: 0.6, tall: 2 });
  return finish(p, 58, 'rgba(30,8,4,0.4)');
}

// 옛 조합 터: a great statue of a worker in the Guild's coat, broken off at the knees, a mask on its
// face. Under the mask the stone has been chipped away.
export function maskStatue() {
  const W = 80, H = 120, gy = H - 3, p = new Pix(W, H);
  const st = ramp('#968c80'), moss = ['#8faa70', '#6f8a56', '#56703f', '#40562f', '#2c3c20'];
  // the plinth: cut blocks
  stones(p, [8, gy - 12, 71, gy], null, st, (x) => (x - 8) / 63 * 1.2 - 0.4, { ch: 6, wmin: 10, wmax: 16, seed: 131 });
  p.rect(8, gy - 13, 64, 1, st[0]);
  // the broken legs, the coat (a round body), buttons and a seam, the head and its round ears
  for (const lx of [24, 44]) p.rect(lx, gy - 26, 12, 14, (x, y, i, j) => tone(st, 2 + (i - 6) / 6 * 1.1 - 0.2 + (j === 0 ? -0.8 : 0) + (hash(x, y, 132) < 0.05 ? 0.8 : 0), x, y));
  for (const lx of [24, 44]) for (let i = 0; i < 12; i += 2) p.set(lx + i + (i % 4 ? 1 : 0), gy - 26 - (i % 3 === 0 ? 1 : 0), st[0]);
  ball(p, W / 2, gy - 48, 24, 26, st, { k: 1.6, lumpy: 0.6, seed: 133 });
  // its little arms: one at its side, the other broken off at the elbow (the hand lies on the plinth)
  ball(p, W / 2 - 23, gy - 52, 5, 9, st, { k: 1.5, seed: 139 });
  ball(p, W / 2 + 23, gy - 60, 5, 4, st, { k: 1.5, seed: 140 });
  p.rect(W / 2 + 19, gy - 58, 8, 1, (x, y, i) => (i % 3 ? st[1] : st[0]));
  ball(p, 64, gy - 16, 5, 3.5, st, { k: 1.4, seed: 141 });
  p.rect(W / 2 - 1, gy - 70, 2, 40, (x, y, i) => st[i ? 1 : 4]);
  for (const y of [gy - 62, gy - 52, gy - 42]) { p.ell(W / 2 + 5, y, 1.6, 1.6, st[4]); p.set(W / 2 + 4, y - 1, st[0]); }
  ball(p, W / 2 - 15, gy - 100, 6, 7, st, { k: 1.5 }); ball(p, W / 2 + 15, gy - 100, 6, 7, st, { k: 1.5 });
  ball(p, W / 2, gy - 86, 20, 18, st, { k: 1.6, lumpy: 0.5, seed: 134 });
  // the mask: a plain pale oval with two holes and a painted smile, cracked across
  const mask = ramp('#e2dcd0');
  ball(p, W / 2, gy - 84, 12, 13, mask, { k: 1.4, fleck: false });
  for (const ex of [W / 2 - 5, W / 2 + 5]) { p.ell(ex, gy - 87, 2, 2.5, '#1b1424'); p.set(ex, gy - 85, '#3a2c2a'); }
  for (let k = -5; k <= 5; k++) p.set(W / 2 + k, gy - 76 - Math.round((k * k) / 10), '#c04a40');
  for (let k = 0; k < 9; k++) { p.set(W / 2 - 9 + k * 2, gy - 92 + k, st[3]); p.set(W / 2 - 8 + k * 2, gy - 92 + k, st[4]); }
  // cracks in the stone, moss creeping over the shoulders and the plinth
  for (const [x, y, n] of [[22, gy - 56, 8], [56, gy - 44, 9], [30, gy - 96, 5]]) for (let k = 0; k < n; k++) p.set(x + Math.round(Math.sin(k * 1.9)), y + k, st[4]);
  const mossy = (x, y) => p.get(x, y) && st.includes(p.get(x, y));
  foliage(p, [W / 2 - 24, gy - 74, W / 2 - 4, gy - 62], (x, y) => mossy(x, y) && ((x - (W / 2 - 14)) / 10) ** 2 + ((y - (gy - 68)) / 5) ** 2 <= 1, moss, { seed: 135, step: 3.6, rmin: 2.2, rmax: 3.2, line: 1 });
  foliage(p, [W / 2 + 8, gy - 70, W / 2 + 24, gy - 60], (x, y) => mossy(x, y) && ((x - (W / 2 + 16)) / 8) ** 2 + ((y - (gy - 66)) / 4) ** 2 <= 1, moss, { seed: 136, step: 3.6, rmin: 2.2, rmax: 3.2, line: 1 });
  foliage(p, [8, gy - 16, 30, gy - 8], (x, y) => mossy(x, y) && x < 26 - (gy - y), moss, { seed: 137, step: 3.6, rmin: 2.2, rmax: 3.2, line: 1 });
  p.outline();
  foot(p, 6, W - 7, gy, ['#5a7a52', '#46623f', '#364e32'], 138, { gap: 0.45 });
  return finish(p, 66);
}

// size in tiles of each zone's landmark, and what looking at it says
export const LANDMARKS = {
  meadow: { w: 7, h: 8, make: meadowTree, name: '외딴 고목', tip: '들판 한가운데 혼자 선 아주 큰 나무. 뿌리 사이에 작은 문이 있다.' },
  forest: { w: 6, h: 7, make: giantMushroom, name: '거인 버섯', tip: '나무보다 큰 버섯. 갓이 어둠 속에서 희미하게 빛난다.' },
  marsh: { w: 6, h: 6, make: giantLotus, name: '거인 연꽃', tip: '방만 한 연잎 위에 집채만 한 꽃봉오리. 아직 안 피었다.' },
  rock: { w: 6, h: 7, make: () => stoneHead(false), name: '돌 얼굴', tip: '산비탈에 반쯤 묻힌 커다란 돌 얼굴. 눈을 감고 있다.' },
  cave: { w: 5, h: 7, make: giantCrystal, name: '거인 수정', tip: '박쥐 왕보다 큰 수정 덩어리. 안쪽에서 빛이 일렁인다.' },
  sea: { w: 4, h: 8, make: lighthouse, name: '등대 바위', tip: '바다 한가운데 솟은 바위 위의 등대. 아무도 안 사는데 불이 켜져 있다.' },
  garden: { w: 6, h: 8, make: giantSunflower, name: '거인 해바라기', tip: '집보다 큰 해바라기. 고개를 숙이고 이쪽을 내려다본다.' },
  snow: { w: 5, h: 7, make: giantSnowman, name: '거인 눈사람', tip: '누가 이렇게 큰 눈사람을 만들었을까. 빨간 목도리가 조합 일꾼 것과 똑같다.' },
  volcano: { w: 6, h: 7, make: emberTree, name: '불씨 나무', tip: '다 타 버린 나무인데 속에서 아직 불씨가 빛난다. 가까이 가면 따뜻하다.' },
  ruins: { w: 5, h: 8, make: maskStatue, name: '가면 석상', tip: '조합 옷을 입은 커다란 석상. 가면을 쓰고 있다. 가면 아래 얼굴은 깎여 나가 있다.' },
};

// Where a field's landmark stands: a w x h block that is all plain wall (no lone props), as close to
// open ground as possible so you can see it, picked by the field's own seed. Null when nothing fits.
export function landmarkSpot(map, w, h, seed, WALL) {
  const W = map.w, H = map.h;
  const wall = (x, y) => x >= 0 && y >= 0 && x < W && y < H && map.tiles[y * W + x] === WALL && !map.props?.[y * W + x];
  let best = null;
  for (let y = 0; y + h <= H; y++) for (let x = 0; x + w <= W; x++) {
    let ok = true;
    for (let j = 0; j < h && ok; j++) for (let i = 0; i < w && ok; i++) if (!wall(x + i, y + j)) ok = false;
    if (!ok) continue;
    // open ground in front of it (below) counts double: that is where you stand to look up at it
    let near = 0;
    for (let j = -1; j < h + 3; j++) for (let i = -2; i < w + 2; i++) {
      const X = x + i, Y = y + j;
      if (X < 0 || Y < 0 || X >= W || Y >= H || (i >= 0 && i < w && j >= 0 && j < h)) continue;
      if (map.tiles[Y * W + X] !== WALL) near += j >= h ? 2 : 1;
    }
    const jitter = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
    const score = near * 8 + jitter % 7;
    if (near >= 6 && (!best || score > best.score)) best = { x, y, w, h, score };
  }
  return best;
}
