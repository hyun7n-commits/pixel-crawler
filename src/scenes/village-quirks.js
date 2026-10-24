// 작은 장난 in the village (v0.30, data/quirks.js): what happens when you hang about in the right spot,
// bump the same thing five times, carry the wrong thing past the wrong someone, or tag along behind a
// neighbour. Stand still somewhere a while and the spot may do something (SPOTS); bump a lamp post, the
// hay, the red mushroom, an apple tree, the windmill or an empty mailbox over and over (BUMP), or sit
// down on a bench; walk the plaza lamps round in order, pass under all three arches in one go, circle
// the maypole; follow the neighbour, the rival or the rescuer about. Each one happens once a visit, and
// the first time ever it gets its page in the book (hooks.onEntry).
// VillageScene calls in here: placeVillageQuirks (enter), quirkTap / quirkStep / quirkMeet (true when
// the tap, the key or the bump was taken) and quirkTick (every frame, last).

import { TILE, dressKey } from './textures.js';
import { D } from './VillageScene.js';
import { setEmote, drawEmote } from './emotes.js';
import { float, face, emerge, pokeKind } from './village-secrets.js';
import { critterCanvas } from './village-props.js';
import { chimneyAt } from './village-houses.js';
import { qtex } from './quirks-art.js';
import { faceKey } from '../data/faces.js';
import { CHARACTERS } from '../data/characters.js';
import { QUIRK_HINTS, quirkId, QK } from '../data/quirks.js';
import { PROPS, HOUSES, propCells, ownsHome } from '../data/village.js';
import { REGION } from '../data/village-map.js';
import { FISH, BUGS } from '../data/life.js';

const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const pick = list => list[Math.floor(Math.random() * list.length)];
const modalUp = () => document.getElementById('modal')?.hidden === false;
const critter = (sc, name) => { const key = `v_${name}`; if (!sc.textures.exists(key)) sc.textures.addCanvas(key, critterCanvas(name)); return key; };
const got = (sc, id) => sc.hooks.onEntry?.(quirkId(id));
const later = (sc, ms, fn) => sc.time.delayedCall(ms, fn);

// the plaza's four lamps, going round clockwise; the maypole
const PLAZA_LAMPS = [[27, 19], [33, 19], [34, 24], [26, 24]];
const MAYPOLE = PROPS.find(p => p.kind === 'maypole');
// how many of a neighbour's steps you have to tag along for, and what then
const FOLLOW = { neighbor: ['whisper', 6], rival: ['stretch', 10], rescue: ['bandage', 5] };
const FISH_IDS = Object.values(FISH).filter(f => !f.junk).map(f => f.id);

// ---------- putting it out ----------
export function placeVillageQuirks(sc) {
  const qk = sc.qk = {
    done: new Set(), bump: { key: null, n: 0, t: 0 }, at: null, from: 0, busyUntil: 0, last: null, moves: 0,
    lamps: [], lampT: 0, arches: new Map(), spin: null, wellAt: -1e9, greeted: new Set(), hello: 0,
    folk: new Map(), sit: null, head: null, parade: null, follower: null, wrap: null, glows: new Map(), marks: [],
    // the pond's water (the rest is the creek)
    pond: new Set((sc.pondTiles || []).filter(t => REGION[t.y]?.[t.x] === 'B').map(t => `${t.x},${t.y}`)),
  };
  // marks over things that are not people (a cat's heart, a mouse seeing stars)
  qk.g = sc.keep(sc.add.graphics().setDepth(D.fx + 0.5));
  const bits = (tint, o = {}) => sc.keep(sc.add.particles(0, 0, 'px', {
    emitting: false, lifespan: { min: 500, max: 900 }, speedX: { min: -30, max: 30 }, speedY: { min: -40, max: -10 }, gravityY: 70,
    scale: { start: 1.5, end: 0.6 }, tint, ...o,
  }).setDepth(D.fx));
  qk.straw = bits([0xf4dc7a, 0xd0a83c, 0xe8c890]);
  qk.spores = bits([0xf4f0e8, 0xf29bb2, 0xffd0e0], { gravityY: -10, speedY: { min: -20, max: -4 }, alpha: { start: 1, end: 0 }, lifespan: { min: 700, max: 1200 } });
  qk.petals = bits([0xf29bb2, 0xffd0e0, 0xffffff, 0xe58aa5], {
    lifespan: { min: 1400, max: 2200 }, speedX: { min: -14, max: 14 }, speedY: { min: 6, max: 20 }, gravityY: 12,
    emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-40, -20, 80, 16) },
  });
}

// ---------- what there is to bump ----------
const BUMP_PROP = { lamp: 'lamp', hay: 'hay', mushroom: 'mushroom', fruittree: 'tree', bench: 'bench' };
const cellsOf = b => { const out = []; for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) out.push([b.x + i, b.y + j]); return out; };
function bumpable(sc, x, y) {
  const pr = sc.propAt(x, y);
  if (pr && BUMP_PROP[pr.kind]) return { kind: BUMP_PROP[pr.kind], key: `${pr.x},${pr.y}`, pr, cells: propCells(pr).map(([i, j]) => [pr.x + i, pr.y + j]) };
  const b = sc.buildingAt(x, y);
  if (b?.id === 'windmill' && sc.sails) return { kind: 'windmill', key: 'windmill', b, cells: cellsOf(b) };
  const d = sc.decorAt(x, y);
  if (d?.id === 'mailbox' && !sc.mail) return { kind: 'mailbox', key: 'mailbox', d, cells: d.at };
  if (d?.id === 'bench') return { kind: 'bench', key: 'yardbench', d, cells: d.at };
  return null;
}
// the tapped cell when you can stand beside it, or the cell of the thing nearest you that you can
function reachOf(sc, t, x, y) {
  const ok = ([cx, cy]) => N8.some(([dx, dy]) => sc.walkable(cx + dx, cy + dy) || (sc.p.x === cx + dx && sc.p.y === cy + dy));
  const cells = [[x, y], ...t.cells.slice().sort((a, b) => cheb(a[0], a[1], sc.p.x, sc.p.y) - cheb(b[0], b[1], sc.p.x, sc.p.y))];
  return cells.find(ok) || [x, y];
}

// ---------- taps, keys, bumps ----------
// a tap on the map: true when it was for one of these (anything else goes on as before; sitting on a
// bench, you get up first)
export function quirkTap(sc, x, y) {
  const qk = sc.qk;
  if (!qk) return false;
  if (qk.sit) standUp(sc);
  if (sc.play || sc.fishing) return false;
  const t = bumpable(sc, x, y);
  if (!t) return false;
  const [cx, cy] = reachOf(sc, t, x, y), it = { qbump: true, x: cx, y: cy };
  const near = sc.near(it);
  if (near === 0) bump(sc, cx, cy);
  else if (near) { sc.path = near; sc.pending = it; }
  else return false;
  return true;
}
// a key pressed towards (x, y)
export function quirkStep(sc, x, y) {
  const qk = sc.qk;
  if (!qk) return false;
  if (qk.sit) { standUp(sc); return true; }
  if (sc.fishing) return false;
  if (pokeKind(sc, x, y) === 'well') qk.wellAt = sc.time.now;
  if (!bumpable(sc, x, y)) return false;
  bump(sc, x, y);
  return true;
}
// walked up to someone or something (VillageScene meet): true when it was taken here
export function quirkMeet(sc, who) {
  const qk = sc.qk;
  if (!qk) return false;
  if (who.qbump) { bump(sc, who.x, who.y); return true; }
  if (who.poke && pokeKind(sc, who.x, who.y) === 'well') qk.wellAt = sc.time.now;
  // a hello to every one of the folk, one after another
  if (who.f && who.id) {
    qk.greeted.add(who.id);
    if (sc.folk.length >= 4 && sc.folk.every(f => qk.greeted.has(f.id)) && !qk.done.has('hello')) { qk.done.add('hello'); qk.hello = sc.time.now + 700; }
  }
  // fresh out of the bath, and the puppy has a sniff
  if (who.pup && !who.busy && Date.now() - QK.bathAt < 120000 && !qk.done.has('soap')) {
    qk.done.add('soap');
    soap(sc, who);
    return true;
  }
  return false;
}

function bump(sc, x, y) {
  const t = bumpable(sc, x, y);
  if (!t) return;
  const qk = sc.qk, now = sc.time.now, b = qk.bump;
  b.n = b.key === t.key && now - b.t < 2600 ? b.n + 1 : 1;
  b.key = t.key;
  b.t = now;
  if (x !== sc.p.x) sc.ps.setFlipX(x < sc.p.x);
  if (t.kind === 'bench') { sit(sc, t, x, y); return; }
  lean(sc, x, y);
  if (b.n === 1) sc.hooks.onHover?.(sc.describe(x, y), true);
  BUMP[t.kind](sc, t, b.n, x, y);
}
function lean(sc, x, y) {
  const ps = sc.ps, bx = center(sc.p.x), by = foot(sc.p.y);
  sc.tweens.killTweensOf(ps);
  ps.setPosition(bx, by);
  sc.tweens.add({ targets: ps, x: bx + Math.sign(x - sc.p.x) * 3, y: by + Math.sign(y - sc.p.y) * 3, duration: 60, yoyo: true, ease: 'Quad.out' });
}
function shake(img, n = 2) {
  if (!img || img.shaking) return;
  img.shaking = true;
  const x0 = img.x;
  img.scene.tweens.add({ targets: img, x: x0 + 1, duration: 45, yoyo: true, repeat: n, onComplete: () => { img.x = x0; img.shaking = false; } });
}
const propObj = (sc, pr) => sc.props.find(o => o.pr === pr);
const propImg = (sc, pr) => propObj(sc, pr)?.imgs[0];
// a mark over something that is not one of the people (they have their own)
function mark(sc, s, kind, ms = 1100, dy = 19) {
  setEmote(s, kind, sc.time.now, ms);
  if (!sc.qk.marks.some(m => m.s === s)) sc.qk.marks.push({ s, dy });
}
// muffled words through a wall, or up out of the ground: they come and go without drifting off
function murmur(sc, x, y, text, ms = 2200, color = '#c9c2b6', alpha = 1) {
  const t = sc.keep(sc.add.text(Math.round(x), Math.round(y), text, {
    fontFamily: 'Galmuri9, sans-serif', fontSize: '10px', color, stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(sc.cameras.main.zoom || 3).setAlpha(0));
  sc.tweens.add({ targets: t, alpha, duration: 260 });
  sc.tweens.add({ targets: t, alpha: 0, y: t.y - 3, delay: ms, duration: 400, onComplete: () => t.destroy() });
  return t;
}
// something small sitting on your head until you walk on
function onHead(sc, img, dy = 0, ms = 12000) {
  const qk = sc.qk;
  dropHead(sc);
  qk.head = { img, dy, at: qk.last, until: sc.time.now + ms };
}
function dropHead(sc) {
  const h = sc.qk.head;
  if (!h) return;
  sc.qk.head = null;
  sc.tweens.add({ targets: h.img, y: h.img.y + 14, x: h.img.x + (Math.random() < 0.5 ? -6 : 6), alpha: 0, duration: 500, ease: 'Quad.in', onComplete: () => h.img.destroy() });
}
// for a while, a lamp's glow is ours to set (the scene sets them all every frame before quirkTick)
const holdGlow = (sc, img, ms, alpha, scale = null) => img && sc.qk.glows.set(img, { until: sc.time.now + ms, alpha, scale });

const BUMP = {
  // the lamp post rings and its light flickers; five in a row and a firefly comes out of it
  lamp(sc, t, n) {
    sc.hooks.onSound?.('knock');
    const o = propObj(sc, t.pr), glow = o?.imgs[1];
    shake(o?.imgs[0], 1);
    holdGlow(sc, glow, 90, 0.15);
    lampRound(sc, t.pr);
    if (n >= 5 && !sc.qk.done.has('lampfly')) { sc.qk.done.add('lampfly'); lampFly(sc, glow); }
  },
  // straw flies; five in a row and there really is a needle in it
  hay(sc, t, n) {
    sc.hooks.onSound?.('rustle');
    const img = propImg(sc, t.pr), cx = center(t.pr.x), top = foot(t.pr.y) - 12;
    shake(img);
    sc.qk.straw.explode(4 + n * 2, cx, top);
    if (n < 5 || sc.qk.done.has('needle')) return;
    sc.qk.done.add('needle');
    needle(sc, cx, top);
  },
  // the red mushroom wobbles and puffs; five in a row and it sneezes
  mushroom(sc, t, n) {
    sc.hooks.onSound?.('pop');
    const img = propImg(sc, t.pr), cx = center(t.pr.x), top = foot(t.pr.y) - 10;
    if (img && !img.squashing) {
      img.squashing = true;
      const sx = img.scaleX, sy = img.scaleY;
      sc.tweens.add({ targets: img, scaleY: sy * 0.82, scaleX: sx * 1.12, duration: 90, yoyo: true, ease: 'Quad.out', onComplete: () => { img.setScale(sx, sy); img.squashing = false; } });
    }
    sc.qk.spores.explode(3, cx, top);
    if (n < 5 || sc.qk.done.has('sneeze')) return;
    sc.qk.done.add('sneeze');
    sneeze(sc, cx, top);
  },
  // the apple tree shakes; five in a row and an apple comes down, with someone in it
  tree(sc, t, n) {
    sc.hooks.onSound?.('rustle');
    const img = propImg(sc, t.pr), cx = center(t.pr.x);
    shake(img);
    sc.fall.explode(3 + n * 2, cx, foot(t.pr.y) - 26);
    if (n < 5 || sc.qk.done.has('worm')) return;
    sc.qk.done.add('worm');
    apple(sc, cx, foot(t.pr.y) - 28);
  },
  // knock on the windmill; five in a row and the mouse living on its sails goes round once too many
  windmill(sc, t, n) {
    sc.hooks.onSound?.('knock');
    float(sc, sc.ps.x + (sc.ps.flipX ? -10 : 10), sc.ps.y - 18, '똑', '#e8d8b8');
    if (n < 5 || sc.qk.done.has('mouse')) return;
    sc.qk.done.add('mouse');
    mouseRide(sc);
  },
  // the empty mailbox rattles; five in a row and whoever sleeps in it comes out cross
  mailbox(sc, t, n) {
    sc.hooks.onSound?.('knock');
    const img = sc.decor.mailbox;
    shake(img, 1);
    float(sc, center(t.d.at[0][0]), foot(t.d.at[0][1]) - 18, '덜컹', '#d8c8a8');
    if (n < 5 || sc.qk.done.has('snail') || !img) return;
    sc.qk.done.add('snail');
    snailOut(sc, img);
  },
};

// ---------- the lamps ----------
// round the plaza's four in order (either way you start, but clockwise)
function lampRound(sc, pr) {
  const qk = sc.qk, i = PLAZA_LAMPS.findIndex(([x, y]) => x === pr.x && y === pr.y), now = sc.time.now;
  if (i < 0) return;
  const last = qk.lamps[qk.lamps.length - 1];
  if (last === i) return;
  if (qk.lamps.length && i === (last + 1) % 4 && now - qk.lampT < 9000) qk.lamps.push(i);
  else qk.lamps = [i];
  qk.lampT = now;
  if (qk.lamps.length < 4 || qk.done.has('lampround')) return;
  qk.done.add('lampround');
  const glows = PLAZA_LAMPS.map(([x, y]) => propObj(sc, sc.propAt(x, y))?.imgs[1]);
  for (let k = 0; k < 8; k++) later(sc, 250 + k * 150, () => {
    const g = glows[(i + 1 + k) % 4];
    if (!g) return;
    holdGlow(sc, g, 160, 1, 1.5);
    sc.spark.explode(4, g.x, g.y);
    sc.hooks.onSound?.('pluck');
  });
  later(sc, 1600, () => { face(sc, 'sparkle', 1200); got(sc, 'lampround'); });
}
// the light goes out, and a firefly comes out and round your head and back in
function lampFly(sc, glow) {
  if (!glow) return;
  const ps = sc.ps, x0 = glow.x, y0 = glow.y;
  holdGlow(sc, glow, 3200, 0);
  const halo = sc.keep(sc.add.image(x0, y0, 'glow').setDepth(D.fx).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.9));
  const dot = sc.keep(sc.add.image(x0, y0, 'px').setDepth(D.fx + 0.01).setTint(0xfff3b0).setScale(2));
  sc.hooks.onSound?.('pop');
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 3000, ease: 'Linear',
    onUpdate: tw => {
      const u = tw.getValue(), hx = ps.x, hy = ps.y - 22;
      let x, y;
      if (u < 0.2) { const k = u / 0.2; x = x0 + (hx + 10 - x0) * k; y = y0 + (hy - y0) * k - Math.sin(k * Math.PI) * 6; }
      else if (u < 0.8) { const a = (u - 0.2) / 0.6 * Math.PI * 4; x = hx + Math.cos(a) * 10; y = hy + Math.sin(a) * 4; }
      else { const k = (u - 0.8) / 0.2; x = hx + 10 + (x0 - hx - 10) * k; y = hy + (y0 - hy) * k - Math.sin(k * Math.PI) * 6; }
      const blink = Math.floor(u * 30) % 4 ? 1 : 0.4;
      halo.setPosition(Math.round(x), Math.round(y)).setAlpha(0.9 * blink);
      dot.setPosition(Math.round(x), Math.round(y)).setAlpha(blink);
    },
    onComplete: () => { halo.destroy(); dot.destroy(); },
  });
  later(sc, 1100, () => { face(sc, 'sparkle', 1400); got(sc, 'lampfly'); });
}

// ---------- the hay, the mushroom, the apple tree, the windmill, the mailbox ----------
function needle(sc, cx, top) {
  const ps = sc.ps, n = sc.keep(sc.add.image(cx, top, qtex(sc, 'needle')).setDepth(D.fx));
  sc.qk.straw.explode(16, cx, top);
  const tx = ps.x + (cx < ps.x ? -9 : 9), ty = ps.y - 3;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 760, ease: 'Linear',
    onUpdate: tw => { const u = tw.getValue(); n.setPosition(Math.round(cx + (tx - cx) * u), Math.round(top + (ty - top) * u - Math.sin(u * Math.PI) * 26)).setAngle(u * 540); },
    onComplete: () => {
      n.setAngle(90);
      sc.spark.explode(8, n.x, n.y - 1);
      sc.hooks.onSound?.('find');
      float(sc, n.x, n.y - 6, '반짝', '#f4f0e8');
      face(sc, 'shock', 1200);
      later(sc, 900, () => { sc.say(ps, '…정말 있었다.', 1500); got(sc, 'needle'); });
      sc.tweens.add({ targets: n, alpha: 0, delay: 2600, duration: 400, onComplete: () => n.destroy() });
    },
  });
}
function sneeze(sc, cx, top) {
  const ps = sc.ps;
  later(sc, 280, () => {
    sc.hooks.onSound?.('sneeze');
    float(sc, cx, top - 6, '에취!', '#ffd0e0');
    sc.qk.spores.explode(24, cx, top);
    face(sc, 'shock', 1000);
    const spots = [[-13, 1], [12, 2], [-6, 6], [7, 7], [-15, -5], [15, -4]];
    spots.forEach(([dx, dy], k) => {
      const m = sc.keep(sc.add.image(Math.round(ps.x + dx), Math.round(ps.y + dy), qtex(sc, 'shroom')).setOrigin(0.5, 1).setDepth(D.actors + (ps.y + dy) / TILE / 100).setScale(0));
      sc.tweens.add({ targets: m, scale: 1, delay: 300 + k * 110, duration: 260, ease: 'Back.out' });
      sc.tweens.add({ targets: m, scale: 0, delay: 4200 + k * 80, duration: 220, ease: 'Quad.in', onComplete: () => m.destroy() });
    });
    later(sc, 1200, () => { face(sc, 'sparkle', 1000); got(sc, 'sneeze'); });
  });
}
function apple(sc, cx, top) {
  const ps = sc.ps, a = sc.keep(sc.add.image(cx, top, qtex(sc, 'apple')).setOrigin(0.5, 1).setDepth(D.fx));
  const tx = Math.round((cx + ps.x) / 2), ty = ps.y - 1;
  sc.tweens.add({ targets: a, y: ty, duration: 420, ease: 'Bounce.out' });
  sc.tweens.add({ targets: a, x: tx, duration: 420, ease: 'Linear' });
  later(sc, 450, () => { sc.hooks.onSound?.('bonk'); float(sc, tx, ty - 8, '툭', '#e8d8b8'); });
  later(sc, 1100, () => {
    float(sc, ps.x, ps.y - 20, '아…', '#f4f0e8');
    const w = sc.keep(sc.add.image(a.x + 1, a.y - 5, qtex(sc, 'grub')).setOrigin(0.5, 1).setDepth(D.fx + 0.01).setScale(1, 0));
    sc.tweens.add({ targets: w, scaleY: 1, duration: 260, ease: 'Back.out' });
    sc.tweens.add({ targets: w, angle: 12, delay: 400, duration: 200, yoyo: true, repeat: 2 });
    mark(sc, w, '!', 1000, 6);
    face(sc, 'shock', 1300);
    later(sc, 900, () => got(sc, 'worm'));
    sc.tweens.add({ targets: [a, w], alpha: 0, delay: 3200, duration: 400, onComplete: () => { a.destroy(); w.destroy(); } });
  });
}
// round on the windmill's sails, once, twice, and off it comes
function mouseRide(sc) {
  const ps = sc.ps, hub = { x: sc.sails.x, y: sc.sails.y }, r = 11;
  const m = sc.keep(sc.add.image(hub.x, hub.y - r, 'pet_mouse').setScale(0.5).setDepth(sc.sails.depth + 0.001));
  sc.hooks.onSound?.('squeak');
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 2000, ease: 'Sine.easeIn',
    onUpdate: tw => { const a = -Math.PI / 2 + tw.getValue() * Math.PI * 4; m.setPosition(Math.round(hub.x + Math.cos(a) * r), Math.round(hub.y + Math.sin(a) * r)).setAngle(a * 180 / Math.PI + 90); },
    onComplete: () => {
      const x0 = m.x, y0 = m.y, tx = ps.x + (hub.x < ps.x ? -12 : 12), ty = ps.y - 2;
      m.setDepth(D.fx);
      sc.tweens.addCounter({
        from: 0, to: 1, duration: 560, ease: 'Linear',
        onUpdate: tw => { const u = tw.getValue(); m.setPosition(Math.round(x0 + (tx - x0) * u), Math.round(y0 + (ty - y0) * u - Math.sin(u * Math.PI) * 18)).setAngle(u * 720); },
        onComplete: () => {
          m.setAngle(0).setOrigin(0.5, 1).setPosition(tx, ty + 2).setDepth(D.actors + (ty + 2) / TILE / 100 + 0.001).setFlipX(tx > ps.x);
          sc.hooks.onSound?.('bonk');
          sc.dust.explode(5, tx, ty + 1);
          mark(sc, m, 'stars', 1800, 9);
          sc.tweens.add({ targets: m, angle: 10, duration: 160, yoyo: true, repeat: 4, ease: 'Sine.easeInOut' });
          face(sc, 'shock', 1000);
          later(sc, 700, () => got(sc, 'mouse'));
          sc.tweens.add({ targets: m, x: hub.x, alpha: 0, delay: 2000, duration: 1400, ease: 'Linear', onStart: () => m.setFlipX(hub.x < m.x), onComplete: () => m.destroy() });
        },
      });
    },
  });
}
function snailOut(sc, img) {
  const top = img.y - img.displayHeight + 2;
  const s = sc.keep(sc.add.image(img.x + 1, top + 4, 'snail').setOrigin(0.5, 1).setScale(0.55).setDepth(img.depth + 0.001).setAlpha(0));
  sc.tweens.add({ targets: s, y: top, alpha: 1, delay: 300, duration: 500, ease: 'Quad.out' });
  later(sc, 850, () => { mark(sc, s, 'anger', 1500, 9); face(sc, 'shock', 1100); sc.hooks.onSound?.('squeak'); });
  later(sc, 1500, () => got(sc, 'snail'));
  sc.tweens.add({ targets: s, y: top + 4, alpha: 0, delay: 2600, duration: 1200, ease: 'Linear', onComplete: () => s.destroy() });
}

// ---------- sitting on a bench ----------
function sit(sc, t, x, y) {
  const qk = sc.qk, ps = sc.ps;
  if (qk.sit) return;
  qk.sit = { x, y, at: sc.time.now, dozed: false };
  sc.tweens.killTweensOf(ps);
  ps.setPosition(center(sc.p.x), foot(sc.p.y));
  sc.tweens.add({ targets: ps, x: center(x), y: foot(y) - 4, duration: 180, ease: 'Quad.out' });
  sc.tweens.add({ targets: ps, hop: 5, duration: 90, yoyo: true, ease: 'Quad.out' });
  ps.setDepth(D.actors + y / 100 + 0.002);
  ps.noShadow = true;
  sc.say(ps, pick(['후유~', '아이고, 다리야.', '앉으니까 좋다.']), 1300);
}
function standUp(sc) {
  const qk = sc.qk, ps = sc.ps;
  if (!qk.sit) return;
  qk.sit = null;
  ps.noShadow = false;
  sc.tweens.killTweensOf(ps);
  ps.setPosition(center(sc.p.x), foot(sc.p.y)).setDepth(D.actors + sc.p.y / 100);
  dropHead(sc);
}
// a while on the bench and you nod off; something lands on your head
function doze(sc, time) {
  const ps = sc.ps;
  ps.expr = 'blink';
  ps.exprUntil = time + 3400;
  for (let k = 0; k < 4; k++) later(sc, k * 850, () => { if (sc.qk.sit) setEmote(ps, 'z', sc.time.now, 800); });
  sc.hooks.onSound?.('snore');
  const petal = sc.keep(sc.add.image(ps.x - 14, ps.y - 46, qtex(sc, 'petal')).setDepth(D.fx));
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 1800, ease: 'Linear',
    onUpdate: tw => { const u = tw.getValue(); petal.setPosition(Math.round(ps.x - 14 * (1 - u) + Math.sin(u * 9) * 3), Math.round(ps.y - 46 + (46 - 17) * u)); },
    onComplete: () => { if (sc.qk.sit) onHead(sc, petal, 1); else petal.destroy(); },
  });
  later(sc, 600, () => { for (const one of sc.folk) if (cheb(one.x, one.y, sc.p.x, sc.p.y) <= 6) setEmote(one.s, '♪', sc.time.now, 1200); });
  later(sc, 2000, () => got(sc, 'benchnap'));
}

// ---------- standing still in the right spot ----------
const beside = (sc, pr) => {
  const cells = propCells(pr).map(([i, j]) => [pr.x + i, pr.y + j]);
  return !cells.some(([x, y]) => x === sc.p.x && y === sc.p.y) && cells.some(([x, y]) => cheb(x, y, sc.p.x, sc.p.y) === 1);
};
const propOf = (sc, kind) => sc.props.find(o => o.pr.kind === kind);
const at = (sc, list) => list.some(([x, y]) => sc.p.x === x && sc.p.y === y);
const along = (sc, y, x0, x1) => sc.p.y === y && sc.p.x >= x0 && sc.p.x <= x1;
const building = (sc, id) => sc.buildings.find(b => b.id === id);
const folkOf = (sc, id) => sc.folk.find(f => f.id === id && !f.busy && f.s.alpha >= 1);
const bag = sc => sc.meta.bag || {};
const waterBy = (sc, pond) => N4.map(([dx, dy]) => [sc.p.x + dx, sc.p.y + dy]).find(([x, y]) => sc.ch(x, y) === '~' && sc.qk.pond.has(`${x},${y}`) === pond);

const SPOTS = [
  { id: 'stare', ms: 4000, find: sc => { const o = propOf(sc, 'scarecrow'); return o && beside(sc, o.pr) && o; }, run: stare },
  { id: 'topiary', ms: 4000, find: sc => sc.props.find(o => o.pr.kind === 'topiary' && beside(sc, o.pr)), run: topiary },
  { id: 'reflect', ms: 4000, busy: 3600, find: sc => { const o = propOf(sc, 'fountain'); return o && beside(sc, o.pr) && o; }, run: reflect },
  { id: 'ducks', ms: 3000, busy: 11000, find: sc => sc.ducks?.length === 3 && waterBy(sc, true), run: ducks },
  { id: 'frog', ms: 1500, find: sc => Object.keys(bag(sc)).some(id => BUGS[id] && bag(sc)[id] > 0) && waterBy(sc, false), run: frog },
  { id: 'fishcat', ms: 1000, find: sc => FISH_IDS.some(id => bag(sc)[id] > 0) && sc.props.find(o => o.pr.kind === 'barrel' && beside(sc, o.pr)), run: fishCat },
  { id: 'farside', ms: 3000, busy: 4000, find: sc => (at(sc, [[19, 41]]) ? [23, 42] : at(sc, [[40, 41]]) ? [36, 41] : null), run: farside },
  { id: 'goldleaf', ms: 4000, find: sc => sc.bigTree && at(sc, [[54, 24]]), run: goldLeaf },
  { id: 'mutter', ms: 3000, busy: 5600, find: sc => along(sc, 12, 28, 32), run: mutter },
  { id: 'candy', ms: 3000, busy: 5000, find: sc => along(sc, 16, 21, 23) && folkOf(sc, 'shop'), run: candy },
  { id: 'practice', ms: 3000, busy: 5600, find: sc => (sc.p.x === 36 || sc.p.x === 42) && sc.p.y >= 9 && sc.p.y <= 11 && HOUSES.find(h => h.id === 'rival').lived, run: practice },
  { id: 'clover', ms: 3000, find: sc => ownsHome(sc.meta) && sc.homeImg?.texture.key !== 'village_lot' && along(sc, 16, 35, 39), run: clover },
  { id: 'freeze', ms: 3000, busy: 6400, find: sc => at(sc, [[6, 10], [6, 12]]), run: freeze },
  { id: 'voice', ms: 5000, busy: 5000, find: sc => at(sc, [[43, 24]]), run: voice },
  { id: 'sparkheart', ms: 4000, find: sc => { const o = propOf(sc, 'campfire'); return o && beside(sc, o.pr) && o; }, run: sparkHeart },
  { id: 'bunsmoke', ms: 3000, find: sc => along(sc, 21, 2, 5) && building(sc, 'bakery'), run: bunSmoke },
  { id: 'heartglass', ms: 3000, find: sc => along(sc, 17, 7, 11) && building(sc, 'greenhouse'), run: heartGlass },
  { id: 'guest', ms: 4000, find: sc => at(sc, [[35, 39]]) && building(sc, 'inn'), run: guest },
  { id: 'spotlight', ms: 3000, busy: 3400, find: sc => at(sc, [[49, 35]]) && building(sc, 'bandstand'), run: spotlight },
  { id: 'pupnap', ms: 5000, busy: 5000, find: sc => sc.pup && !sc.pup.busy && cheb(sc.pup.x, sc.pup.y, sc.p.x, sc.p.y) === 1 && sc.pup, run: pupNap },
];

function stare(sc, o) {
  const img = o.imgs[0], dir = sc.p.x >= o.pr.x ? 1 : -1;
  sc.tweens.add({ targets: img, angle: dir * 9, duration: 500, ease: 'Sine.easeInOut' });
  later(sc, 300, () => mark(sc, img, '?', 1300, img.displayHeight + 2));
  later(sc, 1400, () => { face(sc, 'shock', 900); sc.hooks.onSound?.('alert'); });
  later(sc, 2100, () => { sc.ps.setFlipX(o.pr.x > sc.p.x); setEmote(sc.ps, '…', sc.time.now, 1300); got(sc, 'stare'); });
  sc.tweens.add({ targets: img, angle: 0, delay: 2800, duration: 400, ease: 'Sine.easeInOut' });
}
function topiary(sc, o) {
  const img = o.imgs[0], y0 = img.y;
  sc.hooks.onSound?.('rustle');
  sc.tweens.add({ targets: img, y: y0 - 7, duration: 170, yoyo: true, repeat: 1, ease: 'Quad.out', onComplete: () => { img.y = y0; } });
  later(sc, 360, () => { sc.fall.explode(8, img.x, y0 - 6); sc.hooks.onSound?.('step'); });
  later(sc, 200, () => mark(sc, img, '♪', 1200, img.displayHeight + 2));
  later(sc, 900, () => { face(sc, 'shock', 1000); got(sc, 'topiary'); });
}
// your face in the fountain, upside down, and it blinks first
function reflect(sc, o) {
  const f = o.imgs[0], ps = sc.ps, base = CHARACTERS[sc.p.id].sprite, open = dressKey(sc, base, sc.meta.wear), shut = dressKey(sc, faceKey(base, 'blink'), sc.meta.wear);
  const side = Math.sign(ps.x - f.x) || 1;
  const r = sc.keep(sc.add.image(Math.round(f.x + side * 7), Math.round(f.y - 10), sc.textures.exists(open) ? open : base).setOrigin(0.5, 0)
    .setFlipY(true).setFlipX(ps.flipX).setCrop(0, 0, 16, 9).setScale(0.75).setTint(0x9fd4ff).setAlpha(0).setDepth(f.depth + 0.001));
  sc.tweens.add({ targets: r, alpha: 0.55, duration: 700 });
  later(sc, 1500, () => { if (sc.textures.exists(shut)) r.setTexture(shut); });
  later(sc, 1680, () => r.setTexture(sc.textures.exists(open) ? open : base));
  later(sc, 2100, () => { face(sc, 'shock', 1100); got(sc, 'reflect'); });
  sc.tweens.add({ targets: r, alpha: 0, delay: 3000, duration: 500, onComplete: () => r.destroy() });
}
// the ducklings climb out and fall in behind you (quirkTick moves them)
function ducks(sc, w, time) {
  const d = sc.ducks;
  sc.qk.parade = { t0: time, from: d.slice(1).map(o => ({ x: o.x, y: o.y })), trail: [], pos: d.slice(1).map(o => ({ x: o.x, y: o.y })), water: { x: center(w[0]), y: center(w[1]) } };
  sc.hooks.onSound?.('chirp');
  sc.duckGoal = { x: center(w[0]), y: center(w[1]) };
}
function frog(sc, w) {
  const ps = sc.ps, wx = center(w[0]), wy = center(w[1]) + 4;
  sc.hooks.onSound?.('splash');
  emerge(sc, 'frog', wx, wy, {
    rows: 9, ms: 240, hold: 1500,
    onUp: f => {
      f.setFlipX(ps.x < wx);
      const g = sc.keep(sc.add.graphics().setDepth(D.fx + 0.2)), mx = wx + (ps.x < wx ? -3 : 3), my = wy - 5, tx = ps.x, ty = ps.y - 9;
      sc.tweens.addCounter({
        from: 0, to: 1, duration: 150, yoyo: true, hold: 90, ease: 'Quad.out',
        onUpdate: tw => {
          const u = tw.getValue(), ex = mx + (tx - mx) * u, ey = my + (ty - my) * u, n = Math.max(1, Math.ceil(Math.hypot(ex - mx, ey - my)));
          g.clear().fillStyle(0xe58aa5, 1);
          for (let k = 0; k <= n; k++) g.fillRect(Math.round(mx + (ex - mx) * k / n), Math.round(my + (ey - my) * k / n), 1, 1);
          g.fillStyle(0xd9454a, 1).fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 2, 2);
        },
        onComplete: () => g.destroy(),
      });
      later(sc, 200, () => { float(sc, ps.x, ps.y - 20, '쩝', '#ffd0e0'); face(sc, 'shock', 1200); sc.hooks.onSound?.('pop'); });
      later(sc, 1000, () => got(sc, 'frog'));
    },
  });
}
function fishCat(sc, o) {
  const pr = o.pr, top = foot(pr.y) - 13, ps = sc.ps;
  emerge(sc, 'shadecat', center(pr.x), top, {
    rows: 16, ms: 220, hold: 0,
    onUp: s => {
      sc.hooks.onSound?.('meow');
      s.hop = 0;
      s.setDepth(D.actors + pr.y / 100);
      sc.tweens.add({ targets: s, y: foot(pr.y + 1) - 2, x: s.x + (ps.x > s.x ? 8 : -8), duration: 260, ease: 'Quad.in' });
      sc.qk.follower = { s, until: sc.time.now + 7000, next: 0 };
      later(sc, 900, () => { face(sc, 'sparkle', 1000); got(sc, 'fishcat'); });
    },
  });
}
// across the creek, between the trees: someone waves, and then there is no one
function farside(sc, far) {
  const s = sc.keep(sc.add.image(center(far[0]), foot(far[1]), 'adv').setOrigin(0.5, 1).setTint(0x1b1424).setAlpha(0).setDepth(D.actors + far[1] / 100));
  s.setFlipX(sc.p.x > far[0] ? false : true);
  sc.tweens.add({ targets: s, alpha: 0.7, duration: 900 });
  for (let k = 0; k < 4; k++) later(sc, 1100 + k * 260, () => s.setFlipX(!s.flipX));
  sc.tweens.add({ targets: s, y: s.y - 2, delay: 1100, duration: 130, yoyo: true, repeat: 3 });
  sc.tweens.add({ targets: s, alpha: 0, delay: 2400, duration: 700, onComplete: () => s.destroy() });
  later(sc, 3200, () => { face(sc, 'shock', 1200); setEmote(sc.ps, '?', sc.time.now, 1200); got(sc, 'farside'); });
}
function goldLeaf(sc) {
  const ps = sc.ps;
  for (let k = 0; k < 8; k++) {
    const m = sc.keep(sc.add.image(0, 0, 'px').setTint(0xf4cf4f).setScale(1.4).setDepth(D.fx));
    sc.tweens.addCounter({
      from: 0, to: 1, duration: 1300, ease: 'Quad.in',
      onUpdate: tw => { const u = tw.getValue(), a = k * 0.8 + u * 5, r = 30 * (1 - u); m.setPosition(Math.round(ps.x + Math.cos(a) * r), Math.round(ps.y - 30 + Math.sin(a) * r * 0.6)); },
      onComplete: () => m.destroy(),
    });
  }
  const leaf = sc.keep(sc.add.image(ps.x - 10, ps.y - 52, qtex(sc, 'goldleaf')).setDepth(D.fx));
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 1700, delay: 1100, ease: 'Linear',
    onUpdate: tw => { const u = tw.getValue(); leaf.setPosition(Math.round(ps.x - 10 * (1 - u) + Math.sin(u * 8) * 4), Math.round(ps.y - 52 + (52 - 18) * u)).setAngle(Math.sin(u * 8) * 25); },
    onComplete: () => { leaf.setAngle(0); onHead(sc, leaf, 0); sc.spark.explode(8, ps.x, ps.y - 18); face(sc, 'sparkle', 1500); got(sc, 'goldleaf'); },
  });
}
function mutter(sc) {
  const ps = sc.ps;
  murmur(sc, ps.x, ps.y - 20, '(…올해도 하나 늘었군.)', 2000);
  later(sc, 700, () => setEmote(ps, '…', sc.time.now, 1300));
  later(sc, 2700, () => murmur(sc, ps.x, ps.y - 20, '(…아니. 돌아올 거야.)', 2000));
  later(sc, 5000, () => got(sc, 'mutter'));
}
// the shopkeeper slips out round the back for a sweet
function candy(sc, one) {
  const x = sc.p.x + (sc.p.x <= 22 ? 1 : -1), y = 16;
  one.busy = true;
  sc.tweens.add({ targets: one.s, alpha: 0, duration: 250 });
  const s = sc.keep(sc.add.image(center(x), foot(y), 'shopkeep').setOrigin(0.5, 1).setDepth(D.actors + y / 100 + 0.001).setAlpha(0).setFlipX(x < sc.p.x));
  s.hop = 0;
  const c = sc.keep(sc.add.image(s.x + (s.flipX ? 4 : -4), s.y - 8, 'candy').setScale(0.4).setDepth(s.depth + 0.0001).setAlpha(0));
  sc.tweens.add({ targets: [s, c], alpha: 1, duration: 300 });
  later(sc, 400, () => { mark(sc, s, '♪', 1100); sc.tweens.add({ targets: s, hop: 2, duration: 120, yoyo: true, repeat: 3 }); sc.hooks.onSound?.('candy'); });
  later(sc, 1700, () => { s.setFlipX(!s.flipX); mark(sc, s, 'sweat', 1400); sc.hooks.onSound?.('alert'); });
  later(sc, 2000, () => { sc.say(s, '…못 본 거다?', 1800); c.destroy(); face(sc, 'shock', 900); });
  later(sc, 3000, () => got(sc, 'candy'));
  sc.tweens.add({ targets: s, alpha: 0, delay: 3900, duration: 300, onComplete: () => s.destroy() });
  later(sc, 4200, () => { sc.tweens.add({ targets: one.s, alpha: 1, duration: 300 }); one.busy = false; });
}
function practice(sc) {
  const ps = sc.ps, h = HOUSES.find(o => o.id === 'rival');
  murmur(sc, ps.x, ps.y - 20, '(고, 고마워…)', 1600);
  later(sc, 2000, () => murmur(sc, ps.x, ps.y - 20, '(…아니. 고맙다!)', 1900));
  later(sc, 4300, () => {
    sc.hooks.onSound?.('bonk');
    float(sc, ps.x, ps.y - 14, '쿵', '#d8c8a8');
    shake(h.img, 2);
    sc.dust.explode(6, ps.x, ps.y + 6);
    setEmote(ps, '…', sc.time.now, 1300);
    got(sc, 'practice');
  });
}
function clover(sc) {
  const ps = sc.ps;
  [[-13, 2], [12, 3], [-7, -7], [8, -6], [0, 7], [-16, -3]].forEach(([dx, dy], k) => {
    const c = sc.keep(sc.add.image(Math.round(ps.x + dx), Math.round(ps.y + dy), qtex(sc, 'clover')).setOrigin(0.5, 1).setDepth(D.deco + 0.5).setScale(0));
    sc.tweens.add({ targets: c, scale: 1, delay: k * 140, duration: 280, ease: 'Back.out' });
    later(sc, k * 140 + 100, () => sc.spark.explode(3, c.x, c.y - 4));
    sc.tweens.add({ targets: c, alpha: 0, delay: 6500 + k * 100, duration: 500, onComplete: () => c.destroy() });
  });
  sc.hooks.onSound?.('grow');
  later(sc, 1100, () => { face(sc, 'sparkle', 1500); got(sc, 'clover'); });
}
// 무궁화 꽃이 피었습니다: the sparrows creep up while your back is turned, and freeze when you turn round
function freeze(sc) {
  const ps = sc.ps, back = 1;
  ps.setFlipX(true);
  const birds = [40, 50].map((dx, k) => sc.keep(sc.add.image(ps.x + back * dx, ps.y - 1 - k, critter(sc, 'bird0')).setOrigin(0.5, 1).setFlipX(true).setAlpha(0).setDepth(D.actors + (sc.p.y + 0.5) / 100)));
  sc.tweens.add({ targets: birds, alpha: 1, duration: 300 });
  for (let r = 0; r < 3; r++) {
    const t0 = 300 + r * 1700;
    birds.forEach((b, k) => {
      sc.tweens.add({ targets: b, x: b.x - back * (r + 1) * 9 - 0, delay: t0, duration: 900, ease: 'Linear' });
      sc.tweens.add({ targets: b, y: b.y - 2, delay: t0 + k * 60, duration: 110, yoyo: true, repeat: 3 });
    });
    later(sc, t0 + 1000, () => { ps.setFlipX(false); float(sc, ps.x, ps.y - 20, '홱!', '#f4f0e8'); birds.forEach(b => mark(sc, b, '!', 500, 7)); });
    if (r < 2) later(sc, t0 + 1550, () => ps.setFlipX(true));
  }
  later(sc, 5500, () => {
    sc.hooks.onSound?.('chirp');
    birds.forEach((b, k) => { b.setTexture(critter(sc, 'bird1')).setFlipX(false); sc.tweens.add({ targets: b, x: b.x + 50 + k * 10, y: b.y - 40, alpha: 0, duration: 900, ease: 'Quad.in', onComplete: () => b.destroy() }); });
    face(sc, 'sparkle', 1200);
    got(sc, 'freeze');
  });
}
function voice(sc) {
  const x = center(43), y = foot(23) - 4;
  murmur(sc, x, y, '…어이—', 1800, '#a8b8c8');
  later(sc, 900, () => face(sc, 'shock', 1100));
  later(sc, 2600, () => murmur(sc, x, y - 2, '…거기 누구 있어?', 1600, '#a8b8c8', 0.6));
  later(sc, 4400, () => { setEmote(sc.ps, '…', sc.time.now, 1300); got(sc, 'voice'); });
}
function sparkHeart(sc, o) {
  const img = o.imgs[0], cx = img.x, cy = img.y - 30, tints = [0xf4cf4f, 0xf08c3a, 0xffffff];
  sc.hooks.onSound?.('pop');
  for (let k = 0; k < 16; k++) {
    const t = k / 16 * Math.PI * 2, hx = 16 * Math.sin(t) ** 3 * 0.45, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.45;
    const s = sc.keep(sc.add.image(cx, img.y - 8, 'px').setTint(tints[k % 3]).setScale(1.5).setDepth(D.fx));
    sc.tweens.add({ targets: s, x: Math.round(cx + hx), y: Math.round(cy + hy), duration: 500, ease: 'Quad.out' });
    sc.tweens.add({ targets: s, y: Math.round(cy + hy) - 12, alpha: 0, delay: 1300, duration: 800, ease: 'Quad.in', onComplete: () => s.destroy() });
  }
  later(sc, 700, () => { face(sc, 'sparkle', 1400); got(sc, 'sparkheart'); });
}
function bunSmoke(sc, b) {
  const ps = sc.ps, at = chimneyAt(b) || [b.w * 8, 0], x = b.x * TILE + at[0], y = b.y * TILE + at[1];
  float(sc, ps.x, ps.y - 18, '꼬르륵', '#f4dc7a');
  setEmote(ps, 'sweat', sc.time.now, 1200);
  const bun = sc.keep(sc.add.image(x, y - 4, qtex(sc, 'bun')).setDepth(D.fx).setAlpha(0).setScale(0.5));
  sc.tweens.add({ targets: bun, alpha: 0.85, scale: 1, delay: 800, duration: 700 });
  sc.tweens.add({ targets: bun, y: y - 30, delay: 800, duration: 3000, ease: 'Sine.easeOut' });
  sc.tweens.add({ targets: bun, x: x + 3, delay: 800, duration: 700, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
  sc.tweens.add({ targets: bun, alpha: 0, delay: 2900, duration: 900, onComplete: () => bun.destroy() });
  later(sc, 1800, () => { face(sc, 'sparkle', 1200); got(sc, 'bunsmoke'); });
}
// breath on the greenhouse glass, and someone on the other side draws a heart in it
function heartGlass(sc, b) {
  const ps = sc.ps, x = Math.round(ps.x), y = foot(b.y + b.h - 1) - 10, d = b.img.depth + 0.001;
  sc.hooks.onSound?.('puff');
  const fog = sc.keep(sc.add.image(x, y, qtex(sc, 'fog')).setDepth(d).setAlpha(0));
  sc.tweens.add({ targets: fog, alpha: 0.75, duration: 500 });
  const h = sc.keep(sc.add.image(x - 3, y - 3, qtex(sc, 'heart')).setOrigin(0, 0).setDepth(d + 0.0001).setCrop(0, 0, 0, 6).setTint(0xf29bb2));
  sc.tweens.addCounter({ from: 0, to: 7, delay: 900, duration: 700, ease: 'Linear', onUpdate: tw => h.setCrop(0, 0, Math.round(tw.getValue()), 6) });
  later(sc, 1700, () => { face(sc, 'shock', 1200); got(sc, 'heartglass'); });
  sc.tweens.add({ targets: [fog, h], alpha: 0, delay: 3600, duration: 800, onComplete: () => { fog.destroy(); h.destroy(); } });
}
function guest(sc, b) {
  const x = center(35), y = foot(b.y + b.h - 1) - 1;
  const r = sc.keep(sc.add.image(x - 3, y, 'rat').setOrigin(0.5, 1).setScale(0.6).setAlpha(0).setDepth(b.img.depth + 0.001));
  sc.tweens.add({ targets: r, alpha: 1, x: x + 1, delay: 200, duration: 400, ease: 'Quad.out' });
  later(sc, 700, () => { sc.hooks.onSound?.('squeak'); float(sc, x, y - 12, '찍', '#f4f0e8'); mark(sc, r, '?', 1000, 11); });
  later(sc, 1500, () => { face(sc, 'shock', 1000); got(sc, 'guest'); });
  sc.tweens.add({ targets: r, alpha: 0, x: x - 3, delay: 2300, duration: 300, onComplete: () => r.destroy() });
}
function spotlight(sc) {
  const ps = sc.ps;
  const cone = sc.keep(sc.add.image(ps.x, ps.y + 2, qtex(sc, 'cone')).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(D.fx - 0.2));
  const pool = sc.keep(sc.add.image(ps.x, ps.y - 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0a0).setScale(1.3, 0.6).setAlpha(0).setDepth(D.deco + 0.6));
  sc.hooks.onSound?.('zap');
  sc.tweens.add({ targets: [cone, pool], alpha: 0.6, duration: 120 });
  for (let k = 0; k < 4; k++) later(sc, 500 + k * 380, () => { sc.tweens.add({ targets: ps, hop: 5, duration: 150, yoyo: true, ease: 'Quad.out' }); ps.setFlipX(!ps.flipX); setEmote(ps, '♪', sc.time.now, 700); });
  later(sc, 700, () => sc.hooks.onSound?.('tune'));
  later(sc, 1300, () => { for (const one of sc.folk) if (cheb(one.x, one.y, sc.p.x, sc.p.y) <= 8) setEmote(one.s, '♥', sc.time.now, 1200); got(sc, 'spotlight'); });
  sc.tweens.add({ targets: [cone, pool], alpha: 0, delay: 2600, duration: 500, onComplete: () => { cone.destroy(); pool.destroy(); } });
}
function pupNap(sc, pup) {
  const ps = sc.ps, s = pup.s, dir = Math.sign(ps.x - s.x) || 1, x0 = s.x;
  pup.busy = true;
  s.setFlipX(dir > 0);
  sc.tweens.add({ targets: s, x: x0 + dir * 4, angle: dir * 14, duration: 500, ease: 'Sine.easeInOut' });
  for (let k = 0; k < 4; k++) later(sc, 600 + k * 1000, () => { setEmote(s, 'z', sc.time.now, 900); later(sc, 300, () => setEmote(ps, 'z', sc.time.now, 800)); });
  ps.expr = 'blink';
  ps.exprUntil = sc.time.now + 4400;
  later(sc, 1500, () => got(sc, 'pupnap'));
  later(sc, 4600, () => {
    sc.tweens.add({ targets: s, x: center(pup.x), angle: 0, duration: 300, ease: 'Sine.easeInOut', onComplete: () => { pup.busy = false; } });
    sc.tweens.add({ targets: s, hop: 4, duration: 110, yoyo: true, ease: 'Quad.out' });
  });
}
// fresh from the bath, the puppy sniffs you all over and sneezes at the soap
function soap(sc, pup) {
  const s = pup.s;
  pup.busy = true;
  s.setFlipX(sc.p.x > pup.x);
  for (let k = 0; k < 3; k++) later(sc, k * 260, () => sc.tweens.add({ targets: s, hop: 2, duration: 90, yoyo: true, ease: 'Quad.out' }));
  float(sc, s.x, s.y - 14, '킁킁', '#f4f0e8');
  later(sc, 1100, () => {
    sc.hooks.onSound?.('sneeze');
    float(sc, s.x, s.y - 14, '에취!', '#c8ecf8');
    for (let k = 0; k < 6; k++) {
      const b = sc.keep(sc.add.image(s.x + (k - 2.5) * 3, s.y - 8, qtex(sc, 'bubble')).setDepth(D.fx).setScale(0.6));
      sc.tweens.add({ targets: b, y: b.y - 16 - k * 3, x: b.x + (k % 2 ? 4 : -4), scale: 1, duration: 900 + k * 120, ease: 'Sine.easeOut' });
      sc.tweens.add({ targets: b, alpha: 0, scale: 1.4, delay: 800 + k * 120, duration: 200, onComplete: () => b.destroy() });
    }
    for (let k = 0; k < 4; k++) later(sc, 300 + k * 120, () => s.setFlipX(!s.flipX));
    face(sc, 'shock', 900);
  });
  later(sc, 1700, () => got(sc, 'soap'));
  later(sc, 2400, () => { pup.busy = false; });
}

// ---------- following someone about ----------
const FOLLOWED = {
  whisper(sc, one) {
    const left = Object.keys(QUIRK_HINTS).filter(id => !sc.meta.book?.[quirkId(id)]);
    one.busy = true;
    one.s.setFlipX(sc.p.x < one.x);
    setEmote(one.s, '!', sc.time.now, 900);
    sc.say(one.s, '왜 따라와? …비밀 하나 알려 줄까?', 2300);
    later(sc, 2500, () => { sc.say(one.s, left.length ? QUIRK_HINTS[pick(left)] : '…아니다, 이제 네가 나보다 더 잘 알겠지.', 3200); face(sc, 'sparkle', 1200); got(sc, 'whisper'); });
    later(sc, 5800, () => { one.busy = false; one.next = sc.time.now + 1500; });
  },
  stretch(sc, one) {
    const ps = sc.ps;
    one.busy = true;
    one.s.setFlipX(sc.p.x < one.x);
    setEmote(one.s, 'anger', sc.time.now, 1100);
    sc.say(one.s, '따라 하지 마!', 1500);
    later(sc, 1000, () => sc.tweens.add({ targets: one.s, sy: 1.18, sx: 0.9, duration: 260, yoyo: true, hold: 400, ease: 'Sine.easeInOut' }));
    later(sc, 1500, () => sc.tweens.add({ targets: ps, sy: 1.18, sx: 0.9, duration: 260, yoyo: true, hold: 400, ease: 'Sine.easeInOut' }));
    later(sc, 2700, () => { sc.say(one.s, '…흥.', 1200); face(sc, 'sparkle', 1000); got(sc, 'stretch'); });
    later(sc, 3800, () => { one.busy = false; one.next = sc.time.now + 1500; });
  },
  bandage(sc, one) {
    const ps = sc.ps, dir = Math.sign(ps.x - one.s.x) || 1, x0 = center(one.x);
    one.busy = true;
    one.s.setFlipX(dir < 0);
    setEmote(one.s, '!', sc.time.now, 900);
    sc.say(one.s, '어디 다쳤어?!', 1400);
    sc.tweens.add({ targets: one.s, x: x0 + dir * Math.max(0, Math.abs(ps.x - x0) - 12), duration: 320, delay: 300, ease: 'Quad.out' });
    later(sc, 1100, () => {
      const b = sc.keep(sc.add.image(ps.x, ps.y - 15, 'bandage').setScale(0.45).setDepth(D.fx).setAngle(-20));
      onHead(sc, b, 2, 9000);
      sc.hooks.onSound?.('pop');
      sc.say(one.s, '자, 이제 괜찮아.', 1600);
      face(sc, 'sparkle', 1200);
      got(sc, 'bandage');
    });
    later(sc, 2900, () => sc.tweens.add({ targets: one.s, x: x0, duration: 320, ease: 'Quad.out', onComplete: () => { one.busy = false; one.next = sc.time.now + 1500; } }));
  },
};

// everyone waves at once, when the last of them has had their hello
function helloAll(sc) {
  sc.folk.forEach((one, k) => later(sc, k * 140, () => {
    if (one.busy) return;
    one.s.setFlipX(sc.p.x < one.x);
    sc.tweens.add({ targets: one.s, hop: 5, duration: 130, yoyo: true, repeat: 1, ease: 'Quad.out' });
    setEmote(one.s, '♥', sc.time.now, 1400);
  }));
  sc.hooks.onSound?.('welcome');
  later(sc, 700, () => { face(sc, 'sparkle', 1400); got(sc, 'hello'); });
}
function petals(sc) {
  const ps = sc.ps;
  sc.qk.petals.explode(36, ps.x, ps.y - 40);
  later(sc, 300, () => sc.qk.petals.explode(24, ps.x, ps.y - 40));
  sc.hooks.onSound?.('fanfare');
  const nb = sc.folk.find(f => f.id === 'neighbor' && !f.busy && cheb(f.x, f.y, sc.p.x, sc.p.y) <= 8);
  if (nb) later(sc, 500, () => sc.say(nb.s, '어머, 축하해!', 1500));
  later(sc, 300, () => { for (const one of sc.folk) if (cheb(one.x, one.y, sc.p.x, sc.p.y) <= 8) setEmote(one.s, '♥', sc.time.now, 1200); });
  later(sc, 900, () => { face(sc, 'sparkle', 1400); got(sc, 'petals'); });
}
function tangle(sc) {
  const ps = sc.ps, r = sc.keep(sc.add.image(ps.x, ps.y - 7, qtex(sc, 'ribbon')).setDepth(D.fx - 0.05).setScale(0, 1));
  sc.qk.wrap = r;
  sc.tweens.add({ targets: r, scaleX: 1, duration: 300, ease: 'Back.out' });
  float(sc, ps.x, ps.y - 20, '칭칭', '#f29bb2');
  face(sc, 'shock', 1200);
  later(sc, 1300, () => { setEmote(ps, 'sweat', sc.time.now, 1100); got(sc, 'tangle'); });
  later(sc, 2700, () => {
    for (let k = 0; k < 4; k++) later(sc, k * 90, () => ps.setFlipX(!ps.flipX));
    sc.qk.wrap = null;
    float(sc, ps.x, ps.y - 20, '휙', '#f4f0e8');
    sc.tweens.add({ targets: r, y: r.y - 18, alpha: 0, angle: 30, duration: 600, ease: 'Quad.out', onComplete: () => r.destroy() });
  });
}

// ---------- the ducklings' walk ----------
function paradeTick(sc, time) {
  const pd = sc.qk.parade, d = sc.ducks, ps = sc.ps, el = time - pd.t0;
  const last = pd.trail[0];
  if (!last || Math.hypot(ps.x - last.x, ps.y - last.y) >= 2) { pd.trail.unshift({ x: ps.x, y: ps.y }); if (pd.trail.length > 80) pd.trail.pop(); }
  // a point `k` pixels back along where you walked (or behind your back, where you have not)
  const behind = k => {
    let need = k, prev = { x: ps.x, y: ps.y };
    for (const pt of pd.trail) {
      const l = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      if (l >= need && l > 0) { const u = need / l; return { x: prev.x + (pt.x - prev.x) * u, y: prev.y + (pt.y - prev.y) * u }; }
      need -= l;
      prev = pt;
    }
    return { x: prev.x + (ps.flipX ? need : -need), y: prev.y - 1 };
  };
  const OUT = 1300, FOLLOW_MS = 9000, BACK = 1500;
  d.slice(1).forEach((one, i) => {
    const goal = behind(10 + i * 8), p = pd.pos[i];
    if (el < OUT) {
      const u = Math.min(1, el / OUT), f = pd.from[i];
      p.x = f.x + (goal.x - f.x) * u; p.y = f.y + (goal.y - f.y) * u - Math.sin(u * Math.PI) * 6;
    } else if (el < FOLLOW_MS) { p.x += (goal.x - p.x) * 0.2; p.y += (goal.y - p.y) * 0.2; }
    else {
      const u = Math.min(1, (el - FOLLOW_MS) / BACK), w = { x: d[0].x - (i + 1) * 7, y: d[0].y };
      if (!p.back) p.back = { x: p.x, y: p.y };
      p.x = p.back.x + (w.x - p.back.x) * u; p.y = p.back.y + (w.y - p.back.y) * u - Math.sin(u * Math.PI) * 5;
    }
    if (Math.abs(goal.x - p.x) > 0.5) one.img.setFlipX(goal.x > p.x);
    const waddle = el > OUT && el < FOLLOW_MS ? Math.abs(Math.sin(time / 120 + i)) * 1 : 0;
    one.x = p.x; one.y = p.y;
    one.img.setPosition(Math.round(p.x), Math.round(p.y - waddle)).setDepth(el < FOLLOW_MS + BACK * 0.6 ? D.actors + Math.floor(p.y / TILE) / 100 + 0.001 : D.deco + 0.6);
  });
  if (el < FOLLOW_MS) sc.duckGoal = { ...pd.water };
  if (el >= OUT && !pd.said) {
    pd.said = true;
    sc.hooks.onSound?.('chirp');
    setEmote(ps, '♥', time, 1300);
    face(sc, 'sparkle', 1300);
    got(sc, 'ducks');
  }
  if (el >= FOLLOW_MS + BACK) { sc.qk.parade = null; d.slice(1).forEach(o => o.img.setDepth(D.deco + 0.6)); }
}

// ---------- every frame (VillageScene update, last) ----------
export function quirkTick(sc, time, dt) {
  const qk = sc.qk, ps = sc.ps, p = sc.p;
  if (!qk || !ps) return;
  const here = `${p.x},${p.y}`;
  if (here !== qk.last) { qk.last = here; qk.moves++; moved(sc, time); }
  // standing still somewhere (sitting on a bench counts)
  const still = !sc.path.length && !sc.pending && time >= (ps.stepUntil || 0) && !ps.diving && !sc.play && !sc.fishing && !sc.showing && !modalUp();
  if (!still || here !== qk.at) { qk.at = here; qk.from = time; }
  const stillMs = still ? time - qk.from : 0;
  if (still && time > qk.busyUntil) {
    for (const sp of SPOTS) {
      if (stillMs < sp.ms || qk.done.has(sp.id)) continue;
      const ctx = sp.find(sc);
      if (!ctx) continue;
      qk.done.add(sp.id);
      qk.busyUntil = time + (sp.busy || 2500);
      sp.run(sc, ctx, time);
      break;
    }
  }
  // the well's 야호, heard again down in the fountain
  if (time - qk.wellAt < 10000 && !qk.done.has('underecho')) {
    const o = propOf(sc, 'fountain');
    if (o && beside(sc, o.pr)) {
      qk.done.add('underecho');
      const f = o.imgs[0];
      sc.drops.explode(10, f.x, f.y - 14);
      later(sc, 600, () => { float(sc, f.x, f.y - 22, '…호', '#9fd4ff'); sc.drops.explode(6, f.x, f.y - 14); sc.hooks.onSound?.('splash'); });
      later(sc, 1200, () => { face(sc, 'shock', 1200); got(sc, 'underecho'); });
    }
  }
  // the bench: nodding off after a while
  if (qk.sit && !qk.sit.dozed && time - qk.sit.at > 6000) { qk.sit.dozed = true; if (!qk.done.has('benchnap')) { qk.done.add('benchnap'); doze(sc, time); } }
  // a hello to everyone: they all wave once the talk is over
  if (qk.hello && time > qk.hello && !modalUp()) { qk.hello = 0; helloAll(sc); }
  // following the neighbour, the rival or the rescuer about
  for (const one of sc.folk) {
    const f = FOLLOW[one.id];
    if (!f) continue;
    let st = qk.folk.get(one);
    if (!st) qk.folk.set(one, st = { x: one.x, y: one.y, n: 0, m: qk.moves });
    if (one.x === st.x && one.y === st.y) continue;
    st.x = one.x; st.y = one.y;
    const d = cheb(one.x, one.y, p.x, p.y);
    if (d >= 2 && d <= 5 && qk.moves > st.m) { st.n++; st.m = qk.moves; }
    else if (d > 6) st.n = 0;
    if (st.n >= f[1] && !one.busy && !qk.done.has(f[0]) && !modalUp()) { st.n = 0; qk.done.add(f[0]); FOLLOWED[f[0]](sc, one); }
  }
  if (qk.parade) paradeTick(sc, time);
  // the cat after your fish
  const cat = qk.follower;
  if (cat) {
    const s = cat.s;
    if (!s.active) qk.follower = null;
    else if (time > cat.until) {
      qk.follower = null;
      const away = s.x < ps.x ? -1 : 1;
      s.setFlipX(away < 0);
      sc.tweens.add({ targets: s, x: s.x + away * 90, alpha: 0, duration: 1600, ease: 'Quad.in', onComplete: () => s.destroy() });
    } else {
      const gx = ps.x + (ps.flipX ? 13 : -13), gy = ps.y;
      s.x += (gx - s.x) * 0.06; s.y += (gy - s.y) * 0.06;
      s.setFlipX(ps.x < s.x).setDepth(D.actors + (s.y / TILE - 1) / 100);
      if (time > cat.next) { cat.next = time + 1600; mark(sc, s, '♥', 1000, 18); }
    }
  }
  // what is on your head comes off when you walk on
  const h = qk.head;
  if (h) {
    if (h.at !== qk.last || time > h.until || !h.img.active) dropHead(sc);
    else h.img.setPosition(Math.round(ps.x), Math.round(ps.y - TILE - (ps.hop || 0) + h.dy));
  }
  if (qk.wrap?.active) qk.wrap.setPosition(Math.round(ps.x), Math.round(ps.y - 7 - (ps.hop || 0))).setDepth(ps.depth + 0.001);
  // lamps' glows held for a moment
  for (const [img, o] of qk.glows) {
    if (time > o.until || !img.active) { qk.glows.delete(img); img.setScale?.(1); continue; }
    img.setAlpha(o.alpha);
    if (o.scale) img.setScale(o.scale);
  }
  // marks over things that are not people
  qk.g.clear();
  qk.marks = qk.marks.filter(m => m.s.active !== false && m.s.emote && time <= m.s.emote.until);
  for (const m of qk.marks) drawEmote(qk.g, m.s, m.s.x, m.s.y - m.dy - (m.s.hop || 0), time);
}

// you stepped onto a new cell: the arches, the maypole
function moved(sc, time) {
  const qk = sc.qk, p = sc.p, pr = sc.propAt(p.x, p.y);
  if (pr?.kind === 'arch') {
    qk.arches.set(`${pr.x},${pr.y}`, time);
    for (const [k, t] of qk.arches) if (time - t > 30000) qk.arches.delete(k);
    if (qk.arches.size >= 3 && !qk.done.has('petals')) { qk.done.add('petals'); petals(sc); }
  }
  if (MAYPOLE && sc.maypole) {
    const d = cheb(p.x, p.y, MAYPOLE.x, MAYPOLE.y);
    if (d < 1 || d > 2) { qk.spin = null; return; }
    const a = Math.atan2(p.y - MAYPOLE.y, p.x - MAYPOLE.x);
    if (!qk.spin) { qk.spin = { a, sum: 0 }; return; }
    let da = a - qk.spin.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    qk.spin.a = a;
    qk.spin.sum += da;
    if (Math.abs(qk.spin.sum) >= Math.PI * 4 && !qk.done.has('tangle')) { qk.done.add('tangle'); qk.spin = null; tangle(sc); }
  }
}
