// 펫: a little companion bought at the shop that tags along behind you, in the fields and at home.
// Critters pay it no mind and it never gets hurt; each one helps in one small way. One goes out at a
// time (meta.pet), chosen among the ones you have (meta.pets).
//   peck: every n steps you walk (not rests) it pecks up a little gold at your feet, a few times a field · sight: wider view · greed: more gold
//   drizzle: every n turns a drop of rain heals you · feel: hidden traps this close show themselves
export const PETS = {
  chick:     { name: '삐약이', kind: '병아리',   sprite: 'pet_chick',     cost: 600,  peck: 30,   note: '30걸음마다 발밑을 콕콕 쪼아 골드를 조금 찾아낸다. 들판마다 세 번까지' },
  butterfly: { name: '팔랑이', kind: '나비',     sprite: 'pet_butterfly', cost: 1200, sight: 1,   note: '앞을 팔랑팔랑 날아다녀서 시야 +1' },
  ladybug:   { name: '점박이', kind: '무당벌레', sprite: 'pet_ladybug',   cost: 2000, greed: 0.1, note: '행운의 점박이: 얻는 골드 +10%' },
  cloud:     { name: '뭉게',   kind: '아기 구름', sprite: 'pet_cloud',    cost: 3200, drizzle: 12, note: '12턴마다 보슬비를 뿌려 체력 +1' },
  snail:     { name: '느릿이', kind: '달팽이',   sprite: 'pet_snail',     cost: 4500, feel: 2,    note: '더듬이로 두 칸 안의 숨은 함정을 알아챈다' },
};
// the gold a peck turns up on this floor, and how many pecks one field has in it: walking about, not
// resting, finds it, so standing still never farms gold
export const peckGold = floor => 2 + floor;
export const PECKS_PER_FIELD = 3;
