// Draws a Run and plays its effects. All game rules live in core/;
// this scene only listens to the run's events and animates them.
// Characters stand on the bottom middle of their tile (origin 0.5, 1).

/* global Phaser */
import { TILE, buildTextures } from './textures.js';
import { CHARACTERS } from '../data/characters.js';
import { ITEMS } from '../data/items.js';
import { SIGHT } from '../data/balance.js';
import { T, TERRAIN, GASES, GAS_KEYS } from '../data/terrain.js';
import { idx, inMap, WALL, STAIRS, DOOR, ORE, UPSTAIRS } from '../core/dungeon.js';
import { WAKE_AT } from '../core/ai.js';
import { BOMB_RANGE } from '../core/run.js';
import { ORE_HITS } from '../data/balance.js';
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
    };
    this.gasGfx = this.add.graphics().setDepth(D.gas);
    this.fireGfx = this.add.graphics().setDepth(D.fire);
    this.teleGfx = this.add.graphics().setDepth(D.telegraph);
    this.overlay = this.add.graphics().setDepth(D.overlay);
    this.pathGfx = this.add.graphics().setDepth(D.overlay);
    this.bubbles = [];
    this.waterFrame = 0;
    this.lastEmber = 0;

    const tileOf = ptr => ({ x: Math.floor(ptr.worldX / TILE), y: Math.floor(ptr.worldY / TILE) });
    this.input.on('pointerdown', ptr => {
      if (!this.run || !this.onTileClick) return;
      const t = tileOf(ptr);
      this.onTileClick(t.x, t.y);
    });
    this.input.on('pointermove', ptr => {
      if (!this.run) return;
      const t = tileOf(ptr);
      if (this.hover && this.hover.x === t.x && this.hover.y === t.y) return;
      this.hover = t;
      this.onHover?.(t.x, t.y);
    });
    this.input.on('gameout', () => { this.hover = null; this.onHover?.(null, null); });
    this.scale.on('resize', () => this.fitZoom());
    this.fitZoom();
    this.onReady?.(this);
  }

  fitZoom() {
    const { width, height } = this.scale.gameSize;
    if (width < 16 || height < 16) return;
    this.zoom = Math.max(2, Math.floor(Math.min(width / 15, height / 11) / TILE));
    this.cameras.main.setZoom(this.zoom);
  }

  textRes() { return (this.zoom || 3) * (window.devicePixelRatio || 1); }

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

  floorKey(x, y) {
    const h = hash(x, y) & 15;
    return `z${this.zi}_floor${h < 9 ? 0 : h < 12 ? 1 : h < 15 ? 2 : 3}`;
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
    if (t === WALL) {
      let nearFloor = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (inMap(x + dx, y + dy) && map.tiles[idx(x + dx, y + dy)] !== WALL) nearFloor = true;
      }
      if (!nearFloor) { this.tileImgs[i] = null; return; }
      const faceBelow = inMap(x, y + 1) && map.tiles[idx(x, y + 1)] !== WALL;
      add(`z${zi}_${faceBelow ? 'face' : 'wall'}`);
    } else {
      if (ter === T.WATER) this.waterImgs.add(add(`z${zi}_water${this.waterFrame}`));
      else add(this.floorKey(x, y));
      const spr = TERRAIN[ter]?.sprite;
      if (spr) add(`t_${spr}`, D.ter);
      if (t === STAIRS) add('t_stairs', D.ter);
      if (t === UPSTAIRS) add('t_upStairs', D.ter);
      if (t === DOOR) this.doorImgs[i] = add(map.open[i] ? 't_doorOpen' : 't_door', D.ter);
      if (t === ORE) add('t_bigOre', D.ter);
    }
    this.tileImgs[i] = imgs;
  }

  rebuildAround(list) {
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
    this.sync(true);
  }

  // ---------- state -> sprites ----------
  sync(instant = false) {
    const run = this.run;
    if (!run) return;
    const map = run.map, p = run.p;
    const dur = instant ? 0 : 90;

    for (const [i, img] of Object.entries(this.doorImgs)) img.setTexture(map.open[i] ? 't_doorOpen' : 't_door');

    // fog of war with light falling off from the player
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = idx(x, y), imgs = this.tileImgs[i];
      if (!imgs) continue;
      if (!map.explored[i]) { imgs.forEach(im => im.setVisible(false)); continue; }
      let v;
      if (map.visible[i]) {
        const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        v = Math.round(255 - Math.min(1, d / (SIGHT + 1)) * 110);
      } else v = 70;
      const tint = (v << 16) | (v << 8) | Math.min(255, Math.round(v * 1.05));
      imgs.forEach(im => im.setVisible(true).setTint(tint));
    }

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
        s = this.add.image(q.x * TILE, q.y * TILE, tex).setOrigin(0).setDepth(D.pickups);
        this.tweens.add({ targets: s, y: q.y * TILE - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (q.x * 97) % 600 });
        this.pickupSprites[key] = s;
      }
      s.setVisible(!!map.explored[idx(q.x, q.y)]);
    }
    for (const key of Object.keys(this.pickupSprites)) {
      if (!keep.has(key)) { this.pickupSprites[key].destroy(); delete this.pickupSprites[key]; }
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
      case 'turn': case 'relics': this.sync(); break;
      case 'tiles': this.rebuildAround(d.list); break;
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
      case 'steam': this.fx.steam.explode(14, center(d.x), center(d.y)); break;
      case 'shock': this.shock(d.tiles); break;
      case 'mine':
        this.bump(this.playerSprite, d.from, d);
        this.fx.spark.explode(6 + d.hits * 3, center(d.x), center(d.y));
        this.fx.rock.explode(4 + d.hits * 3, center(d.x), center(d.y));
        this.cameras.main.shake(80 + d.hits * 30, 0.002 + d.hits * 0.0012);
        this.noiseRing(d.x, d.y, d.r);
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

  onHit(d) {
    const s = this.enemySprites[d.enemy.id];
    if (s) this.flash(s);
    const color = { normal: '#ffffff', fire: '#f08c3a', bolt: '#f4cf4f', thorns: '#b8b8c8' }[d.kind] || '#ffffff';
    const kind = d.enemy.d.sprite;
    const fx = d.kind === 'fire' ? 'fire' : d.kind === 'bolt' ? 'spark' : kind === 'skel' ? 'bone' : kind === 'slime' ? 'slime' : 'blood';
    if (this.run.isVisible(d.x, d.y)) {
      this.fx[fx].explode(d.kind === 'normal' ? 6 : 10, center(d.x), center(d.y));
      this.float(d.x, d.y, String(d.dmg), color, d.kind === 'normal' ? 0 : 120);
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

  float(x, y, text, color, delay = 0) {
    const t = this.add.text(center(x), y * TILE, text, {
      fontFamily: '"Do Hyeon", sans-serif', fontSize: '10px', color, stroke: '#000000', strokeThickness: 2,
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

  // How far a swing at the big ore is heard: a ring that grows out to that distance.
  noiseRing(x, y, r) {
    const c = this.add.circle(center(x), center(y), TILE * (r + 0.5)).setStrokeStyle(1.5, 0xf4cf4f, 0.9).setDepth(D.fx).setScale(0.1);
    this.tweens.add({ targets: c, scale: 1, duration: 260 + r * 40, ease: 'Quad.out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 200 + r * 40, duration: 300, onComplete: () => c.destroy() });
  }

  // ---------- per-frame drawing ----------
  update(time) {
    const run = this.run, g = this.overlay;
    g.clear(); this.teleGfx.clear(); this.pathGfx.clear(); this.gasGfx.clear(); this.fireGfx.clear();
    if (!run || !this.playerSprite) return;
    const map = run.map, p = run.p;

    // water ripples
    const wf = Math.floor(time / 650) % 2;
    if (wf !== this.waterFrame) {
      this.waterFrame = wf;
      for (const img of this.waterImgs) img.setTexture(`z${this.zi}_water${wf}`);
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
        g.fillStyle(e.d.boss ? 0xf4cf4f : 0xe0525a, 1); g.fillRect(s.x - 6, top - 3, 12 * Math.max(0, e.hp) / e.maxHp, 2);
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
    ps.setAlpha(run.playerHidden() ? 0.6 : 1);
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
