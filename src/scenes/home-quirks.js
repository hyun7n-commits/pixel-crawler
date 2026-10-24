// 작은 장난 at home (v0.30, data/quirks.js): the room's own little odd things. Stand at a window, under
// the painting or by the bookshelf a while; knock on the cuckoo clock, water the plant, squeeze the
// plushies or get in the bath one time too many; wind the music box and sit down, sit by a friend on the
// sofa, go to bed in the dark or straight out of the bath; cook something with fish in it, or something
// nobody can name; lift the bed or the wardrobe, or put the plant in the sun. Each one happens once a
// visit, and the first time ever it gets its page in the book (hooks.onEntry).
// HomeScene calls in here: placeHomeQuirks (enter), homeQuirkTap / homeQuirkStep / homeQuirkMeet (true
// when the tap, the key or the bump was taken) and homeQuirkTick (every frame, last).

import { TILE, texScale } from './textures.js';
import { setEmote, drawEmote } from './emotes.js';
import { critterCanvas } from './village-props.js';
import { WALL_ROWS, roomSize } from './home-interior-art.js';
import { qtex } from './quirks-art.js';
import { windowSlots } from '../data/home.js';
import { FOLK } from '../data/village.js';
import { quirkId, QK } from '../data/quirks.js';

// HomeScene's layers
const D = { room: 0, wall: 1, actors: 3, dim: 3.9, fx: 4, bubble: 5 };
const mid = x => (x + 1) * TILE + TILE / 2;
const foot = y => (y + WALL_ROWS + 1) * TILE;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const modalUp = () => document.getElementById('modal')?.hidden === false;
const got = (sc, id) => sc.hooks.onEntry?.(quirkId(id));
const later = (sc, ms, fn) => sc.time.delayedCall(ms, fn);
const FISH_DISHES = ['grilledfish', 'sashimi', 'spicyfish', 'tomatostew', 'fishveg', 'fishmush', 'fishsoup', 'fishfruit', 'eelbowl', 'goldfeast'];
const fishDishes = m => FISH_DISHES.reduce((n, id) => n + (m.bag?.[id] || 0), 0);
// a window's glass, in room pixels
const glass = s => ({ x: (s + 1) * TILE + 3, y: 7, w: 10, h: 13 });

// ---------- coming in ----------
export function placeHomeQuirks(sc) {
  const plant = sc.items.find(it => it.id === 'plant');
  sc.hq = {
    done: new Set(), at: null, from: 0, busyUntil: 0, marks: [], talkAt: -1e9,
    water: { n: 0, t: 0 }, squeak: { n: 0, t: 0 }, clock: { n: 0, t: 0 }, baths: [], musicAt: -1e9, lull: null,
    sleepAt: 0, bathEnd: -1e9, was: null, sofaAt: 0, held: null, stars: null, pend: null, cook: null, clockOpen: 0,
    plantAt: plant ? `${plant.x},${plant.y}` : null, mystery: sc.meta.bag?.mystery || 0, fish: fishDishes(sc.meta),
  };
  sc.hq.g = sc.keep(sc.add.graphics().setDepth(D.bubble - 0.1));
  sc.hq.soot = sc.keep(sc.add.particles(0, 0, 'px', {
    emitting: false, lifespan: { min: 800, max: 1400 }, speedY: { min: -26, max: -10 }, speedX: { min: -10, max: 10 },
    scale: { start: 2, end: 3.5 }, alpha: { start: 0.8, end: 0 }, tint: [0x3a3550, 0x26223a, 0x4b5064],
  }).setDepth(D.fx));
  sc.hq.fluff = sc.keep(sc.add.particles(0, 0, 'px', {
    emitting: false, lifespan: { min: 600, max: 1000 }, speed: { min: 10, max: 40 }, gravityY: 30,
    scale: { start: 1.4, end: 0.6 }, tint: [0xa0703f, 0xf4f0e8, 0x5e3d24],
  }).setDepth(D.fx));
}

// ---------- little helpers ----------
// a mark over something that is not you or the friend (they have their own)
function mark(sc, s, kind, ms = 1100, dy = 12) {
  setEmote(s, kind, sc.time.now, ms);
  if (!sc.hq.marks.some(m => m.s === s)) sc.hq.marks.push({ s, dy });
}
// a word that pops up and drifts off
function pop(sc, x, y, text, color = '#f4f0e8') {
  const t = sc.keep(sc.add.text(Math.round(x), Math.round(y), text, {
    fontFamily: 'Galmuri9, sans-serif', fontSize: '10px', color, stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(sc.cameras.main.zoom || 3));
  sc.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 800, delay: 200, ease: 'Quad.in', onComplete: () => t.destroy() });
}
const faceFor = (sc, expr, ms) => { sc.ps.expr = expr; sc.ps.exprUntil = sc.time.now + ms; };
const item = (sc, id) => sc.items.find(it => it.id === id);
const count = (c, now, gap) => { c.n = now - c.t < gap ? c.n + 1 : 1; c.t = now; return c.n; };

// ---------- taps, keys, bumps ----------
// a tap on the cuckoo clock: walk up under it and knock
export function homeQuirkTap(sc, x, y) {
  const hq = sc.hq;
  if (!hq || sc.editing) return false;
  hq.pend = null;
  const it = y < 0 && sc.itemAt(x, y);
  if (it?.id !== 'clock') return false;
  if (sc.sitting) sc.standUp();
  const cx = it.x;
  if (sc.p.x === cx && sc.p.y === 0) { knock(sc, it); return true; }
  const r = sc.walkable(cx, 0) ? sc.route(cx, 0) : [];
  if (!r.length) return false;
  sc.path = r;
  sc.pending = null;
  hq.pend = { it, x: cx };
  return true;
}
// a key up into the wall, under the clock
export function homeQuirkStep(sc, x, y) {
  if (!sc.hq || y >= 0) return false;
  const it = sc.itemAt(x, -1);
  if (it?.id !== 'clock') return false;
  knock(sc, it);
  return true;
}
// using a piece (HomeScene meet): true when it was taken here
export function homeQuirkMeet(sc, it) {
  const hq = sc.hq;
  if (!hq) return false;
  const now = sc.time.now;
  // the friend on the sofa: a word first, then bump it again and you sit down next to them
  if (it.visitor) {
    if (it.f.act !== 'sit' || it.f.w < 2 || sc.visitor !== it.visitor) return false;
    if (now - hq.talkAt > 5000) { hq.talkAt = now; return false; }
    hq.talkAt = -1e9;
    sc.sit(it);
    return true;
  }
  switch (it.f.act) {
    case 'water':
      if (count(hq.water, now, 3000) >= 5 && !hq.done.has('burp')) { hq.done.add('burp'); hq.water.n = 0; burp(sc, it); return true; }
      break;
    case 'bath':
      hq.baths = hq.baths.filter(t => now - t < 30000).concat(now);
      if (hq.baths.length >= 3 && !hq.done.has('duck')) { hq.done.add('duck'); later(sc, 700, () => rubberDuck(sc, it)); }
      break;
    case 'music': hq.musicAt = now; break;
    case 'sit': if (now - hq.musicAt < 6000 && !hq.done.has('lullaby')) hq.lull = { at: now + 1500 }; break;
    case 'sleep': hq.sleepAt = now; break;
    case 'squeak': {
      const plush = sc.items.filter(o => o.f.plush);
      if (plush.length >= 2 && count(hq.squeak, now, 2500) >= 5 && !hq.done.has('chorus')) { hq.done.add('chorus'); hq.squeak.n = 0; chorus(sc, plush); return true; }
      break;
    }
  }
  return false;
}

// ---------- the clock, the plant, the bath, the plushies ----------
function knock(sc, it) {
  const hq = sc.hq, n = count(hq.clock, sc.time.now, 2600);
  sc.path = [];
  sc.hooks.onSound?.('knock');
  sc.tweens.add({ targets: sc.ps, hop: 3, duration: 80, yoyo: true, ease: 'Quad.out' });
  if (n === 1) sc.hooks.onHover?.(sc.describe(it), true);
  const img = it.img, x0 = img.x;
  if (!img.shaking) { img.shaking = true; sc.tweens.add({ targets: img, x: x0 + 1, duration: 45, yoyo: true, repeat: 1, onComplete: () => { img.x = x0; img.shaking = false; } }); }
  pop(sc, img.x, img.y + 2, '똑', '#e8d8b8');
  if (n < 5 || hq.done.has('cuckoo')) return;
  hq.done.add('cuckoo');
  hq.clock.n = 0;
  // out it comes, and it is not happy
  hq.clockOpen = sc.time.now + 1900;
  for (let k = 0; k < 4; k++) later(sc, 150 + k * 380, () => { sc.say(img, '뻐꾹!', 420); sc.hooks.onSound?.('chirp'); hq.fluff.explode(3, img.x, img.y + 10); });
  later(sc, 300, () => mark(sc, { x: img.x + 5, y: img.y + 6 }, 'anger', 1500, 0));
  later(sc, 700, () => faceFor(sc, 'shock', 1200));
  later(sc, 2000, () => got(sc, 'cuckoo'));
}
function burp(sc, it) {
  const img = it.img, top = img.y - img.displayHeight;
  sc.drops.explode(14, img.x, top + 2);
  sc.hooks.onSound?.('water');
  later(sc, 500, () => {
    sc.squash(img, 0.6);
    sc.say(img, '끄억', 1300);
    sc.hooks.onSound?.('puff');
    faceFor(sc, 'shock', 1100);
  });
  later(sc, 1300, () => got(sc, 'burp'));
}
function rubberDuck(sc, tub) {
  if (sc.busy !== 'bath') return;
  const x = tub.img.x + 9, y = tub.img.y - tub.img.displayHeight + 9;
  const d = sc.keep(sc.add.image(x, y + 4, qtex(sc, 'duck')).setOrigin(0.5, 1).setDepth(tub.img.depth + 0.001).setAlpha(0));
  sc.tweens.add({ targets: d, y, alpha: 1, duration: 300, ease: 'Back.out' });
  sc.foam.explode(6, x, y - 2);
  later(sc, 350, () => { pop(sc, x, y - 6, '꽥', '#f4cf4f'); sc.hooks.onSound?.('squeak'); });
  sc.tweens.add({ targets: d, angle: 8, delay: 400, duration: 300, yoyo: true, repeat: 4, ease: 'Sine.easeInOut' });
  later(sc, 900, () => got(sc, 'duck'));
  sc.hq.duck = d;
}
function chorus(sc, plush) {
  plush.forEach((p, i) => [0, 1].forEach(r => later(sc, (r * plush.length + i) * 200, () => {
    sc.squash(p.img, 0.72);
    sc.say(p.img, '삑!', 380);
    sc.hooks.onSound?.('squeak');
  })));
  const end = plush.length * 400;
  later(sc, end, () => { setEmote(sc.ps, '♪', sc.time.now, 1300); faceFor(sc, 'sparkle', 1300); got(sc, 'chorus'); });
}

// ---------- standing still in the right spot ----------
const SPOTS = [
  { id: 'sparrow', ms: 4000, find: sc => sc.p.y === 0 && sc.p.x === windowSlots(sc.room)[0], run: sc => sparrow(sc, windowSlots(sc.room)[0]) },
  { id: 'peek', ms: 4000, find: sc => sc.room.w >= 9 && sc.p.y === 0 && sc.p.x === windowSlots(sc.room)[1] && FOLK.rival.when(sc.meta), run: sc => faceAt(sc, windowSlots(sc.room)[1], 'rival', 'peek') },
  { id: 'painting', ms: 4000, find: sc => { const it = item(sc, 'painting'); return it && sc.p.y === 0 && sc.p.x >= it.x && sc.p.x < it.x + it.f.w && it; }, run: painting },
  { id: 'book', ms: 5000, busy: 4400, find: sc => { const it = item(sc, 'shelf'); return it && [0, 1].some(i => cheb(it.x + i, it.y, sc.p.x, sc.p.y) === 1) && it; }, run: book },
];

function sparrow(sc, s) {
  const g = glass(s), key = 'v_bird0';
  if (!sc.textures.exists(key)) sc.textures.addCanvas(key, critterCanvas('bird0'));
  if (!sc.textures.exists('v_bird1')) sc.textures.addCanvas('v_bird1', critterCanvas('bird1'));
  const b = sc.keep(sc.add.image(g.x + g.w + 4, g.y + g.h - 1, key).setOrigin(0.5, 1).setDepth(D.room + 0.2).setAlpha(0).setFlipX(true));
  sc.tweens.add({ targets: b, x: g.x + 6, alpha: 1, duration: 500, ease: 'Quad.out' });
  for (let k = 0; k < 2; k++) later(sc, 900 + k * 420, () => {
    sc.tweens.add({ targets: b, x: b.x - 1, y: b.y - 1, duration: 70, yoyo: true });
    pop(sc, g.x + 3, g.y + 8, '톡', '#e6f7ff');
    sc.hooks.onSound?.('knock');
  });
  later(sc, 1900, () => { mark(sc, { x: b.x, y: b.y - 6 }, '♪', 900, 0); faceFor(sc, 'sparkle', 1200); got(sc, 'sparrow'); });
  later(sc, 2800, () => { b.setTexture('v_bird1'); sc.tweens.add({ targets: b, y: b.y - 6, x: b.x - 4, alpha: 0, duration: 500, onComplete: () => b.destroy() }); });
}
// someone's face coming up into a window from outside, and down again (the rival peeking in; the cat
// after the smell of fish)
function faceAt(sc, s, sprite, id) {
  const g = glass(s), img = sc.keep(sc.add.image(g.x - 3, g.y + g.h, sprite).setOrigin(0, 0).setDepth(D.room + 0.2).setTint(0xd8ecff));
  img.setScale(texScale(img));
  const show = () => { const rows = Math.max(0, Math.min(16, Math.round(g.y + g.h - img.y))); img.setVisible(rows > 0).setCrop(3, 0, 10, rows); };
  show();
  const up = id === 'peek' ? 9 : 8;
  sc.tweens.add({ targets: img, y: g.y + g.h - up, duration: 600, delay: 100, ease: 'Quad.out', onUpdate: show });
  if (id === 'peek') {
    later(sc, 900, () => { img.setFlipX(true); });
    later(sc, 1300, () => { img.setFlipX(false); mark(sc, { x: g.x + 5, y: g.y + 2 }, '!', 800, 0); sc.hooks.onSound?.('alert'); faceFor(sc, 'shock', 1100); });
    sc.tweens.add({ targets: img, y: g.y + g.h, delay: 1700, duration: 160, ease: 'Quad.in', onUpdate: show, onComplete: () => img.destroy() });
    later(sc, 2100, () => { setEmote(sc.ps, '?', sc.time.now, 1100); got(sc, 'peek'); });
  } else {
    later(sc, 800, () => { pop(sc, g.x + 5, g.y + 2, '킁킁', '#f4f0e8'); sc.hooks.onSound?.('meow'); });
    sc.tweens.add({ targets: img, x: img.x + 1, delay: 900, duration: 150, yoyo: true, repeat: 3 });
    sc.tweens.add({ targets: img, y: g.y + g.h, delay: 2400, duration: 500, ease: 'Quad.in', onUpdate: show, onComplete: () => img.destroy() });
    later(sc, 1600, () => { faceFor(sc, 'shock', 900); got(sc, id); });
  }
}
// a little mouse runs through the painted meadow
function painting(sc, it) {
  const b = it.img.getBounds();
  const r = sc.keep(sc.add.image(b.x + 3, b.y + 11, qtex(sc, 'rat')).setOrigin(0.5, 1).setDepth(D.wall + 0.01).setAlpha(0).setFlipX(true));
  sc.tweens.add({ targets: r, alpha: 1, duration: 150 });
  sc.tweens.add({ targets: r, x: b.right - 4, duration: 1500, ease: 'Linear' });
  sc.tweens.add({ targets: r, y: r.y - 1, duration: 120, yoyo: true, repeat: 5 });
  sc.tweens.add({ targets: r, alpha: 0, delay: 1450, duration: 150, onComplete: () => r.destroy() });
  later(sc, 1000, () => faceFor(sc, 'shock', 1000));
  later(sc, 1800, () => { setEmote(sc.ps, '?', sc.time.now, 1100); got(sc, 'painting'); });
}
// a book drops off the shelf: the workers' roll, some names gone
function book(sc, it) {
  const ps = sc.ps, img = it.img, x0 = img.x + 5, y0 = img.y - img.displayHeight + 7;
  const bk = sc.keep(sc.add.image(x0, y0, qtex(sc, 'book')).setDepth(D.fx));
  const tx = ps.x + (img.x < ps.x ? -7 : 7), ty = ps.y - 2;
  sc.tweens.add({ targets: bk, x: x0 + 3, duration: 200, ease: 'Quad.out' });
  sc.tweens.add({ targets: bk, x: tx, y: ty, angle: 90, delay: 220, duration: 380, ease: 'Quad.in' });
  later(sc, 600, () => { sc.hooks.onSound?.('bonk'); pop(sc, tx, ty - 6, '툭', '#e8d8b8'); faceFor(sc, 'shock', 800); });
  later(sc, 1200, () => { sc.tweens.add({ targets: bk, x: ps.x, y: ps.y - 20, angle: 0, duration: 260, ease: 'Quad.out' }); sc.say(ps, "'일꾼 명부'…", 1900); });
  later(sc, 2600, () => { sc.say(ps, '…제자리에 꽂아 두자.', 1500); got(sc, 'book'); });
  sc.tweens.add({ targets: bk, x: x0, y: y0, delay: 3400, duration: 400, ease: 'Quad.inOut', onComplete: () => bk.destroy() });
}

// ---------- lifting furniture (꾸미기) ----------
function dustBunny(sc, x, y) {
  const d = sc.keep(sc.add.image(mid(x), foot(y) - 2, qtex(sc, 'dust')).setOrigin(0.5, 1).setDepth(D.actors + y / 100 + 0.01).setScale(0.5).setAlpha(0));
  sc.tweens.add({ targets: d, scale: 1, alpha: 1, duration: 260, ease: 'Back.out' });
  later(sc, 500, () => { mark(sc, d, '!', 700, 8); sc.hooks.onSound?.('squeak'); });
  const away = x < sc.room.w / 2 ? -1 : 1, edge = away < 0 ? TILE - 4 : (sc.room.w + 1) * TILE + 4;
  d.setFlipX(away > 0);
  sc.tweens.add({ targets: d, x: edge, delay: 1000, duration: 900, ease: 'Quad.in' });
  sc.tweens.add({ targets: d, y: d.y - 2, delay: 1000, duration: 90, yoyo: true, repeat: 4 });
  sc.tweens.add({ targets: d, alpha: 0, delay: 1700, duration: 250, onComplete: () => d.destroy() });
  later(sc, 1300, () => got(sc, 'dustbunny'));
}
function drawing(sc, x, y) {
  const d = sc.keep(sc.add.image(mid(x), foot(y) - 20, qtex(sc, 'drawing')).setDepth(D.fx).setAlpha(0));
  sc.tweens.add({ targets: d, alpha: 1, duration: 150 });
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 1100, ease: 'Linear',
    onUpdate: tw => { const u = tw.getValue(); d.setPosition(Math.round(mid(x) + Math.sin(u * 7) * 4), Math.round(foot(y) - 20 + 14 * u)).setAngle(Math.sin(u * 7) * 18); },
    onComplete: () => { d.setAngle(0); sc.hooks.onSound?.('rustle'); },
  });
  later(sc, 1400, () => { pop(sc, d.x, d.y - 8, '…', '#f4f0e8'); got(sc, 'drawing'); });
  sc.tweens.add({ targets: d, alpha: 0, delay: 5200, duration: 600, onComplete: () => d.destroy() });
}
function sunPlant(sc, it) {
  const img = it.img, g = glass(it.x);
  const beam = sc.keep(sc.add.image(g.x, g.y + g.h, qtex(sc, 'beam')).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(D.fx - 0.1));
  sc.tweens.add({ targets: beam, alpha: 0.7, duration: 500 });
  sc.tweens.add({ targets: img, angle: 7, delay: 400, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => img.setAngle(0) });
  later(sc, 1200, () => {
    const b = sc.keep(sc.add.image(img.x, img.y - img.displayHeight + 1, qtex(sc, 'bud')).setDepth(D.fx).setScale(0));
    sc.tweens.add({ targets: b, scale: 1, duration: 260, ease: 'Back.out' });
    sc.spark.explode(10, img.x, img.y - img.displayHeight);
    sc.hooks.onSound?.('grow');
    mark(sc, b, '♪', 1100, 6);
    sc.tweens.add({ targets: b, alpha: 0, delay: 3000, duration: 500, onComplete: () => b.destroy() });
  });
  sc.tweens.add({ targets: beam, alpha: 0, delay: 3200, duration: 800, onComplete: () => beam.destroy() });
  later(sc, 1600, () => got(sc, 'sunplant'));
}

// ---------- asleep ----------
function stars(sc) {
  const { tw } = roomSize(sc.room), slots = windowSlots(sc.room).map(s => glass(s));
  const list = [];
  for (let k = 0; list.length < 12 && k < 60; k++) {
    const x = TILE + 4 + Math.floor(Math.random() * ((tw - 2) * TILE - 8)), y = 5 + Math.floor(Math.random() * 16);
    if (slots.some(g => x > g.x - 3 && x < g.x + g.w + 3 && y < g.y + g.h + 3)) continue;
    list.push(sc.keep(sc.add.image(x, y, qtex(sc, 'star')).setDepth(D.dim + 0.06).setAlpha(0)));
  }
  sc.hq.stars = list;
  list.forEach((s, i) => sc.tweens.add({ targets: s, alpha: 0.9, delay: i * 90, duration: 300 }));
  later(sc, 1500, () => got(sc, 'stars'));
}
// fresh from the bath: sheep going over a fence in the dream instead
function sheepDream(sc) {
  const ps = sc.ps;
  let d = sc.dream;
  if (!d) {
    const x = ps.x + 12, y = ps.y - 22;
    d = sc.dream = [sc.keep(sc.add.ellipse(x, y, 22, 18, 0xf4f0e8).setDepth(D.bubble - 0.2))];
  }
  const cloud = d[0];
  d.slice(3).forEach(o => o.setVisible(false));
  const fence = sc.keep(sc.add.image(cloud.x, cloud.y + 6, qtex(sc, 'fence')).setOrigin(0.5, 1).setDepth(D.bubble - 0.15));
  const sheep = sc.keep(sc.add.image(cloud.x - 8, cloud.y + 4, qtex(sc, 'sheep')).setOrigin(0.5, 1).setDepth(D.bubble - 0.14));
  d.push(fence, sheep);
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 900, repeat: 2, ease: 'Linear',
    onUpdate: tw => { if (sheep.active) { const u = tw.getValue(); sheep.setPosition(Math.round(cloud.x - 8 + 16 * u), Math.round(cloud.y + 4 - Math.sin(u * Math.PI) * 7)); } },
  });
  later(sc, 1000, () => got(sc, 'cloud'));
}
// the music box, and you nod off on your seat until it stops
function lullaby(sc) {
  const ps = sc.ps, box = item(sc, 'musicbox');
  faceFor(sc, 'blink', 3300);
  for (let k = 0; k < 3; k++) later(sc, k * 1000, () => setEmote(ps, 'z', sc.time.now, 900));
  if (box) { sc.playing = sc.time.now + 2900; sc.hooks.onSound?.('tune'); }
  later(sc, 3100, () => {
    if (box) pop(sc, box.img.x, box.img.y - 12, '뚝', '#e8d8b8');
    faceFor(sc, 'shock', 1100);
    sc.tweens.add({ targets: ps, hop: 6, duration: 110, yoyo: true, ease: 'Quad.out' });
    sc.hooks.onSound?.('bonk');
    got(sc, 'lullaby');
  });
}
function shoulder(sc) {
  const v = sc.visitor, ps = sc.ps, dir = Math.sign(ps.x - v.s.x) || 1;
  sc.tweens.add({ targets: v.s, angle: dir * 14, x: v.s.x + dir * 3, duration: 900, ease: 'Sine.easeInOut' });
  for (let k = 0; k < 4; k++) later(sc, 300 + k * 1000, () => { if (sc.visitor === v) setEmote(v.s, 'z', sc.time.now, 900); });
  later(sc, 1200, () => { setEmote(ps, '♥', sc.time.now, 1200); got(sc, 'shoulder'); });
  sc.hq.leaning = { v, until: sc.time.now + 5200 };
}
function cough(sc) {
  const st = item(sc, 'stove'), ps = sc.ps;
  if (!st) return;
  const x = st.img.x, y = st.img.y - st.img.displayHeight;
  for (let k = 0; k < 3; k++) later(sc, k * 300, () => { sc.hq.soot.explode(8, x, y + 2); sc.squash(st.img, 0.86); });
  pop(sc, x, y - 4, '콜록콜록', '#c9c2b6');
  sc.hooks.onSound?.('puff');
  later(sc, 700, () => { ps.setTint(0x8a8494); faceFor(sc, 'shock', 1400); setEmote(ps, 'sweat', sc.time.now, 1200); });
  later(sc, 3200, () => ps.clearTint());
  later(sc, 1200, () => got(sc, 'cough'));
}

// ---------- every frame (HomeScene update, last) ----------
export function homeQuirkTick(sc, time, delta) {
  const hq = sc.hq, ps = sc.ps, p = sc.p;
  if (!hq || !ps) return;
  // walking up under the clock to knock
  if (hq.pend && !sc.path.length && time >= sc.nextStep) {
    const pd = hq.pend;
    hq.pend = null;
    if (p.x === pd.x && p.y === 0 && !sc.busy) knock(sc, pd.it);
  }
  // standing still somewhere (sitting counts)
  const here = `${p.x},${p.y}`;
  const still = !sc.path.length && !sc.pending && time >= (ps.stepUntil || 0) && !sc.busy && !sc.editing && !modalUp();
  if (!still || here !== hq.at) { hq.at = here; hq.from = time; }
  const stillMs = still ? time - hq.from : 0;
  if (still && time > hq.busyUntil) {
    for (const sp of SPOTS) {
      if (stillMs < sp.ms || hq.done.has(sp.id)) continue;
      const ctx = sp.find(sc);
      if (!ctx) continue;
      hq.done.add(sp.id);
      hq.busyUntil = time + (sp.busy || 3000);
      sp.run(sc, ctx);
      break;
    }
  }
  // in and out of bed and the bath
  if (sc.busy !== hq.was) {
    if (hq.was === 'bath') {
      hq.bathEnd = time;
      QK.bathAt = Date.now();
      const d = hq.duck;
      hq.duck = null;
      if (d) sc.tweens.add({ targets: d, alpha: 0, duration: 300, onComplete: () => d.destroy() });
    }
    if (hq.was === 'sleep') { hq.stars?.forEach(s => s.destroy()); hq.stars = null; }
    if (sc.busy === 'sleep') hq.sleepAt = time;
    hq.was = sc.busy;
  }
  if (sc.busy === 'sleep') {
    if (!hq.stars && sc.isDark() && time - hq.sleepAt > 1200 && !hq.done.has('stars')) { hq.done.add('stars'); stars(sc); }
    if (time - hq.sleepAt > 1600 && time - hq.bathEnd < 15000 && !hq.done.has('cloud')) { hq.done.add('cloud'); sheepDream(sc); }
    hq.stars?.forEach((s, i) => s.alpha > 0.2 && s.setAlpha(0.55 + 0.4 * Math.sin(time / 380 + i * 1.9)));
  }
  // the music box, then a seat
  if (hq.lull && time > hq.lull.at) { const ok = !!sc.sitting; hq.lull = null; if (ok && !hq.done.has('lullaby')) { hq.done.add('lullaby'); lullaby(sc); } }
  // next to the friend on the sofa
  const v = sc.visitor;
  if (sc.sitting && v && v.seat === sc.sitting && sc.sitting.id === 'sofa') {
    hq.sofaAt ||= time;
    if (time - hq.sofaAt > 4000 && !hq.done.has('shoulder')) { hq.done.add('shoulder'); shoulder(sc); }
  } else hq.sofaAt = 0;
  const lean = hq.leaning;
  if (lean && (time > lean.until || !sc.sitting || sc.visitor !== lean.v)) {
    hq.leaning = null;
    if (lean.v.s.active) { sc.tweens.killTweensOf(lean.v.s); lean.v.s.setAngle(0); if (sc.visitor === lean.v) sc.seatOn(lean.v.s, lean.v.seat, sc.sitting === lean.v.seat ? (sc.p.x <= lean.v.seat.x ? 1 : 0) : 0.5); }
  }
  // something cooked (ui/life.js puts it in the basket): the stove or the window has its say once the pot is put away
  const m = sc.meta, mys = m.bag?.mystery || 0, fish = fishDishes(m);
  if (mys > hq.mystery && !hq.done.has('cough')) hq.cook = 'cough';
  else if (fish > hq.fish && !hq.done.has('fishnose') && !hq.cook) hq.cook = 'fishnose';
  hq.mystery = mys;
  hq.fish = fish;
  if (hq.cook && !modalUp() && !sc.busy) {
    const what = hq.cook;
    hq.cook = null;
    hq.done.add(what);
    if (what === 'cough') cough(sc);
    else faceAt(sc, windowSlots(sc.room)[0], 'shadecat', 'fishnose');
  }
  // lifting the bed or the wardrobe in 꾸미기
  if (sc.held !== hq.held) {
    hq.held = sc.held;
    const h = sc.held;
    if (h?.from && (h.id === 'bed' || h.id === 'cloudbed') && !hq.done.has('dustbunny')) { hq.done.add('dustbunny'); dustBunny(sc, h.from[0], h.from[1] + (h.f.h || 1) - 1); }
    if (h?.from && h.id === 'wardrobe' && !hq.done.has('drawing')) { hq.done.add('drawing'); drawing(sc, h.from[0], h.from[1]); }
  }
  // the plant moved under a window
  const plant = item(sc, 'plant'), pk = plant ? `${plant.x},${plant.y}` : null;
  if (pk !== hq.plantAt) {
    hq.plantAt = pk;
    if (plant && plant.y === 0 && windowSlots(sc.room).includes(plant.x) && !hq.done.has('sunplant')) { hq.done.add('sunplant'); later(sc, 300, () => sunPlant(sc, plant)); }
  }
  // the cuckoo held out
  if (time < hq.clockOpen) { const c = item(sc, 'clock'); const k = c && sc.furnKey('clock', 1); if (k && c.img.texture.key !== k) c.img.setTexture(k); }
  // marks over things that are not people
  hq.g.clear();
  hq.marks = hq.marks.filter(mk => mk.s.active !== false && mk.s.emote && time <= mk.s.emote.until);
  for (const mk of hq.marks) drawEmote(hq.g, mk.s, mk.s.x, mk.s.y - mk.dy, time);
}
