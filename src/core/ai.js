// How enemies behave. Each enemy is in one state at a time:
//   sleep  - snoring; wakes up bit by bit while it can see you (e.wake), or at once on a hit or a loud noise
//   wander - awake and strolling around; notices you when you come into view
//   hunt   - chasing and attacking you
//   search - lost you, goes to where it last saw you and looks around
//   flee   - badly hurt and running away (only enemies with `flees`)

import { lineOfSight, distMap, idx, diagBlocked } from './dungeon.js';
import { SLEEP_MIN } from '../data/terrain.js';
import { cheb, shuffle, DIRS8 } from './util.js';
import { onEnter } from './world.js';

export const WAKE_AT = 10;

export function canSee(run, e, range) {
  const p = run.p, d = cheb(e, p);
  if (d > range) return false;
  if (d > 1 && run.playerHidden()) return false;
  return lineOfSight(run.map, e.x, e.y, p.x, p.y);
}

export function enemyAct(run, e, dmP) {
  const d = e.d, p = run.p;
  if (e.stun > 0) { e.stun--; return; }
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
      return; // noticing takes its turn
    }
  }
  if (e.state === 'hunt' && d.flees && e.hp <= e.maxHp * 0.3) {
    e.state = 'flee';
  }
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
  if (canSee(run, e, 7)) e.wake += 8 - cheb(e, run.p);
  else e.wake = Math.max(0, e.wake - 1);
  if (e.wake >= WAKE_AT) {
    e.state = 'hunt';
    e.wake = 0;
    e.last = { x: run.p.x, y: run.p.y };
    run.say(e, '!');
    run.emit('alert', { enemy: e });
  }
}

// Woken by a hit (`by` = 'hit') or a noise at (x, y)
export function rouse(run, e, by, x, y) {
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
    run.damagePlayer(e.atk, e, 'melee');
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

function flee(run, e, dm, sees) {
  let best = null, bd = dm[idx(e.x, e.y)];
  for (const [dx, dy] of shuffle(DIRS8.slice())) {
    const nx = e.x + dx, ny = e.y + dy;
    if (!canStep(run, e, nx, ny)) continue;
    if (dm[idx(nx, ny)] > bd && dm[idx(nx, ny)] < 9999) { bd = dm[idx(nx, ny)]; best = [nx, ny]; }
  }
  if (best) { moveEnemy(run, e, ...best); }
  else if (run.touching(e, run.p)) {
    run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: run.p.x, y: run.p.y }, who: e });
    run.damagePlayer(e.atk, e, 'melee');
  }
  if (!sees && dm[idx(e.x, e.y)] >= 8) { e.state = 'wander'; e.target = null; }
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
  if (Math.random() < 0.02) { e.state = 'sleep'; e.wake = 0; }
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

const canStep = (run, e, x, y) => run.canEnemyEnter(x, y) && !diagBlocked(run.map, e.x, e.y, x, y);

function moveEnemy(run, e, x, y) {
  e.face = x < e.x ? -1 : x > e.x ? 1 : e.face;
  e.x = x; e.y = y;
  onEnter(run, e, x, y);
}
