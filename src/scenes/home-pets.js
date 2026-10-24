// 펫 at home (v0.30, data/pets.js): every pet you have bought lives in your house. Come in and each is
// somewhere about the room that suits it (the chick by the stove, the mouse by the table, the
// butterfly at the window, the squirrel curled up on the cushion...), fidgeting the way it does, now
// and then padding over a tile and settling again, two of them playing when they are close, and dozing
// off one by one if you stand about. Bump one (or tap it) to pet it; the one you are taking along waits
// beside the door, ready. A room only holds so many without a pile-up: with a lot of pets a few come
// out each day (meta.day turns the rota) and the rest are off somewhere. Never in the way: a pet never
// sits in front of the door, nor where it would wall off a corner or a piece of furniture, and never
// two on one tile. What they are like: scenes/pet-acts.js; the one that follows you: scenes/village-pets.js.

import { TILE } from './textures.js';
import { D } from './HomeScene.js';
import { setEmote, drawEmote } from './emotes.js';
import { PETS } from '../data/pets.js';
import { windowSlots } from '../data/home.js';
import { WALL_ROWS } from './home-interior-art.js';
import { flies, hover, petPose, breath, petIdle, petReact, petDoze, petWake, petShadow } from './pet-acts.js';

const mid = x => (x + 1) * TILE + TILE / 2;
const foot = y => (y + WALL_ROWS + 1) * TILE;
const key = (x, y) => `${x},${y}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const chosen = meta => (meta.pet && meta.pets?.[meta.pet] && PETS[meta.pet] ? meta.pet : null);
// the order they take turns in: as the shop lists them
const ORDER = Object.keys(PETS);
// how many the room holds at most, however big
const MAX_OUT = 8;

// Where each kind likes to be, first choice first: 'by' a piece is beside it, 'on' a piece is on top
// of it (the cushion, the foot of the bed: those sleep), 'window' under the back wall's window, 'rug'
// on the rug. None of them there: anywhere out of the way.
const SPOTS = {
  chick: [['by', 'stove'], ['by', 'table'], ['on', 'petbed']],
  butterfly: [['window'], ['by', 'plant'], ['by', 'table']],
  ladybug: [['by', 'plant'], ['rug'], ['on', 'bed']],
  mouse: [['by', 'table'], ['by', 'shelf'], ['by', 'wardrobe']],
  bookworm: [['by', 'shelf'], ['by', 'secretbox'], ['rug']],
  duckling: [['by', 'tub'], ['by', 'tank'], ['rug']],
  bee: [['by', 'plant'], ['window'], ['by', 'table']],
  piglet: [['on', 'petbed'], ['rug'], ['by', 'stove']],
  sparrow: [['window'], ['by', 'plant'], ['by', 'shelf']],
  cloud: [['window'], ['by', 'lamp'], ['by', 'tub']],
  firefly: [['by', 'lamp'], ['window'], ['by', 'secretbox']],
  squirrel: [['on', 'petbed'], ['on', 'bed'], ['by', 'shelf']],
  slime: [['rug'], ['by', 'tub'], ['by', 'musicbox']],
  snail: [['by', 'plant'], ['by', 'tank'], ['rug']],
  jelly: [['by', 'tank'], ['by', 'tub'], ['window']],
};
// how far off the floor one sits on a piece
const LIFT = { petbed: 3, bed: 5, cloudbed: 7 };

// ---------- room for them ----------
const inRoom = (sc, x, y) => x >= 0 && y >= 0 && x < sc.room.w && y < sc.room.h;
const petAt = (sc, x, y, skip) => (sc.homePets || []).find(q => q !== skip && q.x === x && q.y === y);
// Every free cell still joined up with the door, and every piece with a free cell beside it to bump
// it from, with the pets on the floor counted as solid (`extra`: one more cell to count, `skip`: a pet
// not to count)
function wayKept(sc, extra, skip) {
  const room = sc.room, door = sc.door, solid = new Set(sc.occ.keys());
  for (const q of sc.homePets || []) if (q !== skip && !q.perch) solid.add(key(q.x, q.y));
  if (extra) solid.add(key(extra.x, extra.y));
  const open = (x, y) => inRoom(sc, x, y) && !solid.has(key(x, y));
  const seen = new Set([key(door.x, door.y)]), q = [[door.x, door.y]];
  while (q.length) {
    const [cx, cy] = q.shift();
    for (const [dx, dy] of N4) {
      const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
      if (!open(nx, ny) || seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) if (open(x, y) && !seen.has(key(x, y))) return false;
  const beside = (x, y) => N8.some(([dx, dy]) => seen.has(key(x + dx, y + dy)));
  return sc.items.every(it => it.f.wall || it.f.rug || [...Array(it.f.h).keys()].some(j => [...Array(it.f.w).keys()].some(i => beside(it.x + i, it.y + j))));
}
// a cell a pet may settle on (`ready`: the one by the door may be beside it)
function ok(sc, c, skip, ready) {
  const door = sc.door;
  if (!inRoom(sc, c.x, c.y) || (c.x === door.x && c.y === door.y) || (!ready && cheb(c, door) <= 1)) return false;
  if ((c.x === sc.p.x && c.y === sc.p.y) || petAt(sc, c.x, c.y, skip)) return false;
  if (c.perch) return true;
  return !sc.occ.has(key(c.x, c.y)) && wayKept(sc, c, skip);
}
const item = (sc, id) => sc.items.find(it => it.id === id);
// the cells one of its favourite spots means
function cellsOf(sc, [how, id]) {
  if (how === 'by') {
    const it = item(sc, id);
    if (!it) return [];
    const out = [];
    // its sides first, then in front, then the corners
    for (let j = 0; j < it.f.h; j++) out.push({ x: it.x - 1, y: it.y + j }, { x: it.x + it.f.w, y: it.y + j });
    for (let i = 0; i < it.f.w; i++) out.push({ x: it.x + i, y: it.y + it.f.h });
    out.push({ x: it.x - 1, y: it.y + it.f.h }, { x: it.x + it.f.w, y: it.y + it.f.h }, { x: it.x - 1, y: it.y - 1 }, { x: it.x + it.f.w, y: it.y - 1 });
    return out;
  }
  if (how === 'on') {
    const it = id === 'bed' ? item(sc, 'bed') || item(sc, 'cloudbed') : item(sc, id);
    if (!it || (it.id === 'petbed' && sc.pup) || it.homePet) return [];
    // the cushion itself; the foot of the bed
    return [{ x: it.x + it.f.w - 1, y: it.y + it.f.h - 1, perch: it, lift: LIFT[it.id] || 3 }];
  }
  if (how === 'window') return windowSlots(sc.room).map(x => ({ x, y: 0, window: true }));
  if (how === 'rug') {
    const it = item(sc, 'rug');
    if (!it) return [];
    const out = [];
    for (let j = 0; j < it.f.h; j++) for (let i = 0; i < it.f.w; i++) out.push({ x: it.x + i, y: it.y + j });
    return out;
  }
  return [];
}
// where a pet goes: its favourite spot that is free, else somewhere out of the way, away from the others
function spotFor(sc, id, skip) {
  for (const pref of SPOTS[id] || []) {
    const c = cellsOf(sc, pref).find(c => ok(sc, c, skip));
    if (c) return c;
  }
  const others = (sc.homePets || []).filter(q => q !== skip), cells = [];
  for (let y = 0; y < sc.room.h; y++) for (let x = 0; x < sc.room.w; x++) {
    const c = { x, y };
    if (!ok(sc, c, skip)) continue;
    const apart = others.length ? Math.min(...others.map(q => cheb(q, c))) : 9;
    cells.push({ c, score: Math.min(apart, 3) + (sc.room.h - 1 - y) * 0.2 + Math.random() * 0.5 });
  }
  cells.sort((a, b) => b.score - a.score);
  return cells[0]?.c || null;
}
// the one you are taking along: right beside the door, facing you
function readySpot(sc) {
  const d = sc.door;
  return [{ x: d.x - 1, y: d.y }, { x: d.x + 1, y: d.y }, { x: d.x - 1, y: d.y - 1 }, { x: d.x + 1, y: d.y - 1 }].find(c => ok(sc, c, null, true)) || null;
}
const openCells = sc => {
  let n = 0;
  for (let y = 0; y < sc.room.h; y++) for (let x = 0; x < sc.room.w; x++) if (!sc.occ.has(key(x, y)) && cheb({ x, y }, sc.door) > 1) n++;
  return n;
};

// ---------- coming in ----------
export function placeHomePets(sc) {
  sc.homePets = [];
  sc.petStill = 0;
  sc.petShade = sc.keep(sc.add.graphics().setDepth(D.actors - 0.5));
  const meta = sc.meta, owned = ORDER.filter(id => meta.pets?.[id]);
  if (!owned.length) return;
  const today = chosen(meta), others = owned.filter(id => id !== today);
  const cap = Math.max(2, Math.min(MAX_OUT, Math.floor(openCells(sc) / 4)));
  const out = today ? [today] : [];
  // the rest take turns: a window onto the list that moves along a pet a day
  const n = Math.min(others.length, cap - out.length), start = others.length ? (meta.day || 0) % others.length : 0;
  for (let i = 0; i < n; i++) out.push(others[(start + i) % others.length]);
  for (const id of out) {
    const at = id === today ? readySpot(sc) || spotFor(sc, id) : spotFor(sc, id);
    if (at) addPet(sc, id, at, id === today);
  }
}
function addPet(sc, id, at, ready) {
  const now = sc.time.now;
  const s = sc.keep(sc.add.image(0, 0, PETS[id].sprite).setOrigin(0.5, 1));
  s.hop = 0;
  const pet = {
    pet: true, id, x: at.x, y: at.y, f: { w: 1, h: 1 }, s, ready, fly: flies(id), seed: Math.random() * 6,
    idleAt: now + 1200 + Math.random() * 3000, wanderAt: now + 6000 + Math.random() * 9000, dozeAt: 7000 + Math.random() * 9000, moving: 0,
  };
  perchOn(pet, at);
  pet.asleep = !!pet.perch && !ready;
  pet.fx = mid(at.x); pet.fy = foot(at.y) - pet.lift;
  s.setFlipX(ready ? sc.p.x < at.x : Math.random() < 0.5);
  sc.homePets.push(pet);
}
function perchOn(pet, at) {
  if (pet.perch) pet.perch.homePet = null;
  pet.perch = at.perch || null;
  pet.lift = at.lift || (at.window && pet.fly ? 6 : 0);
  if (pet.perch) pet.perch.homePet = pet;
}
// a piece moved (꾸미기): a pet that was on it, or under where it went, or now walls something off,
// finds itself somewhere else
export function settleHomePets(sc) {
  const pets = sc.homePets || [];
  for (const pet of [...pets]) {
    const lost = pet.perch ? !sc.items.includes(pet.perch) || (pet.perch.id === 'petbed' && sc.pup) : sc.occ.has(key(pet.x, pet.y));
    if (!lost && (pet.perch || wayKept(sc, null, null))) continue;
    if (lost && pet.perch) { pet.perch.homePet = null; pet.perch = null; }
    const at = pet.ready ? readySpot(sc) || spotFor(sc, pet.id, pet) : spotFor(sc, pet.id, pet);
    if (!at) { pet.s.destroy(); sc.homePets = sc.homePets.filter(q => q !== pet); continue; }
    pet.x = at.x; pet.y = at.y;
    perchOn(pet, at);
    pet.moving = sc.time.now + 300;
  }
}

// ---------- about the room ----------
function wander(sc, pet, time) {
  const ways = N4.map(([dx, dy]) => ({ x: pet.x + dx, y: pet.y + dy })).filter(c => ok(sc, c, pet));
  if (!ways.length) return;
  const to = ways[Math.floor(Math.random() * ways.length)];
  if (to.x !== pet.x) pet.s.setFlipX(to.x < pet.x);
  pet.x = to.x; pet.y = to.y;
  pet.moving = time + 220;
}
// two near each other: a nose touch, or a step over and a hop (♪ on both)
function tryPlay(sc, pet, time) {
  const other = (sc.homePets || []).find(q => q !== pet && !q.asleep && !q.perch && !q.busy && cheb(q, pet) >= 1 && cheb(q, pet) <= 2);
  if (!other || Math.random() < 0.4) return false;
  const face = (a, b) => { if (a.x !== b.x) a.s.setFlipX(b.x < a.x); };
  const done = () => { pet.busy = other.busy = false; };
  pet.busy = other.busy = true;
  sc.time.delayedCall(1100, done);
  if (cheb(pet, other) === 2) {
    const c = N8.map(([dx, dy]) => ({ x: pet.x + dx, y: pet.y + dy })).find(c => cheb(c, other) === 1 && ok(sc, c, pet));
    if (c) { pet.x = c.x; pet.y = c.y; pet.moving = time + 220; }
  }
  face(pet, other); face(other, pet);
  sc.time.delayedCall(260, () => {
    for (const q of [pet, other]) {
      if (!q.s.active) continue;
      sc.tweens.add({ targets: q.s, dip: 2, duration: 110, yoyo: true, ease: 'Quad.out' });
      setEmote(q.s, '♪', sc.time.now, 1000);
    }
    sc.tweens.add({ targets: other.s, hop: 3, duration: 110, yoyo: true, delay: 200, ease: 'Quad.out' });
  });
  return true;
}

// ---------- petting one ----------
export const homePetAt = (sc, x, y) => petAt(sc, x, y) || null;
// a tap on one: walk up to it and pet it
export function homePetTap(sc, x, y) {
  const pet = petAt(sc, x, y);
  if (!pet) return false;
  const near = sc.near(pet);
  if (near === 0) pat(sc, pet);
  else if (near) { sc.path = near; sc.pending = pet; }
  return true;
}
// a step into one on the floor (one on a piece is the piece's bump)
export function homePetStep(sc, x, y) {
  const pet = petAt(sc, x, y);
  if (!pet || pet.perch) return false;
  pat(sc, pet);
  return true;
}
// the bump (HomeScene meet): a pet, or the cushion with a pet asleep on it
export function homePetMeet(sc, it) {
  const pet = it.pet ? it : it.id === 'petbed' ? it.homePet : null;
  if (!pet) return false;
  pat(sc, pet);
  return true;
}
function pat(sc, pet) {
  if (pet.busy) return;
  pet.busy = true;
  sc.time.delayedCall(700, () => { pet.busy = false; });
  petWake(sc, pet);
  pet.dozeAt = sc.petStill + 9000 + Math.random() * 8000;
  const p = sc.p;
  if (p.x !== pet.x) { pet.s.setFlipX(p.x < pet.x); sc.ps.setFlipX(pet.x < p.x); }
  petReact(sc, pet, sc.time.now);
  sc.happy();
}
export function homePetDescribe(sc, x, y) {
  const pet = petAt(sc, x, y);
  if (!pet) return '';
  const name = PETS[pet.id].name;
  if (pet.asleep) return `${name}: 새근새근 자고 있다.`;
  return pet.ready ? `${name}: 문 옆에서 나갈 채비를 하고 있다. 부딪히면 좋아한다.` : `${name}: 집에서 쉬고 있다. 부딪히면 좋아한다.`;
}

// ---------- every frame ----------
export function homePetsTick(sc, time, dt) {
  const pets = sc.homePets || [];
  sc.petShade?.clear();
  if (!pets.length) return;
  const ps = sc.ps, p = sc.p;
  const still = !sc.path.length && time >= (ps.stepUntil || 0) && !sc.editing;
  sc.petStill = still ? sc.petStill + dt : 0;
  const music = sc.playing && time < sc.playing;
  for (const pet of pets) {
    const s = pet.s;
    if (pet.asleep) {
      petDoze(pet, time);
      // you came right up to it: it stirs
      if (!still && cheb(pet, p) <= 1) { petWake(sc, pet); pet.dozeAt = 9000 + Math.random() * 8000; }
    } else if (!pet.busy) {
      if (music && pet.danced !== sc.playing) {
        // the music box: everyone bobs along
        pet.danced = sc.playing;
        setEmote(s, '♪', time, 1500);
        sc.tweens.add({ targets: s, hop: 3, duration: 200, yoyo: true, repeat: 3, ease: 'Sine.inOut' });
      } else if (time > pet.idleAt) { pet.idleAt = time + 2800 + Math.random() * 3500; petIdle(sc, pet, time); }
      if (!pet.perch && !pet.ready && time > pet.wanderAt && !music) {
        pet.wanderAt = time + 7000 + Math.random() * 9000;
        if (!tryPlay(sc, pet, time)) wander(sc, pet, time);
      }
      if (sc.petStill > pet.dozeAt && !music) { pet.asleep = true; s.emote = null; }
    }
    const rate = 1 - Math.exp(-dt / 42);
    pet.fx += (mid(pet.x) - pet.fx) * rate;
    pet.fy += (foot(pet.y) - pet.lift - pet.fy) * rate;
    const onWay = Math.abs(mid(pet.x) - pet.fx) + Math.abs(foot(pet.y) - pet.lift - pet.fy) > 1;
    const bob = onWay && !pet.fly ? Math.floor(time / 90) % 2 : 0;
    s.setPosition(Math.round(pet.fx), Math.round(pet.fy - (pet.asleep ? 0 : hover(pet, time)) - bob));
    petPose(s, TILE / s.frame.height, breath(pet, time));
    s.setDepth(pet.perch ? pet.perch.img.depth + 0.0005 : D.actors + pet.y / 100 - 0.0005);
    if (!pet.perch) petShadow(sc.petShade, s, pet.fly && !pet.asleep, foot(pet.y));
  }
  // 비밀: everyone in the room asleep at once while you stand about
  if (pets.length >= 2 && still && pets.every(q => q.asleep)) {
    sc.napStill = (sc.napStill || 0) + dt;
    if (sc.napStill > 2500) { sc.napStill = -1e9; sc.hooks.onSecret?.('petnap'); }
  } else sc.napStill = 0;
}
export function homePetMarks(sc, mk, time) {
  for (const pet of sc.homePets || []) drawEmote(mk, pet.s, pet.s.x + 2, pet.s.y - 12 - (pet.s.hop || 0), time);
}
