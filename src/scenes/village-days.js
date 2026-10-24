// 마을의 하루 in the village (v0.30, data/play.js DAYS): what is going on today. The day is rolled the first
// time you walk in on a new village day (dayToday, before the village's own life is put out, so that the
// day can change what bites and flies about: data/play.js DAY_LIFE); its things are put out each time the
// village is built (placeVillageDay) and it runs till you leave. Nothing says what day it is: you see it,
// and a neighbour may let it slip (the first villager to say hello says the day's line, GOSSIP, instead of
// their own). Doing the day's thing writes its page in the book (dayDone).
//
// A day is an entry in DAYS_A (below), DAYS_B (village-days-b.js) or DAYS_C (village-days-c.js) under its id
// in data/play.js DAYS; a day only rolls once it has one. Every part of it is optional:
//   night: true | 'moon'      the village after dark (moonlit is a little lighter)
//   fog: true                 a foggy morning
//   gossip: '...'             the day's line, instead of GOSSIP[id]
//   place(sc, ev, rnd)        put the day's things out (each time the village is built; `rnd` is seeded for
//                             the day, so the same day comes out the same)
//   tick(sc, ev, time, dt)    every frame
//   tap(sc, ev, x, y)         a tap on cell (x, y), before the village's own life gets it: true when taken
//   step(sc, ev, x, y, repeat)  a key pressed towards (x, y): true when taken
//   key(sc, ev, repeat)       Space (no game going on): true when taken
//   stepOn(sc, ev, x, y)      you walked onto (x, y)
//   meet(sc, ev, who)         you bumped a villager (who.f) or a friend from the meadow (who.id): true when
//                             the day had something to do or say instead of the usual
//   describe(sc, ev, x, y)    the tip line for (x, y), or ''
//   fire(sc, ev, x, y)        a fire at (x, y) to toast a marshmallow on (scenes/village-play.js):
//                             { x, y (the flame, world pixels), tx, ty (its cell) }, or null
// `ev` is the day as it is now: { id, def, t: meta.today, st: meta.today.st, things }. `st` is kept with the
// save for the rest of the day (plain data only: numbers, strings, arrays, objects); everything else on
// `ev` lasts until the village is built again. `things` (addThing) are what the day put on the map that a
// tap or a bump does something with: { x, y, cells: [[x, y]...] (when more than one), tip: '...' or
// (sc, ev, x, y) => '...', act(sc, ev, th) (you walk up beside it, then this), onto: true + step(sc, ev, th)
// (you walk onto it, then this), gone: true once it is done with }; the tip line, the taps and the bumps
// on them are seen to here.
// Helpers for the days (function declarations, so a day file can import them; use them, and D, inside
// its functions only, never at the top of the file):
//   dayRng(sc, salt)                 a random number source seeded for today (and `salt`)
//   freeSpot(sc, at, r, rnd, ok)     a free ground cell within `r` of `at` that you can walk to (ok(x, y):
//                                    any other test), or null
//   openCell(sc, x, y)               free ground: nothing on it, nobody on it, not in anyone's way
//   cuts(sc, cells), block(sc, cells)  whether putting something solid on `cells` cuts off part of the
//                                    village; put it there (whoever stood there steps aside)
//   addThing(ev, th), thingAt(ev, x, y), approach(sc, th)
//   sayAs(sc, who, line, ms)         a villager or friend turns to you, hops and says it
//   pay(sc, n)                       n gold from your purse (false: not enough)
//   give(sc, id, n, from, then)      something flies from `from` (world pixels) over your head and into the
//                                    basket (hooks.onCatch: its page the first time)
//   earn(sc, x, y, n)                +nG over (x, y), into the purse
//   carry(sc, key, from), handOver(sc, who, then)  hold something over your head; hand it to someone
//   follow(sc, imgs, o)              pictures that trail along behind you (o: { gap, lift, ground })
//   dayDone(sc, ev)                  the day's thing is done: its page in the book (once)
//   lit(img), glowAt(sc, x, y, tint, scale, alpha, depth)  something that gives off light (the night
//                                    leaves its colours alone); a soft glow

/* global Phaser */
import { TILE, rowsCanvas, texScale } from './textures.js';
import { D } from './VillageScene.js';
import { pixEllipse } from './pix.js';
import { seeded } from './pixkit.js';
import { ripple, float, face } from './village-secrets.js';
import { flyTo } from './village-play.js';
import { lifeKey, lifeTarget } from './village-life.js';
import { puddleCanvas, rainbowCanvas, starCanvas, fogCanvas, moonCanvas } from './village-play-art.js';
import { matCanvas, packCanvas, parcelCanvas, starBitCanvas, wispCanvas, doorLightCanvas, flameCanvas, FLAME_FRAMES, seatCanvas, litCanvas } from './village-days-art.js';
import { DAYS_B } from './village-days-b.js';
import { DAYS_C } from './village-days-c.js';
import { findIcon } from '../data/finds-art.js';
import { VILLAGE_MAP, HOUSES, HOME, BIG_TREE, doorOf, ownsHome } from '../data/village.js';
import { REGION } from '../data/village-map.js';
import { CROPS, SEED_PACK, seedCost, seedId, isSeed } from '../data/life.js';
import { hasDecor } from '../data/home.js';
import { has } from '../data/book.js';
import { CHARACTERS } from '../data/characters.js';
import { rollToday, dayId, FOGS, nextFog, treasureId, mapId, isMap, MAP_PIC, MAP_PRICE, mapToFind } from '../data/play.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// the middle of the plaza (as in VillageScene)
const PLAZA = { x: 30, y: 23 };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const pick = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length)];
const tex = (sc, key, make) => { if (!sc.textures.exists(key)) sc.textures.addCanvas(key, make()); return key; };
const iconKey = (sc, [shape, pal]) => tex(sc, `day_${shape}_${pal}`, () => rowsCanvas(findIcon(shape, pal)));
const itemKey = (sc, id) => (isMap(id) ? iconKey(sc, MAP_PIC.find) : isSeed(id) ? iconKey(sc, ['seed', 'n']) : lifeKey(sc, id));

// The day's line, for the first villager to say hello (a hint at most: never what to do, or what for)
export const GOSSIP = {
  rain: '비 그치니까 무지개가 떴어! 끝이 어디 닿았을까?',
  market: '오늘 장이 섰대. 떠돌이 상인이 왔다더라.',
  stars: '오늘 밤 별똥별이 쏟아진대. 나는 소원이 벌써 열 개야.',
  fireflies: '연못가에 반딧불이가 잔뜩 왔대. 반짝반짝하더라.',
  turnip: '텃밭 옆에 순무가 엄청 크게 자랐대. 혼자서는 못 뽑겠더라.',
  laundry: '빨랫줄에서 양말 한 짝이 날아갔대. 바람이 범인이래.',
  kite: '연이 나무에 걸렸대. 나무가 안 놔준다나 봐.',
  chicks: '병아리들이 우리를 빠져나갔대! 엄마 닭이 난리야.',
  hide: '친구들이 숨바꼭질한대. 술래는 비밀이래.',
  picnic: '오늘 연못가에서 소풍한대. 도시락 냄새 나지?',
  fog: '안개 속에서 작은 불빛을 봤다는 사람이 있어.',
  moon: '오늘 밤 보름달이래. 큰 나무 쪽에서 누가 노래하더라.',
  wind: '바람 엄청 분다! 조합장 모자가 날아갔대.',
  bloom: '꽃이 한꺼번에 다 피었어! 코가 간질간질해.',
  cleanup: '길에 쓰레기가 굴러다녀. 조합장이 한숨 쉬더라.',
  concert: '오늘 광장에서 연주회 한대. 앞에 모자가 놓여 있더라.',
  campfire: '오늘 밤 광장에 모닥불 피운대. 마시멜로 있어?',
};

// all the days there are (DAYS_A is further down this file)
let ALL = null;
const days = () => (ALL ||= { ...DAYS_A, ...DAYS_B, ...DAYS_C });

// ---------- the day ----------
// a new village day: what is going on today (data/play.js rollToday), from what the village is like now
export function dayToday(sc) {
  const meta = sc.meta, day = meta.day || 0;
  if (meta.today?.day === day) return meta.today;
  const heroes = Object.keys(meta.chars).filter(id => meta.chars[id] && id !== meta.sel).length;
  const fogLeft = FOGS.filter(f => !has(meta, treasureId(f.id))).length;
  rollToday(meta, { P: sc.st.P, arr: sc.st.arr, heroes, garden: hasDecor(meta, 'garden'), fogLeft, day, ok: id => !!days()[id] });
  sc.hooks.onLife?.();
  return meta.today;
}

// put today out (after the games: VillageScene enter)
export function placeVillageDay(sc) {
  sc.day = null;
  sc.smoke.setParticleTint(0xd8d4e0);
  const t = sc.meta.today, def = t?.ev && t.day === (sc.meta.day || 0) ? days()[t.ev] : null;
  if (!def) return;
  t.st ||= {};
  const ev = sc.day = { id: t.ev, def, t, st: t.st, things: [] };
  if (def.night) nightLook(sc, ev, def.night === 'moon');
  if (def.fog) fogLook(sc, ev);
  def.place?.(sc, ev, dayRng(sc, 1));
  if (ev.night) darken(sc, ev);
  sc.hooks.onLife?.();
}

// the day's thing is done: its page, once
export function dayDone(sc, ev = sc.day) {
  if (!ev || ev.t.done) return false;
  ev.t.done = true;
  sc.hooks.onEntry?.(dayId(ev.id));
  sc.hooks.onLife?.();
  return true;
}

// the first hello of the day (VillageScene update): the day's line instead, once a day, until it is done
export function dayGossip(sc, one) {
  const ev = sc.day;
  if (!ev || ev.t.done || ev.st.told || !one.f) return null;
  const line = ev.def.gossip || GOSSIP[ev.id];
  if (!line) return null;
  ev.st.told = true;
  sc.hooks.onLife?.();
  return line;
}

// ---------- taps, keys, steps, bumps ----------
export function dayTap(sc, x, y) {
  const ev = sc.day;
  if (!ev || sc.fishing) return false;
  if (ev.def.tap?.(sc, ev, x, y)) return true;
  const th = thingAt(ev, x, y);
  if (!th || (!th.act && !th.onto)) return false;
  return approach(sc, th);
}
export function dayStep(sc, x, y, repeat) {
  const ev = sc.day;
  if (!ev || sc.fishing) return false;
  if (ev.def.step?.(sc, ev, x, y, repeat)) return true;
  const th = thingAt(ev, x, y);
  if (!th || th.onto || !th.act) return false;
  dayAct(sc, { day: true, th, x, y });
  return true;
}
export function dayKey(sc, repeat) {
  const ev = sc.day;
  return !!(ev && !sc.play && ev.def.key?.(sc, ev, repeat));
}
// beside a thing now (VillageScene meet, for `{ day: true }`)
export function dayAct(sc, it) {
  sc.path = [];
  sc.pending = null;
  const ev = sc.day;
  if (!ev || it.th.gone || sc.play || sc.ps.diving) return;
  if (it.x !== sc.p.x) sc.ps.setFlipX(it.x < sc.p.x);
  it.th.act?.(sc, ev, it.th);
}
export function dayStepOn(sc, x, y) {
  const ev = sc.day;
  if (!ev) return;
  ev.def.stepOn?.(sc, ev, x, y);
  const th = ev.things.find(o => o.onto && !o.gone && o.x === x && o.y === y);
  if (th) sc.time.delayedCall(120, () => { if (!th.gone && sc.day === ev && sc.p.x === x && sc.p.y === y) th.step?.(sc, ev, th); });
}
export function dayMeet(sc, who) {
  const ev = sc.day;
  return !!(ev && ev.def.meet?.(sc, ev, who));
}
export function dayDescribe(sc, x, y) {
  const ev = sc.day;
  if (!ev) return '';
  const d = ev.def.describe?.(sc, ev, x, y);
  if (d) return d;
  const th = thingAt(ev, x, y);
  return th ? (typeof th.tip === 'function' ? th.tip(sc, ev, x, y) : th.tip || '') : '';
}
// a fire to toast a marshmallow on (VillageScene dayFire, for scenes/village-play.js)
export function dayFire(sc, x, y) {
  const ev = sc.day;
  return (ev && ev.def.fire?.(sc, ev, x, y)) || null;
}
export function dayTick(sc, time, dt) {
  const ev = sc.day;
  if (!ev) return;
  if (ev.night) nightTick(sc, ev, time);
  if (ev.fog) fogTick(sc, ev, time, dt);
  holdTick(sc, ev);
  for (const ch of ev.chains || []) chainTick(sc, ch, time);
  ev.def.tick?.(sc, ev, time, dt);
}

// ---------- helpers for the days ----------
export function dayRng(sc, salt = 0) {
  return seeded(((sc.meta.today?.seed || 1) + salt * 7919) % 233280);
}

// the cells where people come in (from the fields, out of your door, by the guild) and in front of every
// door: nothing of a day's goes there
let STARTS = null;
const starts = () => (STARTS ||= (() => {
  const y = VILLAGE_MAP.findIndex(r => r.includes('>')), exit = { x: VILLAGE_MAP[y].indexOf('>') - 1, y };
  const guild = doorOf(HOUSES.find(h => h.id === 'guild'));
  return [exit, { x: guild.x, y: guild.y + 2 }, doorOf(HOME), ...HOUSES.map(doorOf)];
})());
// something there already: a hidden bit, a wild thing, a bug, the skipping stones, the day's own things
function taken(sc, x, y) {
  const at = o => o.x === x && o.y === y;
  return sc.finds.some(at) || (sc.lifeWild || []).some(at) || (sc.lifeBugs || []).some(at) || (sc.stones && at(sc.stones)) ||
    !!thingAt(sc.day, x, y) || starts().some(at);
}
// free ground: nothing on it, nobody on it, not in anyone's way
export function openCell(sc, x, y) {
  if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1 || !'.*:'.includes(sc.ch(x, y)) || sc.blocked[y * MW + x] || sc.isNew(x, y)) return false;
  return !sc.folkAt(x, y) && !sc.pupAt(x, y) && !(sc.p.x === x && sc.p.y === y) && !taken(sc, x, y);
}

// every cell you can walk to from where you are (who is standing where aside)
function flood(sc) {
  const r = new Uint8Array(MW * MH), q = [sc.p.y * MW + sc.p.x];
  r[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), x = i % MW, y = (i / MW) | 0;
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy, j = ny * MW + nx;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || r[j] || sc.blocked[j] || !sc.canCut(x, y, dx, dy)) continue;
      r[j] = 1;
      q.push(j);
    }
  }
  return r;
}
const reachOf = sc => (sc.day ? (sc.day.reach ||= flood(sc)) : flood(sc));
const count = r => r.reduce((n, v) => n + v, 0);
// would something solid on `cells` cut part of the village off?
export function cuts(sc, cells) {
  const before = reachOf(sc), was = cells.map(([x, y]) => sc.blocked[y * MW + x]);
  cells.forEach(([x, y]) => { sc.blocked[y * MW + x] = 1; });
  const after = flood(sc);
  cells.forEach(([x, y], i) => { sc.blocked[y * MW + x] = was[i]; });
  return count(before) - count(after) > cells.filter(([x, y]) => before[y * MW + x]).length;
}
// something solid goes on `cells`: a friend standing there steps aside
export function block(sc, cells) {
  for (const [x, y] of cells) {
    sc.blocked[y * MW + x] = 1;
    const h = sc.heroAt(x, y), to = h && sc.freeGrassTile();
    if (to) {
      sc.tweens.killTweensOf(h.s);
      h.x = to.x; h.y = to.y;
      h.s.setPosition(center(to.x), foot(to.y)).setDepth(D.actors + to.y / 100);
    }
  }
  if (sc.day) sc.day.reach = null;
}
// a free ground cell within `r` of `at` that you can get to
export function freeSpot(sc, at, r, rnd = Math.random, ok = null) {
  const re = reachOf(sc);
  for (let tries = 0; tries < 160; tries++) {
    const x = at.x - r + Math.floor(rnd() * (2 * r + 1)), y = at.y - r + Math.floor(rnd() * (2 * r + 1));
    if (!openCell(sc, x, y) || !re[y * MW + x] || !sc.walkable(x, y) || (ok && !ok(x, y))) continue;
    return { x, y };
  }
  return null;
}

const cellsOf = th => th.cells || [[th.x, th.y]];
export function addThing(ev, th) { ev.things.push(th); return th; }
export function thingAt(ev, x, y) {
  return ev?.things.find(th => !th.gone && cellsOf(th).some(([cx, cy]) => cx === x && cy === y)) || null;
}
// walk up to a thing (onto it, for one you step on), and do it once there
export function approach(sc, th) {
  if (th.onto) {
    if (sc.p.x === th.x && sc.p.y === th.y) { th.step?.(sc, sc.day, th); return true; }
    const r = sc.walkable(th.x, th.y) ? sc.route(th.x, th.y) : [];
    if (r.length) { sc.path = r; sc.pending = null; }
    return true;
  }
  const it = { day: true, th, x: th.x, y: th.y };
  let best = null;
  for (const [x, y] of cellsOf(th)) {
    const n = sc.near({ x, y });
    if (n === 0) { best = 0; it.x = x; it.y = y; break; }
    if (n && (!best || n.length < best.length)) { best = n; it.x = x; it.y = y; }
  }
  if (best === 0) dayAct(sc, it);
  else if (best) { sc.path = best; sc.pending = it; }
  return true;
}

// `who`: a villager or a friend (anything with its picture in .s and its cell in x, y)
export function sayAs(sc, who, line, ms = 1700) {
  if (who.x !== sc.p.x) who.s.setFlipX(sc.p.x < who.x);
  sc.tweens.add({ targets: who.s, hop: 4, duration: 90, yoyo: true, ease: 'Quad.out' });
  sc.say(who.s, line, ms);
}
export const pay = (sc, n) => sc.hooks.onGold?.(-n) === true;
export function give(sc, id, n = 1, from = null, then = null) {
  const at = from || { x: sc.ps.x, y: sc.ps.y - 12 };
  flyTo(sc, itemKey(sc, id), at.x, at.y, () => { sc.hooks.onCatch?.(id, n); then?.(); });
}
export function earn(sc, x, y, n) {
  const z = sc.cameras.main.zoom || 3, k = sc.dpr / z;
  const t = sc.keep(sc.add.text(Math.round(x), Math.round(y), `+${n}G`, {
    fontFamily: 'Galmuri14, sans-serif', fontSize: `${15 * k}px`, color: '#f4cf4f', stroke: '#1b1424', strokeThickness: 3 * k,
  }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(z));
  sc.tweens.add({ targets: t, y: t.y - 12, alpha: 0, delay: 350, duration: 700, ease: 'Quad.in' });
  sc.hooks.onFind?.(n);
}

// something held up over your head as you go about (one at a time); `from`: it comes over to you from there
export function carry(sc, key, from = null) {
  const ev = sc.day, ps = sc.ps;
  ev.held?.destroy();
  const h = ev.held = sc.keep(sc.add.image(from ? from.x : ps.x, from ? from.y : ps.y - TILE - 2, key).setOrigin(0.5, 1).setDepth(ps.depth + 0.0006));
  if (from) {
    h.handing = true;
    sc.tweens.addCounter({
      from: 0, to: 1, duration: 420,
      onUpdate: tw => { const u = tw.getValue(), tx = sc.ps.x, ty = sc.ps.y - TILE - 2; h.setPosition(Math.round(from.x + (tx - from.x) * u), Math.round(from.y + (ty - from.y) * u - 12 * Math.sin(Math.PI * u))); },
      onComplete: () => { h.handing = false; },
    });
  }
  return h;
}
function holdTick(sc, ev) {
  const h = ev.held, ps = sc.ps;
  if (!h) return;
  if (!h.active) { ev.held = null; return; }
  if (h.handing) return;
  h.setPosition(Math.round(ps.x), Math.round(ps.y - TILE - 2 - (ps.hop || 0))).setDepth(ps.depth + 0.0006).setVisible(ps.visible && !ps.diving).setAlpha(ps.alpha);
}
// what you are holding goes over to `who`
export function handOver(sc, who, then = null) {
  const ev = sc.day, h = ev?.held;
  if (!h) { then?.(); return; }
  ev.held = null;
  h.handing = true;
  const x0 = h.x, y0 = h.y, s = who.s;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 380,
    onUpdate: tw => { const u = tw.getValue(); h.setPosition(Math.round(x0 + (s.x - x0) * u), Math.round(y0 + (s.y - TILE - 2 - y0) * u - 10 * Math.sin(Math.PI * u))); },
    onComplete: () => { sc.spark.explode(6, h.x, h.y - 4); h.destroy(); then?.(); },
  });
}

// pictures trailing along behind you, each a little way behind the one before (`lift`: how high off the
// ground; `ground`: they walk, so they sort with everyone else)
export function follow(sc, imgs, { gap = 8, lift = 0, ground = false } = {}) {
  const ch = { items: imgs.map(img => ({ img, x: img.x, y: img.y })), gap, lift, ground };
  (sc.day.chains ||= []).push(ch);
  return ch;
}
function chainTick(sc, ch, time) {
  const ps = sc.ps;
  let lx = ps.x + (ps.flipX ? 1 : -1) * 6, ly = ps.y - ch.lift;
  ch.items.forEach((it, i) => {
    if (!it.img.active) return;
    const dx = lx - it.x, dy = ly - it.y, l = Math.hypot(dx, dy) || 1;
    if (l > ch.gap) { it.x += dx / l * (l - ch.gap); it.y += dy / l * (l - ch.gap); }
    const y = Math.round(it.y + (ch.lift ? Math.sin(time / 320 + i * 1.9) * 1.5 : 0));
    it.img.setPosition(Math.round(it.x), y);
    if (Math.abs(dx) > 0.5 && ch.ground) it.img.setFlipX(dx < 0);
    if (ch.ground) it.img.setDepth(D.actors + (it.y / TILE - 1) / 100);
    it.img.glow?.setPosition(it.img.x, y);
    lx = it.x; ly = it.y;
  });
}

// a light: the night leaves it as it is
export function lit(img) { img.lit = true; return img; }
export function glowAt(sc, x, y, tint = null, scale = 1, alpha = 0.5, depth = D.fx) {
  const g = sc.keep(sc.add.image(Math.round(x), Math.round(y), tint == null ? 'glow' : 'oreGlow').setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(alpha).setDepth(depth));
  if (tint != null) g.setTint(tint);
  return lit(g);
}

// ---------- the night ----------
// The village after dark, done the way the fields do it (DungeonScene: a tint on each picture): the ground
// and everything flat on it under one night-blue sheet (MULTIPLY), everything standing up tinted the same
// blue, people a shade lighter so you can still tell who is who. The lit windows stay lit (their glass is
// laid over each house again), and so do the lamps, a little wider, and anything lit(). No sun on the pond,
// no butterflies or sparrows or petals; the chimney smoke goes grey.
const NIGHT = 0x5d69a8, MOONLIT = 0x7886c2, FOLKS = 0x8f9bd2, FOLKS_MOON = 0xa6b2e2;
const SHEET = () => D.deco + 0.95;
function nightLook(sc, ev, moon) {
  ev.night = { tint: moon ? MOONLIT : NIGHT, folk: moon ? FOLKS_MOON : FOLKS, lit: [], next: 0 };
  sc.keep(sc.add.rectangle(-400, -400, MW * TILE + 800, MH * TILE + 800, ev.night.tint).setOrigin(0).setDepth(SHEET()).setBlendMode(Phaser.BlendModes.MULTIPLY));
  sc.rays?.destroy();
  sc.rays = null;
  sc.glints.forEach(g => g.destroy());
  sc.glints = [];
  for (const k of ['flutters', 'birds', 'motes']) { (sc[k] || []).forEach(o => o.img.destroy()); sc[k] = []; }
  sc.smoke.setParticleTint(0x7a7e98);
  sc.glows.forEach(g => g.setScale(g.scaleX * 1.5));
  // the ducks are above the sheet, with the moon on the water
  for (const d of sc.ducks || []) d.img.setDepth(SHEET() + 0.03);
  const lamps = sc.props.filter(o => o.pr.kind === 'lamp' || o.pr.kind === 'lanterns').map(o => o.imgs[0]);
  for (const src of [...HOUSES.map(h => h.img), ...sc.buildings.map(b => b.img), ownsHome(sc.meta) && sc.homeImg, ...lamps]) if (src) ev.night.lit.push({ src, key: null, img: null });
}
// everything standing up that is not a light goes night-blue (again now and then, for what has come up since)
function darken(sc, ev) {
  const n = ev.night, folks = new Set([sc.ps, sc.petS, sc.pup?.s, ...sc.folk.map(f => f.s), ...sc.heroes.map(h => h.s)]);
  for (const o of sc.children.list) {
    if (o.type !== 'Image' || o.lit || o.isTinted || o.blendMode === Phaser.BlendModes.ADD || o.depth <= SHEET() || o.depth >= D.fx - 0.25) continue;
    o.setTint(folks.has(o) ? n.folk : n.tint);
  }
}
function nightTick(sc, ev, time) {
  const n = ev.night;
  if (time > n.next) { n.next = time + 400; darken(sc, ev); }
  for (const l of n.lit) litTick(sc, l);
}
// a house's lit glass over the house, kept where it is, as it is
function litTick(sc, l) {
  const s = l.src;
  if (!s.active) { l.img?.destroy(); l.img = null; return; }
  if (l.key !== s.texture.key) {
    l.key = s.texture.key;
    const key = `night_${l.key}`;
    if (!sc.textures.exists(key)) sc.textures.addCanvas(key, litCanvas(sc.textures.get(l.key).getSourceImage()));
    l.img?.destroy();
    l.img = sc.textures.get(key).getSourceImage().lit ? lit(sc.keep(sc.add.image(s.x, s.y, key))) : null;
  }
  l.img?.setPosition(s.x, s.y).setOrigin(s.originX, s.originY).setScale(s.scaleX, s.scaleY).setFlipX(s.flipX).setVisible(s.visible).setAlpha(s.alpha).setDepth(s.depth + 0.0001);
}

// ---------- the fog ----------
// A foggy morning: a pale haze over everything and banks of fog drifting slowly by, thin round you
function fogLook(sc, ev) {
  sc.rays?.destroy();
  sc.rays = null;
  sc.keep(sc.add.rectangle(-400, -400, MW * TILE + 800, MH * TILE + 800, 0xe4ecf2).setOrigin(0).setDepth(D.fx + 0.15).setAlpha(0.16));
  const key = tex(sc, 'day_fog', fogCanvas), ps = sc.ps, rnd = dayRng(sc, 2);
  ev.fog = Array.from({ length: 26 }, (_, k) => ({
    img: sc.keep(sc.add.image(0, 0, key).setDepth(D.fx + 0.2).setFlipX(k % 2 === 1).setFlipY(k % 3 === 1)),
    x: ps.x - 280 + rnd() * 560, y: ps.y - 190 + rnd() * 380, v: 2 + rnd() * 4,
  }));
}
function fogTick(sc, ev, time, dt) {
  const view = sc.cameras.main.worldView, ps = sc.ps, s = dt / 1000, m = 60;
  for (const b of ev.fog) {
    b.x += b.v * s;
    // round again from the other side of the view
    if (b.x > view.right + m) b.x -= view.width + 2 * m;
    else if (b.x < view.x - m) b.x += view.width + 2 * m;
    if (b.y > view.bottom + m) b.y -= view.height + 2 * m;
    else if (b.y < view.y - m) b.y += view.height + 2 * m;
    const d = Math.hypot(b.x - ps.x, b.y - ps.y + 8);
    b.img.setPosition(Math.round(b.x), Math.round(b.y)).setAlpha(0.55 * Phaser.Math.Clamp((d - 14) / 70, 0.1, 1));
  }
}

// ======================================================================================================
// The days (DAYS_A): 비 온 뒤 무지개, 장날, 별똥별 내리는 밤, 반딧불이 밤, 보름달, 안개 낀 아침, 모닥불 밤
// ======================================================================================================

// ---------- 비 온 뒤 무지개 ----------
// Puddles on the paths that splash as you go through, and a rainbow with one end on the ground somewhere:
// walk onto that spot and you dig something up (a treasure map, while there is one to be had).
function puddleSpots(sc, rnd) {
  const cells = [];
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) if (sc.ch(x, y) === ':' && !sc.blocked[y * MW + x] && !sc.isNew(x, y)) cells.push([x, y]);
  const out = [];
  for (let k = 0; k < 80 && out.length < 14 && cells.length; k++) {
    const [x, y] = pick(cells, rnd);
    if (!out.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) < 3)) out.push([x, y, Math.floor(rnd() * 3)]);
  }
  return out;
}
function digRainbow(sc, ev, th) {
  th.gone = true;
  const ps = sc.ps, x = ps.x, y = ps.y;
  sc.hooks.onSound?.('rustle');
  face(sc, 'grit', 900);
  for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 220, () => { sc.dust.explode(6, x + (k - 1) * 3, y); sc.tweens.add({ targets: ps, y: y + 2, duration: 80, yoyo: true }); });
  sc.time.delayedCall(760, () => {
    sc.hooks.onSound?.('chest');
    const map = mapToFind(sc.meta);
    if (map) give(sc, mapId(map.id), 1, { x, y: y - 6 }, () => sc.say(ps, '보물 지도다!', 1500));
    else { earn(sc, x, y - 18, 50); face(sc, 'sparkle', 1200); sc.say(ps, '반짝반짝 동전이다!', 1500); }
    dayDone(sc, ev);
    const bow = ev.bow;
    ev.bow = null;
    if (bow) sc.tweens.add({ targets: bow, alpha: 0, duration: 1600, onComplete: () => bow.destroy() });
  });
}
const rain = {
  place(sc, ev, rnd) {
    const st = ev.st;
    st.puddles ||= puddleSpots(sc, rnd);
    ev.puddles = st.puddles.filter(([x, y]) => sc.ch(x, y) === ':').map(([x, y, v]) => ({
      x, y, img: sc.keep(sc.add.image(center(x) + ((x * 7 + y) % 5) - 2, center(y) + 2, tex(sc, `day_puddle${v}`, () => puddleCanvas(v))).setDepth(D.deco + 0.25)),
    }));
    if (ev.t.done) return;
    if (!st.end || sc.blocked[st.end[1] * MW + st.end[0]]) {
      const s = freeSpot(sc, sc.p, 14, rnd, (x, y) => cheb({ x, y }, sc.p) >= 6 && sc.ch(x, y) !== ':');
      if (!s) return;
      st.end = [s.x, s.y, rnd() < 0.5 ? 1 : -1];
    }
    // its foot on the spot, the arc going up and over to one side
    const [x, y, dir] = st.end;
    ev.bow = sc.keep(sc.add.image(center(x) - dir * 7, foot(y) - 3, tex(sc, 'day_rainbow', () => rainbowCanvas(112))).setOrigin(dir > 0 ? 0 : 1, 1).setDepth(D.fx - 0.45).setAlpha(0.5));
    ev.end = { x, y, next: 0 };
    addThing(ev, { x, y, onto: true, tip: '무지개 끝: 무지개가 여기 땅에 닿아 있다.', step: digRainbow });
  },
  tick(sc, ev, time) {
    if (ev.bow) ev.bow.setAlpha(0.45 + 0.07 * Math.sin(time / 900));
    const e = ev.end;
    if (e && ev.bow && time > e.next) { e.next = time + 600 + Math.random() * 700; sc.spark.explode(2, center(e.x) + (Math.random() - 0.5) * 8, foot(e.y) - 4); }
  },
  stepOn(sc, ev, x, y) {
    const p = ev.puddles?.find(o => o.x === x && o.y === y);
    if (!p) return;
    sc.time.delayedCall(90, () => {
      sc.drops.explode(5, p.img.x, p.img.y);
      ripple(sc, p.img.x, p.img.y);
      if (sc.time.now > (ev.splashAt || 0)) { ev.splashAt = sc.time.now + 400; sc.hooks.onSound?.('splash'); }
      if (Math.random() < 0.25) float(sc, p.img.x, p.img.y - 12, '찰박', '#9fd4ff');
    });
  },
  describe(sc, ev, x, y) {
    return ev.puddles?.some(o => o.x === x && o.y === y) && !sc.heroAt(x, y) && !sc.folkAt(x, y) ? '물웅덩이: 밤새 내린 비가 고였다.' : '';
  },
};

// ---------- 장날 ----------
// The wandering peddler (the shopkeeper's double) spreads a mat out by the plaza: a few things for today
// only, at their own prices (hooks.onMarket: ui/play.js). Buy something and you are asked to take a parcel
// round to the shop.
const CALLS = ['골라 봐, 골라 봐!', '오늘만 싸게 줄게!', '먼 데서 왔어!', '구경은 공짜야!'];
const matCells = (x, y) => [[x, y], [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]];
// the peddler's cell and the mat in front, all free, with room to stand in front of it
function matFits(sc, x, y) {
  const cells = matCells(x, y);
  if (!cells.every(([cx, cy]) => openCell(sc, cx, cy))) return false;
  if ([-1, 0, 1].filter(dx => openCell(sc, x + dx, y + 2)).length < 2) return false;
  return !cuts(sc, cells);
}
// today's goods: the map there is to be had, a bag of seeds cheap, eggs, honey
function rollOffers(sc, rnd) {
  const out = [], map = mapToFind(sc.meta), c = pick(Object.values(CROPS), rnd);
  if (map) out.push({ id: mapId(map.id), n: 1, price: MAP_PRICE, name: '보물 지도', line: '어디서 났는지는 묻지 마.' });
  out.push({ id: seedId(c.id), n: SEED_PACK, price: Math.round(seedCost(c.days) * 0.6), name: `${c.name} 씨앗 한 봉지`, line: `먼 동네에서 가져온 씨앗. ${SEED_PACK}알 들었다.` });
  if (!map || rnd() < 0.5) out.push({ id: 'egg', n: 2, price: 20, name: '달걀 두 알', line: '오늘 아침에 받은 달걀. 아직 따뜻하다.' });
  out.push({ id: 'honey', n: 2, price: 26, name: '벌집 꿀 두 조각', line: '산 너머 꿀벌네 꿀. 아주 달다.' });
  return out;
}
function openMat(sc, ev) {
  const pd = ev.pd, st = ev.st;
  if (!pd) return;
  if (sc.p.x !== pd.x) pd.s.setFlipX(sc.p.x < pd.x);
  sc.tweens.add({ targets: pd.s, hop: 4, duration: 90, yoyo: true, ease: 'Quad.out' });
  sc.time.delayedCall(260, () => sc.hooks.onMarket?.({
    line: st.bought ? '또 왔네! 천천히 골라.' : '어서 와! 오늘만 여는 좌판이야.',
    offers: st.offers,
    buy: o => buyOffer(sc, ev, o),
    onClose: () => sc.time.delayedCall(250, () => afterMarket(sc, ev)),
  }));
}
function buyOffer(sc, ev, o) {
  if (o.sold || !pay(sc, o.price)) return false;
  o.sold = true;
  ev.st.bought = (ev.st.bought || 0) + 1;
  sc.hooks.onBag?.(o.id, o.n);
  dayDone(sc, ev);
  return true;
}
// the mat folded up after something was bought: a parcel for the shop
function afterMarket(sc, ev) {
  const st = ev.st, pd = ev.pd;
  if (sc.day !== ev || !pd || !st.bought || st.parcel || !sc.folk.some(f => f.id === 'shop')) return;
  st.parcel = 1;
  sc.tweens.add({ targets: pd.s, hop: 4, duration: 90, yoyo: true, ease: 'Quad.out' });
  sc.say(pd.s, '아 참, 이거 상점 주인한테 좀 전해 줄래? 집에서 보낸 반찬이야.', 2800);
  carry(sc, tex(sc, 'day_parcel', parcelCanvas), { x: pd.s.x, y: pd.s.y - 12 });
  sc.hooks.onLife?.();
}
const market = {
  place(sc, ev, rnd) {
    const st = ev.st, fits = (x, y) => matFits(sc, x, y);
    let at = st.at && fits(st.at[0], st.at[1]) ? { x: st.at[0], y: st.at[1] } : null;
    at ||= freeSpot(sc, PLAZA, 6, rnd, fits) || freeSpot(sc, PLAZA, 10, rnd, fits);
    if (!at) return;
    st.at = [at.x, at.y];
    st.offers ||= rollOffers(sc, rnd);
    const { x, y } = at, cells = matCells(x, y);
    block(sc, cells);
    const s = sc.actor('peddler', x, y);
    s.setScale(texScale(s));
    const pack = sc.keep(sc.add.image(s.x - 4, s.y - 3, tex(sc, 'day_pack', packCanvas)).setOrigin(0.5, 1).setDepth(s.depth - 0.0004));
    sc.keep(sc.add.image(center(x), foot(y + 1), tex(sc, 'day_mat', matCanvas)).setOrigin(0.5, 1).setDepth(D.deco + 0.4));
    const g = sc.keep(sc.add.graphics().setDepth(D.actors - 0.5));
    g.fillStyle(0x000000, 0.28);
    pixEllipse(g, s.x, s.y - 1.5, 11, 4);
    ev.pd = { x, y, s, pack, next: sc.time.now + 2500 };
    addThing(ev, {
      x, y, cells, act: openMat,
      tip: (sc2, ev2, cx, cy) => (cy === y ? '떠돌이 상인: 커다란 보따리를 메고 왔다. 상점 주인이랑 꼭 닮았다.' : '좌판: 처음 보는 물건이 늘어놓여 있다.'),
    });
    if (st.parcel === 1) carry(sc, tex(sc, 'day_parcel', parcelCanvas));
  },
  tick(sc, ev, time) {
    const pd = ev.pd;
    if (!pd) return;
    const s = pd.s, k = texScale(s), d = cheb(pd, sc.p);
    if (d <= 3 && sc.p.x !== pd.x) s.setFlipX(sc.p.x < pd.x);
    s.setScale(k, k * (1 + 0.035 * Math.sin(time / 420 + 2))).setOrigin(0.5, 1 + (s.hop || 0) / TILE);
    pd.pack.setPosition(s.x + (s.flipX ? 4 : -4), s.y - 3 - (s.hop || 0)).setFlipX(s.flipX);
    if (time < pd.next) return;
    pd.next = time + 6000 + Math.random() * 4000;
    if (d <= 6 && d > 1 && !sc.showing) {
      sc.tweens.add({ targets: s, hop: 3, duration: 100, yoyo: true, ease: 'Quad.out' });
      sc.say(s, pick(CALLS), 1500);
    }
  },
  // the parcel to the shopkeeper
  meet(sc, ev, who) {
    if (who.id !== 'shop' || ev.st.parcel !== 1 || !ev.held) return false;
    ev.st.parcel = 2;
    handOver(sc, who, () => {
      sayAs(sc, who, '또 반찬 보냈네! 고마워, 이거 받아.', 1800);
      sc.time.delayedCall(500, () => earn(sc, who.s.x, who.s.y - 20, 30));
      sc.hooks.onLife?.();
    });
    return true;
  },
};

// ---------- 별똥별 내리는 밤 ----------
// A shooting star every few seconds. Make a wish while one goes over (Space, or a tap on open ground) and
// a bit of it comes down near you: walk onto it.
function openGround(sc, ev, x, y) {
  return (sc.walkable(x, y) || (sc.p.x === x && sc.p.y === y)) && !thingAt(ev, x, y) && !lifeTarget(sc, x, y);
}
function shoot(sc, ev) {
  const view = sc.cameras.main.worldView, rnd = Math.random;
  const x0 = view.x + view.width * (0.45 + rnd() * 0.45), y0 = view.y + view.height * (0.06 + rnd() * 0.22);
  const dx = -view.width * (0.22 + rnd() * 0.14), dy = -dx * (0.3 + rnd() * 0.12);
  // (the picture flies up and to the left; turned over, down and to the left)
  const img = lit(sc.keep(sc.add.image(Math.round(x0), Math.round(y0), tex(sc, 'day_shoot', starCanvas)).setFlipY(true).setDepth(D.bubble - 0.6).setAlpha(0)));
  const star = ev.star = { img, wished: false };
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 1150,
    onUpdate: tw => { const u = tw.getValue(); img.setPosition(Math.round(x0 + dx * u), Math.round(y0 + dy * u)).setAlpha(u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1); },
    // (a wish just after it has gone still counts)
    onComplete: () => { img.destroy(); sc.time.delayedCall(350, () => { if (ev.star === star) ev.star = null; }); ev.nextStar = sc.time.now + 3500 + Math.random() * 4000; },
  });
}
function wish(sc, ev) {
  const star = ev.star;
  star.wished = true;
  face(sc, 'blink', 1200);
  sc.hooks.onSound?.('wand');
  sc.spark.explode(8, star.img.x + 3, star.img.y);
  if (ev.t.done || ev.piece || ev.falling) return;
  const s = freeSpot(sc, sc.p, 4, Math.random, (x, y) => cheb({ x, y }, sc.p) >= 2);
  if (!s) return;
  ev.falling = true;
  ev.st.piece = [s.x, s.y];
  const bit = lit(sc.keep(sc.add.image(star.img.x, star.img.y, tex(sc, 'day_starbit', starBitCanvas)).setDepth(D.bubble - 0.6)));
  const x0 = bit.x, y0 = bit.y, tx = center(s.x), ty = foot(s.y) - 5;
  sc.tweens.addCounter({
    from: 0, to: 1, delay: 250, duration: 900, ease: 'Quad.in',
    onUpdate: tw => { const u = tw.getValue(); bit.setPosition(Math.round(x0 + (tx - x0) * u), Math.round(y0 + (ty - y0) * u)); },
    onComplete: () => { bit.destroy(); ev.falling = false; putPiece(sc, ev, s.x, s.y, true); },
  });
  sc.hooks.onLife?.();
}
function putPiece(sc, ev, x, y, fresh) {
  const img = lit(sc.keep(sc.add.image(center(x), foot(y) - 5, tex(sc, 'day_starbit', starBitCanvas)).setDepth(D.actors + y / 100 + 0.004)));
  ev.piece = { img, glow: glowAt(sc, img.x, img.y, 0xfff0a0, 0.6, 0.45), next: 0 };
  if (fresh) { sc.spark.explode(12, img.x, img.y); sc.hooks.onSound?.('pop'); }
  addThing(ev, { x, y, onto: true, tip: '별 조각: 하늘에서 떨어진 반짝이는 조각.', step: takePiece });
}
function takePiece(sc, ev, th) {
  th.gone = true;
  const pc = ev.piece;
  ev.piece = null;
  ev.st.piece = null;
  sc.hooks.onSound?.('chest');
  sc.spark.explode(14, pc.img.x, pc.img.y);
  sc.tweens.add({ targets: [pc.img, pc.glow], y: pc.img.y - 14, alpha: 0, duration: 400, ease: 'Quad.out', onComplete: () => { pc.img.destroy(); pc.glow.destroy(); } });
  earn(sc, pc.img.x, pc.img.y - 8, 40);
  face(sc, 'sparkle', 1200);
  dayDone(sc, ev);
}
const stars = {
  night: true,
  place(sc, ev) {
    ev.nextStar = sc.time.now + 1800;
    const p = ev.st.piece;
    if (p && !ev.t.done && !sc.blocked[p[1] * MW + p[0]]) putPiece(sc, ev, p[0], p[1]);
  },
  tick(sc, ev, time) {
    if (!ev.star && time > ev.nextStar && !sc.showing) shoot(sc, ev);
    const pc = ev.piece;
    if (!pc) return;
    pc.glow.setAlpha(0.38 + 0.12 * Math.sin(time / 260));
    if (time > pc.next) { pc.next = time + 500 + Math.random() * 700; sc.spark.explode(1, pc.img.x, pc.img.y - 3); }
  },
  tap(sc, ev, x, y) {
    if (!ev.star || ev.star.wished || !openGround(sc, ev, x, y)) return false;
    wish(sc, ev);
    return true;
  },
  key(sc, ev) {
    if (!ev.star || ev.star.wished) return false;
    wish(sc, ev);
    return true;
  },
};

// ---------- 반딧불이 밤 ----------
// Fireflies over the pond. Stand still on the bank a moment and one comes and sits on your hand (and
// into the basket); after that a few trail along behind you for the rest of the night.
const pondOf = sc => (sc.pondTiles || []).filter(t => REGION[t.y]?.[t.x] === 'B');
function firefly(sc, x, y, k) {
  const img = lit(sc.keep(sc.add.image(x, y, 'px').setTint(0xeaff9a).setDepth(D.fx - 0.15)));
  img.glow = glowAt(sc, x, y, null, 0.4, 0.4, D.fx - 0.16);
  return { img, x, y, a: Math.random() * 6.3, seed: k * 2.3 + 0.5 };
}
const nearest = (list, ps) => list.slice().sort((a, b) => Math.hypot(a.x - ps.x, a.y - ps.y) - Math.hypot(b.x - ps.x, b.y - ps.y));
function trail(sc, ev) {
  const near = nearest(ev.flies.filter(f => !f.held), sc.ps).slice(0, 3);
  near.forEach(f => { f.held = true; });
  follow(sc, near.map(f => f.img), { gap: 7, lift: 14 });
}
function land(sc, ev) {
  ev.landing = true;
  const ps = sc.ps, f = nearest(ev.flies.filter(o => !o.held), ps)[0];
  if (!f) return;
  f.held = true;
  const x0 = f.x, y0 = f.y;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 1100, ease: 'Sine.inOut',
    onUpdate: tw => {
      const u = tw.getValue(), hx = ps.x + (ps.flipX ? -5 : 5), hy = ps.y - 9;
      f.img.setPosition(Math.round(x0 + (hx - x0) * u), Math.round(y0 + (hy - y0) * u - 6 * Math.sin(Math.PI * u))).setAlpha(1);
      f.img.glow.setPosition(f.img.x, f.img.y).setAlpha(0.5);
    },
    onComplete: () => {
      face(sc, 'sparkle', 1600);
      sc.hooks.onSound?.('wand');
      sc.tweens.add({ targets: f.img.glow, scale: 0.8, alpha: 0.8, duration: 300, yoyo: true, hold: 500 });
      sc.time.delayedCall(900, () => {
        ev.flies = ev.flies.filter(o => o !== f);
        give(sc, 'firefly', 1, { x: f.img.x, y: f.img.y });
        f.img.glow.destroy();
        f.img.destroy();
        dayDone(sc, ev);
        trail(sc, ev);
      });
    },
  });
}
const fireflies = {
  night: true,
  place(sc, ev) {
    const pond = pondOf(sc);
    if (!pond.length) return;
    const xs = pond.map(t => t.x), ys = pond.map(t => t.y);
    ev.box = { x0: Math.min(...xs) * TILE, x1: (Math.max(...xs) + 1) * TILE, y0: (Math.min(...ys) - 1) * TILE, y1: (Math.max(...ys) + 1) * TILE };
    // the bank: the ground right next to the water
    ev.bank = new Set();
    for (const t of pond) for (const [dx, dy] of N8.slice(0, 4)) {
      const x = t.x + dx, y = t.y + dy;
      if ('.*:'.includes(sc.ch(x, y)) && !sc.blocked[y * MW + x]) ev.bank.add(y * MW + x);
    }
    ev.flies = Array.from({ length: 16 }, (_, k) => { const t = pick(pond); return firefly(sc, center(t.x), center(t.y) - 4, k); });
    ev.still = 0;
    if (ev.t.done) trail(sc, ev);
  },
  tick(sc, ev, time, dt) {
    if (!ev.flies) return;
    const s = dt / 1000, b = ev.box;
    for (const f of ev.flies) {
      const on = 0.5 + 0.5 * Math.sin(time / 380 + f.seed * 4);
      if (!f.held) {
        // a wandering heading, turning back at the edge of the pond
        f.a += Math.sin(time / 800 + f.seed * 3) * 1.8 * s;
        f.x += Math.cos(f.a) * 9 * s; f.y += Math.sin(f.a) * 6 * s;
        if (f.x < b.x0 || f.x > b.x1 || f.y < b.y0 || f.y > b.y1) f.a += Math.PI * s * 3;
        f.img.setPosition(Math.round(f.x), Math.round(f.y));
        f.img.glow.setPosition(f.img.x, f.img.y);
      }
      if (f.img.active) { f.img.setAlpha(0.35 + 0.65 * on); f.img.glow.setAlpha(0.12 + 0.3 * on); }
    }
    const ps = sc.ps, still = ev.bank.has(sc.p.y * MW + sc.p.x) && !sc.path.length && !sc.pending && !sc.play && !sc.fishing && time >= (ps.stepUntil || 0) && !ps.diving;
    ev.still = still ? ev.still + dt : 0;
    if (ev.still > 1500 && !ev.t.done && !ev.landing) land(sc, ev);
  },
};

// ---------- 보름달 ----------
// A moonlit night: the moon on the pond, and light leaking round the big tree's tiny door. Knock, and
// someone in there pushes out a moon cookie (one knock a night; after that the door is as it always is).
// (the door in world pixels, as in scenes/village-secrets.js)
const DOOR = () => ({ x0: center(BIG_TREE.x) + 3, y0: foot(BIG_TREE.y) - 11, y1: foot(BIG_TREE.y) - 1 });
function knock(sc, ev, th) {
  th.gone = true;
  ev.st.knocked = true;
  const d = DOOR(), mx = d.x0 + 3, ps = sc.ps;
  sc.hooks.onSound?.('knock');
  float(sc, mx, d.y0 + 2, '똑똑', '#e8d8b8');
  sc.tweens.add({ targets: ps, x: ps.x + Math.sign(mx - ps.x) * 2, duration: 60, yoyo: true, repeat: 1 });
  ev.bright = true;
  sc.tweens.add({ targets: ev.door, alpha: 1, duration: 300 });
  const voice = { x: mx, y: d.y0 + 14, hop: 0, active: true };
  sc.time.delayedCall(800, () => sc.say(voice, '…와 줘서 고마워. 달 과자 하나 줄게.', 2400));
  sc.time.delayedCall(1900, () => {
    give(sc, 'mooncookie', 1, { x: mx, y: d.y1 - 2 }, () => sc.say(ps, '고마워!', 1200));
    dayDone(sc, ev);
  });
  sc.time.delayedCall(3400, () => { ev.bright = false; });
  sc.hooks.onLife?.();
}
const moon = {
  night: 'moon',
  place(sc, ev) {
    const pond = pondOf(sc);
    if (pond.length) {
      const cx = pond.reduce((n, t) => n + t.x, 0) / pond.length, cy = pond.reduce((n, t) => n + t.y, 0) / pond.length;
      const t = nearest(pond, { x: cx, y: cy })[0];
      ev.moon = lit(sc.keep(sc.add.image(center(t.x), center(t.y), tex(sc, 'day_moon', moonCanvas)).setDepth(SHEET() + 0.02).setAlpha(0.8)));
    }
    if (!sc.bigTree) return;
    const d = DOOR();
    ev.door = lit(sc.keep(sc.add.image(d.x0 - 5, d.y0 - 1, tex(sc, 'day_doorlight', doorLightCanvas)).setOrigin(0).setDepth(D.actors + BIG_TREE.y / 100 + 0.0035).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8)));
    if (!ev.st.knocked) addThing(ev, { x: BIG_TREE.x, y: BIG_TREE.y, cells: BIG_TREE.block, tip: '아주 오래된 큰 나무: 작은 문틈으로 불빛이 샌다.', act: knock });
  },
  tick(sc, ev, time) {
    if (ev.moon) ev.moon.setAlpha(0.7 + 0.12 * Math.sin(time / 500)).setFlipX(Math.floor(time / 900) % 2 === 1);
    if (ev.door && !ev.bright) ev.door.setAlpha(0.62 + 0.2 * Math.sin(time / 230) * Math.sin(time / 610));
  },
};

// ---------- 안개 낀 아침 ----------
// Fog, and a little light at the edge of the woods. Come close and it hops on ahead, four times, and stops
// over the spot where the next of the fog's finds (data/play.js FOGS) lies: walk onto it.
function fogPath(sc, rnd) {
  const woodsBy = (x, y) => N8.some(([dx, dy]) => '#T'.includes(sc.ch(x + dx, y + dy)));
  const start = freeSpot(sc, sc.p, 14, rnd, (x, y) => sc.ch(x, y) !== ':' && woodsBy(x, y) && cheb({ x, y }, sc.p) >= 6);
  if (!start) return null;
  const path = [start];
  for (let k = 0; k < 4; k++) {
    const prev = path[path.length - 1];
    const next = freeSpot(sc, prev, 7, rnd, (x, y) => cheb({ x, y }, prev) >= 4 && path.every(o => cheb({ x, y }, o) >= 3) && cheb({ x, y }, sc.p) >= 3);
    if (!next) break;
    path.push(next);
  }
  return path.length >= 3 ? path.map(o => [o.x, o.y]) : null;
}
function hopWisp(sc, ev) {
  const w = ev.wisp, st = ev.st;
  st.hop++;
  const [tx, ty] = st.path[st.hop], x0 = w.img.x, y0 = w.img.y, x1 = center(tx), y1 = foot(ty) - 10;
  w.flying = true;
  w.x = tx; w.y = ty;
  w.th.x = tx; w.th.y = ty;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 650 + Math.hypot(x1 - x0, y1 - y0) * 4, ease: 'Sine.inOut',
    onUpdate: tw => { const u = tw.getValue(); w.img.setPosition(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u - 14 * Math.sin(Math.PI * u))); w.glow.setPosition(w.img.x, w.img.y); },
    onComplete: () => { w.flying = false; w.next = sc.time.now + 900; if (st.hop === st.path.length - 1) stopWisp(sc, ev); },
  });
  sc.hooks.onLife?.();
}
// at the end of its way: it waits over the spot
function stopWisp(sc, ev) {
  const w = ev.wisp;
  w.th.gone = true;
  sc.spark.explode(6, center(w.x), foot(w.y) - 4);
  addThing(ev, { x: w.x, y: w.y, onto: true, tip: '작은 불빛: 여기서 가만히 깜빡이고 있다.', step: fogFind });
}
function fogFind(sc, ev, th) {
  th.gone = true;
  const f = ev.find, w = ev.wisp, ps = sc.ps;
  ev.wisp = null;
  if (w) sc.tweens.add({ targets: [w.img, w.glow], y: w.img.y - 20, alpha: 0, duration: 900, ease: 'Quad.in', onComplete: () => { w.img.destroy(); w.glow.destroy(); } });
  sc.hooks.onSound?.('rustle');
  sc.time.delayedCall(300, () => {
    sc.hooks.onSound?.('chest');
    flyTo(sc, iconKey(sc, f.pic.find), ps.x, ps.y - 4, () => { sc.hooks.onEntry?.(treasureId(f.id)); sc.say(ps, `${f.name}!`, 1600); });
    dayDone(sc, ev);
  });
}
const fog = {
  fog: true,
  place(sc, ev, rnd) {
    const f = nextFog(id => has(sc.meta, id));
    if (!f || ev.t.done) return;
    const st = ev.st;
    if (!st.path || st.path.some(([x, y]) => sc.blocked[y * MW + x])) { st.path = fogPath(sc, rnd); st.hop = 0; }
    if (!st.path) return;
    ev.find = f;
    st.hop = Math.min(st.hop || 0, st.path.length - 1);
    const [x, y] = st.path[st.hop];
    const img = lit(sc.keep(sc.add.image(center(x), foot(y) - 10, tex(sc, 'day_wisp', wispCanvas)).setDepth(D.fx + 0.3)));
    ev.wisp = { img, glow: glowAt(sc, img.x, img.y, 0xc8f0ff, 0.7, 0.5, D.fx + 0.29), x, y, next: 0, flying: false };
    ev.wisp.th = addThing(ev, { x, y, tip: '작은 불빛: 안개 속에서 깜빡인다.' });
    if (st.hop === st.path.length - 1) stopWisp(sc, ev);
  },
  tick(sc, ev, time) {
    const w = ev.wisp;
    if (!w) return;
    if (!w.flying) { w.img.setPosition(center(w.x), Math.round(foot(w.y) - 10 + Math.sin(time / 400) * 1.5)); w.glow.setPosition(w.img.x, w.img.y); }
    w.img.setAlpha(0.75 + 0.25 * Math.sin(time / 170 + Math.sin(time / 530)));
    const st = ev.st;
    if (st.hop < st.path.length - 1 && !w.flying && time > w.next && cheb(w, sc.p) <= 3) hopWisp(sc, ev);
  },
};

// ---------- 모닥불 밤 ----------
// A campfire by the plaza at night, friends sitting round it on logs. Bump it and you sit down with them;
// sitting, a tap on the fire toasts a marshmallow (scenes/village-play.js, through VillageScene dayFire).
const FIRESIDE = ['불 따뜻하다.', '별 많다…', '마시멜로 탄다!', '타닥타닥.', '졸려…'];
// where the logs go round the fire (the side nearest the plaza's middle left free for you)
const SEATS = [[-1, 0], [1, 0], [-1, -1], [1, -1], [0, -1], [-1, 1], [1, 1]];
const flameKey = (sc, f) => tex(sc, `day_flame${f}`, () => flameCanvas(f));
function fireFits(sc, x, y) {
  if (!openCell(sc, x, y)) return false;
  return N8.filter(([dx, dy]) => openCell(sc, x + dx, y + dy)).length >= 5 && !cuts(sc, [[x, y]]);
}
function seat(sc, ev, one, c) {
  const f = ev.fire;
  sc.tweens.killTweensOf(one.s);
  one.x = c.x; one.y = c.y;
  one.busy = true;
  one.s.hop = 0;
  one.s.sy = 0.86;
  one.s.setPosition(center(c.x), foot(c.y)).setDepth(D.actors + c.y / 100).setFlipX(c.x > f.x);
  const log = sc.keep(sc.add.image(center(c.x), foot(c.y) + 3, tex(sc, 'day_seat', seatCanvas)).setOrigin(0.5, 1).setDepth(D.actors + c.y / 100 - 0.0005).setFlipX(c.x > f.x));
  ev.seated.push({ one, s: one.s, log, x: c.x, y: c.y });
}
// friends from the meadow round the fire (three at most); a villager or two when there are not enough
function seatFriends(sc, ev) {
  const f = ev.fire, room = 3 - ev.seated.length;
  if (room <= 0) return;
  const spots = SEATS.map(([dx, dy]) => ({ x: f.x + dx, y: f.y + dy })).filter(c => openCell(sc, c.x, c.y) && !sc.heroAt(c.x, c.y)).slice(0, room);
  const who = sc.heroes.filter(h => !h.busy).slice(0, room);
  for (const id of ['neighbor', 'rescue', 'rival', 'carpenter', 'smith']) {
    const one = sc.folk.find(o => o.id === id && !o.busy && o.s.alpha === 1);
    if (one && who.length + ev.seated.length < 2) who.push(one);
  }
  spots.forEach((c, i) => who[i] && seat(sc, ev, who[i], c));
}
function sitDown(sc, ev) {
  if (ev.sitting) return;
  const f = ev.fire, ps = sc.ps;
  ev.sitting = true;
  ps.setFlipX(center(f.x) < ps.x);
  ps.sy = 0.86;
  sc.dust.explode(3, ps.x, ps.y);
  const o = nearest(ev.seated.filter(q => q.s.active), sc.p)[0];
  if (o) sc.time.delayedCall(250, () => sayAs(sc, o.one, ev.t.done ? '불 따뜻하지?' : '왔구나! 여기 앉아.', 1600));
  dayDone(sc, ev);
}
const campfire = {
  night: true,
  place(sc, ev, rnd) {
    const st = ev.st, fits = (x, y) => fireFits(sc, x, y);
    let at = st.fire && fits(st.fire[0], st.fire[1]) ? { x: st.fire[0], y: st.fire[1] } : null;
    at ||= freeSpot(sc, PLAZA, 6, rnd, fits) || freeSpot(sc, PLAZA, 10, rnd, fits);
    ev.seated = [];
    if (!at) return;
    st.fire = [at.x, at.y];
    const { x, y } = at;
    block(sc, [[x, y]]);
    const base = sc.keep(sc.add.image(center(x), foot(y), sc.growthKey('campfire')).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    const flame = lit(sc.keep(sc.add.image(center(x), foot(y), flameKey(sc, 0)).setOrigin(0.5, 1).setDepth(base.depth + 0.0002)));
    ev.fire = { x, y, flame, glow: glowAt(sc, center(x), foot(y) - 8, 0xffa850, 2.2, 0.5, D.fx - 0.3), frame: 0, next: 0 };
    seatFriends(sc, ev);
    addThing(ev, { x, y, act: sitDown, tip: () => (ev.sitting ? '모닥불: 마시멜로를 구워 먹자.' : '모닥불: 친구들이 둘러앉아 불을 쬐고 있다.') });
  },
  tick(sc, ev, time) {
    const f = ev.fire;
    if (!f) return;
    const fr = Math.floor(time / 130) % FLAME_FRAMES;
    if (fr !== f.frame) { f.frame = fr; f.flame.setTexture(flameKey(sc, fr)); }
    f.glow.setAlpha(0.42 + 0.06 * Math.sin(time / 90) + 0.04 * Math.sin(time / 37));
    if (time > f.next) {
      f.next = time + 300 + Math.random() * 400;
      if (Math.random() < 0.5) sc.spark.explode(1, center(f.x) + (Math.random() - 0.5) * 6, foot(f.y) - 12);
      else sc.smoke.explode(1, center(f.x), foot(f.y) - 16);
    }
    // the guild changed who is out today and the meadow's friends were put out afresh: round the fire again
    const gone = ev.seated.filter(o => !o.s.active);
    if (gone.length) {
      gone.forEach(o => o.log.destroy());
      ev.seated = ev.seated.filter(o => o.s.active);
      seatFriends(sc, ev);
    }
    if (time > (ev.chatAt || 0)) {
      ev.chatAt = time + 6000 + Math.random() * 5000;
      const o = pick(ev.seated);
      if (o && cheb(o, sc.p) <= 6 && !sc.play) sc.say(o.s, pick(FIRESIDE), 1500);
    }
  },
  stepOn(sc, ev) {
    if (!ev.sitting) return;
    ev.sitting = false;
    sc.ps.sy = 1;
  },
  // a friend at the fire just chats (no swapping places with them tonight)
  meet(sc, ev, who) {
    if (!ev.seated?.some(o => o.one === who)) return false;
    sc.say(who.s, pick(FIRESIDE), 1400);
    return true;
  },
  describe(sc, ev, x, y) {
    const o = ev.seated?.find(q => q.x === x && q.y === y && q.s.active);
    return o ? `${o.one.f ? o.one.f.name : CHARACTERS[o.one.id].name}: 모닥불 앞에 앉아 불을 쬐고 있다.` : '';
  },
  fire(sc, ev, x, y) {
    const f = ev.fire;
    return f && ev.sitting && f.x === x && f.y === y ? { x: center(x), y: foot(y) - 9, tx: x, ty: y } : null;
  },
};

const DAYS_A = { rain, market, stars, fireflies, moon, fog, campfire };
