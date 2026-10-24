// 들판의 별난 것들 (v0.30): the odd critters (data/odd.js), the habits they have when they think nobody is
// looking, and the little things lying about the fields (data/trinkets.js). The first time you come
// across each one it goes in the 비밀 도감 (data/book.js, Run.find) with a chime and a toast. None of it
// on the very first trip out (Run.wonders): that one is plain, so the fields can keep surprising you.
// Run calls in here; the critters' own moves are in ai.js (oddAct).

import * as B from '../data/balance.js';
import { VARIANTS, VARIANT_IDS, ODD_KINDS, HABITS, oddId, habitId } from '../data/odd.js';
import { TRICK_OF, trickId } from '../data/tricks.js';
import { TRINKETS_BY_ZONE, TRINKET, trinketId, DUP_GOLD } from '../data/trinkets.js';
import { ITEMS } from '../data/items.js';
import { has } from '../data/book.js';
import { idx, FLOOR } from './dungeon.js';
import { rint, shuffle, cheb, josa, DIRS8 } from './util.js';

// one of `opts` by weight (`w`)
function weighted(opts) {
  let r = Math.random() * opts.reduce((a, o) => a + o.w, 0);
  for (const o of opts) if ((r -= o.w) < 0) return o;
  return opts[opts.length - 1];
}

// what a critter is called, odd ones by what is odd about them (황금 들쥐)
export const oddName = e => e.odd ? `${VARIANTS[e.odd].prefix}${e.d.name}` : e.d.name;

// ---------- 별난 친구들 ----------
// Now and then (once or twice a field) one of the field's critters is not quite like the rest; what
// you have not seen yet comes first. Never a boss, a crowned one, one of a 낮잠 방 heap, quest folk or
// anything special-placed (a beetle under the water, a mimic).
export function oddOut(run) {
  if (!run.wonders || run.floor === run.bossFloor) return;
  const n = (Math.random() < B.ODD_CHANCE ? 1 : 0) + (Math.random() < B.ODD_MORE ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const can = run.enemies.filter(e => e.hp > 0 && !e.odd && !e.mum && !e.d.boss && !e.d.npc && !e.chief && !e.den && !e.d.quest &&
      ODD_KINDS.includes(e.type) && ['sleep', 'wander'].includes(e.state));
    if (!can.length) return;
    const opts = can.flatMap(e => VARIANT_IDS.map(v => ({ e, v, w: has(run.meta, oddId(e.type, v)) ? 1 : 4 })));
    const { e, v } = weighted(opts);
    makeOdd(run, e, v);
  }
}

export function makeOdd(run, e, v) {
  if (v === 'baby') {
    // a little one beside a grown-up of its kind, doing what it does
    const t = shuffle(DIRS8.slice()).map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy }))
      .find(t => run.map.tiles[idx(t.x, t.y)] === FLOOR && run.canEnemyEnter(t.x, t.y) && !run.pickups.some(q => q.x === t.x && q.y === t.y));
    if (!t) return null;
    const b = run.spawnEnemy(e.type, t.x, t.y, 0.5);
    Object.assign(b, { odd: 'baby', meek: true, tiny: true, mum: e.id, state: e.state, xp: 0 });
    return b;
  }
  e.odd = v;
  if (v === 'flower' || v === 'old') e.meek = true;
  if (v === 'sleepy') Object.assign(e, { state: 'sleep', deep: true });
  return e;
}

// You bump a gentle one: a pat. The first time it has something for you; after that it just shuffles
// aside and you trade places (Run.step).
export function pat(run, e) {
  const p = run.p, name = oddName(e);
  run.emit('pat', { enemy: e, from: { x: p.x, y: p.y } });
  e.gave = true;
  if (e.odd === 'baby') {
    // what it was hugging: a tool, a few coins, now and then one of the field's little things
    const tool = run.pickTool(), r = Math.random();
    const q = r < B.BABY_TRINKET ? { type: 'trinket', id: trinketFor(run) } : tool && r < 0.6 ? { type: tool } : { type: 'gold', amount: Math.round((B.gs(run.stage) + 1) * rint(3, 6)) };
    run.dropNear(e.x, e.y, q);
    run.log(`${josa(name, '을', '를')} 쓰다듬었다. 말랑하다. 품에 안고 있던 걸 두고 쪼르르 달려간다.`, 'good');
  } else if (e.odd === 'flower') {
    // the flower off its head: a sniff of it and you feel better
    e.plain = true;
    const n = Math.max(3, Math.round(run.stat().maxHp * B.FLOWER_HEAL));
    run.heal(n);
    run.emit('flower', { enemy: e, x: p.x, y: p.y });
    run.log(`${josa(name, '이', '가')} 머리에 꽂은 꽃을 건네줬다. 향기를 맡으니 기운이 난다.`, 'good');
  } else if (e.odd === 'old') {
    // an old thing from its coat
    const id = trinketFor(run);
    run.emit('gift', { from: { x: e.x, y: e.y }, to: { x: p.x, y: p.y }, id });
    run.log(`${josa(name, '이', '가')} 품을 한참 뒤적이더니 오래된 걸 꺼내 줬다.`, 'good');
    takeTrinket(run, id, 700);
  }
}

// rest beside a 잠꾸러기 a moment (Run.wait) and it rolls over in its sleep, and what it was hugging
// rolls out
export function rollOver(run, e) {
  e.gave = true;
  run.p.lull = 0;
  run.dropNear(e.x, e.y, { type: 'trinket', id: trinketFor(run) });
  run.emit('lull', { x: e.x, y: e.y, enemy: e });
  run.log(`${josa(oddName(e), '이', '가')} 잠결에 데굴 돌아눕자, 품에 안고 자던 게 굴러 나왔다.`, 'good');
}

// Hit, a gentle one never fights back: it runs off, and once out of sight it is gone for good
export function scare(run, e) {
  if (e.scared) return;
  Object.assign(e, { scared: true, state: 'flee', ran: 0, pants: 0, lost: 0, deep: false });
  run.say(e, '…');
}

// gone down a hole: a gold one you did not catch, a gentle one you frightened off
export function slipAway(run, e) {
  e.hp = 0;
  run.emit('burrow', { enemy: e });
  if (run.isVisible(e.x, e.y) || e.odd === 'gold') run.log(e.odd === 'gold' ? `${josa(oddName(e), '이', '가')} 땅굴로 쏙 숨어 버렸다. 놓쳤다…` : `${josa(oddName(e), '이', '가')} 땅굴로 쏙 숨어 버렸다.`);
}

// knocked down: a gold one bursts into coins; a little one whose grown-up fell runs off
export function oddDown(run, e) {
  for (const o of run.enemies) if (o.mum === e.id && o.hp > 0) { o.mum = null; scare(run, o); }
  if (e.odd !== 'gold') return;
  const total = Math.round(B.oddGold(run.payFloor || run.floor)), spots = [{ x: e.x, y: e.y }, ...shuffle(DIRS8.map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy })))
    .filter(t => run.passable(t.x, t.y) && run.map.tiles[idx(t.x, t.y)] === FLOOR)].slice(0, 5);
  spots.forEach((t, k) => run.pickups.push({ x: t.x, y: t.y, type: 'gold', amount: Math.max(1, Math.round(total / spots.length)) + (k ? 0 : total % spots.length) }));
  run.emit('goldburst', { x: e.x, y: e.y, spots });
  run.log(`${josa(oddName(e), '이', '가')} 쓰러지며 동전을 와르르 쏟았다!`, 'good');
}

// The first time you set eyes on an odd one, and now and then a critter that has not noticed you
// caught at one of its habits (it does nothing else for a turn or two: a blow now is a surprise)
export function lookAbout(run) {
  if (!run.wonders) return;
  for (const e of run.enemies) {
    if (e.hp > 0 && e.odd && run.isVisible(e.x, e.y) && !run.shaded(e)) run.find(oddId(e.type, e.odd), 350);
  }
  if ((run.habitAt || 0) > run.turn || Math.random() > B.HABIT_CHANCE) return;
  const can = run.enemies.filter(e => e.hp > 0 && HABITS[e.type] && e.state === 'wander' && !e.habitT && e.foe == null && !(e.grump > 0) && !(e.fear > 0) &&
    !e.bury && !e.juggle && !e.sweetT && !e.scared && !e.d.boss && run.isVisible(e.x, e.y) && !run.shaded(e) && cheb(e, run.p) >= 2);
  if (!can.length) return;
  const opts = can.flatMap(e => [0, 1].map(k => ({ e, k, w: has(run.meta, habitId(e.type, k)) ? 1 : 5 })));
  const { e, k } = weighted(opts);
  const [name, , anim, fx, mark] = HABITS[e.type][k];
  e.habitT = 2;
  e.habitName = name;
  run.habitAt = run.turn + B.HABIT_GAP;
  run.emit('habit', { enemy: e, anim, fx, mark });
  run.find(habitId(e.type, k), 900);
}

// ---------- 도구 장난 (data/tricks.js) ----------
// A meadow tool got a critter: on top of what the tool does, the critter answers in its own way (a little
// show every time, the line in the log once a trip, its page in the book the first time). A boss caught
// off guard by the right tool loses its next turn to it. The ones that were discoveries of their own
// before (`was`) keep their own show and line.
export function trick(run, tool, e) {
  if (!run.wonders || !e || !run.isVisible(e.x, e.y)) return false;
  const id = trickId(tool, e.type), t = TRICK_OF[id];
  if (!t) return false;
  const [, line, anim, fx, mark, was] = t;
  if (!was) {
    if (e.hp > 0) run.emit('habit', { enemy: e, anim, fx, mark });
    if (!(run.tricked ||= {})[id]) { run.tricked[id] = true; run.log(line, 'good'); }
  }
  if (e.d.boss && e.hp > 0) e.stun = Math.max(e.stun || 0, 1);
  run.find(id, 900);
  return true;
}

// ---------- 주운 것 ----------
// one of the zone's little things, the ones not found yet first
export function trinketFor(run) {
  const list = TRINKETS_BY_ZONE[run.stage] || TRINKETS_BY_ZONE[0];
  return weighted(list.map(([id]) => ({ id, w: has(run.meta, trinketId(id)) ? 1 : 6 }))).id;
}

// it goes in the book (a chime and a toast); one you have already is worth a coin or two at the guild
export function takeTrinket(run, id, delay = 200) {
  const t = TRINKET[id];
  if (!t) return;
  if (run.find(trinketId(id), delay)) run.log(`${josa(t.name, '을', '를')} 주웠다.`, 'good');
  else {
    const g = DUP_GOLD(run.stage);
    run.addGold(g);
    run.log(`${t.name}: 이미 있는 거다. 조합에서 ${g}골드로 바꿔 준다.`);
  }
}

// 반짝 흙: once or twice a field something glints in the dirt; step on it and you dig it up
export function buryTrinkets(run, place) {
  if (!run.wonders || run.floor === run.bossFloor) return;
  const n = (Math.random() < B.GLINT_CHANCE ? 1 : 0) + (Math.random() < B.GLINT_MORE ? 1 : 0);
  for (let k = 0; k < n; k++) place(s => run.pickups.push({ x: s.x, y: s.y, type: 'glint', id: trinketFor(run) }));
}

export function digGlint(run, q) {
  run.emit('dig', { x: q.x, y: q.y });
  run.emit('gift', { from: { x: q.x, y: q.y }, to: { x: q.x, y: q.y }, id: q.id, up: true });
  run.log('반짝이는 흙을 파 보니 뭔가 나왔다!', 'good');
  takeTrinket(run, q.id, 500);
}

// 보물 상자: now and then one of the zone's little things is in with the relics
export function chestTrinket(run, x, y) {
  if (run.wonders && Math.random() < B.CHEST_TRINKET) run.dropNear(x, y, { type: 'trinket', id: trinketFor(run) });
}

// the tip line for an odd one
export function oddTip(e) {
  if (e.scared) return '겁먹고 달아나는 중';
  if (e.odd === 'baby') return e.mum ? '어른 곁을 졸졸 따라다닌다. 싸울 생각이 없다' : '싸울 생각이 없다';
  if (e.odd === 'flower' || e.odd === 'old') return '싸울 생각이 없다';
  if (e.odd === 'sleepy' && e.deep) return '세상모르게 자는 중';
  return null;
}
export const toolName = id => ITEMS[id]?.name || id;
