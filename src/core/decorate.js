// Gives each room of a freshly carved floor one theme, so every feature is there for a reason:
//   ore    - the floor's big ore, with a gas crack beside it (mining makes noise and leaks gas)
//   garden - a room overgrown with tall grass you cannot see through (one per floor at most)
//   flood  - groundwater with a little grass around the edges
//   plain  - nothing much, maybe a patch of grass
// Corridors stay bare.

import { T, TRAPS } from '../data/terrain.js';
import { idx, inMap, FLOOR, ORE, DOOR } from './dungeon.js';
import { rint, pick, shuffle, DIRS8 } from './util.js';
import { trapsPerFloor, trapHidden } from '../data/balance.js';

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const free = (map, x, y) => inMap(x, y) && map.tiles[idx(x, y)] === FLOOR && map.ter[idx(x, y)] === T.NONE;
const inRoom = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

function roomTiles(r, margin = 0) {
  const out = [];
  for (let y = r.y + margin; y < r.y + r.h - margin; y++) for (let x = r.x + margin; x < r.x + r.w - margin; x++) out.push([x, y]);
  return out;
}

// Grows a patch of `ter` from a random tile of the room.
function blob(map, r, n, ter, keep) {
  const tiles = roomTiles(r).filter(([x, y]) => free(map, x, y) && !keep(x, y));
  if (!tiles.length) return 0;
  const set = [pick(tiles)];
  map.ter[idx(...set[0])] = ter;
  for (let tries = 0; set.length < n && tries < n * 10; tries++) {
    const [bx, by] = pick(set), [dx, dy] = pick(DIRS4), x = bx + dx, y = by + dy;
    if (!inRoom(r, x, y) || !free(map, x, y) || keep(x, y)) continue;
    map.ter[idx(x, y)] = ter;
    set.push([x, y]);
  }
  return set.length;
}

// Tall grass, with a ring of short grass around it here and there.
function grass(map, r, n, keep) {
  blob(map, r, n, T.BRUSH, keep);
  for (const [x, y] of roomTiles(r)) {
    if (!free(map, x, y) || Math.random() > 0.45) continue;
    if (DIRS4.some(([dx, dy]) => inMap(x + dx, y + dy) && map.ter[idx(x + dx, y + dy)] === T.BRUSH)) map.ter[idx(x, y)] = T.GRASS;
  }
}

// A miner's lamp on the room's top wall, away from doors, lighting the room a little.
function hangLamp(map, r) {
  const spots = [];
  for (let x = r.x; x < r.x + r.w; x++) {
    const y = r.y - 1;
    if (map.tiles[idx(x, y)] !== 0 || map.tiles[idx(x, r.y)] !== FLOOR) continue;
    if ([x - 1, x + 1].some(nx => map.tiles[idx(nx, y)] === DOOR)) continue;
    spots.push(x);
  }
  if (!spots.length) return;
  spots.sort((a, b) => Math.abs(a - r.cx) - Math.abs(b - r.cx));
  map.lights.push({ x: spots[Math.min(spots.length - 1, rint(0, 1))], y: r.y - 1 });
}

// Puts the big ore in the middle of a room, away from the walls so it never blocks a doorway.
function placeOre(map, r, keep) {
  const spots = roomTiles(r, 1).filter(([x, y]) => free(map, x, y) && !keep(x, y));
  if (!spots.length) return false;
  spots.sort((a, b) => (Math.abs(a[0] - r.cx) + Math.abs(a[1] - r.cy)) - (Math.abs(b[0] - r.cx) + Math.abs(b[1] - r.cy)));
  const [x, y] = spots[0];
  map.tiles[idx(x, y)] = ORE;
  map.ore = { x, y, hits: 0 };
  const crack = DIRS4.map(([dx, dy]) => [x + dx, y + dy]).find(([cx, cy]) => free(map, cx, cy) && !keep(cx, cy));
  if (crack) {
    map.ter[idx(...crack)] = T.VENT;
    map.vents.push({ x: crack[0], y: crack[1] });
  }
  return true;
}

// Returns { has, themes }: what this floor contains (for overheard hints) and each room's theme.
export function decorate(map, rooms, { start, stairs }) {
  const has = new Set(), themes = [];
  const keep = (x, y) => (Math.abs(x - start.x) <= 1 && Math.abs(y - start.y) <= 1) || (x === stairs.x && y === stairs.y);

  // the ore goes in the biggest room that is neither the start nor the stairs room
  const oreRoom = rooms.slice(1)
    .filter(r => !inRoom(r, stairs.x, stairs.y))
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];

  rooms.forEach((r, i) => {
    if (i === 0 || Math.random() < 0.55) hangLamp(map, r);
    let theme = 'plain';
    if (i === 0) {
      if (Math.random() < 0.5) grass(map, r, rint(2, 4), keep);
    } else if (r === oreRoom && placeOre(map, r, keep)) {
      theme = 'ore';
      if (Math.random() < 0.6) grass(map, r, rint(2, 4), keep);
    } else {
      const roll = Math.random();
      if (roll < 0.3 && !has.has('garden')) {
        theme = 'garden';
        grass(map, r, Math.round(r.w * r.h * 0.5), keep);
      } else if (roll >= 0.3 && roll < 0.55) {
        theme = 'flood';
        blob(map, r, Math.round(r.w * r.h * 0.4), T.WATER, keep);
        grass(map, r, rint(2, 4), keep);
      } else if (Math.random() < 0.6) {
        grass(map, r, rint(3, 7), keep);
      }
    }
    themes[i] = theme;
    if (theme !== 'plain') has.add(theme);
  });
  return { has, themes };
}

// A few traps on room floors (never in the start room, a doorway's mouth or next to another trap).
// Returns how many were placed.
export function placeTraps(map, rooms, { start, stairs }, floor) {
  const near = (x, y, cond) => DIRS8.some(([dx, dy]) => inMap(x + dx, y + dy) && cond(idx(x + dx, y + dy)));
  const spots = shuffle(rooms.slice(1).flatMap(r => roomTiles(r))).filter(([x, y]) =>
    free(map, x, y) && Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) > 2 && Math.max(Math.abs(x - stairs.x), Math.abs(y - stairs.y)) > 1 &&
    !near(x, y, i => map.tiles[i] === DOOR || map.tiles[i] === ORE));
  let n = 0;
  for (const [x, y] of spots) {
    if (n >= trapsPerFloor(floor)) break;
    if (near(x, y, i => TRAPS.includes(map.ter[i]))) continue;
    map.ter[idx(x, y)] = pick(floor === 1 ? [T.TRAP_SPIKE, T.TRAP_SLEEP] : TRAPS);
    map.hidden[idx(x, y)] = Math.random() < trapHidden(floor) ? 1 : 0;
    n++;
  }
  return n;
}

export function decorateArena(map, room, keep) {
  hangLamp(map, { ...room, cx: room.x + 3 });
  hangLamp(map, { ...room, cx: room.x + room.w - 4 });
  for (let n = 0; n < 3; n++) grass(map, room, rint(4, 7), keep);
  blob(map, room, rint(3, 5), T.WATER, keep);
}
