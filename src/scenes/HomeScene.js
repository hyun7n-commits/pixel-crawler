// Inside your house (data/home.js): walk about, bump the furniture to use it (sleep, sit, tea, a bath,
// the books, the music box), say hello to a friend who dropped in while you were out, and in 꾸미기
// put everything where you like it. Its own scene, woken when you go in at the door in the village
// (main.js showHome); walk out of the door to go back.

/* global Phaser */
import { TILE, texScale, dressKey } from './textures.js';
import { baseZoom } from './zoom.js';
import { pixEllipse } from './pix.js';
import { faceKey } from '../data/faces.js';
import { CHARACTERS } from '../data/characters.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { cleared } from '../data/stages.js';
import { setEmote, drawEmote } from './emotes.js';
import { roomOf, doorCell, furniture, placed, plantStage, VISIT_LINES, fits, taken, ownLayout, hasDecor } from '../data/home.js';
import { bookCount, BOOK_TOTAL } from '../data/book.js';
import { roomCanvas, roomSize, WALL_ROWS, furnitureCanvas, WALL_Y, plushCushion, FRAMES, roofCanvas, yardCanvas, roofAt, yardAt } from './home-interior-art.js';
import { pupCanvas } from './home-art.js';

const D = { room: 0, rug: 0.5, wall: 1, actors: 3, dim: 3.9, fx: 4, ghost: 4.5, bubble: 5 };
const STEP_MS = 140;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// floor cell (x, y) sits on tile (x + 1, y + WALL_ROWS): its middle across, and its foot
const mid = x => (x + 1) * TILE + TILE / 2;
const foot = y => (y + WALL_ROWS + 1) * TILE;
const key = (x, y) => `${x},${y}`;
const pick = list => list[Math.floor(Math.random() * list.length)];

// a little picture from rows of letters, one colour each (the leaping goldfish, the bunny's shadow)
function rowsCanvas(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}

export class HomeScene extends Phaser.Scene {
  constructor(hooks) {
    super({ key: 'home' });
    this.hooks = hooks;
  }

  create(data) {
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#1c1418');
    this.spark = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 300, max: 650 }, speed: { min: 15, max: 60 }, scale: { start: 1.5, end: 0 },
      gravityY: 40, tint: [0xf4cf4f, 0xffffff, 0xf29bb2],
    }).setDepth(D.fx);
    // steam off the teapot and the bath, smoke up the stove's pipe
    this.steam = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: 1300, speedY: { min: -12, max: -6 }, speedX: { min: -3, max: 3 },
      scale: { start: 1.5, end: 3 }, alpha: { start: 0.5, end: 0 }, tint: 0xf4f0f8,
    }).setDepth(D.fx);
    this.drops = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: 420, speedY: { min: 10, max: 40 }, speedX: { min: -12, max: 12 }, gravityY: 160,
      scale: { start: 1.2, end: 0.8 }, tint: [0x9fd4ff, 0x7cc0dc, 0xe6f7ff],
    }).setDepth(D.fx);
    this.foam = this.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 700, max: 1300 }, speedY: { min: -14, max: -4 }, speedX: { min: -8, max: 8 },
      scale: { start: 1.6, end: 0.4 }, alpha: { start: 0.9, end: 0 }, tint: [0xffffff, 0xe6f2ff, 0xc8ecf8],
    }).setDepth(D.fx);
    this.shadows = this.add.graphics().setDepth(D.actors - 0.5);
    this.marks = this.add.graphics().setDepth(D.bubble - 0.1);
    this.cursorG = this.add.graphics().setDepth(D.ghost - 0.1);
    this.objs = [];
    this.bubbles = [];

    // tap to walk, tap a piece of furniture to go and use it, tap the door to go out; in 꾸미기, tap
    // to pick a piece up and tap again to put it down. A mouse shows what is what (and where the
    // piece you are holding would go).
    const cellOf = ptr => ({ x: Math.floor(ptr.worldX / TILE) - 1, y: Math.floor(ptr.worldY / TILE) - WALL_ROWS });
    this.input.on('pointerdown', ptr => { this.down = { x: ptr.x, y: ptr.y }; });
    this.input.on('pointerup', ptr => {
      if (!this.down || Math.hypot(ptr.x - this.down.x, ptr.y - this.down.y) > 12 * this.dpr) return;
      this.down = null;
      const c = cellOf(ptr);
      this.tap(c.x, c.y);
    });
    this.input.on('pointermove', ptr => {
      if (ptr.wasTouch) return;
      const c = cellOf(ptr);
      if (this.editing) { this.cursor = c; this.drawGhost(); return; }
      this.hooks.onHover?.(this.describeAt(c.x, c.y));
    });
    this.input.on('gameout', () => this.hooks.onHover?.(''));
    this.scale.on('resize', () => this.fit());
    this.events.on('wake', (sys, d) => this.enter(d));
    this.enter(data);
  }

  get dpr() { return this.game.registry.get('dpr') || 1; }
  keep(o) { this.objs.push(o); return o; }

  // The whole room on the screen, at the biggest whole zoom that fits between the bar on top and the
  // buttons (and the tray, while arranging) at the bottom: `hooks.insets` measures them, in CSS pixels.
  // The roof and the lawn come into the middle too when there is room for them (a tall phone).
  fit() {
    const cam = this.cameras.main, z0 = baseZoom(this, TILE);
    if (!z0 || !this.room) return;
    const { tw, th } = roomSize(this.room), ins = this.hooks.insets?.() || { top: 56, bottom: 64 };
    const top = ins.top * this.dpr, bottom = ins.bottom * this.dpr, room = th * TILE;
    const z = Math.max(1, Math.min(z0, Math.floor(cam.width / (tw * TILE + 8)), Math.floor((cam.height - top - bottom) / (room + 4))));
    const y0 = this.roof ? this.roof.y - this.roof.height : 0, y1 = this.yard ? this.yard.y + this.yard.height : room;
    const mid = (y1 - y0) * z <= cam.height - top - bottom ? (y0 + y1) / 2 : room / 2;
    cam.setZoom(z);
    cam.centerOn(tw * TILE / 2, mid + (bottom - top) / 2 / z);
  }

  // ---------- coming in ----------
  // `first`: the first time ever through the door
  enter({ meta, first }) {
    this.clear();
    this.meta = meta;
    this.room = roomOf(meta);
    this.door = doorCell(this.room);
    // the room, the roof over it and the lawn in front, as the house looks from the village
    const tex = (k, make) => { if (!this.textures.exists(k)) this.textures.addCanvas(k, make(this.room)); return k; };
    this.keep(this.add.image(0, 0, tex(`home_room_${this.room.w}`, roomCanvas)).setOrigin(0, 0).setDepth(D.room));
    const ra = roofAt(this.room), ya = yardAt(this.room);
    this.roof = this.keep(this.add.image(ra.x, ra.bottom, tex(`home_roof_${this.room.w}`, roofCanvas)).setOrigin(0, 1).setDepth(D.room + 0.1));
    this.yard = this.keep(this.add.image(ya.x, ya.top, tex(`home_yard_${this.room.w}`, yardCanvas)).setOrigin(0, 0).setDepth(D.room - 0.1));
    // a dark veil over the room (walls and all) for when the lamp is out or you are asleep
    const { tw, th } = roomSize(this.room);
    this.dim = this.keep(this.add.graphics().setDepth(D.dim).setAlpha(0));
    this.dim.fillStyle(0x10081c, 1).fillRect(TILE - 6, 0, (tw - 2) * TILE + 12, (th - 1) * TILE + 7);
    this.items = [];
    for (const [id, [x, y]] of Object.entries(placed(meta))) this.addItem(id, x, y);
    this.reindex();
    this.dim.setAlpha(this.isDark() ? 0.35 : 0);
    this.p = { x: this.door.x, y: this.door.y, id: meta.sel };
    this.ps = this.actor(CHARACTERS[meta.sel].sprite, this.p.x, this.p.y);
    this.ps.nextBlink = 0;
    this.path = [];
    this.pending = null;
    this.nextStep = 0;
    this.placeVisitor();
    this.placePup();
    this.fit();
    // a word the first time in, and when someone is waiting
    if (this.visitor) this.time.delayedCall(500, () => this.say(this.visitor.s, `왔어? ${CHARACTERS[this.p.id].name}!`, 1800));
    else if (first) this.time.delayedCall(400, () => this.say(this.ps, '여기가 내 집…!', 1800));
  }

  // the lamp switched off (only while there is a lamp in the room to switch on again)
  isDark() { return !!this.meta.house.dark && this.items.some(it => it.id === 'lamp'); }

  clear() {
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.objs.forEach(o => o.destroy());
    this.objs = [];
    this.bubbles.forEach(b => b.destroy());
    this.bubbles = [];
    this.items = [];
    this.editing = false;
    this.held = null;
    this.busy = null;
    this.sitting = null;
    this.visitor = null;
    this.pup = null;
    this.cursorG?.clear();
    this.ghost = null;
  }

  actor(tex, x, y) {
    const s = this.keep(this.add.image(mid(x), foot(y), tex).setOrigin(0.5, 1).setDepth(D.actors + y / 100));
    s.hop = 0;
    return s;
  }

  // ---------- the furniture ----------
  furnKey(id, v = 0) {
    const k = `home_f_${id}_${v}`;
    if (!this.textures.exists(k)) this.textures.addCanvas(k, furnitureCanvas(id, v));
    return k;
  }
  // which picture a piece shows now: the plant's growth, the lamp on or off, the stars on the map
  look(id) {
    if (id === 'plant') return plantStage(this.meta);
    if (id === 'lamp') return this.meta.house.dark ? 0 : 1;
    if (id === 'map') return ZONES.filter((_, s) => cleared(this.meta, s) > 0).length;
    // the 비밀 상자 fills up: keepsakes stick out from under its lid
    if (id === 'secretbox') { const n = bookCount(this.meta); return n >= 300 ? 3 : n >= 60 ? 2 : n >= 10 ? 1 : 0; }
    return 0;
  }
  addItem(id, x, y) {
    const f = furniture(id);
    if (!f) return null;
    const it = { id, f, x, y, imgs: [] };
    if (f.wall) {
      it.img = this.add.image((x + 1) * TILE + f.w * TILE / 2, WALL_Y[id] ?? 6, this.furnKey(id, this.look(id))).setOrigin(0.5, 0).setDepth(D.wall);
      it.imgs.push(it.img);
    } else if (f.plush) {
      // the boss's own picture, small and soft, on a pink cushion
      if (!this.textures.exists('home_cushion')) this.textures.addCanvas('home_cushion', plushCushion());
      const cx = mid(x), fy = foot(y);
      const cush = this.add.image(cx, fy, 'home_cushion').setOrigin(0.5, 1).setDepth(D.actors + y / 100 - 0.002);
      const tex = ENEMIES[f.plush].sprite;
      it.img = this.add.image(cx, fy - 2, this.textures.exists(tex) ? tex : 'px').setOrigin(0.5, 1).setDepth(D.actors + y / 100 - 0.001);
      it.img.setScale(texScale(it.img) * 0.85);
      it.imgs.push(cush, it.img);
    } else {
      const k = this.furnKey(id, this.look(id));
      it.img = this.add.image((x + 1) * TILE + f.w * TILE / 2, foot(y + f.h - 1), k).setOrigin(0.5, 1)
        .setDepth(f.rug ? D.rug : D.actors + (y + f.h - 1) / 100 - 0.001);
      it.imgs.push(it.img);
      // the lamp and the stove glow
      if (id === 'lamp' || id === 'stove') {
        it.glow = this.add.image(it.img.x, it.img.y - (id === 'lamp' ? 22 : 9), 'glow').setDepth(D.dim + 0.05).setBlendMode(Phaser.BlendModes.ADD)
          .setTint(id === 'lamp' ? 0xffd890 : 0xff9a50).setAlpha(id === 'lamp' && this.meta.house.dark ? 0 : 0.55).setScale(id === 'lamp' ? 1.6 : 1.2);
        it.imgs.push(it.glow);
      }
    }
    it.imgs.forEach(o => this.keep(o));
    this.items.push(it);
    return it;
  }
  removeItem(it) {
    it.imgs.forEach(o => o.destroy());
    this.objs = this.objs.filter(o => !it.imgs.includes(o));
    this.items = this.items.filter(o => o !== it);
  }
  // which cells the furniture stands on (rugs you walk over)
  reindex() {
    this.occ = new Map();
    for (const it of this.items) {
      if (it.f.wall || it.f.rug) continue;
      for (let j = 0; j < it.f.h; j++) for (let i = 0; i < it.f.w; i++) this.occ.set(key(it.x + i, it.y + j), it);
    }
  }
  itemAt(x, y) {
    if (y < 0) return this.items.find(it => it.f.wall && x >= it.x && x < it.x + it.f.w) || null;
    return this.occ.get(key(x, y)) || this.items.find(it => it.f.rug && x >= it.x && x < it.x + it.f.w && y >= it.y && y < it.y + it.f.h) || null;
  }

  // ---------- who else is here ----------
  // a friend who dropped in sits on the sofa (or the stool, or by the table)
  placeVisitor() {
    const v = this.meta.house.visit, ch = v && CHARACTERS[v.id];
    if (!ch || !this.meta.chars[v.id] || v.id === this.p.id) return;
    const seat = this.items.find(it => it.id === 'sofa') || this.items.find(it => it.id === 'stool') || this.items.find(it => it.id === 'table');
    if (!seat) return;
    const s = this.keep(this.add.image(0, 0, ch.sprite).setOrigin(0.5, 1));
    s.hop = 0;
    this.visitor = { ...v, s, seat };
    seat.visitor = this.visitor;
    this.seatOn(s, seat, seat.id === 'sofa' ? 0.5 : 0);
  }
  // the puppy naps on its cushion, when you have the dog house
  placePup() {
    const bed = this.items.find(it => it.id === 'petbed');
    if (!bed || !hasDecor(this.meta, 'dog')) return;
    if (!this.textures.exists('home_pup')) this.textures.addCanvas('home_pup', pupCanvas());
    const s = this.keep(this.add.image(mid(bed.x), foot(bed.y) - 3, 'home_pup').setOrigin(0.5, 1).setDepth(D.actors + bed.y / 100 + 0.001));
    s.setScale(TILE * 0.72 / s.height);
    s.hop = 0;
    this.pup = { s, bed, next: 0 };
    bed.pup = this.pup;
  }
  // put someone on a seat (`k`: how far along a long one)
  seatOn(s, seat, k = 0) {
    const x = (seat.x + 1) * TILE + (seat.f.w - 1) * TILE * k + TILE / 2;
    s.setPosition(x, foot(seat.y) - (seat.id === 'table' ? -1 : 4)).setDepth(D.actors + seat.y / 100 + 0.002);
  }

  // ---------- what is what ----------
  describe(it) {
    if (it.visitor) return `${CHARACTERS[it.visitor.id].name}: 놀러 왔다. 부딪히면 이야기한다.`;
    if (it.pup) return '강아지: 방석에서 새근새근 자고 있다.';
    const f = it.f;
    if (it.id === 'plant') return `${f.name}: ${['싹이 텄다', '잎이 났다', '꽃봉오리가 맺혔다', '꽃이 활짝 폈다'][plantStage(this.meta)]} · 탐험을 다녀올 때마다 자란다`;
    if (it.id === 'map') return `${f.name}: 가 본 들판 ${this.look('map')}곳에 별이 붙어 있다`;
    if (it.id === 'secretbox') return `${f.name}: 비밀 도감 ${bookCount(this.meta)}/${BOOK_TOTAL} · 부딪히면 열어 본다`;
    return `${f.name}: ${f.desc}`;
  }
  describeAt(x, y) {
    if (this.editing) return '';
    if (y >= this.room.h || (x === this.door.x && y === this.door.y)) return x === this.door.x ? '문: 나가면 마을이다.' : '';
    const it = this.itemAt(x, y);
    return it ? this.describe(it) : '';
  }

  // ---------- moving ----------
  inRoom(x, y) { return x >= 0 && y >= 0 && x < this.room.w && y < this.room.h; }
  walkable(x, y) { return this.inRoom(x, y) && !this.occ.has(key(x, y)); }
  canCut(x, y, dx, dy) { return !dx || !dy || this.walkable(x + dx, y) || this.walkable(x, y + dy); }

  tap(x, y) {
    if (this.busy) { this.wakeUp(); return; }
    if (this.editing) { this.editTap(x, y); return; }
    if (this.sitting) this.standUp();
    // the door (or below it): go out
    if (x === this.door.x && y >= this.door.y) {
      if (this.p.x === this.door.x && this.p.y === this.door.y) { this.goOut(); return; }
      this.path = this.route(this.door.x, this.door.y);
      this.pending = 'door';
      return;
    }
    const it = this.itemAt(x, y);
    if (it && (it.f.wall || it.f.rug)) {
      if (!it.f.rug || !this.walkable(x, y)) { this.hooks.onHover?.(this.describe(it), true); return; }
    } else if (it) {
      const near = this.near(it);
      if (near === 0) this.meet(it);
      else if (near) { this.path = near; this.pending = it; }
      else this.hooks.onHover?.('다른 가구에 막혀서 갈 수가 없다. 꾸미기에서 길을 터 주자.', true);
      return;
    }
    if (!this.walkable(x, y) || (x === this.p.x && y === this.p.y)) return;
    this.path = this.route(x, y);
    this.pending = null;
  }

  // keyboard: a step, or bump what is there; down out of the door goes out
  step(dx, dy) {
    if (this.busy) { this.wakeUp(); return; }
    if (this.editing) { this.moveCursor(dx, dy); return; }
    if (this.time.now < this.nextStep) return;
    this.nextStep = this.time.now + STEP_MS;
    if (this.sitting) { this.standUp(); return; }
    const x = this.p.x + dx, y = this.p.y + dy;
    this.path = [];
    if (this.p.x === this.door.x && this.p.y === this.door.y && dy > 0 && !dx) { this.goOut(); return; }
    const it = this.inRoom(x, y) && this.occ.get(key(x, y));
    if (it) { this.meet(it); return; }
    if (this.walkable(x, y) && this.canCut(this.p.x, this.p.y, dx, dy)) this.moveTo(x, y);
  }

  route(tx, ty) {
    const W = this.room.w, prev = new Map(), start = this.p.y * W + this.p.x, goal = ty * W + tx;
    const q = [start];
    prev.set(start, -1);
    while (q.length) {
      const i = q.shift();
      if (i === goal) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (prev.has(j) || !this.walkable(nx, ny) || !this.canCut(x, y, dx, dy)) continue;
        prev.set(j, i);
        q.push(j);
      }
    }
    if (!prev.has(goal)) return [];
    const out = [];
    for (let i = goal; i !== start; i = prev.get(i)) out.unshift([i % W, (i / W) | 0]);
    return out;
  }
  // the shortest walk to a cell beside a piece (0: already there, null: no way)
  near(it) {
    const cells = [];
    for (let j = -1; j <= it.f.h; j++) for (let i = -1; i <= it.f.w; i++) {
      const x = it.x + i, y = it.y + j;
      if (i >= 0 && i < it.f.w && j >= 0 && j < it.f.h) continue;
      cells.push([x, y]);
    }
    if (cells.some(([x, y]) => x === this.p.x && y === this.p.y)) return 0;
    let best = null;
    for (const [x, y] of cells) {
      if (!this.walkable(x, y)) continue;
      const r = this.route(x, y);
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
    this.tweens.add({ targets: ps, x: mid(x), y: foot(y), duration: STEP_MS - 10 });
    ps.setDepth(D.actors + y / 100);
    this.hooks.onStep?.(ps.stepFrame === 1);
  }
  goOut() {
    this.path = [];
    this.busy = 'out';
    this.tweens.add({ targets: this.ps, y: this.ps.y + 10, alpha: 0, duration: 220, ease: 'Quad.in', onComplete: () => this.hooks.onExit?.() });
  }

  // ---------- using things ----------
  meet(it) {
    this.path = [];
    this.pending = null;
    const f = it.f, c = it.x + (f.w - 1) / 2;
    if (c !== this.p.x) this.ps.setFlipX(c < this.p.x);
    if (it.visitor) { this.talkVisitor(); return; }
    const top = { x: it.img.x, y: it.img.y - it.img.displayHeight };
    switch (f.act) {
      case 'sleep': this.sleep(it); break;
      case 'sit': this.sit(it); break;
      case 'tea':
        this.steam.explode(6, it.img.x - 2, top.y + 2);
        this.happy(pick(['후~ 따뜻하다.', '차 한 잔의 여유.', '꿀을 넣어서 달다!']));
        this.hooks.onSound?.('pop');
        break;
      case 'water':
        this.drops.explode(14, it.img.x, top.y + 2);
        this.squash(it.img);
        this.happy(pick(['쑥쑥 자라라!', '물 듬뿍!', '탐험 다녀오면 더 크겠지?']));
        this.hooks.onSound?.('water');
        break;
      case 'lamp': {
        const dark = this.meta.house.dark = !this.meta.house.dark;
        it.img.setTexture(this.furnKey('lamp', dark ? 0 : 1));
        this.tweens.add({ targets: it.glow, alpha: dark ? 0 : 0.55, duration: 200 });
        this.tweens.add({ targets: this.dim, alpha: dark ? 0.35 : 0, duration: 260 });
        this.hooks.onSound?.('pluck');
        this.hooks.onChange?.();
        // 비밀 (v0.29): off and on and off again, six times quick, and a bunny's shadow hops along the
        // wall, though your hands are still
        this.flicks = this.time.now - (this.flickAt || 0) < 1800 ? (this.flicks || 0) + 1 : 1;
        this.flickAt = this.time.now;
        if (this.flicks >= 6 && !dark) { this.flicks = 0; this.time.delayedCall(250, () => this.bunny(it)); }
        break;
      }
      case 'cook':
        this.hooks.onSound?.('sizzle');
        this.steam.explode(8, it.img.x - 0.5, top.y + 1);
        this.tweens.add({ targets: it.glow, alpha: 1, scale: 1.8, duration: 160, yoyo: true });
        this.time.delayedCall(450, () => this.happy(pick(['보글보글… 꿀물 도시락 완성!', '탐험 갈 때 챙겨 가야지.', '난로 앞은 따뜻하다.'])));
        break;
      case 'book': this.hooks.onBook?.(); break;
      case 'bath': this.bath(it); break;
      case 'peek':
        this.squash(it.img, 0.94);
        this.hooks.onSound?.('pop');
        // 비밀: go through every pocket (five rummages in a row) and something crinkles in the last one
        this.peeks = this.time.now - (this.peekAt || 0) < 4000 ? (this.peeks || 0) + 1 : 1;
        this.peekAt = this.time.now;
        if (this.peeks >= 5) {
          this.peeks = 0;
          if (this.hooks.onSecret?.('pocket')) {
            this.say(this.ps, '어? 주머니에서 꼬깃꼬깃한 골드가!', 2000);
            this.spark.explode(14, it.img.x, top.y + 10);
            this.hooks.onCoins?.(80);
            this.ps.expr = 'sparkle';
            this.ps.exprUntil = this.time.now + 1200;
          } else this.say(this.ps, '주머니를 다 뒤졌다. 이제 텅 비었다.', 1800);
          break;
        }
        this.say(this.ps, ['작업복, 작업복, 작업복…', '다 똑같은 옷이다.', '맨 안쪽에 반짝이는 옷이 있다. …언제 입지?', '주머니가 많기도 하다.'][(this.peeks - 1) % 4], 1800);
        break;
      case 'secrets':
        this.squash(it.img, 0.9);
        this.spark.explode(8, it.img.x, top.y + 4);
        this.hooks.onSecrets?.();
        break;
      case 'fish':
        this.foam.explode(5, it.img.x, top.y + 8);
        this.fishFast = this.time.now + 1500;
        this.hooks.onSound?.('pop');
        // 비밀 (v0.29): tap, tap, tap, and the goldfish leaps clean out and back in
        this.taps = this.time.now - (this.tapAt || 0) < 2000 ? (this.taps || 0) + 1 : 1;
        this.tapAt = this.time.now;
        if (this.taps >= 3) { this.taps = 0; this.leap(it, top); break; }
        this.say(it.img, '뻐끔뻐끔', 1200);
        break;
      case 'pet':
        if (it.pup) {
          this.tweens.add({ targets: it.pup.s, hop: 5, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.out' });
          setEmote(it.pup.s, '♥', this.time.now, 1200);
          this.hooks.onSound?.('bark');
          this.happy();
        } else this.say(this.ps, '강아지 집을 놓으면 강아지가 와서 잘 텐데.', 1800);
        break;
      case 'music': this.music(it); break;
      case 'squeak':
        this.squash(it.img, 0.7);
        this.say(it.img, '삑!', 900);
        this.hooks.onSound?.('squeak');
        break;
      default: this.hooks.onHover?.(this.describe(it), true);
    }
  }
  // a hop and a happy face, and maybe a word
  happy(line) {
    this.ps.expr = 'sparkle';
    this.ps.exprUntil = this.time.now + 1100;
    this.tweens.add({ targets: this.ps, hop: 4, duration: 110, yoyo: true, ease: 'Quad.out' });
    if (line) this.say(this.ps, line, 1600);
  }
  squash(img, k = 0.85) {
    const sx = img.scaleX, sy = img.scaleY;
    this.tweens.add({ targets: img, scaleY: sy * k, scaleX: sx * (2 - k), duration: 90, yoyo: true, ease: 'Quad.out', onComplete: () => img.setScale(sx, sy) });
  }

  // Into bed: you hop in under the quilt, the room goes dim, you dream of something you met out in
  // the fields, then wake up (by yourself, or at a tap) fresh as anything.
  sleep(it) {
    this.busy = 'sleep';
    const ps = this.ps, bed = it.img, x = bed.x, y = bed.y - bed.displayHeight + (it.id === 'cloudbed' ? 22 : 18);
    this.tweens.add({ targets: ps, x, y, duration: 260, ease: 'Quad.out' });
    this.tweens.add({ targets: ps, hop: 6, duration: 130, yoyo: true, ease: 'Quad.out' });
    ps.setDepth(bed.depth + 0.0005);
    this.time.delayedCall(260, () => {
      if (this.busy !== 'sleep') return;
      ps.setCrop(0, 0, ps.frame.width, ps.frame.height * 0.62);
      ps.sleeping = true;
      this.tweens.add({ targets: this.dim, alpha: 0.5, duration: 600 });
      this.hooks.onSound?.('snore');
    });
    // a dream: one of the critters you have met, in a thought bubble
    const met = Object.keys(this.meta.critters || {}).filter(t => ENEMIES[t] && this.textures.exists(ENEMIES[t].sprite));
    this.time.delayedCall(1400, () => {
      if (this.busy !== 'sleep' || !met.length) return;
      const t = pick(met), bx = x + 12, by = y - 22;
      const cloud = this.keep(this.add.ellipse(bx, by, 22, 18, 0xf4f0e8).setDepth(D.bubble - 0.2).setAlpha(0));
      const dots = [this.keep(this.add.circle(x + 4, y - 8, 1.5, 0xf4f0e8)), this.keep(this.add.circle(x + 7, y - 12, 2, 0xf4f0e8))].map(d => d.setDepth(D.bubble - 0.2).setAlpha(0));
      const who = this.keep(this.add.image(bx, by + 6, ENEMIES[t].sprite).setOrigin(0.5, 1).setDepth(D.bubble - 0.15).setAlpha(0));
      who.setScale(texScale(who) * 0.75);
      this.dream = [cloud, ...dots, who];
      this.tweens.add({ targets: this.dream, alpha: 1, duration: 300 });
    });
    this.time.delayedCall(4200, () => { if (this.busy === 'sleep') this.wakeUp(); });
  }
  wakeUp() {
    if (this.busy === 'out') return;
    const was = this.busy;
    this.busy = null;
    const ps = this.ps;
    ps.setCrop();
    ps.sleeping = false;
    this.dream?.forEach(o => o.destroy());
    this.dream = null;
    this.tweens.add({ targets: this.dim, alpha: this.isDark() ? 0.35 : 0, duration: 300 });
    this.tweens.add({ targets: ps, x: mid(this.p.x), y: foot(this.p.y), duration: 220, ease: 'Quad.out', onComplete: () => ps.setDepth(D.actors + this.p.y / 100) });
    this.tweens.add({ targets: ps, hop: 5, duration: 110, yoyo: true, ease: 'Quad.out' });
    // 비밀 (v0.29): the third nap in one stay, a hand under the pillow finds a crumpled note
    if (was === 'sleep' && (this.naps = (this.naps || 0) + 1) >= 3 && !this.noteFound) {
      this.noteFound = true;
      this.say(ps, '베개 밑에 쪽지가… "내일은 꼭 돌아올게."', 2600);
      ps.expr = 'shock';
      ps.exprUntil = this.time.now + 1400;
      this.hooks.onSound?.('letter');
      this.time.delayedCall(1200, () => this.hooks.onSecret?.('letter'));
      return;
    }
    if (was === 'sleep') this.happy(pick(['개운하다!', '잘 잤다~', '좋은 꿈 꿨다.']));
    if (was === 'bath') this.happy(pick(['뽀득뽀득!', '개운하다~', '들판 흙이 다 씻겼다.']));
  }
  // the goldfish leaps out of its tank in an arc and plops back in (비밀 'goldfish')
  leap(it, top) {
    const t = it.img, x0 = t.x - 3, y0 = top.y + 9;
    const f = this.keep(this.add.image(x0, y0, this.fishKey()).setDepth(D.fx));
    this.hooks.onSound?.('splash');
    this.foam.explode(8, x0, y0);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 640, ease: 'Linear',
      onUpdate: tw => { const u = tw.getValue(); f.setPosition(Math.round(x0 + 6 * u), Math.round(y0 - 20 * Math.sin(u * Math.PI))).setAngle(-60 + 120 * u); },
      onComplete: () => {
        f.destroy();
        this.foam.explode(10, x0 + 6, y0);
        this.hooks.onSound?.('splash');
        this.say(t, '뽀옥!', 1100);
        this.ps.expr = 'sparkle';
        this.ps.exprUntil = this.time.now + 1200;
        this.hooks.onSecret?.('goldfish');
      },
    });
  }
  // a bunny's shadow hops across the back wall by the lamp, and nobody made it (비밀 'shadow')
  bunny(it) {
    const y = it.img.y - it.img.displayHeight - 6, x0 = it.img.x - 26;
    const b = this.keep(this.add.image(x0, y, this.shadowKey()).setDepth(D.fx).setAlpha(0));
    this.tweens.add({ targets: b, alpha: 0.55, duration: 300 });
    for (let k = 0; k < 4; k++) this.tweens.add({ targets: b, y: y - 4, delay: 300 + k * 360, duration: 180, yoyo: true, ease: 'Quad.out' });
    this.tweens.add({ targets: b, x: x0 + 52, delay: 300, duration: 1440, ease: 'Linear' });
    this.tweens.add({ targets: b, alpha: 0, delay: 1800, duration: 300, onComplete: () => b.destroy() });
    this.time.delayedCall(900, () => {
      this.ps.expr = 'shock';
      this.ps.exprUntil = this.time.now + 1200;
    });
    this.time.delayedCall(2100, () => this.hooks.onSecret?.('shadow'));
  }
  fishKey() {
    if (!this.textures.exists('home_leapfish')) this.textures.addCanvas('home_leapfish', rowsCanvas([
      '.kkk..k.',
      'koookkok',
      'kowoooko',
      'koooookk',
      '.kkkk.k.',
    ], { k: '#1b1424', o: '#f08c3a', w: '#f4f0e8' }));
    return 'home_leapfish';
  }
  shadowKey() {
    if (!this.textures.exists('home_bunnyshadow')) this.textures.addCanvas('home_bunnyshadow', rowsCanvas([
      '.k...k..',
      '.k...k..',
      '.kk.kk..',
      '..kkk...',
      '.kkkkk..',
      'kkkkkkk.',
      'kkkkkkkk',
      '.kk..kk.',
    ], { k: '#000000' }));
    return 'home_bunnyshadow';
  }
  // into the tub: just your head above the bubbles for a moment
  bath(it) {
    this.busy = 'bath';
    const ps = this.ps, tub = it.img, x = tub.x, y = tub.y - tub.displayHeight + 12;
    this.tweens.add({ targets: ps, x, y, duration: 240, ease: 'Quad.out' });
    this.tweens.add({ targets: ps, hop: 7, duration: 120, yoyo: true, ease: 'Quad.out' });
    ps.setDepth(tub.depth - 0.0005);
    this.hooks.onSound?.('splash');
    this.time.delayedCall(240, () => {
      if (this.busy !== 'bath') return;
      ps.setCrop(0, 0, ps.frame.width, ps.frame.height * 0.6);
      ps.setDepth(tub.depth + 0.0005);
      this.foam.explode(12, x, y - 4);
    });
    this.bathFoam = this.time.addEvent({ delay: 380, repeat: 6, callback: () => { if (this.busy === 'bath') this.foam.explode(3, x + (Math.random() - 0.5) * 16, y - 6); } });
    this.time.delayedCall(3000, () => { if (this.busy === 'bath') this.wakeUp(); });
  }
  // up onto the stool or the sofa: a little rest, until you move again
  sit(it) {
    const seat = it;
    this.sitting = seat;
    this.tweens.add({ targets: this.ps, hop: 5, duration: 110, yoyo: true, ease: 'Quad.out' });
    const k = seat.f.w > 1 ? (this.p.x <= seat.x ? 0 : 1) : 0;
    if (seat.visitor && seat.f.w > 1) {
      // the friend shuffles along to make room
      this.seatOn(seat.visitor.s, seat, k ? 0 : 1);
    }
    this.seatOn(this.ps, seat, k);
    this.say(this.ps, pick(['후유~', '아이고, 다리야.', '여기 앉으면 졸리다.']), 1300);
  }
  standUp() {
    const seat = this.sitting;
    this.sitting = null;
    this.ps.setPosition(mid(this.p.x), foot(this.p.y)).setDepth(D.actors + this.p.y / 100);
    if (seat?.visitor) this.seatOn(seat.visitor.s, seat, 0.5);
  }
  // the music box plays the village's tune, and everyone in the room bobs along
  music(it) {
    this.hooks.onSound?.('tune');
    this.playing = this.time.now + 1700;
    for (const s of [this.ps, this.visitor?.s, this.pup?.s].filter(Boolean)) {
      setEmote(s, '♪', this.time.now, 1500);
      this.tweens.add({ targets: s, hop: 3, duration: 200, yoyo: true, repeat: 3, ease: 'Sine.inOut' });
    }
  }
  // the friend who dropped in: a word, and the present they brought (once)
  talkVisitor() {
    const v = this.visitor, house = this.meta.house;
    this.tweens.add({ targets: v.s, hop: 4, duration: 100, yoyo: true, ease: 'Quad.out' });
    if (house.visit?.gift > 0) {
      const n = house.visit.gift;
      house.visit.gift = 0;
      this.hooks.onGift?.(n);
      const b = this.say(v.s, VISIT_LINES[v.line % VISIT_LINES.length], 2600);
      this.time.delayedCall(700, () => {
        this.spark.explode(18, v.s.x, v.s.y - 12);
        const z = this.cameras.main.zoom || 3, k = this.dpr / z;
        // over the friend's words, not on them
        const y = b.active ? b.y - b.displayHeight - 2 : v.s.y - 20;
        const t = this.keep(this.add.text(v.s.x, y, `+${n}G`, {
          fontFamily: 'Galmuri14, sans-serif', fontSize: `${15 * k}px`, color: '#f4cf4f', stroke: '#1b1424', strokeThickness: 3 * k,
        }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(z));
        this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, delay: 500, duration: 800, ease: 'Quad.in' });
        this.happy();
      });
      return;
    }
    this.say(v.s, pick(['조금만 더 있다 갈게.', '여기 앉아 있으면 졸려.', '다음 탐험도 조심해!', '나도 내 오두막 꾸며야지.']), 1800);
    this.hooks.onSound?.('talk');
  }

  // ---------- 꾸미기 ----------
  // Arranging: tap a piece to pick it up (it follows the mouse, or shows where your finger lands),
  // tap a free spot to put it down, or put it away in the tray (main.js, ui/hub.js renderHomeTray).
  setEditing(on) {
    if (on === this.editing) return;
    if (this.busy) this.wakeUp();
    if (this.sitting) this.standUp();
    this.path = [];
    if (!on && this.held) this.putBack();
    this.editing = on;
    this.cursor = this.cursor || { x: this.p.x, y: this.p.y };
    this.cursorG.clear();
    this.drawGhost();
    this.hooks.onHover?.(on ? '가구를 눌러 들고, 빈 곳을 눌러 놓는다.' : '', on);
  }
  // take a piece out of the tray to put somewhere
  holdNew(id) {
    if (!this.editing) this.setEditing(true);
    if (this.held) this.putBack();
    const f = furniture(id);
    if (!f) return;
    this.held = { id, f, from: null, dx: 0, dy: 0 };
    this.cursor = f.wall ? { x: 0, y: -1 } : this.cursor;
    this.drawGhost();
    this.hooks.onHeld?.(this.held);
  }
  // `at`: the cell it was grabbed by, so it moves by that cell
  pickUp(it, at) {
    this.removeItem(it);
    this.reindex();
    // the friend on it moves over to another seat (or waits for one)
    if (it.visitor) { it.visitor.s.destroy(); this.visitor = null; this.placeVisitor(); }
    if (it.pup) { it.pup.s.destroy(); this.pup = null; }
    this.held = { id: it.id, f: it.f, from: [it.x, it.y], dx: at ? Math.max(0, at.x - it.x) : 0, dy: at && !it.f.wall ? Math.max(0, at.y - it.y) : 0 };
    delete ownLayout(this.meta)[it.id];
    this.dim.setAlpha(this.isDark() ? 0.35 : 0);
    this.hooks.onSound?.('pluck');
    this.drawGhost();
    this.hooks.onHeld?.(this.held);
    this.hooks.onChange?.();
  }
  // the piece in hand goes back where it came from (or into the tray)
  putBack() {
    const h = this.held;
    this.held = null;
    if (h?.from) this.drop(h.id, h.from[0], h.from[1], true);
    this.drawGhost();
    this.hooks.onHeld?.(null);
  }
  putAway() {
    if (!this.held) return;
    this.held = null;
    this.hooks.onSound?.('pop');
    this.drawGhost();
    this.hooks.onHeld?.(null);
    this.hooks.onChange?.();
  }
  drop(id, x, y, quiet) {
    ownLayout(this.meta)[id] = [x, y];
    const it = this.addItem(id, x, y);
    this.reindex();
    this.dim.setAlpha(this.isDark() ? 0.35 : 0);
    if (id === 'petbed') this.placePup();
    if (this.meta.house.visit && !this.visitor) this.placeVisitor();
    if (!quiet && it) {
      this.squash(it.img, 0.8);
      this.spark.explode(10, it.img.x, it.img.y - 6);
      this.hooks.onSound?.('pop');
    }
    this.hooks.onChange?.();
  }
  // where the held piece's corner goes for a cursor cell: wall pieces snap to the wall
  spotFor(c) {
    const f = this.held.f, x = c.x - (this.held.dx || 0), y = c.y - (this.held.dy || 0);
    if (f.wall) return { x: Math.max(0, Math.min(this.room.w - f.w, x)), y: -1 };
    return { x: Math.max(0, Math.min(this.room.w - f.w, x)), y: Math.max(0, Math.min(this.room.h - f.h, y)) };
  }
  canDrop(s) {
    const block = new Set([key(this.p.x, this.p.y)]);
    return fits(this.meta, this.held.id, s.x, s.y, this.held.f.rug ? null : block, taken(this.meta, this.held.id));
  }
  editTap(x, y) {
    this.cursor = { x, y };
    if (this.held) {
      const s = this.spotFor({ x, y });
      if (this.canDrop(s)) {
        const id = this.held.id;
        this.held = null;
        this.drop(id, s.x, s.y);
        this.hooks.onHeld?.(null);
      } else {
        this.hooks.onSound?.('pluck');
        this.hooks.onHover?.(this.held.f.wall ? '벽의 빈 곳에 건다. 창문 위는 안 된다.' : '여기엔 못 놓는다. 다른 가구나 문 앞, 내가 선 자리는 피한다.', true);
      }
      this.drawGhost();
      return;
    }
    const it = this.itemAt(x, y);
    if (it) this.pickUp(it, { x, y });
  }
  moveCursor(dx, dy) {
    const c = this.cursor || { x: this.p.x, y: this.p.y };
    this.cursor = { x: Math.max(0, Math.min(this.room.w - 1, c.x + dx)), y: Math.max(-1, Math.min(this.room.h - 1, c.y + dy)) };
    this.drawGhost();
  }
  confirmCursor() { if (this.cursor) this.editTap(this.cursor.x, this.cursor.y); }

  // the piece in hand, see-through at the spot under the cursor: green where it fits, red where not
  drawGhost() {
    const g = this.cursorG;
    g.clear();
    this.ghost?.destroy();
    this.ghost = null;
    if (!this.editing || !this.cursor) return;
    if (!this.held) {
      // what a tap would pick up
      const it = this.itemAt(this.cursor.x, this.cursor.y);
      if (it) {
        const b = it.img.getBounds();
        g.lineStyle(1, 0xf4cf4f, 1).strokeRect(Math.round(b.x) - 0.5, Math.round(b.y) - 0.5, Math.round(b.width) + 1, Math.round(b.height) + 1);
      } else if (this.inRoom(this.cursor.x, this.cursor.y)) {
        g.lineStyle(1, 0xf4f0e8, 0.5).strokeRect((this.cursor.x + 1) * TILE + 0.5, (this.cursor.y + WALL_ROWS) * TILE + 0.5, TILE - 1, TILE - 1);
      }
      return;
    }
    const f = this.held.f, s = this.spotFor(this.cursor), ok = this.canDrop(s);
    const x0 = (s.x + 1) * TILE, y0 = f.wall ? 0 : (s.y + WALL_ROWS) * TILE, w = f.w * TILE, h = f.wall ? WALL_ROWS * TILE - 10 : f.h * TILE;
    g.fillStyle(ok ? 0x7cc45a : 0xe0464a, 0.28).fillRect(x0, y0, w, h);
    g.lineStyle(1, ok ? 0xacdc86 : 0xff6b6b, 0.9).strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    const k = f.plush ? ENEMIES[f.plush].sprite : this.furnKey(this.held.id, this.look(this.held.id));
    const img = this.add.image(x0 + w / 2, f.wall ? WALL_Y[this.held.id] ?? 6 : y0 + h, this.textures.exists(k) ? k : 'px').setOrigin(0.5, f.wall ? 0 : 1).setDepth(D.ghost).setAlpha(ok ? 0.85 : 0.5);
    if (f.plush) img.setScale(texScale(img) * 0.85);
    if (!ok) img.setTint(0xff9a9a);
    this.ghost = img;
  }

  // ---------- bubbles ----------
  say(target, text, ms = 1700) {
    while (this.bubbles.length >= 3) this.bubbles.shift().destroy();
    const z = this.cameras.main.zoom || 3, k = this.dpr / z;
    const b = this.add.text(target.x, target.y - 18, text, {
      fontFamily: 'Galmuri11, sans-serif', fontSize: `${12 * k}px`, color: '#1b1424', backgroundColor: '#f4f0e8',
      padding: { x: 7 * k, y: 4 * k }, align: 'center', wordWrap: { width: 170 * k, useAdvancedWrap: true },
    }).setOrigin(0.5, 1).setDepth(D.bubble).setResolution(z);
    b.target = target;
    b.until = this.time.now + ms;
    this.bubbles.push(b);
    return b;
  }

  // ---------- every frame ----------
  update(time, delta) {
    if (!this.ps) return;
    // walking along the route; arriving beside what you were heading for, use it
    if (this.path.length && time >= this.nextStep && !this.busy) {
      const [x, y] = this.path.shift();
      if (this.walkable(x, y) && this.canCut(this.p.x, this.p.y, x - this.p.x, y - this.p.y)) this.moveTo(x, y);
      else this.path = [];
      this.nextStep = time + STEP_MS;
      if (!this.path.length && this.pending) {
        const what = this.pending;
        this.pending = null;
        this.time.delayedCall(STEP_MS, () => {
          if (what === 'door') { if (this.p.x === this.door.x && this.p.y === this.door.y) this.goOut(); return; }
          if (this.near(what) === 0) this.meet(what);
        });
      }
    }
    // your face: blinking, a happy look, eyes shut asleep
    const ps = this.ps, walking = time < (ps.stepUntil || 0), base = CHARACTERS[this.p.id].sprite;
    let expr = time < (ps.exprUntil || 0) ? ps.expr : '';
    if (time > (ps.nextBlink || 0)) { ps.blinkUntil = time + 130; ps.nextBlink = time + 2200 + Math.random() * 2600; }
    if (ps.sleeping || (!expr && !walking && time < ps.blinkUntil)) expr = 'blink';
    const fk = dressKey(this, faceKey(walking ? `${base}_walk${ps.stepFrame}` : base, expr), this.meta.wear);
    if (ps.texture.key !== fk && this.textures.exists(fk)) {
      const crop = ps.isCropped ? { w: ps._crop.width, h: ps._crop.height } : null;
      ps.setTexture(fk);
      if (crop) ps.setCrop(0, 0, crop.w, crop.h);
    }
    if (ps.sleeping && time > (this.nextZ || 0)) { this.nextZ = time + 900; setEmote(ps, 'z', time, 800); }
    if (this.pup && time > (this.nextPupZ || 0)) { this.nextPupZ = time + 2600; setEmote(this.pup.s, 'z', time, 900); }
    // the fish goes round its bowl, the fire flickers, the cuckoo comes out now and then
    const fast = time < (this.fishFast || 0) ? 3 : 1;
    for (const it of this.items) {
      const n = FRAMES[it.id];
      if (!n) continue;
      let v = 0;
      if (it.id === 'tank') v = Math.floor(time * fast / 420) % n;
      if (it.id === 'stove') v = 1 + Math.floor(time / 160) % 2;
      if (it.id === 'clock') v = time % 9000 < 900 ? 1 : 0;
      if (it.id === 'musicbox') v = time < (this.playing || 0) ? Math.floor(time / 250) % 2 : 0;
      const k = this.furnKey(it.id, v);
      if (it.img.texture.key !== k) it.img.setTexture(k);
      if (it.id === 'clock' && v && !it.cuckoo) { it.cuckoo = true; this.say(it.img, '뻐꾹!', 800); }
      if (it.id === 'clock' && !v) it.cuckoo = false;
      if (it.id === 'stove' && time > (it.puff || 0)) { it.puff = time + 700; this.steam.explode(1, it.img.x - 0.5, it.img.y - it.img.displayHeight + 1); }
      if (it.id === 'tub' && time > (it.puff || 0)) { it.puff = time + 900; this.steam.explode(1, it.img.x + (Math.random() - 0.5) * 18, it.img.y - it.img.displayHeight + 4); }
    }
    if (this.playing && time < this.playing && time > (this.nextNote || 0)) {
      this.nextNote = time + 380;
      const box = this.items.find(it => it.id === 'musicbox');
      if (box) { const s = { x: box.img.x + (Math.random() - 0.5) * 8, y: box.img.y - 14, emote: null }; setEmote(s, '♪', time, 700); (this.notes ||= []).push(s); }
    }
    // breathing, shadows, marks over heads
    const g = this.shadows;
    g.clear();
    const all = [ps, this.visitor?.s].filter(Boolean);
    all.forEach((s, i) => {
      const k = texScale(s), breathe = s === ps && walking ? 1 : 1 + 0.035 * Math.sin(time / 420 + i * 1.7);
      s.setScale(k, k * breathe).setOrigin(0.5, 1 + (s.hop || 0) / TILE);
    });
    // a shadow under you while you stand (not in bed, in the bath or on a seat)
    if (!ps.sleeping && this.busy !== 'bath' && !this.sitting) {
      g.fillStyle(0x000000, 0.25);
      pixEllipse(g, ps.x, ps.y - 1.5, 11, 4);
    }
    if (this.pup) { const s = this.pup.s, k = TILE * 0.72 / s.frame.height; s.setScale(k, k * (1 + 0.04 * Math.sin(time / 600))).setOrigin(0.5, 1 + (s.hop || 0) / (s.frame.height * k)); }
    const mk = this.marks;
    mk.clear();
    for (const s of all) drawEmote(mk, s, s.x, s.y - TILE - (s.hop || 0) - 3, time);
    if (this.pup) drawEmote(mk, this.pup.s, this.pup.s.x + 3, this.pup.s.y - this.pup.s.displayHeight - (this.pup.s.hop || 0) - 1, time);
    this.notes = (this.notes || []).filter(n => time < n.emote.until);
    for (const n of this.notes) drawEmote(mk, n, n.x, n.y, time);
    this.bubbles = this.bubbles.filter(b => {
      if (time > b.until || !b.target.active) { b.destroy(); return false; }
      // over a head, over the top of a piece of furniture (wall pieces hang from their top)
      const t = b.target, top = t === ps || t === this.visitor?.s ? t.y - TILE - 3 - (t.hop || 0) : t.originY === 0 ? t.y - 2 : t.y - t.displayHeight - 2;
      b.setPosition(Math.round(t.x), Math.round(top));
      b.setAlpha(b.until - time < 250 ? (b.until - time) / 250 : 1);
      return true;
    });
  }
}
