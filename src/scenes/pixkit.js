// Drawing the big things (houses, the giant tree, the fields' landmarks) at the same detail as the
// 16px tiles and props around them. The rule: a big thing gets more little features, never bigger
// ones. Leaves stay clumps the size of a village tree's, shingles a hand wide, stones a few pixels.
// Light comes from the upper left; shadows lean cool and purple, highlights warm; only the outside
// edge gets a dark line, and that line takes the colour of what it wraps (dark red round red, dark
// brown round cream), like the trees' dark green one.

export const INK = '#1b1424';
const hex = n => `#${n.toString(16).padStart(6, '0')}`;
const toInt = c => parseInt(c.slice(1), 16);
// blend two #rrggbb colours
export const mixc = (a, b, t) => {
  const pa = toInt(a), pb = toInt(b);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return hex((ch(16) << 16) | (ch(8) << 8) | ch(0));
};

// a ramp of six tones from a base colour: [lightest, light, base, shade, dark, darkest]
const WARM = '#fff4c4', COOL = '#2a1f44';
export const ramp = base => [mixc(base, WARM, 0.46), mixc(base, WARM, 0.22), base, mixc(base, COOL, 0.24), mixc(base, COOL, 0.45), mixc(base, COOL, 0.64)];

// repeatable noise: hash in 0..1 for a pixel, and a smooth version for patches (moss, wear)
export const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const smooth = (x, y, sc, s = 0) => {
  const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
// a tone index from a smooth value, with a narrow checker where two tones meet
export const tone = (R, v, x, y) => R[Math.max(0, Math.min(R.length - 1, Math.round(v + (bayer(x, y) - 0.5) * 0.3)))];
export const seeded = seed => { let s = (seed * 977 + 13) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

// A pixel buffer. Shapes fill in; `outline` then draws the edge just outside them in a dark version
// of the colour it touches. `front` pixels (grass at the foot, things standing before the wall) are
// drawn over the outline.
export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); this.f = []; }
  set(x, y, col) { x = Math.round(x); y = Math.round(y); if (col && x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col; }
  clear(x, y) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = null; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null; }
  // fill every pixel where `inside` holds with `col(x, y)` (or a colour)
  fill(x0, y0, x1, y1, inside, col) {
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      if (!inside || inside(x, y)) this.set(x, y, typeof col === 'function' ? col(x, y) : col);
    }
  }
  rect(x, y, w, h, col) { this.fill(x, y, x + w - 1, y + h - 1, null, typeof col === 'function' ? (px, py) => col(px, py, px - x, py - y) : col); }
  ell(cx, cy, rx, ry, col, clip) {
    this.fill(cx - rx - 1, cy - ry - 1, cx + rx, cy + ry, (x, y) => {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      return nx * nx + ny * ny <= 1 && (!clip || clip(x, y));
    }, typeof col === 'function' ? (x, y) => col(x, y, (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) : col);
  }
  poly(P, col, clip) {
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    this.fill(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, (x, y) => inPoly(P, x + 0.5, y + 0.5) && (!clip || clip(x, y)), col);
  }
  line(x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, typeof col === 'function' ? col(k, n) : col);
  }
  stamp(x, y, rows, pal) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && pal[ch]) this.set(x + i, y + j, pal[ch]); })); }
  outline(fallback = INK, dark = 0.74) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      // the neighbour below or beside decides the line's colour: the outline darkens what it wraps
      const n = this.get(x, y - 1) || this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y + 1);
      if (n) add.push([x, y, n]);
    }
    for (const [x, y, n] of add) this.set(x, y, n === fallback ? fallback : mixc(n, INK, dark));
  }
  // things drawn after the outline, over it
  front(x, y, col) { this.f.push([Math.round(x), Math.round(y), col]); }
  draw(g, ox = 0, oy = 0) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.c[y * this.w + x];
      if (c) { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); }
    }
    for (const [x, y, c] of this.f) { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); }
  }
  canvas(shadow) {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    if (shadow) shadow(g);
    this.draw(g);
    return c;
  }
}
export function inPoly(P, px, py) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A soft shadow on the grass: the sun is up and to the left, so it leans out to the lower right.
export function groundShadow(g, x0, x1, y, depth = 5, lean = 5, alpha = 0.26) {
  g.fillStyle = `rgba(16,34,20,${alpha})`;
  for (let k = 0; k < depth; k++) {
    const t = k / depth, inset = Math.round(Math.sin(t * Math.PI / 2) * 3 * (k === depth - 1 ? 2 : 1));
    g.fillRect(x0 + 2 + Math.round(lean * t) + inset, y - depth + 1 + k, x1 - x0 - 2 + Math.round(lean * (1 - t) * 0.6) - inset, 1);
  }
}

// ---------- materials ----------
// Each takes `inside(x, y)` for where it goes, a ramp, and `lit(x, y)`: how far from the base tone a
// pixel sits before texture (negative is lighter). Feature sizes match the small props.

// roof shingles: rows `rh` tall, shingles `sw` wide, every other row offset by half; each shingle's top
// sits in the shade of the row above, its lower corners round off, and a few are a tone off
export function shingles(p, box, inside, R, lit, o = {}) {
  const sw = o.sw || 6, rh = o.rh || 4, [bx0, by0, bx1, by1] = box, seed = o.seed || 1;
  p.fill(bx0, by0, bx1, by1, inside, (x, y) => {
    const ry = y - by0 - (o.yoff || 0), row = Math.floor(ry / rh), ly = ((ry % rh) + rh) % rh;
    const off = (row & 1) * (sw >> 1), lx = ((x + off) % sw + sw) % sw, col = Math.floor((x + off) / sw);
    let v = 2 + lit(x, y) + (hash(col, row, seed) - 0.5) * 0.9;
    if (ly === 0) v += 1.3;
    else if (lx === 0) v += 1.1;
    else if (ly === rh - 1 && lx === sw - 1) v += 0.9;
    else if (ly === 1 && lx === 1) v -= 0.8;
    if (o.moss && smooth(x, y, 6, seed) > (o.mossAt || 0.8) && ly > 0 && lx > 0) return tone(o.moss, 2 + lit(x, y) * 0.8 + (hash(x, y, 3) > 0.7 ? -1 : 0), x, y);
    return tone(R, v, x, y);
  });
}

// straw thatch: layers `bh` tall with ragged lower edges, each layer shading the top of the one
// below, combed into streaks
export function thatch(p, box, inside, R, lit, o = {}) {
  const bh = o.bh || 6, [bx0, by0, bx1, by1] = box, seed = o.seed || 2;
  p.fill(bx0, by0, bx1, by1, inside, (x, y) => {
    const ry = y - by0, band = Math.floor(ry / bh), ly = ry - band * bh;
    const rag = Math.floor(hash(x, band, seed) * 3);
    let v = 2 + lit(x, y);
    if (ly < 2 && band > 0) v += ly === 0 ? 1.5 : 0.9;           // the layer above hangs over this one
    if (ly >= bh - rag) v += 0.3;
    const streak = hash(x, Math.floor(ry / 3), seed + 1);
    if (streak < 0.22) v += 0.9; else if (streak > 0.86) v -= 0.8;
    if (hash(x, y, seed + 2) < 0.06) v -= 1;
    return tone(R, v, x, y);
  });
}

// lime plaster: a plain wall flecked with grit, with now and then a fine crack
export function plaster(p, box, inside, R, lit, o = {}) {
  const [bx0, by0, bx1, by1] = box, seed = o.seed || 3;
  p.fill(bx0, by0, bx1, by1, inside, (x, y) => {
    let v = 2 + lit(x, y);
    const h = hash(x, y, seed);
    if (h < 0.035) v += 0.8; else if (h > 0.975) v -= 0.7;
    if (smooth(x, y, 5, seed) > 0.72) v += 0.35;
    return tone(R, v, x, y);
  });
}

// rough stones of a few sizes laid in courses, each lit on its top left, mortar dark between them
export function stones(p, box, inside, R, lit, o = {}) {
  const [bx0, by0, bx1, by1] = box, seed = o.seed || 4, ch = o.ch || 4, wmin = o.wmin || 4, wmax = o.wmax || 8;
  // course by course, where each stone starts
  const courses = [];
  for (let y = by0, k = 0; y <= by1; y += ch, k++) {
    const r = seeded(seed * 31 + k), cuts = [];
    for (let x = bx0 - Math.floor(r() * wmax); x <= bx1; x += wmin + Math.floor(r() * (wmax - wmin + 1))) cuts.push(x);
    courses.push(cuts);
  }
  p.fill(bx0, by0, bx1, by1, inside, (x, y) => {
    const k = Math.floor((y - by0) / ch), ly = (y - by0) % ch, cuts = courses[k];
    let i = 0; while (i + 1 < cuts.length && cuts[i + 1] <= x) i++;
    const lx = x - cuts[i], w = (cuts[i + 1] ?? bx1 + 1) - cuts[i];
    if (ly === ch - 1 || lx === 0) return tone(R, 4.2 + lit(x, y) * 0.5, x, y);    // mortar
    let v = 2 + lit(x, y) + (hash(i, k, seed) - 0.5) * 1.1;
    if (ly === 0 || lx === 1) v -= 0.9;
    else if (ly === ch - 2 || lx === w - 1) v += 0.8;
    if ((ly === 0 && (lx === 1 || lx === w - 1)) || (ly === ch - 2 && (lx === 1 || lx === w - 1))) v += 0.6;
    return tone(R, v, x, y);
  });
}

// wooden boards side by side (`vert`: standing up), with the gaps dark and a little grain
export function planks(p, box, inside, R, lit, o = {}) {
  const [bx0, by0, bx1, by1] = box, pw = o.pw || 4, seed = o.seed || 5, vert = o.vert !== false;
  p.fill(bx0, by0, bx1, by1, inside, (x, y) => {
    const a = vert ? x - bx0 : y - by0, b = vert ? y : x, k = Math.floor(a / pw), la = a % pw;
    let v = 2 + lit(x, y) + (hash(k, 0, seed) - 0.5) * 0.8;
    if (la === pw - 1) v += 1.4;
    else if (la === 0) v -= 0.6;
    if (hash(k, Math.floor(b / 3), seed + 1) < 0.18 && la > 0 && la < pw - 1) v += 0.6;
    return tone(R, v, x, y);
  });
}

// a crown of leaves made of clumps the size of a village tree's (radius ~4.5-6.5 whatever the size of
// the crown), each lit from the upper left, the ones in front throwing a dark line on those behind,
// with a few single-pixel glints and specks. `shape(x, y)` says where the crown is.
export function foliage(p, box, shape, pal, o = {}) {
  const [bx0, by0, bx1, by1] = box, r = seeded(o.seed || 7), step = o.step || 6.2, rmin = o.rmin || 4.4, rmax = o.rmax || 6.4;
  const H = by1 - by0, clumps = [];
  // a jittered grid of clumps over the crown, a ring of them round the edge for a bumpy outline
  for (let y = by0 + 2; y <= by1 - 1; y += step * 0.8) for (let x = bx0 + 2; x <= bx1 - 1; x += step) {
    const cx = x + (r() - 0.5) * step * 0.8 + ((Math.round((y - by0) / step) & 1) ? step / 2 : 0), cy = y + (r() - 0.5) * step * 0.6;
    if (!shape(Math.round(cx), Math.round(cy))) continue;
    clumps.push([cx, cy, rmin + r() * (rmax - rmin)]);
  }
  clumps.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const W = p.w, own = new Int32Array(W * p.h).fill(-1);
  clumps.forEach(([cx, cy, cr], i) => {
    for (let y = Math.floor(cy - cr); y <= cy + cr; y++) for (let x = Math.floor(cx - cr); x <= cx + cr; x++) {
      if (x < 0 || y < 0 || x >= W || y >= p.h) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= cr * cr && shape(x, y, true)) own[y * W + x] = i;
    }
  });
  const mid = by0 + H * (o.mid ?? 0.45);
  for (let y = Math.max(0, by0 - 8); y <= Math.min(p.h - 1, by1 + 8); y++) for (let x = Math.max(0, bx0 - 8); x <= Math.min(W - 1, bx1 + 8); x++) {
    const i = own[y * W + x];
    if (i < 0) continue;
    const [cx, cy, cr] = clumps[i];
    const nx = (x + 0.5 - cx) / cr, ny = (y + 0.5 - cy) / cr;
    let T = -(0.5 * nx + 0.86 * ny) * 0.8 - (y - mid) / H * 1.5 - (o.side ? o.side(x, y) : 0);
    let t = T > 0.62 ? 0 : T > 0.16 ? 1 : T > -0.32 ? 2 : T > -0.78 ? 3 : 4;
    for (const e of [0.62, 0.16, -0.32, -0.78]) if (Math.abs(T - e) < 0.05 && (x + y) % 2 === 0) t = Math.max(0, t - 1);
    const below = y + 1 < p.h ? own[(y + 1) * W + x] : -1;
    if (below > i && clumps[below][1] > cy + 2.2) t = Math.min(4, t + (o.line || 2));
    const h = hash(x, y, o.seed || 7);
    if (t >= 1 && t <= 3 && h < 0.045) t -= 1;
    else if (t <= 2 && h > 0.965) t += 1;
    p.set(x, y, pal[t]);
  }
  return { own, clumps };
}

// little things scattered over a crown: fruit, blossoms, petals (only on lit, inner pixels)
export function sprinkle(p, box, own, n, seed, put) {
  const [bx0, by0, bx1, by1] = box, r = seeded(seed);
  for (let k = 0, done = 0; k < n * 12 && done < n; k++) {
    const x = Math.floor(bx0 + r() * (bx1 - bx0)), y = Math.floor(by0 + r() * (by1 - by0));
    if (own[y * p.w + x] < 0 || own[(y + 2) * p.w + x] < 0 || own[y * p.w + x + 2] < 0 || own[(y - 1) * p.w + x] < 0) continue;
    put(x, y); done++;
  }
}

// grass growing up over the foot of a wall, a flower here and there (drawn over the outline)
const GRASS = ['#acdc86', '#7cc45a', '#5aad58', '#3a8448'];
const FLOWERS = ['#fff7f0', '#f8b4cc', '#f4cf4f', '#e0646e', '#9fc2ff'];
export function tufts(p, x0, x1, gy, seed = 9, o = {}) {
  const r = seeded(seed), grass = o.grass || GRASS;
  for (let x = x0; x <= x1; x++) {
    if (r() < (o.gap ?? 0.35)) continue;
    const h = 1 + Math.floor(r() * (o.tall || 3));
    for (let k = 0; k < h; k++) p.front(x, gy - k, grass[Math.min(3, k === h - 1 ? 0 : 2 + (k & 1))]);
    if (r() < (o.flowers ?? 0.1)) { const f = FLOWERS[Math.floor(r() * FLOWERS.length)]; p.front(x, gy - h, f); }
  }
}

// ---------- house parts ----------
export const WOOD = ramp('#8a5634');
export const WOOD_WARM = ramp('#a5683c');
const GLASS_LIT = ['#fff6c8', '#ffe28a', '#f8c45a', '#e6963e'];
const GLASS_DARK = ['#6b6a80', '#4f4e64', '#3d3b50', '#2e2c3e'];

// A window: a wooden frame, warm light behind panes (or dark ones, nobody home), a sill, and maybe a
// flower box, curtains or shutters. (x, y) is the top left of the glass.
export function windowBox(p, x, y, w, h, o = {}) {
  const F = o.frame || WOOD, lived = o.lived !== false;
  p.rect(x - 1, y - 1, w + 2, h + 2, (px, py, i, j) => tone(F, i === 0 || j === 0 ? 1.4 : 3, px, py));
  p.rect(x, y, w, h, (px, py, i, j) => {
    const G = lived ? GLASS_LIT : GLASS_DARK;
    let v = (j / Math.max(1, h - 1)) * 2.4 + (j === 0 ? 0.6 : 0);
    if (lived && i + j < 3 && (i + j) % 2 === 0) v = 0;
    return G[Math.max(0, Math.min(3, Math.round(v)))];
  });
  // panes
  if (w >= 5) p.rect(x + (w >> 1), y, 1, h, tone(F, 3.3, x, y));
  if (h >= 5) p.rect(x, y + (h >> 1) - (h > 6 ? 1 : 0), w, 1, tone(F, 3.3, x, y));
  if (o.curtain && lived) {
    for (let j = 0; j < Math.min(h, 4); j++) { p.set(x, y + j, o.curtain[j < 2 ? 0 : 1]); if (j < 2) p.set(x + 1, y + j, o.curtain[1]); p.set(x + w - 1, y + j, o.curtain[1]); if (j < 2) p.set(x + w - 2, y + j, o.curtain[2] || o.curtain[1]); }
  }
  if (o.shutters) for (const sx of [x - 3, x + w + 1]) p.rect(sx, y - 1, 2, h + 2, (px, py, i, j) => tone(o.shutters, (j % 3 === 2 ? 3.2 : 2) + (i ? 0.6 : 0), px, py));
  // the sill
  p.rect(x - 2, y + h + 1, w + 4, 1, (px, py, i) => tone(F, i < 2 ? 0.6 : 1.2, px, py));
  p.rect(x - 2, y + h + 2, w + 4, 1, tone(F, 3.6, x, y));
  if (o.box) flowerBox(p, x - 1, y + h + 3, w + 2, o.box, o.seed || x * 7 + y);
}
export function roundWindow(p, cx, cy, rr, o = {}) {
  const F = o.frame || WOOD, lived = o.lived !== false;
  p.ell(cx, cy, rr + 1.2, rr + 1.2, (x, y, nx, ny) => tone(F, nx + ny < -0.4 ? 1.2 : 3, x, y));
  p.ell(cx, cy, rr, rr, (x, y, nx, ny) => {
    const G = lived ? GLASS_LIT : GLASS_DARK;
    if (lived && nx < -0.15 && ny < -0.15 && nx + ny < -0.7) return G[0];
    return G[Math.max(0, Math.min(3, Math.round((ny + 1) * 1.3)))];
  });
  p.rect(Math.round(cx - 0.5), Math.round(cy - rr), 1, Math.round(rr * 2), tone(F, 3.3, cx, cy));
  p.rect(Math.round(cx - rr), Math.round(cy - 0.5), Math.round(rr * 2), 1, tone(F, 3.3, cx, cy));
}
// a box of soil under a window, leaves spilling over and a few flowers
export function flowerBox(p, x, y, w, colours, seed) {
  const r = seeded(seed);
  p.rect(x, y, w, 3, (px, py, i, j) => tone(WOOD_WARM, j === 0 ? 1.4 : 2.6 + (i === w - 1 ? 0.8 : 0), px, py));
  for (let i = 0; i < w; i++) {
    const h = 1 + Math.floor(r() * 2);
    for (let k = 1; k <= h; k++) p.set(x + i, y - k, ['#3a8448', '#5aad58', '#7cc45a'][Math.min(2, k - 1 + (r() < 0.3 ? 1 : 0))]);
    if (i % 2 === 0 && r() < 0.75) p.set(x + i, y - h - 1, colours[Math.floor(r() * colours.length)]);
  }
  p.set(x + 1, y + 3, '#3a8448'); p.set(x + w - 2, y + 3, '#5aad58');
}
// A door: a frame, upright boards, two iron straps, a brass knob and a stone step. `arch`: rounded top.
// The empty houses have two boards nailed across.
export function doorway(p, cx, gy, w, h, o = {}) {
  const x = Math.round(cx - w / 2), y = gy - h + 1, D = o.wood || WOOD_WARM, Fr = o.frame || WOOD;
  const inDoor = (px, py) => !o.arch || py >= y + 2 || Math.hypot(px + 0.5 - (x + w / 2), py + 0.5 - (y + w / 2)) <= w / 2;
  // frame
  p.fill(x - 1, y - 1, x + w, gy, (px, py) => {
    if (!o.arch || py >= y + 2) return true;
    return Math.hypot(px + 0.5 - (x + w / 2), py + 0.5 - (y + w / 2)) <= w / 2 + 1.2;
  }, (px, py) => tone(Fr, px === x - 1 || py === y - 1 ? 1.6 : 3.2, px, py));
  // boards
  planks(p, [x, y, x + w - 1, gy], inDoor, D, (px, py) => (py - y) / h * 0.6 + (px - x === 0 ? 0.3 : 0), { pw: o.pw || 3, seed: cx });
  if (o.dark) p.fill(x, y, x + w - 1, gy, inDoor, (px, py) => tone(D, 3.4 + hash(px, py) * 0.6, px, py));
  for (const sy of [y + Math.round(h * 0.3), y + Math.round(h * 0.72)]) for (let i = 0; i < w - 1; i++) p.set(x + i, sy, i === 0 ? '#5e5a66' : (i & 1) ? '#3d3a48' : '#4b4858');
  p.set(x + w - 2, y + Math.round(h * 0.52), '#f4cf4f'); p.set(x + w - 2, y + Math.round(h * 0.52) + 1, '#b88a2a');
  if (o.boarded) for (const [a, b] of [[0.32, 0.5], [0.64, 0.8]]) p.line(x - 1, y + Math.round(h * a), x + w, y + Math.round(h * b), (k, n) => (k === 1 || k === n - 1 ? '#5e5a66' : '#c9a878'));
  // the step
  if (o.step !== false) p.rect(x - 2, gy - 1, w + 4, 2, (px, py, i, j) => tone(o.stone || STONE, j === 0 ? (i < 2 ? 0.8 : 1.4) : 3, px, py));
}
export const STONE = ramp('#a3a2ad');
// a lantern on a bracket: a small glowing box
export function lantern(p, x, y, lit = true) {
  p.rect(x, y, 3, 1, '#3d3a48'); p.set(x + 1, y + 1, '#3d3a48');
  p.rect(x, y + 2, 3, 4, lit ? '#ffe28a' : '#6b6a80'); p.set(x, y + 2, lit ? '#fff6c8' : '#8a8794');
  p.rect(x, y + 2, 3, 1, '#4b4858'); p.rect(x, y + 5, 3, 1, '#4b4858'); p.set(x + 1, y + 6, '#4b4858');
}
// a little board on two pegs with a picture on it (what the house is for)
const SIGN_ART = {
  flag: ['..k.....', '..krrr..', '..krrrrr', '..krr...', '..k.....', '..k.....'],
  coin: ['..kkkk..', '.kyyyyk.', 'kyyYyyyk', 'kyyYyyyk', '.kyyyyk.', '..kkkk..'],
  hammer: ['.kkkkkk.', '.kLLLLk.', '.kkLLkk.', '...nk...', '...nk...', '...nk...'],
  heart: ['.kk..kk.', 'kqqkkqqk', 'kqqqqqqk', '.kqqqqk.', '..kqqk..', '...kk...'],
  cross: ['...kk...', '..krrk..', '.kkrrkk.', 'krrrrrrk', '.kkrrkk.', '..krrk..'],
  star: ['...kk...', '...yy...', 'kyyyyyyk', '.kyyyyk.', '.kyk.yk.', '.k....k.'],
};
const SIGN_PAL = { k: '#3a2a2a', r: '#d9454a', y: '#f4cf4f', Y: '#c99a2b', L: '#b8bccb', n: '#a0703f', q: '#f29bb2' };
export function signboard(p, cx, y, kind, lived = true) {
  const x = Math.round(cx - 6);
  p.rect(x, y, 12, 9, (px, py, i, j) => tone(WOOD_WARM, i === 0 || j === 0 ? 3.4 : i === 11 || j === 8 ? 3.6 : j === 1 || i === 1 ? 0.6 : 1.4, px, py));
  if (lived) p.stamp(x + 2, y + 1, SIGN_ART[kind], SIGN_PAL);
  p.set(x + 2, y - 1, '#4b4858'); p.set(x + 9, y - 1, '#4b4858');
}
