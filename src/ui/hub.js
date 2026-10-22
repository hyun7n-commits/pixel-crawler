// What each villager looks after, drawn as the body of their talk sheet (see FOLK[...].panel in
// data/village.js): the guild picks heroes, the shop sells upgrades, the neighbour gossips, the smith
// keeps the recipe and ore books, the rescuer keeps the records, the rival brags.
// ctx: { meta, onStart, changed, setMeta }. `changed` saves, redraws the sheet and updates the village.

import { $, el, button, icon } from './dom.js';
import { CHARACTERS } from '../data/characters.js';
import { UPGRADES } from '../data/upgrades.js';
import { RELICS, RECIPES, recipeKey, tierOf, DISCOVERY_GOLD } from '../data/relics.js';
import { freshMeta, saveMeta } from '../core/save.js';
import { josa } from '../core/util.js';
import { DISCOVERIES } from '../data/terrain.js';
import { ORES } from '../data/ores.js';
import { FOLK, HOUSES, gossip } from '../data/village.js';
import { LAST_FLOOR } from '../data/balance.js';

export function renderPanel(id, box, ctx) {
  PANELS[id](box, ctx);
}

// The bits of the village screen that are not the map: the purse, sound, and the way out.
export function renderVillageHud(meta) {
  const purse = $('vPurse');
  purse.innerHTML = '';
  purse.append(icon('gold', 20), el('span', null, `${meta.gold}G`));
  $('vGo').textContent = `${josa(CHARACTERS[meta.sel].name, '으로', '로')} 들판에 출발`;
}

const startButton = (meta, onStart) =>
  button('btn primary enter', `${josa(CHARACTERS[meta.sel].name, '으로', '로')} 들판으로 출발`, onStart);

// ---------- 조합장: heroes ----------
function chars(box, { meta, onStart, changed, setMeta }) {
  const buy = (cost, apply) => { meta.gold -= cost; apply(); changed(); };
  const grid = el('div', 'chars');
  for (const [id, c] of Object.entries(CHARACTERS)) {
    const owned = meta.chars[id];
    const cls = 'char' + (meta.sel === id ? ' sel' : '') + (owned ? '' : ' locked');
    const card = owned ? button(cls, null, () => { meta.sel = id; changed(); }) : el('div', cls);
    const top = el('div', 'char-top');
    const sp = icon(c.sprite, 40);
    sp.classList.add('char-spr');
    top.append(sp, el('span', 'char-name', c.name));
    card.append(top);
    const startRelic = Object.entries(c.start).map(([r, l]) => `${RELICS[r].name} Lv${l}`).join(', ');
    card.append(el('div', 'char-stats', `체력 ${c.hp} · 공격 ${c.atk}${c.def ? ` · 방어 ${c.def}` : ''}<br>시작 유물: ${startRelic}<br>${c.note}`));
    if (!owned) {
      const v = Math.min(c.cond.goal, c.cond.val(meta)), met = v >= c.cond.goal;
      card.append(el('div', 'cond', `해금 조건: ${c.cond.text} (${v}/${c.cond.goal})`));
      const bar = el('div', 'bar'), fill = el('i');
      fill.style.width = `${(v / c.cond.goal) * 100}%`;
      bar.append(fill);
      card.append(bar);
      const b = button('btn gold', `${c.cost}G로 데려오기`, () => buy(c.cost, () => { meta.chars[id] = true; meta.sel = id; }));
      b.disabled = !met || meta.gold < c.cost;
      card.append(b);
    }
    grid.append(card);
  }
  box.append(grid, startButton(meta, onStart));
  let armed = 0;
  const reset = button('btn quiet', '처음부터 다시 하기', () => {
    if (Date.now() - armed < 3000) { const m = freshMeta(); saveMeta(m); setMeta(m); return; }
    armed = Date.now();
    reset.textContent = '한 번 더 누르면 모든 진행이 지워진다';
  });
  box.append(reset);
}

// ---------- 상점 주인: upgrades and new relics ----------
function shop(box, { meta, changed }) {
  const buy = (cost, apply) => { meta.gold -= cost; apply(); changed(); };
  const list = el('div', 'shop');
  list.append(el('h3', null, '영구 강화'));
  for (const [id, u] of Object.entries(UPGRADES)) {
    const lv = meta.up[id], max = u.costs.length;
    const row = el('div', 'row'), main = el('div', 'row-main');
    const nm = el('span', 'row-name', u.name), pips = el('span', 'pips');
    for (let i = 0; i < max; i++) pips.append(el('i', i < lv ? 'on' : ''));
    nm.append(pips);
    main.append(nm, el('span', 'row-sub', u.eff));
    const b = button('btn gold', lv >= max ? '최대' : `${u.costs[lv]}G`, () => buy(u.costs[lv], () => { meta.up[id]++; }));
    b.disabled = lv >= max || meta.gold < u.costs[lv];
    row.append(main, b);
    list.append(row);
  }
  list.append(el('h3', null, '들판에 새 유물 추가'));
  for (const [id, r] of Object.entries(RELICS).filter(([, r]) => r.locked)) {
    const row = el('div', 'row'), main = el('div', 'row-main');
    main.append(el('span', 'row-name', r.name), el('span', 'row-sub', `Lv1: ${r.desc(1)}`));
    const have = meta.relicUnlock[id];
    const b = button('btn gold', have ? '추가됨' : `${r.cost}G`, () => buy(r.cost, () => { meta.relicUnlock[id] = true; }));
    b.disabled = have || meta.gold < r.cost;
    row.append(icon(id, 32), main, b);
    list.append(row);
  }
  box.append(list);
}

// ---------- 수다쟁이 이웃: the last run, who might move in next, and the discovery book ----------
function rumor(box, { meta }) {
  const talk = el('div', 'gossip');
  for (const line of gossip(meta.lastRun, meta)) talk.append(el('p', 'say', line));
  // a hint about whoever is still to come (one at a time, in street order)
  const next = HOUSES.map(h => FOLK[h.id]).find(f => f.hint && !f.when(meta));
  if (next) talk.append(el('p', 'say hint', next.hint));
  box.append(talk);
  const book = el('div', 'shop');
  const n = DISCOVERIES.filter(d => meta.found[d.id]).length;
  book.append(el('h3', null, `발견 도감 (${n}/${DISCOVERIES.length})`));
  for (const d of DISCOVERIES) {
    const got = meta.found[d.id];
    const row = el('div', 'row' + (got ? '' : ' unknown')), main = el('div', 'row-main');
    main.append(el('span', 'row-name', got || d.basic ? d.combo : '???'),
      el('span', 'row-sub', got ? d.result : d.basic ? '해 보면 알 수 있다' : `소문: "${d.hint}"`));
    row.append(main);
    book.append(row);
  }
  box.append(book);
}

// ---------- 두더지 대장장이: the recipe book and the ore book ----------
function books(box, { meta }) {
  // every recipe, found ones in full, the rest as a shadow of what they make
  const book = el('div', 'shop');
  const found = RECIPES.filter(rc => meta.recipes[recipeKey(rc)]).length;
  book.append(el('h3', null, `합성 도감 (${found}/${RECIPES.length})`));
  for (const [tier, label] of [[1, '진화'], [2, '전설'], [3, '신화']]) {
    book.append(el('div', 'book-tier t' + tier, label));
    const grid = el('div', 'recipe-book');
    for (const rc of RECIPES.filter(rc => tierOf(rc.id) === tier)) {
      const got = meta.recipes[recipeKey(rc)];
      const cell = el('div', 'recipe-cell' + (got ? '' : ' unknown') + ' t' + tier);
      const pic = (id, hide) => { const c = icon(id); if (hide) c.classList.add('shadow'); return c; };
      const line = el('div', 'rc-line');
      if (got) line.append(pic(rc.a), el('span', 'rc-op', '+'), pic(rc.b), el('span', 'rc-op', '→'), pic(rc.id));
      else line.append(el('b', null, '?'), el('span', 'rc-op', '+'), el('b', null, '?'), el('span', 'rc-op', '→'), pic(rc.id, true));
      cell.append(line, el('span', 'rc-name', got ? RELICS[rc.id].name : `처음 만들면 +${DISCOVERY_GOLD[tier]}G`));
      cell.title = got ? `${RELICS[rc.a].name} + ${RELICS[rc.b].name} → ${RELICS[rc.id].name}: ${RELICS[rc.id].desc(1)}` : '아직 아무도 모르는 조합';
      grid.append(cell);
    }
    book.append(grid);
  }
  box.append(book);
  // every grade of sparkle stone you have seen, and how many you broke open
  const ores = el('div', 'shop');
  ores.append(el('h3', null, `반짝돌 도감 (${ORES.filter(o => o.id in meta.ores).length}/${ORES.length})`));
  const row = el('div', 'ore-book');
  for (const o of ORES) {
    const seen = o.id in meta.ores;
    const cell = el('div', 'ore-cell' + (seen ? '' : ' unknown'));
    const pic = icon(`t_ore_${o.id}`);
    if (!seen) pic.classList.add('shadow');
    cell.append(pic, el('b', null, seen ? o.name : '???'), el('span', null, seen ? `${meta.ores[o.id] ? `${meta.ores[o.id]}번 캠` : '아직 못 캠'} · 골드 ×${o.mult}` : o.gem ? '보석' : ''));
    row.append(cell);
  }
  ores.append(row);
  box.append(ores);
}

// ---------- 구조대원: the records ----------
function records(box, { meta }) {
  const st = meta.stats, g = el('div', 'stats');
  for (const [v, l] of [[st.runs, '도전 횟수'], [st.runs - st.wins, '구조된 횟수'], [st.wins, '정복 횟수'], [`${st.maxFloor || 0}구역`, '최고 도달 구역'],
    [st.kills, '쓰러뜨린 적'], [st.evos, '유물 진화'], [st.bosses.length, '쓰러뜨린 보스 종류'], [st.bestGold, '한 판 최고 골드']]) {
    const s = el('div', 'stat');
    s.append(el('b', null, String(v)), el('span', null, l));
    g.append(s);
  }
  box.append(g);
}

// ---------- 라이벌: always one zone ahead of you, until you clear the fields ----------
function rival(box, { meta }) {
  const mine = meta.stats.maxFloor || 0, won = meta.stats.wins > 0;
  const theirs = won ? LAST_FLOOR : Math.min(LAST_FLOOR, mine + 1);
  box.append(el('p', 'say', won
    ? '들판을 정복했다고? 흥... 나, 나도 거의 다 왔거든.'
    : `나는 벌써 ${theirs}구역까지 가 봤다. 너는 ${mine}구역이지? 흥.`));
  const race = el('div', 'race');
  for (const [who, v, cls] of [['나', mine, 'me'], ['라이벌', won ? LAST_FLOOR - 1 : theirs, 'them']]) {
    const row = el('div', 'race-row ' + cls), bar = el('div', 'bar'), fill = el('i');
    fill.style.width = `${(v / LAST_FLOOR) * 100}%`;
    bar.append(fill);
    row.append(el('span', null, who), bar, el('b', null, `${v}구역`));
    race.append(row);
  }
  box.append(race);
}

const PANELS = { chars, shop, rumor, books, records, rival };
