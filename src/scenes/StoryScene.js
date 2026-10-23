// Picture-book scenes: the opening, each 탐험 license, the ending. Every panel is a little diorama
// built from the game's own tiles, houses and sprites (scenes/storyboards.js), with a line or two of
// text under it (ui/story.js). A tap moves on; the text box and the skip button are DOM.

/* global Phaser */
import { pixDisc, pixEllipse } from './pix.js';
import { TILE, wallKey, floorKey, texScale, S } from './textures.js';
import { houseCanvas, lampPostCanvas } from './village-art.js';
import { faceKey } from '../data/faces.js';

const D = { sky: 0, ground: 1, back: 2, house: 3, actors: 4, fx: 5, bubble: 6 };
// the diorama: the tiles that always fit on screen (rows from `top`, so house roofs show); more ground
// and sky are drawn around it
export const VIEW = { w: 8, h: 7, top: -2 };
const SKY = { day: 0x9fd8f0, dusk: 0xf2a477, night: 0x1d2350, cave: 0x0f0e14 };

export class StoryScene extends Phaser.Scene {
  constructor() { super({ key: 'story' }); }

  create() {
    this.cameras.main.setRoundPixels(true);
    this.objs = [];
    this.spark = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 350, max: 750 }, speed: { min: 20, max: 70 }, scale: { start: 1.5, end: 0 },
      gravityY: 50, tint: [0xf4cf4f, 0xffffff, 0xf29bb2],
    }).setDepth(D.fx);
    // the scene is stopped after each story: let go of the screen's resize then
    const onResize = () => this.fit();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
    this.fit();
  }

  get dpr() { return this.game.registry.get('dpr') || 1; }

  // the biggest whole-number zoom that shows the whole diorama above the text box
  fit() {
    const cam = this.cameras.main, box = this.game.registry.get('storyBox') || 0.3;
    if (!cam) return;
    let z = Math.floor(Math.min(cam.width / (VIEW.w * TILE), cam.height * (1 - box) / (VIEW.h * TILE)));
    cam.setZoom(Math.max(1, z));
    // the diorama stands on the text box; on a tall screen the extra room goes to the sky
    const z2 = cam.zoom, bottom = (VIEW.top + VIEW.h) * TILE + 6;
    cam.centerOn(VIEW.w * TILE / 2, bottom - cam.height * (1 - box) / z2 + cam.height / (2 * z2));
  }

  keep(o) { this.objs.push(o); return o; }

  // wipe the stage for the next panel
  clear() {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.bubbleList = [];
  }

  // ---------- the pieces a panel is built from ----------
  sky(kind) {
    this.cameras.main.setBackgroundColor(SKY[kind] ?? SKY.day);
    if (kind === 'night') {
      const g = this.keep(this.add.graphics().setDepth(D.sky));
      for (let k = 0; k < 160; k++) {
        const x = (k * 53 % 47) * 9 - 160, y = (k * 29 % 61) * 4 - 230;
        g.fillStyle(0xffffff, k % 3 ? 0.5 : 0.9).fillRect(x, y, 1, 1);
      }
      g.fillStyle(0xfff3b0, 1); pixDisc(g, VIEW.w * TILE - 12, -8, 7);
      g.fillStyle(SKY.night, 1); pixDisc(g, VIEW.w * TILE - 9, -10, 6);
    } else if (kind === 'day' || kind === 'dusk') {
      // a tall phone shows a lot of sky over the diorama: a sun and a few slow clouds fill it
      const g = this.keep(this.add.graphics().setDepth(D.sky));
      const sun = kind === 'day' ? 0xfff3b0 : 0xffd27a;
      g.fillStyle(sun, 0.35); pixDisc(g, VIEW.w * TILE - 22, -70, 14);
      g.fillStyle(sun, 1); pixDisc(g, VIEW.w * TILE - 22, -70, 10);
      const cloud = kind === 'day' ? 0xffffff : 0xffe2c4;
      [[8, -50, 1], [70, -110, 0.8], [-20, -170, 1.2], [90, -220, 0.9]].forEach(([x, y, s], i) => {
        const c = this.keep(this.add.graphics().setDepth(D.sky));
        c.fillStyle(cloud, 0.9).fillRect(-12, -3, 24, 6).fillRect(-7, -7, 10, 4).fillRect(0, -9, 9, 6).fillRect(-16, -1, 32, 4);
        c.setPosition(x, y).setScale(s);
        this.tweens.add({ targets: c, x: x + 14, duration: 6000 + i * 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      });
    }
  }

  // meadow (or forest, rock) ground from row y0 down, wider than the screen so nothing shows behind it
  ground(zi, y0, tint) {
    for (let y = y0; y < VIEW.h + 12; y++) for (let x = -14; x < VIEW.w + 14; x++) {
      const h = (x * 7 + y * 13 + 50) % 32;
      const im = this.keep(this.add.image(x * TILE, y * TILE, floorKey(zi, h)).setOrigin(0).setDepth(D.ground));
      if (tint) im.setTint(tint);
    }
  }

  // a row of bushes (or trees, or cliff) at row y, from x0 to x1; returns the images
  hedge(zi, x0, x1, y, tint) {
    const out = [];
    for (let x = x0; x <= x1; x++) {
      const im = this.keep(this.add.image(x * TILE + TILE / 2, y * TILE + TILE, wallKey(this, zi, S, (x * 5 + y) % 3)).setOrigin(0.5, 1).setDepth(D.back + y / 100));
      if (tint) im.setTint(tint);
      out.push(im);
    }
    return out;
  }

  house(spec, x, y, lived = true, tint) {
    const key = `story_house_${spec.id}_${lived ? 1 : 0}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, houseCanvas(spec, lived));
    const im = this.keep(this.add.image(x * TILE, (y + spec.h) * TILE, key).setOrigin(0, 1).setDepth(D.house));
    if (tint) im.setTint(tint);
    return im;
  }

  lamp(x, y) {
    if (!this.textures.exists('village_post')) this.textures.addCanvas('village_post', lampPostCanvas());
    this.keep(this.add.image(x * TILE + TILE / 2, (y + 1) * TILE, 'village_post').setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    const glow = this.keep(this.add.image(x * TILE + TILE / 2 - 1, (y + 1) * TILE - 14, 'glow').setDepth(D.fx).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7));
    this.tweens.add({ targets: glow, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  // someone (or something) standing with their feet at tile (x, y); x and y can be fractions
  actor(key, x, y, { flip = false, face, scale = 1 } = {}) {
    const k = face ? faceKey(key, face) : key;
    const im = this.keep(this.add.image(x * TILE + TILE / 2, (y + 1) * TILE, this.textures.exists(k) ? k : key).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    im.setScale(texScale(im) * scale).setFlipX(flip);
    im.base = key;
    return im;
  }

  face(im, face) {
    const k = face ? faceKey(im.base, face) : im.base;
    if (this.textures.exists(k)) im.setTexture(k);
  }

  // a little idle bounce, like the villagers breathing
  breathe(im, delay = 0) {
    const sy = im.scaleY;
    this.tweens.add({ targets: im, scaleY: sy * 0.94, duration: 520, yoyo: true, repeat: -1, delay, ease: 'Sine.inOut' });
  }

  hop(im, n = 1, h = 5) {
    const y = im.y;
    this.tweens.add({ targets: im, y: y - h, duration: 110, yoyo: true, repeat: n - 1, ease: 'Quad.out', onComplete: () => { im.y = y; } });
  }

  walk(im, toX, ms = 900, onDone) {
    const y = im.y;
    this.tweens.add({ targets: im, x: toX * TILE + TILE / 2, duration: ms, ease: 'Linear', onComplete: onDone });
    this.tweens.add({ targets: im, y: y - 2, duration: 110, yoyo: true, repeat: Math.max(0, Math.round(ms / 220) - 1) });
  }

  sparkle(x, y, n = 18) { this.spark.explode(n, x * TILE + TILE / 2, y * TILE + TILE / 2); }

  // a word bubble over someone: '!', '?', '♥', '…'
  mark(im, text, ms = 1400) {
    const z = this.cameras.main.zoom || 3, k = this.dpr / z;
    const b = this.keep(this.add.text(im.x, im.y - im.displayHeight - 2, text, {
      fontFamily: 'Galmuri11, sans-serif', fontSize: `${12 * k}px`, color: '#1b1424', backgroundColor: '#f4f0e8',
      padding: { x: 6 * k, y: 3 * k },
    }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(z));
    b.setScale(0.2);
    this.tweens.add({ targets: b, scale: 1, duration: 160, ease: 'Back.out' });
    if (ms) this.time.delayedCall(ms, () => this.tweens.add({ targets: b, alpha: 0, duration: 200 }));
    return b;
  }

  // a thought bubble holding an image (the dream house)
  dream(im, key) {
    const g = this.keep(this.add.graphics().setDepth(D.bubble));
    const cx = im.x + 22, cy = im.y - im.displayHeight - 20;
    const top = im.y - im.displayHeight;
    g.fillStyle(0x1b1424, 1); pixDisc(g, im.x + 6, top - 2, 2.5); pixDisc(g, im.x + 11, top - 7, 3.5); pixEllipse(g, cx, cy, 46, 34);
    g.fillStyle(0xf4f0e8, 1); pixDisc(g, im.x + 6, top - 2, 1.5); pixDisc(g, im.x + 11, top - 7, 2.5); pixEllipse(g, cx, cy, 44, 32);
    const pic = this.keep(this.add.image(cx, cy + 1, key).setDepth(D.bubble).setScale(0.42));
    for (const o of [g, pic]) { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 300 }); }
    return pic;
  }

  // a 탐험 license: a round badge on a ribbon, in the zone's colour
  badge(x, y, color, delay = 0) {
    const g = this.keep(this.add.graphics().setDepth(D.fx));
    // two ribbon tails stepping outwards, each notched at the end
    for (const sd of [-1, 1]) for (let t = 0; t < 13; t++) {
      const o = Math.floor(t / 4), x0 = sd < 0 ? -5 - o : 2 + o;
      g.fillStyle(0x1b1424, 1).fillRect(x0 - 1, 3 + t, 5, 1);
      if (t < 12) g.fillStyle(t === 11 ? 0xa83238 : 0xd9454a, 1).fillRect(x0, 3 + t, 3, 1);
    }
    g.fillStyle(0x1b1424, 1); pixDisc(g, 0, 0, 9.5);
    g.fillStyle(0xf4cf4f, 1); pixDisc(g, 0, 0, 8.5);
    g.fillStyle(0xc99a2b, 1); pixDisc(g, 0, 0, 6.5);
    g.fillStyle(color, 1); pixDisc(g, 0, 0, 5.5);
    // a star in the middle
    g.fillStyle(0xfff3b0, 1);
    ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'].forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') g.fillRect(i - 3, j - 3, 1, 1); }));
    g.setPosition(x * TILE + TILE / 2, y * TILE + TILE / 2).setScale(0);
    this.tweens.add({ targets: g, scale: 1, duration: 380, delay, ease: 'Back.out', onStart: () => this.sparkle(x, y, 14) });
    return g;
  }

  // gold coins popping out of a spot and landing around it
  coins(x, y, n = 6) {
    for (let k = 0; k < n; k++) {
      const c = this.keep(this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, 'gold').setDepth(D.fx).setScale(0.6));
      const tx = c.x + (k - n / 2) * 7 + (Math.random() * 4 - 2), ty = c.y + 6 + Math.random() * 6;
      this.tweens.add({
        targets: c, x: tx, duration: 420, delay: k * 50, ease: 'Linear',
        onUpdate: tw => { c.y = y * TILE + TILE / 2 + (ty - (y * TILE + TILE / 2)) * tw.progress - Math.sin(tw.progress * Math.PI) * 18; },
      });
    }
  }

  // the fields tossing in their sleep: bushes heave, a few shuffle over a tile and back
  toss(hedges) {
    hedges.forEach((im, i) => {
      this.tweens.add({ targets: im, scaleY: 1.12, duration: 260 + (i % 3) * 40, yoyo: true, repeat: 3, delay: i * 35, ease: 'Sine.inOut' });
      if (i % 3 === 1) this.tweens.add({ targets: im, x: im.x + (i % 2 ? TILE : -TILE), duration: 420, yoyo: true, hold: 500, delay: 200 + i * 30, ease: 'Quad.inOut' });
    });
  }
}
