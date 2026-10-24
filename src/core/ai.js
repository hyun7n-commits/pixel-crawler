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
// and on top of any of these, `foe`: hit by another critter, it is busy paying that one back (brawl)

import { lineOfSight, distMap, idx, passable, squeeze, flyable, WALL, FLOOR } from './dungeon.js';
import { SLEEP_MIN, T } from '../data/terrain.js';
import { NPC_TEXT } from '../data/npcs.js';
import { MAP_W, BEE_HOME, SCREAM_RANGE } from '../data/balance.js';
import { cheb, shuffle, josa, rint, pick, DIRS8 } from './util.js';
import { onEnter, ignite } from './world.js';

export const WAKE_AT = 10;
// Shattered Pixel Dungeon's vault (v4.0) stealth: a wanderer barely sees what is behind its back, and
// one that only glimpses you from farther than CLOSE comes to look (?) before it gives chase (!).
export const BEHIND_SIGHT = 3;
const CLOSE = 2;
// you are behind it: on the far side of the way it last walked
const behind = (e, p) => e.dir && (p.x - e.x) * e.dir.x + (p.y - e.y) * e.dir.y < 0;

export function canSee(run, e, range) {
  const p = run.p, d = cheb(e, p);
  // 달그림자: melted into the shadows after a kill, you are not there for anyone
  if (p.vanish > 0 || d > range) return false;
  // 일식: under the darkened sun a critter cannot make out anything farther than two tiles
  if (d > 2 && !e.d.boss && run.lv('eclipse')) return false;
  // 카멜레온 standing still: only someone right beside it can tell it from the background
  if (p.blend && d > 1) return false;
  return lineOfSight(run.map, e.x, e.y, p.x, p.y);
}

export function enemyAct(run, e, dmP) {
  const d = e.d, p = run.p;
  // the stars clear the moment it gets to act again (see the stun below)
  e.dazed = false;
  if (e.state === 'npc') {
    if (!e.greeted && run.isVisible(e.x, e.y) && cheb(e, p) <= 6) { e.greeted = true; run.say(e, NPC_TEXT[e.type].call || NPC_TEXT[e.type].greet); }
    return;
  }
  if (e.state === 'hide' || e.state === 'stone') return;
  // v0.23 critters that are not quite themselves this turn
  if (d.inert) { pileTick(run, e); return; }
  if (e.state === 'dead') { playDeadTick(run, e); return; }
  if (e.shellT > 0) { if (--e.shellT === 0) { e.look = null; run.emit('peek', { enemy: e }); } return; }
  if (d.coal && e.lit > 0 && --e.lit === 0) { run.crumble(e); return; }
  if (d.twist && !e.twisted) { lost(run, e); return; }
  // fliers go over drops, water and lava
  if (d.flies) dmP = run.flyMap();
  // 불나방 never sleeps: it can tell where your light is from far off
  if (d.lantern && e.state !== 'hunt' && cheb(e, p) <= 10 && !e.stun) { e.state = 'hunt'; e.last = { x: p.x, y: p.y }; run.say(e, '!'); }
  // 우파루파: a turn without a hit and its wounds close a little
  if (d.regen && e.hp < e.maxHp && run.turn - (e.hitAt ?? -9) >= 2) {
    e.hp = Math.min(e.maxHp, e.hp + d.regen);
    run.emit('regen', { enemy: e, n: d.regen });
  }
  if (e.state === 'lurk') { lurk(run, e); return; }
  // stunned it loses its turn; on the last one it is left dazed, too dizzy to see your next blow
  // coming (run.unaware: a surprise attack)
  if (e.stun > 0) { e.dazed = --e.stun === 0; return; }
  if (e.stoneT > 0) { e.stoneT--; return; }
  // 매운 고추 (run.chili): it only wants to get away from you, panting like any runner; when the heat
  // wears off it comes back to look for you where it last saw you
  if (e.fear > 0) {
    e.state = 'flee';
    flee(run, e, dmP, canSee(run, e, 9));
    if (--e.fear === 0 && e.hp > 0) Object.assign(e, { state: 'search', searchT: 0, last: { x: p.x, y: p.y } });
    return;
  }
  // 도토리 다람쥐 with a pinecone (run.pinecone): off it goes to bury it, then pats the earth down,
  // minding you not at all
  if (e.bury > 0) {
    // something else came up (a nap, a noise to look into, spores, a scrap): the pinecone can wait
    if (e.state !== 'wander' || e.grump > 0 || e.foe != null) e.bury = 0;
    else {
      if (--e.bury >= 2) wander(run, e);
      else run.emit('bury', { enemy: e, done: e.bury === 0 });
      return;
    }
  }
  // 물범 with a pinecone on its nose (run.pinecone): it stays put, bouncing it and clapping, till the show
  // is over; a nap, a noise to look into, spores or a scrap end it early
  if (e.juggle > 0) {
    if (e.state !== 'wander' || e.grump > 0 || e.foe != null) run.dropJuggle(e);
    else {
      if (e.juggle === 1) run.dropJuggle(e);
      else if (--e.juggle % 2 === 0 && run.isVisible(e.x, e.y)) run.emit('clap', { enemy: e });
      return;
    }
  }
  // bees at the honey from a 꿀 병 (run.splashHoney) hum round it until it is licked clean; a bee made
  // angry again (a blow, the stump robbed) drops it at once
  if (e.sweetT > 0) {
    if (e.angry || e.state === 'sleep') e.sweetT = 0;
    else { e.sweetT--; hover(run, e, e.sweet); return; }
  }
  // bees after you turn back once you are far enough from their stump
  const hive = d.swarm && run.map.hive;
  if (hive && !run.calm(e) && cheb(p, hive) > BEE_HOME) { e.angry = false; e.state = 'wander'; e.aim = false; }
  if (run.calm(e)) { if (hive && e.state !== 'sleep') hover(run, e, hive); else calmAct(run, e); return; }
  if (d.drift && e.state !== 'sleep') { drift(run, e); return; }
  if (e.state === 'sleep') { sleepTick(run, e); return; }
  if (d.screams) { scream(run, e, dmP); return; }
  // slow ones act every other turn; so do an unlit lump of charcoal, and a seal off the ice
  // (an angry boss forgets to be slow)
  const crawl = (d.slow && !e.fury) || (d.coal && !e.lit) || (d.slide && run.map.ter[idx(e.x, e.y)] !== T.ICE && !e.charge);
  if (crawl) { e.skip = !e.skip; if (e.skip) return; }
  e.timer++;
  if (e.burn > 0 && !d.boss && Math.random() < 0.5) { randomStep(run, e); return; }
  if (e.grump > 0 && grumpTick(run, e)) return;
  if (e.foe != null && scrap(run, e)) return;

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
    e.ran = 0; e.pants = 0;
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
  // 밤의 눈: you move so softly that a sleeper does not stir however close you come
  if (canSee(run, e, 7) && !run.lv('nightowl')) e.wake += (8 - cheb(e, run.p)) * (1 - 0.2 * run.lv('dreamlamp')) * (run.char.hush || 1);
  else e.wake = Math.max(0, e.wake - 1);
  if (e.wake >= WAKE_AT) {
    e.state = 'hunt';
    e.wake = 0;
    e.last = { x: run.p.x, y: run.p.y };
    run.say(e, '!');
    run.emit('alert', { enemy: e });
    // 낮잠 방: the first one up squeaks, and the whole heap jumps up with it (unless the pollen holds them)
    if (e.den) for (const o of run.enemies) {
      if (o === e || !o.den || o.hp <= 0 || o.state !== 'sleep' || cheb(o, e) > 4 || run.map.gas.sleep[idx(o.x, o.y)] >= SLEEP_MIN) continue;
      Object.assign(o, { state: 'hunt', wake: 0, doze: 0, last: { x: run.p.x, y: run.p.y } });
      run.say(o, '!');
      run.emit('alert', { enemy: o });
    }
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
  if (d.boss) run.enrage(e);
  if (run.bossSpecial(e)) return;
  if (e.backoff > 0) { e.backoff--; retreat(run, e, dm, d.hops ? 3 : d.fast ? 2 : 1); return; }
  if (d.mirror) { mirror(run, e); return; }
  if (d.burrow && burrow(run, e, dm)) return;
  if (d.reach && reach(run, e)) return;
  if (d.ball && rollBall(run, e)) return;
  if (d.dive && dive(run, e)) return;
  // a seal on the ice shoots along it on its belly, like a charge
  const lane = d.charge || (d.slide && (e.charge || run.map.ter[idx(e.x, e.y)] === T.ICE) ? d.slide : 0);
  if (lane && charge(run, e, lane)) return;
  if (d.tongue && tongue(run, e)) return;
  if (d.blink && blink(run, e)) return;
  const dist = cheb(e, p);
  if (d.ranged) {
    if (e.aim) {
      e.aim = false;
      const at = e.aimAt || { x: p.x, y: p.y }, stillThere = at.x === p.x && at.y === p.y;
      // one that has stepped into the line, or onto the tile you left, takes it instead (다툼)
      const o = inTheWay(run, e, at);
      const hit = !o && stillThere && dist <= d.ranged && lineOfSight(run.map, e.x, e.y, p.x, p.y);
      run.emit('shot', { from: { x: e.x, y: e.y }, to: o ? { x: o.x, y: o.y } : at, hit: hit || !!o, kind: d.knock ? 'snow' : null });
      if (o) strayHit(run, e, o, e.atk, '맞혔다');
      else if (hit && run.damagePlayer(e.atk, e, 'ranged') && d.knock && p.hp > 0) run.shovePlayer(e);
      else if (!hit) run.log(`${d.name}의 공격을 피했다.`, 'good');
      return;
    }
    if (dist > 1 && dist <= d.ranged && lineOfSight(run.map, e.x, e.y, p.x, p.y) && !inTheWay(run, e, p) && Math.random() < 0.7) {
      e.aim = true;
      e.aimAt = { x: p.x, y: p.y };
      return;
    }
  }
  // 사마귀 and 눈사람 stand their ground
  if (d.still && !run.touching(e, p)) { if (p.x !== e.x) e.face = Math.sign(p.x - e.x); return; }
  if (run.touching(e, p)) {
    run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: p.x, y: p.y }, who: e });
    const landed = run.damagePlayer(e.lit ? Math.round(e.atk * 1.5) : e.atk, e, 'melee');
    // 딱따구리: peck-peck, two in a turn
    if (d.drill && p.hp > 0) { run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: p.x, y: p.y }, who: e }); run.damagePlayer(e.atk, e, 'melee'); }
    // 나비: every flap scatters sleepy dust; fight beside it too long and you nod off
    if (d.pollen && p.hp > 0) dust(run, e);
    if (d.thief && landed && run.gold > 0) steal(run, e, dm);
    // 가재: a pinch that holds on (not every turn: it lets go to snap again)
    if (d.grab && landed && p.hp > 0 && e.timer - (e.grabT ?? -9) >= 3) {
      e.grabT = e.timer;
      p.held = e.id;
      run.emit('grab', { enemy: e, x: p.x, y: p.y });
      run.log(`${josa(d.name, '이', '가')} 집게로 꽉 붙잡았다! 이번 턴엔 못 걸어간다.`, 'warn');
    }
    if (d.hitAndRun) e.backoff = 2;
    if (d.hops) e.backoff = 1;
    if (d.stoneSkin && e.hp > 0) { e.stoneT = 1; run.emit('stone', { enemy: e }); }
    return;
  }
  // 메뚜기 hops two tiles; burning charcoal rolls quick
  const moves = d.fast || d.hops || e.lit ? 2 : 1;
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
function charge(run, e, range = e.d.charge) {
  const p = run.p;
  if (e.charge) {
    const lane = e.charge;
    e.charge = null;
    let at = { x: e.x, y: e.y }, hit = false, rammed = null;
    for (const t of lane) {
      if (t.x === p.x && t.y === p.y) { hit = true; break; }
      // you stepped aside and someone else was standing further down the lane: it gets the horns (다툼)
      const o = run.enemyAt(t.x, t.y);
      if (o && o !== e && !o.d.npc && !['hide', 'stone', 'lurk'].includes(o.state)) { rammed = o; break; }
      if (!run.canEnemyEnter(t.x, t.y)) break;
      at = t;
    }
    const from = { x: e.x, y: e.y };
    if (at.x !== e.x || at.y !== e.y) moveEnemy(run, e, at.x, at.y);
    run.emit('charge', { enemy: e, from, to: at, hit: hit || !!rammed });
    if (hit) run.damagePlayer(e.atk * 2, e, 'charge');
    else if (rammed) strayHit(run, e, rammed, e.atk * 2, '들이받았다');
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
  if (!straight || dist < 2 || dist > range || e.timer - (e.chargeT ?? -99) < rest) return false;
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
    // you got off the tile, but someone else is on it now: it is the one reeled in, and it is cross
    const o = !hit && lineOfSight(run.map, e.x, e.y, at.x, at.y) && run.enemyAt(at.x, at.y);
    run.emit('tongue', { enemy: e, to: { ...at }, hit: hit || !!o, land });
    e.lickT = e.timer;
    if (o && canBrawl(run, o) && canBrawl(run, e)) {
      const sx2 = Math.sign(o.x - e.x), sy2 = Math.sign(o.y - e.y), spot = { x: e.x + sx2, y: e.y + sy2 };
      if ((spot.x !== o.x || spot.y !== o.y) && run.canEnemyEnter(spot.x, spot.y)) { o.x = spot.x; o.y = spot.y; run.refreshDoors(); run.emit('push', { enemy: o, from: { ...at }, to: spot }); }
      if (run.isVisible(o.x, o.y)) run.log(`${d.name}의 혀에 ${josa(o.d.name, '이', '가')} 붙잡혀 끌려갔다!`, 'good');
      if (brawl(run, o, e) && run.isVisible(o.x, o.y)) run.discover('brawl');
      return true;
    }
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

// how far anything running from you gets before it has to stop and catch its breath, every time: three
// tiles, then a turn of panting, then three more
const PANT_AFTER = 3;

function flee(run, e, dm, sees) {
  // a goblin weighed down by your gold gets away once out of sight
  if (e.loot && !sees && dm[idx(e.x, e.y)] >= 6) { run.escape(e); return; }
  // it runs at your pace, so it tires, and while it pants for a turn you catch up
  if ((e.ran || 0) >= PANT_AFTER) {
    e.ran = 0; e.pants = (e.pants || 0) + 1;
    run.emit('pant', { enemy: e });
    return;
  }
  if (fleeStep(run, e, dm)) e.ran = (e.ran || 0) + 1;
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
  // 딱따구리 drums on a tree now and then, and whatever sleeps near it wakes
  if (e.d.drill && Math.random() < 0.12 && DIRS8.some(([dx, dy]) => run.map.tiles[idx(e.x + dx, e.y + dy)] === WALL) && cheb(e, run.p) <= 12) {
    run.say(e, '따다닥!');
    run.emit('drill', { enemy: e });
    run.noise(e.x, e.y, 5);
    return;
  }
  if (!e.target || (e.x === e.target.x && e.y === e.target.y) || Math.random() < 0.03) e.target = run.randomFloorTile();
  const dm = distMap(run.map, e.target.x, e.target.y);
  if (!stepToward(run, e, dm)) e.target = null;
}

function randomStep(run, e) {
  for (const [dx, dy] of shuffle(DIRS8.slice())) {
    if (canStep(run, e, e.x + dx, e.y + dy)) { moveEnemy(run, e, e.x + dx, e.y + dy); return; }
  }
}

// 화난 대장 (v0.29, Run.enrage): a step more every other turn, toward you; never while it is winding
// something up (a slam, a charge, an aimed shot, a dive, a breath), so what is painted lands where shown,
// and never one that crawls (it has stopped crawling instead)
export function furyStep(run, e, dm) {
  if (e.hp <= 0 || e.stun > 0 || e.state !== 'hunt' || e.d.slow || run.touching(e, run.p)) return;
  if (e.slam || e.charge || e.lane || e.aim || e.dive || e.diving || e.breath || e.lick) return;
  stepToward(run, e, e.d.flies ? run.flyMap() : dm);
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

// fliers cross drops and pools; fireproof critters wade into lava
const canStep = (run, e, x, y) => {
  if (squeeze(run.map, e.x, e.y, x - e.x, y - e.y)) return false;
  if (run.canEnemyEnter(x, y)) return true;
  if (!flyable(run.map, x, y) || run.enemyAt(x, y) || (x === run.p.x && y === run.p.y)) return false;
  const ter = run.map.ter[idx(x, y)];
  return !!e.d.flies || (!!e.d.fireproof && ter === T.LAVA);
};

function moveEnemy(run, e, x, y) {
  const from = { x: e.x, y: e.y }, d = e.d;
  e.face = x < e.x ? -1 : x > e.x ? 1 : e.face;
  e.dir = { x: Math.sign(x - e.x), y: Math.sign(y - e.y) };
  e.x = x; e.y = y;
  // what it leaves behind: slime, honey, a line of fire
  if (d.slimy) run.goo(from.x, from.y, T.SLIME);
  if (e.type === 'queen' && Math.random() < 0.5) run.goo(from.x, from.y, T.HONEY);
  if (d.fireTrail) ignite(run, from.x, from.y, true);
  run.refreshDoors();
  onEnter(run, e, x, y);
  // on ice (or a snail's slime) a walker slides on the same way
  const ter = run.map.ter[idx(e.x, e.y)];
  if ((ter === T.ICE || (ter === T.SLIME && !d.slimy)) && !d.flies && !d.slide && e.hp > 0) {
    for (let k = 0; k < 12; k++) {
      const nx = e.x + e.dir.x, ny = e.y + e.dir.y;
      if (!run.canEnemyEnter(nx, ny) || squeeze(run.map, e.x, e.y, e.dir.x, e.dir.y)) break;
      e.x = nx; e.y = ny;
      onEnter(run, e, nx, ny);
      if (ter === T.SLIME || run.map.ter[idx(nx, ny)] !== T.ICE) break;
    }
    run.refreshDoors();
  }
}

// ---------- v0.23 critters ----------

// 갑옷 조각: the pieces of an empty suit of armour rattle back together a few turns after it falls
function pileTick(run, e) {
  if (--e.reformT > 0) { if (run.isVisible(e.x, e.y)) run.say(e, '덜그럭…'); return; }
  const a = run.spawnEnemy('armor', e.x, e.y);
  e.hp = 0;
  Object.assign(a, { hp: Math.ceil(a.maxHp * 0.6), maxHp: a.maxHp, atk: e.armorAtk || a.atk, reformed: true, state: 'hunt', last: { x: run.p.x, y: run.p.y } });
  a.x = e.x; a.y = e.y;
  run.emit('reform', { enemy: a });
  if (run.isVisible(a.x, a.y)) run.log('갑옷 조각이 덜그럭덜그럭 다시 맞춰졌다!', 'warn');
}

// 무당벌레 lying on its back: if you walk off it gets up and comes after you
function playDeadTick(run, e) {
  if (--e.fakeT > 0) return;
  e.state = 'hunt';
  e.last = { x: run.p.x, y: run.p.y };
  run.emit('rise', { enemy: e });
  run.say(e, '벌떡!');
  if (run.isVisible(e.x, e.y)) run.log(`죽은 척하던 ${josa(e.d.name, '이', '가')} 벌떡 일어났다!`, 'warn');
}

// 길 잃은 꼬마: sobbing, it toddles after you at a little distance. Come right up to it, or hit it,
// and it lifts its head.
function lost(run, e) {
  const p = run.p, dist = cheb(e, p);
  if (dist <= 1 && run.isVisible(e.x, e.y)) { twist(run, e); return; }
  if (e.state === 'sleep') { if (canSee(run, e, 5)) e.state = 'wander'; else return; }
  if (Math.random() < 0.25 && run.isVisible(e.x, e.y)) run.say(e, pick(['훌쩍…', '흐윽…', '엄마…', '여기 어디야…']));
  if (dist > 2 && dist <= 9 && canSee(run, e, 9) && Math.random() < 0.7) stepToward(run, e, distMap(run.map, p.x, p.y));
  else if (dist > 9 && Math.random() < 0.3) randomStep(run, e);
}
export function twist(run, e) {
  if (e.twisted) return;
  e.twisted = true;
  e.look = 'lostkidTwist';
  e.state = 'hunt';
  e.last = { x: run.p.x, y: run.p.y };
  run.emit('twist', { enemy: e });
  run.say(e, '찾았다.');
  run.log('…꼬마가 고개를 들었다. 입이 귀까지 찢어져 있다!', 'warn');
}

// 해파리: drifts on the wind, never after you. Touch it on its turn and it stings you stiff for a turn.
function drift(run, e) {
  const p = run.p;
  if (run.touching(e, p) && !p.stun && p.hp > 0) {
    run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: p.x, y: p.y }, who: e });
    if (run.damagePlayer(e.atk, e, 'melee') && p.hp > 0) sting(run, e);
    return;
  }
  e.skip = !e.skip;
  if (e.skip) return;
  if (!e.wind || Math.random() < 0.15) e.wind = pick(DIRS8);
  const [dx, dy] = e.wind;
  if (canStep(run, e, e.x + dx, e.y + dy)) moveEnemy(run, e, e.x + dx, e.y + dy);
  else e.wind = null;
}
export function sting(run, e) {
  run.p.stun = Math.max(run.p.stun || 0, 1);
  run.emit('sting', { x: run.p.x, y: run.p.y });
  run.log('찌릿! 몸이 굳어서 한 턴 동안 못 움직인다.', 'warn');
}

// 나비: sleepy dust every flap; three turns side by side and you doze off for a turn
function dust(run, e) {
  const p = run.p;
  p.drowsy = (p.drowsy || 0) + 1;
  run.emit('pollen', { x: p.x, y: p.y });
  if (p.drowsy < e.d.pollen) return;
  p.drowsy = 0;
  if (run.lv('mint') >= 3 || run.lv('dreamlamp') || run.lv('pillow')) return;
  p.sleep = Math.max(p.sleep || 0, 1);
  run.say('player', '꾸벅…');
  run.log('졸음 가루를 너무 마셔서 꾸벅 졸았다!', 'warn');
}

// 사마귀: lined up within reach (straight or on the slant, nothing between), its blade shoots out
const lined = (a, b) => a.x === b.x || a.y === b.y || Math.abs(a.x - b.x) === Math.abs(a.y - b.y);
export function inReach(run, e) {
  const p = run.p, dist = cheb(e, p);
  return e.d.reach && dist >= 2 && dist <= e.d.reach && lined(e, p) && lineOfSight(run.map, e.x, e.y, p.x, p.y) &&
    !run.enemyAt(e.x + Math.sign(p.x - e.x), e.y + Math.sign(p.y - e.y));
}
function reach(run, e) {
  if (!inReach(run, e)) return false;
  const p = run.p;
  run.emit('lunge', { enemy: e, to: { x: p.x, y: p.y } });
  run.damagePlayer(e.atk, e, 'melee');
  return true;
}

// 쇠똥구리: lined up with you, it paints the lane, then sends its ball rolling down it next turn. The
// ball hits the first one in its way, you or a critter, and stops there.
function rollBall(run, e) {
  const p = run.p;
  if (e.lane) {
    const lane = e.lane;
    e.lane = null;
    e.ballT = e.timer;
    let end = null, hit = null;
    for (const t of lane) {
      if (!passable(run.map, t.x, t.y)) break;
      end = t;
      if (t.x === p.x && t.y === p.y) { hit = 'player'; break; }
      const o = run.enemyAt(t.x, t.y);
      if (o && o !== e) { hit = o; break; }
    }
    run.emit('ball', { enemy: e, from: { x: e.x, y: e.y }, to: end || { x: e.x, y: e.y } });
    const dmg = Math.round(e.atk * 1.5);
    if (hit === 'player') { run.damagePlayer(dmg, e, 'ranged'); run.log('쇠똥 공에 데굴데굴 치였다!', 'warn'); }
    else if (hit) {
      if (run.isVisible(hit.x, hit.y)) run.log(`쇠똥 공이 ${josa(hit.d.name, '을', '를')} 쳤다!`, 'good');
      run.hurt(hit, dmg * 2, 'bonk', e);
      if (hit.foe === e.id && run.isVisible(hit.x, hit.y)) run.discover('brawl');
    }
    else if (run.isVisible(e.x, e.y)) run.log('쇠똥 공이 헛굴렀다.', 'good');
    return true;
  }
  const dx = p.x - e.x, dy = p.y - e.y, dist = cheb(e, p);
  if (!lined(e, p) || dist < 2 || dist > e.d.ball || e.timer - (e.ballT ?? -99) < 3) return false;
  const sx = Math.sign(dx), sy = Math.sign(dy), lane = [];
  for (let k = 1; k <= e.d.ball; k++) {
    const x = e.x + sx * k, y = e.y + sy * k;
    if (!passable(run.map, x, y)) break;
    lane.push({ x, y });
  }
  if (lane.length < dist) return false;
  e.lane = lane;
  run.emit('aimCharge', { enemy: e });
  return true;
}

// 갈매기: marks your tile with its shadow, then swoops down on it next turn
function dive(run, e) {
  const p = run.p;
  if (e.swoop) {
    const at = e.swoop;
    e.swoop = null; e.aim = false; e.aimAt = null;
    e.diveT = e.timer;
    const hit = p.x === at.x && p.y === at.y;
    // you got off the shadow, but someone else is under it now (다툼)
    const o = !hit && run.enemyAt(at.x, at.y);
    const victim = o && o !== e && !o.d.npc && !['hide', 'stone', 'lurk'].includes(o.state) ? o : null;
    // it lands beside the spot (or on it, if nobody is there)
    const land = hit || victim ? DIRS8.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })).filter(t => canStep(run, e, t.x, t.y))
      .sort((a, b) => cheb(a, e) - cheb(b, e))[0] : canStep(run, e, at.x, at.y) ? at : null;
    const from = { x: e.x, y: e.y };
    if (land) { e.x = land.x; e.y = land.y; run.refreshDoors(); }
    run.emit('swoop', { enemy: e, from, to: { x: e.x, y: e.y }, at, hit: hit || !!victim });
    if (hit) run.damagePlayer(Math.round(e.atk * 1.5), e, 'charge');
    else if (victim) strayHit(run, e, victim, Math.round(e.atk * 1.5), '덮쳤다');
    else if (run.isVisible(e.x, e.y)) run.log(`${josa(e.d.name, '이', '가')} 헛내리꽂았다!`, 'good');
    return true;
  }
  const dist = cheb(e, p);
  if (dist < 2 || dist > e.d.dive || e.timer - (e.diveT ?? -99) < 3 || !lineOfSight(run.map, e.x, e.y, p.x, p.y)) return false;
  e.swoop = { x: p.x, y: p.y };
  e.aim = true; e.aimAt = { x: p.x, y: p.y };
  run.say(e, '끼룩!');
  return true;
}

// 눈토끼: under the snow it is only a moving lump, quick; right beside you it bursts out
function burrow(run, e, dm) {
  const p = run.p, dist = cheb(e, p);
  if (!e.dug && dist >= 4 && e.timer - (e.upT ?? -99) >= 4) {
    e.dug = true;
    e.look = 'snowmound';
    run.emit('mound', { enemy: e });
    return true;
  }
  if (!e.dug) return false;
  if (run.touching(e, p)) {
    e.dug = false; e.look = null; e.upT = e.timer;
    run.emit('pop', { enemy: e });
    run.say(e, '퐁!');
    return true;
  }
  for (let i = 0; i < 2; i++) {
    if (!stepToward(run, e, dm) || run.touching(e, p)) break;
  }
  return true;
}

// 가면 일꾼: does exactly what you just did. You stepped, it steps the same way; you stood still, so
// does it. Beside you, a step of yours is its chance to hit.
function mirror(run, e) {
  const p = run.p, m = run.lastMove;
  if (!m) { if (run.touching(e, p) && run.struck?.has(e.id)) attackPlayer(run, e); return; }
  if (run.touching(e, p)) { attackPlayer(run, e); return; }
  const x = e.x + m.dx, y = e.y + m.dy;
  if (canStep(run, e, x, y)) moveEnemy(run, e, x, y);
  else run.emit('bump', { enemy: e, dx: m.dx, dy: m.dy });
}
function attackPlayer(run, e) {
  const p = run.p;
  run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: p.x, y: p.y }, who: e });
  run.damagePlayer(e.atk, e, 'melee');
}

// ---------- 다툼 (v0.26) ----------
// A critter hit by another one (a charge or a shot you stepped out of the way of, a gull diving on the
// wrong tile, a dung ball, a frog's tongue, or one knocked into it) forgets you and goes for the one that
// hit it, the way monsters fall out with each other in Doom; hit back, that one turns round too. They
// scrap until one falls (it counts as yours, as any kill does in Shattered Pixel Dungeon), until a few
// turns go by, or until you hit one of them: that one has you to deal with again. One busy scrapping
// does not see you coming (run.unaware).
export const BRAWL_TURNS = 10;
const SHUT = ['hide', 'stone', 'lurk', 'dead', 'npc'];
export function canBrawl(run, e) {
  const d = e?.d;
  return !!d && e.hp > 0 && !d.boss && !d.npc && !d.inert && !d.screams && !d.swarm && !d.drift && !d.mirror && !d.twist &&
    !SHUT.includes(e.state) && !run.calm(e);
}
// `a` was hit by `b`: it turns on `b`. False if either is not the brawling kind.
export function brawl(run, a, b) {
  if (!b || a === b || !canBrawl(run, a) || !canBrawl(run, b)) return false;
  // one already in a scrap just turns to the newcomer (no new shout, it is the same scrap)
  const fresh = a.foe == null || !run.enemies.some(o => o.id === a.foe && o.hp > 0);
  Object.assign(a, { foe: b.id, foeT: BRAWL_TURNS, state: 'hunt', wake: 0, doze: 0, aim: false, aimAt: null, charge: null, lick: null, swoop: null, lane: null, backoff: 0 });
  if (!fresh) return true;
  run.brawls = (run.brawls || 0) + 1;
  run.emit('brawl', { enemy: a, foe: b });
  if (run.isVisible(a.x, a.y)) {
    // critters only ever speak in marks (design: no words from enemies)
    run.say(a, pick(['!', '!!', '!?']));
    run.log(`화가 난 ${josa(a.d.name, '이', '가')} ${b.d.name}에게 덤벼든다!`, 'good');
  }
  return true;
}
// 심술이 나다: the toadstool's spores (world.js), or a blow from 심술 방망이 (run.js). Whatever it was
// about to do (an aim, a charge, a tongue) is forgotten. False if it is not the brawling kind.
export function vex(run, e, turns, why = 'spores') {
  if (!canBrawl(run, e)) return false;
  e.grumpWhy = why;
  if (!(e.grump > 0)) {
    Object.assign(e, { state: 'hunt', wake: 0, doze: 0, aim: false, aimAt: null, charge: null, lick: null, swoop: null, lane: null });
    run.emit('grump', { enemy: e });
    if (run.isVisible(e.x, e.y)) run.say(e, pick(['으르릉…', '흥!', '!']));
  }
  e.grump = Math.max(e.grump || 0, turns);
  return true;
}
// 심술 (v0.26): with the toadstool's spores up its nose it is cross with the whole world. It bites
// whoever is beside it, another critter first (and that one bites back: a brawl), or you if there is
// nobody else; with nobody beside it, it stomps off towards the nearest critter it can see. With no
// one about at all it just goes on as usual. False when it did nothing of the sort this turn.
function grumpTick(run, e) {
  e.grump--;
  const p = run.p, other = o => o !== e && o.hp > 0 && !o.d.npc && !['hide', 'lurk', 'stone'].includes(o.state);
  const near = run.enemies.filter(o => other(o) && run.touching(e, o));
  if (near.length) {
    const o = pick(near);
    if (o.x !== e.x) e.face = Math.sign(o.x - e.x);
    run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: o.x, y: o.y }, who: e });
    run.hurt(o, Math.max(1, e.atk - (o.def || 0)), 'brawl', e);
    if (e.grumpWhy === 'spores' && run.isVisible(o.x, o.y)) run.discover('grump_brawl');
    return true;
  }
  if (run.touching(e, p) && p.hp > 0) { attackPlayer(run, e); return true; }
  const t = run.enemies.filter(o => other(o) && cheb(o, e) <= 5 && lineOfSight(run.map, e.x, e.y, o.x, o.y)).sort((a, b) => cheb(a, e) - cheb(b, e))[0];
  if (!t) return false;
  if (t.x !== e.x) e.face = Math.sign(t.x - e.x);
  const dm = distMap(run.map, t.x, t.y);
  for (let i = e.d.fast || e.d.hops ? 2 : 1; i > 0; i--) if (!stepToward(run, e, dm) || run.touching(e, t)) break;
  return true;
}

// a blow meant for you lands on `o` instead
function strayHit(run, e, o, dmg, verb) {
  if (run.isVisible(o.x, o.y)) run.log(`${josa(e.d.name, '이', '가')} 대신 ${josa(o.d.name, '을', '를')} ${verb}!`, 'good');
  run.hurt(o, Math.max(1, dmg - (o.def || 0)), 'stray', e);
  if (o.foe === e.id && run.isVisible(o.x, o.y)) run.discover('brawl');
}
// the first critter on the straight line from `e` to `to` (the tile itself included)
function inTheWay(run, e, to) {
  let dx = Math.abs(to.x - e.x), dy = -Math.abs(to.y - e.y), err = dx + dy, x = e.x, y = e.y;
  const sx = e.x < to.x ? 1 : -1, sy = e.y < to.y ? 1 : -1;
  while (!(x === to.x && y === to.y)) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    const o = run.enemyAt(x, y);
    if (o && o !== e && !o.d.npc && !['hide', 'lurk'].includes(o.state)) return o;
  }
  return null;
}
// a turn of the scrap: go for the foe, or bite it. False when the scrap is over (it gets on with its day).
function scrap(run, e) {
  const o = run.enemies.find(x => x.id === e.foe);
  if (!o || o.hp <= 0 || --e.foeT < 0 || !canBrawl(run, o) || !canBrawl(run, e)) {
    // the fight is over: it looks round from where it stands
    Object.assign(e, { foe: null, foeT: 0, state: 'search', searchT: 0, last: { x: e.x, y: e.y } });
    return false;
  }
  if (o.x !== e.x) e.face = Math.sign(o.x - e.x);
  if (run.touching(e, o)) {
    for (let k = e.d.drill ? 2 : 1; k > 0 && o.hp > 0; k--) {
      run.emit('attack', { from: { x: e.x, y: e.y }, to: { x: o.x, y: o.y }, who: e });
      run.hurt(o, Math.max(1, (e.lit ? Math.round(e.atk * 1.5) : e.atk) - (o.def || 0)), 'brawl', e);
    }
    return true;
  }
  if (e.d.still) return true;
  const dm = distMap(run.map, o.x, o.y);
  for (let i = e.d.fast || e.d.hops || e.lit ? 2 : 1; i > 0; i--) if (!stepToward(run, e, dm) || run.touching(e, o)) break;
  return true;
}
