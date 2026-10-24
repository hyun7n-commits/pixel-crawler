// 마을의 하루 sheets (v0.30, scenes/village-days.js): the wandering peddler's mat on market day. A few
// things for today only, each at its own price; what you buy goes in the basket.

import { el, button } from './dom.js';
import { bookPic } from './book.js';
import { picOf } from './life.js';
import { josa } from '../core/util.js';

// `offers`: { id, n, price, name, line, sold }; `buy(o)`: true when it went through
let marketNote = '';
export function renderMarket(box, meta, { offers, buy, changed }) {
  const list = el('div', 'shop market');
  if (marketNote) { list.append(el('p', 'say', marketNote)); marketNote = ''; }
  for (const o of offers) {
    const row = el('div', 'row' + (o.sold ? ' owned' : '')), main = el('div', 'row-main');
    main.append(el('span', 'row-name', o.name), el('span', 'row-sub', o.line));
    const b = button('btn gold', o.sold ? '팔렸다' : `${o.price}G`, () => {
      if (!buy(o)) return;
      marketNote = `${josa(o.name, '을', '를')} 샀다. 바구니에 넣었다.`;
      changed();
    });
    b.disabled = !!o.sold || meta.gold < o.price;
    row.append(bookPic(picOf(o.id), 32), main, b);
    list.append(row);
  }
  box.append(list);
}
