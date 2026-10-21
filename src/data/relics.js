// Relics are passive items. Each one levels up to MAX_LEVEL.
// `locked: true` relics only appear in the dungeon after they are bought in the shop.
// `evo: true` relics are never offered directly; they come from EVOLUTIONS or LEGENDS.
// `legend: true` relics come from two evolved relics; their recipes stay hidden until found.

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
  boots:  { name: '살금 신발',   desc: l => `기습 피해 ×${2 + 0.5 * l} (기본 ×2)` },
  lantern: { name: '광부 랜턴',  desc: l => `시야 +${l}칸` },
  hammer: { name: '진동 망치',   desc: l => `공격할 때 ${15 * l}% 확률로 적이 한 턴 기절` },
  pick:   { name: '금 곡괭이',   desc: l => `큰 광석에서 나오는 골드 +${50 * l}%` },
  cloak:  { name: '깃털 망토',   desc: l => `적의 공격을 ${8 * l}% 확률로 피한다` },
  mint:   { name: '박하사탕',    desc: l => (l < 3 ? `졸음 가스를 ${l + 1}배 더 잘 버틴다` : '졸음 가스에 잠들지 않는다') },
  sweep:  { name: '휘두름 장갑', desc: l => `공격하면 옆의 다른 적에게도 ${30 * l}% 피해`, locked: true, cost: 180 },
  bombbag: { name: '폭탄 가방',  desc: l => `처음 가는 층에 들어갈 때마다 폭탄 +1${l > 1 ? `, 폭탄 피해 +${25 * (l - 1)}%` : ''}`, locked: true, cost: 140 },
  magnet: { name: '반짝 자석',   desc: l => `${l + 1}칸 안의 골드를 저절로 줍는다`, locked: true, cost: 100 },
  bandage: { name: '비상 붕대',  desc: l => `체력이 1/3 아래로 떨어지면 층마다 한 번 체력 +${6 * l}`, locked: true, cost: 90 },

  flamesword: { name: '불꽃의 검', evo: true, desc: () => '공격력 +8, 공격할 때마다 불꽃 피해 +5' },
  fortress:   { name: '가시 요새', evo: true, desc: () => '받는 피해 -5, 맞으면 때린 적에게 8 피해' },
  bloodcrown: { name: '피의 왕관', evo: true, desc: () => '최대 체력 +30, 적을 쓰러뜨리면 체력 +10' },
  goldbolt:   { name: '황금 번개', evo: true, desc: () => '3턴마다 적 3마리에게 번개 10, 얻는 골드 +150%' },
  shadow:     { name: '그림자 걸음', evo: true, desc: () => '기습 피해 ×4, 적의 공격을 30% 확률로 피한다' },
  quake:      { name: '지진 망치', evo: true, desc: () => '공격하면 옆의 모든 적에게 같은 피해, 맞은 적은 30% 확률로 기절' },
  goldrush:   { name: '골드 러시', evo: true, desc: () => '큰 광석에서 나오는 골드 ×3, 4칸 안의 골드를 저절로 줍는다' },

  volcano:  { name: '화산 망치', evo: true, legend: true, desc: () => '공격력 +10, 공격하면 옆의 모든 적에게 같은 피해와 불꽃, 30% 확률로 기절' },
  undying:  { name: '불사의 심장', evo: true, legend: true, desc: () => '받는 피해 -6, 최대 체력 +40, 맞으면 때린 적에게 10 피해, 쓰러지면 한 번 되살아난다' },
  goldstorm: { name: '황금 폭풍', evo: true, legend: true, desc: () => '2턴마다 적 4마리에게 번개 12, 얻는 골드 +200%, 큰 광석 골드 ×3, 5칸 안의 골드를 저절로 줍는다' },
};

// When `a` and `b` are both at MAX_LEVEL, both are used up and become `id`, freeing a slot.
// An evolved relic must beat its two ingredients together, since both are gone.
export const EVOLUTIONS = [
  { id: 'flamesword', a: 'blade',  b: 'ring' },
  { id: 'fortress',   a: 'shield', b: 'thorns' },
  { id: 'bloodcrown', a: 'fang',   b: 'heart' },
  { id: 'goldbolt',   a: 'bolt',   b: 'coin' },
  { id: 'shadow',     a: 'boots',  b: 'cloak' },
  { id: 'quake',      a: 'hammer', b: 'sweep' },
  { id: 'goldrush',   a: 'pick',   b: 'magnet' },
];

// Two evolved relics become one legendary relic. The recipe is hidden ("???") until made once;
// village gossip hints at it.
export const LEGENDS = [
  { id: 'volcano',   a: 'flamesword', b: 'quake',      hint: '불꽃 검을 든 채로 땅을 흔들면 화산이 깨어난대.' },
  { id: 'undying',   a: 'fortress',   b: 'bloodcrown', hint: '가시로 둘러싼 피의 왕은 죽지 않는다는 전설이 있어.' },
  { id: 'goldstorm', a: 'goldbolt',   b: 'goldrush',   hint: '금빛 번개가 금광을 휩쓸면 황금 폭풍이 분대.' },
];

export const evolutionOf = id => EVOLUTIONS.find(e => e.a === id || e.b === id);
export const legendOf = id => LEGENDS.find(e => e.a === id || e.b === id);
