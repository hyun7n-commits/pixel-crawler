// 비밀 in the village (v0.28, data/secrets.js): what happens when you poke at the things round you that
// nobody said you could. Shake the woods three times and the squirrel up there drops an acorn on your
// head; poke the pond and the big koi leaps out and soaks you; rattle a barrel and a cat jumps out; knock
// three times on the big tree's tiny door and someone small pushes out a cookie. Stand still in the
// flowers and the butterflies take you for one; make enough of a fuss of the puppy and it does a trick.
// The first time, each one is a secret found (main.js foundSecret); after that it still happens, it is
// just yours now.

import { TILE } from './textures.js';
import { critterCanvas } from './village-props.js';
import { BIG_TREE } from '../data/village.js';
import { D } from './VillageScene.js';

const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const tex = (sc, name) => {
  const key = `v_${name}`;
  if (!sc.textures.exists(key)) sc.textures.addCanvas(key, critterCanvas(name));
  return key;
};

// the tiny door in the big tree's roots, in world pixels (scenes/landmarks.js bigTreeCanvas: 3px right of
// the trunk's middle, 6 wide, 10 high, its sill on the picture's ground line)
const DOOR = { x0: center(BIG_TREE.x) + 3, x1: center(BIG_TREE.x) + 9, y0: foot(BIG_TREE.y) - 11, y1: foot(BIG_TREE.y) - 1 };

// what there is to poke at, if anything
export function pokeKind(sc, x, y) {
  if (sc.bigTree && BIG_TREE.block.some(([bx, by]) => bx === x && by === y)) return 'door';
  const pr = sc.propAt(x, y);
  if (pr) return pr.kind === 'barrel' || pr.kind === 'crate' ? 'barrel' : null;
  if (sc.buildingAt(x, y) || sc.houseAt(x, y) || sc.homeAt(x, y) || sc.decorAt(x, y)) return null;
  const ch = sc.ch(x, y);
  return ch === '~' ? 'water' : ch === '#' || ch === 'T' ? 'woods' : null;
}

// A poke: you lean in and it does its thing. Three in a row at the same thing (any bit of the woods or
// the pond, that barrel, the door) and more happens.
export function poke(sc, x, y) {
  const kind = pokeKind(sc, x, y);
  if (!kind) return false;
  const now = sc.time.now, key = kind === 'barrel' ? `${x},${y}` : kind, st = sc.pokes;
  st.n = st.key === key && now - st.t < 2600 ? st.n + 1 : 1;
  st.key = key;
  st.t = now;
  if (x !== sc.p.x) sc.ps.setFlipX(x < sc.p.x);
  lean(sc, x, y);
  POKE[kind](sc, x, y, st.n);
  return true;
}

function lean(sc, x, y) {
  const ps = sc.ps, bx = center(sc.p.x), by = foot(sc.p.y);
  sc.tweens.killTweensOf(ps);
  ps.setPosition(bx, by);
  sc.tweens.add({ targets: ps, x: bx + Math.sign(x - sc.p.x) * 3, y: by + Math.sign(y - sc.p.y) * 3, duration: 60, yoyo: true, ease: 'Quad.out' });
}

const POKE = {
  // the woods rustle and leaves come down; the third time, the squirrel up there drops an acorn on you
  woods(sc, x, y, n) {
    sc.hooks.onSound?.('rustle');
    sc.fall.explode(4 + n * 3, center(x), y * TILE + 3);
    const t = sc.treeAt(x, y);
    if (t && !t.shaking) {
      t.shaking = true;
      const x0 = t.x;
      sc.tweens.add({ targets: t, x: x0 + 1, duration: 45, yoyo: true, repeat: 2, onComplete: () => { t.x = x0; t.shaking = false; } });
    }
    if (n % 3) return;
    const ps = sc.ps, a = sc.add.image(ps.x, ps.y - 44, tex(sc, 'acorn')).setDepth(D.fx);
    sc.tweens.add({
      targets: a, y: ps.y - 17, duration: 320, ease: 'Quad.in',
      onComplete: () => {
        sc.hooks.onSound?.('bonk');
        float(sc, ps.x, ps.y - 20, '콩!', '#f4cf4f');
        face(sc, 'hit', 1000);
        sc.tweens.add({ targets: a, x: a.x + (ps.flipX ? -12 : 12), y: ps.y - 3, angle: 260, duration: 420, ease: 'Quad.out' });
        sc.tweens.add({ targets: a, alpha: 0, delay: 900, duration: 300, onComplete: () => a.destroy() });
        emerge(sc, 'goblin', center(x), y * TILE + 4, { rows: 9, hold: 1100, onUp: s => sc.say(s, '킥킥', 900) });
        sc.time.delayedCall(700, () => sc.hooks.onSecret?.('acorn'));
      },
    });
  },
  // a ripple; the third time, the big koi leaps out right in front of you and you get soaked
  water(sc, x, y, n) {
    sc.hooks.onSound?.('splash');
    ripple(sc, center(x), center(y));
    sc.drops.explode(4, center(x), center(y));
    if (n % 3) return;
    const k = sc.add.image(center(x), center(y), tex(sc, 'koi')).setDepth(D.fx).setScale(0.6);
    const dir = sc.p.x >= x ? 1 : -1, x0 = center(x) - dir * 8, x1 = center(x) + dir * 10, y0 = center(y);
    k.setFlipX(dir > 0).setPosition(x0, y0);
    sc.drops.explode(10, x0, y0);
    sc.tweens.addCounter({
      from: 0, to: 1, duration: 620, ease: 'Linear',
      onUpdate: tw => {
        const u = tw.getValue();
        k.setPosition(Math.round(x0 + (x1 - x0) * u), Math.round(y0 - 22 * Math.sin(u * Math.PI))).setAngle(dir * (-50 + 100 * u)).setScale(0.6 + 0.4 * Math.sin(u * Math.PI));
      },
      onComplete: () => {
        k.destroy();
        sc.hooks.onSound?.('splash');
        ripple(sc, x1, y0);
        sc.drops.explode(18, x1, y0);
        // and some of it on you
        sc.drops.explode(12, sc.ps.x, sc.ps.y - 14);
        float(sc, sc.ps.x, sc.ps.y - 20, '첨벙!', '#9fd4ff');
        face(sc, 'shock', 1100);
        sc.time.delayedCall(500, () => sc.hooks.onSecret?.('koi'));
      },
    });
  },
  // the barrel rattles; the third time, a cat that was asleep in it jumps out and makes off (once a visit)
  barrel(sc, x, y, n) {
    sc.hooks.onSound?.('knock');
    const img = sc.props.find(o => o.pr === sc.propAt(x, y))?.imgs[0];
    if (img && !img.shaking) {
      img.shaking = true;
      const x0 = img.x;
      sc.tweens.add({ targets: img, x: x0 + 1, duration: 40, yoyo: true, repeat: 3, onComplete: () => { img.x = x0; img.shaking = false; } });
    }
    float(sc, center(x), y * TILE - 2, '덜컹', '#d8c8a8');
    if (n < 3 || sc.catOut) return;
    sc.catOut = true;
    const pr = sc.propAt(x, y), top = foot(pr.y) - 13;
    sc.time.delayedCall(250, () => emerge(sc, 'shadecat', center(x), top, {
      rows: 16, ms: 220, hold: 0,
      onUp: s => {
        sc.hooks.onSound?.('meow');
        float(sc, center(x), top - 18, '냥!', '#f4cf4f');
        face(sc, 'shock', 900);
        // off the barrel and away into the woods, the way you are not
        const away = sc.p.x > x ? -1 : 1;
        sc.tweens.add({ targets: s, y: s.y - 6, duration: 140, yoyo: true, ease: 'Quad.out' });
        sc.tweens.add({ targets: s, x: s.x + away * 14, duration: 280, ease: 'Linear', onComplete: () => {
          s.setDepth(D.actors + (pr.y + 1) / 100).setFlipX(away < 0);
          sc.tweens.add({ targets: s, y: foot(pr.y + 1) - 2, duration: 160, ease: 'Quad.in' });
          sc.tweens.add({ targets: s, x: s.x + away * 90, alpha: 0, delay: 260, duration: 1300, ease: 'Quad.in', onComplete: () => s.destroy() });
        } });
        sc.time.delayedCall(700, () => sc.hooks.onSecret?.('cat'));
      },
    }));
  },
  // knock, knock; the third time the tiny door opens a crack, two eyes look out, and a cookie comes
  // through the gap (once a visit; after that just the eyes)
  door(sc, x, y, n) {
    sc.hooks.onSound?.('knock');
    float(sc, (DOOR.x0 + DOOR.x1) / 2, DOOR.y0 + 2, '똑', '#e8d8b8');
    if (n < 3 || sc.doorOpen) return;
    sc.doorOpen = true;
    const mx = (DOOR.x0 + DOOR.x1) / 2;
    const gap = sc.add.rectangle(mx, (DOOR.y0 + 3 + DOOR.y1) / 2, DOOR.x1 - DOOR.x0 - 2, DOOR.y1 - DOOR.y0 - 3, 0x1b1424).setDepth(D.actors + BIG_TREE.y / 100 + 0.004).setScale(0, 1);
    const eyes = sc.add.image(mx, DOOR.y0 + 6, tex(sc, 'eyes')).setDepth(gap.depth + 0.0001).setAlpha(0);
    eyes.hop = 0;
    sc.tweens.add({ targets: gap, scaleX: 1, duration: 260, delay: 300, ease: 'Quad.out' });
    sc.tweens.add({ targets: eyes, alpha: 1, delay: 700, duration: 120 });
    sc.time.delayedCall(1000, () => eyes.setVisible(false));
    sc.time.delayedCall(1110, () => eyes.setVisible(true));
    const cookie = !sc.cookieGiven;
    sc.cookieGiven = true;
    sc.time.delayedCall(1300, () => {
      sc.say(eyes, cookie ? '…쉿.' : '…', 1400);
      if (!cookie) return;
      const c = sc.add.image(mx, DOOR.y1 - 2, tex(sc, 'cookie')).setDepth(D.fx);
      sc.tweens.add({ targets: c, y: DOOR.y1 + 5, duration: 260, ease: 'Bounce.out' });
      sc.tweens.add({
        targets: c, x: sc.ps.x, y: sc.ps.y - 18, delay: 700, duration: 360, ease: 'Quad.inOut',
        onComplete: () => {
          c.destroy();
          sc.spark.explode(10, sc.ps.x, sc.ps.y - 16);
          face(sc, 'sparkle', 1200);
          sc.hooks.onSecret?.('door');
        },
      });
    });
    sc.time.delayedCall(2900, () => {
      sc.tweens.add({ targets: eyes, alpha: 0, duration: 120 });
      sc.tweens.add({ targets: gap, scaleX: 0, delay: 120, duration: 220, ease: 'Quad.in', onComplete: () => { gap.destroy(); eyes.destroy(); sc.doorOpen = false; } });
    });
  },
};

// Something coming up from behind a line (the top of the woods, a barrel's rim): only the part of it
// above the line shows, `rows` of it at most; then, after `hold` ms, back down (hold 0: it stays up, all
// of it, and is yours to move: onUp gets it).
function emerge(sc, key, x, line, { rows = 16, ms = 260, hold = 900, onUp } = {}) {
  const s = sc.add.image(x, line + 16, key).setOrigin(0.5, 1).setDepth(D.fx - 0.1);
  const show = () => { const r = Math.max(0, Math.min(rows, Math.round(line - (s.y - 16)))); s.setVisible(r > 0).setCrop(0, 0, 16, r); };
  show();
  sc.tweens.add({
    targets: s, y: line + 16 - rows, duration: ms, ease: 'Quad.out', onUpdate: show,
    onComplete: () => {
      if (!hold) { s.setCrop(); onUp?.(s); return; }
      onUp?.(s);
      sc.tweens.add({ targets: s, y: line + 16, delay: hold, duration: ms, ease: 'Quad.in', onUpdate: show, onComplete: () => s.destroy() });
    },
  });
  return s;
}

// a ring spreading out on the water
function ripple(sc, x, y) {
  const r = sc.add.ellipse(x, y, 8, 4).setStrokeStyle(1, 0xe6f7ff, 0.9).setDepth(D.deco + 0.65);
  sc.tweens.add({ targets: r, scale: 2.6, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: () => r.destroy() });
}

// a word that pops up and drifts off (the same pixel font as out in the fields)
function float(sc, x, y, text, color) {
  const t = sc.add.text(Math.round(x), Math.round(y), text, {
    fontFamily: 'Galmuri9, sans-serif', fontSize: '10px', color, stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(sc.cameras.main.zoom || 3);
  sc.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 800, delay: 150, ease: 'Quad.in', onComplete: () => t.destroy() });
}

function face(sc, expr, ms) {
  sc.ps.expr = expr;
  sc.ps.exprUntil = sc.time.now + ms;
}

// ---------- standing still in the flowers ----------
// a while without moving on a flower bed and the butterflies come over; a little longer and one lands
// on your head. Off they go when you walk on.
const FLOWERY = new Set(['rainbow', 'flowerclock']);
export function stillInFlowers(sc, time, dt) {
  const ps = sc.ps, p = sc.p;
  const flowers = sc.ch(p.x, p.y) === '*' || FLOWERY.has(sc.propAt(p.x, p.y)?.kind);
  const still = flowers && !sc.path.length && !sc.pending && time >= (ps.stepUntil || 0) && !ps.diving;
  if (!still) {
    if (sc.still) for (const f of sc.flutters || []) f.goal = f.perch = f.landed = null;
    sc.still = 0;
    return;
  }
  sc.still = (sc.still || 0) + dt;
  const all = sc.flutters || [];
  if (sc.still > 3200 && !all.some(f => f.goal)) {
    // the nearest few come over; any still far off are brought in from just out of sight
    all.slice().sort((a, b) => Math.hypot(a.x - ps.x, a.y - ps.y) - Math.hypot(b.x - ps.x, b.y - ps.y)).slice(0, 4).forEach((f, i) => {
      if (Math.hypot(f.x - ps.x, f.y - ps.y) > 90) { const a = i * 1.7 + 0.4; f.x = ps.x + Math.cos(a) * 90; f.y = ps.y - 16 + Math.sin(a) * 60; }
      f.goal = { a: i * 1.6, r: 9 + i * 3, lead: i === 0 };
    });
  }
  const lead = all.find(f => f.goal?.lead);
  if (sc.still > 5200 && lead && !lead.perch && Math.hypot(lead.x - ps.x, lead.y - ps.y + 16) < 16) lead.perch = true;
}
// moveLife: a butterfly that has a goal circles your head (or sits on it); true when it is seen to
export function flutterTo(sc, f, time, s) {
  if (!f.goal) return false;
  const ps = sc.ps;
  let gx, gy;
  if (f.perch) { gx = ps.x; gy = ps.y - 17 - (ps.hop || 0); }
  else { const a = time / 700 + f.goal.a; gx = ps.x + Math.cos(a) * f.goal.r; gy = ps.y - 16 + Math.sin(a) * f.goal.r * 0.5; }
  const dx = gx - f.x, dy = gy - f.y, l = Math.hypot(dx, dy);
  const v = Math.min(l, Math.max(f.perch ? 24 : 30, l * 1.2) * s);
  if (l > 0.01) { f.x += dx / l * v; f.y += dy / l * v; }
  // it has landed on your head
  if (f.perch && l < 1 && !f.landed) {
    f.landed = true;
    face(sc, 'sparkle', 1600);
    sc.hooks.onSecret?.('butterfly');
  }
  // a perched one only opens and shuts its wings now and then
  const flap = f.perch && l < 1 ? Math.floor(time / 600) % 3 === 0 : Math.floor(time / 110 + f.seed * 5) % 2;
  f.img.setTexture(flap ? f.k0 : f.k1).setPosition(Math.round(f.x), Math.round(f.y)).setDepth(f.perch ? D.fx + 0.1 : D.fx - 0.2);
  return true;
}

// ---------- the puppy's trick ----------
// five pats in a row: a roll over, a dig, and up comes a bone, which it brings you
export function petPup(sc, pup) {
  const now = sc.time.now;
  sc.pets = now - (sc.petAt || 0) < 2500 ? (sc.pets || 0) + 1 : 1;
  sc.petAt = now;
  if (sc.pets < 5 || pup.busy) return false;
  sc.pets = 0;
  pup.busy = true;
  const s = pup.s;
  sc.tweens.add({ targets: s, hop: 6, duration: 160, yoyo: true, ease: 'Quad.out' });
  sc.tweens.add({
    targets: s, angle: s.flipX ? 360 : -360, duration: 480, ease: 'Quad.inOut',
    onComplete: () => {
      s.setAngle(0);
      float(sc, s.x, s.y - 14, '데굴', '#f4f0e8');
      // then a dig, paws going
      for (let k = 0; k < 5; k++) sc.time.delayedCall(260 + k * 120, () => { sc.dust.explode(3, s.x + (k % 2 ? 3 : -3), s.y - 1); sc.hooks.onSound?.('step', k % 2); });
      sc.time.delayedCall(980, () => {
        const b = sc.add.image(s.x, s.y - 2, tex(sc, 'bone')).setDepth(D.fx);
        sc.tweens.add({ targets: b, y: s.y - 14, duration: 220, ease: 'Quad.out', yoyo: true });
        sc.say(s, '멍멍!', 1100);
        sc.hooks.onSound?.('bark');
        sc.tweens.add({
          targets: b, x: sc.ps.x, y: sc.ps.y - 16, delay: 600, duration: 320, ease: 'Quad.inOut',
          onComplete: () => {
            b.destroy();
            face(sc, 'sparkle', 1200);
            pup.busy = false;
            sc.hooks.onSecret?.('pup');
          },
        });
      });
    },
  });
  return true;
}
