// Permanent upgrades sold in the hub shop. `costs` has one price per level.
// Kept small (v0.20): the town makes you a little sturdier, never safe; the fields stay dangerous.
// Priced (v0.21) so the later stages' bigger hauls still have somewhere to go: the first levels come
// after a run or two, the last ones after many.

// What it costs to pack one basic relic (Lv1) for the next run; paid again every run, so gold
// always has a use, and it's how you try out a pairing you have a hunch about (ui/hub.js shop).
export const PACK_COST = 300;

export const UPGRADES = {
  hp:     { name: '튼튼한 몸',   eff: '시작 최대 체력 +3',                 costs: [150, 400, 900, 1800, 3200] },
  atk:    { name: '날카로운 손', eff: '시작 공격력 +1',                    costs: [800, 3000] },
  pot:    { name: '비상 물약',   eff: '체력 물약 1개 들고 시작',           costs: [900] },
  greed:  { name: '욕심쟁이',    eff: '얻는 골드 +10%',                    costs: [200, 500, 1000, 1800, 3000] },
  reroll: { name: '다시 뽑기',   eff: '판마다 유물 선택지 다시 뽑기 +1회', costs: [400, 1200, 2800] },
};
