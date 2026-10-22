// The village between runs, drawn with the meadow's tiles. You walk around it like in a run (tap a
// spot, or the arrow keys) and bump into people to talk to them; the signpost at the east end leads
// out to the fields. What each villager offers is DOM (ui/hub.js), opened through `hooks.onTalk`.

/* global Phaser */
import { TILE, wallKey, waterKey, shadeKey, floorKey, N, E, S, W_, NE, SE, SW, NW } from './textures.js';
import { houseCanvas, pathKey } from './village-art.js';
import { baseZoom } from './zoom.js';
import { faceKey } from '../data/faces.js';
import { VILLAGE_MAP, HOUSES, FOLK, doorOf, HERO_LINES } from '../data/village.js';
import { CHARACTERS } from '../data/characters.js';
import { ZONES } from '../data/enemies.js';

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
const MEADOW = { y0: 7, y1: 10 }; // where the heroes who stay home wander
const PAD = { x: 6, y: 8 };       // bushes drawn around the map

export class VillageScene extends Phaser.Scene {
  constructor(hooks) {
    super({ key: 'village' });
    this.hooks = hooks;
  }

  create(data) {
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor(ZONES[0].wallDark);
    this.spark = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 300, max: 650 }, speed: { min: 15, max: 60 }, scale: { start: 1.5, end: 0 },
      gravityY: 40, tint: [0xf4cf4f, 0xffffff, 0xf29bb2],
    }).setDepth(D.fx);
    this.smoke = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: 1600, speedY: { min: -14, max: -8 }, speedX: { min: -2, max: 5 },
      scale: { start: 2, end: 3.5 }, alpha: { start: 0.45, end: 0 }, tint: 0xd8d4e0,
    }).setDepth(D.fx);
    this.shadows = this.add.graphics().setDepth(D.actors - 0.5);
    this.objs = [];
    this.bubbles = [];

    // tap a spot to walk there, or a villager to go and talk; hover with a mouse to read who is who
    const tileOf = ptr => ({ x: Math.floor(ptr.worldX / TILE), y: Math.floor(ptr.worldY / TILE) });
    this.input.on('pointerup', ptr => {
      if (Math.hypot(ptr.upX - ptr.downX, ptr.upY - ptr.downY) > 12 * this.dpr) return;
      const t = tileOf(ptr);
      this.tap(t.x, t.y);
    });
    this.input.on('pointermove', ptr => {
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
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if ('#~'.includes(this.ch(x, y))) this.blocked[y * MW + x] = 1;
    // the hedge goes on past the edge, so a tall phone screen shows bushes around the village, not a void
    for (let y = -PAD.y; y < MH + PAD.y; y++) for (let x = -PAD.x; x < MW + PAD.x; x++) this.drawTile(x, y);
    // a house someone is just moving into still has its boards up until they arrive
    for (const h of HOUSES) {
      const f = FOLK[h.id], lived = f.when(meta), moving = lived && f.arrive && !meta.village.seen[h.id];
      h.img = this.keep(this.add.image(h.x * TILE, h.y * TILE, this.houseKey(h, lived && !moving)).setOrigin(0).setDepth(D.house));
      for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) this.blocked[y * MW + x] = 1;
      h.lived = lived;
    }
    // the villagers stand at their doors; ones who just moved in arrive with a little fanfare
    this.folk = [];
    const arrivals = [];
    for (const h of HOUSES) {
      const f = FOLK[h.id];
      if (!h.lived) continue;
      const at = doorOf(h), s = this.actor(f.sprite, at.x, at.y);
      const one = { id: h.id, f, x: at.x, y: at.y, s, house: h, greeted: false };
      this.folk.push(one);
      if (f.arrive && !meta.village.seen[h.id]) { arrivals.push(one); s.setAlpha(0); }
    }
    const start = from === 'run' ? { x: MW - 2, y: 6 } : { x: 4, y: 6 };
    this.p = { x: start.x, y: start.y, id: meta.sel };
    this.heroes = [];
    this.placeHeroes();
    this.ps = this.actor(CHARACTERS[meta.sel].sprite, start.x, start.y);
    this.ps.setFlipX(from === 'run');
    this.path = [];
    this.nextStep = 0;
    this.cameras.main.startFollow(this.ps, true, 0.2, 0.2, 0, TILE / 2);
    this.cameras.main.centerOn(center(start.x), foot(start.y) - TILE / 2);
    if (arrivals.length) this.welcome(arrivals);
  }

  // the heroes you have but did not pick today hang about in the meadow
  placeHeroes() {
    for (const id of Object.keys(CHARACTERS).filter(c => this.meta.chars[c] && c !== this.p.id)) {
      const spot = this.freeMeadowTile();
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
    this.objs.forEach(o => o.destroy());
    this.objs = [];
    this.bubbles.forEach(b => b.destroy());
    this.bubbles = [];
    this.waterImgs = [];
    this.pending = null;
  }

  keep(o) { this.objs.push(o); return o; }

  ch(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? '#' : VILLAGE_MAP[y][x]; }

  drawTile(x, y) {
    const ch = this.ch(x, y);
    const around = test => (test(x, y - 1) && N) | (test(x + 1, y) && E) | (test(x, y + 1) && S) | (test(x - 1, y) && W_) |
      (test(x + 1, y - 1) && NE) | (test(x + 1, y + 1) && SE) | (test(x - 1, y + 1) && SW) | (test(x - 1, y - 1) && NW);
    const add = (key, depth = D.tiles) => this.keep(this.add.image(x * TILE, y * TILE, key).setOrigin(0).setDepth(depth));
    const hedge = (nx, ny) => this.ch(nx, ny) === '#';
    if (ch === '#') {
      add(wallKey(this, 0, around((nx, ny) => !hedge(nx, ny)), hash(x + 99, y + 99) % 3));
      return;
    }
    if (ch === '~') {
      const img = add(waterKey(this, 0, 0, around((nx, ny) => this.ch(nx, ny) !== '~')));
      img.shore = around((nx, ny) => this.ch(nx, ny) !== '~');
      this.waterImgs.push(img);
      return;
    }
    const pathy = (nx, ny) => ':>'.includes(this.ch(nx, ny));
    if (pathy(x, y)) add(pathKey(this, around((nx, ny) => !pathy(nx, ny)) & (N | E | S | W_)));
    else add(ch === '*' ? `z0_floor${4 + (hash(x, y) % 3)}` : floorKey(0, hash(x, y) & 31)); // '*': daisies, pink flowers, buttercups
    const shade = around(hedge) & (N | E | W_ | NE | NW);
    if (shade) add(shadeKey(this, shade));
    if (ch === '>') add('t_stairs', D.deco);
  }

  actor(tex, x, y) {
    const s = this.keep(this.add.image(center(x), foot(y), tex).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    s.hop = 0;
    return s;
  }

  freeMeadowTile() {
    for (let tries = 0; tries < 60; tries++) {
      const x = 2 + Math.floor(Math.random() * (MW - 4)), y = MEADOW.y0 + Math.floor(Math.random() * (MEADOW.y1 - MEADOW.y0 + 1));
      if (this.walkable(x, y)) return { x, y };
    }
    return null;
  }

  // ---------- who is where ----------
  folkAt(x, y) { return this.folk.find(f => f.x === x && f.y === y); }
  heroAt(x, y) { return this.heroes.find(h => h.x === x && h.y === y); }
  houseAt(x, y) { return HOUSES.find(h => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h); }
  walkable(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH || this.blocked[y * MW + x]) return false;
    return !this.folkAt(x, y) && !this.heroAt(x, y) && !(this.p && this.p.x === x && this.p.y === y);
  }

  describe(x, y) {
    const who = this.folkAt(x, y) || (this.houseAt(x, y)?.lived && this.folk.find(f => f.id === this.houseAt(x, y).id));
    if (who) return `${who.f.name}: ${who.f.tip}`;
    if (this.houseAt(x, y)) return '빈 집: 아직 아무도 안 산다.';
    const hero = this.heroAt(x, y);
    if (hero) return `${CHARACTERS[hero.id].name}: 부딪히면 오늘은 이 친구가 나간다.`;
    if (this.ch(x, y) === '>') return '들판 가는 길: 여기로 가면 토벌을 나간다.';
    return '';
  }

  // ---------- moving ----------
  // a tap: walk to the spot; on a villager or a house, walk up to them and talk; on the sign, head out
  tap(x, y) {
    const house = this.houseAt(x, y);
    const target = this.folkAt(x, y) || (house?.lived && this.folk.find(f => f.id === house.id)) || this.heroAt(x, y);
    if (house && !house.lived) { this.hooks.onHover?.('빈 집: 아직 아무도 안 산다.', true); return; }
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
    const who = this.folkAt(x, y) || this.heroAt(x, y);
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
    if (Math.max(Math.abs(who.x - this.p.x), Math.abs(who.y - this.p.y)) === 1) return 0;
    let best = null;
    for (const [dx, dy] of DIRS) {
      const r = this.walkable(who.x + dx, who.y + dy) ? this.route(who.x + dx, who.y + dy) : [];
      if (r.length && (!best || r.length < best.length)) best = r;
    }
    return best;
  }

  moveTo(x, y) {
    const ps = this.ps;
    if (x !== this.p.x) ps.setFlipX(x < this.p.x);
    this.p.x = x; this.p.y = y;
    ps.stepFrame = ps.stepFrame === 1 ? 2 : 1;
    ps.stepUntil = this.time.now + STEP_MS + 60;
    this.tweens.add({ targets: ps, x: center(x), y: foot(y), duration: STEP_MS - 10 });
    ps.setDepth(D.actors + y / 100);
    this.hooks.onStep?.(ps.stepFrame === 1);
    if (this.ch(x, y) === '>') { this.path = []; this.time.delayedCall(STEP_MS, () => this.hooks.onLeave?.()); }
  }

  // bumping into someone: a villager talks, a hero takes your place for today
  meet(who) {
    this.path = [];
    this.pending = null;
    if (who.x !== this.p.x) this.ps.setFlipX(who.x < this.p.x);
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
      fontFamily: '"Do Hyeon", sans-serif', fontSize: `${14 * k}px`, color: '#1b1424', backgroundColor: '#f4f0e8',
      padding: { x: 7 * k, y: 4 * k }, align: 'center', wordWrap: { width: 190 * k, useAdvancedWrap: true },
    }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(z);
    b.target = target;
    b.until = this.time.now + ms;
    this.bubbles.push(b);
  }

  // ---------- every frame ----------
  update(time) {
    if (!this.ps) return;
    // walking: one tile at a time along the route; arriving next to whoever you were heading for, talk
    if (this.path.length && time >= this.nextStep) {
      const [x, y] = this.path.shift();
      if (this.walkable(x, y) && this.canCut(this.p.x, this.p.y, x - this.p.x, y - this.p.y)) this.moveTo(x, y);
      else this.path = [];
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
    const base = CHARACTERS[this.p.id].sprite, expr = time < (ps.exprUntil || 0) ? ps.expr : '';
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
    // the heroes at home amble about the meadow
    for (const h of this.heroes) {
      if (time < h.next || h === this.pending) continue;
      h.next = time + 1200 + Math.random() * 2600;
      const [dx, dy] = DIRS[Math.floor(Math.random() * 4)];
      const x = h.x + dx, y = h.y + dy;
      if (y < MEADOW.y0 || y > MEADOW.y1 || !this.walkable(x, y)) continue;
      h.x = x; h.y = y;
      if (dx) h.s.setFlipX(dx < 0);
      const sp = CHARACTERS[h.id].sprite;
      h.s.setTexture(`${sp}_walk1`);
      this.tweens.add({ targets: h.s, x: center(x), y: foot(y), duration: 260, onComplete: () => h.s.setTexture(sp) });
      h.s.setDepth(D.actors + y / 100);
    }
    // bobbing and shadows
    const g = this.shadows;
    g.clear();
    const all = [ps, ...this.folk.map(f => f.s), ...this.heroes.map(h => h.s)];
    all.forEach((s, i) => {
      const breathe = s === ps && walking ? 1 : 1 + 0.035 * Math.sin(time / 420 + i * 1.7);
      s.setScale(1, breathe).setOrigin(0.5, 1 + (s.hop || 0) / TILE);
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(s.x, s.y - 1.5, 11, 4);
    });
    // chimney smoke from the houses people live in, and the pond shimmering
    if (time > (this.nextSmoke || 0)) {
      this.nextSmoke = time + 450;
      for (const h of HOUSES) if (h.lived && h.chimney) this.smoke.explode(1, h.x * TILE + h.w * TILE - 10, h.y * TILE + 1);
    }
    const wf = Math.floor(time / 600) % 2;
    if (wf !== this.waterFrame) {
      this.waterFrame = wf;
      for (const img of this.waterImgs) img.setTexture(waterKey(this, 0, wf, img.shore));
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
