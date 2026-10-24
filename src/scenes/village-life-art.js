// Pictures for 마을 생활 (v0.30, scenes/village-life.js): the yard's vegetable bed with its plots, what
// grows in them as the days go by, wet soil after the watering can, the fishing float. Drawn at the
// village's scale (16 pixels a tile), in its palette.

const PAL = {
  k: '#1b1424', g: '#6fbf4e', G: '#3f8a3a', l: '#9ad86f', w: '#f4f0e8', r: '#d9454a', y: '#f4cf4f', c: '#eadbb0',
  // the planks: lit top, board, knots
  b: '#c4935a', n: '#a0703f', N: '#6e4a2a',
  // soil: the mound's top, its body, its clods and shadowed foot, the furrows between; and the same, wet
  a: '#a57c52', s: '#80603d', S: '#5e432a', F: '#3f2c1a', A: '#6e5034', e: '#553a24', E: '#3d2918',
};

function paint(rows) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || !PAL[ch]) return;
    g.fillStyle = PAL[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

// one plot's mound of soil, 12 x 12, two pixels in from its tile's top left corner: a crumbly top
// catching the light, clods in it, a shadowed foot (`wet`: darker)
const MOUND = [
  '.aaaaaaaaaa.',
  'aaasaaaaasaa',
  'asaaaasaaaas',
  'ssssssssssss',
  'sSssssSsssss',
  'sssssssssSss',
  'ssSssssssssS',
  'ssssssSsssss',
  'sssSssssssss',
  'SssssssssSsS',
  'SSSSSSSSSSSS',
  '.SSSSSSSSSS.',
];
const WET = { a: 'A', s: 'e', S: 'E' };
const mound = wet => (wet ? MOUND.map(r => [...r].map(ch => WET[ch] || ch).join('')) : MOUND);
export const MOUND_AT = 2;

// The bed: `cols` x 2 plots in a low frame of planks, dark furrows between the mounds, its bottom row
// on the ground (data/home.js DECOR garden: 2 columns, 3 once 텃밭 넓히기 is bought).
export function bedCanvas(cols = 2) {
  const w = cols * 16, h = 32;
  const rows = Array.from({ length: h }, () => Array(w).fill('F'));
  // the planks round the edge: an outline and a board, lit along the top, a knot here and there
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1, board = x === 1 || y === 1 || x === w - 2 || y === h - 2;
    if (edge) rows[y][x] = 'k';
    else if (board) rows[y][x] = (x + 2 * y) % 9 === 0 ? 'N' : y === 1 ? 'b' : 'n';
  }
  for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < 2; cy++) {
    MOUND.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch !== '.') rows[cy * 16 + MOUND_AT + j][cx * 16 + MOUND_AT + i] = ch;
    }));
  }
  return paint(rows.map(r => r.join('')));
}
// a plot's soil once watered, laid over the mound
export const wetCanvas = () => paint(mound(true));

// what grows: 0 seeds just in (pale, to show up on dark soil), 1 a sprout, 2 nearly there (3: ripe,
// drawn as the crop's own picture over stage 2's leaves)
const GROW = [
  [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '.cc....cc.',
    '.NN.cc.NN.',
    '....NN....',
    '..........',
  ],
  [
    '..........',
    '..........',
    '..........',
    '..kk..kk..',
    '.klgk.kglk',
    '.kgGgkgGgk',
    '..kkkgkkk.',
    '.....Gk...',
    '....kGk...',
  ],
  [
    '..kk...kk.',
    '.klgk.klgk',
    'klggGkgggk',
    'kgGgGkgGGk',
    '.kkGgGgkk.',
    '.klgGGGlgk',
    'kggGkGkGgk',
    '.kkk.G.kk.',
    '....kGk...',
  ],
];
export const growCanvas = stage => paint(GROW[Math.max(0, Math.min(2, stage))]);

// the fishing float: red over white
export const floatCanvas = () => paint([
  '.k.',
  'krk',
  'krk',
  'kwk',
  '.k.',
]);
