// 상점 진열대 (v0.30): the shop starts with next to nothing on its shelves and gets new goods in after
// every trip, the way Vampire Crawlers' shop keeps filling up. At the end of each trip the first
// STOCK_PER_TRIP goods below (one more on a trip that beats its stage) whose `when` holds come in, in
// this order, and the end card says what came; what has come is in meta.stock (good id -> the trip it
// came on), and what you have not had a look at yet wears a NEW badge in the shop (meta.stockSeen), with
// a '!' over the shopkeeper till you do (ui/hub.js, scenes/VillageScene.js).
// A good's id says what it is:
//   up:<upgrade>:<level> the next level of a lasting upgrade goes on sale (data/upgrades.js)
//   pet:<pet> a pet (data/pets.js) · treat:<treat> pet treats, bought again and again
//   wear:<piece> a 꾸미기 (data/wear.js) · relic:<relic> a relic for the fields (relics.js `locked`)
//   life:<tool> a tool for village life (data/life.js LIFE_TOOLS) · seed:<crop> seeds, bought again and again
//   svc:pack packing a relic for the next trip

import { UPGRADES } from './upgrades.js';
import { PETS, TREATS } from './pets.js';
import { WEAR } from './wear.js';
import { RELICS } from './relics.js';
import { LIFE_TOOLS, CROPS, seedCost, SEED_PACK } from './life.js';
import { isOpen } from './unlocks.js';
import { villageP, ownsHome } from './village.js';

export const STOCK_PER_TRIP = 2;
// what a brand-new shop has on its shelves
export const FIRST_STOCK = ['up:hp:1', 'up:greed:1'];

const trips = n => m => m.stats.runs >= n;
const opened = id => m => isOpen(m, id);
const home = (n = 0) => m => ownsHome(m) && m.stats.runs >= n;
const bosses = n => m => m.stats.bosses.length >= n;
const petted = n => m => Object.keys(m.pets || {}).length > 0 && m.stats.runs >= n;
const pond = n => m => villageP(m) >= 3 && m.stats.runs >= n;
const all = (...fs) => m => fs.every(f => f(m));

const S = (id, when = () => true) => ({ id, when });
export const STOCK = [
  S('up:hp:1'), S('up:greed:1'),
  S('pet:chick', trips(1)), S('up:pot:1', trips(1)),
  S('up:hp:2', trips(2)), S('life:net1', trips(2)), S('up:regen:1', trips(2)),
  S('treat:cookie', petted(1)), S('up:greed:2', trips(3)), S('up:xp:1', trips(3)), S('up:reroll:1', trips(3)),
  S('wear:sprout', opened('wear')), S('pet:butterfly', trips(4)), S('up:hp:3', trips(4)), S('up:sneak:1', trips(4)),
  S('seed:turnip', home()), S('seed:carrot', home()), S('life:rod1', pond(1)),
  S('up:herb:1', trips(5)), S('up:tool:1', opened('pinecone')), S('wear:leaf', opened('wear')),
  S('pet:mouse', trips(5)), S('up:charm:1', trips(5)), S('up:atk:1', trips(6)), S('up:shovel:1', trips(6)),
  S('seed:potato', home(6)), S('wear:flower', opened('wear')), S('pet:ladybug', trips(6)),
  S('up:greed:3', trips(7)), S('up:regen:2', trips(7)), S('treat:jelly', petted(7)), S('seed:strawberry', home(7)),
  S('relic:bandage', opened('shelf')), S('svc:pack', opened('shelf')), S('life:can', home(8)), S('up:xp:2', trips(8)),
  S('wear:scarf', opened('wear')), S('pet:bookworm', trips(8)), S('up:bomb:1', opened('bomb')), S('up:reroll:2', trips(9)),
  S('seed:cabbage', home(9)), S('relic:magnet', opened('shelf')), S('wear:cherry', opened('wear')),
  S('up:hp:4', trips(10)), S('pet:duckling', trips(10)), S('up:armor:1', all(trips(10), bosses(2))), S('life:net2', trips(10)),
  S('seed:pepper', home(10)), S('wear:clover', opened('wear')), S('relic:moss', opened('shelf')), S('up:map:1', opened('map')),
  S('up:sneak:2', trips(12)), S('pet:bee', trips(12)), S('seed:tomato', home(12)), S('wear:bell', opened('wear')),
  S('up:herb:2', trips(13)), S('life:rod2', pond(13)), S('relic:bombbag', opened('shelf')), S('wear:acorn', opened('wear')),
  S('up:greed:4', trips(14)), S('pet:piglet', trips(14)), S('seed:corn', home(14)), S('up:charm:2', trips(15)),
  S('up:tool:2', all(opened('pinecone'), trips(15))), S('wear:bandana', opened('wear')), S('relic:thorns', opened('shelf')),
  S('treat:cake', petted(16)), S('up:sight:1', all(trips(16), bosses(3))), S('pet:sparrow', trips(16)), S('seed:eggplant', home(16)),
  S('wear:star', opened('wear')), S('life:plot2', home(17)), S('up:shovel:2', trips(18)), S('relic:sweep', opened('shelf')),
  S('pet:cloud', trips(18)), S('up:xp:3', trips(19)), S('seed:sunflower', home(19)), S('wear:heart', opened('wear')),
  S('up:hp:5', trips(20)), S('up:regen:3', trips(20)), S('pet:firefly', trips(20)), S('relic:bolt', opened('shelf')),
  S('wear:bib', opened('wear')), S('up:atk:2', all(trips(22), bosses(5))), S('life:net3', trips(22)), S('seed:pumpkin', home(22)),
  S('pet:squirrel', trips(22)), S('wear:ribbon', opened('wear')), S('up:reroll:3', trips(24)), S('wear:bluebow', opened('wear')),
  S('pet:slime', trips(24)), S('seed:watermelon', home(25)), S('up:greed:5', trips(26)), S('wear:bowtie', opened('wear')),
  S('life:rod3', pond(28)), S('pet:snail', trips(28)), S('wear:moon', opened('wear')), S('up:armor:2', all(trips(30), bosses(7))),
  S('wear:tie', opened('wear')), S('wear:stripe', opened('wear')), S('pet:jelly', trips(32)), S('wear:shroom', opened('wear')),
  S('wear:lei', opened('wear')), S('wear:pearl', opened('wear')), S('wear:crown', opened('wear')), S('wear:rainbow', opened('wear')),
];
export const STOCK_BY_ID = Object.fromEntries(STOCK.map(g => [g.id, g]));
export const STOCK_TOTAL = STOCK.length;

const part = id => id.split(':');
export const stocked = (meta, id) => meta.stock?.[id] != null;
export const stockCount = meta => STOCK.reduce((n, g) => n + (stocked(meta, g.id) ? 1 : 0), 0);
// how many levels of an upgrade are on sale so far
export function upCap(meta, id) {
  let n = 0;
  while (n < UPGRADES[id].costs.length && stocked(meta, `up:${id}:${n + 1}`)) n++;
  return n;
}
// is anything on the shelves you have not looked at yet
export const newStock = meta => STOCK.filter(g => stocked(meta, g.id) && !meta.stockSeen?.[g.id]).map(g => g.id);
export const isNew = (meta, id) => stocked(meta, id) && !meta.stockSeen?.[id];
export function seeStock(meta) {
  meta.stockSeen ||= {};
  for (const g of STOCK) if (stocked(meta, g.id)) meta.stockSeen[g.id] = true;
}

// What comes in at the end of this trip (and is written down as come): a list of goods, `n` at most.
export function arriveStock(meta, n = STOCK_PER_TRIP) {
  meta.stock ||= {};
  const out = [];
  for (const g of STOCK) {
    if (out.length >= n) break;
    if (stocked(meta, g.id) || !g.when(meta)) continue;
    meta.stock[g.id] = meta.stats.runs;
    out.push(g);
  }
  return out;
}
// the next good still to come (for the shop's "다음에 들어올 물건" shadow), null once all have come
export const nextStock = meta => STOCK.find(g => !stocked(meta, g.id) && g.when(meta)) || STOCK.find(g => !stocked(meta, g.id)) || null;

// A save from before v0.30 had everything of then on sale: those stay on the shelves. A brand-new one
// has FIRST_STOCK. Returns what came in now for a worker back after the update (a few goods, so the
// first look at the shop already has something new); [] when there is nothing to do.
const OLD_UPS = ['hp', 'atk', 'pot', 'greed', 'reroll', 'tool'];
const OLD_PETS = ['chick', 'butterfly', 'ladybug', 'cloud', 'snail'];
const OLD_WEAR = ['leaf', 'flower', 'star', 'ribbon', 'crown', 'scarf', 'bell', 'bowtie', 'stripe', 'lei', 'rainbow'];
export const WELCOME_STOCK = 3;
export function stockSince(meta) {
  if (meta.stock) return [];
  meta.stock = {};
  if (!meta.stats.runs) { for (const id of FIRST_STOCK) meta.stock[id] = 0; return []; }
  const put = id => { if (STOCK_BY_ID[id]) meta.stock[id] = 0; };
  for (const u of OLD_UPS) UPGRADES[u].costs.forEach((_, i) => put(`up:${u}:${i + 1}`));
  for (const p of OLD_PETS) put(`pet:${p}`);
  if (isOpen(meta, 'wear')) for (const w of OLD_WEAR) put(`wear:${w}`);
  if (isOpen(meta, 'shelf')) { for (const r of Object.keys(RELICS).filter(r => RELICS[r].locked)) put(`relic:${r}`); put('svc:pack'); }
  seeStock(meta);
  return arriveStock(meta, WELCOME_STOCK);
}

// ---------- what a good looks like in a list ----------
// { name, line, pic } (pic as the 비밀 도감 draws them, ui/book.js bookPic)
export function goodInfo(id) {
  const [kind, a, b] = part(id);
  switch (kind) {
    case 'up': {
      const u = UPGRADES[a];
      return { name: `${u.name} ${b}단계`, line: u.eff, pic: u.pic, kind };
    }
    case 'pet': return { name: `${PETS[a].name} (${PETS[a].kind})`, line: '같이 다니는 펫', pic: { spr: PETS[a].sprite }, kind };
    case 'treat': return { name: TREATS[a].name, line: `펫 간식. 먹으면 펫이 쑥 자란다 (경험치 +${TREATS[a].xp})`, pic: TREATS[a].pic, kind };
    case 'wear': return { name: WEAR[a].name, line: '꾸미기', pic: { wear: a }, kind };
    case 'relic': return { name: RELICS[a].name, line: '들판에 새 유물 추가', pic: { spr: a }, kind };
    case 'life': return { name: LIFE_TOOLS[a].name, line: LIFE_TOOLS[a].desc, pic: LIFE_TOOLS[a].pic, kind };
    case 'seed': return { name: `${CROPS[a].name} 씨앗`, line: `${SEED_PACK}알에 ${seedCost(CROPS[a].days)}G. 텃밭에 심으면 ${CROPS[a].days}일 만에 자란다`, pic: { find: ['seed', 'n'] }, kind };
    case 'svc': return { name: '유물 챙겨 주기', line: '다음 판에 기본 유물 하나를 챙겨 간다', pic: { spr: 'shopkeep' }, kind };
  }
  return { name: id, line: '', pic: { spr: 'door' }, kind };
}
