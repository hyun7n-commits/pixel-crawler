// Progress that survives between runs (gold, upgrades, unlocks, records).
// Stored in the browser's localStorage; the desktop build will swap this for a file.

import { FIRST_STOCK } from '../data/shop.js';

// v2 (v0.20): the game opens up one thing at a time now (data/unlocks.js), so it starts over from a
// fresh save; the v1 save stays in storage untouched.
const SAVE_KEY = 'pixel-crawler-save-v2';

export function freshMeta() {
  return {
    gold: 0,
    up: { hp: 0, atk: 0, pot: 0, greed: 0, reroll: 0, tool: 0, regen: 0, xp: 0, sneak: 0, herb: 0, armor: 0, charm: 0, shovel: 0, sight: 0, map: 0, bomb: 0 },
    relicUnlock: {},
    chars: { adv: true },
    sel: 'adv',
    stats: { kills: 0, maxFloor: 0, bosses: [], evos: 0, runs: 0, wins: 0, bestGold: 0, chests: 0 },
    open: {},   // what has opened so far, by unlock id (data/unlocks.js)
    found: {},  // discovered combinations, see data/terrain.js
    recipes: {},  // relic recipes found at least once, by recipeKey, see data/relics.js
    ores: {},     // ore grades seen: id -> how many broken open, see data/ores.js
    critters: {}, // kinds of critter met: type -> how many knocked out, see data/enemies.js
    village: { seen: {}, last: null },  // villagers who have already moved in with a hello, and the village as you last saw it
                                        // ({ P, arr }: how far grown, who lived there), see data/village.js
    lastRun: null,          // how the last run went, for the village gossip
    story: {},              // picture-book scenes already shown: intro, ratking, skelking, ending (ui/story.js)
    pack: null,             // a basic relic paid for in the shop to take on the next run (data/upgrades.js PACK_COST)
    forge: null,            // an evolved relic (or a legend) the smith makes for the next run (FORGE_COST)
    clears: {},             // stage -> the highest 회차 it has been beaten at (data/stages.js)
    stage: 0, loop: 1,      // what the stage select has picked for the next trip
    dares: { on: {}, won: {} },  // the rival's dares: switched on, and the furthest stage won with each (data/dares.js)
    home: [],               // 집 꾸미기 pieces put up round your house (data/home.js)
    house: { lvl: 0, own: {}, at: null, plant: 0, visit: null, seen: false, dark: false },  // inside the house: how big, the furniture ordered and where it
                            // stands (null: as the guild left it), trips since the plant went in, a friend dropping by,
                            // been in yet, the lamp off
    bookGifts: 0,           // the smith's recipe-book gifts already taken (data/balance.js bookGift)
    pets: {},               // pets bought at the shop, and the one that comes along (data/pets.js)
    pet: null,
    secrets: {},            // 비밀 found round the village, the house and the fields: id -> when (data/secrets.js)
    book: {},               // everything else in the 비밀 도감: entry id -> when (data/book.js)
    bookBox: 0,             // the book's presents already taken (one every GIFT_EVERY pages)
    wardrobe: {},           // 꾸미기 bought at the shop, and what the hero wears now (data/wear.js)
    wear: { head: null, neck: null },
    board: null,            // the guild's notice board for the next trip, until it goes (data/requests.js)
    ten: true,              // stage numbers are the ten-stage ones (v0.23)
    // v0.30
    stock: Object.fromEntries(FIRST_STOCK.map(id => [id, 0])),  // what the shop has on its shelves: good -> the trip it came (data/shop.js)
    stockSeen: {},          // goods already looked at in the shop (the rest wear NEW)
    petXp: {},              // each pet's experience (data/pets.js)
    tools: {},              // village-life tools: rod, net (levels), can, plots (data/life.js LIFE_TOOLS)
    bag: {},                // the basket: fish, bugs, crops, wild things, dishes, seeds -> how many (data/life.js)
    day: 0,                 // village days gone by: one a trip
    life: null,             // the village today: bites left, bugs and wild things about, gifts given (scenes/village-life.js)
    garden: [],             // the yard's 텃밭 plots: { crop, at, water } (data/life.js)
    meal: null,             // a dish eaten for the next trip (data/life.js DISHES)
    hearts: {},             // how close you are with each villager and friend (data/affinity.js)
    bonds: {},              // how close the villagers are with each other, by pair
    games: {},              // the village games' best scores
  };
}

// v0.23 went from five stages to ten, the new ones slotted in between: what the five were then
const OLD_STAGE = [0, 1, 2, 4, 7];
function tenStages(m) {
  if (m.ten) return m;
  const clears = {};
  for (const [s, l] of Object.entries(m.clears || {})) if (OLD_STAGE[s] != null) clears[OLD_STAGE[s]] = l;
  const won = {};
  for (const [id, n] of Object.entries(m.dares?.won || {})) won[id] = n ? OLD_STAGE[n - 1] + 1 : 0;
  return { ...m, clears, stage: OLD_STAGE[m.stage] ?? 0, dares: { on: { ...m.dares?.on }, won }, ten: true };
}

// Saves from before v0.14 kept the legends made as { id: true }; those were these recipes.
const OLD_LEGENDS = { volcano: 'volcano:flamesword+quake', undying: 'undying:fortress+bloodcrown', goldstorm: 'goldstorm:goldbolt+goldrush' };
const oldLegends = (legends = {}) => Object.fromEntries(Object.keys(legends).filter(id => OLD_LEGENDS[id]).map(id => [OLD_LEGENDS[id], true]));

export function loadMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const m = tenStages(JSON.parse(raw)), f = freshMeta();
      return {
        ...f, ...m,
        up: { ...f.up, ...m.up },
        stats: { ...f.stats, ...m.stats },
        chars: { ...f.chars, ...m.chars },
        relicUnlock: { ...m.relicUnlock },
        found: { ...m.found },
        recipes: { ...m.recipes, ...oldLegends(m.legends) },
        ores: { ...m.ores },
        // saves from before the critter book already knew the bosses they beat
        critters: m.critters ? { ...m.critters } : Object.fromEntries((m.stats?.bosses || []).map(b => [b, 1])),
        village: { seen: { ...m.village?.seen }, last: m.village?.last || null },
        open: { ...m.open },
        story: { ...m.story },
        home: Array.isArray(m.home) ? m.home : [],
        house: {
          lvl: m.house?.lvl || 0, own: { ...m.house?.own }, at: m.house?.at ? { ...m.house.at } : null, plant: m.house?.plant || 0,
          visit: m.house?.visit || null, seen: !!m.house?.seen, dark: !!m.house?.dark,
        },
        clears: { ...m.clears },
        dares: { on: { ...m.dares?.on }, won: { ...m.dares?.won } },
        pets: { ...m.pets },
        secrets: { ...m.secrets },
        book: { ...m.book },
        wardrobe: { ...m.wardrobe },
        wear: { head: m.wear?.head || null, neck: m.wear?.neck || null },
        // v0.30: a save from before has no shelves yet (data/shop.js stockSince fills them as they were)
        stock: m.stock ? { ...m.stock } : null,
        stockSeen: { ...m.stockSeen },
        petXp: { ...m.petXp },
        tools: { ...m.tools },
        bag: { ...m.bag },
        day: m.day || 0,
        life: m.life || null,
        garden: Array.isArray(m.garden) ? m.garden.map(g => ({ ...g })) : [],
        meal: m.meal || null,
        hearts: { ...m.hearts },
        bonds: { ...m.bonds },
        games: { ...m.games },
      };
    }
  } catch (e) { /* storage blocked or corrupt: start fresh */ }
  return freshMeta();
}

export function saveMeta(meta) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ }
}
