// Map generation, path distances, line of sight and field of view.
// Tiles: 0 = wall, 1 = floor, 2 = stairs down, 3 = door, 4 = big ore (blocks walking, not sight), 5 = stairs up.
// Like Shattered Pixel Dungeon, rooms are walled boxes joined by one-tile corridors,
// and a corridor only ever meets a room through a door. A door hides the room until
// someone stands in it.
// Floor features (brush, water...) live in map.ter, see data/terrain.js.

import { MAP_W as W, MAP_H as H, SIGHT } from '../data/balance.js';
import { T } from '../data/terrain.js';
import { rint, pick, shuffle, DIRS8 } from './util.js';

export const WALL = 0, FLOOR = 1, STAIRS = 2, DOOR = 3, ORE = 4, UPSTAIRS = 5;
export const isStairs = t => t === STAIRS || t === UPSTAIRS;

export function createMap() {
  const n = W * H;
  return {
    w: W, h: H,
    tiles: new Uint8Array(n),
    explored: new Uint8Array(n),
    visible: new Uint8Array(n),
    ter: new Uint8Array(n),
    fire: new Uint8Array(n),      // turns of fire left
    open: new Uint8Array(n),      // 1 on a door someone is standing in
    room: new Int16Array(n).fill(-1),
    gas: { sleep: new Float32Array(n), mine: new Float32Array(n) },
    doors: [],
    vents: [],
    ore: null,                    // the floor's big ore: { x, y, hits }
    up: null, down: null,         // where the stairs are, for arriving from above or below
  };
}

export const idx = (x, y) => y * W + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const passable = (map, x, y) => {
  if (!inMap(x, y)) return false;
  const t = map.tiles[idx(x, y)];
  return t !== WALL && t !== ORE;
};
export const opaque = (map, x, y) => {
  if (!inMap(x, y)) return true;
  const i = idx(x, y), t = map.tiles[i];
  return t === WALL || (t === DOOR && !map.open[i]) || map.ter[i] === T.BRUSH;
};
export const isBorder = (x, y) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1;

// ---------- rooms and corridors ----------
const GAP = 3; // between two rooms: wall, corridor, wall
const SIDES = ['top', 'bottom', 'left', 'right'];

// Returns the rooms ordered from the start room outward.
export function carveRooms(map) {
  let rooms = [];
  for (let t = 0; t < 600 && rooms.length < 10; t++) {
    const rw = rint(4, 8), rh = rint(4, 6);
    const x = rint(2, W - rw - 2), y = rint(2, H - rh - 2);
    if (rooms.some(r => x < r.x + r.w + GAP && x + rw + GAP > r.x && y < r.y + r.h + GAP && y + rh + GAP > r.y)) continue;
    rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1), doors: {} });
  }
  const gap = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
  const order = [rooms[0]], rest = rooms.slice(1);
  while (rest.length) {
    const last = order[order.length - 1];
    rest.sort((a, b) => gap(a, last) - gap(b, last));
    order.push(rest.shift());
  }
  rooms = order;
  rooms.forEach((r, i) => { r.id = i; fillRect(map, r.x, r.y, r.w, r.h, i); });

  // a corridor may not cross a room or its wall
  const reserved = new Uint8Array(W * H);
  for (const r of rooms) {
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) reserved[idx(x, y)] = 1;
  }

  // a spanning tree by distance, plus two short loops so there is more than one way around
  const inTree = new Set([rooms[0]]), links = [];
  while (inTree.size < rooms.length) {
    let best = null;
    for (const a of inTree) for (const b of rooms) {
      if (!inTree.has(b) && (!best || gap(a, b) < gap(...best))) best = [a, b];
    }
    links.push(best);
    inTree.add(best[1]);
  }
  for (let n = 0; n < 2; n++) {
    const a = pick(rooms), b = rooms.filter(o => o !== a).sort((p, q) => gap(a, p) - gap(a, q))[1];
    if (b && !links.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) links.push([a, b]);
  }
  for (const [a, b] of links) connect(map, reserved, a, b);

  // anything still cut off gets joined to the nearest reachable room, or removed
  for (let pass = 0; pass < 3; pass++) {
    const dm = distMap(map, rooms[0].cx, rooms[0].cy);
    const cut = rooms.filter(r => dm[idx(r.cx, r.cy)] >= 9999);
    if (!cut.length) break;
    for (const r of cut) {
      const near = rooms.filter(o => dm[idx(o.cx, o.cy)] < 9999).sort((p, q) => gap(r, p) - gap(r, q));
      if (near.some(o => connect(map, reserved, r, o))) continue;
      if (pass === 2) wipeRoom(map, r);
    }
  }
  const dm = distMap(map, rooms[0].cx, rooms[0].cy);
  return rooms.filter(r => dm[idx(r.cx, r.cy)] < 9999);
}

// The wall tile on one side of a room where a door goes, and the corridor tile just outside it.
// A room gets at most one door per side, shared by every corridor that arrives there.
function doorSpot(r, side) {
  if (r.doors[side]) return r.doors[side];
  let x, y, ox = 0, oy = 0;
  if (side === 'top' || side === 'bottom') {
    x = rint(r.x, r.x + r.w - 1);
    y = side === 'top' ? r.y - 1 : r.y + r.h;
    oy = side === 'top' ? -1 : 1;
  } else {
    y = rint(r.y, r.y + r.h - 1);
    x = side === 'left' ? r.x - 1 : r.x + r.w;
    ox = side === 'left' ? -1 : 1;
  }
  return { x, y, out: { x: x + ox, y: y + oy }, side };
}

function sidesToward(a, b) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  const h = dx > 0 ? 'right' : 'left', v = dy > 0 ? 'bottom' : 'top';
  return Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h];
}

// Digs a corridor from a door of room a to a door of room b. Returns false if no way was found.
function connect(map, reserved, a, b) {
  const tries = [];
  for (const sa of [...sidesToward(a, b), ...SIDES]) for (const sb of [...sidesToward(b, a), ...SIDES]) {
    if (!tries.some(([p, q]) => p === sa && q === sb)) tries.push([sa, sb]);
  }
  for (const [sa, sb] of tries.slice(0, 10)) {
    const da = doorSpot(a, sa), db = doorSpot(b, sb);
    if (isBorder(da.out.x, da.out.y) || isBorder(db.out.x, db.out.y)) continue;
    if (reserved[idx(da.out.x, da.out.y)] || reserved[idx(db.out.x, db.out.y)]) continue;
    const path = corridorPath(reserved, da.out, db.out);
    if (!path) continue;
    for (const [x, y] of path) if (map.tiles[idx(x, y)] === WALL) map.tiles[idx(x, y)] = FLOOR;
    for (const [r, d] of [[a, da], [b, db]]) {
      if (r.doors[d.side]) continue;
      r.doors[d.side] = d;
      map.tiles[idx(d.x, d.y)] = DOOR;
      map.doors.push({ x: d.x, y: d.y });
    }
    return true;
  }
  return false;
}

// Shortest 4-way path through rock that stays clear of every room and its walls.
function corridorPath(reserved, from, to) {
  const prev = new Int32Array(W * H).fill(-1), start = idx(from.x, from.y), goal = idx(to.x, to.y);
  const q = [start];
  prev[start] = start;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (i === goal) break;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
      const nx = x + dx, ny = y + dy, j = idx(nx, ny);
      if (isBorder(nx, ny) || prev[j] !== -1 || reserved[j]) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  if (prev[goal] === -1) return null;
  const path = [];
  for (let i = goal; ; i = prev[i]) { path.push([i % W, (i / W) | 0]); if (i === start) break; }
  return path;
}

function wipeRoom(map, r) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    map.tiles[idx(x, y)] = WALL;
    map.room[idx(x, y)] = -1;
  }
  for (const d of Object.values(r.doors)) {
    map.tiles[idx(d.x, d.y)] = WALL;
    map.doors = map.doors.filter(o => o.x !== d.x || o.y !== d.y);
  }
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
