// Progress that survives between runs (gold, upgrades, unlocks, records).
// Stored in the browser's localStorage; the desktop build will swap this for a file.

const SAVE_KEY = 'pixel-crawler-save-v1';

export function freshMeta() {
  return {
    gold: 0,
    up: { hp: 0, atk: 0, pot: 0, greed: 0, reroll: 0 },
    relicUnlock: {},
    chars: { adv: true },
    sel: 'adv',
    stats: { kills: 0, maxFloor: 0, bosses: [], evos: 0, runs: 0, wins: 0, bestGold: 0 },
    found: {},  // discovered combinations, see data/terrain.js
  };
}

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
      };
    }
  } catch (e) { /* storage blocked or corrupt: start fresh */ }
  return freshMeta();
}

export function saveMeta(meta) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ }
}
