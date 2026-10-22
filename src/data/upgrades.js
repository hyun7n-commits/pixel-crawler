// Permanent upgrades sold in the hub shop. `costs` has one price per level.
// Kept small (v0.20): the town makes you a little sturdier, never safe; the fields stay dangerous.

// What it costs to pack one basic relic (Lv1) for the next run; paid again every run, so gold
// always has a use, and it's how you try out a pairing you have a hunch about (ui/hub.js shop).
export const PACK_COST = 150;

export const UPGRADES = {
  hp:     { name: '튼튼한 몸',   eff: '시작 최대 체력 +3',                 costs: [120, 260, 450, 700, 1000] },
  atk:    { name: '날카로운 손', eff: '시작 공격력 +1',                    costs: [300, 900] },
  pot:    { name: '비상 물약',   eff: '체력 물약 1개 들고 시작',           costs: [400] },
  greed:  { name: '욕심쟁이',    eff: '얻는 골드 +10%',                    costs: [120, 230, 350, 500, 680] },
  reroll: { name: '다시 뽑기',   eff: '판마다 유물 선택지 다시 뽑기 +1회', costs: [250, 500, 800] },
};
