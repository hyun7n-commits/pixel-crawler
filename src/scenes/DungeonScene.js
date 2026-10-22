// Draws a Run and plays its effects. All game rules live in core/;
// this scene only listens to the run's events and animates them.
// Characters stand on the bottom middle of their tile (origin 0.5, 1).

/* global Phaser */
import { setEmote, drawEmote } from './emotes.js';
import { TILE, buildTextures, wallKey, waterKey, shadeKey, floorKey, oreFrame, dropKey, chipKey, texScale, N, E, S, W_, NE, SE, SW, NW } from './textures.js';
import { CHARACTERS } from '../data/characters.js';
import { ITEMS } from '../data/items.js';
import { T, TERRAIN, GASES, GAS_KEYS } from '../data/terrain.js';
import { idx, inMap, lineOfSight, WALL, STAIRS, DOOR, ORE, UPSTAIRS, GRAVE, LOCKED, HIVE } from '../core/dungeon.js';
import { WAKE_AT } from '../core/ai.js';
import { BOMB_RANGE } from '../core/run.js';
import { ORE_HITS } from '../data/balance.js';
import { ORES } from '../data/ores.js';
import { cheb } from '../core/util.js';
import { faceKey } from '../data/faces.js';
import { tierOf } from '../data/relics.js';
import { baseZoom } from './zoom.js';
import { wait, fissionMs, evolveMs, FISSION_LEAD, FISSION_STEP, EVOLVE_FLASH } from '../ui/beat.js';

const D = { tiles: 0, ter: 1, fire: 2, gas: 3, telegraph: 4, pickups: 5, enemies: 6, player: 7, overlay: 8, fx: 9, bubble: 10, text: 11 };
// what a pickup looks like on the floor (items use their own sprite)
const PICKUP_TEX = { gold: 'gold', chest: 'chest', lockedChest: 'lockedChest', key: 'key', necklace: 'necklace', candy: 'candy', crystal: 'pedestal' };
const center = v => v * TILE + TILE / 2;
const foot = v => v * TILE + TILE;
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
      leaf: burst([0x6cc45a, 0x2f7a43, 0xb5e08a], { gravityY: 60, speed: { min: 12, max: 36 }, lifespan: { min: 300, max: 600 }, scale: { start: 1.5, end: 0.5 } }),
    };
    this.shadowGfx = this.add.graphics().setDepth(D.pickups - 0.5);
    this.gasGfx = this.add.graphics().setDepth(D.gas);
    this.fireGfx = this.add.graphics().setDepth(D.fire);
    this.teleGfx = this.add.graphics().setDepth(D.telegraph);
    this.puffGfx = this.add.graphics().setDepth(D.enemies);
    this.overlay = this.add.graphics().setDepth(D.overlay);
    this.pathGfx = this.add.graphics().setDepth(D.overlay);
    this.bubbles = [];
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
  follow() {
    const cam = this.cameras.main;
    if (this.playerSprite && !cam._follow) cam.startFollow(this.playerSprite, true, 0.25, 0.25, 0, TILE / 2);
  }

  textRes() { return this.zoom || 3; }

  // ---------- wiring ----------
  attach(run) {
    this.run = run;
    this.diving = false;
    run.on((type, data) => this.onEvent(type, data));
    if (run.map) this.buildFloor();
  }

  detach() {
    this.run = null;
    this.diving = false;
    this.aim = false;
    this.clearFloor();
  }

  clearFloor() {
    (this.tileImgs || []).forEach(list => list && list.forEach(i => i.destroy()));
    Object.values(this.enemySprites || {}).forEach(s => { s.crown?.destroy(); s.destroy(); });
    Object.values(this.pickupSprites || {}).forEach(s => { s.extra?.destroy(); s.destroy(); });
    this.bubbles.forEach(b => b.destroy());
    this.playerSprite?.destroy();
    (this.lamps || []).forEach(l => { l.lamp.destroy(); l.glow.destroy(); });
    this.lamps = [];
    this.light = null;
    this.tileImgs = [];
    this.waterImgs = new Set();
    this.enemySprites = {};
    this.pickupSprites = {};
    this.doorImgs = {};
    this.oreImgs = {};
    this.bubbles = [];
    this.playerSprite = null;
  }

  get zi() { return Math.floor((this.run.floor - 1) / 3); }

  buildFloor() {
    this.clearFloor();
    const run = this.run, map = run.map;
    this.cameras.main.setBackgroundColor(run.zone.void);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) this.buildTile(x, y);
    this.buildLamps();
    this.heroKey = CHARACTERS[run.charId].sprite;
    this.playerSprite = this.makeActor(this.heroKey, run.p.x, run.p.y).setDepth(D.player);
    this.cameras.main.startFollow(this.playerSprite, true, 0.25, 0.25, 0, TILE / 2);
    this.cameras.main.centerOn(center(run.p.x), foot(run.p.y) - TILE / 2);
    this.sync(true);
  }

  // Through a burrow: you hop into the hole, the view closes in a circle around you, and the next field
  // opens around you as you pop out of its hole. The rules have already moved you; this is only the show,
  // and your next move waits for it (busy). `d.dir`: 1 on, -1 back, 0 the first field of a run.
  arrive(d) {
    const ps = this.playerSprite;
    if (!d.dir || !ps) { this.buildFloor(); this.popOut(); this.iris(true, 420); return; }
    this.busyUntil = performance.now() + 1100;
    this.diving = true;
    const hx = center(d.from.x), hy = foot(d.from.y), k = texScale(ps);
    this.tweens.killTweensOf(ps);
    ps.dying = true; // the pose loop leaves it alone from here
    this.tweens.add({
      targets: ps, x: hx, y: hy - 5, duration: 140, ease: 'Quad.out',
      onComplete: () => {
        this.fx.dust.explode(12, hx, hy - 3);
        this.tweens.add({ targets: ps, y: hy + 7, scaleX: k * 0.6, scaleY: k * 0.15, duration: 170, ease: 'Quad.in' });
      },
    });
    this.later(120, () => this.iris(false, 340, () => this.later(90, () => {
      this.diving = false;
      this.buildFloor();
      this.popOut();
      this.iris(true, 420);
    })));
  }

  // You pop up out of the hole: squashed flat, then a little hop, then you land.
  popOut() {
    const ps = this.playerSprite;
    if (!ps) return;
    this.busyUntil = Math.max(this.busyUntil || 0, performance.now() + 450);
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

  makeActor(tex, x, y) {
    const s = this.add.image(center(x), foot(y), tex).setOrigin(0.5, 1);
    s.setScale(texScale(s));
    s.hop = 0;
    s.flashUntil = 0;
    return s;
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
    (this.tileImgs[i] || []).forEach(img => { this.waterImgs.delete(img); img.destroy(); });
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
    if (t === WALL) {
      const open = around((nx, ny) => !wall(nx, ny));
      if (!open) { this.tileImgs[i] = null; return; }
      add(wallKey(this, zi, open, hash(x, y) % 3));
    } else {
      if (ter === T.WATER) {
        const shore = around((nx, ny) => wall(nx, ny) || map.ter[idx(nx, ny)] !== T.WATER);
        const img = add(waterKey(this, zi, this.waterFrame, shore));
        img.shore = shore;
        this.waterImgs.add(img);
      } else {
        add(floorKey(zi, hash(x, y) & 31));
        const shade = around(wall) & (N | E | W_ | NE | NW);
        if (shade) add(shadeKey(this, shade));
      }
      const spr = !map.hidden[i] && TERRAIN[ter]?.sprite;
      // grass comes in a few looks so a meadow does not look tiled
      if (spr) add(ter === T.BRUSH || ter === T.GRASS ? `t_${spr}${hash(x, y) % 3}` : `t_${spr}`, D.ter);
      if (t === STAIRS) add('t_stairs', D.ter);
      if (t === UPSTAIRS) add('t_upStairs', D.ter);
      if (t === DOOR) this.doorImgs[i] = add(map.open[i] ? 't_doorOpen' : 't_door', D.ter);
      if (t === LOCKED) add('t_doorLocked', D.ter);
      if (t === GRAVE) add(map.bigGrave === i ? 't_graveBig' : 't_grave', D.ter);
      if (t === HIVE) add(map.hive?.honey ? 't_hive' : 't_hiveEmpty', D.ter);
      if (t === ORE) {
        const ore = map.ores.find(o => o.cells.some(c => idx(c.x, c.y) === i));
        const [key, frame] = ore ? oreFrame(this, ore, x, y) : ['t_ore_copper'];
        this.oreImgs[i] = add(key, D.ter);
        if (frame) this.oreImgs[i].setFrame(frame);
      }
    }
    this.tileImgs[i] = imgs;
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
    const dur = instant ? 0 : 90;

    for (const [i, img] of Object.entries(this.doorImgs)) img.setTexture(map.open[i] ? 't_doorOpen' : 't_door');

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
        s = this.makeActor(e.state === 'hide' ? 'chest' : e.d.sprite, e.x, e.y).setDepth(D.enemies);
        if (e.d.boss) {
          s.setScale(1.25 * texScale(s));
          s.crown = this.add.image(0, 0, 'crown').setOrigin(0.5, 1).setDepth(D.enemies + 0.1);
        }
        this.enemySprites[e.id] = s;
      }
      // things that stand still (a "chest", a statue, quest folk) stay drawn once seen, like items
      const still = e.state === 'hide' || e.state === 'stone' || e.state === 'npc';
      // the owl's eye feels sleepers through the walls: a faint shape above the dark
      const sensed = run.sensed(e);
      s.setVisible(run.isVisible(e.x, e.y) || (still && !!map.explored[idx(e.x, e.y)]) || sensed);
      s.setAlpha(sensed ? 0.5 : 1).setDepth(sensed ? D.overlay + 0.5 : D.enemies);
      this.moveTo(s, e.x, e.y, dur);
      // a mark over its head when its mind changes: ! it saw you, ? it lost you, … it gave up, 💢 it got angry
      const seen = run.isVisible(e.x, e.y);
      if (seen && s.was) {
        if (e.state === 'hunt' && !['hunt', 'flee'].includes(s.was)) this.emote(s, '!');
        else if (e.state === 'search' && s.was === 'hunt') this.emote(s, '?', 1300);
        else if (e.state === 'wander' && (s.was === 'search' || s.was === 'hunt')) this.emote(s, '…', 1300);
      }
      if (seen && ((e.angry && !s.wasAngry) || (e.rage && !s.wasRage))) this.emote(s, 'anger', 1500);
      s.was = e.state; s.wasAngry = e.angry; s.wasRage = e.rage;
      if (seen && !e.d.npc && !run.calm(e) && !['hide', 'stone', 'sleep'].includes(e.state)) threat = true;
    }
    this.safe = !threat;
    for (const id of Object.keys(this.enemySprites)) {
      const s = this.enemySprites[id];
      if (!alive.has(+id) && !s.dying) { s.crown?.destroy(); s.destroy(); delete this.enemySprites[id]; }
    }

    const keep = new Set();
    for (const q of run.pickups) {
      const key = `${q.x},${q.y},${q.type}`;
      keep.add(key);
      let s = this.pickupSprites[key];
      if (!s) {
        const tex = q.type === 'gold' && q.ore != null ? dropKey(q.ore) : PICKUP_TEX[q.type] || ITEMS[q.type].sprite;
        s = this.add.image(q.x * TILE, q.y * TILE, tex).setOrigin(0).setDepth(D.pickups).setData('baseY', q.y * TILE + 14);
        if (q.type === 'crystal') {
          // the relic floats shut inside a crystal above its stand
          s.extra = this.add.container(q.x * TILE, q.y * TILE - 2, [
            this.add.image(4, 1, q.relic).setOrigin(0),
            this.add.image(2, -2, 'crystalShell').setOrigin(0),
          ]).setDepth(D.pickups + 0.1);
          this.tweens.add({ targets: s.extra, y: q.y * TILE - 4, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } else this.tweens.add({ targets: s, y: q.y * TILE - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (q.x * 97) % 600 });
        this.pickupSprites[key] = s;
      }
      s.setVisible(!!map.explored[idx(q.x, q.y)]);
      s.extra?.setVisible(s.visible);
    }
    for (const key of Object.keys(this.pickupSprites)) {
      if (!keep.has(key)) { this.pickupSprites[key].extra?.destroy(); this.pickupSprites[key].destroy(); delete this.pickupSprites[key]; }
    }
  }

  // fog of war with light falling off from the player
  paintFog() {
    const run = this.run, map = run.map, p = run.p;
    const sight = run.stat().sight;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = idx(x, y), imgs = this.tileImgs[i];
      if (!imgs) continue;
      if (!map.explored[i]) { imgs.forEach(im => im.setVisible(false)); continue; }
      let v;
      if (map.visible[i]) {
        const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        v = Math.round(255 - Math.min(1, d / (sight + 1)) * 110);
      } else v = 70;
      // lamplight warms and brightens the tiles around a lamp, even ones you only remember
      const L = this.light ? this.light[i] : 0;
      v = Math.min(255, v + Math.round(L * (map.visible[i] ? 40 : 50)));
      const r = Math.min(255, v + Math.round(L * 22)), b = Math.max(0, Math.min(255, Math.round(v * 1.05 - L * 34)));
      const tint = (r << 16) | (v << 8) | b;
      imgs.forEach(im => im.setVisible(true).setTint(tint));
    }
    for (const l of this.lamps) {
      const seen = !!map.explored[idx(l.x, l.y)];
      l.lamp.setVisible(seen);
      l.glow.setVisible(seen);
    }
  }

  moveTo(sprite, x, y, dur) {
    if (!sprite) return;
    const tx = center(x), ty = foot(y);
    if (sprite.x === tx && sprite.y === ty) return;
    this.tweens.killTweensOf(sprite);
    sprite.hop = 0;
    if (!dur) { sprite.setPosition(tx, ty); return; }
    // your feet take turns: one walk frame per step, back to standing once you arrive
    if (sprite === this.playerSprite) {
      sprite.stepFrame = sprite.stepFrame === 1 ? 2 : 1;
      sprite.stepUntil = this.time.now + dur + 70;
    }
    this.tweens.add({ targets: sprite, x: tx, y: ty, duration: dur, ease: 'Quad.out' });
  }

  spriteFor(who) {
    return who === 'player' ? this.playerSprite : this.enemySprites[who.id];
  }

  // ---------- events ----------
  onEvent(type, d) {
    if (!this.run) return;
    switch (type) {
      case 'floor': this.arrive(d); break;
      case 'turn': this.sync(); this.follow(); break;
      case 'relics': this.sync(); break;
      case 'tiles': this.rebuildAround(d.list, d.soft); break;
      case 'stairs': this.rebuildAround([idx(d.x, d.y)]); this.fx.spark.explode(16, center(d.x), center(d.y)); break;
      case 'attack': this.bump(this.spriteFor(d.who), d.from, d.to); break;
      case 'hit': this.onHit(d); break;
      case 'kill': this.onKill(d.enemy); break;
      case 'phit':
        this.face('hit', 450);
        this.flash(this.playerSprite);
        this.shake(['slam', 'bomb', 'charge'].includes(d.kind) ? 220 : 110, ['slam', 'bomb', 'charge'].includes(d.kind) ? 0.012 : 0.005);
        this.fx.blood.explode(8, center(d.x), center(d.y));
        this.float(d.x, d.y, `-${d.dmg}`, '#ff6b6b');
        break;
      case 'sneak': this.heavyHit(d.x, d.y, d.from); break;
      case 'snore': this.noiseRing(d.x, d.y, d.r, 0xb58cf0); break;
      case 'vein': this.onVein(d); break;
      case 'newOre': this.onNewOre(d); break;
      case 'hangon':
        // the blow should have finished you: everything stops for a moment, and you're still standing
        this.hitStop(420);
        this.cameras.main.flash(260, 255, 255, 255);
        this.shake(300, 0.015);
        this.float(d.x, d.y - 0.4, '버텼다!', '#ffd6d6', 120, 16);
        break;
      case 'dodge': this.float(d.x, d.y, '회피', '#6fe0e0'); break;
      // the evolved relics' own moves
      case 'shade': this.fx.magic.explode(14, center(d.x), center(d.y)); break;
      case 'quick': this.float(d.x, d.y - 0.3, '한 번 더!', '#c9f2a8', 80); this.fx.spark.explode(10, center(d.x), center(d.y)); break;
      case 'push': this.fx.dust.explode(10, center(d.from.x), foot(d.from.y) - 2); this.shake(90, 0.003); break;
      case 'bonk': {
        this.shake(140, 0.006);
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
      case 'gold': this.float(d.x, d.y, `+${d.n}G`, '#f4cf4f', 300); break;
      case 'pickup':
        this.fx[d.type === 'gold' ? 'gold' : 'spark'].explode(d.type === 'chest' ? 20 : 6, center(d.x), center(d.y));
        if (d.type === 'chest') this.face('sparkle', 900);
        break;
      case 'zap': this.lightning(d.from, d.to); break;
      case 'shot': this.projectile(d.from, d.to, d.hit); break;
      case 'throw': this.throwArc(d.from, d.to); break;
      case 'boom': this.explosion(d.x, d.y, d.r); break;
      case 'gasboom': this.gasBoom(d.tiles); break;
      case 'puff': this.fx[d.kind].explode(30, center(d.x), center(d.y)); break;
      case 'rustle': this.fx.leaf.explode(7, center(d.x), center(d.y) + 3); break;
      case 'dig': this.fx.dust.explode(14, center(d.x), center(d.y)); this.fx.rock.explode(6, center(d.x), center(d.y)); this.shake(90, 0.004); break;
      case 'shatter': this.fx.crystal.explode(16, center(d.x), center(d.y)); break;
      case 'unlock': this.fx.spark.explode(14, center(d.x), center(d.y)); break;
      case 'honey':
        this.fx.gold.explode(18, center(d.x), center(d.y));
        this.fx.heal.explode(14, center(this.run.p.x), center(this.run.p.y));
        this.float(this.run.p.x, this.run.p.y, `♥+${d.n}`, '#ff9fb4', 0, 12);
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
      case 'reveal': {
        const s = this.enemySprites[d.enemy.id];
        if (s) {
          s.setTexture(d.enemy.d.sprite);
          this.tweens.add({ targets: s, hop: 7, duration: 110, yoyo: true, ease: 'Quad.out' });
        }
        this.fx.dust.explode(10, center(d.enemy.x), center(d.enemy.y));
        this.shake(160, 0.008);
        break;
      }
      case 'trap': this.onTrap(d); break;
      case 'summon': this.fx.magic.explode(16, center(d.x), center(d.y)); break;
      case 'alarm':
        for (let k = 0; k < 3; k++) this.time.delayedCall(k * 220, () => this.noiseRing(d.x, d.y, 9, 0xff6b6b));
        this.shake(260, 0.006);
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
        for (let k = 0; k < 3; k++) {
          const ring = this.add.circle(center(d.x), center(d.y), TILE).setStrokeStyle(1.5, 0xff6a6a, 0.9).setDepth(D.fx).setScale(0.3);
          this.tweens.add({ targets: ring, scale: 3 + d.list.length * 0.4, alpha: 0, delay: k * 180, duration: 800, ease: 'Quad.out', onComplete: () => ring.destroy() });
        }
        this.heardMarks = d.list.map(e => ({ e, until: this.time.now + 2200 }));
        break;
      case 'say': this.say(d.who, d.text); break;
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
        if (!d.hit) this.shake(120, 0.004);
        break;
      case 'rage': {
        // the last boss loses its temper: a red flash, a shake, and its frown deepens for the rest of the fight
        const s = this.enemySprites[d.enemy.id];
        this.fx.magic.explode(30, center(d.enemy.x), center(d.enemy.y));
        this.shake(300, 0.01);
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
          const c = this.add.image(center(d.from.x), center(d.from.y), 'gold').setScale(0.45).setDepth(D.fx);
          this.tweens.add({
            targets: c, x: s ? s.x : center(d.enemy.x), duration: 300, delay: k * 40, ease: 'Quad.out',
            onUpdate: tw => { c.y = center(d.from.y) + (center(d.enemy.y) - center(d.from.y)) * tw.progress - Math.sin(tw.progress * Math.PI) * TILE; },
            onComplete: () => c.destroy(),
          });
        }
        this.float(d.from.x, d.from.y, `-${d.n}G`, '#f4cf4f', 100);
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
        this.shake(140, 0.006);
        break;
      case 'split': {
        this.fx.slime.explode(14, center(d.from.x), center(d.from.y));
        const c = this.enemySprites[d.child.id];
        if (c) { c.x = center(d.from.x); c.y = foot(d.from.y); this.tweens.add({ targets: c, x: center(d.child.x), y: foot(d.child.y), duration: 160, ease: 'Quad.out' }); }
        break;
      }
      case 'stone': this.fx.dust.explode(8, center(d.enemy.x), center(d.enemy.y)); break;
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
        if (!d.hit) { this.shake(120, 0.005); this.fx.spark.explode(8, center(d.to.x), center(d.to.y) - 8); }
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
            this.shake(160, 0.007);
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
    }[d.kind];
    if (!look) return;
    this.float(d.x, d.y - 0.4, look[0], look[1], 0, 12);
    this.noiseRing(d.x, d.y, 1, look[2]);
    if (d.kind === T.TRAP_SPIKE) { this.fx.rock.explode(10, center(d.x), center(d.y)); this.shake(140, 0.008); }
    if (d.kind === T.TRAP_SUMMON) { this.shake(220, 0.01); this.cameras.main.flash(120, 154, 95, 209); }
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
    this.shake(150, 0.009);
    // the slash crosses the line of the swing
    const ang = Math.atan2(y - from.y, x - from.x) + Math.PI / 4;
    for (const [w, col, len] of [[5, 0xf4cf4f, 24], [2, 0xffffff, 30]]) {
      const s = this.add.rectangle(cx, cy, len, w, col).setRotation(ang).setDepth(D.fx).setScale(0.2, 1);
      this.tweens.add({
        targets: s, scaleX: 1, duration: 70, ease: 'Quad.out',
        onComplete: () => this.tweens.add({ targets: s, alpha: 0, scaleY: 0.2, duration: 200, onComplete: () => s.destroy() }),
      });
    }
    const ring = this.add.circle(cx, cy, TILE * 0.7).setStrokeStyle(2, 0xffffff, 1).setDepth(D.fx).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration: 300, ease: 'Quad.out', onComplete: () => ring.destroy() });
    this.fx.spark.explode(16, cx, cy);
  }

  onKill(e) {
    const s = this.enemySprites[e.id];
    const fx = e.d.sprite === 'skel' ? 'spore' : e.d.sprite === 'slime' ? 'slime' : 'blood';
    if (this.run.isVisible(e.x, e.y)) this.fx[fx].explode(e.d.boss ? 40 : 14, center(e.x), center(e.y));
    if (e.d.boss) { this.shake(300, 0.01); this.fx.spark.explode(30, center(e.x), center(e.y)); }
    if (!s) return;
    s.dying = true;
    s.crown?.destroy();
    this.tweens.killTweensOf(s);
    // that was the last one in sight: a happy little hop
    this.later(260, () => {
      const ps = this.playerSprite;
      if (!ps || this.run.p.hp <= 0 || this.anyThreat()) return;
      this.face('sparkle', 800);
      this.emote(ps, '♪', 1000);
      this.tweens.add({ targets: ps, hop: 4, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.out' });
    });
    this.tweens.add({
      targets: s, alpha: 0, scaleX: 1.4 * texScale(s), scaleY: 0.3 * texScale(s), duration: 220, ease: 'Quad.in',
      onComplete: () => { s.destroy(); delete this.enemySprites[e.id]; },
    });
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
    sprite.setPosition(bx, by);
    this.tweens.add({ targets: sprite, x: bx + dx, y: by + dy, duration: 55, yoyo: true, ease: 'Quad.out' });
  }

  // Like time.delayedCall, but on the page's clock, so it stays in step with the DOM cards (ui/beat.js)
  // even when frames drop. Skipped if the run has ended by then.
  later(ms, fn) {
    const run = this.run;
    setTimeout(() => { if (this.run === run && run && !run.over) fn(); }, ms);
  }

  // One relic growing in a star candy's burst: its icon pops up over your head with its new level.
  growPop(st, k) {
    const p = this.run.p, x = center(p.x), y = p.y * TILE - 3;
    const img = this.add.image(x, y, st.id || 'gold').setDepth(D.text).setScale(0);
    this.tweens.add({ targets: img, scale: 1.6, duration: 110, ease: 'Back.out' });
    this.tweens.add({ targets: img, y: y - 16, alpha: 0, delay: 260, duration: 420, ease: 'Quad.in', onComplete: () => img.destroy() });
    if (st.id) this.float(p.x, p.y - 0.9, `Lv${st.lvl}`, st.lvl >= 3 ? '#f4cf4f' : '#ffffff', 60, 9);
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
    const glow = this.add.circle(x, y, TILE * (2 + d.tier), Phaser.Display.Color.GetColor(...col), 0.45).setDepth(D.fx).setScale(0.3).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, scale: 1.4, alpha: 0, duration: 420 + 120 * (d.tier || 0), ease: 'Quad.out', onComplete: () => glow.destroy() });
    if (d.tier >= 2) this.shake(260, 0.004 * d.tier);
    for (let k = 0; k < (d.first ? 3 : 1); k++) {
      const ring = this.add.circle(x, y, TILE).setStrokeStyle(2, Phaser.Display.Color.GetColor(...col), 1).setDepth(D.fx).setScale(0.2);
      this.tweens.add({ targets: ring, scale: 3 + d.tier, alpha: 0, delay: k * 200, duration: 700, ease: 'Quad.out', onComplete: () => ring.destroy() });
    }
  }

  float(x, y, text, color, delay = 0, size = 10) {
    const t = this.add.text(center(x), y * TILE, text, {
      fontFamily: '"Do Hyeon", sans-serif', fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 2,
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
    while (this.bubbles.length >= 2) this.bubbles.shift().destroy();
    const k = (this.game.registry.get('dpr') || 1) / (this.cameras.main.zoom || 3);
    const b = this.add.text(target.x, target.y - 18, text, {
      fontFamily: '"Do Hyeon", sans-serif', fontSize: `${14 * k}px`, color: '#1b1424', backgroundColor: '#f4f0e8',
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

  projectile(from, to, hit) {
    const b = this.add.image(center(from.x), center(from.y), 'px').setScale(3).setTint(0xff6b6b).setDepth(D.fx);
    this.tweens.add({
      targets: b, x: center(to.x), y: center(to.y), duration: 140, ease: 'Linear',
      onComplete: () => { b.destroy(); if (!hit) this.fx.dust.explode(5, center(to.x), center(to.y)); },
    });
  }

  throwArc(from, to) {
    const b = this.add.image(center(from.x), center(from.y), 'bomb').setScale(0.6).setDepth(D.fx);
    const dist = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    this.tweens.add({ targets: b, x: center(to.x), duration: 110 + dist * 25, ease: 'Linear', onComplete: () => b.destroy() });
    this.tweens.add({ targets: b, y: center(to.y), duration: 110 + dist * 25, ease: 'Quad.in' });
    this.tweens.add({ targets: b, angle: 360, duration: 110 + dist * 25 });
  }

  explosion(x, y, r = 1) {
    const c = this.add.circle(center(x), center(y), 3, 0xf08c3a, 0.85).setDepth(D.fx);
    this.tweens.add({ targets: c, radius: TILE * (r + 0.7), alpha: 0, duration: 280, ease: 'Quad.out', onComplete: () => c.destroy() });
    this.fx.fire.explode(60, center(x), center(y));
    this.fx.dust.explode(20, center(x), center(y));
    this.shake(220, 0.012);
  }

  gasBoom(tiles) {
    this.shake(400, 0.018);
    this.cameras.main.flash(160, 255, 210, 120);
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
    this.hitStop(last ? 140 + size * 30 : 35 + d.hits * 12);
    this.fx.spark.explode((last ? 30 : 6) + d.hits * 3, cx, cy);
    this.fx.rock.explode((last ? 24 : 4) + d.hits * 3, cx, cy);
    // a big vein comes down in pieces: rubble from every tile it filled
    if (last && size > 1) for (const c of d.cells) { this.fx.rock.explode(14, center(c.x), center(c.y)); this.fx.spark.explode(12, center(c.x), center(c.y)); }
    this.shake(last ? 420 + size * 80 : 80 + d.hits * 35, last ? 0.012 + size * 0.002 : 0.002 + d.hits * 0.0014);
    if (last) this.cameras.main.flash(160, 244, 207, 79);
    this.noiseRing(d.x, d.y, d.r);
    const g = ORES[d.tier], tint = Phaser.Display.Color.HexStringToColor(g.vein ? g.vein[0] : '#ffffff').color;
    // pieces of whatever is inside burst out with every swing: blue shards from diamond, red from ruby
    this.shards(cx, cy, d.tier, last ? 18 * size : 4 + d.hits * 2, last ? 2.6 : 1.4);
    // the ore itself shudders, every tile of it
    const cells = d.cells || [{ x: d.x, y: d.y }];
    const imgs = cells.map(c => this.oreImgs[idx(c.x, c.y)]).filter(im => im?.active);
    if (!last) for (const im of imgs) this.tweens.add({ targets: im, x: im.x + 1.5, duration: 30, yoyo: true, repeat: 2 + d.hits });
    // cracked into a better grade: the veins change colour with a glittering pop
    if (d.rose) {
      for (const c of cells) {
        const im = this.oreImgs[idx(c.x, c.y)];
        if (im?.active) im.setTexture(...oreFrame(this, { cells, tier: d.tier }, c.x, c.y));
      }
      this.hitStop(110);
      const c = Phaser.Display.Color.IntegerToRGB(tint);
      this.cameras.main.flash(140, c.r, c.g, c.b);
      this.fx.spark.explode(24, cx, cy);
      const ring = this.add.circle(cx, cy, TILE * 0.9).setStrokeStyle(2, tint, 1).setDepth(D.fx).setScale(0.2);
      this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => ring.destroy() });
      this.shards(cx, cy, d.tier, 16, 2.2);
    }
    // a bonanza: a fountain of pieces, no words needed
    if (d.nugget) {
      this.hitStop(160);
      this.shake(320, 0.012);
      this.cameras.main.flash(180, 244, 207, 79);
      for (let k = 0; k < 16; k++) this.coinFly(cx, cy, 2.4, 120 + k * 22, chipKey(d.tier));
    }
    // chips of the ore spray out and fly into your pocket
    const n = (last ? 14 : 2 + d.hits) * (last ? size : 1);
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
    for (let k = 0; k < 2; k++) {
      const ring = this.add.circle(cx, cy, TILE).setStrokeStyle(2, tint, 1).setDepth(D.fx).setScale(0.2);
      this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, delay: k * 160, duration: 650, ease: 'Quad.out', onComplete: () => ring.destroy() });
    }
    this.shards(cx, cy, d.tier, 24, 2.8);
  }

  // A big vein comes into view for the first time: it shines, and you can't miss it.
  onVein(d) {
    const g = ORES[d.tier], tint = Phaser.Display.Color.HexStringToColor(g.vein ? g.vein[0] : '#ffffff').color;
    const xs = d.cells.map(c => center(c.x)), ys = d.cells.map(c => center(c.y));
    const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
    for (const c of d.cells) this.fx.spark.explode(10, center(c.x), center(c.y));
    const ring = this.add.circle(mx, my, TILE * 1.2).setStrokeStyle(2, tint, 1).setDepth(D.fx).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => ring.destroy() });
    if (d.size >= 4) { const c = Phaser.Display.Color.IntegerToRGB(tint); this.cameras.main.flash(160, c.r, c.g, c.b); this.shake(200, 0.004); }
    // the bigger it is, the longer it keeps glittering
    for (let k = 0; k < d.size; k++) this.time.delayedCall(250 + k * 220, () => { const c = d.cells[k % d.cells.length]; this.shards(center(c.x), center(c.y) - 4, d.tier, 6, 0.8); });
  }

  coinFly(x, y, spread, delay, key = 'gold') {
    const c = this.add.image(x, y, key).setScale(key === 'gold' ? 0.45 : 0.9).setDepth(D.fx);
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

  // Every shake goes through here, kept small: a nudge you feel, not a jolt that hides the board.
  shake(ms, k) { this.cameras.main.shake(ms * 0.7, Math.min(0.0055, k * 0.4)); }

  // a heartbeat of stillness so a heavy hit lands
  hitStop(ms) {
    this.tweens.timeScale = 0.05;
    clearTimeout(this.hitStopTimer);
    this.hitStopTimer = setTimeout(() => { this.tweens.timeScale = 1; }, ms);
  }

  // How far a sound carries (a swing at the big ore, snoring): a ring that grows out to that distance.
  noiseRing(x, y, r, color = 0xf4cf4f) {
    const c = this.add.circle(center(x), center(y), TILE * (r + 0.5)).setStrokeStyle(1.5, color, 0.9).setDepth(D.fx).setScale(0.1);
    this.tweens.add({ targets: c, scale: 1, duration: 260 + r * 40, ease: 'Quad.out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 200 + r * 40, duration: 300, onComplete: () => c.destroy() });
  }

  // ---------- per-frame drawing ----------
  update(time) {
    const run = this.run, g = this.overlay;
    g.clear(); this.teleGfx.clear(); this.puffGfx.clear(); this.pathGfx.clear(); this.gasGfx.clear(); this.fireGfx.clear(); this.shadowGfx.clear();
    // down a burrow, the old field stays on screen while the rules already hold the new one
    if (!run || !this.playerSprite || this.diving) return;
    const map = run.map, p = run.p;

    // lamps flicker
    for (const l of this.lamps) {
      if (!l.glow.visible) continue;
      const f = 0.85 + 0.09 * Math.sin(time / 110 + l.seed) + 0.06 * Math.sin(time / 37 + l.seed * 3);
      l.glow.setAlpha(f).setScale(0.95 + 0.05 * f);
    }

    // soft shadows under everyone standing on the floor (they stay put when an actor hops)
    const shadow = (s, w) => {
      if (!s || !s.visible || s.dying) return;
      if (s.flat) { this.shadowGfx.fillStyle(0x000000, 0.25); this.shadowGfx.fillEllipse(s.x, s.y - 2, 9, 3); return; }
      const lift = Math.min(1, (s.lift ?? s.hop ?? 0) / 6);
      this.shadowGfx.fillStyle(0x000000, 0.32 * (1 - 0.5 * lift));
      this.shadowGfx.fillEllipse(s.x, s.y - 1.5, w * (1 - 0.3 * lift), 4);
    };
    shadow(this.playerSprite, 11);
    for (const s of Object.values(this.enemySprites)) shadow(s, s.scaleX / texScale(s) > 1.1 ? 15 : 11);
    for (const s of Object.values(this.pickupSprites)) if (s.visible) { this.shadowGfx.fillStyle(0x000000, 0.25); this.shadowGfx.fillEllipse(s.x + 8, s.getData?.('baseY') ?? s.y + 15, 9, 3); }

    // water ripples
    const wf = Math.floor(time / 650) % 2;
    if (wf !== this.waterFrame) {
      this.waterFrame = wf;
      for (const img of this.waterImgs) img.setTexture(waterKey(this, this.zi, wf, img.shore));
    }

    // gas clouds and fire on tiles you can see
    const burning = [];
    for (let i = 0; i < map.tiles.length; i++) {
      if (!map.visible[i]) continue;
      const x = (i % map.w) * TILE, y = ((i / map.w) | 0) * TILE;
      for (const k of GAS_KEYS) {
        const v = map.gas[k][i];
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
    for (const e of run.enemies) {
      if (!e.charge || e.hp <= 0 || !run.isVisible(e.x, e.y)) continue;
      e.charge.forEach((t, k) => {
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
      const r = 5.5 + 1.5 * Math.sin(time / 60), cx = center(f.x), cy = center(f.y) - 1;
      this.puffGfx.fillStyle(0x3a2150, 1).fillCircle(cx, cy, r + 1);
      this.puffGfx.fillStyle(0xb57cf0, 1).fillCircle(cx, cy, r);
      this.puffGfx.fillStyle(0xe2c8ff, 1).fillCircle(cx - r * 0.35, cy - r * 0.35, r * 0.35);
      this.puffGfx.fillStyle(0x3a2150, 1).fillRect(cx - 2.5, cy, 1, 1.5).fillRect(cx + 1.5, cy, 1, 1.5);
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
      g.lineStyle(1, 0x1b1424, 0.9);
      const cracks = [[8, 2, 6, 7], [6, 7, 9, 11], [3, 9, 6, 7], [9, 11, 12, 13], [10, 4, 12, 8]];
      for (let k = 0; k < ore.hits; k++) g.lineBetween(cx0 + cracks[k][0] * sx, cy0 + cracks[k][1] * sy, cx0 + cracks[k][2] * sx, cy0 + cracks[k][3] * sy);
      // the pips: how many swings it has taken, over the middle of the rock
      const px0 = bx * TILE + (bw * TILE) / 2 - 6.5;
      for (let k = 0; k < ORE_HITS; k++) {
        g.fillStyle(k < ore.hits ? 0xf4cf4f : 0x2c2536, 1);
        g.fillRect(px0 + k * 2.6, by * TILE - 3, 2, 2);
      }
      // a glint now and then, so it catches your eye from across the room (a big vein glitters more)
      const c = ore.cells[Math.floor(Math.random() * ore.cells.length)];
      if (map.visible[idx(c.x, c.y)] && time > (ore.glint || 0)) {
        ore.glint = time + (900 + Math.random() * 900) / ore.size;
        this.fx.spark.explode(2, c.x * TILE + 3 + Math.random() * 10, c.y * TILE + 3 + Math.random() * 9);
      }
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
        g.fillTriangle(ax + Math.cos(ang) * 6, ay + Math.sin(ang) * 6,
          ax + Math.cos(ang + 2.4) * 5, ay + Math.sin(ang + 2.4) * 5,
          ax + Math.cos(ang - 2.4) * 5, ay + Math.sin(ang - 2.4) * 5);
      }
    }

    let claw = false;
    for (const e of run.enemies) {
      const s = this.enemySprites[e.id];
      if (!s || e.hp <= 0 || s.dying) continue;
      const face = e.state === 'hunt' || e.state === 'flee' ? (p.x < e.x ? -1 : 1) * (e.state === 'flee' ? -1 : 1) : e.face || -1;
      let flip = face < 0;
      if (e.state === 'search' && e.searchT > 0) flip = Math.floor(time / 450) % 2 === 0; // looking around
      this.pose(s, e, flip, time);
      s.crown?.setVisible(s.visible);
      if (!s.visible) continue;
      if (s.crown) s.crown.setPosition(s.x, s.y - TILE * 1.25 + 2 - s.lift);
      const top = s.y - TILE * (s.scaleY / texScale(s)) * (e.d.boss ? 1.25 : 1) - s.lift;
      if (e.type === 'peddler' && run.stall.some(x => !x.sold)) { // a coin over the stall while there's stock
        const gy = top - 4 + Math.sin(time / 260) * 1.2;
        g.fillStyle(0x1b1424, 1); g.fillCircle(s.x, gy, 3.5);
        g.fillStyle(0xf4cf4f, 1); g.fillCircle(s.x, gy, 2.5);
        g.fillStyle(0xfff3b0, 1); g.fillRect(s.x - 1, gy - 1.5, 1, 1);
      }
      if (['hide', 'stone', 'npc'].includes(e.state)) continue; // no marks: a chest, a statue, a friend
      this.drawStatus(g, s, e, top, flip ? -1 : 1, time);
      if (run.calm(e) && !e.sleep && e.state !== 'sleep') {
        if (!s.humAt) s.humAt = time + Math.random() * 4000;
        else if (time > s.humAt) { s.humAt = time + 4500 + Math.random() * 3000; this.emote(s, '♪', 1300); }
      }
      this.drawEmote(g, s, s.x, top - 5, time);
      if (e.loot) { // your gold, in a little sack over its head
        const gy = top - 5 + Math.sin(time / 150) * 1;
        g.fillStyle(0x1b1424, 1); g.fillCircle(s.x, gy, 3.5);
        g.fillStyle(0xf4cf4f, 1); g.fillCircle(s.x, gy, 2.5);
        g.fillStyle(0xfff3b0, 1); g.fillRect(s.x - 1, gy - 1.5, 1, 1);
      }
      if (e.d.quest) { // the necklace glints over the thief
        const gy = top - 6 + Math.sin(time / 200) * 1;
        g.fillStyle(0xf4cf4f, 1); g.fillTriangle(s.x, gy - 3, s.x + 3, gy, s.x - 3, gy); g.fillTriangle(s.x, gy + 3, s.x + 3, gy, s.x - 3, gy);
        g.fillStyle(0x8fd8f0, 1); g.fillRect(s.x - 0.5, gy - 0.5, 1, 1);
      }
      if (e.state !== 'sleep' || e.hp < e.maxHp) {
        g.fillStyle(0x000000, 0.8); g.fillRect(s.x - 6, top - 3, 12, 2);
        g.fillStyle(e.d.boss ? 0xf4cf4f : run.calm(e) ? 0x8fd36a : 0xe0525a, 1); g.fillRect(s.x - 6, top - 3, 12 * Math.max(0, e.hp) / e.maxHp, 2);
      }
      if (e.aim && e.aimAt) {
        const a = 0.45 + 0.4 * Math.sin(time / 80);
        g.lineStyle(1, 0xff5a5a, a);
        g.lineBetween(center(e.x), center(e.y), center(e.aimAt.x), center(e.aimAt.y));
        g.strokeRect(e.aimAt.x * TILE + 0.5, e.aimAt.y * TILE + 0.5, TILE - 1, TILE - 1);
      }
      if (run.willHit(e)) claw = true;
    }
    // red claw marks on your tile: something will hit you next turn
    if (claw) {
      const a = 0.55 + 0.35 * Math.sin(time / 90), x0 = p.x * TILE, y0 = p.y * TILE;
      g.lineStyle(1.5, 0xff3b3b, a);
      for (let k = 0; k < 3; k++) g.lineBetween(x0 + 3 + k * 4, y0 + 2, x0 + 7 + k * 4, y0 + 13);
    }

    this.clawed = claw;

    // you: walk frames while moving; standing still a while, you glance back over your shoulder now and then
    const ps = this.playerSprite;
    const walking = time < (ps.stepUntil || 0);
    let expr = time < (ps.exprUntil || 0) ? ps.expr : this.lowHp ? 'teary' : '';
    // a blink every few seconds when the face is at rest
    if (time > (ps.nextBlink || 0)) { ps.blinkUntil = time + 130; ps.nextBlink = time + 2200 + Math.random() * 2600; }
    if (!expr && !walking && time < ps.blinkUntil) expr = 'blink';
    const key = faceKey(walking ? `${this.heroKey}_walk${ps.stepFrame}` : this.heroKey, expr);
    if (ps.texture.key !== key && this.textures.exists(key)) ps.setTexture(key);
    if (walking || p.sleep || !ps.nextLook) ps.nextLook = time + 2500 + Math.random() * 2000;
    else if (time > ps.nextLook) { ps.lookAt = time; ps.nextLook = time + 4000 + Math.random() * 4000; }
    const look = time - (ps.lookAt || -1e9);
    this.pose(ps, p, (p.face < 0) !== (look > 0 && look < 520), time);
    ps.setAlpha(p.shade > 0 ? 0.55 : 1); // hidden in the shadows after a kill (그림자 걸음)
    // holding a legend, you give off a few embers now and then; a myth, a purple shimmer
    if (time > (this.auraAt || 0)) {
      this.auraAt = time + 650;
      const top = Math.max(0, ...Object.keys(p.relics).map(tierOf));
      if (top >= 2) this.fx[top >= 3 ? 'magic' : 'ember'].explode(top >= 3 ? 3 : 2, ps.x + (Math.random() - 0.5) * 12, ps.y - 4 - Math.random() * 10);
    }
    this.drawStatus(g, ps, p, ps.y - TILE - ps.hop, p.face < 0 ? -1 : 1, time);
    // nothing after you for a while: you hum to yourself, or do your own little thing (see pose)
    if (walking || !this.safe || this.lowHp || p.sleep || !ps.calmSince) ps.calmSince = time;
    else if (time - ps.calmSince > 4000 && time > (ps.humAt || 0)) {
      ps.humAt = time + 4500 + Math.random() * 2000;
      ps.quirkN = (ps.quirkN || 0) + 1;
      if (ps.quirkN % 2) this.emote(ps, '♪', 1300);
      else {
        ps.quirkAt = time;
        const id = this.run.charId, side = p.face < 0 ? -5 : 5;
        if (id === 'mage' || id === 'vamp') this.later(150, () => this.fx.magic.explode(4, ps.x, ps.y - 12));
        if (id === 'knight') this.later(250, () => this.fx.spark.explode(4, ps.x + side, ps.y - 6));
      }
    }
    this.drawEmote(g, ps, ps.x, ps.y - TILE - ps.hop - 3, time);

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
    s.flat = false;
    let sx = 1, sy = 1, hop = s.hop || 0, jitter = 0, rot = 0;
    // each kind has its own way of standing about (faster when it is after you)
    const asleep0 = who.sleep || who.state === 'sleep', windup = who.d && this.run.willHit(who);
    if (who.d && !asleep0 && !windup && !who.stoneT && !s.dying) {
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
    s.setFlipX(flip).setRotation(rot);
    if (who.d?.npc && who.type === 'ghost') hop = Math.max(hop, 2 + 1.5 * Math.sin(time / 380));
    if (asleep0) sy = 1 + 0.05 * Math.sin(time / 450 + id);
    else if (windup) { sx = 1.08; sy = 0.86; }
    // awake and standing: breathing a little, each at their own pace
    else if (!s.dying && sy === 1) sy = 1 + 0.025 * Math.sin(time / (420 + (id % 5) * 40) + id);
    if (who.burn > 0) hop = Math.max(hop, Math.abs(Math.sin(time / 90 + id)) * 3);
    // 부들부들: little bursts of trembling when nearly beaten, wide-eyed, or running for it
    const you = who === this.run.p, asleep = who.sleep || who.state === 'sleep';
    const low = you ? this.lowHp : who.d && !who.d.boss && who.hp <= who.maxHp * 0.25;
    const scared = who.state === 'flee' || (you && s.expr === 'shock' && time < (s.exprUntil || 0));
    if (!asleep && (scared || (low && (time + id * 613) % 1400 < 480))) jitter = (Math.floor(time / 45) % 2 ? 0.6 : -0.6);
    // a toadstool about to burst shivers; a boar about to charge paws the ground
    if (who.d?.bones && who.hp <= who.maxHp * 0.4 && who.state !== 'sleep') jitter = Math.sin(time / 28 + id) * 0.8;
    if (who.charge) jitter = Math.sin(time / 40) * 1.2;
    if (who.stoneT > 0) { sx = 1; sy = 1; hop = 0; }
    const base = (who.d?.boss ? 1.25 : 1) * (who.small ? 0.8 : 1);
    const k = texScale(s);
    if (!s.dying) s.setScale(base * sx * k * (s.sqx ?? 1), base * sy * k * (s.sqy ?? 1));
    s.setOrigin(0.5 + jitter / TILE, 1 + hop / TILE);
    s.lift = hop;
    if (time < s.flashUntil) return;
    let tint = who.rage ? 0xff8080 : who.d?.boss ? 0xffb0b0 : 0xffffff;
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
      g.fillStyle(0xbfe8ff, 0.8); g.fillCircle(bx + dir * r * 0.6, by, r);
      g.fillStyle(0xffffff, 0.9); g.fillRect(bx + dir * r * 0.4 - 0.5, by - r * 0.5, 1, 1);
    }
    if (who.state === 'flee') {
      const bob = Math.sin(time / 120) * 1;
      g.fillStyle(0x6fc3ff, 1);
      g.fillRect(s.x - dir * 6, top + 1 + bob, 2, 3); g.fillRect(s.x - dir * 6 + 0.5, top + bob, 1, 1);
    }
    if (who.stun > 0) {
      g.fillStyle(0xf4cf4f, 1);
      for (let k = 0; k < 3; k++) {
        const a = time / 180 + k * 2.1;
        g.fillRect(s.x + Math.cos(a) * 6 - 0.5, top - 1 + Math.sin(a) * 1.5, 2, 2);
      }
    }
    if (who.burn > 0) this.drawFlame(g, s.x - dir * 2, s.y - (s.hop || 0) - 2, 0.7, time, who.id || 7);
    if (who !== this.run.p) return;
    // a bead of sweat when something is about to hit you or has just noticed you
    if (this.clawed || time < (s.sweatUntil || 0)) {
      const bob = Math.sin(time / 140), sx = s.x - dir * 7;
      g.fillStyle(0x8fd8f0, 1); g.fillRect(sx, top + 3 + bob, 2, 3); g.fillRect(sx + 0.5, top + 2 + bob, 1, 1);
    }
    // nearly out: now and then a tear rolls down from each eye (columns 7 and 12 of the sprite)
    if (s.texture.key.endsWith('~teary')) {
      const t = (time % 1600) / 900;
      if (t < 1) for (const c of [7, 12]) {
        const ex = s.flipX ? s.x + 7.5 - c : s.x - 7.5 + c;
        g.fillStyle(0x8fd8f0, 1 - t * 0.6); g.fillRect(ex - 0.5, top + 8 + t * 5, 1, 2);
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

  drawAim(g, time) {
    const run = this.run, p = run.p;
    g.lineStyle(1, 0xf4cf4f, 0.35);
    for (let y = p.y - BOMB_RANGE; y <= p.y + BOMB_RANGE; y++) for (let x = p.x - BOMB_RANGE; x <= p.x + BOMB_RANGE; x++) {
      if (run.canThrowAt(x, y)) g.strokeRect(x * TILE + 1.5, y * TILE + 1.5, TILE - 3, TILE - 3);
    }
    const h = this.hover;
    if (!h || !run.canThrowAt(h.x, h.y)) return;
    const a = 0.3 + 0.2 * Math.sin(time / 90);
    g.fillStyle(0xff5040, a);
    g.fillRect((h.x - 1) * TILE, (h.y - 1) * TILE, TILE * 3, TILE * 3);
    g.lineStyle(1.5, 0xffffff, 0.9);
    g.strokeRect(h.x * TILE + 0.5, h.y * TILE + 0.5, TILE - 1, TILE - 1);
    if (cheb(h, p) <= 1) {
      g.fillStyle(0xff2020, 0.35 + 0.3 * Math.sin(time / 60));
      g.fillRect(p.x * TILE, p.y * TILE, TILE, TILE);
    }
  }
}
