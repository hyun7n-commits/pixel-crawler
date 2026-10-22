// Map generation, path distances, line of sight and field of view.
// Tiles: 0 = wall, 1 = floor, 2 = stairs down, 3 = door, 4 = big ore (blocks walking, not sight), 5 = stairs up,
// 6 = grave (blocks walking, not sight), 7 = locked door (blocks both until opened with the floor's key).
// Like Shattered Pixel Dungeon, rooms are walled boxes packed side by side, joined by doors in
// their shared walls (see carveRooms). A door hides the room until someone stands in it.
// Floor features (brush, water...) live in map.ter, see data/terrain.js.

import { MAP_W as W, MAP_H as H, SIGHT } from '../data/balance.js';
import { T } from '../data/terrain.js';
import { rint, pick, DIRS8 } from './util.js';

export const WALL = 0, FLOOR = 1, STAIRS = 2, DOOR = 3, ORE = 4, UPSTAIRS = 5, GRAVE = 6, LOCKED = 7;
// tiles you bump into to use: mine, dig, unlock
export const isBump = t => t === ORE || t === GRAVE || t === LOCKED;
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
// Like Shattered Pixel Dungeon, rooms are packed together and share their walls; a door in a
// shared wall joins two rooms. Each new room grows off the side of one already placed, so the
// floor comes out as one tight, irregular cluster with no long corridors through empty rock.
// Between the proper rooms there are narrow pieces too: straight halls and winding tunnels.
// A box is given by its walls: x0..x1, y0..y1 inclusive; the floor inside is x0+1..x1-1.

const SIDES = ['top', 'bottom', 'left', 'right'];
const SIZES = {
  start:  () => [rint(4, 6), rint(4, 6)],
  room:   () => [rint(4, 8), rint(4, 7)],
  large:  () => [rint(8, 11), rint(7, 9)],
  tunnel: () => [rint(3, 6), rint(3, 6)],
};

const box = (x0, y0, w, h, kind) => ({ x0, y0, x1: x0 + w + 1, y1: y0 + h + 1, kind, links: [] });
// two boxes may touch along a wall but never overlap inside
const clash = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;
const fits = b => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= W - 1 && b.y1 <= H - 1;

// The wall tiles two boxes share where a door could go (not at a corner), or [].
function sharedWall(a, b) {
  const out = [];
  if (a.x1 === b.x0 || b.x1 === a.x0) {
    const x = a.x1 === b.x0 ? a.x1 : a.x0;
    for (let y = Math.max(a.y0, b.y0) + 1; y <= Math.min(a.y1, b.y1) - 1; y++) out.push([x, y]);
  } else if (a.y1 === b.y0 || b.y1 === a.y0) {
    const y = a.y1 === b.y0 ? a.y1 : a.y0;
    for (let x = Math.max(a.x0, b.x0) + 1; x <= Math.min(a.x1, b.x1) - 1; x++) out.push([x, y]);
  }
  return out;
}

// A new box of `kind` against one side of `p`, sharing at least `minShare` tiles of wall.
function growFrom(p, kind, minShare = 2) {
  const side = pick(SIDES);
  let w, h;
  if (kind === 'hall') {
    const len = rint(3, 8);
    [w, h] = side === 'left' || side === 'right' ? [len, 1] : [1, len];
    minShare = 1;
  } else [w, h] = SIZES[kind]();
  let x0, y0;
  if (side === 'right' || side === 'left') {
    x0 = side === 'right' ? p.x1 : p.x0 - w - 1;
    y0 = rint(p.y0 - h + minShare - 1, p.y1 - minShare - 1);
  } else {
    y0 = side === 'bottom' ? p.y1 : p.y0 - h - 1;
    x0 = rint(p.x0 - w + minShare - 1, p.x1 - minShare - 1);
  }
  return box(x0, y0, w, h, kind);
}

function addDoor(map, a, b) {
  const spots = sharedWall(a, b).filter(([x, y]) =>
    !map.doors.some(d => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1));
  if (!spots.length) return false;
  const [x, y] = pick(spots);
  map.doors.push({ x, y });
  a.links.push(b); b.links.push(a);
  return true;
}

// Returns the proper rooms (not halls or tunnels), ordered from the start room outward.
export function carveRooms(map) {
  for (let attempt = 0; attempt < 60; attempt++) {
    map.tiles.fill(WALL); map.room.fill(-1); map.doors = [];
    const rooms = buildLayout(map);
    if (rooms) return rooms;
  }
  throw new Error('no floor layout');
}

function buildLayout(map) {
  const [sw, sh] = SIZES.start();
  const boxes = [box(rint(W / 2 - 8, W / 2 + 2), rint(H / 2 - 6, H / 2 + 1), sw, sh, 'start')];
  const want = rint(8, 10);
  let large = 0;
  for (let t = 0; t < 3000 && boxes.filter(b => b.kind !== 'hall' && b.kind !== 'tunnel').length < want; t++) {
    // halls and tunnels always lead on to a proper room, so grow off those first
    const open = boxes.filter(b => (b.kind === 'hall' || b.kind === 'tunnel') && b.links.length < 2);
    const parent = open.length && Math.random() < 0.8 ? pick(open) : pick(boxes);
    const roll = Math.random();
    let kind = roll < 0.18 ? 'hall' : roll < 0.28 ? 'tunnel' : roll < 0.38 && large < 2 ? 'large' : 'room';
    if ((parent.kind === 'hall' || parent.kind === 'tunnel') && kind === 'hall') kind = 'room';
    const b = growFrom(parent, kind);
    if (!fits(b) || boxes.some(o => clash(o, b))) continue;
    if (!addDoor(map, parent, b)) continue;
    if (kind === 'large') large++;
    boxes.push(b);
  }
  // a hall or tunnel that leads nowhere is filled back in
  for (let changed = true; changed;) {
    changed = false;
    for (const b of boxes.slice()) {
      if ((b.kind !== 'hall' && b.kind !== 'tunnel') || b.links.length >= 2) continue;
      for (const o of b.links) o.links.splice(o.links.indexOf(b), 1);
      map.doors = map.doors.filter(d => !(onBoxWall(b, d.x, d.y) && b.links.some(o => onBoxWall(o, d.x, d.y))));
      boxes.splice(boxes.indexOf(b), 1);
      changed = true;
    }
  }
  // a few extra doors between neighbours so there is more than one way around
  for (const a of boxes) for (const b of boxes) {
    if (a === b || a.links.includes(b) || boxes.indexOf(a) > boxes.indexOf(b)) continue;
    if (a.kind === 'hall' && b.kind === 'hall') continue;
    if (sharedWall(a, b).length && Math.random() < 0.3) addDoor(map, a, b);
  }
  // the stairs go in the proper room the longest walk away, and it sits on one loop with the start
  const walk = walkFrom(boxes[0]);
  // (a room stuck out on its own with nothing beside it can't be looped, so the next farthest is tried)
  const far = boxes.filter(b => b.kind === 'room' || b.kind === 'large')
    .sort((a, b) => walk.get(b) - walk.get(a)).slice(0, 4)
    .find(b => ringUp(map, boxes, boxes[0], b));
  if (!far) return null;
  far.stairs = true;

  // carve
  const rooms = [];
  for (const b of boxes) {
    const r = { x: b.x0 + 1, y: b.y0 + 1, w: b.x1 - b.x0 - 1, h: b.y1 - b.y0 - 1, kind: b.kind, stairs: !!b.stairs };
    r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1);
    b.r = r;
    if (b.kind === 'tunnel') continue;
    const id = b.kind === 'hall' ? -1 : rooms.length;
    fillRect(map, r.x, r.y, r.w, r.h, id);
    if (id >= 0) rooms.push(r);
  }
  for (const d of map.doors) map.tiles[idx(d.x, d.y)] = DOOR;
  // a tunnel is a block of rock with a winding path from each of its doors to its middle
  for (const b of boxes.filter(o => o.kind === 'tunnel')) {
    const r = b.r, hub = { x: rint(r.x, r.x + r.w - 1), y: rint(r.y, r.y + r.h - 1) };
    for (const d of map.doors.filter(o => onBoxWall(b, o.x, o.y))) {
      let x = Math.min(Math.max(d.x, r.x), r.x + r.w - 1), y = Math.min(Math.max(d.y, r.y), r.y + r.h - 1);
      const xFirst = Math.random() < 0.5;
      map.tiles[idx(x, y)] = FLOOR;
      while (x !== hub.x || y !== hub.y) {
        if ((xFirst && x !== hub.x) || y === hub.y) x += Math.sign(hub.x - x); else y += Math.sign(hub.y - y);
        map.tiles[idx(x, y)] = FLOOR;
      }
    }
  }
  if (rooms.length < 6) return null;
  shapeRooms(map, rooms);

  // order from the start outward, and make sure every room can be reached
  const dm = distMap(map, rooms[0].cx, rooms[0].cy);
  if (rooms.some(r => dm[idx(r.cx, r.cy)] >= 9999)) return null;
  const start = rooms[0];
  rooms.sort((a, b) => (a === start ? -1 : b === start ? 1 : dm[idx(a.cx, a.cy)] - dm[idx(b.cx, b.cy)]));
  rooms.forEach((r, i) => {
    r.id = i;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (map.room[idx(x, y)] >= 0) map.room[idx(x, y)] = i;
  });
  return rooms;
}

// Makes two separate ways between the start and the stairs room, so the floor is a loop you can walk
// round instead of one corridor out and the same one back: every door the only route depends on
// gets a second way around it, through a new door between two boxes on either side of it.
// A new hall or tunnel off a box outside `side` that also touches a box inside it, with a door to each.
function bridgeWith(map, boxes, side) {
  const out = boxes.filter(b => !side.has(b) && b.kind !== 'hall');
  for (let t = 0; t < 300; t++) {
    const b = pick(out), c = growFrom(b, Math.random() < 0.5 ? 'hall' : 'tunnel');
    if (!fits(c) || boxes.some(o => clash(o, c))) continue;
    const a = [...side].find(o => o.kind !== 'hall' && sharedWall(o, c).length);
    if (!a || !addDoor(map, b, c)) continue;
    if (!addDoor(map, c, a)) {
      map.doors.pop(); b.links.pop(); c.links.length = 0;
      continue;
    }
    boxes.push(c);
    return true;
  }
  return false;
}

// Rough walking distance from box `from` to every box, going door to door between box middles.
function walkFrom(from) {
  const mid = b => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  const walk = new Map([[from, 0]]), todo = [from];
  while (todo.length) {
    const b = todo.shift();
    for (const o of b.links) {
      const d = walk.get(b) + Math.abs(mid(b)[0] - mid(o)[0]) + Math.abs(mid(b)[1] - mid(o)[1]);
      if (!walk.has(o) || d < walk.get(o)) { walk.set(o, d); todo.push(o); }
    }
  }
  return walk;
}

function ringUp(map, boxes, start, far) {
  const same = (e, a, b) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a);
  const reach = cut => {
    const seen = new Set([start]), todo = [start];
    while (todo.length) {
      const b = todo.pop();
      for (const o of b.links) if (!seen.has(o) && !(cut && same(cut, b, o))) { seen.add(o); todo.push(o); }
    }
    return seen;
  };
  const route = () => {
    const from = new Map([[start, null]]), todo = [start];
    while (todo.length) {
      const b = todo.shift();
      for (const o of b.links) if (!from.has(o)) { from.set(o, b); todo.push(o); }
    }
    const edges = [];
    for (let b = far; from.get(b); b = from.get(b)) edges.push([from.get(b), b]);
    return edges;
  };
  for (let tries = 0; tries < 12; tries++) {
    const bridge = route().find(e => !reach(e).has(far));
    if (!bridge) return true;
    const side = reach(bridge), pairs = [];
    // the way round should be a real second way, not a shortcut: prefer a door far from both ends
    const fromStart = walkFrom(start), fromFar = walkFrom(far);
    for (const a of side) for (const b of boxes) {
      if (side.has(b) || a.links.includes(b) || (a.kind === 'hall' && b.kind === 'hall')) continue;
      if (sharedWall(a, b).length) pairs.push([a, b, fromStart.get(a) + fromFar.get(b) + 6 * Math.random()]);
    }
    if (pairs.sort((p, q) => q[2] - p[2]).some(([a, b]) => addDoor(map, a, b))) continue;
    // nothing on the two sides touches: dig a short hall or tunnel that joins them
    if (!bridgeWith(map, boxes, side)) return false;
  }
  return false;
}

const onBoxWall = (b, x, y) => ((x === b.x0 || x === b.x1) && y > b.y0 && y < b.y1) || ((y === b.y0 || y === b.y1) && x > b.x0 && x < b.x1);

// Some rooms get a little character: rough cave corners or a few pillars.
// Nothing goes within a step of a door, and the room's middle stays open.
function shapeRooms(map, rooms) {
  const nearDoor = (x, y) => map.doors.some(d => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1);
  const wallUp = list => {
    if (list.some(([x, y]) => nearDoor(x, y))) return;
    for (const [x, y] of list) { map.tiles[idx(x, y)] = WALL; map.room[idx(x, y)] = -1; }
  };
  rooms.forEach((r, i) => {
    if (i === 0 || r.w < 5 || r.h < 5) return;
    const roll = Math.random(), x1 = r.x + r.w - 1, y1 = r.y + r.h - 1;
    if (roll < 0.35) {
      // cave: knock the corners in
      for (const [cx, cy, sx, sy] of [[r.x, r.y, 1, 1], [x1, r.y, -1, 1], [r.x, y1, 1, -1], [x1, y1, -1, -1]]) {
        if (Math.random() < 0.3) continue;
        const big = r.w >= 7 && r.h >= 6 && Math.random() < 0.5;
        wallUp(big ? [[cx, cy], [cx + sx, cy], [cx, cy + sy]] : [[cx, cy]]);
      }
    } else if (roll < 0.55 && r.w >= 7 && r.h >= 7) {
      // pillars, a step in from the walls
      for (const [px, py] of [[r.x + 1, r.y + 1], [x1 - 1, r.y + 1], [r.x + 1, y1 - 1], [x1 - 1, y1 - 1]]) wallUp([[px, py]]);
    }
  });
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
