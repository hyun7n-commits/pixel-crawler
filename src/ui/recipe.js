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
    box.append(part(run, rc.a, grow), el('span', 'rc-op', '+'), part(run, rc.b, grow), el('span', 'rc-op', '→'), result(rc.id));
    wrap.append(box);
  }
  return wrap;
}
