// One trip into the dungeon. Holds all run state and the turn rules.
// It never touches the screen: it emits events that the scene and HUD listen to.
// Enemy behaviour lives in ai.js, fire/gas/explosions in world.js.

import * as B from '../data/balance.js';
import { RELICS, EVOLUTIONS, LEGENDS, MAX_LEVEL, MAX_SLOTS } from '../data/relics.js';
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
import { onEnter, explosion, envTick, waterBody, ignite, addGas, spotTraps, revealTraps, openGrave } from './world.js';

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
    const rl = this.p.relics, ch = this.char, up = this.meta.up;
    const lv = id => rl[id] || 0;
    return {
      atk: ch.atk + up.atk + 2 * lv('blade') + (rl.flamesword ? 8 : 0) + (rl.volcano ? 10 : 0),
      def: ch.def + lv('shield') + (rl.fortress ? 5 : 0) + (rl.undying ? 6 : 0),
      maxHp: ch.hp + up.hp * 4 + 8 * lv('heart') + (rl.bloodcrown ? 30 : 0) + (rl.undying ? 40 : 0) + (this.p.lvl - 1) * B.HP_PER_LEVEL,
      goldMult: 1 + 0.4 * lv('coin') + (rl.goldbolt ? 1.5 : 0) + (rl.goldstorm ? 2 : 0) + 0.1 * up.greed,
      dodge: (ch.dodge || 0) + 0.08 * lv('cloak') + (rl.shadow ? 0.3 : 0),
      sneak: rl.shadow ? 4 : 2 + 0.5 * lv('boots'),           // damage multiplier on a surprise attack
      sight: B.SIGHT + lv('lantern'),
      oreMult: rl.goldrush || rl.goldstorm ? 3 : 1 + 0.5 * lv('pick'),
      oreRise: rl.goldrush || rl.goldstorm ? 0.25 : 0.05 * lv('pick'),   // extra chance a swing finds a better grade
      magnet: rl.goldstorm ? 5 : rl.goldrush ? 4 : rl.magnet ? rl.magnet + 1 : 0,
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
    this.respawnT = 0;
    if (isBossFloor(this.floor)) this.genBossFloor();
    else this.genNormalFloor();
    this.enterFloor();
  }

  enterFloor() {
    this.telegraph = [];
    this.trail = [{ x: this.p.x, y: this.p.y }];
    this.bandageUsed = false;
    this.refreshDoors();
    computeFOV(this.map, this.p.x, this.p.y, this.stat().sight);
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
    if (map.ore) map.ore.tier = Math.min(ORES.length - 1, zi + (Math.random() < B.ORE_START_BONUS ? 1 : 0));

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
        const e = this.spawnEnemy(pick(this.zone.enemies), s.x, s.y, scale);
        e.state = Math.random() < B.START_ASLEEP ? 'sleep' : 'wander';
      });
    }
    if (Math.random() < B.TURTLE_CHANCE) {
      place(s => { this.spawnEnemy('turtle', s.x, s.y, scale).state = Math.random() < 0.5 ? 'sleep' : 'wander'; });
    }
    for (let i = 0, n = rint(5, 7); i < n; i++) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'gold', amount: (zi + 1) * rint(3, 7) }));
    place(s => this.addChest(s.x, s.y));
    if (this.floor === 1) place(s => this.addChest(s.x, s.y));
    if (Math.random() < 0.6) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'potion' }));
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
    this.log('쓰러뜨리기 전에는 위층으로 돌아갈 수 없다.');
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
      if (this.p.relics.bombbag) { this.p.items.bomb++; this.log('폭탄 가방에서 폭탄을 하나 꺼냈다.', 'good'); }
    }
    this.emit('banner', { text: isBossFloor(this.floor) ? `${this.floor}층 · 보스` : `${this.floor}층 · ${this.zone.name}` });
    this.log(dir > 0 ? `${this.floor}층에 내려왔다.` : `${this.floor}층으로 올라왔다.`);
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
    if (map.tiles[i] === ORE) return this.mineOre();
    if (map.tiles[i] === GRAVE) { openGrave(this, nx, ny); this.endTurn(); return true; }
    if (map.tiles[i] === LOCKED) return this.unlock(nx, ny);
    if (!this.passable(nx, ny)) return false;
    p.x = nx; p.y = ny;
    this.trail.push({ x: nx, y: ny });
    if (this.trail.length > 40) this.trail.shift();
    onEnter(this, 'player', nx, ny);
    this.pickupAt(nx, ny);
    if (map.tiles[i] === STAIRS) { this.changeFloor(1); return true; }
    if (map.tiles[i] === UPSTAIRS) { this.changeFloor(-1); return true; }
    this.endTurn();
    return true;
  }

  wait() {
    if (!this.canAct()) return false;
    this.endTurn();
    return true;
  }

  // Bump a locked door: the floor's key opens it.
  unlock(x, y) {
    const map = this.map, i = idx(x, y);
    if (!map.keyHeld) {
      this.log('잠겨 있다. 이 층 어딘가에 열쇠가 있을 것이다.');
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
    const ids = Object.keys(rl).filter(id => !RELICS[id].evo && rl[id] < MAX_LEVEL);
    return ids.length ? ids.map(id => ({ kind: 'relic', id })) : [{ kind: 'gold', name: '덩어리 값', amount: 60 }];
  }

  // Bump the big ore to mine it. Every swing pays a little more than the last, is louder,
  // and makes the crack beside it puff mine gas. A swing may crack into a better grade
  // underneath, or hit a bonanza. The last swing breaks it wide open.
  mineOre() {
    const map = this.map, ore = map.ore, p = this.p, s = this.stat();
    ore.hits++;
    const k = ore.hits - 1, last = ore.hits >= B.ORE_HITS, top = ORES.length - 1;
    if (ore.hits === 1) this.meetOre(ore.tier);
    const nugget = !last && Math.random() < B.ORE_NUGGET[k];
    const above = Math.max(0, ore.tier - Math.floor((this.floor - 1) / B.FLOORS_PER_ZONE));
    const rise = B.ORE_RISE[k] * B.ORE_RISE_DECAY ** above + s.oreRise;
    const rose = !last && ore.tier < top && (nugget || Math.random() < rise);
    if (rose) { ore.tier++; this.meetOre(ore.tier); }
    const g = ORES[ore.tier];
    const r = B.ORE_NOISE[k] + (nugget ? 2 : 0);
    let gold;
    if (!last) gold = Math.round(B.oreGold(this.floor) * g.mult * B.ORE_SWING[k] * s.oreMult * (nugget ? B.ORE_NUGGET_MULT : 1));
    this.emit('mine', { x: ore.x, y: ore.y, from: { x: p.x, y: p.y }, hits: ore.hits, r, last, tier: ore.tier, rose, nugget });
    for (const v of map.vents) addGas(this, v.x, v.y, 'mine', B.ORE_GAS);
    if (!last) {
      this.addGold(gold);
      if (nugget) this.log(`노다지! ${g.name} 덩어리가 와르르 쏟아졌다!`, 'good');
      else if (rose) this.log(`쩡! 속에서 ${josa(g.name, '이', '가')} 비친다! (${ore.hits}/${B.ORE_HITS})`, 'good');
      else this.log(`캉! ${g.name} 조각이 떨어졌다. (${ore.hits}/${B.ORE_HITS})`);
    } else {
      const i = idx(ore.x, ore.y);
      map.tiles[i] = FLOOR;
      map.ore = null;
      this.meta.ores[g.id] = (this.meta.ores[g.id] || 0) + 1;
      this.pickups.push({ x: ore.x, y: ore.y, type: 'gold', amount: Math.round(B.oreJackpot(this.floor) * g.mult * s.oreMult) });
      this.pickups.push({ x: ore.x, y: ore.y, type: 'chest' });
      this.log(`쩌억! 큰 ${g.name} 광석이 통째로 쏟아졌다!`, 'good');
      this.discover('ore_jackpot');
      // the blacksmith on this floor wants a chunk of it
      const smith = this.quests.smith;
      if (this.floor === smith.floor && smith.state !== 'done') {
        smith.chunk = ore.tier;
        this.log(`큰 ${g.name} 덩어리를 하나 챙겼다.${smith.state === 'asked' ? ' 대장장이에게 가져가자.' : ''}`, 'good');
      }
      this.emit('tiles', { list: [i] });
    }
    const heard = this.noise(ore.x, ore.y, r);
    if (heard.length) {
      this.emit('heard', { x: p.x, y: p.y, list: heard });
      this.log(`${heard.length}마리가 소리를 듣고 깼다!`, 'warn');
    }
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
      this.log(`지도를 펼쳤다. 계단 위치가 보인다.${traps ? ` 숨은 함정 ${traps}개도 표시돼 있다.` : ''}`, 'good');
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
    const bag = this.p.relics.bombbag || 0;
    explosion(this, x, y, 1, { dmg: Math.round(B.bombDamage(this.floor) * (1 + 0.25 * Math.max(0, bag - 1))), cause: '내가 던진 폭탄에 휘말렸다' });
    this.endTurn();
    return true;
  }

  pickupAt(x, y) {
    const map = this.map;
    for (const q of this.pickups.filter(q => q.x === x && q.y === y)) {
      if (q.type === 'lockedChest' && !map.keyHeld) { this.log('잠긴 상자다. 이 층 어딘가에 열쇠가 있을 것이다.'); continue; }
      this.pickups.splice(this.pickups.indexOf(q), 1);
      this.emit('pickup', { x, y, type: q.type });
      if (q.type === 'gold') this.addGold(q.amount);
      else if (q.type === 'chest') {
        this.queue.push({ kind: 'chest' });
        this.log('보물 상자를 열었다!', 'good');
        if (q.guarded) this.wakeStatues(x, y);
      } else if (q.type === 'lockedChest') {
        map.keyHeld = false;
        this.queue.push({ kind: 'chest', rich: true });
        this.log('열쇠로 잠긴 상자를 열었다!', 'good');
      } else if (q.type === 'key') {
        map.keyHeld = true;
        this.log('작은 열쇠를 주웠다. 이 층의 잠긴 곳을 연다.', 'good');
      } else if (q.type === 'crystal') this.takeCrystal(q);
      else if (q.type === 'necklace') {
        this.quests.ghost.state = 'found';
        this.log('반짝돌 목걸이를 찾았다! 유령 광부에게 돌려주자.', 'good');
      } else { this.p.items[q.type]++; this.log(`${josa(ITEMS[q.type].name, '을', '를')} 주웠다.`); }
    }
  }

  // A relic from a crystal vault: the other crystals of that vault shatter.
  takeCrystal(q) {
    const rl = this.p.relics, id = q.relic;
    const fits = rl[id] ? rl[id] < MAX_LEVEL : Object.keys(rl).length < MAX_SLOTS;
    if (fits) this.gainRelic(id);
    else { this.addGold(40); this.log('유물을 더 담을 수 없어서 수정이 골드로 부서졌다.'); }
    for (const o of this.pickups.filter(o => o.type === 'crystal' && o.vault === q.vault)) {
      this.pickups.splice(this.pickups.indexOf(o), 1);
      this.emit('shatter', { x: o.x, y: o.y });
    }
    this.log('나머지 수정은 산산조각 났다.');
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
    const s = this.stat(), rl = this.p.relics, lv = id => rl[id] || 0;
    const base = s.atk + rnd(2);
    if (this.unaware(e)) {
      this.emit('sneak', { x: e.x, y: e.y });
      this.log(`${e.state === 'sleep' ? '자고 있는 ' : ''}${e.d.name}에게 기습! 피해 ×${s.sneak}`, 'good');
      this.strike(e, Math.round(base * s.sneak), 'sneak');
    } else this.strike(e, base, 'normal');
    // the swing carries on into everyone else standing next to you
    const quake = rl.quake || rl.volcano, sweep = lv('sweep');
    if (quake || sweep) {
      for (const o of this.enemies.filter(o => o !== e && o.hp > 0 && this.touching(o, this.p))) {
        this.emit('attack', { from: { x: this.p.x, y: this.p.y }, to: { x: o.x, y: o.y }, who: 'player' });
        this.strike(o, quake ? base : Math.max(1, Math.round(base * 0.3 * sweep)), 'normal');
      }
    }
  }

  // One blow from you: defence, then the relics that ride along with every hit.
  strike(e, raw, kind) {
    const rl = this.p.relics;
    this.hurt(e, Math.max(1, raw - e.def), kind);
    if (e.hp <= 0) return;
    let fire = 0;
    if (rl.flamesword || rl.volcano) fire = 5;
    else if (rl.ring && Math.random() < 0.3) fire = 3 * rl.ring;
    if (fire) {
      this.hurt(e, fire, 'fire');
      const t = this.map.ter[idx(e.x, e.y)];
      if (t === T.BRUSH) ignite(this, e.x, e.y);
    }
    const stun = rl.quake || rl.volcano ? 0.3 : 0.15 * (rl.hammer || 0);
    if (e.hp > 0 && !e.d.boss && Math.random() < stun) { e.stun = 1; this.emit('stun', { x: e.x, y: e.y }); }
  }

  hurt(e, dmg, kind) {
    if (e.hp <= 0 || e.d.npc) return;
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
        this.map.down = { x: e.x, y: e.y };
        this.emit('stairs', { x: e.x, y: e.y });
        const up = this.map.up;
        this.map.tiles[idx(up.x, up.y)] = UPSTAIRS;
        this.map.ter[idx(up.x, up.y)] = T.NONE;
        this.emit('stairs', { x: up.x, y: up.y });
        this.log('내려가는 계단이 나타나고, 위층으로 가는 길도 열렸다.', 'good');
      }
      this.addGold(30 * (this.floor / 3));
    } else if (e.d.treasure) {
      this.pickups.push({ x: e.x, y: e.y, type: 'chest' }, { x: e.x, y: e.y, type: 'gold', amount: B.turtleGold(this.floor) });
      this.log(`${josa(e.d.name, '이', '가')} 등에 지고 있던 보물을 떨궜다!`, 'good');
    } else if (e.d.quest) {
      this.pickups.push({ x: e.x, y: e.y, type: 'necklace' });
      this.log('도둑 쥐가 반짝돌 목걸이를 떨궜다!', 'good');
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
      const thorn = rl.undying ? 10 : rl.fortress ? 8 : 2 * (rl.thorns || 0);
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
    const rl = p.relics, maxHp = this.stat().maxHp;
    if (p.hp <= 0 && rl.undying && !this.revived) {
      this.revived = true;
      p.hp = 0;
      this.heal(Math.round(maxHp / 2));
      this.log('불사의 심장이 뛴다! 쓰러졌다가 다시 일어났다.', 'evo');
      this.emit('banner', { text: '불사의 심장!' });
    } else if (p.hp > 0 && rl.bandage && !this.bandageUsed && p.hp < maxHp / 3) {
      this.bandageUsed = true;
      this.heal(6 * rl.bandage);
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
    this.emit('banner', { text: `새 광석! ${g.name}` });
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
    if (rl.goldstorm && this.turn % 2 === 0) this.zap(4, 12);
    else if (rl.goldbolt && this.turn % 3 === 0) this.zap(3, 10);
    else if (rl.bolt && this.turn % 6 === 0) this.zap(1, 4 * rl.bolt);
    if (rl.moss && this.turn % [6, 4, 2][rl.moss - 1] === 0) this.heal(1);

    const dm = distMap(this.map, p.x, p.y);
    for (const e of this.enemies.slice()) {
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
    // like Vampire Survivors, one card usually helps what you already have (a level, or an evolution partner),
    // so evolutions stay within reach even with many relics in the pool
    const grows = id => rl[id] || EVOLUTIONS.some(ev => (ev.a === id && rl[ev.b]) || (ev.b === id && rl[ev.a]));
    const growth = pool.filter(grows), ids = [];
    if (growth.length && Math.random() < 0.75) ids.push(pick(growth));
    for (const id of shuffle(pool.slice())) if (ids.length < n && !ids.includes(id)) ids.push(id);
    const res = shuffle(ids).map(id => ({ kind: 'relic', id }));
    if (res.length < n) res.push({ kind: 'heal' });
    if (res.length < n) res.push({ kind: 'gold' });
    return res;
  }

  // Called by the UI after the player picks one of `offers()`.
  choose(o) {
    this.queue.shift();
    if (o.kind === 'heal') this.heal(Math.round(this.stat().maxHp * 0.5));
    else if (o.kind === 'gold') this.addGold(o.amount || 25);
    else if (o.kind === 'relic') this.gainRelic(o.id);
    this.emit('relics');
  }

  gainRelic(id) {
    const rl = this.p.relics;
    this.withMaxHpDelta(() => { rl[id] = (rl[id] || 0) + 1; });
    this.log(`${RELICS[id].name} Lv${rl[id]}`, 'good');
    this.checkEvolutions();
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
    for (const lg of LEGENDS) {
      if (rl[lg.a] && rl[lg.b] && !rl[lg.id]) {
        this.withMaxHpDelta(() => { delete rl[lg.a]; delete rl[lg.b]; rl[lg.id] = 1; });
        const first = !this.meta.legends[lg.id];
        this.meta.legends[lg.id] = true;
        this.log(`전설 탄생! ${RELICS[lg.a].name} + ${RELICS[lg.b].name} → ${RELICS[lg.id].name}${first ? ' (처음 만들었다!)' : ''}`, 'evo');
        this.emit('evolve', { id: lg.id, x: this.p.x, y: this.p.y });
        this.emit('banner', { text: `전설 탄생! ${RELICS[lg.id].name}` });
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
