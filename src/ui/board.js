// The guild's notice board (조합 의뢰, v0.29): after the stage is picked, five requests pinned up for the
// trip and up to three of them taken along (data/requests.js). Three come ticked; a tap takes one off or
// puts one on. What is ticked stays in meta.board, so going back and looking again shows the same board.

import { el, button } from './dom.js';
import { openSheet, closeModal } from './modal.js';
import { boardFor, MAX_TAKEN } from '../data/requests.js';

export function showBoard({ meta, onGo, onBack }) {
  const b = boardFor(meta, meta.stage || 0, meta.loop || 1);
  const draw = sh => {
    sh.innerHTML = '';
    const taken = new Set(b.taken);
    sh.append(el('h2', null, `조합 의뢰 ${taken.size}/${MAX_TAKEN}`));
    const list = el('div', 'board');
    b.offers.forEach((q, i) => {
      const on = taken.has(i), full = !on && taken.size >= MAX_TAKEN;
      const note = button('note' + (on ? ' on' : '') + (full ? ' full' : ''), null, () => {
        if (on) b.taken = b.taken.filter(k => k !== i);
        else if (!full) b.taken = [...b.taken, i];
        draw(sh);
      });
      note.append(el('span', 'note-pin'), el('b', null, q.text), el('span', 'note-pay', `일당 ${q.pay}G`));
      if (on) note.append(el('span', 'note-tag', '받음'));
      note.setAttribute('aria-pressed', String(on));
      list.append(note);
    });
    sh.append(list);
    const go = button('btn primary board-go', taken.size ? `의뢰 ${taken.size}개 받고 출발` : '의뢰 없이 출발', () => { closeModal(); onGo(); });
    sh.append(go);
  };
  openSheet(draw, () => { closeModal(); onBack?.(); });
}
