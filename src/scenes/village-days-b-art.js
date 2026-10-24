// Pictures for the second lot of 마을의 하루 (v0.30, scenes/village-days-b.js): the dirt the giant turnip
// sits in (and the hole it leaves), the sock the wind took, the kite caught in the tree, and the little
// bits of the friends that give them away at hide and seek (ears over the bush, a tail out of the side of
// the crate...). Drawn with pixkit at the village's scale and in its light (from the upper left),
// outlined in a dark version of what they wrap. (The turnip itself, the washing line, the hen and the
// bush are in village-play-art.js; the crate is the village's own, village-props.js.)

import { Pix, ramp, tone, hash } from './pixkit.js';

const done = p => { p.outline(); return p.canvas(); };

// ---------- 커다란 순무 ----------
// the ring of turned-up earth the turnip sits in, two tiles wide; `hole`: after it came out, the hole
// it left in the middle
export function moundCanvas(hole = false) {
  const p = new Pix(32, 9), DIRT = ramp('#8a6a44');
  p.ell(16, 5, 15, 3.6, (x, y, nx, ny) => tone(DIRT, 1.9 + nx * 0.6 + ny * 0.9 + (hash(x, y, 7) < 0.25 ? 0.8 : 0), x, y));
  if (hole) p.ell(16, 5, 9, 2.2, (x, y, nx, ny) => (ny < -0.3 ? '#3a2a22' : '#2a1c18'));
  else for (let k = 0; k < 5; k++) p.set(6 + k * 5, 3 + (k % 2), DIRT[0]);     // crumbs of earth on top
  return done(p);
}

// ---------- 날아간 양말 ----------
// one yellow sock, with a white heel and toe (the match of the one on the line, village-play-art.js)
export function sockCanvas() {
  const p = new Pix(9, 10), Y = ramp('#f4cf4f'), W = ramp('#f4efe6');
  p.rect(1, 1, 4, 6, (x, y, i, j) => tone(Y, 1.5 + i * 0.4 + (j === 0 ? -0.5 : 0), x, y));
  p.rect(2, 6, 6, 3, (x, y, i, j) => tone(Y, 1.8 + i * 0.25 + j * 0.4, x, y));
  p.rect(1, 6, 2, 2, (x, y) => tone(W, 1.6, x, y));       // the heel
  p.rect(6, 7, 2, 2, (x, y) => tone(W, 2.0, x, y));       // the toe
  return done(p);
}

// ---------- 나무에 걸린 연 ----------
// a red diamond kite with a cross spar and a tail of three paper bows
export function kiteCanvas() {
  const p = new Pix(13, 26), R = ramp('#d9454a'), BOW = ['#f4cf4f', '#8fd8f0', '#f29bb2'];
  p.poly([[6, 0], [12, 7], [6, 15], [0, 7]], (x, y) => tone(R, 1.6 + (x - 6) * 0.15 + (y - 7) * 0.08 + (x === 6 || y === 7 ? 0.9 : 0), x, y));
  p.set(6, 7, '#f4efe6');
  for (let y = 15; y < 26; y++) p.set(6 + (y % 4 < 2 ? 1 : 0), y, '#e8dcc8');   // the string of the tail
  for (let k = 0; k < 3; k++) {
    const y = 17 + k * 3, x = 6 + (k % 2 ? 1 : 0);
    p.set(x - 1, y, BOW[k]); p.set(x, y, BOW[k]); p.set(x + 1, y, BOW[k]);
  }
  return done(p);
}

// ---------- 숨바꼭질 ----------
// What shows of each friend while they hide (data/play.js HIDE_LINES): drawn as little stamps. `top`:
// it pokes up over the top of the hiding place; otherwise it sticks out of its side. Light from the
// upper left, as everywhere.
const PK = {
  k: '#1b1424', w: '#f4f0e8', W: '#d8d0c4', y: '#f4cf4f', Y: '#e8c86a', h: '#c99a2b', r: '#d9454a', p: '#f29bb2',
  o: '#f08c3a', O: '#b8612a', n: '#a0703f', N: '#6e4a2a', d: '#8a6a44', D: '#5e4630', g: '#6fbf4e', G: '#3f8a3a',
  s: '#c9ccd6', S: '#8a8e9c', T: '#5e6270', v: '#6f4e9c', V: '#3e2a66', c: '#8fd8f0', l: '#9ad86f', e: '#f4dc7a',
  b: '#8a7a6a', B: '#3a3030',
};
const PEEKS = {
  adv: { top: true, rows: ['..YYYY..', '..YrrY..', 'YYYYYYYY', 'hhhhhhhh'] },                        // the straw hat's crown and brim
  rogue: { rows: ['bbBB', 'bbBB', 'BBbb', 'BBbb', 'bbBB', 'bbBB', 'BBbb'] },                       // a striped tail
  mage: { top: true, rows: ['..wwww..', '.wwwwwww', 'wwwwwwww', '.wWWWWw.'] },                       // a 'cloud'
  knight: { rows: ['...nn', '..nnn', '.nnn.', 'nnn..', 'nn...', 'Nn...'] },                         // a wagging tail
  vamp: { top: true, rows: ['..VvvV..', '.VvvvvV.', 'VvvkkvvV', 'Vvvv.vvV', '.VV..VV.'] },            // a bat, hanging
  rabbit: { top: true, rows: ['.w....w.', 'wpw..wpw', 'wpw..wpw', 'wpw..wpw', 'www..www', '.w....w.'] },   // two ears
  hamster: { rows: ['.ooo.ooo.', 'ooeooeooo', 'ooooooooo', '.ooo.ooo.'] },                           // full cheeks
  cat: { rows: ['..oo', '.oOo', 'oO..', 'oo..', 'oo..', 'Oo..', '.oo.'] },                           // a tail, swishing
  hedgehog: { top: true, rows: ['.N.N.N.N.', 'NnNnNnNnN', 'nnnnnnnnn', '.nnnnnnn.'] },                // rolled up like a burr
  owl: { top: true, rows: ['nnnnnnnn', 'nkknnkkn', 'kkkkkkkk', 'nnnnnnnn'] },                        // eyes shut tight
  fox: { rows: ['.ccc.', 'cwwwc', 'cwwcc', '.ccc.', '...n.', '...n.', '...N.'] },                     // a magnifying glass
  frog: { top: true, rows: ['gg...gg', 'gkg.gkg', 'ggg.ggg'] },                                     // two eyes
  panda: { top: true, rows: ['kk....kk', 'kwwwwwwk', 'wwkwwkww', 'wwwwwwww', '.wwllww.'] },           // munching
  turtle: { top: true, rows: ['..GGGGG..', '.GgGgGgG.', 'GgGgGgGgG', 'GGGGGGGGG'] },                  // the shell
  mole: { rows: ['...dd...', '.dddddd.', 'dddDdddd', 'dDddddDd'] },                                  // a heap of earth
  penguin: { rows: ['.kkkk.', 'kkwwkk', 'kkwwkk', '.kkkk.', 'oo..oo'] },                              // a bottom and two feet
  bear: { top: true, rows: ['nn.....nn', 'nOn...nOn', '.nnnnnnn.', 'nnnnnnnnn'] },                    // ears and a big back
  goat: { top: true, rows: ['S.....S', 'Ss...sS', '.Ss.sS.', '.Ss.sS.'] },                            // two horns
  dragon: { top: true, rows: ['..ss..', '.sWWs.', 'sWWWWs', '.ssss.', '..ss..'] },                     // a puff of smoke
  skunk: { rows: ['.kwk.', 'kwwwk', 'kwwwk', 'kkwkk', 'kkwkk', 'kkkkk', '.kkk.'] },                    // a striped tail
  chameleon: { rows: ['.ll.', 'lkkl', 'lkkl', '.ll.'] },                                            // one eye, blinking
};
export const peekTop = id => !!PEEKS[id]?.top;
export function peekCanvas(id) {
  const def = PEEKS[id] || PEEKS.rabbit, w = def.rows[0].length, h = def.rows.length;
  const p = new Pix(w + 2, h + 2);
  p.stamp(1, 1, def.rows, PK);
  return done(p);
}
