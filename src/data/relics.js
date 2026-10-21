// Relics are passive items. Each one levels up to MAX_LEVEL.
// `locked: true` relics only appear in the dungeon after they are bought in the shop.
// `evo: true` relics are never offered directly; they come from EVOLUTIONS.

export const MAX_LEVEL = 3;
export const MAX_SLOTS = 6;

export const RELICS = {
  blade:  { name: '칼날',        desc: l => `공격력 +${2 * l}` },
  shield: { name: '방패',        desc: l => `받는 피해 -${l}` },
  fang:   { name: '흡혈 송곳니', desc: l => `적을 쓰러뜨리면 체력 +${2 * l}` },
  ring:   { name: '불꽃 반지',   desc: l => `공격할 때 30% 확률로 불꽃 피해 +${3 * l}` },
  coin:   { name: '행운의 동전', desc: l => `얻는 골드 +${40 * l}%` },
  heart:  { name: '거인의 심장', desc: l => `최대 체력 +${8 * l}` },
  thorns: { name: '가시 갑옷',   desc: l => `맞으면 때린 적에게 ${2 * l} 피해`, locked: true, cost: 150 },
  bolt:   { name: '번개 부적',   desc: l => `6턴마다 가장 가까운 적에게 번개 ${4 * l}`, locked: true, cost: 200 },
  moss:   { name: '재생 이끼',   desc: l => `${[6, 4, 2][l - 1]}턴마다 체력 +1`, locked: true, cost: 120 },

  flamesword: { name: '불꽃의 검', evo: true, desc: () => '공격력 +8, 공격할 때마다 불꽃 피해 +5' },
  fortress:   { name: '가시 요새', evo: true, desc: () => '받는 피해 -5, 맞으면 때린 적에게 8 피해' },
  bloodcrown: { name: '피의 왕관', evo: true, desc: () => '최대 체력 +10, 적을 쓰러뜨리면 체력 +10' },
  goldbolt:   { name: '황금 번개', evo: true, desc: () => '3턴마다 적 3마리에게 번개 10, 쓰러뜨리면 골드 +3' },
};

// When `a` and `b` are both at MAX_LEVEL, `a` turns into `id`. `b` stays.
export const EVOLUTIONS = [
  { id: 'flamesword', a: 'blade',  b: 'ring' },
  { id: 'fortress',   a: 'shield', b: 'thorns' },
  { id: 'bloodcrown', a: 'fang',   b: 'heart' },
  { id: 'goldbolt',   a: 'bolt',   b: 'coin' },
];

export const evolutionOf = id => EVOLUTIONS.find(e => e.a === id || e.b === id);
