// 마을의 하루, the third lot of days (v0.30): see scenes/village-days.js for what a day is and the helpers;
// the pictures are in village-days-c-art.js.
//   연못가 소풍  a blanket by the pond with friends on it and a basket: sit down with them and they share
//   바람 부는 날  gusts of leaves across the village, the laundry and the flags flapping; the guild master's
//               cap has blown off somewhere: pick it up and take it back to him
//   꽃 잔치      flowers out all over the grass, and six wild roses big enough to pick: walk onto them
//   대청소       litter along the paths: walk onto each bit, and take the bag to the guild master
//   광장 연주회  a friend playing the lute in the plaza, folk gathered round: a coin in the hat for an encore

import { TILE } from './textures.js';
import { D } from './VillageScene.js';
import { setEmote } from './emotes.js';
import { face } from './village-secrets.js';
import { freeSpot, openCell, cuts, block, addThing, sayAs, pay, give, earn, carry, handOver, dayDone } from './village-days.js';
import {
  blanketCanvas, basketCanvas, capCanvas, windBitCanvas, shiftedCanvas, bloomSheetCanvas, roseCanvas, bouquetCanvas,
  LITTER_KINDS, litterCanvas, trashBagCanvas, luteCanvas, noteCanvas, hatCanvas, coinCanvas,
} from './village-days-c-art.js';
import { VILLAGE_MAP } from '../data/village.js';
import { REGION } from '../data/village-map.js';
import { CHARACTERS } from '../data/characters.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// the middle of the plaza (as in VillageScene)
const PLAZA = { x: 30, y: 23 };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const pick = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length)];
const tex = (sc, key, make) => { if (!sc.textures.exists(key)) sc.textures.addCanvas(key, make()); return key; };
const grassy = ch => ch === '.' || ch === '*';
const nearest = (list, p) => list.slice().sort((a, b) => cheb(a, p) - cheb(b, p));
const nameOf = one => (one.f ? one.f.name : CHARACTERS[one.id].name);
const guildMaster = sc => sc.folk.find(f => f.id === 'guild' && f.s.alpha === 1);
// the ground right next to the pond
function bankCells(sc) {
  const out = [];
  for (const t of sc.pondTiles || []) {
    if (REGION[t.y]?.[t.x] !== 'B') continue;
    for (const [dx, dy] of N8.slice(0, 4)) {
      const x = t.x + dx, y = t.y + dy;
      if (grassy(sc.ch(x, y)) && !sc.blocked[y * MW + x] && !out.some(o => o.x === x && o.y === y)) out.push({ x, y });
    }
  }
  return out;
}
// a villager or a friend sits (or stands) at `c` for the day, looking towards `at`
function settle(sc, one, c, at, sit) {
  sc.tweens.killTweensOf(one.s);
  one.x = c.x; one.y = c.y;
  one.busy = true;
  one.s.hop = 0;
  one.s.sy = sit ? 0.86 : 1;
  one.s.setPosition(center(c.x), foot(c.y)).setDepth(D.actors + c.y / 100).setFlipX(c.x > at.x);
  return { one, s: one.s, x: c.x, y: c.y };
}
// the friends from the meadow who are free, then a villager or two when there are not enough (`need`)
function freeFriends(sc, room, need, folkIds) {
  const who = sc.heroes.filter(h => !h.busy).slice(0, room);
  for (const id of folkIds) {
    const one = sc.folk.find(o => o.id === id && !o.busy && o.s.alpha === 1);
    if (one && who.length < need) who.push(one);
  }
  return who;
}

// ---------- 연못가 소풍 ----------
// A gingham blanket on the grass by the pond, friends sitting round the basket. Walk onto a free corner
// of it and you sit down with them, and they share the lunch (a 소풍 도시락 into the basket).
// where everyone goes on the blanket (cells from its top left): three friends, the basket, and the two
// cells left for you, on the open side
const PICNIC_SEATS = [[0, 0], [2, 0], [0, 1]], PICNIC_BASKET = [1, 0], PICNIC_FREE = [[1, 1], [2, 1]];
const PICNIC_LINES = ['김밥 맛있다.', '개미가 왔다!', '연못 바람 시원하다.', '하나 더 먹어도 돼?', '배부르다…', '오리가 쳐다본다.'];
const blanketCells = (x, y) => [[x, y], [x + 1, y], [x + 2, y], [x, y + 1], [x + 1, y + 1], [x + 2, y + 1]];
// all six cells free grass, with somewhere to step on from below, and nothing cut off by the solid four
function blanketFits(sc, x, y) {
  const cells = blanketCells(x, y);
  if (!cells.every(([cx, cy]) => grassy(sc.ch(cx, cy)) && openCell(sc, cx, cy))) return false;
  if (![0, 1, 2].some(i => openCell(sc, x + i, y + 2))) return false;
  return !cuts(sc, cells.slice(0, 4));
}
function seatPicnic(sc, ev) {
  const b = ev.blanket, room = 3 - ev.seated.length;
  if (room <= 0) return;
  const spots = PICNIC_SEATS.map(([i, j]) => ({ x: b.x + i, y: b.y + j })).filter(c => !ev.seated.some(o => o.x === c.x && o.y === c.y)).slice(0, room);
  const who = freeFriends(sc, room, Math.max(0, 2 - ev.seated.length), ['neighbor', 'rival', 'rescue']);
  spots.forEach((c, i) => who[i] && ev.seated.push(settle(sc, who[i], c, ev.basket, true)));
}
function sitPicnic(sc, ev) {
  if (ev.sitting) return;
  const ps = sc.ps, b = ev.basket;
  ev.sitting = true;
  ps.setFlipX(b.x < sc.p.x);
  ps.sy = 0.86;
  sc.dust.explode(3, ps.x, ps.y);
  const o = nearest(ev.seated.filter(q => q.s.active), sc.p)[0];
  if (ev.t.done) { if (o) sc.time.delayedCall(250, () => sayAs(sc, o.one, pick(PICNIC_LINES), 1500)); return; }
  if (o) sc.time.delayedCall(250, () => sayAs(sc, o.one, '왔구나! 같이 먹자.', 1700));
  sc.time.delayedCall(1100, () => {
    if (sc.day !== ev) return;
    sc.hooks.onSound?.('pop');
    give(sc, 'picnicbox', 1, { x: ev.basketImg.x, y: ev.basketImg.y - 6 }, () => sc.say(sc.ps, '잘 먹겠습니다!', 1500));
    dayDone(sc, ev);
  });
}
const picnic = {
  place(sc, ev, rnd) {
    const st = ev.st, fits = (x, y) => blanketFits(sc, x, y);
    let at = st.at && fits(st.at[0], st.at[1]) ? { x: st.at[0], y: st.at[1] } : null;
    const bank = bankCells(sc);
    for (let k = 0; k < 8 && !at && bank.length; k++) at = freeSpot(sc, pick(bank, rnd), 3, rnd, fits);
    at ||= freeSpot(sc, PLAZA, 10, rnd, fits);
    ev.seated = [];
    if (!at) return;
    st.at = [at.x, at.y];
    const { x, y } = at, cells = blanketCells(x, y);
    block(sc, cells.slice(0, 4));
    sc.keep(sc.add.image(x * TILE, foot(y + 1) + 1, tex(sc, 'day_blanket', blanketCanvas)).setOrigin(0, 1).setDepth(D.deco + 0.4));
    const bx = x + PICNIC_BASKET[0], by = y + PICNIC_BASKET[1];
    ev.blanket = { x, y };
    ev.basket = { x: bx, y: by };
    ev.basketImg = sc.keep(sc.add.image(center(bx), foot(by) - 2, tex(sc, 'day_basket', basketCanvas)).setOrigin(0.5, 1).setDepth(D.actors + by / 100));
    seatPicnic(sc, ev);
    addThing(ev, { x: bx, y: by, tip: '소풍 바구니: 도시락 냄새가 솔솔 난다.' });
    for (const [i, j] of PICNIC_FREE) addThing(ev, { x: x + i, y: y + j, onto: true, step: sitPicnic, tip: () => (ev.sitting ? '돗자리: 폭신폭신하다.' : '돗자리: 친구들이 둘러앉아 도시락을 먹고 있다. 자리가 남았다.') });
  },
  tick(sc, ev, time) {
    if (!ev.blanket) return;
    // the guild changed who is out today and the meadow's friends were put out afresh: on the blanket again
    const gone = ev.seated.filter(o => !o.s.active);
    if (gone.length) { ev.seated = ev.seated.filter(o => o.s.active); seatPicnic(sc, ev); }
    for (const o of ev.seated) if (cheb(o, sc.p) <= 3 && o.x !== sc.p.x) o.s.setFlipX(sc.p.x < o.x);
    if (time > (ev.chatAt || 0)) {
      ev.chatAt = time + 5000 + Math.random() * 5000;
      const o = pick(ev.seated);
      if (o && cheb(o, sc.p) <= 6 && !sc.play) { sc.say(o.s, pick(PICNIC_LINES), 1500); sc.tweens.add({ targets: o.s, hop: 3, duration: 90, yoyo: true, ease: 'Quad.out' }); }
    }
  },
  stepOn(sc, ev) {
    if (!ev.sitting) return;
    ev.sitting = false;
    sc.ps.sy = 1;
  },
  // a friend on the blanket just chats (no swapping places with them today)
  meet(sc, ev, who) {
    if (!ev.seated?.some(o => o.one === who)) return false;
    sc.say(who.s, pick(PICNIC_LINES), 1400);
    return true;
  },
  describe(sc, ev, x, y) {
    const o = ev.seated?.find(q => q.x === x && q.y === y && q.s.active);
    return o ? `${nameOf(o.one)}: 돗자리에 앉아 김밥을 먹고 있다.` : '';
  },
};

// ---------- 바람 부는 날 ----------
// Gusts of leaves and petals streak across, the laundry swings on its line and the roof flags flap for
// all they are worth. The guild master's cap has blown off to somewhere in the village: walk onto it to
// pick it up, and bump him to give it back.
const GUST_BITS = 18;
const capKey = sc => tex(sc, 'day_cap', capCanvas);
function takeCap(sc, ev, th) {
  th.gone = true;
  ev.st.cap = 'held';
  const img = ev.cap;
  ev.cap = null;
  sc.hooks.onSound?.('rustle');
  face(sc, 'sparkle', 1200);
  carry(sc, capKey(sc), { x: img.x, y: img.y - 4 });
  img.destroy();
  sc.hooks.onLife?.();
}
// the bits the wind carries: a pool, launched from off the left of the view in gusts, gone past the right
function gustTick(sc, ev, time, dt) {
  const g = ev.gust, view = sc.cameras.main.worldView, s = dt / 1000;
  if (time > g.next && !sc.showing) {
    g.next = time + 1500 + Math.random() * 2200;
    g.on = time + 700;
    const idle = g.bits.filter(b => !b.live), n = 8 + Math.floor(Math.random() * 7);
    for (const b of idle.slice(0, n)) {
      b.live = true;
      b.x = view.x - 10 - Math.random() * 140; b.y = view.y + Math.random() * view.height;
      b.v = 150 + Math.random() * 120; b.seed = Math.random() * 6.3;
      b.img.setVisible(true);
    }
  }
  for (const b of g.bits) {
    if (!b.live) continue;
    b.x += b.v * s; b.y += (Math.sin(time / 110 + b.seed) * 24 + 8) * s;
    if (b.x > view.right + 20 || b.y > view.bottom + 20) { b.live = false; b.img.setVisible(false); continue; }
    b.img.setPosition(Math.round(b.x), Math.round(b.y)).setFlipY(Math.floor(time / 90 + b.seed) % 2 === 0);
  }
}
// the laundry on its line (집 꾸미기), swinging: the clothes between the poles nudged a pixel one way and
// the other; the flags on the roofs flap twice as fast
function flapTick(sc, ev, time) {
  const w = sc.decor?.laundry;
  if (w?.active) {
    const fr = Math.floor(time / 170) % 2;
    if (fr !== ev.washFrame) {
      ev.washFrame = fr;
      const src = sc.textures.get('decor_laundry').getSourceImage();
      w.setTexture(tex(sc, `day_laundry${fr}`, () => shiftedCanvas(src, 5, 46, 3, 11, y => (y >= 5 && (y + fr) % 2 ? 1 : 0))));
    }
  }
  const ff = Math.floor(time / 150) % 2;
  if (ff !== ev.flagFrame) {
    ev.flagFrame = ff;
    for (const f of sc.flags || []) if (f.img.active) f.img.setTexture(sc.growthKey('flag', f.v * 2 + ff));
  }
}
const wind = {
  place(sc, ev, rnd) {
    ev.gust = { bits: [], next: sc.time.now + 500, on: 0 };
    for (let k = 0; k < GUST_BITS; k++) ev.gust.bits.push({ img: sc.keep(sc.add.image(0, 0, tex(sc, `day_windbit${k % 3}`, () => windBitCanvas(k % 3))).setDepth(D.fx - 0.1).setVisible(false)), live: false, x: 0, y: 0, v: 0, seed: 0 });
    ev.washFrame = ev.flagFrame = -1;
    if (ev.t.done) return;
    const st = ev.st, boss = guildMaster(sc);
    if (!boss) return;
    if (st.cap === 'held') { carry(sc, capKey(sc)); return; }
    if (!Array.isArray(st.cap) || sc.blocked[st.cap[1] * MW + st.cap[0]]) {
      const s = freeSpot(sc, boss, 16, rnd, (x, y) => cheb({ x, y }, boss) >= 7 && cheb({ x, y }, sc.p) >= 4);
      if (!s) return;
      st.cap = [s.x, s.y];
    }
    const [x, y] = st.cap;
    ev.cap = sc.keep(sc.add.image(center(x), foot(y) - 1, capKey(sc)).setOrigin(0.5, 1).setDepth(D.actors + y / 100 - 0.001));
    ev.capAt = { x, y };
    addThing(ev, { x, y, onto: true, tip: '모자: 바람에 날려 온 모자다. 어디서 본 것 같다.', step: takeCap });
  },
  tick(sc, ev, time, dt) {
    gustTick(sc, ev, time, dt);
    flapTick(sc, ev, time);
    // the cap skips about on the ground while a gust blows
    if (ev.cap) ev.cap.setX(center(ev.capAt.x) + (time < ev.gust.on && Math.floor(time / 60) % 2 ? 1 : 0));
    // the guild master, bareheaded, wonders where it went
    if (!ev.t.done && time > (ev.wonderAt || 0)) {
      ev.wonderAt = time + 4500 + Math.random() * 3000;
      const boss = guildMaster(sc);
      if (boss && cheb(boss, sc.p) <= 7 && !boss.busy) setEmote(boss.s, '?', time, 1400);
    }
  },
  // the cap back to the guild master
  meet(sc, ev, who) {
    if (who.id !== 'guild' || ev.st.cap !== 'held' || !ev.held) return false;
    ev.st.cap = 'back';
    handOver(sc, who, () => {
      sayAs(sc, who, '아이고, 내 모자! 고맙네. 이건 사례일세.', 2200);
      sc.time.delayedCall(500, () => earn(sc, who.s.x, who.s.y - 20, 40));
      dayDone(sc, ev);
      sc.hooks.onLife?.();
    });
    return true;
  },
};

// ---------- 꽃 잔치 ----------
// Flowers out all over the grass (one sheet over the whole village), and six wild roses standing up in
// it, spread about: walk onto one and you pick it, and carry the bunch; the sixth and the bunch goes
// into the basket (들장미, two of them). What is picked is kept with the day.
const ROSES = 6;
const bouquetKey = (sc, n) => tex(sc, `day_bouquet${n}`, () => bouquetCanvas(n));
function roseSpots(sc, rnd) {
  const out = [];
  const ok = (x, y) => grassy(sc.ch(x, y)) && cheb({ x, y }, sc.p) >= 3 && out.every(o => cheb({ x, y }, o) >= 6);
  for (let k = 0; k < 24 && out.length < ROSES; k++) {
    const s = freeSpot(sc, out.length ? pick(out, rnd) : sc.p, 14, rnd, ok) || freeSpot(sc, PLAZA, 16, rnd, ok);
    if (s) out.push(s);
  }
  return out.map(o => [o.x, o.y]);
}
function pickRose(sc, ev, th) {
  th.gone = true;
  const st = ev.st, r = ev.roses[th.k];
  st.picked.push(th.k);
  const n = st.picked.length, ps = sc.ps;
  sc.hooks.onSound?.('rustle');
  face(sc, 'sparkle', 1000);
  sc.spark.explode(6, r.img.x, r.img.y - 6);
  sc.tweens.add({ targets: r.img, y: r.img.y - 10, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => r.img.destroy() });
  sc.time.delayedCall(200, () => {
    if (sc.day !== ev) return;
    carry(sc, bouquetKey(sc, n));
    if (n < ROSES) return;
    sc.time.delayedCall(700, () => {
      if (sc.day !== ev) return;
      const h = ev.held;
      ev.held = null;
      give(sc, 'rose', 2, h ? { x: h.x, y: h.y } : null, () => sc.say(ps, '한 아름이다!', 1500));
      h?.destroy();
      dayDone(sc, ev);
    });
  });
  sc.hooks.onLife?.();
}
const bloom = {
  place(sc, ev, rnd) {
    const st = ev.st, b = sc.openBox;
    // the sheet: a patch of blossoms on about two grass cells in five
    const cells = [];
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      if (sc.ch(x, y) !== '.' || sc.blocked[y * MW + x] || sc.isNew(x, y) || rnd() > 0.4) continue;
      cells.push([x - b.x0, y - b.y0, Math.floor(rnd() * 5)]);
    }
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
    sc.keep(sc.add.image(b.x0 * TILE, b.y0 * TILE, tex(sc, `day_bloom_${ev.t.seed}`, () => bloomSheetCanvas(w, h, cells))).setOrigin(0).setDepth(D.deco + 0.2));
    st.picked ||= [];
    if (!st.roses || st.roses.some(([x, y]) => sc.blocked[y * MW + x])) { st.roses = roseSpots(sc, rnd); st.picked = []; }
    ev.roses = st.roses.map(([x, y], k) => {
      if (st.picked.includes(k)) return null;
      const img = sc.keep(sc.add.image(center(x), foot(y) - 1, tex(sc, 'day_rose', roseCanvas)).setOrigin(0.5, 1).setDepth(D.actors + y / 100 - 0.001));
      addThing(ev, { x, y, k, onto: true, tip: '들장미: 유난히 크게 핀 꽃이다. 향기가 여기까지 난다.', step: pickRose });
      return { x, y, img };
    });
    if (st.picked.length && !ev.t.done) carry(sc, bouquetKey(sc, st.picked.length));
  },
  tick(sc, ev, time) {
    // the roses nod now and then
    const k = Math.floor(time / 700) % 7;
    for (const r of ev.roses || []) if (r?.img.active) r.img.setX(center(r.x) + (k === (r.x + r.y) % 7 ? 1 : 0));
  },
};

// ---------- 대청소 ----------
// Six bits of litter along the paths: walk onto each and it goes in the bag you then carry. With all six
// in it, bump the guild master and he takes the bag off you (30G).
const LITTER = 6;
const bagKey = (sc, n) => tex(sc, `day_trashbag${n >= 4 ? 1 : 0}`, () => trashBagCanvas(n >= 4));
function litterSpots(sc, rnd) {
  const out = [];
  const ok = (x, y) => sc.ch(x, y) === ':' && cheb({ x, y }, sc.p) >= 3 && out.every(o => cheb({ x, y }, o) >= 5);
  for (let k = 0; k < 30 && out.length < LITTER; k++) {
    const s = freeSpot(sc, out.length ? pick(out, rnd) : PLAZA, 14, rnd, ok) || freeSpot(sc, PLAZA, 18, rnd, ok);
    if (s) out.push(s);
  }
  return out.map((o, k) => [o.x, o.y, Math.floor(rnd() * LITTER_KINDS.length)]);
}
function pickLitter(sc, ev, th) {
  th.gone = true;
  const st = ev.st, b = ev.bits[th.k], ps = sc.ps;
  st.got.push(th.k);
  const n = st.got.length;
  sc.hooks.onSound?.('pop');
  face(sc, 'grit', 700);
  const x0 = b.img.x, y0 = b.img.y;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 300,
    onUpdate: tw => { const u = tw.getValue(), tx = ps.x, ty = ps.y - TILE - 4; b.img.setPosition(Math.round(x0 + (tx - x0) * u), Math.round(y0 + (ty - y0) * u - 10 * Math.sin(Math.PI * u))); },
    onComplete: () => { b.img.destroy(); carry(sc, bagKey(sc, n)); sc.tweens.add({ targets: ev.held, scaleX: 1.15, scaleY: 0.9, duration: 90, yoyo: true }); },
  });
  sc.hooks.onLife?.();
}
const cleanup = {
  place(sc, ev, rnd) {
    const st = ev.st;
    st.got ||= [];
    if (!st.bits || st.bits.some(([x, y]) => sc.blocked[y * MW + x])) { st.bits = litterSpots(sc, rnd); st.got = []; }
    ev.bits = st.bits.map(([x, y, v], k) => {
      if (st.got.includes(k)) return null;
      const kind = LITTER_KINDS[v];
      const img = sc.keep(sc.add.image(center(x) + ((x + y) % 3) - 1, foot(y) - 1, tex(sc, `day_litter_${kind}`, () => litterCanvas(kind))).setOrigin(0.5, 1).setDepth(D.actors + y / 100 - 0.001));
      addThing(ev, { x, y, k, onto: true, tip: ['빈 깡통: 누가 길에 버렸다.', '구겨진 종이: 길에 굴러다닌다.', '빈 병: 길가에 뒹굴고 있다.', '사과 심: 개미가 꼬였다.'][v], step: pickLitter });
      return { x, y, img };
    });
    if (st.got.length && !st.handed) carry(sc, bagKey(sc, st.got.length));
  },
  tick(sc, ev, time) {
    // the paper skitters along a pixel now and then
    const k = Math.floor(time / 500) % 5;
    for (const b of ev.bits || []) if (b?.img.active && b.img.texture.key === 'day_litter_paper') b.img.setX(center(b.x) + ((b.x + b.y) % 3) - 1 + (k === (b.x + b.y) % 5 ? 1 : 0));
    // the guild master sighs at the state of the paths
    if (!ev.t.done && time > (ev.sighAt || 0)) {
      ev.sighAt = time + 5000 + Math.random() * 4000;
      const boss = guildMaster(sc);
      if (boss && cheb(boss, sc.p) <= 7 && !boss.busy) setEmote(boss.s, '…', time, 1400);
    }
  },
  // the full bag to the guild master
  meet(sc, ev, who) {
    if (who.id !== 'guild' || ev.st.got.length < LITTER || ev.st.handed || !ev.held) return false;
    ev.st.handed = true;
    handOver(sc, who, () => {
      sayAs(sc, who, '길이 이렇게 깨끗해진 게 얼마 만인지. 고맙네, 받게.', 2200);
      sc.time.delayedCall(500, () => earn(sc, who.s.x, who.s.y - 20, 30));
      dayDone(sc, ev);
      sc.hooks.onLife?.();
    });
    return true;
  },
};

// ---------- 광장 연주회 ----------
// A friend from the meadow with a lute in the plaza, notes floating up, folk gathered round. Bump the
// friend and a coin (5G) goes in the hat, and they play an encore: a happy tune (sfx 'tune'), everyone
// dancing. Not a coin, not a note more.
const COIN = 5, NOTES = 8;
// where the listeners stand, from the player (the front, below, left open for you)
const CROWD = [[-2, 1], [2, 1], [-1, 3], [1, 3], [-3, 2]];
const CROWD_LINES = ['쉿, 듣는 중이야.', '이 곡 좋다.', '앙코르!', '♪'];
function stageFits(sc, x, y) {
  if (!openCell(sc, x, y) || !openCell(sc, x, y + 1)) return false;
  return N8.filter(([dx, dy]) => openCell(sc, x + dx, y + dy)).length >= 6 && !cuts(sc, [[x, y]]);
}
function gather(sc, ev) {
  const b = ev.band, room = 3 - ev.crowd.length;
  if (!b || room <= 0) return;
  const spots = CROWD.map(([dx, dy]) => ({ x: b.x + dx, y: b.y + dy })).filter(c => openCell(sc, c.x, c.y) && !sc.heroAt(c.x, c.y) && !ev.crowd.some(o => o.x === c.x && o.y === c.y)).slice(0, room);
  const who = freeFriends(sc, room, Math.max(0, 2 - ev.crowd.length), ['neighbor', 'rescue', 'carpenter', 'smith', 'rival']);
  spots.forEach((c, i) => who[i] && ev.crowd.push(settle(sc, who[i], c, b, false)));
}
// a note up from the lute, swaying, fading out
function noteTick(sc, ev, time, dt) {
  const b = ev.band, s = dt / 1000;
  if (!b) return;
  const every = ev.encore ? 180 : 650;
  if (time > (ev.noteAt || 0) && !sc.showing) {
    ev.noteAt = time + every + Math.random() * every * 0.6;
    const n = ev.notes.find(o => !o.live);
    if (n) { n.live = true; n.x = b.lute.x + (Math.random() - 0.5) * 6; n.y = b.lute.y - 8; n.t = 0; n.seed = Math.random() * 6.3; n.img.setVisible(true).setAlpha(1); }
  }
  for (const n of ev.notes) {
    if (!n.live) continue;
    n.t += s; n.y -= 22 * s;
    if (n.t > 1.5) { n.live = false; n.img.setVisible(false); continue; }
    n.img.setPosition(Math.round(n.x + Math.sin(n.t * 5 + n.seed) * 3), Math.round(n.y)).setAlpha(n.t < 1 ? 1 : 1.5 - n.t);
  }
}
function tossCoin(sc, ev) {
  const b = ev.band, ps = sc.ps;
  if (!b || ev.encore) return;
  if (!pay(sc, COIN)) { sc.say(b.s, '…', 700); return; }
  ev.encore = true;
  const coin = sc.keep(sc.add.image(ps.x, ps.y - 12, tex(sc, 'day_coin', coinCanvas)).setDepth(D.bubble - 0.2));
  const x0 = coin.x, y0 = coin.y, x1 = b.hat.x, y1 = b.hat.y - 3;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 420, ease: 'Quad.in',
    onUpdate: tw => { const u = tw.getValue(); coin.setPosition(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u - 16 * Math.sin(Math.PI * u))); },
    onComplete: () => { sc.spark.explode(5, coin.x, coin.y); coin.destroy(); encore(sc, ev); },
  });
}
function encore(sc, ev) {
  const b = ev.band;
  if (!b?.s.active) { ev.encore = false; return; }
  sayAs(sc, b.one, '고마워! 그럼 신나는 걸로 한 곡 더!', 1600);
  sc.time.delayedCall(900, () => {
    if (sc.day !== ev) return;
    sc.hooks.onSound?.('tune');
    const dancers = [sc.ps, ...ev.crowd.filter(o => o.s.active).map(o => o.s)];
    sc.tweens.add({ targets: b.s, hop: 5, duration: 150, yoyo: true, repeat: 9, ease: 'Quad.out' });
    setEmote(b.s, '♪', sc.time.now, 2400);
    dancers.forEach((s, i) => sc.time.delayedCall(200 + i * 180, () => {
      if (sc.day !== ev || !s.active) return;
      sc.tweens.add({ targets: s, hop: 4, duration: 170, yoyo: true, repeat: 5, ease: 'Quad.out' });
      for (let k = 1; k <= 3; k++) sc.time.delayedCall(k * 340, () => s.active && s.setFlipX(!s.flipX));
      setEmote(s, '♪', sc.time.now, 2000);
    }));
    face(sc, 'sparkle', 2400);
    sc.time.delayedCall(2600, () => {
      if (sc.day !== ev) return;
      ev.encore = false;
      dayDone(sc, ev);
      sc.hooks.onLife?.();
    });
  });
}
// the player at the stage with the lute, the hat on the ground in front, the listeners round them
function placeBand(sc, ev) {
  const [x, y] = ev.st.at, player = sc.heroes.find(h => !h.busy);
  if (!player) return;
  block(sc, [[x, y]]);
  const seat = settle(sc, player, { x, y }, { x, y: y + 2 }, false);
  const lute = sc.keep(sc.add.image(seat.s.x, seat.s.y, tex(sc, 'day_lute', luteCanvas)).setOrigin(0.5, 1).setDepth(seat.s.depth + 0.0005));
  const hat = sc.keep(sc.add.image(center(x), foot(y + 1), tex(sc, 'day_hat', hatCanvas)).setOrigin(0.5, 1).setDepth(D.deco + 0.45));
  ev.band = { ...seat, lute, hat, next: 0 };
  gather(sc, ev);
  addThing(ev, { x, y, act: tossCoin, tip: () => `${nameOf(ev.band.one)}: 광장에서 류트를 켜고 있다. 앞에 모자가 놓여 있다.` });
  addThing(ev, { x, y: y + 1, tip: '모자: 동전이 몇 닢 들어 있다.' });
}
const concert = {
  place(sc, ev, rnd) {
    const st = ev.st, fits = (x, y) => stageFits(sc, x, y);
    let at = st.at && fits(st.at[0], st.at[1]) ? { x: st.at[0], y: st.at[1] } : null;
    at ||= freeSpot(sc, PLAZA, 5, rnd, fits) || freeSpot(sc, PLAZA, 10, rnd, fits);
    ev.crowd = [];
    ev.notes = [];
    ev.band = null;
    if (!at) return;
    st.at = [at.x, at.y];
    for (let k = 0; k < NOTES; k++) ev.notes.push({ img: sc.keep(sc.add.image(0, 0, tex(sc, `day_note${k % 2}`, () => noteCanvas(k % 2))).setDepth(D.fx - 0.1).setVisible(false)), live: false, x: 0, y: 0, t: 0, seed: 0 });
    placeBand(sc, ev);
  },
  tick(sc, ev, time, dt) {
    const b = ev.band;
    if (!b) return;
    if (!b.s.active) {
      // the guild changed who is out today: whoever is free now takes the lute
      ev.band = null;
      b.lute.destroy(); b.hat.destroy();
      ev.things.forEach(th => { th.gone = true; });
      ev.crowd = [];
      placeBand(sc, ev);
      return;
    }
    const gone = ev.crowd.filter(o => !o.s.active);
    if (gone.length) { ev.crowd = ev.crowd.filter(o => o.s.active); gather(sc, ev); }
    // the player faces you when you are close, bounces in time, and the lute goes with them
    const s = b.s, d = cheb(b, sc.p);
    if (d <= 4 && sc.p.x !== b.x) s.setFlipX(sc.p.x < b.x);
    if (time > b.next && !ev.encore) { b.next = time + 1000 + Math.random() * 400; sc.tweens.add({ targets: s, hop: 3, duration: 140, yoyo: true, ease: 'Quad.out' }); }
    b.lute.setPosition(s.x + (s.flipX ? -5 : 5), s.y - 3 - (s.hop || 0)).setFlipX(s.flipX).setDepth(s.depth + 0.0005);
    noteTick(sc, ev, time, dt);
    for (const o of ev.crowd) if (o.s.active && cheb(o, sc.p) <= 2 && o.x !== sc.p.x) o.s.setFlipX(sc.p.x < o.x);
    if (time > (ev.chatAt || 0)) {
      ev.chatAt = time + 6000 + Math.random() * 5000;
      const o = pick(ev.crowd);
      if (o && cheb(o, sc.p) <= 6 && !sc.play && !ev.encore) sc.say(o.s, pick(CROWD_LINES), 1400);
    }
  },
  // the player: a coin in the hat; a friend in the crowd just chats (no swapping places today); a
  // villager in it talks as they always do
  meet(sc, ev, who) {
    if (ev.band && who === ev.band.one) { tossCoin(sc, ev); return true; }
    const o = ev.crowd?.find(q => q.one === who);
    if (!o || who.f) return false;
    sc.say(who.s, pick(CROWD_LINES), 1400);
    return true;
  },
  describe(sc, ev, x, y) {
    const o = ev.crowd?.find(q => q.x === x && q.y === y && q.s.active);
    return o ? `${nameOf(o.one)}: 연주를 듣고 있다.` : '';
  },
};

export const DAYS_C = { picnic, wind, bloom, cleanup, concert };
