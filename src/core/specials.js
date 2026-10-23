// Special rooms, like Shattered Pixel Dungeon's: small set pieces, each with one choice in it.
//   vault  - a locked secret garden with three relics under glass cloches. Take one and the others shatter.
//            Its key lies in another room of the same floor (or bomb your way in).
//   grave  - the squirrels' acorn stash: dirt mounds to dig up (gold, an item, or an angry squirrel),
//            and the big oak stump, which always holds a chest (plus any gold the acorn squirrels
//            stole on this floor) and always lets its keeper out.
//   statue - a scarecrow stands over a chest. Take the chest and the scarecrow starts to walk.
//   traps  - a little trap puzzle between the door and a chest (see traps below).
//   weeds  - 풀뽑기 밭: weeds in rows to pull, a little pay each. One (two in a big patch) is a screaming
//            root that trembles now and then; pull it and it runs off yelling. The last weed hides a star candy.
//   cage   - 우리: a friend locked in a cage at the back of a room, the crowned 우두머리 that carries
//            its key dozing in front of it (Run.openCage). It is the floor's set piece.
//   hive   - a honey stump in a grassy patch, its bees humming round it. Bump it for the honey pot
//            (more max HP for the run) and every bee that is awake comes after you, until you get
//            far enough away. Smoke from a fire next to it, or sleepy pollen, puts them to sleep first.
//   den    - 낮잠 방 (v0.26, Shiren's monster house): a dead-end room where a heap of the field's
//            critters nap round a chest, gold all about. Each sleeper dozes on for a few turns yet,
//            then stirs as any sleeper does when it sees you, and the first one up squeaks the
//            rest awake (ai.js sleepTick); a fight or a bomb wakes them, a bell far off draws them
//            out, sleep pollen keeps them under. Its sleepers are part of the field's lot (Run takes
//            half as many from the wanderers).
// Floors without a vault sometimes have a locked chest instead, with its key elsewhere.
// Some floors (most in the deep forest) also get a pair of fairy rings in two far-apart rooms:
// step into one and you pop out of the other (world.js warp).
// Nothing here touches the run directly: placeSpecials returns what to add.

import { T } from '../data/terrain.js';
import { idx, FLOOR, DOOR, GRAVE, LOCKED, HIVE, WEED, distMap } from './dungeon.js';
import { pick, shuffle, rint, DIRS8 } from './util.js';
import * as B from '../data/balance.js';

export const SET_PIECES = new Set(['vault', 'grave', 'statue', 'traps', 'hive', 'weeds', 'cage', 'den']);

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

// ctx: { floor, start, stairs, open(id) -> has that unlock come (data/unlocks.js), relicOffers(n) -> relic ids,
//        cage: 'cage' when a friend waits on this floor, chief() -> the critter type its 우두머리 is,
//        den: true when the burrow's sign promised a 낮잠 방, napper() / gold() / tool() for its contents }
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
    // a set piece wants its room clear: any lone bush standing in it goes
    const r = rooms[i];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (map.props[idx(x, y)]) { delete map.props[idx(x, y)]; map.tiles[idx(x, y)] = FLOOR; }
    }
    for (const t of floorTiles(map, rooms[i])) map.ter[idx(t.x, t.y)] = T.NONE;
  };

  // something locked, and its key
  let lockedAt = null;
  const open = ctx.open || (() => true);
  if (ctx.floor >= 2 && open('vault') && Math.random() < B.VAULT_CHANCE) {
    const fits = ids().filter(i => leaf(i) && rooms[i].w >= 3 && rooms[i].h >= 3 && rooms[i].w * rooms[i].h <= 36);
    if (fits.length) {
      const i = pick(fits);
      claim(i, 'vault');
      vault(map, rooms[i], out, ctx);
      lockedAt = rooms[i];
    }
  }
  if (!lockedAt && ctx.floor >= 2 && open('keys') && Math.random() < B.LOCKED_CHEST_CHANCE) {
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
    hive: (r) => r.w >= 4 && r.h >= 4 && hiveSpots(map, r).length > 0,
    weeds: (r) => r.w >= 4 && r.h >= 3,
    // never the first field of a trip, never on the way: a room with one door, well away from where you come in
    den: (r, i) => leaf(i) && r.w >= 4 && r.h >= 4 && B.localOf(ctx.floor) >= 2 && cheb(mid(r), ctx.start) >= 8,
  };
  const make = { grave, statue, traps, hive, weeds, den };
  const zone = B.stageOf(ctx.floor);
  const chance = { hive: B.HIVE_CHANCE, weeds: B.WEED_CHANCE[zone], den: B.DEN_CHANCE };
  let made = 0;
  // a caged friend takes the floor's one set piece: the room farthest from where you come in that has
  // space for the cage and its 우두머리
  if (ctx.cage) {
    const fits = ids().filter(i => rooms[i].w >= 3 && rooms[i].h >= 3 && rooms[i].w * rooms[i].h >= 12)
      .sort((a, b) => cheb(mid(rooms[b]), ctx.start) - cheb(mid(rooms[a]), ctx.start));
    if (fits.length) {
      claim(fits[0], 'cage');
      cage(map, rooms[fits[0]], out, ctx);
      made++;
    }
  }
  // the burrow you took said a 낮잠 방 waits here (갈림길): it comes first, and if no room is quite
  // right for it, any one-door room will do, then any room at all off the way
  if (ctx.den) {
    const any = ids().filter(i => rooms[i].w >= 3 && rooms[i].h >= 3 && cheb(mid(rooms[i]), ctx.start) >= 5);
    const fits = [ids().filter(i => fit.den(rooms[i], i)), any.filter(i => leaf(i)), any].find(f => f.length);
    if (fits) {
      const i = pick(fits);
      claim(i, 'den');
      den(map, rooms[i], out, ctx);
      made++;
    }
  }
  // one set piece a field at most, so each one gets your full attention; the weed patch, the
  // meadow's everyday job, gets the first pick of the rooms
  for (const kind of ['weeds', ...shuffle(['grave', 'statue', 'traps', 'hive', 'den'])]) {
    if (made >= 1 || !open(kind) || Math.random() > (chance[kind] ?? B.SPECIAL_CHANCE)) continue;
    const fits = ids().filter(i => fit[kind](rooms[i], i));
    if (!fits.length) continue;
    const i = pick(fits);
    claim(i, kind);
    make[kind](map, rooms[i], out, ctx);
    made++;
  }
  if (open('rings') && Math.random() < B.RING_CHANCE[zone]) rings(map, rooms, ids());
  return out;
}

// 낮잠 방: the chest in the middle, the nappers all round it, the gold (and a meadow tool) among them
function den(map, r, out, ctx) {
  const tiles = floorTiles(map, r).filter(t => map.ter[idx(t.x, t.y)] !== T.WATER);
  const c = tiles.reduce((a, t) => (cheb(t, mid(r)) < cheb(a, mid(r)) ? t : a), tiles[0]);
  out.pickups.push({ x: c.x, y: c.y, type: 'chest' });
  map.den = { x: c.x, y: c.y };
  const rest = shuffle(tiles.filter(t => t !== c));
  const n = Math.max(B.DEN_MIN, Math.min(B.DEN_MAX, Math.round(tiles.length * 0.2)));
  for (const t of rest.slice(0, n)) out.enemies.push({ type: ctx.napper(), x: t.x, y: t.y, state: 'sleep', doze: rint(1, 5), den: true });
  for (const t of rest.slice(n, n + 3)) out.pickups.push({ x: t.x, y: t.y, type: 'gold', amount: ctx.gold() });
  const tool = ctx.tool?.(), t = rest[n + 3];
  if (tool && t) out.pickups.push({ x: t.x, y: t.y, type: tool });
  out.den = n;
}

// two fairy rings on open ground, as far apart as the free rooms allow (never set pieces, never by a door)
function rings(map, rooms, free) {
  const spot = i => {
    const doors = doorsOf(map, rooms[i]);
    return pick(floorTiles(map, rooms[i]).filter(t => map.ter[idx(t.x, t.y)] === T.NONE && !doors.some(d => cheb(t, d.in) <= 1)));
  };
  const spots = free.map(spot).filter(Boolean);
  let best = null;
  for (const a of spots) for (const b of spots) if (cheb(a, b) >= 12 && (!best || cheb(a, b) > cheb(best[0], best[1]))) best = [a, b];
  if (!best) return;
  for (const t of best) map.ter[idx(t.x, t.y)] = T.RING;
  map.rings = best.map(t => ({ x: t.x, y: t.y }));
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
  // rows of mounds on every other tile, so there is always a way between them
  const spots = shuffle(floorTiles(map, r).filter(t => (t.x - r.x) % 2 === 1 && (t.y - r.y) % 2 === 1 && !nearDoor(t)));
  const n = Math.min(spots.length, Math.max(3, Math.min(5, Math.round(r.w * r.h / 8))));
  const graves = spots.slice(0, n);
  if (!graves.length) return;
  for (const t of graves) map.tiles[idx(t.x, t.y)] = GRAVE;
  const big = graves.reduce((b, t) => (cheb(t, door.in) > cheb(b, door.in) ? t : b));
  map.bigGrave = idx(big.x, big.y);
  // a little grass between the mounds
  for (const t of floorTiles(map, r)) if (Math.random() < 0.3) map.ter[idx(t.x, t.y)] = T.GRASS;
  // never wall anything off
  for (const t of graves) {
    const dm = distMap(map, door.in.x, door.in.y);
    if (floorTiles(map, r).every(f => dm[idx(f.x, f.y)] < 9999)) break;
    map.tiles[idx(t.x, t.y)] = FLOOR;
  }
}

function cage(map, r, out, ctx) {
  const doors = doorsOf(map, r), tiles = floorTiles(map, r);
  const fromDoor = t => Math.min(...doors.map(d => cheb(t, d.in)));
  // at the back of the room, away from the doors, with a free tile beside it to stand on
  const at = tiles.filter(t => fromDoor(t) >= 2).sort((a, b) => fromDoor(b) - fromDoor(a))[0] || tiles[tiles.length - 1];
  out.enemies.push({ type: ctx.cage, x: at.x, y: at.y, state: 'npc' });
  out.cage = { x: at.x, y: at.y };
  // the 우두머리 naps between the door and the cage
  const spot = tiles.filter(t => cheb(t, at) === 2 && fromDoor(t) >= 1).sort((a, b) => fromDoor(a) - fromDoor(b))[0]
    || tiles.find(t => cheb(t, at) === 1);
  if (spot) out.enemies.push({ type: ctx.chief(), x: spot.x, y: spot.y, state: 'sleep', chief: true });
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

// 풀뽑기 밭: rows of weeds on every other line, broken every third tile (so there is always a way
// between them), a little grass round them. Which ones are screaming roots is kept in map.weeds.roots; the scene makes them tremble.
function weeds(map, r) {
  const nearDoor = t => doorsOf(map, r).some(d => cheb(t, d.in) <= 1);
  const spots = shuffle(floorTiles(map, r).filter(t => (t.y - r.y) % 2 === 1 && (t.x - r.x) % 3 !== 0 && !nearDoor(t)));
  const list = spots.slice(0, Math.min(spots.length, Math.max(4, Math.min(9, Math.round(r.w * r.h / 5)))));
  if (list.length < 3) return;
  for (const t of list) map.tiles[idx(t.x, t.y)] = WEED;
  // never wall anything off
  const door = doorsOf(map, r)[0];
  for (const t of list) {
    const dm = distMap(map, door.in.x, door.in.y);
    if (floorTiles(map, r).every(f => dm[idx(f.x, f.y)] < 9999)) break;
    map.tiles[idx(t.x, t.y)] = FLOOR;
  }
  const ids = list.map(t => idx(t.x, t.y)).filter(i => map.tiles[i] === WEED);
  map.weeds = { left: ids.length, roots: shuffle(ids.slice()).slice(0, ids.length >= 7 ? 2 : 1) };
  for (const t of floorTiles(map, r)) if (Math.random() < 0.3) map.ter[idx(t.x, t.y)] = T.GRASS;
}

// where the stump can stand: open ground all round it (so it never cuts a way off), not by a door
function hiveSpots(map, r) {
  const doors = doorsOf(map, r);
  return floorTiles(map, r).filter(t => DIRS8.every(([dx, dy]) => map.tiles[idx(t.x + dx, t.y + dy)] === FLOOR) &&
    !doors.some(d => cheb(t, d.in) <= 1));
}

function hive(map, r, out, ctx) {
  const door = doorsOf(map, r)[0];
  const spots = hiveSpots(map, r);
  // as deep in the room as it can be, so you see the bees before you reach them
  const at = spots.reduce((b, t) => (cheb(t, door.in) > cheb(b, door.in) ? t : b));
  map.tiles[idx(at.x, at.y)] = HIVE;
  map.hive = { x: at.x, y: at.y, honey: true };
  // a meadow round it: grass that burns, which is the smoke that calms the bees
  for (const t of floorTiles(map, r)) if (cheb(t, at) <= 2 ? Math.random() < 0.6 : Math.random() < 0.25) map.ter[idx(t.x, t.y)] = T.GRASS;
  const zone = Math.floor((ctx.floor - 1) / B.FLOORS_PER_ZONE);
  const round = shuffle(DIRS8.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })));
  for (const t of round.slice(0, 3 + zone)) out.enemies.push({ type: 'bee', x: t.x, y: t.y, state: 'wander' });
}

// A trap room is a little puzzle you can read from the door: one kind of trap, laid in a pattern.
//   stones - every other tile, like a chessboard: the safe way is to walk diagonally
//   slalom - lines of traps across the room, each with one gap, the gaps on alternate sides
//   ring   - the chest walled in by traps all round, and a bomb by the door to blast a way in
// Every layout is checked: the chest can be reached without stepping on a trap (the ring, once
// one of its traps is sprung), the walk straight at it would step on one, and the room stays whole.
const PUZZLE_TRAPS = [T.TRAP_SPIKE, T.TRAP_SPIKE, T.TRAP_SLEEP, T.TRAP_ALARM, T.TRAP_SUMMON];

function traps(map, r, out) {
  const door = doorsOf(map, r)[0];
  const tiles = floorTiles(map, r);
  for (const kind of shuffle(['stones', 'slalom', 'ring'])) {
    const plan = LAYOUTS[kind](tiles, door.in, r);
    if (!plan || !fairTraps(tiles, door.in, plan, kind === 'ring')) continue;
    const trap = kind === 'ring' ? pick([T.TRAP_SPIKE, T.TRAP_SLEEP]) : pick(PUZZLE_TRAPS);
    for (const i of plan.traps) map.ter[i] = trap;
    out.pickups.push({ x: plan.goal.x, y: plan.goal.y, type: 'chest' });
    if (kind === 'ring') out.pickups.push({ x: door.in.x, y: door.in.y, type: 'bomb' });
    return;
  }
}

// steps (8 ways) from `from` over the room's tiles, keeping off `traps`
function safeSteps(tiles, from, traps) {
  const at = new Map(tiles.map(t => [idx(t.x, t.y), t]));
  const d = new Map([[idx(from.x, from.y), 0]]), q = [from];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], k = d.get(idx(c.x, c.y));
    for (const [dx, dy] of DIRS8) {
      const i = idx(c.x + dx, c.y + dy);
      if (!at.has(i) || d.has(i) || traps.has(i)) continue;
      d.set(i, k + 1);
      q.push(at.get(i));
    }
  }
  return d;
}

const farthest = (tiles, d) => tiles.filter(t => d.has(idx(t.x, t.y))).reduce((b, t) => (!b || d.get(idx(t.x, t.y)) > d.get(idx(b.x, b.y)) ? t : b), null);

const LAYOUTS = {
  stones(tiles, start) {
    const odd = (start.x + start.y) & 1;
    const traps = new Set(tiles.filter(t => ((t.x + t.y) & 1) !== odd).map(t => idx(t.x, t.y)));
    const goal = farthest(tiles, safeSteps(tiles, start, traps));
    return goal && cheb(goal, start) >= 3 ? { traps, goal } : null;
  },
  slalom(tiles, start, r) {
    // lines run across the room, one every other step going in from the door
    const alongX = start.x === r.x || start.x === r.x + r.w - 1;
    const depth = t => (alongX ? Math.abs(t.x - start.x) : Math.abs(t.y - start.y));
    const across = t => (alongX ? t.y : t.x);
    const deep = Math.max(...tiles.map(depth));
    if (deep < 4) return null;
    const lo = alongX ? r.y : r.x, hi = alongX ? r.y + r.h - 1 : r.x + r.w - 1;
    if (hi - lo < 2) return null;
    // the first gap is on the side away from where you come in
    let gapHigh = across(start) - lo < hi - across(start);
    const traps = new Set();
    for (let k = 1; k < deep; k += 2) {
      const line = tiles.filter(t => depth(t) === k);
      const gap = line.reduce((b, t) => (!b || (gapHigh ? across(t) > across(b) : across(t) < across(b)) ? t : b), null);
      for (const t of line) if (t !== gap) traps.add(idx(t.x, t.y));
      gapHigh = !gapHigh;
    }
    const goal = farthest(tiles, safeSteps(tiles, start, traps));
    return goal ? { traps, goal } : null;
  },
  ring(tiles, start) {
    const floor = new Set(tiles.map(t => idx(t.x, t.y)));
    const spots = tiles.filter(c => cheb(c, start) >= 3 && DIRS8.every(([dx, dy]) => floor.has(idx(c.x + dx, c.y + dy))));
    if (!spots.length) return null;
    const goal = spots.reduce((b, t) => (cheb(t, start) > cheb(b, start) ? t : b));
    const traps = new Set(DIRS8.map(([dx, dy]) => idx(goal.x + dx, goal.y + dy)));
    return { traps, goal };
  },
};

function fairTraps(tiles, start, { traps, goal }, walledIn) {
  const gi = idx(goal.x, goal.y);
  if (traps.has(idx(start.x, start.y)) || traps.has(gi)) return false;
  const d = safeSteps(tiles, start, traps);
  // every tile that is not a trap is still part of the room (only the ring's chest sits apart)
  if (tiles.some(t => !traps.has(idx(t.x, t.y)) && !d.has(idx(t.x, t.y)) && !(walledIn && idx(t.x, t.y) === gi))) return false;
  if (walledIn) return !d.has(gi);
  if (!d.has(gi)) return false;
  // the puzzle part: going straight at the chest would step on a trap
  const n = cheb(goal, start);
  for (let k = 1; k < n; k++) {
    const x = Math.round(start.x + ((goal.x - start.x) * k) / n), y = Math.round(start.y + ((goal.y - start.y) * k) / n);
    if (traps.has(idx(x, y))) return true;
  }
  return d.get(gi) > n + 1;
}
