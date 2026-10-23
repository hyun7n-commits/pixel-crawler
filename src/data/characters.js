// Playable characters. `start` is the relics (and levels) a run begins with.
// The others are not bought: each one is locked in a cage (우리) somewhere in one zone of the fields
// (`cage`: that zone's index in ZONES). Break the lock and they move into the village (core/run.js).

// `kind` is what they are (a raccoon, a sheep...), shown small beside the name.
// Each one plays differently because of one trait of their own (`note` says it in a line):
//   sneak: added to the surprise
//   multiplier · hush: how fast sleepers notice you (1 = normal) · choices: relic cards per pick
//   block: chance to stop a blow on the shield · lifesteal: HP back per hit · noRegen: no slow healing
export const CHARACTERS = {
  // the one you start as: no trait, no relic, nothing but a pickaxe and a lantern
  adv: {
    name: '일꾼', kind: '밀짚모자', sprite: 'adv', hp: 30, atk: 3, def: 0,
    start: {}, note: '재주도 유물도 없는 평범한 일꾼. 그래서 뭐든 될 수 있다',
  },
  rogue: {
    name: '도적', kind: '너구리', sprite: 'rogue', hp: 27, atk: 4, def: 0, dodge: 0.2, sneak: 1, hush: 0.5,
    start: { boots: 1 }, note: '날렵해서 잘 피하고, 자는 적이 늦게 깨며, 기습이 훨씬 아프다',
    cage: 0, rumor: '초원 어딘가 우리에 너구리가 갇혀 있다는 소문이다',
  },
  mage: {
    name: '마법사', kind: '양', sprite: 'mage', hp: 25, atk: 3, def: 0, choices: 4,
    start: { bolt: 2 }, note: '유물을 고를 때 하나 더 보고 고른다',
    cage: 1, rumor: '깊은숲 어딘가에서 양이 우는 소리가 들린다던데',
  },
  knight: {
    name: '기사', kind: '강아지', sprite: 'knightP', hp: 32, atk: 3, def: 1, block: 0.17,
    start: { shield: 1 }, note: '여섯 번에 한 번꼴로 공격을 방패로 막아 낸다',
    cage: 2, rumor: '반딧불 늪에서 강아지 짖는 소리가 났다고 한다',
  },
  vamp: {
    name: '흡혈귀', kind: '박쥐', sprite: 'vamp', hp: 31, atk: 4, def: 0, lifesteal: 1, noRegen: true,
    start: { fang: 1 }, note: '때릴 때마다 체력 +1, 대신 가만히 있어서는 낫지 않는다',
    cage: 3, rumor: '돌산 바위틈에 꼬마 박쥐가 갇혀 있다는 이야기가 있다',
  },
};
