// 비밀 도감 (v0.30, data/book.js): a tab for each chapter, a little picture for every page, the ones not
// found yet a dark shape; tap one you have to read about it. At home it is the 비밀 상자; in the village
// the book button on the top bar opens it too. Every GIFT_EVERY pages there is a present in it.

import { el, button } from './dom.js';
import { spriteForDom, oddCanvas, rowsCanvas, dressedCanvas } from '../scenes/textures.js';
import { findIcon } from '../data/finds-art.js';
import { WEAR } from '../data/wear.js';
import { CHARACTERS } from '../data/characters.js';
import { CHAPTERS, byChapter, has, bookCount, chapterCount, BOOK_TOTAL, GIFT_EVERY, bookGiftOf, bookGiftsDue } from '../data/book.js';

// an entry's picture as a canvas (null when there is none to draw)
function picCanvas(pic) {
  try {
    if (pic.find) return rowsCanvas(findIcon(...pic.find));
    if (pic.wear) return dressedCanvas(CHARACTERS.adv.sprite, { [WEAR[pic.wear].slot]: pic.wear });
    if (pic.odd) return oddCanvas(pic.spr, pic.odd);
    if (pic.spr) return spriteForDom(pic.spr);
  } catch (e) { /* a picture that is not there: the cell shows its mark only */ }
  return null;
}

// the cached pictures are shared: each place gets a copy of its own
function copyOf(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

// A page's picture at `size` CSS pixels: with a tool in front for the tricks, a mark for the habits.
// `dark`: not found yet, only its shape.
export function bookPic(pic, size = 32, dark = false) {
  const wrap = el('span', 'bk-pic');
  wrap.style.width = wrap.style.height = `${size}px`;
  const src = picCanvas(pic);
  if (src) {
    const c = copyOf(src);
    c.className = 'pix' + (dark ? ' shadow' : '');
    // the little ones are drawn little
    const k = pic.odd === 'baby' ? 0.72 : 1;
    c.style.width = `${Math.round(size * k * src.width / 16)}px`;
    c.style.height = `${Math.round(size * k * src.height / 16)}px`;
    wrap.append(c);
  }
  if (!dark && pic.tool) {
    const t = picCanvas({ spr: pic.tool });
    if (t) { const c = copyOf(t); c.className = 'pix bk-tool'; wrap.append(c); }
  }
  if (!dark && pic.mark) wrap.append(el('i', 'bk-mark', pic.mark));
  return wrap;
}

let tab = 'secret';

export function renderBook(box, meta, { changed } = {}) {
  const n = bookCount(meta);
  const head = el('div', 'bk-head');
  const bar = el('div', 'bar'), fill = el('i');
  fill.style.width = `${(100 * n / BOOK_TOTAL).toFixed(1)}%`;
  bar.append(fill);
  head.append(el('b', null, `비밀 도감 ${n}/${BOOK_TOTAL}`), bar);
  box.append(head);
  // a present for every GIFT_EVERY pages
  const due = bookGiftsDue(meta), got = meta.bookBox || 0;
  if (due > 0) {
    const row = el('div', 'row book-gift ready'), main = el('div', 'row-main');
    main.append(el('span', 'row-name', '도감 선물이 들어 있다!'), el('span', 'row-sub', `${(got + 1) * GIFT_EVERY}칸을 채웠다. 상자 바닥에 골드가 반짝인다.`));
    row.append(main, button('btn gold', `${bookGiftOf(got + 1)}G 받기`, () => { meta.gold += bookGiftOf(got + 1); meta.bookBox = got + 1; changed?.(); }));
    box.append(row);
  } else if (n) box.append(el('p', 'row-sub', `${(got + 1) * GIFT_EVERY - n}칸 더 채우면 상자에 선물이 생긴다.`));
  // the chapters: a chapter with nothing found yet is only a shape too
  const tabs = el('div', 'bk-tabs');
  for (const ch of CHAPTERS) {
    const k = chapterCount(meta, ch.id), all = byChapter(ch.id).length;
    const b = button('bk-tab' + (tab === ch.id ? ' on' : ''), null, () => { tab = ch.id; box.innerHTML = ''; renderBook(box, meta, { changed }); });
    b.append(bookPic(ch.pic, 24, !k), el('span', null, k ? ch.name : '???'), el('small', null, `${k}/${all}`));
    tabs.append(b);
  }
  box.append(tabs);
  const cur = CHAPTERS.find(c => c.id === tab) || CHAPTERS[0];
  box.append(el('p', 'bk-note', chapterCount(meta, cur.id) ? cur.note : '아직 하나도 못 찾았다.'));
  const grid = el('div', 'bk-grid'), note = el('p', 'book-note', '찾은 칸을 누르면 그때 일을 볼 수 있다.');
  for (const e of byChapter(cur.id)) {
    const got = has(meta, e.id), cell = el('button', 'bk-cell' + (got ? '' : ' unknown'));
    cell.type = 'button';
    cell.append(bookPic(e.pic, 32, !got));
    cell.onclick = () => {
      grid.querySelectorAll('.picked').forEach(c => c.classList.remove('picked'));
      cell.classList.add('picked');
      note.innerHTML = '';
      if (got) note.append(el('b', null, e.name), el('span', null, e.line));
      else note.textContent = '아직 못 찾았다.';
    };
    grid.append(cell);
  }
  box.append(grid, note);
}
