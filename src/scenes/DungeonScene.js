// Draws a Run and plays its effects. All game rules live in core/;
// this scene only listens to the run's events and animates them.
// Characters stand on the bottom middle of their tile (origin 0.5, 1).

/* global Phaser */
import { TILE, buildTextures, wallKey, waterKey, shadeKey, floorKey, N, E, S, W_, NE, SE, SW, NW } from './textures.js';
import { CHARACTERS } from '../data/characters.js';
import { ITEMS } from '../data/items.js';
import { T, TERRAIN, GASES, GAS_KEYS } from '../data/terrain.js';
import { idx, inMap, lineOfSight, WALL, STAIRS, DOOR, ORE, UPSTAIRS } from '../core/dungeon.js';
import { WAKE_AT } from '../core/ai.js';
import { BOMB_RANGE } from '../core/run.js';
import { ORE_HITS } from '../data/balance.js';
import { ORES } from '../data/ores.js';
import { cheb } from '../core/util.js';

const D = { tiles: 0, ter: 1, fire: 2, gas: 3, telegraph: 4, pickups: 5, enemies: 6, player: 7, overlay: 8, fx: 9, bubble: 10, text: 11 };
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
    this.cameras.main.setBackgroundColor('#07060a');
    this.cameras.main.setRoundPixels(true);

    const burst = (tint, extra = {}) => this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 250, max: 500 }, speed: { min: 15, max: 60 },
      scale: { start: 1.5, end: 0 }, gravityY: 90, tint, ...extra,
    }).setDepth(D.fx);
    this.fx = {
      blood: burst([0xd9454a, 0xa02c3e]),
      bone: burst([0xf4f0e8, 0xb8b8c8]),
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
      leaf: burst([0x6cc45a, 0x2f7a43, 0xb5e08a], { gravityY: 60, speed: { min: 12, max: 36 }, lifespan: { min: 300, max: 600 }, scale: { start: 1.5, end: 0.5 } }),
    };
    this.shadowGfx = this.add.graphics().setDepth(D.pickups - 0.5);
    this.gasGfx = this.add.graphics().setDepth(D.gas);
    this.fireGfx = this.add.graphics().setDepth(D.fire);
    this.teleGfx = this.add.graphics().setDepth(D.telegraph);
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

  // The canvas is drawn at the screen's real pixel density (main.js), so zoom is counted in
  // device pixels per art pixel and always stays a whole number to keep the pixel art crisp.
  get dpr() { return this.game.registry.get('dpr') || 1; }

  fitZoom() {
    const r = this.dpr, w = this.scale.gameSize.width / r, h = this.scale.gameSize.height / r;
    if (w < 16 || h < 16) return;
    let tile = Math.min(w / 15, h / 11);                                   // whole rooms on a big screen
    if (this.game.registry.get('touch')) tile = Math.max(tile, Math.min(w, h) / 10); // finger-sized on a phone
    this.baseZoom = Math.max(1, Math.floor(Math.max(tile, 32) * r / TILE));
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
    run.on((type, data) => this.onEvent(type, data));
    if (run.map) this.buildFloor();
  }

  detach() {
    this.run = null;
    this.aim = false;
    this.clearFloor();
  }

  clearFloor() {
    (this.tileImgs || []).forEach(list => list && list.forEach(i => i.destroy()));
    Object.values(this.enemySprites || {}).forEach(s => { s.crown?.destroy(); s.destroy(); });
    Object.values(this.pickupSprites || {}).forEach(s => s.destroy());
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
    this.bubbles = [];
    this.playerSprite = null;
  }

  get zi() { return Math.floor((this.run.floor - 1) / 3); }

  buildFloor() {
    this.clearFloor();
    const run = this.run, map = run.map;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) this.buildTile(x, y);
    this.buildLamps();
    this.playerSprite = this.makeActor(CHARACTERS[run.charId].sprite, run.p.x, run.p.y).setDepth(D.player);
    this.cameras.main.startFollow(this.playerSprite, true, 0.25, 0.25, 0, TILE / 2);
    this.cameras.main.centerOn(center(run.p.x), foot(run.p.y) - TILE / 2);
    this.sync(true);
  }

  makeActor(tex, x, y) {
    const s = this.add.image(center(x), foot(y), tex).setOrigin(0.5, 1);
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
    // which neighbours pass `test`, as N/E/S/W and diagonal bits
    const around = test => (test(x, y - 1) && N) | (test(x + 1, y) && E) | (test(x, y + 1) && S) | (test(x - 1, y) && W_) |
      (test(x + 1, y - 1) && NE) | (test(x + 1, y + 1) && SE) | (test(x - 1, y + 1) && SW) | (test(x - 1, y - 1) && NW);
    const wall = (nx, ny) => !inMap(nx, ny) || map.tiles[idx(nx, ny)] === WALL;
    if (t === WALL) {
      const open = around((nx, ny) => !wall(nx, ny));
      if (!open) { this.tileImgs[i] = null; return; }
      add(wallKey(this, zi, open));
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
      if (t === ORE) this.oreImg = add(`t_ore_${ORES[map.ore?.tier || 0].id}`, D.ter);
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
    if (!run) return;
    const map = run.map, p = run.p;
    const dur = instant ? 0 : 90;

    for (const [i, img] of Object.entries(this.doorImgs)) img.setTexture(map.open[i] ? 't_doorOpen' : 't_door');

    this.paintFog();
    this.moveTo(this.playerSprite, p.x, p.y, dur);

    const alive = new Set();
    for (const e of run.enemies) {
      if (e.hp <= 0) continue;
      alive.add(e.id);
      let s = this.enemySprites[e.id];
      if (!s) {
        s = this.makeActor(e.d.sprite, e.x, e.y).setDepth(D.enemies);
        if (e.d.boss) {
          s.setScale(1.25);
          s.crown = this.add.image(0, 0, 'crown').setOrigin(0.5, 1).setDepth(D.enemies + 0.1);
        }
        this.enemySprites[e.id] = s;
      }
      s.setVisible(run.isVisible(e.x, e.y));
      this.moveTo(s, e.x, e.y, dur);
    }
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
        const tex = q.type === 'gold' ? 'gold' : q.type === 'chest' ? 'chest' : ITEMS[q.type].sprite;
        s = this.add.image(q.x * TILE, q.y * TILE, tex).setOrigin(0).setDepth(D.pickups).setData('baseY', q.y * TILE + 14);
        this.tweens.add({ targets: s, y: q.y * TILE - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (q.x * 97) % 600 });
        this.pickupSprites[key] = s;
      }
      s.setVisible(!!map.explored[idx(q.x, q.y)]);
    }
    for (const key of Object.keys(this.pickupSprites)) {
      if (!keep.has(key)) { this.pickupSprites[key].destroy(); delete this.pickupSprites[key]; }
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
    this.tweens.add({ targets: sprite, x: tx, y: ty, duration: dur, ease: 'Quad.out' });
  }

  spriteFor(who) {
    return who === 'player' ? this.playerSprite : this.enemySprites[who.id];
  }

  // ---------- events ----------
  onEvent(type, d) {
    if (!this.run) return;
    switch (type) {
      case 'floor': this.buildFloor(); break;
      case 'turn': this.sync(); this.follow(); break;
      case 'relics': this.sync(); break;
      case 'tiles': this.rebuildAround(d.list, d.soft); break;
      case 'stairs': this.rebuildAround([idx(d.x, d.y)]); this.fx.spark.explode(16, center(d.x), center(d.y)); break;
      case 'attack': this.bump(this.spriteFor(d.who), d.from, d.to); break;
      case 'hit': this.onHit(d); break;
      case 'kill': this.onKill(d.enemy); break;
      case 'phit':
        this.flash(this.playerSprite);
        this.cameras.main.shake(['slam', 'bomb'].includes(d.kind) ? 220 : 110, ['slam', 'bomb'].includes(d.kind) ? 0.012 : 0.005);
        this.fx.blood.explode(8, center(d.x), center(d.y));
        this.float(d.x, d.y, `-${d.dmg}`, '#ff6b6b');
        break;
      case 'sneak':
        this.float(d.x, d.y - 1.1, '기습!', '#f4cf4f', 0, 12);
        this.fx.spark.explode(12, center(d.x), center(d.y));
        this.cameras.main.shake(90, 0.004);
        break;
      case 'snore': this.noiseRing(d.x, d.y, d.r, 0xb58cf0); break;
      case 'dodge': this.float(d.x, d.y, '회피', '#6fe0e0'); break;
      case 'heal': this.float(d.x, d.y, `+${d.n}`, '#8fd36a'); this.fx.heal.explode(6, center(d.x), center(d.y)); break;
      case 'gold': this.float(d.x, d.y, `+${d.n}G`, '#f4cf4f', 300); break;
      case 'pickup': this.fx[d.type === 'gold' ? 'gold' : 'spark'].explode(d.type === 'chest' ? 20 : 6, center(d.x), center(d.y)); break;
      case 'zap': this.lightning(d.from, d.to); break;
      case 'shot': this.projectile(d.from, d.to, d.hit); break;
      case 'throw': this.throwArc(d.from, d.to); break;
      case 'boom': this.explosion(d.x, d.y, d.r); break;
      case 'gasboom': this.gasBoom(d.tiles); break;
      case 'puff': this.fx[d.kind].explode(30, center(d.x), center(d.y)); break;
      case 'rustle': this.fx.leaf.explode(7, center(d.x), center(d.y) + 3); break;
      case 'trap': this.onTrap(d); break;
      case 'summon': this.fx.magic.explode(16, center(d.x), center(d.y)); break;
      case 'alarm':
        for (let k = 0; k < 3; k++) this.time.delayedCall(k * 220, () => this.noiseRing(d.x, d.y, 9, 0xff6b6b));
        this.cameras.main.shake(260, 0.006);
        break;
      case 'spot':
        this.float(d.x, d.y, '!', '#f4cf4f', 0, 14);
        this.fx.spark.explode(10, center(d.x), center(d.y));
        break;
      case 'steam': this.fx.steam.explode(14, center(d.x), center(d.y)); break;
      case 'shock': this.shock(d.tiles); break;
      case 'mine': this.onMine(d); break;
      case 'heard':
        this.float(d.x, d.y + 1.7, `${d.list.length}마리가 들었다!`, '#ff7a7a', 250, 11);
        this.heardMarks = d.list.map(e => ({ e, until: this.time.now + 2200 }));
        break;
      case 'say': this.say(d.who, d.text); break;
      case 'alert': {
        const s = this.enemySprites[d.enemy.id];
        if (s) this.tweens.add({ targets: s, hop: 5, duration: 100, yoyo: true, ease: 'Quad.out' });
        break;
      }
      case 'discover': this.fx.spark.explode(30, center(this.run.p.x), center(this.run.p.y)); break;
      case 'slam':
        d.tiles.forEach(t => this.fx.dust.explode(3, center(t.x), center(t.y)));
        if (!d.hit) this.cameras.main.shake(120, 0.004);
        break;
      case 'teleport':
        this.fx.magic.explode(18, center(d.from.x), center(d.from.y));
        this.fx.magic.explode(18, center(d.to.x), center(d.to.y));
        break;
      case 'evolve':
        this.fx.spark.explode(40, center(d.x), center(d.y));
        this.fx.fire.explode(20, center(d.x), center(d.y));
        this.cameras.main.flash(180, 244, 207, 79);
        break;
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
    if (d.kind === T.TRAP_SPIKE) { this.fx.rock.explode(10, center(d.x), center(d.y)); this.cameras.main.shake(140, 0.008); }
    if (d.kind === T.TRAP_SUMMON) { this.cameras.main.shake(220, 0.01); this.cameras.main.flash(120, 154, 95, 209); }
  }

  onHit(d) {
    const s = this.enemySprites[d.enemy.id];
    if (s) this.flash(s);
    const color = { normal: '#ffffff', sneak: '#f4cf4f', fire: '#f08c3a', bolt: '#f4cf4f', thorns: '#b8b8c8' }[d.kind] || '#ffffff';
    const kind = d.enemy.d.sprite;
    const fx = d.kind === 'fire' ? 'fire' : d.kind === 'bolt' ? 'spark' : kind === 'skel' ? 'bone' : kind === 'slime' ? 'slime' : 'blood';
    if (this.run.isVisible(d.x, d.y)) {
      this.fx[fx].explode(d.kind === 'normal' ? 6 : 10, center(d.x), center(d.y));
      const first = d.kind === 'normal' || d.kind === 'sneak';
      this.float(d.x, d.y, String(d.dmg), color, first ? 0 : 120, d.kind === 'sneak' ? 13 : 10);
    }
  }

  onKill(e) {
    const s = this.enemySprites[e.id];
    const fx = e.d.sprite === 'skel' ? 'bone' : e.d.sprite === 'slime' ? 'slime' : 'blood';
    if (this.run.isVisible(e.x, e.y)) this.fx[fx].explode(e.d.boss ? 40 : 14, center(e.x), center(e.y));
    if (e.d.boss) { this.cameras.main.shake(300, 0.01); this.fx.spark.explode(30, center(e.x), center(e.y)); }
    if (!s) return;
    s.dying = true;
    s.crown?.destroy();
    this.tweens.killTweensOf(s);
    this.tweens.add({
      targets: s, alpha: 0, scaleX: 1.4, scaleY: 0.3, duration: 220, ease: 'Quad.in',
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

  float(x, y, text, color, delay = 0, size = 10) {
    const t = this.add.text(center(x), y * TILE, text, {
      fontFamily: '"Do Hyeon", sans-serif', fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(D.text).setResolution(this.textRes()).setAlpha(delay ? 0 : 1);
    this.tweens.add({ targets: t, alpha: 1, duration: 1, delay });
    this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 800, delay: delay + 150, ease: 'Quad.in', onComplete: () => t.destroy() });
  }

  // A short line in a speech bubble over the speaker. At most two on screen.
  say(who, text) {
    const target = this.spriteFor(who);
    if (!target || target.dying) return;
    if (who !== 'player' && !this.run.isVisible(who.x, who.y)) return;
    while (this.bubbles.length >= 2) this.bubbles.shift().destroy();
    // enemies only ever say "!" or "?": draw those as a bare mark, not a speech bubble
    const mark = text === '!' || text === '?';
    const style = mark
      ? { fontFamily: '"Do Hyeon", sans-serif', fontSize: '13px', color: text === '!' ? '#ff5a4a' : '#f4cf4f', stroke: '#1b1424', strokeThickness: 3 }
      : { fontFamily: '"Do Hyeon", sans-serif', fontSize: '9px', color: '#1b1424', backgroundColor: '#f4f0e8', padding: { x: 3, y: 1 } };
    const b = this.add.text(target.x, target.y - 18, text, style).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(this.textRes());
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
    this.cameras.main.shake(220, 0.012);
  }

  gasBoom(tiles) {
    this.cameras.main.shake(400, 0.018);
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
    const cx = center(d.x), cy = center(d.y), last = d.last;
    this.bump(this.playerSprite, d.from, d);
    this.hitStop(last ? 140 : 35 + d.hits * 12);
    this.fx.spark.explode((last ? 30 : 6) + d.hits * 3, cx, cy);
    this.fx.rock.explode((last ? 24 : 4) + d.hits * 3, cx, cy);
    this.cameras.main.shake(last ? 420 : 80 + d.hits * 35, last ? 0.014 : 0.002 + d.hits * 0.0014);
    if (last) this.cameras.main.flash(160, 244, 207, 79);
    this.noiseRing(d.x, d.y, d.r);
    const g = ORES[d.tier], tint = Phaser.Display.Color.HexStringToColor(g.vein ? g.vein[0] : '#ffffff').color;
    // the ore itself shudders
    const img = this.oreImg?.active ? this.oreImg : null;
    if (img && !last) this.tweens.add({ targets: img, x: img.x + 1.5, duration: 30, yoyo: true, repeat: 2 + d.hits });
    // cracked into a better grade: the veins change colour with a glittering pop
    if (d.rose) {
      if (img) img.setTexture(`t_ore_${g.id}`);
      this.hitStop(110);
      const c = Phaser.Display.Color.IntegerToRGB(tint);
      this.cameras.main.flash(140, c.r, c.g, c.b);
      this.fx.spark.explode(24, cx, cy);
      const ring = this.add.circle(cx, cy, TILE * 0.9).setStrokeStyle(2, tint, 1).setDepth(D.fx).setScale(0.2);
      this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => ring.destroy() });
      if (!d.nugget) this.float(d.x, d.y - 0.6, `${g.name}!`, g.vein ? g.vein[0] : '#ffffff', 60, g.gem ? 15 : 13);
    }
    // a bonanza: a fountain of gold and a big shout
    if (d.nugget) {
      this.hitStop(160);
      this.cameras.main.shake(320, 0.012);
      this.cameras.main.flash(180, 244, 207, 79);
      this.float(d.x, d.y - 1.1, d.rose ? `노다지! ${g.name}!` : '노다지!', '#f4cf4f', 140, 18);
      for (let k = 0; k < 16; k++) this.coinFly(cx, cy, 2.4, 120 + k * 22);
    }
    // gold chips spray out and fly into your pocket
    const n = last ? 14 : 2 + d.hits;
    for (let k = 0; k < n; k++) this.coinFly(cx, cy, last ? 2.2 : 1.2, k * (last ? 25 : 35));
  }

  coinFly(x, y, spread, delay) {
    const c = this.add.image(x, y, 'gold').setScale(0.45).setDepth(D.fx);
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
    g.clear(); this.teleGfx.clear(); this.pathGfx.clear(); this.gasGfx.clear(); this.fireGfx.clear(); this.shadowGfx.clear();
    if (!run || !this.playerSprite) return;
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
      const lift = Math.min(1, (s.hop || 0) / 6);
      this.shadowGfx.fillStyle(0x000000, 0.32 * (1 - 0.5 * lift));
      this.shadowGfx.fillEllipse(s.x, s.y - 1.5, w * (1 - 0.3 * lift), 4);
    };
    shadow(this.playerSprite, 11);
    for (const s of Object.values(this.enemySprites)) shadow(s, s.scaleX > 1.1 ? 15 : 11);
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

    // boss slam warning
    const pulse = 0.35 + 0.25 * Math.sin(time / 110);
    this.teleGfx.fillStyle(0xff4646, pulse);
    for (const t of run.telegraph) this.teleGfx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);

    // auto-walk path
    this.pathGfx.fillStyle(0x8fd36a, 0.55);
    for (const [x, y] of this.path) this.pathGfx.fillRect(x * TILE + 6, y * TILE + 6, 4, 4);

    // the big ore: cracks and pips show how many swings it has taken
    const ore = map.ore;
    if (ore && map.explored[idx(ore.x, ore.y)]) {
      const x0 = ore.x * TILE, y0 = ore.y * TILE;
      g.lineStyle(1, 0x1b1424, 0.9);
      const cracks = [[8, 2, 6, 7], [6, 7, 9, 11], [3, 9, 6, 7], [9, 11, 12, 13], [10, 4, 12, 8]];
      for (let k = 0; k < ore.hits; k++) g.lineBetween(x0 + cracks[k][0], y0 + cracks[k][1], x0 + cracks[k][2], y0 + cracks[k][3]);
      for (let k = 0; k < ORE_HITS; k++) {
        g.fillStyle(k < ore.hits ? 0xf4cf4f : 0x2c2536, 1);
        g.fillRect(x0 + 2 + k * 2.6, y0 - 3, 2, 2);
      }
      // a glint now and then, so it catches your eye from across the room
      if (map.visible[idx(ore.x, ore.y)] && time > (this.nextGlint || 0)) {
        this.nextGlint = time + 900 + Math.random() * 900;
        this.fx.spark.explode(2, x0 + 3 + Math.random() * 10, y0 + 3 + Math.random() * 9);
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
      if (!s.visible) continue;
      if (s.crown) s.crown.setPosition(s.x, s.y - TILE * 1.25 + 2 - s.hop);
      const top = s.y - TILE * s.scaleY * (e.d.boss ? 1.25 : 1) - s.hop;
      this.drawStatus(g, s, e, top, flip ? -1 : 1, time);
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

    // you
    const ps = this.playerSprite;
    this.pose(ps, p, p.face < 0, time);
    this.drawStatus(g, ps, p, ps.y - TILE - ps.hop, p.face < 0 ? -1 : 1, time);

    // speech bubbles follow their speaker
    this.bubbles = this.bubbles.filter(b => {
      if (time > b.until || !b.target.active) { b.destroy(); return false; }
      b.setPosition(Math.round(b.target.x), Math.round(b.target.y - TILE - 4 - b.target.hop));
      b.setAlpha(b.until - time < 250 ? (b.until - time) / 250 : 1);
      return true;
    });

    if (this.aim) this.drawAim(g, time);
  }

  // Body language: breathing while asleep, crouching before a hit, hopping when on fire.
  pose(s, who, flip, time) {
    s.setFlipX(flip);
    const id = who.id || 0;
    let sx = 1, sy = 1, hop = s.hop || 0;
    if (who.sleep || who.state === 'sleep') sy = 1 + 0.05 * Math.sin(time / 450 + id);
    else if (who.d && this.run.willHit(who)) { sx = 1.08; sy = 0.86; }
    if (who.burn > 0) hop = Math.max(hop, Math.abs(Math.sin(time / 90 + id)) * 3);
    const base = who.d?.boss ? 1.25 : 1;
    if (!s.dying) s.setScale(base * sx, base * sy);
    s.setOrigin(0.5, 1 + hop / TILE);
    if (time < s.flashUntil) return;
    let tint = who.d?.boss ? 0xffb0b0 : 0xffffff;
    if (who.burn > 0) tint = 0xffc890;
    if (who.sleep || who.state === 'sleep') tint = 0xc4c4dc;
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
