// Gives each room of a freshly carved floor one theme, so every feature is there for a reason:
//   ore    - one of the floor's big ores (1 to 4 tiles), with a gas crack beside it (mining makes noise and leaks gas)
//   garden - a room overgrown with tall grass you cannot see through (one per floor at most)
//   flood  - groundwater with a little grass around the edges
//   plain  - nothing much, maybe a patch of grass or a puddle
// Corridors stay bare. The marsh floods more of its rooms. Bigger rooms may have a lone bush or boulder
// standing in them (cover to break line of sight, a corner to lose a chaser round), and a berry bush
// grows by the tall grass now and then.

import { T, TRAPS } from '../data/terrain.js';
import { idx, inMap, passable, FLOOR, ORE, DOOR, WALL, distMap } from './dungeon.js';
import { rint, pick, shuffle, DIRS8 } from './util.js';
import { trapsPerFloor, trapHidden, ORES_PER_FLOOR, ORE_SIZE_CHANCE, BERRY_CHANCE, PROPS_PER_ROOM } from '../data/balance.js';

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

// The shapes a vein can take, by size: a block, a domino, an L, a 2x2.
const VEINS = [
  [[[0, 0]]],
  [[[0, 0], [1, 0]], [[0, 0], [0, 1]]],
  [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]]],
  [[[0, 0], [1, 0], [0, 1], [1, 1]]],
];

function rollSize(floor) {
  if (floor === 1) return 1; // the first field's boulder is always a single block
  let roll = Math.random();
  for (let s = 0; s < ORE_SIZE_CHANCE.length; s++) if ((roll -= ORE_SIZE_CHANCE[s]) < 0) return s + 1;
  return 1;
}

// Puts the big ore in the middle of a room, away from the walls so it never blocks a doorway.
// A big vein that would cut the floor in two (pillars, cave corners) shrinks until it fits.
function placeOre(map, r, keep, start, floor) {
  const spots = roomTiles(r, 1).filter(([x, y]) => free(map, x, y) && !keep(x, y));
  if (!spots.length) return false;
  const near = ([x, y]) => Math.abs(x - r.cx) + Math.abs(y - r.cy);
  spots.sort((a, b) => near(a) - near(b));
  const reach = () => { const dm = distMap(map, start.x, start.y); let n = 0; for (const d of dm) if (d < 9999) n++; return n; };
  // the room's own floor must stay in one piece too, or a ring or cross room would be cut in half
  const rid = map.room[idx(r.cx, r.cy)];
  const inside = () => {
    const tiles = []; for (let i = 0; i < map.tiles.length; i++) if (map.room[i] === rid && passable(map, i % map.w, (i / map.w) | 0)) tiles.push(i);
    if (!tiles.length) return 0;
    const seen = new Set([tiles[0]]), todo = [tiles[0]];
    while (todo.length) {
      const c = todo.pop();
      for (const [dx, dy] of DIRS4) { const j = c + dx + dy * map.w; if (!seen.has(j) && map.room[j] === rid && passable(map, j % map.w, (j / map.w) | 0)) { seen.add(j); todo.push(j); } }
    }
    return seen.size === tiles.length;
  };
  const before = reach();
  let cells = null;
  for (let size = rollSize(floor); size >= 1 && !cells; size--) {
    for (const [x, y] of spots.slice(0, 6)) {
      for (const shape of shuffle(VEINS[size - 1].slice())) {
        const c = shape.map(([dx, dy]) => [x + dx, y + dy]);
        if (!c.every(([cx, cy]) => inRoom(r, cx, cy) && cx > r.x && cy > r.y && cx < r.x + r.w - 1 && cy < r.y + r.h - 1 && free(map, cx, cy) && !keep(cx, cy))) continue;
        for (const [cx, cy] of c) map.tiles[idx(cx, cy)] = ORE;
        if (reach() === before - c.length && inside()) { cells = c; break; }
        for (const [cx, cy] of c) map.tiles[idx(cx, cy)] = FLOOR;
      }
      if (cells) break;
    }
  }
  if (!cells) return false;
  const [x, y] = cells[0];
  const ore = { x, y, cells: cells.map(([cx, cy]) => ({ x: cx, y: cy })), size: cells.length, hits: 0, tier: 0, vent: null };
  map.ores.push(ore);
  const crack = shuffle(cells.flatMap(([cx, cy]) => DIRS4.map(([dx, dy]) => [cx + dx, cy + dy])))
    .find(([cx, cy]) => free(map, cx, cy) && !keep(cx, cy));
  if (crack) {
    map.ter[idx(...crack)] = T.VENT;
    ore.vent = { x: crack[0], y: crack[1] };
    map.vents.push(ore.vent);
  }
  return true;
}

// Returns { has, themes }: what this floor contains and each room's theme.
export function decorate(map, rooms, { start, stairs, floor = 1, style = 'meadow', ores = 0 }) {
  const wet = style === 'marsh' ? 0.45 : 0.25;
  const has = new Set(), themes = [];
  const keep = (x, y) => (Math.abs(x - start.x) <= 1 && Math.abs(y - start.y) <= 1) || (x === stairs.x && y === stairs.y);

  // the ores go in the biggest rooms that are neither the start nor the stairs room
  // (a room too cramped for one passes it on to the next biggest); `ores`: more on a 금빛 날 (data/weather.js)
  const oreRooms = new Set();
  for (const r of rooms.slice(1).filter(r => !inRoom(r, stairs.x, stairs.y)).sort((a, b) => b.w * b.h - a.w * a.h)) {
    if (oreRooms.size >= ORES_PER_FLOOR + ores) break;
    if (placeOre(map, r, keep, start, floor)) oreRooms.add(r);
  }

  rooms.forEach((r, i) => {
    if (i === 0 || Math.random() < 0.55) hangLamp(map, r);
    let theme = 'plain';
    if (i === 0) {
      if (Math.random() < 0.5) grass(map, r, rint(2, 4), keep);
    } else if (oreRooms.has(r)) {
      theme = 'ore';
      if (Math.random() < 0.6) grass(map, r, rint(2, 4), keep);
    } else {
      const roll = Math.random();
      if (roll < 0.3 && !has.has('garden')) {
        theme = 'garden';
        grass(map, r, Math.round(r.w * r.h * 0.5), keep);
      } else if (roll >= 0.3 && roll < 0.3 + wet) {
        theme = 'flood';
        blob(map, r, Math.round(r.w * r.h * (style === 'marsh' ? 0.5 : 0.4)), T.WATER, keep);
        grass(map, r, rint(2, 4), keep);
      } else {
        if (Math.random() < 0.6) grass(map, r, rint(3, 7), keep);
        if (Math.random() < (style === 'marsh' ? 0.7 : 0.25)) blob(map, r, rint(2, 4), T.WATER, keep);
      }
    }
    themes[i] = theme;
    if (theme !== 'plain') has.add(theme);
  });
  rooms.forEach((r, i) => { if (i > 0 && themes[i] !== 'garden') placeProps(map, r, keep, start); });
  if (Math.random() < BERRY_CHANCE) placeBerry(map, rooms, keep);
  return { has, themes };
}

// A lone bush (or stump, reeds, boulder, stalagmite: drawn by zone) in the middle of a bigger room,
// never next to a door or the walls and never cutting the floor in two.
function placeProps(map, r, keep, start) {
  if (r.w < 5 || r.h < 5) return;
  const want = rint(...PROPS_PER_ROOM);
  if (!want) return;
  const reach = () => { const dm = distMap(map, start.x, start.y); let n = 0; for (const d of dm) if (d < 9999) n++; return n; };
  let before = reach(), made = 0;
  for (const [x, y] of shuffle(roomTiles(r, 1))) {
    if (made >= want) break;
    if (!free(map, x, y) || keep(x, y)) continue;
    // room to walk around it: nothing but plain floor in the ring of tiles around
    if (DIRS8.some(([dx, dy]) => map.tiles[idx(x + dx, y + dy)] !== FLOOR || map.props[idx(x + dx, y + dy)])) continue;
    map.tiles[idx(x, y)] = WALL;
    if (reach() !== before - 1) { map.tiles[idx(x, y)] = FLOOR; continue; }
    map.props[idx(x, y)] = 1;
    before--;
    made++;
  }
}

// A berry bush at the edge of some tall grass (or anywhere in a room if there is no grass).
function placeBerry(map, rooms, keep) {
  const spots = shuffle(rooms.slice(1).flatMap(r => roomTiles(r))).filter(([x, y]) => free(map, x, y) && !keep(x, y) &&
    !DIRS8.some(([dx, dy]) => map.tiles[idx(x + dx, y + dy)] === DOOR));
  const t = spots.find(([x, y]) => DIRS8.some(([dx, dy]) => inMap(x + dx, y + dy) && map.ter[idx(x + dx, y + dy)] === T.BRUSH)) || spots[0];
  if (t) map.ter[idx(...t)] = T.BERRY;
}

// A few traps on room floors (never in the start room, a doorway's mouth or next to another trap).
// Returns how many were placed.
// Before the 'traps' unlock (data/unlocks.js) there are only a couple, all in plain sight, spikes and sleepy pollen.
export function placeTraps(map, rooms, { start, stairs }, floor, all = true) {
  const near = (x, y, cond) => DIRS8.some(([dx, dy]) => inMap(x + dx, y + dy) && cond(idx(x + dx, y + dy)));
  const spots = shuffle(rooms.slice(1).flatMap(r => roomTiles(r))).filter(([x, y]) =>
    free(map, x, y) && Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) > 2 && Math.max(Math.abs(x - stairs.x), Math.abs(y - stairs.y)) > 1 &&
    !near(x, y, i => map.tiles[i] === DOOR || map.tiles[i] === ORE));
  let n = 0;
  for (const [x, y] of spots) {
    if (n >= (all ? trapsPerFloor(floor) : Math.min(2, trapsPerFloor(floor)))) break;
    if (near(x, y, i => TRAPS.includes(map.ter[i]))) continue;
    map.ter[idx(x, y)] = pick(floor === 1 || !all ? [T.TRAP_SPIKE, T.TRAP_SLEEP] : TRAPS);
    map.hidden[idx(x, y)] = all && Math.random() < trapHidden(floor) ? 1 : 0;
    n++;
  }
  return n;
}

// 심술 버섯 (v0.26): one or two toadstools out on open ground in rooms of their own, well away from
// where you come in and from doors and other traps, with room round them for a crowd. Returns how many.
export function placeGrumps(map, rooms, { start, stairs }) {
  const near = (x, y, cond) => DIRS8.some(([dx, dy]) => inMap(x + dx, y + dy) && cond(idx(x + dx, y + dy)));
  const used = new Set();
  let n = 0;
  for (const r of shuffle(rooms.slice(1).filter(r => r.w >= 4 && r.h >= 4))) {
    if (n >= rint(1, 2)) break;
    const spot = shuffle(roomTiles(r)).find(([x, y]) => free(map, x, y) &&
      Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) > 5 && Math.max(Math.abs(x - stairs.x), Math.abs(y - stairs.y)) > 1 &&
      DIRS8.every(([dx, dy]) => inMap(x + dx, y + dy) && map.tiles[idx(x + dx, y + dy)] === FLOOR) &&
      !near(x, y, i => map.tiles[i] === DOOR || map.tiles[i] === ORE || TRAPS.includes(map.ter[i])));
    if (!spot || used.has(r)) continue;
    used.add(r);
    map.ter[idx(...spot)] = T.TRAP_GRUMP;
    n++;
  }
  return n;
}

// The boss arena by its shape: grass to hide in, a puddle or two; the pond's rim gets reeds of grass.
export function decorateArena(map, room, keep, layout = 'pillars') {
  hangLamp(map, { ...room, cx: room.x + 3 });
  hangLamp(map, { ...room, cx: room.x + room.w - 4 });
  const patches = { grove: 5, pond: 4, lanes: 2, cavern: 2 }[layout] ?? 3;
  for (let n = 0; n < patches; n++) grass(map, room, rint(4, 7), keep);
  if (layout !== 'pond') blob(map, room, rint(3, 5), T.WATER, keep);
  if (layout === 'cavern' || layout === 'lanes') blob(map, room, rint(2, 4), T.WATER, keep);
}
