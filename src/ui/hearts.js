// 친밀도 in the talk sheet (v0.30, data/affinity.js): how close you are with someone, as ten little
// pixel hearts under what they said; a present for them out of the basket (once a village day); and,
// now and then, something they would like taken over to a friend of theirs.

import { el, button } from './dom.js';
import { bookPic } from './book.js';
import { bagItems, picOf } from './life.js';
import { PAL } from '../data/sprites.js';
import { itemName } from '../data/life.js';
import { heartsOf, heartPart, giftedToday, giftable, whoName, ERRAND_ITEMS, HEART_PTS, MAX_HEARTS } from '../data/affinity.js';
import { josa } from '../core/util.js';

// one heart, 7x6: 'k' its outline, '#' what fills up (left to right as it fills)
const HEART = ['.kk.kk.', 'k##k##k', 'k#####k', '.k###k.', '..k#k..', '...k...'];
const GAP = 1;

// ten hearts in a row: the full ones red, the one filling up partly, the rest dark
function heartsCanvas(full, part) {
  const w = HEART[0].length, h = HEART.length;
  const c = document.createElement('canvas');
  c.width = MAX_HEARTS * (w + GAP) - GAP; c.height = h;
  const g = c.getContext('2d');
  // how many of the five inside columns of the heart being filled are red
  const cols = Math.floor(part / HEART_PTS * 5 + 1e-6);
  for (let i = 0; i < MAX_HEARTS; i++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = HEART[y][x];
      if (ch === '.') continue;
      const lit = i < full || (i === full && x - 1 < cols);
      g.fillStyle = ch === 'k' ? PAL.k : lit ? (y === 1 && (x === 1 || x === 4) ? PAL.q : PAL.r) : '#3a3346';
      g.fillRect(i * (w + GAP) + x, y, 1, 1);
    }
  }
  // (drawn two or three times over: styles.css .ties-hearts)
  c.className = 'pix ties-hearts';
  return c;
}

let giving = null; // who the present picker is open for
let picked = null;

// The hearts row (and what goes with it) at the top of someone's talk sheet.
// opts: { redraw, onGift(id), ask: an errand they would like done (data/affinity.js errandAsk) or null,
//   onErrand() }
export function heartsRow(meta, who, { redraw, onGift, ask, onErrand }) {
  const box = el('div', 'ties');
  const top = el('div', 'ties-top');
  top.append(heartsCanvas(heartsOf(meta, who), heartPart(meta, who)));
  const gifts = bagItems(meta).filter(giftable);
  if (giftedToday(meta, who)) top.append(el('span', 'row-sub ties-note', '오늘은 선물을 줬다.'));
  else {
    const open = giving === who;
    top.append(button('btn ties-gift' + (open ? ' on' : ''), '선물하기', () => { giving = open ? null : who; picked = null; redraw(); }));
  }
  box.append(top);
  // the present picker: what is in the basket, then the one you picked and a button to give it
  if (giving === who && !giftedToday(meta, who)) {
    if (!gifts.length) box.append(el('p', 'row-sub', '바구니에 줄 만한 게 없다.'));
    else {
      if (picked && !gifts.includes(picked)) picked = null;
      const grid = el('div', 'bag-grid ties-grid');
      for (const id of gifts) {
        const b = button('bag-cell' + (picked === id ? ' on' : ''), null, () => { picked = picked === id ? null : id; redraw(); });
        b.append(bookPic(picOf(id), 40), el('span', 'bag-n', `${meta.bag[id]}`));
        b.title = itemName(id);
        grid.append(b);
      }
      box.append(grid);
      if (picked) {
        const id = picked;
        box.append(button('btn primary ties-give', `${josa(itemName(id), '을', '를')} 준다`, () => { giving = picked = null; onGift(id); }));
      }
    }
  }
  // something to take over to a friend of theirs: what you are carrying for them, or what they ask
  const e = meta.errand;
  if (e && e.from === who) {
    const row = el('div', 'row ties-errand');
    row.append(bookPic({ find: ERRAND_ITEMS[e.what].pic }, 32), el('span', 'row-sub', `${whoName(e.to)}에게 ${josa(ERRAND_ITEMS[e.what].name, '을', '를')} 전해 줘야 한다.`));
    box.append(row);
  } else if (ask) {
    const row = el('div', 'row ties-errand'), main = el('div', 'row-main');
    main.append(el('span', 'ties-ask', `“${ask.ask}”`));
    row.append(bookPic({ find: ERRAND_ITEMS[ask.what].pic }, 32), main, button('btn primary', '전해 줄게', onErrand));
    box.append(row);
  }
  return box;
}
// the picker closes with the sheet
export const heartsClosed = () => { giving = picked = null; };
