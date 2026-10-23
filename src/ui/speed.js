// 배속: how fast the fields play, 1x, 2x or 3x, remembered between visits. It speeds up what happens
// between your moves (walking, critters' turns, the trip down a burrow); the big moments (a star
// candy, an evolution) keep their own pace so the cards and sounds stay together (ui/beat.js).
import { showsLeft } from './beat.js';

const KEY = 'pixel-crawler-speed';
let s = 1;
try { const v = +localStorage.getItem(KEY); if ([1, 2, 3].includes(v)) s = v; } catch (e) { /* storage blocked: 1x */ }

export const speed = () => s;
// right now: the chosen speed, or 1 while a celebration is playing
export const pace = () => (showsLeft() > 0 ? 1 : s);
export function nextSpeed() {
  s = s % 3 + 1;
  try { localStorage.setItem(KEY, String(s)); } catch (e) { /* not remembered */ }
  return s;
}
