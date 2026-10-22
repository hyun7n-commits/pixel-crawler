// How enemies behave. Each enemy is in one state at a time:
//   sleep  - snoring; wakes up bit by bit while it can see you (e.wake), or at once on a hit or a loud noise
//   wander - awake and strolling around; notices you when you come into view
//   hunt   - chasing and attacking you
//   search - lost you, goes to where it last saw you and looks around
//   flee   - badly hurt and running away (only enemies with `flees`)
//   hide   - a mimic posing as a chest · stone - a statue standing still · npc - quest folk
//            (none of these act; a hit, or reaching for the mimic or the statue's chest, wakes them up)

import { lineOfSight, distMap, idx, passable } from './dungeon.js';
import { SLEEP_MIN } from '../data/terrain.js';
import { NPC_TEXT } from '../data/npcs.js';
import { MAP_W } from '../data/balance.js';
import { cheb, shuffle, josa, rint, DIRS8 } from './util.js';
import { onEnter } from './world.js';

export const WAKE_AT = 10;

export function canSee(run, e, range) {
  const p = run.p, d = cheb(e, p);
  if (d > range) return false;
  return lineOfSight(run.map, e.x, e.y, p.x, p.y);
}

export function enemyAct(run, e, dmP) {
  const d = e.d, p = run.p;
  if (e.state === 'npc') {
    if (!e.greeted && run.isVisible(e.x, e.y) && cheb(e, p) <= 6) { e.greeted = true; run.say(e, NPC_TEXT[e.type].greet); }
    return;
  }
  if (e.state === 'hide' || e.state === 'stone') return;
  if (e.stun > 0) { e.stun--; return; }
  if (e.stoneT > 0) { e.stoneT--; return; }
  if (run.calm(e)) { calmAct(run, e); return; }
  if (e.state === 'sleep') { sleepTick(run, e); return; }
  if (d.slow) { e.skip = !e.skip; if (e.skip) return; }
  e.timer++;
  if (e.burn > 0 && !d.boss && Math.random() < 0.5) { randomStep(run, e); return; }

  const sees = canSee(run, e, e.state === 'hunt' ? 9 : 7);
  if (sees) {
    e.last = { x: p.x, y: p.y };
    if (e.state === 'wander' || e.state === 'search') {
      e.state = 'hunt';
      run.say(e, '!');
      run.emit('alert', { enemy: e });
      if (!run.p.sleep) return; // noticing takes its turn, unless you are asleep and easy pickings
    }
  }
  if (e.state === 'hunt' && d.flees && e.hp <= e.maxHp * 0.3) {
    e.state = 'flee';
  }
  if (e.loot) e.state = 'flee'; // a goblin with your gold only wants to get away
  if (e.state === 'flee') { flee(run, e, dmP, sees); return; }
  if (e.state === 'hunt') {
    if (sees || e.aim || d.boss) { hunt(run, e, dmP); return; }
    e.state = 'search';
    e.searchT = 0;
  }
  if (e.state === 'search') { search(run, e); return; }
  wander(run, e);
}

function sleepTick(run, e) {
  if (run.map.gas.sleep[idx(e.x, e.y)] >= SLEEP_MIN) { e.wake = 0; return; }
  if (e.doze > 0) { e.doze--; return; }
  if (canSee(run, e, 7)) e.wake += (8 - cheb(e, run.p)) * (1 - 0.2 * run.lv('dreamlamp')) * (run.char.hush || 1);
  else e.wake = Math.max(0, e.wake - 1);
  if (e.wake >= WAKE_AT) {
    e.state = 'hunt';
    e.wake = 0;
    e.last = { x: run.p.x, y: run.p.y };
    run.say(e, '!');
    run.emit('alert', { enemy: e });
  }
}

// A peaceful monster minding its own business: naps, wakes up, ambles about.
function calmAct(run, e) {
  if (e.state === 'sleep') {
    if (e.doze > 0) e.doze--;
    else if (Math.random() < 0.05) e.state = 'wander';
    return;
  }
  if (e.d.slow) { e.skip = !e.skip; if (e.skip) return; }
  if (Math.random() < 0.03) { e.state = 'sleep'; return; }
  wander(run, e);
}

// A mimic drops its act, or a statue comes to life, and goes straight for you.
export function awaken(run, e) {
  if (e.state !== 'hide' && e.state !== 'stone') return;
  run.log(e.state === 'hide' ? '상자에서 집게가 튀어나왔다! 소라게다!' : '허수아비가 삐걱삐걱 움직이기 시작했다!', 'warn');
  e.state = 'hunt';
  e.last = { x: run.p.x, y: run.p.y };
  run.say(e, '!');
  run.emit('reveal', { enemy: e });
  run.emit('alert', { enemy: e });
}

// Woken by a hit (`by` = 'hit') or a noise at (x, y)
export function rouse(run, e, by, x, y) {
  if (e.state === 'npc') return false;
  if (e.state === 'hide' || e.state === 'stone') {
    if (by === 'hit') awaken(run, e);
    return false;
  }
  if (run.calm(e)) {
    if (by !== 'hit') return false; // noise doesn't bother it
    e.angry = true;
    e.state = 'hunt'; e.wake = 0; e.doze = 0;
    e.last = { x: run.p.x, y: run.p.y };
    run.say(e, '!');
    run.emit('alert', { enemy: e });
    run.log(`${josa(e.d.name, '이', '가')} 화났다!`, 'warn');
    return true;
  }
  if (e.state === 'sleep') {
    if (by !== 'hit' && run.map.gas.sleep[idx(e.x, e.y)] >= SLEEP_MIN) return false;
    e.wake = 0; e.doze = 0;
    if (by === 'hit') { e.state = 'hunt'; e.last = { x: run.p.x, y: run.p.y }; run.say(e, '!'); }
    else { e.state = 'search'; e.searchT = 0; e.last = { x, y }; run.say(e, '?'); }
    run.emit('alert', { enemy: e });
    return true;
  }
  if (by !== 'hit' && e.state === 'wander') {
    e.state = 'search'; e.searchT = 0; e.last = { x, y };
  }
  return false;
}

function hunt(run, e, dm) {
  const p = run.p, d = e.d;
  if (run.bossSpecial(e)) return;
  if (e.backoff > 0) { e.backoff--; retreat(run, e, dm, d.fast ? 2 : 1); return; }
  if (d.charge && charge(run, e)) return;
  if (d.blink && blink(run, e)) return;
  const dist = cheb(e, p);
  if (d.ranged) {
    if (e.aim) {
      e.aim = false;
      const stillThere = e.aimAt && e.aimAt.x === p.x && e.aimAt.y === p.y;
      const hit = stillThere && dist <= d.ranged && lineOfSight(run.map, e.x, e.y, p.x, p.y);
      run.emit('shot', { from: { x: e.x, y: e.y }, to: e.aimAt || { x: p.x, y: p.y }, hit });
      if (hit) run.damagePlayer(e.atk, e, 'ranged');
      else run.log(`${d.name}의 공격을 피했다.`, 'good');
      return;
    }
    if (dist > 1 && dist <= d.ranged && lineOfSight(run.map, e.x, e.y, p.x, p.y) && Math.random() < 0.7) {
      e.aim = true;
      e.aimAt = { x: p.x, y: p.y };
      return;
    }
  }
  if (run.touching(e, p)) {
    run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: p.x, y: p.y }, who: e });
    const landed = run.damagePlayer(e.atk, e, 'melee');
    if (d.thief && landed && run.gold > 0) steal(run, e);
    if (d.hitAndRun) e.backoff = 2;
    if (d.stoneSkin && e.hp > 0) { e.stoneT = 1; run.emit('stone', { enemy: e }); }
    return;
  }
  const moves = d.fast ? 2 : 1;
  for (let i = 0; i < moves; i++) {
    if (!followTrail(run, e, dm) && !stepToward(run, e, dm)) break;
    if (cheb(e, p) === 1 || e.hp <= 0) break;
  }
}

// Like in Shattered Pixel Dungeon, a chaser walks in your footsteps, so backing away
// keeps the gap the same and you can plan the next turn. It only leaves your trail
// when the trail winds around and a straight route is clearly shorter.
function followTrail(run, e, dm) {
  const t = run.trail, last = t.length - 1, direct = dm[idx(e.x, e.y)];
  let k = -1;
  for (let j = last; j >= 0; j--) if (t[j].x === e.x && t[j].y === e.y) { k = j; break; }
  let next = -1;
  if (k >= 0) next = k + 1;
  else {
    // not on the trail yet: step onto the newest footprint within reach
    for (let j = last - 1; j >= 0; j--) {
      if (cheb(e, t[j]) === 1 && canStep(run, e, t[j].x, t[j].y)) { next = j; break; }
    }
  }
  if (next < 0 || next >= last || last - next > direct + 1) return false;
  const n = t[next];
  if (!canStep(run, e, n.x, n.y)) return false;
  moveEnemy(run, e, n.x, n.y);
  return true;
}

// The goblin's grab: a handful of your gold, then it runs. It's slowed by the weight, so you can catch it.
function steal(run, e) {
  const n = Math.min(run.gold, 5 + 3 * run.floor + rint(0, 5));
  run.gold -= n;
  e.loot = n;
  e.state = 'flee';
  run.emit('steal', { enemy: e, n, from: { x: run.p.x, y: run.p.y } });
}

// Backs away from you a step or two, like a bat after a bite.
function retreat(run, e, dm, steps) {
  const safe = safetyMap(dm);
  for (let k = 0; k < steps; k++) {
    let best = null, bs = safe[idx(e.x, e.y)];
    for (const [dx, dy] of shuffle(DIRS8.slice())) {
      const nx = e.x + dx, ny = e.y + dy;
      if (canStep(run, e, nx, ny) && safe[idx(nx, ny)] < bs) { bs = safe[idx(nx, ny)]; best = [nx, ny]; }
    }
    if (!best) return;
    moveEnemy(run, e, ...best);
  }
}

// The knight: when you stand in a straight line from it, it paints the lane red and rams down it next
// turn. Still in the lane: a double hit. Stepped aside: it runs to the end and stands there dizzy.
function charge(run, e) {
  const p = run.p;
  if (e.charge) {
    const lane = e.charge;
    e.charge = null;
    let at = { x: e.x, y: e.y }, hit = false;
    for (const t of lane) {
      if (t.x === p.x && t.y === p.y) { hit = true; break; }
      if (!run.canEnemyEnter(t.x, t.y)) break;
      at = t;
    }
    const from = { x: e.x, y: e.y };
    if (at.x !== e.x || at.y !== e.y) moveEnemy(run, e, at.x, at.y);
    run.emit('charge', { enemy: e, from, to: at, hit });
    if (hit) run.damagePlayer(e.atk * 2, e, 'charge');
    else { e.stun = 2; run.emit('stun', { x: e.x, y: e.y }); }
    e.chargeT = e.timer;
    return true;
  }
  const dx = p.x - e.x, dy = p.y - e.y, dist = cheb(e, p);
  const straight = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
  if (!straight || dist < 2 || dist > e.d.charge || e.timer - (e.chargeT ?? -99) < 4) return false;
  const sx = Math.sign(dx), sy = Math.sign(dy), lane = [];
  for (let k = 1; k <= dist + 2; k++) {
    const x = e.x + sx * k, y = e.y + sy * k;
    if (!passable(run.map, x, y)) break;
    if (k < dist && run.enemyAt(x, y)) return false;
    lane.push({ x, y });
  }
  if (lane.length < dist) return false;
  e.charge = lane;
  run.emit('aimCharge', { enemy: e });
  return true;
}

// The wizard: let you get next to it and it pops away to somewhere it can still see you, and aims.
function blink(run, e) {
  const p = run.p;
  if (!run.touching(e, p) || e.timer - (e.blinkT ?? -99) < 5) return false;
  const spots = [];
  for (let y = p.y - 6; y <= p.y + 6; y++) for (let x = p.x - 6; x <= p.x + 6; x++) {
    const dd = cheb({ x, y }, p);
    if (dd >= 4 && run.canEnemyEnter(x, y) && lineOfSight(run.map, x, y, p.x, p.y)) spots.push({ x, y });
  }
  if (!spots.length) return false;
  const to = spots[Math.floor(Math.random() * spots.length)];
  run.emit('teleport', { enemy: e, from: { x: e.x, y: e.y }, to });
  e.x = to.x; e.y = to.y;
  run.refreshDoors();
  e.blinkT = e.timer;
  e.aim = true; e.aimAt = { x: p.x, y: p.y };
  return true;
}

function flee(run, e, dm, sees) {
  // weighed down by your gold: a goblin stumbles every third turn, and gets away once out of sight
  if (e.loot) {
    if (!sees && dm[idx(e.x, e.y)] >= 6) { run.escape(e); return; }
    if (e.timer % 3 === 0) return;
  }
  // walk downhill on the safety map: out through a door and away, never into a corner
  const safe = safetyMap(dm);
  let best = null, bs = safe[idx(e.x, e.y)];
  for (const [dx, dy] of shuffle(DIRS8.slice())) {
    const nx = e.x + dx, ny = e.y + dy;
    if (!canStep(run, e, nx, ny)) continue;
    if (safe[idx(nx, ny)] < bs) { bs = safe[idx(nx, ny)]; best = [nx, ny]; }
  }
  if (best) { moveEnemy(run, e, ...best); }
  else if (run.touching(e, run.p)) {
    run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: run.p.x, y: run.p.y }, who: e });
    run.damagePlayer(e.atk, e, 'melee');
  }
  if (!sees && dm[idx(e.x, e.y)] >= 8) { e.state = 'wander'; e.target = null; }
}

// Brogue's "safety map": start from your distance times -1.2, then let every tile settle to at most
// one step worse than its best neighbour. Far-away places become deep valleys, so a dead-end corner
// near you drains toward the door (even past you) instead of trapping whoever runs there.
// Built once per turn and kept on the distance map it came from.
function safetyMap(dm) {
  if (dm.safe) return dm.safe;
  const n = dm.length, w = MAP_W, s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = dm[i] < 9999 ? -1.2 * dm[i] : 9999;
  const nb = [1, -1, w, -w, w + 1, w - 1, -w + 1, -w - 1];
  for (let pass = 0, changed = true; changed && pass < 30; pass++) {
    changed = false;
    // sweep forward then backward so changes travel both ways in one pass
    for (const dir of [1, -1]) {
      for (let k = 0; k < n; k++) {
        const i = dir > 0 ? k : n - 1 - k;
        if (s[i] >= 9999) continue;
        for (const o of nb) {
          const j = i + o;
          if (j >= 0 && j < n && s[j] < 9999 && s[j] + 1 < s[i]) { s[i] = s[j] + 1; changed = true; }
        }
      }
    }
  }
  dm.safe = s;
  return s;
}

function search(run, e) {
  const last = e.last;
  if (!last) { e.state = 'wander'; return; }
  if (e.x === last.x && e.y === last.y) {
    e.searchT++;
    if (e.searchT === 1) run.say(e, '?');
    if (e.searchT > 3) { e.state = 'wander'; e.target = null; }
    return;
  }
  const dm = distMap(run.map, last.x, last.y);
  if (!stepToward(run, e, dm) && ++e.searchT > 3) { e.state = 'wander'; e.target = null; }
}

function wander(run, e) {
  if (!e.target || (e.x === e.target.x && e.y === e.target.y) || Math.random() < 0.03) e.target = run.randomFloorTile();
  const dm = distMap(run.map, e.target.x, e.target.y);
  if (!stepToward(run, e, dm)) e.target = null;
}

function randomStep(run, e) {
  for (const [dx, dy] of shuffle(DIRS8.slice())) {
    if (canStep(run, e, e.x + dx, e.y + dy)) { moveEnemy(run, e, e.x + dx, e.y + dy); return; }
  }
}

function stepToward(run, e, dm) {
  let best = null, bd = dm[idx(e.x, e.y)];
  for (const [dx, dy] of shuffle(DIRS8.slice())) {
    const nx = e.x + dx, ny = e.y + dy;
    if (!canStep(run, e, nx, ny)) continue;
    if (dm[idx(nx, ny)] < bd) { bd = dm[idx(nx, ny)]; best = [nx, ny]; }
  }
  if (!best) return false;
  moveEnemy(run, e, ...best);
  return true;
}

const canStep = (run, e, x, y) => run.canEnemyEnter(x, y);

function moveEnemy(run, e, x, y) {
  e.face = x < e.x ? -1 : x > e.x ? 1 : e.face;
  e.x = x; e.y = y;
  run.refreshDoors();
  onEnter(run, e, x, y);
}
