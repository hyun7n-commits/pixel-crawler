// Big things, for a sense of scale: a tree as tall as three houses in the village, and one huge
// thing in each zone's fields (a lone tree in the meadow, a giant mushroom in the deep forest, a lotus
// in the marsh, a stone head on the mountain, a crystal in the cave). Each is a canvas anchored at its
// foot; it is only ever looked at, never walked into (except the bit right under its trunk).

import { Pix, mixc } from './village-houses.js';

const rand = seed => { let s = seed * 977 + 13; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

// a crown of leafy clumps, each lit from the upper left, the ones in front shading the ones behind:
// the village tree's crown at a much bigger size
function crown(p, cx, cy, rx, ry, leaf, r, n = 18) {
  const clumps = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k + 0.5) * Math.PI * 2 / n + (r() - 0.5) * 0.3, cr = rx * (0.26 + r() * 0.08);
    clumps.push([cx + Math.cos(a) * (rx - cr * 0.9), cy + Math.sin(a) * (ry - cr * 0.9), cr]);
  }
  for (let k = 0; k < Math.round(n * 0.6); k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.55;
    clumps.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rx * (0.3 + r() * 0.08)]);
  }
  clumps.sort((a, b) => a[1] - b[1]);
  p.ell(cx, cy, rx - 2, ry - 2, leaf[4]);
  clumps.forEach(([x0, y0, cr], i) => {
    const below = clumps.slice(i + 1);
    p.ell(x0, y0, cr, cr * 0.92, (x, y, nx, ny) => {
      const T = -(0.5 * nx + 0.86 * ny) * 0.8 - (y - cy) / ry * 0.55;
      let t = T > 0.62 ? 0 : T > 0.15 ? 1 : T > -0.35 ? 2 : T > -0.75 ? 3 : 4;
      for (const e of [0.62, 0.15, -0.35, -0.75]) if (Math.abs(T - e) < 0.05 && (x + y) % 2 === 0) t = Math.max(0, t - 1);
      // the rim of a clump that sits in front of this one shades it
      if (below.some(([bx, by, br]) => by > y0 + 3 && (x + 0.5 - bx) ** 2 + (y + 1.5 - by) ** 2 <= br * br)) t = Math.min(4, t + 2);
      return leaf[t];
    });
  });
}

// a trunk: three tones, bark marks, roots spreading at the foot
function trunk(p, cx, top, gy, w, bark, r) {
  const [l, m, d] = bark;
  for (let y = top; y <= gy; y++) {
    const k = (y - top) / (gy - top), spread = k > 0.75 ? Math.round(((k - 0.75) / 0.25) ** 2 * w * 0.9) : 0;
    const x0 = Math.round(cx - w / 2 - spread), x1 = Math.round(cx + w / 2 + spread);
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      p.set(x, y, t < 0.22 ? l : t < 0.7 ? m : d);
    }
  }
  for (let k = 0; k < w * 1.6; k++) {
    const x = Math.round(cx - w / 2 + 3 + r() * (w - 6)), y = Math.round(top + 4 + r() * (gy - top - 10));
    p.rect(x, y, 1, 2 + Math.floor(r() * 4), d);
  }
}

const VILLAGE_LEAF = ['#a6df6e', '#71c452', '#4aa446', '#33833d', '#215f30'];
const BARK = ['#a7744a', '#8a5634', '#5e3a22'];

// The village's old tree: a crown as wide as a house and a half, a trunk you could not hug, and at
// the foot of it, between two roots, a door far too small for anyone you know.
export function bigTreeCanvas(leaf = VILLAGE_LEAF, line = '#12301c', bark = BARK, seed = 3, door = true, W = 144, H = 136) {
  const gy = H - 3, r = rand(seed), k = W / 144;
  const p = new Pix(W, H);
  trunk(p, W / 2, Math.round(60 * H / 136), gy, Math.round(24 * k), bark, r);
  crown(p, W / 2, Math.round(46 * H / 136), W / 2 - 3, Math.round(44 * H / 136), leaf, r);
  if (door) {
    // the tiny door
    const dx = W / 2 + 3, dy = gy - 8;
    p.rect(dx - 1, dy - 1, 6, 9, '#1b1424'); p.rect(dx, dy, 4, 8, '#6e4a2a'); p.set(dx + 3, dy + 4, '#f4cf4f');
    p.rect(dx + 1, dy - 1, 2, 1, '#1b1424');
  }
  p.outline(line);
  return finish(p, W * 0.64);
}

// the picture onto a canvas, over a soft round shadow `sw` wide at the foot
function finish(p, sw, shadow = 'rgba(8,14,10,0.3)') {
  const c = document.createElement('canvas');
  c.width = p.w; c.height = p.h;
  const g = c.getContext('2d');
  g.fillStyle = shadow;
  for (const [dy, f] of [[-5, 0.6], [-4, 0.82], [-3, 0.95], [-2, 1], [-1, 0.86], [0, 0.64]]) g.fillRect(Math.round(p.w / 2 - sw * f / 2), p.h - 3 + dy, Math.round(sw * f), 1);
  p.draw(g);
  return c;
}

// ---------- one big thing in each zone's fields ----------
// The forest's: a mushroom taller than the trees, its pale cap glowing faintly in the dark, a ring of
// ordinary-sized ones round its foot.
function giantMushroom() {
  const W = 96, H = 112, gy = H - 3, p = new Pix(W, H), r = rand(5);
  const cap = ['#dfe8f0', '#bcd0e0', '#93aec6', '#6a86a3', '#4c6582'], stem = ['#e8e0cc', '#c8bea6', '#968a72'];
  // stem, leaning a little, wider at the foot
  for (let y = 40; y <= gy; y++) {
    const k = (y - 40) / (gy - 40), w = 14 + k * k * 10, cx = W / 2 + 4 - k * 6;
    for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) {
      const t = (x - (cx - w / 2)) / w;
      p.set(x, y, t < 0.25 ? stem[0] : t < 0.72 ? stem[1] : stem[2]);
    }
  }
  // a skirt round the stem
  p.ell(W / 2 + 1, 62, 13, 4, (x, y, nx) => (nx < 0 ? stem[0] : stem[1]), (x, y) => y >= 61);
  // gills, then the cap
  p.ell(W / 2, 40, W / 2 - 2, 9, (x, y) => (x % 3 === 0 ? '#8c8478' : '#b8ad9a'), (x, y) => y >= 39);
  p.ell(W / 2, 40, W / 2 - 2, 38, (x, y, nx, ny) => {
    const T = -(0.55 * nx + 0.83 * ny);
    return cap[T > 0.78 ? 0 : T > 0.35 ? 1 : T > -0.1 ? 2 : T > -0.5 ? 3 : 4];
  }, (x, y) => y <= 40);
  // pale spots on the cap
  for (const [cx, cy, rr] of [[30, 14, 5], [56, 9, 4], [70, 24, 4.5], [44, 28, 3], [20, 30, 3], [62, 34, 2.5]]) p.ell(cx, cy, rr, rr * 0.8, '#f4f8fb');
  // little mushrooms at the foot, each the size of a hero's head
  for (const [cx, sz] of [[16, 1], [26, 0.8], [76, 1.1], [86, 0.75]]) {
    const top = gy - Math.round(10 * sz);
    p.rect(cx - 1, top + 3, 3, gy - top - 2, stem[1]);
    p.ell(cx + 0.5, top + 3, 5 * sz + 1, 4 * sz + 1, (x, y, nx) => (nx < -0.2 ? '#d07a6a' : '#a8524a'), (x, y) => y <= top + 3);
  }
  p.outline('#070d10');
  return finish(p, 60);
}

// The marsh's: a lily pad as wide as a room, and on it a lotus bud as tall as a house, not yet open.
function giantLotus() {
  const W = 96, H = 96, gy = H - 4, p = new Pix(W, H);
  const pad = ['#7d9a52', '#5f7d40', '#46602f', '#33461f'], pink = ['#f0c4d4', '#d898b0', '#b06e8c', '#80506a'];
  // the pad, a notch cut out of it
  p.ell(W / 2, gy - 12, W / 2 - 1, 13, (x, y, nx, ny) => {
    const vein = Math.abs(Math.atan2(ny, nx) * 4 % 1) < 0.08;
    return vein ? pad[2] : ny < -0.3 ? pad[0] : nx > 0.4 ? pad[2] : pad[1];
  });
  p.poly([[W / 2, gy - 12], [W / 2 + 18, gy + 2], [W / 2 + 4, gy + 2]], null);
  // the stalk and the bud, petals overlapping, lit from the left
  p.rect(W / 2 - 2, 40, 5, gy - 50, pad[1]); p.rect(W / 2 - 2, 40, 1, gy - 50, pad[0]);
  const petal = (cx, cy, rx, ry, base) => p.ell(cx, cy, rx, ry, (x, y, nx, ny) => {
    const T = -(0.6 * nx + 0.6 * ny);
    return pink[Math.max(0, Math.min(3, base + (T > 0.5 ? -1 : T < -0.4 ? 1 : 0)))];
  });
  petal(W / 2 - 9, 34, 10, 20, 2); petal(W / 2 + 9, 34, 10, 20, 2);
  petal(W / 2, 28, 12, 26, 1);
  petal(W / 2 - 5, 40, 8, 13, 0); petal(W / 2 + 6, 41, 8, 12, 1);
  for (let y = 6; y < 50; y += 5) p.set(W / 2, y, pink[2]);
  p.outline('#0a0f07');
  return finish(p, 80, 'rgba(6,12,10,0.35)');
}

// The mountain's: a stone head as big as a hut, half sunk into the slope, eyes shut, moss on its
// crown. (Nobody remembers who carved it. Nobody says who it looks like.)
export function stoneHead(open = false) {
  const W = 96, H = 100, gy = H - 3, p = new Pix(W, H), r = rand(9);
  const st = ['#b4b2aa', '#959389', '#77756c', '#5a5850', '#403e38'], moss = ['#7d9a62', '#5f7a4a', '#465c38'];
  p.ell(W / 2, 54, 40, 46, (x, y, nx, ny) => {
    const T = -(0.6 * nx + 0.7 * ny) + (r() - 0.5) * 0.12;
    return st[T > 0.6 ? 0 : T > 0.15 ? 1 : T > -0.3 ? 2 : T > -0.7 ? 3 : 4];
  }, (x, y) => y <= gy);
  // moss over the top of the head
  p.ell(W / 2 - 6, 14, 30, 12, (x, y, nx, ny) => moss[ny < -0.2 ? 0 : nx > 0.3 ? 2 : 1], (x, y) => p.get(x, y) && (y < 16 || ((x * 7 + y * 3) % 5 > 1 && y < 22)));
  // brow, eyes, nose, a small sad mouth
  p.rect(22, 40, 20, 3, st[3]); p.rect(54, 40, 20, 3, st[3]);
  if (open) {
    for (const ex of [32, 64]) { p.ell(ex, 50, 7, 6, '#1b1424'); p.ell(ex, 50, 4.5, 4, '#f4e9c0'); p.ell(ex + 1, 51, 2, 2, '#1b1424'); }
  } else {
    for (const ex of [26, 58]) { p.rect(ex, 50, 13, 2, st[4]); p.rect(ex + 1, 52, 11, 1, st[2]); }
  }
  p.poly([[W / 2 - 2, 46], [W / 2 + 6, 66], [W / 2 - 6, 66]], st[3]); p.rect(W / 2 - 6, 66, 12, 2, st[4]);
  p.rect(W / 2 - 8, 76, 16, 2, st[4]); p.set(W / 2 - 9, 78, st[4]); p.set(W / 2 + 8, 78, st[4]);
  // cracks
  for (const [x, y, n] of [[16, 30, 6], [74, 60, 7], [60, 20, 4]]) for (let k = 0; k < n; k++) p.set(x + (k % 2), y + k, st[4]);
  // rubble at the foot
  for (const [cx, rr] of [[10, 5], [86, 6], [18, 3.5], [78, 3]]) p.ell(cx, gy - rr + 1, rr + 1, rr, (x, y, nx) => st[nx < 0 ? 1 : 3]);
  p.outline('#18191e');
  return finish(p, 82);
}

// The cave's: a crystal cluster taller than the bat lord, glowing violet and ice blue.
function giantCrystal() {
  const W = 80, H = 104, gy = H - 3, p = new Pix(W, H);
  const blue = ['#d8f4ff', '#9fd8f0', '#5aa8cc', '#36708f'], violet = ['#ecd8ff', '#c49aff', '#8e62c8', '#5a3c88'];
  const shard = (bx, w, h, lean, pal) => {
    const tip = [bx + lean, gy - h], l = [bx - w / 2, gy - h * 0.18], rr = [bx + w / 2, gy - h * 0.15];
    p.poly([[bx - w / 2, gy + 1], l, [tip[0] - w * 0.18, tip[1] + w * 0.6], tip, [tip[0] + w * 0.18, tip[1] + w * 0.6], rr, [bx + w / 2, gy + 1]], (x, y) => {
      const f = (x - (bx - w / 2)) / w;
      return pal[f < 0.3 ? 0 : f < 0.55 ? 1 : f < 0.8 ? 2 : 3];
    });
    p.line(tip[0], tip[1] + 3, bx + lean * 0.2, gy - 6, pal[0]);
  };
  shard(22, 18, 58, -8, violet);
  shard(60, 16, 50, 9, blue);
  shard(40, 24, 96, 2, blue);
  shard(30, 12, 34, -5, blue);
  shard(52, 12, 30, 4, violet);
  p.outline('#0c0a12');
  return finish(p, 64, 'rgba(10,6,20,0.35)');
}

// the meadow's: one old tree standing alone in the pasture, crown silver-green in the dark, and the
// same tiny door between its roots as the one in the village
const meadowTree = () => bigTreeCanvas(['#86a466', '#6a8a52', '#526e42', '#3c5636', '#283c28'], '#0b160e', ['#7a6450', '#5e4a3a', '#3e3026'], 11, true, 112, 120);

// size in tiles of each zone's landmark, and what looking at it says
export const LANDMARKS = {
  meadow: { w: 7, h: 8, make: meadowTree, name: '외딴 고목', tip: '들판 한가운데 혼자 선 아주 큰 나무. 뿌리 사이에 작은 문이 있다.' },
  forest: { w: 6, h: 7, make: giantMushroom, name: '거인 버섯', tip: '나무보다 큰 버섯. 갓이 어둠 속에서 희미하게 빛난다.' },
  marsh: { w: 6, h: 6, make: giantLotus, name: '거인 연꽃', tip: '방만 한 연잎 위에 집채만 한 꽃봉오리. 아직 안 피었다.' },
  rock: { w: 6, h: 7, make: () => stoneHead(false), name: '돌 얼굴', tip: '산비탈에 반쯤 묻힌 커다란 돌 얼굴. 눈을 감고 있다.' },
  cave: { w: 5, h: 7, make: giantCrystal, name: '거인 수정', tip: '박쥐 왕보다 큰 수정 덩어리. 안쪽에서 빛이 일렁인다.' },
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

