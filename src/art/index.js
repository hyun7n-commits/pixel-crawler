// Every picture drawn in code, by texture name. A drawing works in a box 100 wide (100 tall for a
// square picture), whatever its size in the world; `artCanvas` paints it at any resolution, so the same picture serves the map (RES canvas
// pixels per world pixel) and the menus (bigger, for sharp icons on phones).

import { FOLK, PET_ART, drawFolk } from './folk.js';
import { PROPS } from './props.js';
import { CRITTERS } from './critters.js';
import { RELIC_ART, ITEM_ART, ITEM_SIZE } from './items.js';

// name -> { w, h } in world pixels and draw(g), or null when the picture is still pixel art
export function artDraw(name) {
  const [base, expr = ''] = name.split('~');
  const m = base.match(/^(.*)_walk([12])$/);
  const key = m ? m[1] : base, frame = m ? +m[2] : 0;
  if (FOLK[key]) return { w: 16, h: 16, draw: g => drawFolk(g, FOLK[key], frame, expr) };
  if (PET_ART[key] && !expr) return { w: 16, h: 16, draw: g => PET_ART[key](g, frame) };
  if (expr) return null;
  if (CRITTERS[key]) return { w: 16, h: 16, draw: g => CRITTERS[key](g, frame || undefined) };
  if (ITEM_ART[name]) { const n = ITEM_SIZE[name] || 16; return { w: n, h: n, draw: ITEM_ART[name] }; }
  if (RELIC_ART[name]) return { w: 8, h: 8, draw: RELIC_ART[name] };
  // things on the ground: t_door, t_stairs, ... (the same picture by its bare name for the menus)
  const prop = PROPS[name.startsWith('t_') ? name.slice(2) : name];
  if (prop) return { w: 16, h: 16, draw: prop };
  return null;
}

// `perPx`: canvas pixels per world pixel
export function artCanvas(art, perPx) {
  const c = document.createElement('canvas');
  c.width = Math.round(art.w * perPx); c.height = Math.round(art.h * perPx);
  const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.scale(c.width / 100, c.width / 100);
  art.draw(g);
  return c;
}

export const hasArt = name => !!artDraw(name);
