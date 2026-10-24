// 마을 놀이 in the village (v0.30, data/play.js): the games in the things the village puts up as it
// grows, and the treasure maps. A tap on one (or a bump) walks you up to it and starts it; while a game
// is on, any tap or key is its button.
//   물수제비  the flat stones on the pond's bank: stand on them, and a tap throws when the bar over your
//            head is up high; the higher, the more skips (twelve and it walks right across)
//   그네      the swings: sit, swing higher and higher, and tap to leap off; the further forward you are
//            going when you let go, the further you land
//   시소      the seesaw, with a friend from the meadow: tap each time your end hits the ground
//   분수      a coin in the fountain and a wish (three a day): something comes of it, or nothing
//   열기구    up over the village and down again; from up there, what is buried shows
//   모닥불    a marshmallow over the fire: pull it out golden
//   달리기    the rival's race (from the rival's sheet, main.js): tap as fast as you can
// Maps (`map:<id>` in the basket) show a corner of the village with an X: walk onto it and you dig the
// thing up. What you do here gets its page in the book (data/book.js 놀이, 분수 소원, 마을 보물).

import { TILE, rowsCanvas } from './textures.js';
import { D } from './VillageScene.js';
import { setEmote } from './emotes.js';
import { ripple, float, face, koiLeap } from './village-secrets.js';
import { stonesCanvas, pebbleCanvas, flagCanvas, toadCanvas, mallowCanvas, rainbowCanvas } from './village-play-art.js';
import { findIcon } from '../data/finds-art.js';
import { REGION } from '../data/village-map.js';
import { VILLAGE_MAP, propCells } from '../data/village.js';
import { CROP_LIST } from '../data/life.js';
import {
  playId, SKIP_MARKS, SWING_MARKS, SEESAW_MARKS, RACE_MARKS, marksUpTo, WISH_COST, rollWish, wishId, TREASURES, treasureId, mapId, isMap,
} from '../data/play.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const tex = (sc, key, make) => { if (!sc.textures.exists(key)) sc.textures.addCanvas(key, make()); return key; };
const iconKey = (sc, shape, pal) => tex(sc, `play_${shape}_${pal}`, () => rowsCanvas(findIcon(shape, pal)));
const games = sc => (sc.meta.games ||= {});
const record = (sc, marks, n) => { for (const id of marksUpTo(marks, n)) sc.hooks.onEntry?.(playId(id)); };
// the prop kinds there is a game in
const GAME_OF = { swings: 'swing', seesaw: 'seesaw', fountain: 'wish', balloon: 'balloon', campfire: 'mallow' };
export const WISHES_A_DAY = 3;

// ---------- putting it out ----------
export function placeVillagePlay(sc) {
  sc.play = null;
  sc.swingRest = null;
  sc.mapNext = 0;
  sc.stones = placeStones(sc);
}

// The flat stones lie on the bank where the longest stretch of the pond opens out in front of them
// (a throw across, not along a narrow bit), so a perfect throw can cross it.
function placeStones(sc) {
  const pond = (x, y) => sc.ch(x, y) === '~' && REGION[y]?.[x] === 'B';
  let best = null;
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (!'.*:'.includes(sc.ch(x, y)) || !sc.walkable(x, y) || sc.isNew(x, y)) continue;
    for (const [dx, dy] of N4) {
      let run = 0;
      while (pond(x + dx * (run + 1), y + dy * (run + 1))) run++;
      // the far bank has to be ground (a throw that runs out into the creek is no good)
      const far = sc.ch(x + dx * (run + 1), y + dy * (run + 1));
      if (run < 4 || far === '#' || far === '~') continue;
      const score = run + (dx ? 0.5 : 0) - Math.abs(y - 30) * 0.01;
      if (!best || score > best.score) best = { x, y, dir: [dx, dy], run, score };
    }
  }
  if (!best) return null;
  best.img = sc.keep(sc.add.image(center(best.x), foot(best.y) - 2, tex(sc, 'play_stones', stonesCanvas)).setOrigin(0.5, 1).setDepth(D.deco + 0.35));
  return best;
}

// ---------- what there is to play with ----------
const onStones = sc => !!sc.stones && sc.p.x === sc.stones.x && sc.p.y === sc.stones.y;
const ahead = (sc, x, y) => { const s = sc.stones; return (x - s.x) * s.dir[0] + (y - s.y) * s.dir[1] > 0; };
// a game prop whose picture covers the cell (the balloon and the swings stand taller than their foot)
function gamePropAt(sc, x, y) {
  const px = center(x), py = center(y);
  for (const o of sc.props) {
    if (!GAME_OF[o.pr.kind]) continue;
    const img = o.imgs[0];
    if (!img?.visible) continue;
    if (propCells(o.pr).some(([i, j]) => o.pr.x + i === x && o.pr.y + j === y)) return o;
    const b = img.getBounds();
    if (px >= b.x + 2 && px <= b.right - 2 && py >= b.y + 2 && py <= b.bottom) return o;
  }
  return null;
}
// the cell of a prop to walk up to: the one nearest you that you can stand beside
function reachCell(sc, pr) {
  const cells = propCells(pr).map(([i, j]) => ({ x: pr.x + i, y: pr.y + j }));
  const by = c => [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => sc.walkable(c.x + dx, c.y + dy) || (sc.p.x === c.x + dx && sc.p.y === c.y + dy));
  const ok = cells.filter(by);
  ok.sort((a, b) => Math.hypot(a.x - sc.p.x, a.y - sc.p.y) - Math.hypot(b.x - sc.p.x, b.y - sc.p.y));
  return ok[0] || cells[0];
}
export function playTarget(sc, x, y) {
  const s = sc.stones;
  if (s && s.x === x && s.y === y) return { play: 'skip', x, y, onto: true };
  if (s && onStones(sc) && sc.ch(x, y) === '~' && ahead(sc, x, y)) return { play: 'skip', x: s.x, y: s.y, onto: true };
  const o = gamePropAt(sc, x, y);
  if (o) { const c = reachCell(sc, o.pr); return { play: GAME_OF[o.pr.kind], x: c.x, y: c.y, pr: o.pr, img: o.imgs[0] }; }
  const fire = sc.dayFire?.(x, y);
  if (fire) return { play: 'mallow', x: fire.tx, y: fire.ty, fire };
  return null;
}

// ---------- taps and keys ----------
// a tap on the map: true when a game took it
export function playTap(sc, x, y) {
  if (sc.play) { press(sc); return true; }
  if (sc.fishing) return false;
  const it = playTarget(sc, x, y);
  if (!it) return false;
  if (it.onto && onStones(sc)) { playAct(sc, it); return true; }
  const near = sc.near(it);
  if (near === 0) playAct(sc, it);
  else if (near) { sc.path = near; sc.pending = it; }
  return true;
}
// a key pressed towards (x, y): true when a game took it (the stones you walk onto like any grass;
// from on them, a step at the water throws)
export function playStep(sc, x, y, repeat) {
  if (sc.play) { if (!repeat) press(sc); return true; }
  const it = playTarget(sc, x, y);
  if (!it || (it.onto && !onStones(sc))) return false;
  playAct(sc, it);
  return true;
}
// Space: the game's button, or a throw from the stones
export function playKey(sc, repeat) {
  if (sc.play) { if (!repeat) press(sc); return true; }
  if (onStones(sc)) { playAct(sc, { play: 'skip' }); return true; }
  return false;
}
function press(sc) {
  const pl = sc.play;
  GAMES[pl.kind].press?.(sc, pl);
}
// beside it now (on it, for the stones): play
export function playAct(sc, it) {
  sc.path = [];
  sc.pending = null;
  if (sc.play || sc.ps.diving) return;
  if (it.play === 'skip') startSkip(sc);
  else if (it.play === 'swing') startSwing(sc, it.pr);
  else if (it.play === 'seesaw') startSeesaw(sc, it.pr);
  else if (it.play === 'wish') makeWish(sc, it.pr);
  else if (it.play === 'balloon') ride(sc, it.pr);
  else if (it.play === 'mallow') startMallow(sc, it.fire || fireOf(sc, it.pr));
}
const fireOf = (sc, pr) => { const img = sc.props.find(o => o.pr === pr)?.imgs[0]; return img ? { x: img.x, y: img.y - 9 } : null; };

// ---------- 물수제비 ----------
const SKIP_PERIOD = 1100;
const skipPower = t => (1 - Math.cos(2 * Math.PI * t / SKIP_PERIOD)) / 2;
function startSkip(sc) {
  const s = sc.stones;
  if (!s) return;
  if (s.dir[0]) sc.ps.setFlipX(s.dir[0] < 0);
  sc.hooks.onSound?.('pluck');
  sc.play = { kind: 'skip', t0: sc.time.now, phase: 'aim', g: sc.keep(sc.add.graphics().setDepth(D.bubble - 0.1)) };
}
function skipTick(sc, pl, time) {
  if (pl.phase !== 'aim') return;
  // a little bar over your shoulder that fills and empties: throw when it is full
  const v = skipPower(time - pl.t0), g = pl.g, ps = sc.ps;
  const x = Math.round(ps.x + (ps.flipX ? -12 : 9)), y = Math.round(ps.y - 26), h = Math.round(v * 16);
  g.clear();
  g.fillStyle(0x1b1424, 1).fillRect(x - 1, y - 1, 5, 18);
  g.fillStyle(0x3a3046, 1).fillRect(x, y, 3, 16);
  g.fillStyle(v > 0.93 ? 0xfff3b0 : v > 0.7 ? 0xf4cf4f : v > 0.4 ? 0x9ad86f : 0x6fbf4e, 1).fillRect(x, y + 16 - h, 3, h);
  g.fillStyle(0xffffff, 1).fillRect(x - 1, y - 2, 5, 1);
}
function skipPress(sc, pl) {
  if (pl.phase !== 'aim') return;
  const v = skipPower(sc.time.now - pl.t0);
  pl.phase = 'fly';
  pl.g.clear();
  const n = Math.max(1, Math.min(12, Math.round(Math.pow(v, 1.5) * 12 + (Math.random() - 0.5) * 1.6)));
  throwStone(sc, pl, n);
}
function throwStone(sc, pl, n) {
  const s = sc.stones, [dx, dy] = s.dir, ps = sc.ps;
  // the arm goes back and through
  sc.tweens.killTweensOf(ps);
  ps.setPosition(center(s.x), foot(s.y));
  sc.tweens.add({ targets: ps, x: ps.x + dx * 3, y: ps.y + dy * 2, duration: 70, yoyo: true, ease: 'Quad.out' });
  sc.hooks.onSound?.('pluck');
  const sx = center(s.x) + dx * TILE / 2, sy = center(s.y) + 2 + dy * TILE / 2;
  const L = s.run * TILE, r = 0.8, Z = 1 - Math.pow(r, 12);
  const at = d => ({ x: sx + dx * d, y: sy + dy * d });
  const dist = k => 4 + (L - 4) * (1 - Math.pow(r, k)) / Z;
  const img = sc.keep(sc.add.image(ps.x + dx * 6, ps.y - 10, tex(sc, 'play_pebble', pebbleCanvas)).setDepth(D.fx - 0.1));
  const seg = (k, from) => {
    const across = k > 12, to = at(across ? L + TILE * 0.7 : dist(k));
    const hgt = k === 1 ? 9 : across ? 6 : Math.max(1.5, 8 * Math.pow(r, k - 1));
    sc.tweens.addCounter({
      from: 0, to: 1, duration: 60 + Math.hypot(to.x - from.x, to.y - from.y) * 4.2,
      onUpdate: tw => { const u = tw.getValue(); img.setPosition(Math.round(from.x + (to.x - from.x) * u), Math.round(from.y + (to.y - from.y) * u - hgt * Math.sin(Math.PI * u))); },
      onComplete: () => {
        if (across) {
          // all the way over: it lands on the far bank and stands up in the grass
          img.setDepth(D.actors + to.y / TILE / 100);
          sc.spark.explode(10, to.x, to.y - 2);
          skipDone(sc, pl, n, to);
          return;
        }
        ripple(sc, to.x, to.y);
        sc.drops.explode(3 + Math.min(4, k), to.x, to.y);
        float(sc, to.x, to.y - 3, `${k}`, '#e6f7ff');
        sc.hooks.onSound?.('pop');
        if (k < n) seg(k + 1, to);
        else if (n >= 12) seg(13, to);
        else {
          sc.tweens.add({ targets: img, alpha: 0, duration: 220, onComplete: () => img.destroy() });
          sc.time.delayedCall(120, () => { ripple(sc, to.x, to.y); sc.hooks.onSound?.('splash'); });
          skipDone(sc, pl, n, to);
        }
      },
    });
  };
  seg(1, { x: img.x, y: img.y });
}
function skipDone(sc, pl, n, to) {
  const g = games(sc);
  g.skip = Math.max(g.skip || 0, n);
  record(sc, SKIP_MARKS, n);
  pl.g.destroy();
  sc.play = null;
  if (n >= 8) sc.time.delayedCall(300, () => koiLeap(sc, Math.floor(to.x / TILE), Math.floor(to.y / TILE)));
  if (n >= 5) face(sc, 'sparkle', 1100);
  else if (n <= 1) setEmote(sc.ps, '…', sc.time.now, 900);
  sc.hooks.onLife?.();
}

// ---------- 그네 ----------
const SWING_MS = 1300;
function swingPos(pl, time) {
  const t = time - pl.t0, ph = 2 * Math.PI * t / SWING_MS, A = Math.min(1, 0.22 + t / 2800);
  return { q: A * Math.sin(ph), fwd: Math.cos(ph) > 0, A };
}
function startSwing(sc, pr) {
  const o = sc.props.find(q => q.pr === pr), img = o?.imgs[0];
  if (!img) return;
  const ps = sc.ps, left = img.x - img.width / 2, top = img.y - img.height;
  img.setTexture(sc.growthKey('swings', 1));
  sc.swingRest?.g.destroy();
  sc.swingRest = null;
  const g = sc.keep(sc.add.graphics().setDepth(img.depth + 0.0004));
  sc.tweens.killTweensOf(ps);
  ps.setFlipX(false).setDepth(img.depth + 0.0008);
  const pl = { kind: 'swing', pr, img, g, left, top, t0: sc.time.now + 300, phase: 'up', from: { x: sc.p.x, y: sc.p.y } };
  sc.play = pl;
  sc.hooks.onSound?.('pop');
  // up onto the seat
  const x0 = ps.x, y0 = ps.y, tx = left + 12, ty = top + 27;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 300,
    onUpdate: tw => { const u = tw.getValue(); ps.setPosition(Math.round(x0 + (tx - x0) * u), Math.round(y0 + (ty - y0) * u - 8 * Math.sin(Math.PI * u))); },
    onComplete: () => { if (sc.play === pl) pl.phase = 'swing'; },
  });
}
// the left seat, `q` from -1 (all the way back, up and away from you) to 1 (all the way forward, low
// and close): the ropes stretch and the seat grows as it comes at you
function drawSeat(g, left, top, q) {
  const sx = left + 12, sy = top + 23 + Math.round(5 * q), hw = 3 + Math.round(q);
  g.clear();
  g.fillStyle(0xd8c49c, 1).fillRect(sx - 2 - (hw - 3), top + 5, 1, sy - top - 5);
  g.fillStyle(0xc9b088, 1).fillRect(sx + 2 + (hw - 3), top + 5, 1, sy - top - 5);
  g.fillStyle(0xf08890, 1).fillRect(sx - hw, sy, hw * 2 + 1, 1);
  g.fillStyle(0xb8424c, 1).fillRect(sx - hw, sy + 1, hw * 2 + 1, 1);
  return { sx, sy };
}
function swingTick(sc, pl, time) {
  if (pl.phase === 'up') { drawSeat(pl.g, pl.left, pl.top, 0); return; }
  if (pl.phase !== 'swing') return;
  const { q } = swingPos(pl, time), { sx, sy } = drawSeat(pl.g, pl.left, pl.top, q), ps = sc.ps;
  ps.setPosition(sx, sy + 4);
  ps.sx = ps.sy = 1 + 0.08 * q;
  ps.setDepth(pl.img.depth + 0.0008);
}
function swingPress(sc, pl) {
  if (pl.phase !== 'swing') return;
  // out in front is what counts; going forward still is better
  const { q, fwd } = swingPos(pl, sc.time.now);
  const power = Math.max(0, q) * (fwd ? 1 : 0.7), want = power > 0.05 ? 1 + Math.floor(power * 6.99) : 1;
  // as far as you get without landing in something
  const col = pl.pr.x, y0 = pl.pr.y;
  let n = 0;
  for (let k = 1; k <= want; k++) {
    const x = col, y = y0 + k;
    if (!sc.walkable(x, y) && !(sc.p.x === x && sc.p.y === y)) break;
    n = k;
  }
  leap(sc, pl, n, q);
}
function leap(sc, pl, n, q) {
  pl.phase = 'leap';
  const ps = sc.ps, to = n ? { x: pl.pr.x, y: pl.pr.y + n } : pl.from;
  const x0 = ps.x, y0 = ps.y, tx = center(to.x), ty = foot(to.y), hgt = 8 + n * 5;
  ps.sx = ps.sy = 1;
  sc.hooks.onSound?.('pluck');
  // the empty seat swings on by itself and settles
  sc.swingRest = { g: pl.g, img: pl.img, left: pl.left, top: pl.top, q0: q, t0: sc.time.now };
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 260 + n * 75,
    onUpdate: tw => { const u = tw.getValue(); ps.setPosition(Math.round(x0 + (tx - x0) * u), Math.round(y0 + (ty - y0) * u - hgt * Math.sin(Math.PI * u))); },
    onComplete: () => {
      sc.p.x = to.x; sc.p.y = to.y;
      ps.setDepth(D.actors + to.y / 100);
      sc.dust.explode(6 + n, tx, ty);
      sc.play = null;
      if (!n) return;
      const g = games(sc);
      g.swing = Math.max(g.swing || 0, n);
      record(sc, SWING_MARKS, n);
      if (n <= 1) { float(sc, tx, ty - 18, '쿵', '#e8d8b8'); sc.hooks.onSound?.('bonk'); face(sc, 'hit', 700); }
      else { sc.hooks.onSound?.('puff'); face(sc, n >= 5 ? 'sparkle' : 'blink', 900); }
      if (n >= 7) { sc.spark.explode(16, tx, ty - 10); float(sc, tx, ty - 22, '휘익!', '#ffffff'); }
      sc.hooks.onLife?.();
    },
  });
}
function swingRestTick(sc, time) {
  const r = sc.swingRest;
  if (!r) return;
  const t = time - r.t0, k = Math.max(0, 1 - t / 1800);
  if (!k || !r.img.active) {
    r.g.destroy();
    if (r.img.active) r.img.setTexture(sc.growthKey('swings', 0));
    sc.swingRest = null;
    return;
  }
  drawSeat(r.g, r.left, r.top, r.q0 * k * Math.cos(2 * Math.PI * t / SWING_MS));
}

// ---------- 시소 ----------
// One end down: your turn to push off. Miss the moment (or push when it is not your turn) and it stops.
const SEESAW_WIN = n => Math.max(260, 470 - n * 10);
const SEESAW_TIP = n => Math.max(120, 190 - n * 3);
function startSeesaw(sc, pr) {
  const o = sc.props.find(q => q.pr === pr), img = o?.imgs[0];
  const free = sc.heroes.filter(h => !h.busy && h.s.visible);
  if (!img) return;
  if (!free.length) { setEmote(sc.ps, '…', sc.time.now, 1100); sc.hooks.onHover?.('시소: 혼자서는 탈 수가 없다.', true); return; }
  const h = free.sort((a, b) => Math.hypot(a.x - sc.p.x, a.y - sc.p.y) - Math.hypot(b.x - sc.p.x, b.y - sc.p.y))[0];
  h.busy = true;
  const ps = sc.ps, left = img.x - img.width / 2, top = img.y - img.height;
  const pl = { kind: 'seesaw', pr, img, h, left, top, n: 0, v: 0, phase: 'start', at: sc.time.now + 700, from: { x: sc.p.x, y: sc.p.y }, hx: h.s.x, hy: h.s.y };
  sc.play = pl;
  sc.tweens.killTweensOf(ps);
  sc.tweens.killTweensOf(h.s);
  ps.setFlipX(false).setDepth(img.depth + 0.001);
  h.s.setFlipX(true).setDepth(img.depth + 0.001);
  img.setTexture(sc.growthKey('seesaw', 0));
  hopTo(sc, ps, ...riderAt(pl, 0, 'L'), 320);
  hopTo(sc, h.s, ...riderAt(pl, 0, 'R'), 420);
  sc.say(h.s, '같이 타자!', 1100);
  sc.hooks.onSound?.('pop');
}
const riderAt = (pl, v, side) => {
  const yl = 12 - 2 * v, yr = 4 + 2 * v, x = side === 'L' ? 5 : 26, y = yl + (yr - yl) * (x - 1) / 29;
  return [pl.left + x, Math.round(pl.top + y) + 1];
};
function hopTo(sc, s, tx, ty, ms) {
  const x0 = s.x, y0 = s.y;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: ms,
    onUpdate: tw => { const u = tw.getValue(); s.setPosition(Math.round(x0 + (tx - x0) * u), Math.round(y0 + (ty - y0) * u - 10 * Math.sin(Math.PI * u))); },
  });
}
function seesawTick(sc, pl, time) {
  const set = v => {
    if (v === pl.v) return;
    pl.v = v;
    pl.img.setTexture(sc.growthKey('seesaw', v));
    sc.ps.setPosition(...riderAt(pl, v, 'L'));
    if (!pl.flying) pl.h.s.setPosition(...riderAt(pl, v, 'R'));
  };
  if (time < pl.at) return;
  const thump = (side, word) => {
    const [x, y] = riderAt(pl, side === 'L' ? 0 : 4, side);
    sc.dust.explode(4, x, y + 2);
    float(sc, x, y - 16, word, '#fff3e6');
    sc.hooks.onSound?.('bonk');
  };
  switch (pl.phase) {
    case 'start': pl.phase = 'downL'; pl.at = time; pl.until = time + SEESAW_WIN(0) + 300; set(0); return;
    case 'downL':
      if (pl.queued) { pl.queued = false; kick(sc, pl, time); return; }
      if (time > pl.until) seesawEnd(sc, pl, false);
      return;
    case 'up': {
      const u = Math.min(1, (time - pl.t) / SEESAW_TIP(pl.n));
      set(Math.round(u * 4));
      if (u >= 1) { pl.phase = 'downR'; pl.t = time; thump('R', '덕'); }
      return;
    }
    case 'downR':
      if (time - pl.t > 150) { pl.phase = 'back'; pl.t = time; if (pl.n >= 20) launch(sc, pl); }
      return;
    case 'back': {
      const u = Math.min(1, (time - pl.t) / SEESAW_TIP(pl.n));
      set(4 - Math.round(u * 4));
      if (u >= 1) {
        if (pl.n >= 20) { pl.phase = 'done'; return; }
        pl.phase = 'downL'; pl.t = time; pl.until = time + SEESAW_WIN(pl.n);
        thump('L', '쿵');
      }
      return;
    }
    default:
  }
}
function kick(sc, pl, time) {
  pl.n++;
  pl.phase = 'up';
  pl.t = time;
  const g = games(sc);
  g.seesaw = Math.max(g.seesaw || 0, pl.n);
  record(sc, SEESAW_MARKS, pl.n);
  if (pl.n % 5 === 0) float(sc, sc.ps.x, sc.ps.y - 24, `${pl.n}`, '#f4cf4f');
  if (pl.n >= 20) sc.hooks.onLife?.();
}
function seesawPress(sc, pl) {
  const time = sc.time.now;
  if (pl.phase === 'downL') { kick(sc, pl, time); return; }
  // a hair early, coming down: it counts once you are down
  if (pl.phase === 'back' && time - pl.t > SEESAW_TIP(pl.n) - 110) { pl.queued = true; return; }
  if (pl.phase === 'start' || pl.phase === 'done' || pl.flying) return;
  seesawEnd(sc, pl, false);
}
// twenty in a row: your friend goes flying, turns head over heels, and comes down on the seat again
function launch(sc, pl) {
  const s = pl.h.s, [x, y] = riderAt(pl, 0, 'R');
  pl.flying = true;
  sc.hooks.onSound?.('pluck');
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 1100,
    onUpdate: tw => { const u = tw.getValue(); s.setPosition(x, Math.round(y - 46 * Math.sin(Math.PI * u))); s.setAngle(360 * Math.min(1, u * 1.15)); },
    onComplete: () => {
      s.setAngle(0);
      pl.flying = false;
      sc.spark.explode(18, x, y - 10);
      sc.say(s, '한 번 더!', 1400);
      seesawEnd(sc, pl, true);
    },
  });
}
function seesawEnd(sc, pl, won) {
  if (pl.ended) return;
  pl.ended = true;
  const ps = sc.ps, h = pl.h;
  if (!won) {
    float(sc, ps.x, ps.y - 20, '쿵.', '#e8d8b8');
    sc.say(h.s, pl.n >= 10 ? '와, 잘 탄다!' : pl.n ? '아이고.' : '어어?', 1200);
    if (pl.n) setEmote(h.s, '♪', sc.time.now, 1000);
  } else face(sc, 'sparkle', 1200);
  sc.time.delayedCall(won ? 600 : 500, () => {
    pl.img.setTexture(sc.growthKey('seesaw', 0));
    hopTo(sc, ps, center(pl.from.x), foot(pl.from.y), 300);
    hopTo(sc, h.s, pl.hx, pl.hy, 380);
    sc.time.delayedCall(400, () => {
      ps.setDepth(D.actors + pl.from.y / 100);
      h.s.setDepth(D.actors + h.y / 100);
      h.busy = false;
      h.next = sc.time.now + 1500;
      if (sc.play === pl) sc.play = null;
      sc.hooks.onLife?.();
    });
  });
}

// ---------- 분수 ----------
function makeWish(sc, pr) {
  const img = sc.props.find(o => o.pr === pr)?.imgs[0], t = sc.meta.today;
  if (!img) return;
  if (t && (t.wishes || 0) >= WISHES_A_DAY) { setEmote(sc.ps, '…', sc.time.now, 1000); sc.hooks.onHover?.('분수가 조용하다. 오늘 소원은 여기까지인가 보다.', true); return; }
  if (!sc.hooks.onGold?.(-WISH_COST)) { setEmote(sc.ps, '…', sc.time.now, 1000); sc.hooks.onHover?.(`던질 동전이 없다. (${WISH_COST}G)`, true); return; }
  if (t) t.wishes = (t.wishes || 0) + 1;
  const pl = { kind: 'wish' };
  sc.play = pl;
  const ps = sc.ps, wx = img.x, wy = img.y - 14, x0 = ps.x, y0 = ps.y - 12;
  if (Math.abs(wx - x0) > 2) ps.setFlipX(wx < x0);
  const coin = sc.add.image(x0, y0, iconKey(sc, 'coin', 'Y')).setDepth(D.fx).setScale(0.5);
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 520,
    onUpdate: tw => { const u = tw.getValue(); coin.setPosition(Math.round(x0 + (wx - x0) * u), Math.round(y0 + (wy - y0) * u - 22 * Math.sin(Math.PI * u))); },
    onComplete: () => {
      coin.destroy();
      ripple(sc, wx, wy);
      sc.drops.explode(6, wx, wy);
      sc.hooks.onSound?.('splash');
      sc.time.delayedCall(650, () => granted(sc, rollWish(), wx, wy, pl));
    },
  });
}
function granted(sc, w, wx, wy, pl) {
  const ps = sc.ps;
  sc.hooks.onEntry?.(wishId(w.id));
  sc.hooks.onHover?.(w.line, true);
  if (w.gold) {
    // coins popping out of the water and over to you
    const n = Math.min(6, Math.max(3, Math.round(w.gold / 30)));
    for (let k = 0; k < n; k++) {
      const c = sc.add.image(wx, wy, iconKey(sc, 'coin', 'Y')).setDepth(D.fx).setScale(0.5);
      const mx = wx + (k - (n - 1) / 2) * 6;
      sc.tweens.addCounter({
        from: 0, to: 1, delay: k * 90, duration: 480,
        onUpdate: tw => { const u = tw.getValue(); c.setPosition(Math.round(mx + (ps.x - mx) * u), Math.round(wy + (ps.y - 14 - wy) * u - 20 * Math.sin(Math.PI * u))); },
        onComplete: () => c.destroy(),
      });
    }
    sc.time.delayedCall(480 + n * 90, () => { sc.hooks.onFind?.(w.gold); face(sc, 'sparkle', 1200); });
  }
  if (w.boon) {
    sc.hooks.onBoon?.(w.boon);
    sc.spark.explode(16, wx, wy - 4);
    sc.hooks.onSound?.('secret');
    if (w.boon.gold) {
      // a little rainbow over the spray for a moment
      const rb = sc.add.image(wx, wy + 2, tex(sc, 'play_rainbow40', () => rainbowCanvas(40))).setOrigin(0.5, 1).setDepth(D.fx - 0.2).setAlpha(0);
      sc.tweens.add({ targets: rb, alpha: 0.7, duration: 400, yoyo: true, hold: 1600, onComplete: () => rb.destroy() });
    }
  }
  if (w.seed) {
    const c = CROP_LIST[Math.floor(Math.random() * 6)][0];
    flyTo(sc, iconKey(sc, 'seed', 'n'), wx, wy, () => sc.hooks.onCatch?.(`seed:${c}`, 3));
  }
  if (w.item) flyTo(sc, tex(sc, `life_${w.item}`, () => rowsCanvas(findIcon('fish', 'orw'))), wx, wy, () => sc.hooks.onCatch?.(w.item, 1));
  if (w.id === 'toad') {
    // out hops a toad, has a look at you, and is off
    const t = sc.add.image(wx, wy, tex(sc, 'play_toad', toadCanvas)).setDepth(D.fx);
    const dir = ps.x < wx ? 1 : -1;
    sc.tweens.add({ targets: t, y: wy - 10, duration: 220, yoyo: true, ease: 'Quad.out' });
    sc.time.delayedCall(500, () => float(sc, t.x, t.y - 6, '개굴', '#cfe8a0'));
    sc.tweens.add({ targets: t, x: wx + dir * 40, delay: 1100, duration: 900, onComplete: () => t.destroy() });
    sc.tweens.add({ targets: t, alpha: 0, delay: 1700, duration: 300 });
    face(sc, 'shock', 900);
  }
  if (w.id === 'plop') setEmote(ps, '♪', sc.time.now, 900);
  if (w.id === 'wish') { sc.burst?.explode(30, wx, wy - 10); sc.hooks.onSound?.('fanfare'); }
  sc.time.delayedCall(300, () => { if (sc.play === pl) sc.play = null; });
  sc.hooks.onLife?.();
}
// a thing flying out to you, over your head, and into the basket (scenes/village-days.js too)
export function flyTo(sc, key, x0, y0, done) {
  const ps = sc.ps, img = sc.add.image(x0, y0, key).setDepth(D.bubble - 0.2);
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 420,
    onUpdate: tw => { const u = tw.getValue(), tx = ps.x, ty = ps.y - 28; img.setPosition(Math.round(x0 + (tx - x0) * u), Math.round(y0 + (ty - y0) * u - 18 * Math.sin(Math.PI * u))); },
    onComplete: () => {
      sc.spark.explode(8, img.x, img.y);
      sc.tweens.add({ targets: img, alpha: 0, delay: 600, duration: 240, onComplete: () => img.destroy() });
      face(sc, 'sparkle', 1000);
      done?.();
    },
  });
}

// ---------- 열기구 ----------
function ride(sc, pr) {
  const o = sc.props.find(q => q.pr === pr), img = o?.imgs[0], fl = sc.floaters.find(f => f.img === img);
  if (!img || !fl) return;
  const ps = sc.ps, cam = sc.cameras.main;
  const pl = { kind: 'balloon', img, fl, y0: fl.y, from: { x: sc.p.x, y: sc.p.y }, z0: cam.zoom };
  sc.play = pl;
  sc.tweens.killTweensOf(ps);
  hopTo(sc, ps, img.x, img.y - 4, 320);
  ps.setDepth(img.depth - 0.0005);
  sc.hooks.onSound?.('pop');
  sc.hooks.onEntry?.(playId('balloon'));
  sc.time.delayedCall(360, () => {
    pl.riding = true;
    ps.noShadow = true;
    cam.stopFollow();
    const b = sc.openBox, cx = (b.x0 + b.x1 + 1) / 2 * TILE, cy = (b.y0 + b.y1 + 1) / 2 * TILE;
    cam.pan(cx, cy, 2200, 'Sine.easeInOut');
    cam.zoomTo(Math.max(1, Math.round(pl.z0 * 0.6)), 2200, 'Sine.easeInOut');
    sc.tweens.add({ targets: fl, y: pl.y0 - 70, duration: 2200, ease: 'Sine.inOut' });
    sc.hooks.onSound?.('warp');
    // from up here: whatever is hidden glints, and a map's X shows on the ground
    sc.time.delayedCall(2300, () => {
      for (const f of sc.finds) sc.spark.explode(8, f.img.x, f.img.y - 2);
      for (const id of heldMaps(sc)) { const t = TREASURES[id.slice(4)]; if (t) xMark(sc, t.spot, 2600); }
    });
    sc.time.delayedCall(5000, () => {
      cam.pan(ps.x, ps.y - 20, 1800, 'Sine.easeInOut');
      cam.zoomTo(pl.z0, 1800, 'Sine.easeInOut');
      sc.tweens.add({ targets: fl, y: pl.y0, duration: 1800, ease: 'Sine.inOut' });
    });
    sc.time.delayedCall(6900, () => {
      pl.riding = false;
      ps.noShadow = false;
      hopTo(sc, ps, center(pl.from.x), foot(pl.from.y), 300);
      sc.time.delayedCall(320, () => {
        ps.setDepth(D.actors + pl.from.y / 100);
        cam.startFollow(ps, true, 0.2, 0.2, 0, TILE / 2);
        sc.fitZoom();
        face(sc, 'sparkle', 1000);
        if (sc.play === pl) sc.play = null;
      });
    });
  });
}
function balloonTick(sc, pl) {
  if (pl.riding) sc.ps.setPosition(pl.img.x, pl.img.y - 4);
}
// a red X on the ground for a while (a map's spot, seen from the balloon)
function xMark(sc, [x, y], ms) {
  const g = sc.add.graphics().setDepth(D.fx + 0.4);
  const cx = center(x), cy = center(y);
  for (let d = -4; d <= 4; d++) {
    g.fillStyle(0x8a1e28, 1).fillRect(cx + d - 1, cy + d, 3, 2).fillRect(cx - d - 1, cy + d, 3, 2);
    g.fillStyle(0xe0464e, 1).fillRect(cx + d - 1, cy + d - 1, 3, 2).fillRect(cx - d - 1, cy + d - 1, 3, 2);
  }
  g.setAlpha(0);
  sc.tweens.add({ targets: g, alpha: 1, duration: 300, yoyo: true, hold: ms, onComplete: () => g.destroy() });
}

// ---------- 모닥불 ----------
const MALLOW_MS = 4200;
const mallowStage = u => (u < 0.3 ? 0 : u < 0.52 ? 1 : u < 0.76 ? 2 : u < 0.9 ? 3 : 4);
function startMallow(sc, fire) {
  if (!fire) return;
  const ps = sc.ps;
  if (Math.abs(fire.x - ps.x) > 2) ps.setFlipX(fire.x < ps.x);
  const pl = { kind: 'mallow', fire, t0: sc.time.now, stage: -1, g: sc.keep(sc.add.graphics().setDepth(D.fx - 0.2)) };
  pl.img = sc.keep(sc.add.image(fire.x, fire.y - 4, tex(sc, 'play_mallow0', () => mallowCanvas(0))).setDepth(D.fx - 0.1));
  sc.play = pl;
  sc.hooks.onSound?.('pluck');
}
function mallowTick(sc, pl, time) {
  const u = (time - pl.t0) / MALLOW_MS, st = mallowStage(u), ps = sc.ps;
  if (st !== pl.stage) {
    pl.stage = st;
    pl.img.setTexture(tex(sc, `play_mallow${st}`, () => mallowCanvas(st)));
    if (st === 4) { sc.hooks.onSound?.('sizzle'); float(sc, pl.fire.x, pl.fire.y - 10, '화르륵', '#ffb060'); }
  }
  // the stick from your hand to the fire, a pixel at a time
  const dir = ps.flipX ? -1 : 1, hx = Math.round(ps.x + dir * 5), hy = Math.round(ps.y - 9), mx = pl.img.x, my = pl.img.y;
  const g = pl.g, n = Math.max(4, Math.round(Math.hypot(mx - hx, my - hy)));
  g.clear();
  g.fillStyle(0x8a5634, 1);
  for (let k = 0; k <= n; k++) g.fillRect(Math.round(hx + (mx - hx) * k / n), Math.round(hy + (my - hy) * k / n), 1, 1);
  pl.img.y = pl.fire.y - 4 + (Math.floor(time / 300) % 2);
  if (st === 4 && Math.random() < 0.3) sc.spark.explode(1, mx, my - 2);
  // too long: it drops off into the fire
  if (u > 1.35) mallowEnd(sc, pl, -1);
}
function mallowPress(sc, pl) { mallowEnd(sc, pl, pl.stage); }
function mallowEnd(sc, pl, st) {
  if (sc.play !== pl) return;
  sc.play = null;
  pl.g.destroy();
  const ps = sc.ps;
  if (st < 0) {
    sc.tweens.add({ targets: pl.img, y: pl.fire.y + 4, alpha: 0, duration: 300, onComplete: () => pl.img.destroy() });
    float(sc, pl.fire.x, pl.fire.y - 8, '앗', '#ffffff');
    face(sc, 'shock', 900);
    return;
  }
  // out it comes, and down the hatch
  sc.tweens.add({ targets: pl.img, x: ps.x, y: ps.y - 12, duration: 240, ease: 'Quad.out', onComplete: () => pl.img.destroy() });
  sc.time.delayedCall(260, () => {
    sc.hooks.onSound?.('candy');
    float(sc, ps.x, ps.y - 20, '냠', '#fff3e6');
    if (st === 2) { sc.hooks.onEntry?.(playId('mallow1')); face(sc, 'sparkle', 1300); sc.say(ps, '노릇노릇!', 1200); }
    else if (st === 4) { sc.hooks.onEntry?.(playId('mallow2')); face(sc, 'shock', 1000); sc.say(ps, '후후… 숯 맛이다.', 1400); }
    else sc.say(ps, st < 2 ? '덜 익었다…' : '조금 탔다.', 1200);
  });
}

// ---------- 달리기 시합 ----------
// The track: the longest straight bit of open ground there is (a lane for each of you, side by side),
// starting from the end nearer you.
function raceTrack(sc) {
  const free = (x, y) => x > 0 && y > 0 && x < MW - 1 && y < MH - 1 && ':.*'.includes(sc.ch(x, y)) && !sc.blocked[y * MW + x] && !sc.isNew(x, y);
  let best = null;
  for (let y = 2; y < MH - 2; y++) {
    let x = 1;
    while (x < MW - 1) {
      if (!(free(x, y) && free(x, y + 1))) { x++; continue; }
      let e = x;
      while (e + 1 < MW - 1 && free(e + 1, y) && free(e + 1, y + 1)) e++;
      const len = Math.min(16, e - x);
      if (len >= 9) {
        const mid = x + (e - x) / 2;
        const score = len * 2 - Math.hypot(mid - sc.p.x, y - sc.p.y) * 0.15;
        if (!best || score > best.score) best = { x0: x, x1: e, y, score };
      }
      x = e + 1;
    }
  }
  if (!best) return null;
  // trim it to sixteen, round its middle
  const len = Math.min(16, best.x1 - best.x0), mid = Math.round((best.x0 + best.x1) / 2), x0 = mid - Math.floor(len / 2), x1 = x0 + len;
  const leftFirst = Math.abs(x0 - sc.p.x) <= Math.abs(x1 - sc.p.x);
  return { from: leftFirst ? x0 : x1, to: leftFirst ? x1 : x0, dir: leftFirst ? 1 : -1, y: best.y, len };
}
export function startRace(sc) {
  const rv = sc.folk.find(f => f.id === 'rival');
  if (!rv || sc.play || sc.showing || sc.ps.diving) return false;
  const tr = raceTrack(sc);
  if (!tr) { sc.say(rv.s, '오늘은 달릴 데가 없네.', 1400); return false; }
  const ps = sc.ps, g = games(sc), wins = g.raceWins || 0;
  sc.path = [];
  sc.pending = null;
  rv.busy = true;
  const pl = {
    kind: 'race', rv, tr, me: 0, them: 0, phase: 'line', speed: Math.min(3.9, 2.5 + 0.15 * wins),
    trip: Math.random() < 0.12, tripped: false, until: 0, last: 0,
  };
  sc.play = pl;
  sc.tweens.killTweensOf(ps);
  sc.tweens.killTweensOf(rv.s);
  // up to the line, the rival in the lane below
  hopTo(sc, ps, center(tr.from), foot(tr.y), 360);
  hopTo(sc, rv.s, center(tr.from), foot(tr.y + 1), 420);
  ps.setFlipX(tr.dir < 0);
  rv.s.setFlipX(tr.dir < 0);
  sc.p.x = tr.from; sc.p.y = tr.y;
  rv.x = tr.from; rv.y = tr.y + 1;
  ps.setDepth(D.actors + tr.y / 100);
  rv.s.setDepth(D.actors + (tr.y + 1) / 100);
  pl.flag = sc.keep(sc.add.image(center(tr.to) + tr.dir * 10, foot(tr.y + 1) - 2, tex(sc, 'play_flag', flagCanvas)).setOrigin(0.5, 1).setDepth(D.actors + (tr.y + 1) / 100 + 0.002).setFlipX(tr.dir < 0));
  sc.cameras.main.pan(center((tr.from + tr.to) / 2), foot(tr.y), 600, 'Sine.easeInOut');
  const count = ['셋', '둘', '하나', '땅!'];
  count.forEach((w, k) => sc.time.delayedCall(700 + k * 650, () => {
    sc.say(rv.s, w, 600);
    sc.hooks.onSound?.(k === 3 ? 'bell' : 'talk');
    if (k === 3) { pl.phase = 'run'; pl.t = sc.time.now; sc.cameras.main.startFollow(ps, true, 0.2, 0.2, 0, TILE / 2); }
  }));
  return true;
}
function racePress(sc, pl) {
  if (pl.phase !== 'run') return;
  const now = sc.time.now;
  if (now - pl.last < 45) return;
  pl.last = now;
  pl.me = Math.min(pl.tr.len, pl.me + 0.5);
  const ps = sc.ps;
  ps.stepFrame = ps.stepFrame === 1 ? 2 : 1;
  ps.stepUntil = now + 200;
  if (ps.stepFrame === 1) sc.hooks.onStep?.(true);
  if (Math.random() < 0.3) sc.dust.explode(1, ps.x - pl.tr.dir * 4, ps.y);
}
function raceTick(sc, pl, time, dt) {
  if (pl.phase !== 'run') return;
  const tr = pl.tr, ps = sc.ps, rv = pl.rv;
  // the rival keeps a steady pace, and now and then goes flat on their face
  if (pl.trip && !pl.tripped && pl.them >= tr.len * 0.55) {
    pl.tripped = true;
    pl.until = time + 1000;
    rv.s.setAngle(tr.dir * 80);
    float(sc, rv.s.x, rv.s.y - 14, '꽈당', '#ffffff');
    sc.hooks.onSound?.('bonk');
    sc.dust.explode(6, rv.s.x, rv.s.y);
    sc.hooks.onEntry?.(playId('racetrip'));
  }
  if (time > pl.until) {
    if (rv.s.angle) rv.s.setAngle(0);
    pl.them = Math.min(tr.len, pl.them + pl.speed * dt / 1000);
  }
  ps.x = center(tr.from) + tr.dir * pl.me * TILE;
  rv.s.x = center(tr.from) + tr.dir * pl.them * TILE;
  rv.s.hop = time < pl.until ? 0 : Math.floor(time / 110) % 2 ? 2 : 0;
  if (pl.me >= tr.len || pl.them >= tr.len) raceEnd(sc, pl, pl.me >= tr.len);
}
function raceEnd(sc, pl, won) {
  pl.phase = 'over';
  const tr = pl.tr, rv = pl.rv, g = games(sc), ps = sc.ps;
  g.races = (g.races || 0) + 1;
  if (won) g.raceWins = (g.raceWins || 0) + 1;
  sc.hooks.onEntry?.(playId('race1'));
  record(sc, RACE_MARKS, g.raceWins || 0);
  // where everyone ends up
  const at = v => tr.from + tr.dir * Math.round(v);
  sc.p.x = at(pl.me); sc.p.y = tr.y;
  rv.x = at(pl.them); rv.y = tr.y + 1;
  sc.tweens.add({ targets: ps, x: center(sc.p.x), duration: 120 });
  sc.tweens.add({ targets: rv.s, x: center(rv.x), duration: 120 });
  rv.s.hop = 0;
  rv.s.setAngle(0);
  sc.hooks.onSound?.(won ? 'fanfare' : 'bonk');
  if (won) {
    face(sc, 'sparkle', 1400);
    sc.spark.explode(16, ps.x, ps.y - 10);
    const w = g.raceWins;
    sc.say(rv.s, pl.tripped ? '…못 본 걸로 해.' : w >= 10 ? '대단한데.' : w === 1 ? '흥, 신발 탓이야.' : '다음엔 안 봐줘.', 1600);
  } else {
    setEmote(ps, 'sweat', sc.time.now, 1100);
    sc.say(rv.s, '내가 이겼다! 연습 좀 해 와.', 1600);
  }
  sc.time.delayedCall(1600, () => {
    sc.tweens.add({ targets: pl.flag, alpha: 0, duration: 300, onComplete: () => pl.flag.destroy() });
    rv.busy = false;
    rv.next = sc.time.now + 1200;
    if (sc.play === pl) sc.play = null;
    sc.hooks.onLife?.();
  });
}
// ---------- 보물 지도 ----------
export const heldMaps = sc => Object.keys(sc.meta.bag || {}).filter(id => isMap(id) && sc.meta.bag[id] > 0);
// you stepped onto (x, y): the X on a map you have? dig it up
export function playStepOn(sc, x, y) {
  for (const id of heldMaps(sc)) {
    const t = TREASURES[id.slice(4)];
    if (t && t.spot[0] === x && t.spot[1] === y) { sc.time.delayedCall(120, () => dig(sc, t)); return; }
  }
}
function dig(sc, t) {
  if (!(sc.meta.bag?.[mapId(t.id)] > 0)) return;
  const ps = sc.ps, x = ps.x, y = ps.y;
  sc.hooks.onCatch?.(mapId(t.id), -1);
  sc.hooks.onSound?.('rustle');
  face(sc, 'grit', 900);
  for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 220, () => { sc.dust.explode(6, x + (k - 1) * 3, y); sc.tweens.add({ targets: ps, y: y + 2, duration: 80, yoyo: true }); });
  sc.time.delayedCall(760, () => {
    sc.hooks.onSound?.('chest');
    flyTo(sc, iconKey(sc, ...t.pic.find), x, y, () => {
      sc.hooks.onEntry?.(treasureId(t.id));
      sc.say(ps, `${t.name}!`, 1600);
      sc.time.delayedCall(500, () => sc.hooks.onFind?.(t.gold));
    });
  });
}

// ---------- every frame ----------
const GAMES = {
  skip: { tick: skipTick, press: skipPress },
  swing: { tick: swingTick, press: swingPress },
  seesaw: { tick: seesawTick, press: seesawPress },
  wish: {},
  balloon: { tick: balloonTick },
  mallow: { tick: mallowTick, press: mallowPress },
  race: { tick: raceTick, press: racePress },
};
export function playTick(sc, time, dt) {
  const pl = sc.play;
  if (pl) GAMES[pl.kind].tick?.(sc, pl, time, dt);
  swingRestTick(sc, time);
  // close to where a map you have says to dig: a glint there now and then
  if (time > (sc.mapNext || 0)) {
    sc.mapNext = time + 1500;
    for (const id of heldMaps(sc)) {
      const t = TREASURES[id.slice(4)];
      if (t && Math.max(Math.abs(t.spot[0] - sc.p.x), Math.abs(t.spot[1] - sc.p.y)) <= 3) sc.spark.explode(3, center(t.spot[0]), foot(t.spot[1]) - 4);
    }
  }
}

// ---------- the tip line ----------
export function playDescribe(sc, x, y) {
  const s = sc.stones;
  if (s && s.x === x && s.y === y) return '납작한 돌: 물수제비 뜨기 딱 좋은 돌이 쌓여 있다.';
  const o = gamePropAt(sc, x, y);
  if (!o) return '';
  switch (o.pr.kind) {
    case 'swings': return '그네: 앉아서 흔들흔들. 높이 올라갔을 때 뛰어내리면?';
    case 'seesaw': return '시소: 친구랑 같이 타는 거다. 내 쪽이 땅에 닿을 때 힘껏!';
    case 'fountain': return (sc.meta.today?.wishes || 0) >= WISHES_A_DAY ? '분수: 오늘은 조용하다.' : `분수: 동전(${WISH_COST}G)을 던지고 소원을 빌어 보자.`;
    case 'balloon': return '열기구: 타면 마을이 한눈에 보인다.';
    case 'campfire': return '모닥불: 마시멜로를 구워 먹자.';
    default: return '';
  }
}
