// Map generation, path distances, line of sight and field of view.
// Tiles: 0 = wall, 1 = floor, 2 = stairs, 3 = crystal (blocks walking, not sight).
// Floor features (brush, water...) live in map.ter, see data/terrain.js.

import { MAP_W as W, MAP_H as H, SIGHT } from '../data/balance.js';
import { T } from '../data/terrain.js';
import { rint, pick, DIRS8 } from './util.js';

export const WALL = 0, FLOOR = 1, STAIRS = 2, CRYSTAL = 3;
export const ORE = 1, RUBBLE = 2; // map.ore values on wall tiles

export function createMap() {
  const n = W * H;
  return {
    w: W, h: H,
    tiles: new Uint8Array(n),
    explored: new Uint8Array(n),
    visible: new Uint8Array(n),
    ter: new Uint8Array(n),
    ore: new Uint8Array(n),       // ORE or RUBBLE on a wall
    dig: new Uint8Array(n),       // hits left before an ore/rubble wall breaks
    fire: new Uint8Array(n),      // turns of fire left
    room: new Int16Array(n).fill(-1),
    gas: { sleep: new Float32Array(n), poison: new Float32Array(n), mine: new Float32Array(n) },
    crystals: [],
    vents: [],
  };
}

export const idx = (x, y) => y * W + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const passable = (map, x, y) => {
  if (!inMap(x, y)) return false;
  const t = map.tiles[idx(x, y)];
  return t !== WALL && t !== CRYSTAL;
};
export const opaque = (map, x, y) => !inMap(x, y) || map.tiles[idx(x, y)] === WALL || map.ter[idx(x, y)] === T.BRUSH;
export const isBorder = (x, y) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1;

// Rooms joined by L-shaped corridors, plus two extra links so the map has loops.
// Returns the rooms ordered from the start room outward.
export function carveRooms(map) {
  const rooms = [];
  for (let t = 0; t < 400 && rooms.length < 10; t++) {
    const rw = rint(5, 9), rh = rint(4, 7);
    const x = rint(1, W - rw - 2), y = rint(1, H - rh - 2);
    const overlaps = rooms.some(r => x < r.x + r.w + 2 && x + rw + 2 > r.x && y < r.y + r.h + 2 && y + rh + 2 > r.y);
    if (!overlaps) rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
  }
  const order = [rooms[0]], rest = rooms.slice(1);
  const gap = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
  while (rest.length) {
    const last = order[order.length - 1];
    rest.sort((a, b) => gap(a, last) - gap(b, last));
    order.push(rest.shift());
  }
  order.forEach((r, i) => fillRect(map, r.x, r.y, r.w, r.h, i));
  for (let i = 1; i < order.length; i++) corridor(map, order[i - 1], order[i]);
  for (let i = 0; i < 2; i++) corridor(map, pick(order), pick(order));
  return order;
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

function corridor(map, a, b) {
  let x = a.cx, y = a.cy;
  const alongX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); map.tiles[idx(x, y)] = FLOOR; } };
  const alongY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); map.tiles[idx(x, y)] = FLOOR; } };
  if (Math.random() < 0.5) { alongX(); alongY(); } else { alongY(); alongX(); }
}

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
      let best = null, bd = dm[idx(x, y)];
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy;
        if (inMap(nx, ny) && dm[idx(nx, ny)] < bd) { bd = dm[idx(nx, ny)]; best = [nx, ny]; }
      }
      if (!best) break;
      path.push(best);
      [x, y] = best;
    }
    return path;
  };
  return tryPath(true) || tryPath(false) || [];
}

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

const LIT_RANGE = 12;   // how far away a lit crystal can be seen
const CRYSTAL_LIGHT = 2;

export function computeFOV(map, px, py) {
  map.visible.fill(0);
  const see = (x, y) => { map.visible[idx(x, y)] = 1; map.explored[idx(x, y)] = 1; };
  for (let y = py - SIGHT; y <= py + SIGHT; y++) {
    for (let x = px - SIGHT; x <= px + SIGHT; x++) {
      if (!inMap(x, y)) continue;
      if ((x - px) ** 2 + (y - py) ** 2 > SIGHT * SIGHT + 2) continue;
      if (lineOfSight(map, px, py, x, y)) see(x, y);
    }
  }
  // crystals light up the tiles around them, so you can see into far rooms
  for (const c of map.crystals) {
    if (map.tiles[idx(c.x, c.y)] !== CRYSTAL) continue;
    if (Math.max(Math.abs(c.x - px), Math.abs(c.y - py)) > LIT_RANGE) continue;
    if (!lineOfSight(map, px, py, c.x, c.y)) continue;
    for (let y = c.y - CRYSTAL_LIGHT; y <= c.y + CRYSTAL_LIGHT; y++) {
      for (let x = c.x - CRYSTAL_LIGHT; x <= c.x + CRYSTAL_LIGHT; x++) {
        if (inMap(x, y) && lineOfSight(map, px, py, x, y)) see(x, y);
      }
    }
  }
}
