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
// Priced (v0.25, 200-trip bot careers) so a legend is a treat saved up for over a trip or two, not a
// given: at 9000G the bot took one every trip from the second 회차 and beat all forty stages in ~60
// trips; at 15000G it takes ~90-100, and without the smith it stalls for good in the fourth 회차.
// (FORGE_COST env "evolved,legend": a test override for the bot's careers)
const FC = (globalThis.process?.env?.FORGE_COST || '3000,15000').split(',').map(Number);
export const FORGE_COST = { 1: FC[0], 2: FC[1] };
export const FORGE_LEGEND_LOOP = 2;
// what the smith knows how to make: every evolved relic (and later legend) you have made at least once
const inOrder = (a, b) => tierOf(a) - tierOf(b) || Object.keys(RELICS).indexOf(a) - Object.keys(RELICS).indexOf(b);
export const forgeable = meta => [...new Set(RECIPES.filter(rc => meta.recipes[recipeKey(rc)]).map(rc => rc.id))]
  .filter(id => tierOf(id) === 1 || (tierOf(id) === 2 && loopsOpen(meta) >= FORGE_LEGEND_LOOP))
  .sort(inOrder);
// ...and what he has the stuff for today: a few of those (up to two legends), a new lot after every trip.
// Dealt from the number of trips so far, so it holds still while you look and changes when you come home;
// what you have ordered stays on show so it can be called off.
export const FORGE_STOCK = 4;
export function forgeStock(meta) {
  let s = (meta.stats.runs * 7919 + 17) % 233280;
  const deal = ids => ids.map(id => [(s = (s * 9301 + 49297) % 233280), id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const all = forgeable(meta);
  const legends = deal(all.filter(id => tierOf(id) === 2)).slice(0, 2);
  const stock = [...deal(all.filter(id => tierOf(id) === 1)).slice(0, FORGE_STOCK - legends.length), ...legends];
  if (meta.forge && !stock.includes(meta.forge)) stock.push(meta.forge);
  return stock.sort(inOrder);
}

export const UPGRADES = {
  hp:     { name: '튼튼한 몸',   eff: '시작 최대 체력 +3',                 costs: [150, 400, 900, 1800, 3200] },
  atk:    { name: '날카로운 손', eff: '시작 공격력 +1',                    costs: [800, 3000] },
  pot:    { name: '비상 물약',   eff: '체력 물약 1개 들고 시작',           costs: [900] },
  greed:  { name: '욕심쟁이',    eff: '얻는 골드 +10%',                    costs: [200, 500, 1000, 1800, 3000] },
  reroll: { name: '다시 뽑기',   eff: '판마다 유물 선택지 다시 뽑기 +1회', costs: [400, 1200, 2800] },
  // v0.26: shown once the first meadow tool has opened (`open`)
  tool:   { name: '도구 주머니', eff: '들판 도구 1개 들고 시작',           costs: [700, 2200], open: 'pinecone' },
};
