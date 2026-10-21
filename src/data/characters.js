// Playable characters. `start` is the relics (and levels) a run begins with.
// Characters with `cond` must meet the condition first, then be bought for `cost` gold.
// `cond.val` reads the saved progress (see core/save.js).

export const CHARACTERS = {
  adv: {
    name: '모험가', sprite: 'adv', hp: 30, atk: 3, def: 0,
    start: { blade: 1 }, note: '균형 잡힌 기본 캐릭터',
  },
  rogue: {
    name: '도적', sprite: 'rogue', hp: 24, atk: 4, def: 0, dodge: 0.2,
    start: { coin: 1 }, note: '20% 확률로 공격을 피해요',
    cost: 200, cond: { text: '4층(동굴)에 도착하기', val: m => m.stats.maxFloor, goal: 4 },
  },
  mage: {
    name: '마법사', sprite: 'mage', hp: 20, atk: 2, def: 0,
    start: { bolt: 2 }, note: '번개 부적 Lv2로 시작해요',
    cost: 400, cond: { text: '적 누적 100마리 쓰러뜨리기', val: m => m.stats.kills, goal: 100 },
  },
  knight: {
    name: '기사', sprite: 'knightP', hp: 40, atk: 3, def: 1,
    start: { shield: 2 }, note: '단단하지만 느리게 강해져요',
    cost: 600, cond: { text: '해골 왕 쓰러뜨리기', val: m => (m.stats.bosses.includes('skelking') ? 1 : 0), goal: 1 },
  },
  vamp: {
    name: '흡혈귀', sprite: 'vamp', hp: 28, atk: 4, def: 0,
    start: { fang: 2 }, note: '싸울수록 체력을 되찾아요',
    cost: 900, cond: { text: '유물 진화 누적 3번', val: m => m.stats.evos, goal: 3 },
  },
};
