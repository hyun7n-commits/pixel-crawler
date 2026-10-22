// Chiikawa-style faces for the heroes, made from each hero frame by repainting a few face pixels.
// Every hero shares one face layout: eyes in columns 7 and 12 (rows 6-7), blush on row 8,
// the ㅅ mouth on rows 9-10. Each expression is a list of [col, row, colour] pixels.
//   hit      squeezed >< eyes when something lands on you
//   grit     squinted eyes, a crease between them and a straight mouth: straining (mining, a big swing)
//   teary    wet eyes and a wobbly mouth when your health is low
//   sparkle  big shiny eyes when something good happens (a chest, an evolution, a jackpot)
//   shock    wide eyes, a small open mouth: something just noticed you
// The sweat drop, falling tears and trembling are drawn over the sprite in DungeonScene.

const EYES = [[7, 6], [7, 7], [12, 6], [12, 7]];
const MOUTH = [[10, 9], [9, 10], [11, 10]];
const clear = list => list.map(([x, y]) => [x, y, 'w']);

export const FACES = {
  hit: [...clear(EYES), ...clear(MOUTH),
    [6, 6, 'k'], [7, 7, 'k'], [6, 8, 'k'], [13, 6, 'k'], [12, 7, 'k'], [13, 8, 'k'],
    [9, 10, 'f'], [10, 10, 'f'], [11, 10, 'f']],
  grit: [[7, 6, 'w'], [12, 6, 'w'], [6, 7, 'k'], [13, 7, 'k'], ...clear(MOUTH),
    [8, 5, 'S'], [9, 6, 'S'], [11, 5, 'S'], [10, 6, 'S'],
    [9, 10, 'f'], [10, 10, 'f'], [11, 10, 'f']],
  teary: [...clear(MOUTH),
    [7, 8, 'c'], [12, 8, 'c'], [6, 7, 'c'], [13, 7, 'c'],
    [9, 10, 'f'], [10, 9, 'f'], [11, 10, 'f']],
  sparkle: [...clear(EYES),
    [6, 6, 'k'], [7, 6, 'w'], [6, 7, 'k'], [7, 7, 'k'], [6, 5, 'k'], [7, 5, 'k'],
    [11, 6, 'k'], [12, 6, 'w'], [11, 7, 'k'], [12, 7, 'k'], [11, 5, 'k'], [12, 5, 'k'],
    [7, 6, 'z'], [12, 6, 'z']],
  shock: [...clear(EYES), ...clear(MOUTH),
    [7, 5, 'k'], [7, 6, 'k'], [7, 7, 'k'], [12, 5, 'k'], [12, 6, 'k'], [12, 7, 'k'],
    [10, 9, 'f'], [9, 10, 'f'], [10, 10, 'k'], [11, 10, 'f'], [10, 11, 'f']],
};

// Only paints onto skin, eyes and mouth, never onto a hat, hood or helmet.
const FACE_PIXELS = new Set(['w', 'k', 'f', 'q', 'r']);
export function faceRows(rows, expr) {
  const out = rows.map(r => [...r]);
  for (const [x, y, ch] of FACES[expr]) {
    const was = out[y]?.[x];
    if (was === undefined || !FACE_PIXELS.has(was)) continue;
    // the vampire's eyes are red; keep them red when they stay eyes
    out[y][x] = ch === 'k' && rows[6][7] === 'r' && y >= 5 && y <= 8 ? 'r' : ch;
  }
  return out.map(r => r.join(''));
}
export const faceKey = (key, expr) => (expr ? `${key}~${expr}` : key);
