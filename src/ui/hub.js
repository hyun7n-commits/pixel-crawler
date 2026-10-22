// The town between runs: pick a character, buy upgrades, see records.

import { $, el, button, icon } from './dom.js';
import { CHARACTERS } from '../data/characters.js';
import { UPGRADES } from '../data/upgrades.js';
import { RELICS, RECIPES, recipeKey, tierOf, DISCOVERY_GOLD } from '../data/relics.js';
import { freshMeta, saveMeta } from '../core/save.js';
import { josa } from '../core/util.js';
import { DISCOVERIES } from '../data/terrain.js';
import { ORES } from '../data/ores.js';


let tab = 'chars';

export function renderHub(ctx) {
  const { meta, onStart, setMeta } = ctx;
  const rerender = () => renderHub(ctx);
  const buy = (cost, apply) => { meta.gold -= cost; apply(); saveMeta(meta); rerender(); };

  const h = $('hub');
  h.innerHTML = '';
  const inner = el('div', 'hub-inner');

  const head = el('div', 'hub-head');
  head.append(el('div', 'logo', '픽셀 던전 크롤러<small>v0.16</small>'));
  const purse = el('div', 'purse');
  purse.append(icon('gold', 24), el('span', null, `${meta.gold}G`));
  head.append(purse);
  inner.append(head);

  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  for (const [id, label] of [['chars', '캐릭터'], ['shop', '상점'], ['records', '기록']]) {
    const t = button('tab', label, () => { tab = id; rerender(); });
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', String(tab === id));
    tabs.append(t);
  }
  inner.append(tabs);

  if (tab === 'chars') {
    const grid = el('div', 'chars');
    for (const [id, c] of Object.entries(CHARACTERS)) {
      const owned = meta.chars[id];
      const cls = 'char' + (meta.sel === id ? ' sel' : '') + (owned ? '' : ' locked');
      const card = owned ? button(cls, null, () => { meta.sel = id; saveMeta(meta); rerender(); }) : el('div', cls);
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
    inner.append(grid);
    inner.append(button('btn primary enter', `${josa(CHARACTERS[meta.sel].name, '으로', '로')} 들판으로 출발`, onStart));
  }

  if (tab === 'shop') {
    const shop = el('div', 'shop');
    shop.append(el('h3', null, '영구 강화'));
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
      shop.append(row);
    }
    shop.append(el('h3', null, '들판에 새 유물 추가'));
    for (const [id, r] of Object.entries(RELICS).filter(([, r]) => r.locked)) {
      const row = el('div', 'row'), main = el('div', 'row-main');
      main.append(el('span', 'row-name', r.name), el('span', 'row-sub', `Lv1: ${r.desc(1)}`));
      const have = meta.relicUnlock[id];
      const b = button('btn gold', have ? '추가됨' : `${r.cost}G`, () => buy(r.cost, () => { meta.relicUnlock[id] = true; }));
      b.disabled = have || meta.gold < r.cost;
      row.append(icon(id, 32), main, b);
      shop.append(row);
    }
    inner.append(shop);
  }

  if (tab === 'records') {
    const st = meta.stats, g = el('div', 'stats');
    for (const [v, l] of [[st.runs, '도전 횟수'], [st.wins, '정복 횟수'], [`${st.maxFloor || 0}구역`, '최고 도달 구역'], [st.kills, '쓰러뜨린 적'],
      [st.evos, '유물 진화'], [st.bosses.length, '쓰러뜨린 보스 종류'], [st.bestGold, '한 판 최고 골드']]) {
      const s = el('div', 'stat');
      s.append(el('b', null, String(v)), el('span', null, l));
      g.append(s);
    }
    inner.append(g);
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
    inner.append(book);
    // the recipe book: every recipe, found ones in full, the rest as a shadow of what they make
    const book2 = el('div', 'shop');
    const found = RECIPES.filter(rc => meta.recipes[recipeKey(rc)]).length;
    book2.append(el('h3', null, `합성 도감 (${found}/${RECIPES.length})`));
    for (const [tier, label] of [[1, '진화'], [2, '전설'], [3, '신화']]) {
      book2.append(el('div', 'book-tier t' + tier, label));
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
      book2.append(grid);
    }
    inner.append(book2);
    // the ore book: every grade you have seen, and how many you broke open
    const ores = el('div', 'shop');
    ores.append(el('h3', null, `반짝돌 도감 (${ORES.filter(o => o.id in meta.ores).length}/${ORES.length})`));
    const orow = el('div', 'ore-book');
    for (const o of ORES) {
      const seen = o.id in meta.ores;
      const cell = el('div', 'ore-cell' + (seen ? '' : ' unknown'));
      const pic = icon(`t_ore_${o.id}`);
      if (!seen) pic.classList.add('shadow');
      cell.append(pic, el('b', null, seen ? o.name : '???'), el('span', null, seen ? `${meta.ores[o.id] ? `${meta.ores[o.id]}번 캠` : '아직 못 캠'} · 골드 ×${o.mult}` : o.gem ? '보석' : ''));
      orow.append(cell);
    }
    ores.append(orow);
    inner.append(ores);
    let armed = 0;
    const reset = button('btn', '기록 초기화', () => {
      if (Date.now() - armed < 3000) { const m = freshMeta(); saveMeta(m); setMeta(m); return; }
      armed = Date.now();
      reset.textContent = '한 번 더 누르면 모든 진행이 지워진다';
    });
    reset.style.alignSelf = 'flex-start';
    inner.append(reset);
  }
  h.append(inner);
}
