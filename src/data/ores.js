// Grades of the big ore. Deeper floors start on a better grade, and a swing can crack
// into the next grade underneath. `mult` scales the gold; `vein` recolours the ore's
// pieces stuck in the rock (light, dark): round nuggets for the metals, faceted crystals for the rest.
// Gems sit above diamond; the rainbow stone is the top.

export const ORES = [
  { id: 'copper',   name: '동',        metal: true, mult: 1,   vein: ['#e0874a', '#9c4f25'] },
  { id: 'silver',   name: '은',        metal: true, mult: 1.25, vein: ['#f1f4fa', '#9aa5b8'] },
  { id: 'gold',     name: '금',        metal: true, mult: 1.6, vein: ['#f4cf4f', '#c99a2b'] },
  { id: 'diamond',  name: '다이아몬드', mult: 2,   vein: ['#c8f6ff', '#5cc8e8'] },
  { id: 'emerald',  name: '에메랄드',   mult: 2.6, vein: ['#6fe39a', '#1f8a4a'], gem: true },
  { id: 'sapphire', name: '사파이어',   mult: 3.3, vein: ['#7aa4ff', '#2a3fb0'], gem: true },
  { id: 'ruby',     name: '루비',       mult: 4.2, vein: ['#ff6478', '#a3142f'], gem: true },
  { id: 'rainbow',  name: '무지개석',   mult: 6,   vein: null, gem: true },
];

export const RAINBOW = ['#ff6478', '#f08c3a', '#f4cf4f', '#6fe39a', '#7aa4ff', '#b58cf0'];
