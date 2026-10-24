// The new stages' grounds (v0.23): drops you can fall down, a single bridge over them, and pools that
// are ice or lava instead of water. Carved after the set pieces and before anything is put down, so
// nothing lands on a drop. Every cut is undone if it would leave some part of the field out of reach.

import { T } from '../data/terrain.js';
import { idx, inMap, distMap, squeeze, isBump, FLOOR, WALL, DOOR } from './dungeon.js';
import { rint, shuffle, DIRS8 } from './util.js';

const OPEN = new Set([T.NONE, T.GRASS, T.BRUSH, T.ASH]);

// how many tiles you can walk to from (x, y), and how many things you can walk up to and bump (a locked
// door, a sparkle rock, a mound: v0.29, so that no drop or lava cuts you off from one)
function reach(map, x, y) {
  const dm = distMap(map, x, y);
  let n = 0;
  for (let i = 0; i < dm.length; i++) {
    if (dm[i] < 9999) n++;
    else if (isBump(map.tiles[i])) {
      const bx = i % map.w, by = (i / map.w) | 0;
      if (DIRS8.some(([dx, dy]) => inMap(bx + dx, by + dy) && dm[idx(bx + dx, by + dy)] < 9999 && !squeeze(map, bx + dx, by + dy, -dx, -dy))) n++;
    }
  }
  return n;
}

// Turns `cut` into drops (and `bridge` into a bridge across them) if every tile you could reach before,
// apart from the ones cut, can still be reached. Returns true if it stayed.
function tryCut(map, cut, bridge, ctx) {
  if (!cut.length || cut.some(i => map.tiles[i] !== FLOOR || !OPEN.has(map.ter[i]) || ctx.taken.has(i))) return false;
  const before = reach(map, ctx.start.x, ctx.start.y);
  const was = cut.map(i => map.ter[i]);
  for (const i of cut) map.ter[i] = T.CHASM;
  for (const i of bridge) map.ter[i] = T.BRIDGE;
  if (reach(map, ctx.start.x, ctx.start.y) + cut.length - bridge.length >= before) return true;
  cut.forEach((i, k) => { map.ter[i] = was[k]; });
  return false;
}

// Can this tile go? Plain floor of room `r`, nothing on it, and no way in (a door or a passage) right
// beside it, so you never step out of a doorway straight into the drop.
function cuttable(map, r, x, y, ctx) {
  const i = idx(x, y);
  if (map.room[i] !== r.id || map.tiles[i] !== FLOOR || !OPEN.has(map.ter[i]) || ctx.taken.has(i)) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
    const j = idx(x + dx, y + dy);
    return map.room[j] === r.id || map.tiles[j] === WALL;
  });
}

// 바닷가 절벽: a room split in two by a gorge with one narrow bridge over it, and here and there a
// ledge where the ground just ends and the sea is far below. 옛 조합 터: floors fallen in, holes you
// walk around.
export function carveChasms(map, rooms, style, ctx) {
  const usable = rooms.filter(r => !ctx.skip(r));
  if (style === 'sea') {
    const long = longBridge(map, ctx);
    // the gorge: two or three rows (or columns) of the room fall away, every tile of the room in them,
    // and one bridge crosses where the room is widest
    let done = long && Math.random() < 0.5;
    for (const r of shuffle(usable.slice())) {
      if (done) break;
      for (const across of shuffle([true, false])) {
        const len = across ? r.h : r.w, span = across ? r.w : r.h, deep = len >= 8 ? 3 : 2;
        if (len < deep + 2 || span < 3) continue;
        for (let t = 0; t < 4 && !done; t++) {
          const edge = len >= deep + 4 ? 2 : 1, at = rint(edge, len - deep - edge), cut = [], cols = {};
          let ok = true;
          for (let k = 0; k < deep && ok; k++) for (let j = 0; j < span; j++) {
            const x = across ? r.x + j : r.x + at + k, y = across ? r.y + at + k : r.y + j, i = idx(x, y);
            // a bush or a boulder in the way stays standing, a pillar in the gorge
            if (map.room[i] !== r.id || map.tiles[i] === WALL) continue;
            if (!cuttable(map, r, x, y, ctx)) { ok = false; break; }
            cut.push(i);
            cols[j] = (cols[j] || 0) + 1;
          }
          // the bridge goes where the gorge is cut all the way through, nearest the middle
          const through = Object.keys(cols).map(Number).filter(j => cols[j] === deep).sort((a, b) => Math.abs(a - span / 2) - Math.abs(b - span / 2));
          if (!ok || cut.length < deep * 3 || !through.length) continue;
          const b = through[0], bridge = cut.filter(i => (across ? i % map.w - r.x : ((i / map.w) | 0) - r.y) === b);
          done = tryCut(map, cut, bridge, ctx);
        }
        if (done) break;
      }
    }
    // ledges: along one side of a room the ground ends in a drop one or two deep
    for (const r of shuffle(usable.slice()).slice(0, 3)) {
      if (r.w < 5 || r.h < 5 || hasDrop(map, r)) continue;
      const side = rint(0, 3), deep = r.w >= 7 && r.h >= 7 && Math.random() < 0.5 ? 2 : 1, cut = [];
      for (let k = 0; k < deep; k++) {
        const n = side < 2 ? r.w : r.h;
        // not the whole side: a stretch of it, so the room keeps its corners
        const from = rint(0, Math.max(0, Math.floor(n / 3))), to = n - rint(0, Math.max(0, Math.floor(n / 3)));
        for (let j = from; j < to; j++) {
          const x = side === 0 ? r.x + j : side === 1 ? r.x + j : side === 2 ? r.x + k : r.x + r.w - 1 - k;
          const y = side === 0 ? r.y + k : side === 1 ? r.y + r.h - 1 - k : r.y + j;
          if (map.room[idx(x, y)] === r.id && cuttable(map, r, x, y, ctx)) cut.push(idx(x, y));
        }
      }
      if (cut.length >= 3) tryCut(map, cut, [], ctx);
    }
  }
  if (style === 'ruins') {
    // a hole grows out from one tile of a room's floor, four to eight tiles, wherever the floor allows
    let holes = 0;
    const want = rint(2, 3);
    for (const r of shuffle(usable.slice())) {
      if (holes >= want) break;
      const cells = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (cuttable(map, r, x, y, ctx)) cells.push([x, y]);
      for (let t = 0; t < 3 && cells.length >= 4; t++) {
        const [sx, sy] = cells[rint(0, cells.length - 1)], cut = [idx(sx, sy)], size = rint(4, 8);
        for (let k = 0; k < 40 && cut.length < size; k++) {
          const from = cut[rint(0, cut.length - 1)], [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][rint(0, 3)];
          const x = from % map.w + dx, y = ((from / map.w) | 0) + dy, i = idx(x, y);
          if (!cut.includes(i) && cuttable(map, r, x, y, ctx)) cut.push(i);
        }
        if (cut.length >= 3 && tryCut(map, cut, [], ctx)) { holes++; break; }
      }
    }
  }
}

// 바닷가 절벽's big sight: a straight stretch of passage between two clifftops becomes a rope bridge
// over the sea, the rock on both sides of it fallen away. Picks the longest stretch it can (4 to 8
// tiles) and opens up to two tiles of drop on each side, as long as that rock touches nothing else.
function longBridge(map, ctx) {
  const ground = i => map.tiles[i] !== WALL && map.ter[i] !== T.CHASM;
  const runs = [];
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const seen = new Set();
    for (let i = 0; i < map.tiles.length; i++) {
      if (seen.has(i)) continue;
      const pass = j => map.tiles[j] === FLOOR && map.room[j] < 0 && OPEN.has(map.ter[j]);
      if (!pass(i)) continue;
      // walk the straight stretch from here, while the rock stands on both sides
      const x0 = i % map.w, y0 = (i / map.w) | 0, run = [];
      for (let k = 0; ; k++) {
        const x = x0 + dx * k, y = y0 + dy * k, j = idx(x, y);
        if (x >= map.w - 1 || y >= map.h - 1 || !pass(j) || map.tiles[idx(x + dy, y + dx)] !== WALL || map.tiles[idx(x - dy, y - dx)] !== WALL) break;
        run.push(j); seen.add(j);
      }
      if (run.length >= 4) runs.push({ run: run.slice(0, 8), dx, dy });
    }
  }
  if (!runs.length) return false;
  const best = runs.sort((a, b) => b.run.length - a.run.length)[Math.min(runs.length - 1, rint(0, 1))];
  const { run, dx, dy } = best, mine = new Set(run), drop = [];
  // the rock beside the bridge, one or two deep, where nothing else is next to it
  for (const i of run) {
    const x = i % map.w, y = (i / map.w) | 0;
    for (const s of [1, -1]) for (let d = 1; d <= 2; d++) {
      const nx = x + dy * s * d, ny = y + dx * s * d, j = idx(nx, ny);
      if (nx < 1 || ny < 1 || nx >= map.w - 1 || ny >= map.h - 1 || map.tiles[j] !== WALL || map.props?.[j]) break;
      let lonely = true;
      for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) {
        const k = idx(nx + ex, ny + ey);
        if (!mine.has(k) && !drop.includes(k) && ground(k)) lonely = false;
      }
      if (!lonely) break;
      drop.push(j);
    }
  }
  if (drop.length < run.length) return false;
  for (const j of drop) { map.tiles[j] = FLOOR; map.ter[j] = T.CHASM; }
  for (const i of run) map.ter[i] = T.BRIDGE;
  return true;
}

function hasDrop(map, r) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (map.ter[idx(x, y)] === T.CHASM) return true;
  return false;
}

// The zone's pools: frozen over on the snowy plateau, molten rock on the volcano. A lava pool that
// would cut the way through has cooled to a black crust you can walk on.
export function fillPools(map, wet, start, taken = new Set()) {
  if (wet === 'ice') {
    // a warm spring stays open in the snow
    for (let i = 0; i < map.ter.length; i++) if (map.ter[i] === T.WATER && !map.spring?.includes(i)) map.ter[i] = T.ICE;
    return;
  }
  if (wet !== 'lava') return;
  const seen = new Set();
  for (let i = 0; i < map.ter.length; i++) {
    if (map.ter[i] !== T.WATER || seen.has(i)) continue;
    // one pool at a time
    const pool = [i];
    seen.add(i);
    for (let h = 0; h < pool.length; h++) {
      const x = pool[h] % map.w, y = (pool[h] / map.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = idx(x + dx, y + dy);
        if (map.ter[j] === T.WATER && !seen.has(j)) { seen.add(j); pool.push(j); }
      }
    }
    const before = reach(map, start.x, start.y);
    // ...and never in a doorway: what lies right by a door has cooled to crust (v0.29: a door on the
    // volcano opened onto lava)
    const byDoor = j => DIRS8.some(([dx, dy]) => map.tiles[idx(j % map.w + dx, ((j / map.w) | 0) + dy)] === DOOR);
    for (const j of pool) map.ter[j] = byDoor(j) ? T.ASH : T.LAVA;
    const hot = pool.filter(j => map.ter[j] === T.LAVA).length;
    if (pool.some(j => taken.has(j)) || reach(map, start.x, start.y) + hot < before) for (const j of pool) map.ter[j] = T.ASH;
  }
}
