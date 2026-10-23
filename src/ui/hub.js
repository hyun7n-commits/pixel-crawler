// What each villager looks after, drawn as the body of their talk sheet (see FOLK[...].panel in
// data/village.js): the guild picks heroes, the shop sells upgrades, the neighbour gossips, the smith
// keeps the recipe and ore books, the rescuer keeps the records and the critter book, the rival brags.
// ctx: { meta, onStart, changed, setMeta }. `changed` saves, redraws the sheet and updates the village.

import { $, el, button, icon } from './dom.js';
import { CHARACTERS } from '../data/characters.js';
import { UPGRADES, PACK_COST, FORGE_COST, FORGE_LEGEND_LOOP, forgeable } from '../data/upgrades.js';
import { PETS } from '../data/pets.js';
import { isOpen, RELIC_GATES } from '../data/unlocks.js';
import { RELICS, RECIPES, recipeKey, tierOf, DISCOVERY_GOLD } from '../data/relics.js';
import { freshMeta, saveMeta } from '../core/save.js';
import { josa } from '../core/util.js';
import { DISCOVERIES } from '../data/terrain.js';
import { ORES } from '../data/ores.js';
import { LORE, LORE_AFTER } from '../data/lore.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { FOLK, HOUSES, gossip } from '../data/village.js';
import { BOOK_GIFT_EVERY, bookGift, bookGiftsDue } from '../data/balance.js';
import { FRIENDS, friendSpot, cleared, loopsOpen } from '../data/stages.js';
import { DARES, daresOpen, daresOn, dareGold, DARE_GOLD } from '../data/dares.js';
import { DECOR, hasDecor } from '../data/home.js';
import { decorCanvas } from '../scenes/home-art.js';
import { savedRun } from '../core/suspend.js';

export function renderPanel(id, box, ctx) {
  PANELS[id](box, ctx);
}

// The bits of the village screen that are not the map: the purse, sound, and the way out.
// `saved`: a trip saved halfway (core/suspend.js savedRun), which the button picks up instead
export function renderVillageHud(meta, saved = savedRun()) {
  const purse = $('vPurse');
  purse.innerHTML = '';
  purse.append(icon('gold', 16), el('span', null, `${meta.gold}G`));
  $('vGo').textContent = saved ? `이어서 탐험 · ${saved.label}` : `${josa(CHARACTERS[meta.sel].name, '으로', '로')} 들판에 출발`;
}

const startButton = (meta, onStart) => {
  const saved = savedRun();
  const b = button('btn primary enter', saved ? `이어서 탐험 · ${saved.label}` : `${josa(CHARACTERS[meta.sel].name, '으로', '로')} 들판으로 출발`, onStart);
  if (!meta.pack && !meta.forge) return b;
  // what you packed at the shop, and what the smith made to order, go out with you
  const wrap = el('div', 'go-wrap'), note = el('span', 'packed-note');
  for (const id of [meta.forge, meta.pack].filter(Boolean)) note.append(icon(id, 16), el('span', null, `${RELICS[id].name} 챙김`));
  wrap.append(note, b);
  return wrap;
};

// the ten 탐험 licenses (one per stage), greyed out until earned; see scenes/storyboards.js
const LICENSE_COLORS = ['#6fbf4e', '#2f7a46', '#5fb3a1', '#4f8db0', '#a39a86', '#e08aa8', '#b8c8dc', '#8a7aa8', '#d0603a', '#7a6a62'];
function licenses(meta) {
  const row = el('div', 'licenses');
  row.append(el('span', 'lic-title', '탐험 자격증'));
  for (const [s, z] of ZONES.entries()) {
    const got = cleared(meta, s) > 0, name = z.name, color = LICENSE_COLORS[s];
    const b = el('span', 'lic' + (got ? ' got' : ''), `<i style="--c:${color}">★</i>${name}`);
    b.title = got ? `${name} 탐험 자격증` : `${name} 끝의 대장을 잡으면 받는다`;
    row.append(b);
  }
  return row;
}

// ---------- 조합장: heroes ----------
// The worker and the friends in the order they are found (data/stages.js); a friend not rescued yet
// is a dark shape with nothing about them but where they are said to be locked up.
function chars(box, { meta, onStart, changed, setMeta, onStory }) {
  box.append(licenses(meta));
  const grid = el('div', 'chars');
  const order = ['adv', ...[0, 1, 2, 3].flatMap(l => FRIENDS.map(row => row[l]))].filter(id => CHARACTERS[id]);
  for (const id of order) {
    const c = CHARACTERS[id], owned = meta.chars[id];
    if (!owned) {
      const spot = friendSpot(id), card = el('div', 'char locked');
      const top = el('div', 'char-top'), sp = icon(c.sprite, 48);
      sp.classList.add('char-spr');
      top.append(sp, el('span', 'char-name', '???'));
      card.append(top, el('div', 'cond', isOpen(meta, 'cage') ? `${ZONES[spot.stage].name} ${spot.loop}회차 어딘가에 갇혀 있다` : '아직 아무도 본 적이 없다'));
      grid.append(card);
      continue;
    }
    const cls = 'char' + (meta.sel === id ? ' sel' : '') + (owned ? '' : ' locked');
    const card = owned ? button(cls, null, () => { meta.sel = id; changed(); }) : el('div', cls);
    const top = el('div', 'char-top');
    const sp = icon(c.sprite, 48);
    sp.classList.add('char-spr');
    top.append(sp, el('span', 'char-name', `${c.name}${c.kind ? `<small>${c.kind}</small>` : ''}`));
    card.append(top);
    const startRelic = Object.entries(c.start).map(([r, l]) => `${RELICS[r].name} Lv${l}`).join(', ');
    card.append(el('div', 'char-stats', `체력 ${c.hp} · 공격 ${c.atk}${c.def ? ` · 방어 ${c.def}` : ''}<br>시작 유물: ${startRelic}<br>${c.note}`));
    grid.append(card);
  }
  box.append(grid, startButton(meta, onStart));
  let armed = 0;
  const reset = button('btn quiet', '처음부터 다시 하기', () => {
    if (Date.now() - armed < 3000) { const m = freshMeta(); saveMeta(m); setMeta(m); return; }
    armed = Date.now();
    reset.textContent = '한 번 더 누르면 모든 진행이 지워진다';
  });
  box.append(button('btn quiet', '처음 이야기 다시 보기', onStory), reset);
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
  pets(list, meta, buy, changed);
  // the relic shelf and packing a relic come once the meadow's boss has fallen (data/unlocks.js)
  if (!isOpen(meta, 'shelf')) { box.append(list); return; }
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
  // one basic relic to take on the next run: paid each time, swap or put back for free
  list.append(el('h3', null, '다음 판에 챙겨 갈 유물'));
  list.append(el('p', 'row-sub', `${PACK_COST}G를 내면 기본 유물 하나를 Lv1로 들고 나간다(이미 있으면 +1). 한 판만. 궁금한 조합을 시험해 보기 좋다.`));
  const grid = el('div', 'pack-grid');
  const pick = Object.keys(RELICS).filter(id => !tierOf(id) && (RELICS[id].locked ? meta.relicUnlock[id] : !RELIC_GATES[id] || isOpen(meta, RELIC_GATES[id])));
  for (const id of pick) {
    const on = meta.pack === id;
    const b = button(`pack${on ? ' on' : ''}`, null, () => {
      if (on) { meta.gold += PACK_COST; meta.pack = null; }        // put it back: money back
      else if (meta.pack) meta.pack = id;                            // swap: already paid
      else { meta.gold -= PACK_COST; meta.pack = id; }
      changed();
    });
    b.append(icon(id, 32), el('span', null, RELICS[id].name));
    b.title = RELICS[id].desc(1);
    b.disabled = !meta.pack && meta.gold < PACK_COST;
    grid.append(b);
  }
  list.append(grid);
  if (meta.pack) list.append(el('p', 'row-sub', `${RELICS[meta.pack].name} 챙김. 다시 누르면 내려놓고 골드를 돌려받는다.`));
  box.append(list);
}

// 펫 (data/pets.js): buy one, then pick which one comes along (tap again to leave it home)
function pets(list, meta, buy, changed) {
  list.append(el('h3', null, '펫'));
  list.append(el('p', 'row-sub', '데려가면 뒤를 졸졸 따라다니며 조금씩 돕는다. 적은 펫을 건드리지 않는다. 한 번에 한 마리.'));
  for (const [id, pt] of Object.entries(PETS)) {
    const have = meta.pets?.[id], on = meta.pet === id;
    const row = el('div', 'row' + (on ? ' owned' : '')), main = el('div', 'row-main');
    main.append(el('span', 'row-name', `${pt.name}<small>${pt.kind}</small>`), el('span', 'row-sub', pt.note));
    const b = have
      ? button('btn' + (on ? ' primary' : ''), on ? '데려감' : '데려가기', () => { meta.pet = on ? null : id; changed(); })
      : button('btn gold', `${pt.cost}G`, () => buy(pt.cost, () => { meta.pets = { ...meta.pets, [id]: true }; meta.pet = id; }));
    if (!have) b.disabled = meta.gold < pt.cost;
    row.append(icon(pt.sprite, 32), main, b);
    list.append(row);
  }
}

// ---------- 내 집: 집 꾸미기 (data/home.js) ----------
// ctx.onDecor(id) runs after a piece is bought, so the village can show it going up
function home(box, { meta, changed, onDecor }) {
  const list = el('div', 'shop');
  const n = DECOR.filter(d => hasDecor(meta, d.id)).length;
  list.append(el('h3', null, `집 꾸미기 (${n}/${DECOR.length})`));
  for (const d of DECOR) {
    const have = hasDecor(meta, d.id);
    const row = el('div', 'row' + (have ? ' owned' : '')), main = el('div', 'row-main');
    main.append(el('span', 'row-name', d.name), el('span', 'row-sub', d.desc));
    const b = button('btn gold', have ? '놓았다' : `${d.cost}G`, () => {
      meta.gold -= d.cost;
      meta.home = [...(meta.home || []), d.id];
      changed();
      onDecor?.(d.id);
    });
    b.disabled = have || meta.gold < d.cost;
    const pic = decorCanvas(d.id), k = Math.min(44 / pic.width, 36 / pic.height);
    pic.className = 'pix decor-ic';
    pic.style.width = `${Math.round(pic.width * k)}px`;
    pic.style.height = `${Math.round(pic.height * k)}px`;
    const frame = el('span', 'decor-frame');
    frame.append(pic);
    row.append(frame, main, b);
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

// ---------- 두더지 대장장이: made to order, the recipe book and the ore book ----------
function books(box, { meta, changed }) {
  forge(box, meta, changed);
  // every recipe, found ones in full, the rest as a shadow of what they make
  const book = el('div', 'shop');
  const found = RECIPES.filter(rc => meta.recipes[recipeKey(rc)]).length;
  book.append(el('h3', null, `합성 도감 (${found}/${RECIPES.length})`));
  // a gift from the smith for every ten recipes in the book
  const claimed = meta.bookGifts || 0, due = bookGiftsDue(found, claimed);
  if (claimed * BOOK_GIFT_EVERY < RECIPES.length) {
    const row = el('div', 'row book-gift' + (due > 0 ? ' ready' : '')), main = el('div', 'row-main');
    const next = (claimed + 1) * BOOK_GIFT_EVERY, bar = el('div', 'bar'), fill = el('i');
    fill.style.width = `${Math.min(100, 100 * (found - claimed * BOOK_GIFT_EVERY) / BOOK_GIFT_EVERY)}%`;
    bar.append(fill);
    main.append(el('span', 'row-name', due > 0 ? '도감 선물이 왔다!' : `도감 ${next}칸을 채우면 선물`),
      el('span', 'row-sub', due > 0 ? `조합 ${next}개를 찾아냈다. 대장장이가 골드를 내민다.` : `${next - found}개 더 찾으면 대장장이가 ${bookGift(claimed + 1)}G를 준다.`), bar);
    const b = button('btn gold', `${bookGift(claimed + 1)}G 받기`, () => { meta.gold += bookGift(claimed + 1); meta.bookGifts = claimed + 1; changed(); });
    b.disabled = due <= 0;
    row.append(main, b);
    book.append(row);
  }
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

// 주문 제작: an evolved relic you have made before (from the second 회차 a legend too), forged for the
// next run. Paid now; tap it again to call it off and get the gold back, or tap another to swap.
function forge(box, meta, changed) {
  const list = el('div', 'shop'), ids = forgeable(meta), cost = id => FORGE_COST[tierOf(id)];
  list.append(el('h3', null, '주문 제작'));
  list.append(el('p', 'row-sub', ids.length
    ? `찾아낸 조합의 진화 유물을 만들어 준다. 다음 판에 Lv1로 들고 나간다. 한 판에 하나.${loopsOpen(meta) >= FORGE_LEGEND_LOOP ? ' 전설도 만들 수 있다.' : ` ${FORGE_LEGEND_LOOP}회차가 열리면 전설도 만들어 준다.`}`
    : '아직 만들 줄 아는 게 없다. 들판에서 유물을 진화시켜 조합을 찾아 오자.'));
  const grid = el('div', 'pack-grid forge-grid');
  for (const id of ids) {
    const on = meta.forge === id, back = meta.forge ? cost(meta.forge) : 0;
    const b = button(`pack t${tierOf(id)}${on ? ' on' : ''}`, null, () => {
      meta.gold += back;                       // the one ordered before is called off (money back)
      meta.forge = on ? null : id;
      if (!on) meta.gold -= cost(id);
      changed();
    });
    b.append(icon(id, 32), el('span', null, RELICS[id].name), el('span', 'forge-price', on ? '주문함' : `${cost(id)}G`));
    b.title = RELICS[id].desc(1);
    b.disabled = !on && meta.gold + back < cost(id);
    grid.append(b);
  }
  if (ids.length) list.append(grid);
  if (meta.forge) list.append(el('p', 'row-sub', `${josa(RELICS[meta.forge].name, '을', '를')} 주문했다. 다시 누르면 취소하고 골드를 돌려받는다.`));
  box.append(list);
}

// ---------- 구조대원: the records ----------
function records(box, { meta }) {
  const st = meta.stats, g = el('div', 'stats');
  const friends = FRIENDS.flat().filter(id => meta.chars[id]).length;
  for (const [v, l] of [[st.runs, '도전 횟수'], [st.runs - st.wins, '구조된 횟수'], [st.wins, '스테이지 돌파'], [`${loopsOpen(meta)}회차`, '열린 회차'], [`${friends}/${FRIENDS.flat().length}`, '구한 친구'],
    [st.kills, '쓰러뜨린 적'], [st.evos, '유물 진화'], [st.bosses.length, '쓰러뜨린 보스 종류'], [st.bestGold, '한 판 최고 골드']]) {
    const s = el('div', 'stat');
    s.append(el('b', null, String(v)), el('span', null, l));
    g.append(s);
  }
  box.append(g);
  critterBook(box, meta);
}

// every kind of critter out in the fields: the ones you have met with their name and how many you
// knocked out, the rest as a shadow. Tap one you know to read what it does.
function critterBook(box, meta) {
  const kinds = Object.keys(ENEMIES).filter(t => !ENEMIES[t].npc), book = meta.critters || {};
  const wrap = el('div', 'shop');
  wrap.append(el('h3', null, `들판 친구 도감 (${kinds.filter(t => t in book).length}/${kinds.length})`));
  const grid = el('div', 'ore-book critter-book'), note = el('p', 'book-note', '만난 친구를 누르면 무엇을 하는지 볼 수 있다.');
  for (const t of kinds) {
    const d = ENEMIES[t], met = t in book;
    const cell = el('div', 'ore-cell' + (met ? '' : ' unknown') + (d.boss ? ' boss' : ''));
    const pic = el('span', 'crit-pic'), body = icon(d.sprite);
    pic.append(body);
    if (d.boss) pic.append(icon('crown'));
    if (!met) pic.querySelectorAll('canvas').forEach(c => c.classList.add('shadow'));
    cell.append(pic, el('b', null, met ? d.name : '???'), el('span', null, met ? (book[t] ? `${book[t]}번 쓰러뜨림` : '만나기만 함') : d.boss ? '보스' : ''));
    cell.onclick = () => {
      grid.querySelectorAll('.picked').forEach(c => c.classList.remove('picked'));
      cell.classList.add('picked');
      // after enough of them, a second line: something you have started to notice (data/lore.js)
      const lore = met && LORE[t] && (book[t] || 0) >= (d.boss ? 1 : LORE_AFTER);
      note.textContent = met ? `${d.name}: ${d.tip}` : '아직 만나지 못했다.';
      if (lore) note.append(el('span', 'lore', LORE[t]));
    };
    grid.append(cell);
  }
  wrap.append(grid, note);
  box.append(wrap);
}

// ---------- 라이벌: the dares (data/dares.js) ----------
// One card per dare open so far: what it does, a switch, and the furthest stage won with it on.
// Every dare taken adds DARE_GOLD to the gold of the trip.
function rival(box, { meta, changed }) {
  const open = daresOpen(meta), on = daresOn(meta);
  box.append(el('p', 'say', on.length
    ? `흥, 내기 ${on.length}개라고? 골드는 ×${dareGold(on.length).toFixed(1)}로 받겠네. 어디 해 봐.`
    : '나랑 내기할래? 하나 걸 때마다 골드를 더 받는다. 겁나면 말고.'));
  const list = el('div', 'shop dares');
  DARES.forEach((d, i) => {
    if (i >= open) return;
    const lit = !!meta.dares.on[d.id], won = meta.dares.won[d.id] || 0;
    const row = el('div', 'row dare' + (lit ? ' on' : '')), main = el('div', 'row-main');
    row.append(icon(d.icon, 32));
    main.append(el('span', 'row-name', `${d.name}${won ? ` <small>${ZONES[won - 1].name}까지 돌파</small>` : ''}`), el('span', 'row-sub', `${d.desc} · 골드 +${Math.round(DARE_GOLD * 100)}%`));
    row.append(main, button('btn' + (lit ? ' gold' : ''), lit ? '거는 중' : '걸기', () => { meta.dares.on[d.id] = !lit; changed(); }));
    list.append(row);
  });
  if (open < DARES.length) list.append(el('p', 'book-note', '대장을 더 쓰러뜨리면 라이벌이 새 내기를 걸어 온다.'));
  box.append(list);
}

const PANELS = { chars, shop, rumor, books, records, rival, home };
