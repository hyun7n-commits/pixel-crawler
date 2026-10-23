// The living dungeon: fire, gas, explosions and what happens when you step on things.
// Like run.js these are pure rules. They change the run and emit events for the scene to draw.

import { T, TERRAIN, GAS_KEYS, SLEEP_MIN, MINE_MIN, isTrap } from '../data/terrain.js';
import { idx, inMap, passable, isBorder, WALL, FLOOR, DOOR, GRAVE, LOCKED } from './dungeon.js';
import { ITEMS } from '../data/items.js';
import { DIRS8, pick, rint, shuffle, josa } from './util.js';
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
  // tall grass is flattened by whoever walks into it, like in Shattered Pixel Dungeon (판다 munches it first)
  if (ter === T.BRUSH && who === 'player' && run.char.graze) run.heal(run.char.graze);
  if (ter === T.BRUSH) trample(run, who, x, y);
  if (ter === T.BERRY && who === 'player') eatBerries(run, x, y);
  if (who === 'player' && isTrap(ter)) springTrap(run, x, y);
  if (who === 'player' && ter === T.RING) warp(run, x, y);
  // 꿀: whoever walks into the queen bee's honey is stuck there a turn (her bees fly over it)
  if (ter === T.HONEY && who === 'player') {
    run.p.sticky = 1;
    if (!run.told.honey) { run.told.honey = true; run.log('꿀을 밟았다! 끈적끈적, 다음 걸음은 발을 떼느라 한 턴이 간다.', 'warn'); }
  } else if (ter === T.HONEY && !who.d.flies && who.type !== 'queen') who.stun = Math.max(who.stun || 0, 1);
}

// 요정 고리: step into one and you pop out of its partner. The fairies only carry you, so whoever
// was on your heels loses your trail and has to find the long way round.
function warp(run, x, y) {
  const to = (run.map.rings || []).find(r => r.x !== x || r.y !== y);
  if (!to) return;
  if (run.enemyAt(to.x, to.y)) { run.log('짝 고리 위에 누가 서 있어서 빠져나가지 못했다.'); return; }
  run.p.x = to.x; run.p.y = to.y;
  run.trail = [{ x: to.x, y: to.y }];
  run.emit('warp', { from: { x, y }, to: { x: to.x, y: to.y } });
  if (!run.told.ring) { run.told.ring = true; run.log('요정 고리에 들어갔더니 다른 고리로 뿅 하고 나왔다!', 'good'); }
}

// 산딸기 덤불: walking in, you pick the berries and eat them; what is left is an ordinary bush
function eatBerries(run, x, y) {
  const i = idx(x, y);
  run.map.ter[i] = T.BRUSH;
  run.emit('tiles', { list: [i], soft: true });
  run.emit('berry', { x, y });
  run.heal(B.berryHeal(run.floor));
  run.log('산딸기를 따 먹었다. 새콤달콤하다.', 'good');
}

function trample(run, who, x, y) {
  const i = idx(x, y);
  run.map.ter[i] = T.GRASS;
  run.emit('tiles', { list: [i], soft: true });
  if (run.isVisible(x, y)) run.emit('rustle', { x, y });
  // now and then something glints in the grass
  if (who === 'player' && Math.random() < B.GRASS_COIN) {
    const n = rint(1, 3) * (1 + Math.floor((run.floor - 1) / B.FLOORS_PER_ZONE));
    run.addGold(n);
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
    if (seen) run.log('퐁! 졸음 꽃에서 꽃가루가 퍼졌다!', 'warn');
  } else if (t === T.TRAP_SPIKE) {
    if (seen) run.log('따끔! 풀숲에 밤송이가 숨어 있었다!', 'warn');
    damageAt(run, x, y, B.trapSpike(run.floor), '밤송이를 밟았다', 'spike');
  } else if (t === T.TRAP_ALARM) {
    run.log('딸랑딸랑! 방울 소리가 구역 전체에 울렸다!', 'warn');
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
    if (seen || onMe) run.log('쿠구궁!', 'warn');
  }
}

// ---------- the squirrels' acorn stash ----------
// Digs up a dirt mound where the squirrels buried their acorns (bumped into, or blown open). Noisy.
// Usually something good, sometimes an angry squirrel; the big oak stump is their store: it holds a
// chest and whatever gold the acorn squirrels got away with on this floor, and its keeper always
// comes out. (The tiles are still called graves in the code.)
export function openGrave(run, x, y) {
  const map = run.map, i = idx(x, y), big = map.bigGrave === i;
  map.tiles[i] = FLOOR;
  map.ter[i] = T.DUG;
  run.emit('tiles', { list: [i], soft: true });
  run.emit('dig', { x, y });
  run.noise(x, y, 5);
  const roll = Math.random();
  if (big || roll < 0.3) {
    const e = run.spawnEnemy('wraith', x, y, B.gimmickScale(run.floor));
    e.state = 'hunt';
    e.last = { x: run.p.x, y: run.p.y };
    run.say(e, '!');
    run.log(big ? '도토리 창고 주인이 튀어나왔다! 화난 청설모다!' : '흙 속에서 화난 청설모가 튀어나왔다!', 'warn');
  }
  if (big) {
    run.pickups.push({ x, y, type: 'chest' }, { x, y, type: 'gold', amount: B.graveGold(run.floor) * 2 }, { x, y, type: 'candy' });
    run.log('그루터기 구멍 안에 보물 상자와 별사탕이 숨겨져 있었다!', 'good');
    if (map.stash) {
      run.pickups.push({ x, y, type: 'gold', amount: map.stash, stolen: true });
      run.log('다람쥐가 훔쳐 간 골드도 여기 모여 있었다!', 'good');
      map.stash = 0;
    }
  } else if (roll >= 0.3 && roll < 0.7) {
    run.pickups.push({ x, y, type: 'gold', amount: B.graveGold(run.floor) });
    run.log('흙 속에서 골드가 나왔다.', 'good');
  } else if (roll >= 0.7 && roll < 0.9) {
    const type = run.dare?.('nopotion') ? 'bomb' : pick(['potion', 'bomb']);
    run.pickups.push({ x, y, type });
    run.log(`흙 속에서 ${josa(ITEMS[type].name, '이', '가')} 나왔다.`, 'good');
  } else if (roll >= 0.9) run.log('도토리 껍질뿐이다.');
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
    run.log(`숨은 함정을 찾았다! ${josa(TERRAIN[map.ter[i]].name, '이다', '다')}.`, 'good');
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
  if (who !== 'player' && who.d.npc) return;
  // 숯덩이 catches: it flares up quick and fierce, and burns itself out in a few turns
  if (who !== 'player' && who.d.coal && !who.lit && who.hp > 0) {
    Object.assign(who, { lit: 9, look: 'coalLit', state: 'hunt', last: { x: run.p.x, y: run.p.y }, wake: 0, doze: 0 });
    run.emit('kindle', { enemy: who });
    run.say(who, '화르륵!');
    if (run.isVisible(who.x, who.y)) run.log(`${josa(who.d.name, '에', '에')} 불이 붙었다! 활활 타오른다!`, 'warn');
  }
  if (who !== 'player' && who.d.fireproof) return;
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
    // a wooden bridge burnt through falls into the drop, with whoever is on it
    else if (map.fire[i] === 0 && map.ter[i] === T.BRIDGE) {
      map.ter[i] = T.CHASM;
      changed.push(i);
      run.emit('collapse', { x, y });
      if (run.isVisible(x, y)) run.log('불탄 다리가 와르르 무너졌다!', 'warn');
      if (w === 'player') { run.pendingFall = true; run.fallAt = { x, y }; }
      else if (w && !w.d.flies && !w.d.boss) run.plunge(w, { x, y });
    }
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
  for (const t of tiles) damageAt(run, t.x, t.y, dmg, '늪 가스 폭발에 휘말렸다', 'fire');
  for (const t of tiles) ignite(run, t.x, t.y, true);
  run.noise(sx, sy, 12);
  if (tiles.length > 1 || run.isVisible(sx, sy)) run.discover('fire_mine');
}

// ---------- explosions ----------
export function explosion(run, x, y, r, { dmg, cause, selfMult = 0.5, burn = 0, own = false }) {
  const map = run.map, changed = [];
  let broke = false;
  run.emit('boom', { x, y, r });
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const tx = x + i, ty = y + j;
    if (!inMap(tx, ty)) continue;
    const w = whoAt(run, tx, ty);
    // 펭귄 knows how to stand next to its own bombs
    if (w === 'player') { if (!(own && run.char.bombs)) run.hurtPlayer(Math.max(1, Math.round(dmg * selfMult)), cause, 'bomb'); }
    else if (w) { run.hurt(w, dmg, 'fire'); if (burn && w.hp > 0) setBurn(run, w, burn); }
    const t = map.tiles[idx(tx, ty)];
    if (t === GRAVE) { openGrave(run, tx, ty); continue; }
    if ((t === WALL && !isBorder(tx, ty)) || t === DOOR || t === LOCKED) {
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
  smokeHive(run);
  for (const who of ['player', ...run.enemies.filter(e => e.hp > 0)]) creatureTick(run, who);
}

// Smoke from a fire by the honey stump puts its bees to sleep (how beekeepers do it), angry or not;
// they stay asleep a while after the fire dies down.
function smokeHive(run) {
  const map = run.map, h = map.hive;
  if (!h) return;
  let smoke = false;
  for (let dy = -B.HIVE_SMOKE; dy <= B.HIVE_SMOKE && !smoke; dy++) for (let dx = -B.HIVE_SMOKE; dx <= B.HIVE_SMOKE; dx++) {
    if (inMap(h.x + dx, h.y + dy) && map.fire[idx(h.x + dx, h.y + dy)] > 0) { smoke = true; break; }
  }
  if (!smoke) return;
  let n = 0;
  for (const e of run.enemies) {
    if (!e.d.swarm || e.hp <= 0) continue;
    if (e.state !== 'sleep') n++;
    Object.assign(e, { state: 'sleep', angry: false, aim: false, wake: 0, doze: 8 });
  }
  if (n && run.isVisible(h.x, h.y)) {
    run.emit('smoke', { x: h.x, y: h.y });
    run.discover('smoke_bees');
    run.log('연기를 맡은 벌들이 꾸벅꾸벅 졸기 시작했다.', 'good');
  }
}

function creatureTick(run, who) {
  const map = run.map, b = body(run, who);
  if (b.hp <= 0) return;
  const i = idx(b.x, b.y);

  // peppermint lets you shrug off thinner gas, and at Lv3 all of it
  const mint = who === 'player' ? (run.lv('dreamlamp') || run.lv('pillow') ? 3 : run.lv('mint')) : 0;
  const sleepAt = mint >= 3 ? Infinity : SLEEP_MIN * (1 + mint);
  if (map.gas.sleep[i] >= sleepAt) {
    if (who === 'player') {
      // a hit wakes you for one turn, enough to stumble out of the cloud
      if (run.p.wokeAt !== run.turn) {
        if (!run.p.sleep) {
          run.say('player', '하암…');
          run.log(run.told.snore ? '졸음 꽃가루를 마셔서 잠들었다…' : '졸음 꽃가루를 마셔서 잠들었다… 코 고는 소리에 적이 몰려온다!', 'warn');
          run.told.snore = true;
        }
        run.p.sleep = 2;
      }
    } else if (who.state !== 'sleep') {
      who.state = 'sleep'; who.wake = 0; who.doze = 2; who.aim = false;
      if (run.isVisible(b.x, b.y)) run.discover(who.d.screams ? 'hush_root' : 'sleep_enemy');
    } else who.doze = 2;
  } else if (who === 'player' && run.p.sleep > 0 && --run.p.sleep === 0) {
    run.log('잠에서 깼다.', 'good');
  }
  // asleep you snore, and anything awake nearby comes to see
  if (who === 'player' && run.p.sleep > 0) {
    run.emit('snore', { x: b.x, y: b.y, r: SNORE_NOISE });
    run.noise(b.x, b.y, SNORE_NOISE);
  }

  // 온천: a warm pool soaks the aches away, a little every other turn (critters' too)
  if (map.spring?.includes(i) && run.turn % 2 === 0) {
    if (who === 'player') {
      if (run.p.hp < run.stat().maxHp) {
        run.heal(B.SPRING_HEAL);
        if (!run.told.spring) { run.told.spring = true; run.log('따끈한 온천이다. 몸이 노곤노곤 풀린다.', 'good'); }
        run.emit('soak', { x: b.x, y: b.y });
      }
    } else if (b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + B.SPRING_HEAL);
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
