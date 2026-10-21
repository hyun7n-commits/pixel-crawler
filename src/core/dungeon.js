// Map generation, path distances, line of sight and field of view.
// Tiles: 0 = wall, 1 = floor, 2 = stairs.

import { MAP_W as W, MAP_H as H, SIGHT } from '../data/balance.js';
import { rint, pick, DIRS8 } from './util.js';

export const WALL = 0, FLOOR = 1, STAIRS = 2;

export function createMap() {
  return {
    w: W, h: H,
    tiles: new Uint8Array(W * H),
    explored: new Uint8Array(W * H),
    visible: new Uint8Array(W * H),
  };
}

export const idx = (x, y) => y * W + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const passable = (map, x, y) => inMap(x, y) && map.tiles[idx(x, y)] !== WALL;

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
  for (const r of rooms) fillRect(map, r.x, r.y, r.w, r.h);

  const order = [rooms[0]], rest = rooms.slice(1);
  const gap = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
  while (rest.length) {
    const last = order[order.length - 1];
    rest.sort((a, b) => gap(a, last) - gap(b, last));
    order.push(rest.shift());
  }
  for (let i = 1; i < order.length; i++) corridor(map, order[i - 1], order[i]);
  for (let i = 0; i < 2; i++) corridor(map, pick(order), pick(order));
  return order;
}

// One large arena for boss floors, with four pillars for cover.
export function carveArena(map) {
  const rw = 17, rh = 13, x0 = (W - rw) >> 1, y0 = 2;
  fillRect(map, x0, y0, rw, rh);
  for (const [i, j] of [[x0 + 4, y0 + 4], [x0 + rw - 5, y0 + 4], [x0 + 4, y0 + rh - 5], [x0 + rw - 5, y0 + rh - 5]]) {
    map.tiles[idx(i, j)] = WALL;
  }
  return { start: { x: x0 + (rw >> 1), y: y0 + rh - 2 }, boss: { x: x0 + (rw >> 1), y: y0 + 2 } };
}

function fillRect(map, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) map.tiles[idx(x, y)] = FLOOR;
}

function corridor(map, a, b) {
  let x = a.cx, y = a.cy;
  const alongX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); map.tiles[idx(x, y)] = FLOOR; } };
  const alongY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); map.tiles[idx(x, y)] = FLOOR; } };
  if (Math.random() < 0.5) { alongX(); alongY(); } else { alongY(); alongX(); }
}

// Breadth-first step counts from (sx, sy) over walkable tiles, 8 directions.
export function distMap(map, sx, sy, exploredOnly = false) {
  const dm = new Int32Array(W * H).fill(9999);
  const q = [[sx, sy]];
  dm[idx(sx, sy)] = 0;
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h], d = dm[idx(x, y)];
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (!passable(map, nx, ny)) continue;
      if (exploredOnly && !map.explored[idx(nx, ny)]) continue;
      if (dm[idx(nx, ny)] <= d + 1) continue;
      dm[idx(nx, ny)] = d + 1;
      q.push([nx, ny]);
    }
  }
  return dm;
}

// Path from (fx, fy) to (tx, ty) over explored tiles, as a list of [x, y] steps.
export function pathTo(map, fx, fy, tx, ty) {
  const dm = distMap(map, tx, ty, true);
  if (dm[idx(fx, fy)] >= 9999) return [];
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
}

// Bresenham line; blocked if any tile strictly between the ends is a wall.
export function lineOfSight(map, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) break;
    if (!passable(map, x, y)) return false;
  }
  return true;
}

export function computeFOV(map, px, py) {
  map.visible.fill(0);
  for (let y = py - SIGHT; y <= py + SIGHT; y++) {
    for (let x = px - SIGHT; x <= px + SIGHT; x++) {
      if (!inMap(x, y)) continue;
      if ((x - px) ** 2 + (y - py) ** 2 > SIGHT * SIGHT + 2) continue;
      if (lineOfSight(map, px, py, x, y)) {
        map.visible[idx(x, y)] = 1;
        map.explored[idx(x, y)] = 1;
      }
    }
  }
}
