// Map generation, path distances, line of sight and field of view.
// Tiles: 0 = wall, 1 = floor, 2 = stairs down, 3 = door, 4 = big ore (blocks walking, not sight), 5 = stairs up,
// 6 = grave (blocks walking, not sight), 7 = locked door (blocks both until opened with the floor's key),
// 8 = the honey stump (blocks walking, not sight).
// Like Shattered Pixel Dungeon, rooms are walled boxes packed side by side, joined by doors in
// their shared walls (see carveRooms). A door hides the room until someone stands in it.
// Floor features (brush, water...) live in map.ter, see data/terrain.js.

import { MAP_W as W, MAP_H as H, SIGHT } from '../data/balance.js';
import { T } from '../data/terrain.js';
import { rint, pick, DIRS8 } from './util.js';

export const WALL = 0, FLOOR = 1, STAIRS = 2, DOOR = 3, ORE = 4, UPSTAIRS = 5, GRAVE = 6, LOCKED = 7, HIVE = 8, WEED = 9;
// tiles you bump into to use: mine, dig, unlock, take the honey
export const isBump = t => t === ORE || t === GRAVE || t === LOCKED || t === HIVE || t === WEED;
export const isStairs = t => t === STAIRS || t === UPSTAIRS;

export function createMap() {
  const n = W * H;
  return {
    w: W, h: H,
    tiles: new Uint8Array(n),
    explored: new Uint8Array(n),
    visible: new Uint8Array(n),
    ter: new Uint8Array(n),
    hidden: new Uint8Array(n),    // 1 on a trap you have not spotted yet (drawn as plain floor)
    fire: new Uint8Array(n),      // turns of fire left
    open: new Uint8Array(n),      // 1 on a door someone is standing in
    room: new Int16Array(n).fill(-1),
    gas: { sleep: new Float32Array(n), mine: new Float32Array(n) },
    doors: [],
    vents: [],
    lights: [],                   // miners' lamps hung on wall faces: { x, y } of the wall tile
    ores: [],                     // the floor's big ores: { x, y, hits, tier, vent }
    up: null, down: null,         // where the stairs are, for arriving from above or below
  };
}

export const idx = (x, y) => y * W + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const passable = (map, x, y) => {
  if (!inMap(x, y)) return false;
  const t = map.tiles[idx(x, y)];
  return t !== WALL && !isBump(t);
};
export const opaque = (map, x, y) => {
  if (!inMap(x, y)) return true;
  const i = idx(x, y), t = map.tiles[i];
  return t === WALL || t === LOCKED || (t === DOOR && !map.open[i]) || map.ter[i] === T.BRUSH;
};
export const isBorder = (x, y) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1;

// ---------- rooms ----------
// Like Shattered Pixel Dungeon's loop builder: the main rooms sit around one big loop, the start on
// one side and the stairs on the far side, each joined to the next by a winding passage. You can walk
// the floor round either way instead of in and out of a middle. A few side rooms hang off the loop
// (dead ends, where vaults and trap rooms go), and sometimes a hall in the middle cuts across it like
// a figure eight. Rooms come in shapes: plain, cave, round, cross, ring (a block in the middle),
// pillars and L.
// A box is given by its walls: x0..x1, y0..y1 inclusive; the floor inside is x0+1..x1-1.

const box = (x0, y0, w, h, kind) => ({ x0, y0, x1: x0 + w + 1, y1: y0 + h + 1, kind, links: [] });
// boxes keep at least one tile of rock between their walls, for the passages to run through
const clash = (a, b) => a.x0 - 1 <= b.x1 && b.x0 - 1 <= a.x1 && a.y0 - 1 <= b.y1 && b.y0 - 1 <= a.y1;
const fits = b => b.x0 >= 1 && b.y0 >= 1 && b.x1 <= W - 2 && b.y1 <= H - 2;
const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const midOf = b => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });

export function carveRooms(map) {
  for (let attempt = 0; attempt < 120; attempt++) {
    map.tiles.fill(WALL); map.room.fill(-1); map.doors = []; map.passage = [];
    const rooms = buildLoop(map);
    if (rooms) return rooms;
  }
  throw new Error('no floor layout');
}

// A box of the given size centred near (px, py), nudged a little until it fits among the others.
function placeBox(boxes, px, py, w, h, kind) {
  for (let t = 0; t < 30; t++) {
    const s = t < 10 ? 0 : t < 20 ? 1 : 2;
    const ww = Math.max(3, w - s), hh = Math.max(3, h - s);
    const b = box(Math.round(px - (ww + 1) / 2) + rint(-s, s), Math.round(py - (hh + 1) / 2) + rint(-s, s), ww, hh, kind);
    if (fits(b) && !boxes.some(o => clash(o, b))) return b;
  }
  return null;
}

function buildLoop(map) {
  const boxes = [];
  const n = rint(6, 8), cx = W / 2 + rint(-1, 1), cy = H / 2 + rint(-1, 1);
  const rx = rint(13, 15), ry = rint(8, 10), a0 = Math.random() * Math.PI * 2, turn = Math.random() < 0.5 ? 1 : -1;
  const stairsAt = Math.round(n / 2);
  // the main loop
  const main = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + turn * (i * 2 * Math.PI) / n + (Math.random() - 0.5) * 0.35, f = 0.85 + Math.random() * 0.2;
    const kind = i === 0 ? 'start' : i === stairsAt ? 'stairs' : Math.random() < 0.2 ? 'large' : 'room';
    const [w, h] = kind === 'start' || kind === 'stairs' ? [rint(4, 6), rint(4, 5)] : kind === 'large' ? [rint(7, 9), rint(6, 7)] : [rint(5, 8), rint(4, 7)];
    const b = placeBox(boxes, cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f, w, h, kind);
    if (!b) return null;
    b.angle = a;
    boxes.push(b); main.push(b);
  }
  const links = main.map((b, i) => [b, main[(i + 1) % n]]);
  // a hall across the middle, joining the two halves of the loop (a figure eight)
  if (Math.random() < 0.55) {
    const q = Math.max(1, Math.round(n / 4));
    const c = placeBox(boxes, cx, cy, rint(5, 8), rint(4, 5), 'room');
    if (c) { boxes.push(c); links.push([main[q], c], [c, main[(stairsAt + q) % n]]); }
  }
  // side rooms off the loop, out toward the edge or in toward the middle: dead ends
  const sides = rint(3, 5);
  for (let k = 0, t = 0; k < sides && t < 12; t++) {
    const w = rint(4, 6), h = rint(3, 5), spots = [];
    for (const m of main.slice(1)) for (let gap = 2; gap <= 5; gap++) for (const [ax, ay] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const mx = Math.round((m.x0 + m.x1) / 2 - (w + 1) / 2) + rint(-2, 2), my = Math.round((m.y0 + m.y1) / 2 - (h + 1) / 2) + rint(-2, 2);
      const x0 = ax < 0 ? m.x0 - gap - w - 2 : ax > 0 ? m.x1 + gap + 1 : mx;
      const y0 = ay < 0 ? m.y0 - gap - h - 2 : ay > 0 ? m.y1 + gap + 1 : my;
      const sb = box(x0, y0, w, h, 'side');
      if (fits(sb) && !boxes.some(o => clash(o, sb))) spots.push([m, sb]);
    }
    if (!spots.length) continue;
    const [m, sb] = pick(spots);
    boxes.push(sb); links.push([m, sb]); k++;
  }

  // shape the rooms, then join them
  for (const b of boxes) shapeBox(b);
  for (const [a, b] of links) if (!join(map, boxes, a, b)) return null;

  // carve
  const rooms = [];
  for (const b of boxes) {
    const r = { x: b.x0 + 1, y: b.y0 + 1, w: b.x1 - b.x0 - 1, h: b.y1 - b.y0 - 1, kind: b.kind === 'stairs' ? 'room' : b.kind, stairs: b.kind === 'stairs', shape: b.shape };
    const id = boxes.indexOf(b);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (!b.mask[y][x]) continue;
      map.tiles[idx(r.x + x, r.y + y)] = FLOOR;
      map.room[idx(r.x + x, r.y + y)] = id;
    }
    // the middle: the floor tile nearest the box's centre
    let best = null;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (!b.mask[y][x]) continue;
      const d = (x - (r.w - 1) / 2) ** 2 + (y - (r.h - 1) / 2) ** 2;
      if (!best || d < best.d) best = { x: r.x + x, y: r.y + y, d };
    }
    r.cx = best.x; r.cy = best.y;
    b.r = r;
    rooms.push(r);
  }
  for (const t of map.passage) map.tiles[t] = FLOOR;
  delete map.passage;
  for (const d of map.doors) map.tiles[idx(d.x, d.y)] = DOOR;

  // order from the start outward, and make sure every room can be reached
  const start = main[0].r;
  const dm = distMap(map, start.cx, start.cy);
  if (rooms.some(r => dm[idx(r.cx, r.cy)] >= 9999)) return null;
  rooms.sort((a, b) => (a === start ? -1 : b === start ? 1 : dm[idx(a.cx, a.cy)] - dm[idx(b.cx, b.cy)]));
  // map.room held each box's index; renumber to the sorted order
  const newId = boxes.map(b => rooms.indexOf(b.r));
  for (let i = 0; i < map.room.length; i++) if (map.room[i] >= 0) map.room[i] = newId[map.room[i]];
  rooms.forEach((r, i) => { r.id = i; });
  return rooms;
}

// Which tiles inside a box are floor. Start and stairs rooms stay open in the middle.
function shapeBox(b) {
  const w = b.x1 - b.x0 - 1, h = b.y1 - b.y0 - 1;
  const m = Array.from({ length: h }, () => Array(w).fill(true));
  const wall = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) m[y][x] = false; };
  const keepMiddle = b.kind === 'start' || b.kind === 'stairs';
  const options = ['rect', 'cave', 'cave'];
  if (w >= 5 && h >= 5) options.push('round', 'round', 'cross');
  if (w >= 6 && h >= 5) options.push('ell');
  if (w >= 7 && h >= 6 && !keepMiddle) options.push('ring', 'ring');
  if (w >= 7 && h >= 7) options.push('pillars');
  const shape = w < 4 || h < 4 || (b.kind === 'side' && Math.random() < 0.5) ? 'rect' : pick(options);
  b.shape = shape;
  if (shape === 'cave') {
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [w - 1, 0, -1, 1], [0, h - 1, 1, -1], [w - 1, h - 1, -1, -1]]) {
      if (Math.random() < 0.25) continue;
      wall(x, y);
      if (w >= 6 && h >= 5 && Math.random() < 0.6) { wall(x + sx, y); wall(x, y + sy); }
    }
    // a few bites out of the long walls
    for (let k = 0; w >= 5 && h >= 5 && k < (w + h) / 4; k++) {
      const side = rint(0, 3), t = side < 2 ? rint(1, w - 2) : rint(1, h - 2);
      if (side === 0) wall(t, 0); else if (side === 1) wall(t, h - 1); else if (side === 2) wall(0, t); else wall(w - 1, t);
    }
  } else if (shape === 'round') {
    const cut = Math.max(1, Math.floor(Math.min(w, h) / 2.6));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x), dy = Math.min(y, h - 1 - y);
      if (dx + dy < cut) wall(x, y);
    }
  } else if (shape === 'cross') {
    const cw = Math.floor(w / 3), ch = Math.floor(h / 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if ((x < cw || x >= w - cw) && (y < ch || y >= h - ch)) wall(x, y);
    }
  } else if (shape === 'ell') {
    const cw = Math.floor((w - 1) / 2), ch = Math.floor((h - 1) / 2), right = Math.random() < 0.5, down = Math.random() < 0.5;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) wall(right ? w - 1 - x : x, down ? h - 1 - y : y);
  } else if (shape === 'ring') {
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) wall(x, y);
  } else if (shape === 'pillars') {
    for (const [x, y] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) wall(x, y);
  }
  b.mask = m;
}

// Joins two boxes: a door in each, facing the other, and a winding passage between them through the rock.
function join(map, boxes, a, b) {
  const doorsOn = bx => map.doors.filter(d => (d.x === bx.x0 || d.x === bx.x1 || d.y === bx.y0 || d.y === bx.y1) && inBox(bx, d.x, d.y));
  // the spots in a box's wall where a door could go: the tile inside is floor, and no door right beside
  const spots = (bx, toward) => {
    const out = [], w = bx.x1 - bx.x0 - 1, h = bx.y1 - bx.y0 - 1, taken = doorsOn(bx);
    const add = (x, y, ix, iy, nx, ny) => {
      if (!bx.mask[iy]?.[ix]) return;
      if (taken.some(d => Math.abs(d.x - x) + Math.abs(d.y - y) <= 2)) return;
      const ox = x + nx, oy = y + ny;
      if (!inMap(ox, oy) || isBorder(ox, oy) || boxes.some(o => inBox(o, ox, oy))) return;
      const score = -Math.hypot(ox - toward.x, oy - toward.y) + Math.random() * 2;
      out.push({ x, y, ox, oy, score });
    };
    for (let x = 0; x < w; x++) { add(bx.x0 + 1 + x, bx.y0, x, 0, 0, -1); add(bx.x0 + 1 + x, bx.y1, x, h - 1, 0, 1); }
    for (let y = 0; y < h; y++) { add(bx.x0, bx.y0 + 1 + y, 0, y, -1, 0); add(bx.x1, bx.y0 + 1 + y, w - 1, y, 1, 0); }
    return out.sort((p, q) => q.score - p.score);
  };
  const sa = spots(a, midOf(b)).slice(0, 4), sb = spots(b, midOf(a)).slice(0, 4);
  for (const da of sa) for (const db of sb) {
    const path = passage(boxes, da, db, map.passage);
    if (!path) continue;
    map.passage.push(...path);
    map.doors.push({ x: da.x, y: da.y }, { x: db.x, y: db.y });
    a.links.push(b); b.links.push(a);
    return true;
  }
  return false;
}

// A winding way through rock from just outside one door to just outside the other, 4-way steps,
// around every box. Slightly random costs make it wander like a mine tunnel instead of a ruler line.
function passage(boxes, from, to, dug) {
  const n = W * H, cost = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const blocked = i => { const x = i % W, y = (i / W) | 0; return isBorder(x, y) || boxes.some(o => inBox(o, x, y)); };
  const s = idx(from.ox, from.oy), t = idx(to.ox, to.oy), dugSet = new Set(dug);
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = Math.random() * 1.5;
  cost[s] = 0;
  const open = [s];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (cost[open[k]] < cost[open[bi]]) bi = k;
    const c = open.splice(bi, 1)[0];
    if (c === t) break;
    const x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = idx(nx, ny);
      if (j !== t && blocked(j)) continue;
      // reuse an old passage cheaply (they join up into crossroads), else rock with a little noise
      const step = dugSet.has(j) ? 0.6 : 1 + noise[j];
      if (cost[c] + step < cost[j]) { cost[j] = cost[c] + step; prev[j] = c; if (!open.includes(j)) open.push(j); }
    }
  }
  if (cost[t] === Infinity) return null;
  const path = [];
  for (let c = t; c !== -1; c = prev[c]) path.push(c);
  return path;
}

// One large arena for boss floors, with four pillars for cover.
export function carveArena(map) {
  const rw = 17, rh = 13, x0 = (W - rw) >> 1, y0 = 2;
  fillRect(map, x0, y0, rw, rh, 0);
  for (const [i, j] of [[x0 + 4, y0 + 4], [x0 + rw - 5, y0 + 4], [x0 + 4, y0 + rh - 5], [x0 + rw - 5, y0 + rh - 5]]) {
    map.tiles[idx(i, j)] = WALL;
  }
  return {
    room: { x: x0, y: y0, w: rw, h: rh, cx: x0 + (rw >> 1), cy: y0 + (rh >> 1) },
    start: { x: x0 + (rw >> 1), y: y0 + rh - 2 },
    boss: { x: x0 + (rw >> 1), y: y0 + 2 },
  };
}

function fillRect(map, x0, y0, w, h, room) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    map.tiles[idx(x, y)] = FLOOR;
    map.room[idx(x, y)] = room;
  }
}

// ---------- distances and paths ----------
// Breadth-first step counts from (sx, sy) over walkable tiles, 8 directions.
// opts.exploredOnly: only through explored tiles · opts.block(x, y): extra tiles to avoid
export function distMap(map, sx, sy, opts = {}) {
  const dm = new Int32Array(W * H).fill(9999);
  const q = [[sx, sy]];
  dm[idx(sx, sy)] = 0;
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h], d = dm[idx(x, y)];
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (!passable(map, nx, ny)) continue;
      if (opts.exploredOnly && !map.explored[idx(nx, ny)]) continue;
      if (dm[idx(nx, ny)] <= d + 1) continue;
      if (opts.block && opts.block(nx, ny)) continue;
      dm[idx(nx, ny)] = d + 1;
      q.push([nx, ny]);
    }
  }
  return dm;
}

// Path from (fx, fy) to (tx, ty) over explored tiles, as a list of [x, y] steps.
// `avoid(x, y)` marks tiles to walk around when there is another way (the target is always allowed).
export function pathTo(map, fx, fy, tx, ty, avoid, block) {
  const tryPath = strict => {
    const dm = distMap(map, tx, ty, {
      exploredOnly: true,
      block: (x, y) => (x === fx && y === fy ? false : (block && block(x, y)) || (strict && avoid && avoid(x, y))),
    });
    if (dm[idx(fx, fy)] >= 9999) return null;
    const path = [];
    let x = fx, y = fy;
    while (!(x === tx && y === ty) && path.length < 200) {
      // among equally short steps, take the one that keeps closest to a straight line
      let best = null, bd = dm[idx(x, y)], be = Infinity;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny)) continue;
        const d = dm[idx(nx, ny)], e = (nx - tx) ** 2 + (ny - ty) ** 2;
        if (d < bd || (best && d === bd && e < be)) { bd = d; be = e; best = [nx, ny]; }
      }
      if (!best) break;
      path.push(best);
      [x, y] = best;
    }
    return path;
  };
  return tryPath(true) || tryPath(false) || [];
}

// ---------- sight ----------
// Bresenham line; blocked if any tile strictly between the ends blocks sight.
export function lineOfSight(map, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) break;
    if (opaque(map, x, y)) return false;
  }
  return true;
}

export function computeFOV(map, px, py, sight = SIGHT) {
  map.visible.fill(0);
  for (let y = py - sight; y <= py + sight; y++) {
    for (let x = px - sight; x <= px + sight; x++) {
      if (!inMap(x, y)) continue;
      if ((x - px) ** 2 + (y - py) ** 2 > sight * sight + 2) continue;
      if (lineOfSight(map, px, py, x, y)) { map.visible[idx(x, y)] = 1; map.explored[idx(x, y)] = 1; }
    }
  }
}
