// 출발 준비 (v0.32): after the stage is picked, one sheet for everything about this trip: the weather
// there today (data/weather.js), the basic relics to pack (up to three, a level a tap, each level dearer
// than the last: data/upgrades.js PACK_PRICES), the smith's order (the same as at his anvil) and the
// guild's requests (until v0.32 a notice board of their own). Gold always has somewhere to go right
// before setting off, and the trip is planned in one place. Skipped while none of it is open yet.

import { el, button, icon, weatherPic } from './dom.js';
import { openSheet, closeModal } from './modal.js';
import { ZONES } from '../data/enemies.js';
import { CHARACTERS } from '../data/characters.js';
import { RELICS, MAX_LEVEL, MAX_SLOTS, tierOf } from '../data/relics.js';
import { isOpen, RELIC_GATES } from '../data/unlocks.js';
import { stocked } from '../data/shop.js';
import { PACK_MAX, PACK_PRICES, packLevels, packCost, FORGE_COST, forgeStock } from '../data/upgrades.js';
import { boardFor, MAX_TAKEN } from '../data/requests.js';
import { WEATHER, WEATHER_FROM, weatherFor } from '../data/weather.js';
import { daresOn } from '../data/dares.js';
import { DARE_SLOTS } from '../data/balance.js';
import { josa } from '../core/util.js';

const canPack = meta => stocked(meta, 'svc:pack') && isOpen(meta, 'shelf');
const canForge = meta => isOpen(meta, 'smith') && forgeStock(meta).length > 0;
// the basic relics that can turn up in the fields so far
const packable = meta => Object.keys(RELICS).filter(id => !tierOf(id) && (RELICS[id].locked ? meta.relicUnlock[id] : !RELIC_GATES[id] || isOpen(meta, RELIC_GATES[id])));

// is there anything to get ready yet (otherwise the trip just goes)
export const needsPrep = meta => meta.stats.runs >= WEATHER_FROM || isOpen(meta, 'request') || canPack(meta) || canForge(meta);

export function showPrep({ meta, onGo, onBack }) {
  const stage = meta.stage || 0, loop = meta.loop || 1, z = ZONES[stage];
  const board = isOpen(meta, 'request') ? boardFor(meta, stage, loop) : null;
  meta.packs ||= {};
  let focus = null;   // the relic last tapped: what it does is written under the grid (a phone has no hover)
  const draw = sh => {
    const y = sh.scrollTop;
    sh.innerHTML = '';
    sh.classList.add('prep');
    sh.append(el('h2', null, `출발 준비`));
    sh.append(el('p', 'prep-where', `${stage + 1}. ${z.name}${loop > 1 ? ` · ${loop}회차` : ''} · ${josa(CHARACTERS[meta.sel].name, '으로', '로')} 간다 · 가진 골드 ${meta.gold}G`));

    // today's weather there
    const w = weatherFor(meta, stage, loop);
    if (w || meta.stats.runs >= WEATHER_FROM) {
      const box = el('div', 'prep-weather' + (w ? ` w-${w}` : ' plain')), txt = el('div', 'pw-text');
      if (w) box.append(weatherPic(w, 32));
      txt.append(el('b', null, w ? `오늘은 ${WEATHER[w].name}` : '오늘은 평범한 날'), el('span', null, w ? WEATHER[w].rule : '들판이 여느 때와 같다. 다른 스테이지의 날씨는 고르는 화면에 나온다.'));
      box.append(txt);
      sh.append(box);
    }

    // the relics to pack: a tap is a level more (a grown one tapped again goes back, money back)
    if (canPack(meta)) {
      const packs = meta.packs, n = packLevels(packs), next = PACK_PRICES[n];
      const start = CHARACTERS[meta.sel].start || {};
      const slots = MAX_SLOTS - (daresOn(meta).includes('light') ? DARE_SLOTS : 0);
      const room = slots - Object.keys(start).length - (meta.forge ? 1 : 0);
      const kinds = Object.keys(packs).length, newKinds = Object.keys(packs).filter(id => !start[id]).length;
      const sec = el('div', 'prep-sec');
      sec.append(el('h3', null, `챙겨 갈 유물 ${kinds}/${PACK_MAX}`));
      sec.append(el('p', 'row-sub', next
        ? `누를 때마다 한 레벨씩 오른다. 다음 한 레벨 ${next}G. 다 오른 걸 또 누르면 내려놓고 돌려받는다.`
        : '더는 못 챙긴다. 다 오른 걸 누르면 내려놓고 돌려받는다.'));
      const grid = el('div', 'pack-grid');
      for (const id of packable(meta)) {
        const lv = packs[id] || 0, cap = MAX_LEVEL - (start[id] || 0);
        if (cap <= 0) continue;
        const full = lv >= cap, isNew = !lv && !start[id];
        const blocked = !lv && (kinds >= PACK_MAX || (isNew && newKinds >= room));
        const b = button(`pack${lv ? ' on' : ''}`, null, () => {
          focus = id;
          if (full) { meta.gold += packCost(n) - packCost(n - lv); delete packs[id]; }
          else if (next && meta.gold >= next && !blocked) { meta.gold -= next; packs[id] = lv + 1; }
          draw(sh);
        });
        b.append(icon(id, 32), el('span', null, RELICS[id].name), el('span', 'forge-price', lv ? `Lv${(start[id] || 0) + lv}` : start[id] ? `가진 것 Lv${start[id]}` : ''));
        b.title = RELICS[id].desc(Math.max(1, (start[id] || 0) + lv));
        b.disabled = !full && (blocked || !next || meta.gold < next);
        grid.append(b);
      }
      sec.append(grid);
      if (focus && RELICS[focus]) {
        const lv = Math.max(1, (start[focus] || 0) + (packs[focus] || 0));
        sec.append(el('p', 'row-sub prep-desc', `${RELICS[focus].name} Lv${lv}: ${RELICS[focus].desc(lv)}`));
      }
      if (n) {
        const foot = el('div', 'prep-foot');
        foot.append(el('span', 'row-sub', `챙긴 값 ${packCost(n)}G`), button('btn', '다 내려놓기', () => {
          meta.gold += packCost(n);
          meta.packs = {};
          focus = null;
          draw(sh);
        }));
        sec.append(foot);
      }
      sh.append(sec);
    }

    // the smith's order, as at his anvil: an evolved relic (from the second 회차, a legend) at Lv1
    if (canForge(meta)) {
      const sec = el('div', 'prep-sec'), cost = id => FORGE_COST[tierOf(id)];
      sec.append(el('h3', null, '대장장이 주문'));
      sec.append(el('p', 'row-sub', '만들어 본 진화 유물을 Lv1로 만들어 준다. 한 판에 하나. 다시 누르면 취소하고 돌려받는다.'));
      const grid = el('div', 'pack-grid forge-grid');
      for (const id of forgeStock(meta)) {
        const on = meta.forge === id, back = meta.forge ? cost(meta.forge) : 0;
        const b = button(`pack t${tierOf(id)}${on ? ' on' : ''}`, null, () => {
          meta.gold += back;
          meta.forge = on ? null : id;
          if (!on) meta.gold -= cost(id);
          focus = null;
          draw(sh);
        });
        b.append(icon(id, 32), el('span', null, RELICS[id].name), el('span', 'forge-price', on ? '주문함' : `${cost(id)}G`));
        b.title = RELICS[id].desc(1);
        b.disabled = !on && meta.gold + back < cost(id);
        grid.append(b);
      }
      sec.append(grid);
      if (meta.forge) sec.append(el('p', 'row-sub prep-desc', `${RELICS[meta.forge].name}: ${RELICS[meta.forge].desc(1)}`));
      sh.append(sec);
    }

    // the guild's requests: three come ticked, a tap takes one off or puts one on
    if (board) {
      const taken = new Set(board.taken), sec = el('div', 'prep-sec');
      sec.append(el('h3', null, `조합 의뢰 ${taken.size}/${MAX_TAKEN}`));
      const list = el('div', 'board');
      board.offers.forEach((q, i) => {
        const on = taken.has(i), full = !on && taken.size >= MAX_TAKEN;
        const note = button('note' + (on ? ' on' : '') + (full ? ' full' : ''), null, () => {
          if (on) board.taken = board.taken.filter(k => k !== i);
          else if (!full) board.taken = [...board.taken, i];
          draw(sh);
        });
        note.append(el('span', 'note-pin'), el('b', null, q.text), el('span', 'note-pay', `일당 ${q.pay}G`));
        if (on) note.append(el('span', 'note-tag', '받음'));
        note.setAttribute('aria-pressed', String(on));
        list.append(note);
      });
      sec.append(list);
      sh.append(sec);
    }

    sh.append(button('btn primary board-go', '출발!', () => { closeModal(); onGo(); }));
    sh.scrollTop = y;
  };
  openSheet(draw, () => { closeModal(); onBack?.(); });
}
