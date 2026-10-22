// Relics are passive items, and like the balls in BALL x PIT they grow, evolve and fuse.
//   tier 0  basic relics, offered on level-ups and in chests. Each one levels up to MAX_LEVEL.
//   tier 1  evolved: two basic relics both at MAX_LEVEL that make a recipe turn into one of these, at Lv1.
//   tier 2  legends: two evolved relics that make a recipe (any level). A legend keeps both of them at
//           full strength inside it (`has`), plus a power of its own.
//   tier 3  myths: two legends. Same again, one level only.
// Recipes are secret: nothing in a run tells you what goes with what. Making one for the first time
// is a discovery; it goes in the book in town, and from then on the game shows it to you.
// Several recipes can lead to the same relic.
// Any two relics at MAX_LEVEL that are not a recipe can still be fused (see fusedId): one slot, both
// effects, but nothing grows out of it any more.
// `locked: true` relics only appear in the dungeon after they are bought in the shop.

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
  boots:  { name: '살금 신발',   desc: l => `나를 못 본 적을 치면 피해 ×${1.5 + 0.25 * l} (기본 ×1.5)` },
  lantern: { name: '반딧불이 병',  desc: l => `시야 +${l}칸` },
  hammer: { name: '진동 망치',   desc: l => `공격할 때 ${15 * l}% 확률로 적이 한 턴 기절` },
  pick:   { name: '금 곡괭이',   desc: l => `반짝 바위에서 나오는 골드 +${50 * l}%, 더 좋은 반짝돌이 나올 확률 +${5 * l}%` },
  cloak:  { name: '깃털 망토',   desc: l => `적의 공격을 ${8 * l}% 확률로 피한다` },
  mint:   { name: '박하사탕',    desc: l => (l < 3 ? `졸음 꽃가루를 ${l + 1}배 더 잘 버틴다` : '졸음 꽃가루에 잠들지 않는다') },
  sweep:  { name: '휘두름 장갑', desc: l => `공격하면 옆의 다른 적에게도 ${30 * l}% 피해`, locked: true, cost: 180 },
  bombbag: { name: '폭탄 가방',  desc: l => `처음 가는 구역에 들어갈 때마다 폭탄 +1${l > 1 ? `, 폭탄 피해 +${25 * (l - 1)}%` : ''}`, locked: true, cost: 140 },
  magnet: { name: '반짝 자석',   desc: l => `${l + 1}칸 안의 골드를 저절로 줍는다`, locked: true, cost: 100 },
  bandage: { name: '비상 붕대',  desc: l => `체력이 1/3 아래로 떨어지면 구역마다 한 번 체력 +${6 * l}`, locked: true, cost: 90 },

  // evolved
  flamesword: { name: '불꽃의 검',   tier: 1, desc: l => `공격력 +${4 + 2 * l}, 때릴 때마다 불꽃 피해 +${2 + l}` },
  fortress:   { name: '가시 요새',   tier: 1, desc: l => `받는 피해 -${2 + l}, 맞으면 때린 적에게 ${4 + 2 * l} 피해` },
  bloodcrown: { name: '피의 왕관',   tier: 1, desc: l => `최대 체력 +${15 + 5 * l}, 적을 쓰러뜨리면 체력 +${4 + 2 * l}` },
  goldbolt:   { name: '황금 번개',   tier: 1, desc: l => `3턴마다 적 ${l + 1}마리에게 번개 ${6 + 2 * l}, 얻는 골드 +${75 + 25 * l}%` },
  shadow:     { name: '그림자 걸음', tier: 1, desc: l => `나를 못 본 적을 치면 피해 ×${2.25 + 0.25 * l}, 적의 공격을 ${15 + 5 * l}% 확률로 피한다` },
  quake:      { name: '지진 망치',   tier: 1, desc: l => `공격하면 옆의 모든 적에게 같은 피해, ${15 + 5 * l}% 확률로 기절` },
  goldrush:   { name: '골드 러시',   tier: 1, desc: l => `반짝 바위 골드 ×${1.5 + 0.5 * l}, 더 좋은 반짝돌 확률 +${10 + 5 * l}%, ${1 + l}칸 안의 골드를 저절로 줍는다` },
  dreamlamp:  { name: '꿈꾸는 등불', tier: 1, desc: l => `시야 +${1 + l}칸, 자는 적이 ${20 * l}% 더 늦게 깬다, 졸음 꽃가루에 잠들지 않는다` },
  firebomb:   { name: '불꽃 폭탄',   tier: 1, desc: l => `처음 가는 구역마다 폭탄 +${l < 3 ? 1 : 2}, 폭탄 피해 +${25 + 25 * l}%, 터진 자리의 적에게 불이 붙는다` },
  herbal:     { name: '약초 주머니', tier: 1, desc: l => `${[3, 2, 2][l - 1]}턴마다 체력 +1, 체력이 1/3 아래로 떨어지면 구역마다 두 번 체력 +${6 + 4 * l}` },
  bloodblade: { name: '피의 검',     tier: 1, desc: l => `공격력 +${3 + l}, 때릴 때마다 체력 +${l < 3 ? 1 : 2}` },
  ironheart:  { name: '강철 심장',   tier: 1, desc: l => `최대 체력 +${10 + 5 * l}, 받는 피해 -${l}` },
  owleye:     { name: '부엉이 눈',   tier: 1, desc: l => `시야 +${1 + l}칸, 나를 못 본 적을 치면 피해 ×${2 + 0.25 * l}` },
  luckycharm: { name: '네잎 클로버', tier: 1, desc: l => `얻는 골드 +${100 + 25 * l}%, 적의 공격을 ${20 + 5 * l}% 확률로 피한다` },
  thunder:    { name: '천둥 망치',   tier: 1, desc: l => `4턴마다 적 ${l + 1}마리에게 번개 ${6 + 2 * l}, 공격할 때 ${30 + 5 * l}% 확률로 적이 한 턴 기절` },
  whirl:      { name: '회오리 검',   tier: 1, desc: l => `공격력 +${4 + l}, 공격하면 옆의 다른 적에게도 ${60 + 10 * l}% 피해` },
  pillow:     { name: '꿀잠 베개',   tier: 1, desc: l => `최대 체력 +${16 + 4 * l}, ${[4, 3, 2][l - 1]}턴마다 체력 +1, 졸음 꽃가루에 잠들지 않는다` },
  spikecloak: { name: '고슴도치 망토', tier: 1, desc: l => `적의 공격을 ${20 + 5 * l}% 확률로 피한다, 맞거나 피하면 때린 적에게 ${4 + 2 * l} 피해` },
  goldfang:   { name: '황금 이빨',   tier: 1, desc: l => `적을 쓰러뜨리면 체력 +${5 + l}, 쓰러뜨린 적이 꼭 골드를 떨군다, 얻는 골드 +${80 + 20 * l}%` },
  headlamp:   { name: '반딧불 모자',    tier: 1, desc: l => `시야 +${1 + l}칸, 반짝 바위 골드 ×${1.5 + 0.5 * l}, 더 좋은 반짝돌 확률 +${10 + 5 * l}%` },
  embermail:  { name: '불씨 갑옷',   tier: 1, desc: l => `받는 피해 -${1 + l}, 나를 때린 적에게 불꽃 ${3 + l} 피해, 불이 붙는다` },
  dagger:     { name: '암살 단검',   tier: 1, desc: l => `공격력 +${2 + l}, 나를 못 본 적을 치면 피해 ×${2.5 + 0.25 * l}` },
  sunlamp:    { name: '태양 랜턴',   tier: 1, desc: l => `시야 +${1 + l}칸, 3턴마다 보이는 적 ${l < 3 ? 1 : 2}마리에게 햇빛 ${4 + 2 * l}` },
  giantfist:  { name: '거인의 주먹', tier: 1, desc: l => `최대 체력 +${12 + 4 * l}, 공격력 +${l}, 공격할 때 ${25 + 5 * l}% 확률로 적이 한 턴 기절` },

  // legends: both ingredients stay inside at full strength
  volcano:   { name: '화산 망치',   tier: 2, has: ['flamesword', 'quake'], desc: l => `불꽃의 검과 지진 망치의 힘, 공격력 +${2 * l}` },
  undying:   { name: '불사의 심장', tier: 2, has: ['fortress', 'bloodcrown'], desc: l => `가시 요새와 피의 왕관의 힘, 받는 피해 -${l}, 쓰러지면 한 번 되살아난다` },
  goldstorm: { name: '황금 폭풍',   tier: 2, has: ['goldbolt', 'goldrush'], desc: l => `황금 번개와 골드 러시의 힘, 번개가 2턴마다 치고, 얻는 골드 +${25 * l}%` },
  phantom:   { name: '달그림자',    tier: 2, has: ['shadow', 'dreamlamp'], desc: l => `그림자 걸음과 꿈꾸는 등불의 힘, 기습 피해 ×+${0.5 * l}, 피하기 +${5 * l}%` },
  meteor:    { name: '운석 폭탄',   tier: 2, has: ['firebomb', 'quake'], desc: l => `불꽃 폭탄과 지진 망치의 힘, ${10 - 2 * l}턴마다 보이는 적에게 운석 ${10 + 5 * l}` },
  lifetree:  { name: '생명의 나무', tier: 2, has: ['herbal', 'bloodcrown'], desc: l => `약초 주머니와 피의 왕관의 힘, ${l < 2 ? 2 : 1}턴마다 체력 +1, 최대 체력 +${10 * l}` },
  bloodmoon: { name: '붉은 달',     tier: 2, has: ['bloodblade', 'bloodcrown'], desc: l => `피의 검과 피의 왕관의 힘, 공격력 +${2 * l}` },
  stormlord: { name: '폭풍 망치',   tier: 2, has: ['thunder', 'quake'], desc: l => `천둥 망치와 지진 망치의 힘, 번개가 2턴마다 치고, 공격력 +${l}` },
  guardian:  { name: '수호 거북',   tier: 2, has: ['ironheart', 'fortress'], desc: l => `강철 심장과 가시 요새의 힘, 받는 피해 -${l}, 최대 체력 +${10 * l}` },
  fortune:   { name: '행운의 여신', tier: 2, has: ['luckycharm', 'goldfang'], desc: l => `네잎 클로버와 황금 이빨의 힘, 얻는 골드 +${25 * l}%, 피하기 +${5 * l}%` },
  nightowl:  { name: '밤의 눈',     tier: 2, has: ['owleye', 'dreamlamp'], desc: l => `부엉이 눈과 꿈꾸는 등불의 힘, 시야 +${l}칸, 기습 피해 ×+${0.5 * l}` },
  whirlwind: { name: '칼바람',      tier: 2, has: ['whirl', 'flamesword'], desc: l => `회오리 검과 불꽃의 검의 힘, 옆의 적에게도 같은 피해, 공격력 +${l}` },

  // myths
  minecrown: { name: '반짝돌 왕관', tier: 3, has: ['goldstorm', 'volcano'], desc: () => '황금 폭풍과 화산 망치의 힘, 공격력 +5, 얻는 골드 +50%, 더 좋은 반짝돌 확률 +15%' },
  eternity:  { name: '영원의 심장',   tier: 3, has: ['undying', 'lifetree'], desc: () => '불사의 심장과 생명의 나무의 힘, 최대 체력 +30, 두 번 되살아난다' },
  eclipse:   { name: '일식',          tier: 3, has: ['phantom', 'meteor'], desc: () => '달그림자와 운석 폭탄의 힘, 운석이 3턴마다 떨어지고, 기습 피해 ×+2' },
  godhammer: { name: '신의 망치',     tier: 3, has: ['stormlord', 'whirlwind'], desc: () => '폭풍 망치와 칼바람의 힘, 공격력 +5, 번개가 매 턴 친다' },
  bloodking: { name: '피의 군주',     tier: 3, has: ['bloodmoon', 'guardian'], desc: () => '붉은 달과 수호 거북의 힘, 최대 체력 +20, 쓰러지면 한 번 되살아난다' },
  dawnstar:  { name: '새벽별',        tier: 3, has: ['nightowl', 'fortune'], desc: () => '밤의 눈과 행운의 여신의 힘, 얻는 골드 +50%, 피하기 +10%, 기습 피해 ×+1' },
};

export const tierOf = id => (isFused(id) ? 0 : RELICS[id].tier || 0);
export const maxLevelOf = id => (isFused(id) || tierOf(id) === 3 ? 1 : MAX_LEVEL);

// Two relics in, one out. `a` and `b` must be owned at the same time; basic ones at MAX_LEVEL.
export const RECIPES = [
  { id: 'flamesword', a: 'blade',  b: 'ring' },
  { id: 'flamesword', a: 'blade',  b: 'bombbag' },
  { id: 'fortress',   a: 'shield', b: 'thorns' },
  { id: 'bloodcrown', a: 'fang',   b: 'heart' },
  { id: 'goldbolt',   a: 'bolt',   b: 'coin' },
  { id: 'shadow',     a: 'boots',  b: 'cloak' },
  { id: 'quake',      a: 'hammer', b: 'sweep' },
  { id: 'quake',      a: 'hammer', b: 'shield' },
  { id: 'goldrush',   a: 'pick',   b: 'magnet' },
  { id: 'goldrush',   a: 'pick',   b: 'coin' },
  { id: 'dreamlamp',  a: 'lantern', b: 'mint' },
  { id: 'firebomb',   a: 'bombbag', b: 'ring' },
  { id: 'herbal',     a: 'moss',   b: 'bandage' },
  { id: 'herbal',     a: 'moss',   b: 'heart' },

  // v0.15: like BALL x PIT, every basic relic goes into four or more recipes, and several lead to the same place
  { id: 'fortress',   a: 'heart',  b: 'thorns' },
  { id: 'bloodcrown', a: 'fang',   b: 'bandage' },
  { id: 'goldbolt',   a: 'bolt',   b: 'magnet' },
  { id: 'shadow',     a: 'boots',  b: 'mint' },
  { id: 'quake',      a: 'hammer', b: 'bombbag' },
  { id: 'goldrush',   a: 'coin',   b: 'magnet' },
  { id: 'firebomb',   a: 'bombbag', b: 'pick' },
  { id: 'herbal',     a: 'bandage', b: 'heart' },
  { id: 'bloodblade', a: 'blade',  b: 'fang' },
  { id: 'bloodblade', a: 'sweep',  b: 'fang' },
  { id: 'ironheart',  a: 'shield', b: 'heart' },
  { id: 'ironheart',  a: 'shield', b: 'bandage' },
  { id: 'ironheart',  a: 'shield', b: 'moss' },
  { id: 'owleye',     a: 'lantern', b: 'boots' },
  { id: 'owleye',     a: 'lantern', b: 'cloak' },
  { id: 'luckycharm', a: 'coin',   b: 'cloak' },
  { id: 'luckycharm', a: 'coin',   b: 'mint' },
  { id: 'thunder',    a: 'bolt',   b: 'ring' },
  { id: 'thunder',    a: 'hammer', b: 'bolt' },
  { id: 'whirl',      a: 'blade',  b: 'sweep' },
  { id: 'whirl',      a: 'blade',  b: 'hammer' },
  { id: 'whirl',      a: 'boots',  b: 'sweep' },
  { id: 'pillow',     a: 'mint',   b: 'heart' },
  { id: 'pillow',     a: 'mint',   b: 'moss' },
  { id: 'spikecloak', a: 'cloak',  b: 'thorns' },
  { id: 'goldfang',   a: 'fang',   b: 'coin' },
  { id: 'goldfang',   a: 'fang',   b: 'magnet' },
  { id: 'headlamp',   a: 'lantern', b: 'pick' },
  { id: 'headlamp',   a: 'lantern', b: 'magnet' },
  { id: 'embermail',  a: 'ring',   b: 'thorns' },
  { id: 'embermail',  a: 'shield', b: 'ring' },
  { id: 'dagger',     a: 'blade',  b: 'boots' },
  { id: 'dagger',     a: 'blade',  b: 'cloak' },
  { id: 'sunlamp',    a: 'lantern', b: 'ring' },
  { id: 'sunlamp',    a: 'lantern', b: 'bolt' },
  { id: 'giantfist',  a: 'heart',  b: 'hammer' },
  { id: 'giantfist',  a: 'hammer', b: 'thorns' },

  { id: 'volcano',   a: 'flamesword', b: 'quake' },
  { id: 'undying',   a: 'fortress',   b: 'bloodcrown' },
  { id: 'goldstorm', a: 'goldbolt',   b: 'goldrush' },
  { id: 'phantom',   a: 'shadow',     b: 'dreamlamp' },
  { id: 'meteor',    a: 'firebomb',   b: 'quake' },
  { id: 'meteor',    a: 'firebomb',   b: 'goldbolt' },
  { id: 'lifetree',  a: 'herbal',     b: 'bloodcrown' },
  { id: 'lifetree',  a: 'herbal',     b: 'fortress' },

  { id: 'volcano',   a: 'embermail',  b: 'quake' },
  { id: 'volcano',   a: 'sunlamp',    b: 'flamesword' },
  { id: 'undying',   a: 'ironheart',  b: 'bloodcrown' },
  { id: 'undying',   a: 'giantfist',  b: 'bloodcrown' },
  { id: 'goldstorm', a: 'luckycharm', b: 'goldrush' },
  { id: 'goldstorm', a: 'goldfang',   b: 'goldbolt' },
  { id: 'goldstorm', a: 'headlamp',   b: 'goldrush' },
  { id: 'phantom',   a: 'owleye',     b: 'shadow' },
  { id: 'phantom',   a: 'dagger',     b: 'dreamlamp' },
  { id: 'phantom',   a: 'spikecloak', b: 'shadow' },
  { id: 'meteor',    a: 'thunder',    b: 'firebomb' },
  { id: 'meteor',    a: 'sunlamp',    b: 'firebomb' },
  { id: 'lifetree',  a: 'pillow',     b: 'herbal' },
  { id: 'lifetree',  a: 'pillow',     b: 'bloodcrown' },
  { id: 'bloodmoon', a: 'bloodblade', b: 'bloodcrown' },
  { id: 'bloodmoon', a: 'bloodblade', b: 'goldfang' },
  { id: 'bloodmoon', a: 'bloodblade', b: 'dagger' },
  { id: 'stormlord', a: 'thunder',    b: 'quake' },
  { id: 'stormlord', a: 'thunder',    b: 'whirl' },
  { id: 'stormlord', a: 'thunder',    b: 'giantfist' },
  { id: 'guardian',  a: 'ironheart',  b: 'fortress' },
  { id: 'guardian',  a: 'spikecloak', b: 'fortress' },
  { id: 'guardian',  a: 'embermail',  b: 'ironheart' },
  { id: 'guardian',  a: 'giantfist',  b: 'ironheart' },
  { id: 'fortune',   a: 'luckycharm', b: 'goldfang' },
  { id: 'fortune',   a: 'luckycharm', b: 'headlamp' },
  { id: 'fortune',   a: 'luckycharm', b: 'spikecloak' },
  { id: 'nightowl',  a: 'owleye',     b: 'dreamlamp' },
  { id: 'nightowl',  a: 'owleye',     b: 'headlamp' },
  { id: 'nightowl',  a: 'pillow',     b: 'dreamlamp' },
  { id: 'nightowl',  a: 'sunlamp',    b: 'owleye' },
  { id: 'whirlwind', a: 'whirl',      b: 'flamesword' },
  { id: 'whirlwind', a: 'whirl',      b: 'shadow' },
  { id: 'whirlwind', a: 'dagger',     b: 'whirl' },
  { id: 'whirlwind', a: 'dagger',     b: 'flamesword' },

  { id: 'minecrown', a: 'goldstorm', b: 'volcano' },
  { id: 'eternity',  a: 'undying',   b: 'lifetree' },
  { id: 'eclipse',   a: 'phantom',   b: 'meteor' },

  { id: 'minecrown', a: 'fortune',   b: 'volcano' },
  { id: 'eternity',  a: 'guardian',  b: 'lifetree' },
  { id: 'eclipse',   a: 'nightowl',  b: 'meteor' },
  { id: 'godhammer', a: 'stormlord', b: 'whirlwind' },
  { id: 'godhammer', a: 'stormlord', b: 'volcano' },
  { id: 'bloodking', a: 'bloodmoon', b: 'guardian' },
  { id: 'bloodking', a: 'bloodmoon', b: 'undying' },
  { id: 'dawnstar',  a: 'nightowl',  b: 'fortune' },
  { id: 'dawnstar',  a: 'fortune',   b: 'phantom' },
];
export const recipeKey = rc => `${rc.id}:${rc.a}+${rc.b}`;
export const recipesWith = id => RECIPES.filter(rc => rc.a === id || rc.b === id);

// What a first discovery is worth, by the tier of what it makes.
export const DISCOVERY_GOLD = [0, 30, 100, 300];

// A fused relic is named after its two halves: 'fuse:a+b'.
export const fusedId = (a, b) => `fuse:${a}+${b}`;
export const isFused = id => id.startsWith('fuse:');
export const fusedParts = id => id.slice(5).split('+');
export const relicName = id => (isFused(id) ? fusedParts(id).map(p => RELICS[p].name).join(' + ') : RELICS[id].name);
