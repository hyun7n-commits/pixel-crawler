// How enemies behave. Each enemy is in one state at a time:
//   sleep  - snoring; wakes up bit by bit while it can see you (e.wake), or at once on a hit or a loud noise
//   wander - awake and strolling around; notices you when you come into view, but sees little behind
//            it (BEHIND_SIGHT), and a glimpse from afar only makes it curious (? and search)
//   hunt   - chasing and attacking you (!)
//   search - heard something, glimpsed you, or lost you: goes to look (?); seeing you again there
//            turns it into a hunt, while slipping out of sight behind a door or a bush loses it
//   flee   - badly hurt and running away (only enemies with `flees`)
//   hide   - a mimic posing as a chest · stone - a statue standing still · npc - quest folk
//            (none of these act; a hit, or reaching for the mimic or the statue's chest, wakes them up)
//   lurk   - a diving beetle under the water, only its bubbles showing; bites whoever comes next to it

import { lineOfSight, distMap, idx, passable } from './dungeon.js';
import { SLEEP_MIN } from '../data/terrain.js';
import { NPC_TEXT } from '../data/npcs.js';
import { MAP_W, BEE_HOME, SCREAM_RANGE } from '../data/balance.js';
import { cheb, shuffle, josa, rint, pick, DIRS8 } from './util.js';
import { onEnter } from './world.js';

export const WAKE_AT = 10;
// Shattered Pixel Dungeon's vault (v4.0) stealth: a wanderer barely sees what is behind its back, and
// one that only glimpses you from farther than CLOSE comes to look (?) before it gives chase (!).
export const BEHIND_SIGHT = 3;
const CLOSE = 2;
// you are behind it: on the far side of the way it last walked
const behind = (e, p) => e.dir && (p.x - e.x) * e.dir.x + (p.y - e.y) * e.dir.y < 0;

export function canSee(run, e, range) {
  const p = run.p, d = cheb(e, p);
  if (d > range) return false;
  // 카멜레온 standing still: only someone right beside it can tell it from the background
  if (p.blend && d > 1) return false;
  return lineOfSight(run.map, e.x, e.y, p.x, p.y);
}

export function enemyAct(run, e, dmP) {
  const d = e.d, p = run.p;
  if (e.state === 'npc') {
    if (!e.greeted && run.isVisible(e.x, e.y) && cheb(e, p) <= 6) { e.greeted = true; run.say(e, NPC_TEXT[e.type].call || NPC_TEXT[e.type].greet); }
    return;
  }
  if (e.state === 'hide' || e.state === 'stone') return;
  // 우파루파: a turn without a hit and its wounds close a little
  if (d.regen && e.hp < e.maxHp && run.turn - (e.hitAt ?? -9) >= 2) {
    e.hp = Math.min(e.maxHp, e.hp + d.regen);
    run.emit('regen', { enemy: e, n: d.regen });
  }
  if (e.state === 'lurk') { lurk(run, e); return; }
  if (e.stun > 0) { e.stun--; return; }
  if (e.stoneT > 0) { e.stoneT--; return; }
  // bees after you turn back once you are far enough from their stump
  const hive = d.swarm && run.map.hive;
  if (hive && !run.calm(e) && cheb(p, hive) > BEE_HOME) { e.angry = false; e.state = 'wander'; e.aim = false; }
  if (run.calm(e)) { if (hive && e.state !== 'sleep') hover(run, e, hive); else calmAct(run, e); return; }
  if (e.state === 'sleep') { sleepTick(run, e); return; }
  if (d.screams) { scream(run, e, dmP); return; }
  if (d.slow) { e.skip = !e.skip; if (e.skip) return; }
  e.timer++;
  if (e.burn > 0 && !d.boss && Math.random() < 0.5) { randomStep(run, e); return; }

  const sees = canSee(run, e, e.state === 'hunt' ? 9 : e.state === 'wander' && behind(e, p) ? BEHIND_SIGHT : 7);
  if (sees) {
    e.last = { x: p.x, y: p.y };
    // a glimpse from afar: it wonders what that was and comes to look
    if (e.state === 'wander' && cheb(e, p) > CLOSE && !run.p.sleep && !d.boss) {
      e.state = 'search';
      e.searchT = 0;
      run.say(e, '?');
      return;
    }
    if (e.state === 'wander' || e.state === 'search') {
      const sure = e.state === 'search';
      e.state = 'hunt';
      run.say(e, '!');
      run.emit('alert', { enemy: e });
      // noticing takes its turn, unless it was already looking for you or you are asleep
      if (!sure && !run.p.sleep) return;
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

// A calm bee buzzes about its stump, never more than a couple of steps away.
function hover(run, e, hive) {
  if (cheb(e, hive) > 2) { stepToward(run, e, distMap(run.map, hive.x, hive.y)); return; }
  if (Math.random() < 0.4) return;
  const steps = DIRS8.map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy })).filter(t => canStep(run, e, t.x, t.y) && cheb(t, hive) <= 2);
  const t = steps[Math.floor(Math.random() * steps.length)];
  if (t) moveEnemy(run, e, t.x, t.y);
}

// The stump was robbed (or a bee was hit): every bee that is awake comes after you. Returns how many.
export function angerSwarm(run) {
  let n = 0;
  for (const b of run.enemies) {
    if (!b.d.swarm || b.hp <= 0 || b.state === 'sleep') continue;
    b.angry = true; b.state = 'hunt'; b.wake = 0; b.doze = 0;
    b.last = { x: run.p.x, y: run.p.y };
    n++;
  }
  if (n) run.emit('swarm', { x: run.map.hive?.x, y: run.map.hive?.y });
  return n;
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
  if (e.state === 'lurk') {
    if (by === 'hit') surface(run, e, false);
    return false;
  }
  if (e.state === 'hide' || e.state === 'stone') {
    if (by === 'hit') awaken(run, e);
    return false;
  }
  if (run.calm(e)) {
    if (by !== 'hit') return false; // noise doesn't bother it
    if (e.d.swarm) angerSwarm(run);
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
  if (d.tongue && tongue(run, e)) return;
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
    if (d.thief && landed && run.gold > 0) steal(run, e, dm);
    // 가재: a pinch that holds on (not every turn: it lets go to snap again)
    if (d.grab && landed && p.hp > 0 && e.timer - (e.grabT ?? -9) >= 3) {
      e.grabT = e.timer;
      p.held = e.id;
      run.emit('grab', { enemy: e, x: p.x, y: p.y });
      run.log(`${josa(d.name, '이', '가')} 집게로 꽉 붙잡았다! 이번 턴엔 못 걸어간다.`, 'warn');
    }
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

// The goblin's grab: a handful of your gold, and it is off at once. The weight soon wears it out (see
// flee), so a few tiles of chasing catch it up; one hit and it drops the gold (run.hurt).
function steal(run, e, dm) {
  const n = Math.min(run.gold, 5 + 3 * run.floor + rint(0, 5));
  run.gold -= n;
  e.loot = n;
  e.state = 'flee';
  e.ran = 0; e.pants = 0;
  run.emit('steal', { enemy: e, n, from: { x: run.p.x, y: run.p.y } });
  if (fleeStep(run, e, dm)) e.ran++;
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
    else {
      e.stun = 2;
      run.emit('stun', { x: e.x, y: e.y });
      // the boar chief hits the rock so hard that stones come down
      if (e.d.boss) run.quake(e);
    }
    e.chargeT = e.timer;
    return true;
  }
  const dx = p.x - e.x, dy = p.y - e.y, dist = cheb(e, p);
  const straight = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
  const rest = e.d.boss && e.hp <= e.maxHp / 2 ? 3 : 4;
  if (!straight || dist < 2 || dist > e.d.charge || e.timer - (e.chargeT ?? -99) < rest) return false;
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

// The frog: lined up with you a few tiles off (straight or on the slant, nothing in between), it aims its
// tongue at your tile; next turn it shoots it, and if you are still on that tile you are reeled in
// right up to it. Stepping off the tile is all it takes to make it miss.
function tongue(run, e) {
  const p = run.p, d = e.d;
  if (e.lick) {
    const at = e.lick;
    e.lick = null; e.aim = false; e.aimAt = null;
    const hit = p.x === at.x && p.y === at.y && lineOfSight(run.map, e.x, e.y, p.x, p.y);
    const sx = Math.sign(p.x - e.x), sy = Math.sign(p.y - e.y);
    // where you land: the first free tile next to it along the line
    const land = { x: e.x + sx, y: e.y + sy };
    run.emit('tongue', { enemy: e, to: { ...at }, hit, land });
    e.lickT = e.timer;
    if (!hit) { if (run.isVisible(e.x, e.y)) run.log(`${d.name}의 혀가 헛쳤다!`, 'good'); return true; }
    if ((land.x !== p.x || land.y !== p.y) && run.passable(land.x, land.y) && !run.enemyAt(land.x, land.y)) {
      run.pullPlayer(land.x, land.y, e);
      run.log(`${d.name}의 혀에 붙잡혀 끌려갔다!`, 'warn');
    }
    return true;
  }
  const dx = p.x - e.x, dy = p.y - e.y, dist = cheb(e, p);
  const straight = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
  if (!straight || dist < 2 || dist > d.tongue || e.timer - (e.lickT ?? -99) < 4) return false;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  for (let k = 1; k < dist; k++) if (!passable(run.map, e.x + sx * k, e.y + sy * k) || run.enemyAt(e.x + sx * k, e.y + sy * k)) return false;
  if (!lineOfSight(run.map, e.x, e.y, p.x, p.y)) return false;
  e.lick = { x: p.x, y: p.y };
  e.aim = true; e.aimAt = { x: p.x, y: p.y };
  run.emit('aimTongue', { enemy: e });
  return true;
}

// 물방개: under the water it does nothing but wait, a few bubbles rising. Come next to it (or step
// in the water beside it) and it bursts up with a bite. Spotted first, it can be hit before it moves.
function lurk(run, e) {
  if (!run.touching(e, run.p) || run.p.hp <= 0) return;
  surface(run, e, true);
}
export function surface(run, e, bite) {
  e.state = 'hunt';
  e.last = { x: run.p.x, y: run.p.y };
  run.emit('surface', { enemy: e });
  run.say(e, '!');
  if (!bite) return;
  run.log(`물속에서 ${josa(e.d.name, '이', '가')} 튀어나와 덥석 물었다!`, 'warn');
  run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: run.p.x, y: run.p.y }, who: e });
  run.damagePlayer(e.atk, e, 'melee');
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

// One step downhill on the safety map: out through a door and away, never into a corner.
function fleeStep(run, e, dm) {
  const safe = safetyMap(dm);
  let best = null, bs = safe[idx(e.x, e.y)];
  for (const [dx, dy] of shuffle(DIRS8.slice())) {
    const nx = e.x + dx, ny = e.y + dy;
    if (!canStep(run, e, nx, ny)) continue;
    if (safe[idx(nx, ny)] < bs) { bs = safe[idx(nx, ny)]; best = [nx, ny]; }
  }
  if (best) moveEnemy(run, e, ...best);
  return !!best;
}

// how far a goblin carrying your gold runs before it has to stop and catch its breath: three tiles
// the first time, then two
const PANT_AFTER = [3, 2];

function flee(run, e, dm, sees) {
  // weighed down by your gold: it gets away once out of sight, but it tires, and while it pants for a
  // turn you catch up
  if (e.loot) {
    if (!sees && dm[idx(e.x, e.y)] >= 6) { run.escape(e); return; }
    if ((e.ran || 0) >= PANT_AFTER[Math.min(e.pants || 0, PANT_AFTER.length - 1)]) {
      e.ran = 0; e.pants = (e.pants || 0) + 1;
      run.emit('pant', { enemy: e });
      return;
    }
  }
  if (fleeStep(run, e, dm)) { if (e.loot) e.ran = (e.ran || 0) + 1; }
  else if (run.touching(e, run.p)) {
    run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: run.p.x, y: run.p.y }, who: e });
    run.damagePlayer(e.atk, e, 'melee');
  }
  if (!sees && dm[idx(e.x, e.y)] >= 8) { e.state = 'wander'; e.target = null; }
}

// A screaming root runs from you yelling every turn, so everyone near comes to see. Caught, it goes
// quiet; asleep (pollen), it hushes; left alone, it digs back into the ground after a while.
function scream(run, e, dm) {
  if (--e.left <= 0) {
    e.hp = 0;
    run.emit('burrow', { enemy: e });
    if (run.isVisible(e.x, e.y)) run.log('비명 뿌리가 땅속으로 쏙 숨었다. 조용해졌다.');
    return;
  }
  const safe = safetyMap(dm);
  let best = null, bs = safe[idx(e.x, e.y)];
  for (const [dx, dy] of shuffle(DIRS8.slice())) {
    const nx = e.x + dx, ny = e.y + dy;
    if (canStep(run, e, nx, ny) && safe[idx(nx, ny)] < bs) { bs = safe[idx(nx, ny)]; best = [nx, ny]; }
  }
  if (best) moveEnemy(run, e, ...best);
  if (e.left % 2 === 0) run.say(e, pick(['꺄아아!', '꺄악!', '으아앙!', '살려줘!']));
  run.emit('scream', { x: e.x, y: e.y });
  run.noise(e.x, e.y, SCREAM_RANGE);
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
  e.dir = { x: Math.sign(x - e.x), y: Math.sign(y - e.y) };
  e.x = x; e.y = y;
  run.refreshDoors();
  onEnter(run, e, x, y);
}
