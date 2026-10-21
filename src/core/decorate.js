// Gives each room of a freshly carved floor one theme, so every feature is there for a reason:
//   ore    - the floor's big ore, with a gas crack beside it (mining makes noise and leaks gas)
//   garden - mushroom brush and a sleep mushroom or two; enemies here are fast asleep (one per floor at most)
//   flood  - groundwater with a little brush around the edges
//   plain  - nothing much, maybe a patch of brush
// Corridors stay bare.

import { T } from '../data/terrain.js';
import { idx, inMap, FLOOR, ORE } from './dungeon.js';
import { rint, pick } from './util.js';

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

function sprinkle(map, r, n, ter, keep) {
  for (let k = 0; k < n; k++) {
    const c = pick(roomTiles(r).filter(([x, y]) => free(map, x, y) && !keep(x, y)));
    if (c) map.ter[idx(...c)] = ter;
  }
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
    let theme = 'plain';
    if (i === 0) {
      if (Math.random() < 0.5) blob(map, r, rint(2, 4), T.BRUSH, keep);
    } else if (r === oreRoom && placeOre(map, r, keep)) {
      theme = 'ore';
      if (Math.random() < 0.6) blob(map, r, rint(2, 4), T.BRUSH, keep);
    } else {
      const roll = Math.random();
      if (roll < 0.3 && !has.has('garden')) {
        theme = 'garden';
        blob(map, r, Math.round(r.w * r.h * 0.45), T.BRUSH, keep);
        sprinkle(map, r, rint(1, 2), T.MUSH_SLEEP, keep);
      } else if (roll >= 0.3 && roll < 0.55) {
        theme = 'flood';
        blob(map, r, Math.round(r.w * r.h * 0.4), T.WATER, keep);
        blob(map, r, rint(2, 4), T.BRUSH, keep);
      } else if (Math.random() < 0.5) {
        blob(map, r, rint(3, 6), T.BRUSH, keep);
      }
    }
    themes[i] = theme;
    if (theme !== 'plain') has.add(theme);
  });
  return { has, themes };
}

export function decorateArena(map, room, keep) {
  for (let n = 0; n < 3; n++) blob(map, room, rint(4, 7), T.BRUSH, keep);
  blob(map, room, rint(3, 5), T.WATER, keep);
}
