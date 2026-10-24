// 마을 생활 (v0.30, data/life.js): the basket (from the village's top bar), the seed sheet at the yard's
// bed, and cooking at the stove at home. What you catch, pick and pull up waits in the basket; a dish
// eaten before a trip helps on that trip (meta.meal, core/run.js).

import { el, button } from './dom.js';
import { bookPic } from './book.js';
import {
  ITEM, CROPS, DISHES, DISH_LIST, FISH_LIST, BUG_LIST, CROP_LIST, FORAGE_LIST, isSeed, itemName, cookable, cook, buffText, addToBag,
  bagCount, lifeEntry,
} from '../data/life.js';
import { has } from '../data/book.js';
import { isMap, MAP_PIC } from '../data/play.js';
import { mapCanvas } from '../scenes/village-play-art.js';
import { josa } from '../core/util.js';

const SEED_PIC = { find: ['seed', 'n'] };
const picOf = id => (isSeed(id) ? SEED_PIC : isMap(id) ? MAP_PIC : ITEM[id]?.pic);
const nameOf = id => (isMap(id) ? '보물 지도' : itemName(id));
// the order things are listed in: as the tables have them
const ORDER = Object.fromEntries([...DISH_LIST, ...FISH_LIST, ...BUG_LIST, ...CROP_LIST, ...FORAGE_LIST].map((r, i) => [r[0], i]));
const byOrder = (a, b) => (ORDER[a.replace('seed:', '')] ?? 999) - (ORDER[b.replace('seed:', '')] ?? 999) || (isSeed(a) - isSeed(b));
const GROUPS = [['map', '보물 지도'], ['dish', '요리'], ['fish', '물고기'], ['bug', '곤충'], ['crop', '텃밭'], ['forage', '들에서 난 것'], ['seed', '씨앗']];
const groupOf = id => (isSeed(id) ? 'seed' : isMap(id) ? 'map' : ITEM[id]?.cat);
const owned = meta => Object.keys(meta.bag || {}).filter(id => meta.bag[id] > 0 && (ITEM[id] || isSeed(id) || isMap(id))).sort(byOrder);
export const bagItems = owned;
export { picOf };

// a dish you have eaten for the next trip, in a line
function mealRow(meta) {
  const d = DISHES[meta.meal];
  if (!d) return null;
  const row = el('div', 'row owned meal-row'), main = el('div', 'row-main');
  main.append(el('span', 'row-name', `든든하다: ${d.name}`), el('span', 'row-sub', `다음 탐험에서 ${buffText(d.buff)}`));
  row.append(bookPic(d.pic, 32), main);
  return row;
}

// an item in a grid: its picture and how many
function cell(id, n, on, onTap) {
  const b = button('bag-cell' + (on ? ' on' : ''), null, onTap);
  b.append(bookPic(picOf(id), 48), el('span', 'bag-n', `${n}`));
  b.title = nameOf(id);
  return b;
}

// ---------- the basket ----------
let picked = null;
export function renderBasket(box, meta, { changed }) {
  const meal = mealRow(meta);
  if (meal) box.append(meal);
  const ids = owned(meta);
  if (!ids.length) { box.append(el('p', 'row-sub', '아직 아무것도 없다. 마을을 둘러보자.')); return; }
  if (picked && !ids.includes(picked)) picked = null;
  for (const [g, name] of GROUPS) {
    const list = ids.filter(id => groupOf(id) === g);
    if (!list.length) continue;
    box.append(el('h3', null, name));
    const grid = el('div', 'bag-grid');
    for (const id of list) grid.append(cell(id, meta.bag[id], picked === id, () => { picked = picked === id ? null : id; changed(); }));
    box.append(grid);
    // what you picked, under its own group
    if (picked && list.includes(picked)) box.append(detail(meta, picked, changed));
  }
}
function detail(meta, id, changed) {
  const it = ITEM[id], row = el('div', 'row bag-detail'), main = el('div', 'row-main');
  // a treasure map: the drawing itself, big enough to find the place by
  if (isMap(id)) {
    const box = el('div', 'bag-map'), c = mapCanvas(meta, id.slice(4));
    if (c) { c.className = 'pix'; c.style.width = `${c.width * 3}px`; c.style.height = `${c.height * 3}px`; box.append(c); }
    box.append(el('span', 'row-sub', '마을 어딘가를 그린 지도. 빨간 X 표시가 있다.'));
    return box;
  }
  if (isSeed(id)) {
    const c = CROPS[id.slice(5)];
    main.append(el('span', 'row-name', itemName(id)), el('span', 'row-sub', `텃밭에 심으면 ${c.days}일 만에 ${josa(c.name, '이', '가')} 자란다.`));
    row.append(bookPic(SEED_PIC, 32), main);
    return row;
  }
  main.append(el('span', 'row-name', it.name), el('span', 'row-sub', it.line));
  if (it.cat === 'dish') main.append(el('span', 'row-sub buff', buffText(it.buff)));
  row.append(bookPic(it.pic, 32), main);
  if (it.cat === 'dish') {
    const b = button('btn primary', meta.meal ? '배불러서 못 먹는다' : '먹고 나가기', () => {
      meta.meal = id;
      addToBag(meta, id, -1);
      picked = null;
      changed('eat');
    });
    b.disabled = !!meta.meal;
    row.append(b);
  }
  return row;
}

// ---------- the seed sheet ----------
// `i`: the plot you tapped; `empties`: every empty plot
export function renderSeeds(box, meta, { i, empties, onPlant }) {
  const seeds = owned(meta).filter(isSeed);
  for (const id of seeds) {
    const c = CROPS[id.slice(5)], n = meta.bag[id];
    const row = el('div', 'row'), main = el('div', 'row-main');
    main.append(el('span', 'row-name', `${c.name} 씨앗 <small>${n}알</small>`), el('span', 'row-sub', `${c.days}일이면 다 자란다`));
    row.append(bookPic(SEED_PIC, 32), main);
    const all = Math.min(n, empties.length);
    if (all > 1) row.append(button('btn', `빈 칸 다 (${all})`, () => onPlant(c.id, empties)));
    row.append(button('btn primary', '심기', () => onPlant(c.id, [i])));
    box.append(row);
  }
}

// ---------- cooking ----------
// one or two things in the pot; what comes out you only know once you have made it (the book says so)
let pot = [];
export function renderCook(box, meta, { changed, onCooked }) {
  pot = pot.filter(id => bagCount(meta, id) >= pot.filter(o => o === id).length);
  const head = el('div', 'pot');
  for (let k = 0; k < 2; k++) {
    const id = pot[k];
    const slot = button('pot-slot' + (id ? ' full' : ''), null, () => { if (id) { pot.splice(k, 1); changed(); } });
    if (id) slot.append(bookPic(picOf(id), 48));
    head.append(slot);
    if (k === 0) head.append(el('span', 'pot-plus', '+'));
  }
  const out = pot.length ? cook(pot) : null, known = out && has(meta, lifeEntry(out.id));
  head.append(el('span', 'pot-plus', '→'));
  const res = el('span', 'pot-slot result');
  if (out) res.append(bookPic(out.pic, 48, !known));
  head.append(res, el('span', 'pot-name', out ? (known ? out.name : '???') : ''));
  box.append(head);
  const go = button('btn primary', '보글보글 요리하기', () => {
    const dish = cook(pot);
    for (const id of pot) addToBag(meta, id, -1);
    addToBag(meta, dish.id, 1);
    pot = [];
    onCooked(dish);
  });
  go.disabled = !pot.length;
  box.append(go);
  const can = owned(meta).filter(id => cookable(id));
  if (!can.length) { box.append(el('p', 'row-sub', '냄비에 넣을 게 없다. 물고기나 채소를 구해 오자.')); return; }
  box.append(el('h3', null, '바구니에서 넣기'));
  const grid = el('div', 'bag-grid');
  for (const id of can) {
    const left = meta.bag[id] - pot.filter(o => o === id).length;
    const b = cell(id, left, false, () => { if (pot.length < 2 && left > 0) { pot.push(id); changed(); } });
    b.disabled = left <= 0 || pot.length >= 2;
    grid.append(b);
  }
  box.append(grid);
}
// what came out of the pot: eat it now, or keep it in the basket
export function renderDish(box, meta, dish, { changed, onEat }) {
  const card = el('div', 'dish-card');
  card.append(bookPic(dish.pic, 96), el('b', null, dish.name), el('p', 'row-sub', dish.line), el('p', 'buff', buffText(dish.buff)));
  box.append(card);
  const row = el('div', 'dish-buttons');
  const eat = button('btn primary', meta.meal ? '배불러서 못 먹는다' : '먹고 나가기', () => {
    meta.meal = dish.id;
    addToBag(meta, dish.id, -1);
    onEat();
  });
  eat.disabled = !!meta.meal;
  row.append(eat, button('btn', '바구니에 넣어 두기', () => changed('keep')));
  box.append(row);
}
export const hasCookable = meta => owned(meta).some(id => cookable(id));
export const basketCount = meta => owned(meta).reduce((n, id) => n + meta.bag[id], 0);
