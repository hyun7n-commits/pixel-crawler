import { RELICS, RECIPES, recipeKey, tierOf } from './relics.js';
import { loopsOpen } from './stages.js';

// Permanent upgrades sold in the hub shop. `costs` has one price per level.
// Kept small (v0.20): the town makes you a little sturdier, never safe; the fields stay dangerous.
// Priced (v0.21) so the later stages' bigger hauls still have somewhere to go: the first levels come
// after a run or two, the last ones after many.

// What it costs to pack one basic relic (Lv1) for the next run; paid again every run, so gold
// always has a use, and it's how you try out a pairing you have a hunch about (ui/hub.js shop).
export const PACK_COST = 300;
// 두더지 대장장이's 주문 제작 (ui/hub.js books): an evolved relic whose recipe is in your book, made for
// the next run and carried out at Lv1; from the second 회차 on, a legend too. Paid again every time,
// so the late fields' gold always has somewhere to go, and a run can be planned round the legend
// (or the myth) you are after. Price by tier (1 evolved, 2 legend); legends once FORGE_LEGEND_LOOP 회차 is open.
export const FORGE_COST = { 1: 2000, 2: 9000 };
export const FORGE_LEGEND_LOOP = 2;
// what the smith can make: every evolved relic (and later legend) you have made at least once
export const forgeable = meta => [...new Set(RECIPES.filter(rc => meta.recipes[recipeKey(rc)]).map(rc => rc.id))]
  .filter(id => tierOf(id) === 1 || (tierOf(id) === 2 && loopsOpen(meta) >= FORGE_LEGEND_LOOP))
  .sort((a, b) => tierOf(a) - tierOf(b) || Object.keys(RELICS).indexOf(a) - Object.keys(RELICS).indexOf(b));

export const UPGRADES = {
  hp:     { name: '튼튼한 몸',   eff: '시작 최대 체력 +3',                 costs: [150, 400, 900, 1800, 3200] },
  atk:    { name: '날카로운 손', eff: '시작 공격력 +1',                    costs: [800, 3000] },
  pot:    { name: '비상 물약',   eff: '체력 물약 1개 들고 시작',           costs: [900] },
  greed:  { name: '욕심쟁이',    eff: '얻는 골드 +10%',                    costs: [200, 500, 1000, 1800, 3000] },
  reroll: { name: '다시 뽑기',   eff: '판마다 유물 선택지 다시 뽑기 +1회', costs: [400, 1200, 2800] },
};
