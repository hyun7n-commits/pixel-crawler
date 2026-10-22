// The guild's request of the day (조합 의뢰): one small goal for each trip to the fields, posted as you
// set out and paid in full the moment you meet it (a flat fee: gold relics do not touch it).
// Each one is a little past what you usually manage, so it pulls you to try something: dig, fight,
// grab, evolve, or go further. `n(meta)`: how many; `count(type, d, run)`: how much an event adds.
// The very first trip always asks for one sparkle boulder, which teaches that digging is loud.

import { pick } from '../core/util.js';

const zone = m => Math.min(2, Math.floor(Math.max(0, m.stats.maxFloor - 1) / 3));

export const REQUESTS = {
  ore:   { text: n => `반짝 바위 ${n}개 깨기`, n: m => (m.stats.runs ? 2 + zone(m) : 1), pay: n => 25 * n, count: (t, d) => t === 'mine' && d.last },
  kill:  { text: n => `말썽쟁이 ${n}마리 토벌`, n: m => 12 + 6 * zone(m), pay: n => 4 * n, count: (t, d) => t === 'kill' && !d.enemy.d.npc },
  candy: { text: n => `별사탕 ${n}개 줍기`, n: () => 2, pay: () => 60, count: t => t === 'fission' },
  evo:   { text: n => (n > 1 ? `유물 ${n}번 진화시키기` : '유물 하나 진화시키기'), n: m => (zone(m) ? 2 : 1), pay: n => 60 * n, count: (t, d) => t === 'evolve' && !d.fused },
  chest: { text: n => `보물 상자 ${n}개 열기`, n: m => 2 + zone(m), pay: n => 25 * n, count: (t, d) => t === 'pickup' && (d.type === 'chest' || d.type === 'lockedChest') },
  reach: { text: n => `${n}구역까지 가기`, n: m => Math.min(9, m.stats.maxFloor + 1), pay: n => 20 * n, count: (t, d, run) => (t === 'floor' ? { set: run.floor } : 0) },
};

export function pickRequest(meta) {
  const ids = !meta.stats.runs ? ['ore'] : Object.keys(REQUESTS).filter(id => id !== 'reach' || (meta.stats.maxFloor >= 2 && meta.stats.maxFloor < 9));
  const id = pick(ids), r = REQUESTS[id], n = r.n(meta);
  return { id, n, pay: r.pay(n), text: r.text(n), got: 0, done: false };
}
