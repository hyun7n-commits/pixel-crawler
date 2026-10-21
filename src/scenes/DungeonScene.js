// Draws a Run and plays its effects. All game rules live in core/run.js;
// this scene only listens to the run's events and animates them.

/* global Phaser */
import { TILE, buildTextures } from './textures.js';
import { CHARACTERS } from '../data/characters.js';
import { ITEMS } from '../data/items.js';
import { SIGHT } from '../data/balance.js';
import { idx, inMap, WALL, STAIRS } from '../core/dungeon.js';
import { cheb } from '../core/util.js';

const D = { tiles: 0, telegraph: 1, pickups: 2, enemies: 3, player: 4, overlay: 5, fx: 6, text: 7 };
const center = v => v * TILE + TILE / 2;
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
    this.onTileClick = null;
  }

  create() {
    buildTextures(this);
    this.cameras.main.setBackgroundColor('#07060a');
    this.cameras.main.setRoundPixels(true);

    const burst = (tint, extra = {}) => this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 250, max: 500 }, speed: { min: 12, max: 45 },
      scale: { start: 1, end: 0 }, gravityY: 70, tint, ...extra,
    }).setDepth(D.fx);
    this.fx = {
      blood: burst([0xd9454a, 0xa02c3e]),
      bone: burst([0xf4f0e8, 0xb8b8c8]),
      slime: burst([0x6cc45a, 0x2f7a43]),
      fire: burst([0xf08c3a, 0xf4cf4f, 0xd9454a], { gravityY: -40 }),
      spark: burst([0xf4cf4f, 0xffffff], { gravityY: 0, speed: { min: 20, max: 70 } }),
      heal: burst([0x8fd36a, 0xc9f2a8], { gravityY: -50, speed: { min: 5, max: 20 } }),
      magic: burst([0x9a5fd1, 0x6fe0e0], { gravityY: -20 }),
      dust: burst([0x6b6b80, 0xb8b8c8], { gravityY: 20, speed: { min: 8, max: 30 } }),
      gold: burst([0xf4cf4f, 0xf08c3a], { gravityY: 40 }),
    };
    this.overlay = this.add.graphics().setDepth(D.overlay);
    this.teleGfx = this.add.graphics().setDepth(D.telegraph);
    this.pathGfx = this.add.graphics().setDepth(D.overlay);

    this.input.on('pointerdown', ptr => {
      if (!this.run || !this.onTileClick) return;
      this.onTileClick(Math.floor(ptr.worldX / TILE), Math.floor(ptr.worldY / TILE));
    });
    this.scale.on('resize', () => this.fitZoom());
    this.fitZoom();
    this.onReady?.(this);
  }

  fitZoom() {
    const { width, height } = this.scale.gameSize;
    if (width < 16 || height < 16) return;
    this.zoom = Math.max(3, Math.floor(Math.min(width / 15, height / 11) / TILE));
    this.cameras.main.setZoom(this.zoom);
  }

  // ---------- wiring ----------
  attach(run) {
    this.run = run;
    run.on((type, data) => this.onEvent(type, data));
    if (run.map) this.buildFloor();
  }

  detach() {
    this.run = null;
    this.clearFloor();
  }

  clearFloor() {
    (this.tileImgs || []).forEach(list => list && list.forEach(i => i.destroy()));
    Object.values(this.enemySprites || {}).forEach(s => { s.crown?.destroy(); s.destroy(); });
    Object.values(this.pickupSprites || {}).forEach(s => s.destroy());
    this.playerSprite?.destroy();
    this.tileImgs = [];
    this.enemySprites = {};
    this.pickupSprites = {};
    this.playerSprite = null;
  }

  buildFloor() {
    this.clearFloor();
    const run = this.run, map = run.map, zi = Math.floor((run.floor - 1) / 3);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) this.buildTile(x, y, zi);
    this.playerSprite = this.add.image(run.p.x * TILE, run.p.y * TILE, CHARACTERS[run.charId].sprite)
      .setOrigin(0).setDepth(D.player);
    this.cameras.main.startFollow(this.playerSprite, true, 0.25, 0.25, -TILE / 2, -TILE / 2);
    this.cameras.main.centerOn(center(run.p.x), center(run.p.y));
    this.sync(true);
  }

  buildTile(x, y, zi) {
    const map = this.run.map, i = idx(x, y), t = map.tiles[i];
    (this.tileImgs[i] || []).forEach(img => img.destroy());
    const imgs = [];
    const add = key => imgs.push(this.add.image(x * TILE, y * TILE, key).setOrigin(0).setDepth(D.tiles).setVisible(false));
    if (t !== WALL) {
      const h = hash(x, y) & 15;
      add(`z${zi}_floor${h < 9 ? 0 : h < 12 ? 1 : h < 15 ? 2 : 3}`);
      if (t === STAIRS) add('stairs');
    } else {
      let nearFloor = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (inMap(x + dx, y + dy) && map.tiles[idx(x + dx, y + dy)] !== WALL) nearFloor = true;
      }
      if (!nearFloor) { this.tileImgs[i] = null; return; }
      const faceBelow = inMap(x, y + 1) && map.tiles[idx(x, y + 1)] !== WALL;
      add(`z${zi}_${faceBelow ? 'face' : 'wall'}`);
    }
    this.tileImgs[i] = imgs;
  }

  // ---------- state -> sprites ----------
  sync(instant = false) {
    const run = this.run;
    if (!run) return;
    const map = run.map, p = run.p;
    const dur = instant ? 0 : 90;

    // fog of war with light falling off from the player
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const imgs = this.tileImgs[idx(x, y)];
      if (!imgs) continue;
      const i = idx(x, y);
      if (!map.explored[i]) { imgs.forEach(im => im.setVisible(false)); continue; }
      let v;
      if (map.visible[i]) {
        const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        v = Math.round(255 - Math.min(1, d / (SIGHT + 1)) * 110);
      } else v = 70;
      const tint = (v << 16) | (v << 8) | Math.round(v * 1.05 > 255 ? 255 : v * 1.05);
      imgs.forEach(im => im.setVisible(true).setTint(tint));
    }

    this.moveTo(this.playerSprite, p.x, p.y, dur);

    // enemies
    const alive = new Set();
    for (const e of run.enemies) {
      if (e.hp <= 0) continue;
      alive.add(e.id);
      let s = this.enemySprites[e.id];
      if (!s) {
        s = this.add.image(e.x * TILE, e.y * TILE, e.d.sprite).setOrigin(0).setDepth(D.enemies);
        if (e.d.boss) {
          s.setTint(0xffb0b0);
          s.crown = this.add.image(0, 0, 'crown').setOrigin(0.5, 1).setScale(0.6).setDepth(D.enemies);
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

    // pickups
    const keep = new Set();
    for (const q of run.pickups) {
      const key = `${q.x},${q.y},${q.type}`;
      keep.add(key);
      let s = this.pickupSprites[key];
      if (!s) {
        const tex = q.type === 'gold' ? 'gold' : q.type === 'chest' ? 'chest' : ITEMS[q.type].sprite;
        s = this.add.image(q.x * TILE, q.y * TILE, tex).setOrigin(0).setDepth(D.pickups);
        this.tweens.add({ targets: s, y: q.y * TILE - 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (q.x * 97) % 600 });
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
    const tx = x * TILE, ty = y * TILE;
    if (sprite.x === tx && sprite.y === ty) return;
    this.tweens.killTweensOf(sprite);
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
      case 'stairs': this.buildTile(d.x, d.y, Math.floor((this.run.floor - 1) / 3)); this.fx.spark.explode(16, center(d.x), center(d.y)); break;
      case 'attack': this.bump(this.spriteFor(d.who), d.from, d.to); break;
      case 'hit': this.onHit(d); break;
      case 'kill': this.onKill(d.enemy); break;
      case 'phit':
        this.flash(this.playerSprite);
        this.cameras.main.shake(d.kind === 'slam' ? 220 : 110, d.kind === 'slam' ? 0.012 : 0.005);
        this.fx.blood.explode(8, center(d.x), center(d.y));
        this.float(d.x, d.y, `-${d.dmg}`, '#ff6b6b');
        break;
      case 'dodge': this.float(d.x, d.y, '회피', '#6fe0e0'); break;
      case 'heal': this.float(d.x, d.y, `+${d.n}`, '#8fd36a'); this.fx.heal.explode(6, center(d.x), center(d.y)); break;
      case 'gold': this.float(d.x, d.y, `+${d.n}G`, '#f4cf4f', 300); break;
      case 'pickup': this.fx[d.type === 'gold' ? 'gold' : 'spark'].explode(d.type === 'chest' ? 20 : 6, center(d.x), center(d.y)); break;
      case 'zap': this.lightning(d.from, d.to); break;
      case 'shot': this.projectile(d.from, d.to, d.hit); break;
      case 'boom': this.explosion(d.x, d.y); break;
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
    this.fx[fx].explode(d.kind === 'normal' ? 6 : 10, center(d.x), center(d.y));
    this.float(d.x, d.y, String(d.dmg), color, d.kind === 'normal' ? 0 : 120);
  }

  onKill(e) {
    const s = this.enemySprites[e.id];
    const fx = e.d.sprite === 'skel' ? 'bone' : e.d.sprite === 'slime' ? 'slime' : 'blood';
    this.fx[fx].explode(e.d.boss ? 40 : 14, center(e.x), center(e.y));
    if (e.d.boss) { this.cameras.main.shake(300, 0.01); this.fx.spark.explode(30, center(e.x), center(e.y)); }
    if (!s) return;
    s.dying = true;
    s.crown?.destroy();
    this.tweens.add({
      targets: s, alpha: 0, scaleX: 1.3, scaleY: 0.4, y: s.y + TILE * 0.6, duration: 220, ease: 'Quad.in',
      onComplete: () => { s.destroy(); delete this.enemySprites[e.id]; },
    });
  }

  // ---------- effect helpers ----------
  flash(sprite) {
    if (!sprite) return;
    sprite.setTintFill(0xffffff);
    this.time.delayedCall(70, () => {
      if (!sprite.active) return;
      sprite.clearTint();
      if (this.run && sprite !== this.playerSprite && Object.values(this.enemySprites).includes(sprite)) {
        const e = this.run.enemies.find(en => this.enemySprites[en.id] === sprite);
        if (e?.d.boss) sprite.setTint(0xffb0b0);
      }
    });
  }

  bump(sprite, from, to) {
    if (!sprite) return;
    const dx = Math.sign(to.x - from.x) * 3, dy = Math.sign(to.y - from.y) * 3;
    const bx = from.x * TILE, by = from.y * TILE;
    this.tweens.killTweensOf(sprite);
    sprite.setPosition(bx, by);
    this.tweens.add({ targets: sprite, x: bx + dx, y: by + dy, duration: 50, yoyo: true, ease: 'Quad.out' });
  }

  float(x, y, text, color, delay = 0) {
    const t = this.add.text(center(x), y * TILE, text, {
      fontFamily: '"Do Hyeon", sans-serif', fontSize: '6px', color, stroke: '#000000', strokeThickness: 1.5,
    }).setOrigin(0.5, 1).setDepth(D.text).setResolution((this.zoom || 4) * (window.devicePixelRatio || 1)).setAlpha(delay ? 0 : 1);
    this.tweens.add({ targets: t, alpha: 1, duration: 1, delay });
    this.tweens.add({ targets: t, y: t.y - 7, alpha: 0, duration: 750, delay: delay + 150, ease: 'Quad.in', onComplete: () => t.destroy() });
  }

  lightning(from, to) {
    const g = this.add.graphics().setDepth(D.fx);
    const x0 = center(from.x), y0 = center(from.y), x1 = center(to.x), y1 = center(to.y);
    const draw = (w, color) => {
      g.lineStyle(w, color, 1);
      g.beginPath(); g.moveTo(x0, y0);
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        g.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 4, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 4);
      }
      g.lineTo(x1, y1); g.strokePath();
    };
    draw(2, 0xf4cf4f); draw(0.7, 0xffffff);
    this.fx.spark.explode(10, x1, y1);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  projectile(from, to, hit) {
    const b = this.add.image(center(from.x), center(from.y), 'px').setScale(2).setTint(0xff6b6b).setDepth(D.fx);
    this.tweens.add({
      targets: b, x: center(to.x), y: center(to.y), duration: 140, ease: 'Linear',
      onComplete: () => { b.destroy(); if (!hit) this.fx.dust.explode(5, center(to.x), center(to.y)); },
    });
  }

  explosion(x, y) {
    const c = this.add.circle(center(x), center(y), 2, 0xf08c3a, 0.8).setDepth(D.fx);
    this.tweens.add({ targets: c, radius: TILE * 2.6, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => c.destroy() });
    this.fx.fire.explode(50, center(x), center(y));
    this.cameras.main.shake(200, 0.01);
  }

  // ---------- per-frame overlay ----------
  update(time) {
    const run = this.run, g = this.overlay;
    g.clear(); this.teleGfx.clear(); this.pathGfx.clear();
    if (!run) return;

    // boss slam warning
    const pulse = 0.35 + 0.25 * Math.sin(time / 110);
    this.teleGfx.fillStyle(0xff4646, pulse);
    for (const t of run.telegraph) this.teleGfx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);

    // auto-walk path
    this.pathGfx.fillStyle(0x8fd36a, 0.55);
    for (const [x, y] of this.path) this.pathGfx.fillRect(x * TILE + 3, y * TILE + 3, 2, 2);

    for (const e of run.enemies) {
      const s = this.enemySprites[e.id];
      if (!s || e.hp <= 0 || !s.visible) continue;
      if (s.crown) s.crown.setPosition(s.x + TILE / 2, s.y + 1);
      // hp bar
      const w = TILE - 2, top = s.y - 2;
      g.fillStyle(0x000000, 0.8); g.fillRect(s.x + 1, top, w, 1.5);
      g.fillStyle(e.d.boss ? 0xf4cf4f : 0xe0525a, 1); g.fillRect(s.x + 1, top, w * Math.max(0, e.hp) / e.maxHp, 1.5);
      // aim line and target box
      if (e.aim && e.aimAt) {
        const a = 0.45 + 0.4 * Math.sin(time / 80);
        g.lineStyle(0.75, 0xff5a5a, a);
        g.lineBetween(center(e.x), center(e.y), center(e.aimAt.x), center(e.aimAt.y));
        g.strokeRect(e.aimAt.x * TILE + 0.5, e.aimAt.y * TILE + 0.5, TILE - 1, TILE - 1);
      }
      // "!" = will hit you on its next turn
      if (cheb(e, run.p) === 1 && !e.aim && !e.slam && !(e.d.slow && !e.skip)) {
        const bob = Math.sin(time / 120) > 0 ? 0 : 0.5;
        g.fillStyle(0xff5050, 1);
        g.fillRect(s.x + TILE - 1.5, s.y - 4 + bob, 1, 2.5);
        g.fillRect(s.x + TILE - 1.5, s.y - 1 + bob, 1, 1);
      }
    }
  }
}
