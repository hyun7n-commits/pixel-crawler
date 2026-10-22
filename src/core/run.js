// One trip into the dungeon. Holds all run state and the turn rules.
// It never touches the screen: it emits events that the scene and HUD listen to.
// Enemy behaviour lives in ai.js, fire/gas/explosions in world.js.

import * as B from '../data/balance.js';
import { RELICS, RECIPES, MAX_LEVEL, MAX_SLOTS, DISCOVERY_GOLD, tierOf, maxLevelOf, recipeKey, recipesWith, fusedId, isFused, fusedParts, relicName } from '../data/relics.js';
import { CHARACTERS } from '../data/characters.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { ORES } from '../data/ores.js';
import { T, DISCOVERIES, GOSSIP, SLEEP_TALK, FLOOR_HINTS, isTrap } from '../data/terrain.js';
import { rnd, rint, pick, shuffle, cheb, josa, DIRS8 } from './util.js';
import {
  createMap, carveRooms, carveArena, idx, inMap, passable, distMap, lineOfSight, computeFOV,
  FLOOR, STAIRS, ORE, UPSTAIRS, GRAVE, LOCKED, DOOR,
} from './dungeon.js';
import { decorate, decorateArena, placeTraps } from './decorate.js';
import { placeSpecials, SET_PIECES } from './specials.js';
import { NPC_TEXT } from '../data/npcs.js';
import { enemyAct, rouse, awaken } from './ai.js';
import { onEnter, explosion, envTick, waterBody, ignite, addGas, spotTraps, revealTraps, openGrave, setBurn, springTrap } from './world.js';

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
    this.queue = [];        // pending choices: { kind: 'level' | 'chest' | 'talk', ... }
    this.over = false;
    this.victory = false;
    this.cause = '';        // what knocked you out, for the summary
    this.found = [];        // discoveries made this run
    this.newRecipes = [];   // recipes found for the first time this run
    this.told = {};         // one-time hints already shown
    this.floors = {};       // floors you left, kept as they were so you can go back for what you missed
    this.trail = [];        // your last steps on this floor; hunting enemies follow them
    // the two quest folk and the floor each one lives on
    this.quests = {
      ghost: { floor: rint(1, 2), state: 'idle' },              // idle -> asked -> found -> done
      smith: { floor: rint(4, 5), state: 'idle', chunk: null },  // chunk: grade of the big ore you broke there
    };
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
    const L = this.levels(), ch = this.char, up = this.meta.up;
    const lv = id => L[id] || 0, on = id => lv(id) > 0;
    // `f(id, base, per)`: nothing without the relic, else base + per × level
    const f = (id, base, per) => (on(id) ? base + per * lv(id) : 0);
    const best = (...xs) => Math.max(...xs);
    return {
      atk: ch.atk + up.atk + 2 * lv('blade') + f('flamesword', 4, 2) + 2 * lv('volcano') + (on('minecrown') ? 5 : 0) +
        f('bloodblade', 3, 1) + f('whirl', 4, 1) + f('dagger', 2, 1) + lv('giantfist') + 2 * lv('bloodmoon') + lv('stormlord') + lv('whirlwind') + (on('godhammer') ? 5 : 0),
      def: ch.def + lv('shield') + f('fortress', 2, 1) + lv('undying') + lv('ironheart') + f('embermail', 1, 1) + lv('guardian'),
      maxHp: ch.hp + up.hp * 4 + 8 * lv('heart') + f('bloodcrown', 15, 5) + 10 * lv('lifetree') + (on('eternity') ? 30 : 0) +
        f('ironheart', 10, 5) + f('pillow', 16, 4) + f('giantfist', 12, 4) + 10 * lv('guardian') + (on('bloodking') ? 20 : 0) +
        (this.p.lvl - 1) * B.HP_PER_LEVEL,
      goldMult: 1 + 0.4 * lv('coin') + f('goldbolt', 0.75, 0.25) + 0.25 * lv('goldstorm') + (on('minecrown') ? 0.5 : 0) + 0.1 * up.greed +
        f('luckycharm', 1, 0.25) + f('goldfang', 0.8, 0.2) + 0.25 * lv('fortune') + (on('dawnstar') ? 0.5 : 0),
      // never more than 60%: something always gets through
      dodge: Math.min(0.6, (ch.dodge || 0) + 0.08 * lv('cloak') + f('shadow', 0.15, 0.05) + 0.05 * lv('phantom') +
        f('luckycharm', 0.2, 0.05) + f('spikecloak', 0.2, 0.05) + 0.05 * lv('fortune') + (on('dawnstar') ? 0.1 : 0)),
      // damage multiplier on a surprise attack: the best of the sneaky relics, plus what legends add on top
      sneak: best(1.5 + 0.25 * lv('boots'), f('shadow', 2.25, 0.25), f('dagger', 2.5, 0.25), f('owleye', 2, 0.25)) +
        0.5 * lv('phantom') + 0.5 * lv('nightowl') + (on('eclipse') ? 2 : 0) + (on('dawnstar') ? 1 : 0) + (ch.sneak || 0),
      sight: Math.min(B.SIGHT + 6, B.SIGHT + lv('lantern') + f('dreamlamp', 1, 1) + f('owleye', 1, 1) + f('headlamp', 1, 1) + f('sunlamp', 1, 1) + lv('nightowl')),
      oreMult: best(1 + 0.5 * lv('pick'), f('goldrush', 1.5, 0.5), f('headlamp', 1.5, 0.5)),
      // extra chance a swing finds a better grade
      oreRise: best(0.05 * lv('pick'), f('goldrush', 0.1, 0.05), f('headlamp', 0.1, 0.05)) + (on('minecrown') ? 0.15 : 0),
      magnet: on('goldrush') ? 1 + lv('goldrush') : on('magnet') ? lv('magnet') + 1 : 0,
    };
  }
  // Every relic in effect and its level: the ones in your slots, and what fused relics, legends and
  // myths hold inside them (always at full strength).
  levels() {
    const out = {};
    const add = (id, l) => {
      out[id] = Math.max(out[id] || 0, l);
      for (const h of isFused(id) ? fusedParts(id) : RELICS[id].has || []) add(h, maxLevelOf(h));
    };
    for (const [id, l] of Object.entries(this.p.relics)) add(id, l);
    return out;
  }
  lv(id) { return this.levels()[id] || 0; }
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
  // enemies know the mine: they never step on a trap
  canEnemyEnter(x, y) {
    return this.passable(x, y) && !this.enemyAt(x, y) && !(x === this.p.x && y === this.p.y) && !isTrap(this.map.ter[idx(x, y)]);
  }
  // next to each other: close enough to hit, diagonals and doorways included
  touching(a, b) { return cheb(a, b) === 1; }
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
      !e.stoneT && !e.backoff && !e.charge && !(e.d.slow && !e.skip);
  }
  get zone() { return zoneOf(this.floor); }

  // ---------- floors ----------
  start() {
    this.arrival = { dir: 0 };
    this.genFloor();
    this.log(`${josa(this.char.name, '으로', '로')} 들판에 나왔다. 깃발 꽂힌 땅굴을 찾아 앞으로 가자.`, 'good');
    this.emit('banner', { text: `1구역 · ${this.zone.name}` });
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
    this.respawnT = 0;
    if (isBossFloor(this.floor)) this.genBossFloor();
    else this.genNormalFloor();
    this.enterFloor();
  }

  enterFloor() {
    this.telegraph = [];
    this.trail = [{ x: this.p.x, y: this.p.y }];
    this.bandageUsed = 0;
    this.refreshDoors();
    computeFOV(this.map, this.p.x, this.p.y, this.stat().sight);
    // 반딧불 모자: every sparkle boulder on the field glows through the dark from the moment you arrive
    if (this.lv('headlamp')) for (const o of this.map.ores) for (const c of o.cells) this.map.explored[idx(c.x, c.y)] = 1;
    // `dir`: 1 down a burrow to the next field, -1 back, 0 the first field; `from`: the hole you went into
    this.emit('floor', this.arrival || {});
    this.arrival = null;
    this.spotVeins();
  }

  // A big vein (three tiles or more) catches your eye the first time it comes into view.
  spotVeins() {
    for (const o of this.map.ores) {
      if (o.spotted || o.size < 3 || !o.cells.some(c => this.isVisible(c.x, c.y))) continue;
      o.spotted = true;
      this.emit('vein', { x: o.x, y: o.y, cells: o.cells, size: o.size, tier: o.tier });
    }
  }

  genNormalFloor() {
    const map = this.map, rooms = carveRooms(map), start = rooms[0];
    this.p.x = start.cx; this.p.y = start.cy;
    const dm = distMap(map, start.cx, start.cy);
    // the layout already picked the stairs room, on a loop with the start (see dungeon.js buildLoop)
    let far = rooms.find(r => r.stairs), best = -1;
    if (!far) {
      for (const r of rooms) {
        const d = dm[idx(r.cx, r.cy)];
        if (d > best && d < 9999) { best = d; far = r; }
      }
    }
    map.tiles[idx(far.cx, far.cy)] = STAIRS;
    map.down = { x: far.cx, y: far.cy };
    if (this.floor > 1) { map.tiles[idx(start.cx, start.cy)] = UPSTAIRS; map.up = { x: start.cx, y: start.cy }; }
    const zi = Math.floor((this.floor - 1) / B.FLOORS_PER_ZONE);
    const stairs = { x: far.cx, y: far.cy };
    const deco = decorate(map, rooms, { start: this.p, stairs });
    this.has = deco.has;
    const sp = placeSpecials(map, rooms, deco, {
      floor: this.floor, start: this.p, stairs,
      relicOffers: n => this.offers(n).filter(o => o.kind === 'relic').map(o => o.id),
    });
    // loose traps, enemies and loot stay out of the set pieces
    const open = rooms.filter((r, i) => !SET_PIECES.has(deco.themes[i]));
    if (placeTraps(map, open, { start: this.p, stairs }, this.floor)) this.has.add('trap');
    for (const o of map.ores) o.tier = Math.min(ORES.length - 1, zi + (Math.random() < B.ORE_START_BONUS ? 1 : 0));

    // a free spot in a room other than the start; returns the spot and its room
    const free = () => {
      for (let t = 0; t < 300; t++) {
        const r = pick(open.slice(1));
        const x = rint(r.x, r.x + r.w - 1), y = rint(r.y, r.y + r.h - 1), i = idx(x, y);
        if (map.tiles[i] !== FLOOR || ![T.NONE, T.BRUSH, T.GRASS, T.ASH].includes(map.ter[i])) continue;
        if (this.enemyAt(x, y) || this.pickups.some(q => q.x === x && q.y === y) || sp.pickups.some(q => q.x === x && q.y === y)) continue;
        if (Math.abs(x - this.p.x) + Math.abs(y - this.p.y) < 6) continue;
        return { x, y, theme: deco.themes[rooms.indexOf(r)] };
      }
      return null;
    };
    const place = (fn) => { const s = free(); if (s) fn(s); };
    const scale = B.enemyScale(this.floor);
    // about half of them start asleep
    for (let i = 0; i < B.enemiesPerFloor(this.floor); i++) {
      place(s => {
        const type = pick(this.zone.enemies), state = Math.random() < B.START_ASLEEP ? 'sleep' : 'wander';
        const e = this.spawnEnemy(type, s.x, s.y, scale);
        e.state = state;
        // pack animals bring friends, curled up right beside them
        for (let k = 1, n = e.d.pack ? rint(2, e.d.pack) : 1; k < n; k++) {
          const t = shuffle(DIRS8.slice()).map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy }))
            .find(t => map.tiles[idx(t.x, t.y)] === FLOOR && this.canEnemyEnter(t.x, t.y));
          if (t) this.spawnEnemy(type, t.x, t.y, scale).state = state;
        }
      });
    }
    if (Math.random() < B.TURTLE_CHANCE) {
      place(s => { this.spawnEnemy('turtle', s.x, s.y, scale).state = Math.random() < 0.5 ? 'sleep' : 'wander'; });
    }
    for (let i = 0, n = rint(5, 7); i < n; i++) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'gold', amount: (zi + 1) * rint(3, 7) }));
    place(s => this.addChest(s.x, s.y));
    if (this.floor === 1) place(s => this.addChest(s.x, s.y));
    if (Math.random() < B.POTION_CHANCE) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'potion' }));
    if (Math.random() < 0.6) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'bomb' }));
    if (Math.random() < 0.3) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'map' }));

    this.pickups.push(...sp.pickups);
    for (const o of sp.enemies) this.spawnEnemy(o.type, o.x, o.y, B.gimmickScale(this.floor)).state = o.state;
    // the quest folk, on their floors
    const q = this.quests;
    if (this.floor === q.ghost.floor) place(s => { this.spawnEnemy('ghost', s.x, s.y).state = 'npc'; });
    if (this.floor === q.smith.floor) {
      place(s => {
        this.spawnEnemy('smith', s.x, s.y).state = 'npc';
        const a = DIRS8.map(([dx, dy]) => ({ x: s.x + dx, y: s.y + dy }))
          .find(t => map.tiles[idx(t.x, t.y)] === FLOOR && map.ter[idx(t.x, t.y)] === T.NONE && !this.pickups.some(o => o.x === t.x && o.y === t.y));
        if (a) map.ter[idx(a.x, a.y)] = T.ANVIL;
      });
    }
  }

  // A chest, or from floor 2 on now and then a mimic pretending to be one.
  addChest(x, y) {
    if (this.floor >= 2 && Math.random() < B.MIMIC_CHANCE) {
      this.spawnEnemy('mimic', x, y, B.gimmickScale(this.floor)).state = 'hide';
      this.has.add('mimic');
    } else this.pickups.push({ x, y, type: 'chest' });
  }

  genBossFloor() {
    const spots = carveArena(this.map);
    this.p.x = spots.start.x; this.p.y = spots.start.y;
    this.map.up = { ...spots.start }; // the way back opens once the boss is down
    decorateArena(this.map, spots.room, (x, y) => cheb({ x, y }, spots.start) <= 1 || cheb({ x, y }, spots.boss) <= 1);
    const type = this.zone.boss;
    const b = this.spawnEnemy(type, spots.boss.x, spots.boss.y, B.bossScale(this.floor));
    b.state = 'hunt';
    this.boss = b;
    this.log(`${josa(ENEMIES[type].name, '이', '가')} 나타났다! ${ENEMIES[type].tip}`, 'warn');
    this.log('쓰러뜨리기 전에는 돌아갈 수 없다.');
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

  // dir = 1 down, -1 up. Floors you have been on come back exactly as you left them.
  changeFloor(dir) {
    this.arrival = { dir, from: { x: this.p.x, y: this.p.y } };
    this.floors[this.floor] = {
      map: this.map, enemies: this.enemies.filter(e => e.hp > 0), pickups: this.pickups,
      boss: this.boss, has: this.has, gasActive: this.gasActive, overheard: this.overheard, respawnT: this.respawnT,
    };
    this.floor += dir;
    this.p.burn = 0; this.p.sleep = 0;
    const kept = this.floors[this.floor];
    if (kept) {
      delete this.floors[this.floor];
      Object.assign(this, kept);
      const at = dir > 0 ? this.map.up : this.map.down;
      this.arriveAt(at.x, at.y);
      this.enterFloor();
    } else {
      this.meta.stats.maxFloor = Math.max(this.meta.stats.maxFloor, this.floor);
      this.genFloor();
      const fb = this.lv('firebomb'), bombs = fb ? (fb < 3 ? 1 : 2) : this.lv('bombbag') ? 1 : 0;
      if (bombs) { this.p.items.bomb += bombs; this.log('폭탄 가방에서 폭탄을 꺼냈다.', 'good'); }
    }
    this.emit('banner', { text: isBossFloor(this.floor) ? `${this.floor}구역 · 보스` : `${this.floor}구역 · ${this.zone.name}` });
    this.log(dir > 0 ? `${this.floor}구역에 왔다.` : `${this.floor}구역으로 돌아왔다.`);
    this.afterTurn();
  }

  // Puts you on a stair tile, nudging aside whoever is standing on it.
  arriveAt(x, y) {
    const e = this.enemyAt(x, y);
    if (e) {
      const spot = DIRS8.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find(q => this.canEnemyEnter(q.x, q.y));
      if (spot) { e.x = spot.x; e.y = spot.y; }
    }
    this.p.x = x; this.p.y = y;
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
    const e = this.enemyAt(nx, ny);
    if (e && e.d.npc) { this.talk(e); return true; }
    if (e && e.state === 'hide') {
      // you reach for the chest and it bites
      awaken(this, e);
      this.endTurn();
      return true;
    }
    if (e) {
      this.emit('attack', { from: { x: p.x, y: p.y }, to: { x: nx, y: ny }, who: 'player' });
      this.playerAttack(e);
      this.endTurn();
      return true;
    }
    const i = idx(nx, ny);
    if (map.tiles[i] === ORE) return this.mineOre(this.oreAt(nx, ny), { x: nx, y: ny });
    if (map.tiles[i] === GRAVE) { openGrave(this, nx, ny); this.endTurn(); return true; }
    if (map.tiles[i] === LOCKED) return this.unlock(nx, ny);
    if (!this.passable(nx, ny)) return false;
    p.x = nx; p.y = ny;
    this.trail.push({ x: nx, y: ny });
    if (this.trail.length > 40) this.trail.shift();
    this.emit('move', { x: nx, y: ny, ter: map.ter[i] });
    onEnter(this, 'player', nx, ny);
    this.pickupAt(nx, ny);
    if (map.tiles[i] === STAIRS) { this.changeFloor(1); return true; }
    if (map.tiles[i] === UPSTAIRS) { this.changeFloor(-1); return true; }
    this.endTurn();
    return true;
  }

  wait() {
    if (!this.canAct()) return false;
    // 꿀잠 베개: a proper rest, as long as nobody is in sight
    const L = this.levels(), p = this.p;
    if (L.pillow && p.hp < this.stat().maxHp && !this.enemies.some(e => e.hp > 0 && !e.d.npc && !this.calm(e) && e.state !== 'hide' && e.state !== 'stone' && this.isVisible(e.x, e.y))) {
      this.heal(1 + L.pillow);
      this.emit('snooze', { x: p.x, y: p.y });
    }
    this.endTurn();
    return true;
  }

  // Bump a locked door: the floor's key opens it.
  unlock(x, y) {
    const map = this.map, i = idx(x, y);
    if (!map.keyHeld) {
      this.log('잠겨 있다. 이 구역 어딘가에 열쇠가 있을 것이다.');
      this.emit('locked', { x, y });
      return false;
    }
    map.keyHeld = false;
    map.tiles[i] = DOOR;
    map.doors.push({ x, y });
    this.emit('tiles', { list: [i], soft: true });
    this.emit('unlock', { x, y });
    this.log('열쇠로 잠긴 문을 열었다.', 'good');
    this.endTurn();
    return true;
  }

  // ---------- quest folk ----------
  // Talking takes no turn. What they say goes up as a sheet (queue kind 'talk').
  talk(e) {
    const q = this.quests[e.type], text = NPC_TEXT[e.type];
    const sheet = (body, opts, extra = {}) => this.queue.push({ kind: 'talk', who: e.type, text: body, opts, ...extra });
    const ok = () => [{ kind: 'ok', name: text.ok[0], desc: text.ok[1] }];
    if (e.type === 'ghost') {
      if (q.state === 'idle') {
        q.state = 'asked';
        const s = this.hiddenSpot() || this.randomFloorTile();
        this.spawnEnemy('thief', s.x, s.y, B.gimmickScale(this.floor)).state = 'wander';
        sheet(text.ask, ok());
      } else if (q.state === 'found') {
        q.state = 'done';
        sheet(text.thanks, this.offers(3), { noReroll: true });
        e.hp = 0;
        this.enemies = this.enemies.filter(o => o !== e);
        this.emit('vanish', { x: e.x, y: e.y });
        this.log(text.bye, 'good');
      } else this.say(e, text.wait);
    } else if (e.type === 'smith') {
      if (q.state === 'idle' && q.chunk === null) { q.state = 'asked'; sheet(text.ask, ok()); }
      else if (q.state === 'done') this.say(e, text.after);
      else if (q.chunk === null) this.say(e, text.wait);
      else {
        const gem = ORES[q.chunk].gem, picks = gem ? 2 : 1;
        q.state = 'done';
        q.chunk = null;
        for (let k = 0; k < picks; k++) this.queue.push({ kind: 'talk', who: 'smith', text: k ? text.thanksGem : gem ? text.thanksGem : text.thanks, smithPick: true, noReroll: true });
        this.log('대장장이가 망치를 들었다. 깡! 깡!', 'good');
      }
    }
    this.emit('turn');
  }

  // Relics the blacksmith can hammer up a level (asked when the sheet opens, so two picks in a row stay right).
  smithOffers() {
    const rl = this.p.relics;
    const ids = Object.keys(rl).filter(id => rl[id] < maxLevelOf(id));
    return ids.length ? ids.map(id => ({ kind: 'relic', id })) : [{ kind: 'gold', name: '덩어리 값', amount: 60 }];
  }

  // Bump the big ore to mine it. Every swing pays a little more than the last, is louder,
  // and makes the crack beside it puff mine gas. A swing may crack into a better grade
  // underneath, or hit a bonanza. The last swing breaks it wide open.
  oreAt(x, y) { return this.map.ores.find(o => o.cells.some(c => c.x === x && c.y === y)); }

  // `at`: the tile of the vein you swung at (a big vein spans up to four)
  mineOre(ore, at = ore) {
    const map = this.map, p = this.p, s = this.stat(), big = B.ORE_SIZE_MULT[ore.size - 1];
    ore.hits++;
    const k = ore.hits - 1, last = ore.hits >= B.ORE_HITS, top = ORES.length - 1;
    if (ore.hits === 1) this.meetOre(ore.tier);
    const nugget = !last && Math.random() < B.ORE_NUGGET[k];
    const above = Math.max(0, ore.tier - Math.floor((this.floor - 1) / B.FLOORS_PER_ZONE));
    const rise = B.ORE_RISE[k] * B.ORE_RISE_DECAY ** above + s.oreRise;
    const rose = !last && ore.tier < top && (nugget || Math.random() < rise);
    if (rose) { ore.tier++; this.meetOre(ore.tier); }
    const g = ORES[ore.tier];
    const r = Math.round((B.ORE_NOISE[k] + (nugget ? 2 : 0)) * (this.char.quiet ? 0.75 : 1));
    let gold;
    if (!last) gold = Math.round(B.oreGold(this.floor) * g.mult * B.ORE_SWING[k] * s.oreMult * big * (nugget ? B.ORE_NUGGET_MULT : 1));
    this.emit('mine', { x: at.x, y: at.y, cells: ore.cells, size: ore.size, from: { x: p.x, y: p.y }, hits: ore.hits, r, last, tier: ore.tier, rose, nugget });
    if (ore.vent) addGas(this, ore.vent.x, ore.vent.y, 'mine', B.ORE_GAS);
    if (!last) this.addGold(gold);
    else {
      for (const c of ore.cells) map.tiles[idx(c.x, c.y)] = FLOOR;
      map.ores = map.ores.filter(o => o !== ore);
      this.meta.ores[g.id] = (this.meta.ores[g.id] || 0) + 1;
      // the haul lies in a heap on every tile the vein filled; a 2x2 jackpot holds a richer chest
      const haul = Math.round(B.oreJackpot(this.floor) * g.mult * s.oreMult * big / ore.size);
      for (const c of ore.cells) this.pickups.push({ x: c.x, y: c.y, type: 'gold', amount: haul, ore: ore.tier });
      this.pickups.push({ x: ore.x, y: ore.y, type: 'chest', rich: ore.size >= 4, vein: ore.size >= 4 });
      if (Math.random() < B.CANDY_ORE[ore.size - 1]) { const c = ore.cells[ore.cells.length - 1]; this.pickups.push({ x: c.x, y: c.y, type: 'candy' }); }
      this.discover('ore_jackpot', true);
      // the blacksmith on this floor wants a chunk of it
      const smith = this.quests.smith;
      if (this.floor === smith.floor && smith.state !== 'done' && (smith.chunk === null || ore.tier > smith.chunk)) {
        smith.chunk = ore.tier;
        this.log(`반짝돌 덩어리를 하나 챙겼다.${smith.state === 'asked' ? ' 대장장이에게 가져가자.' : ''}`, 'good');
      }
      this.emit('tiles', { list: ore.cells.map(c => idx(c.x, c.y)) });
    }
    const heard = this.noise(ore.x, ore.y, r);
    // the deeper you dig, the more the mine answers: monsters crawl out of the dark toward the sound
    const came = [];
    const wave = B.ORE_WAVE[k] + (B.ORE_WAVE[k] ? B.ORE_SIZE_WAVE[ore.size - 1] : 0);
    for (let n = 0; n < (this.char.quiet ? wave - 1 : wave); n++) {
      const t = this.waveSpot(ore);
      if (!t) break;
      const e = this.spawnEnemy(pick(this.zone.enemies), t.x, t.y, B.enemyScale(this.floor));
      e.state = 'search'; e.searchT = 0; e.last = { x: ore.x, y: ore.y };
      came.push(e);
    }
    if (heard.length || came.length) this.emit('heard', { x: p.x, y: p.y, list: [...heard, ...came] });
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
      const traps = revealTraps(this);
      this.log(`지도를 펼쳤다. 땅굴 위치가 보인다.${traps ? ` 숨은 함정 ${traps}개도 표시돼 있다.` : ''}`, 'good');
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
    const bag = this.lv('bombbag'), fb = this.lv('firebomb');
    const mult = fb ? 1.25 + 0.25 * fb : 1 + 0.25 * Math.max(0, bag - 1);
    explosion(this, x, y, 1, { dmg: Math.round(B.bombDamage(this.floor) * mult), cause: '내가 던진 폭탄에 휘말렸다', burn: fb ? 3 : 0 });
    this.endTurn();
    return true;
  }

  pickupAt(x, y) {
    const map = this.map;
    for (const q of this.pickups.filter(q => q.x === x && q.y === y)) {
      if (q.type === 'lockedChest' && !map.keyHeld) { this.log('잠긴 상자다. 이 구역 어딘가에 열쇠가 있을 것이다.'); continue; }
      this.pickups.splice(this.pickups.indexOf(q), 1);
      this.emit('pickup', { x, y, type: q.type });
      if (q.type === 'gold' && q.stolen) { this.gold += q.amount; this.emit('gold', { x, y, n: q.amount }); }
      else if (q.type === 'gold') this.addGold(q.amount);
      else if (q.type === 'chest') {
        this.queue.push({ kind: 'chest', rich: !!q.rich, vein: !!q.vein });
        this.log('보물 상자를 열었다!', 'good');
        if (q.guarded) this.wakeStatues(x, y);
      } else if (q.type === 'lockedChest') {
        map.keyHeld = false;
        this.queue.push({ kind: 'chest', rich: true });
        this.log('열쇠로 잠긴 상자를 열었다!', 'good');
      } else if (q.type === 'key') {
        map.keyHeld = true;
        this.log('작은 열쇠를 주웠다. 이 구역의 잠긴 곳을 연다.', 'good');
      } else if (q.type === 'candy') this.fission(q.n || B.candySteps(this.floor), x, y);
      else if (q.type === 'crystal') this.takeCrystal(q);
      else if (q.type === 'necklace') {
        this.quests.ghost.state = 'found';
        this.log('아기새 리본을 찾았다! 울보 아기새에게 돌려주자.', 'good');
      } else { this.p.items[q.type]++; this.log(`${josa(ITEMS[q.type].name, '을', '를')} 주웠다.`); }
    }
  }

  // A relic from a crystal vault: the other crystals of that vault shatter.
  takeCrystal(q) {
    const rl = this.p.relics, id = q.relic;
    const fits = rl[id] ? rl[id] < maxLevelOf(id) : Object.keys(rl).length < MAX_SLOTS;
    if (fits) this.gainRelic(id);
    else { this.addGold(40); this.log('유물을 더 담을 수 없어서 유리 종 속 유물을 골드로 바꿨다.'); }
    for (const o of this.pickups.filter(o => o.type === 'crystal' && o.vault === q.vault)) {
      this.pickups.splice(this.pickups.indexOf(o), 1);
      this.emit('shatter', { x: o.x, y: o.y });
    }
    this.log('나머지 유리 종은 와장창 깨졌다.');
  }

  // Taking the chest a statue guards wakes every statue in that room.
  wakeStatues(x, y) {
    const room = this.map.room[idx(x, y)];
    for (const e of this.enemies) if (e.state === 'stone' && this.map.room[idx(e.x, e.y)] === room) awaken(this, e);
  }

  // ---------- combat ----------
  // An enemy that is not after you (asleep, strolling, searching, or a calm one) takes a surprise attack.
  unaware(e) { return ['sleep', 'wander', 'search'].includes(e.state) || this.calm(e); }

  playerAttack(e) {
    const s = this.stat(), L = this.levels(), p = this.p;
    const base = s.atk + rnd(2);
    // 그림자 걸음: right after a kill you are still in the shadows, so the next blow is a surprise too
    const shade = p.shade > 0 && !this.unaware(e);
    if (this.unaware(e) || shade) {
      p.shade = 0;
      this.emit('sneak', { x: e.x, y: e.y, from: { x: p.x, y: p.y } });
      this.log(shade ? `그림자 속에서 튀어나와 ${josa(e.d.name, '을', '를')} 내리쳤다!` : `${e.state === 'sleep' ? '자고 있는' : '나를 못 본'} ${josa(e.d.name, '을', '를')} 세게 내리쳤다!`, 'good');
      this.strike(e, Math.round(base * s.sneak), 'sneak');
      // 암살 단검: a surprise kill is over before anyone can react; they all lose this turn
      if (e.hp <= 0 && L.dagger) { this.quick = true; this.emit('quick', { x: p.x, y: p.y }); }
    } else this.strike(e, base, 'normal');
    // the swing carries on into everyone else standing next to you
    const share = L.quake || L.whirlwind ? 1 : L.whirl ? 0.6 + 0.1 * L.whirl : 0.3 * (L.sweep || 0);
    if (share) {
      for (const o of this.enemies.filter(o => o !== e && o.hp > 0 && this.touching(o, this.p))) {
        this.emit('attack', { from: { x: this.p.x, y: this.p.y }, to: { x: o.x, y: o.y }, who: 'player' });
        this.strike(o, Math.max(1, Math.round(base * share)), 'normal');
      }
    }
  }

  // One blow from you: defence, then the relics that ride along with every hit.
  strike(e, raw, kind) {
    const L = this.levels();
    this.hurt(e, Math.max(1, raw - e.def), kind);
    const steal = (this.char.lifesteal || 0) + (L.bloodblade ? (L.bloodblade < 3 ? 1 : 2) : 0);
    if (steal && !e.d.npc) this.heal(steal);
    if (e.hp <= 0) return;
    let fire = 0;
    if (L.flamesword) fire = 2 + L.flamesword;
    else if (L.ring && Math.random() < 0.3) fire = 3 * L.ring;
    if (fire) {
      this.hurt(e, fire, 'fire');
      const t = this.map.ter[idx(e.x, e.y)];
      if (t === T.BRUSH) ignite(this, e.x, e.y);
    }
    const stun = Math.max(0.15 * (L.hammer || 0), L.quake ? 0.15 + 0.05 * L.quake : 0, L.thunder ? 0.3 + 0.05 * L.thunder : 0, L.giantfist ? 0.25 + 0.05 * L.giantfist : 0);
    if (e.hp > 0 && !e.d.boss && Math.random() < stun) {
      e.stun = 1;
      this.emit('stun', { x: e.x, y: e.y });
      if (L.giantfist) this.knock(e, 4 + 2 * L.giantfist);
    }
  }

  // 거인의 주먹: a dazed monster flies one tile away from you. Into a wall or another monster it takes a
  // knock (and so does the other one); onto a trap it sets it off; through fire it catches; into water
  // it is put out.
  knock(e, dmg) {
    const dx = Math.sign(e.x - this.p.x), dy = Math.sign(e.y - this.p.y), x = e.x + dx, y = e.y + dy;
    const other = this.enemyAt(x, y);
    if (!this.passable(x, y) || other || (x === this.p.x && y === this.p.y)) {
      this.emit('bonk', { x: e.x, y: e.y, dx, dy });
      this.hurt(e, dmg, 'bonk');
      if (other) this.hurt(other, dmg, 'bonk');
      return;
    }
    const from = { x: e.x, y: e.y };
    e.x = x; e.y = y;
    this.emit('push', { enemy: e, from, to: { x, y } });
    onEnter(this, e, x, y);
    if (isTrap(this.map.ter[idx(x, y)])) springTrap(this, x, y);
  }

  hurt(e, dmg, kind) {
    if (e.hp <= 0 || e.d.npc) return;
    if (e.stoneT > 0) dmg = 1; // a gargoyle gone to stone barely feels it
    e.hp -= dmg;
    this.emit('hit', { enemy: e, x: e.x, y: e.y, dmg, kind });
    if (e.hp <= 0) this.onKill(e);
    else {
      rouse(this, e, 'hit');
      if (e.d.splits && e.hp >= 4) this.split(e);
    }
  }

  // A slime that takes a hit and lives splits off half of what it has left into a little one beside it.
  split(e) {
    const spot = shuffle(DIRS8.slice()).map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy })).find(t => this.canEnemyEnter(t.x, t.y));
    if (!spot) return;
    const half = Math.floor(e.hp / 2);
    e.hp -= half;
    const c = this.spawnEnemy(e.type, spot.x, spot.y);
    Object.assign(c, { hp: half, maxHp: e.maxHp, atk: e.atk, state: 'hunt', last: { x: this.p.x, y: this.p.y }, small: true, xp: 1 });
    e.small = true;
    this.emit('split', { enemy: e, child: c, from: { x: e.x, y: e.y } });
  }

  // A thief that got out of sight with your gold is gone, and the gold with it; on a floor with an
  // acorn stash, it takes the gold home to the big oak stump, where you can still dig it up.
  escape(e) {
    e.hp = 0;
    this.emit('escape', { enemy: e });
    const stash = this.map.bigGrave;
    if (e.loot && stash != null && this.map.tiles[stash] === GRAVE) {
      this.map.stash = (this.map.stash || 0) + e.loot;
      this.log(`${josa(e.d.name, '이', '가')} 골드를 들고 큰 참나무 그루터기 쪽으로 사라졌다…`, 'warn');
    } else this.log(`${josa(e.d.name, '이', '가')} 골드를 들고 사라졌다…`, 'warn');
  }

  onKill(e) {
    const L = this.levels(), stats = this.meta.stats;
    this.kills++; stats.kills++;
    this.emit('kill', { enemy: e });
    if (e.d.boss) {
      if (!stats.bosses.includes(e.type)) stats.bosses.push(e.type);
      this.log(`${josa(e.d.name, '을', '를')} 쓰러뜨렸다!`, 'good');
      if (this.floor >= B.LAST_FLOOR) this.victory = true;
      else {
        this.map.tiles[idx(e.x, e.y)] = STAIRS;
        this.map.ter[idx(e.x, e.y)] = T.NONE;
        this.map.down = { x: e.x, y: e.y };
        this.emit('stairs', { x: e.x, y: e.y });
        const up = this.map.up;
        this.map.tiles[idx(up.x, up.y)] = UPSTAIRS;
        this.map.ter[idx(up.x, up.y)] = T.NONE;
        this.emit('stairs', { x: up.x, y: up.y });
        this.log('다음 구역으로 가는 땅굴이 뚫리고, 돌아가는 굴도 열렸다.', 'good');
      }
      this.addGold(30 * (this.floor / 3));
      this.dropNear(e.x, e.y, { type: 'candy', n: B.candySteps(this.floor) + B.CANDY_BOSS });
    } else if (e.d.treasure) {
      this.pickups.push({ x: e.x, y: e.y, type: 'chest' }, { x: e.x, y: e.y, type: 'gold', amount: B.turtleGold(this.floor) });
      this.dropNear(e.x, e.y, { type: 'candy' });
      this.log(`${josa(e.d.name, '이', '가')} 등에 지고 있던 보물을 떨궜다!`, 'good');
    } else if (e.d.quest) {
      this.pickups.push({ x: e.x, y: e.y, type: 'necklace' });
      this.log('도둑 들쥐가 리본을 떨궜다!', 'good');
    } else if (e.loot) {
      this.pickups.push({ x: e.x, y: e.y, type: 'gold', amount: e.loot, stolen: true });
    } else if (L.goldfang || Math.random() < B.GOLD_DROP_CHANCE) {
      this.pickups.push({ x: e.x, y: e.y, type: 'gold', amount: (Math.floor((this.floor - 1) / 3) + 1) * rint(1, 4) });
    }
    if (e.d.bones) this.boneBurst(e);
    if (L.shadow && !e.d.npc) { this.p.shade = 3; this.emit('shade', { x: this.p.x, y: this.p.y }); }
    const heal = 2 * (L.fang || 0) + (L.bloodcrown ? 4 + 2 * L.bloodcrown : 0) + (L.goldfang ? 5 + L.goldfang : 0);
    if (heal) this.heal(heal);
    this.gainXp(e.xp ?? e.d.xp);
  }

  // A skeleton falls apart in a burst of bone: everyone next to it takes a hit, monsters too.
  boneBurst(e) {
    const dmg = e.atk + rint(1, 3);
    this.emit('bones', { x: e.x, y: e.y });
    for (const o of this.enemies.filter(o => o !== e && o.hp > 0 && cheb(o, e) === 1)) this.hurt(o, dmg * 2, 'bones');
    if (cheb(this.p, e) === 1) this.hurtPlayer(Math.max(1, dmg - this.stat().def), '독버섯 포자에 맞았다', 'bones');
  }

  damagePlayer(raw, src, kind = 'melee') {
    const s = this.stat(), L = this.levels(), p = this.p;
    if (s.dodge && Math.random() < s.dodge) {
      this.emit('dodge', { x: p.x, y: p.y });
      // the hedgehog cloak pricks whoever lunged at you, hit or miss
      if (L.spikecloak && src && kind === 'melee') this.hurt(src, 4 + 2 * L.spikecloak, 'thorns');
      // 네잎 클로버: a near miss is lucky money
      if (L.luckycharm) this.addGold(2 + L.luckycharm);
      return false;
    }
    if (this.char.block && Math.random() < this.char.block) { this.emit('block', { x: p.x, y: p.y, from: { x: src.x, y: src.y } }); return false; }
    const roll = raw * (B.HIT_ROLL[0] + Math.random() * (B.HIT_ROLL[1] - B.HIT_ROLL[0]));
    let dmg = Math.max(1, Math.round(roll) + rnd(2) - s.def);
    // 강철 심장: with a third of your health or less, blows glance off at half strength
    if (L.ironheart && p.hp <= s.maxHp / 3) { dmg = Math.max(1, Math.ceil(dmg / 2)); this.emit('iron', { x: p.x, y: p.y }); }
    this.hurtPlayer(dmg, `${src.d.name}에게 당했다`, kind);
    if (src && (kind === 'melee' || kind === 'charge')) {
      const thorn = (L.fortress ? 4 + 2 * L.fortress : 2 * (L.thorns || 0)) + (L.spikecloak ? 4 + 2 * L.spikecloak : 0);
      if (thorn) this.hurt(src, thorn, 'thorns');
      if (L.embermail && src.hp > 0) { this.hurt(src, 3 + L.embermail, 'fire'); if (src.hp > 0) setBurn(this, src, 3); }
      if (src.type === 'lord' && src.hp > 0) src.hp = Math.min(src.maxHp, src.hp + dmg);
    }
    return true;
  }

  // Damage that ignores defence and dodging (fire, gas, falling rocks, your own bomb...)
  hurtPlayer(dmg, cause, kind = 'env') {
    const p = this.p;
    if (p.hp <= 0) return;
    const before = p.hp;
    p.hp -= dmg;
    // hanging on: one blow never takes you from a good share of your health straight to the floor
    const hung = p.hp <= 0 && before > this.stat().maxHp * B.HANG_ON;
    if (hung) p.hp = 1;
    this.cause = cause;
    if (p.sleep) { p.sleep = 0; p.wokeAt = this.turn; this.log('아파서 잠이 확 깼다!', 'warn'); }
    this.emit('phit', { x: p.x, y: p.y, dmg: hung ? before - 1 : dmg, kind });
    if (hung) {
      this.log('으윽... 간신히 버텼다! 한 대만 더 맞으면 끝이다.', 'warn');
      this.emit('hangon', { x: p.x, y: p.y });
    }
    const L = this.levels(), maxHp = this.stat().maxHp;
    const lives = (L.eternity ? 2 : L.undying ? 1 : 0) + (L.bloodking ? 1 : 0), band = L.herbal ? 6 + 4 * L.herbal : 6 * (L.bandage || 0);
    if (p.hp <= 0 && (this.revives || 0) < lives) {
      this.revives = (this.revives || 0) + 1;
      p.hp = 0;
      this.heal(Math.round(maxHp / 2));
      const heart = this.revives <= (L.eternity ? 2 : L.undying ? 1 : 0) ? RELICS[L.eternity ? 'eternity' : 'undying'].name : RELICS.bloodking.name;
      this.log(`${heart}의 힘으로 쓰러졌다가 다시 일어났다.`, 'evo');
      this.emit('banner', { text: `${heart}!` });
    } else if (p.hp > 0 && band && this.bandageUsed < (L.herbal ? 2 : 1) && p.hp < maxHp / 3) {
      this.bandageUsed++;
      this.heal(band);
      this.log('비상 붕대를 감았다.', 'good');
    }
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
  // Wakes and draws enemies within r. Returns the ones that heard it and are now coming to look.
  noise(x, y, r) {
    let woke = 0;
    const heard = [];
    for (const e of this.enemies) {
      if (e.hp <= 0 || cheb(e, { x, y }) > r) continue;
      const before = e.state;
      if (rouse(this, e, 'noise', x, y)) woke++;
      if (e.state === 'search' && before !== 'search') heard.push(e);
    }
    if (woke) this.discover('noise_sleep');
    return heard;
  }

  // The first time a grade of ore turns up at all, it goes in the ore book.
  meetOre(tier) {
    const g = ORES[tier];
    if (g.id in this.meta.ores) return;
    this.meta.ores[g.id] = 0;
    this.emit('newOre', { tier });
  }

  // Goes in the book in town. Common-sense ones (and ones the effects already show, `quiet`) say nothing.
  discover(id, quiet) {
    if (this.meta.found[id] || this.over) return;
    const d = DISCOVERIES.find(x => x.id === id);
    if (!d) return;
    this.meta.found[id] = true;
    this.found.push(id);
    this.emit('discover', { id, d });
    if (!quiet && !d.basic) this.log(`새 발견! ${d.combo}: ${d.result}`, 'evo');
  }

  // ---------- turn ----------
  endTurn() {
    const p = this.p, L = this.levels(), quick = this.quick;
    this.quick = false;
    this.turn++;
    if (p.shade > 0) p.shade--;
    if (!this.char.noRegen && this.turn % B.REGEN_TURNS === 0 && p.hp > 0 && p.hp < this.stat().maxHp) p.hp++;
    if (L.goldbolt && this.turn % (L.goldstorm ? 2 : 3) === 0) this.zap(L.goldbolt + 1 + (L.goldstorm ? 1 : 0), 6 + 2 * L.goldbolt);
    else if (L.bolt && this.turn % 6 === 0) this.zap(1, 4 * L.bolt);
    if (L.thunder && this.turn % (L.godhammer ? 1 : L.stormlord ? 2 : 4) === 0) this.zap(L.thunder + 1, 6 + 2 * L.thunder);
    if (L.sunlamp && this.turn % 3 === 0) this.sunbeam(L.sunlamp < 3 ? 1 : 2, 4 + 2 * L.sunlamp);
    const every = L.eclipse ? 3 : L.meteor ? 10 - 2 * L.meteor : 0;
    if (every && this.turn % every === 0) this.meteor(10 + 5 * (L.meteor || 1));
    // the quickest of the healing relics you hold
    const regen = Math.min(...[L.lifetree && (L.lifetree < 2 ? 2 : 1), L.herbal && [3, 2, 2][L.herbal - 1], L.moss && [6, 4, 2][L.moss - 1],
      L.pillow && [4, 3, 2][L.pillow - 1]].filter(Boolean), Infinity);
    if (regen < Infinity && this.turn % regen === 0) this.heal(1);

    // doors shut the moment nobody stands in them, so a chaser right behind you loses sight of you
    // as you step through (the Shattered Pixel Dungeon door ambush)
    this.refreshDoors();
    const dm = distMap(this.map, p.x, p.y);
    if (!quick) for (const e of this.enemies.slice()) {
      if (e.hp > 0 && p.hp > 0) enemyAct(this, e, dm);
    }
    if (p.hp > 0) envTick(this);
    this.enemies = this.enemies.filter(e => e.hp > 0);
    if (p.hp > 0) { this.chatter(); spotTraps(this); }
    this.magnetize();
    this.respawnTick();
    this.afterTurn();
  }

  // the magnet relics pull in gold you can see
  magnetize() {
    const r = this.stat().magnet, p = this.p;
    if (!r) return;
    for (const q of this.pickups.filter(q => q.type === 'gold' && cheb(q, p) <= r && this.isVisible(q.x, q.y))) {
      this.pickups.splice(this.pickups.indexOf(q), 1);
      this.emit('pickup', { x: q.x, y: q.y, type: 'gold' });
      this.addGold(q.amount);
    }
  }

  // 부엉이 눈: a sleeping monster out of sight but not far is felt through the walls
  sensed(e) { return e.state === 'sleep' && !this.isVisible(e.x, e.y) && cheb(e, this.p) <= 12 && this.lv('owleye') > 0; }

  // a peaceful monster nobody has picked a fight with yet
  calm(e) { return !!e.d.peaceful && !e.angry; }

  // Like Shattered Pixel Dungeon: once you thin a floor out, a new enemy wanders in now and then,
  // somewhere out of sight, and roams until it runs into you.
  respawnTick() {
    if (isBossFloor(this.floor) || this.over) return;
    const hostile = this.enemies.filter(e => !e.d.peaceful && !e.d.gimmick).length;
    if (hostile >= B.enemiesPerFloor(this.floor)) { this.respawnT = 0; return; }
    if (++this.respawnT < B.RESPAWN_TURNS) return;
    const spot = this.hiddenSpot();
    if (!spot) return;
    this.respawnT = 0;
    this.spawnEnemy(pick(this.zone.enemies), spot.x, spot.y, B.enemyScale(this.floor)).state = 'wander';
  }

  // Where a monster answering the ore comes from: out of sight, a good walk from the ore.
  waveSpot(ore) {
    const map = this.map, dm = distMap(map, ore.x, ore.y, { block: (x, y) => !this.canEnemyEnter(x, y) });
    const spots = [];
    for (let i = 0; i < dm.length; i++) {
      if (dm[i] < 8 || dm[i] > 20 || map.visible[i] || map.tiles[i] !== FLOOR) continue;
      const x = i % map.w, y = (i / map.w) | 0;
      if (!this.enemyAt(x, y) && !map.fire[i]) spots.push({ x, y });
    }
    return pick(spots) || null;
  }

  hiddenSpot() {
    const map = this.map;
    for (let t = 0; t < 300; t++) {
      const x = rnd(map.w), y = rnd(map.h), i = idx(x, y);
      if (map.tiles[i] !== FLOOR || map.visible[i] || cheb({ x, y }, this.p) < 10) continue;
      if (!this.canEnemyEnter(x, y) || map.fire[i] || map.gas.sleep[i] > 0.5) continue;
      return { x, y };
    }
    return null;
  }

  zap(count, dmg) {
    const targets = this.enemies
      .filter(e => e.hp > 0 && this.isVisible(e.x, e.y) && !this.calm(e) && e.state !== 'hide' && e.state !== 'stone')
      .sort((a, b) => cheb(a, this.p) - cheb(b, this.p))
      .slice(0, count);
    const hit = new Set();
    for (const e of targets) this.zapHit({ x: this.p.x, y: this.p.y }, e, dmg, hit);
  }

  // A rock from the sky onto the nearest enemy you can see, and a share of it on whoever stands beside it.
  meteor(dmg) {
    const e = this.enemies
      .filter(e => e.hp > 0 && this.isVisible(e.x, e.y) && !this.calm(e) && e.state !== 'hide' && e.state !== 'stone' && !e.d.npc)
      .sort((a, b) => cheb(a, this.p) - cheb(b, this.p))[0];
    if (!e) return;
    this.emit('meteor', { x: e.x, y: e.y });
    for (const o of this.enemies.filter(o => o.hp > 0 && cheb(o, e) <= 1 && !o.d.npc)) this.hurt(o, o === e ? dmg : Math.ceil(dmg / 2), 'fire');
  }

  // Sunlight through a crack in the ceiling onto the nearest enemies you can see, and they catch fire.
  sunbeam(count, dmg) {
    const targets = this.enemies
      .filter(e => e.hp > 0 && this.isVisible(e.x, e.y) && !this.calm(e) && e.state !== 'hide' && e.state !== 'stone' && !e.d.npc)
      .sort((a, b) => cheb(a, this.p) - cheb(b, this.p))
      .slice(0, count);
    for (const e of targets) {
      this.emit('sunbeam', { x: e.x, y: e.y });
      this.hurt(e, dmg, 'fire');
      if (e.hp > 0) setBurn(this, e, 2);
    }
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

  // Now and then, while nothing is after you, you overhear a nearby enemy. Once per floor at most.
  chatter() {
    const p = this.p;
    if (this.overheard || Math.random() > 0.05) return;
    if (this.enemies.some(e => e.hp > 0 && (e.state === 'hunt' || e.state === 'flee'))) return;
    const near = this.enemies.filter(e => e.hp > 0 && !e.d.boss && cheb(e, p) >= 2 && cheb(e, p) <= 5 && this.isVisible(e.x, e.y));
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
    computeFOV(this.map, this.p.x, this.p.y, this.stat().sight);
    if (this.p.hp <= 0) { this.p.hp = 0; this.finish(false); return; }
    if (this.victory) { this.finish(true); return; }
    this.emit('turn');
    this.spotVeins();
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
        if (hit) { this.hurtPlayer(10 + this.floor, '버섯 왕의 버섯 망치에 맞았다', 'slam'); this.log('버섯 왕의 내려치기에 맞았다!', 'warn'); }
        else this.log('내려치기를 피했다!', 'good');
        return true;
      }
      if (e.timer % 4 === 0) {
        e.slam = true;
        this.telegraph = [];
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          if (passable(this.map, p.x + i, p.y + j)) this.telegraph.push({ x: p.x + i, y: p.y + j });
        }
        this.log('버섯 왕이 커다란 버섯 망치를 들어 올렸다. 붉은 칸에서 벗어나야 한다!', 'warn');
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
        this.log('박쥐 대왕이 순간이동해 조준하고 있다!', 'warn');
        return true;
      }
    }
    return false;
  }

  // ---------- relic choices ----------
  relicAvailable(id) { return !RELICS[id].locked || this.meta.relicUnlock[id]; }

  offers(n = 3) {
    n += (this.char.choices || 3) - 3;
    const rl = this.p.relics, full = Object.keys(rl).length >= MAX_SLOTS, known = this.meta.recipes, have = this.levels();
    const pool = Object.keys(RELICS).filter(id => {
      if (rl[id]) return rl[id] < maxLevelOf(id);
      if (tierOf(id) > 0 || full) return false;
      // nothing new could come of it: everything it goes into, you already have
      const uses = recipesWith(id);
      if (uses.length && uses.every(rc => have[rc.id])) return false;
      return this.relicAvailable(id);
    });
    // like Vampire Survivors, one card usually helps what you already have: a level, or the partner
    // in a recipe you have found before. Recipes you haven't found are never shown, but the mine is
    // kind: now and then a card is quietly the other half of something you are growing (Lv2 and up).
    const grows = id => rl[id] || recipesWith(id).some(rc => known[recipeKey(rc)] && rl[rc.a === id ? rc.b : rc.a]);
    const partners = pool.filter(id => !rl[id] && recipesWith(id).some(rc => (rl[rc.a === id ? rc.b : rc.a] || 0) >= 2));
    const growth = pool.filter(grows), ids = [];
    if (growth.length && Math.random() < 0.75) ids.push(pick(growth));
    if (partners.length && Math.random() < B.PARTNER_CHANCE) { const id = pick(partners); if (!ids.includes(id)) ids.push(id); }
    for (const id of shuffle(pool.slice())) if (ids.length < n && !ids.includes(id)) ids.push(id);
    const res = shuffle(ids).map(id => ({ kind: 'relic', id }));
    // like BALL x PIT's fission: now and then a card that grows two of yours at once
    const growing = Object.keys(rl).filter(id => rl[id] < maxLevelOf(id));
    if (growing.length >= 2 && Math.random() < B.TWIN_CHANCE) {
      const [a, b] = shuffle(growing);
      res.splice(rnd(res.length), 1, { kind: 'twin', a, b });
    }
    // two maxed relics that make nothing together can still be fused into one slot
    const pair = this.fusablePair(!full);
    if (pair && (full || Math.random() < 0.35)) {
      if (res.length >= n) res.pop();
      res.push({ kind: 'fuse', a: pair[0], b: pair[1] });
    }
    if (res.length < n) res.push({ kind: 'heal' });
    if (res.length < n) res.push({ kind: 'gold' });
    return res;
  }

  // Two relics at full level that are no recipe together (and not fused or myths already).
  // `basicOnly`: while there is room, evolved relics are kept for the legends they could become.
  fusablePair(basicOnly) {
    const rl = this.p.relics;
    const ready = Object.keys(rl).filter(id => !isFused(id) && tierOf(id) < (basicOnly ? 1 : 3) && rl[id] >= MAX_LEVEL);
    const pairs = [];
    for (let i = 0; i < ready.length; i++) for (let j = i + 1; j < ready.length; j++) {
      const a = ready[i], b = ready[j];
      if (!RECIPES.some(rc => (rc.a === a && rc.b === b) || (rc.a === b && rc.b === a))) pairs.push([a, b]);
    }
    return pairs.length ? pick(pairs) : null;
  }

  // The recipe a relic card would set off at once, but only one you have found before: an unknown
  // recipe stays a surprise.
  evolvesWith(id) {
    const rl = { ...this.p.relics, [id]: (this.p.relics[id] || 0) + 1 };
    const ready = r => rl[r] && (tierOf(r) > 0 || rl[r] >= MAX_LEVEL);
    return RECIPES.find(rc => (rc.a === id || rc.b === id) && !rl[rc.id] && ready(rc.a) && ready(rc.b) && this.meta.recipes[recipeKey(rc)]) || null;
  }

  // Called by the UI after the player picks one of `offers()`.
  choose(o) {
    this.queue.shift();
    if (o.kind === 'heal') this.heal(Math.round(this.stat().maxHp * 0.5));
    else if (o.kind === 'gold') this.addGold(o.amount || 25);
    else if (o.kind === 'relic') this.gainRelic(o.id);
    else if (o.kind === 'fuse') this.fuse(o.a, o.b);
    else if (o.kind === 'twin') for (const id of [o.a, o.b]) if (this.p.relics[id] && this.p.relics[id] < maxLevelOf(id)) this.gainRelic(id);
    this.emit('relics');
  }

  gainRelic(id) {
    const rl = this.p.relics;
    this.withMaxHpDelta(() => { rl[id] = (rl[id] || 0) + 1; });
    this.log(`${RELICS[id].name} Lv${rl[id]}`, 'good');
    this.checkRecipes();
    this.emit('relics');
  }

  fuse(a, b) {
    const rl = this.p.relics, id = fusedId(a, b);
    this.withMaxHpDelta(() => { delete rl[a]; delete rl[b]; rl[id] = 1; });
    this.meta.stats.fusions = (this.meta.stats.fusions || 0) + 1;
    this.log(`합체! ${relicName(id)}`, 'evo');
    this.emit('evolve', { id, tier: 0, fused: true, x: this.p.x, y: this.p.y });
  }

  // A pickup beside (x, y): the first free floor tile around it, or right there.
  dropNear(x, y, q) {
    const t = DIRS8.map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
      .find(t => this.passable(t.x, t.y) && this.map.tiles[idx(t.x, t.y)] === FLOOR && !isTrap(this.map.ter[idx(t.x, t.y)]) && !this.pickups.some(o => o.x === t.x && o.y === t.y));
    this.pickups.push({ ...(t || { x, y }), ...q });
  }

  // 별사탕, BALL x PIT's fission: several of your relics grow one after another (다다다닥), and whatever
  // that completes evolves at the end. A relic whose recipe partner you also hold is likelier to be
  // picked, so a candy tends to finish something (nothing on screen says which). With nothing left to
  // grow, a step pays gold.
  fission(n, x, y) {
    const rl = this.p.relics, steps = [];
    let gold = 0;
    for (let k = 0; k < n; k++) {
      const ids = Object.keys(rl).filter(id => rl[id] < maxLevelOf(id));
      if (!ids.length) { gold += 6 + 4 * Math.floor((this.floor - 1) / B.FLOORS_PER_ZONE); steps.push({ gold: true }); continue; }
      const w = ids.map(id => (recipesWith(id).some(rc => rl[rc.a === id ? rc.b : rc.a]) ? 3 : 1));
      let r = Math.random() * w.reduce((a, b) => a + b, 0), id = ids[0];
      for (let i = 0; i < ids.length; i++) if ((r -= w[i]) < 0) { id = ids[i]; break; }
      this.withMaxHpDelta(() => { rl[id]++; });
      steps.push({ id, lvl: rl[id] });
    }
    this.meta.stats.candies = (this.meta.stats.candies || 0) + 1;
    const grown = steps.filter(t => t.id).map(t => `${RELICS[t.id].name} Lv${t.lvl}`);
    this.log(`별사탕! ${grown.length ? grown.join(', ') : '더 자랄 유물이 없다'}`, 'evo');
    this.emit('fission', { x, y, steps });
    if (gold) this.addGold(gold);
    this.checkRecipes();
    this.emit('relics');
  }

  // Any recipe you now hold the two halves of goes off by itself, the first time as a discovery.
  checkRecipes() {
    const rl = this.p.relics, ready = id => rl[id] && (tierOf(id) > 0 || rl[id] >= MAX_LEVEL);
    for (let again = true; again;) {
      again = false;
      for (const rc of RECIPES) {
        if (rl[rc.id] || !ready(rc.a) || !ready(rc.b)) continue;
        this.withMaxHpDelta(() => { delete rl[rc.a]; delete rl[rc.b]; rl[rc.id] = 1; });
        const key = recipeKey(rc), first = !this.meta.recipes[key], tier = tierOf(rc.id);
        this.meta.recipes[key] = true;
        this.meta.stats.evos++;
        if (first) { this.newRecipes.push(key); this.gold += DISCOVERY_GOLD[tier]; }
        this.log(`${['', '진화', '전설', '신화'][tier]}! ${RELICS[rc.a].name} + ${RELICS[rc.b].name} → ${RELICS[rc.id].name}`, 'evo');
        this.emit('evolve', { id: rc.id, a: rc.a, b: rc.b, tier, first, known: RECIPES.filter(r => this.meta.recipes[recipeKey(r)]).length, x: this.p.x, y: this.p.y });
        again = true;
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
