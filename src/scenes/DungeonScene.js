// Draws a Run and plays its effects. All game rules live in core/;
// this scene only listens to the run's events and animates them.
// Characters stand on the bottom middle of their tile (origin 0.5, 1).

/* global Phaser */
import { setEmote, drawEmote } from './emotes.js';
import { pixEllipse, pixDisc, pixLine, pixDiamond, pixArrow } from './pix.js';
import { TILE, buildTextures, oddKey, findKey, shapeKey, dressKey, wallKey, waterKey, roundedWater, seamKey, SEAM_SPOTS, chasmKey, seaKey, bridgeKey, GRASS_PAL, shadeKey, floorKey, oreFrame, oreTall, dropKey, chipKey, pebbleKey, texScale, N, E, S, W_, NE, SE, SW, NW } from './textures.js';
import { CHARACTERS } from '../data/characters.js';
import { PETS } from '../data/pets.js';
import { ITEMS } from '../data/items.js';
import { T, TERRAIN, GASES, GAS_KEYS, isTrap } from '../data/terrain.js';
import { idx, inMap, lineOfSight, WALL, FLOOR, STAIRS, DOOR, ORE, UPSTAIRS, GRAVE, LOCKED, HIVE, WEED } from '../core/dungeon.js';
import { diveInto } from './burrow.js';
import { WAKE_AT } from '../core/ai.js';
import { BOMB_RANGE } from '../core/run.js';
import { ORE_HITS, HEAR_STEPS, BELL_RANGE, SNEEZE_NOISE, oreGold } from '../data/balance.js';
import { ORES } from '../data/ores.js';
import { cheb, pick } from '../core/util.js';
import { ENEMIES } from '../data/enemies.js';
import { faceKey } from '../data/faces.js';
import { tierOf } from '../data/relics.js';
import { baseZoom } from './zoom.js';
import { wait, fissionMs, evolveMs, FISSION_LEAD, FISSION_STEP, EVOLVE_FLASH, GROW_MS, WELL_MS } from '../ui/beat.js';
import { pace } from '../ui/speed.js';
import { LANDMARKS, landmarkSpot, stoneHead } from './landmarks.js';
import { patchNoise, scatterKey, patchKey, PATCH_VARIANTS, footKey, sideKey, bloomKey, fieldTreeKey, fieldTreeCount, moteKeys, TREE_ODDS, SCATTER_VARIANTS, FOOT_VARIANTS, SIDE_VARIANTS, BLOOM_VARIANTS, FOOT_UP } from './field-decor.js';

// Critter pictures drawn looking left (data/sprites.js); the rest look right, which is what an unflipped
// sprite means here (pose flips it to face left)
const LEFT_ART = new Set(['rat', 'thief', 'hopper', 'woodpecker', 'snail', 'gull', 'hermit', 'hermitBare', 'dungbeetle', 'seal', 'salamander', 'shadecat']);
const D = { tiles: 0, ter: 1, fire: 2, gas: 3, telegraph: 4, pickups: 5, enemies: 6, player: 7, overlay: 8, fx: 9, bubble: 10, text: 11 };
// 골드 on the floor looks like how much is there, for the floor you are on (data/sprites.js gold_1..gold_5):
// two coins, three, a stack, a heap, a sack
const goldTex = (n, floor) => { const u = oreGold(floor); return n <= 1.5 * u ? 'gold_1' : n <= 3 * u ? 'gold_2' : n <= 6 * u ? 'gold' : n <= 12 * u ? 'gold_4' : 'gold_5'; };
// what a pickup looks like on the floor (items use their own sprite)
const PICKUP_TEX = { gold: 'gold', chest: 'chest', lockedChest: 'lockedChest', bossChest: 'bossChest', key: 'key', cageKey: 'cageKey', necklace: 'necklace', tag: 'workertag', candy: 'candy', crystal: 'pedestal', glint: 'glintDirt', cairn: 'cairn' };
// 버릇 (v0.30, data/odd.js HABITS): the bits that fly off a critter at its habit
const HABIT_FX = { bubble: 'splash', sparkle: 'spark', dust: 'dust', snow: 'fluff', flame: 'ember', spark: 'spark', petal: 'berry', spore: 'spore' };
// critters on the wing, who never wade
const FLIERS = new Set(['bat', 'vampLord', 'bee', 'ghostNpc', 'gull', 'jelly', 'butterfly', 'moth', 'queen', 'bigmask']);
// one step's glide (a touch longer than main.js's 120 ms walk beat, so steps run into each other)
// and how quickly the view catches up with you (the time it takes to close most of the gap)
const STEP_MS = 130, CAM_EASE_MS = 140;
// how much of a body is under the water when it wades: the feet and a sliver (v0.29; it was 0.22)
const WADE = 0.13;
// how far above the bottom of its tile the front rim of a burrow's mouth is (sprites.js stairs, upStairs)
const HOLE_LIP = { on: 2, back: 3 };
const center = v => v * TILE + TILE / 2;
// 들판의 일 (v0.30, data/happen.js): what drifts over a field in a shower, by its `fx`: colours, how fast
// it goes (1: a gentle fall), how far it sways, whether it twinkles, rain's streaks
const SHOWER = {
  fluff: { tint: [0xffffff, 0xf4f0e8, 0xe8e1d4], speed: 0.6, sway: 8 },
  leaf: { tint: [0x6cc45a, 0xb5e08a, 0xf4cf4f, 0x2f7a43], speed: 0.8, sway: 10 },
  firefly: { tint: [0xe6ff9a, 0xc8f07a], speed: 0.35, sway: 6, blink: true },
  spore: { tint: [0xc49aff, 0xf4f0e8, 0x9a5fd1], speed: 0.5, sway: 6, blink: true },
  splash: { tint: [0x8fd8f0, 0xffffff], speed: 2.6, sway: 1, streak: true },
  dust: { tint: [0x7d8398, 0xb8bccb, 0xc9c2b6], speed: 0.7, sway: 4 },
  magic: { tint: [0x9a5fd1, 0x6fe0e0], speed: 0.3, sway: 4, blink: true },
  berry: { tint: [0xf29bb2, 0xffd1dc, 0xd9454a, 0xfbf8f2], speed: 0.7, sway: 12 },
  ember: { tint: [0xf08c3a, 0xf4cf4f], speed: 0.8, sway: 6, blink: true },
  steam: { tint: [0xffffff, 0xc9c2b6], speed: 0.4, sway: 5, size: 2 },
};
const RAINBOW_BANDS = [0xd9454a, 0xf08c3a, 0xf4cf4f, 0x6cc45a, 0x4f8de0, 0x9a5fd1];
// a sparkle rock's glow: its grade's light colour (the rainbow stone a warm white)
const oreTint = tier => Phaser.Display.Color.HexStringToColor(ORES[tier].vein ? ORES[tier].vein[0] : '#fff4e0').color;
const foot = v => v * TILE + TILE;
// 숨은 방 (v0.30): the ground right in front of a hidden room's way in, as the way from it to the way
// in ({i, dx, dy}), and how far a picture drawn facing north turns to face that way
function nookFront(map) {
  const n = map.nook;
  if (!n || n.gap < 0 || n.hits == null) return null;
  const gx = n.gap % map.w, gy = (n.gap / map.w) | 0;
  for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
    const x = gx + dx, y = gy + dy, i = idx(x, y);
    if (inMap(x, y) && map.tiles[i] !== WALL && !n.cells.includes(i)) return { i, dx: -dx, dy: -dy };
  }
  return null;
}
const TURN = { '0,-1': 0, '1,0': 90, '0,1': 180, '-1,0': -90 };

// 버릇 (v0.30, data/odd.js HABITS): how a critter moves at its habit, `t` ms into it and `len` long.
// Takes and returns the numbers pose() goes on with.
function habitPose(anim, t, len, o) {
  const k = Math.min(1, t / len), arc = Math.sin(k * Math.PI);
  switch (anim) {
    case 'groom': o.rot = 0.1 * Math.sin(t / 70); o.sx = 1 + 0.04 * Math.sin(t / 50); break;
    case 'spin': o.flip = Math.floor(t / 110) % 2 === 0; o.hop = Math.abs(Math.sin(t / 110)) * 1.5; break;
    case 'jump': o.hop = Math.abs(Math.sin(t / 230)) * 7; o.sy = 1 + 0.08 * Math.sin(t / 115); break;
    case 'puff': o.sx = o.sy = 1 + 0.18 * arc; break;
    case 'nod': o.rot = 0.15 * Math.max(0, Math.sin(t / 140)); break;
    case 'sniff': o.jitter = Math.sin(t / 35) * 0.5; o.sx = 1 + 0.05 * Math.abs(Math.sin(t / 60)); break;
    case 'stretch': o.sy = 1 + 0.2 * arc; o.sx = 1 - 0.1 * arc; break;
    case 'shiver': o.jitter = Math.floor(t / 40) % 2 ? 0.8 : -0.8; break;
    case 'roll': o.rot = 0.6 * Math.sin(k * Math.PI * 4); o.jitter = 2 * Math.sin(k * Math.PI * 2); break;
    case 'flip': o.flipY = k > 0.15 && k < 0.85; break;
    case 'lie': o.rot = -1.4 * Math.min(1, arc * 2); break;
    case 'dance': o.hop = Math.abs(Math.sin(t / 150)) * 3; o.flip = Math.floor(t / 300) % 2 === 0; break;
    case 'shrink': o.sx = o.sy = 1 - 0.3 * arc; break;
    case 'wiggle': o.rot = 0.18 * Math.sin(t / 60); break;
    case 'clap': o.sx = Math.floor(t / 120) % 2 ? 1.08 : 0.96; break;
    case 'swing': o.rot = 0.35 * Math.sin(t / 240); o.hop = 3; break;
    case 'drum': o.hop = Math.abs(Math.sin(t / 70)) * 1.8; o.rot = -0.1 * Math.abs(Math.sin(t / 70)); break;
    case 'kungfu': o.rot = [0, -0.3, 0.3, 0][Math.floor(t / 180) % 4]; o.hop = Math.floor(t / 180) % 4 === 1 ? 3 : 0; break;
    case 'float': o.hop = 3 + 3 * arc + Math.sin(t / 160); break;
    case 'dig': o.rot = 0.25 + 0.12 * Math.sin(t / 55); o.jitter = Math.sin(t / 30) * 0.5; break;
    case 'bow': o.rot = 0.45 * arc; break;
    case 'wobble': o.rot = 0.14 * Math.sin(t / 110); break;
    case 'knead': o.sy = 1 - 0.07 * Math.abs(Math.sin(t / 110)); o.jitter = Math.sin(t / 110) * 0.4; break;
    // 'flicker' fades in and out (pose)
  }
  return o;
}
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
};


export class DungeonScene extends Phaser.Scene {
  constructor(onReady) {
    super('dungeon');
    this.onReady = onReady;
    this.run = null;
    this.path = [];
    this.aim = false;          // true while choosing where to throw a bomb
    this.hover = null;         // tile under the mouse
    this.onTileClick = null;
    this.onHover = null;
  }

  create() {
    buildTextures(this);
    this.cameras.main.setBackgroundColor('#0c1a10');
    this.cameras.main.setRoundPixels(true);

    const burst = (tint, extra = {}) => this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 250, max: 500 }, speed: { min: 15, max: 60 },
      scale: { start: 1.5, end: 0 }, gravityY: 90, tint, ...extra,
    }).setDepth(D.fx);
    this.fx = {
      blood: burst([0xff6b7a, 0xffc4cc]), // a soft pink puff, not gore
      spore: burst([0xc49aff, 0xf4f0e8, 0x9a5fd1], { gravityY: 20 }),
      grump: burst([0xf08c3a, 0xf4cf4f, 0xd9454a], { gravityY: 12, speed: { min: 10, max: 45 } }),
      slime: burst([0x6cc45a, 0x2f7a43]),
      fire: burst([0xf08c3a, 0xf4cf4f, 0xd9454a], { gravityY: -50 }),
      ember: burst([0xf08c3a, 0xf4cf4f], { gravityY: -40, speed: { min: 4, max: 14 }, lifespan: { min: 300, max: 600 }, scale: { start: 1, end: 0 } }),
      spark: burst([0xf4cf4f, 0xffffff], { gravityY: 0, speed: { min: 25, max: 90 } }),
      heal: burst([0x8fd36a, 0xc9f2a8], { gravityY: -60, speed: { min: 6, max: 25 } }),
      magic: burst([0x9a5fd1, 0x6fe0e0], { gravityY: -25 }),
      dust: burst([0x7d8398, 0xb8bccb], { gravityY: 30, speed: { min: 10, max: 40 } }),
      rock: burst([0x4b5064, 0x7d8398, 0xf4cf4f], { gravityY: 220, speed: { min: 20, max: 70 }, scale: { start: 2, end: 1 } }),
      gold: burst([0xf4cf4f, 0xf08c3a], { gravityY: 50 }),
      steam: burst([0xffffff, 0xc9c2b6], { gravityY: -50, speed: { min: 5, max: 20 }, alpha: { start: 0.8, end: 0 } }),
      sleep: burst([0xb58cf0, 0xd8c2ff], { gravityY: -10, speed: { min: 8, max: 30 }, alpha: { start: 0.8, end: 0 }, scale: { start: 2.5, end: 0 } }),
      crystal: burst([0x8fd8f0, 0xc8f6ff, 0x3d8fb3], { gravityY: 120, speed: { min: 20, max: 70 } }),
      // a hot spring's steam: soft wisps drifting up and fading
      warm: burst([0xffffff, 0xe8f6f2], { gravityY: -18, speed: { min: 2, max: 8 }, angle: { min: 250, max: 290 }, lifespan: { min: 900, max: 1500 }, scale: { start: 2.5, end: 4.5 }, alpha: { start: 0.6, end: 0 } }),
      leaf: burst([0x6cc45a, 0x2f7a43, 0xb5e08a], { gravityY: 60, speed: { min: 12, max: 36 }, lifespan: { min: 300, max: 600 }, scale: { start: 1.5, end: 0.5 } }),
      splash: burst([0x8fd8f0, 0xffffff, 0x4f8de0], { gravityY: 160, speed: { min: 20, max: 60 }, angle: { min: 220, max: 320 } }),
      firefly: burst([0xe6ff9a, 0xc8f07a], { gravityY: -20, speed: { min: 6, max: 24 }, lifespan: { min: 500, max: 900 }, scale: { start: 1, end: 0 } }),
      berry: burst([0xd9454a, 0xf29bb2, 0x6cc45a], { gravityY: 60 }),
      // 민들레 홀씨: white tufts that drift up and away
      fluff: burst([0xffffff, 0xf4f0e8, 0xe8e1d4], { gravityY: -14, speed: { min: 4, max: 18 }, lifespan: { min: 600, max: 1100 }, scale: { start: 1.2, end: 0.6 }, alpha: { start: 0.95, end: 0 } }),
      honey: burst([0xf4cf4f, 0xc99a2b, 0xf08c3a], { gravityY: 140, speed: { min: 15, max: 50 }, angle: { min: 200, max: 340 } }),
    };
    // Restraint: every burst is a few pixels, never a fountain (Shattered Pixel Dungeon keeps it this small).
    for (const em of Object.values(this.fx)) {
      const explode = em.explode.bind(em);
      em.explode = (n, x, y) => explode(Math.max(1, Math.min(12, Math.round(n * 0.4))), x, y);
    }
    this.shadowGfx = this.add.graphics().setDepth(D.pickups - 0.5);
    this.gasGfx = this.add.graphics().setDepth(D.gas);
    this.fireGfx = this.add.graphics().setDepth(D.fire);
    this.teleGfx = this.add.graphics().setDepth(D.telegraph);
    this.puffGfx = this.add.graphics().setDepth(D.enemies);
    this.overlay = this.add.graphics().setDepth(D.overlay);
    this.pathGfx = this.add.graphics().setDepth(D.overlay);
    this.bubbles = [];
    this.prints = [];
    this.waterFrame = 0;
    this.lastEmber = 0;

    // Touch works like Shattered Pixel Dungeon: tap a tile to act on it, hold to read about it,
    // drag to look around, pinch (or the mouse wheel) to zoom. The mouse also shows tips on hover.
    this.input.addPointer(1);
    const cam = this.cameras.main;
    const tileOf = ptr => ({ x: Math.floor(ptr.worldX / TILE), y: Math.floor(ptr.worldY / TILE) });
    const downs = () => this.input.manager.pointers.filter(q => q.isDown);
    const spread = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);
    const g = { press: null, pinch: 0, hold: 0 };
    const cancelPress = () => { clearTimeout(g.hold); g.press = null; };
    this.input.on('pointerdown', ptr => {
      if (!this.run) return;
      const two = downs();
      if (two.length >= 2) { cancelPress(); g.pinch = spread(two); g.pinchZoom = this.zoom; return; }
      cancelPress();
      g.press = { id: ptr.id, x: ptr.x, y: ptr.y, tile: tileOf(ptr), sx: cam.scrollX, sy: cam.scrollY, drag: false, held: false };
      const press = g.press;
      if (ptr.wasTouch) g.hold = setTimeout(() => {
        if (g.press !== press || press.drag) return;
        press.held = true;
        this.onHold?.(press.tile.x, press.tile.y);
      }, 380);
    });
    this.input.on('pointermove', ptr => {
      if (!this.run) return;
      if (g.pinch) {
        const two = downs();
        if (two.length < 2) return;
        // the map grows with the fingers: twice as far apart, twice as big
        this.zoomBy(Math.round(g.pinchZoom * spread(two) / g.pinch) - this.zoom);
        return;
      }
      const press = g.press;
      if (press && ptr.isDown && press.id === ptr.id) {
        if (!press.drag && Math.hypot(ptr.x - press.x, ptr.y - press.y) > 10 * this.dpr) {
          press.drag = true;
          clearTimeout(g.hold);
          cam.stopFollow();
        }
        if (press.drag) this.lookAt(press.sx - (ptr.x - press.x) / cam.zoom, press.sy - (ptr.y - press.y) / cam.zoom);
        return;
      }
      if (ptr.wasTouch) return;
      const t = tileOf(ptr);
      if (this.hover && this.hover.x === t.x && this.hover.y === t.y) return;
      this.hover = t;
      this.onHover?.(t.x, t.y);
    });
    const release = ptr => {
      if (g.pinch) { if (!downs().length) g.pinch = 0; return; }
      const press = g.press;
      if (!press || press.id !== ptr.id) return;
      cancelPress();
      if (!press.drag && !press.held && this.run) this.onTileClick?.(press.tile.x, press.tile.y);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', ptr => { if (g.press?.id === ptr.id) cancelPress(); if (!downs().length) g.pinch = 0; });
    this.input.on('wheel', (ptr, objs, dx, dy) => { if (this.run && dy) this.zoomBy(dy < 0 ? 1 : -1); });
    this.input.on('gameout', () => { this.hover = null; this.onHover?.(null, null); });
    this.zoomBias = 0;
    this.scale.on('resize', () => this.fitZoom());
    this.fitZoom();
    this.onReady?.(this);
  }

  get dpr() { return this.game.registry.get('dpr') || 1; }

  fitZoom() {
    const z = baseZoom(this, TILE);
    if (!z) return;
    this.baseZoom = z;
    this.zoomBy(0);
  }

  zoomBy(n) {
    const r = this.dpr, lo = Math.max(1, Math.round(1.5 * r)), hi = Math.round(6 * r);
    const z = Phaser.Math.Clamp(this.baseZoom + this.zoomBias + n, lo, hi);
    this.zoomBias = z - this.baseZoom;
    if (z === this.zoom) return;
    this.zoom = z;
    this.cameras.main.setZoom(z);
  }

  // Drag the view around without losing the map: the middle of the screen stays over the dungeon.
  lookAt(sx, sy) {
    const cam = this.cameras.main, map = this.run?.map;
    if (!map) return;
    const hw = cam.width / 2, hh = cam.height / 2;
    cam.scrollX = Phaser.Math.Clamp(sx + hw, 0, map.w * TILE) - hw;
    cam.scrollY = Phaser.Math.Clamp(sy + hh, 0, map.h * TILE) - hh;
  }

  // back to the hero, e.g. after looking around and then acting
  // 어둠 속 눈 (v0.23): once in a long while, just past the edge of your light, two small eyes open,
  // look at you, blink and are gone. Nothing is ever there when you go to look. Never in the first few
  // fields; a little more often the further out the stage.
  darkEyes() {
    const run = this.run, map = run.map, p = run.p;
    if (run.stage < 1 || this.time.now < (this.eyesAt || 0) || Math.random() > 0.008 + 0.002 * run.stage) return;
    // somewhere on screen you cannot see into: behind a wall, down a dark passage
    const spots = [], v = this.cameras.main.worldView;
    const x0 = Math.max(1, Math.ceil(v.x / TILE) + 1), x1 = Math.min(map.w - 2, Math.floor(v.right / TILE) - 2);
    const y0 = Math.max(1, Math.ceil(v.y / TILE) + 1), y1 = Math.min(map.h - 2, Math.floor(v.bottom / TILE) - 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      if (cheb({ x, y }, p) < 4 || map.visible[i] || map.tiles[i] === WALL || run.enemyAt(x, y)) continue;
      spots.push({ x, y });
    }
    if (!spots.length) return;
    this.eyesAt = this.time.now + 90000;
    const o = spots[Math.floor(Math.random() * spots.length)], cx = center(o.x), cy = center(o.y) - 1;
    const eyes = [-3, 2].map(dx => this.add.rectangle(cx + dx, cy, 2, 2, 0xfff2b0).setDepth(D.fx).setAlpha(0));
    this.tweens.chain({
      targets: eyes,
      tweens: [
        { alpha: 0.9, duration: 600, delay: 300 },
        { scaleY: 0.2, duration: 80, yoyo: true, delay: 1100 },
        { alpha: 0, duration: 500, delay: 900 },
      ],
      onComplete: () => eyes.forEach(e => e.destroy()),
    });
  }

  follow() {
    const cam = this.cameras.main;
    if (this.playerSprite && !cam._follow) cam.startFollow(this.playerSprite, true, 0.1, 0.1, 0, TILE / 2);
  }

  textRes() { return this.zoom || 3; }

  // ---------- wiring ----------
  attach(run) {
    this.run = run;
    this.diving = false;
    this.held = null;
    run.on((type, data) => this.onEvent(type, data));
    if (run.map) this.buildFloor();
  }

  detach() {
    this.run = null;
    this.held = null;
    if (this.fallen) { this.fallen = false; this.cameras.main.postFX?.clear(); }
    // a trip that ends mid-burrow must not leave the view closed over the village
    const iris = document.getElementById('iris');
    if (iris) iris.hidden = true;
    this.diving = false;
    this.aim = false;
    this.clearFloor();
  }

  clearFloor() {
    (this.tileImgs || []).forEach(list => list && list.forEach(i => i.destroy()));
    this.wellImg = null;
    Object.values(this.enemySprites || {}).forEach(s => { s.crown?.destroy(); s.cage?.destroy(); s.destroy(); });
    Object.values(this.pickupSprites || {}).forEach(s => this.dropPickup(s));
    this.bubbles.forEach(b => b.destroy());
    this.playerSprite?.destroy();
    this.petSprite?.destroy();
    this.petSprite = null;
    (this.lamps || []).forEach(l => { l.lamp.destroy(); l.glow.destroy(); });
    this.lamps = [];
    (this.air || []).forEach(a => { a.img.destroy(); a.glow?.destroy(); });
    this.air = [];
    this.light = null;
    this.tileImgs = [];
    this.cull = null;
    this.waterImgs = new Set();
    this.shyWeeds = new Set();
    this.flyImgs = new Set();
    this.enemySprites = {};
    this.pickupSprites = {};
    this.doorImgs = {};
    this.seamGlint = {};
    this.oreImgs = {};
    (this.oreGlows || new Map()).forEach(g => g.img.destroy());
    this.oreGlows = new Map();
    this.bubbles = [];
    this.prints = [];
    this.playerSprite = null;
    // a tween whose sprite is gone keeps running for nothing (the bobbing ones loop forever): sweep them
    for (const t of this.tweens.getTweens()) if (t.targets?.some(o => o?.type && !o.scene)) t.remove();
  }

  // a pickup's sprite and its endless bobbing tween go together
  dropPickup(s) {
    for (const o of [s, s.extra]) if (o) { this.tweens.killTweensOf(o); o.destroy(); }
  }

  get zi() { return this.run.stage; }

  buildFloor() {
    this.clearFloor();
    const run = this.run, map = run.map;
    this.cameras.main.setBackgroundColor(run.zone.void);
    this.placeLandmark();
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) this.buildTile(x, y);
    this.buildLamps();
    this.buildAir();
    this.heroKey = CHARACTERS[run.charId].sprite;
    this.playerSprite = this.makeActor(dressKey(this, this.heroKey, run.meta.wear), run.p.x, run.p.y).setDepth(D.player);
    // the pet trots along a step behind (data/pets.js)
    if (run.pet) { this.petSprite = this.makeActor(PETS[run.pet].sprite, run.p.x, run.p.y).setDepth(D.player - 0.05); this.petSprite.x -= 10; }
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1, 0, TILE / 2);
    this.cameras.main.centerOn(center(run.p.x), foot(run.p.y) - TILE / 2);
    this.sync(true);
  }

  // Through a burrow: you hop up and drop into the hole feet first, behind its front rim (scenes/burrow.js);
  // the view closes in a circle around you, and the next field opens as you climb up out of its hole.
  // The rules have already moved you; this is only the show, and your next move waits for it (busy).
  // `d.dir`: 1 on, -1 back, 0 the first field of a run.
  arrive(d) {
    const ps = this.playerSprite;
    if (!d.dir || !ps) { this.buildFloor(); this.popOut(); this.iris(true, 420); return; }
    if (d.fell) { this.dropIn(d); return; }
    this.busyUntil = performance.now() + 1200 / pace();
    this.diving = true;
    const hx = center(d.from.x), rim = foot(d.from.y) - (d.dir > 0 ? HOLE_LIP.on : HOLE_LIP.back);
    this.tweens.killTweensOf(ps);
    ps.dying = true; // the pose loop leaves it alone from here
    ps.glide = null;
    diveInto(this, ps, {
      x: hx, rim, k: texScale(ps),
      onRim: () => this.fx.dust.explode(10, hx, rim),
      done: () => this.fx.dust.explode(6, hx, rim),
    });
    this.later(240, () => this.iris(false, 340, () => this.later(90, () => {
      this.diving = false;
      this.buildFloor();
      this.popOut();
      this.iris(true, 420);
    })));
  }

  // Down a drop (v0.23): you step out over the edge and shrink away into the dark; on the next field
  // you come down out of the sky and land with a bump.
  dropIn(d) {
    const ps = this.playerSprite;
    this.busyUntil = performance.now() + 1300 / pace();
    this.diving = true;
    this.tweens.killTweensOf(ps);
    ps.dying = true;
    ps.setCrop().setOrigin(0.5, 1).setRotation(0);
    const k = texScale(ps);
    this.tweens.add({ targets: ps, x: center(d.from.x), y: foot(d.from.y), duration: 120, ease: 'Sine.out', onComplete: () => {
      this.tweens.add({ targets: ps, y: ps.y + 12, scaleX: k * 0.3, scaleY: k * 0.3, alpha: 0, angle: 200, duration: 460, ease: 'Quad.in' });
    } });
    this.later(380, () => this.iris(false, 300, () => this.later(80, () => {
      this.diving = false;
      this.buildFloor();
      const p2 = this.playerSprite;
      if (p2) {
        p2.hop = 70;
        this.tweens.add({ targets: p2, hop: 0, duration: 380, ease: 'Quad.in', onComplete: () => {
          this.fx.dust.explode(18, p2.x, p2.y - 2);
          p2.sqx = 1.4; p2.sqy = 0.6;
          this.tweens.add({ targets: p2, sqx: 1, sqy: 1, duration: 240, ease: 'Back.out' });
          this.face('hit', 900);
        } });
      }
      this.iris(true, 420);
    })));
  }

  // You come up out of the hole head first, then hop clear of it and land; with no hole under you (the
  // first field), you pop up squashed flat.
  popOut() {
    const ps = this.playerSprite;
    if (!ps) return;
    this.busyUntil = Math.max(this.busyUntil || 0, performance.now() + 520 / pace());
    const t = this.run.map.tiles[idx(this.run.p.x, this.run.p.y)];
    if (t === STAIRS || t === UPSTAIRS) {
      ps.lip = t === STAIRS ? HOLE_LIP.on : HOLE_LIP.back;
      ps.sink = 1;
      this.tweens.add({
        targets: ps, sink: 0, duration: 260, ease: 'Quad.out',
        onComplete: () => {
          ps.sink = 0; ps.hop = ps.lip;
          this.tweens.add({ targets: ps, hop: 8, duration: 150, ease: 'Quad.out', onComplete: () => this.tweens.add({ targets: ps, hop: 0, duration: 150, ease: 'Quad.in' }) });
        },
      });
      this.later(30, () => this.fx.dust.explode(12, ps.x, ps.y - ps.lip));
      return;
    }
    ps.sqx = 0.6; ps.sqy = 0.2; ps.hop = -4;
    this.tweens.add({ targets: ps, sqx: 1, sqy: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({ targets: ps, hop: 9, duration: 170, ease: 'Quad.out', onComplete: () => this.tweens.add({ targets: ps, hop: 0, duration: 150, ease: 'Quad.in' }) });
    this.later(60, () => this.fx.dust.explode(14, ps.x, ps.y - 2));
  }

  // The circle the view closes to (open = false) or opens from, centred on you; done() when it is over.
  iris(open, ms, done) {
    const el = document.getElementById('iris');
    if (!el) { done?.(); return; }
    const cam = this.cameras.main, box = el.parentElement.getBoundingClientRect(), R = Math.hypot(box.width, box.height);
    const t0 = performance.now();
    ms /= pace();
    el.hidden = false;
    const tick = () => {
      const f = Math.min(1, (performance.now() - t0) / ms), ps = this.playerSprite;
      const r = R * (open ? f * f : (1 - f) * (1 - f));
      let x = box.width / 2, y = box.height / 2;
      if (ps) {
        const cv = this.game.canvas.getBoundingClientRect(), v = cam.worldView, s = (cv.width / this.scale.width) * cam.zoom;
        x = cv.left - box.left + (ps.x - v.x) * s;
        y = cv.top - box.top + (ps.y - TILE / 2 - v.y) * s;
      }
      el.style.background = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, #0c0b11 ${r + 1}px)`;
      if (f < 1) requestAnimationFrame(tick);
      else { if (open) el.hidden = true; done?.(); }
    };
    tick();
  }

  busy() { return performance.now() < (this.busyUntil || 0); }

  // each zone's doors: a fence gate on the meadow, a log door in the forest, a reed curtain in the
  // marsh, a stone slab on the mountain, a curtain of moss in the cave
  doorTex(open) {
    const key = `t_door${open ? 'Open' : ''}_${this.run.zone.style}`;
    return this.textures.exists(key) ? key : open ? 't_doorOpen' : 't_door';
  }

  makeActor(tex, x, y) {
    const s = this.add.image(center(x), foot(y), tex).setOrigin(0.5, 1);
    s.setScale(texScale(s));
    s.hop = 0;
    s.flashUntil = 0;
    return s;
  }

  // 반짝 바위 shine at night (v0.28: they had too little presence): a soft glow of the grade's colour
  // breathes on the ground round each one, and a glint winks on one now and then (update).
  oreGlow(ore) {
    if (this.oreGlows.get(ore)?.img.active) return;
    const xs = ore.cells.map(c => center(c.x)), ys = ore.cells.map(c => center(c.y));
    const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2 + 1;
    const img = this.add.image(mx, my, 'oreGlow').setDepth(D.ter - 0.1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.oreGlows.set(ore, { img, ore, seed: hash(ore.x, ore.y) % 1000, tier: -1 });
  }

  // Miners' lamps on the walls, and how much of their warm light reaches each tile.
  buildLamps() {
    const map = this.run.map, R = 3.5;
    this.light = new Float32Array(map.w * map.h);
    for (const l of map.lights || []) {
      const lamp = this.add.image(l.x * TILE, l.y * TILE, 't_lamp').setOrigin(0).setDepth(D.ter).setVisible(false);
      const glow = this.add.image(center(l.x), l.y * TILE + 6, 'glow').setDepth(D.ter + 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.lamps.push({ ...l, lamp, glow, seed: hash(l.x, l.y) % 1000 });
      for (let y = Math.floor(l.y - R); y <= l.y + R + 1; y++) for (let x = Math.floor(l.x - R); x <= l.x + R; x++) {
        if (!inMap(x, y)) continue;
        const d = Math.hypot(x - l.x, y - l.y - 0.5);
        if (d > R || !lineOfSight(map, l.x, l.y + 1, x, y)) continue;
        const i = idx(x, y);
        this.light[i] = Math.max(this.light[i], 1 - d / R);
      }
    }
  }

  buildTile(x, y) {
    if (!inMap(x, y)) return;
    const map = this.run.map, i = idx(x, y), t = map.tiles[i], ter = map.ter[i], zi = this.zi;
    (this.tileImgs[i] || []).forEach(img => { this.waterImgs.delete(img); this.shyWeeds.delete(img); this.flyImgs.delete(img); img.destroy(); });
    const imgs = [];
    const add = (key, depth = D.tiles) => {
      const img = this.add.image(x * TILE, y * TILE, key).setOrigin(0).setDepth(depth).setVisible(false);
      imgs.push(img);
      return img;
    };
    delete this.doorImgs[i];
    delete this.oreImgs[i];
    // which neighbours pass `test`, as N/E/S/W and diagonal bits
    const around = test => (test(x, y - 1) && N) | (test(x + 1, y) && E) | (test(x, y + 1) && S) | (test(x - 1, y) && W_) |
      (test(x + 1, y - 1) && NE) | (test(x + 1, y + 1) && SE) | (test(x - 1, y + 1) && SW) | (test(x - 1, y - 1) && NW);
    const wall = (nx, ny) => !inMap(nx, ny) || map.tiles[idx(nx, ny)] === WALL;
    const style = this.run.zone.style;
    // by the sea: ground you stand on (not the drops, nor the bridge over them), and land, which is
    // that ground or the rock right round it; everything else is the sea far below
    const seaGround = (nx, ny) => inMap(nx, ny) && !wall(nx, ny) && ![T.CHASM, T.BRIDGE].includes(map.ter[idx(nx, ny)]);
    const seaLand = (nx, ny) => seaGround(nx, ny) || (inMap(nx, ny) && wall(nx, ny) && [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => seaGround(nx + dx, ny + dy)));
    if (t === WALL && map.props?.[i]) {
      // a lone bush, stump, reed clump, boulder or stalagmite standing in a room
      add(floorKey(zi, hash(x, y) & 31));
      add(`t_prop_${style}`, D.ter);
    } else if (t === WALL && style === 'sea' && !around(seaGround)) {
      // 바닷가 절벽: the paths run along the clifftops with a rim of rock, and beyond the rock the sea
      // lies far below; a lighthouse may stand on a rock out there
      const land = around(seaLand) & (N | E | S | W_), h = hash(x, y), v = !land && h % 23 === 0 ? 4 : h % 4;
      const img = add(seaKey(this, zi, land, v, this.waterFrame));
      Object.assign(img, { sea: true, shore: land, v });
      this.waterImgs.add(img);
      imgs.deep = true;
      const lm = map.landmark;
      if (lm && this.inLandmark(x, y)) {
        const f = `${x - lm.x}_${y - lm.y}`;
        if (!this.textures.get(lm.key).empty.has(f)) this.lmImgs.push(add(this.lmOpen ? 'lm_rock_open' : lm.key, D.tiles + 0.7).setFrame(f));
      }
    } else if (t === WALL) {
      // (by the sea a drop beside the rock is more sea: the cliff face is drawn on the drop's side)
      const open = around(style === 'sea' ? seaGround : (nx, ny) => !wall(nx, ny));
      // deep inside a hedge, a wood or a cliff: more of the same, so the field has no black holes
      // (it shows once something near it has been seen; see paintFog)
      add(wallKey(this, zi, open, hash(x, y) % 3));
      if (!open) imgs.deep = true;
      // 틈 너머 비밀 터: light leaking through a narrow gap in the wall's face
      // (v0.29) a hidden room's way in: the bushes a little parted or a crack in the rock, more at each hit
      // (v0.30) turned to face the ground you would come at it from
      if (map.nook?.gap === i) {
        const im = add(map.nook.hits == null ? 't_gap' : `t_hide_${map.nook.kind}${Math.min(2, map.nook.hits)}`, D.tiles + 0.6), f = nookFront(map);
        if (f) Object.assign(im.setOrigin(0.5).setPosition(center(x), center(y)).setAngle(TURN[`${f.dx},${f.dy}`]), { nook: true, out: { dx: -f.dx, dy: -f.dy } });
      }
      // 반짝 광맥 (v0.29): the gems (or golden acorns) still in this bit of wall
      const seam = map.seams?.find(o => o.i === i);
      if (seam?.left > 0) add(seamKey(this, seam.kind, seam.left), D.tiles + 0.6);
      // flowers, berries, cattail heads or crystals on top now and then (not on a face you look at)
      const hb = hash(x * 7 + 3, y * 11 + 5);
      if (!(open & S) && hb % 100 < 28) add(bloomKey(this, this.run.zone, zi, (hb >> 8) % BLOOM_VARIANTS), D.tiles + 0.5);
      if (!open) this.plantTree(x, y, add);
      const lm = map.landmark;
      if (lm && this.inLandmark(x, y)) {
        const f = `${x - lm.x}_${y - lm.y}`;
        if (!this.textures.get(lm.key).empty.has(f)) this.lmImgs.push(add(this.lmOpen ? 'lm_rock_open' : lm.key, D.tiles + 0.7).setFrame(f));
      }
    } else {
      if (ter === T.WATER || ter === T.ICE || ter === T.LAVA) {
        const shore = around((nx, ny) => wall(nx, ny) || map.ter[idx(nx, ny)] !== ter);
        const warm = !!map.spring?.includes(i), kind = ter === T.ICE ? 'ice' : ter === T.LAVA ? 'lava' : null;
        // a pool's outer corners curve round, over the ground (v0.29)
        if (kind !== 'lava' && roundedWater(shore)) add(floorKey(zi, hash(x, y) & 31));
        const img = add(waterKey(this, zi, kind === 'ice' ? 0 : this.waterFrame, shore, warm, kind, kind !== 'lava'));
        img.shore = shore;
        img.warm = warm;
        img.kind = kind;
        // ice lies still; water and lava move
        if (kind !== 'ice') this.waterImgs.add(img);
        // lily pads float on the meadow's, the forest's, the garden's and above all the marsh's water
        const h = hash(x, y);
        if (!warm && !kind && ['meadow', 'forest', 'marsh', 'garden'].includes(style) && h % (style === 'marsh' ? 4 : 9) === 0) add(`t_lily${h % 2}`, D.ter);
      } else if (ter === T.CHASM || ter === T.BRIDGE) {
        // a drop (the cliff face shows where ground meets it on the near side), and the bridge over it
        const gap = (nx, ny) => inMap(nx, ny) && [T.CHASM, T.BRIDGE].includes(map.ter[idx(nx, ny)]);
        const ground = around((nx, ny) => inMap(nx, ny) && !wall(nx, ny) && !gap(nx, ny));
        if (style === 'sea') {
          const land = around(seaLand) & (N | E | S | W_);
          const img = add(seaKey(this, zi, land, hash(x, y) % 4, this.waterFrame));
          Object.assign(img, { sea: true, shore: land, v: hash(x, y) % 4 });
          this.waterImgs.add(img);
        } else add(chasmKey(this, zi, ground & (N | E | S | W_), hash(x, y) % 4));
        // the planks run the way the bridge does (v0.29: one that ran east-west was drawn as a row of
        // little north-south pieces, which looked like doors); a lone tile goes across its drop
        const plank = (nx, ny) => inMap(nx, ny) && map.ter[idx(nx, ny)] === T.BRIDGE, drop = (nx, ny) => inMap(nx, ny) && map.ter[idx(nx, ny)] === T.CHASM;
        const ns = plank(x, y - 1) || plank(x, y + 1) ? true : plank(x - 1, y) || plank(x + 1, y) ? false : drop(x - 1, y) || drop(x + 1, y);
        if (ter === T.BRIDGE) add(bridgeKey(this, ns, hash(x, y) % 3), D.ter);
      } else {
        add(floorKey(zi, hash(x, y) & 31));
        const shade = around(wall) & (N | E | W_ | NE | NW);
        if (shade) add(shadeKey(this, shade));
        this.decorate(x, y, add);
        // 숨은 방 (v0.30): what has spilled out of the way into a hidden room, on the ground in front of it
        const f = map.nook?.gap >= 0 && nookFront(map);
        if (f?.i === i) add(`t_hide_${map.nook.kind}_litter`, D.ter + 0.15).setOrigin(0.5).setPosition(center(x), center(y)).setAngle(TURN[`${f.dx},${f.dy}`]);
      }
      // a snail's slime or the queen's honey shows once you have seen it lying there, so a trail laid
      // out of sight does not light up ground you only remember (v0.29)
      const goo = ter === T.SLIME || ter === T.HONEY;
      if (goo && map.visible[i]) (map.gooSeen ||= {})[i] = map.goo?.[i];
      const spr = !map.hidden[i] && !(goo && map.gooSeen?.[i] !== map.goo?.[i]) && TERRAIN[ter]?.sprite;
      // grass comes in a few looks so a meadow does not look tiled
      if (spr) add(ter === T.BRUSH || ter === T.GRASS ? `t_${spr}${hash(x, y) % 3}${GRASS_PAL[style] ? '_' + style : ''}` : `t_${spr}`, D.ter);
      // 갈림길: a little wooden sign staked behind the hole where its flag would be, the picture of what
      // the field past it has painted on it
      const route = t === STAIRS && map.routes?.find(o => o.x === x && o.y === y);
      if (t === STAIRS) add(route ? 't_stairsBare' : 't_stairs', D.ter);
      if (route) add(`routeSign_${route.kind}`, D.pickups + 0.2).setOrigin(0, 1).setPosition(x * TILE + 4, y * TILE + 8);
      if (t === UPSTAIRS) add('t_upStairs', D.ter);
      if (t === DOOR) this.doorImgs[i] = add(this.doorTex(map.open[i]), D.ter);
      // a stalactite overhead (its shadow and drip mark on the ground); a firefly swarm
      if (map.drips?.some(o => o.x === x && o.y === y)) add('t_drip', D.ter);
      if (map.nests?.includes(i)) add('t_nest', D.ter + 0.2);
      // 소원 우물: the little stone well (dry once its one wish is used)
      if (map.well && map.well.x === x && map.well.y === y) this.wellImg = add(map.well.dry ? 't_wellDry' : 't_well', D.ter + 0.3);
      if (map.flies?.some(o => o.x === x && o.y === y)) {
        const g = add('glow', D.ter + 0.5).setOrigin(0.5).setPosition(center(x), center(y)).setBlendMode(Phaser.BlendModes.ADD);
        const f = add('t_fly', D.ter + 0.6);
        f.fly = g; f.seed = hash(x, y) % 1000; f.home = { x: x * TILE, y: y * TILE };
        this.flyImgs.add(f);
      }
      if (t === LOCKED) add('t_doorLocked', D.ter);
      if (t === GRAVE) add(map.bigGrave === i ? 't_graveBig' : 't_grave', D.ter);
      if (t === HIVE) add(map.hive?.honey ? 't_hive' : 't_hiveEmpty', D.ter);
      if (t === WEED) {
        const w = add('t_weed', D.ter);
        // a screaming root trembles now and then (see update)
        if (map.weeds?.roots.includes(i)) { w.home = x * TILE; this.shyWeeds.add(w); }
      }
      if (t === ORE) {
        const ore = map.ores.find(o => o.cells.some(c => idx(c.x, c.y) === i));
        const [key, frame] = ore?.pebble ? [pebbleKey(ore.tier)] : ore ? oreFrame(this, ore, x, y) : ['t_ore_copper'];
        const im = this.oreImgs[i] = add(key, D.ter);
        if (frame) im.setFrame(frame);
        // a sparkle rock stands a little up over the tile above it (textures.js oreTall), the 2x2 giant a lot
        im.setOrigin(0, 1).setY((y + 1) * TILE);
        if (ore && !ore.pebble) this.oreGlow(ore);
      }
    }
    this.tileImgs[i] = imgs;
  }

  // The zone's one big thing (landmarks.js), where a block of wall big enough for it stands near open
  // ground. It is cut into one picture per tile, so the fog and the light fall on it like on the
  // tiles; those pieces are added by buildTile. map.landmark also tells the tip what it is.
  placeLandmark() {
    const run = this.run, map = run.map, style = run.zone.style, lm = LANDMARKS[style];
    map.landmark = null;
    if (!lm) return;
    const spot = landmarkSpot(map, lm.w, lm.h, run.floor * 31 + run.stage, WALL);
    if (!spot) return;
    map.landmark = { ...spot, name: lm.name, tip: lm.tip, key: this.landmarkTex(style, lm) };
    if (style === 'rock') this.landmarkTex('rock_open', { ...lm, make: () => stoneHead(true) });
    this.lmImgs = [];
  }
  landmarkTex(name, lm) {
    const key = `lm_${name}`;
    if (this.textures.exists(key)) return key;
    const art = lm.make(), W = lm.w * TILE, H = lm.h * TILE;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').drawImage(art, Math.round((W - art.width) / 2), H - art.height);
    const tex = this.textures.addCanvas(key, c), px = c.getContext('2d').getImageData(0, 0, W, H).data;
    tex.empty = new Set();
    for (let cy = 0; cy < lm.h; cy++) for (let cx = 0; cx < lm.w; cx++) {
      tex.add(`${cx}_${cy}`, 0, cx * TILE, cy * TILE, TILE, TILE);
      let any = false;
      for (let j = 0; j < TILE && !any; j++) for (let i = 0; i < TILE; i++) if (px[((cy * TILE + j) * W + cx * TILE + i) * 4 + 3]) { any = true; break; }
      if (!any) tex.empty.add(`${cx}_${cy}`);
    }
    return key;
  }
  inLandmark(x, y, pad = 0) {
    const lm = this.run.map.landmark;
    return !!lm && x >= lm.x - pad && x < lm.x + lm.w + pad && y >= lm.y - pad && y < lm.y + lm.h + pad;
  }
  // the stone head on the mountain opens its eyes now and then, but only while you are far from it
  stirLandmark() {
    const lm = this.run.map.landmark, p = this.run.p;
    if (!lm || this.run.zone.style !== 'rock' || !this.lmImgs?.length) return;
    const far = Math.max(Math.abs(p.x - (lm.x + lm.w / 2)), Math.abs(p.y - (lm.y + lm.h))) > 6;
    const open = far && (this.lmOpen ? Math.random() < 0.7 : Math.random() < 0.12);
    if (open === !!this.lmOpen) return;
    this.lmOpen = open;
    for (const im of this.lmImgs) if (im.active) im.setTexture(open ? 'lm_rock_open' : lm.key, im.frame.name);
  }

  // A tree in the thick of a hedge or a wood, where its whole picture (two tiles wide, three high)
  // stands on wall: at most one in each 3x3 block, at a spot that block's hash picks.
  plantTree(x, y, add) {
    const map = this.run.map, style = this.run.zone.style, n = fieldTreeCount(style);
    if (!n || this.inLandmark(x, y, 2)) return;
    const bx = Math.floor(x / 3), by = Math.floor(y / 3), hb = hash(bx * 13 + 1, by * 17 + 2);
    // out on the meadow only a lone tree stands in the pasture now and then; woods are thick with them
    if (x !== bx * 3 + hb % 2 || y !== by * 3 + 1 + (hb >> 4) % 2 || (hb >> 8) % 10 >= (TREE_ODDS[style] ?? 7)) return;
    for (let dy = -2; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      if (!inMap(x + dx, y + dy) || map.tiles[idx(x + dx, y + dy)] !== WALL) return;
    }
    add(fieldTreeKey(this, style, (hb >> 12) % n), D.tiles + 0.6 + y / 1000).setY((y + 1) * TILE + 2).setOrigin(0, 1);
  }

  // The little things on the ground (field-decor.js): a band of leaves and flowers at the foot of a
  // wall, tufts along a wall to the side, and things scattered over more than half the open ground.
  // Only on plain ground; a hidden trap's tile gets them like any other, so they give nothing away.
  decorate(x, y, add) {
    const map = this.run.map, i = idx(x, y), ter = map.ter[i], z = this.run.zone, zi = this.zi;
    if (map.tiles[i] !== FLOOR) return;
    if (ter !== T.NONE && !(isTrap(ter) && map.hidden[i])) return;
    const plainWall = (nx, ny) => inMap(nx, ny) && map.tiles[idx(nx, ny)] === WALL && !map.props?.[idx(nx, ny)];
    const h = hash(x * 3 + 11, y * 5 + 7);
    if (plainWall(x, y - 1)) {
      add(footKey(this, z, zi, h % FOOT_VARIANTS), D.tiles + 0.5).setY(y * TILE - FOOT_UP);
      return;
    }
    let side = false;
    if (plainWall(x - 1, y) && h % 5 < 3) { add(sideKey(this, z, zi, (h >> 3) % SIDE_VARIANTS, false), D.tiles + 0.5); side = true; }
    if (plainWall(x + 1, y) && (h >> 5) % 5 < 3) { add(sideKey(this, z, zi, (h >> 7) % SIDE_VARIANTS, true), D.tiles + 0.5); side = true; }
    if (side) return;
    // patches where things grow thick, over a soft noise so they come in clumps, not evenly
    if (patchNoise(x, y, this.run.floor) > 0.6) add(patchKey(this, z, zi, (h >> 12) % PATCH_VARIANTS), D.tiles + 0.5);
    else if ((h >> 9) % 100 < 58) add(scatterKey(this, z, zi, (h >> 12) % SCATTER_VARIANTS), D.tiles + 0.5);
  }

  // `soft`: only the look of the tiles changed (grass flattened, a trap went off), so actors keep gliding
  rebuildAround(list, soft = false) {
    const done = new Set();
    for (const i of list) {
      const x = i % this.run.map.w, y = (i / this.run.map.w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny) || done.has(idx(nx, ny))) continue;
        done.add(idx(nx, ny));
        this.buildTile(nx, ny);
      }
    }
    // a blast took a lamp's wall with it
    if (this.lamps.length !== (this.run.map.lights || []).length) {
      this.lamps.forEach(l => { l.lamp.destroy(); l.glow.destroy(); });
      this.lamps = [];
      this.buildLamps();
    }
    if (soft) this.paintFog(); else this.sync(true);
  }

  // ---------- state -> sprites ----------
  sync(instant = false) {
    const run = this.run;
    if (!run || this.diving) return;
    const map = run.map, p = run.p;
    // a step lasts as long as the walk's beat (main.js walkTick) at an even speed, so walking along is
    // one smooth glide like SPD's, not a dart and a stop on every tile
    const dur = instant ? 0 : STEP_MS;

    for (const [i, img] of Object.entries(this.doorImgs)) img.setTexture(this.doorTex(map.open[i]));
    if (!instant) this.stirLandmark();

    this.paintFog();
    this.moveTo(this.playerSprite, p.x, p.y, dur);
    this.lowHp = p.hp > 0 && p.hp <= run.stat().maxHp * 0.3;

    const alive = new Set();
    let threat = false;
    for (const e of run.enemies) {
      if (e.hp <= 0) continue;
      alive.add(e.id);
      let s = this.enemySprites[e.id];
      if (!s) {
        s = this.makeActor(this.enemyLook(e), e.x, e.y).setDepth(D.enemies);
        if (e.d.boss || e.chief) {
          s.setScale(1.25 * texScale(s));
          s.crown = this.add.image(0, 0, 'crown').setOrigin(0.5, 1).setDepth(D.enemies + 0.1);
        }
        // a caged hero sits behind the bars; the cage stays put while they fidget inside
        if (e.type === 'cage') s.cage = this.add.image(center(e.x), foot(e.y), 'cage').setOrigin(0.5, 1).setDepth(D.enemies + 0.1);
        this.enemySprites[e.id] = s;
      }
      // a beetle under the water, or the toad king mid-dive: only the ripples show
      const under = e.state === 'lurk' || e.diving, tex = under ? 'ripple' : this.enemyLook(e);
      if (s.texture.key !== tex && !s.dying) { s.setTexture(tex); if (!e.d.boss && !e.chief) s.setScale(texScale(s)); }
      s.crown?.setVisible(!under);
      s.wet = under;
      // things that stand still (a "chest", a statue, quest folk) stay drawn once seen, like items
      const still = e.state === 'hide' || e.state === 'stone' || e.state === 'npc';
      // the owl's eye feels sleepers through the walls: a faint shape above the dark
      const sensed = run.sensed(e);
      // 그림자 고양이: out of reach of your light it melts into the dark
      const hidden = run.shaded(e);
      s.setVisible(((run.isVisible(e.x, e.y) && !hidden) || (still && !!map.explored[idx(e.x, e.y)]) || sensed));
      s.setAlpha(sensed ? 0.5 : 1).setDepth(sensed ? D.overlay + 0.5 : D.enemies);
      // footsteps in the dark: an awake critter moving out of sight within earshot leaves a faint print
      if (s.at && (s.at.x !== e.x || s.at.y !== e.y) && !s.visible && !['sleep', 'npc'].includes(e.state) && !e.d.npc && cheb(e, run.p) <= HEAR_STEPS) {
        this.prints.push({ x: e.x, y: e.y, dx: e.x - s.at.x, dy: e.y - s.at.y, at: this.time.now });
        if (this.prints.length > 24) this.prints.shift();
      }
      s.at = { x: e.x, y: e.y };
      this.moveTo(s, e.x, e.y, dur);
      // a mark over its head when its mind changes, and only two kinds: ! it is after you, ? it is looking
      const seen = run.isVisible(e.x, e.y);
      if (seen && s.was) {
        if (e.state === 'hunt' && !['hunt', 'flee'].includes(s.was) && e.foe == null) this.emote(s, '!');
        else if (e.state === 'search' && s.was !== 'search') this.emote(s, '?', 1300);
      }
      if (seen && ((e.angry && !s.wasAngry) || (e.rage && !s.wasRage))) this.emote(s, '!', 1100);
      s.was = e.state; s.wasAngry = e.angry; s.wasRage = e.rage;
      // still hot from the chili: a little steam off its head every turn
      if (seen && e.fear > 0) this.fx.steam.explode(4, center(e.x), foot(e.y) - TILE);
      // still cross from the toadstool's spores: the 💢 comes back every turn
      if (seen && e.grump > 0) this.emote(s, 'anger', 800);
      if (seen && !e.d.npc && !run.calm(e) && !['hide', 'stone', 'sleep'].includes(e.state)) threat = true;
    }
    this.safe = !threat;
    for (const id of Object.keys(this.enemySprites)) {
      const s = this.enemySprites[id];
      if (!alive.has(+id) && !s.dying) { s.crown?.destroy(); s.cage?.destroy(); s.destroy(); delete this.enemySprites[id]; }
    }

    const keep = new Set();
    for (const q of run.pickups) {
      const key = `${q.x},${q.y},${q.type}`;
      keep.add(key);
      let s = this.pickupSprites[key];
      if (!s) {
        const tex = q.type === 'gold' ? (q.ore != null ? dropKey(q.ore) : goldTex(q.amount, this.run.payFloor || this.run.floor)) : q.type === 'chest' && q.rich ? 'richChest'
          : q.type === 'trinket' ? findKey(this, q.id) : PICKUP_TEX[q.type] || ITEMS[q.type].sprite;
        s = this.add.image(q.x * TILE, q.y * TILE, tex).setOrigin(0).setDepth(D.pickups).setData('baseY', q.y * TILE + 14);
        if (q.type === 'bossChest') {
          // the boss's chest sits in a warm glow that breathes
          s.extra = this.add.image(q.x * TILE + TILE / 2, q.y * TILE + TILE / 2, 'glow').setTint(0xf4cf4f).setAlpha(0.55).setDepth(D.pickups - 0.1).setScale(1.4);
          this.tweens.add({ targets: s.extra, alpha: 0.25, scale: 1.1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        }
        if (q.type === 'crystal') {
          // the relic floats shut inside a crystal above its stand
          s.extra = this.add.container(q.x * TILE, q.y * TILE - 2, [
            this.add.image(0, -2, q.relic).setOrigin(0),
            this.add.image(-3, -4, 'crystalShell').setOrigin(0),
          ]).setDepth(D.pickups + 0.1);
          this.tweens.add({ targets: s.extra, y: q.y * TILE - 4, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } else {
          const bob = () => this.tweens.add({ targets: s, y: q.y * TILE - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (q.x * 97) % 600 });
          // 머리 쿵: this one falls out of the leaves overhead and bounces where it lands
          if (this.dropIn === key) {
            this.dropIn = null;
            s.y -= 2.5 * TILE;
            this.tweens.add({ targets: s, y: q.y * TILE, duration: 600, ease: 'Bounce.out', onComplete: bob });
          } else bob();
        }
        this.pickupSprites[key] = s;
      }
      s.setVisible(!!map.explored[idx(q.x, q.y)]);
      s.extra?.setVisible(s.visible);
    }
    // a thrown bell, ringing where it landed: it rocks to and fro until it falls quiet
    for (const b of map.bells || []) {
      if (b.frog != null) continue;   // down a frog's throat
      const key = `${b.x},${b.y},ringing`;
      keep.add(key);
      let s = this.pickupSprites[key];
      if (!s) {
        s = this.add.image(center(b.x), foot(b.y), 'bell').setOrigin(0.5, 1).setDepth(D.pickups);
        this.tweens.add({ targets: s, angle: { from: -16, to: 16 }, duration: 170, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.pickupSprites[key] = s;
      }
      s.setVisible(!!map.explored[idx(b.x, b.y)]);
    }
    for (const key of Object.keys(this.pickupSprites)) {
      if (!keep.has(key)) { this.dropPickup(this.pickupSprites[key]); delete this.pickupSprites[key]; }
    }
  }

  // fog of war with light falling off from the player
  paintFog() {
    const run = this.run, map = run.map, p = run.p, W = map.w, H = map.h, n = W * H;
    // slime or honey laid while you were not looking appears when you see that spot
    for (const i of Object.keys(map.goo || {})) if (map.visible[i] && map.gooSeen?.[i] !== map.goo[i]) this.buildTile(i % W, (i / W) | 0);
    const sight = run.stat().sight;
    if (this.fogSeen?.length !== n) { this.fogSeen = new Uint8Array(n); this.fogCol = new Float32Array(n * 3); this.fogCorner = new Float32Array((W + 1) * (H + 1) * 3); }
    const seenA = this.fogSeen, col = this.fogCol, cor = this.fogCorner;
    // the inside of a thick wall has no line of sight of its own: it shows, a shade darker, once a tile
    // within two of it has been seen, lit as if in sight when open ground beside it is; and a patch of it
    // walled in by shown wall shows too, so a big hedge has no dark holes in it
    for (let i = 0; i < n; i++) {
      const imgs = this.tileImgs[i];
      seenA[i] = !imgs ? 0 : imgs.deep ? this.deepSeen(i % W, (i / W) | 0) : map.visible[i] ? 2 : map.explored[i] ? 1 : 0;
    }
    for (let round = 0; round < 2; round++) {
      const fill = [];
      for (let i = 0; i < n; i++) {
        if (seenA[i] || !this.tileImgs[i]?.deep) continue;
        const x = i % W, y = (i / W) | 0;
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inMap(x + dx, y + dy) && seenA[idx(x + dx, y + dy)]) k++;
        if (k >= 3) fill.push(i);
      }
      for (const i of fill) seenA[i] = 1;
    }
    // the landmark shows whole as soon as any of it has been seen
    const lm = map.landmark;
    if (lm) {
      let any = 0;
      for (let y = lm.y; y < lm.y + lm.h; y++) for (let x = lm.x; x < lm.x + lm.w; x++) any = Math.max(any, seenA[idx(x, y)]);
      if (any) for (let y = lm.y; y < lm.y + lm.h; y++) for (let x = lm.x; x < lm.x + lm.w; x++) seenA[idx(x, y)] ||= 1;
    }
    // night: your lantern warms what is near and fades to cold blue at the edge of sight; what you only
    // remember sinks into dim blue, like Shattered Pixel Dungeon's fog
    for (let i = 0; i < n; i++) {
      const seen = seenA[i], x = i % W, y = (i / W) | 0;
      if (!seen) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      let r, v, b;
      if (seen === 2) {
        const t = Math.min(1, Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2) / (sight + 1)), warm = (1 - t) * (1 - t);
        v = 255 - t * 120;
        r = v; b = v - warm * 38 + t * 12; v -= warm * 8;
      } else { r = 50; v = 58; b = 76; }
      // lamplight warms and brightens the tiles around a lamp, even ones you only remember
      const L = this.light ? this.light[i] : 0;
      // walls sit a shade under the ground you walk on (deeper in, deeper still), so the way through a
      // field always reads first, as in Shattered Pixel Dungeon (v0.28)
      const k = L * (seen === 2 ? 40 : 60), dim = map.tiles[i] === WALL ? (this.tileImgs[i].deep ? 0.74 : 0.87) : this.tileImgs[i].deep ? 0.8 : 1;
      col[i * 3] = (r + k + L * 22) * dim; col[i * 3 + 1] = (v + k) * dim; col[i * 3 + 2] = (b + k - L * 34) * dim;
    }
    // the light at each corner is the mean of the tiles that meet there, and each picture is tinted from
    // its corners, so light and fog shade smoothly across the ground instead of in squares
    for (let cy = 0; cy <= H; cy++) for (let cx = 0; cx <= W; cx++) {
      const o = (cy * (W + 1) + cx) * 3;
      let r = 0, g = 0, b = 0;
      for (const [tx, ty] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) {
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const j = (ty * W + tx) * 3;
        r += col[j]; g += col[j + 1]; b += col[j + 2];
      }
      cor[o] = r / 4; cor[o + 1] = g / 4; cor[o + 2] = b / 4;
    }
    const ch = n => Math.max(0, Math.min(255, Math.round(n)));
    const at = (gx, gy) => {
      gx = Math.max(0, Math.min(W, gx)); gy = Math.max(0, Math.min(H, gy));
      const x0 = Math.min(W - 1, Math.floor(gx)), y0 = Math.min(H - 1, Math.floor(gy)), fx = gx - x0, fy = gy - y0;
      const o = (y0 * (W + 1) + x0) * 3, o2 = o + (W + 1) * 3;
      const c = k => (cor[o + k] * (1 - fx) + cor[o + 3 + k] * fx) * (1 - fy) + (cor[o2 + k] * (1 - fx) + cor[o2 + 3 + k] * fx) * fy;
      return (ch(c(0)) << 16) | (ch(c(1)) << 8) | ch(c(2));
    };
    for (let i = 0; i < n; i++) {
      const imgs = this.tileImgs[i];
      if (!imgs) continue;
      imgs.shown = !!seenA[i];
      if (!seenA[i]) { imgs.forEach(im => im.setVisible(false)); continue; }
      const x = i % W, y = (i / W) | 0, on = this.inView(x, y);
      for (const im of imgs) {
        im.setVisible(on);
        if (!on) continue;
        const w = im.displayWidth, h = im.displayHeight, x0 = (im.x - im.originX * w) / TILE, y0 = (im.y - im.originY * h) / TILE;
        im.setTint(at(x0, y0), at(x0 + w / TILE, y0), at(x0, y0 + h / TILE), at(x0 + w / TILE, y0 + h / TILE));
      }
    }
    for (const l of this.lamps) {
      const seen = !!map.explored[idx(l.x, l.y)];
      l.lamp.setVisible(seen);
      l.glow.setVisible(seen);
    }
  }

  // What drifts in the air over a field (field-decor.js): petals on the meadow, leaves in the forest,
  // fluff over the marsh, specks in the hills and the cave, and fireflies blinking about, all inside
  // the view and only over ground you have seen. Moved in update (moveAir).
  buildAir() {
    const style = this.run.zone.style, keys = moteKeys(this, style);
    this.air = [];
    // no fireflies over the sea or in the snow; on the volcano they are embers
    const motes = style === 'cave' ? 8 : 14, flies = { rock: 3, cave: 5, sea: 0, snow: 0, volcano: 6 }[style] ?? 8;
    for (let k = 0; k < motes; k++) {
      this.air.push({ kind: 'mote', img: this.add.image(0, 0, keys[k % keys.length]).setOrigin(0).setDepth(D.player + 0.5).setAlpha(0.85), seed: k * 1.7 });
    }
    for (let k = 0; k < flies; k++) {
      const glow = this.add.image(0, 0, 'glow').setScale(0.4).setDepth(D.player + 0.4).setBlendMode(Phaser.BlendModes.ADD);
      const img = this.add.image(0, 0, 'px').setOrigin(0).setTint(style === 'cave' ? 0x9af0e0 : style === 'volcano' ? 0xffa040 : 0xeaff9a).setDepth(D.player + 0.45);
      this.air.push({ kind: 'fly', img, glow, seed: k * 2.3 + 0.5 });
    }
    this.air.forEach(a => this.placeAir(a, true));
  }

  placeAir(a, anywhere) {
    const v = this.cameras.main.worldView, m = 24;
    a.x = v.x - m + Math.random() * (v.width + 2 * m);
    a.y = anywhere || a.kind === 'fly' ? v.y + Math.random() * v.height : v.y - 6;
    a.vx = a.kind === 'fly' ? (Math.random() - 0.5) * 8 : 2 + Math.random() * 6;
    a.vy = a.kind === 'fly' ? (Math.random() - 0.5) * 6 : 5 + Math.random() * 6;
  }

  moveAir(time, dt) {
    const map = this.run.map, v = this.cameras.main.worldView, s = dt / 1000;
    for (const a of this.air || []) {
      const t = time / 1000 + a.seed;
      if (a.kind === 'mote') { a.x += (a.vx + Math.sin(t * 1.6) * 6) * s; a.y += a.vy * s; }
      else { a.x += (a.vx + Math.sin(t * 0.9) * 5) * s; a.y += (a.vy + Math.cos(t * 1.3) * 4) * s; }
      if (a.x < v.x - 40 || a.x > v.right + 40 || a.y < v.y - 40 || a.y > v.bottom + 10) this.placeAir(a, false);
      const tx = Math.floor(a.x / TILE), ty = Math.floor(a.y / TILE);
      const seen = inMap(tx, ty) && !!map.explored[idx(tx, ty)];
      a.img.setPosition(Math.round(a.x), Math.round(a.y)).setVisible(seen);
      if (a.glow) {
        const on = 0.5 + 0.5 * Math.sin(t * 2.2);
        a.img.setAlpha(0.35 + 0.65 * on);
        a.glow.setPosition(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5).setAlpha(0.25 + 0.6 * on).setVisible(seen);
      }
    }
  }

  // Only the tiles on screen (and a few round it, for the trees reaching up and the bands at the
  // walls' feet) are drawn: a field with all its flowers and trees is thousands of pictures.
  inView(x, y) {
    const c = this.cull;
    return !c || (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1);
  }
  cullTiles() {
    const map = this.run.map, v = this.cameras.main.worldView, M = 3;
    const r = { x0: Math.floor(v.x / TILE) - M, x1: Math.ceil(v.right / TILE) + M, y0: Math.floor(v.y / TILE) - M, y1: Math.ceil(v.bottom / TILE) + M };
    const c = this.cull;
    if (c && c.x0 === r.x0 && c.x1 === r.x1 && c.y0 === r.y0 && c.y1 === r.y1) return;
    this.cull = r;
    const bx0 = Math.max(0, Math.min(r.x0, c ? c.x0 : 0)), bx1 = Math.min(map.w - 1, Math.max(r.x1, c ? c.x1 : map.w - 1));
    const by0 = Math.max(0, Math.min(r.y0, c ? c.y0 : 0)), by1 = Math.min(map.h - 1, Math.max(r.y1, c ? c.y1 : map.h - 1));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const imgs = this.tileImgs[idx(x, y)];
      if (!imgs) continue;
      const on = !!imgs.shown && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
      if (imgs.length && imgs[0].visible !== on) imgs.forEach(im => im.setVisible(on));
    }
  }

  // 2: open ground within two tiles is in sight; 1: something within two has been seen; 0: neither
  deepSeen(x, y) {
    const map = this.run.map;
    let seen = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!inMap(x + dx, y + dy)) continue;
      const j = idx(x + dx, y + dy);
      if (map.visible[j] && map.tiles[j] !== WALL) return 2;
      if (map.explored[j]) seen = 1;
    }
    return seen;
  }

  // Steps glide frame by frame (glideAll) rather than by tween: a new tween stands still for its
  // first frame, which on every tile made walking hitch. A step that comes before the last one is
  // done carries straight on from wherever the sprite is.
  moveTo(sprite, x, y, dur) {
    if (!sprite) return;
    if (sprite.flight > this.time.now) return;   // on the wind (blowAway): it lands by itself
    const tx = center(x), ty = foot(y), g = sprite.glide;
    if (g ? g.x === tx && g.y === ty : sprite.x === tx && sprite.y === ty) return;
    this.tweens.killTweensOf(sprite);
    sprite.hop = 0;
    if (sprite.sqx != null) sprite.sqx = sprite.sqy = 1; // a squash cut short ends with the step
    if (!dur) { sprite.glide = null; sprite.setPosition(tx, ty); return; }
    // your feet take turns: one walk frame per step, back to standing once you arrive
    if (sprite === this.playerSprite) {
      sprite.stepFrame = sprite.stepFrame === 1 ? 2 : 1;
      sprite.stepUntil = this.time.now + dur + 70;
    }
    sprite.glide = { x: tx, y: ty, v: TILE / dur };
  }

  // Everyone on the way somewhere moves toward it at an even pace, both ways at once (so a diagonal
  // step takes as long as a straight one). Left more than a tile behind, they hurry to catch up.
  glideAll(dt) {
    const step = s => {
      const g = s?.glide;
      if (!g) return;
      if (s.dying) { s.glide = null; return; }
      const dx = g.x - s.x, dy = g.y - s.y, d = Math.max(Math.abs(dx), Math.abs(dy));
      const m = g.v * dt * (d > TILE * 1.25 ? d / TILE : 1);
      if (m >= d) { s.setPosition(g.x, g.y); s.glide = null; return; }
      s.x += Phaser.Math.Clamp(dx, -m, m);
      s.y += Phaser.Math.Clamp(dy, -m, m);
    };
    step(this.playerSprite);
    for (const s of Object.values(this.enemySprites)) step(s);
  }

  spriteFor(who) {
    return who === 'player' ? this.playerSprite : this.enemySprites[who.id];
  }

  // A frog's tongue: a pink line shoots out to the tile it aimed at and snaps back.
  tongue(d) {
    const s = this.enemySprites[d.enemy.id];
    if (!s) return;
    const g = this.add.graphics().setDepth(D.fx);
    const x0 = s.x, y0 = s.y - TILE * 0.45, x1 = center(d.to.x), y1 = center(d.to.y);
    const o = { t: 0 };
    const draw = () => {
      g.clear();
      const x = x0 + (x1 - x0) * o.t, y = y0 + (y1 - y0) * o.t;
      g.fillStyle(0xe58aa5, 1); pixLine(g, x0, y0, x, y, 2);
      g.fillStyle(0xf29bb2, 1); pixDisc(g, x, y, 2);
    };
    this.tweens.add({ targets: o, t: 1, duration: 110, ease: 'Quad.out', yoyo: true, hold: 60, onUpdate: draw, onComplete: () => g.destroy() });
  }

  // ---------- events ----------
  onEvent(type, d) {
    if (!this.run) return;
    // something thrown is still in the air: where it lands, and the rest of that turn, waits until it
    // gets there (the rules have already happened; only the show waits)
    if (this.held) {
      if (performance.now() < this.held.until + 400) { this.held.list.push([type, d]); return; }
      this.letGo();
    }
    switch (type) {
      case 'floor': this.arrive(d); break;
      case 'turn': this.sync(); this.follow(); this.darkEyes(); break;
      case 'relics': this.sync(); break;
      case 'tiles': this.rebuildAround(d.list, d.soft); break;
      case 'stairs': this.rebuildAround([idx(d.x, d.y)]); this.fx.spark.explode(16, center(d.x), center(d.y)); break;
      case 'attack': this.bump(this.spriteFor(d.who), d.from, d.to); break;
      case 'hit': this.onHit(d); break;
      case 'kill': if (!d.fell) this.onKill(d.enemy); break;
      case 'phit':
        this.face('hit', 450);
        this.flash(this.playerSprite);
        this.fx.blood.explode(8, center(d.x), center(d.y));
        this.float(d.x, d.y, `-${d.dmg}`, '#ff6b6b');
        break;
      case 'sneak': this.heavyHit(d.x, d.y, d.from); break;
      case 'snore': this.noiseRing(d.x, d.y, d.r, 0xb58cf0); break;
      case 'vein': this.onVein(d); break;
      case 'newOre': this.onNewOre(d); break;
      case 'dodge': this.float(d.x, d.y, '회피', '#6fe0e0'); break;
      // the evolved relics' own moves
      case 'shade': this.fx.magic.explode(14, center(d.x), center(d.y)); break;
      case 'quick': this.float(d.x, d.y - 0.3, '한 번 더!', '#c9f2a8', 80); this.fx.spark.explode(10, center(d.x), center(d.y)); break;
      case 'push': this.fx.dust.explode(10, center(d.from.x), foot(d.from.y) - 2); break;
      case 'bonk': {
        this.fx.spark.explode(12, center(d.x) + d.dx * 7, center(d.y) + d.dy * 7);
        const e = this.run.enemyAt(d.x, d.y), s = e && this.enemySprites[e.id];
        if (s) this.tweens.add({ targets: s, x: s.x + d.dx * 4, duration: 60, yoyo: true });
        break;
      }
      case 'iron': {
        const ps = this.playerSprite;
        if (ps) { ps.setTintFill(0xd8e2ff); ps.flashUntil = this.time.now + 90; }
        this.fx.spark.explode(8, center(d.x), center(d.y) - 6);
        this.float(d.x, d.y - 0.2, '강철!', '#d8e2ff');
        break;
      }
      case 'snooze': this.fx.sleep.explode(5, center(d.x), center(d.y) - 10); break;
      case 'heal': this.float(d.x, d.y, `+${d.n}`, '#8fd36a'); this.fx.heal.explode(6, center(d.x), center(d.y)); break;
      case 'soak': // humming in the hot spring
        if (this.time.now > (this.playerSprite.soakAt || 0)) { this.playerSprite.soakAt = this.time.now + 2600; this.face('sparkle', 900); }
        break;
      case 'gold': this.float(d.x, d.y, `+${d.n}G`, '#f4cf4f', 300); break;
      // 연속 처치: a count over the fallen one, bigger and hotter as it climbs
      case 'combo': {
        const big = d.n >= 5, mid = d.n >= 3;
        this.float(d.x, d.y - 0.4, big ? `${d.n}연속! 대박!` : `${d.n}연속!`, big ? '#ff9a3a' : mid ? '#f4cf4f' : '#fff3b0', 0, big ? 14 : mid ? 11 : 10);
        this.fx.gold.explode(big ? 30 : mid ? 18 : 8, center(d.x), center(d.y));
        if (big) this.fx.spark.explode(20, center(d.x), center(d.y));
        break;
      }
      case 'peck': if (this.petSprite) this.fx.gold.explode(8, this.petSprite.x, this.petSprite.y - 2); break;
      case 'drizzle': if (this.petSprite) this.fx.splash.explode(8, this.petSprite.x, this.petSprite.y); break;
      case 'feel': d.at.forEach(t => this.fx.spark.explode(6, center(t.x), center(t.y))); break;
      // v0.30 pets (data/pets.js): each does its thing with a little beat of its own
      case 'petScout': this.petHop('!'); d.spots.forEach((t, i) => this.time.delayedCall(250 + i * 120, () => this.fx.spark.explode(8, center(t.x), center(t.y)))); break;
      case 'petSniff': this.petHop('?'); this.time.delayedCall(600, () => { this.petHop('!'); this.fx.spark.explode(10, center(d.to.x), center(d.to.y)); }); break;
      case 'petFetch': this.petHop('♪'); this.fx.spark.explode(10, center(d.x), center(d.y) - 4); this.face('sparkle', 900); break;
      case 'petGlow':
        this.petHop('!');
        for (let k = 0; k < 4; k++) this.time.delayedCall(k * 380, () => { this.fx.firefly.explode(10, center(d.x), center(d.y)); this.fx.spark.explode(4, center(d.x), center(d.y)); });
        break;
      case 'petSoft':
        if (this.petSprite) this.tweens.add({ targets: this.petSprite, scaleX: this.petSprite.scaleX * 1.25, scaleY: this.petSprite.scaleY * 0.75, duration: 90, yoyo: true });
        this.float(d.x, d.y - 0.5, '말랑', '#a6e6cf', 0);
        break;
      case 'petZap': if (this.petSprite) this.lightning({ x: this.petSprite.x / TILE - 0.5, y: this.petSprite.y / TILE - 0.5 }, d.to); this.float(d.to.x, d.to.y, '찌릿', '#f4cf4f', 0); break;
      case 'petHoney': this.petHop('♥'); if (this.petSprite) this.fx.honey.explode(12, this.petSprite.x, this.petSprite.y - 4); break;
      case 'petCoins': this.petHop('♪'); this.fx.gold.explode(12, center(d.x), center(d.y) - 4); break;
      case 'bossChest': // the lid flies open and the stage's prize spills out
        this.fx.gold.explode(30, center(d.x), center(d.y) - 4);
        this.fx.spark.explode(20, center(d.x), center(d.y) - 6);
        this.float(d.x, d.y - 0.4, `+${d.gold}G`, '#f4cf4f', 150, 14);
        this.face('sparkle', 1600);
        break;
      case 'pickup':
        this.fx[d.type === 'gold' ? 'gold' : 'spark'].explode(d.type === 'chest' ? 20 : 6, center(d.x), center(d.y));
        if (d.type === 'chest') this.face('sparkle', 900);
        break;
      case 'zap': this.lightning(d.from, d.to); break;
      case 'shot': this.projectile(d.from, d.to, d.hit, d.kind); break;
      case 'wand': this.projectile(d.from, d.to, true, 'magic'); break;
      case 'recharge': if (this.playerSprite) this.fx.magic.explode(5, this.playerSprite.x, this.playerSprite.y - TILE); break;
      case 'throw': {
        // the critters' marks (stars, bars) keep showing how things stood until it lands
        const ms = this.throwArc(d.from, d.to, d.sprite), held = { until: performance.now() + ms / pace(), list: [], snap: this.run.enemies.map(e => ({ ...e })) };
        this.held = held;
        this.busyUntil = Math.max(this.busyUntil || 0, held.until + 30);
        this.time.delayedCall(ms, () => { if (this.held === held) this.letGo(); });
        break;
      }
      // the meadow tools (core/run.js throwTool) where they land
      case 'pine':
        // 도토리 다람쥐 catches it in both paws, with a happy little hop
        if (d.caught != null) {
          const s = this.enemySprites[d.caught];
          if (s) this.tweens.add({ targets: s, hop: 6, duration: 110, yoyo: true, ease: 'Quad.out' });
          this.float(d.x, d.y, d.mark || '덥석!', '#f29bb2', 0, 10);
          break;
        }
        this.fx.dust.explode(d.hit ? 10 : 6, center(d.x), center(d.y));
        this.float(d.x, d.y, d.hit ? '콩!' : '톡', d.hit ? '#f4cf4f' : '#d8d2c0', 0, d.hit ? 12 : 9);
        if (!d.hit) this.noiseRing(d.x, d.y, 3, 0xd8d2c0);
        break;
      // 물범's show: a clap of the flippers now and then, and the pinecone dropping when it is over
      case 'clap': {
        const s = this.enemySprites[d.enemy.id];
        if (s) this.tweens.add({ targets: s, hop: 3, duration: 90, yoyo: true, ease: 'Quad.out' });
        this.float(d.enemy.x, d.enemy.y, '짝짝', '#f4cf4f', 0, 8);
        break;
      }
      case 'juggleDone': if (this.run.isVisible(d.enemy.x, d.enemy.y)) this.float(d.enemy.x, d.enemy.y, '톡', '#d8d2c0', 0, 8); break;
      case 'roll': {
        // 공벌레 rolled up into a ball: a trail of dust behind it, and 데굴데굴 where it stops
        const n = Math.max(Math.abs(d.to.x - d.from.x), Math.abs(d.to.y - d.from.y));
        for (let k = 0; k <= n; k++) this.time.delayedCall(k * 35, () => this.fx.dust.explode(3, center(d.from.x + d.dx * k), foot(d.from.y + d.dy * k) - 2));
        if (n) this.float(d.to.x, d.to.y, '데굴데굴', '#d8d2c0', 0, 9);
        break;
      }
      case 'bury':
        // the squirrel scratches a hole for its pinecone, then pats the earth down over it
        if (this.run.isVisible(d.enemy.x, d.enemy.y)) {
          this.fx.dust.explode(4, center(d.enemy.x), center(d.enemy.y) + 4);
          if (d.done) this.float(d.enemy.x, d.enemy.y, '토닥토닥', '#d8d2c0', 0, 8);
        }
        break;
      case 'melt':
        // sweat, steam, and a little run of water where it stood
        if (this.run.isVisible(d.x, d.y)) {
          this.fx.steam.explode(14, center(d.x), center(d.y) - 6);
          this.float(d.x, d.y, '주르륵', '#8fd8f0', 300, 10);
        }
        break;
      case 'reel': for (const t of d.list) if (this.run.isVisible(t.x, t.y)) this.fx.spark.explode(3, center(t.x), center(t.y) - 8); break;
      case 'sweet': for (const e of d.list) if (this.run.isVisible(e.x, e.y)) this.float(e.x, e.y, d.mark || '♥', d.mark ? '#f4cf4f' : '#f29bb2', 160, 8); break;
      // 불도마뱀 + 매운 고추: gulped down with relish
      case 'yum': if (this.run.isVisible(d.enemy.x, d.enemy.y)) this.float(d.enemy.x, d.enemy.y + 0.1, '꿀꺽!', '#ff9a3a', 0, 10); break;
      case 'honeyPour': {
        const ring = this.add.circle(center(d.x), center(d.y), TILE * 0.6).setStrokeStyle(2, 0xf4cf4f, 0.9).setDepth(D.fx).setScale(0.4);
        this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 380, ease: 'Quad.out', onComplete: () => ring.destroy() });
        this.fx.honey.explode(24, center(d.x), center(d.y));
        for (const e of d.list) this.float(e.x, e.y, '찐득!', '#f4cf4f', 80, 9);
        break;
      }
      case 'doze': for (const e of d.list) { this.fx.sleep.explode(8, center(e.x), center(e.y) - 4); this.float(e.x, e.y, 'Zz', '#d8c2ff', 120, 10); } break;
      case 'chili': {
        const s = this.enemySprites[d.enemy.id];
        if (s) { s.flashUntil = this.time.now + 260; s.setTint(0xff5040); this.tweens.add({ targets: s, hop: 9, duration: 120, yoyo: true, ease: 'Quad.out' }); }
        this.fx.fire.explode(10, center(d.enemy.x), center(d.enemy.y) - 6);
        this.fx.steam.explode(8, center(d.enemy.x), center(d.enemy.y) - 10);
        break;
      }
      case 'ring':
        this.noiseRing(d.x, d.y, BELL_RANGE, 0xf4cf4f);
        this.float(d.x, d.y, '딸랑', '#f4cf4f', 0, 9);
        break;
      case 'bellDone': this.fx.spark.explode(6, center(d.x), center(d.y)); break;
      case 'blow': this.blowAway(d); break;
      case 'boom': this.explosion(d.x, d.y, d.r); break;
      case 'gasboom': this.gasBoom(d.tiles); break;
      case 'puff': this.fx[d.kind].explode(30, center(d.x), center(d.y)); break;
      case 'rustle': this.fx.leaf.explode(7, center(d.x), center(d.y) + 3); break;
      // ---- 비밀 (v0.28, core/run.js bumpWall and the rest) ----
      // walking into a wall: a nudge and a few leaves (grit off rock); a bush in a room sways
      case 'poke':
        this.bump(this.playerSprite, { x: d.x - d.dx, y: d.y - d.dy }, d);
        this.fx[d.kind === 'rock' ? 'dust' : 'leaf'].explode(d.prop ? 8 : 5, center(d.x) - d.dx * 6, center(d.y) - d.dy * 6 + 2);
        if (d.prop) this.sway(idx(d.x, d.y));
        break;
      // 머리 쿵: stars round your head, and (the first time) something drops out of the leaves overhead
      case 'headbonk':
        this.face('hit', 1000);
        this.float(d.x, d.y - 0.4, '쿵!', '#f4cf4f', 0, 12);
        this.fx.spark.explode(8, this.playerSprite.x, this.playerSprite.y - TILE);
        this.emote(this.playerSprite, 'stars', 1600);
        if (d.drop) {
          this.fx.leaf.explode(10, center(d.drop.x), d.drop.y * TILE - 2 * TILE);
          this.dropIn = `${d.drop.x},${d.drop.y},${d.drop.type}`;
        }
        break;
      case 'baby': this.babyOut(d); break;
      // 숨은 방 (v0.29): leaves or chips of rock fly from the wall at each hit, and a burst when it opens
      case 'hideHit':
        this.bump(this.playerSprite, { x: d.x - d.dx, y: d.y - d.dy }, d);
        this.fx[d.kind === 'rock' ? 'rock' : 'leaf'].explode(6 + d.n * 3, center(d.x) - d.dx * 5, center(d.y) - d.dy * 5 + 2);
        if (d.kind === 'rock') this.fx.dust.explode(4 + d.n * 2, center(d.x), center(d.y) + 3);
        this.float(d.x, d.y - 0.2, d.kind === 'rock' ? '쩍!' : '바스락!', d.kind === 'rock' ? '#d8d0c4' : '#c9f2a8', 0, 9);
        break;
      case 'pry': {
        // a gem (or a golden acorn) pops out of the wall, more of a burst the further in it was
        this.bump(this.playerSprite, d.from, d);
        this.fx[d.kind === 'gem' ? 'crystal' : 'leaf'].explode(5 + d.n * 3, center(d.x), center(d.y));
        if (d.kind === 'gem') this.fx.dust.explode(3 + d.n, center(d.x), center(d.y) + 3);
        this.float(d.x, d.y - 0.3, d.last ? '반짝!' : d.kind === 'gem' ? '똑!' : '톡!', d.last ? '#fff3b0' : '#d8f6ff', 0, d.last ? 12 : 9);
        if (d.last) this.face('sparkle', 1400);
        break;
      }
      case 'hideOpen':
        this.bump(this.playerSprite, { x: d.x - d.dx, y: d.y - d.dy }, d);
        this.fx[d.kind === 'rock' ? 'rock' : 'leaf'].explode(18, center(d.x), center(d.y));
        this.fx.dust.explode(12, center(d.x), center(d.y) + 2);
        this.float(d.x, d.y - 0.2, d.kind === 'rock' ? '와르르!' : '쏙!', '#f4cf4f', 60, 11);
        this.face('sparkle', 1400);
        break;
      case 'squeeze':
        this.fx.leaf.explode(14, center(d.x), center(d.y));
        this.float(d.x, d.y - 0.2, '쏙!', '#c9f2a8', 60, 10);
        this.face('sparkle', 1400);
        break;
      // 비밀 (v0.29): what went down the cliff, heard only a long while later; a pinecone roasting in
      // the lava; a sleeper rolling over beside you
      case 'plop': this.time.delayedCall(1700, () => this.float(d.x, d.y, '…퐁', '#9fd4ff', 0, 8)); break;
      case 'roast':
        this.fx.steam.explode(10, center(d.x), center(d.y));
        this.float(d.x, d.y, '타닥타닥!', '#ffb062', 0, 10);
        this.face('sparkle', 1200);
        break;
      case 'lull': {
        const s = this.enemySprites[d.enemy.id];
        if (s) { s.setFlipX(!s.flipX); this.tweens.add({ targets: s, hop: 4, duration: 140, yoyo: true, ease: 'Quad.out' }); this.emote(s, 'z', 1400); }
        this.float(d.x, d.y, '데굴', '#f4f0e8', 0, 9);
        break;
      }
      // 별난 것들 (v0.30, core/wonders.js)
      case 'habit': {
        const s = this.enemySprites[d.enemy.id];
        if (!s) break;
        s.habit = { anim: d.anim, at: this.time.now, until: this.time.now + 1500 };
        if (d.mark) this.emote(s, d.mark, 1500);
        const fx = HABIT_FX[d.fx];
        if (fx) for (const t of [0, 500, 1000]) this.time.delayedCall(t, () => { if (!s.dying && s.active) this.fx[fx].explode(5, s.x, s.y - 8); });
        break;
      }
      case 'pat': {
        const s = this.enemySprites[d.enemy.id];
        this.bump(this.playerSprite, d.from, d.enemy);
        if (s) { this.emote(s, '♥', 1400); this.tweens.add({ targets: s, hop: 3, duration: 120, yoyo: true, ease: 'Quad.out' }); }
        this.face('sparkle', 900);
        break;
      }
      case 'flower': this.fx.berry.explode(10, center(d.x), center(d.y) - 6); break;
      case 'gift': this.giftArc(d); break;
      case 'happen': this.happening(d); break;
      case 'cairn':
        this.fx.heal.explode(16, center(d.x), center(d.y) - 4);
        this.fx.spark.explode(8, center(d.x), center(d.y) - 10);
        this.face('sparkle', 1400);
        break;
      case 'cower': {
        const s = this.enemySprites[d.enemy.id];
        if (s && this.run.isVisible(d.enemy.x, d.enemy.y)) this.emote(s, 'sweat', 700);
        break;
      }
      case 'spirit': this.spiritUp(d); break;
      case 'spiritGone': this.spiritDown(d); break;
      case 'dream':
        this.face('blink', 1800);
        this.emote(this.playerSprite, 'z', 1800);
        this.fx.sleep.explode(12, center(d.x), center(d.y) - 10);
        break;
      case 'dig': this.fx.dust.explode(14, center(d.x), center(d.y)); this.fx.rock.explode(6, center(d.x), center(d.y)); break;
      case 'shatter': this.fx.crystal.explode(16, center(d.x), center(d.y)); break;
      case 'unlock': this.fx.spark.explode(14, center(d.x), center(d.y)); break;
      case 'honey':
        this.fx.gold.explode(18, center(d.x), center(d.y));
        this.fx.heal.explode(14, center(this.run.p.x), center(this.run.p.y));
        this.float(this.run.p.x, this.run.p.y, `♥+${d.n}`, '#ff9fb4', 0, 12);
        this.face('sparkle', 1100);
        break;
      case 'pluck':
        // out comes the weed with a puff of leaves and soil
        this.fx.leaf.explode(d.root ? 16 : 10, center(d.x), center(d.y));
        this.fx.dust.explode(6, center(d.x), center(d.y) + 4);
        break;
      case 'scream': {
        // a pink ring of noise round the root, and the field hears it
        this.noiseRing(d.x, d.y, 2, 0xff8fb0);
        const e = this.run.enemyAt(d.x, d.y), s = this.enemySprites[e?.id];
        if (s) this.emote(s, '!', 500);
        // just pulled: its sprite turns up a moment later, then it yells
        if (d.first && e) { this.time.delayedCall(80, () => this.say(e, '꺄아아악!')); this.face('shock', 900); }
        break;
      }
      case 'burrow': {
        // it digs back into the ground
        const s = this.enemySprites[d.enemy.id];
        this.fx.dust.explode(14, center(d.enemy.x), center(d.enemy.y) + 4);
        if (s) { s.dying = true; this.tweens.add({ targets: s, scaleY: 0, alpha: 0, duration: 260, onComplete: () => { s.destroy(); delete this.enemySprites[d.enemy.id]; } }); }
        break;
      }
      case 'weedsDone':
        this.fx.spark.explode(24, center(d.x), center(d.y));
        this.float(d.x, d.y, '다 뽑았다!', '#b5e08a', 120, 11);
        this.face('sparkle', 1100);
        break;
      case 'warp': {
        // a puff of fairy dust where you stepped in, and you pop out of the other ring
        this.fx.magic.explode(20, center(d.from.x), center(d.from.y));
        this.fx.spark.explode(16, center(d.to.x), center(d.to.y));
        this.moveTo(this.playerSprite, d.to.x, d.to.y, 0);
        const ps = this.playerSprite;
        ps.sqx = 0.6; ps.sqy = 1.4;
        this.tweens.add({ targets: ps, sqx: 1, sqy: 1, duration: 260, ease: 'Back.out' });
        this.face('shock', 600);
        break;
      }
      case 'swarm': if (d.x != null) this.noiseRing(d.x, d.y, 2, 0xf4cf4f); break;
      case 'smoke': this.fx.steam.explode(24, center(d.x), center(d.y)); this.fx.sleep.explode(10, center(d.x), center(d.y)); break;
      case 'locked': this.float(d.x, d.y, '잠김', '#b8bccb'); break;
      case 'vanish': this.fx.magic.explode(26, center(d.x), center(d.y)); this.float(d.x, d.y, '고마워!', '#c8f6ff', 0, 11); break;
      case 'bang': {
        // the cage rattles on its own spot; wood chips fly off the lock
        const e = this.run.enemies.find(o => o.d.caged && o.x === d.x && o.y === d.y), s = this.enemySprites[e?.id];
        if (s?.cage) this.tweens.add({ targets: s.cage, x: center(d.x) + (d.from.x <= d.x ? 1 : -1), duration: 50, yoyo: true, repeat: 1 });
        this.fx.rock.explode(4 + d.n * 2, center(d.x), center(d.y) + 3);
        this.noiseRing(d.x, d.y, 1 + d.n, 0xf4cf4f);
        this.bump(this.playerSprite, d.from, d);
        this.face('grit', 380);
        break;
      }
      case 'rescue': this.onRescue(d); break;
      case 'reveal': {
        const s = this.enemySprites[d.enemy.id];
        if (s) {
          s.setTexture(d.enemy.d.sprite);
          this.tweens.add({ targets: s, hop: 7, duration: 110, yoyo: true, ease: 'Quad.out' });
        }
        this.fx.dust.explode(10, center(d.enemy.x), center(d.enemy.y));
        break;
      }
      case 'trap': this.onTrap(d); break;
      case 'summon': this.fx.magic.explode(16, center(d.x), center(d.y)); break;
      case 'alarm':
        this.noiseRing(d.x, d.y, 9, 0xff6b6b);
        break;
      case 'spot':
        this.float(d.x, d.y, '!', '#f4cf4f', 0, 14);
        this.fx.spark.explode(10, center(d.x), center(d.y));
        break;
      case 'steam': this.fx.steam.explode(14, center(d.x), center(d.y)); break;
      case 'shock': this.shock(d.tiles); break;
      case 'mine': this.onMine(d); break;
      case 'heard':
        // the noise rolls out from you as red rings; the ones that heard get arrows at the edge of the view
        {
          const ring = this.add.circle(center(d.x), center(d.y), TILE).setStrokeStyle(1, 0xff6a6a, 0.9).setDepth(D.fx).setScale(0.3);
          this.tweens.add({ targets: ring, scale: 3 + d.list.length * 0.4, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: () => ring.destroy() });
        }
        this.heardMarks = d.list.map(e => ({ e, until: this.time.now + 2200 }));
        break;
      case 'say': this.say(d.who, d.text); break;
      // 심술 버섯: a whiff of the spores and it bristles (the mark keeps coming back while it is cross)
      case 'grump': { const s = this.enemySprites[d.enemy.id]; if (s && this.run.isVisible(d.enemy.x, d.enemy.y)) this.emote(s, 'anger', 900); break; }
      case 'sneeze': this.noiseRing(d.x, d.y, SNEEZE_NOISE, 0xf08c3a); break;
      // 다툼: the winner puffs up a size (run.puffUp), with a sparkle and a 쑥
      case 'puffUp': {
        const s = this.enemySprites[d.enemy.id];
        if (!s || !this.run.isVisible(d.enemy.x, d.enemy.y)) break;
        this.fx.spark.explode(14, center(d.enemy.x), center(d.enemy.y) - 4);
        this.float(d.enemy.x, d.enemy.y - 0.4, '쑥!', '#ffb07a', d.late ? 520 : 60, 11); // (after what set it off, '꿀꺽!')
        this.tweens.add({ targets: s, hop: 8, duration: 120, yoyo: true, ease: 'Quad.out' });
        break;
      }
      // 다툼: hit by another critter, it bristles at that one (💢)
      case 'brawl': {
        const s = this.enemySprites[d.enemy.id];
        if (s && this.run.isVisible(d.enemy.x, d.enemy.y)) { this.emote(s, 'anger', 1400); this.tweens.add({ targets: s, hop: 6, duration: 90, yoyo: true, ease: 'Quad.out' }); }
        break;
      }
      case 'alert': {
        const s = this.enemySprites[d.enemy.id];
        if (s) this.tweens.add({ targets: s, hop: 5, duration: 100, yoyo: true, ease: 'Quad.out' });
        // you see it notice you: wide eyes and a bead of sweat
        if (this.run.isVisible(d.enemy.x, d.enemy.y)) { this.face('shock', 700); this.playerSprite.sweatUntil = this.time.now + 900; }
        break;
      }
      case 'discover': this.fx.spark.explode(30, center(this.run.p.x), center(this.run.p.y)); this.face('sparkle', 1000); break;
      case 'slam':
        d.tiles.forEach(t => this.fx.dust.explode(3, center(t.x), center(t.y)));
        break;
      case 'rage': {
        // the last boss loses its temper: a red flash, and its frown deepens for the rest of the fight
        const s = this.enemySprites[d.enemy.id];
        this.fx.magic.explode(30, center(d.enemy.x), center(d.enemy.y));
        if (s) { s.setTintFill(0xff5050); s.flashUntil = this.time.now + 220; this.tweens.add({ targets: s, hop: 7, duration: 120, yoyo: true, repeat: 1 }); }
        this.face('shock', 900);
        break;
      }
      case 'teleport':
        this.fx.magic.explode(18, center(d.from.x), center(d.from.y));
        this.fx.magic.explode(18, center(d.to.x), center(d.to.y));
        break;
      case 'steal': {
        // your coins hop over to the goblin
        const s = this.enemySprites[d.enemy.id];
        for (let k = 0; k < Math.min(8, 2 + d.n / 4); k++) {
          const c = this.add.image(center(d.from.x), center(d.from.y), 'coin').setDepth(D.fx);
          this.tweens.add({
            targets: c, x: s ? s.x : center(d.enemy.x), duration: 300, delay: k * 40, ease: 'Quad.out',
            onUpdate: tw => { c.y = center(d.from.y) + (center(d.enemy.y) - center(d.from.y)) * tw.progress - Math.sin(tw.progress * Math.PI) * TILE; },
            onComplete: () => c.destroy(),
          });
        }
        this.float(d.from.x, d.from.y, `-${d.n}G`, '#f4cf4f', 100);
        break;
      }
      case 'pant': {
        // the goblin with your gold stops to catch its breath: a bead of sweat, a puff, a little sag
        const s = this.enemySprites[d.enemy.id];
        if (!s || !this.run.isVisible(d.enemy.x, d.enemy.y)) break;
        this.emote(s, 'sweat', 900);
        this.fx.dust.explode(4, center(d.enemy.x) + 5, center(d.enemy.y) - 2);
        this.tweens.add({ targets: s, hop: 1.5, duration: 150, yoyo: true, repeat: 2, ease: 'Sine.inOut' });
        break;
      }
      case 'dropLoot': {
        // caught: the pouch bursts and the coins hop down onto the tile
        for (let k = 0; k < Math.min(6, 2 + d.n / 5); k++) {
          const c = this.add.image(center(d.x), center(d.y), 'coin').setDepth(D.fx);
          const dx = (k - 2.5) * 3;
          this.tweens.add({
            targets: c, x: center(d.x) + dx, duration: 260, delay: k * 30, ease: 'Quad.out',
            onUpdate: tw => { c.y = center(d.y) - Math.sin(tw.progress * Math.PI) * 10; },
            onComplete: () => c.destroy(),
          });
        }
        break;
      }
      case 'escape': {
        const s = this.enemySprites[d.enemy.id];
        this.fx.dust.explode(20, center(d.enemy.x), center(d.enemy.y));
        if (s) { s.dying = true; this.tweens.add({ targets: s, alpha: 0, duration: 200, onComplete: () => { s.destroy(); delete this.enemySprites[d.enemy.id]; } }); }
        break;
      }
      case 'swell': this.fx.spore.explode(8, center(d.x), center(d.y)); break;
      case 'bones':
        this.fx.spore.explode(30, center(d.x), center(d.y));
        this.fx.dust.explode(10, center(d.x), center(d.y));
        this.noiseRing(d.x, d.y, 1, 0xc49aff);
        break;
      case 'split': {
        this.fx.slime.explode(14, center(d.from.x), center(d.from.y));
        const c = this.enemySprites[d.child.id];
        if (c) { c.x = center(d.from.x); c.y = foot(d.from.y); this.tweens.add({ targets: c, x: center(d.child.x), y: foot(d.child.y), duration: 160, ease: 'Quad.out' }); }
        break;
      }
      case 'stone': this.fx.dust.explode(8, center(d.enemy.x), center(d.enemy.y)); break;
      // the marsh and the cave (v0.21)
      case 'aimTongue': {
        const s = this.enemySprites[d.enemy.id];
        if (s) this.tweens.add({ targets: s, sqy: 1.15, sqx: 0.9, duration: 120, yoyo: true });
        break;
      }
      case 'tongue': this.tongue(d); break;
      case 'pull': this.fx.dust.explode(10, center(d.from.x), foot(d.from.y) - 2); this.face('shock', 700); break;
      case 'surface': {
        this.fx.splash.explode(20, center(d.enemy.x), center(d.enemy.y) + 2);
        const s = this.enemySprites[d.enemy.id];
        if (s) { s.hop = 6; this.tweens.add({ targets: s, hop: 0, duration: 220, ease: 'Bounce.out' }); }
        this.face('shock', 800);
        break;
      }
      case 'grab': this.float(d.x, d.y, '꽉!', '#ff9a9a', 60); break;
      case 'struggle': {
        const ps = this.playerSprite;
        if (ps) this.tweens.add({ targets: ps, hop: 2, duration: 60, yoyo: true, repeat: 2 });
        this.fx.dust.explode(6, center(d.x), foot(d.y) - 2);
        break;
      }
      case 'regen': if (this.run.isVisible(d.enemy.x, d.enemy.y)) { this.float(d.enemy.x, d.enemy.y, `+${d.n}`, '#8fd36a', 0, 9); this.fx.heal.explode(4, center(d.enemy.x), center(d.enemy.y)); } break;
      case 'prick': this.float(d.x, d.y, '따끔', '#c8f6ff', 60); this.fx.crystal.explode(8, center(d.from.x), center(d.from.y)); break;
      // the friends' own moves (v0.21)
      case 'hop': { // 토끼: a little hop and a puff of dust where it took off
        const ps = this.playerSprite;
        if (ps) { ps.hop = -5; ps.sqx = -0.15; ps.sqy = 0.2; }
        this.fx.dust.explode(8, center(d.x - d.dx), foot(d.y - d.dy) - 2);
        break;
      }
      case 'shell': this.fx.dust.explode(5, center(d.x), foot(d.y) - 2); break;
      case 'shellhit': this.float(d.x, d.y - 0.3, '단단', '#c9e7a0', 60); break;
      case 'blend': this.fx.leaf.explode(8, center(d.x), center(d.y)); break;
      case 'ram': this.float(d.x, d.y - 0.3, '박치기!', '#f4cf4f', 60); this.fx.spark.explode(12, center(d.x), center(d.y)); break;
      case 'breath': {
        const n = 5;
        for (let k = 1; k <= n; k++) {
          const t = k / n;
          this.later(k * 30, () => this.fx.fire.explode(5, center(d.from.x + (d.to.x - d.from.x) * t), center(d.from.y + (d.to.y - d.from.y) * t)));
        }
        break;
      }
      case 'stink':
        this.fx.leaf.explode(12, center(d.x), center(d.y));
        this.fx.steam.explode(16, center(d.x), center(d.y));
        d.list.forEach(e => this.float(e.x, e.y - 0.3, '어질', '#c9e7a0', 60));
        break;
      case 'rockfall':
        this.fx.rock.explode(14, center(d.x), center(d.y));
        this.fx.dust.explode(14, center(d.x), center(d.y) + 3);
        if (this.run.map.drips) this.rebuildAround([idx(d.x, d.y)], true);
        break;
      case 'rumble':
        for (const r of this.run.rocks || []) this.fx.dust.explode(4, center(r.x), r.y * TILE + 2);
        break;
      case 'quake': this.fx.rock.explode(20, center(d.x), center(d.y) - 6); this.fx.dust.explode(20, center(d.x), center(d.y)); break;
      case 'dive':
        this.fx.splash.explode(24, center(d.from.x), center(d.from.y) + 2);
        this.fx.splash.explode(10, center(d.to.x), center(d.to.y) + 2);
        break;
      case 'splash':
        d.tiles.forEach(t => this.fx.splash.explode(5, center(t.x), center(t.y) + 3));
        this.fx.splash.explode(20, center(d.enemy.x), center(d.enemy.y));
        break;
      case 'fly':
        this.fx.firefly.explode(16, center(d.x), center(d.y));
        this.float(d.x, d.y, '반딧불이!', '#e6ff9a', 0, 10);
        this.rebuildAround([idx(d.x, d.y)], true);
        break;
      case 'berry': this.fx.berry.explode(14, center(d.x), center(d.y)); break;
      case 'aimCharge': {
        const s = this.enemySprites[d.enemy.id];
        if (s) this.tweens.add({ targets: s, hop: 4, duration: 90, yoyo: true, repeat: 1 });
        this.fx.dust.explode(6, center(d.enemy.x), center(d.enemy.y) + 4);
        break;
      }
      case 'charge':
        for (let k = 0, n = Math.max(Math.abs(d.to.x - d.from.x), Math.abs(d.to.y - d.from.y)); k <= n; k++) {
          const x = d.from.x + Math.sign(d.to.x - d.from.x) * k, y = d.from.y + Math.sign(d.to.y - d.from.y) * k;
          this.time.delayedCall(k * 30, () => this.fx.dust.explode(5, center(x), center(y) + 4));
        }
        if (!d.hit) { this.fx.spark.explode(8, center(d.to.x), center(d.to.y) - 8); }
        break;
      case 'fission': {
        // the candy bursts into stars, then each relic it grows pops up over your head, one after another
        const ms = fissionMs(d.steps.length);
        this.later(wait(d, ms), () => {
          this.face('sparkle', ms + 300);
          this.fx.spark.explode(26, center(this.run.p.x), center(this.run.p.y));
          d.steps.forEach((st, k) => this.later(FISSION_LEAD + k * FISSION_STEP, () => this.growPop(st, k)));
        });
        break;
      }
      case 'well': {
        // 퐁당: the old relic drops in with a splash, the well runs dry, and the new one bobs up out of
        // it; an evolve it sets off waits until it is up (ui/beat.js)
        const wx = center(d.x), wy = center(d.y), drop = 260;
        this.later(wait(d, WELL_MS), () => {
          const old = this.add.image(wx, wy - 18, d.from).setDepth(D.text);
          this.tweens.add({ targets: old, y: wy, scale: 0.4, duration: drop, ease: 'Quad.in', onComplete: () => {
            old.destroy();
            this.fx.splash.explode(14, wx, wy);
            this.wellImg?.setTexture('t_wellDry');
            const up = this.add.image(wx, wy, d.to).setDepth(D.text).setScale(0.3);
            this.tweens.add({ targets: up, y: wy - 22, scale: 1.6, duration: 380, ease: 'Back.out' });
            this.tweens.add({ targets: up, alpha: 0, delay: WELL_MS - drop, duration: 260, onComplete: () => up.destroy() });
            this.fx.spark.explode(10, wx, wy - 14);
          } });
        });
        break;
      }
      case 'grow':
        // the relic card you picked lands on you: its icon pops up over your head (before any evolve it sets off)
        this.later(wait(d, GROW_MS), () => this.growPop(d, 2));
        break;
      case 'evolve': {
        // goes off when the two relics meet on the evolve card (ui/evo.js)
        const ms = evolveMs(d);
        this.later(wait(d, ms) + EVOLVE_FLASH * ms, () => this.evolveBang(d));
        break;
      }
      case 'sunbeam': {
        // a shaft of light drops onto them from above and they smoulder
        const tx = center(d.x), ty = center(d.y);
        const beam = this.add.rectangle(tx, ty - 60, 6, 120, 0xfff1a8, 0.75).setDepth(D.fx).setScale(0.3, 1);
        this.tweens.add({ targets: beam, scaleX: 1.4, alpha: 0, duration: 380, ease: 'Quad.out', onComplete: () => beam.destroy() });
        this.fx.spark.explode(10, tx, ty);
        this.fx.fire.explode(8, tx, ty);
        break;
      }
      case 'meteor': {
        // a streak from the top of the view, then the crash
        const tx = center(d.x), ty = center(d.y), rock = this.add.circle(tx + 40, ty - 120, 3, 0xf08c3a).setDepth(D.fx);
        this.tweens.add({
          targets: rock, x: tx, y: ty, duration: 220, ease: 'Quad.in',
          onUpdate: () => this.fx.ember.explode(1, rock.x, rock.y),
          onComplete: () => {
            rock.destroy();
            this.fx.fire.explode(30, tx, ty); this.fx.rock.explode(14, tx, ty);
            this.noiseRing(d.x, d.y, 1, 0xf08c3a);
          },
        });
        break;
      }
      case 'block': {
        // a clang off the shield
        const x = center(d.x) + Math.sign(d.from.x - d.x) * 6, y = center(d.y) + Math.sign(d.from.y - d.y) * 6 - 4;
        this.fx.spark.explode(10, x, y);
        const sh = this.add.rectangle(x, y, 6, 8, 0x8fb8ff, 0.9).setDepth(D.fx);
        this.tweens.add({ targets: sh, alpha: 0, scale: 1.8, duration: 260, onComplete: () => sh.destroy() });
        this.float(d.x, d.y, '막음', '#8fb8ff');
        break;
      }
      // ---------- v0.25: the legends' and myths' own moves ----------
      case 'erupt': {
        // 화산 망치: the ground round what you hit glows and fire leaps up out of it
        const g = this.add.graphics().setDepth(D.fx);
        g.fillStyle(0xf08c3a, 0.45);
        for (const t of d.tiles) g.fillRect(t.x * TILE + 1, t.y * TILE + 1, TILE - 2, TILE - 2);
        this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
        for (const t of d.tiles) this.fx.fire.explode(5, center(t.x), foot(t.y) - 4);
        this.noiseRing(d.x, d.y, 1, 0xf08c3a);
        break;
      }
      case 'fade': this.fx.magic.explode(18, center(d.x), center(d.y)); break; // 달그림자: you melt into the dark
      case 'unfade': this.fx.magic.explode(6, center(d.x), center(d.y)); break;
      case 'sprout': this.fx.leaf.explode(16, center(d.x), center(d.y)); this.fx.berry.explode(8, center(d.x), center(d.y)); break;
      case 'petrify': this.fx.crystal.explode(18, center(d.x), center(d.y)); this.fx.spark.explode(10, center(d.x), center(d.y)); break;
      case 'ward': this.float(d.x, d.y, '무적', '#f4cf4f', 60); this.fx.gold.explode(6, center(d.x), center(d.y) - 6); break;
      case 'revive': {
        // a relic's life: a golden blast that throws back whoever stood close
        const x = center(d.x), y = center(d.y);
        this.fx.gold.explode(30, x, y); this.fx.spark.explode(20, x, y);
        const ring = this.add.circle(x, y, TILE).setStrokeStyle(2, 0xf4cf4f, 1).setDepth(D.fx).setScale(0.2);
        this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => ring.destroy() });
        this.face('sparkle', 1200);
        break;
      }
      case 'goldburst': for (const t of d.spots) this.fx.gold.explode(12, center(t.x), center(t.y)); this.float(d.x, d.y - 0.3, '와르르!', '#f4cf4f', 60); break;
      case 'bloodrage': this.noiseRing(d.x, d.y, 0, 0xd9454a); break; // 붉은 달: a red pulse round you as the blow lands
      case 'dawn': {
        // 새벽별: a warm light spreads out from you over the whole field
        const x = center(d.x), y = center(d.y);
        const glow = this.add.circle(x, y, TILE * 8, 0xfff1a8, 0.35).setDepth(D.fx).setScale(0.1).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, scale: 2.5, alpha: 0, duration: 1100, ease: 'Quad.out', onComplete: () => glow.destroy() });
        break;
      }
      // ---------- v0.23 ----------
      case 'brink': this.float(d.x, d.y, '아찔!', '#c8d8ff', 0, 9); this.fx.dust.explode(4, center(d.x), d.y * TILE + 3); break;
      case 'fall': this.face('shock', 900); break;
      case 'plunge': {
        // over the edge: it slides onto the drop and shrinks away into the dark
        const s = this.enemySprites[d.enemy.id];
        this.fx.dust.explode(8, center(d.from.x), foot(d.from.y) - 2);
        if (!s) break;
        s.dying = true;
        s.crown?.destroy();
        this.tweens.killTweensOf(s);
        this.tweens.add({ targets: s, x: center(d.to.x), y: foot(d.to.y), duration: 90, onComplete: () => {
          this.tweens.add({ targets: s, y: s.y + 10, scaleX: s.scaleX * 0.3, scaleY: s.scaleY * 0.3, alpha: 0, angle: 180, duration: 420, ease: 'Quad.in',
            onComplete: () => { s.destroy(); delete this.enemySprites[d.enemy.id]; } });
        } });
        break;
      }
      case 'collapse': this.fx.rock.explode(14, center(d.x), center(d.y)); this.fx.dust.explode(12, center(d.x), center(d.y)); this.rebuildAround([idx(d.x, d.y)]); break;
      case 'slide': {
        // skid marks: a few flecks along the way
        const n = Math.max(Math.abs(d.to.x - d.from.x), Math.abs(d.to.y - d.from.y));
        for (let k = 0; k <= n; k++) {
          const x = d.from.x + Math.sign(d.to.x - d.from.x) * k, y = d.from.y + Math.sign(d.to.y - d.from.y) * k;
          this.later(k * 40, () => this.fx.steam.explode(3, center(x), foot(y) - 2));
        }
        this.face('shock', 500);
        break;
      }
      case 'swoop': {
        const s = this.enemySprites[d.enemy.id];
        this.fx.dust.explode(10, center(d.at.x), foot(d.at.y) - 2);
        if (s) { this.tweens.add({ targets: s, hop: 10, duration: 70, yoyo: true }); }
        if (d.hit) this.float(d.at.x, d.at.y - 0.3, '콕!', '#ffd0a0', 40);
        break;
      }
      case 'sting': this.float(d.x, d.y - 0.3, '찌릿!', '#fff38a', 30); this.fx.spark.explode(12, center(d.x), center(d.y)); this.face('shock', 700); break;
      case 'tuck': if (this.run.isVisible(d.enemy.x, d.enemy.y)) this.float(d.enemy.x, d.enemy.y - 0.3, '쏙', '#f4d0dc', 40); break;
      case 'peek': if (this.run.isVisible(d.enemy.x, d.enemy.y)) this.float(d.enemy.x, d.enemy.y - 0.3, '빼꼼', '#f4d0dc', 40); break;
      case 'shed': this.fx.dust.explode(10, center(d.enemy.x), center(d.enemy.y)); this.float(d.enemy.x, d.enemy.y - 0.3, '훌러덩!', '#ffb0b0', 40); break;
      case 'twist': {
        // the little one looks up: a cold flash, and your face falls
        const s = this.enemySprites[d.enemy.id];
        if (s) { s.setTintFill(0x10080c); s.flashUntil = this.time.now + 260; this.tweens.add({ targets: s, hop: 5, duration: 90, yoyo: true }); }
        this.face('shock', 1400);
        break;
      }
      case 'kindle': this.fx.fire.explode(20, center(d.enemy.x), center(d.enemy.y)); break;
      case 'crumble': this.fx.dust.explode(18, center(d.enemy.x), center(d.enemy.y)); this.fx.ember.explode(8, center(d.enemy.x), center(d.enemy.y)); break;
      case 'sparks': this.fx.ember.explode(20, center(d.x), center(d.y)); this.fx.fire.explode(14, center(d.x), center(d.y)); break;
      case 'ball': {
        // the dung ball rolls down the lane, spinning
        const b = this.add.image(center(d.from.x), foot(d.from.y) - 4, 'dungball').setDepth(D.fx);
        const n = Math.max(1, Math.max(Math.abs(d.to.x - d.from.x), Math.abs(d.to.y - d.from.y)));
        this.tweens.add({ targets: b, x: center(d.to.x), y: foot(d.to.y) - 4, angle: 360 * Math.sign(d.to.x - d.from.x || 1), duration: 70 * n, ease: 'Linear',
          onComplete: () => { this.fx.dust.explode(10, b.x, b.y + 3); b.destroy(); } });
        break;
      }
      case 'ink': {
        // a cloud of ink spreads over everything and slowly thins
        const cam = this.cameras.main, ink = this.add.rectangle(0, 0, cam.width, cam.height, 0x07070d, 0.85).setOrigin(0).setScrollFactor(0).setDepth(D.overlay + 5);
        this.tweens.add({ targets: ink, alpha: 0, delay: 500, duration: 1600, onComplete: () => ink.destroy() });
        this.face('shock', 1000);
        break;
      }
      case 'lavabreath':
        d.tiles.forEach((t, k) => this.later(k * 45, () => this.fx.fire.explode(10, center(t.x), center(t.y))));
        break;
      case 'wade': this.fx.ember.explode(10, center(d.to.x), center(d.to.y)); break;
      case 'reform': this.fx.spark.explode(14, center(d.enemy.x), center(d.enemy.y)); break;
      case 'fakeDeath': this.fx.blood.explode(10, center(d.enemy.x), center(d.enemy.y)); break;
      case 'rise': this.fx.dust.explode(8, center(d.enemy.x), foot(d.enemy.y) - 2); break;
      case 'mound': this.fx.steam.explode(12, center(d.enemy.x), foot(d.enemy.y) - 2); break;
      case 'pop': {
        const s = this.enemySprites[d.enemy.id];
        this.fx.steam.explode(16, center(d.enemy.x), foot(d.enemy.y) - 4);
        if (s) this.tweens.add({ targets: s, hop: 8, duration: 110, yoyo: true });
        break;
      }
      case 'lunge': this.bump(this.enemySprites[d.enemy.id], d.enemy, d.to); this.fx.spark.explode(6, center(d.to.x), center(d.to.y)); break;
      case 'drill': this.noiseRing(d.enemy.x, d.enemy.y, 5, 0xd9454a); break;
      case 'pollen': this.fx.sleep.explode(5, center(d.x), center(d.y) - 6); break;
      case 'bump': { const s = this.enemySprites[d.enemy.id]; if (s) this.bump(s, d.enemy, { x: d.enemy.x + d.dx, y: d.enemy.y + d.dy }); break; }
      case 'levelup':
        this.fx.heal.explode(24, center(this.run.p.x), center(this.run.p.y));
        this.float(this.run.p.x, this.run.p.y, '레벨 업!', '#6fb6ff', 150);
        break;
      default: break;
    }
  }

  onTrap(d) {
    const look = {
      [T.TRAP_SPIKE]: ['푹!', '#d8dde8', 0xd8dde8],
      [T.TRAP_SLEEP]: ['쉬익!', '#d8c2ff', 0xb58cf0],
      [T.TRAP_ALARM]: ['따르릉!', '#ff8a8a', 0xff6b6b],
      [T.TRAP_SUMMON]: ['쿠궁!', '#e6a6ff', 0x9a5fd1],
      [T.TRAP_GRUMP]: ['퍽!', '#ffb07a', 0xf08c3a],
    }[d.kind];
    if (!look) return;
    this.float(d.x, d.y - 0.4, look[0], look[1], 0, 12);
    this.noiseRing(d.x, d.y, 1, look[2]);
    if (d.kind === T.TRAP_SPIKE) { this.fx.rock.explode(10, center(d.x), center(d.y)); }
  }

  onHit(d) {
    const s = this.enemySprites[d.enemy.id];
    if (s) this.flash(s);
    const color = { normal: '#ffffff', sneak: '#f4cf4f', fire: '#f08c3a', bolt: '#f4cf4f', thorns: '#b8b8c8' }[d.kind] || '#ffffff';
    const kind = d.enemy.d.sprite;
    const fx = d.kind === 'fire' ? 'fire' : d.kind === 'bolt' ? 'spark' : kind === 'skel' ? 'spore' : kind === 'slime' ? 'slime' : 'blood';
    if (this.run.isVisible(d.x, d.y)) {
      this.fx[fx].explode(d.kind === 'normal' ? 6 : 10, center(d.x), center(d.y));
      const first = d.kind === 'normal' || d.kind === 'sneak';
      this.float(d.x, d.y, String(d.dmg), color, first ? 0 : 120, d.kind === 'sneak' ? 16 : 10);
    }
  }

  // A blow the target never saw coming: a frozen beat, a slash across it and a thump, no words.
  heavyHit(x, y, from) {
    const cx = center(x), cy = center(y);
    this.hitStop(90);
    // the slash crosses the line of the swing
    const ang = Math.atan2(y - from.y, x - from.x) + Math.PI / 4;
    for (const [w, col, len] of [[5, 0xf4cf4f, 24], [2, 0xffffff, 30]]) {
      const s = this.add.rectangle(cx, cy, len, w, col).setRotation(ang).setDepth(D.fx).setScale(0.2, 1);
      this.tweens.add({
        targets: s, scaleX: 1, duration: 70, ease: 'Quad.out',
        onComplete: () => this.tweens.add({ targets: s, alpha: 0, scaleY: 0.2, duration: 200, onComplete: () => s.destroy() }),
      });
    }
    this.fx.spark.explode(16, cx, cy);
  }

  // the lock breaks: the cage falls apart, the hero hops out with a happy face, waves, and runs off
  // home (the sprite was taken out of the run already, so it is a stand-in here)
  onRescue(d) {
    const old = Object.entries(this.enemySprites).find(([, s]) => s.cage && Math.round(s.cage.x) === center(d.x) && s.cage.y === foot(d.y));
    if (old) { old[1].cage.destroy(); old[1].destroy(); delete this.enemySprites[old[0]]; }
    this.fx.rock.explode(14, center(d.x), center(d.y));
    this.fx.spark.explode(18, center(d.x), center(d.y));
    const s = this.makeActor(d.sprite, d.x, d.y).setDepth(D.enemies);
    s.setTexture(faceKey(d.sprite, 'sparkle'));
    this.emote(s, '♪', 1400);
    if (d.text) this.bubble(s, d.text);
    this.tweens.add({ targets: s, y: s.y - 6, duration: 140, yoyo: true, repeat: 2, ease: 'Quad.out' });
    this.later(1300, () => {
      this.fx.dust.explode(8, s.x, s.y - 4);
      this.tweens.add({ targets: s, alpha: 0, x: s.x + (d.x < this.run.p.x ? -TILE * 2 : TILE * 2), duration: 500, ease: 'Quad.in', onComplete: () => s.destroy() });
    });
    this.face('sparkle', 1400);
  }

  onKill(e) {
    const s = this.enemySprites[e.id];
    const fx = e.d.sprite === 'skel' || e.d.sprite === 'skelking' ? 'spore' : e.d.sprite === 'slime' ? 'slime' : 'blood';
    if (this.run.isVisible(e.x, e.y)) this.fx[fx].explode(e.d.boss ? 40 : 14, center(e.x), center(e.y));
    if (e.d.boss) { this.fx.spark.explode(30, center(e.x), center(e.y)); }
    if (!s) return;
    s.dying = true;
    s.crown?.destroy();
    this.tweens.killTweensOf(s);
    // that was the last one in sight: a small smile
    this.later(260, () => {
      if (!this.playerSprite || this.run.p.hp <= 0 || this.anyThreat()) return;
      this.face('sparkle', 800);
    });
    this.tweens.add({
      targets: s, alpha: 0, y: s.y + 2, duration: 300, ease: 'Linear',
      onComplete: () => { s.destroy(); delete this.enemySprites[e.id]; },
    });
  }

  // Falling down (v0.20): no fanfare. Your eyes squeeze shut and you tip over where you stood, the
  // colour drains out of the field, and it goes quiet. `done` runs once it has sunk in.
  fall(done) {
    const ps = this.playerSprite, cam = this.cameras.main, p = this.run.p;
    this.fallen = true;
    this.bubbles.forEach(b => b.destroy());
    this.bubbles = [];
    if (ps) {
      this.tweens.killTweensOf(ps);
      ps.glide = null;
      const key = dressKey(this, faceKey(this.heroKey, 'hit'), this.run.meta.wear);
      if (this.textures.exists(key)) ps.setTexture(key);
      ps.clearTint().setAlpha(1);
      // a beat standing, then over onto your side (a quarter turn keeps every pixel square)
      this.time.delayedCall(260, () => {
        ps.setOrigin(0.5, 0.5).setPosition(center(p.x), foot(p.y) - 5).setRotation(p.face < 0 ? -Math.PI / 2 : Math.PI / 2);
      });
    }
    const fx = cam.postFX?.addColorMatrix();
    const k = { t: 0 };
    this.tweens.add({
      targets: k, t: 1, delay: 200, duration: 1400, ease: 'Quad.out',
      onUpdate: () => { if (fx) { fx.grayscale(k.t); fx.brightness(1 - 0.3 * k.t, true); } },
    });
    this.time.delayedCall(1500, () => done?.());
  }

  // ---------- effect helpers ----------
  flash(sprite) {
    if (!sprite) return;
    sprite.flashUntil = this.time.now + 80;
    sprite.setTintFill(0xffffff);
  }

  bump(sprite, from, to) {
    if (!sprite || sprite.dying) return;
    const dx = Math.sign(to.x - from.x) * 5, dy = Math.sign(to.y - from.y) * 5;
    const bx = center(from.x), by = foot(from.y);
    this.tweens.killTweensOf(sprite);
    sprite.glide = null;
    sprite.setPosition(bx, by);
    this.tweens.add({ targets: sprite, x: bx + dx, y: by + dy, duration: 55, yoyo: true, ease: 'Quad.out' });
  }

  // Like time.delayedCall, but on the page's clock, so it stays in step with the DOM cards (ui/beat.js)
  // even when frames drop. Skipped if the run has ended by then.
  // At 2x or 3x it comes that much sooner (ui/speed.js), except during a celebration.
  later(ms, fn) {
    const run = this.run;
    setTimeout(() => { if (this.run === run && run && !run.over) fn(); }, ms / pace());
  }

  // One relic growing in a star candy's burst: its icon pops up over your head with its new level.
  growPop(st, k) {
    const p = this.run.p, x = center(p.x), y = p.y * TILE - 3;
    const img = this.add.image(x, y, st.id || 'gold').setDepth(D.text).setScale(0);
    this.tweens.add({ targets: img, scale: 1.6, duration: 110, ease: 'Back.out' });
    this.tweens.add({ targets: img, y: y - 16, alpha: 0, delay: 260, duration: 420, ease: 'Quad.in', onComplete: () => img.destroy() });
    // a new relic needs no number; a full one says so in gold, like its slot in the bag
    if (st.id && st.lvl > 1) this.float(p.x, p.y - 0.9, st.max ? 'MAX' : `Lv${st.lvl}`, st.max ? '#f4cf4f' : '#ffffff', 60, 9);
    this.fx.spark.explode(5 + k, x, y);
  }

  // The bang on the field when two relics become one: the higher the tier, the bigger; a recipe found
  // for the first time rings out three times.
  evolveBang(d) {
    const x = center(this.run.p.x), y = center(this.run.p.y);
    this.face('sparkle', 1200);
    const col = [[111, 224, 224], [244, 207, 79], [240, 140, 58], [196, 140, 255]][d.tier || 0];
    this.fx.spark.explode(30 + 20 * (d.tier || 0), x, y);
    this.fx[d.tier >= 3 ? 'magic' : d.fused ? 'crystal' : 'fire'].explode(20 + 10 * (d.tier || 0), x, y);
    // a soft burst of light around you instead of a full-screen flash
    const glow = this.add.circle(x, y, TILE * (1.2 + 0.4 * d.tier), Phaser.Display.Color.GetColor(...col), 0.3).setDepth(D.fx).setScale(0.3).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, scale: 1.4, alpha: 0, duration: 420 + 120 * (d.tier || 0), ease: 'Quad.out', onComplete: () => glow.destroy() });
    const ring = this.add.circle(x, y, TILE).setStrokeStyle(1, Phaser.Display.Color.GetColor(...col), 1).setDepth(D.fx).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 2 + d.tier * 0.5, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }

  // `size` in world pixels picks the pixel font whose grid matches the art: 10 (small), 12, 15 (big)
  float(x, y, text, color, delay = 0, size = 10) {
    const [family, px] = size >= 14 ? ['Galmuri14', 15] : size >= 11 ? ['Galmuri11', 12] : ['Galmuri9', 10];
    // words that come up on the same spot at once sit one above the other instead of on top of each
    // other (the melting snowman's 주르륵 used to print right over its 20)
    const at = this.time.now + delay, key = `${x},${y}`;
    this.floats = (this.floats || []).filter(f => f.at > this.time.now - 1000);
    const lift = this.floats.filter(f => f.key === key && Math.abs(f.at - at) < 600).reduce((a, f) => Math.max(a, f.lift + f.px + 1), 0);
    this.floats.push({ key, at, lift, px });
    const t = this.add.text(center(x), y * TILE - lift, text, {
      fontFamily: `${family}, sans-serif`, fontSize: `${px}px`, color, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(D.text).setResolution(this.textRes()).setAlpha(delay ? 0 : 1);
    this.tweens.add({ targets: t, alpha: 1, duration: 1, delay });
    this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 800, delay: delay + 150, ease: 'Quad.in', onComplete: () => t.destroy() });
  }

  // A short line in a speech bubble over the speaker, the same size on every screen (sizes are CSS
  // pixels; `k` turns them into world pixels at the camera's zoom). At most two on screen.
  say(who, text) {
    const target = this.spriteFor(who);
    if (!target || target.dying) return;
    if (who !== 'player' && !this.run.isVisible(who.x, who.y)) return;
    // critters only ever say "!" or "?": those are head marks (scenes/emotes.js), not bubbles
    if (text === '!' || text === '?') { this.emote(target, text, text === '?' ? 1300 : 1100); return; }
    this.bubble(target, text);
  }

  bubble(target, text) {
    while (this.bubbles.length >= 2) this.bubbles.shift().destroy();
    const k = (this.game.registry.get('dpr') || 1) / (this.cameras.main.zoom || 3);
    const b = this.add.text(target.x, target.y - 18, text, {
      fontFamily: 'Galmuri11, sans-serif', fontSize: `${12 * k}px`, color: '#1b1424', backgroundColor: '#f4f0e8',
      padding: { x: 7 * k, y: 4 * k }, align: 'center', wordWrap: { width: 190 * k, useAdvancedWrap: true },
    }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(this.textRes());
    b.target = target;
    b.until = this.time.now + 1500;
    this.bubbles.push(b);
  }

  lightning(from, to) {
    const g = this.add.graphics().setDepth(D.fx);
    const x0 = center(from.x), y0 = center(from.y), x1 = center(to.x), y1 = center(to.y);
    const draw = (w, color) => {
      g.lineStyle(w, color, 1);
      g.beginPath(); g.moveTo(x0, y0);
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        g.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 8, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 8);
      }
      g.lineTo(x1, y1); g.strokePath();
    };
    draw(3, 0xf4cf4f); draw(1, 0xffffff);
    this.fx.spark.explode(10, x1, y1);
    this.tweens.add({ targets: g, alpha: 0, duration: 240, onComplete: () => g.destroy() });
  }

  shock(tiles) {
    const g = this.add.graphics().setDepth(D.fx);
    g.fillStyle(0xf4f08f, 0.55);
    for (const t of tiles) g.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    this.tweens.add({ targets: g, alpha: 0, duration: 350, yoyo: false, onComplete: () => g.destroy() });
  }

  projectile(from, to, hit, kind) {
    // a snowball is a fat white lob; the mage's spark a violet star trailing glitter; everything else a
    // quick red dart
    const snow = kind === 'snow', magic = kind === 'magic';
    const b = this.add.image(center(from.x), center(from.y), magic ? 'glow' : 'px').setScale(snow ? 4 : magic ? 0.45 : 3)
      .setTint(snow ? 0xf4f8ff : magic ? 0xc49aff : 0xff6b6b).setDepth(D.fx);
    if (magic) b.setBlendMode(Phaser.BlendModes.ADD);
    const dist = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    this.tweens.add({
      targets: b, x: center(to.x), y: center(to.y), duration: snow ? 200 : magic ? 70 + dist * 30 : 140, ease: 'Linear',
      onUpdate: () => { if (magic && Math.random() < 0.6) this.fx.magic.explode(1, b.x, b.y); },
      onComplete: () => {
        b.destroy();
        if (snow) this.fx.steam.explode(10, center(to.x), center(to.y));
        else if (magic) this.fx.magic.explode(14, center(to.x), center(to.y));
        else if (!hit) this.fx.dust.explode(5, center(to.x), center(to.y));
      },
    });
  }

  // the flight takes `ms` (returned) at 1x
  throwArc(from, to, tex = 'bomb') {
    const b = this.add.image(center(from.x), center(from.y), tex).setScale(0.6).setDepth(D.fx);
    const dist = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)), ms = 110 + dist * 25;
    this.tweens.add({ targets: b, x: center(to.x), duration: ms, ease: 'Linear', onComplete: () => b.destroy() });
    this.tweens.add({ targets: b, y: center(to.y), duration: ms, ease: 'Quad.in' });
    this.tweens.add({ targets: b, angle: 360, duration: ms });
    return ms;
  }

  // the turn that waited for a thrown thing plays now, in order (a throw among it holds the rest again)
  letGo() {
    const list = this.held ? this.held.list : [];
    this.held = null;
    for (const [type, d] of list) this.onEvent(type, d);
  }

  // 민들레 홀씨: up you go on the wind, a trail of tufts behind, and down with a little squash far away
  blowAway(d) {
    const ps = this.playerSprite, dist = Math.max(Math.abs(d.to.x - d.from.x), Math.abs(d.to.y - d.from.y));
    const dur = Math.min(1100, 420 + dist * 22) / pace();
    this.fx.fluff.explode(24, center(d.from.x), center(d.from.y) - 4);
    this.face('sparkle', dur + 400);
    this.tweens.killTweensOf(ps);
    ps.glide = null;
    ps.flight = this.time.now + dur;
    this.tweens.add({ targets: ps, x: center(d.to.x), y: foot(d.to.y), duration: dur, ease: 'Sine.inOut' });
    this.tweens.add({ targets: ps, hop: 16, duration: dur / 2, yoyo: true, ease: 'Sine.out' });
    this.time.addEvent({ delay: 80, repeat: Math.max(0, Math.floor(dur / 80) - 1), callback: () => this.fx.fluff.explode(3, ps.x, ps.y - 10 - (ps.hop || 0)) });
    this.time.delayedCall(dur, () => {
      ps.sqx = 1.3; ps.sqy = 0.75;
      this.tweens.add({ targets: ps, sqx: 1, sqy: 1, duration: 220, ease: 'Back.out' });
      this.fx.fluff.explode(10, ps.x, ps.y - 4);
    });
    this.busyUntil = Math.max(this.busyUntil || 0, performance.now() + dur + 120);
  }

  // A bush (a stump, a clump of reeds, a giant bud) standing in a room sways when bumped, and now and
  // then on its own when a baby is asleep in it (update)
  sway(i, n = 2) {
    const img = (this.tileImgs[i] || []).find(o => o.texture.key.startsWith('t_prop_'));
    if (!img || img.swaying) return;
    img.swaying = true;
    const x0 = img.x;
    this.tweens.add({ targets: img, x: x0 + 1, duration: 70, yoyo: true, repeat: n, ease: 'Sine.inOut', onComplete: () => { img.x = x0; img.swaying = false; } });
  }

  // 숨은 방 (v0.30): the bushes in its way in stir, and a leaf or two drop out on the side you would
  // come at it from (grit and a chip off rock)
  stirNook(nook, at) {
    const im = (this.tileImgs[nook.gap] || []).find(o => o.nook), out = im?.out || { dx: 0, dy: 1 };
    if (im && !im.swaying) {
      im.swaying = true;
      const x0 = im.x;
      this.tweens.add({ targets: im, x: x0 + 1, duration: 70, yoyo: true, repeat: 1, ease: 'Sine.inOut', onComplete: () => { im.x = x0; im.swaying = false; } });
    }
    const x = center(at.x) + out.dx * 6, y = center(at.y) + out.dy * 6 + 2;
    if (nook.kind === 'rock') { this.fx.dust.explode(3, x, y); this.fx.rock.explode(2, x, y); }
    else this.fx.leaf.explode(4, x, y);
  }

  // 덤불 속 아기: out of the bush it tumbles, startled, drops what it was hugging and scampers off
  babyOut(d) {
    this.sway(idx(d.x, d.y), 4);
    this.fx.leaf.explode(16, center(d.x), center(d.y));
    this.face('shock', 800);
    const b = this.add.image(center(d.x), foot(d.y) - 3, d.sprite).setOrigin(0.5, 1).setDepth(D.enemies + 0.2);
    const k = texScale(b) * 0.62, y0 = b.y;
    b.setScale(k * 0.3).setFlipX(d.away < 0);
    this.tweens.add({ targets: b, scale: k, duration: 160, ease: 'Back.out' });
    this.tweens.add({ targets: b, y: y0 - 9, duration: 170, yoyo: true, ease: 'Quad.out' });
    this.float(d.x, d.y - 0.5, '!', '#f4cf4f', 120, 11);
    this.fx.spark.explode(6, center(d.to.x), center(d.to.y));
    this.later(620, () => {
      // hop, hop, hop, and gone
      this.tweens.add({ targets: b, x: b.x + d.away * TILE * 3.5, duration: 720, ease: 'Linear' });
      this.tweens.add({ targets: b, y: y0 - 4, duration: 120, yoyo: true, repeat: 2, ease: 'Quad.out' });
      this.tweens.add({ targets: b, alpha: 0, delay: 420, duration: 300, onComplete: () => b.destroy() });
    });
  }

  // 연못 신령: where the tool sank the water glows, and up rises the old spirit with what you threw in
  // one hand and a golden one in the other (core/run.js; main.js puts the question)
  spiritUp(d) {
    this.spiritDown({ gone: true });
    const x = center(d.x), wl = center(d.y) + 4;
    this.fx.splash.explode(18, x, wl - 2);
    const glow = this.add.image(x, wl - 6, 'glow').setTint(0x8fd8f0).setAlpha(0).setScale(0.5).setDepth(D.fx).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.7, scale: 1.3, duration: 500, ease: 'Sine.out' });
    const s = this.add.image(x, wl + 16, 'spirit').setOrigin(0.5, 1).setDepth(D.enemies + 0.2);
    const crop = () => s.setCrop(0, 0, 16, Phaser.Math.Clamp(wl - (s.y - 16), 0, 16));
    crop();
    const sp = this.spirit = { s, glow, wl, items: [] };
    this.tweens.add({
      targets: s, y: wl - 3, duration: 520, delay: 150, ease: 'Quad.out', onUpdate: crop,
      onComplete: () => {
        if (this.spirit !== sp) return;
        s.setCrop();
        this.tweens.add({ targets: s, y: wl - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        // the plain one on the left, the golden one on the right, held up for you to see
        for (const side of [-1, 1]) {
          const tex = ITEMS[d.tool].sprite, it = this.add.image(x + side * 11, wl - 12, side > 0 ? this.goldKey(tex) : tex).setScale(0).setDepth(D.enemies + 0.3);
          this.tweens.add({ targets: it, scale: 0.7, duration: 220, ease: 'Back.out' });
          this.tweens.add({ targets: it, y: wl - 14, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 220 });
          sp.items.push(it);
        }
        this.fx.spark.explode(8, x + 11, wl - 14);
      },
    });
  }

  // a golden copy of a picture (the spirit's golden tool): each pixel onto a gold ramp by how bright it is
  goldKey(tex) {
    const key = `${tex}_gold`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get(tex).getSourceImage(), c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const im = g.getImageData(0, 0, c.width, c.height), px = im.data;
    const RAMP = [[124, 78, 22], [196, 136, 34], [236, 182, 56], [248, 216, 96], [255, 246, 196]];
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const L = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
      if (L < 0.14) continue;   // the outline stays
      const [r, gr, b] = RAMP[Math.max(0, Math.min(4, Math.round((L - 0.14) / 0.55 * 4)))];
      px[i] = r; px[i + 1] = gr; px[i + 2] = b;
    }
    g.putImageData(im, 0, 0);
    this.textures.addCanvas(key, c);
    return key;
  }

  // ...and back down into the pond: told the truth, it hands you both; told a lie, it shakes its head
  spiritDown(d) {
    const sp = this.spirit;
    if (!sp) return;
    this.spirit = null;
    const { s, glow, wl } = sp, ps = this.playerSprite;
    if (d.gone) { s.destroy(); glow.destroy(); sp.items.forEach(it => it.destroy()); return; }
    this.tweens.killTweensOf(s);
    sp.items.forEach(it => this.tweens.killTweensOf(it));
    if (d.honest) {
      this.face('sparkle', 1600);
      this.fx.spark.explode(16, s.x, s.y - 8);
      sp.items.forEach((it, k) => this.tweens.add({ targets: it, x: ps.x, y: ps.y - 8, scale: 0.3, alpha: 0, duration: 420, delay: 120 * k, ease: 'Quad.in', onComplete: () => it.destroy() }));
    } else {
      this.face('teary', 1600);
      this.tweens.add({ targets: s, x: s.x + 1.5, duration: 70, yoyo: true, repeat: 3 });
      sp.items.forEach(it => this.tweens.add({ targets: it, y: it.y + 10, alpha: 0, duration: 500, delay: 300, onComplete: () => it.destroy() }));
    }
    const crop = () => s.setCrop(0, 0, 16, Phaser.Math.Clamp(wl - (s.y - 16), 0, 16));
    this.tweens.add({
      targets: s, y: wl + 16, duration: 620, delay: 520, ease: 'Quad.in', onUpdate: crop,
      onComplete: () => { this.fx.splash.explode(12, s.x, wl - 2); s.destroy(); },
    });
    this.tweens.add({ targets: glow, alpha: 0, duration: 700, delay: 520, onComplete: () => glow.destroy() });
  }

  explosion(x, y, r = 1) {
    const c = this.add.circle(center(x), center(y), 3, 0xf08c3a, 0.85).setDepth(D.fx);
    this.tweens.add({ targets: c, radius: TILE * (r + 0.7), alpha: 0, duration: 280, ease: 'Quad.out', onComplete: () => c.destroy() });
    this.fx.fire.explode(60, center(x), center(y));
    this.fx.dust.explode(20, center(x), center(y));
  }

  gasBoom(tiles) {
    for (const t of tiles) {
      this.time.delayedCall(t.d * 40, () => {
        if (!this.run) return;
        const r = this.add.rectangle(center(t.x), center(t.y), TILE, TILE, 0xfff1a8, 0.9).setDepth(D.fx);
        this.tweens.add({ targets: r, alpha: 0, scale: 1.6, duration: 260, onComplete: () => r.destroy() });
        this.fx.fire.explode(6, center(t.x), center(t.y));
      });
    }
  }

  // A swing at the big ore: everything gets a little bigger with each hit, and the last one pours out.
  onMine(d) {
    const cx = center(d.x), cy = center(d.y), last = d.last, size = d.size || 1;
    this.face(last ? 'sparkle' : 'grit', last ? 900 : 380);
    this.bump(this.playerSprite, d.from, d);
    this.fx.spark.explode((last ? 30 : 6) + d.hits * 3, cx, cy);
    this.fx.rock.explode((last ? 24 : 4) + d.hits * 3, cx, cy);
    // a big vein comes down in pieces: rubble from every tile it filled
    if (last && size > 1) for (const c of d.cells) { this.fx.rock.explode(14, center(c.x), center(c.y)); this.fx.spark.explode(12, center(c.x), center(c.y)); }
    this.noiseRing(d.x, d.y, d.r);
    const g = ORES[d.tier], tint = Phaser.Display.Color.HexStringToColor(g.vein ? g.vein[0] : '#ffffff').color;
    // pieces of whatever is inside burst out with every swing: blue shards from diamond, red from ruby
    this.shards(cx, cy, d.tier, last ? 6 + 2 * size : 2, last ? 2 : 1);
    // the ore itself shudders, every tile of it
    const cells = d.cells || [{ x: d.x, y: d.y }];
    const imgs = cells.map(c => this.oreImgs[idx(c.x, c.y)]).filter(im => im?.active);
    if (!last) for (const im of imgs) this.tweens.add({ targets: im, x: im.x + 1.5, duration: 30, yoyo: true, repeat: 2 + d.hits });
    // cracked into a better grade: the veins change colour with a glittering pop
    if (d.rose) {
      for (const c of cells) {
        const im = this.oreImgs[idx(c.x, c.y)];
        if (im?.active) im.setTexture(...(d.pebble ? [pebbleKey(d.tier)] : oreFrame(this, { cells, tier: d.tier }, c.x, c.y)));
      }
      this.fx.spark.explode(24, cx, cy);
      const ring = this.add.circle(cx, cy, TILE * 0.9).setStrokeStyle(2, tint, 1).setDepth(D.fx).setScale(0.2);
      this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => ring.destroy() });
      this.shards(cx, cy, d.tier, 6, 1.6);
    }
    // a bonanza: a fountain of pieces, no words needed
    if (d.nugget) {
      for (let k = 0; k < 6; k++) this.coinFly(cx, cy, 2, 120 + k * 40, chipKey(d.tier));
    }
    // chips of the ore spray out and fly into your pocket
    const n = last ? 3 + 2 * size : 1;
    for (let k = 0; k < n; k++) this.coinFly(cx, cy, last ? 2.2 : 1.2, k * (last ? 25 : 35), chipKey(d.tier));
  }

  // Little pieces of the ore flying out and bouncing on the floor, in the grade's colours.
  shards(x, y, tier, n, spread) {
    const g = ORES[tier], cols = (g.vein || ['#ff6478', '#7aa4ff', '#6fe39a', '#f4cf4f']).map(c => Phaser.Display.Color.HexStringToColor(c).color);
    for (let k = 0; k < n; k++) {
      const s = this.add.rectangle(x, y, 2, 2, cols[k % cols.length]).setDepth(D.fx).setAngle(45);
      const a = Math.random() * Math.PI * 2, dist = TILE * spread * (0.3 + Math.random() * 0.7);
      const tx = x + Math.cos(a) * dist, ty = y + Math.sin(a) * dist * 0.5 + 4, h = TILE * (0.4 + Math.random() * 0.8);
      this.tweens.add({
        targets: s, x: tx, duration: 380 + Math.random() * 200, ease: 'Quad.out', angle: 45 + 360 * (Math.random() < 0.5 ? 1 : -1),
        onUpdate: tw => { s.y = y + (ty - y) * tw.progress - Math.sin(tw.progress * Math.PI) * h; },
        onComplete: () => this.tweens.add({ targets: s, alpha: 0, delay: 250, duration: 300, onComplete: () => s.destroy() }),
      });
    }
  }

  // The first time a grade turns up at all: a ring of its colour and a shower of its pieces, no words.
  onNewOre(d) {
    const ore = this.run.map.ores.find(o => o.tier === d.tier) || this.run.map.ores[0];
    if (!ore) return;
    const g = ORES[d.tier], tint = Phaser.Display.Color.HexStringToColor(g.vein ? g.vein[0] : '#ffffff').color;
    const cx = center(ore.x), cy = center(ore.y);
    const ring = this.add.circle(cx, cy, TILE).setStrokeStyle(1, tint, 1).setDepth(D.fx).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => ring.destroy() });
    this.shards(cx, cy, d.tier, 8, 2);
  }

  // A big vein comes into view for the first time: it shines, and you can't miss it.
  onVein(d) {
    const g = ORES[d.tier], tint = Phaser.Display.Color.HexStringToColor(g.vein ? g.vein[0] : '#ffffff').color;
    const xs = d.cells.map(c => center(c.x)), ys = d.cells.map(c => center(c.y));
    const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
    for (const c of d.cells) this.fx.spark.explode(10, center(c.x), center(c.y));
    const ring = this.add.circle(mx, my, TILE * 1.2).setStrokeStyle(2, tint, 1).setDepth(D.fx).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => ring.destroy() });
    // the bigger it is, the longer it keeps glittering
    for (let k = 0; k < Math.min(3, d.size); k++) this.time.delayedCall(250 + k * 300, () => { const c = d.cells[k % d.cells.length]; this.shards(center(c.x), center(c.y) - 4, d.tier, 2, 0.6); });
  }

  // a four-pointed glint that winks open and shut (on a sparkle rock)
  glint(x, y, depth = D.pickups - 0.1) {
    const s = this.add.image(Math.round(x), Math.round(y), 'glint').setDepth(depth).setScale(0.2).setAlpha(0.95);
    this.tweens.add({ targets: s, scale: 1, duration: 160, yoyo: true, hold: 60, ease: 'Quad.out', onComplete: () => s.destroy() });
  }

  coinFly(x, y, spread, delay, key = 'coin') {
    const c = this.add.image(x, y, key).setScale(key === 'coin' ? 1 : 0.9).setDepth(D.fx);
    const a = Math.random() * Math.PI * 2, dist = TILE * spread * (0.5 + Math.random() * 0.5);
    const tx = x + Math.cos(a) * dist, ty = y + Math.sin(a) * dist * 0.6;
    this.tweens.add({
      targets: c, x: tx, duration: 260, delay, ease: 'Quad.out',
      onUpdate: tw => { c.y = y + (ty - y) * tw.progress - Math.sin(tw.progress * Math.PI) * TILE * 0.9; },
      onComplete: () => {
        const p = this.playerSprite;
        if (!p) { c.destroy(); return; }
        this.tweens.add({ targets: c, x: p.x, y: p.y - TILE / 2, scale: 0.2, duration: 220, delay: 120, ease: 'Quad.in', onComplete: () => c.destroy() });
      },
    });
  }

  // the pet keeps a little behind you, bobbing (the flying ones higher up)
  followPet(ps, p, time) {
    const pt = this.petSprite;
    if (!pt) return;
    const back = p.face < 0 ? 1 : -1, fly = !!PETS[this.run.pet]?.fly;
    const tx = ps.x + back * 10, ty = ps.y - (fly ? 7 + 2 * Math.sin(time / 260) : 0) + 1;
    pt.x += (tx - pt.x) * 0.12;
    pt.y += (ty - pt.y) * 0.2;
    pt.setFlipX(p.face < 0);
    pt.setAlpha(ps.alpha);
    pt.setDepth(pt.y > ps.y ? D.player + 0.05 : D.player - 0.05);
  }

  // the pet gives a little hop, with a mark over it
  petHop(mark) {
    const pt = this.petSprite;
    if (!pt) return;
    this.tweens.add({ targets: pt, y: pt.y - 4, duration: 100, yoyo: true, ease: 'Quad.out' });
    if (mark) this.emote(pt, mark, 1100);
  }

  // a heartbeat of stillness so a heavy hit lands
  hitStop(ms) {
    this.stopUntil = performance.now() + ms / pace();
  }

  // How far a sound carries (a swing at the big ore, snoring): a ring that grows out to that distance.
  noiseRing(x, y, r, color = 0xf4cf4f) {
    const c = this.add.circle(center(x), center(y), TILE * (r + 0.5)).setStrokeStyle(1.5, color, 0.9).setDepth(D.fx).setScale(0.1);
    this.tweens.add({ targets: c, scale: 1, duration: 260 + r * 40, ease: 'Quad.out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 200 + r * 40, duration: 300, onComplete: () => c.destroy() });
  }

  // ---------- per-frame drawing ----------
  update(time, delta) {
    const run = this.run, g = this.overlay;
    // the game speed (배속), or the moment's stillness after a heavy hit
    const k = pace();
    this.tweens.timeScale = performance.now() < (this.stopUntil || 0) ? 0.05 : k;
    this.time.timeScale = k;
    // the view eases after you by time, not by frame, so it glides the same on a 60 or a 120 Hz screen
    const cam = this.cameras.main, dt = Math.min(delta || 16, 50);
    if (cam._follow) cam.setLerp(1 - Math.exp(-dt * k / CAM_EASE_MS));
    g.clear(); this.teleGfx.clear(); this.puffGfx.clear(); this.pathGfx.clear(); this.gasGfx.clear(); this.fireGfx.clear(); this.shadowGfx.clear();
    // down a burrow, the old field stays on screen while the rules already hold the new one
    if (!run || !this.playerSprite || this.diving) return;
    const map = run.map, p = run.p;
    this.glideAll(dt * this.tweens.timeScale);
    this.moveAir(time, dt);
    this.cullTiles();

    // fireflies drift about their spot and pulse
    for (const f of this.flyImgs) {
      if (!f.visible) continue;
      const a = time / 700 + f.seed;
      f.setPosition(f.home.x + Math.round(1.5 * Math.sin(a)), f.home.y + Math.round(1.5 * Math.cos(a * 1.3)));
      f.fly.setAlpha(0.55 + 0.25 * Math.sin(time / 160 + f.seed)).setScale(0.8);
    }

    // 덤불 속 아기: the bush it sleeps in stirs now and then; 틈 너머 비밀 터: a mote of light drifts out
    // of the gap now and then
    if (map.baby != null && map.visible[map.baby] && time > (this.babyStir || 0)) {
      this.babyStir = time + 2000 + Math.random() * 2400;
      this.sway(map.baby, 1);
    }
    const gap = map.nook?.hits == null ? map.nook?.gap : -1;
    if (gap >= 0 && map.visible[gap] && time > (this.gapMote || 0)) {
      this.gapMote = time + 1400 + Math.random() * 1800;
      this.fx.firefly.explode(1, center(gap % map.w), ((gap / map.w) | 0) * TILE + 11);
    }
    // 숨은 방 (v0.30): its way in gives itself away now and then (the leaves stir and one or two drop out,
    // or grit and a chip off the rock), and the first time you come within two steps of it you wonder
    const nook = map.nook;
    if (nook?.hits != null && nook.gap >= 0 && map.visible[nook.gap]) {
      const at = { x: nook.gap % map.w, y: (nook.gap / map.w) | 0 };
      if (this.nookSeen !== nook && !this.busy() && cheb(p, at) <= 2) { this.nookSeen = nook; this.emote(this.playerSprite, '?', 1300); this.nookStir = 0; }
      if (time > (this.nookStir || 0)) { this.nookStir = time + 2600 + Math.random() * 2200; this.stirNook(nook, at); }
    }
    // 반짝 광맥: one of the gems (acorns) still in the wall winks now and then
    for (const sm of map.seams || []) {
      if (sm.left <= 0 || !map.visible[sm.i] || time < (this.seamGlint[sm.i] || 0)) continue;
      this.seamGlint[sm.i] = time + 1500 + Math.random() * 2500;
      const n = SEAM_SPOTS.length - 1 - ((Math.random() * sm.left) | 0), [sx, sy] = SEAM_SPOTS[n], c = n === SEAM_SPOTS.length - 1 ? 3 : 2;
      this.glint(sm.x * TILE + sx + c + 0.5, sm.y * TILE + sy + c + 0.5);
    }

    // lamps flicker
    for (const l of this.lamps) {
      if (!l.glow.visible) continue;
      const f = 0.85 + 0.09 * Math.sin(time / 110 + l.seed) + 0.06 * Math.sin(time / 37 + l.seed * 3);
      l.glow.setAlpha(f).setScale(0.95 + 0.05 * f);
    }

    // soft shadows under everyone standing on the floor (they stay put when an actor hops)
    const shadow = (s, w) => {
      if (!s || !s.visible || s.dying || s.sink > 0) return;
      // wading: a ring of ripples round the legs where the water meets them, breathing in and out
      if (s.wet) {
        const r = w * 0.5 + 1.5 + Math.round(Math.sin(time / 420 + s.x) * 0.8);
        this.shadowGfx.fillStyle(0x0c2430, 0.35); pixEllipse(this.shadowGfx, s.x, s.y, r * 2, 4);
        this.shadowGfx.fillStyle(0xd8f2ff, 0.55);
        this.shadowGfx.fillRect(Math.round(s.x - r - 1), Math.round(s.y - 1), 3, 1);
        this.shadowGfx.fillRect(Math.round(s.x + r - 2), Math.round(s.y - 1), 3, 1);
        this.shadowGfx.fillRect(Math.round(s.x - r + 2), Math.round(s.y + 1), Math.round(r * 2 - 4), 1);
        return;
      }
      if (s.flat) { this.shadowGfx.fillStyle(0x000000, 0.25); pixEllipse(this.shadowGfx, s.x, s.y - 2, 9, 3); return; }
      const lift = Math.min(1, (s.lift ?? s.hop ?? 0) / 6);
      this.shadowGfx.fillStyle(0x000000, 0.32 * (1 - 0.5 * lift));
      pixEllipse(this.shadowGfx, s.x, s.y - 1.5, w * (1 - 0.3 * lift), 4);
    };
    shadow(this.playerSprite, 11);
    for (const s of Object.values(this.enemySprites)) shadow(s, s.scaleX / texScale(s) > 1.1 ? 15 : 11);
    for (const s of Object.values(this.pickupSprites)) if (s.visible) { this.shadowGfx.fillStyle(0x000000, 0.25); pixEllipse(this.shadowGfx, s.x + 8, s.getData?.('baseY') ?? s.y + 15, 9, 3); }

    // water ripples
    const wf = Math.floor(time / 650) % 2;
    if (wf !== this.waterFrame) {
      this.waterFrame = wf;
      for (const img of this.waterImgs) img.setTexture(img.sea ? seaKey(this, this.zi, img.shore, img.v, wf) : waterKey(this, this.zi, wf, img.shore, img.warm, img.kind, img.kind !== 'lava'));
    }
    // a screaming root in the weed patch gives itself away with a shiver now and then
    for (const w of this.shyWeeds) {
      const ph = (time + w.home * 37) % 2300;
      w.x = w.home + (w.visible && ph < 260 ? Math.round(Math.sin(ph / 22)) * 0.7 : 0);
    }
    // a hot spring steams
    if (map.spring && time > (this.steamAt || 0)) {
      this.steamAt = time + 140;
      const i = map.spring[Math.floor(Math.random() * map.spring.length)];
      if (map.visible[i]) this.fx.warm.explode(1, (i % map.w) * TILE + 2 + Math.random() * 12, ((i / map.w) | 0) * TILE + 6 + Math.random() * 6);
    }
    // 소원 우물: now and then a glint on its water, so it reads as something to walk up to
    const well = map.well;
    if (well && !well.dry && map.visible[idx(well.x, well.y)]) {
      const t = (time % 2600) / 2600, wx = well.x * TILE + 9, wy = well.y * TILE + 8;
      if (t < 0.12) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(wx, wy, 1, 1);
        if (t > 0.03 && t < 0.09) { g.fillRect(wx - 1, wy, 3, 1); g.fillRect(wx, wy - 1, 1, 3); }
      }
    }

    // gas clouds and fire on tiles you can see
    const burning = [];
    for (let i = 0; i < map.tiles.length; i++) {
      if (!map.visible[i]) continue;
      const x = (i % map.w) * TILE, y = ((i / map.w) | 0) * TILE;
      for (const k of GAS_KEYS) {
        const v = map.gas[k]?.[i] || 0;
        if (v < 0.3) continue;
        const a = Math.min(k === 'mine' ? 0.32 : 0.55, 0.08 + v / (k === 'mine' ? 40 : 28)) * (0.85 + 0.15 * Math.sin(time / 380 + i));
        this.gasGfx.fillStyle(GASES[k].color, a);
        this.gasGfx.fillRect(x, y, TILE, TILE);
      }
      if (map.fire[i]) {
        burning.push(i);
        this.drawFlame(this.fireGfx, x + 8, y + 16, 1, time, i);
      }
    }
    if (burning.length && time - this.lastEmber > 110) {
      this.lastEmber = time;
      const i = burning[(Math.random() * burning.length) | 0];
      this.fx.ember.explode(2, (i % map.w) * TILE + 8, ((i / map.w) | 0) * TILE + 8);
    }

    // boss slam warning, and the lane a knight is about to ram down
    const pulse = 0.35 + 0.25 * Math.sin(time / 110);
    this.teleGfx.fillStyle(0xff4646, pulse);
    for (const t of run.telegraph) this.teleGfx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    // stones about to fall: the tile goes red and a shadow grows on it
    for (const r of run.rocks || []) {
      if (!map.explored[idx(r.x, r.y)]) continue;
      this.teleGfx.fillStyle(0xff4646, pulse);
      this.teleGfx.fillRect(r.x * TILE, r.y * TILE, TILE, TILE);
      this.teleGfx.fillStyle(0x000000, 0.35 + 0.1 * Math.sin(time / 90));
      pixEllipse(this.teleGfx, center(r.x), center(r.y) + 2, 10, 5);
    }
    for (const e of run.enemies) {
      if (!(e.charge || e.lane) || e.hp <= 0 || !run.isVisible(e.x, e.y)) continue;
      (e.charge || e.lane).forEach((t, k) => {
        this.teleGfx.fillStyle(0xff4646, pulse * (1 - k * 0.08));
        this.teleGfx.fillRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4);
      });
    }

    // a fallen poison mushroom swelling up: the tiles it will burst over, and the spore ball growing
    for (const f of run.puffs || []) {
      if (!run.isVisible(f.x, f.y)) continue;
      this.teleGfx.fillStyle(0xff4646, pulse);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        if (run.passable(f.x + i, f.y + j)) this.teleGfx.fillRect((f.x + i) * TILE, (f.y + j) * TILE, TILE, TILE);
      }
      // the spore ball sits above whatever it dropped, wobbling bigger as it is about to go
      const r = Math.round(5.5 + 1.5 * Math.sin(time / 60)), cx = center(f.x), cy = center(f.y) - 1;
      this.puffGfx.fillStyle(0x3a2150, 1); pixDisc(this.puffGfx, cx, cy, r + 1);
      this.puffGfx.fillStyle(0xb57cf0, 1); pixDisc(this.puffGfx, cx, cy, r);
      this.puffGfx.fillStyle(0xe2c8ff, 1); pixDisc(this.puffGfx, cx - r * 0.35, cy - r * 0.35, Math.max(1, Math.round(r * 0.35)));
      this.puffGfx.fillStyle(0x3a2150, 1).fillRect(cx - 3, cy, 1, 2).fillRect(cx + 2, cy, 1, 2);
    }

    // auto-walk path
    this.pathGfx.fillStyle(0x8fd36a, 0.55);
    for (const [x, y] of this.path) this.pathGfx.fillRect(x * TILE + 6, y * TILE + 6, 4, 4);

    // the big ores: cracks and pips show how many swings each has taken
    for (const ore of map.ores) {
      if (!ore.cells.some(c => map.explored[idx(c.x, c.y)])) continue;
      // cracks spread over the whole rock (a full rectangle), or the corner tile of an L
      const xs = ore.cells.map(c => c.x), ys = ore.cells.map(c => c.y);
      const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx + 1, bh = Math.max(...ys) - by + 1;
      const full = bw * bh === ore.cells.length;
      const corner = full ? null : ore.cells.find(c => ore.cells.filter(o => cheb(o, c) === 1 && (o.x === c.x || o.y === c.y)).length === 2);
      const cx0 = (full ? bx : corner.x) * TILE, cy0 = (full ? by : corner.y) * TILE, sx = full ? bw : 1, sy = full ? bh : 1;
      g.fillStyle(0x1b1424, 0.9);
      const cracks = ore.pebble ? [[8, 7, 6, 10], [6, 10, 9, 12]] : [[8, 2, 6, 7], [6, 7, 9, 11], [3, 9, 6, 7], [9, 11, 12, 13], [10, 4, 12, 8]];
      for (let k = 0; k < ore.hits; k++) pixLine(g, cx0 + cracks[k][0] * sx, cy0 + cracks[k][1] * sy, cx0 + cracks[k][2] * sx, cy0 + cracks[k][3] * sy);
      // the pips: how many swings it has taken, over the middle of the rock
      const pips = ore.pebble ? 2 : ORE_HITS, px0 = bx * TILE + (bw * TILE) / 2 - (pips * 3 - 1) / 2;
      for (let k = 0; k < pips; k++) {
        g.fillStyle(k < ore.hits ? 0xf4cf4f : 0x2c2536, 1);
        g.fillRect(Math.round(px0) + k * 3, by * TILE + (ore.pebble ? 3 : -oreTall(ore) - 3), 2, 2);
      }
      // a glint winks on it now and then, so it catches your eye from across the room (a big vein more often)
      const c = ore.cells[Math.floor(Math.random() * ore.cells.length)];
      if (map.visible[idx(c.x, c.y)] && time > (ore.glint || 0)) {
        ore.glint = time + (900 + Math.random() * 1100) / ore.size;
        const up = c.y === by ? oreTall(ore) : 0;
        this.glint(c.x * TILE + 3 + Math.random() * 10, (c.y + 1) * TILE - 4 - Math.random() * (ore.pebble ? 6 : 14 + up));
      }
    }
    // 반짝 흙 (v0.30): a glint winks on a heap of turned earth now and then too
    for (const q of run.pickups) {
      const ps = q.type === 'glint' && map.visible[idx(q.x, q.y)] && this.pickupSprites[`${q.x},${q.y},glint`];
      if (!ps || time < (ps.glintAt || 0)) continue;
      ps.glintAt = time + 900 + Math.random() * 1400;
      this.glint(q.x * TILE + 7 + Math.random() * 3, q.y * TILE + 8 + Math.random() * 3, D.pickups + 0.1);
    }
    // their glow breathes, brighter in your light than in what you only remember
    for (const [ore, gl] of this.oreGlows) {
      if (!map.ores.includes(ore)) { gl.img.destroy(); this.oreGlows.delete(ore); continue; }
      const on = ore.cells.some(c => this.tileImgs[idx(c.x, c.y)]?.shown) && this.inView(ore.x, ore.y);
      gl.img.setVisible(on);
      if (!on) continue;
      if (gl.tier !== ore.tier) { gl.tier = ore.tier; gl.img.setTint(oreTint(ore.tier)); }
      const b = 0.5 + 0.5 * Math.sin(time / 850 + gl.seed), lit = ore.cells.some(c => map.visible[idx(c.x, c.y)]) ? 1 : 0.5;
      gl.img.setAlpha((0.6 + 0.4 * b) * lit).setScale((ore.size > 1 ? 1.7 : 1.25) * (0.92 + 0.08 * b));
    }

    // enemies that heard the ore but are out of sight: red arrows at the edge of the view
    if (this.heardMarks?.length) {
      const view = this.cameras.main.worldView, now = this.time.now;
      this.heardMarks = this.heardMarks.filter(m => m.until > now && m.e.hp > 0);
      for (const { e, until } of this.heardMarks) {
        if (run.isVisible(e.x, e.y)) continue;
        const ex = center(e.x), ey = center(e.y), px = center(p.x), py = center(p.y) - TILE / 2;
        const ang = Math.atan2(ey - py, ex - px), pad = 10;
        const ax = Phaser.Math.Clamp(ex, view.x + pad, view.right - pad), ay = Phaser.Math.Clamp(ey, view.y + pad, view.bottom - pad);
        const a = Math.min(1, (until - now) / 500) * (0.65 + 0.35 * Math.sin(time / 90));
        g.fillStyle(0xff5a5a, a);
        pixArrow(g, ax, ay, ang, 7, 8);
      }
    }

    let claw = false;
    for (const e of this.held?.snap || run.enemies) {
      const s = this.enemySprites[e.id];
      if (!s || e.hp <= 0 || s.dying) continue;
      const face = e.state === 'hunt' || e.state === 'flee' ? (p.x < e.x ? -1 : 1) * (e.state === 'flee' ? -1 : 1) : e.face || -1;
      let flip = face < 0;
      if (e.state === 'search' && e.searchT > 0) flip = Math.floor(time / 450) % 2 === 0; // looking around
      this.pose(s, e, flip, time);
      s.crown?.setVisible(s.visible);
      s.cage?.setVisible(s.visible);
      if (!s.visible) continue;
      if (s.crown) s.crown.setPosition(s.x, s.y - TILE * 1.25 + 2 - s.lift);
      const top = s.y - TILE * (s.scaleY / texScale(s)) * (e.d.boss || e.chief ? 1.25 : e.big ? 1.2 : 1) - s.lift;
      // 황금 (v0.30): a glint winks on a gold one now and then
      if (e.odd === 'gold' && time > (s.glintAt || 0)) {
        s.glintAt = time + 450 + Math.random() * 800;
        this.glint(s.x - 5 + Math.random() * 10, s.y - 2 - Math.random() * 10, D.enemies + 0.2);
      }
      if (e.type === 'peddler' && run.stall.some(x => !x.sold)) { // a coin over the stall while there's stock
        const gy = Math.round(top - 4 + Math.sin(time / 260) * 1.2), sx = Math.round(s.x);
        g.fillStyle(0x1b1424, 1); pixDisc(g, sx, gy, 3.5);
        g.fillStyle(0xf4cf4f, 1); pixDisc(g, sx, gy, 2.5);
        g.fillStyle(0xfff3b0, 1); g.fillRect(sx - 1, gy - 2, 1, 1);
      }
      if (['hide', 'stone', 'npc'].includes(e.state)) continue; // no marks: a chest, a statue, a friend
      this.drawStatus(g, s, e, top, flip ? -1 : 1, time);
      this.drawEmote(g, s, s.x, top - 5, time);
      if (e.loot) { // your gold, in a little sack over its head
        const gy = Math.round(top - 5 + Math.sin(time / 150) * 1), sx = Math.round(s.x);
        g.fillStyle(0x1b1424, 1); pixDisc(g, sx, gy, 3.5);
        g.fillStyle(0xf4cf4f, 1); pixDisc(g, sx, gy, 2.5);
        g.fillStyle(0xfff3b0, 1); g.fillRect(sx - 1, gy - 2, 1, 1);
      }
      if (e.d.quest) { // the necklace glints over the thief
        const gy = top - 6 + Math.sin(time / 200) * 1;
        g.fillStyle(0xf4cf4f, 1); pixDiamond(g, s.x, gy, 3);
        g.fillStyle(0x8fd8f0, 1); g.fillRect(Math.round(s.x), Math.round(gy), 1, 1);
      }
      // its health over its head once it is hurt, green over red like SPD's (v0.29: it was a thin line
      // over anything awake, and the testers never noticed it); 대장 has its big one up top (ui/hud.js)
      if (e.hp < e.maxHp && !e.d.boss) {
        const w = e.chief || e.big ? 16 : 12, bx = Math.round(s.x - w / 2), by = Math.round(top - 3);
        g.fillStyle(0x1b1424, 1); g.fillRect(bx - 1, by - 1, w + 2, 4);
        g.fillStyle(0xc23b4a, 1); g.fillRect(bx, by, w, 2);
        g.fillStyle(0x8fd36a, 1); g.fillRect(bx, by, Math.max(1, Math.round(w * Math.max(0, e.hp) / e.maxHp)), 2);
      }
      if (e.aim && e.aimAt) {
        const a = 0.45 + 0.4 * Math.sin(time / 80);
        g.fillStyle(0xff5a5a, a);
        pixLine(g, center(e.x), center(e.y), center(e.aimAt.x), center(e.aimAt.y));
        g.lineStyle(1, 0xff5a5a, a);
        g.strokeRect(e.aimAt.x * TILE + 0.5, e.aimAt.y * TILE + 0.5, TILE - 1, TILE - 1);
      }
      if (run.willHit(e)) claw = true;
    }
    // red claw marks on your tile: something will hit you next turn
    if (claw) {
      const a = 0.55 + 0.35 * Math.sin(time / 90), x0 = p.x * TILE, y0 = p.y * TILE;
      g.fillStyle(0xff3b3b, a);
      for (let k = 0; k < 3; k++) pixLine(g, x0 + 3 + k * 4, y0 + 2, x0 + 7 + k * 4, y0 + 13);
    }

    this.clawed = claw;

    // footprints you heard: two small paw marks on the tile, pointing the way it went, fading out
    this.prints = this.prints.filter(f => time - f.at < 1800);
    for (const f of this.prints) {
      const a = 0.75 * (1 - (time - f.at) / 1800), cx = center(f.x), cy = center(f.y);
      const sx = f.dy ? 2 : 0, sy = f.dx ? 2 : 0; // side by side across the direction of travel
      g.fillStyle(0xe8e4dc, a);
      g.fillRect(Math.round(cx - sx - 1 - f.dx), Math.round(cy - sy - f.dy), 2, 2);
      g.fillRect(Math.round(cx + sx + f.dx), Math.round(cy + sy + f.dy), 2, 2);
    }

    // you: walk frames while moving; standing still a while, you glance back over your shoulder now and then
    const ps = this.playerSprite;
    if (this.fallen) return; // lying where you fell (fall): nothing more moves
    const walking = time < (ps.stepUntil || 0);
    let expr = time < (ps.exprUntil || 0) ? ps.expr : this.lowHp ? 'teary' : '';
    // a blink every few seconds when the face is at rest
    if (time > (ps.nextBlink || 0)) { ps.blinkUntil = time + 130; ps.nextBlink = time + 2200 + Math.random() * 2600; }
    if (!expr && !walking && time < ps.blinkUntil) expr = 'blink';
    const key = dressKey(this, faceKey(walking ? `${this.heroKey}_walk${ps.stepFrame}` : this.heroKey, expr), this.run.meta.wear);
    if (ps.texture.key !== key && this.textures.exists(key)) ps.setTexture(key);
    if (walking || p.sleep || !ps.nextLook) ps.nextLook = time + 2500 + Math.random() * 2000;
    else if (time > ps.nextLook) { ps.lookAt = time; ps.nextLook = time + 4000 + Math.random() * 4000; }
    const look = time - (ps.lookAt || -1e9);
    this.pose(ps, p, (p.face < 0) !== (look > 0 && look < 520), time);
    ps.setAlpha(p.vanish > 0 ? 0.3 : p.shade > 0 || p.blend ? 0.55 : 1);
    this.followPet(ps, p, time); // hidden in the shadows after a kill (그림자 걸음), or the chameleon's colours
    // holding a legend, you give off a few embers now and then; a myth, a purple shimmer
    if (time > (this.auraAt || 0)) {
      this.auraAt = time + 650;
      const top = Math.max(0, ...Object.keys(p.relics).map(tierOf));
      if (top >= 2) this.fx[top >= 3 ? 'magic' : 'ember'].explode(top >= 3 ? 3 : 2, ps.x + (Math.random() - 0.5) * 12, ps.y - 4 - Math.random() * 10);
      // 불사의 심장's ward: a golden shimmer while nothing can hurt you
      if (p.invuln > 0) this.fx.gold.explode(4, ps.x + (Math.random() - 0.5) * 12, ps.y - 4 - Math.random() * 10);
    }
    this.drawStatus(g, ps, p, ps.y - TILE - ps.hop, p.face < 0 ? -1 : 1, time);
    // nothing after you for a while: you hum to yourself, or do your own little thing (see pose)
    if (walking || !this.safe || this.lowHp || p.sleep || !ps.calmSince) ps.calmSince = time;
    else if (time - ps.calmSince > 4000 && time > (ps.humAt || 0)) {
      ps.humAt = time + 4500 + Math.random() * 2000;
      ps.quirkAt = time;
    }
    this.drawEmote(g, ps, ps.x, ps.y - TILE - ps.hop - 3, time);
    if (this.petSprite) this.drawEmote(g, this.petSprite, this.petSprite.x, this.petSprite.y - 13, time);

    // speech bubbles follow their speaker (kept on screen when the speaker stands near an edge)
    const view = this.cameras.main.worldView;
    this.bubbles = this.bubbles.filter(b => {
      if (time > b.until || !b.target.active) { b.destroy(); return false; }
      const half = b.displayWidth / 2 + 2, x = Phaser.Math.Clamp(b.target.x, view.x + half, view.right - half);
      b.setPosition(Math.round(x), Math.round(b.target.y - TILE - 4 - b.target.hop));
      b.setAlpha(b.until - time < 250 ? (b.until - time) / 250 : 1);
      return true;
    });

    if (this.aim) this.drawAim(g, time);
    else if (this.run.char.wand && this.run.p.charges > 0) this.drawWand(g, time);
  }

  // 마법사: little violet corners round each monster the wand can reach right now
  drawWand(g, time) {
    const run = this.run, a = 0.45 + 0.25 * Math.sin(time / 160);
    g.lineStyle(1, 0xc49aff, a);
    for (const e of run.enemies) {
      if (!run.canZapAt(e.x, e.y)) continue;
      const s = this.enemySprites[e.id];
      const x = s ? Math.round(s.x - TILE / 2) : e.x * TILE, y = s ? Math.round(s.y - TILE) : e.y * TILE;
      for (const [cx, cy, dx, dy] of [[0, 0, 1, 1], [TILE, 0, -1, 1], [0, TILE, 1, -1], [TILE, TILE, -1, -1]]) {
        g.lineBetween(x + cx, y + cy + 0.5 * dy, x + cx + 3 * dx, y + cy + 0.5 * dy);
        g.lineBetween(x + cx + 0.5 * dx, y + cy, x + cx + 0.5 * dx, y + cy + 3 * dy);
      }
    }
  }

  anyThreat() {
    const run = this.run;
    return run.enemies.some(e => e.hp > 0 && !e.d.npc && !run.calm(e) && !['hide', 'stone', 'sleep'].includes(e.state) && run.isVisible(e.x, e.y));
  }

  // A manga mark over someone's head for a moment (scenes/emotes.js): it pops in, rises a little, fades.
  emote(s, kind, ms = 1100) { setEmote(s, kind, this.time.now, ms); }
  drawEmote(g, s, x, y, time) { drawEmote(g, s, x, y, time); }

  // A Chiikawa face on the hero for a moment; while two overlap, the stronger feeling stays.
  face(expr, ms) {
    const ps = this.playerSprite;
    if (!ps) return;
    const rank = { grit: 1, sparkle: 2, shock: 3, hit: 4 }, now = this.time.now;
    if (now < (ps.exprUntil || 0) && rank[ps.expr] > rank[expr]) return;
    ps.expr = expr;
    ps.exprUntil = now + ms;
  }

  // 주운 것 (v0.30): the little thing pops up out of the dirt (`up`), or comes over to you from the one
  // handing it over
  giftArc(d) {
    const img = this.add.image(center(d.from.x), center(d.from.y) - 4, findKey(this, d.id)).setDepth(D.text - 1);
    if (d.up) {
      img.setScale(0.6);
      this.fx.spark.explode(8, img.x, img.y);
      this.tweens.add({ targets: img, y: img.y - 16, scale: 1, duration: 380, ease: 'Back.out' });
      this.tweens.add({ targets: img, alpha: 0, y: img.y - 22, duration: 300, delay: 1000, onComplete: () => img.destroy() });
      return;
    }
    const x0 = img.x, y0 = img.y, tx = center(d.to.x), ty = center(d.to.y) - 6;
    this.tweens.addCounter({
      from: 0, to: 1, duration: 560, ease: 'Sine.inOut',
      onUpdate: tw => { const k = tw.getValue(); img.setPosition(x0 + (tx - x0) * k, y0 + (ty - y0) * k - Math.sin(k * Math.PI) * 14); },
      onComplete: () => {
        this.fx.spark.explode(8, tx, ty);
        this.tweens.add({ targets: img, alpha: 0, y: ty - 8, duration: 300, delay: 250, onComplete: () => img.destroy() });
      },
    });
  }

  // ---------- 들판의 일 (v0.30, data/happen.js, core/wonders.js happen) ----------
  // Something small going on in the field: never in the way, gone in a few seconds.
  happening({ h, at, spots }) {
    if (['glints', 'parade', 'prints'].includes(h.kind) ? !spots?.length : ['sound', 'peek', 'fish', 'bubble'].includes(h.kind) && !at) return;
    switch (h.kind) {
      case 'sound': for (let k = 0; k < (h.n || 1); k++) this.float(at.x, at.y, h.text, h.color, k * 650, 11); break;
      case 'shower': this.drift(h); break;
      case 'flyby': this.flyby(h); break;
      case 'peek': this.peekOut(h, at); break;
      case 'fish': this.fishJump(at); break;
      case 'bubble': this.lavaBubble(at); break;
      case 'glow': this.skyGlow(h, at); break;
      case 'glints':
        spots.forEach((c, k) => this.time.delayedCall(k * 170 + Math.random() * 200, () => this.glint(center(c.x) + Math.round((Math.random() - 0.5) * 8), center(c.y) - 2 + Math.round((Math.random() - 0.5) * 8), D.fx)));
        break;
      case 'parade': this.parade(h, spots); break;
      case 'prints': this.footprints(spots); break;
    }
  }

  // bits drifting across the whole view for a few seconds, a handful at a time: falling, rising (`up`)
  // or blown across (`wind`)
  drift(h) {
    const S = SHOWER[h.fx] || SHOWER.fluff, cam = this.cameras.main, dir = h.up ? -1 : h.wind ? 0 : 1;
    for (let k = 0; k < 34; k++) this.time.delayedCall(k * 80 + Math.random() * 120, () => {
      const v = cam.worldView;
      const x0 = h.wind ? v.x - 4 : v.x + Math.random() * v.width;
      const y0 = dir > 0 ? v.y + Math.random() * v.height * 0.55 : dir < 0 ? v.y + v.height * (0.35 + Math.random() * 0.65) : v.y + Math.random() * v.height;
      const img = this.add.image(Math.round(x0), Math.round(y0), 'px').setDepth(D.fx).setTint(pick(S.tint));
      const px = S.size || (Math.random() < 0.5 ? 2 : 1);
      img.setScale(px, S.streak ? 3 : px);
      const life = 1600 + Math.random() * 1400, dist = S.speed * (30 + Math.random() * 30), ph = Math.random() * 6, wide = v.width;
      this.tweens.addCounter({
        from: 0, to: 1, duration: life,
        onUpdate: tw => {
          const t = tw.getValue();
          const dx = h.wind ? t * wide * 0.9 : Math.sin(t * 6 + ph) * S.sway;
          const dy = h.wind ? Math.sin(t * 8 + ph) * 3 : dir * t * dist;
          let a = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
          if (S.blink) a *= 0.55 + 0.45 * Math.sin(t * 22 + ph);
          img.setPosition(Math.round(x0 + dx), Math.round(y0 + dy)).setAlpha(a);
        },
        onComplete: () => img.destroy(),
      });
    });
  }

  // `n` of something crossing the view high up, one after another (a big one is only its shadow)
  flyby(h) {
    const cam = this.cameras.main, key = h.find ? shapeKey(this, h.spr, 'w') : h.spr;
    const ltr = Math.random() < 0.5, high = 0.24 + Math.random() * 0.22;
    for (let k = 0; k < (h.n || 1); k++) {
      const img = this.add.image(-99, -99, key).setDepth(h.big ? D.ter + 0.6 : D.fx).setAlpha(0);
      img.setScale(texScale(img) * (h.big ? 2.4 : h.small ? 0.6 : h.find ? 1 : 0.9));
      img.setFlipX(ltr ? LEFT_ART.has(key) : !LEFT_ART.has(key));
      if (h.tint) img.setTint(h.tint);
      const dur = (h.big ? 2400 : 3000) + Math.random() * 600, dy = (k ? (k % 2 ? 7 : -5) * Math.ceil(k / 2) : 0) + Math.random() * 4, ph = Math.random() * 6;
      this.tweens.addCounter({
        from: 0, to: 1, duration: dur, delay: k * 230,
        onUpdate: tw => {
          const t = tw.getValue(), v = cam.worldView;
          const x = ltr ? v.x - 20 + t * (v.width + 40) : v.right + 20 - t * (v.width + 40);
          const y = v.y + v.height * high + dy + (h.big ? 0 : Math.sin(t * 14 + ph) * 2);
          img.setPosition(Math.round(x), Math.round(y)).setAlpha(h.big ? 0.28 : 1);
          if (h.find) img.setRotation(Math.sin(t * 9 + ph) * 0.5);
        },
        onComplete: () => img.destroy(),
      });
    }
  }

  // a head pokes up out of the bush (or over the rock), looks, and ducks back
  peekOut(h, at) {
    const spr = h.spr || ENEMIES[pick(this.run.zone.enemies)]?.sprite || 'rat';
    const img = this.add.image(center(at.x), 0, spr).setOrigin(0.5, 0).setDepth(D.enemies + at.y / 1000);
    const sc = texScale(img), fh = img.frame.height, base = at.y * TILE + 7;
    img.setScale(sc).setFlipX((this.run.p.x < at.x) === !LEFT_ART.has(spr));
    this.tweens.addCounter({
      from: 0, to: 1, duration: 2300,
      onUpdate: tw => {
        const t = tw.getValue(), k = t < 0.18 ? t / 0.18 : t < 0.78 ? 1 : t < 0.86 ? (0.86 - t) / 0.08 : 0;
        const shown = Math.max(0, Math.round(fh * 0.55 * k));
        img.setCrop(0, 0, img.frame.width, shown);
        img.y = base - shown * sc;
      },
      onComplete: () => img.destroy(),
    });
    this.time.delayedCall(700, () => { if (img.active) this.fx.leaf.explode(4, center(at.x), base); });
  }

  // a little fish leaps out of the pond and back in
  fishJump(at) {
    const x0 = center(at.x) - 6, y0 = center(at.y) + 2;
    const img = this.add.image(x0, y0, 'minnow').setDepth(D.fx).setScale(0.7);
    this.fx.splash.explode(10, x0, y0);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 720,
      onUpdate: tw => { const t = tw.getValue(); img.setPosition(Math.round(x0 + t * 12), Math.round(y0 - Math.sin(t * Math.PI) * 14)).setRotation((t - 0.5) * 1.6); },
      onComplete: () => { this.fx.splash.explode(10, x0 + 12, y0); img.destroy(); },
    });
  }

  // a bubble swells on the lava and bursts
  lavaBubble(at) {
    const x = center(at.x), y = center(at.y) + 2, g = this.add.graphics().setDepth(D.fx);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 1300, ease: 'Sine.out',
      onUpdate: tw => {
        const r = 1 + tw.getValue() * 4.5;
        g.clear().fillStyle(0x8e2433, 1);
        pixDisc(g, x, y, r + 1);
        g.fillStyle(0xf08c3a, 1);
        pixDisc(g, x, y, r);
        g.fillStyle(0xfff3b0, 1).fillRect(Math.round(x - r / 2), Math.round(y - r / 2), 1, 1);
      },
      onComplete: () => {
        g.destroy();
        this.fx.ember.explode(14, x, y - 2);
        this.fx.fire.explode(8, x, y);
        this.float(at.x, at.y, '퐁', '#ffb062', 0, 10);
      },
    });
  }

  // a wash of colour over the field (mist, a warm glow), a rainbow, or the aurora: it comes and goes
  skyGlow(h, at) {
    const cam = this.cameras.main, v = cam.worldView;
    if (h.color === 'rainbow' || h.color === 'aurora') {
      const g = this.add.graphics().setDepth(D.overlay - 0.05).setAlpha(0);
      const draw = t => {
        const w = cam.worldView;
        g.clear();
        if (h.color === 'rainbow') {
          const side = this.rainbowSide ??= Math.random() < 0.5 ? -1 : 1;
          const cx = w.centerX + side * w.width * 0.22, cy = w.y + w.height * 0.5, r0 = Math.min(w.width * 0.2, 70);
          RAINBOW_BANDS.forEach((c, i) => {
            g.fillStyle(c, 1);
            const r = r0 - i * 2;
            for (let a = Math.PI * 1.08; a <= Math.PI * 1.92; a += 0.6 / r) g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 2, 2);
          });
        } else {
          [0x6cc45a, 0x6fe0e0, 0xb5e08a].forEach((c, i) => {
            g.fillStyle(c, 1);
            for (let x = w.x; x < w.right; x += 2) {
              const y = w.y + w.height * (0.08 + i * 0.05) + Math.sin(x / 23 + t * 3 + i) * 5 + Math.sin(x / 9 + t * 5) * 2;
              g.fillRect(Math.round(x), Math.round(y), 2, 3 + i);
            }
          });
        }
      };
      this.tweens.addCounter({
        from: 0, to: 1, duration: 4200,
        onUpdate: tw => { const t = tw.getValue(); draw(t); g.setAlpha((t < 0.25 ? t / 0.25 : t > 0.7 ? (1 - t) / 0.3 : 1) * (h.color === 'rainbow' ? 0.3 : 0.35)); },
        onComplete: () => { g.destroy(); this.rainbowSide = null; },
      });
      return;
    }
    // (big enough to cover the view while you walk on)
    const mist = h.color === 0xe8f0f0;
    const r = this.add.rectangle(v.centerX, v.centerY, v.width * 3, v.height * 3, h.color).setDepth(D.overlay - 0.05).setAlpha(0);
    if (!mist) r.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, alpha: mist ? 0.2 : 0.16, duration: 1200, yoyo: true, hold: 1600, ease: 'Sine.inOut', onComplete: () => r.destroy() });
    if (at) for (let k = 0; k < 3; k++) this.time.delayedCall(300 + k * 500, () => this.fx.spark.explode(8, center(at.x), center(at.y) - 8));
  }

  // little ones trotting past in a line, sideways
  parade(h, spots) {
    const a = spots[0], b = spots[spots.length - 1];
    for (let k = 0; k < (h.n || 3); k++) {
      const img = this.add.image(center(a.x), center(a.y) + 5, h.spr).setOrigin(0.5, 1).setDepth(D.enemies + a.y / 1000).setAlpha(0);
      img.setScale(texScale(img) * 0.5);
      this.tweens.addCounter({
        from: 0, to: 1, duration: 2600, delay: k * 380,
        onUpdate: tw => {
          const t = tw.getValue();
          img.setPosition(Math.round(center(a.x) + (center(b.x) - center(a.x)) * t), Math.round(center(a.y) + 5 - Math.abs(Math.sin(t * 20 + k)) * 2));
          img.setAlpha(t < 0.1 ? t * 10 : t > 0.9 ? (1 - t) * 10 : 1);
        },
        onComplete: () => img.destroy(),
      });
    }
  }

  // a line of little footprints, as if someone just went by; they fade after a while
  footprints(spots) {
    spots.forEach((c, k) => this.time.delayedCall(k * 160, () => {
      const g = this.add.graphics().setDepth(D.ter + 0.5).fillStyle(0x7d8398, 0.9);
      const side = k % 2 ? 2 : -2, x = center(c.x) + side, y = center(c.y) + 1;
      g.fillRect(x - 1, y, 2, 2).fillRect(x - 1, y - 3, 1, 1).fillRect(x + 1, y - 3, 1, 1);
      this.tweens.add({ targets: g, alpha: 0, duration: 1500, delay: 6000, onComplete: () => g.destroy() });
    }));
  }

  // what a critter looks like (v0.30: an odd one has a picture of its own, data/odd.js)
  enemyLook(e) {
    if (e.state === 'hide') return 'chest';
    if (e.friend) return CHARACTERS[e.friend].sprite;
    if (e.look) return e.look;
    return e.odd && !e.plain ? oddKey(this, e.d.sprite, e.odd) : e.d.sprite;
  }

  // Body language: breathing while asleep, crouching before a hit, hopping when on fire.
  pose(s, who, flip, time) {
    const id = who.id || 0;
    if (who.state === 'hide' || who.state === 'stone') {
      // a mimic gives itself away with a twitch now and then; a statue just stands there, grey
      const twitch = who.state === 'hide' && (time + id * 977) % 5200 < 160 ? 1.5 : 0;
      s.flat = who.state === 'hide';
      s.setFlipX(false).setRotation(0).setScale(texScale(s)).setOrigin(0.5, 1 + twitch / TILE);
      if (time >= s.flashUntil) s.setTint(who.state === 'stone' ? 0xa8a8b8 : 0xffffff);
      return;
    }
    if (who.state === 'lurk' || who.diving) {
      // only ripples on the water: they spread and shrink, no body, no shadow
      const w = 1 + 0.08 * Math.sin(time / 260 + id);
      if (s.isCropped) s.setCrop();
      s.wet = true; s.flat = false;
      s.setFlipX(false).setRotation(0).setScale(texScale(s) * w * (who.diving ? 1.3 : 1), texScale(s) * (who.diving ? 1.3 : 1)).setOrigin(0.5, 1);
      if (time >= s.flashUntil) s.setTint(0xffffff);
      return;
    }
    s.flat = false;
    let sx = 1, sy = 1, hop = s.hop || 0, jitter = 0, rot = 0, flipY = false;
    // each kind has its own way of standing about (faster when it is after you)
    const asleep0 = who.sleep || who.state === 'sleep', windup = who.d && this.run.willHit(who);
    // 버릇 (v0.30): caught at one of its habits, it does that instead
    const habit = s.habit && time < s.habit.until && !s.dying ? s.habit : null;
    if (habit) ({ sx, sy, hop, jitter, rot, flip, flipY } = habitPose(habit.anim, time - habit.at, habit.until - habit.at, { sx, sy, hop, jitter, rot, flip, flipY }));
    if (s.habit && !habit) { s.habit = null; s.setAlpha(1); }
    if (habit?.anim === 'flicker') s.setAlpha(Math.floor((time - habit.at) / 110) % 3 ? 1 : 0.35);
    if (who.d && !asleep0 && !windup && !who.stoneT && !s.dying && !habit) {
      const t = time * (who.state === 'hunt' ? 1.5 : 1) + id * 377;
      switch (who.d.sprite) {
        case 'bee': // buzzing about: a quick bob and a little zigzag
          hop = Math.max(hop, 3 + 1.5 * Math.sin(t / 110)); jitter = Math.sin(t / 260) * 0.8; sx = 1 + 0.05 * Math.sin(t / 40); break;
        case 'bat': case 'vampLord': // always on the wing: bobbing and flapping
          hop = Math.max(hop, 2.5 + 1.5 * Math.sin(t / 170)); sx = 1 + 0.08 * Math.sin(t / 55); break;
        case 'slime': { const w = Math.sin(t / 240); sx = 1 + 0.08 * w; sy = 1 - 0.08 * w; break; } // jelly
        case 'rat': case 'thief': { const ph = t % 2600; if (ph < 380) hop = Math.max(hop, Math.abs(Math.sin(ph / 380 * Math.PI * 2)) * 2); break; } // sniffing hops
        case 'goblin': if (t % 3400 < 420) flip = !flip; break; // glancing over its shoulder
        case 'wraith': hop = Math.max(hop, Math.abs(Math.sin(t / 85)) * 1.5); break; // stamping, cross
        case 'skel': case 'statue': rot = 0.07 * Math.sin(t / 520); break; // swaying on one foot
        case 'wizard': rot = 0.05 * Math.sin(t / 700); break;
        case 'spider': if (who.state === 'hunt') hop = Math.max(hop, Math.abs(Math.sin(t / 70)) * 0.8); break; // skittering
        case 'garg': sx = 1 + 0.05 * Math.sin(t / 150); break; // crawling
        case 'knight': if (t % 3000 < 220) { sx = 1.07; sy = 0.93; } break; // a snort
        case 'turtle': rot = 0.03 * Math.sin(t / 900); break;
        case 'frog': case 'toadking': { const ph = t % 2200; if (ph < 300) hop = Math.max(hop, Math.sin(ph / 300 * Math.PI) * 3); else sy = 1 + 0.05 * Math.sin(t / 120); break; } // a throat that puffs, a hop now and then
        case 'beetle': rot = 0.04 * Math.sin(t / 300); break;
        case 'crab': if (t % 1800 < 300) { sx = 1.06; sy = 0.95; } break; // snapping
        case 'axolotl': rot = 0.05 * Math.sin(t / 600); break; // waving its frills
        case 'shadecat': if (t % 4000 < 200) flip = !flip; break;
        case 'crystalhog': if (who.state === 'hunt') jitter = Math.sin(t / 50) * 0.4; break; // bristling
        case 'boarchief': if (t % 2600 < 260) { sx = 1.08; sy = 0.92; } break;
        case 'root': hop = Math.max(hop, Math.abs(Math.sin(t / 60)) * 2); rot = 0.12 * Math.sin(t / 45); break; // running about in a panic
        // v0.23
        case 'hopper': { const ph = t % 1600; if (ph < 260) hop = Math.max(hop, Math.sin(ph / 260 * Math.PI) * 4); break; } // boing
        case 'woodpecker': if (t % 2000 < 240) rot = -0.25 * Math.abs(Math.sin(t / 30)); break; // tok-tok
        case 'snail': sx = 1 + 0.06 * Math.sin(t / 700); break; // stretching along
        case 'gull': case 'butterfly': case 'moth': hop = Math.max(hop, 3 + 1.5 * Math.sin(t / 200)); sx = 1 + 0.07 * Math.sin(t / 70); break;
        case 'jelly': case 'bigmask': hop = Math.max(hop, 2.5 + 2 * Math.sin(t / 520)); sy = 1 + 0.05 * Math.sin(t / 260); break; // drifting
        case 'queen': hop = Math.max(hop, 3 + 1.2 * Math.sin(t / 150)); sx = 1 + 0.05 * Math.sin(t / 45); break;
        case 'hermit': if (t % 2400 < 300) jitter = Math.sin(t / 40); break; // a scuttle
        case 'dungbeetle': sx = 1 + 0.05 * Math.sin(t / 180); break; // leaning on its ball
        case 'ladybug': rot = 0.04 * Math.sin(t / 400); break;
        case 'mantis': rot = 0.05 * Math.sin(t / 900); break; // swaying, still
        case 'snowhare': if (t % 2600 < 200) sy = 1.06; break; // ears up
        case 'snowman': case 'snowhead': rot = 0.04 * Math.sin(t / 650); break; // a wobble
        case 'seal': sy = 1 + 0.05 * Math.sin(t / 500); break;
        case 'salamander': rot = 0.04 * Math.sin(t / 350); break;
        case 'coal': if (who.lit) jitter = Math.sin(t / 35) * 0.6; break; // crackling
        case 'lostkid': if (!who.twisted && t % 1800 < 500) jitter = Math.sin(t / 50) * 0.5; break; // sobbing
        case 'armorpile': if (t % 1200 < 200) jitter = Math.sin(t / 30) * 0.7; break; // rattling
        case 'octopus': { const w = Math.sin(t / 300); sx = 1 + 0.05 * w; sy = 1 - 0.04 * w; break; }
        case 'yeti': sy = 1 + 0.04 * Math.sin(t / 380); break;
        case 'lavaturtle': rot = 0.03 * Math.sin(t / 1000); break;
      }
    }
    // you, at ease: the worker stretches, the rogue crouches and peeks both ways, the mage floats,
    // the knight puffs up proudly, the vampire flits
    const q = time - (s.quirkAt ?? -1e9);
    if (who === this.run.p && q < 900) {
      const k = Math.sin(q / 900 * Math.PI);
      switch (this.run.charId) {
        case 'adv': sy = 1 + 0.12 * k; sx = 1 - 0.08 * k; break;
        case 'rogue': sy = 0.9; sx = 1.06; if (Math.floor(q / 225) % 2) flip = !flip; break;
        case 'mage': hop = Math.max(hop, 3 * k); break;
        case 'knight': sx = 1 + 0.1 * k; sy = 1 + 0.07 * k; break;
        case 'vamp': hop = Math.max(hop, 4 * k); sx = 1 + 0.1 * Math.sin(q / 50); break;
      }
    }
    // a ladybug playing dead lies on its back; art drawn looking left is mirrored the other way round
    s.setFlipX(LEFT_ART.has(s.texture.key.split('~')[0]) ? !flip : flip).setFlipY(who.state === 'dead' || flipY).setRotation(rot);
    if (who.d?.npc && who.type === 'ghost') hop = Math.max(hop, 2 + 1.5 * Math.sin(time / 380));
    if (asleep0) sy = 1 + 0.05 * Math.sin(time / 450 + id);
    else if (windup) { sx = 1.08; sy = 0.86; }
    // awake and standing: breathing a little, each at their own pace
    else if (!s.dying && sy === 1) sy = 1 + 0.025 * Math.sin(time / (420 + (id % 5) * 40) + id);
    if (who.burn > 0) hop = Math.max(hop, Math.abs(Math.sin(time / 90 + id)) * 3);
    // 부들부들: little bursts of trembling when nearly beaten, wide-eyed, or running for it
    const you = who === this.run.p, asleep = who.sleep || who.state === 'sleep';
    const low = you ? this.lowHp : who.d && !who.d.boss && !who.chief && who.hp <= who.maxHp * 0.25;
    const scared = who.state === 'flee' || (you && s.expr === 'shock' && time < (s.exprUntil || 0));
    if (!asleep && (scared || (low && (time + id * 613) % 1400 < 480))) jitter = (Math.floor(time / 45) % 2 ? 0.6 : -0.6);
    // a toadstool about to burst shivers; a boar about to charge paws the ground
    if (who.d?.bones && who.hp <= who.maxHp * 0.4 && who.state !== 'sleep') jitter = Math.sin(time / 28 + id) * 0.8;
    if (who.charge) jitter = Math.sin(time / 40) * 1.2;
    if (who.stoneT > 0) { sx = 1; sy = 1; hop = 0; }
    // wading: in water the bottom of a body is under the surface
    const ter = this.run.map.ter[idx(who.x, who.y)];
    const wet = !s.dying && !who.d?.boss && !FLIERS.has(who.d?.sprite) && (ter === T.WATER || (ter === T.LAVA && who.d?.fireproof));
    // half out of a burrow: what is still in the hole is hidden below the rim of its mouth
    const fh = s.frame.height, sunk = s.sink > 0 ? Math.min(fh - 1, Math.round(fh * s.sink)) : 0;
    // (v0.29: only the feet and a sliver go under, about a third of what it was, so a body wades
    // instead of swimming up to its chin)
    const cut = sunk || (wet ? Math.round(fh * WADE) : 0);
    // squeezing up out of the hole: narrow while still in it (the way you went down, scenes/burrow.js)
    if (sunk) { sx *= 1 - 0.3 * s.sink; sy *= 1 + 0.15 * s.sink; }
    if (cut) { s.setCrop(0, 0, s.frame.width, fh - cut); hop -= cut * TILE / fh - (sunk ? s.lip : 1); } else if (s.isCropped) s.setCrop();
    s.wet = wet;
    const base = (who.d?.boss || who.chief ? 1.25 : who.big ? 1.2 : 1) * (who.small ? 0.8 : 1) * (who.tiny ? 0.65 : 1);
    const k = texScale(s);
    if (!s.dying) s.setScale(base * sx * k * (s.sqx ?? 1), base * sy * k * (s.sqy ?? 1));
    s.setOrigin(0.5 + jitter / TILE, 1 + hop / TILE);
    s.lift = hop;
    if (time < s.flashUntil) return;
    // every boss has a picture of its own now (and the crown), so only rage colours one
    let tint = who.rage || who.fury ? 0xff8080 : 0xffffff;
    if (who.burn > 0) tint = 0xffc890;
    if (who.sleep || who.state === 'sleep') tint = 0xc4c4dc;
    if (who.stoneT > 0) tint = 0x9a9aac;
    if (who.stun > 0) tint = 0xfff0a0;
    s.setTint(tint);
  }

  drawStatus(g, s, who, top, dir, time) {
    const asleep = who.sleep || who.state === 'sleep';
    if (asleep) {
      // snot bubble: big = deep sleep, small = about to wake
      const depth = who.d ? 1 - Math.min(1, (who.wake || 0) / WAKE_AT) : 1;
      const r = (1.2 + 3.2 * depth) * (0.85 + 0.15 * Math.sin(time / 420 + (who.id || 0)));
      const bx = s.x + dir * 5, by = top + 8;
      g.fillStyle(0xbfe8ff, 0.8); pixDisc(g, bx + dir * r * 0.6, by, Math.max(1, Math.round(r * 2) / 2));
      g.fillStyle(0xffffff, 0.9); g.fillRect(Math.round(bx + dir * r * 0.4), Math.round(by - r * 0.5), 1, 1);
    }
    if (who.state === 'flee') {
      const bob = Math.round(Math.sin(time / 120)), dx = Math.round(s.x - dir * 6), ty = Math.round(top);
      g.fillStyle(0x6fc3ff, 1);
      g.fillRect(dx, ty + 1 + bob, 2, 3); g.fillRect(dx + (dir < 0 ? 1 : 0), ty + bob, 1, 1);
    }
    // stars round the head: stunned, or still dizzy from it (a blow now is a surprise attack)
    if (who.stun > 0 || who.dazed) {
      // little four-point stars going round above the health bar
      for (let k = 0; k < 3; k++) {
        const a = time / 220 + k * 2.1, x = Math.round(s.x + Math.cos(a) * 6), y = Math.round(top - 7 + Math.sin(a) * 1.5);
        g.fillStyle(0xf4cf4f, 1); g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
        g.fillStyle(0xffffff, 1); g.fillRect(x, y, 1, 1);
      }
    }
    if (who.burn > 0) this.drawFlame(g, s.x - dir * 2, s.y - (s.hop || 0) - 2, 0.7, time, who.id || 7);
    // 기세등등: now and then a glint of the star candy it carries (a dot, a little cross, a dot)
    if (who.big && who.d) {
      const t = ((time + (who.id || 0) * 377) % 1400) / 1400;
      if (t < 0.36) {
        const x = Math.round(s.x - dir * 4), y = Math.round(top + 6);
        if (t > 0.08 && t < 0.26) { g.fillStyle(0xf29bb2, 1); g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); }
        g.fillStyle(0xfff3b0, 1); g.fillRect(x, y, 1, 1);
      }
    }
    // 물범 bouncing the pinecone on the tip of its nose
    if (who.juggle > 0) {
      const up = Math.round(Math.abs(Math.sin(time / 170)) * 4), x = Math.round(s.x + dir * 6) - 1, y = Math.round(top + 1 - up - (s.hop || 0));
      g.fillStyle(0x4f331d, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 3, 3); g.fillRect(x + 1, y + 4, 1, 1);
      g.fillStyle(0x9a6a3a, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x, y + 2, 1, 1); g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + 1, y + 3, 1, 1);
    }
    // 도토리 다람쥐 hugging the pinecone it caught, on its way to bury it
    if (who.bury > 0) {
      const x = Math.round(s.x + dir * 4) - 1, y = Math.round(top + 9 - (s.hop || 0));
      g.fillStyle(0x4f331d, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 3, 3); g.fillRect(x + 1, y + 4, 1, 1);
      g.fillStyle(0x9a6a3a, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x, y + 2, 1, 1); g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + 1, y + 3, 1, 1);
    }
    if (who !== this.run.p) return;
    // a bead of sweat when something is about to hit you or has just noticed you
    if (this.clawed || time < (s.sweatUntil || 0)) {
      const bob = Math.round(Math.sin(time / 140)), sx = Math.round(s.x - dir * 7), ty = Math.round(top);
      g.fillStyle(0x8fd8f0, 1); g.fillRect(sx, ty + 3 + bob, 2, 3); g.fillRect(sx + (dir < 0 ? 1 : 0), ty + 2 + bob, 1, 1);
    }
    // nearly out: now and then a tear rolls down from each eye (columns 7 and 12 of the sprite)
    if (s.texture.key.endsWith('~teary')) {
      const t = (time % 1600) / 900;
      if (t < 1) for (const c of [7, 12]) {
        const ex = s.flipX ? s.x + 7.5 - c : s.x - 7.5 + c;
        g.fillStyle(0x8fd8f0, 1 - t * 0.6); g.fillRect(Math.round(ex - 0.5), Math.round(top + 8 + t * 5), 1, 2);
      }
    }
  }

  drawFlame(g, x, y, k, time, seed) {
    const f = n => 0.6 + 0.4 * Math.abs(Math.sin(time / 70 + seed * 1.7 + n));
    g.fillStyle(0xd9454a, 0.85); g.fillRect(x - 6 * k, y - 4 * k * f(0), 12 * k, 4 * k * f(0));
    g.fillStyle(0xf08c3a, 0.95);
    g.fillRect(x - 5 * k, y - 9 * k * f(1), 4 * k, 9 * k * f(1));
    g.fillRect(x + 1 * k, y - 11 * k * f(2), 4 * k, 11 * k * f(2));
    g.fillStyle(0xf4cf4f, 1);
    g.fillRect(x - 3 * k, y - 5 * k * f(3), 2 * k, 5 * k * f(3));
    g.fillRect(x + 2 * k, y - 7 * k * f(4), 2 * k, 7 * k * f(4));
  }

  // Picking where to throw (this.aim: what, data/items.js): every tile it can land on gets a faint
  // yellow square, and the one under the pointer shows how far it reaches (a bomb's 3x3 in red, honey
  // in amber, sleep pollen in violet; a pinecone, a chili or a bell just the one tile)
  drawAim(g, time) {
    const run = this.run, p = run.p, id = this.aim, it = ITEMS[id] || ITEMS.bomb, r = it.area ?? 1;
    g.lineStyle(1, 0xf4cf4f, 0.35);
    for (let y = p.y - BOMB_RANGE; y <= p.y + BOMB_RANGE; y++) for (let x = p.x - BOMB_RANGE; x <= p.x + BOMB_RANGE; x++) {
      if (run.canThrowAt(x, y, id)) g.strokeRect(x * TILE + 1.5, y * TILE + 1.5, TILE - 3, TILE - 3);
    }
    const h = this.hover;
    if (!h || !run.canThrowAt(h.x, h.y, id)) return;
    const a = 0.3 + 0.2 * Math.sin(time / 90);
    g.fillStyle({ honeyjar: 0xf4b03a, sleepy: 0xb58cf0, bell: 0xf4cf4f, pinecone: 0xf4cf4f }[id] ?? 0xff5040, a);
    g.fillRect((h.x - r) * TILE, (h.y - r) * TILE, TILE * (2 * r + 1), TILE * (2 * r + 1));
    g.lineStyle(1.5, 0xffffff, 0.9);
    g.strokeRect(h.x * TILE + 0.5, h.y * TILE + 0.5, TILE - 1, TILE - 1);
    if (r > 0 && cheb(h, p) <= r) {
      g.fillStyle(0xff2020, 0.35 + 0.3 * Math.sin(time / 60));
      g.fillRect(p.x * TILE, p.y * TILE, TILE, TILE);
    }
  }
}
