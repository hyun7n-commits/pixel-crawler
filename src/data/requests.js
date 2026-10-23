// The guild's request of the day (조합 의뢰): one small goal for each trip to the fields, posted as you
// set out and paid in full the moment you meet it (a flat fee: gold relics do not touch it).
// Each one is a little past what you usually manage, so it pulls you to try something: dig, fight,
// grab, evolve, or reach the boss. `n(meta, stage)`: how many; `count(type, d, run)`: how much an event adds.
// The first request (it opens after the first trip, data/unlocks.js) asks for one sparkle boulder,
// which teaches that digging is loud.

import { pick } from '../core/util.js';
import { isOpen } from './unlocks.js';


export const REQUESTS = {
  ore:   { text: n => `반짝 바위 ${n}개 깨기`, n: (m, z) => (m.stats.runs > 1 ? 2 + Math.min(1, z) : 1), pay: n => 25 * n, count: (t, d) => t === 'mine' && d.last },
  kill:  { text: n => `말썽쟁이 ${n}마리 쓰러뜨리기`, n: (m, z) => 12 + 3 * z, pay: n => 4 * n, count: (t, d) => t === 'kill' && !d.enemy.d.npc },
  candy: { text: n => `별사탕 ${n}개 줍기`, n: () => 2, pay: () => 60, count: t => t === 'fission' },
  evo:   { text: n => (n > 1 ? `유물 ${n}번 진화시키기` : '유물 하나 진화시키기'), n: (m, z) => (z >= 2 ? 2 : 1), pay: n => 60 * n, count: (t, d) => t === 'evolve' && !d.fused },
  chest: { text: n => `보물 상자 ${n}개 열기`, n: (m, z) => 2 + Math.min(1, z), pay: n => 25 * n, count: (t, d) => t === 'pickup' && (d.type === 'chest' || d.type === 'lockedChest') },
  reach: { text: () => '대장 앞까지 가기', n: () => 1, pay: () => 60, count: (t, d, run) => (t === 'floor' && run.floor === run.bossFloor ? 1 : 0) },
};

export function pickRequest(meta, stage = 0) {
  const ids = meta.stats.runs <= 1 ? ['ore'] : Object.keys(REQUESTS).filter(id => id !== 'candy' || isOpen(meta, 'candy'));
  const id = pick(ids), r = REQUESTS[id], n = r.n(meta, stage);
  return { id, n, pay: r.pay(n), text: r.text(n), got: 0, done: false };
}
