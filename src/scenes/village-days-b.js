// 마을의 하루, the second lot of days (v0.30): see scenes/village-days.js for what a day is and the helpers.
//   커다란 순무    a turnip grown too big beside the yard's bed: bump it to pull, and the friends come and
//                 pull along behind you until it pops out
//   날아간 양말    the neighbour's washing line with a sock gone: it is lying somewhere in the village;
//                 pick it up and bring it round
//   나무에 걸린 연  a friend's kite high in a tree: shake the trunk till it drops
//   병아리 소동    three chicks got out: walk into them and they come along behind you, back to the hen
//   숨바꼭질      three friends hiding behind bushes, crates and trees, each showing a little; find them
// (Everything from village-days.js is used inside the functions only: the two files import each other.)

import { TILE, texScale } from './textures.js';
import { D } from './VillageScene.js';
import { setEmote } from './emotes.js';
import { float, face } from './village-secrets.js';
import { bedWide } from './village-life.js';
import { bigTurnipCanvas, washingCanvas, henCanvas, bushCanvas } from './village-play-art.js';
import { propCanvas } from './village-props.js';
import { moundCanvas, sockCanvas, kiteCanvas, peekCanvas, peekTop } from './village-days-b-art.js';
import { freeSpot, openCell, cuts, block, addThing, sayAs, give, earn, carry, handOver, follow, dayDone } from './village-days.js';
import { VILLAGE_MAP, HOUSES, doorOf } from '../data/village.js';
import { DECOR } from '../data/home.js';
import { CHARACTERS } from '../data/characters.js';
import { HIDE_IDS, hideId } from '../data/play.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const N8 = [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]];
const PLAZA = { x: 30, y: 23 };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const pick = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length)];
const tex = (sc, key, make) => { if (!sc.textures.exists(key)) sc.textures.addCanvas(key, make()); return key; };
const nameOf = id => CHARACTERS[id]?.name || id;

// the friends from the meadow who are free to join in (not hiding, not on the seesaw)
const freeHeroes = sc => sc.heroes.filter(h => !h.busy && h.s.active && h.s.visible);
// a hero (or anyone with a picture in .s) stands at a cell, or hops over to it
function standAt(sc, h, x, y, flipX) {
  sc.tweens.killTweensOf(h.s);
  h.x = x; h.y = y;
  h.s.hop = 0;
  h.s.setPosition(center(x), foot(y)).setDepth(D.actors + y / 100).setFlipX(flipX);
}
function hopTo(sc, h, x, y, ms = 360, flipX = null) {
  const s = h.s, x0 = s.x, y0 = s.y, tx = center(x), ty = foot(y);
  sc.tweens.killTweensOf(s);
  h.x = x; h.y = y;
  s.hop = 0;
  if (flipX != null) s.setFlipX(flipX);
  else if (tx !== x0) s.setFlipX(tx < x0);
  s.setDepth(D.actors + y / 100);
  sc.tweens.addCounter({
    from: 0, to: 1, duration: ms,
    onUpdate: tw => { const u = tw.getValue(); s.setPosition(Math.round(x0 + (tx - x0) * u), Math.round(y0 + (ty - y0) * u - 8 * Math.sin(Math.PI * u))); },
    onComplete: () => s.setPosition(tx, ty),
  });
}
// the walkable cells round (x, y), the nearest to you first
function roundCells(sc, x, y) {
  return N8.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter(c => sc.walkable(c.x, c.y) && !sc.isNew(c.x, c.y))
    .sort((a, b) => cheb(a, sc.p) - cheb(b, sc.p));
}
// the trees standing on their own ('T' on the map, not part of the woods) that you can get up beside,
// as [x, y] of their trunks
function treeSpots(sc, rnd, ok = null) {
  const out = [];
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (sc.ch(x, y) !== 'T' || !sc.treeAt(x, y) || sc.isNew(x, y) || (ok && !ok(x, y))) continue;
    const beside = N8.filter(([dx, dy]) => openCell(sc, x + dx, y + dy) && sc.route(x + dx, y + dy).length);
    if (beside.length >= 2) out.push([x, y]);
  }
  return out.length ? pick(out, rnd) : null;
}

// ---------- 커다란 순무 ----------
// A giant turnip's leaves stick up out of the ground beside the yard's bed. Bump it and you pull: it
// wobbles and comes up a little. After a few pulls the friends from the meadow line up behind you and
// pull along (영차!), and on the twelfth it pops out and goes in the basket.
const PULLS = 12, HELP_AT = 3, TURNIP_H = 34, LEAF_ROWS = 14;
const GARDEN = DECOR.find(d => d.id === 'garden');
// where the turnip can stand: two cells side by side right next to the bed
function turnipSpots(sc) {
  const xs = GARDEN.at.map(c => c[0]), ys = GARDEN.at.map(c => c[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) + (bedWide(sc.meta) ? 1 : 0), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const out = [];
  for (let y = y0; y <= y1; y++) { out.push([x1 + 1, y]); out.push([x0 - 2, y]); }
  for (let x = x0 - 1; x <= x1; x++) { out.push([x, y1 + 1]); out.push([x, y0 - 1]); }
  return out.filter(([x, y]) => [[x, y], [x + 1, y]].every(([cx, cy]) => openCell(sc, cx, cy)) && !cuts(sc, [[x, y], [x + 1, y]]));
}
// how much of the picture shows after n pulls (leaves only at first, the whole bulb by the last pull)
const turnipRows = n => Math.round(LEAF_ROWS + (TURNIP_H - LEAF_ROWS) * Math.min(1, n / PULLS));
function showTurnip(sc, ev, rows) {
  const t = ev.turnip;
  t.rows = rows;
  t.img.setCrop(0, 0, 30, rows).setY(t.ground + (TURNIP_H - rows));
}
// the friends line up behind you, away from the turnip, and pull along
function lineUp(sc, ev) {
  const t = ev.turnip, p = sc.p;
  const dx = p.x < t.x ? -1 : p.x > t.x + 1 ? 1 : 0, dy = Math.sign(p.y - t.y) || (dx ? 0 : 1);
  ev.helpers ||= [];
  const cells = [];
  for (let k = 1; k <= 3; k++) {
    const x = p.x + dx * k, y = p.y + dy * k;
    if (!sc.walkable(x, y) && !ev.helpers.some(h => h.x === x && h.y === y)) break;
    cells.push({ x, y });
  }
  const more = freeHeroes(sc).slice(0, Math.max(0, cells.length - ev.helpers.length));
  for (const h of more) { h.busy = true; ev.helpers.push(h); }
  ev.helpers.forEach((h, i) => {
    const c = cells[i];
    if (!c || (h.x === c.x && h.y === c.y)) return;
    hopTo(sc, h, c.x, c.y, 300 + i * 80, dx ? dx > 0 : h.s.flipX);
  });
}
function pull(sc, ev, th) {
  const t = ev.turnip, st = ev.st, ps = sc.ps;
  if (!t || ev.pulling || ev.t.done) return;
  ev.pulling = true;
  st.pulls = (st.pulls || 0) + 1;
  sc.hooks.onSound?.('rustle');
  face(sc, 'grit', 700);
  sc.say(ps, '영차!', 700);
  // you lean back, the turnip rocks and comes up a bit
  const bx = center(sc.p.x), by = foot(sc.p.y), ax = Math.sign(sc.p.x - (t.x + 0.5)) || 0, ay = Math.sign(sc.p.y - t.y);
  sc.tweens.killTweensOf(ps);
  ps.setPosition(bx, by);
  sc.tweens.add({ targets: ps, x: bx + ax * 3, y: by + ay * 2, duration: 140, yoyo: true, ease: 'Quad.out' });
  sc.tweens.add({ targets: t.img, x: t.img.x + 1, duration: 50, yoyo: true, repeat: 3, onComplete: () => t.img.setX(center(t.x) + TILE / 2) });
  sc.dust.explode(4, t.img.x + (Math.random() - 0.5) * 16, t.ground);
  const from = t.rows, to = turnipRows(st.pulls);
  sc.tweens.addCounter({ from, to, duration: 260, ease: 'Quad.out', onUpdate: tw => showTurnip(sc, ev, Math.round(tw.getValue())) });
  if (st.pulls >= HELP_AT) {
    lineUp(sc, ev);
    (ev.helpers || []).forEach((h, i) => sc.time.delayedCall(140 + i * 110, () => {
      if (!h.s.active) return;
      sc.tweens.add({ targets: h.s, hop: 3, duration: 90, yoyo: true, ease: 'Quad.out' });
      sc.say(h.s, '영차!', 650);
    }));
  }
  sc.hooks.onLife?.();
  sc.time.delayedCall(420, () => { ev.pulling = false; if (st.pulls >= PULLS) popOut(sc, ev, th); });
}
// out it comes: a leap, everyone tumbles back, and into the basket
function popOut(sc, ev, th) {
  const t = ev.turnip, ps = sc.ps;
  if (th.gone) return;
  th.gone = true;
  ev.pulling = true;
  sc.hooks.onSound?.('pop');
  showTurnip(sc, ev, TURNIP_H);
  t.img.setCrop();
  t.mound.setTexture(tex(sc, 'dayb_hole', () => moundCanvas(true)));
  sc.dust.explode(14, t.img.x, t.ground);
  sc.tweens.add({ targets: t.img, y: t.ground - 22, duration: 300, ease: 'Quad.out', yoyo: true, hold: 120, onComplete: () => {
    sc.tweens.add({ targets: t.img, alpha: 0, duration: 200, onComplete: () => t.img.destroy() });
    give(sc, 'giantturnip', 1, { x: t.img.x, y: t.img.y - 16 }, () => sc.say(ps, '뽑혔다!', 1400));
    dayDone(sc, ev);
  } });
  // you and the helpers tumble back a step
  const ax = Math.sign(sc.p.x - (t.x + 0.5)) || 0, ay = Math.sign(sc.p.y - t.y);
  sc.tweens.add({ targets: ps, x: ps.x + ax * 4, y: ps.y + ay * 3, duration: 160, yoyo: true, ease: 'Quad.out' });
  face(sc, 'sparkle', 1500);
  (ev.helpers || []).forEach((h, i) => sc.time.delayedCall(80 + i * 90, () => {
    if (!h.s.active) return;
    sc.tweens.add({ targets: h.s, hop: 5, duration: 120, yoyo: true, ease: 'Quad.out' });
    setEmote(h.s, '♥', sc.time.now, 1400);
  }));
  sc.time.delayedCall(2200, () => { (ev.helpers || []).forEach(h => { h.busy = false; h.next = sc.time.now + 800; }); ev.helpers = []; });
}
const turnip = {
  place(sc, ev, rnd) {
    const st = ev.st, spots = turnipSpots(sc);
    let at = st.at && spots.some(([x, y]) => x === st.at[0] && y === st.at[1]) ? st.at : null;
    at ||= spots.length ? pick(spots, rnd) : null;
    if (!at) return;
    st.at = at;
    const [x, y] = at, cells = [[x, y], [x + 1, y]];
    block(sc, cells);
    const ground = foot(y) - 2;
    const mound = sc.keep(sc.add.image(center(x) + TILE / 2, foot(y), tex(sc, ev.t.done ? 'dayb_hole' : 'dayb_mound', () => moundCanvas(ev.t.done))).setOrigin(0.5, 1).setDepth(D.actors + y / 100 - 0.0002));
    if (ev.t.done) { addThing(ev, { x, y, cells, tip: '순무 구덩이: 커다란 순무가 뽑혀 나간 자리다.' }); return; }
    const img = sc.keep(sc.add.image(center(x) + TILE / 2, ground, tex(sc, 'dayb_turnip', bigTurnipCanvas)).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    ev.turnip = { x, y, img, mound, ground, rows: TURNIP_H };
    showTurnip(sc, ev, turnipRows(st.pulls || 0));
    addThing(ev, {
      x, y, cells, act: pull,
      tip: () => ((st.pulls || 0) < HELP_AT ? '커다란 순무: 잎사귀만 땅 위로 삐죽 나와 있다. 엄청나게 크다.' : '커다란 순무: 조금씩 올라오고 있다. 다 같이 영차!'),
    });
  },
  tick(sc, ev, time) {
    const t = ev.turnip;
    if (!t || !t.img.active) return;
    // the leaves stir in the wind
    t.img.setFlipX(Math.floor(time / 1300) % 2 === 1);
  },
};

// ---------- 날아간 양말 ----------
// The neighbour's washing line is up beside their house with a sock gone: the wind took it somewhere
// in the village. Walk onto it and you pick it up (it rides along over your head); bring it round to
// the neighbour and the line is full again.
const SNACK = 'roastnut';
function lineFits(sc, x, y) {
  const cells = [[x, y], [x + 1, y], [x + 2, y]];
  return cells.every(([cx, cy]) => openCell(sc, cx, cy) && sc.ch(cx, cy) !== ':') && [0, 1, 2].some(dx => openCell(sc, x + dx, y + 1)) && !cuts(sc, cells);
}
function takeSock(sc, ev, th) {
  th.gone = true;
  const s = ev.sock, st = ev.st;
  ev.sock = null;
  st.sock = null;
  st.got = 1;
  sc.hooks.onSound?.('pop');
  face(sc, 'sparkle', 1200);
  carry(sc, tex(sc, 'dayb_sock', sockCanvas), { x: s.x, y: s.y });
  s.destroy();
  sc.say(sc.ps, '양말이다.', 1200);
  sc.hooks.onLife?.();
}
const laundry = {
  place(sc, ev, rnd) {
    const st = ev.st, nb = HOUSES.find(h => h.id === 'neighbor');
    if (!nb?.lived) return;
    const fits = (x, y) => lineFits(sc, x, y);
    let at = st.line && fits(st.line[0], st.line[1]) ? { x: st.line[0], y: st.line[1] } : null;
    at ||= freeSpot(sc, { x: nb.x + nb.w + 1, y: nb.y + nb.h - 1 }, 3, rnd, fits) || freeSpot(sc, doorOf(nb), 6, rnd, fits);
    if (!at) return;
    st.line = [at.x, at.y];
    const { x, y } = at, cells = [[x, y], [x + 1, y], [x + 2, y]];
    block(sc, cells);
    const full = ev.t.done || st.got === 2;
    ev.line = sc.keep(sc.add.image(center(x + 1), foot(y), tex(sc, `dayb_washing${full ? 1 : 0}`, () => washingCanvas(full))).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    addThing(ev, { x, y, cells, tip: () => (ev.t.done || st.got === 2 ? '빨랫줄: 양말 두 짝이 나란히 걸려 있다.' : '빨랫줄: 이웃네 빨래가 널려 있다. 양말이 한 짝뿐이다.') });
    if (ev.t.done || st.got === 2) return;
    if (st.got === 1) { carry(sc, tex(sc, 'dayb_sock', sockCanvas)); return; }
    // the sock, somewhere off on the grass
    let sock = st.sock && openCell(sc, st.sock[0], st.sock[1]) ? { x: st.sock[0], y: st.sock[1] } : null;
    sock ||= freeSpot(sc, PLAZA, 16, rnd, (sx, sy) => cheb({ x: sx, y: sy }, at) >= 7 && cheb({ x: sx, y: sy }, sc.p) >= 4 && sc.ch(sx, sy) !== ':');
    if (!sock) return;
    st.sock = [sock.x, sock.y];
    ev.sock = sc.keep(sc.add.image(center(sock.x), foot(sock.y) - 2, tex(sc, 'dayb_sock', sockCanvas)).setOrigin(0.5, 1).setDepth(D.deco + 0.5).setFlipX(rnd() < 0.5));
    ev.sock.base = ev.sock.y;
    addThing(ev, { x: sock.x, y: sock.y, onto: true, tip: '양말 한 짝: 바람에 날려 온 모양이다. 노란색이다.', step: takeSock });
  },
  tick(sc, ev, time) {
    // the sock on the grass lifts a pixel in the wind now and then
    const s = ev.sock;
    if (s?.active) s.setY(s.base - (Math.floor(time / 700) % 3 === 0 ? 1 : 0));
  },
  // the sock to the neighbour
  meet(sc, ev, who) {
    if (who.id !== 'neighbor' || ev.st.got !== 1 || !ev.held) return false;
    ev.st.got = 2;
    handOver(sc, who, () => {
      sayAs(sc, who, '내 양말! 바람이 범인이었어. 고마워, 이거 받아.', 2400);
      sc.time.delayedCall(500, () => earn(sc, who.s.x, who.s.y - 20, 30));
      sc.time.delayedCall(1000, () => give(sc, SNACK, 1, { x: who.s.x, y: who.s.y - 12 }));
      // the line full again
      sc.time.delayedCall(1400, () => {
        if (!ev.line?.active) return;
        ev.line.setTexture(tex(sc, 'dayb_washing1', () => washingCanvas(true)));
        sc.spark.explode(6, ev.line.x + 12, ev.line.y - 16);
      });
      dayDone(sc, ev);
      sc.hooks.onLife?.();
    });
    return true;
  },
};

// ---------- 나무에 걸린 연 ----------
// A friend's kite is caught high in one of the trees, the friend standing under it looking up. Bump the
// trunk a few times (leaves come down, the tree shivers) and the kite drops; the friend hugs it.
const SHAKES = 3;
function shakeTree(sc, ev, th) {
  const k = ev.kite, st = ev.st;
  if (!k || ev.shaking) return;
  ev.shaking = true;
  st.shakes = (st.shakes || 0) + 1;
  sc.hooks.onSound?.('rustle');
  const t = k.tree;
  sc.fall.explode(6 + st.shakes * 3, t.x, t.y - t.height + 16);
  if (!t.shaking) {
    t.shaking = true;
    const x0 = t.x;
    sc.tweens.add({ targets: t, x: x0 + 1, duration: 45, yoyo: true, repeat: 2, onComplete: () => { t.x = x0; t.shaking = false; } });
  }
  sc.tweens.add({ targets: k.img, y: k.img.y + 2, duration: 70, yoyo: true, repeat: 1 });
  // you lean into the trunk
  const ps = sc.ps, bx = center(sc.p.x), by = foot(sc.p.y);
  sc.tweens.killTweensOf(ps);
  ps.setPosition(bx, by);
  sc.tweens.add({ targets: ps, x: bx + Math.sign(k.x - sc.p.x) * 3, y: by + Math.sign(k.y - sc.p.y) * 2, duration: 60, yoyo: true, ease: 'Quad.out' });
  sc.hooks.onLife?.();
  sc.time.delayedCall(380, () => { ev.shaking = false; if (st.shakes >= SHAKES) dropKite(sc, ev, th); });
}
// the kite comes down, swinging side to side, to the friend's feet; the friend hugs it
function dropKite(sc, ev, th) {
  const k = ev.kite, h = k.friend;
  if (th.gone) return;
  th.gone = true;
  ev.shaking = true;
  k.down = true;
  sc.hooks.onSound?.('pop');
  sc.fall.explode(10, k.tree.x, k.tree.y - k.tree.height + 16);
  const img = k.img, x0 = img.x, y0 = img.y, tx = h ? h.s.x : x0, ty = h ? h.s.y - 6 : foot(k.y + 1);
  img.setDepth(D.fx - 0.2);
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 1300, ease: 'Sine.easeIn',
    onUpdate: tw => { const u = tw.getValue(); img.setPosition(Math.round(x0 + (tx - x0) * u + 7 * Math.sin(u * 9)), Math.round(y0 + (ty - y0) * u)); },
    onComplete: () => {
      sc.spark.explode(8, img.x, img.y);
      if (h && h.s.active) {
        img.setPosition(h.s.x + (h.s.flipX ? -5 : 5), h.s.y - 2).setDepth(h.s.depth + 0.0005);
        sc.tweens.add({ targets: h.s, hop: 5, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.out' });
        setEmote(h.s, '♥', sc.time.now, 1600);
        sc.time.delayedCall(300, () => sc.say(h.s, '내 연! 고마워!', 1700));
      }
      face(sc, 'sparkle', 1400);
      dayDone(sc, ev);
      // off the friend goes with it, a while later
      sc.time.delayedCall(3200, () => {
        sc.tweens.add({ targets: img, alpha: 0, duration: 500, onComplete: () => img.destroy() });
        if (h) { h.busy = false; h.next = sc.time.now + 600; }
        ev.kite = null;
      });
    },
  });
}
const kite = {
  place(sc, ev, rnd) {
    const st = ev.st;
    if (ev.t.done) return;
    const ok = (x, y) => sc.treeAt(x, y) && N8.some(([dx, dy]) => openCell(sc, x + dx, y + dy) && sc.route(x + dx, y + dy).length);
    let at = st.tree && sc.ch(st.tree[0], st.tree[1]) === 'T' && ok(st.tree[0], st.tree[1]) ? st.tree : null;
    at ||= treeSpots(sc, rnd);
    if (!at) return;
    st.tree = at;
    const [x, y] = at, tree = sc.treeAt(x, y);
    const img = sc.keep(sc.add.image(tree.x + 5, tree.y - tree.height + 9, tex(sc, 'dayb_kite', kiteCanvas)).setOrigin(0.5, 0).setDepth(tree.depth + 0.0003));
    ev.kite = { x, y, tree, img, friend: null, sigh: 0 };
    // the friend whose kite it is, under the tree, looking up
    const free = freeHeroes(sc), cells = roundCells(sc, x, y).filter(c => c.y >= y);
    const h = free.length ? free[Math.floor(rnd() * free.length)] : null, c = cells[0] || roundCells(sc, x, y)[0];
    if (h && c) {
      h.busy = true;
      ev.kite.friend = h;
      standAt(sc, h, c.x, c.y, c.x > x);
    }
    addThing(ev, { x, y, act: shakeTree, tip: () => ((st.shakes || 0) ? '나무: 흔들었더니 연이 조금 움직였다. 더!' : '나무: 높은 가지에 연이 걸려 있다.') });
  },
  tick(sc, ev, time) {
    const k = ev.kite;
    if (!k || !k.img.active) return;
    // it tugs at its string in the wind, up there
    if (!ev.shaking && !k.down) k.img.setX(k.tree.x + 5 + (Math.floor(time / 900) % 2));
    const h = k.friend;
    if (h && h.s.active && time > k.sigh && !ev.t.done) { k.sigh = time + 3200 + Math.random() * 2400; setEmote(h.s, '…', time, 1300); h.s.setFlipX(k.x < h.x); }
  },
  // the friend under the tree only sighs (no swapping places today)
  meet(sc, ev, who) {
    const k = ev.kite;
    if (!k || who !== k.friend) return false;
    sayAs(sc, who, ev.t.done ? '연 돌려줘서 고마워.' : '내 연이… 나무가 안 놔줘.', 1700);
    return true;
  },
  describe(sc, ev, x, y) {
    const h = ev.kite?.friend;
    return h && h.x === x && h.y === y ? `${nameOf(h.id)}: 나무 위만 올려다보고 있다.` : '';
  },
};

// ---------- 병아리 소동 ----------
// Three chicks have got out and are scattered about the village; the hen fusses by the neighbour's
// house (or the plaza). Walk into a chick and it comes along behind you, in a line; bring all three to
// the hen and they run under her, and she lays you an egg.
const CHICKS = 3;
function chickImg(sc, x, y) {
  const s = sc.keep(sc.add.image(center(x), foot(y), 'pet_chick').setOrigin(0.5, 1).setDepth(D.actors + y / 100));
  s.setScale(texScale(s));
  return s;
}
function takeChick(sc, ev, th) {
  th.gone = true;
  const c = ev.chicks[th.i];
  ev.st.chicks[th.i][2] = 1;
  ev.chain ||= follow(sc, [], { gap: 10, ground: true });
  ev.chain.items.push({ img: c.img, x: c.img.x, y: c.img.y });
  c.img.setDepth(sc.ps.depth - 0.0003);
  sc.hooks.onSound?.('pop');
  float(sc, c.img.x, c.img.y - 12, '삐약', '#f4cf4f');
  face(sc, 'sparkle', 1000);
  sc.hooks.onLife?.();
}
// at the hen: with all three behind you they run under her and she lays an egg; with fewer she fusses
function toHen(sc, ev, th) {
  const hn = ev.hen, got = ev.st.chicks.filter(c => c[2]).length;
  sc.tweens.add({ targets: hn.img, y: hn.img.y - 3, duration: 90, yoyo: true, repeat: 1, ease: 'Quad.out' });
  if (got < CHICKS) { float(sc, hn.img.x, hn.img.y - 14, '꼬꼬?', '#f4efe6'); setEmote(sc.ps, '…', sc.time.now, 1100); return; }
  th.gone = true;
  float(sc, hn.img.x, hn.img.y - 14, '꼬꼬댁!', '#f4efe6');
  const items = ev.chain ? ev.chain.items : [];
  ev.chains = (ev.chains || []).filter(c => c !== ev.chain);
  ev.chain = null;
  items.forEach((it, i) => sc.time.delayedCall(i * 160, () => {
    const img = it.img;
    if (!img.active) return;
    sc.tweens.add({ targets: img, x: hn.img.x + (i - 1) * 3, y: hn.img.y, duration: 420, ease: 'Quad.in', onComplete: () => { sc.dust.explode(3, img.x, img.y); img.destroy(); } });
  }));
  sc.time.delayedCall(1100, () => {
    sc.hooks.onSound?.('pop');
    sc.spark.explode(8, hn.img.x, hn.img.y - 6);
    give(sc, 'egg', 1, { x: hn.img.x, y: hn.img.y - 4 }, () => sc.say(sc.ps, '달걀이다!', 1300));
    dayDone(sc, ev);
  });
}
const chicks = {
  place(sc, ev, rnd) {
    const st = ev.st, nb = HOUSES.find(h => h.id === 'neighbor');
    const near = nb?.lived ? doorOf(nb) : PLAZA, fits = (x, y) => openCell(sc, x, y) && sc.ch(x, y) !== ':' && !cuts(sc, [[x, y]]);
    let at = st.hen && fits(st.hen[0], st.hen[1]) ? { x: st.hen[0], y: st.hen[1] } : null;
    at ||= freeSpot(sc, near, 4, rnd, fits) || freeSpot(sc, PLAZA, 8, rnd, fits);
    if (!at) return;
    st.hen = [at.x, at.y];
    block(sc, [[at.x, at.y]]);
    const img = sc.keep(sc.add.image(center(at.x), foot(at.y) - 1, tex(sc, 'dayb_hen', henCanvas)).setOrigin(0.5, 1).setDepth(D.actors + at.y / 100));
    ev.hen = { x: at.x, y: at.y, img, next: 0 };
    if (ev.t.done) { addThing(ev, { x: at.x, y: at.y, tip: '엄마 닭: 병아리들을 품고 꾸벅꾸벅 졸고 있다.' }); return; }
    addThing(ev, { x: at.x, y: at.y, act: toHen, tip: '엄마 닭: 꼬꼬댁 꼬꼬! 안절부절못하고 있다.' });
    // the chicks, off on their own about the village
    st.chicks ||= [];
    while (st.chicks.length < CHICKS) {
      const s = freeSpot(sc, PLAZA, 13, rnd, (x, y) => cheb({ x, y }, at) >= 5 && cheb({ x, y }, sc.p) >= 3 && st.chicks.every(c => cheb({ x, y }, { x: c[0], y: c[1] }) >= 4));
      if (!s) break;
      st.chicks.push([s.x, s.y, 0]);
    }
    ev.chicks = st.chicks.map(([x, y, got], i) => {
      if (got) {
        const img = chickImg(sc, sc.p.x, sc.p.y);
        img.setDepth(sc.ps.depth - 0.0003);
        ev.chain ||= follow(sc, [], { gap: 10, ground: true });
        ev.chain.items.push({ img, x: img.x, y: img.y });
        return { x, y, img, peep: 0 };
      }
      if (!sc.walkable(x, y)) { const s = freeSpot(sc, { x, y }, 3, rnd); if (s) { x = s.x; y = s.y; st.chicks[i][0] = x; st.chicks[i][1] = y; } }
      const img = chickImg(sc, x, y);
      addThing(ev, { x, y, i, onto: true, tip: '병아리: 삐약삐약. 혼자서 어딜 가는 걸까.', step: takeChick });
      return { x, y, img, peep: 0 };
    });
  },
  tick(sc, ev, time) {
    const hn = ev.hen;
    if (hn && time > hn.next) {
      hn.next = time + 900 + Math.random() * 900;
      hn.img.setFlipX(!hn.img.flipX);
      if (!ev.t.done && Math.random() < 0.3 && cheb(hn, sc.p) <= 6) float(sc, hn.img.x, hn.img.y - 14, '꼬꼬', '#f4efe6');
    }
    for (const c of ev.chicks || []) {
      if (!c.img.active || time < c.peep) continue;
      c.peep = time + 1500 + Math.random() * 2000;
      if (Math.random() < 0.5) sc.tweens.add({ targets: c.img, y: c.img.y - 2, duration: 90, yoyo: true, ease: 'Quad.out' });
      else if (cheb({ x: Math.floor(c.img.x / TILE), y: Math.floor(c.img.y / TILE) }, sc.p) <= 5) float(sc, c.img.x, c.img.y - 10, '삐약', '#f4cf4f');
    }
  },
};

// ---------- 숨바꼭질 ----------
// Three friends from the meadow are hiding: behind a bush, a crate or a tree, each showing a little of
// themselves (data/play.js HIDE_LINES: ears over the top, a tail out of the side...). Bump the spot and
// out they pop with a '!'; a page for each, and the day's once all three are found.
const HIDERS = 3;
const FOUND = ['들켰다!', '어떻게 알았어?', '아, 아깝다!', '다음엔 더 잘 숨을 거야.'];
const SPOT_TIP = { bush: '덤불: 잎이 바스락거린다.', crate: '나무 상자: 뭔가 들썩거린다.', tree: '나무: 뒤에서 뭔가 꼼지락거린다.' };
// where a bit of someone shows: over the top of the spot, or out of its side
function peekAt(sc, hd, kind) {
  const top = peekTop(hd.id), x = center(hd.at[0]), y = foot(hd.at[1]);
  tex(sc, `dayb_peek_${hd.id}`, () => peekCanvas(hd.id));
  if (kind === 'tree') return { x: x + 6 + (top ? 0 : 2), y: y - 2, ox: 0, oy: 1, depth: D.actors + hd.at[1] / 100 + 0.0008 };
  const h = kind === 'bush' ? 13 : 14;
  if (top) return { x: x + (hd.id === 'bear' ? 0 : 1), y: y - h + 3, ox: 0.5, oy: 1, depth: D.actors + hd.at[1] / 100 - 0.0004 };
  return { x: x + (kind === 'bush' ? 7 : 6), y: y - 3, ox: 0, oy: 1, depth: D.actors + hd.at[1] / 100 - 0.0004 };
}
function hideHero(sc, ev, hd) {
  const h = sc.heroes.find(o => o.id === hd.id);
  if (!h || !h.s.active) return null;
  sc.tweens.killTweensOf(h.s);
  h.busy = true;
  h.x = hd.at[0]; h.y = hd.at[1];
  h.s.noShadow = true;
  h.s.setVisible(false).setPosition(center(h.x), foot(h.y));
  return h;
}
function findHider(sc, ev, th) {
  const hd = ev.st.hiders[th.i], spot = ev.spots[th.i];
  if (hd.found || th.gone) return;
  const h = spot.hero && spot.hero.s.active ? spot.hero : hideHero(sc, ev, hd);
  th.gone = true;
  hd.found = 1;
  spot.peek?.destroy();
  spot.peek = null;
  sc.hooks.onSound?.('pop');
  if (spot.img && !spot.img.shaking) {
    spot.img.shaking = true;
    const x0 = spot.img.x;
    sc.tweens.add({ targets: spot.img, x: x0 + 1, duration: 45, yoyo: true, repeat: 2, onComplete: () => { spot.img.x = x0; spot.img.shaking = false; } });
  }
  if (h) {
    const c = roundCells(sc, hd.at[0], hd.at[1])[0] || { x: sc.p.x, y: sc.p.y };
    h.busy = false;
    h.next = sc.time.now + 2500;
    h.s.noShadow = false;
    h.s.setVisible(true).setPosition(center(hd.at[0]), foot(hd.at[1]) - 4);
    hopTo(sc, h, c.x, c.y, 320, c.x < sc.p.x ? false : c.x > sc.p.x);
    setEmote(h.s, '!', sc.time.now, 1300);
    sc.time.delayedCall(350, () => sc.say(h.s, pick(FOUND), 1700));
  }
  sc.spark.explode(8, center(hd.at[0]), foot(hd.at[1]) - 8);
  face(sc, 'sparkle', 1200);
  sc.hooks.onEntry?.(hideId(hd.id));
  sc.hooks.onLife?.();
  if (ev.st.hiders.every(o => o.found)) sc.time.delayedCall(900, () => dayDone(sc, ev));
}
// who hides where today: the friends from the meadow (three of them), bushes and crates put out on the
// grass and the trees standing about, none too close to another
function rollHiders(sc, rnd) {
  const ids = sc.heroes.map(h => h.id).filter(id => HIDE_IDS.includes(id));
  const out = [];
  while (ids.length && out.length < HIDERS) out.push({ id: ids.splice(Math.floor(rnd() * ids.length), 1)[0], found: 0 });
  const far = (x, y) => out.every(o => !o.at || cheb({ x, y }, { x: o.at[0], y: o.at[1] }) >= 5) && cheb({ x, y }, sc.p) >= 4;
  for (const o of out) {
    const want = pick(['bush', 'crate', 'tree'], rnd);
    let at = want === 'tree' ? treeSpots(sc, rnd, far) : null;
    o.kind = at ? 'tree' : want === 'tree' ? 'bush' : want;
    if (!at) { const s = freeSpot(sc, PLAZA, 13, rnd, (x, y) => far(x, y) && sc.ch(x, y) !== ':' && !cuts(sc, [[x, y]])); at = s && [s.x, s.y]; }
    o.at = at;
  }
  return out.filter(o => o.at);
}
const hide = {
  place(sc, ev, rnd) {
    const st = ev.st;
    // (rolled afresh when a hider is not about any more, or their spot has gone under something)
    const stale = hd => !sc.heroes.some(h => h.id === hd.id) ||
      (hd.kind === 'tree' ? sc.ch(hd.at[0], hd.at[1]) !== 'T' || !sc.treeAt(hd.at[0], hd.at[1]) : sc.blocked[hd.at[1] * MW + hd.at[0]] || !'.*:'.includes(sc.ch(hd.at[0], hd.at[1])));
    if (!st.hiders || st.hiders.some(hd => !hd.found && stale(hd))) st.hiders = rollHiders(sc, rnd);
    ev.spots = st.hiders.map((hd, i) => {
      const [x, y] = hd.at, spot = { img: null, peek: null, hero: null };
      if (hd.kind !== 'tree') {
        block(sc, [[x, y]]);
        const key = hd.kind === 'bush' ? tex(sc, 'dayb_bush', bushCanvas) : tex(sc, 'dayb_crate', () => propCanvas('crate'));
        spot.img = sc.keep(sc.add.image(center(x), foot(y) + (hd.kind === 'bush' ? 1 : 0), key).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
      } else spot.img = sc.treeAt(x, y);
      if (hd.found) return spot;
      spot.hero = hideHero(sc, ev, hd);
      const p = peekAt(sc, hd, hd.kind);
      spot.peek = sc.keep(sc.add.image(p.x, p.y, `dayb_peek_${hd.id}`).setOrigin(p.ox, p.oy).setDepth(p.depth));
      spot.peek.base = { x: p.x, y: p.y };
      addThing(ev, { x, y, i, act: findHider, tip: SPOT_TIP[hd.kind] });
      return spot;
    });
  },
  tick(sc, ev, time) {
    // the bits that show fidget now and then (an ear twitches, a tail swishes)
    ev.spots?.forEach((spot, i) => {
      const pk = spot.peek;
      if (!pk?.active) return;
      const t = time / 1000 + i * 1.3, wig = Math.sin(t * 2.4) > 0.75 ? 1 : 0;
      if (peekTop(ev.st.hiders[i].id)) pk.setY(pk.base.y - wig);
      else pk.setX(pk.base.x + wig);
    });
  },
};

export const DAYS_B = { turnip, laundry, kite, chicks, hide };
