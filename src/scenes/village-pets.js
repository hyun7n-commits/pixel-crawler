// 펫 round the village (v0.30, data/pets.js): the one you take along (데려가기 at the shop, meta.pet)
// trots after you from the moment you pick it: a tile behind, along the way you came, hurrying when you
// get ahead and popping up at your heels when you are clean out of sight, fidgeting in its own way when
// you stop and dozing off if you stand about. In at your door with you and out again; down the burrow
// with you to the fields (core/run.js takes it from there). It is company, not a thing in the way: it
// never blocks a path, hops aside when you turn back onto it, and never stands on anyone. Bump it (or
// tap it while it is beside you) and it is pleased. Stand still near the sparrows and it may not be able
// to help itself. What it does at home: scenes/home-pets.js; what it is like: scenes/pet-acts.js.

import { TILE } from './textures.js';
import { D } from './VillageScene.js';
import { setEmote, drawEmote } from './emotes.js';
import { PETS } from '../data/pets.js';
import { VILLAGE_MAP, HOME, doorOf } from '../data/village.js';
import { flies, hover, petPose, breath, petIdle, petReact, petDoze, petWake, petShadow } from './pet-acts.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const STEP_MS = 140, HURRY_MS = 80, CHASE_MS = 95;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// the pet that comes along today (none when it was left at home)
const chosen = meta => (meta.pet && meta.pets?.[meta.pet] && PETS[meta.pet] ? meta.pet : null);
// a tile the pet may stand on: open ground with nobody on it (and not the burrow's mouth)
const free = (sc, x, y) => sc.walkable(x, y) && sc.ch(x, y) !== '>';
// the free tile nearest `c` among the eight round it, the ones in `prefer` first
function spotBy(sc, c, prefer = []) {
  for (const [dx, dy] of [...prefer, ...DIRS]) if (free(sc, c.x + dx, c.y + dy)) return { x: c.x + dx, y: c.y + dy };
  return null;
}

// ---------- coming out ----------
export function placeVillagePets(sc) {
  sc.pet = null;
  sc.petShade = sc.keep(sc.add.graphics().setDepth(D.actors - 0.5));
  const id = chosen(sc.meta);
  if (id) summon(sc, id, true);
}
// the pet turns up at your heels: a free tile behind you (or where you stand, and it hops off)
function summon(sc, id, quiet) {
  const p = sc.p, back = sc.ps.flipX ? 1 : -1;
  const at = spotBy(sc, p, [[back, 0], [back, 1], [back, -1], [0, 1], [0, -1]]) || { x: p.x, y: p.y };
  const s = sc.keep(sc.add.image(center(at.x), foot(at.y), PETS[id].sprite).setOrigin(0.5, 1).setFlipX(sc.ps.flipX));
  s.hop = 0;
  sc.pet = { id, x: at.x, y: at.y, s, fx: s.x, fy: s.y, trail: [], next: 0, moving: 0, idleAt: sc.time.now + 1500, still: 0, fly: flies(id), seed: Math.random() * 6 };
  if (quiet) return;
  s.setAlpha(0);
  sc.tweens.add({ targets: s, alpha: 1, duration: 250 });
  sc.spark.explode(8, s.x, s.y - 6);
  setEmote(s, '♪', sc.time.now, 1000);
}
// 데려가기 at the shop (main.js resync): the pet changes on the spot, or goes home, or comes out
export function syncVillagePet(sc) {
  if (!sc.ps) return;
  const id = chosen(sc.meta);
  if (sc.pet?.id === id) return;
  if (sc.pet) {
    const s = sc.pet.s;
    sc.tweens.add({ targets: s, alpha: 0, duration: 200, onComplete: () => s.destroy() });
    sc.pet = null;
  }
  if (id) summon(sc, id, false);
}
// back out of your front door (VillageScene outOfHome): it comes out after you onto the step
export function petOutOfHome(sc) {
  syncVillagePet(sc);
  const pet = sc.pet;
  if (!pet) return;
  const door = doorOf(HOME), at = spotBy(sc, door, [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1]]) || door;
  settle(sc, pet, at);
  pet.in = false;
  pet.s.setAlpha(0);
  sc.tweens.add({ targets: pet.s, alpha: 1, duration: 220, delay: 180 });
}
// straight onto a tile, no walk
function settle(sc, pet, at) {
  pet.x = at.x; pet.y = at.y;
  pet.fx = center(at.x); pet.fy = foot(at.y);
  pet.trail = [];
  pet.chase = null;
}

// ---------- following ----------
// you are leaving a tile (VillageScene moveTo): the pet remembers the way you went
export function petStepOff(sc, x, y) {
  const pet = sc.pet;
  if (!pet) return;
  pet.trail.push({ x, y });
  if (pet.trail.length > 10) pet.trail.shift();
  pet.chase = null;
  petWake(sc, pet);
}
// one tile on: along the way you came when that leads on, else straight after you (or after a sparrow)
function stepOn(sc, pet, time) {
  const p = sc.p, d = cheb(pet, p);
  const goal = pet.chase ? pet.chase.b : p;
  // the way you came: tiles further from you than the pet already is are no use any more, nor the
  // next one when someone has strolled onto it
  const open = c => free(sc, c.x, c.y) && sc.canCut(pet.x, pet.y, c.x - pet.x, c.y - pet.y);
  if (!pet.chase) {
    while (pet.trail.length) {
      const c = pet.trail[0];
      if ((c.x === pet.x && c.y === pet.y) || cheb(c, p) > d || (cheb(c, pet) <= 1 && !open(c))) { pet.trail.shift(); continue; }
      break;
    }
  }
  const t = pet.trail[0], aim = !pet.chase && t ? t : goal;
  let to = null;
  if (!pet.chase && t && cheb(t, pet) <= 1) { to = t; pet.trail.shift(); }
  else {
    const dist = o => Math.hypot(o.x - aim.x, o.y - aim.y);
    let best = dist(pet);
    for (const [dx, dy] of DIRS) {
      const x = pet.x + dx, y = pet.y + dy, c = { x, y };
      if (cheb(c, p) === 0 && !pet.chase) continue;
      if (!free(sc, x, y) || !sc.canCut(pet.x, pet.y, dx, dy) || dist(c) >= best) continue;
      best = dist(c); to = c;
    }
  }
  if (!to) {
    // boxed in: after a while it turns up at your heels anyway
    pet.stuck = (pet.stuck || 0) + 1;
    if (pet.stuck > 8 && !pet.chase) popBeside(sc, pet);
    return;
  }
  pet.stuck = 0;
  if (to.x !== pet.x) pet.s.setFlipX(to.x < pet.x);
  pet.x = to.x; pet.y = to.y;
  pet.moving = time + STEP_MS;
  pet.next = time + (pet.chase ? CHASE_MS : pet.trail.length > 3 ? HURRY_MS : STEP_MS);
}
// out of sight (a swap, the balloon, the race's end): it comes running up from just behind you
function popBeside(sc, pet) {
  const back = sc.ps.flipX ? 1 : -1, at = spotBy(sc, sc.p, [[back, 0], [back, 1], [back, -1]]);
  if (!at) return;
  settle(sc, pet, at);
  pet.stuck = 0;
  pet.s.setAlpha(0);
  sc.tweens.add({ targets: pet.s, alpha: 1, duration: 200 });
  sc.dust.explode(4, pet.fx, pet.fy - 1);
}
// you turned back onto its tile: it hops out from under your feet
function aside(sc, pet, time) {
  const back = sc.ps.flipX ? 1 : -1, at = spotBy(sc, sc.p, [[back, 0], [back, 1], [back, -1], [0, 1], [0, -1]]);
  if (!at) return;
  pet.x = at.x; pet.y = at.y;
  pet.trail = [];
  pet.moving = time + STEP_MS;
  pet.next = time + STEP_MS;
  sc.tweens.add({ targets: pet.s, hop: 3, duration: 100, yoyo: true, ease: 'Quad.out' });
}

// ---------- the sparrows ----------
// 비밀: stand still with it beside you near a sparrow, and it goes for the bird (which is off, of
// course), then comes back as if nothing happened
function wantChase(sc, pet, time) {
  if (pet.still < 2500 || pet.asleep || pet.chase || time < (pet.chaseAt || 0) || sc.play || sc.fishing || sc.showing) return;
  pet.chaseAt = time + 3500;
  const b = (sc.birds || []).find(o => !o.gone && o.img.visible && cheb(o, pet) <= 3 && cheb(o, pet) >= 1);
  if (b && Math.random() < 0.6) { pet.chase = { b }; setEmote(pet.s, '!', time, 700); pet.next = time + 300; }
}
function chaseTick(sc, pet, time) {
  const c = pet.chase, b = c.b;
  if (b.gone || !b.img.visible) { pet.chase = null; return; }
  if (cheb(b, pet) > 1) return;
  // got there: the sparrow is off, and the pet stands looking after it
  b.gone = time + 2500 + Math.random() * 6000;
  b.img.setFlipX(b.x <= pet.x).setTexture('v_bird1').setDepth(D.fx);
  sc.time.delayedCall(1500, () => b.img.setVisible(false));
  pet.chase = null;
  pet.busy = true;
  pet.s.setFlipX(b.x < pet.x);
  sc.tweens.add({ targets: pet.s, hop: 4, duration: 120, yoyo: true, ease: 'Quad.out' });
  setEmote(pet.s, '!', time, 600);
  sc.time.delayedCall(700, () => { setEmote(pet.s, '…', sc.time.now, 1100); });
  sc.time.delayedCall(1500, () => { pet.busy = false; pet.next = sc.time.now + 200; });
  sc.hooks.onSound?.('chirp');
  sc.hooks.onSecret?.('chase');
}

// ---------- bumping it ----------
// a tap on it while it is beside you: a pat (further off, you just walk there and it hops aside)
export function petTap(sc, x, y) {
  const pet = sc.pet;
  if (!pet || pet.x !== x || pet.y !== y || sc.play || sc.fishing || cheb(pet, sc.p) > 1) return false;
  pat(sc, pet);
  return true;
}
// a step into it: the same
export function petStep(sc, x, y) {
  const pet = sc.pet;
  if (!pet || pet.x !== x || pet.y !== y || sc.play) return false;
  pat(sc, pet);
  return true;
}
function pat(sc, pet) {
  if (pet.busy) return;
  pet.busy = true;
  sc.time.delayedCall(700, () => { pet.busy = false; });
  sc.path = [];
  sc.pending = null;
  petWake(sc, pet);
  const p = sc.p;
  if (p.x !== pet.x) { pet.s.setFlipX(p.x < pet.x); sc.ps.setFlipX(pet.x < p.x); }
  petReact(sc, pet, sc.time.now);
  sc.tweens.add({ targets: sc.ps, hop: 4, duration: 110, yoyo: true, ease: 'Quad.out' });
  sc.ps.expr = 'sparkle';
  sc.ps.exprUntil = sc.time.now + 900;
}
export function petDescribe(sc, x, y) {
  const pet = sc.pet;
  return pet && pet.x === x && pet.y === y ? `${PETS[pet.id].name}: 오늘 같이 나온 펫. 뒤를 졸졸 따라온다. 부딪히면 좋아한다.` : '';
}
// the pet is pleased for you (a catch, a find: scenes/village-life.js)
export function petCheer(sc) {
  const pet = sc.pet;
  if (!pet) return;
  petWake(sc, pet);
  sc.tweens.add({ targets: pet.s, hop: 5, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.out' });
  setEmote(pet.s, '♪', sc.time.now, 1100);
}

// ---------- every frame ----------
export function petTick(sc, time, dt) {
  const pet = sc.pet;
  sc.petShade?.clear();
  if (!pet) return;
  const ps = sc.ps, p = sc.p, s = pet.s;
  // down the burrow or in at your door after you (and back out, if you thought better of the trip)
  if (ps.diving && !pet.in) {
    pet.in = true;
    sc.tweens.add({ targets: s, x: ps.x, y: ps.y - 4, alpha: 0, duration: 260, delay: 120, ease: 'Quad.in' });
  } else if (!ps.diving && pet.in) {
    pet.in = false;
    popBeside(sc, pet);
  }
  if (pet.in) { s.setVisible(ps.visible); return; }
  s.setVisible(ps.visible);
  const walking = sc.path.length > 0 || time < (ps.stepUntil || 0) || !!sc.play;
  pet.still = walking ? 0 : pet.still + dt;
  const d = cheb(pet, p);
  if (!pet.busy && time >= pet.next) {
    if (pet.x === p.x && pet.y === p.y) aside(sc, pet, time);
    else if (d > 10) popBeside(sc, pet);
    else if (pet.chase) { chaseTick(sc, pet, time); if (pet.chase) stepOn(sc, pet, time); }
    else if (d > 1) stepOn(sc, pet, time);
    else {
      // beside you: it turns to you, fidgets now and then, and nods off if you stand about
      if (!walking && p.x !== pet.x && time > pet.moving) s.setFlipX(p.x < pet.x);
      pet.trail = [];
      wantChase(sc, pet, time);
      if (!pet.asleep && pet.still > 11000 && !sc.play) { pet.asleep = true; pet.idleAt = time + 2000; }
      if (!pet.asleep && !walking && time > pet.idleAt) { pet.idleAt = time + 2600 + Math.random() * 3000; petIdle(sc, pet, time); }
    }
  }
  if (pet.asleep) petDoze(pet, time);
  // the picture follows its tile, a flier up in the air, a walker bobbing along
  const rate = 1 - Math.exp(-dt / 42);
  pet.fx += (center(pet.x) - pet.fx) * rate;
  pet.fy += (foot(pet.y) - pet.fy) * rate;
  const onWay = Math.abs(center(pet.x) - pet.fx) + Math.abs(foot(pet.y) - pet.fy) > 1;
  const bob = onWay && !pet.fly ? Math.floor(time / 90) % 2 : 0;
  s.setPosition(Math.round(pet.fx), Math.round(pet.fy - hover(pet, time) - bob));
  petPose(s, TILE / s.frame.height, breath(pet, time));
  s.setDepth(D.actors + (pet.fy / TILE - 1) / 100 - 0.0004);
  if (s.visible && s.alpha > 0.2) petShadow(sc.petShade, s, pet.fly, pet.fy);
}
export function petMarks(sc, mk, time) {
  const pet = sc.pet;
  if (pet?.s.visible && !pet.in) drawEmote(mk, pet.s, pet.s.x, pet.s.y - 13 - (pet.s.hop || 0), time);
}
