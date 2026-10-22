// Chiikawa-style faces for the heroes, made from each hero frame by repainting a few face pixels.
// Every hero shares one face layout: eyes in columns 7 and 12 (rows 6-7), blush on row 8,
// the smiling ‿ mouth on rows 9-10 (a ㅅ there reads as a frown, so only the teary face uses it). Each expression is a list of [col, row, colour] pixels.
//   hit      squeezed >< eyes when something lands on you
//   grit     squinted eyes, a crease between them and a straight mouth: straining (mining, a big swing)
//   teary    wet eyes and a wobbly mouth when your health is low
//   sparkle  big shiny eyes when something good happens (a chest, an evolution, a jackpot)
//   shock    wide eyes, a small open mouth: something just noticed you
//   blink    eyes shut for a moment, every few seconds when nothing else is going on
// The sweat drop, falling tears and trembling are drawn over the sprite in DungeonScene.

const EYES = [[7, 6], [7, 7], [12, 6], [12, 7]];
const MOUTH = [[8, 9], [9, 10], [10, 10], [11, 9]];
const clear = list => list.map(([x, y]) => [x, y, 'w']);

export const FACES = {
  blink: [[7, 6, 'w'], [12, 6, 'w']],
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

// Only paints onto the face (skin, eyes, mouth, blush, the raccoon's mask), never onto a hat, wool or
// helmet. A 'w' in an expression means "this hero's skin here": the colour beside that pixel, so the
// sheep's peach face and the raccoon's mask stay theirs when an eye closes.
const FACE_PIXELS = new Set(['w', 'k', 'f', 'q', 'r']);
const MARKS = new Set(['k', 'f', 'r', 'q']);
export function faceRows(rows, expr) {
  const out = rows.map(r => [...r]);
  const face = new Set([...FACE_PIXELS, rows[7][9], rows[6][6], rows[6][11]]);
  const skinAt = (x, y) => [rows[y][x - 1], rows[y][x + 1]].find(c => c && !MARKS.has(c) && face.has(c)) || rows[7][9];
  for (const [x, y, ch] of FACES[expr]) {
    const was = out[y]?.[x];
    if (was === undefined || !face.has(rows[y][x])) continue;
    // the vampire's eyes are red; keep them red when they stay eyes
    out[y][x] = ch === 'w' ? skinAt(x, y) : ch === 'k' && rows[6][7] === 'r' && y >= 5 && y <= 8 ? 'r' : ch;
  }
  return out.map(r => r.join(''));
}
export const faceKey = (key, expr) => (expr ? `${key}~${expr}` : key);
