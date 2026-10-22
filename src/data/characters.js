// Playable characters. `start` is the relics (and levels) a run begins with.
// Characters with `cond` must meet the condition first, then be bought for `cost` gold.
// `cond.val` reads the saved progress (see core/save.js).

// Each one plays differently because of one trait of their own (`note` says it in a line):
//   quiet: mining is quieter, so fewer monsters come for the ore · sneak: added to the surprise
//   multiplier · hush: how fast sleepers notice you (1 = normal) · choices: relic cards per pick
//   block: chance to stop a blow on the shield · lifesteal: HP back per hit · noRegen: no slow healing
export const CHARACTERS = {
  adv: {
    name: '광부', sprite: 'adv', hp: 30, atk: 3, def: 0, quiet: true,
    start: { blade: 1 }, note: '곡괭이질 소리가 작아 광석에 몬스터가 덜 몰려온다',
  },
  rogue: {
    name: '도적', sprite: 'rogue', hp: 24, atk: 4, def: 0, dodge: 0.1, sneak: 1, hush: 0.5,
    start: { boots: 1 }, note: '자는 적이 늦게 깨고, 기습이 훨씬 아프다',
    cost: 200, cond: { text: '4층(동굴)에 도착하기', val: m => m.stats.maxFloor, goal: 4 },
  },
  mage: {
    name: '마법사', sprite: 'mage', hp: 22, atk: 3, def: 0, choices: 4,
    start: { bolt: 2 }, note: '유물을 고를 때 하나 더 보고 고른다',
    cost: 400, cond: { text: '적 누적 100마리 쓰러뜨리기', val: m => m.stats.kills, goal: 100 },
  },
  knight: {
    name: '기사', sprite: 'knightP', hp: 34, atk: 3, def: 1, block: 0.25,
    start: { shield: 1 }, note: '네 번에 한 번꼴로 공격을 방패로 막아 낸다',
    cost: 600, cond: { text: '해골 왕 쓰러뜨리기', val: m => (m.stats.bosses.includes('skelking') ? 1 : 0), goal: 1 },
  },
  vamp: {
    name: '흡혈귀', sprite: 'vamp', hp: 28, atk: 4, def: 0, lifesteal: 1, noRegen: true,
    start: { fang: 1 }, note: '때릴 때마다 체력 +1, 대신 가만히 있어서는 낫지 않는다',
    cost: 900, cond: { text: '유물 진화 누적 3번', val: m => m.stats.evos, goal: 3 },
  },
};
