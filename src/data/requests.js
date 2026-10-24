// The guild's notice board (조합 의뢰): small goals for a trip to the fields, paid in full the moment you
// meet one (a flat fee: gold relics do not touch it). Since v0.29 the board holds five and you take up to
// three of them with you (ui/board.js), which is where much of a trip's money comes from now that the
// fields pay less; the fee grows with the stage and the 회차 so it stays worth it all the way down.
// Each one is a little past what you usually manage, so it pulls you to try something: dig, fight,
// grab, evolve, or reach the boss. `n(meta, stage)`: how many; `count(type, d, run)`: how much an event adds;
// `can(meta)`: whether it may be pinned up yet (a secret is never given away by a request).
// The first request (it opens after the first trip, data/unlocks.js) asks for one sparkle boulder,
// which teaches that digging is loud.

import { shuffle } from '../core/util.js';
import { isOpen } from './unlocks.js';
import { gs } from './balance.js';
import { loopGold } from './stages.js';

export const MAX_TAKEN = 3;
const OFFERS = 5;

export const REQUESTS = {
  ore:   { text: n => `반짝 바위 ${n}개 깨기`, n: (m, z) => (m.stats.runs > 1 ? 2 + Math.min(1, z) : 1), pay: n => 25 * n, count: (t, d) => t === 'mine' && d.last },
  kill:  { text: n => `말썽쟁이 ${n}마리 쓰러뜨리기`, n: (m, z) => 12 + 3 * Math.min(6, z), pay: n => 4 * n, count: (t, d) => t === 'kill' && !d.enemy.d.npc },
  candy: { text: n => `별사탕 ${n}개 줍기`, n: () => 2, pay: () => 60, count: t => t === 'fission', can: m => isOpen(m, 'candy') },
  evo:   { text: n => (n > 1 ? `유물 ${n}번 진화시키기` : '유물 하나 진화시키기'), n: (m, z) => (z >= 2 ? 2 : 1), pay: n => 60 * n, count: (t, d) => t === 'evolve' && !d.fused },
  chest: { text: n => `보물 상자 ${n}개 열기`, n: (m, z) => 2 + Math.min(1, z), pay: n => 25 * n, count: (t, d) => t === 'pickup' && (d.type === 'chest' || d.type === 'lockedChest') },
  reach: { text: () => '대장 앞까지 가기', n: () => 1, pay: () => 60, count: (t, d, run) => (t === 'floor' && run.floor === run.bossFloor ? 1 : 0) },
  // v0.29: the walls' gems and golden acorns, prised out one by one (core/run.js prySeam)
  seam:  { text: n => `벽에 박힌 보석이나 황금 도토리 ${n}개 캐기`, n: (m, z) => 4 + Math.min(2, Math.floor(z / 3)), pay: n => 12 * n, count: t => t === 'pry' },
  // ...and the hidden rooms, once you know there are such things
  hide:  { text: n => `숨은 방 ${n}개 찾기`, n: (m, z) => (z >= 3 ? 2 : 1), pay: n => 35 * n, count: t => t === 'hideOpen', can: m => !!m.secrets?.nook },
};

// what a request pays on this stage and 회차
const payAt = (pay, stage, loop) => Math.round(pay * (1 + gs(stage)) * loopGold(loop) / 5) * 5;

export function makeRequest(meta, id, stage = 0, loop = 1) {
  const r = REQUESTS[id], n = r.n(meta, stage);
  return { id, n, pay: payAt(r.pay(n), stage, loop), text: r.text(n), got: 0, done: false };
}

// The board for a trip to this stage: five requests (the very first time, only the boulder), kept in
// meta.board until the trip goes so that backing out and looking again does not pin up new ones.
// Three come ticked; `taken` is which.
export function boardFor(meta, stage = 0, loop = 1) {
  const b = meta.board;
  if (b && b.stage === stage && b.loop === loop && b.offers?.every(q => REQUESTS[q.id])) return b;
  const ids = meta.stats.runs <= 1 ? ['ore'] : shuffle(Object.keys(REQUESTS).filter(id => !REQUESTS[id].can || REQUESTS[id].can(meta))).slice(0, OFFERS);
  const offers = ids.map(id => makeRequest(meta, id, stage, loop));
  return (meta.board = { stage, loop, offers, taken: offers.slice(0, MAX_TAKEN).map((q, i) => i) });
}

// what goes out with the trip: the ticked ones, fresh (the board is cleared for the next trip)
export function takeRequests(meta, stage = 0, loop = 1) {
  if (!isOpen(meta, 'request')) return [];
  const b = boardFor(meta, stage, loop), out = b.taken.filter(i => b.offers[i]).slice(0, MAX_TAKEN).map(i => ({ ...b.offers[i], got: 0, done: false }));
  meta.board = null;
  return out;
}
