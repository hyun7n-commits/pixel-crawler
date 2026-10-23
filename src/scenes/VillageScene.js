// The village between runs, drawn with the meadow's tiles. You walk around it like in a run (tap a
// spot, or the arrow keys) and bump into people to talk to them; the signpost on the east side leads
// out to the fields. What each villager offers is DOM (ui/hub.js), opened through `hooks.onTalk`.
// Each time you come home a few shiny bits lie hidden in the grass for whoever wanders off the path.

/* global Phaser */
import { pixEllipse } from './pix.js';
import { TILE, HOME_ZI, wallKey, waterKey, shadeKey, floorKey, texScale, N, E, S, W_, NE, SE, SW, NW } from './textures.js';
import { houseCanvas, pathKey, lampPostCanvas, lotCanvas, treeKey, shrubCanvas, sunRaysCanvas, glintCanvas } from './village-art.js';
import { baseZoom } from './zoom.js';
import { faceKey } from '../data/faces.js';
import { VILLAGE_MAP, HOUSES, FOLK, doorOf, HERO_LINES, HOME, ownsHome, PROPS, PROP_NAMES } from '../data/village.js';
import { CHARACTERS } from '../data/characters.js';
import { VILLAGE_GROUND } from '../data/enemies.js';
import { DECOR, hasDecor, LETTERS } from '../data/home.js';
import { decorCanvas, pupCanvas } from './home-art.js';
import { setEmote, drawEmote } from './emotes.js';
import { patchNoise, scatterKey, patchKey, footKey, bloomKey, moteKeys, SCATTER_VARIANTS, PATCH_VARIANTS, FOOT_VARIANTS, BLOOM_VARIANTS, FOOT_UP } from './field-decor.js';
import { propCanvas, critterCanvas } from './village-props.js';

const MW = VILLAGE_MAP[0].length, MH = VILLAGE_MAP.length;
const D = { tiles: 0, deco: 1, house: 2, actors: 3, fx: 4, bubble: 5 };
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
};
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const STEP_MS = 140;
const PAD = { x: 6, y: 8 };       // bushes drawn around the map
const grassy = ch => ch === '.' || ch === '*';
// where you walk in: beside the signpost coming back from the fields, otherwise in front of the guild
const EXIT = (() => { const y = VILLAGE_MAP.findIndex(r => r.includes('>')); return { x: VILLAGE_MAP[y].indexOf('>'), y }; })();
const GUILD = doorOf(HOUSES.find(h => h.id === 'guild'));

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
    this.shadows = this.add.graphics().setDepth(D.actors - 0.5);
    this.marks = this.add.graphics().setDepth(D.fx + 0.5);
    this.objs = [];
    this.bubbles = [];

    // tap a spot to walk there, or a villager to go and talk; hover with a mouse to read who is who
    // or drag to look round the village (walk off again and the view comes back to you)
    const tileOf = ptr => ({ x: Math.floor(ptr.worldX / TILE), y: Math.floor(ptr.worldY / TILE) });
    const cam0 = this.cameras.main;
    this.input.on('pointerdown', ptr => { this.drag = { x: ptr.x, y: ptr.y, sx: cam0.scrollX, sy: cam0.scrollY, on: false }; });
    this.input.on('pointerup', ptr => {
      const dragged = this.drag?.on;
      this.drag = null;
      if (dragged || Math.hypot(ptr.upX - ptr.downX, ptr.upY - ptr.downY) > 12 * this.dpr) return;
      const t = tileOf(ptr);
      this.tap(t.x, t.y);
    });
    this.input.on('pointermove', ptr => {
      const d = this.drag;
      if (d && ptr.isDown) {
        if (!d.on && Math.hypot(ptr.x - d.x, ptr.y - d.y) > 12 * this.dpr) { d.on = true; cam0.stopFollow(); }
        if (d.on) { cam0.setScroll(d.sx - (ptr.x - d.x) / cam0.zoom, d.sy - (ptr.y - d.y) / cam0.zoom); return; }
      }
      if (ptr.wasTouch) return;
      const t = tileOf(ptr);
      this.hooks.onHover?.(this.describe(t.x, t.y));
    });
    this.input.on('gameout', () => this.hooks.onHover?.(''));
    this.scale.on('resize', () => this.fitZoom());
    this.events.on('wake', (sys, d) => this.enter(d));
    this.fitZoom();
    this.enter(data);
  }

  get dpr() { return this.game.registry.get('dpr') || 1; }

  // the same zoom as in the fields; when the screen is bigger than the village (a tall phone), the
  // village sits in the middle of the woods instead of in a corner
  fitZoom() {
    const z = baseZoom(this, TILE), cam = this.cameras.main;
    if (!z) return;
    cam.setZoom(z);
    const W = MW * TILE, H = MH * TILE, vw = cam.width / z, vh = cam.height / z;
    const bw = Math.max(W, vw), bh = Math.max(H, vh);
    cam.setBounds((W - bw) / 2, (H - bh) / 2, bw, bh);
  }

  // ---------- building the place ----------
  // `meta`: the save; `from`: 'run' when coming back from the fields (you walk in by the signpost)
  enter({ meta, from }) {
    this.meta = meta;
    this.clear();
    this.fitZoom();
    this.blocked = new Uint8Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if ('#~LT'.includes(this.ch(x, y))) this.blocked[y * MW + x] = 1;
    // the hedge goes on past the edge, so a tall phone screen shows bushes around the village, not a void
    for (let y = -PAD.y; y < MH + PAD.y; y++) for (let x = -PAD.x; x < MW + PAD.x; x++) this.drawTile(x, y);
    this.plantTrees();
    this.sunOnPond();
    this.placeProps();
    // a house someone is just moving into still has its boards up until they arrive
    for (const h of HOUSES) {
      const f = FOLK[h.id], lived = f.when(meta), moving = lived && f.arrive && !meta.village.seen[h.id];
      h.img = this.keep(this.add.image(h.x * TILE, h.y * TILE, this.houseKey(h, lived && !moving)).setOrigin(0).setDepth(D.actors + (h.y + h.h - 1) / 100));
      this.shrubs(h);
      for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) this.blocked[y * MW + x] = 1;
      h.lived = lived;
    }
    // your own house, or the roped-off lot where it will stand
    const home = ownsHome(meta);
    if (!this.textures.exists('village_lot')) this.textures.addCanvas('village_lot', lotCanvas(HOME.w, HOME.h));
    this.keep(this.add.image(HOME.x * TILE, HOME.y * TILE, home ? this.houseKey(HOME, true) : 'village_lot').setOrigin(0).setDepth(D.actors + (HOME.y + HOME.h - 1) / 100));
    for (let y = HOME.y; y < HOME.y + HOME.h; y++) for (let x = HOME.x; x < HOME.x + HOME.w; x++) this.blocked[y * MW + x] = 1;
    // what you have put round it (data/home.js); bumping the house in front of its door opens that list
    this.homeDoor = home ? { ...doorOf(HOME), home: true } : null;
    if (this.homeDoor) this.homeDoor.y--;
    this.decor = {};
    this.pup = null;
    this.placeDecor();
    // a letter in the mailbox now and then, when you come home from the fields
    this.mailbox = { x: 34, y: 29, mailbox: true };
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
    }
    const start = from === 'run' ? { x: EXIT.x - 1, y: EXIT.y } : { x: GUILD.x, y: GUILD.y + 2 };
    this.p = { x: start.x, y: start.y, id: meta.sel };
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
    if (arrivals.length) this.welcome(arrivals);
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
        const c = this.keep(this.add.image(s.x + 3, s.y - TILE + 2, 'gold').setDepth(D.fx).setScale(0.45));
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
    }
  }

  // the pieces of 집 꾸미기 bought so far, each on its own tiles round the house; `fresh`: the one
  // just bought, which pops in with sparkles
  placeDecor(fresh) {
    if (!ownsHome(this.meta)) return;
    for (const d of DECOR) {
      if (!hasDecor(this.meta, d.id) || this.decor[d.id]) continue;
      const key = `decor_${d.id}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, decorCanvas(d.id));
      const x0 = Math.min(...d.at.map(a => a[0])), y1 = Math.max(...d.at.map(a => a[1]));
      const img = this.keep(this.add.image(x0 * TILE, foot(y1), key).setOrigin(0, 1).setDepth(D.actors + y1 / 100));
      for (const [x, y] of d.at) this.blocked[y * MW + x] = 1;
      if (this.pup && d.at.some(([x, y]) => x === this.pup.x && y === this.pup.y)) this.movePup(39, 27);
      if (this.p && d.at.some(([x, y]) => x === this.p.x && y === this.p.y)) {
        const door = doorOf(HOME);
        this.p.x = door.x; this.p.y = door.y;
        this.ps.setPosition(center(door.x), foot(door.y)).setDepth(D.actors + door.y / 100);
      }
      this.decor[d.id] = img;
      if (d.id === 'statue') this.tweens.add({ targets: img, alpha: 0.82, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (d.id === 'dog') this.placePup();
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

  // the dog house's puppy pads about the yard; bump it and it hops
  placePup() {
    if (this.pup) return;
    if (!this.textures.exists('home_pup')) this.textures.addCanvas('home_pup', pupCanvas());
    const [x, y] = [39, 27];
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
      if (!grassy(this.ch(x, y)) || !this.walkable(x, y) || this.finds.some(f => Math.abs(f.x - x) + Math.abs(f.y - y) < 8)) continue;
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
      const spot = this.freeGrassTile();
      if (!spot) break;
      this.heroes.push({ id, x: spot.x, y: spot.y, s: this.actor(CHARACTERS[id].sprite, spot.x, spot.y), next: 0 });
    }
  }

  // after the guild changed who goes out today, or took someone new on
  resync() {
    if (!this.ps || (this.p.id === this.meta.sel && this.heroes.length === Object.keys(this.meta.chars).filter(c => this.meta.chars[c]).length - 1)) return;
    this.heroes.forEach(h => h.s.destroy());
    this.heroes = [];
    this.p.id = this.meta.sel;
    this.ps.setTexture(CHARACTERS[this.p.id].sprite);
    this.placeHeroes();
  }

  houseKey(h, lived) {
    const key = `house_${h.id}_${lived ? 1 : 0}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, houseCanvas(h, lived));
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
  }

  keep(o) { this.objs.push(o); return o; }

  ch(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? '#' : VILLAGE_MAP[y][x]; }

  drawTile(x, y) {
    const ch = this.ch(x, y);
    const around = test => (test(x, y - 1) && N) | (test(x + 1, y) && E) | (test(x, y + 1) && S) | (test(x - 1, y) && W_) |
      (test(x + 1, y - 1) && NE) | (test(x + 1, y + 1) && SE) | (test(x - 1, y + 1) && SW) | (test(x - 1, y - 1) && NW);
    const add = (key, depth = D.tiles) => this.keep(this.add.image(x * TILE, y * TILE, key).setOrigin(0).setDepth(depth));
    const hedge = (nx, ny) => this.ch(nx, ny) === '#' && !this.grove(nx, ny);
    if (ch === '#' && this.grove(x, y)) { add(floorKey(HOME_ZI, hash(x, y) & 31)); return; } // grass under a lone tree (plantTrees)
    if (ch === '#') {
      const open = around((nx, ny) => !hedge(nx, ny)), hb = hash(x * 7 + 3, y * 11 + 5);
      add(wallKey(this, HOME_ZI, open, hash(x + 99, y + 99) % 3));
      // flowers peeping out of the top of the hedge
      if (!(open & S) && hb % 100 < 30) add(bloomKey(this, VILLAGE_GROUND, HOME_ZI, (hb >> 8) % BLOOM_VARIANTS), D.tiles + 0.5);
      return;
    }
    if (ch === '~') {
      const img = add(waterKey(this, HOME_ZI, 0, around((nx, ny) => this.ch(nx, ny) !== '~')));
      img.shore = around((nx, ny) => this.ch(nx, ny) !== '~');
      this.waterImgs.push(img);
      if (x >= 0 && y >= 0 && hash(x, y) % 9 === 0) add(`t_lily${hash(x, y) % 2}`, D.deco);
      return;
    }
    const pathy = (nx, ny) => ':>'.includes(this.ch(nx, ny));
    if (pathy(x, y)) add(pathKey(this, around((nx, ny) => !pathy(nx, ny)) & (N | E | S | W_)));
    else add(ch === '*' ? `z${HOME_ZI}_floor${4 + (hash(x, y) % 3)}` : floorKey(HOME_ZI, hash(x, y) & 31)); // '*': daisies, pink flowers, buttercups
    const shade = around(hedge) & (N | E | W_ | NE | NW);
    if (shade) add(shadeKey(this, shade));
    if (grassy(ch)) this.decorate(x, y, add, hedge);
    if (ch === '>') add('t_stairs', D.deco);
    if (ch === 'L') {
      if (!this.textures.exists('village_post')) this.textures.addCanvas('village_post', lampPostCanvas());
      this.keep(this.add.image(center(x), foot(y), 'village_post').setOrigin(0.5, 1).setDepth(D.actors + y / 100));
      const glow = this.keep(this.add.image(center(x) - 1, foot(y) - 14, 'glow').setDepth(D.fx).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6));
      this.glows.push(glow);
    }
  }

  // Flowers, clover and pebbles in the grass (field-decor.js, in the daytime colours): thick in the
  // flower beds ('*') and in patches here and there, a band of leaves and flowers along the hedge's foot.
  decorate(x, y, add, hedge) {
    const z = VILLAGE_GROUND, zi = HOME_ZI, h = hash(x * 3 + 11, y * 5 + 7);
    if (hedge(x, y - 1)) { add(footKey(this, z, zi, h % FOOT_VARIANTS), D.tiles + 0.5).setY(y * TILE - FOOT_UP); return; }
    if (this.ch(x, y) === '*' || patchNoise(x, y, 5) > 0.62) add(patchKey(this, z, zi, (h >> 12) % PATCH_VARIANTS), D.tiles + 0.5);
    else if ((h >> 9) % 100 < 40) add(scatterKey(this, z, zi, (h >> 12) % SCATTER_VARIANTS), D.tiles + 0.5);
  }

  // The odds and ends round the village (data/village.js PROPS): each stands on its tile like a house.
  placeProps() {
    for (const pr of PROPS) {
      const key = `village_prop_${pr.kind}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, propCanvas(pr.kind));
      this.keep(this.add.image(center(pr.x), foot(pr.y), key).setOrigin(0.5, 1).setDepth(D.actors + pr.y / 100));
      this.blocked[pr.y * MW + pr.x] = 1;
    }
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
      // a wandering heading, a bob, and wings that beat
      f.a += (Math.sin(time / 900 + f.seed * 3) * 1.6) * s;
      f.x += Math.cos(f.a) * 14 * s; f.y += Math.sin(f.a) * 10 * s + Math.sin(time / 160 + f.seed) * 0.25;
      if (f.x < TILE || f.x > (MW - 1) * TILE || f.y < TILE * 2 || f.y > (MH - 2) * TILE) f.a += Math.PI * s * 4;
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
  // standing in the grass ('T'). The border trees are plain and dark; the grass ones bear fruit or blossom now and then.
  plantTrees() {
    const hedge = (x, y) => this.ch(x, y) === '#';
    const tree = (px, y, v) => this.keep(this.add.image(px, foot(y), treeKey(this, v)).setOrigin(0.5, 1).setDepth(D.actors + y / 100 + 0.001));
    for (let gy = -PAD.y; gy < MH + PAD.y; gy += 2) for (let gx = -PAD.x + ((gy / 2) & 1); gx < MW + PAD.x; gx += 3) {
      const h = hash(gx + 500, gy + 500), x = gx + (h % 2), y = gy + ((h >> 3) % 2);
      let deep = true;
      for (let dy = -2; dy <= 0 && deep; dy++) for (let dx = -1; dx <= 1 && deep; dx++) if (!hedge(x + dx, y + dy)) deep = false;
      if (deep) tree(center(x), y, h % 5 < 2 ? 1 : 0);
    }
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      // a 2x2 square of hedge on its own: one big tree over it
      if (this.grove(x, y) && this.grove(x + 1, y) && this.grove(x, y - 1) && !hedge(x, y + 1) && !hedge(x - 1, y)) tree((x + 1) * TILE, y, 1);
      if (this.ch(x, y) === 'T') { const r = hash(x * 3 + 7, y * 5 + 1) % 10; tree(center(x), y, r < 5 ? 0 : r < 7 ? 2 : r < 9 ? 3 : 1); }
    }
  }

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

  // a flowering shrub against each side of a house, where there is grass for it
  shrubs(h) {
    if (!this.textures.exists('village_shrub')) this.textures.addCanvas('village_shrub', shrubCanvas());
    const y = h.y + h.h - 1;
    for (const x of [h.x - 1, h.x + h.w]) {
      if (!grassy(this.ch(x, y)) || hash(x + 3, y + 9) % 4 === 0) continue;
      this.keep(this.add.image(center(x), foot(y), 'village_shrub').setOrigin(0.5, 1).setDepth(D.actors + y / 100));
      this.blocked[y * MW + x] = 1;
    }
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
  }

  actor(tex, x, y) {
    const s = this.keep(this.add.image(center(x), foot(y), tex).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    s.hop = 0;
    return s;
  }

  // the heroes who stay home hang about on the grass inside the loop, near the pond
  freeGrassTile() {
    for (let tries = 0; tries < 80; tries++) {
      const x = GUILD.x - 12 + Math.floor(Math.random() * 25), y = GUILD.y + 3 + Math.floor(Math.random() * 15);
      if (grassy(this.ch(x, y)) && this.walkable(x, y)) return { x, y };
    }
    return null;
  }

  // ---------- who is where ----------
  folkAt(x, y) { return this.folk.find(f => f.x === x && f.y === y); }
  heroAt(x, y) { return this.heroes.find(h => h.x === x && h.y === y); }
  houseAt(x, y) { return HOUSES.find(h => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h); }
  homeAt(x, y) { return x >= HOME.x && x < HOME.x + HOME.w && y >= HOME.y && y < HOME.y + HOME.h; }
  homeLine() {
    return ownsHome(this.meta) ? '내 집: 탐험 자격증 셋을 따고 조합에서 받은 내 집이다! 문 앞에서 부딪히면 꾸밀 수 있다.' : '빈 집터: 언젠가 여기에 내 집을… 조합장이 말한 큰 상이 이건가?';
  }
  pupAt(x, y) { return this.pup && this.pup.x === x && this.pup.y === y ? this.pup : null; }
  decorAt(x, y) { return DECOR.find(d => this.decor[d.id] && d.at.some(([ax, ay]) => ax === x && ay === y)); }
  walkable(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH || this.blocked[y * MW + x]) return false;
    return !this.folkAt(x, y) && !this.heroAt(x, y) && !this.pupAt(x, y) && !(this.p && this.p.x === x && this.p.y === y);
  }

  describe(x, y) {
    const who = this.folkAt(x, y) || (this.houseAt(x, y)?.lived && this.folk.find(f => f.id === this.houseAt(x, y).id));
    if (who) return `${who.f.name}: ${who.f.tip}`;
    if (this.houseAt(x, y)) return '빈 집: 아직 아무도 안 산다.';
    if (this.homeAt(x, y)) return this.homeLine();
    if (this.pupAt(x, y)) return '강아지: 같이 사는 강아지. 부딪히면 좋아한다.';
    const d = this.decorAt(x, y);
    if (d) return `${d.name}: ${d.desc}`;
    const hero = this.heroAt(x, y);
    if (hero) return `${CHARACTERS[hero.id].name}: 부딪히면 오늘은 이 친구가 나간다.`;
    if (this.ch(x, y) === '>') return '들판 가는 땅굴: 쏙 들어가면 탐험을 나간다.';
    if (this.ch(x, y) === 'L') return '반딧불 등';
    if (this.ch(x, y) === 'T') return '나무';
    const pr = PROPS.find(o => o.x === x && o.y === y);
    if (pr) return PROP_NAMES[pr.kind];
    return '';
  }

  // ---------- moving ----------
  // a tap: walk to the spot; on a villager or a house, walk up to them and talk; on the sign, head out
  tap(x, y) {
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

  // keyboard: one step, or bump whoever is there
  step(dx, dy) {
    if (this.time.now < this.nextStep) return;
    this.nextStep = this.time.now + STEP_MS;
    const x = this.p.x + dx, y = this.p.y + dy;
    const who = this.folkAt(x, y) || this.heroAt(x, y) || this.pupAt(x, y) || (this.homeAt(x, y) && this.homeDoor) ||
      (this.mail && this.decorAt(x, y)?.id === 'mailbox' && this.mailbox);
    this.path = [];
    if (who) { this.meet(who); return; }
    if (this.walkable(x, y) && this.canCut(this.p.x, this.p.y, dx, dy)) this.moveTo(x, y);
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
        if (prev.has(j) || !this.walkable(nx, ny) || !this.canCut(x, y, dx, dy)) continue;
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
    if (this.ch(x, y) === '>') { this.path = []; this.time.delayedCall(STEP_MS, () => this.dive()); }
  }

  // Into the burrow out to the fields: a little hop, then down the hole, then the run begins.
  dive() {
    const ps = this.ps, k = texScale(ps), y = ps.y;
    ps.diving = true;
    this.hooks.onDive?.();
    this.tweens.add({
      targets: ps, y: y - 5, duration: 140, ease: 'Quad.out',
      onComplete: () => this.tweens.add({
        targets: ps, y: y + 7, scaleX: k * 0.6, scaleY: k * 0.15, duration: 170, ease: 'Quad.in',
        onComplete: () => this.time.delayedCall(160, () => { ps.diving = false; ps.setScale(k).setY(y); this.hooks.onLeave?.(); }),
      }),
    });
  }

  // bumping into someone: a villager talks, a hero takes your place for today
  meet(who) {
    this.path = [];
    this.pending = null;
    if (who.home) { this.hooks.onHome?.(); return; }
    if (who.mailbox) {
      const letter = this.mail;
      this.mail = null;
      if (letter) this.hooks.onMail?.(letter);
      return;
    }
    if (who.x !== this.p.x) this.ps.setFlipX(who.x < this.p.x);
    if (who.pup) {
      who.s.setFlipX(this.p.x > who.x);
      this.tweens.add({ targets: who.s, hop: 5, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.out' });
      this.say(who.s, Math.random() < 0.5 ? '멍!' : '♥', 1100);
      this.ps.expr = 'sparkle';
      this.ps.exprUntil = this.time.now + 900;
      this.hooks.onPet?.();
      return;
    }
    who.s.setFlipX(this.p.x < who.x);
    this.tweens.add({ targets: who.s, hop: 4, duration: 90, yoyo: true, ease: 'Quad.out' });
    if (who.f) {
      const pick = who.f.lines[Math.floor(Math.random() * who.f.lines.length)];
      const line = typeof pick === 'function' ? pick(this.meta) : pick;
      this.say(who.s, line);
      this.time.delayedCall(260, () => this.hooks.onTalk?.(who.id, line));
      return;
    }
    this.hooks.onSwap?.(who.id);
  }

  // the picked hero changes: you become them, and the one you were takes their spot in the meadow
  swapHero(id) {
    const other = this.heroes.find(h => h.id === id);
    if (!other) return;
    const was = this.p.id, ws = this.ps;
    ws.setTexture(CHARACTERS[was].sprite);
    this.ps = other.s;
    this.p.id = id;
    const px = this.p.x, py = this.p.y;
    this.p.x = other.x; this.p.y = other.y;
    Object.assign(other, { id: was, s: ws, x: px, y: py, next: this.time.now + 1500 });
    this.cameras.main.startFollow(this.ps, true, 0.2, 0.2, 0, TILE / 2);
    this.spark.explode(14, this.ps.x, this.ps.y - 8);
    this.say(this.ps, HERO_LINES[Math.floor(Math.random() * HERO_LINES.length)]);
  }

  // someone new moves in: they hop out of their door with sparkles and say hello
  // new neighbours, one after another: the camera drifts over to their house, then back to you
  welcome(list) {
    const cam = this.cameras.main;
    let t = 500;
    for (const one of list) {
      this.time.delayedCall(t, () => { cam.stopFollow(); cam.pan(one.s.x, one.s.y - TILE * 2, 650, 'Sine.easeInOut'); });
      this.time.delayedCall(t + 750, () => this.arrive(one));
      t += 2300;
    }
    this.time.delayedCall(t, () => cam.pan(this.ps.x, this.ps.y - TILE / 2, 500, 'Sine.easeInOut', false, (c, k) => {
      if (k === 1) cam.startFollow(this.ps, true, 0.2, 0.2, 0, TILE / 2);
    }));
  }

  // someone moves in: the boards come off the house, they hop out with sparkles and say hello
  arrive(one) {
    if (!one.s.active) return;
    const h = one.house;
    h.img.setTexture(this.houseKey(h, true));
    this.spark.explode(30, (h.x + h.w / 2) * TILE, (h.y + h.h / 2) * TILE);
    this.tweens.add({ targets: one.s, alpha: 1, duration: 200 });
    this.tweens.add({ targets: one.s, hop: 10, duration: 180, yoyo: true, repeat: 1, ease: 'Quad.out' });
    this.spark.explode(26, one.s.x, one.s.y - 8);
    this.say(one.s, one.f.arrive || '안녕!', 2600);
    this.ps.expr = 'sparkle';
    this.ps.exprUntil = this.time.now + 1200;
    this.hooks.onArrive?.(one.id);
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
    this.moveLife(time, Math.min(delta || 16, 50));
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
    const key = faceKey(walking ? `${base}_walk${ps.stepFrame}` : base, expr);
    if (ps.texture.key !== key && this.textures.exists(key)) ps.setTexture(key);

    // villagers breathe and turn to look at you when you come close; the first time, they say hello
    for (const one of this.folk) {
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
      if (!one.f.stroll || time < one.next || one === this.pending || one.s.alpha < 1) continue;
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
      if (time < h.next || h === this.pending) continue;
      h.next = time + 1200 + Math.random() * 2600;
      const [dx, dy] = DIRS[Math.floor(Math.random() * 4)];
      const x = h.x + dx, y = h.y + dy;
      if (!grassy(this.ch(x, y)) || !this.walkable(x, y)) continue;
      h.x = x; h.y = y;
      if (dx) h.s.setFlipX(dx < 0);
      const sp = CHARACTERS[h.id].sprite;
      h.s.setTexture(`${sp}_walk1`);
      this.tweens.add({ targets: h.s, x: center(x), y: foot(y), duration: 260, onComplete: () => h.s.scene && h.s.setTexture(sp) });
      h.s.setDepth(D.actors + y / 100);
    }
    // the puppy pads round its yard, and trots over when you come by
    const pup = this.pup;
    if (pup && time > pup.next && pup !== this.pending) {
      pup.next = time + 900 + Math.random() * 1800;
      const near = Math.max(Math.abs(pup.x - this.p.x), Math.abs(pup.y - this.p.y));
      const yard = (x, y) => x >= HOME.x - 4 && x <= HOME.x + HOME.w + 6 && y >= HOME.y - 1 && y <= HOME.y + HOME.h + 1;
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
      if (one.s.alpha < 1 || one === this.pending || Math.max(Math.abs(one.x - this.p.x), Math.abs(one.y - this.p.y)) > 7) continue;
      this.habit(one.id, one.s, time);
    }
    for (const h of this.heroes) {
      if (time < (h.habitAt || 0)) continue;
      h.habitAt = time + 6000 + Math.random() * 5000;
      if (Math.max(Math.abs(h.x - this.p.x), Math.abs(h.y - this.p.y)) <= 7) this.habit(h.id, h.s, time);
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
      if (!s.diving) s.setScale(k * (s.sx || 1), k * breathe * (s.sy || 1)).setOrigin(0.5, 1 + (s.hop || 0) / TILE);
      g.fillStyle(0x000000, 0.28);
      pixEllipse(g, s.x, s.y - 1.5, 11, 4);
    });
    const mk = this.marks;
    mk.clear();
    for (const s of all) drawEmote(mk, s, s.x, s.y - TILE - (s.hop || 0) - 3, time);
    if (pup) drawEmote(mk, pup.s, pup.s.x, pup.s.y - 13 - (pup.s.hop || 0), time);
    if (this.mail && this.decor.mailbox) {
      if (time > this.mailNext) { this.mailNext = time + 2400; setEmote(this.mailMark, '!', time, 1600); }
      drawEmote(mk, this.mailMark, center(this.mailbox.x), foot(this.mailbox.y) - 21, time);
    }
    // chimney smoke from the houses people live in, and the pond shimmering
    if (time > (this.nextSmoke || 0)) {
      this.nextSmoke = time + 450;
      for (const h of HOUSES) if (h.lived && h.chimney) this.smoke.explode(1, h.x * TILE + h.w * TILE - 10, h.y * TILE + 1);
      if (ownsHome(this.meta)) this.smoke.explode(1, HOME.x * TILE + HOME.w * TILE - 10, HOME.y * TILE + 1);
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
      for (const img of this.waterImgs) img.setTexture(waterKey(this, HOME_ZI, wf, img.shore));
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
