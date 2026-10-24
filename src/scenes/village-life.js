// 마을 생활 in the village (v0.30, data/life.js): fishing in the pond and the creek, bugs to catch with the
// net, wild things to pick up, the vegetable bed in your yard, and your pet trotting along behind you.
// What there is today was rolled when you first walked in on this village day (a day passes with each
// trip, main.js); what you catch, pick or pull up goes in the basket (hooks.onCatch: main.js puts it in
// meta.bag, and the book gets its page the first time).
// Tap a bug, the bed or (rod in hand) the water and you walk up to it and do what it takes; a wild thing
// you just walk over. Fishing: the float goes in, and when it bobs under (a '!' over you) a tap pulls the
// fish up; too soon and you just reel in, too late and it gets away. Nothing here costs anything but the
// day's bites and bugs, so nothing can go badly wrong.

import { TILE, rowsCanvas } from './textures.js';
import { D } from './VillageScene.js';
import { setEmote, drawEmote } from './emotes.js';
import { ripple, float, face, koiLeap } from './village-secrets.js';
import { petCheer } from './village-pets.js';
import { bedCanvas, wetCanvas, growCanvas, floatCanvas, MOUND_AT } from './village-life-art.js';
import { findIcon } from '../data/finds-art.js';
import {
  BUGS, FORAGE, CROPS, ITEM, LIFE_TOOLS, BITE_WINDOW, NET_CATCH, GARDEN_BASE, fishFor, rollDay, plotCount, ripe, cropStage, daysLeft, isSeed, lifeEntry,
} from '../data/life.js';
import { REGION } from '../data/village-map.js';
import { VILLAGE_MAP, PROPS, shownIn, villageP } from '../data/village.js';
import { DECOR, hasDecor } from '../data/home.js';
import { PETS, petLevel } from '../data/pets.js';
import { has } from '../data/book.js';
import { DAY_LIFE } from '../data/play.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// the yard's bed: the carpenter's four plots, and two more on the right with 텃밭 넓히기
const GARDEN = DECOR.find(d => d.id === 'garden');
export const GARDEN_MORE = [[43, 18], [43, 19]];
const PLOT_CELLS = [...GARDEN.at, ...GARDEN_MORE];
export const bedWide = meta => plotCount(meta) > GARDEN_BASE;
export const bedArt = cols => bedCanvas(cols);

const tex = (sc, key, make) => { if (!sc.textures.exists(key)) sc.textures.addCanvas(key, make()); return key; };
export const lifeKey = (sc, id) => tex(sc, `life_${id}`, () => rowsCanvas(findIcon(...ITEM[id].pic.find)));

// ---------- today ----------
// where things can turn up today, by kind: a bug's tree is the tree itself (it sits on the trunk), a wild
// thing's the grass under one; a pond bug hovers over water by the bank
function spotsOf(sc) {
  const bug = { flower: [], tree: [], grass: [], pond: [] }, wild = { flower: [], tree: [], grass: [], hive: [] };
  const free = (x, y) => x > 0 && y > 0 && x < MW - 1 && y < MH - 1 && sc.walkable(x, y) && !sc.isNew(x, y) && sc.ch(x, y) !== '>';
  const byFree = (x, y) => N4.some(([dx, dy]) => free(x + dx, y + dy));
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    const ch = sc.ch(x, y);
    if (ch === '*' && free(x, y)) { bug.flower.push({ x, y }); wild.flower.push({ x, y }); }
    else if (ch === '.' && free(x, y)) {
      bug.grass.push({ x, y });
      wild.grass.push({ x, y });
      if (N4.some(([dx, dy]) => sc.ch(x + dx, y + dy) === 'T')) wild.tree.push({ x, y });
    } else if (ch === 'T' && byFree(x, y) && !sc.isNew(x, y)) bug.tree.push({ x, y });
    else if (ch === '~' && byFree(x, y) && !sc.isNew(x, y)) bug.pond.push({ x, y });
  }
  for (const pr of PROPS.filter(p => p.kind === 'hive' && shownIn(p, sc.st))) {
    for (const [dx, dy] of N4) if (free(pr.x + dx, pr.y + dy)) wild.hive.push({ x: pr.x + dx, y: pr.y + dy });
  }
  return { bug, wild };
}
// still a good spot for it (the village may have grown over it since the morning)
function stillThere(sc, o, kind, where) {
  const ch = sc.ch(o.x, o.y);
  if (kind === 'bug') return where === 'tree' ? ch === 'T' : where === 'pond' ? ch === '~' : where === 'flower' ? ch === '*' : ch === '.';
  return (ch === '.' || ch === '*') && !sc.blocked[o.y * MW + o.x];
}
// today's fish, bugs and wild things (a new day rolls them afresh; what is going on today has its say:
// data/play.js DAY_LIFE, scenes/village-days.js)
export function today(sc) {
  const meta = sc.meta, t = meta.today;
  if (meta.life?.day === (meta.day || 0)) return meta.life;
  const { bug, wild } = spotsOf(sc);
  rollDay(meta, bug, wild, Math.random, t && t.day === (meta.day || 0) ? DAY_LIFE[t.ev] || null : null);
  sc.hooks.onLife?.();
  return meta.life;
}

// ---------- putting it all out ----------
export function placeVillageLife(sc) {
  sc.fishing = null;
  sc.lifeBugs = [];
  sc.lifeWild = [];
  const life = today(sc);
  for (const b of life.bugs) {
    if (!BUGS[b.id] || !stillThere(sc, b, 'bug', BUGS[b.id].where)) continue;
    sc.lifeBugs.push(bugImg(sc, b));
  }
  for (const f of life.forage) {
    if (!FORAGE[f.id] || !stillThere(sc, f, 'wild')) continue;
    const img = sc.keep(sc.add.image(center(f.x), foot(f.y) - 2, lifeKey(sc, f.id)).setOrigin(0.5, 1).setDepth(D.deco + 0.3));
    sc.lifeWild.push({ ...f, img, next: 0 });
  }
  drawBed(sc);
}

// a bug where it sits: on a flower's head, low on a trunk, in the grass, or hovering over the water
function bugImg(sc, b) {
  const B = BUGS[b.id], at = bugAt(b.x, b.y, B.where);
  const img = sc.keep(sc.add.image(at.x, at.y, lifeKey(sc, b.id)).setOrigin(0.5, 1).setDepth(D.actors + b.y / 100 + 0.006));
  const shape = B.pic.find[0];
  return { ...b, img, shape, base: at, seed: Math.random() * 6, next: 0 };
}
const bugAt = (x, y, where) => ({ x: center(x) + (where === 'tree' ? 2 : 0), y: where === 'tree' ? foot(y) - 7 : where === 'pond' ? center(y) - 2 : where === 'flower' ? foot(y) - 6 : foot(y) - 2 });

// ---------- the bed ----------
const plotsOf = sc => (hasDecor(sc.meta, 'garden') ? PLOT_CELLS.slice(0, plotCount(sc.meta)) : []);
const plotIndex = (sc, x, y) => plotsOf(sc).findIndex(([px, py]) => px === x && py === y);
export function drawBed(sc) {
  for (const p of sc.plots) for (const k of ['wet', 'grow', 'crop']) p[k]?.destroy();
  sc.plots = [];
  const cells = plotsOf(sc), g = sc.meta.garden ||= [], z = D.actors + Math.max(...PLOT_CELLS.map(c => c[1])) / 100;
  cells.forEach(([x, y], i) => {
    const p = g[i], one = { i, x, y }, x0 = x * TILE + MOUND_AT, y0 = y * TILE + MOUND_AT;
    if (p?.wet) one.wet = sc.keep(sc.add.image(x0, y0, tex(sc, 'life_wet', wetCanvas)).setOrigin(0).setDepth(z + 0.001));
    const st = cropStage(p);
    if (st >= 0) one.grow = sc.keep(sc.add.image(center(x), y * TILE + 12, tex(sc, `life_grow${Math.min(2, st)}`, () => growCanvas(Math.min(2, st)))).setOrigin(0.5, 1).setDepth(z + 0.002));
    if (st === 3) one.crop = sc.keep(sc.add.image(center(x), y * TILE + 11, lifeKey(sc, p.crop)).setOrigin(0.5, 1).setDepth(z + 0.003));
    sc.plots.push(one);
  });
}
const emptyPlots = sc => plotsOf(sc).map((_, i) => i).filter(i => !sc.meta.garden[i]?.crop);
const seedsInBag = meta => Object.keys(meta.bag || {}).filter(id => isSeed(id) && meta.bag[id] > 0);

// Seeds in (the seed sheet, ui/life.js, calls this through VillageScene.plantSeeds): in the plots
// given, as far as the seeds go
export function plantSeeds(sc, crop, idxs) {
  const meta = sc.meta, key = `seed:${crop}`;
  let n = 0;
  for (const i of idxs) {
    if (!(meta.bag?.[key] > 0) || meta.garden[i]?.crop) continue;
    meta.garden[i] = { crop, grown: 0, wet: false };
    meta.bag[key]--;
    if (!meta.bag[key]) delete meta.bag[key];
    n++;
  }
  if (!n) return 0;
  drawBed(sc);
  for (const i of idxs) {
    const p = sc.plots[i];
    if (!p?.grow) continue;
    sc.dust.explode(5, center(p.x), p.y * TILE + 11);
    p.grow.setScale(0.3);
    sc.tweens.add({ targets: p.grow, scale: 1, duration: 260, ease: 'Back.out' });
  }
  sc.hooks.onSound?.('pop');
  face(sc, 'sparkle', 900);
  sc.hooks.onLife?.();
  return n;
}

// at the bed: pull up what is ready, else plant, else water, else see how it is coming on
function tendBed(sc, i) {
  const meta = sc.meta, g = meta.garden, cells = plotsOf(sc);
  const ready = cells.map((_, k) => k).filter(k => ripe(g[k]));
  if (ready.length) {
    ready.forEach((k, n) => sc.time.delayedCall(n * 160, () => {
      const p = g[k], one = sc.plots[k];
      if (!p) return;
      const extra = Math.random() < 0.25 ? 1 : 0;
      g[k] = null;
      sc.dust.explode(8, center(one.x), one.y * TILE + 10);
      catchIt(sc, p.crop, center(one.x), one.y * TILE + 8, extra);
      if (n === ready.length - 1) { drawBed(sc); sc.hooks.onLife?.(); }
    }));
    return;
  }
  const p = g[i];
  if (!p?.crop) {
    if (seedsInBag(meta).length) sc.hooks.onPlant?.(i, emptyPlots(sc));
    else { setEmote(sc.ps, '?', sc.time.now, 1100); sc.hooks.onHover?.('빈 밭이다. 씨앗이 있으면 심을 수 있다.', true); }
    return;
  }
  const dry = cells.map((_, k) => k).filter(k => g[k]?.crop && !ripe(g[k]) && !g[k].wet);
  if ((meta.tools?.can || 0) >= 1 && dry.length) {
    for (const k of dry) g[k].wet = true;
    sc.hooks.onSound?.('water');
    for (const k of dry) { const one = sc.plots[k]; sc.drops.explode(8, center(one.x), one.y * TILE + 4); }
    sc.time.delayedCall(160, () => drawBed(sc));
    face(sc, 'sparkle', 900);
    sc.hooks.onLife?.();
    return;
  }
  setEmote(sc.ps, '♪', sc.time.now, 1000);
  sc.hooks.onHover?.(bedLine(sc, i), true);
}
function bedLine(sc, i) {
  const p = sc.meta.garden[i];
  if (!p?.crop) return seedsInBag(sc.meta).length ? '빈 밭: 씨앗을 심을 수 있다.' : '빈 밭: 씨앗이 있으면 심을 수 있다.';
  const c = CROPS[p.crop], left = daysLeft(p);
  if (!left) return `${c.name}: 다 자랐다! 뽑자.`;
  return `${c.name}: ${left === 1 ? '내일이면' : `${left}일 뒤면`} 다 자란다${p.wet ? ' (오늘 물 줬다)' : ''}.`;
}

// ---------- catching ----------
// what you got: up out of the water (or the net, or the dirt) to over your head, you hold it up, and
// into the basket it goes (`extra`: one more of it)
function catchIt(sc, id, fx, fy, extra = 0) {
  const it = ITEM[id], ps = sc.ps, img = sc.add.image(fx, fy, lifeKey(sc, id)).setDepth(D.bubble - 0.2);
  const tx = ps.x, ty = ps.y - 30;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 380, ease: 'Linear',
    onUpdate: tw => { const u = tw.getValue(); img.setPosition(Math.round(fx + (tx - fx) * u), Math.round(fy + (ty - fy) * u - 16 * Math.sin(u * Math.PI))); },
    onComplete: () => {
      sc.spark.explode(10, tx, ty);
      sc.tweens.add({ targets: img, y: ty - 2, duration: 120, yoyo: true, repeat: 2 });
      sc.tweens.add({ targets: img, alpha: 0, delay: 1000, duration: 260, onComplete: () => img.destroy() });
    },
  });
  const junk = it.junk, rare = it.rare && !junk;
  face(sc, junk ? 'shock' : 'sparkle', 1300);
  sc.time.delayedCall(380, () => sc.say(ps, `${it.name}${junk ? '…' : rare ? '!!' : '!'}${extra ? ' 두 개!' : ''}`, 1500));
  petCheer(sc);
  sc.hooks.onSound?.('pop');
  sc.hooks.onCatch?.(id, 1 + extra);
}

// ---------- the net ----------
function swingAt(sc, b) {
  const meta = sc.meta, net = meta.tools?.net || 0, B = BUGS[b.id];
  if (b.x !== sc.p.x) sc.ps.setFlipX(b.x < sc.p.x);
  lean(sc, b.x, b.y);
  sc.hooks.onSound?.('rustle');
  if (net) {
    const pic = LIFE_TOOLS[`net${Math.min(3, net)}`].pic.find, key = tex(sc, `life_net${Math.min(3, net)}`, () => rowsCanvas(findIcon(...pic)));
    const n = sc.add.image(b.img.x, b.img.y - 10, key).setDepth(D.bubble - 0.3);
    sc.tweens.add({ targets: n, y: b.img.y - 2, duration: 140, ease: 'Quad.in', onComplete: () => sc.tweens.add({ targets: n, alpha: 0, duration: 200, onComplete: () => n.destroy() }) });
  }
  const got = net && Math.random() < NET_CATCH(net, B.net);
  sc.time.delayedCall(150, () => {
    if (got) {
      sc.lifeBugs = sc.lifeBugs.filter(o => o !== b);
      today(sc).bugs = today(sc).bugs.filter(o => !(o.x === b.x && o.y === b.y && o.id === b.id));
      b.img.destroy();
      catchIt(sc, b.id, b.img.x, b.img.y - 4);
      sc.hooks.onLife?.();
      return;
    }
    // away it goes: a shy one for the day, the rest only as far as another spot like the last
    float(sc, b.img.x, b.img.y - 4, '휙', '#e8f4ff');
    sc.hooks.onSound?.('buzz');
    face(sc, 'shock', 700);
    flyOff(sc, b, net && B.shy);
  });
}
function flyOff(sc, b, gone) {
  const life = today(sc), entry = life.bugs.find(o => o.x === b.x && o.y === b.y && o.id === b.id);
  const { bug } = spotsOf(sc), used = new Set(sc.lifeBugs.map(o => `${o.x},${o.y}`));
  const spots = (bug[BUGS[b.id].where] || []).filter(c => !used.has(`${c.x},${c.y}`) && Math.abs(c.x - sc.p.x) + Math.abs(c.y - sc.p.y) > 3);
  const to = !gone && spots.length ? spots[Math.floor(Math.random() * spots.length)] : null;
  b.busy = true;
  if (!to) {
    sc.lifeBugs = sc.lifeBugs.filter(o => o !== b);
    life.bugs = life.bugs.filter(o => o !== entry);
    sc.tweens.add({ targets: b.img, y: b.img.y - 60, x: b.img.x + (Math.random() < 0.5 ? -30 : 30), alpha: 0, duration: 900, ease: 'Quad.in', onComplete: () => b.img.destroy() });
  } else {
    const at = bugAt(to.x, to.y, BUGS[b.id].where), x0 = b.img.x, y0 = b.img.y, dist = Math.hypot(at.x - x0, at.y - y0);
    sc.tweens.addCounter({
      from: 0, to: 1, duration: Math.min(1600, 300 + dist * 6), ease: 'Sine.inOut',
      onUpdate: tw => { const u = tw.getValue(); b.img.setPosition(Math.round(x0 + (at.x - x0) * u), Math.round(y0 + (at.y - y0) * u - 24 * Math.sin(u * Math.PI))); },
      onComplete: () => { b.busy = false; b.base = at; b.img.setDepth(D.actors + to.y / 100 + 0.006); },
    });
    Object.assign(b, { x: to.x, y: to.y });
    if (entry) Object.assign(entry, { x: to.x, y: to.y });
  }
  sc.hooks.onLife?.();
}
function lean(sc, x, y) {
  const ps = sc.ps, bx = center(sc.p.x), by = foot(sc.p.y);
  sc.tweens.killTweensOf(ps);
  ps.setPosition(bx, by);
  sc.tweens.add({ targets: ps, x: bx + Math.sign(x - sc.p.x) * 3, y: by + Math.sign(y - sc.p.y) * 3, duration: 60, yoyo: true, ease: 'Quad.out' });
}

// ---------- the rod ----------
const whereOf = (x, y) => (REGION[y]?.[x] === 'B' ? 'pond' : 'creek');
function castAt(sc, x, y) {
  const life = today(sc), where = whereOf(x, y), now = sc.time.now;
  if (x !== sc.p.x) sc.ps.setFlipX(x < sc.p.x);
  const bob = sc.keep(sc.add.image(center(x), center(y) + 2, tex(sc, 'life_float', floatCanvas)).setOrigin(0.5, 1).setDepth(D.deco + 0.75));
  const line = sc.keep(sc.add.graphics().setDepth(D.actors + sc.p.y / 100 + 0.01));
  sc.hooks.onSound?.('pluck');
  sc.time.delayedCall(120, () => { ripple(sc, bob.x, bob.y - 1); sc.hooks.onSound?.('splash'); });
  const empty = !(life.bites[where] > 0);
  const wait = empty ? 3600 : 1400 + Math.random() * 2600;
  // a nibble or two first, to keep you on your toes (a tap then only reels in)
  const nibbles = empty ? [] : Array.from({ length: Math.floor(Math.random() * 3) }, () => now + 500 + Math.random() * (wait - 700));
  sc.fishing = { x, y, where, phase: 'wait', at: now + wait, nibbles, bob, line, empty, base: bob.y };
  // the big koi, now and then, when it feels like showing off
  if (where === 'pond' && Math.random() < (sc.hooks.found?.('koi') ? 0.03 : 0.1)) sc.time.delayedCall(700, () => sc.fishing && koiLeap(sc, x, y));
}
// a tap (or a key) while the line is out
export function reel(sc) {
  const f = sc.fishing;
  if (!f) return false;
  if (f.phase === 'bite') {
    const life = today(sc);
    life.bites[f.where] = Math.max(0, (life.bites[f.where] || 0) - 1);
    const fish = fishFor(f.where, sc.meta.tools?.rod || 1, villageP(sc.meta));
    const bx = f.bob.x, by = f.bob.y;
    sc.drops.explode(14, bx, by);
    ripple(sc, bx, by);
    endFishing(sc);
    catchIt(sc, fish.id, bx, by - 2);
    sc.hooks.onLife?.();
    return true;
  }
  // too soon: nothing on it yet
  endFishing(sc);
  setEmote(sc.ps, '…', sc.time.now, 900);
  return true;
}
export function endFishing(sc) {
  const f = sc.fishing;
  if (!f) return;
  sc.fishing = null;
  f.line.destroy();
  sc.tweens.add({ targets: f.bob, alpha: 0, y: f.bob.y - 4, duration: 160, onComplete: () => f.bob.destroy() });
}
function fishTick(sc, time) {
  const f = sc.fishing;
  if (!f) return;
  // the line: from the rod's tip by your hand to the float, sagging a little, a pixel at a time
  const ps = sc.ps, dir = ps.flipX ? -1 : 1, hx = Math.round(ps.x + dir * 6), hy = Math.round(ps.y - 12), bx = f.bob.x, by = f.bob.y - 4;
  const g = f.line;
  g.clear();
  g.fillStyle(0xe8e4f0, 0.9);
  const n = Math.max(6, Math.round(Math.hypot(bx - hx, by - hy)));
  for (let k = 0; k <= n; k++) {
    const u = k / n, sag = 4 * Math.sin(u * Math.PI);
    g.fillRect(Math.round(hx + (bx - hx) * u), Math.round(hy + (by - hy) * u + sag), 1, 1);
  }
  g.fillStyle(0x6e4a2a, 1);
  g.fillRect(hx - dir, hy - 1, 1, 1);
  if (f.phase === 'wait') {
    f.bob.y = Math.round(f.base + Math.sin(time / 320) * 0.6);
    if (f.nibbles.length && time >= f.nibbles[0]) {
      f.nibbles.shift();
      sc.tweens.add({ targets: f.bob, y: f.base + 1, duration: 90, yoyo: true });
      ripple(sc, f.bob.x, f.base - 1);
    }
    if (time < f.at) return;
    if (f.empty) {
      // nothing bites today here: in it comes, with a sigh
      endFishing(sc);
      setEmote(sc.ps, '…', time, 1200);
      sc.hooks.onHover?.('오늘은 입질이 없다. 내일 다시 오자.', true);
      return;
    }
    f.phase = 'bite';
    f.until = time + BITE_WINDOW[Math.min(3, sc.meta.tools?.rod || 1)];
    f.bob.y = f.base + 3;
    sc.drops.explode(8, f.bob.x, f.base - 2);
    ripple(sc, f.bob.x, f.base - 1);
    setEmote(sc.ps, '!', time, f.until - time);
    sc.hooks.onSound?.('splash');
    return;
  }
  // the bite: it tugs, then it is gone
  f.bob.y = f.base + 2 + (Math.floor(time / 70) % 2);
  if (time < f.until) return;
  const life = today(sc);
  life.bites[f.where] = Math.max(0, (life.bites[f.where] || 0) - 1);
  float(sc, f.bob.x, f.base - 6, '첨벙', '#9fd4ff');
  endFishing(sc);
  setEmote(sc.ps, '…', time, 1000);
  face(sc, 'shock', 800);
  sc.hooks.onLife?.();
}

// ---------- every frame ----------
export function lifeTick(sc, time, dt) {
  fishTick(sc, time);
  for (const b of sc.lifeBugs || []) {
    if (b.busy) continue;
    const t = time / 1000 + b.seed, x = b.base.x, y = b.base.y;
    switch (b.shape) {
      // wings beating, a slow bob
      case 'bfly': case 'moth': case 'dfly':
        b.img.setScale(Math.floor(time / 140 + b.seed * 3) % 2 ? 1 : 0.7, 1).setPosition(x + Math.round(Math.sin(t * 0.9) * 1.5), y + Math.round(Math.sin(t * 2.3)));
        break;
      case 'bee':
        b.img.setPosition(x + (Math.floor(time / 90) % 2), y + Math.round(Math.sin(t * 5)));
        break;
      // a hop now and then
      case 'hopper':
        if (time > b.next) { b.next = time + 1800 + Math.random() * 2600; sc.tweens.add({ targets: b.img, y: y - 4, duration: 140, yoyo: true, ease: 'Quad.out' }); }
        break;
      case 'firefly':
        b.img.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(t * 1.7))).setPosition(x + Math.round(Math.sin(t * 0.7) * 2), y + Math.round(Math.sin(t * 1.3) * 1.5));
        break;
      // the shelled ones sit still where they are (a twitchy side-step read as a roach)
      default:
        break;
    }
  }
  // the wild things catch the light now and then, so you notice them
  for (const f of sc.lifeWild || []) {
    if (time < f.next) continue;
    f.next = time + 2200 + Math.random() * 3000;
    sc.spark.explode(2, f.img.x + (Math.random() - 0.5) * 6, f.img.y - 6);
  }
  // what is ready in the bed bobs
  for (const p of sc.plots || []) if (p.crop) p.crop.y = p.y * TILE + 11 - (Math.floor(time / 500 + p.i) % 2);
}
export function lifeMarks(sc, mk, time) {
}

// ---------- what a tap or a bump does ----------
const bugOn = (sc, x, y) => (sc.lifeBugs || []).find(b => b.x === x && b.y === y && !b.busy);
const canFish = (sc, x, y) => (sc.meta.tools?.rod || 0) >= 1 && sc.ch(x, y) === '~';
// something of village life at this cell to walk up to (null: nothing)
export function lifeTarget(sc, x, y) {
  if (bugOn(sc, x, y)) return { life: 'bug', x, y };
  const i = plotIndex(sc, x, y);
  if (i >= 0) return { life: 'bed', x, y, i };
  if (canFish(sc, x, y)) return { life: 'fish', x, y };
  return null;
}
// a tap on the map: true when village life took it
export function lifeTap(sc, x, y) {
  const f = sc.fishing;
  if (f) {
    // with a bite on, any tap pulls; otherwise a tap on the water reels in, and anywhere else you put
    // the rod away and go
    if (f.phase === 'bite' || (x === f.x && y === f.y) || sc.ch(x, y) === '~') return reel(sc);
    endFishing(sc);
  }
  const it = lifeTarget(sc, x, y);
  if (!it) return false;
  const near = sc.near(it);
  if (near === 0) lifeAct(sc, it);
  else if (near) { sc.path = near; sc.pending = it; }
  return true;
}
// a key pressed towards (x, y): true when village life took it
export function lifeStep(sc, x, y) {
  if (sc.fishing) { reel(sc); return true; }
  const it = lifeTarget(sc, x, y);
  if (!it) return false;
  lifeAct(sc, it);
  return true;
}
// next to it now: do it
export function lifeAct(sc, it) {
  sc.path = [];
  sc.pending = null;
  if (it.life === 'bug') { const b = bugOn(sc, it.x, it.y); if (b) swingAt(sc, b); return; }
  if (it.life === 'bed') { tendBed(sc, it.i); return; }
  if (it.life === 'fish' && !sc.fishing) castAt(sc, it.x, it.y);
}
// you stepped onto (x, y): a wild thing there goes in the basket, a bug sitting there flits off;
// walking puts the rod away
export function lifeStepOn(sc, x, y) {
  if (sc.fishing) endFishing(sc);
  const b = bugOn(sc, x, y);
  if (b) { float(sc, b.img.x, b.img.y - 4, '휙', '#e8f4ff'); flyOff(sc, b, false); }
  const f = (sc.lifeWild || []).find(o => o.x === x && o.y === y);
  if (!f) return;
  sc.lifeWild = sc.lifeWild.filter(o => o !== f);
  const life = today(sc);
  life.forage = life.forage.filter(o => !(o.x === x && o.y === y && o.id === f.id));
  sc.time.delayedCall(100, () => {
    sc.hooks.onSound?.('pluck');
    catchIt(sc, f.id, f.img.x, f.img.y - 4);
    f.img.destroy();
    sc.hooks.onLife?.();
  });
}
// what it is, for the tip line
export function lifeDescribe(sc, x, y) {
  const b = bugOn(sc, x, y);
  if (b) {
    const known = has(sc.meta, lifeEntry(b.id));
    const what = known ? BUGS[b.id].name : '처음 보는 곤충';
    return (sc.meta.tools?.net || 0) ? `${what}: 다가가서 잠자리채를 휘두르자.` : `${what}: 손으로는 못 잡겠다.`;
  }
  const i = plotIndex(sc, x, y);
  if (i >= 0) return `텃밭 · ${bedLine(sc, i)}`;
  const f = (sc.lifeWild || []).find(o => o.x === x && o.y === y);
  if (f) return has(sc.meta, lifeEntry(f.id)) ? `${FORAGE[f.id].name}: 주워 가자.` : '뭔가 떨어져 있다.';
  if (sc.ch(x, y) === '~' && (sc.meta.tools?.rod || 0) >= 1) {
    const left = today(sc).bites[whereOf(x, y)] || 0;
    const name = whereOf(x, y) === 'pond' ? '연못' : '개울';
    return left ? `${name}: 낚싯대를 드리워 보자.` : `${name}: 오늘은 입질이 없을 것 같다.`;
  }
  return '';
}
