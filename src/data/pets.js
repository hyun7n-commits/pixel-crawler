// 펫: a little companion bought at the shop that tags along behind you, in the fields and round the
// village. Critters pay it no mind and it never gets hurt; each one helps in one small way. One goes out
// at a time (meta.pet), chosen among the ones you have (meta.pets).
// v0.30: fifteen of them, coming into the shop one by one as its shelves fill (data/shop.js), and each
// grows from Lv1 to Lv5 (meta.petXp): a little for every new field it goes out on with you, more when
// the trip beats its boss, and a treat from the shop helps too. A pet a level up does its thing better:
// each value below is a list, one for each level (petPower picks the level's).
//   peck: every n steps you walk (not rests) it pecks up a little gold at your feet, `pecks` times a field
//   sight: wider view · greed: more gold · drizzle: every n turns a drop of rain heals you
//   feel: hidden traps this close show themselves · glint: the chance it sniffs out a glint in the dirt on
//   a field (core/wonders.js) · honey: once a field, when you are down to a third, it brings you honey
//   (health) · xp: more experience · swim: dodging in water · coins: gold that comes out of every chest
//   with it (and two more each field down) · fetch: the chance it brings you a meadow tool on a field ·
//   soft: once every n turns, a blow lands half as hard · scout: on a new field it shows you the way
//   out (1), the chests too (2), and the keys (3) · glow: the hidden room's wall glimmers once you are this
//   close · zap: the chance a critter that hits you gets a shock and loses its next turn
//   fly: it flies (scenes/DungeonScene.js followPet)

export const PET_LV = 5;
// the experience each level starts at
export const PET_XP = [0, 6, 16, 32, 56];
// what a trip gives the pet that came: one for each new field, and some more for a stage beaten
export const PET_XP_FIELD = 1, PET_XP_WIN = 3;

export const PETS = {
  chick:     { name: '삐약이', kind: '병아리',     sprite: 'pet_chick',     cost: 600,  peck: [30, 30, 28, 26, 24], pecks: [3, 4, 5, 6, 8] },
  butterfly: { name: '팔랑이', kind: '나비',       sprite: 'pet_butterfly', cost: 1200, sight: [1, 1, 2, 2, 3], fly: true },
  ladybug:   { name: '점박이', kind: '무당벌레',   sprite: 'pet_ladybug',   cost: 2000, greed: [0.1, 0.13, 0.16, 0.2, 0.25] },
  mouse:     { name: '찍찍이', kind: '생쥐',       sprite: 'pet_mouse',     cost: 1500, glint: [0.5, 0.6, 0.7, 0.85, 1] },
  bookworm:  { name: '꼬물이', kind: '책벌레',     sprite: 'pet_bookworm',  cost: 1800, xp: [0.1, 0.13, 0.16, 0.2, 0.25] },
  duckling:  { name: '꽥꽥이', kind: '아기 오리',  sprite: 'pet_duckling',  cost: 2200, swim: [0.15, 0.2, 0.25, 0.3, 0.35] },
  bee:       { name: '붕붕이', kind: '꿀벌',       sprite: 'pet_bee',       cost: 2400, honey: [4, 5, 6, 8, 10], fly: true },
  piglet:    { name: '꿀꿀이', kind: '아기 돼지',  sprite: 'pet_piglet',    cost: 2800, coins: [8, 11, 14, 18, 24] },
  sparrow:   { name: '짹짹이', kind: '참새',       sprite: 'pet_sparrow',   cost: 3000, scout: [1, 1, 2, 2, 3] },
  cloud:     { name: '뭉게',   kind: '아기 구름',  sprite: 'pet_cloud',     cost: 3200, drizzle: [12, 11, 10, 9, 8], fly: true },
  firefly:   { name: '깜빡이', kind: '반딧불이',   sprite: 'pet_firefly',   cost: 3400, glow: [3, 4, 5, 7, 99], fly: true },
  squirrel:  { name: '다람이', kind: '다람쥐',     sprite: 'pet_squirrel',  cost: 3600, fetch: [0.35, 0.5, 0.65, 0.8, 1] },
  slime:     { name: '말랑이', kind: '말랑 젤리',  sprite: 'pet_slime',     cost: 4000, soft: [14, 12, 10, 9, 8] },
  snail:     { name: '느릿이', kind: '달팽이',     sprite: 'pet_snail',     cost: 4500, feel: [2, 2, 3, 3, 4] },
  jelly:     { name: '둥실이', kind: '아기 해파리', sprite: 'pet_jelly',    cost: 5000, zap: [0.2, 0.25, 0.3, 0.35, 0.45], fly: true },
};

const pct = v => `${Math.round(v * 100)}%`;
// what a pet does at a level, in a line
const NOTE = {
  chick: v => `${v.peck}걸음마다 발밑을 콕콕 쪼아 골드를 조금 찾아낸다. 들판마다 ${v.pecks}번까지`,
  butterfly: v => `앞을 팔랑팔랑 날아다녀서 시야 +${v.sight}`,
  ladybug: v => `행운의 점박이: 얻는 골드 +${pct(v.greed)}`,
  mouse: v => `들판마다 ${v.glint >= 1 ? '꼭' : `${pct(v.glint)} 확률로`} 흙 속 반짝이는 곳을 하나 킁킁 찾아낸다`,
  bookworm: v => `옆에서 같이 배운다: 얻는 경험치 +${pct(v.xp)}`,
  duckling: v => `물속에 있으면 꽥꽥 소란을 피워 공격을 피하기 쉬워진다 (회피 +${pct(v.swim)})`,
  bee: v => `체력이 1/3 아래로 떨어지면 들판마다 한 번 꿀을 물어 온다 (체력 +${v.honey})`,
  piglet: v => `보물 상자를 열면 코를 박고 골드를 찾아낸다 (+${v.coins}G, 깊이 갈수록 더)`,
  sparrow: v => `새 들판에 들어서면 날아올라 ${['', '깃발 땅굴 자리', '깃발 땅굴과 보물 상자 자리', '깃발 땅굴, 보물 상자, 열쇠 자리'][v.scout]}를 알려 준다`,
  cloud: v => `${v.drizzle}턴마다 보슬비를 뿌려 체력 +1`,
  firefly: v => (v.glow >= 99 ? '들판의 숨은 방이 어디 있든 그 벽을 반짝 비춰 준다' : `숨은 방 벽에 ${v.glow}칸 안으로 다가가면 반짝 비춰 준다`),
  squirrel: v => `들판마다 ${v.fetch >= 1 ? '꼭' : `${pct(v.fetch)} 확률로`} 어디선가 들판 도구를 하나 물어 온다`,
  slime: v => `${v.soft}턴에 한 번, 맞을 때 말랑하게 받아 내서 피해가 절반이 된다`,
  snail: v => `더듬이로 ${v.feel}칸 안의 숨은 함정을 알아챈다`,
  jelly: v => `나를 때린 적을 ${pct(v.zap)} 확률로 찌릿! 다음 턴을 쉬게 만든다`,
};

// the level a pet has grown to (1..PET_LV), and its experience
export const petXp = (meta, id) => meta.petXp?.[id] || 0;
export function petLevel(meta, id) {
  const xp = petXp(meta, id);
  let lv = 1;
  while (lv < PET_LV && xp >= PET_XP[lv]) lv++;
  return lv;
}
// how far along to the next level (0..1), 1 at the top
export function petProgress(meta, id) {
  const lv = petLevel(meta, id);
  if (lv >= PET_LV) return 1;
  return (petXp(meta, id) - PET_XP[lv - 1]) / (PET_XP[lv] - PET_XP[lv - 1]);
}
// what the pet does at a level: every list value taken at that level
export function petPower(id, lv) {
  const pt = PETS[id];
  if (!pt) return {};
  const out = { id, name: pt.name, fly: !!pt.fly };
  for (const [k, v] of Object.entries(pt)) if (Array.isArray(v)) out[k] = v[Math.min(lv, v.length) - 1];
  return out;
}
export const petNote = (id, lv) => NOTE[id]?.(petPower(id, lv)) || '';
// Experience for a pet: returns the levels it went up by.
export function feedPet(meta, id, n) {
  const before = petLevel(meta, id);
  meta.petXp = { ...meta.petXp, [id]: petXp(meta, id) + n };
  return petLevel(meta, id) - before;
}

// 펫 간식: bought at the shop once it has them in, and given there and then to a pet you have
export const TREATS = {
  cookie: { name: '뼈다귀 쿠키', xp: 3, cost: 120, pic: { find: ['bone', 'Y'] } },
  jelly: { name: '하트 젤리', xp: 8, cost: 300, pic: { find: ['heart', 'q'] } },
  cake: { name: '펫 케이크', xp: 20, cost: 700, pic: { find: ['cake', 'wr'] } },
};

// the gold a peck turns up on this floor, and how many pecks one field has in it: walking about, not
// resting, finds it, so standing still never farms gold
export const peckGold = floor => 2 + floor;
