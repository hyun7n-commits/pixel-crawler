import { RELICS, RECIPES, recipeKey, tierOf } from './relics.js';
import { loopsOpen } from './stages.js';

// Permanent upgrades sold in the hub shop. `costs` has one price per level.
// Kept small (v0.20): the town makes you a little sturdier, never safe; the fields stay dangerous.
// Priced (v0.21) so the later stages' bigger hauls still have somewhere to go: the first levels come
// after a run or two, the last ones after many.

// What it costs to pack one basic relic (Lv1) for the next run; paid again every run, so gold
// always has a use, and it's how you try out a pairing you have a hunch about (ui/hub.js shop).
export const PACK_COST = 300;
// v0.32 출발 준비 (ui/prep.js): up to PACK_MAX basic relics packed for the trip, each tap one level more
// (up to Lv3), every level dearer than the one before, paid again every trip. The first is as cheap as
// the old single pack; the last few cost a late stage's whole haul, so however much gold piles up, a
// trip can always be set off a little stronger with it (or it goes on a legend from the smith).
export const PACK_PRICES = [PACK_COST, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500];
export const PACK_MAX = 3;
export const packLevels = packs => Object.values(packs || {}).reduce((a, b) => a + b, 0);
export const packCost = n => PACK_PRICES.slice(0, n).reduce((a, b) => a + b, 0);
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

// v0.30: more of them, and none of them on sale at first: each level comes into the shop on its own as
// its shelves fill up (data/shop.js), so the shop grows from two things to a whole wall of them.
// `pic`: its little picture in the shop (as the 비밀 도감 draws them, ui/book.js bookPic); `open`: shown
// once that unlock has opened.
export const UPGRADES = {
  hp:     { name: '튼튼한 몸',   eff: '시작 최대 체력 +3',                 costs: [150, 400, 900, 1800, 3200], pic: { spr: 'heart' } },
  greed:  { name: '욕심쟁이',    eff: '얻는 골드 +10%',                    costs: [200, 500, 1000, 1800, 3000], pic: { spr: 'coin' } },
  pot:    { name: '비상 물약',   eff: '체력 물약 1개 들고 시작',           costs: [900], pic: { spr: 'potion' } },
  regen:  { name: '숨 고르기',   eff: '새 들판에 들어설 때마다 체력 +2',    costs: [600, 1600, 3200], pic: { spr: 'moss' } },
  xp:     { name: '배우는 기쁨', eff: '얻는 경험치 +10%',                  costs: [500, 1400, 3000], pic: { find: ['star', 'y'] } },
  reroll: { name: '다시 뽑기',   eff: '판마다 유물 선택지 다시 뽑기 +1회', costs: [400, 1200, 2800], pic: { find: ['dice', 'w'] } },
  sneak:  { name: '살금살금',    eff: '기습 공격 피해 +25%',               costs: [700, 2400], pic: { spr: 'boots' } },
  herb:   { name: '약초 지식',   eff: '체력 물약 회복량 +10%',             costs: [600, 1800], pic: { spr: 'heal' } },
  atk:    { name: '날카로운 손', eff: '시작 공격력 +1',                    costs: [800, 3000], pic: { spr: 'blade' } },
  armor:  { name: '두꺼운 작업복', eff: '방어 +1',                         costs: [1500, 5000], pic: { spr: 'shield' } },
  charm:  { name: '네잎클로버',  eff: '별난 친구를 더 자주 만난다',        costs: [900, 2500], pic: { find: ['clover', 'g'] } },
  shovel: { name: '꼬마 삽',     eff: '흙 속 반짝이는 곳이 더 자주 보인다', costs: [800, 2200], pic: { find: ['shovel', 'Ln'] } },
  sight:  { name: '밝은 눈',     eff: '시야 +1',                           costs: [2500], pic: { spr: 'lantern' } },
  // v0.26: shown once the first meadow tool has opened (`open`)
  tool:   { name: '도구 주머니', eff: '들판 도구 1개 들고 시작',           costs: [700, 2200], open: 'pinecone', pic: { spr: 'toolpouch' } },
  map:    { name: '지도 한 장',  eff: '지도 1장 들고 시작',                costs: [1200], open: 'map', pic: { spr: 'map' } },
  bomb:   { name: '폭탄 하나 더', eff: '폭탄 1개 더 들고 시작',            costs: [700], open: 'bomb', pic: { spr: 'bomb' } },
};
