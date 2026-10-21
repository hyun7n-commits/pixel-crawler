// Permanent upgrades sold in the hub shop. `costs` has one price per level.

export const UPGRADES = {
  hp:     { name: '튼튼한 몸',   eff: '시작 최대 체력 +4',                 costs: [40, 80, 130, 190, 260] },
  atk:    { name: '날카로운 손', eff: '시작 공격력 +1',                    costs: [80, 160, 280] },
  pot:    { name: '비상 물약',   eff: '체력 물약 1개 들고 시작',           costs: [60, 150] },
  greed:  { name: '욕심쟁이',    eff: '얻는 골드 +10%',                    costs: [50, 90, 140, 200, 270] },
  reroll: { name: '다시 뽑기',   eff: '판마다 유물 선택지 다시 뽑기 +1회', costs: [100, 200, 320] },
};
