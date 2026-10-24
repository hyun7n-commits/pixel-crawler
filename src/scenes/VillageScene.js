// The village between runs, drawn with the meadow's tiles. You walk around it like in a run (tap a
// spot, or the arrow keys) and bump into people to talk to them; the burrow on the east side of the
// plaza leads out to the fields. What each villager offers is DOM (ui/hub.js), opened through
// `hooks.onTalk`. Each time you come home a few shiny bits lie hidden in the grass for whoever wanders
// off the path.
// The village grows (data/village.js): the parts of the map not open yet are woods, and whatever has
// opened or gone up since you last looked plays out when you come back (`playGrowth`): the camera goes
// over, the woods there sink away, the new thing pops up, a banner says what it is. A tap skips it.

/* global Phaser */
import { pixEllipse } from './pix.js';
import { diveInto } from './burrow.js';
import { TILE, HOME_ZI, dressKey, wallKey, waterKey, roundedWater, shadeKey, floorKey, texScale, N, E, S, W_, NE, SE, SW, NW } from './textures.js';
import { chimneyAt } from './village-houses.js';
import { houseCanvas, pathKey, lampPostCanvas, lotCanvas, treeKey, shrubCanvas, sunRaysCanvas, glintCanvas } from './village-art.js';
import { baseZoom } from './zoom.js';
import { faceKey } from '../data/faces.js';
import {
  VILLAGE_MAP, HOUSES, BUILDINGS, FOLK, doorOf, HERO_LINES, HOME, ownsHome, PROPS, PROP_NAMES, WALK, propCells, BIG_TREE,
  villageState, regionOpen, shownIn, BUILD, LEVELS, guildLevel, shopLevel, COBBLE_P, FLOWERS_P, cottageName, GROWN,
} from '../data/village.js';
import { REGION, REGIONS } from '../data/village-map.js';
import { josa } from '../core/util.js';
import { bigTreeCanvas } from './landmarks.js';
import { CHARACTERS } from '../data/characters.js';
import { VILLAGE_GROUND } from '../data/enemies.js';
import { DECOR, hasDecor, LETTERS, houseLevel } from '../data/home.js';
import { decorCanvas, pupCanvas } from './home-art.js';
import { setEmote, drawEmote } from './emotes.js';
import { newStock } from '../data/shop.js';
import { plotCount, GARDEN_BASE } from '../data/life.js';
import {
  placeVillageLife, lifeTap, lifeStep, lifeAct, lifeStepOn, lifeDescribe, lifeTick, lifeMarks, plantSeeds, drawBed, GARDEN_MORE, bedArt,
} from './village-life.js';
import { placeVillagePlay, playTap, playStep, playAct, playStepOn, playDescribe, playTick, playKey, startRace } from './village-play.js';
import { placeVillageHearts, heartsTick, heartsTap, heartsMeet } from './village-hearts.js';
import { chatLine } from '../data/affinity.js';
import { patchNoise, scatterKey, patchKey, footKey, bloomKey, moteKeys, SCATTER_VARIANTS, PATCH_VARIANTS, FOOT_VARIANTS, BLOOM_VARIANTS, FOOT_UP } from './field-decor.js';
import { propCanvas, critterCanvas } from './village-props.js';
import { poke, pokeKind, stillInFlowers, flutterTo, petPup } from './village-secrets.js';
import { growthPropCanvas, stringCanvas, GROWTH_PROPS, STRING_PAD, SAILS_AT, SAIL_FRAMES } from './village-growth-art.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const TOP = 3 * TILE;
export const D = { tiles: 0, deco: 1, house: 2, actors: 3, fx: 4, bubble: 5 };
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
};
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const STEP_MS = 140;
const PAD = { x: 6, y: 8 };       // woods drawn around the map
const grassy = ch => ch === '.' || ch === '*';
// where you walk in: beside the burrow coming back from the fields, otherwise in front of the guild
const EXIT = (() => { const y = VILLAGE_MAP.findIndex(r => r.includes('>')); return { x: VILLAGE_MAP[y].indexOf('>'), y }; })();
const GUILD = doorOf(HOUSES.find(h => h.id === 'guild'));
// the middle of the plaza, where the heroes who stay home hang about
const PLAZA = { x: 30, y: 23 };
// where the puppy curls up: on the grass at the front corner of your house, by the dog house
const PUP = { x: HOME.x + HOME.w, y: HOME.y + HOME.h };
const MAYPOLE = PROPS.find(p => p.kind === 'maypole');
// the clears at which the guild and the shop grow (village.js guildLevel, shopLevel)
const LEVEL_P = [0, 10, 20];
// what a cell is in a state of the village (`open`: its open cells): woods where the village has not
// reached yet; the flower beds are plain grass until they are planted
const chIn = (open, st, x, y) => {
  if (x < 0 || y < 0 || x >= MW || y >= MH || !open[y * MW + x]) return '#';
  const c = VILLAGE_MAP[y][x];
  return c === '*' && st.P < FLOWERS_P ? '.' : c;
};
// the turns of the growth show: the clears in order, then the friends' cottages, then the folk moving in
const turnRank = k => (/^p\d+$/.test(k) ? +k.slice(1) : /^f\d$/.test(k) ? 100 + +k[1] : 200);

export class VillageScene extends Phaser.Scene {
  constructor(hooks) {
    super({ key: 'village' });
    this.hooks = hooks;
  }

  create(data) {
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor(VILLAGE_GROUND.wallDark);
    this.spark = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 300, max: 650 }, speed: { min: 15, max: 60 }, scale: { start: 1.5, end: 0 },
      gravityY: 40, tint: [0xf4cf4f, 0xffffff, 0xf29bb2],
    }).setDepth(D.fx);
    this.smoke = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: 1600, speedY: { min: -14, max: -8 }, speedX: { min: -2, max: 5 },
      scale: { start: 2, end: 3.5 }, alpha: { start: 0.45, end: 0 }, tint: 0xd8d4e0,
    }).setDepth(D.fx);
    // leaves and twigs flying when the woods draw back
    this.leaves = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 450, max: 900 }, speed: { min: 25, max: 70 }, angle: { min: 200, max: 340 },
      scale: { start: 2, end: 0.6 }, gravityY: 110, tint: [0x5aad58, 0x3a8448, 0x7cc45a, 0xacdc86, 0x8a5634],
    }).setDepth(D.fx);
    // poking at things (scenes/village-secrets.js): leaves coming down out of the woods, a splash, dust
    this.fall = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 600, max: 1100 }, speedX: { min: -14, max: 14 }, speedY: { min: 4, max: 22 },
      scale: { start: 1.6, end: 1 }, gravityY: 28, alpha: { start: 1, end: 0.2 }, tint: [0x5aad58, 0x3a8448, 0x7cc45a, 0xacdc86],
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-7, -6, 14, 8) },
    }).setDepth(D.fx);
    this.drops = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: 460, speedY: { min: -60, max: -20 }, speedX: { min: -24, max: 24 }, gravityY: 220,
      scale: { start: 1.3, end: 0.8 }, tint: [0x9fd4ff, 0x7cc0dc, 0xe6f7ff],
    }).setDepth(D.fx);
    this.dust = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 250, max: 450 }, speedY: { min: -26, max: -8 }, speedX: { min: -20, max: 20 }, gravityY: 70,
      scale: { start: 1.4, end: 0.4 }, tint: [0xb89a6a, 0x8a6a44, 0xd8c09a],
    }).setDepth(D.fx);
    // fireworks over the village once it is all grown
    this.burst = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 700, max: 1100 }, speed: { min: 28, max: 62 }, scale: { start: 1.6, end: 0.3 },
      gravityY: 26, alpha: { start: 1, end: 0 },
    }).setDepth(D.bubble - 0.5);
    this.shadows = this.add.graphics().setDepth(D.actors - 0.5);
    this.marks = this.add.graphics().setDepth(D.fx + 0.5);
    this.objs = [];
    this.bubbles = [];

    // tap a spot to walk there, or a villager to go and talk; hover with a mouse to read who is who
    // or drag to look round the village (walk off again and the view comes back to you)
    // (and, as in the fields, pinch or the mouse wheel to zoom: v0.29)
    const tileOf = ptr => ({ x: Math.floor(ptr.worldX / TILE), y: Math.floor(ptr.worldY / TILE) });
    const cam0 = this.cameras.main;
    this.input.addPointer(1);
    const downs = () => this.input.manager.pointers.filter(q => q.isDown);
    const spread = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);
    this.input.on('pointerdown', ptr => {
      const two = downs();
      if (two.length >= 2) { this.drag = null; this.pinch = { d: spread(two), z: cam0.zoom }; return; }
      this.drag = { x: ptr.x, y: ptr.y, sx: cam0.scrollX, sy: cam0.scrollY, on: false };
    });
    this.input.on('pointerup', ptr => {
      if (this.pinch) { if (!downs().length) this.pinch = null; return; }
      const dragged = this.drag?.on;
      this.drag = null;
      if (dragged || Math.hypot(ptr.upX - ptr.downX, ptr.upY - ptr.downY) > 12 * this.dpr) return;
      if (this.showing) { this.skipShow(); return; }
      const t = tileOf(ptr);
      this.tap(t.x, t.y);
    });
    this.input.on('pointermove', ptr => {
      if (this.pinch) {
        const two = downs();
        if (two.length >= 2) this.zoomBy(Math.round(this.pinch.z * spread(two) / this.pinch.d) - cam0.zoom);
        return;
      }
      const d = this.drag;
      if (d && ptr.isDown && !this.showing) {
        if (!d.on && Math.hypot(ptr.x - d.x, ptr.y - d.y) > 12 * this.dpr) { d.on = true; cam0.stopFollow(); }
        if (d.on) { cam0.setScroll(d.sx - (ptr.x - d.x) / cam0.zoom, d.sy - (ptr.y - d.y) / cam0.zoom); return; }
      }
      if (ptr.wasTouch) return;
      const t = tileOf(ptr);
      this.hooks.onHover?.(this.describe(t.x, t.y));
    });
    this.input.on('wheel', (ptr, objs, dx, dy) => { if (dy && !this.showing) this.zoomBy(dy < 0 ? 1 : -1); });
    this.input.on('gameout', () => this.hooks.onHover?.(''));
    this.zoomBias = 0;
    this.scale.on('resize', () => this.fitZoom());
    // back out of your own door the village is as you left it; anything else builds it afresh
    this.events.on('wake', (sys, d) => (d?.from === 'home' && d.meta === this.meta && this.ps ? this.outOfHome() : this.enter(d)));
    this.fitZoom();
    this.enter(data);
  }

  get dpr() { return this.game.registry.get('dpr') || 1; }

  // the same zoom as in the fields; the view keeps to the part of the village that has opened (and a
  // strip of woods round it), so a small village feels small; when the screen is bigger than that (a
  // tall phone), it sits in the middle of the woods instead of in a corner
  fitZoom() {
    const z0 = baseZoom(this, TILE), cam = this.cameras.main;
    if (!z0) return;
    const r = this.dpr, z = Phaser.Math.Clamp(z0 + (this.zoomBias || 0), Math.max(1, Math.round(1.5 * r)), Math.round(6 * r));
    this.zoomBias = z - z0;
    cam.setZoom(z);
    const b = this.openBox || { x0: 0, y0: 0, x1: MW - 1, y1: MH - 1 };
    const x0 = (b.x0 - 3) * TILE, x1 = (b.x1 + 4) * TILE, y0 = (b.y0 - 2) * TILE - TOP, y1 = (b.y1 + 3) * TILE;
    const vw = cam.width / z, vh = cam.height / z, bw = Math.max(x1 - x0, vw), bh = Math.max(y1 - y0, vh);
    cam.setBounds((x0 + x1 - bw) / 2, (y0 + y1 - bh) / 2, bw, bh);
  }

  // closer in or further out, a step at a time (pinch, wheel); the view keeps to the village
  zoomBy(n) {
    if (!n) return;
    this.zoomBias = (this.zoomBias || 0) + n;
    this.fitZoom();
  }

  // ---------- building the place ----------
  // `meta`: the save; `from`: 'run' when coming back from the fields (you walk in by the burrow),
  // 'home' when coming out of your house
  enter({ meta, from }) {
    this.meta = meta;
    this.clear();
    // how far the village has grown, and what has opened or gone up since you last looked (nothing to
    // compare with the first time on a save)
    const st = this.st = villageState(meta), last = meta.village.last;
    this.growth = last ? { was: { P: last.P, arr: new Set(last.arr) } } : null;
    const was = this.growth?.was;
    this.hooks.onSeen?.(st);
    this.open = this.openIn(st);
    this.wasOpen = was ? this.openIn(was) : null;
    let bx0 = MW, by0 = MH, bx1 = 0, by1 = 0;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!this.open[y * MW + x]) continue;
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
    }
    this.openBox = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
    this.fitZoom();
    this.blocked = new Uint8Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if ('#~T'.includes(this.ch(x, y))) this.blocked[y * MW + x] = 1;
    // the ground, baked into one picture (the woods go on past the edge, so a tall phone screen shows
    // trees round the village, not a void); what changed since last time gets its old look laid over it
    this.ground = [];
    for (let y = -PAD.y; y < MH + PAD.y; y++) for (let x = -PAD.x; x < MW + PAD.x; x++) this.drawTile(x, y);
    this.plantTrees();
    this.bake(this.ground, 'village_ground', { x0: -PAD.x, y0: -PAD.y, x1: MW + PAD.x - 1, y1: MH + PAD.y - 1 }, D.tiles);
    this.ground = null;
    if (was) this.overlayOld();
    if (shownIn(BIG_TREE, st)) { this.plantBigTree(); this.hold(BIG_TREE, [this.bigTree]); }
    else this.bigTree = null;
    this.sunOnPond();
    this.placeProps();
    // the folk's houses, up once they have moved in; the guild's tent and the peddler's cart grow into
    // proper buildings as the village does
    for (const h of HOUSES) {
      const f = FOLK[h.id], lived = f.when(meta);
      h.lived = lived;
      h.img = null;
      if (!lived) continue;
      const lvl = this.levelOf(h, st.P), old = was?.arr.has(h.id) ? this.levelOf(h, was.P) : lvl;
      h.img = this.keep(this.add.image((h.x + h.w / 2) * TILE, (h.y + h.h) * TILE, this.houseKey(h, true, old)).setOrigin(0.5, 1).setDepth(D.actors + (h.y + h.h - 1) / 100));
      if (old !== lvl) this.swap(`p${LEVEL_P[lvl]}`, h.img, this.houseKey(h, true, lvl));
      for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) this.blocked[y * MW + x] = 1;
      this.hold({ x: h.x, y: h.y, cond: h.id }, [h.img, ...this.shrubs(h)]);
    }
    // what the village has put up as it grew: the bakery, the inn, the friends' cottages...
    for (const b of BUILDINGS) {
      if (!shownIn(b, st)) continue;
      b.img = this.keep(this.add.image((b.x + b.w / 2) * TILE, (b.y + b.h) * TILE, this.houseKey(b, true)).setOrigin(0.5, 1).setDepth(D.actors + (b.y + b.h - 1) / 100));
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) this.blocked[y * MW + x] = 1;
      this.buildings.push(b);
      this.hold(b, [b.img, ...(b.id === 'windmill' ? [this.placeSails(b)] : [])]);
    }
    // your own house, or the roped-off lot where it will stand (the first time you come back with a
    // win, the house goes up on it)
    const home = ownsHome(meta), hadHome = !was || was.arr.has('carpenter');
    if (!this.textures.exists('village_lot')) this.textures.addCanvas('village_lot', lotCanvas(HOME.w, HOME.h));
    const homeKey = this.houseKey(HOME, true, houseLevel(meta));
    this.homeImg = this.keep(this.add.image((HOME.x + HOME.w / 2) * TILE, (HOME.y + HOME.h) * TILE, home && hadHome ? homeKey : 'village_lot').setOrigin(0.5, 1).setDepth(D.actors + (HOME.y + HOME.h - 1) / 100));
    if (home && !hadHome) this.swap('p1', this.homeImg, homeKey);
    for (let y = HOME.y; y < HOME.y + HOME.h; y++) for (let x = HOME.x; x < HOME.x + HOME.w; x++) this.blocked[y * MW + x] = 1;
    // bumping the house in front of its door takes you inside
    this.homeDoor = home ? { ...doorOf(HOME), home: true } : null;
    if (this.homeDoor) this.homeDoor.y--;
    this.decor = {};
    this.pup = null;
    this.placeDecor();
    // a letter in the mailbox now and then, when you come home from the fields
    const box = DECOR.find(d => d.id === 'mailbox').at[0];
    this.mailbox = { x: box[0], y: box[1], mailbox: true };
    const senders = LETTERS.filter(l => FOLK[l.from].when(meta) && (!l.if || l.if(meta)));
    this.mail = from === 'run' && hasDecor(meta, 'mailbox') && senders.length && Math.random() < 0.6
      ? senders[Math.floor(Math.random() * senders.length)] : null;
    this.mailMark = {};
    this.mailNext = 0;
    // the villagers stand at their doors; ones who just moved in arrive with a little fanfare
    this.folk = [];
    const arrivals = [];
    for (const h of HOUSES) {
      const f = FOLK[h.id];
      if (!h.lived) continue;
      const at = doorOf(h), s = this.actor(f.sprite, at.x, at.y);
      const one = { id: h.id, f, x: at.x, y: at.y, s, house: h, greeted: false, next: 0, dir: [0, 1] };
      this.folk.push(one);
      if (f.arrive && !meta.village.seen[h.id]) { arrivals.push(one); s.setAlpha(0); }
      // nobody stands at the door of a house that has not come up yet
      if (h.img.held) this.holdAt(h.img.held, [s], 'fade');
    }
    const start = from === 'run' ? { x: EXIT.x - 1, y: EXIT.y } : from === 'home' ? doorOf(HOME) : { x: GUILD.x, y: GUILD.y + 2 };
    this.p = { x: start.x, y: start.y, id: meta.sel };
    // the festival (P40): the heroes at home dance round the maypole; the first time, they run over
    // to it when it opens
    this.fest = st.P >= GROWN && (!was || was.P >= GROWN);
    this.heroes = [];
    this.placeHeroes();
    this.ps = this.actor(CHARACTERS[meta.sel].sprite, start.x, start.y);
    this.ps.setFlipX(from === 'run');
    this.path = [];
    this.nextStep = 0;
    this.cameras.main.startFollow(this.ps, true, 0.2, 0.2, 0, TILE / 2);
    this.cameras.main.centerOn(center(start.x), foot(start.y) - TILE / 2);
    this.hideFinds(2 + Math.floor(Math.random() * 2));
    this.placeLife();
    placeVillageLife(this);
    placeVillagePlay(this);
    placeVillageHearts(this);
    this.festival();
    this.playGrowth(arrivals);
  }

  // ---------- growing ----------
  // the cells open in a state of the village
  openIn(st) {
    const o = new Uint8Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (regionOpen(REGION[y][x], st)) o[y * MW + x] = 1;
    return o;
  }
  // a cell that has opened since you last looked
  isNew(x, y) {
    return !!this.wasOpen && x >= 0 && y >= 0 && x < MW && y < MH && !!this.open[y * MW + x] && !this.wasOpen[y * MW + x];
  }
  // One turn of the show: the old look that melts away (`over`), what comes up (`things`), what gets a
  // new picture (`swaps`), what goes (`gone`), what starts (`after`), who moves in (`folk`).
  turn(key) {
    let s = this.steps.get(key);
    if (!s) this.steps.set(key, s = { key, over: [], things: [], swaps: [], gone: [], after: [] });
    return s;
  }
  // which turn something new comes up in (null: it was here already): the clear that put it up, the
  // part of the village that opened round it, or whoever moved in
  trig(o) {
    const g = this.growth;
    if (!g || shownIn(o, g.was)) return null;
    if (o.p != null && o.p > g.was.P) return `p${o.p}`;
    if (this.isNew(o.x, o.y)) return this.cellTrig(o.x, o.y);
    return o.cond && !g.was.arr.has(o.cond) ? o.cond : null;
  }
  // why a cell is open now: the clear that opened its part of the village, or who moved in
  cellTrig(x, y) {
    const r = REGIONS[REGION[y][x]], arr = this.st.arr, was = this.growth.was.arr;
    if (r.p != null) return `p${r.p}`;
    if (r.cond) return r.cond;
    return r.any.find(c => arr.has(c) && !was.has(c)) || r.any.find(c => arr.has(c));
  }
  // something that comes up in the show stays hidden until its turn. `how`: 'grow' up out of the
  // ground, or 'fade' in
  hold(o, imgs, how = 'grow') {
    const key = this.trig(o);
    if (key) this.holdAt(key, imgs, how);
    return key;
  }
  holdAt(key, imgs, how = 'grow') {
    imgs.forEach(i => { i.setVisible(false); i.held = key; });
    this.turn(key).things.push({ imgs, how });
  }
  // something that gets a new picture in the show (the house on the lot, the guild growing)
  swap(key, img, to) {
    img.finalKey = to;
    this.turn(key).swaps.push({ img, key: to });
  }
  // the guild's tent becomes a timber hall (P10) and a hall with a clock tower (P20); the peddler's
  // cart a shop (P10)
  levelOf(h, P) { return h.id === 'guild' ? guildLevel(P) : h.id === 'shop' ? shopLevel(P) : 0; }

  // The old look of whatever changed since last time (the woods that stood there, the grass before
  // the flowers, the dirt before the cobbles), one picture per turn of the show, laid over the new
  // ground until its turn; the old trees stand on it as pictures of their own, and sink away.
  overlayOld() {
    const g = this.growth, now = { open: this.open, st: this.st }, changed = new Map(), opened = new Map();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = y * MW + x, c = VILLAGE_MAP[y][x];
      if (this.isNew(x, y)) opened.set(i, this.cellTrig(x, y));
      else if (this.open[i] && c === '*' && g.was.P < FLOWERS_P && this.st.P >= FLOWERS_P) changed.set(i, `p${FLOWERS_P}`);
      else if (this.open[i] && ':>='.includes(c) && g.was.P < COBBLE_P && this.st.P >= COBBLE_P) changed.set(i, `p${COBBLE_P}`);
    }
    // round a cell that opened, the hedge's edge and its shade on the grass change too
    for (const [i, key] of opened) {
      const x = i % MW, y = (i / MW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = (y + dy) * MW + x + dx;
        if (!opened.has(j) && !changed.has(j)) changed.set(j, key);
      }
    }
    for (const [i, key] of opened) changed.set(i, key);
    const byKey = new Map();
    for (const [i, key] of changed) { if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(i); }
    // draw them as they were: the village swapped back to its old state for a moment
    this.open = this.wasOpen; this.st = g.was; this.baking = true;
    let n = 0;
    for (const [key, cells] of byKey) {
      this.ground = [];
      let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
      for (const i of cells) {
        const x = i % MW, y = (i / MW) | 0;
        this.drawTile(x, y);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const img = this.bake(this.ground, `village_old${n++}`, { x0, y0: y0 - 1, x1, y1 }, D.deco + 0.9);
      img.ground = true;
      this.turn(key).over.push(img);
    }
    // the old trees: the ones on or over a cell that opened, unless they are still standing now
    const deepNow = (x, y) => {
      for (let dy = -2; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) if (chIn(now.open, now.st, x + dx, y + dy) !== '#') return false;
      return true;
    };
    const wants = (x, y) => {
      if (deepNow(x, y)) return null;
      for (let dy = -3; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
        const k = x + dx >= 0 && x + dx < MW && opened.get((y + dy) * MW + x + dx);
        if (k) return k;
      }
      return null;
    };
    this.plantTrees((x, y) => this.ch(x, y), { wants, add: (img, key) => this.turn(key).over.push(img) });
    this.open = now.open; this.st = now.st; this.baking = false; this.ground = null;
  }

  // where the camera goes to watch a turn
  stepAt(s) {
    const k = s.key;
    if (/^p\d+$/.test(k)) { const [x, y] = BUILD[+k.slice(1) - 1].at; return { x, y }; }
    const cot = BUILDINGS.find(b => `f${b.cot}` === k);
    if (cot) return { x: cot.x + 1, y: cot.y + 1 };
    const h = HOUSES.find(o => o.id === k);
    if (h) { const d = doorOf(h); return { x: d.x, y: d.y - 2 }; }
    return { x: this.p.x, y: this.p.y };
  }

  // The show: turn after turn, the camera going over to each; the woods there sink away, the new
  // things come up, a banner says what it is. A tap skips to the end.
  playGrowth(arrivals) {
    for (const one of arrivals) this.turn(one.id).folk = one;
    const list = [...this.steps.values()].sort((a, b) => turnRank(a.key) - turnRank(b.key));
    if (!list.length) return;
    for (const s of list) {
      if (/^p\d+$/.test(s.key)) {
        const n = +s.key.slice(1), b = BUILD[n - 1], lv = LEVELS.find(l => l.p === n);
        s.banner = b.say || `${josa(b.name, '이', '가')} 생겼다!`;
        if (lv) s.level = `마을이 커졌다! 이제 ${josa(lv.name, '이다', '다')}`;
      } else if (/^f\d$/.test(s.key)) s.banner = `${josa(cottageName(this.meta, +s.key[1]), '이', '가')} 생겼다!`;
    }
    this.showing = list;
    const cam = this.cameras.main, T = this.showTimers = [];
    const at = (ms, fn) => T.push(this.time.delayedCall(ms, fn));
    cam.stopFollow();
    let t = 300;
    for (const s of list) {
      const { x, y } = this.stepAt(s);
      at(t, () => cam.pan(center(x), center(y), 800, 'Sine.easeInOut', true));
      t += 900;
      if (s.over.length) { at(t, () => this.melt(s)); t += 650; }
      at(t, () => this.pop(s));
      t += s.things.length || s.swaps.length || s.gone.length ? 1500 : 150;
      if (s.level) { at(t, () => this.hooks.onGrow?.(s.level, true)); t += 1800; }
      if (s.folk) { at(t, () => this.arrive(s.folk)); t += 2300; }
    }
    at(t, () => this.endShow());
  }

  // the old woods sink away, the trees nearest the middle first, leaves flying; the ground fades
  melt(s, fast) {
    if (s.melted) return;
    s.melted = true;
    const c = this.stepAt(s);
    for (const o of s.over) {
      if (!o.active) continue;
      if (fast) { this.dropOld(o); continue; }
      if (o.ground) { this.tweens.add({ targets: o, alpha: 0, duration: 650, delay: 150, onComplete: () => this.dropOld(o) }); continue; }
      const delay = Math.min(550, Math.hypot(o.x / TILE - c.x, o.y / TILE - c.y) * 45);
      this.tweens.add({
        targets: o, scaleY: 0, scaleX: o.scaleX * 0.6, alpha: 0.4, duration: 300, delay, ease: 'Back.in',
        onComplete: () => { this.leaves.explode(6, o.x, o.y - 10); this.dropOld(o); },
      });
    }
  }
  dropOld(o) {
    const key = o.ground && o.texture.key;
    o.destroy();
    if (key && this.textures.exists(key)) this.textures.remove(key);
  }

  // a turn's new things come up out of the ground with sparkles, the nearest first; what changes gets
  // its new picture with a bounce; what goes, goes; a banner says what it was
  pop(s, fast) {
    if (s.popped) return;
    s.popped = true;
    const c = this.stepAt(s);
    for (const th of s.things) for (const img of th.imgs) {
      if (!img.active) continue;
      img.setVisible(true);
      img.held = null;
      if (fast) continue;
      const delay = Math.min(500, Math.hypot(img.x / TILE - c.x, img.y / TILE - c.y) * 30);
      if (th.how === 'fade') {
        const a = img.alpha;
        img.setAlpha(0);
        this.tweens.add({ targets: img, alpha: a, duration: 450, delay });
        continue;
      }
      const sx = img.scaleX, sy = img.scaleY, b = img.getBounds();
      img.setScale(sx * 0.4, sy * 0.05);
      this.tweens.add({ targets: img, scaleX: sx, scaleY: sy, duration: 420, delay, ease: 'Back.out' });
      if (b.width * b.height > 60) this.time.delayedCall(delay + 120, () => this.spark.explode(Math.min(28, 6 + Math.round(b.width * b.height / 140)), b.centerX, b.centerY));
    }
    for (const sw of s.swaps) {
      if (!sw.img.active) continue;
      sw.img.setTexture(sw.key);
      if (fast) continue;
      const sx = sw.img.scaleX, sy = sw.img.scaleY, b = sw.img.getBounds();
      sw.img.setScale(sx * 1.08, sy * 0.8);
      this.tweens.add({ targets: sw.img, scaleX: sx, scaleY: sy, duration: 480, ease: 'Back.out' });
      this.spark.explode(30, b.centerX, b.centerY);
      this.leaves.explode(10, b.centerX, b.bottom - 4);
    }
    for (const img of s.gone) {
      if (!img.active) continue;
      if (fast) { img.destroy(); continue; }
      this.tweens.add({ targets: img, alpha: 0, scaleY: img.scaleY * 0.2, duration: 300, ease: 'Quad.in', onComplete: () => img.destroy() });
    }
    s.after.forEach(f => f(fast));
    if (s.banner && !fast) this.hooks.onGrow?.(s.banner);
  }

  // a tap during the show: everything comes up at once, and back to you
  skipShow() {
    const list = this.showing;
    if (!list) return;
    this.showTimers.forEach(e => e.remove(false));
    for (const s of list) {
      this.melt(s, true);
      this.pop(s, true);
      if (s.folk) this.arrive(s.folk, true);
    }
    this.endShow(true);
  }
  endShow(fast) {
    this.showing = null;
    const cam = this.cameras.main, follow = () => cam.startFollow(this.ps, true, 0.2, 0.2, 0, TILE / 2);
    if (fast) { cam.panEffect.reset(); follow(); return; }
    cam.pan(this.ps.x, this.ps.y - TILE / 2, 600, 'Sine.easeInOut', true, (c, k) => { if (k === 1) follow(); });
  }

  // The last pieces, which are not things on a tile: a flag on every roof (P37), fireworks (P39), and
  // the festival (P40), when the heroes at home run over to dance round the maypole.
  festival() {
    const P = this.st.P, was = this.growth?.was;
    const fresh = n => was && was.P < n;
    if (P >= 37) {
      const roofs = [...HOUSES.filter(h => h.lived && h.id !== 'guild').map(h => h.img), ...this.buildings.map(b => b.img)];
      if (ownsHome(this.meta)) roofs.push(this.homeImg);
      roofs.forEach((img, k) => {
        const top = this.roofTop(img.finalKey || img.texture.key), v = k % 4;
        const flag = this.keep(this.add.image(img.x + top.dx, img.y + top.dy + 1, this.growthKey('flag', v * 2)).setOrigin(0.5, 1).setDepth(img.depth + 0.0005));
        this.flags.push({ img: flag, v });
        const key = img.held || (fresh(37) ? 'p37' : null);
        if (key) this.holdAt(key, [flag]);
      });
    }
    if (P >= 39) {
      if (fresh(39)) this.turn('p39').after.push(() => { this.fireworks = true; this.nextFirework = 0; });
      else this.fireworks = true;
    }
    if (P >= GROWN && fresh(GROWN)) this.turn(`p${GROWN}`).after.push(fast => { this.fest = true; this.gather(fast); });
  }

  // the highest point of a house's picture, round the middle: where its festival flag goes
  roofTop(key) {
    this.roofs = this.roofs || {};
    if (this.roofs[key]) return this.roofs[key];
    const src = this.textures.get(key).getSourceImage(), W = src.width, H = src.height;
    let top = { x: W / 2, y: 0 };
    const g = src.getContext?.('2d');
    if (g) {
      const d = g.getImageData(0, 0, W, H).data, x0 = Math.floor(W * 0.3), x1 = Math.ceil(W * 0.7);
      find: for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) if (d[(y * W + x) * 4 + 3] > 0) { top = { x, y }; break find; }
    }
    return (this.roofs[key] = { dx: top.x + 0.5 - W / 2, dy: top.y - H });
  }

  // the festival starts: the heroes at home hurry over to the maypole
  gather(fast) {
    for (const h of this.heroes) {
      const spot = this.freeNear(MAYPOLE, 4);
      if (!spot) continue;
      if (!fast) this.spark.explode(8, h.s.x, h.s.y - 6);
      h.x = spot.x; h.y = spot.y;
      h.s.setPosition(center(spot.x), foot(spot.y)).setDepth(D.actors + spot.y / 100);
      if (!fast) this.spark.explode(12, h.s.x, h.s.y - 6);
    }
  }

  // a rocket goes up somewhere in view and bursts into little stars
  firework(view) {
    const x = Math.round(view.x + view.width * (0.2 + Math.random() * 0.6)), y = Math.round(view.y + view.height * (0.12 + Math.random() * 0.2));
    const tint = [0xf4cf4f, 0xf29bb2, 0x9fc2ff, 0xfff7f0, 0xa6df6e][Math.floor(Math.random() * 5)];
    const r = this.keep(this.add.image(x, y + 56, 'px').setScale(1.3).setDepth(D.bubble - 0.5).setTint(0xfff3b0));
    this.tweens.add({
      targets: r, y, duration: 650, ease: 'Quad.out',
      onComplete: () => { r.destroy(); this.burst.setParticleTint(tint); this.burst.explode(22, x, y); },
    });
  }

  // One villager's (or a hero's) habit, by who they are: the guild master mulls over requests, the
  // shopkeeper flips a coin, the smith hammers, the neighbour hums, the rescuer keeps watch, the rival
  // flexes; the heroes do what they do in the fields when it is quiet.
  habit(id, s, time) {
    const tw = cfg => this.tweens.add({ targets: s, ...cfg });
    switch (id) {
      case 'guild':
        setEmote(s, '…', time, 1400);
        this.time.delayedCall(900, () => tw({ sy: 0.9, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.out' }));
        break;
      case 'shop': {
        const c = this.keep(this.add.image(s.x + 3, s.y - TILE + 2, 'coin').setDepth(D.fx));
        this.tweens.add({ targets: c, y: c.y - 12, duration: 260, yoyo: true, ease: 'Quad.out', onComplete: () => { c.destroy(); setEmote(s, '♪', this.time.now, 1000); } });
        this.tweens.add({ targets: c, scaleX: 0.1, duration: 90, yoyo: true, repeat: 2 });
        break;
      }
      case 'smith':
        for (let i = 0; i < 3; i++) this.time.delayedCall(i * 260, () => {
          tw({ sy: 0.86, sx: 1.06, duration: 80, yoyo: true, ease: 'Quad.out' });
          this.spark.explode(5, s.x + (s.flipX ? -7 : 7), s.y - 5);
        });
        break;
      case 'neighbor':
        setEmote(s, Math.random() < 0.5 ? '♪' : '…', time, 1300);
        tw({ hop: 3, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.out' });
        break;
      case 'rescue':
        for (let i = 0; i < 4; i++) this.time.delayedCall(i * 280, () => s.setFlipX(!s.flipX));
        this.time.delayedCall(1150, () => setEmote(s, '!', this.time.now, 900));
        break;
      case 'rival':
        setEmote(s, 'anger', time, 1200);
        tw({ sx: 1.12, sy: 1.08, duration: 200, yoyo: true, hold: 350, ease: 'Back.out' });
        break;
      case 'adv': tw({ sy: 1.12, sx: 0.94, duration: 260, yoyo: true, hold: 250, ease: 'Sine.inOut' }); setEmote(s, '♪', time, 1200); break;
      case 'rogue':
        tw({ sy: 0.8, sx: 1.08, duration: 160, yoyo: true, hold: 600, ease: 'Quad.out' });
        this.time.delayedCall(250, () => s.setFlipX(!s.flipX));
        this.time.delayedCall(650, () => s.setFlipX(!s.flipX));
        break;
      case 'mage':
        tw({ hop: 5, duration: 500, yoyo: true, hold: 400, ease: 'Sine.inOut' });
        this.time.delayedCall(300, () => this.spark.explode(6, s.x, s.y - 4));
        break;
      case 'knight': tw({ sx: 1.1, sy: 1.07, duration: 220, yoyo: true, hold: 400, ease: 'Back.out' }); break;
      case 'vamp': tw({ hop: 4, duration: 180, yoyo: true, repeat: 3, ease: 'Sine.inOut' }); setEmote(s, '♪', time, 1200); break;
      // the festival: a hop and a twirl round the maypole
      case 'dance':
        tw({ hop: 5, duration: 160, yoyo: true, repeat: 1, ease: 'Quad.out' });
        this.time.delayedCall(330, () => s.setFlipX(!s.flipX));
        setEmote(s, '♪', time, 1100);
        break;
    }
  }

  // the pieces of 집 꾸미기 bought so far, each on its own tiles round the house; `fresh`: the one
  // just bought, which pops in with sparkles
  placeDecor(fresh) {
    if (!ownsHome(this.meta)) return;
    for (const d of DECOR) {
      if (!hasDecor(this.meta, d.id) || this.decor[d.id]) continue;
      // (the 텃밭 grows a column with 텃밭 넓히기: scenes/village-life.js)
      const wide = d.id === 'garden' && plotCount(this.meta) > GARDEN_BASE, at = wide ? [...d.at, ...GARDEN_MORE] : d.at;
      const key = wide ? 'decor_garden_wide' : `decor_${d.id}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, wide ? bedArt(3) : decorCanvas(d.id));
      const x0 = Math.min(...at.map(a => a[0])), y1 = Math.max(...at.map(a => a[1]));
      const img = this.keep(this.add.image(x0 * TILE, foot(y1), key).setOrigin(0, 1).setDepth(D.actors + y1 / 100));
      for (const [x, y] of at) this.blocked[y * MW + x] = 1;
      if (this.pup && d.at.some(([x, y]) => x === this.pup.x && y === this.pup.y)) this.movePup(PUP.x, PUP.y);
      if (this.p && d.at.some(([x, y]) => x === this.p.x && y === this.p.y)) {
        const door = doorOf(HOME);
        this.p.x = door.x; this.p.y = door.y;
        this.ps.setPosition(center(door.x), foot(door.y)).setDepth(D.actors + door.y / 100);
      }
      this.decor[d.id] = img;
      if (d.id === 'statue') this.tweens.add({ targets: img, alpha: 0.82, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (d.id === 'dog') this.placePup();
      if (d.id === 'garden' && this.plots) drawBed(this);
      if (d.id === fresh) {
        const cx = img.x + img.width / 2, cy = img.y - img.height / 2;
        this.spark.explode(30, cx, cy);
        img.setScale(0.2);
        this.tweens.add({ targets: img, scale: 1, duration: 320, ease: 'Back.out' });
      }
    }
  }

  // a piece just bought: the camera drifts over, it pops up with sparkles, you cheer, back to you
  showDecor(id) {
    const d = DECOR.find(o => o.id === id);
    if (!d) return;
    const cam = this.cameras.main;
    const cx = (Math.min(...d.at.map(a => a[0])) + Math.max(...d.at.map(a => a[0])) + 1) / 2 * TILE;
    const cy = (Math.min(...d.at.map(a => a[1])) + Math.max(...d.at.map(a => a[1]))) / 2 * TILE;
    cam.stopFollow();
    cam.pan(cx, cy, 450, 'Sine.easeInOut');
    this.time.delayedCall(500, () => {
      this.placeDecor(id);
      this.ps.expr = 'sparkle';
      this.ps.exprUntil = this.time.now + 1400;
      this.tweens.add({ targets: this.ps, hop: 5, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.out' });
      this.say(this.ps, '짠!', 1300);
    });
    this.time.delayedCall(1700, () => cam.pan(this.ps.x, this.ps.y - TILE / 2, 450, 'Sine.easeInOut', false, (c, k) => {
      if (k === 1) cam.startFollow(this.ps, true, 0.2, 0.2, 0, TILE / 2);
    }));
  }

  // the carpenter built on (ui/hub.js): the camera goes over, and the house in the village puffs up
  // into its bigger self
  showHomeGrow() {
    const key = this.houseKey(HOME, true, houseLevel(this.meta)), img = this.homeImg, cam = this.cameras.main;
    if (!img || !ownsHome(this.meta) || img.texture.key === key) return;
    cam.stopFollow();
    cam.pan(img.x, img.y - TILE * 2, 450, 'Sine.easeInOut');
    this.time.delayedCall(500, () => {
      this.spark.explode(40, img.x, img.y - img.height / 2);
      this.tweens.add({
        targets: img, scaleX: 1.08, scaleY: 0.9, duration: 120, yoyo: true, ease: 'Quad.out',
        onYoyo: () => img.setTexture(key),
        onComplete: () => img.setScale(1),
      });
      this.ps.expr = 'sparkle';
      this.ps.exprUntil = this.time.now + 1400;
      this.tweens.add({ targets: this.ps, hop: 5, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.out' });
      this.say(this.ps, '우와, 집이 커졌다!', 1500);
    });
    this.time.delayedCall(2000, () => cam.pan(this.ps.x, this.ps.y - TILE / 2, 450, 'Sine.easeInOut', false, (c, k) => {
      if (k === 1) cam.startFollow(this.ps, true, 0.2, 0.2, 0, TILE / 2);
    }));
  }

  // the dog house's puppy pads about the yard; bump it and it hops
  placePup() {
    if (this.pup) return;
    if (!this.textures.exists('home_pup')) this.textures.addCanvas('home_pup', pupCanvas());
    const { x, y } = PUP;
    const s = this.keep(this.add.image(center(x), foot(y), 'home_pup').setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    s.setScale(TILE * 0.8 / s.height);
    s.hop = 0;
    this.pup = { x, y, s, next: 0, pup: true };
  }
  movePup(x, y) {
    Object.assign(this.pup, { x, y });
    this.pup.s.setPosition(center(x), foot(y)).setDepth(D.actors + y / 100);
  }

  // a few bits of sparkle-stone dropped in the grass, away from the paths; you only see them twinkle
  // now and then, so you have to wander a little to spot one
  hideFinds(n) {
    this.finds = [];
    for (let tries = 0; tries < 200 && this.finds.length < n; tries++) {
      const x = 1 + Math.floor(Math.random() * (MW - 2)), y = 1 + Math.floor(Math.random() * (MH - 2));
      if (!grassy(this.ch(x, y)) || !this.walkable(x, y) || this.isNew(x, y) || this.finds.some(f => Math.abs(f.x - x) + Math.abs(f.y - y) < 8)) continue;
      if (Math.abs(x - this.p.x) + Math.abs(y - this.p.y) < 6) continue;
      const img = this.keep(this.add.image(center(x), center(y) + 2, 't_chip_copper').setDepth(D.deco).setAlpha(0.85));
      this.finds.push({ x, y, img, next: 0 });
    }
  }

  // stepping onto one: it pops up into your pocket
  pickUp(f) {
    this.finds = this.finds.filter(o => o !== f);
    const n = 2 + Math.floor(Math.random() * 4);
    this.spark.explode(16, f.img.x, f.img.y);
    this.tweens.add({ targets: f.img, y: f.img.y - 14, alpha: 0, duration: 380, ease: 'Quad.out', onComplete: () => f.img.destroy() });
    const k = this.dpr / (this.cameras.main.zoom || 3);
    const t = this.keep(this.add.text(f.img.x, f.img.y - 8, `+${n}G`, {
      fontFamily: 'Galmuri14, sans-serif', fontSize: `${15 * k}px`, color: '#f4cf4f', stroke: '#1b1424', strokeThickness: 3 * k,
    }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(this.cameras.main.zoom || 3));
    this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, delay: 350, duration: 700, ease: 'Quad.in' });
    this.ps.expr = 'sparkle';
    this.ps.exprUntil = this.time.now + 900;
    this.hooks.onFind?.(n);
  }

  // the heroes you have but did not pick today hang about in the meadow
  placeHeroes() {
    for (const id of Object.keys(CHARACTERS).filter(c => this.meta.chars[c] && c !== this.p.id)) {
      const spot = (this.fest && this.freeNear(MAYPOLE, 4)) || this.freeGrassTile();
      if (!spot) break;
      this.heroes.push({ id, x: spot.x, y: spot.y, s: this.actor(CHARACTERS[id].sprite, spot.x, spot.y), next: 0 });
    }
  }

  // seeds in from the seed sheet (ui/life.js)
  plantSeeds(crop, idxs) { return plantSeeds(this, crop, idxs); }
  // the rival's race (from the rival's sheet), and Space for the games (main.js)
  startRace() { return startRace(this); }
  playKey(repeat) { return !this.showing && !!this.ps && playKey(this, repeat); }
  // the shop sold you 텃밭 넓히기: the bed takes in its new column
  widenBed() {
    const img = this.decor?.garden;
    if (!img || img.texture.key === 'decor_garden_wide' || plotCount(this.meta) <= GARDEN_BASE) return;
    img.destroy();
    delete this.decor.garden;
    this.placeDecor('garden');
  }

  // after the guild changed who goes out today, or took someone new on
  resync() {
    this.widenBed();
    if (!this.ps || (this.p.id === this.meta.sel && this.heroes.length === Object.keys(this.meta.chars).filter(c => this.meta.chars[c]).length - 1)) return;
    this.heroes.forEach(h => h.s.destroy());
    this.heroes = [];
    this.p.id = this.meta.sel;
    this.ps.setTexture(CHARACTERS[this.p.id].sprite);
    this.placeHeroes();
  }

  houseKey(h, lived, lvl = 0) {
    const key = `house_${h.id}_${lived ? 1 : 0}_${lvl}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, houseCanvas(h, lived, lvl));
    return key;
  }

  clear() {
    this.time.removeAllEvents();
    // nothing may finish moving something that is about to go
    this.tweens.killAll();
    this.objs.forEach(o => o.destroy());
    this.objs = [];
    this.bubbles.forEach(b => b.destroy());
    this.bubbles = [];
    this.waterImgs = [];
    this.glows = [];
    this.glints = [];
    this.rays = null;
    this.finds = [];
    this.pending = null;
    this.props = [];
    this.twinkles = [];
    this.floaters = [];
    this.flags = [];
    this.buildings = [];
    this.sails = this.maypole = this.fountain = this.campfire = null;
    this.steps = new Map();
    this.showing = null;
    this.showTimers = [];
    this.fireworks = this.fest = false;
    this.cameras.main.panEffect.reset();
    // 비밀 (scenes/village-secrets.js): what you have been poking at, and what has already happened this visit
    this.treeImgs = new Map();
    this.pokes = { key: null, n: 0, t: 0 };
    this.catOut = this.doorOpen = this.cookieGiven = false;
    this.pets = this.still = 0;
    // 마을 생활 (scenes/village-life.js)
    this.fishing = null;
    this.lifeBugs = [];
    this.lifeWild = [];
    this.plots = [];
    this.petS = null;
    // 마을 놀이 (scenes/village-play.js)
    this.play = this.stones = this.swingRest = null;
  }

  keep(o) { this.objs.push(o); return o; }

  // what a cell is today (chIn)
  ch(x, y) { return chIn(this.open, this.st, x, y); }

  // One cell of ground. Everything that never moves is baked into one picture (bakeGround); only the
  // water (it ripples) and what floats on it are images of their own.
  drawTile(x, y) {
    const ch = this.ch(x, y);
    const around = test => (test(x, y - 1) && N) | (test(x + 1, y) && E) | (test(x, y + 1) && S) | (test(x - 1, y) && W_) |
      (test(x + 1, y - 1) && NE) | (test(x + 1, y + 1) && SE) | (test(x - 1, y + 1) && SW) | (test(x - 1, y - 1) && NW);
    const add = (key, depth = D.tiles, dy = 0) => this.ground.push({ key, x: x * TILE, y: y * TILE + dy, depth });
    const hedge = (nx, ny) => this.ch(nx, ny) === '#' && !this.grove(nx, ny);
    if (ch === '#' && this.grove(x, y)) { add(floorKey(HOME_ZI, hash(x, y) & 31)); return; } // grass under a lone tree (plantTrees)
    if (ch === '#') {
      const open = around((nx, ny) => !hedge(nx, ny)), hb = hash(x * 7 + 3, y * 11 + 5);
      add(wallKey(this, HOME_ZI, open, hash(x + 99, y + 99) % 3));
      // flowers peeping out of the top of the hedge
      if (!(open & S) && hb % 100 < 30) add(bloomKey(this, VILLAGE_GROUND, HOME_ZI, (hb >> 8) % BLOOM_VARIANTS), D.tiles + 0.5);
      return;
    }
    if ((ch === '~' || ch === '=') && this.baking) {
      // the old look (overlayOld) is one still picture
      const shore = around((nx, ny) => !'~='.includes(this.ch(nx, ny)));
      if (roundedWater(shore)) add(floorKey(HOME_ZI, hash(x, y) & 31));
      add(waterKey(this, HOME_ZI, 0, shore, false, null, true));
      if (ch === '~' && hash(x, y) % 9 === 0) add(`t_lily${hash(x, y) % 2}`, D.deco);
      if (ch === '=') add(this.growthKey('bridge', '~'.includes(this.ch(x, y - 1)) || '~'.includes(this.ch(x, y + 1)) ? 0 : 1), D.deco + 0.1);
      return;
    }
    if (ch === '~') {
      const shore = around((nx, ny) => !'~='.includes(this.ch(nx, ny)));
      const img = this.keep(this.add.image(x * TILE, y * TILE, waterKey(this, HOME_ZI, 0, shore, false, null, true)).setOrigin(0).setDepth(D.tiles + 0.2));
      img.shore = shore;
      img.round = true;
      this.waterImgs.push(img);
      if (x >= 0 && y >= 0 && hash(x, y) % 9 === 0) this.keep(this.add.image(x * TILE, y * TILE, `t_lily${hash(x, y) % 2}`).setOrigin(0).setDepth(D.deco));
      return;
    }
    if (ch === '=') {
      // a plank bridge over the stream, the water running underneath
      const shore = around((nx, ny) => !'~='.includes(this.ch(nx, ny)));
      const img = this.keep(this.add.image(x * TILE, y * TILE, waterKey(this, HOME_ZI, 0, shore)).setOrigin(0).setDepth(D.tiles + 0.2));
      img.shore = shore;
      this.waterImgs.push(img);
      const across = '~'.includes(this.ch(x, y - 1)) || '~'.includes(this.ch(x, y + 1)) ? 'h' : 'v';
      this.keep(this.add.image(x * TILE, y * TILE, this.growthKey('bridge', across === 'h' ? 0 : 1)).setOrigin(0).setDepth(D.deco + 0.1));
      return;
    }
    const pathy = (nx, ny) => ':>='.includes(this.ch(nx, ny));
    if (pathy(x, y)) add(pathKey(this, around((nx, ny) => !pathy(nx, ny)) & (N | E | S | W_), this.st.P >= COBBLE_P));
    else add(ch === '*' ? `z${HOME_ZI}_floor${4 + (hash(x, y) % 3)}` : floorKey(HOME_ZI, hash(x, y) & 31)); // '*': daisies, pink flowers, buttercups
    const shade = around(hedge) & (N | E | W_ | NE | NW);
    if (shade) add(shadeKey(this, shade));
    if (grassy(ch)) this.decorate(x, y, add, hedge);
    if (ch === '>') add('t_stairs', D.deco);
  }

  // pictures drawn once into one canvas, in depth order (`box`: the tiles it covers)
  bake(ops, key, box, depth) {
    const W = (box.x1 - box.x0 + 1) * TILE, H = (box.y1 - box.y0 + 1) * TILE, ox = -box.x0 * TILE, oy = -box.y0 * TILE;
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, W, H), g = tex.getContext();
    g.imageSmoothingEnabled = false;
    ops.sort((a, b) => a.depth - b.depth);
    for (const o of ops) {
      const f = this.textures.getFrame(o.key);
      if (f) g.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, o.x + ox, o.y + oy, f.cutWidth, f.cutHeight);
    }
    tex.refresh();
    return this.keep(this.add.image(box.x0 * TILE, box.y0 * TILE, key).setOrigin(0).setDepth(depth));
  }

  // Flowers, clover and pebbles in the grass (field-decor.js, in the daytime colours): thick in the
  // flower beds ('*') and in patches here and there, a band of leaves and flowers along the hedge's foot.
  decorate(x, y, add, hedge) {
    const z = VILLAGE_GROUND, zi = HOME_ZI, h = hash(x * 3 + 11, y * 5 + 7);
    if (hedge(x, y - 1)) { add(footKey(this, z, zi, h % FOOT_VARIANTS), D.tiles + 0.5, -FOOT_UP); return; }
    if (this.ch(x, y) === '*' || patchNoise(x, y, 5) > 0.62) add(patchKey(this, z, zi, (h >> 12) % PATCH_VARIANTS), D.tiles + 0.5);
    else if ((h >> 9) % 100 < 40) add(scatterKey(this, z, zi, (h >> 12) % SCATTER_VARIANTS), D.tiles + 0.5);
  }

  // The odds and ends round the village (data/village.js PROPS): each stands on its tile(s) like a house,
  // except the few hung over the paths (WALK), which you walk under. The lamps glow; strings of flags
  // and lanterns hang from one point to another; the big tree's lights and the pond's lanterns twinkle.
  // One that something has taken the place of since last time (the campfire, under the fountain) is
  // still there when you arrive, and goes in the show.
  placeProps() {
    for (const pr of PROPS) {
      const now = shownIn(pr, this.st), then = !!this.growth && shownIn(pr, this.growth.was);
      if (!now && !then) continue;
      const imgs = [], put = img => { imgs.push(img); return this.keep(img); };
      const cells = propCells(pr);
      const x1 = pr.x + Math.max(...cells.map(c => c[0])), y1 = pr.y + Math.max(...cells.map(c => c[1]));
      let how = 'grow';
      switch (pr.kind) {
        case 'lamp': {
          if (!this.textures.exists('village_post')) this.textures.addCanvas('village_post', lampPostCanvas());
          put(this.add.image(center(pr.x), foot(pr.y), 'village_post').setOrigin(0.5, 1).setDepth(D.actors + pr.y / 100));
          this.glows.push(put(this.add.image(center(pr.x) - 1, foot(pr.y) - 14, 'glow').setDepth(D.fx).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6)));
          break;
        }
        case 'bigtree': break;   // plantBigTree
        case 'bunting': case 'lanterns': {
          // the flags hang between two poles of their own; the lanterns between two lamp posts
          const span = pr.to[0] - pr.x, key = `village_${pr.kind}_${span}`;
          if (!this.textures.exists(key)) this.textures.addCanvas(key, stringCanvas(pr.kind, span * TILE));
          put(this.add.image(center(pr.x) - STRING_PAD, foot(pr.y) - 3, key).setOrigin(0, 1).setDepth(D.fx - 0.3));
          how = 'fade';
          break;
        }
        case 'lights': {
          // little lights strung through the big tree's crown, each twinkling on its own
          const c = BIG_TREE.crown;
          for (let k = 0; k < 26; k++) {
            const x = (c.x0 + 0.5 + Math.random() * (c.x1 - c.x0)) * TILE, y = (c.y0 + 1 + Math.random() * (c.y1 - c.y0 - 2)) * TILE;
            this.twinkles.push(put(this.add.image(Math.round(x), Math.round(y), 'px').setScale(1.4).setDepth(D.actors + BIG_TREE.y / 100 + 0.003)
              .setTint([0xfff3b0, 0xffd0e0, 0xc8f0ff, 0xffffff][k % 4]).setAlpha(0.3)));
          }
          break;
        }
        case 'pondlanterns': {
          const pond = this.pondTiles || [];
          for (let k = 0; k < Math.min(6, pond.length); k++) {
            const t = pond[Math.floor((k + 0.5) / 6 * pond.length)];
            const img = put(this.add.image(center(t.x), center(t.y), this.growthKey('pondlantern', k % 2)).setDepth(D.deco + 0.7));
            const glow = put(this.add.image(img.x, img.y - 2, 'glow').setDepth(D.fx).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setScale(0.7));
            this.glows.push(glow);
            this.floaters.push({ img, x: img.x, y: img.y, seed: k * 1.7 }, { img: glow, x: glow.x, y: glow.y - 0, seed: k * 1.7 });
          }
          break;
        }
        default: {
          const key = GROWTH_PROPS[pr.kind] ? this.growthKey(pr.kind, pr.v || 0) : `village_prop_${pr.kind}`;
          if (!GROWTH_PROPS[pr.kind] && !this.textures.exists(key)) this.textures.addCanvas(key, propCanvas(pr.kind));
          // the flower beds lie flat; the arches and the fair's gate go over your head
          const over = pr.kind === 'arch' || pr.kind === 'gate', flat = WALK.has(pr.kind) && !over;
          const img = put(this.add.image((pr.x + x1 + 1) / 2 * TILE, foot(y1), key).setOrigin(0.5, 1).setDepth(flat ? D.deco : over ? D.fx - 0.4 : D.actors + y1 / 100));
          if (pr.kind === 'fountain') this.fountain = img;
          if (pr.kind === 'maypole') this.maypole = img;
          if (pr.kind === 'balloon') this.floaters.push({ img, x: img.x, y: img.y, seed: 3, big: true });
        }
      }
      if (!imgs.length) continue;
      if (!now) { this.turn(`p${pr.until}`).gone.push(...imgs); continue; }
      this.props.push({ pr, imgs });
      if (!WALK.has(pr.kind)) for (const [i, j] of cells) this.blocked[(pr.y + j) * MW + pr.x + i] = 1;
      // the flags' poles
      if (pr.kind === 'bunting') for (const [x, y] of [[pr.x, pr.y], pr.to]) this.blocked[y * MW + x] = 1;
      this.hold(pr, imgs, how);
    }
  }

  // a picture from scenes/village-growth-art.js, made once
  growthKey(kind, v = 0) {
    const key = `village_g_${kind}_${v}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, growthPropCanvas(kind, v));
    return key;
  }

  // the windmill's sails turn slowly over its cap (a picture for each step, so they stay pixel-sharp)
  placeSails(b) {
    const [dx, dy] = SAILS_AT;
    this.sails = this.keep(this.add.image(b.x * TILE + dx, (b.y + b.h) * TILE + dy, this.growthKey('sails', 0)).setDepth(D.actors + (b.y + b.h - 1) / 100 + 0.002));
    return this.sails;
  }

  // Little lives about the place: butterflies over the grass, a duck and her ducklings on the pond,
  // sparrows hopping about that fly off when you come too close, petals drifting down.
  placeLife() {
    const tex = (key, make) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, make()); return key; };
    const wings = ['#ffffff', '#ffe066', '#ffb0c8', '#b8d8ff'];
    this.flutters = wings.concat(wings).slice(0, 7).map((w, i) => {
      const k0 = tex(`vfly0_${i % 4}`, () => critterCanvas('fly0', w)), k1 = tex(`vfly1_${i % 4}`, () => critterCanvas('fly1', w));
      const spot = this.freeGrassTile() || { x: 20, y: 12 };
      return { img: this.keep(this.add.image(center(spot.x), center(spot.y), k0).setDepth(D.fx - 0.2)), k0, k1, x: center(spot.x), y: center(spot.y), a: Math.random() * 6.3, seed: i * 1.3 };
    });
    const pond = this.pondTiles || [];
    this.ducks = [];
    if (pond.length) {
      const t = pond[Math.floor(pond.length / 2)];
      const mk = (name, n) => ({ img: this.keep(this.add.image(center(t.x) - n * 7, center(t.y), tex(`v_${name}`, () => critterCanvas(name))).setDepth(D.deco + 0.6)), x: center(t.x) - n * 7, y: center(t.y) });
      this.ducks = [mk('duck', 0), mk('duckling', 1), mk('duckling', 2)];
      this.duckGoal = null;
      if (this.isNew(t.x, t.y)) this.holdAt(this.cellTrig(t.x, t.y), this.ducks.map(d => d.img), 'fade');
    }
    this.birds = [];
    tex('v_bird1', () => critterCanvas('bird1'));
    for (let k = 0; k < 4; k++) {
      const spot = this.freeGrassTile();
      if (!spot) continue;
      const img = this.keep(this.add.image(center(spot.x) + (k % 2 ? 3 : -3), foot(spot.y) - 3, tex('v_bird0', () => critterCanvas('bird0'))).setOrigin(0.5, 1).setDepth(D.actors + spot.y / 100));
      this.birds.push({ img, x: spot.x, y: spot.y, next: 0, gone: 0 });
    }
    this.motes = moteKeys(this, 'meadow').map((key, i) => ({ img: this.keep(this.add.image(0, 0, key).setOrigin(0).setDepth(D.fx).setAlpha(0.9)), x: 0, y: -999, seed: i * 2.1 }))
      .concat(moteKeys(this, 'meadow').map((key, i) => ({ img: this.keep(this.add.image(0, 0, key).setOrigin(0).setDepth(D.fx).setAlpha(0.9)), x: 0, y: -999, seed: i * 1.7 + 4 })));
  }

  moveLife(time, dt) {
    const s = dt / 1000, view = this.cameras.main.worldView;
    for (const f of this.flutters || []) {
      // (one that has taken you for a flower comes and circles you: scenes/village-secrets.js)
      if (flutterTo(this, f, time, s)) continue;
      // a wandering heading, a bob, and wings that beat
      f.a += (Math.sin(time / 900 + f.seed * 3) * 1.6) * s;
      f.x += Math.cos(f.a) * 14 * s; f.y += Math.sin(f.a) * 10 * s + Math.sin(time / 160 + f.seed) * 0.25;
      const b = this.openBox;
      if (f.x < (b.x0 + 1) * TILE || f.x > b.x1 * TILE || f.y < (b.y0 + 1) * TILE || f.y > b.y1 * TILE) f.a += Math.PI * s * 4;
      f.img.setTexture(Math.floor(time / 110 + f.seed * 5) % 2 ? f.k0 : f.k1).setPosition(Math.round(f.x), Math.round(f.y));
    }
    // the duck paddles to a spot on the pond, the ducklings in a line behind her
    const d = this.ducks || [];
    if (d.length) {
      if (!this.duckGoal || Math.hypot(this.duckGoal.x - d[0].x, this.duckGoal.y - d[0].y) < 2) {
        const t = this.pondTiles[Math.floor(Math.random() * this.pondTiles.length)];
        this.duckGoal = { x: center(t.x) + (Math.random() - 0.5) * 8, y: center(t.y) + (Math.random() - 0.5) * 6 };
      }
      const lead = d[0], gx = this.duckGoal.x - lead.x, gy = this.duckGoal.y - lead.y, gl = Math.hypot(gx, gy) || 1;
      lead.x += gx / gl * 5 * s; lead.y += gy / gl * 5 * s;
      if (Math.abs(gx) > 0.5) lead.img.setFlipX(gx > 0);
      for (let i = 1; i < d.length; i++) {
        const a = d[i - 1], b = d[i], dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1;
        if (l > 7) { b.x += dx / l * (l - 7); b.y += dy / l * (l - 7); }
        if (Math.abs(dx) > 0.5) b.img.setFlipX(dx > 0);
      }
      d.forEach((one, i) => one.img.setPosition(Math.round(one.x), Math.round(one.y + Math.sin(time / 400 + i) * 0.6)));
    }
    // sparrows: a hop now and then; too close and they are off, back somewhere else in a while
    for (const b of this.birds || []) {
      if (b.gone) {
        if (time < b.gone) { b.img.y -= 60 * s; b.img.x += (b.img.flipX ? 40 : -40) * s; continue; }
        const spot = this.freeGrassTile();
        if (!spot) continue;
        b.gone = 0; b.x = spot.x; b.y = spot.y;
        b.img.setPosition(center(spot.x), foot(spot.y) - 3).setDepth(D.actors + spot.y / 100).setVisible(true);
        continue;
      }
      if (Math.max(Math.abs(b.x - this.p.x), Math.abs(b.y - this.p.y)) <= 1) {
        b.gone = time + 2500 + Math.random() * 6000;
        b.img.setFlipX(b.x > this.p.x ? false : true).setTexture('v_bird1').setDepth(D.fx);
        this.time.delayedCall(1500, () => b.img.setVisible(false));
        continue;
      }
      if (time > b.next) {
        b.next = time + 700 + Math.random() * 1800;
        b.img.setTexture(Math.random() < 0.5 ? 'v_bird0' : 'v_bird1').setFlipX(Math.random() < 0.5);
        const nx = b.img.x + (Math.random() - 0.5) * 6;
        if (Math.abs(nx - center(b.x)) < 6) this.tweens.add({ targets: b.img, x: Math.round(nx), y: b.img.y - 2, duration: 90, yoyo: true });
      }
    }
    // petals drifting down across the view
    for (const m of this.motes || []) {
      if (m.y < view.y - 20 || m.y > view.bottom + 4 || m.x > view.right + 20) { m.x = view.x - 10 + Math.random() * (view.width + 10); m.y = view.y - 4 - Math.random() * 30; m.vx = 3 + Math.random() * 6; m.vy = 7 + Math.random() * 7; }
      const t = time / 1000 + m.seed;
      m.x += (m.vx + Math.sin(t * 1.5) * 7) * s; m.y += m.vy * s;
      m.img.setPosition(Math.round(m.x), Math.round(m.y));
    }
  }

  // The woods: round trees wherever the hedge is deep enough behind them to take the crown (so they
  // never hide a path), one over each little square of hedge inside the village, and the ones
  // standing in the grass ('T'). The border trees are plain and dark; the grass ones bear fruit or
  // blossom now and then. A tree with nothing but woods under it can never stand in front of anyone,
  // so it is baked into the ground; the rest stand up like everything else. `ch`: the map to plant on
  // (the woods as they were, for the bit that is about to melt away), `out`: where the ones that stand
  // up go.
  plantTrees(ch = (x, y) => this.ch(x, y), out = null) {
    const hedge = (x, y) => ch(x, y) === '#';
    const woods = (px, y, key) => {
      const f = this.textures.getFrame(key), x0 = Math.floor((px - f.cutWidth / 2) / TILE), x1 = Math.floor((px + f.cutWidth / 2 - 1) / TILE);
      const y0 = Math.floor((foot(y) - f.cutHeight) / TILE);
      for (let j = y0; j <= y; j++) for (let i = x0; i <= x1; i++) if (!hedge(i, j)) return false;
      return true;
    };
    const tree = (px, y, v) => {
      const key = treeKey(this, v), x = Math.floor(px / TILE), stand = () => this.keep(this.add.image(px, foot(y), key).setOrigin(0.5, 1).setDepth(D.actors + y / 100 + 0.001));
      if (out) { const k = out.wants(x, y); if (k) out.add(stand(), k); return; }
      if (woods(px, y, key)) {
        const f = this.textures.getFrame(key);
        this.ground.push({ key, x: Math.round(px - f.cutWidth / 2), y: foot(y) - f.cutHeight, depth: D.tiles + 0.8 + y / 1000 });
        return;
      }
      const img = stand();
      // one on ground that has just opened comes up in the show
      if (this.isNew(x, y)) this.holdAt(this.cellTrig(x, y), [img]);
      // the cells under its crown know it, to shake it when you poke them
      for (const tx of new Set([Math.floor((px - 1) / TILE), x])) for (const ty of [y - 1, y]) this.treeImgs.set(ty * MW + tx, img);
    };
    for (let gy = -PAD.y; gy < MH + PAD.y; gy += 2) for (let gx = -PAD.x + ((gy / 2) & 1); gx < MW + PAD.x; gx += 3) {
      const h = hash(gx + 500, gy + 500), x = gx + (h % 2), y = gy + ((h >> 3) % 2);
      let deep = true;
      for (let dy = -2; dy <= 0 && deep; dy++) for (let dx = -1; dx <= 1 && deep; dx++) if (!hedge(x + dx, y + dy)) deep = false;
      if (deep) tree(center(x), y, h % 5 < 2 ? 1 : 0);
    }
    if (out) return;
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      // a 2x2 square of hedge on its own: one big tree over it
      if (this.grove(x, y) && this.grove(x + 1, y) && this.grove(x, y - 1) && !hedge(x, y + 1) && !hedge(x - 1, y)) tree((x + 1) * TILE, y, 1);
      if (ch(x, y) === 'T') { const r = hash(x * 3 + 7, y * 5 + 1) % 10; tree(center(x), y, r < 5 ? 0 : r < 7 ? 2 : r < 9 ? 3 : 1); }
    }
  }

  // the big old tree: drawn at its trunk's foot, so everything north of the trunk is under its crown
  plantBigTree() {
    if (!this.textures.exists('village_bigtree')) this.textures.addCanvas('village_bigtree', bigTreeCanvas());
    const t = BIG_TREE;
    this.bigTree = this.keep(this.add.image(center(t.x), foot(t.y) + 2, 'village_bigtree').setOrigin(0.5, 1).setDepth(D.actors + t.y / 100 + 0.002));
    for (const [x, y] of t.block) this.blocked[y * MW + x] = 1;
  }
  underBigTree(x, y) { const c = BIG_TREE.crown; return x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1; }
  treeAt(x, y) { return this.treeImgs.get(y * MW + x); }

  // true for a cell of a little 2x2 square of hedge standing on its own in the grass: a tree grows there instead
  grove(x, y) {
    const hedge = (i, j) => this.ch(i, j) === '#';
    for (const [bx, by] of [[x, y], [x - 1, y], [x, y - 1], [x - 1, y - 1]]) {
      if (!(hedge(bx, by) && hedge(bx + 1, by) && hedge(bx, by + 1) && hedge(bx + 1, by + 1))) continue;
      let alone = true;
      for (let j = by - 1; j <= by + 2 && alone; j++) for (let i = bx - 1; i <= bx + 2 && alone; i++) {
        if ((i === bx || i === bx + 1) && (j === by || j === by + 1)) continue;
        if (hedge(i, j)) alone = false;
      }
      if (alone) return true;
    }
    return false;
  }

  // a flowering shrub against each side of a house, where there is grass for it (and nothing else)
  shrubs(h) {
    if (!this.textures.exists('village_shrub')) this.textures.addCanvas('village_shrub', shrubCanvas());
    const y = h.y + h.h - 1, out = [];
    for (const x of [h.x - 1, h.x + h.w]) {
      if (!grassy(this.ch(x, y)) || this.blocked[y * MW + x] || hash(x + 3, y + 9) % 4 === 0 || DECOR.some(d => d.at.some(([ax, ay]) => ax === x && ay === y))) continue;
      out.push(this.keep(this.add.image(center(x), foot(y), 'village_shrub').setOrigin(0.5, 1).setDepth(D.actors + y / 100)));
      this.blocked[y * MW + x] = 1;
    }
    return out;
  }

  // sunlight falling through the trees onto the pond, and a few glints on the water
  sunOnPond() {
    const pond = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (this.ch(x, y) === '~') pond.push({ x, y });
    this.pondTiles = pond;
    if (!pond.length) return;
    const x0 = Math.min(...pond.map(t => t.x)) - 2, x1 = Math.max(...pond.map(t => t.x)) + 2;
    const y0 = Math.min(...pond.map(t => t.y)) - 3, y1 = Math.max(...pond.map(t => t.y)) + 2;
    const key = `village_rays_${x1 - x0}_${y1 - y0}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, sunRaysCanvas((x1 - x0) * TILE, (y1 - y0) * TILE));
    this.rays = this.keep(this.add.image(x0 * TILE, y0 * TILE, key).setOrigin(0).setDepth(D.fx).setBlendMode(Phaser.BlendModes.ADD));
    if (!this.textures.exists('village_glint')) this.textures.addCanvas('village_glint', glintCanvas());
    for (let k = 0; k < 4; k++) this.glints.push(Object.assign(this.keep(this.add.image(0, 0, 'village_glint').setDepth(D.deco + 0.5).setAlpha(0)), { next: k * 500 }));
    const t = pond[0];
    if (this.isNew(t.x, t.y)) this.holdAt(this.cellTrig(t.x, t.y), [this.rays, ...this.glints], 'fade');
  }

  actor(tex, x, y) {
    const s = this.keep(this.add.image(center(x), foot(y), tex).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    s.hop = 0;
    return s;
  }

  // a free spot on the grass round the plaza, for the heroes at home, the sparrows, the butterflies
  // (never on ground that is about to open in the show)
  freeGrassTile() { return this.freeNear(PLAZA, 11); }
  freeNear(c, r) {
    for (let tries = 0; tries < 80; tries++) {
      const x = c.x - r + Math.floor(Math.random() * (2 * r + 1)), y = c.y - r + Math.floor(Math.random() * (2 * r + 1));
      if (grassy(this.ch(x, y)) && this.walkable(x, y) && !this.isNew(x, y)) return { x, y };
    }
    return null;
  }

  // ---------- who is where ----------
  folkAt(x, y) { return this.folk.find(f => f.x === x && f.y === y); }
  heroAt(x, y) { return this.heroes.find(h => h.x === x && h.y === y); }
  houseAt(x, y) { return HOUSES.find(h => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h); }
  homeAt(x, y) { return x >= HOME.x && x < HOME.x + HOME.w && y >= HOME.y && y < HOME.y + HOME.h; }
  homeLine() {
    if (!ownsHome(this.meta)) return '빈 집터: 언젠가 여기에 내 집을… 조합장이 말한 큰 상이 이건가?';
    const v = this.meta.house?.visit, who = v?.gift > 0 && CHARACTERS[v.id];
    return who ? `내 집: ${josa(who.name, '이', '가')} 놀러 와 있다! 문 앞에서 부딪히면 들어간다.` : '내 집: 문 앞에서 부딪히면 들어간다. 안이 아늑할수록 탐험이 든든해진다.';
  }
  // back out of your front door (main.js leaveHome): you step out onto the doorstep
  outOfHome() {
    const door = doorOf(HOME), ps = this.ps;
    this.path = [];
    this.pending = null;
    this.p.x = door.x; this.p.y = door.y;
    ps.setFlipX(false).setAlpha(0).setPosition(center(door.x), foot(door.y) - 6).setDepth(D.actors + door.y / 100);
    this.tweens.add({ targets: ps, y: foot(door.y), alpha: 1, duration: 200, ease: 'Quad.out' });
    this.cameras.main.centerOn(center(door.x), foot(door.y) - TILE / 2);
  }
  pupAt(x, y) { return this.pup && this.pup.x === x && this.pup.y === y ? this.pup : null; }
  buildingAt(x, y) { return this.buildings.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); }
  propAt(x, y) { return this.props.find(o => propCells(o.pr).some(([i, j]) => o.pr.x + i === x && o.pr.y + j === y))?.pr; }
  decorAt(x, y) { return DECOR.find(d => this.decor[d.id] && d.at.some(([ax, ay]) => ax === x && ay === y)); }
  walkable(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH || this.blocked[y * MW + x]) return false;
    return !this.folkAt(x, y) && !this.heroAt(x, y) && !this.pupAt(x, y) && !(this.p && this.p.x === x && this.p.y === y);
  }

  describe(x, y) {
    const play = playDescribe(this, x, y);
    if (play) return play;
    const life = lifeDescribe(this, x, y);
    if (life) return life;
    const who = this.folkAt(x, y) || (this.houseAt(x, y)?.lived && this.folk.find(f => f.id === this.houseAt(x, y).id));
    if (who) return `${who.f.name}: ${who.f.tip}`;
    if (this.houseAt(x, y)) return '빈 집: 아직 아무도 안 산다.';
    if (this.homeAt(x, y)) return this.homeLine();
    if (this.pupAt(x, y)) return '강아지: 같이 사는 강아지. 부딪히면 좋아한다.';
    const d = this.decorAt(x, y);
    if (d) return `${d.name}: ${d.desc}`;
    const hero = this.heroAt(x, y);
    if (hero) return `${CHARACTERS[hero.id].name}: 마을에 사는 친구. 부딪히면 말을 건다.`;
    const b = this.buildingAt(x, y);
    if (b) return `${b.cot != null ? cottageName(this.meta, b.cot) : b.name}: ${b.tip}`;
    if (this.bigTree && BIG_TREE.block.some(([bx, by]) => bx === x && by === y)) return '아주 오래된 큰 나무: 뿌리 사이에 아주 작은 문이 있다. 늘 잠겨 있다.';
    if (this.ch(x, y) === '>') return '들판 가는 땅굴: 쏙 들어가면 탐험을 나간다.';
    if (this.ch(x, y) === 'T') return '나무';
    const pr = this.propAt(x, y);
    if (pr) return PROP_NAMES[pr.kind];
    return '';
  }

  // ---------- moving ----------
  // a tap: walk to the spot; on a villager or a house, walk up to them and talk; on the sign, head out
  tap(x, y) {
    if (this.ps?.diving) return;
    // someone showing you something (scenes/village-hearts.js): a tap hurries them on
    if (heartsTap(this)) return;
    // a game going on, or something to play with (scenes/village-play.js)
    if (playTap(this, x, y)) return;
    // fishing, a bug, the yard's bed (scenes/village-life.js)
    if (lifeTap(this, x, y)) return;
    const house = this.houseAt(x, y);
    const target = this.folkAt(x, y) || (house?.lived && this.folk.find(f => f.id === house.id)) || this.heroAt(x, y) ||
      this.pupAt(x, y) || (this.homeAt(x, y) && this.homeDoor);
    if (house && !house.lived) { this.hooks.onHover?.('빈 집: 아직 아무도 안 산다.', true); return; }
    if (this.homeAt(x, y) && !this.homeDoor) { this.hooks.onHover?.(this.homeLine(), true); return; }
    const d = !target && this.decorAt(x, y);
    if (d?.id === 'mailbox' && this.mail) {
      const near = this.near(this.mailbox);
      if (near === 0) this.meet(this.mailbox);
      else if (near) { this.path = near; this.pending = this.mailbox; }
      return;
    }
    if (d) { this.hooks.onHover?.(`${d.name}: ${d.desc}`, true); return; }
    // the woods, the pond, a barrel, the big tree's door: go up to it and give it a poke
    if (!target && pokeKind(this, x, y)) {
      const it = { poke: true, x, y }, near = this.near(it);
      if (near === 0) poke(this, x, y);
      else if (near) { this.path = near; this.pending = it; }
      return;
    }
    // a building or a thing you cannot walk into: what it is
    if (!target && (this.buildingAt(x, y) || (this.propAt(x, y) && !this.walkable(x, y)))) { this.hooks.onHover?.(this.describe(x, y), true); return; }
    if (target) {
      const near = this.near(target);
      if (near === 0) { this.meet(target); return; }
      if (near) { this.path = near; this.pending = target; }
      return;
    }
    if (x === this.p.x && y === this.p.y) return;
    if (!this.walkable(x, y)) return;
    this.path = this.route(x, y);
    this.pending = null;
  }

  // keyboard: one step, or bump whoever is there (`repeat`: the key held down; in a game a held key
  // is one press)
  step(dx, dy, repeat) {
    if (this.showing) { this.skipShow(); return; }
    if (heartsTap(this, repeat)) return;
    if (this.play) { playStep(this, this.p.x + dx, this.p.y + dy, repeat); return; }
    if (this.ps?.diving || this.time.now < this.nextStep) return;
    this.nextStep = this.time.now + STEP_MS;
    const x = this.p.x + dx, y = this.p.y + dy;
    if (playStep(this, x, y, repeat)) { this.path = []; return; }
    if (lifeStep(this, x, y)) { this.path = []; return; }
    const who = this.folkAt(x, y) || this.heroAt(x, y) || this.pupAt(x, y) || (this.homeAt(x, y) && this.homeDoor) ||
      (this.mail && this.decorAt(x, y)?.id === 'mailbox' && this.mailbox);
    this.path = [];
    if (who) { this.meet(who); return; }
    if (this.walkable(x, y) && this.canCut(this.p.x, this.p.y, dx, dy)) this.moveTo(x, y);
    else poke(this, x, y);
  }

  // diagonal steps may not squeeze between two blocked corners
  canCut(x, y, dx, dy) {
    if (!dx || !dy) return true;
    const open = (nx, ny) => nx >= 0 && ny >= 0 && nx < MW && ny < MH && !this.blocked[ny * MW + nx];
    return open(x + dx, y) || open(x, y + dy);
  }

  route(tx, ty) {
    const prev = new Map(), start = this.p.y * MW + this.p.x, goal = ty * MW + tx;
    const q = [start];
    prev.set(start, -1);
    while (q.length) {
      const i = q.shift();
      if (i === goal) break;
      const x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, j = ny * MW + nx;
        if (prev.has(j) || !this.walkable(nx, ny) || !this.canCut(x, y, dx, dy) || (j !== goal && this.ch(nx, ny) === '>')) continue;
        prev.set(j, i);
        q.push(j);
      }
    }
    if (!prev.has(goal)) return [];
    const out = [];
    for (let i = goal; i !== start; i = prev.get(i)) out.unshift([i % MW, (i / MW) | 0]);
    return out;
  }

  // the shortest walk to a tile beside someone; 0 when already beside them, null when there is no way
  near(who) {
    // the skipping stones: onto them, not beside them
    if (who.onto) {
      if (this.p.x === who.x && this.p.y === who.y) return 0;
      const r = this.walkable(who.x, who.y) ? this.route(who.x, who.y) : [];
      return r.length ? r : null;
    }
    if (who.home) {
      // the house: step up to its door, so nothing gets put up where you are standing
      if (this.p.x === who.x && this.p.y === who.y + 1) return 0;
      const r = this.walkable(who.x, who.y + 1) ? this.route(who.x, who.y + 1) : [];
      return r.length ? r : null;
    }
    if (Math.max(Math.abs(who.x - this.p.x), Math.abs(who.y - this.p.y)) === 1) return 0;
    let best = null;
    for (const [dx, dy] of DIRS) {
      const r = this.walkable(who.x + dx, who.y + dy) ? this.route(who.x + dx, who.y + dy) : [];
      if (r.length && (!best || r.length < best.length)) best = r;
    }
    return best;
  }

  moveTo(x, y) {
    const ps = this.ps, cam = this.cameras.main;
    if (cam._follow !== ps) cam.startFollow(ps, true, 0.2, 0.2, 0, TILE / 2);
    if (x !== this.p.x) ps.setFlipX(x < this.p.x);
    this.p.x = x; this.p.y = y;
    ps.stepFrame = ps.stepFrame === 1 ? 2 : 1;
    ps.stepUntil = this.time.now + STEP_MS + 60;
    this.tweens.add({ targets: ps, x: center(x), y: foot(y), duration: STEP_MS - 10 });
    ps.setDepth(D.actors + y / 100);
    this.hooks.onStep?.(ps.stepFrame === 1);
    const find = this.finds.find(f => f.x === x && f.y === y);
    if (find) this.time.delayedCall(STEP_MS - 20, () => this.pickUp(find));
    lifeStepOn(this, x, y);
    playStepOn(this, x, y);
    if (this.ch(x, y) === '>') { this.path = []; this.time.delayedCall(STEP_MS, () => this.dive()); }
  }

  // Into the burrow out to the fields: a little hop, then down the hole behind its rim (scenes/burrow.js),
  // then the run begins.
  dive() {
    const ps = this.ps, k = texScale(ps), x = ps.x, y = ps.y;
    ps.diving = true;
    this.hooks.onDive?.();
    diveInto(this, ps, {
      x: center(this.p.x), rim: foot(this.p.y) - 2, k,
      done: () => this.time.delayedCall(160, () => { ps.diving = false; ps.setCrop().setVisible(true).setScale(k).setPosition(x, y); this.hooks.onLeave?.(); }),
    });
  }

  // bumping into someone: a villager talks, a hero takes your place for today
  meet(who) {
    this.path = [];
    this.pending = null;
    if (who.poke) { poke(this, who.x, who.y); return; }
    if (who.life) { lifeAct(this, who); return; }
    if (who.play) { playAct(this, who); return; }
    // your own door: in you go (main.js showHome, scenes/HomeScene.js)
    if (who.home) {
      const ps = this.ps;
      if (ps.diving) return;
      ps.diving = true;
      this.tweens.add({ targets: ps, y: ps.y - 6, alpha: 0, duration: 170, ease: 'Quad.in', onComplete: () => { ps.diving = false; this.hooks.onHome?.(); } });
      return;
    }
    if (who.mailbox) {
      const letter = this.mail;
      this.mail = null;
      if (letter) this.hooks.onMail?.(letter);
      return;
    }
    if (who.x !== this.p.x) this.ps.setFlipX(who.x < this.p.x);
    if (who.pup) {
      who.s.setFlipX(this.p.x > who.x);
      // 비밀: five pats in a row and it does a trick
      if (petPup(this, who)) { this.hooks.onPet?.(); return; }
      this.tweens.add({ targets: who.s, hop: 5, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.out' });
      this.say(who.s, Math.random() < 0.5 ? '멍!' : '♥', 1100);
      this.ps.expr = 'sparkle';
      this.ps.exprUntil = this.time.now + 900;
      this.hooks.onPet?.();
      return;
    }
    // something you were asked to take over (scenes/village-hearts.js)
    if (heartsMeet(this, who)) return;
    who.s.setFlipX(this.p.x < who.x);
    this.tweens.add({ targets: who.s, hop: 4, duration: 90, yoyo: true, ease: 'Quad.out' });
    if (who.f) {
      const pick = who.f.lines[Math.floor(Math.random() * who.f.lines.length)];
      const line = chatLine(this.meta, who.id) ?? (typeof pick === 'function' ? pick(this.meta) : pick);
      this.say(who.s, line);
      this.time.delayedCall(260, () => this.hooks.onTalk?.(who.id, line));
      return;
    }
    // a friend: a word, and a sheet of their own (main.js talkToFriend)
    const line = chatLine(this.meta, who.id);
    if (line && this.hooks.onFriend) {
      this.say(who.s, line);
      this.time.delayedCall(260, () => this.hooks.onFriend(who.id, line));
      return;
    }
    this.hooks.onSwap?.(who.id);
  }

  // the picked hero changes: you become them, and the one you were takes their spot in the meadow
  swapHero(id) {
    const other = this.heroes.find(h => h.id === id);
    if (!other) return;
    const was = this.p.id, ws = this.ps;
    // both stop where they stand (a step half done would finish on the wrong one) and wear their own faces
    for (const [sp, x, y] of [[ws, this.p.x, this.p.y], [other.s, other.x, other.y]]) {
      this.tweens.killTweensOf(sp);
      sp.hop = 0;
      sp.setPosition(center(x), foot(y));
    }
    ws.setTexture(CHARACTERS[was].sprite);
    other.s.setTexture(CHARACTERS[id].sprite);
    this.ps = other.s;
    this.p.id = id;
    const px = this.p.x, py = this.p.y;
    this.p.x = other.x; this.p.y = other.y;
    Object.assign(other, { id: was, s: ws, x: px, y: py, next: this.time.now + 1500 });
    this.cameras.main.startFollow(this.ps, true, 0.2, 0.2, 0, TILE / 2);
    this.spark.explode(14, this.ps.x, this.ps.y - 8);
    this.say(this.ps, HERO_LINES[Math.floor(Math.random() * HERO_LINES.length)]);
  }

  // someone moves in: they hop out of their door with sparkles and say hello
  arrive(one, fast) {
    if (one.arrived || !one.s.active) return;
    one.arrived = true;
    one.s.setAlpha(1);
    this.hooks.onArrive?.(one.id);
    if (fast) return;
    const h = one.house;
    this.spark.explode(30, (h.x + h.w / 2) * TILE, (h.y + h.h / 2) * TILE);
    this.tweens.add({ targets: one.s, hop: 10, duration: 180, yoyo: true, repeat: 1, ease: 'Quad.out' });
    this.spark.explode(26, one.s.x, one.s.y - 8);
    this.say(one.s, one.f.arrive || '안녕!', 2600);
    this.ps.expr = 'sparkle';
    this.ps.exprUntil = this.time.now + 1200;
  }

  // a speech bubble over someone's head, the same size on every screen (sizes are in CSS pixels,
  // `k` turns them into world pixels; the text is drawn at the camera's zoom so it stays sharp)
  say(target, text, ms = 1700) {
    while (this.bubbles.length >= 3) this.bubbles.shift().destroy();
    const z = this.cameras.main.zoom || 3, k = this.dpr / z;
    const b = this.add.text(target.x, target.y - 18, text, {
      fontFamily: 'Galmuri11, sans-serif', fontSize: `${12 * k}px`, color: '#1b1424', backgroundColor: '#f4f0e8',
      padding: { x: 7 * k, y: 4 * k }, align: 'center', wordWrap: { width: 190 * k, useAdvancedWrap: true },
    }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(z);
    b.target = target;
    b.until = this.time.now + ms;
    this.bubbles.push(b);
  }

  // ---------- every frame ----------
  update(time, delta) {
    if (!this.ps) return;
    stillInFlowers(this, time, Math.min(delta || 16, 50));
    this.moveLife(time, Math.min(delta || 16, 50));
    lifeTick(this, time, Math.min(delta || 16, 50));
    playTick(this, time, Math.min(delta || 16, 50));
    heartsTick(this, time);
    // the big tree's crown goes see-through while you are under it
    if (this.bigTree) {
      const want = this.underBigTree(this.p.x, this.p.y) && this.p.y < BIG_TREE.y ? 0.45 : 1;
      this.bigTree.alpha += (want - this.bigTree.alpha) * Math.min(1, (delta || 16) / 120);
    }
    // walking: one tile at a time along the route; arriving next to whoever you were heading for, talk
    if (this.path.length && time >= this.nextStep) {
      const [x, y] = this.path.shift();
      if (this.walkable(x, y) && this.canCut(this.p.x, this.p.y, x - this.p.x, y - this.p.y)) this.moveTo(x, y);
      else {
        // someone strolled into the way: go round them
        const [gx, gy] = this.path.length ? this.path[this.path.length - 1] : [x, y];
        this.path = this.pending ? this.near(this.pending) || [] : this.walkable(gx, gy) ? this.route(gx, gy) : [];
      }
      this.nextStep = time + STEP_MS;
      if (!this.path.length && this.pending) {
        const who = this.pending;
        this.pending = null;
        this.time.delayedCall(STEP_MS, () => {
          const near = this.near(who);
          if (near === 0) this.meet(who);
          else if (near && near.length <= 3) { this.path = near; this.pending = who; }
        });
      }
    }
    const ps = this.ps, walking = time < (ps.stepUntil || 0);
    const base = CHARACTERS[this.p.id].sprite;
    let expr = time < (ps.exprUntil || 0) ? ps.expr : '';
    if (time > (ps.nextBlink || 0)) { ps.blinkUntil = time + 130; ps.nextBlink = time + 2200 + Math.random() * 2600; }
    if (!expr && !walking && time < ps.blinkUntil) expr = 'blink';
    const key = dressKey(this, faceKey(walking ? `${base}_walk${ps.stepFrame}` : base, expr), this.meta.wear);
    if (ps.texture.key !== key && this.textures.exists(key)) ps.setTexture(key);

    // villagers breathe and turn to look at you when you come close; the first time, they say hello
    for (const one of this.folk) {
      if (one.busy) continue;
      const d = Math.max(Math.abs(one.x - this.p.x), Math.abs(one.y - this.p.y));
      if (d <= 3) one.s.setFlipX(this.p.x < one.x);
      if (d <= 2 && !one.greeted) {
        one.greeted = true;
        const line = one.f.lines[0];
        this.say(one.s, typeof line === 'function' ? line(this.meta) : line);
      }
    }
    // a few villagers stroll round the loop, keeping on the way they were going; they stop for a
    // chat when you come close, and wait for you once you are on your way to them
    for (const one of this.folk) {
      if (!one.f.stroll || time < one.next || one === this.pending || one.s.alpha < 1 || one.busy) continue;
      one.next = time + one.f.stroll * (0.8 + Math.random() * 0.5);
      if (Math.max(Math.abs(one.x - this.p.x), Math.abs(one.y - this.p.y)) <= 2) continue;
      const ok = ([dx, dy]) => this.ch(one.x + dx, one.y + dy) === ':' && this.walkable(one.x + dx, one.y + dy) && this.canCut(one.x, one.y, dx, dy);
      const ways = DIRS.filter(d => ok(d) && !(d[0] === -one.dir[0] && d[1] === -one.dir[1]));
      const score = d => d[0] * one.dir[0] + d[1] * one.dir[1] + Math.random() * 1.2;
      const way = ways.sort((a, b) => score(b) - score(a))[0] || (ok([-one.dir[0], -one.dir[1]]) && [-one.dir[0], -one.dir[1]]);
      if (!way) continue;
      one.dir = way;
      one.x += way[0]; one.y += way[1];
      if (way[0]) one.s.setFlipX(way[0] < 0);
      const ms = Math.min(one.f.stroll * 0.7, 420);
      this.tweens.add({ targets: one.s, x: center(one.x), y: foot(one.y), duration: ms });
      this.tweens.add({ targets: one.s, hop: 2, duration: ms / 2, yoyo: true, ease: 'Quad.out' });
      one.s.setDepth(D.actors + one.y / 100);
    }
    // the heroes at home amble about on the grass
    for (const h of this.heroes) {
      if (time < h.next || h === this.pending || h.busy) continue;
      h.next = time + 1200 + Math.random() * 2600;
      const [dx, dy] = DIRS[Math.floor(Math.random() * 4)];
      const x = h.x + dx, y = h.y + dy;
      if (!grassy(this.ch(x, y)) || !this.walkable(x, y)) continue;
      if (this.fest && Math.max(Math.abs(x - MAYPOLE.x), Math.abs(y - MAYPOLE.y)) > 4) continue;
      h.x = x; h.y = y;
      if (dx) h.s.setFlipX(dx < 0);
      // the sprite and its picture are kept from now: a swap during the step hands this sprite to you and
      // `h` gets yours, and setting `h.s` back to this hero's picture then dressed both of you alike (v0.29)
      const s = h.s, sp = CHARACTERS[h.id].sprite;
      s.setTexture(`${sp}_walk1`);
      this.tweens.add({ targets: s, x: center(x), y: foot(y), duration: 260, onComplete: () => { if (s.scene && s !== this.ps) s.setTexture(sp); } });
      h.s.setDepth(D.actors + y / 100);
    }
    // the puppy pads round its yard, and trots over when you come by
    const pup = this.pup;
    if (pup && time > pup.next && pup !== this.pending && !pup.busy) {
      pup.next = time + 900 + Math.random() * 1800;
      const near = Math.max(Math.abs(pup.x - this.p.x), Math.abs(pup.y - this.p.y));
      const yard = (x, y) => x >= HOME.x - 5 && x <= HOME.x + HOME.w + 4 && y >= HOME.y - 1 && y <= HOME.y + HOME.h + 1;
      const ways = DIRS.slice(0, 4).filter(([dx, dy]) => yard(pup.x + dx, pup.y + dy) && grassy(this.ch(pup.x + dx, pup.y + dy)) && this.walkable(pup.x + dx, pup.y + dy));
      const toward = ([dx, dy]) => Math.abs(pup.x + dx - this.p.x) + Math.abs(pup.y + dy - this.p.y);
      const way = near <= 4 && near > 1 ? ways.sort((a, b) => toward(a) - toward(b))[0] : near > 1 && Math.random() < 0.6 ? ways[Math.floor(Math.random() * ways.length)] : null;
      if (way) {
        pup.x += way[0]; pup.y += way[1];
        if (way[0]) pup.s.setFlipX(way[0] > 0);
        this.tweens.add({ targets: pup.s, x: center(pup.x), y: foot(pup.y), duration: 220 });
        this.tweens.add({ targets: pup.s, hop: 2, duration: 110, yoyo: true, ease: 'Quad.out' });
        pup.s.setDepth(D.actors + pup.y / 100);
      } else if (near === 1) pup.s.setFlipX(this.p.x > pup.x);
    }
    // everyone has a little habit of their own when you are close enough to see it
    for (const one of this.folk) {
      if (time < (one.habitAt || 0)) continue;
      one.habitAt = time + 5500 + Math.random() * 4500;
      if (one.s.alpha < 1 || one === this.pending || one.busy || Math.max(Math.abs(one.x - this.p.x), Math.abs(one.y - this.p.y)) > 7) continue;
      this.habit(one.id, one.s, time);
    }
    for (const h of this.heroes) {
      if (time < (h.habitAt || 0) || h.busy) continue;
      h.habitAt = time + (this.fest ? 2200 + Math.random() * 2000 : 6000 + Math.random() * 5000);
      if (Math.max(Math.abs(h.x - this.p.x), Math.abs(h.y - this.p.y)) <= 7) this.habit(this.fest ? 'dance' : h.id, h.s, time);
    }
    if (this.pup && time > (this.pup.habitAt || 0)) {
      this.pup.habitAt = time + 3500 + Math.random() * 3000;
      const d = Math.max(Math.abs(this.pup.x - this.p.x), Math.abs(this.pup.y - this.p.y));
      if (d <= 3) setEmote(this.pup.s, '♥', time, 1100);
    }
    // bobbing and shadows
    const g = this.shadows;
    g.clear();
    if (pup) {
      const k = TILE * 0.72 / pup.s.frame.height, br = 1 + 0.05 * Math.sin(time / 300);
      pup.s.setScale(k, k * br).setOrigin(0.5, 1 + (pup.s.hop || 0) / (pup.s.frame.height * k));
      g.fillStyle(0x000000, 0.25);
      pixEllipse(g, pup.s.x, pup.s.y - 1, 9, 3);
    }
    const all = [ps, ...this.folk.map(f => f.s), ...this.heroes.map(h => h.s)];
    all.forEach((s, i) => {
      const breathe = s === ps && walking ? 1 : 1 + 0.035 * Math.sin(time / 420 + i * 1.7);
      const k = texScale(s);
      // down the burrow or in at the door: no shadow left on the grass
      if (s.diving) return;
      s.setScale(k * (s.sx || 1), k * breathe * (s.sy || 1)).setOrigin(0.5, 1 + (s.hop || 0) / TILE);
      if (s.noShadow) return;
      g.fillStyle(0x000000, 0.28);
      pixEllipse(g, s.x, s.y - 1.5, 11, 4);
    });
    const mk = this.marks;
    mk.clear();
    for (const s of all) drawEmote(mk, s, s.x, s.y - TILE - (s.hop || 0) - 3, time);
    if (pup) drawEmote(mk, pup.s, pup.s.x, pup.s.y - 13 - (pup.s.hop || 0), time);
    lifeMarks(this, mk, time);
    if (this.mail && this.decor.mailbox) {
      if (time > this.mailNext) { this.mailNext = time + 2400; setEmote(this.mailMark, '!', time, 1600); }
      drawEmote(mk, this.mailMark, center(this.mailbox.x), foot(this.mailbox.y) - 21, time);
    }
    // the shop has got things in that you have not had a look at yet: a '!' over the shopkeeper now and then
    const keeper = time > (this.shopNext || 0) && this.folk.find(f => f.id === 'shop');
    if (keeper) { this.shopNext = time + 2600; if (newStock(this.meta).length) setEmote(keeper.s, '!', time, 1700); }
    // a friend waiting inside with a present (a heart), or a house you have not been into yet (a '!'),
    // over your door now and then
    const visit = this.meta.house?.visit?.gift > 0;
    if (this.homeDoor && (visit || !this.meta.house?.seen)) {
      this.visitMark ||= {};
      if (time > (this.visitNext || 0)) { this.visitNext = time + 2600; setEmote(this.visitMark, visit ? '♥' : '!', time, 1700); }
      drawEmote(mk, this.visitMark, center(this.homeDoor.x), foot(this.homeDoor.y) - 18, time);
    }
    // chimney smoke from the houses people live in, and the pond shimmering
    if (time > (this.nextSmoke || 0)) {
      this.nextSmoke = time + 450;
      const puff = (h, lvl) => { const at = chimneyAt(h, lvl); if (at) this.smoke.explode(1, h.x * TILE + at[0], h.y * TILE + at[1]); };
      for (const h of HOUSES) if (h.lived && h.img?.visible) puff(h, +h.img.texture.key.split('_').pop());
      for (const b of this.buildings) if (b.img.visible) puff(b);
      if (ownsHome(this.meta) && this.homeImg.texture.key !== 'village_lot') puff(HOME);
    }
    // the windmill turns, the balloon and the pond's lanterns bob, the big tree's lights twinkle, the
    // flags flap, the maypole's ribbons go round, and once it is all grown, now and then a firework
    const dt = Math.min(delta || 16, 50);
    const sf = Math.floor(time / 260) % SAIL_FRAMES;
    if (this.sails && sf !== this.sailFrame) { this.sailFrame = sf; this.sails.setTexture(this.growthKey('sails', sf)); }
    for (const f of this.floaters) f.img.setPosition(f.x, Math.round(f.y + Math.sin(time / (f.big ? 1400 : 650) + f.seed) * (f.big ? 3 : 1)));
    this.twinkles.forEach((t, i) => t.setAlpha(0.3 + 0.7 * Math.max(0, Math.sin(time / 420 + i * 2.3))));
    const fr = Math.floor(time / 380) % 2;
    if (fr !== this.flagFrame) {
      this.flagFrame = fr;
      for (const f of this.flags) f.img.setTexture(this.growthKey('flag', f.v * 2 + fr));
      this.maypole?.setTexture(this.growthKey('maypole', fr));
    }
    if (this.fireworks && time > (this.nextFirework || 0)) {
      this.nextFirework = time + 2600 + Math.random() * 2800;
      this.firework(this.cameras.main.worldView);
    }
    // the hidden bits twinkle now and then; the lamps flicker
    for (const f of this.finds) {
      if (time < f.next) continue;
      f.next = time + 1300 + Math.random() * 1800;
      this.spark.explode(2, f.img.x, f.img.y - 2);
      this.tweens.add({ targets: f.img, alpha: 1, scale: 1.25, duration: 160, yoyo: true });
    }
    this.glows.forEach((g, i) => g.setAlpha(0.5 + 0.12 * Math.sin(time / 300 + i * 2.1)));
    // the sunlight on the pond breathes a little; now and then the water glints where it falls
    if (this.rays) this.rays.setAlpha(0.85 + 0.15 * Math.sin(time / 1400));
    for (const gl of this.glints) {
      if (time < gl.next) continue;
      const t = this.pondTiles[Math.floor(Math.random() * this.pondTiles.length)];
      gl.next = time + 900 + Math.random() * 1600;
      gl.setPosition(t.x * TILE + 3 + Math.floor(Math.random() * 10), t.y * TILE + 3 + Math.floor(Math.random() * 10)).setAlpha(0);
      this.tweens.add({ targets: gl, alpha: 1, duration: 220, yoyo: true, hold: 200 });
    }
    const wf = Math.floor(time / 600) % 2;
    if (wf !== this.waterFrame) {
      this.waterFrame = wf;
      for (const img of this.waterImgs) img.setTexture(waterKey(this, HOME_ZI, wf, img.shore, false, null, img.round));
    }
    const view = this.cameras.main.worldView;
    this.bubbles = this.bubbles.filter(b => {
      if (time > b.until || !b.target.active) { b.destroy(); return false; }
      // kept on screen when its speaker stands near an edge
      const half = b.displayWidth / 2 + 2, x = Phaser.Math.Clamp(b.target.x, view.x + half, view.right - half);
      b.setPosition(Math.round(x), Math.round(b.target.y - TILE - 3 - (b.target.hop || 0)));
      b.setAlpha(b.until - time < 250 ? (b.until - time) / 250 : 1);
      return true;
    });
  }
}
