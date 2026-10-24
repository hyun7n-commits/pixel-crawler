// Recipes shown as pictures instead of rules: [relic + level pips] + [relic + pips] → [result].
// Only recipes you have already found show up. The rest are a secret until you stumble on them.

import { el, icon } from './dom.js';
import { RELICS, MAX_LEVEL, recipeKey, recipesWith, tierOf, maxLevelOf, isFused, fusedParts } from '../data/relics.js';

// A relic's icon; a fused one is its two halves side by side.
export function relicIcon(id, size) {
  if (!isFused(id)) return icon(id, size);
  const box = el('span', 'fused-icon');
  for (const part of fusedParts(id)) box.append(icon(part, size ? size * 0.7 : undefined));
  return box;
}

// `grow` is a relic about to gain a level (on a choice card): its next pip blinks.
function part(run, id, grow) {
  const lv = run.p.relics[id] || 0;
  const p = el('span', 'rc-part' + (lv ? ' have' : ''));
  p.title = RELICS[id].name;
  p.append(icon(id));
  const pips = el('span', 'rc-pips');
  // basic relics have to be full; evolved ones go in at any level
  if (tierOf(id) > 0) pips.append(el('i', lv ? 'on star' : 'star'));
  else for (let i = 0; i < MAX_LEVEL; i++) pips.append(el('i', i < lv ? 'on' : i === lv && grow === id ? 'next' : ''));
  p.append(pips);
  return p;
}

function result(id) {
  const p = el('span', 'rc-part rc-result t' + tierOf(id));
  p.title = RELICS[id].name;
  p.append(icon(id));
  return p;
}

// The recipes you know that this relic goes into.
export function recipeFor(run, id, grow) {
  if (isFused(id) || maxLevelOf(id) === 1 && tierOf(id) === 3) return null;
  const known = recipesWith(id).filter(rc => run.meta.recipes[recipeKey(rc)]);
  if (!known.length) return null;
  const wrap = el('div', 'recipes');
  for (const rc of known) {
    const box = el('div', 'recipe' + (tierOf(rc.id) >= 2 ? ' legend' : ''));
    box.dataset.result = rc.id;
    box.append(part(run, rc.a, grow), el('span', 'rc-op', '+'), part(run, rc.b, grow), el('span', 'rc-op', '→'), result(rc.id));
    wrap.append(box);
  }
  return wrap;
}

// On a phone a choice card's recipes fold into one line (how many, and what they make), opened and
// closed with a tap that does not pick the card (v0.29: with many recipes found, one pick took three
// screens of scrolling). On a wide screen they are always open and the line is not shown.
export function foldRecipes(rc) {
  const wrap = el('div', 'rc-fold'), head = el('span', 'rc-fold-head');
  const made = [...new Set([...rc.children].map(b => b.dataset.result))];
  head.setAttribute('role', 'button');
  head.append(el('span', 'rc-fold-n', `진화 ${rc.children.length}가지`));
  const pics = el('span', 'rc-fold-pics');
  for (const id of made.slice(0, 5)) pics.append(icon(id));
  if (made.length > 5) pics.append(el('span', 'rc-fold-more', `+${made.length - 5}`));
  head.append(pics, el('span', 'rc-fold-arrow', '▾'));
  head.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); wrap.classList.toggle('open'); });
  wrap.append(head, rc);
  return wrap;
}
