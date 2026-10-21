// Fills a freshly carved floor with features: brush, water, gas vents, rails, crystals, ore...
// Every feature can show up on any floor for now, so all of them can be tried early.

import { T } from '../data/terrain.js';
import { idx, inMap, FLOOR, WALL, CRYSTAL, ORE, isBorder } from './dungeon.js';
import { rint, pick, shuffle } from './util.js';

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

// A tile whose 8 neighbours are all open floor, so blocking it never cuts a path.
function openSpot(map, r, keep) {
  const spots = roomTiles(r, 1).filter(([x, y]) => {
    if (!free(map, x, y) || keep(x, y)) return false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const t = map.tiles[idx(x + i, y + j)];
      if (t !== FLOOR || map.ter[idx(x + i, y + j)] === T.PIT) return false;
    }
    return true;
  });
  return spots.length ? pick(spots) : null;
}

export function decorate(map, rooms, { start, stairs, zone, bossFloor }) {
  const has = new Set(), carts = [];
  const keep = (x, y) => (Math.abs(x - start.x) <= 1 && Math.abs(y - start.y) <= 1) || (x === stairs.x && y === stairs.y);
  let vent = false, rail = false, pit = false;

  rooms.forEach((r, i) => {
    if (i === 0) { // the start room stays calm: at most a little brush
      if (Math.random() < 0.5) blob(map, r, rint(3, 6), T.BRUSH, keep);
      return;
    }
    const area = r.w * r.h;
    if (!rail && Math.random() < 0.3 && (r.w >= 7 || r.h >= 6)) {
      const horiz = r.w >= 7 && (r.h < 6 || Math.random() < 0.5);
      const line = [];
      if (horiz) { const y = rint(r.y + 1, r.y + r.h - 2); for (let x = r.x; x < r.x + r.w; x++) line.push([x, y]); }
      else { const x = rint(r.x + 1, r.x + r.w - 2); for (let y = r.y; y < r.y + r.h; y++) line.push([x, y]); }
      if (line.every(([x, y]) => free(map, x, y) && !keep(x, y))) {
        for (const [x, y] of line) map.ter[idx(x, y)] = horiz ? T.RAIL_H : T.RAIL_V;
        const [cx, cy] = Math.random() < 0.5 ? line[0] : line[line.length - 1];
        carts.push({ x: cx, y: cy, axis: horiz ? 'h' : 'v', bomb: 0 });
        rail = true; has.add('cart');
      }
    }
    if (Math.random() < (zone === 1 ? 0.45 : 0.15)) {
      for (let n = rint(1, 2); n > 0; n--) {
        const s = openSpot(map, r, keep);
        if (s) { map.tiles[idx(...s)] = CRYSTAL; map.crystals.push({ x: s[0], y: s[1] }); has.add('crystal'); }
      }
    }
    if (!pit && !bossFloor && Math.random() < 0.15) {
      const s = openSpot(map, r, keep);
      if (s) { map.ter[idx(...s)] = T.PIT; pit = true; has.add('pit'); }
    }
    if (!vent && Math.random() < 0.3) {
      const s = openSpot(map, r, keep);
      if (s) {
        map.ter[idx(...s)] = T.VENT;
        map.vents.push({ x: s[0], y: s[1] });
        vent = true; has.add('vent');
        for (let n = rint(1, 2); n > 0; n--) {
          const c = pick(roomTiles(r).filter(([x, y]) => free(map, x, y) && !keep(x, y)));
          if (c) { map.ter[idx(...c)] = T.CRACKED; has.add('cracked'); }
        }
      }
    }
    if (Math.random() < 0.25) {
      for (let n = rint(1, 3); n > 0; n--) {
        const c = pick(roomTiles(r).filter(([x, y]) => free(map, x, y) && !keep(x, y)));
        if (c) map.ter[idx(...c)] = Math.random() < 0.5 ? T.MUSH_SLEEP : T.MUSH_POISON;
      }
    }
    if (Math.random() < 0.3) blob(map, r, rint(3, 7), T.WATER, keep);
    if (Math.random() < 0.15) blob(map, r, rint(2, 4), T.STICKY, keep);
    if (Math.random() < 0.4) blob(map, r, Math.round(area * (0.25 + Math.random() * 0.3)), T.BRUSH, keep);
  });

  // wooden props along corridors
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.room[i] === -1 && map.tiles[i] === FLOOR && map.ter[i] === T.NONE && Math.random() < 0.2) {
      map.ter[i] = T.TIMBER; has.add('timber');
    }
  }
  // a few loose ceilings anywhere but the start room
  const floorTiles = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (free(map, x, y) && !keep(x, y) && map.room[idx(x, y)] !== 0) floorTiles.push([x, y]);
  }
  for (const [x, y] of shuffle(floorTiles).slice(0, rint(2, 4))) { map.ter[idx(x, y)] = T.CRACKED; has.add('cracked'); }

  // shiny ore in walls next to the floor
  const walls = [];
  for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
    if (map.tiles[idx(x, y)] !== WALL || isBorder(x, y)) continue;
    if (DIRS4.some(([dx, dy]) => map.tiles[idx(x + dx, y + dy)] === FLOOR)) walls.push([x, y]);
  }
  for (const [x, y] of shuffle(walls).slice(0, rint(6, 10))) {
    map.ore[idx(x, y)] = ORE; map.dig[idx(x, y)] = 2; has.add('ore');
  }
  return { carts, has };
}

export function decorateArena(map, room, keep) {
  for (let n = 0; n < 3; n++) blob(map, room, rint(4, 7), T.BRUSH, keep);
  blob(map, room, rint(3, 5), T.WATER, keep);
}
