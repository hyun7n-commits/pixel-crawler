// Progress that survives between runs (gold, upgrades, unlocks, records).
// Stored in the browser's localStorage; the desktop build will swap this for a file.

// v2 (v0.20): the game opens up one thing at a time now (data/unlocks.js), so it starts over from a
// fresh save; the v1 save stays in storage untouched.
const SAVE_KEY = 'pixel-crawler-save-v2';

export function freshMeta() {
  return {
    gold: 0,
    up: { hp: 0, atk: 0, pot: 0, greed: 0, reroll: 0 },
    relicUnlock: {},
    chars: { adv: true },
    sel: 'adv',
    stats: { kills: 0, maxFloor: 0, bosses: [], evos: 0, runs: 0, wins: 0, bestGold: 0, chests: 0 },
    open: {},   // what has opened so far, by unlock id (data/unlocks.js)
    found: {},  // discovered combinations, see data/terrain.js
    recipes: {},  // relic recipes found at least once, by recipeKey, see data/relics.js
    ores: {},     // ore grades seen: id -> how many broken open, see data/ores.js
    critters: {}, // kinds of critter met: type -> how many knocked out, see data/enemies.js
    village: { seen: {} },  // villagers who have already moved in with a hello, see data/village.js
    lastRun: null,          // how the last run went, for the village gossip
    story: {},              // picture-book scenes already shown: intro, ratking, skelking, ending (ui/story.js)
    pack: null,             // a basic relic paid for in the shop to take on the next run (data/upgrades.js PACK_COST)
    step: 0,                // the 탐험 단계 picked at the guild (data/balance.js)
    home: [],               // 집 꾸미기 pieces put up round your house (data/home.js)
    bookGifts: 0,           // the smith's recipe-book gifts already taken (data/balance.js bookGift)
  };
}

// Saves from before v0.14 kept the legends made as { id: true }; those were these recipes.
const OLD_LEGENDS = { volcano: 'volcano:flamesword+quake', undying: 'undying:fortress+bloodcrown', goldstorm: 'goldstorm:goldbolt+goldrush' };
const oldLegends = (legends = {}) => Object.fromEntries(Object.keys(legends).filter(id => OLD_LEGENDS[id]).map(id => [OLD_LEGENDS[id], true]));

export function loadMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const m = JSON.parse(raw), f = freshMeta();
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
        village: { seen: { ...m.village?.seen } },
        open: { ...m.open },
        story: { ...m.story },
        home: Array.isArray(m.home) ? m.home : [],
      };
    }
  } catch (e) { /* storage blocked or corrupt: start fresh */ }
  return freshMeta();
}

export function saveMeta(meta) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ }
}
