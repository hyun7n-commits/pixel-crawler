// Pictures for the little odd things (v0.30, scenes/village-quirks.js and home-quirks.js): a needle out of
// the hay, a tiny mushroom, an apple with a caterpillar in it, a golden leaf, a four-leaf clover, a puff of
// smoke the shape of a bun, a breath of fog on glass and the heart drawn in it, a ribbon wound round, a
// dust bunny, a crayon drawing, a rubber duck, a book, a sheep and its fence, a glow-in-the-dark star, a
// soap bubble, a feather, a stage light and a sunbeam. Drawn in the same palette letters as the sprites
// (data/sprites.js PAL), outlined in ink where they are things, soft where they are light or breath.

import { rowsCanvas } from './textures.js';
import { Pix, mixc } from './pixkit.js';

const ROWS = {
  needle: ['.t.', 'kwk', 'klk', '.l.', '.l.', '.l.', '.l.', '.L.', '.L.'],
  shroom: ['.kkk.', 'krwrk', 'krrrk', '.kwk.', '.kwk.'],
  apple: ['...G..', '..kgk.', '.krrrk', 'krrwrk', 'krrrrk', 'kRrrRk', '.kkkk.'],
  grub: ['.kk.', 'kvvk', 'kgkv', 'kvvk', '.kk.'],
  goldleaf: ['...kk', '..kzk', '.kzyk', 'kyyYk', 'kYYk.', 'kkk..', 'N....'],
  clover: ['.kk.kk.', 'kgvkvgk', 'kgggggk', '.kkGkk.', 'kgggggk', 'kgvkvgk', '.kkGkk.', '...G...'],
  bun: ['...WWWWW...', '.WWlWWWlWW.', 'WWlWWlWWlWW', 'WlWWWWWWWlW', '.WWWWWWWWW.', '..lllllll..'],
  heart: ['.tt.tt.', 't..t..t', 't.....t', '.t...t.', '..t.t..', '...t...'],
  ribbon: ['rr..........', '.rrr....yy..', '...rrryyyy..', 'bb...yyrr...', '.bbbb...rrr.', '....bbbb..rr', '..yy...bbb..', 'yyy.......bb'],
  dust: ['.k.kk.k.', 'kLllllLk', 'klwklwkL', 'klkklkkL', 'kllllllk', '.kLLLLk.'],
  // three little ones in work hats holding hands, the sun in the corner, in crayon on a bit of paper
  drawing: ['WWWWWWWWWWWWWWW', 'WaaaaaaaaaaaaaW', 'WayyaaaaaaaaaaW', 'WayyaaaaaaaaaaW', 'WaaaaaaaaaaaaaW', 'WayyyayyyayyyaW', 'WaakaaakaaakaaW',
    'WakkkkkkkkkkkaW', 'WaabaaaraaagaaW', 'WaabaaaraaagaaW', 'WababararagagaW', 'WvvvvvvvvvvvvvW', 'WWWWWWWWWWWWWWW'],
  duck: ['..kk..', '.kyyko', 'kyyyyk', 'kyyyyk', '.kkkk.'],
  book: ['kkkkkk', 'kbbbbk', 'kbzzbk', 'kbbbbk', 'kkkkkk'],
  sheep: ['.kkkk...', 'kwwwwkk.', 'kwwwwwdk', 'kwwwwkkk', '.kkkk...', '.k..k...'],
  fence: ['n...n...n.', 'nnnnnnnnnn', 'n...n...n.', 'nnnnnnnnnn', 'n...n...n.'],
  star: ['.v.', 'vzv', '.v.'],
  bubble: ['.cc.', 'ctwc', 'cwwc', '.cc.'],
  feather: ['..n', '.nN', 'nN.', 'N..'],
  bud: ['.q.', 'qyq', '.g.'],
  rat: ['.kk.k', 'kllll', 'kllll', '.k.k.'],
  petal: ['qe', 'q.'],
};

// a picture by name, made once per scene's textures
export function qtex(sc, name) {
  const key = `qk_${name}`;
  if (sc.textures.exists(key)) return key;
  const make = MAKE[name];
  sc.textures.addCanvas(key, make ? make() : rowsCanvas(ROWS[name]));
  return key;
}

const MAKE = {
  // breath on glass: a soft white blot, thicker in the middle
  fog() {
    const p = new Pix(11, 8);
    p.ell(5.5, 4, 5.4, 3.8, (x, y, nx, ny) => (nx * nx + ny * ny < 0.35 ? '#f4f0e8' : (x + y) % 2 ? '#e6eef4' : null));
    return p.canvas();
  },
  // a stage light falling from above in three steps of brightness
  cone() {
    const p = new Pix(28, 46);
    for (let y = 0; y < 46; y++) {
      const half = 3 + y * 0.24, cx = 14;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const edge = Math.abs(x + 0.5 - cx) > half - 2;
        p.set(x, y, edge ? ((x + y) % 2 ? '#8a7a40' : null) : y < 14 ? '#b8a860' : y < 30 ? '#a89850' : '#988848');
      }
    }
    return p.canvas();
  },
  // sunlight slanting in from a window onto the floor below it
  beam() {
    const p = new Pix(15, 30);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 10; x++) {
      const px = Math.round(x + y * 0.15);
      p.set(px, y, (x === 0 || x === 9) && (x + y) % 2 ? null : mixc('#806a30', '#a08840', y / 30));
    }
    return p.canvas();
  },
};
