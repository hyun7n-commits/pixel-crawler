// The living dungeon: fire, gas, explosions and what happens when you step on things.
// Like run.js these are pure rules. They change the run and emit events for the scene to draw.

import { T, TERRAIN, GAS_KEYS, SLEEP_MIN, MINE_MIN, isTrap } from '../data/terrain.js';
import { idx, inMap, passable, isBorder, WALL, FLOOR, DOOR } from './dungeon.js';
import { DIRS8, pick, rint, shuffle } from './util.js';
import * as B from '../data/balance.js';

const { SNORE_NOISE } = B;

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GAS_DECAY = { sleep: 0.8, mine: 0.97 };

// 'player', an enemy, or null
export function whoAt(run, x, y) {
  if (run.p.x === x && run.p.y === y) return 'player';
  return run.enemyAt(x, y) || null;
}
const body = (run, who) => (who === 'player' ? run.p : who);

function damageAt(run, x, y, dmg, cause, kind) {
  const w = whoAt(run, x, y);
  if (w === 'player') run.hurtPlayer(dmg, cause, kind);
  else if (w) run.hurt(w, dmg, kind);
}

// ---------- stepping on things ----------
export function onEnter(run, who, x, y) {
  const map = run.map, i = idx(x, y), ter = map.ter[i], b = body(run, who);
  if (map.fire[i] > 0) setBurn(run, who, 3);
  if (ter === T.WATER && b.burn > 0) {
    b.burn = 0;
    run.emit('steam', { x, y });
    if (who === 'player') { run.log('웅덩이에 뛰어들어 불을 껐다.', 'good'); run.discover('water_fire'); }
  }
  // tall grass is flattened by whoever walks into it, like in Shattered Pixel Dungeon
  if (ter === T.BRUSH) trample(run, who, x, y);
  if (who === 'player' && isTrap(ter)) springTrap(run, x, y);
}

function trample(run, who, x, y) {
  const i = idx(x, y);
  run.map.ter[i] = T.GRASS;
  run.emit('tiles', { list: [i], soft: true });
  if (run.isVisible(x, y)) run.emit('rustle', { x, y });
  // now and then something glints in the grass
  if (who === 'player' && Math.random() < B.GRASS_COIN) {
    const n = rint(1, 3) * (1 + Math.floor((run.floor - 1) / B.FLOORS_PER_ZONE));
    run.addGold(n, x, y);
    run.log(`풀 속에서 동전 ${n}개를 주웠다.`, 'good');
  }
}

// ---------- traps ----------
// Sets off the trap at (x, y): stepped on by you, or caught in a blast.
export function springTrap(run, x, y) {
  const map = run.map, i = idx(x, y), t = map.ter[i];
  if (!isTrap(t)) return;
  map.ter[i] = T.TRAP_OFF;
  map.hidden[i] = 0;
  run.emit('tiles', { list: [i], soft: true });
  run.emit('trap', { x, y, kind: t });
  const seen = run.isVisible(x, y), onMe = run.p.x === x && run.p.y === y;
  if (t === T.TRAP_SLEEP) {
    addGas(run, x, y, 'sleep', 60);
    for (const [dx, dy] of DIRS8) addGas(run, x + dx, y + dy, 'sleep', 30);
    run.emit('puff', { x, y, kind: 'sleep' });
    if (seen) run.log('딸깍! 졸음 가스가 뿜어져 나왔다!', 'warn');
  } else if (t === T.TRAP_SPIKE) {
    if (seen) run.log('푹! 바닥에서 가시가 솟았다!', 'warn');
    damageAt(run, x, y, B.trapSpike(run.floor), '가시 함정을 밟았다', 'spike');
  } else if (t === T.TRAP_ALARM) {
    run.log('따르르릉! 요란한 종소리가 층 전체에 울렸다!', 'warn');
    run.emit('alarm', { x, y });
    run.noise(x, y, 99);
  } else if (t === T.TRAP_SUMMON) {
    const spots = [];
    for (let r = 1; r <= 2 && spots.length < 6; r++) {
      for (const [dx, dy] of shuffle([...DIRS8])) {
        const sx = x + dx * r, sy = y + dy * r;
        if (run.canEnemyEnter(sx, sy) && !whoAt(run, sx, sy) && !spots.some(o => o.x === sx && o.y === sy)) spots.push({ x: sx, y: sy });
      }
    }
    const n = Math.min(spots.length, B.trapSummon(run.floor));
    for (const s of spots.slice(0, n)) {
      const e = run.spawnEnemy(pick(run.zone.enemies), s.x, s.y, B.enemyScale(run.floor));
      e.state = 'hunt';
      e.last = { x: run.p.x, y: run.p.y };
      run.emit('summon', { x: s.x, y: s.y });
    }
    if (seen || onMe) run.log(`쿠구궁! 함정에서 몬스터 ${n}마리가 튀어나왔다!`, 'warn');
  }
}

// Hidden traps next to you may be spotted at the end of each turn.
export function spotTraps(run) {
  const map = run.map, p = run.p;
  for (const [dx, dy] of DIRS8) {
    const x = p.x + dx, y = p.y + dy, i = idx(x, y);
    if (!inMap(x, y) || !map.hidden[i] || Math.random() > B.TRAP_SPOT) continue;
    map.hidden[i] = 0;
    run.emit('tiles', { list: [i], soft: true });
    run.emit('spot', { x, y });
    run.log(`숨은 함정을 찾았다! ${TERRAIN[map.ter[i]].name}이다.`, 'good');
  }
}

// Shows every hidden trap on the floor (the map item).
export function revealTraps(run) {
  const map = run.map, list = [];
  for (let i = 0; i < map.hidden.length; i++) if (map.hidden[i]) { map.hidden[i] = 0; list.push(i); }
  if (list.length) run.emit('tiles', { list, soft: true });
  return list.length;
}

// ---------- fire ----------
export function setBurn(run, who, n) {
  const b = body(run, who);
  if (b.hp <= 0 || run.map.ter[idx(b.x, b.y)] === T.WATER) return;
  const was = b.burn > 0;
  b.burn = Math.max(b.burn || 0, n);
  if (was) return;
  if (who === 'player') { run.say('player', '앗 뜨거!'); run.log('몸에 불이 붙었다! 웅덩이에 들어가면 꺼진다.', 'warn'); }
}

// Sets a tile alight. `flash` makes even bare floor burn for a moment (explosions).
export function ignite(run, x, y, flash = false) {
  if (!inMap(x, y)) return;
  const map = run.map, i = idx(x, y);
  if (!passable(map, x, y) || map.ter[i] === T.WATER) return;
  if (map.gas.mine[i] >= MINE_MIN) gasExplode(run, x, y);
  const ter = map.ter[i];
  const burn = TERRAIN[ter]?.burn || 0;
  if (burn) map.fire[i] = Math.max(map.fire[i], burn);
  else if (flash) map.fire[i] = Math.max(map.fire[i], 1);
  else return;
  const w = whoAt(run, x, y);
  if (w) setBurn(run, w, 3);
}

function fireTick(run) {
  const map = run.map, spread = new Set(), changed = [];
  for (let i = 0; i < map.fire.length; i++) {
    if (!map.fire[i]) continue;
    const x = i % map.w, y = (i / map.w) | 0;
    const w = whoAt(run, x, y);
    if (w) setBurn(run, w, 3);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = idx(nx, ny);
      if (map.fire[j]) continue;
      if (map.gas.mine[j] >= MINE_MIN) spread.add(j);
      else if (TERRAIN[map.ter[j]]?.burn && Math.random() < 0.45) spread.add(j);
    }
    if (--map.fire[i] === 0 && (map.ter[i] === T.BRUSH || map.ter[i] === T.GRASS)) { map.ter[i] = T.ASH; changed.push(i); }
  }
  for (const j of spread) {
    const x = j % map.w, y = (j / map.w) | 0;
    if ((map.ter[j] === T.BRUSH || map.ter[j] === T.GRASS) && run.isVisible(x, y)) run.discover('fire_brush');
    ignite(run, x, y);
  }
  if (changed.length) run.emit('tiles', { list: changed });
}

// ---------- gas ----------
export function addGas(run, x, y, kind, amount) {
  if (!passable(run.map, x, y)) return;
  run.map.gas[kind][idx(x, y)] += amount;
  run.gasActive = true;
}

function diffuse(map, kind) {
  const g = map.gas[kind], next = new Float32Array(g.length), decay = GAS_DECAY[kind];
  let any = false;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (!passable(map, x, y)) continue;
    const i = idx(x, y);
    let sum = g[i] * 2, cnt = 2;
    for (const [dx, dy] of DIRS4) {
      if (passable(map, x + dx, y + dy)) { sum += g[idx(x + dx, y + dy)]; cnt++; }
    }
    const v = (sum / cnt) * decay;
    if (v >= 0.25) { next[i] = v; any = true; }
  }
  g.set(next);
  return any;
}

export function gasTick(run) {
  if (!run.gasActive) return;
  let any = false;
  for (const k of GAS_KEYS) any = diffuse(run.map, k) || any;
  run.gasActive = any;
}

// Everything connected to (sx, sy) that holds mine gas goes off at once.
export function gasExplode(run, sx, sy) {
  const map = run.map, g = map.gas.mine;
  const start = idx(sx, sy), seen = new Set([start]), q = [{ x: sx, y: sy, d: 0 }], tiles = [];
  for (let h = 0; h < q.length && tiles.length < 300; h++) {
    const t = q[h];
    tiles.push(t);
    for (const [dx, dy] of DIRS4) {
      const nx = t.x + dx, ny = t.y + dy, j = idx(nx, ny);
      if (!inMap(nx, ny) || seen.has(j) || g[j] < MINE_MIN * 0.5) continue;
      seen.add(j);
      q.push({ x: nx, y: ny, d: t.d + 1 });
    }
  }
  for (const t of tiles) g[idx(t.x, t.y)] = 0;
  run.emit('gasboom', { tiles, x: sx, y: sy });
  const dmg = 8 + 2 * run.floor;
  for (const t of tiles) damageAt(run, t.x, t.y, dmg, '광산 가스 폭발에 휘말렸다', 'fire');
  for (const t of tiles) ignite(run, t.x, t.y, true);
  run.noise(sx, sy, 12);
  if (tiles.length > 1 || run.isVisible(sx, sy)) run.discover('fire_mine');
}

// ---------- explosions ----------
export function explosion(run, x, y, r, { dmg, cause, selfMult = 0.5 }) {
  const map = run.map, changed = [];
  let broke = false;
  run.emit('boom', { x, y, r });
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const tx = x + i, ty = y + j;
    if (!inMap(tx, ty)) continue;
    const w = whoAt(run, tx, ty);
    if (w === 'player') run.hurtPlayer(Math.max(1, Math.round(dmg * selfMult)), cause, 'bomb');
    else if (w) run.hurt(w, dmg, 'fire');
    const t = map.tiles[idx(tx, ty)];
    if ((t === WALL && !isBorder(tx, ty)) || t === DOOR) {
      breakWall(run, tx, ty);
      changed.push(idx(tx, ty));
      broke = broke || t === WALL;
    }
  }
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) ignite(run, x + i, y + j, true);
  // a blast sets off any trap it reaches, so you can spring one from a distance
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (!inMap(x + i, y + j) || !isTrap(map.ter[idx(x + i, y + j)])) continue;
    springTrap(run, x + i, y + j);
    run.discover('bomb_trap');
  }
  if (broke) run.discover('bomb_wall');
  if (changed.length) run.emit('tiles', { list: changed });
  run.noise(x, y, 9);
}

// Blows a hole in a wall or a door.
export function breakWall(run, x, y) {
  const map = run.map, i = idx(x, y);
  if (map.tiles[i] === DOOR) map.doors = map.doors.filter(d => d.x !== x || d.y !== y);
  map.lights = map.lights.filter(l => l.x !== x || l.y !== y);
  map.tiles[i] = FLOOR;
  map.open[i] = 0;
  map.ter[i] = T.NONE;
}

// All water tiles connected to (x, y)
export function waterBody(map, x, y) {
  const start = idx(x, y), seen = new Set([start]), q = [[x, y]];
  for (let h = 0; h < q.length; h++) {
    const [cx, cy] = q[h];
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx, ny = cy + dy, j = idx(nx, ny);
      if (inMap(nx, ny) && !seen.has(j) && map.ter[j] === T.WATER) { seen.add(j); q.push([nx, ny]); }
    }
  }
  return q;
}

// ---------- once per turn, after the enemies move ----------
export function envTick(run) {
  gasTick(run);
  fireTick(run);
  for (const who of ['player', ...run.enemies.filter(e => e.hp > 0)]) creatureTick(run, who);
}

function creatureTick(run, who) {
  const map = run.map, b = body(run, who);
  if (b.hp <= 0) return;
  const i = idx(b.x, b.y);

  // peppermint lets you shrug off thinner gas, and at Lv3 all of it
  const mint = who === 'player' ? run.p.relics.mint || 0 : 0;
  const sleepAt = mint >= 3 ? Infinity : SLEEP_MIN * (1 + mint);
  if (map.gas.sleep[i] >= sleepAt) {
    if (who === 'player') {
      // a hit wakes you for one turn, enough to stumble out of the cloud
      if (run.p.wokeAt !== run.turn) {
        if (!run.p.sleep) {
          run.say('player', '하암…');
          run.log(run.told.snore ? '졸음 가스를 마셔서 잠들었다…' : '졸음 가스를 마셔서 잠들었다… 코 고는 소리에 적이 몰려온다!', 'warn');
          run.told.snore = true;
        }
        run.p.sleep = 2;
      }
    } else if (who.state !== 'sleep') {
      who.state = 'sleep'; who.wake = 0; who.doze = 2; who.aim = false;
      if (run.isVisible(b.x, b.y)) run.discover('sleep_enemy');
    } else who.doze = 2;
  } else if (who === 'player' && run.p.sleep > 0 && --run.p.sleep === 0) {
    run.log('잠에서 깼다.', 'good');
  }
  // asleep you snore, and anything awake nearby comes to see
  if (who === 'player' && run.p.sleep > 0) {
    run.emit('snore', { x: b.x, y: b.y, r: SNORE_NOISE });
    run.noise(b.x, b.y, SNORE_NOISE);
  }

  if (b.burn > 0) {
    if (map.ter[i] === T.WATER) { b.burn = 0; return; }
    const dmg = 2 + Math.floor(run.floor / 3);
    if (who === 'player') run.hurtPlayer(dmg, '불에 타 버렸다', 'burn');
    else run.hurt(who, dmg, 'fire');
    if (TERRAIN[map.ter[i]]?.burn && !map.fire[i]) ignite(run, b.x, b.y);
    b.burn--;
  }
}
