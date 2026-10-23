// 스테이지와 회차, the BALL x PIT way. Each trip out is one stage: one zone of the fields (ZONES in
// data/enemies.js), FLOORS_PER_ZONE fields deep, the last one its boss. You pick an open stage in the
// village. Beating a stage's boss at a 회차 opens the next stage at that 회차; beating all ten opens
// the next 회차, where every stage is rowdier and pays more.
//
// 친구 구하기: each stage holds one friend at each of its first two 회차 (FRIENDS[stage][회차 - 1]). On
// one field of the trip they sit in a cage whose key a crowned 우두머리 (a mid-boss) carries; beat it,
// open the cage, and they move to the village. At most one a trip, and only while that friend is still
// locked up, so meeting the second one there means coming back at 2회차 (core/run.js, core/specials.js).
//
// meta.clears[stage]: the highest 회차 that stage has been beaten at (0: never).
// meta.stage / meta.loop: what the stage select has picked.

export const LOOPS = 4;

// the 20 friends: rows are the ten stages (초원, 깊은숲, 반딧불 늪, 바닷가 절벽, 돌산, 거인 꽃밭, 눈 고원,
// 박쥐 동굴, 불꽃 화산, 옛 조합 터), columns 회차 1-2
export const FRIENDS = [
  ['rogue', 'rabbit'],
  ['mage', 'owl'],
  ['knight', 'frog'],
  ['turtle', 'penguin'],
  ['mole', 'goat'],
  ['hamster', 'hedgehog'],
  ['panda', 'fox'],
  ['vamp', 'bear'],
  ['dragon', 'skunk'],
  ['cat', 'chameleon'],
];

// where a friend is found: { stage, loop } (or null for the worker you start as)
export function friendSpot(id) {
  for (let s = 0; s < FRIENDS.length; s++) {
    const l = FRIENDS[s].indexOf(id);
    if (l >= 0) return { stage: s, loop: l + 1 };
  }
  return null;
}

export const cleared = (m, s) => m.clears?.[s] || 0;

// the highest 회차 open: the next one opens once every stage is beaten at the one before
export const loopsOpen = m => Math.min(LOOPS, 1 + Math.min(...FRIENDS.map((_, s) => cleared(m, s))));

// a stage is open at a 회차 once the stage before it is beaten at that 회차 (the first always is)
export const stageOpen = (m, s, loop) => loop <= loopsOpen(m) && (s === 0 || cleared(m, s - 1) >= loop);

// the friend waiting in this stage at this 회차, if they are still locked up
export function caged(m, s, loop) {
  const id = FRIENDS[s]?.[loop - 1];
  return id && !m.chars[id] ? id : null;
}

// how much rowdier each 회차 is: critters' health and attack, and the gold you pick up
export const loopFoe = loop => 1 + 0.35 * (loop - 1);
export const loopGold = loop => 1 + 0.25 * (loop - 1);
