// The evolution moment: the two relics slide in from both sides, bump together in a flash, and what
// they make pops out of it. A recipe found for the first time gets a "new" stamp and the book count.

import { $, el, icon } from './dom.js';
import { RELICS, RECIPES, fusedParts, relicName } from '../data/relics.js';
import { wait, evolveMs } from './beat.js';

const TIER = ['합체!', '진화!', '전설!', '신화!'];

export function showEvolve(d) {
  const ms = evolveMs(d);
  setTimeout(() => {
    const [a, b] = d.fused ? fusedParts(d.id) : [d.a, d.b];
    if (!a || !b) return;
    const box = el('div', `evocard t${d.fused ? 'f' : d.tier}`);
    box.style.setProperty('--ms', `${ms}ms`);
    const row = el('div', 'evo-row');
    const ia = el('span', 'evo-a'), ib = el('span', 'evo-b'), ir = el('span', 'evo-r'), flash = el('span', 'evo-flash');
    ia.append(icon(a)); ib.append(icon(b));
    if (d.fused) for (const p of fusedParts(d.id)) ir.append(icon(p));
    else ir.append(icon(d.id));
    row.append(el('span', 'evo-rays'), ia, ib, flash, ir);
    box.append(row, el('div', 'evo-name', `${TIER[d.fused ? 0 : d.tier]} ${d.fused ? relicName(d.id) : RELICS[d.id].name}`));
    if (d.first) {
      box.append(el('div', 'evo-new', `새 조합 · 도감 ${d.known}/${RECIPES.length}`));
    }
    $('stage').append(box);
    $('banner').classList.remove('show');
    setTimeout(() => box.remove(), ms + 200);
  }, wait(d, ms));
}
