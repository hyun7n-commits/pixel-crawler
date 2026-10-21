// The living dungeon: fire, gas, explosions, collapsing ceilings and what happens when you step on things.
// Like run.js these are pure rules. They change the run and emit events for the scene to draw.

import { T, TERRAIN, GAS_KEYS, SLEEP_MIN, POISON_MIN, MINE_MIN, isMushroom } from '../data/terrain.js';
import { idx, inMap, passable, isBorder, WALL, FLOOR, ORE, RUBBLE } from './dungeon.js';
import { rint, DIRS8 } from './util.js';

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GAS_DECAY = { sleep: 0.9, poison: 0.9, mine: 0.97 };

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
    if (who === 'player') { run.log('웅덩이에 뛰어들어 불을 껐어요.', 'good'); run.discover('water_fire'); }
    else run.say(who, '휴…');
  }
  if (isMushroom(ter)) burstMushroom(run, x, y);
  if (ter === T.STICKY) {
    b.stuck = 1;
    if (who === 'player') run.log('끈적이를 밟았어요! 한 턴 붙잡혀요.', 'warn');
    else run.say(who, '끈적!');
  }
  if (who === 'player' && ter === T.BRUSH && !run.told.brush) {
    run.told.brush = true;
    run.log('버섯 덤불 속에 숨었어요. 멀리 있는 적은 나를 못 봐요.', 'good');
  }
}

// ---------- fire ----------
export function setBurn(run, who, n) {
  const b = body(run, who);
  if (b.hp <= 0 || run.map.ter[idx(b.x, b.y)] === T.WATER) return;
  const was = b.burn > 0;
  b.burn = Math.max(b.burn || 0, n);
  if (was) return;
  if (who === 'player') { run.say('player', '앗 뜨거!'); run.log('몸에 불이 붙었어요! 웅덩이에 들어가면 꺼져요.', 'warn'); }
  else run.say(who, '앗뜨뜨!');
}

// Sets a tile alight. `flash` makes even bare floor burn for a moment (explosions).
export function ignite(run, x, y, flash = false) {
  if (!inMap(x, y)) return;
  const map = run.map, i = idx(x, y);
  if (!passable(map, x, y) || map.ter[i] === T.WATER) return;
  if (map.gas.mine[i] >= MINE_MIN) gasExplode(run, x, y);
  burnPoison(run, x, y);
  const ter = map.ter[i];
  if (isMushroom(ter)) { burstMushroom(run, x, y); return; }
  const burn = TERRAIN[ter]?.burn || 0;
  if (burn) map.fire[i] = Math.max(map.fire[i], burn);
  else if (flash) map.fire[i] = Math.max(map.fire[i], 1);
  else return;
  const w = whoAt(run, x, y);
  if (w) setBurn(run, w, 3);
}

function burnPoison(run, x, y) {
  const g = run.map.gas.poison;
  let gone = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    if (!inMap(x + i, y + j)) continue;
    const k = idx(x + i, y + j);
    gone += g[k];
    g[k] = 0;
  }
  if (gone > 2) {
    run.emit('burnoff', { x, y });
    if (run.isVisible(x, y)) run.discover('fire_poison');
  }
}

function fireTick(run) {
  const map = run.map, spread = new Set(), ended = [];
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
    if (map.gas.poison[i] > 0) burnPoison(run, x, y);
    if (--map.fire[i] === 0) ended.push(i);
  }
  const changed = [];
  for (const i of ended) {
    const x = i % map.w, y = (i / map.w) | 0;
    if (map.ter[i] === T.BRUSH) { map.ter[i] = T.ASH; changed.push(i); }
    else if (map.ter[i] === T.TIMBER) {
      if (run.isVisible(x, y)) run.discover('fire_timber');
      collapse(run, x, y);
    }
  }
  for (const j of spread) {
    const x = j % map.w, y = (j / map.w) | 0;
    if (map.ter[j] === T.BRUSH && run.isVisible(x, y)) run.discover('fire_brush');
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

export function burstMushroom(run, x, y) {
  const map = run.map, i = idx(x, y);
  const kind = map.ter[i] === T.MUSH_SLEEP ? 'sleep' : 'poison';
  map.ter[i] = T.NONE;
  addGas(run, x, y, kind, 40);
  for (const [dx, dy] of DIRS4) addGas(run, x + dx, y + dy, kind, 20);
  run.emit('puff', { x, y, kind });
  run.emit('tiles', { list: [i] });
  if (run.isVisible(x, y)) {
    run.log(kind === 'sleep' ? '졸음 버섯이 터졌어요! 보라 가스를 마시면 잠들어요.' : '독 버섯이 터졌어요! 초록 가스는 몸에 해로워요.', 'warn');
  }
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

// Vents leak mine gas a little every turn. Also used to pre-fill rooms when a floor is made.
export function gasTick(run) {
  const map = run.map;
  for (const v of map.vents) {
    const i = idx(v.x, v.y);
    if (v.rest > 0) { v.rest--; continue; } // a vent that just blew up stays quiet for a while
    if (map.ter[i] === T.VENT && map.tiles[i] === FLOOR) map.gas.mine[i] = Math.min(40, map.gas.mine[i] + 4);
  }
  if (!run.gasActive && !map.vents.length) return;
  let any = false;
  for (const k of GAS_KEYS) any = diffuse(map, k) || any;
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
  for (const v of map.vents) if (seen.has(idx(v.x, v.y)) || Math.abs(v.x - sx) + Math.abs(v.y - sy) <= 3) v.rest = 25;
  run.emit('gasboom', { tiles, x: sx, y: sy });
  const dmg = 8 + 2 * run.floor;
  for (const t of tiles) damageAt(run, t.x, t.y, dmg, '광산 가스 폭발에 휘말렸어요', 'fire');
  for (const t of tiles) ignite(run, t.x, t.y, true);
  for (const t of tiles) {
    for (const [dx, dy] of [[0, 0], ...DIRS4]) {
      if (inMap(t.x + dx, t.y + dy) && map.ter[idx(t.x + dx, t.y + dy)] === T.CRACKED) {
        collapse(run, t.x + dx, t.y + dy);
        run.discover('bomb_ceiling');
      }
    }
  }
  run.noise(sx, sy, 12);
  if (tiles.length > 1 || run.isVisible(sx, sy)) run.discover('fire_mine');
}

// ---------- explosions and collapses ----------
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
    if (map.tiles[idx(tx, ty)] === WALL && !isBorder(tx, ty)) {
      breakWall(run, tx, ty);
      changed.push(idx(tx, ty));
      broke = true;
    }
  }
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) ignite(run, x + i, y + j, true);
  for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) {
    if (inMap(x + i, y + j) && map.ter[idx(x + i, y + j)] === T.CRACKED) {
      collapse(run, x + i, y + j);
      run.discover('bomb_ceiling');
    }
  }
  if (broke) run.discover('bomb_wall');
  if (changed.length) run.emit('tiles', { list: changed });
  run.noise(x, y, 9);
}

export function breakWall(run, x, y) {
  const map = run.map, i = idx(x, y);
  if (map.ore[i] === ORE) {
    const amount = (Math.floor((run.floor - 1) / 3) + 1) * rint(6, 12);
    run.pickups.push({ x, y, type: 'gold', amount });
    run.log('반짝돌이 쏟아졌어요!', 'good');
  }
  map.tiles[i] = FLOOR;
  map.ore[i] = 0;
  map.dig[i] = 0;
  map.ter[i] = T.NONE;
}

// The ceiling over (x, y) comes down: the tile turns into a rock pile that can be dug out.
export function collapse(run, x, y) {
  const map = run.map, i = idx(x, y);
  if (map.tiles[i] !== FLOOR) return;
  map.tiles[i] = WALL;
  map.ore[i] = RUBBLE;
  map.dig[i] = 2;
  map.ter[i] = T.NONE;
  map.fire[i] = 0;
  for (const k of GAS_KEYS) map.gas[k][i] = 0;
  run.carts = run.carts.filter(c => !(c.x === x && c.y === y));
  for (const q of run.pickups.filter(q => q.x === x && q.y === y)) {
    const s = nearestFree(run, x, y);
    if (s) { q.x = s.x; q.y = s.y; }
  }
  const w = whoAt(run, x, y), dmg = 10 + 2 * run.floor;
  run.emit('collapse', { x, y });
  if (w) {
    const s = nearestFree(run, x, y);
    const b = body(run, w);
    if (s) { b.x = s.x; b.y = s.y; }
    if (w === 'player') { run.hurtPlayer(dmg, '무너진 천장에 깔렸어요', 'crush'); run.p.stun = 1; }
    else { run.hurt(w, dmg, 'crush'); if (w.hp > 0) { w.stun = 2; run.say(w, '으악!'); } }
  }
  const list = [i];
  for (const [dx, dy] of DIRS8) if (inMap(x + dx, y + dy)) list.push(idx(x + dx, y + dy));
  run.emit('tiles', { list });
  run.noise(x, y, 8);
}

export function nearestFree(run, x, y) {
  const seen = new Set([idx(x, y)]), q = [[x, y]];
  for (let h = 0; h < q.length && h < 200; h++) {
    const [cx, cy] = q[h];
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx, ny = cy + dy, j = idx(nx, ny);
      if (!inMap(nx, ny) || seen.has(j)) continue;
      seen.add(j);
      if (!passable(run.map, nx, ny)) continue;
      if (!whoAt(run, nx, ny) && !run.cartAt(nx, ny) && run.map.ter[j] !== T.PIT) return { x: nx, y: ny };
      q.push([nx, ny]);
    }
  }
  return null;
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
  for (const c of run.carts.slice()) {
    if (c.bomb > 0 && --c.bomb === 0) run.cartBlast(c);
  }
}

function creatureTick(run, who) {
  const map = run.map, b = body(run, who);
  if (b.hp <= 0) return;
  const i = idx(b.x, b.y);

  if (map.gas.sleep[i] >= SLEEP_MIN) {
    if (who === 'player') {
      if (!run.p.sleep) { run.say('player', '하암…'); run.log('졸음 가스를 마셔서 잠들었어요…', 'warn'); }
      run.p.sleep = 2;
    } else if (who.state !== 'sleep') {
      who.state = 'sleep'; who.wake = 0; who.doze = 2; who.aim = false;
      run.say(who, '하암…');
    } else who.doze = 2;
  } else if (who === 'player' && run.p.sleep > 0 && --run.p.sleep === 0) {
    run.log('잠에서 깼어요.', 'good');
  }

  const pg = map.gas.poison[i];
  if (pg >= POISON_MIN) {
    const dmg = 1 + Math.floor(pg / 15);
    b.poisoned = 2;
    if (who === 'player') run.hurtPlayer(dmg, '독 가스를 너무 마셨어요', 'poison');
    else run.hurt(who, dmg, 'poison');
  } else if (b.poisoned) b.poisoned--;
  if (b.hp <= 0) return;

  if (b.burn > 0) {
    if (map.ter[i] === T.WATER) { b.burn = 0; return; }
    const dmg = 2 + Math.floor(run.floor / 3);
    if (who === 'player') run.hurtPlayer(dmg, '불에 타 버렸어요', 'burn');
    else run.hurt(who, dmg, 'fire');
    if (TERRAIN[map.ter[i]]?.burn && !map.fire[i]) ignite(run, b.x, b.y);
    b.burn--;
  }
}
