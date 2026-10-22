// Special rooms, like Shattered Pixel Dungeon's: small set pieces, each with one choice in it.
//   vault  - a locked room with three relics in crystal. Take one and the others shatter.
//            Its key lies in another room of the same floor (or bomb your way in).
//   grave  - old miners' graves to dig up: gold, an item, or an angry wraith.
//            The big grave always holds a chest, and always wakes a wraith.
//   statue - a stone miner stands over a chest. Take the chest and the statue starts to walk.
//   traps  - a room paved with traps and one safe path to a chest at the far end.
// Floors without a vault sometimes have a locked chest instead, with its key elsewhere.
// Nothing here touches the run directly: placeSpecials returns what to add.

import { T } from '../data/terrain.js';
import { idx, FLOOR, DOOR, GRAVE, LOCKED, distMap } from './dungeon.js';
import { pick, shuffle } from './util.js';
import * as B from '../data/balance.js';

export const SET_PIECES = new Set(['vault', 'grave', 'statue', 'traps']);

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const inRoom = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
const mid = r => ({ x: r.cx, y: r.cy });

function floorTiles(map, r) {
  const out = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (map.tiles[idx(x, y)] === FLOOR) out.push({ x, y });
  return out;
}

// The doors in a room's walls, each with the room tile just inside it.
function doorsOf(map, r) {
  const out = [];
  for (let x = r.x; x < r.x + r.w; x++) {
    if (map.tiles[idx(x, r.y - 1)] === DOOR) out.push({ x, y: r.y - 1, in: { x, y: r.y } });
    if (map.tiles[idx(x, r.y + r.h)] === DOOR) out.push({ x, y: r.y + r.h, in: { x, y: r.y + r.h - 1 } });
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    if (map.tiles[idx(r.x - 1, y)] === DOOR) out.push({ x: r.x - 1, y, in: { x: r.x, y } });
    if (map.tiles[idx(r.x + r.w, y)] === DOOR) out.push({ x: r.x + r.w, y, in: { x: r.x + r.w - 1, y } });
  }
  return out;
}

// Picks `n` tiles from `tiles`, each as far as it can be from the ones already picked (and from `away`).
function spread(tiles, n, away = []) {
  const got = [];
  while (got.length < n && tiles.length) {
    const from = [...got, ...away];
    const best = tiles.reduce((b, t) => {
      const d = from.length ? Math.min(...from.map(o => cheb(o, t))) : Math.random();
      return !b || d > b.d ? { t, d } : b;
    }, null).t;
    got.push(best);
    tiles = tiles.filter(t => t !== best && cheb(t, best) > 1);
  }
  return got;
}

// ctx: { floor, start, stairs, relicOffers(n) -> relic ids }
// deco: { has, themes } from decorate(); set pieces take over a room's theme.
export function placeSpecials(map, rooms, deco, ctx) {
  const out = { pickups: [], enemies: [] };
  const used = new Set([0]);
  rooms.forEach((r, i) => { if (inRoom(r, ctx.stairs.x, ctx.stairs.y) || deco.themes[i] === 'ore') used.add(i); });
  const ids = () => rooms.map((r, i) => i).filter(i => !used.has(i));
  const leaf = i => doorsOf(map, rooms[i]).length === 1;
  const claim = (i, theme) => {
    used.add(i);
    deco.themes[i] = theme;
    deco.has.add(theme);
    for (const t of floorTiles(map, rooms[i])) map.ter[idx(t.x, t.y)] = T.NONE;
  };

  // something locked, and its key
  let lockedAt = null;
  if (ctx.floor >= 2 && Math.random() < B.VAULT_CHANCE) {
    const fits = ids().filter(i => leaf(i) && rooms[i].w >= 3 && rooms[i].h >= 3 && rooms[i].w * rooms[i].h <= 36);
    if (fits.length) {
      const i = pick(fits);
      claim(i, 'vault');
      vault(map, rooms[i], out, ctx);
      lockedAt = rooms[i];
    }
  }
  if (!lockedAt && ctx.floor >= 2 && Math.random() < B.LOCKED_CHEST_CHANCE) {
    const i = pick(ids());
    const t = i !== undefined && pick(floorTiles(map, rooms[i]).filter(t => map.ter[idx(t.x, t.y)] !== T.WATER));
    if (t) {
      out.pickups.push({ x: t.x, y: t.y, type: 'lockedChest' });
      deco.has.add('locked');
      lockedAt = rooms[i];
      used.add(i);
    }
  }
  if (lockedAt) {
    // the key lies in one of the rooms farthest from the lock
    const far = ids().sort((a, b) => cheb(mid(rooms[b]), mid(lockedAt)) - cheb(mid(rooms[a]), mid(lockedAt)));
    const spots = far.slice(0, Math.max(1, Math.ceil(far.length / 2)))
      .flatMap(i => floorTiles(map, rooms[i]))
      .filter(t => map.ter[idx(t.x, t.y)] !== T.WATER && cheb(t, ctx.start) > 2);
    const k = pick(spots) || pick(floorTiles(map, rooms[0]).filter(t => cheb(t, ctx.start) >= 1));
    out.pickups.push({ x: k.x, y: k.y, type: 'key' });
    // no set piece may take over the key's room (a grave could land right on it)
    rooms.forEach((r, i) => { if (inRoom(r, k.x, k.y)) used.add(i); });
  }

  // set pieces
  const fit = {
    grave: (r) => r.w >= 4 && r.h >= 4,
    statue: (r) => r.w >= 5 && r.h >= 5 && ctx.floor >= 2,
    traps: (r, i) => leaf(i) && Math.min(r.w, r.h) >= 3 && Math.max(r.w, r.h) >= 5 && r.w * r.h <= 35,
  };
  const make = { grave, statue, traps };
  let made = 0;
  for (const kind of shuffle(['grave', 'statue', 'traps'])) {
    if (made >= (ctx.floor === 1 ? 1 : 2) || Math.random() > B.SPECIAL_CHANCE) continue;
    const fits = ids().filter(i => fit[kind](rooms[i], i));
    if (!fits.length) continue;
    const i = pick(fits);
    claim(i, kind);
    make[kind](map, rooms[i], out, ctx);
    made++;
  }
  return out;
}

function vault(map, r, out, ctx) {
  const door = doorsOf(map, r)[0];
  map.tiles[idx(door.x, door.y)] = LOCKED;
  map.doors = map.doors.filter(d => d.x !== door.x || d.y !== door.y);
  const relics = ctx.relicOffers(3);
  const spots = spread(floorTiles(map, r).filter(t => cheb(t, door.in) > 1), 3, [door.in]);
  const vaultId = idx(door.x, door.y);
  spots.forEach((t, k) => {
    if (relics[k]) out.pickups.push({ x: t.x, y: t.y, type: 'crystal', relic: relics[k], vault: vaultId });
    else out.pickups.push({ x: t.x, y: t.y, type: 'gold', amount: B.graveGold(ctx.floor) * 2 });
  });
}

function grave(map, r, out) {
  const door = doorsOf(map, r)[0];
  const nearDoor = t => doorsOf(map, r).some(d => cheb(t, d.in) <= 1);
  // rows of graves on every other tile, so there is always a way between them
  const spots = shuffle(floorTiles(map, r).filter(t => (t.x - r.x) % 2 === 1 && (t.y - r.y) % 2 === 1 && !nearDoor(t)));
  const n = Math.min(spots.length, Math.max(3, Math.min(5, Math.round(r.w * r.h / 8))));
  const graves = spots.slice(0, n);
  if (!graves.length) return;
  for (const t of graves) map.tiles[idx(t.x, t.y)] = GRAVE;
  const big = graves.reduce((b, t) => (cheb(t, door.in) > cheb(b, door.in) ? t : b));
  map.bigGrave = idx(big.x, big.y);
  // a little grass between the graves
  for (const t of floorTiles(map, r)) if (Math.random() < 0.3) map.ter[idx(t.x, t.y)] = T.GRASS;
  // never wall anything off
  for (const t of graves) {
    const dm = distMap(map, door.in.x, door.in.y);
    if (floorTiles(map, r).every(f => dm[idx(f.x, f.y)] < 9999)) break;
    map.tiles[idx(t.x, t.y)] = FLOOR;
  }
}

function statue(map, r, out) {
  const door = doorsOf(map, r)[0];
  const tiles = floorTiles(map, r);
  // the statue in the middle, the chest just behind it as seen from the door
  const at = tiles.reduce((b, t) => (Math.abs(t.x - r.cx) + Math.abs(t.y - r.cy) < Math.abs(b.x - r.cx) + Math.abs(b.y - r.cy) ? t : b));
  const behind = tiles.filter(t => cheb(t, at) === 1 && cheb(t, door.in) > cheb(at, door.in))
    .sort((a, b) => cheb(b, door.in) - cheb(a, door.in))[0];
  if (!behind) return;
  out.enemies.push({ type: 'statue', x: at.x, y: at.y, state: 'stone' });
  out.pickups.push({ x: behind.x, y: behind.y, type: 'chest', guarded: true });
}

function traps(map, r, out) {
  const door = doorsOf(map, r)[0];
  const tiles = floorTiles(map, r), at = new Map(tiles.map(t => [idx(t.x, t.y), t]));
  const goal = tiles.reduce((b, t) => (cheb(t, door.in) > cheb(b, door.in) ? t : b));
  // a winding safe path: step toward the goal most of the time, sideways now and then
  let path = null;
  for (let tries = 0; tries < 60 && !path; tries++) {
    const p = [door.in], seen = new Set([idx(door.in.x, door.in.y)]);
    let cur = door.in;
    for (let steps = 0; steps < 80 && (cur.x !== goal.x || cur.y !== goal.y); steps++) {
      const next = DIRS4.map(([dx, dy]) => at.get(idx(cur.x + dx, cur.y + dy))).filter(t => t && !seen.has(idx(t.x, t.y)));
      if (!next.length) break;
      const toward = next.filter(t => Math.abs(t.x - goal.x) + Math.abs(t.y - goal.y) < Math.abs(cur.x - goal.x) + Math.abs(cur.y - goal.y));
      cur = toward.length && Math.random() < 0.7 ? pick(toward) : pick(next);
      seen.add(idx(cur.x, cur.y));
      p.push(cur);
    }
    if (cur.x === goal.x && cur.y === goal.y) path = p;
  }
  if (!path) return;
  const safe = new Set(path.map(t => idx(t.x, t.y)));
  const kinds = [T.TRAP_SPIKE, T.TRAP_SPIKE, T.TRAP_SLEEP, T.TRAP_SLEEP, T.TRAP_ALARM, T.TRAP_SUMMON];
  for (const t of tiles) if (!safe.has(idx(t.x, t.y))) map.ter[idx(t.x, t.y)] = pick(kinds);
  out.pickups.push({ x: goal.x, y: goal.y, type: 'chest' });
}
