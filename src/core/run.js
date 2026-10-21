// One trip into the dungeon. Holds all run state and the turn rules.
// It never touches the screen: it emits events that the scene and HUD listen to.
// Enemy behaviour lives in ai.js, fire/gas/explosions in world.js.

import * as B from '../data/balance.js';
import { RELICS, EVOLUTIONS, MAX_LEVEL, MAX_SLOTS } from '../data/relics.js';
import { CHARACTERS } from '../data/characters.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { T, DISCOVERIES, GOSSIP, SLEEP_TALK, FLOOR_HINTS } from '../data/terrain.js';
import { rnd, rint, pick, shuffle, cheb, josa, DIRS8 } from './util.js';
import {
  createMap, carveRooms, carveArena, idx, inMap, passable, distMap, lineOfSight, computeFOV, diagBlocked,
  FLOOR, STAIRS, ORE,
} from './dungeon.js';
import { decorate, decorateArena } from './decorate.js';
import { enemyAct, rouse } from './ai.js';
import { onEnter, explosion, envTick, waterBody, ignite, addGas } from './world.js';

export const zoneOf = floor => ZONES[Math.floor((floor - 1) / B.FLOORS_PER_ZONE)];
export const isBossFloor = floor => floor % B.FLOORS_PER_ZONE === 0;
export const BOMB_RANGE = 5;

export class Run {
  constructor(meta, charId) {
    this.meta = meta;
    this.charId = charId;
    this.char = CHARACTERS[charId];
    this.floor = 1;
    this.turn = 0;
    this.gold = 0;
    this.kills = 0;
    this.rerolls = meta.up.reroll;
    this.queue = [];        // pending choices: { kind: 'level' | 'chest' }
    this.over = false;
    this.victory = false;
    this.cause = '';        // what knocked you out, for the summary
    this.found = [];        // discoveries made this run
    this.told = {};         // one-time hints already shown
    this.startStats = JSON.parse(JSON.stringify(meta.stats));
    this.listeners = [];
    this.p = {
      x: 0, y: 0, hp: 0, lvl: 1, xp: 0, face: 1,
      burn: 0, sleep: 0, stun: 0, wokeAt: -1,
      relics: { ...this.char.start },
      items: { potion: meta.up.pot, bomb: 1, map: 0 },
    };
    this.p.hp = this.stat().maxHp;
    meta.stats.runs++;
    meta.stats.maxFloor = Math.max(meta.stats.maxFloor, 1);
  }

  // ---------- events ----------
  on(fn) { this.listeners.push(fn); }
  emit(type, data = {}) { for (const fn of this.listeners) fn(type, data); }
  log(text, cls) { this.emit('log', { text, cls }); }
  say(who, text) { this.emit('say', { who, text }); }

  // ---------- derived stats ----------
  stat() {
    const rl = this.p.relics, ch = this.char, up = this.meta.up;
    const lv = id => rl[id] || 0;
    return {
      atk: ch.atk + up.atk + 2 * lv('blade') + (rl.flamesword ? 8 : 0),
      def: ch.def + lv('shield') + (rl.fortress ? 5 : 0),
      maxHp: ch.hp + up.hp * 4 + 8 * lv('heart') + (rl.bloodcrown ? 30 : 0) + (this.p.lvl - 1) * B.HP_PER_LEVEL,
      goldMult: 1 + 0.4 * lv('coin') + (rl.goldbolt ? 1.5 : 0) + 0.1 * up.greed,
      dodge: ch.dodge || 0,
    };
  }
  // Runs fn; any gain in max HP also fills current HP by the same amount.
  withMaxHpDelta(fn) {
    const before = this.stat().maxHp;
    fn();
    const after = this.stat().maxHp;
    if (after > before) this.p.hp += after - before;
    this.p.hp = Math.min(this.p.hp, after);
  }

  // ---------- map helpers ----------
  passable(x, y) { return passable(this.map, x, y); }
  isVisible(x, y) { return inMap(x, y) && this.map.visible[idx(x, y)] === 1; }
  enemyAt(x, y) { return this.enemies.find(e => e.hp > 0 && e.x === x && e.y === y); }
  canEnemyEnter(x, y) {
    return this.passable(x, y) && !this.enemyAt(x, y) && !(x === this.p.x && y === this.p.y);
  }
  // next to each other and not split by a doorway corner
  touching(a, b) { return cheb(a, b) === 1 && !diagBlocked(this.map, a.x, a.y, b.x, b.y); }
  playerHidden() { return this.map.ter[idx(this.p.x, this.p.y)] === T.BRUSH; }
  randomFloorTile() {
    for (let t = 0; t < 100; t++) {
      const x = rnd(this.map.w), y = rnd(this.map.h);
      if (this.canEnemyEnter(x, y)) return { x, y };
    }
    return { x: this.p.x, y: this.p.y };
  }
  // true if this enemy will hit you on its next turn (shown as a claw mark on your tile)
  willHit(e) {
    return e.hp > 0 && e.state === 'hunt' && this.touching(e, this.p) && !e.aim && !e.slam && !e.stun &&
      !(e.d.slow && !e.skip);
  }
  get zone() { return zoneOf(this.floor); }

  // ---------- floors ----------
  start() {
    this.genFloor();
    this.log(`${josa(this.char.name, '으로', '로')} 광산에 들어왔다. 계단을 찾아 내려가자.`, 'good');
    this.emit('banner', { text: `1층 · ${this.zone.name}` });
    this.afterTurn();
  }

  genFloor() {
    this.map = createMap();
    this.enemies = [];
    this.pickups = [];
    this.telegraph = [];
    this.boss = null;
    this.has = new Set();
    this.gasActive = false;
    this.overheard = false; // at most one overheard line per floor
    if (isBossFloor(this.floor)) this.genBossFloor();
    else this.genNormalFloor();
    this.refreshDoors();
    computeFOV(this.map, this.p.x, this.p.y);
    this.emit('floor');
  }

  genNormalFloor() {
    const map = this.map, rooms = carveRooms(map), start = rooms[0];
    this.p.x = start.cx; this.p.y = start.cy;
    const dm = distMap(map, start.cx, start.cy);
    let far = rooms[1], best = -1;
    for (const r of rooms) {
      const d = dm[idx(r.cx, r.cy)];
      if (d > best && d < 9999) { best = d; far = r; }
    }
    map.tiles[idx(far.cx, far.cy)] = STAIRS;
    const zi = Math.floor((this.floor - 1) / B.FLOORS_PER_ZONE);
    const deco = decorate(map, rooms, { start: this.p, stairs: { x: far.cx, y: far.cy } });
    this.has = deco.has;

    // a free spot in a room other than the start; returns the spot and its room
    const free = () => {
      for (let t = 0; t < 300; t++) {
        const r = pick(rooms.slice(1));
        const x = rint(r.x, r.x + r.w - 1), y = rint(r.y, r.y + r.h - 1), i = idx(x, y);
        if (map.tiles[i] !== FLOOR || ![T.NONE, T.BRUSH, T.ASH].includes(map.ter[i])) continue;
        if (this.enemyAt(x, y) || this.pickups.some(q => q.x === x && q.y === y)) continue;
        if (Math.abs(x - this.p.x) + Math.abs(y - this.p.y) < 6) continue;
        return { x, y, theme: deco.themes[rooms.indexOf(r)] };
      }
      return null;
    };
    const place = (fn) => { const s = free(); if (s) fn(s); };
    const scale = B.enemyScale(this.floor);
    // enemies in a mushroom garden are fast asleep; elsewhere about half of them are
    for (let i = 0; i < B.enemiesPerFloor(this.floor); i++) {
      place(s => {
        const e = this.spawnEnemy(pick(this.zone.enemies), s.x, s.y, scale);
        e.state = s.theme === 'garden' || Math.random() < 0.5 ? 'sleep' : 'wander';
      });
    }
    for (let i = 0, n = rint(5, 7); i < n; i++) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'gold', amount: (zi + 1) * rint(3, 7) }));
    place(s => this.pickups.push({ x: s.x, y: s.y, type: 'chest' }));
    if (this.floor === 1) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'chest' }));
    if (Math.random() < 0.6) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'potion' }));
    if (Math.random() < 0.6) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'bomb' }));
    if (Math.random() < 0.3) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'map' }));
  }

  genBossFloor() {
    const spots = carveArena(this.map);
    this.p.x = spots.start.x; this.p.y = spots.start.y;
    decorateArena(this.map, spots.room, (x, y) => cheb({ x, y }, spots.start) <= 1 || cheb({ x, y }, spots.boss) <= 1);
    const type = this.zone.boss;
    const b = this.spawnEnemy(type, spots.boss.x, spots.boss.y, B.bossScale(this.floor));
    b.state = 'hunt';
    this.boss = b;
    this.log(`${josa(ENEMIES[type].name, '이', '가')} 나타났다! ${ENEMIES[type].tip}`, 'warn');
  }

  spawnEnemy(type, x, y, scale = 1) {
    const d = ENEMIES[type];
    const e = {
      id: Run.nextId++, type, d, x, y,
      hp: Math.round(d.hp * scale), maxHp: Math.round(d.hp * scale), atk: Math.round(d.atk * scale),
      def: d.def || 0, aim: false, aimAt: null, skip: false, slam: false, timer: 0, face: -1,
      state: d.boss ? 'hunt' : Math.random() < 0.65 ? 'sleep' : 'wander',
      wake: 0, doze: 0, last: null, target: null, searchT: 0,
      burn: 0, stun: 0,
    };
    this.enemies.push(e);
    this.emit('spawn', { enemy: e });
    return e;
  }

  descend() {
    this.floor++;
    this.meta.stats.maxFloor = Math.max(this.meta.stats.maxFloor, this.floor);
    this.p.burn = 0; this.p.sleep = 0;
    this.genFloor();
    this.emit('banner', { text: isBossFloor(this.floor) ? `${this.floor}층 · 보스` : `${this.floor}층 · ${this.zone.name}` });
    this.log(`${this.floor}층에 내려왔다.`);
    this.afterTurn();
  }

  // ---------- player actions (return true if a turn was spent) ----------
  canAct() { return !this.over && this.queue.length === 0 && !this.p.sleep && !this.p.stun; }

  // While asleep or stunned the turns pass on their own.
  passTurn() {
    if (this.over || this.queue.length || !(this.p.sleep || this.p.stun)) return false;
    if (this.p.stun > 0) this.p.stun--;
    this.endTurn();
    return true;
  }

  step(dx, dy) {
    if (!this.canAct()) return false;
    const p = this.p, map = this.map, nx = p.x + dx, ny = p.y + dy;
    if (!inMap(nx, ny)) return false;
    if (dx) p.face = Math.sign(dx);
    if (diagBlocked(map, p.x, p.y, nx, ny)) return false;
    const e = this.enemyAt(nx, ny);
    if (e) {
      this.emit('attack', { from: { x: p.x, y: p.y }, to: { x: nx, y: ny }, who: 'player' });
      this.playerAttack(e);
      this.endTurn();
      return true;
    }
    const i = idx(nx, ny);
    if (map.tiles[i] === ORE) return this.mineOre();
    if (!this.passable(nx, ny)) return false;
    p.x = nx; p.y = ny;
    onEnter(this, 'player', nx, ny);
    this.pickupAt(nx, ny);
    if (map.tiles[i] === STAIRS) { this.descend(); return true; }
    this.endTurn();
    return true;
  }

  wait() {
    if (!this.canAct()) return false;
    this.endTurn();
    return true;
  }

  // Bump the big ore to mine it. Every swing pays a little, is louder than the last
  // and makes the crack beside it puff mine gas. The last swing breaks it wide open.
  mineOre() {
    const map = this.map, ore = map.ore, p = this.p;
    ore.hits++;
    const r = B.ORE_NOISE[ore.hits - 1];
    this.emit('mine', { x: ore.x, y: ore.y, from: { x: p.x, y: p.y }, hits: ore.hits, r });
    for (const v of map.vents) addGas(this, v.x, v.y, 'mine', B.ORE_GAS);
    if (ore.hits < B.ORE_HITS) {
      this.addGold(B.oreGold(this.floor));
      this.log(`캉! 광석 조각이 떨어졌다. (${ore.hits}/${B.ORE_HITS})`);
    } else {
      const i = idx(ore.x, ore.y);
      map.tiles[i] = FLOOR;
      map.ore = null;
      this.pickups.push({ x: ore.x, y: ore.y, type: 'gold', amount: B.oreJackpot(this.floor) });
      this.pickups.push({ x: ore.x, y: ore.y, type: 'chest' });
      this.log('쩌억! 큰 광석이 통째로 쏟아졌다!', 'good');
      this.discover('ore_jackpot');
      this.emit('tiles', { list: [i] });
    }
    this.noise(ore.x, ore.y, r);
    this.endTurn();
    return true;
  }

  useItem(id) {
    if (!this.canAct() || !this.p.items[id] || id === 'bomb') return false;
    const p = this.p;
    p.items[id]--;
    if (id === 'potion') {
      this.heal(Math.round(this.stat().maxHp * B.POTION_HEAL));
      this.log('체력 물약을 마셨다.', 'good');
    }
    if (id === 'map') {
      const m = this.map;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        let near = false;
        for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) if (passable(m, x + k, y + j) || m.tiles[idx(x, y)] === ORE) near = true;
        if (near) m.explored[idx(x, y)] = 1;
      }
      this.log('지도를 펼쳤다. 계단 위치가 보인다.', 'good');
    }
    this.endTurn();
    return true;
  }

  canThrowAt(x, y) {
    return inMap(x, y) && this.isVisible(x, y) && cheb({ x, y }, this.p) <= BOMB_RANGE && !(x === this.p.x && y === this.p.y);
  }

  throwBomb(x, y) {
    if (!this.canAct() || !this.p.items.bomb || !this.canThrowAt(x, y)) return false;
    const p = this.p;
    p.items.bomb--;
    if (x !== p.x) p.face = Math.sign(x - p.x);
    this.emit('throw', { from: { x: p.x, y: p.y }, to: { x, y } });
    explosion(this, x, y, 1, { dmg: B.bombDamage(this.floor), cause: '내가 던진 폭탄에 휘말렸다' });
    this.endTurn();
    return true;
  }

  pickupAt(x, y) {
    for (const q of this.pickups.filter(q => q.x === x && q.y === y)) {
      this.pickups.splice(this.pickups.indexOf(q), 1);
      this.emit('pickup', { x, y, type: q.type });
      if (q.type === 'gold') this.addGold(q.amount);
      else if (q.type === 'chest') { this.queue.push({ kind: 'chest' }); this.log('보물 상자를 열었다!', 'good'); }
      else { this.p.items[q.type]++; this.log(`${josa(ITEMS[q.type].name, '을', '를')} 주웠다.`); }
    }
  }

  // ---------- combat ----------
  playerAttack(e) {
    const s = this.stat(), rl = this.p.relics;
    if (e.state === 'sleep') this.log(`자고 있는 ${e.d.name}에게 기습!`, 'good');
    const sneak = e.state === 'sleep' ? 2 : 1;
    this.hurt(e, Math.max(1, (s.atk + rnd(2)) * sneak - e.def), 'normal');
    let fire = 0;
    if (rl.flamesword) fire = 5;
    else if (rl.ring && Math.random() < 0.3) fire = 3 * rl.ring;
    if (fire && e.hp > 0) {
      this.hurt(e, fire, 'fire');
      const t = this.map.ter[idx(e.x, e.y)];
      if (t === T.BRUSH) ignite(this, e.x, e.y);
    }
  }

  hurt(e, dmg, kind) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    this.emit('hit', { enemy: e, x: e.x, y: e.y, dmg, kind });
    if (e.hp <= 0) this.onKill(e);
    else rouse(this, e, 'hit');
  }

  onKill(e) {
    const rl = this.p.relics, stats = this.meta.stats;
    this.kills++; stats.kills++;
    this.emit('kill', { enemy: e });
    if (e.d.boss) {
      if (!stats.bosses.includes(e.type)) stats.bosses.push(e.type);
      this.log(`${josa(e.d.name, '을', '를')} 쓰러뜨렸다!`, 'good');
      if (this.floor >= B.LAST_FLOOR) this.victory = true;
      else {
        this.map.tiles[idx(e.x, e.y)] = STAIRS;
        this.map.ter[idx(e.x, e.y)] = T.NONE;
        this.emit('stairs', { x: e.x, y: e.y });
        this.log('계단이 나타났다.', 'good');
      }
      this.addGold(30 * (this.floor / 3));
    } else if (Math.random() < B.GOLD_DROP_CHANCE) {
      this.pickups.push({ x: e.x, y: e.y, type: 'gold', amount: (Math.floor((this.floor - 1) / 3) + 1) * rint(1, 4) });
    }
    const heal = 2 * (rl.fang || 0) + (rl.bloodcrown ? 10 : 0);
    if (heal) this.heal(heal);
    this.gainXp(e.d.xp);
  }

  damagePlayer(raw, src, kind = 'melee') {
    const s = this.stat(), rl = this.p.relics, p = this.p;
    if (s.dodge && Math.random() < s.dodge) { this.emit('dodge', { x: p.x, y: p.y }); return; }
    const dmg = Math.max(1, raw + rnd(2) - s.def);
    this.hurtPlayer(dmg, `${src.d.name}에게 당했다`, kind);
    if (src && kind === 'melee') {
      const thorn = rl.fortress ? 8 : 2 * (rl.thorns || 0);
      if (thorn) this.hurt(src, thorn, 'thorns');
      if (src.type === 'lord' && src.hp > 0) src.hp = Math.min(src.maxHp, src.hp + dmg);
    }
  }

  // Damage that ignores defence and dodging (fire, gas, falling rocks, your own bomb...)
  hurtPlayer(dmg, cause, kind = 'env') {
    const p = this.p;
    if (p.hp <= 0) return;
    p.hp -= dmg;
    this.cause = cause;
    if (p.sleep) { p.sleep = 0; p.wokeAt = this.turn; this.log('아파서 잠이 확 깼다!', 'warn'); }
    this.emit('phit', { x: p.x, y: p.y, dmg, kind });
  }

  heal(n) {
    const before = this.p.hp;
    this.p.hp = Math.min(this.stat().maxHp, this.p.hp + n);
    if (this.p.hp > before) this.emit('heal', { x: this.p.x, y: this.p.y, n: this.p.hp - before });
  }

  addGold(n) {
    const g = Math.max(1, Math.round(n * this.stat().goldMult));
    this.gold += g;
    this.emit('gold', { x: this.p.x, y: this.p.y, n: g });
  }

  gainXp(n) {
    const p = this.p;
    p.xp += n;
    while (p.xp >= B.xpToLevel(p.lvl)) {
      p.xp -= B.xpToLevel(p.lvl);
      this.withMaxHpDelta(() => { p.lvl++; });
      this.heal(Math.round(this.stat().maxHp * B.LEVEL_UP_HEAL));
      this.queue.push({ kind: 'level' });
      this.emit('levelup', { lvl: p.lvl });
    }
  }

  // Loud things wake sleepers nearby and draw wanderers over.
  noise(x, y, r) {
    let woke = 0;
    for (const e of this.enemies) {
      if (e.hp > 0 && cheb(e, { x, y }) <= r && rouse(this, e, 'noise', x, y)) woke++;
    }
    if (woke) this.discover('noise_sleep');
  }

  discover(id) {
    if (this.meta.found[id] || this.over) return;
    const d = DISCOVERIES.find(x => x.id === id);
    if (!d) return;
    this.meta.found[id] = true;
    this.found.push(id);
    this.emit('discover', { id, d });
    this.log(`새 발견! ${d.combo}: ${d.result}`, 'evo');
  }

  // ---------- turn ----------
  endTurn() {
    const p = this.p, rl = p.relics;
    this.turn++;
    if (rl.goldbolt && this.turn % 3 === 0) this.zap(3, 10);
    else if (rl.bolt && this.turn % 6 === 0) this.zap(1, 4 * rl.bolt);
    if (rl.moss && this.turn % [6, 4, 2][rl.moss - 1] === 0) this.heal(1);

    const dm = distMap(this.map, p.x, p.y);
    for (const e of this.enemies.slice()) {
      if (e.hp > 0 && p.hp > 0) enemyAct(this, e, dm);
    }
    if (p.hp > 0) envTick(this);
    this.enemies = this.enemies.filter(e => e.hp > 0);
    if (p.hp > 0) this.chatter();
    this.afterTurn();
  }

  zap(count, dmg) {
    const targets = this.enemies
      .filter(e => e.hp > 0 && this.isVisible(e.x, e.y))
      .sort((a, b) => cheb(a, this.p) - cheb(b, this.p))
      .slice(0, count);
    const hit = new Set();
    for (const e of targets) this.zapHit({ x: this.p.x, y: this.p.y }, e, dmg, hit);
  }

  zapHit(from, e, dmg, hit) {
    if (hit.has(e.id) || e.hp <= 0) return;
    hit.add(e.id);
    const at = { x: e.x, y: e.y };
    this.emit('zap', { from, to: at });
    this.hurt(e, dmg, 'bolt');
    // water carries the shock to everyone standing in it, you included
    if (this.map.ter[idx(at.x, at.y)] === T.WATER) {
      const pool = waterBody(this.map, at.x, at.y);
      this.emit('shock', { tiles: pool.map(([x, y]) => ({ x, y })) });
      this.discover('bolt_water');
      for (const [x, y] of pool) {
        const o = this.enemyAt(x, y);
        if (o) this.zapHit(at, o, dmg, hit);
        if (x === this.p.x && y === this.p.y) this.hurtPlayer(Math.ceil(dmg / 2), '웅덩이에서 감전됐다', 'bolt');
      }
    }
  }

  // Now and then, hiding in a brush, you overhear a nearby enemy. Once per floor at most.
  chatter() {
    const p = this.p;
    if (this.overheard || !this.playerHidden() || Math.random() > 0.06) return;
    const near = this.enemies.filter(e => e.hp > 0 && e.state !== 'hunt' && e.state !== 'flee' &&
      cheb(e, p) <= 5 && this.isVisible(e.x, e.y));
    if (!near.length) return;
    const e = pick(near);
    this.overheard = true;
    let text;
    if (e.state === 'sleep') text = pick(SLEEP_TALK);
    else {
      const hints = FLOOR_HINTS.filter(h => this.has.has(h.has));
      text = hints.length && Math.random() < 0.7 ? pick(hints).text : pick(GOSSIP);
    }
    this.say(e, text);
    this.log(`엿들음 · ${e.d.name}: "${text}"`, 'hear');
  }

  // A door stands open only while someone is in the doorway.
  refreshDoors() {
    const m = this.map;
    for (const d of m.doors) {
      const here = (this.p.x === d.x && this.p.y === d.y) || this.enemies.some(e => e.hp > 0 && e.x === d.x && e.y === d.y);
      m.open[idx(d.x, d.y)] = here ? 1 : 0;
    }
  }

  afterTurn() {
    this.refreshDoors();
    computeFOV(this.map, this.p.x, this.p.y);
    if (this.p.hp <= 0) { this.p.hp = 0; this.finish(false); return; }
    if (this.victory) { this.finish(true); return; }
    this.emit('turn');
  }

  // Returns true if the boss used its whole turn on a special move.
  bossSpecial(e) {
    const p = this.p;
    if (e.type === 'skelking') {
      if (e.slam) {
        e.slam = false;
        const hit = this.telegraph.some(t => t.x === p.x && t.y === p.y);
        this.emit('slam', { tiles: this.telegraph, hit });
        this.telegraph = [];
        if (hit) { this.hurtPlayer(10 + this.floor, '해골 왕의 뼈망치에 맞았다', 'slam'); this.log('해골 왕의 내려치기에 맞았다!', 'warn'); }
        else this.log('내려치기를 피했다!', 'good');
        return true;
      }
      if (e.timer % 4 === 0) {
        e.slam = true;
        this.telegraph = [];
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          if (passable(this.map, p.x + i, p.y + j)) this.telegraph.push({ x: p.x + i, y: p.y + j });
        }
        this.log('해골 왕이 뼈망치를 들어 올렸다. 붉은 칸에서 벗어나야 한다!', 'warn');
        return true;
      }
    }
    if (e.type === 'ratking' && e.timer % 5 === 0) {
      let n = 0;
      for (const [dx, dy] of shuffle(DIRS8.slice())) {
        const nx = e.x + dx, ny = e.y + dy;
        if (n < 2 && this.canEnemyEnter(nx, ny)) {
          this.spawnEnemy('rat', nx, ny).state = 'hunt';
          n++;
        }
      }
      if (n) this.log('왕쥐가 쥐를 불러냈다.', 'warn');
    }
    if (e.type === 'lord' && e.timer % 6 === 0 && !e.aim) {
      const spots = [];
      for (let y = p.y - 6; y <= p.y + 6; y++) for (let x = p.x - 6; x <= p.x + 6; x++) {
        const dd = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
        if (dd >= 4 && this.canEnemyEnter(x, y) && lineOfSight(this.map, x, y, p.x, p.y)) spots.push({ x, y });
      }
      if (spots.length) {
        const s = pick(spots);
        this.emit('teleport', { enemy: e, from: { x: e.x, y: e.y }, to: s });
        e.x = s.x; e.y = s.y;
        e.aim = true; e.aimAt = { x: p.x, y: p.y };
        this.log('뱀파이어 군주가 순간이동해 조준하고 있다!', 'warn');
        return true;
      }
    }
    return false;
  }

  // ---------- relic choices ----------
  relicAvailable(id) { return !RELICS[id].locked || this.meta.relicUnlock[id]; }

  offers(n = 3) {
    const rl = this.p.relics, full = Object.keys(rl).length >= MAX_SLOTS;
    const pool = Object.keys(RELICS).filter(id => {
      if (RELICS[id].evo) return false;
      if (rl[id]) return rl[id] < MAX_LEVEL;
      if (full) return false;
      const ev = EVOLUTIONS.find(e => e.a === id || e.b === id);
      if (ev && rl[ev.id]) return false;
      return this.relicAvailable(id);
    });
    const res = shuffle(pool).slice(0, n).map(id => ({ kind: 'relic', id }));
    if (res.length < n) res.push({ kind: 'heal' });
    if (res.length < n) res.push({ kind: 'gold' });
    return res;
  }

  // Called by the UI after the player picks one of `offers()`.
  choose(o) {
    this.queue.shift();
    const rl = this.p.relics;
    if (o.kind === 'heal') this.heal(Math.round(this.stat().maxHp * 0.5));
    else if (o.kind === 'gold') this.addGold(25);
    else {
      this.withMaxHpDelta(() => { rl[o.id] = (rl[o.id] || 0) + 1; });
      this.log(`${RELICS[o.id].name} Lv${rl[o.id]}`, 'good');
      this.checkEvolutions();
    }
    this.emit('relics');
  }

  checkEvolutions() {
    const rl = this.p.relics;
    for (const ev of EVOLUTIONS) {
      if (rl[ev.a] === MAX_LEVEL && rl[ev.b] === MAX_LEVEL && !rl[ev.id]) {
        this.withMaxHpDelta(() => { delete rl[ev.a]; delete rl[ev.b]; rl[ev.id] = 1; });
        this.meta.stats.evos++;
        this.log(`진화! ${RELICS[ev.a].name} + ${RELICS[ev.b].name} → ${RELICS[ev.id].name}`, 'evo');
        this.emit('evolve', { id: ev.id, x: this.p.x, y: this.p.y });
        this.emit('banner', { text: `진화! ${RELICS[ev.id].name}` });
      }
    }
  }

  // ---------- end ----------
  finish(won) {
    if (this.over) return;
    this.over = true;
    this.queue = [];
    const stats = this.meta.stats;
    if (won) { stats.wins++; this.gold += B.VICTORY_BONUS; }
    this.meta.gold += this.gold;
    stats.bestGold = Math.max(stats.bestGold, this.gold);
    const before = { stats: this.startStats };
    const newlyUnlockable = Object.entries(CHARACTERS)
      .filter(([id, c]) => c.cond && !this.meta.chars[id] && c.cond.val(this.meta) >= c.cond.goal && c.cond.val(before) < c.cond.goal)
      .map(([, c]) => c.name);
    this.emit('end', { won, newlyUnlockable });
  }
}
Run.nextId = 1;
