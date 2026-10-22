// The town between runs: pick a character, buy upgrades, see records.

import { $, el, button, icon } from './dom.js';
import { CHARACTERS } from '../data/characters.js';
import { UPGRADES } from '../data/upgrades.js';
import { RELICS, LEGENDS, evolutionOf } from '../data/relics.js';
import { freshMeta, saveMeta } from '../core/save.js';
import { josa } from '../core/util.js';
import { DISCOVERIES } from '../data/terrain.js';
import { ORES } from '../data/ores.js';

const TOUCH = window.matchMedia?.('(pointer: coarse)').matches;

let tab = 'chars';

export function renderHub(ctx) {
  const { meta, onStart, setMeta } = ctx;
  const rerender = () => renderHub(ctx);
  const buy = (cost, apply) => { meta.gold -= cost; apply(); saveMeta(meta); rerender(); };

  const h = $('hub');
  h.innerHTML = '';
  const inner = el('div', 'hub-inner');

  const head = el('div', 'hub-head');
  head.append(el('div', 'logo', '픽셀 던전 크롤러<small>v0.9 · 9층 · 보스 3마리 · 녹픽던식 방 배치 · 풀과 함정</small>'));
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
    inner.append(el('div', 'howto',
      (TOUCH
        ? '<b>이동</b> 가고 싶은 칸을 톡 (대각선도 된다) · <b>공격</b> 적을 톡 · <b>쉬기</b> 나를 톡 · ' +
          '<b>설명</b> 아무 칸이나 꾹 누르기 · <b>둘러보기</b> 끌어서 옮기고 두 손가락으로 확대 · 유물과 소모품은 <b>가방</b>에 있다.<br>'
        : '<b>이동</b> 방향키·WASD (두 개를 같이 누르면 대각선) 또는 가고 싶은 칸을 클릭 · <b>공격</b> 적에게 부딪히거나 적을 클릭 · ' +
          '<b>쉬기</b> 스페이스 · <b>폭탄</b> 2를 누르고 던질 곳 고르기 · 마우스를 올리면 무엇이든 한 줄 설명이 나온다. 휠로 확대, 끌어서 둘러보기.<br>') +
      '층마다 <b>큰 광석</b>이 하나 있다. 칠수록 골드가 커지고, 가끔 속에서 더 좋은 광석(동, 은, 금, 다이아몬드, 그 위로 보석)이 나오거나 <b>노다지</b>가 터진다. 대신 소리가 커져서 적이 몰려온다. ' +
      '<b>올라가는 계단</b>으로 지난 층에 돌아가 남은 것을 챙길 수 있다. 쫓아오는 적은 내 발자국을 그대로 밟는다. ' +
      '<b>키 큰 풀</b>은 앞을 가리지만 누가 밟으면 쓰러진다. 바닥의 <b>함정</b>은 밟으면 터지고, 숨은 함정은 옆에 서 있으면 찾아낸다. ' +
      '잠들면 코를 골아서 적이 몰려온다. <b>광석 거북</b>은 먼저 싸우지 않지만, 쓰러뜨리면 보물을 준다. ' +
      '나를 눈치채지 못한 적(자거나 어슬렁거리는 적)을 치면 <b>기습</b>으로 피해가 두 배다. ' +
      '적 코에 <b>콧방울</b>이 있으면 자는 중이다. 내 칸에 <b style="color:var(--danger)">빨간 발톱 자국</b>이 보이면 다음 턴에 맞는다.'));
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
    inner.append(button('btn primary enter', `${josa(CHARACTERS[meta.sel].name, '으로', '로')} 던전 입장`, onStart));
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
    shop.append(el('h3', null, '던전에 새 유물 추가'));
    for (const [id, r] of Object.entries(RELICS).filter(([, r]) => r.locked)) {
      const row = el('div', 'row'), main = el('div', 'row-main');
      const ev = evolutionOf(id);
      main.append(el('span', 'row-name', r.name),
        el('span', 'row-sub', `Lv1: ${r.desc(1)}${ev ? ` · 진화: ${RELICS[ev.a].name} + ${RELICS[ev.b].name} → ${RELICS[ev.id].name}` : ''}`));
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
    for (const [v, l] of [[st.runs, '도전 횟수'], [st.wins, '정복 횟수'], [`${st.maxFloor || 0}층`, '최고 도달 층'], [st.kills, '쓰러뜨린 적'],
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
    const legends = el('div', 'shop');
    legends.append(el('h3', null, `전설 유물 (${LEGENDS.filter(l => meta.legends[l.id]).length}/${LEGENDS.length})`));
    for (const l of LEGENDS) {
      const got = meta.legends[l.id];
      const row = el('div', 'row' + (got ? '' : ' unknown')), main = el('div', 'row-main');
      main.append(el('span', 'row-name', got ? `${RELICS[l.a].name} + ${RELICS[l.b].name} → ${RELICS[l.id].name}` : '???'),
        el('span', 'row-sub', got ? RELICS[l.id].desc() : `소문: "${l.hint}"`));
      row.append(main);
      legends.append(row);
    }
    inner.append(legends);
    // the ore book: every grade you have seen, and how many you broke open
    const ores = el('div', 'shop');
    ores.append(el('h3', null, `광석 도감 (${ORES.filter(o => o.id in meta.ores).length}/${ORES.length})`));
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
