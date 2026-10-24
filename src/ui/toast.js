// 새로 찾은 것 (v0.30): a find slides in at the side with its picture, its name, its chapter and how many
// pages the 비밀 도감 has now (data/book.js), then goes. Three at most at once; the rest wait their turn.

import { $, el } from './dom.js';
import { bookPic } from './book.js';
import { ENTRY, CHAPTERS, bookCount, BOOK_TOTAL } from '../data/book.js';

const SHOW_MS = 2800, MAX = 3;
const waiting = [];
let up = 0;

export function toast(meta, id, onShow) {
  const e = ENTRY[id];
  if (!e) return;
  waiting.push({ e, n: bookCount(meta), onShow });
  next();
}

function next() {
  if (up >= MAX || !waiting.length) return;
  const { e, n, onShow } = waiting.shift();
  let box = $('toasts');
  if (!box) { box = el('div'); box.id = 'toasts'; $('stage').append(box); }
  const t = el('div', 'toast');
  const ch = CHAPTERS.find(c => c.id === e.ch);
  const words = el('div', 'toast-words');
  words.append(el('b', null, e.name), el('small', null, `${ch?.name || '비밀'} · 도감 ${n}/${BOOK_TOTAL}`));
  t.append(bookPic(e.pic, 28), words);
  box.append(t);
  up++;
  onShow?.();
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    t.classList.add('out');
    setTimeout(() => { t.remove(); up--; next(); }, 260);
  }, SHOW_MS + (waiting.length ? 0 : 400));
}
