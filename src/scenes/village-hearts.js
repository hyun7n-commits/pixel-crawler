// 친밀도 in the village (v0.30, data/affinity.js): what the folk and the friends do with how close you are,
// and with each other.
//   presents: picked in the talk sheet (main.js, ui/hearts.js), handed over here (giftTo): they turn to
//     you and say what they make of it, with a ♥ (and a little burst of hearts), a ♪ or a sweat drop
//   milestones: at 2 and 4 hearts they hand you something there and then; at 6, 8 and 10 they take you
//     somewhere and tell you something (data/affinity-people.js `steps`) while you walk along. A tap or
//     a key hurries the talking on. Each is a page in the 하트 chapter.
//   pairs: two who get on stop for a word when they come across each other (friends ambling about, a
//     villager on a stroll), and now and then one goes over to see the other; once their bond has grown
//     the village sees it (a walk together, time side by side, presents for each other: the 단짝 pages)
//   errands: what you were asked to take over is in your hand till you bump into whoever it is for

import { TILE, rowsCanvas } from './textures.js';
import { D } from './VillageScene.js';
import { setEmote } from './emotes.js';
import { face } from './village-secrets.js';
import { findIcon } from '../data/finds-art.js';
import { VILLAGE_MAP, HOME, BIG_TREE, doorOf, ownsHome, propCells } from '../data/village.js';
import { CHARACTERS } from '../data/characters.js';
import { friendSpot } from '../data/stages.js';
import { ITEM, itemName } from '../data/life.js';
import { WEAR } from '../data/wear.js';
import { josa } from '../core/util.js';
import {
  PAIRS, pairsOf, milestoneOf, dueMilestone, doneMilestone, heartId, pairId, dueBond, doneBond, meetToday, metToday,
  takePresent, doneErrand, ERRAND_ITEMS,
} from '../data/affinity.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const tex = (sc, key, make) => { if (!sc.textures.exists(key)) sc.textures.addCanvas(key, make()); return key; };
const iconKey = (sc, [shape, pal]) => tex(sc, `kin_${shape}_${pal}`, () => rowsCanvas(findIcon(shape, pal)));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const pick = l => l[Math.floor(Math.random() * l.length)];
// how long a line stays up (and the talk waits on it)
const sayMs = text => Math.min(3600, 1100 + text.length * 70);
const STEP_MS = { folk: 320, hero: 270 };
// a mark over someone's head shows this long before their bubble covers it
const SAY_AFTER = 650;
const HEART = ['.kk.kk.', 'kqekeek', 'keeeeek', '.keeek.', '..kek..', '...k...'];

// ---------- putting it out ----------
export function placeVillageHearts(sc) {
  // scene: a milestone being shown (you walk along; taps hurry it) · pair: two of them showing their bond
  // · meet: two of them stopping for a word · away: villagers off their doorstep, to be walked back
  // · talk: the one you just bumped into, theirs till their sheet is up
  sc.ties = {
    scene: null, pair: null, meet: null, after: null, afterWho: new Set(), carry: null, away: new Set(), talk: null, talkUntil: 0,
    pairAt: sc.time.now + 6000 + Math.random() * 4000, nearAt: 0,
  };
}

// who is who in the village now: a villager (once they are out of their door), or a friend in the meadow
// (never the one you are today)
export function actorOf(sc, who) {
  return sc.folk?.find(f => f.id === who && f.s.alpha >= 1) || sc.heroes?.find(h => h.id === who) || null;
}
const free = (sc, one) => !!one && !one.busy && one !== sc.pending && one.s?.active && one.s.visible && one.s.alpha >= 1;
// (the one you just bumped into is yours till their sheet is up)
const talking = (sc, one) => one === sc.ties.talk && sc.time.now < sc.ties.talkUntil;
// free, or only on their way back from the last thing (they stop where they are)
function freeNow(sc, one) {
  if (one?.homing) { one.homing = false; one.busy = false; sc.ties.away.add(one); }
  return free(sc, one);
}
const isHero = (sc, one) => sc.heroes.includes(one);

// ---------- walking someone about ----------
// a tile `one` may step on (never the burrow out: that is for you)
function open(sc, x, y, one) {
  if (x < 0 || y < 0 || x >= MW || y >= MH || sc.blocked[y * MW + x] || sc.ch(x, y) === '>') return false;
  const there = sc.folkAt(x, y) || sc.heroAt(x, y) || sc.pupAt(x, y);
  return (!there || there === one) && !(sc.p.x === x && sc.p.y === y);
}
// the shortest way for `one` to (tx, ty), or to a tile beside it (`beside`); null when there is none
function wayFor(sc, one, tx, ty, beside) {
  const at = (x, y) => (beside ? Math.max(Math.abs(x - tx), Math.abs(y - ty)) === 1 : x === tx && y === ty);
  if (at(one.x, one.y)) return [];
  const start = one.y * MW + one.x, prev = new Map([[start, -1]]), q = [start];
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0;
    if (at(x, y)) {
      const out = [];
      for (let j = i; j !== start; j = prev.get(j)) out.unshift([j % MW, (j / MW) | 0]);
      return out;
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, j = ny * MW + nx;
      if (prev.has(j) || !open(sc, nx, ny, one) || !sc.canCut(x, y, dx, dy)) continue;
      prev.set(j, i);
      q.push(j);
    }
  }
  return null;
}
function stepTo(sc, one, x, y, ms) {
  const s = one.s, hero = isHero(sc, one) && CHARACTERS[one.id];
  if (x !== one.x) s.setFlipX(x < one.x);
  one.x = x; one.y = y;
  if (hero) s.setTexture(`${hero.sprite}_walk${(one.k = (one.k || 0) + 1) % 2 + 1}`);
  sc.tweens.add({ targets: s, x: center(x), y: foot(y), duration: ms, onComplete: () => { if (hero && s.scene && s !== sc.ps && one.s === s) s.setTexture(hero.sprite); } });
  sc.tweens.add({ targets: s, hop: 2, duration: ms / 2, yoyo: true, ease: 'Quad.out' });
  s.setDepth(D.actors + y / 100);
}
// walks `one` there a tile at a time, going round anyone who steps into the way; `done(ok)`.
// `then(one, x0, y0)` after each step (whoever is coming along behind); it stops as soon as `live()` is not
function walk(sc, one, tx, ty, beside, done, then = null, live = null, tries = 0) {
  const id = one.id, gone = () => one.id !== id || !one.s.active || (live && !live());
  const way = wayFor(sc, one, tx, ty, beside);
  if (!way) {
    if (tries < 5) sc.time.delayedCall(450, () => (gone() ? done(false) : walk(sc, one, tx, ty, beside, done, then, live, tries + 1)));
    else done(false);
    return;
  }
  const ms = isHero(sc, one) ? STEP_MS.hero : STEP_MS.folk;
  const next = k => {
    if (gone()) { done(false); return; }
    if (k >= way.length) { done(true); return; }
    const [x, y] = way[k];
    if (!open(sc, x, y, one)) { walk(sc, one, tx, ty, beside, done, then, live, tries + 1); return; }
    const x0 = one.x, y0 = one.y;
    stepTo(sc, one, x, y, ms - 30);
    then?.(one, x0, y0);
    sc.time.delayedCall(ms, () => next(k + 1));
  };
  next(0);
}
const faceTo = (one, x) => { if (x !== one.x) one.s.setFlipX(x < one.x); };
// taken from what they were doing (a villager at their door, one on their stroll, a friend in the meadow)
// and, when it is over, walked back there
function hold(...ones) {
  for (const one of ones) {
    one.busy = true;
    if (!one.back) one.back = { x: one.x, y: one.y, id: one.id };
  }
}
function release(sc, ...ones) {
  for (const one of ones) {
    if (!one?.s.active) continue;
    one.busy = false;
    one.s.sy = 1;
    one.next = sc.time.now + 1500;
    if (one.back && (one.x !== one.back.x || one.y !== one.back.y)) sc.ties.away.add(one);
    else one.back = null;
  }
}
function homeward(sc) {
  const T = sc.ties;
  for (const one of T.away) {
    if (!free(sc, one)) continue;
    const b = one.back;
    T.away.delete(one);
    // (a friend who has become you since, or one already there)
    if (!b || b.id !== one.id || (one.x === b.x && one.y === b.y)) { one.back = null; continue; }
    one.busy = one.homing = true;
    walk(sc, one, b.x, b.y, false, ok => {
      // (taken for something else on the way: freeNow)
      if (!one.homing) return;
      one.busy = one.homing = false;
      if (ok) { one.back = null; one.s.setFlipX(false); } else T.away.add(one);
    }, null, () => one.homing);
    return;
  }
}

// ---------- places ----------
// A tile to stand on at a place in the village (null when that place is not there yet):
//   door / cottage: their own (a friend's is the cottage of their stage) · home: your door · a villager's
//   house by its id · burrow: beside the way out · pond · flowers · plaza · bigtree · one of the
//   village's buildings (gazebo, inn, tower...) or props (board, well, bench, fountain, statue...)
function spotOf(sc, one, name) {
  const near = (x, y) => freeNear(sc, one, x, y);
  switch (name) {
    case 'door': return one.house ? near(doorOf(one.house).x, doorOf(one.house).y) : spotOf(sc, one, 'cottage');
    case 'cottage': {
      const s = friendSpot(one.id)?.stage, b = s != null && sc.buildings.find(o => o.id === `cot${s}`);
      return b ? near(doorOf(b).x, doorOf(b).y) : null;
    }
    case 'home': return ownsHome(sc.meta) ? near(doorOf(HOME).x, doorOf(HOME).y) : null;
    case 'burrow': {
      const y = VILLAGE_MAP.findIndex(r => r.includes('>'));
      return near(VILLAGE_MAP[y].indexOf('>') - 1, y);
    }
    case 'bigtree': return sc.bigTree ? near(BIG_TREE.x, BIG_TREE.y + 1) : null;
    case 'plaza': return near(30, 23);
    case 'pond': {
      const banks = (sc.pondTiles || []).flatMap(t => DIRS.map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy }))).filter(c => open(sc, c.x, c.y, one));
      return closest(one, banks);
    }
    case 'flowers': {
      const beds = [];
      for (let y = 12; y < 34; y++) for (let x = 10; x < 50; x++) if (sc.ch(x, y) === '*' && open(sc, x, y, one) && !sc.isNew(x, y)) beds.push({ x, y });
      return closest(one, beds);
    }
    default: {
      const h = sc.folk?.find(f => f.id === name)?.house;
      if (h) return near(doorOf(h).x, doorOf(h).y);
      const b = sc.buildings.find(o => o.id === name);
      if (b) return near(doorOf(b).x, doorOf(b).y);
      const props = sc.props.filter(o => o.pr.kind === name && o.imgs[0]?.visible !== false);
      const cells = props.flatMap(o => propCells(o.pr).flatMap(([i, j]) => DIRS.map(([dx, dy]) => ({ x: o.pr.x + i + dx, y: o.pr.y + j + dy }))));
      // in front of it (below) if there is room there
      const fronts = cells.filter(c => open(sc, c.x, c.y, one));
      return closest(one, fronts.filter(c => props.some(o => c.y === o.pr.y + Math.max(...propCells(o.pr).map(q => q[1])) + 1))) || closest(one, fronts);
    }
  }
}
function closest(one, list) {
  let best = null, bd = 1e9;
  for (const c of list) { const d = Math.hypot(c.x - one.x, c.y - one.y); if (d < bd) { bd = d; best = c; } }
  return best;
}
// a free tile at or round (x, y), the nearest first
function freeNear(sc, one, x, y) {
  for (let r = 0; r <= 4; r++) {
    const ring = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && open(sc, x + dx, y + dy, one)) ring.push({ x: x + dx, y: y + dy });
    if (ring.length) return closest({ x, y }, ring);
  }
  return null;
}

// ---------- a little burst of hearts ----------
function burst(sc, x, y, n = 7) {
  if (!sc.heartFx?.scene) {
    tex(sc, 'kin_heart', () => rowsCanvas(HEART));
    sc.heartFx = sc.add.particles(0, 0, 'kin_heart', {
      emitting: false, lifespan: { min: 750, max: 1150 }, speedX: { min: -22, max: 22 }, speedY: { min: -44, max: -20 },
      gravityY: 26, scale: { start: 0.9, end: 0.6 }, alpha: { start: 1, end: 0 },
    }).setDepth(D.bubble - 0.4);
  }
  sc.heartFx.explode(n, x, y);
}
// something small going from one to another in a little arc; `done` when it gets there
function toss(sc, key, from, to, done) {
  const img = sc.keep(sc.add.image(from.x, from.y - 12, key).setDepth(D.bubble - 0.5));
  const x0 = img.x, y0 = img.y;
  sc.tweens.addCounter({
    from: 0, to: 1, duration: 520,
    onUpdate: tw => { const u = tw.getValue(); img.setPosition(Math.round(x0 + (to.x - x0) * u), Math.round(y0 + (to.y - 12 - y0) * u - 12 * Math.sin(Math.PI * u))); },
    onComplete: () => { img.destroy(); done?.(); },
  });
}

// ---------- presents ----------
// they hand you what the milestone gives; it goes where it belongs, and the tip line says what it was
function handOver(sc, one, g) {
  if (!g) return;
  const meta = sc.meta;
  const key = g.item ? iconKey(sc, ITEM[g.item].pic.find) : g.seed ? iconKey(sc, ['seed', 'n']) : g.gold ? iconKey(sc, ['coin', 'Y'])
    : g.wear ? tex(sc, `kin_wear_${g.wear}`, () => rowsCanvas(WEAR[g.wear].art)) : null;
  const land = () => {
    let said = '';
    if (g.item) { sc.hooks.onCatch?.(g.item, g.n || 1); said = `${itemName(g.item)} ${g.n || 1}개를 받았다.`; }
    if (g.seed) { takePresent(meta, { seed: g.seed, n: g.n }); said = `${itemName(`seed:${g.seed}`)} ${g.n || 1}알을 받았다.`; }
    if (g.gold) { sc.hooks.onGold?.(g.gold); said = `${g.gold}G를 받았다.`; }
    if (g.wear) {
      const w = WEAR[g.wear];
      takePresent(meta, { wear: g.wear });
      if (!meta.wear?.[w.slot]) meta.wear = { ...meta.wear, [w.slot]: g.wear };
      said = `${josa(w.name, '을', '를')} 받았다.`;
    }
    if (g.cut) said = '이제 씨앗을 단골 가격에 산다.';
    if (g.sell) said = '이제 파는 물건을 조금 더 쳐 준다.';
    sc.hooks.onLife?.();
    sc.hooks.onSound?.('find');
    face(sc, 'sparkle', 1000);
    if (said) sc.hooks.onHover?.(said, true);
  };
  if (key) toss(sc, key, one.s, sc.ps, land);
  else land();
}

// A present from the basket (main.js, after the talk sheet): `res` is data/affinity.js give's
export function giftTo(sc, who, res) {
  const one = actorOf(sc, who);
  if (!one || !sc.ties) return;
  const now = sc.time.now, s = one.s;
  faceTo(one, sc.p.x);
  // how they take it shows first (a bubble would hide it), then what they say
  sc.time.delayedCall(SAY_AFTER, () => s.active && sc.say(s, res.line, sayMs(res.line)));
  if (res.taste === 'love') {
    setEmote(s, '♥', now, 1700);
    burst(sc, s.x, s.y - 14);
    sc.tweens.add({ targets: s, hop: 6, duration: 140, yoyo: true, repeat: 1, ease: 'Quad.out' });
    sc.hooks.onSound?.('tune');
  } else if (res.taste === 'like') {
    setEmote(s, '♪', now, 1400);
    sc.tweens.add({ targets: s, hop: 4, duration: 120, yoyo: true, ease: 'Quad.out' });
    sc.hooks.onSound?.('pop');
  } else if (res.taste === 'hate') {
    setEmote(s, 'sweat', now, 1500);
    sc.tweens.add({ targets: s, sx: 1.1, sy: 0.9, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.out' });
    sc.hooks.onSound?.('squeak');
  } else sc.hooks.onSound?.('talk');
  heartsAfter(sc, [who], SAY_AFTER + sayMs(res.line) + 200);
}

// After a chat, a present or an errand: the next milestone (or a pair's) if one is due, shown now
export function heartsAfter(sc, whos, delay = 350) {
  const T = sc.ties;
  if (!T || T.scene) return;
  for (const who of whos) T.afterWho.add(who);
  if (T.after) return;
  T.after = sc.time.delayedCall(delay, () => {
    T.after = null;
    whos = [...T.afterWho];
    T.afterWho.clear();
    // (with a sheet up it waits for the next chat)
    if (T.scene || sc.play || sc.fishing || sc.showing || !sc.ps || sc.ps.diving || sc.hooks.sheetUp?.()) return;
    for (const who of whos) { const n = dueMilestone(sc.meta, who); if (n && heartScene(sc, who, n)) return; }
    for (const who of whos) for (const p of pairsOf(who)) if (dueBond(sc.meta, p.key) && pairScene(sc, p)) return;
  });
}

// ---------- a milestone ----------
function heartScene(sc, who, n) {
  const T = sc.ties, m = milestoneOf(who, n), one = actorOf(sc, who);
  if (!m || T.pair?.a === one || T.pair?.b === one || !freeNow(sc, one)) return false;
  const steps = m.steps || [['hop'], ['say', m.say], ['give'], ['emote', '♥']];
  const sn = { who, n, one, m, given: false, timer: null, go: null };
  T.scene = sn;
  hold(one);
  sc.path = [];
  sc.pending = null;
  faceTo(one, sc.p.x);
  let k = 0;
  const next = () => {
    if (T.scene !== sn) return;
    sn.timer = null;
    sn.go = null;
    if (k >= steps.length) { endScene(sc, sn); return; }
    const [kind, arg] = steps[k++];
    const wait = ms => { sn.go = next; sn.timer = sc.time.delayedCall(ms, next); };
    const now = sc.time.now, s = one.s;
    switch (kind) {
      case 'go': {
        const spot = arg.split('|').map(name => spotOf(sc, one, name)).find(Boolean);
        if (!spot || (one.x === spot.x && one.y === spot.y)) { wait(0); return; }
        // you come along a step behind
        walk(sc, one, spot.x, spot.y, false, () => {
          if (T.scene !== sn) return;
          faceTo(one, sc.p.x);
          wait(350);
        }, (o, x0, y0) => { if (T.scene === sn && (sc.p.x !== x0 || sc.p.y !== y0)) { sc.pending = null; sc.path = sc.route(x0, y0); } }, () => T.scene === sn);
        return;
      }
      case 'say': faceTo(one, sc.p.x); sc.say(s, arg, sayMs(arg)); wait(sayMs(arg) - 150); return;
      case 'emote': setEmote(s, arg, now, 1400); wait(800); return;
      case 'me': if (arg === 'sparkle') face(sc, 'sparkle', 1300); else setEmote(sc.ps, arg, now, 1300); wait(800); return;
      case 'hop': sc.tweens.add({ targets: s, hop: 7, duration: 160, yoyo: true, ease: 'Quad.out' }); sc.hooks.onSound?.('pop'); wait(500); return;
      case 'spark': sc.spark.explode(14, s.x, s.y - 12); sc.hooks.onSound?.('bell'); wait(600); return;
      case 'give': sn.given = true; handOver(sc, one, m.give); wait(1000); return;
      case 'wait': wait(arg); return;
      default: wait(0);
    }
  };
  // the first step after a breath, so the talk sheet is gone and the bubble you just had has been read
  sn.go = next;
  sn.timer = sc.time.delayedCall(250, next);
  return true;
}
function endScene(sc, sn) {
  const T = sc.ties, meta = sc.meta;
  if (!sn.given && sn.m.give) handOver(sc, sn.one, sn.m.give);
  doneMilestone(meta, sn.who, sn.n);
  sc.hooks.onLife?.();
  sc.hooks.onEntry?.(heartId(sn.who, sn.n));
  T.scene = null;
  release(sc, sn.one);
  // another one due already (a big present can be worth two)
  heartsAfter(sc, [sn.who], 900);
}
// A tap or a key while a milestone is on: the talking hurries on (true: it took the tap; a key held
// down does not hurry it)
export function heartsTap(sc, held = false) {
  const sn = sc.ties?.scene;
  if (!sn) return false;
  if (!held && sn.timer && sn.go) { const go = sn.go; sn.timer.remove(false); sn.timer = null; sn.go = null; go(); }
  return true;
}

// ---------- pairs ----------
// two who get on, by each other: a word each; one more for their bond today
function chatPair(sc, p, A, B, visit) {
  const T = sc.ties, meet = { p, a: A, b: B };
  T.meet = meet;
  hold(A, B);
  const [guest, host] = Math.random() < 0.5 ? [A, B] : [B, A];
  // still theirs (one of them gone, as when the friends are placed anew: it is dropped)
  const on = () => {
    if (T.meet !== meet) return false;
    if (A.s.active && B.s.active) return true;
    T.meet = null;
    release(sc, A, B);
    return false;
  };
  const talk = () => {
    if (!on()) return;
    faceTo(A, B.x); faceTo(B, A.x);
    const [la, lb] = pick(p.chat);
    sc.say(A.s, la, sayMs(la));
    sc.time.delayedCall(sayMs(la) - 300, () => {
      if (!on()) return;
      sc.say(B.s, lb, sayMs(lb));
      sc.time.delayedCall(sayMs(lb), () => {
        if (!on()) return;
        setEmote(Math.random() < 0.5 ? A.s : B.s, Math.random() < 0.5 ? '♪' : '♥', sc.time.now, 1200);
        if (meetToday(sc.meta, p.key)) sc.hooks.onLife?.();
        sc.time.delayedCall(900, () => {
          if (!on()) return;
          T.meet = null;
          release(sc, A, B);
        });
      });
    });
  };
  if (!visit) { talk(); return; }
  walk(sc, guest, host.x, host.y, true, ok => {
    if (!on()) return;
    if (ok) { talk(); return; }
    T.meet = null;
    release(sc, A, B);
  }, null, () => T.meet === meet);
}

// What their bond has come to, for you to see: the one nearer you stays, the other comes over; then
// 1 they walk off together somewhere, 2 they spend a while side by side, 3 they give each other something
function pairScene(sc, p) {
  const T = sc.ties, n = dueBond(sc.meta, p.key), lv = p.lv[n - 1];
  const A = actorOf(sc, p.a), B = actorOf(sc, p.b);
  if (!lv || T.pair || T.meet || !freeNow(sc, A) || !freeNow(sc, B)) return false;
  const [host, guest] = cheb(A, sc.p) <= cheb(B, sc.p) ? [A, B] : [B, A];
  const ps = { p, n, a: A, b: B };
  T.pair = ps;
  hold(A, B);
  // still theirs (one of them gone, as when the friends are placed anew: it is dropped)
  const alive = () => {
    if (T.pair !== ps) return false;
    if (A.s.active && B.s.active) return true;
    T.pair = null;
    release(sc, A, B);
    return false;
  };
  const end = () => {
    if (T.pair !== ps) return;
    doneBond(sc.meta, p.key, n);
    sc.hooks.onLife?.();
    sc.hooks.onEntry?.(pairId(p.key, n));
    T.pair = null;
    release(sc, A, B);
  };
  // their lines one after another, and a ♪ or a ♥ once the last bubble has gone
  const talk = (lines, done) => {
    let k = 0, last = null;
    const one = () => {
      if (!alive()) return;
      if (k >= lines.length) {
        if (!last) { done(); return; }
        setEmote(last.s, n === 1 ? '♪' : '♥', sc.time.now, 1200);
        sc.time.delayedCall(900, () => alive() && done());
        return;
      }
      const [who, text] = lines[k++], s = who === 'a' ? A : B, o = s === A ? B : A;
      faceTo(s, o.x); faceTo(o, s.x);
      sc.say(s.s, text, sayMs(text));
      last = o;
      sc.time.delayedCall(sayMs(text) - (k === lines.length ? 0 : 200), one);
    };
    one();
  };
  walk(sc, guest, host.x, host.y, true, ok => {
    if (!alive()) return;
    if (!ok) { T.pair = null; release(sc, A, B); return; }
    if (n === 1) {
      // off they go, side by side: the one who came leads, the other a step behind
      const spot = p.at.split('|').map(name => spotOf(sc, guest, name)).find(Boolean);
      talk(lv.says.slice(0, 2), () => {
        if (!spot) { talk(lv.says.slice(2), end); return; }
        walk(sc, guest, spot.x, spot.y, false, () => alive() && talk(lv.says.slice(2), end), (o, x0, y0) => {
          if (alive() && open(sc, x0, y0, host) && cheb(host, { x: x0, y: y0 }) === 1) stepTo(sc, host, x0, y0, (isHero(sc, host) ? STEP_MS.hero : STEP_MS.folk) - 30);
        }, alive);
      });
    } else if (n === 2) {
      // a while side by side, settled down
      A.s.sy = B.s.sy = 0.9;
      talk(lv.says, () => { setEmote(A.s, '♥', sc.time.now, 1400); setEmote(B.s, '♥', sc.time.now, 1400); sc.time.delayedCall(1400, end); });
    } else {
      // presents for each other
      const [ga, gb] = lv.swap;
      talk(lv.says.slice(0, 1), () => {
        if (!alive()) return;
        toss(sc, iconKey(sc, ga), A.s, B.s);
        toss(sc, iconKey(sc, gb), B.s, A.s, () => { burst(sc, (A.s.x + B.s.x) / 2, Math.min(A.s.y, B.s.y) - 14, 9); sc.hooks.onSound?.('tune'); });
        sc.time.delayedCall(700, () => alive() && talk(lv.says.slice(1), () => sc.time.delayedCall(600, end)));
      });
    }
  });
  return true;
}

// the bonds' goings-on, every frame: two who get on and happen to be close stop for a word; now and
// then one goes over to see the other, or (when their bond has grown and you are near) shows it
function pairTick(sc, time) {
  const T = sc.ties, meta = sc.meta;
  // (nobody wanders off while you are talking to them)
  if (T.scene || T.pair || T.meet || sc.showing || sc.play || sc.fishing || sc.hooks.sheetUp?.()) return;
  const here = [];
  for (const p of PAIRS) {
    const A = actorOf(sc, p.a), B = actorOf(sc, p.b);
    if (free(sc, A) && free(sc, B) && !talking(sc, A) && !talking(sc, B)) here.push({ p, A, B });
  }
  if (time > T.nearAt) {
    T.nearAt = time + 500;
    const close = here.find(o => cheb(o.A, o.B) <= 2 && !metToday(meta, o.p.key));
    if (close) { chatPair(sc, close.p, close.A, close.B, false); return; }
  }
  if (time < T.pairAt) { homeward(sc); return; }
  T.pairAt = time + 12000 + Math.random() * 10000;
  const near = o => Math.min(cheb(o.A, sc.p), cheb(o.B, sc.p));
  const due = here.filter(o => dueBond(meta, o.p.key) && near(o) <= 8).sort((a, b) => near(a) - near(b))[0];
  if (due && pairScene(sc, due.p)) return;
  const todo = here.filter(o => !metToday(meta, o.p.key));
  const o = todo.length ? pick(todo) : here.length && Math.random() < 0.35 ? pick(here) : null;
  if (o) chatPair(sc, o.p, o.A, o.B, true);
}

// ---------- errands ----------
// bumping into whoever the thing in your hand is for: over it goes (true: the bump was this)
export function heartsMeet(sc, who) {
  const T = sc.ties;
  if (!T) return false;
  // one of two who were busy with each other: they leave it for later and see to you
  for (const k of ['meet', 'pair']) {
    const o = T[k];
    if (o && (o.a === who || o.b === who)) { T[k] = null; release(sc, o.a, o.b); T.nearAt = sc.time.now + 6000; }
  }
  T.talk = who;
  T.talkUntil = sc.time.now + 2000;
  const e = sc.meta.errand;
  if (!e || who.id !== e.to || T.scene) return false;
  const done = doneErrand(sc.meta), it = ERRAND_ITEMS[done.what];
  sc.hooks.onLife?.();
  T.carry?.destroy();
  T.carry = null;
  faceTo(who, sc.p.x);
  toss(sc, iconKey(sc, it.pic), sc.ps, who.s, () => {
    setEmote(who.s, '♥', sc.time.now, 1600);
    burst(sc, who.s.x, who.s.y - 14, 5);
    sc.hooks.onSound?.('letter');
    sc.time.delayedCall(SAY_AFTER, () => who.s.active && sc.say(who.s, done.thanks, sayMs(done.thanks)));
    heartsAfter(sc, [who.id], SAY_AFTER + sayMs(done.thanks) + 200);
  });
  return true;
}
// what you are carrying, in your hand as you go
function carryTick(sc) {
  const T = sc.ties, e = sc.meta.errand, ps = sc.ps;
  if (e && !T.carry) T.carry = sc.keep(sc.add.image(0, 0, iconKey(sc, ERRAND_ITEMS[e.what].pic)).setOrigin(0.5, 1));
  if (!e && T.carry) { T.carry.destroy(); T.carry = null; }
  if (!T.carry) return;
  T.carry.setPosition(Math.round(ps.x + (ps.flipX ? -6 : 6)), Math.round(ps.y - 2 - (ps.hop || 0))).setDepth(ps.depth + 0.001).setVisible(!ps.diving && ps.visible && ps.alpha > 0.5);
}

// ---------- every frame ----------
export function heartsTick(sc, time) {
  if (!sc.ties || !sc.ps) return;
  carryTick(sc);
  pairTick(sc, time);
}
