// A combination shown as a picture instead of a rule: [relic + level pips] + [relic + pips] → [result].
// Full pips on both sides is all a player needs to read; no "both at Lv3" wording anywhere.

import { el, icon } from './dom.js';
import { RELICS, MAX_LEVEL, evolutionOf, legendOf } from '../data/relics.js';

// `grow` is a relic about to gain a level (on a choice card): its next pip blinks.
function part(run, id, grow) {
  const r = RELICS[id], lv = run.p.relics[id] || 0;
  const p = el('span', 'rc-part' + (lv ? ' have' : ''));
  p.title = r.name;
  p.append(icon(id));
  const pips = el('span', 'rc-pips');
  if (r.evo) pips.append(el('i', lv ? 'on star' : 'star'));
  else for (let i = 0; i < MAX_LEVEL; i++) pips.append(el('i', i < lv ? 'on' : i === lv && grow === id ? 'next' : ''));
  p.append(pips);
  return p;
}

function result(id, known) {
  const p = el('span', 'rc-part rc-result');
  if (known) { p.title = RELICS[id].name; p.append(icon(id)); } else p.append(el('b', null, '?'));
  return p;
}

// Evolution of a basic relic, or the legendary recipe of an evolved one.
export function recipeFor(run, id, grow) {
  const ev = evolutionOf(id), lg = !ev && legendOf(id);
  const rc = ev || lg;
  if (!rc) return null;
  const box = el('div', 'recipe' + (lg ? ' legend' : ''));
  const known = ev || run.meta.legends[lg.id];
  box.append(part(run, rc.a, grow), el('span', 'rc-op', '+'),
    known ? part(run, rc.b, grow) : result(rc.b, false),
    el('span', 'rc-op', '→'), result(rc.id, known));
  if (lg && !known) box.append(el('span', 'rc-hint', `소문: "${lg.hint}"`));
  return box;
}
