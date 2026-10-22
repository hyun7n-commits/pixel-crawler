// Playable characters. `start` is the relics (and levels) a run begins with.
// Characters with `cond` must meet the condition first, then be bought for `cost` gold.
// `cond.val` reads the saved progress (see core/save.js).

// Each one plays differently because of one trait of their own (`note` says it in a line):
//   quiet: mining is quieter, so fewer monsters come for the ore · sneak: added to the surprise
//   multiplier · hush: how fast sleepers notice you (1 = normal) · choices: relic cards per pick
//   block: chance to stop a blow on the shield · lifesteal: HP back per hit · noRegen: no slow healing
export const CHARACTERS = {
  adv: {
    name: '일꾼', sprite: 'adv', hp: 30, atk: 3, def: 0, quiet: true,
    start: { blade: 1 }, note: '곡괭이질 소리가 작아 반짝 바위에 몬스터가 덜 몰려온다',
  },
  rogue: {
    name: '도적', sprite: 'rogue', hp: 27, atk: 4, def: 0, dodge: 0.2, sneak: 1, hush: 0.5,
    start: { boots: 1 }, note: '날렵해서 잘 피하고, 자는 적이 늦게 깨며, 기습이 훨씬 아프다',
    cost: 400, cond: { text: '4구역(깊은숲)에 도착하기', val: m => m.stats.maxFloor, goal: 4 },
  },
  mage: {
    name: '마법사', sprite: 'mage', hp: 25, atk: 3, def: 0, choices: 4,
    start: { bolt: 2 }, note: '유물을 고를 때 하나 더 보고 고른다',
    cost: 800, cond: { text: '적 누적 100마리 쓰러뜨리기', val: m => m.stats.kills, goal: 100 },
  },
  knight: {
    name: '기사', sprite: 'knightP', hp: 32, atk: 3, def: 1, block: 0.2,
    start: { shield: 1 }, note: '다섯 번에 한 번꼴로 공격을 방패로 막아 낸다',
    cost: 1200, cond: { text: '버섯 왕 쓰러뜨리기', val: m => (m.stats.bosses.includes('skelking') ? 1 : 0), goal: 1 },
  },
  vamp: {
    name: '흡혈귀', sprite: 'vamp', hp: 31, atk: 4, def: 0, lifesteal: 1, noRegen: true,
    start: { fang: 1 }, note: '때릴 때마다 체력 +1, 대신 가만히 있어서는 낫지 않는다',
    cost: 1800, cond: { text: '유물 진화 누적 3번', val: m => m.stats.evos, goal: 3 },
  },
};
