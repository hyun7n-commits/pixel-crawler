// One trip into the dungeon. Holds all run state and the turn rules.
// It never touches the screen: it emits events that the scene and HUD listen to.
// Enemy behaviour lives in ai.js, fire/gas/explosions in world.js.

import * as B from '../data/balance.js';
import { RELICS, RECIPES, MAX_LEVEL, MAX_SLOTS, DISCOVERY_GOLD, tierOf, maxLevelOf, recipeKey, recipesWith, fusedId, isFused, fusedParts, relicName } from '../data/relics.js';
import { CHARACTERS } from '../data/characters.js';
import { PETS, peckGold, PECKS_PER_FIELD } from '../data/pets.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { ITEMS, TOOLS, ZONE_TOOL } from '../data/items.js';
import { ORES } from '../data/ores.js';
import { T, DISCOVERIES, GOSSIP, SLEEP_TALK, FLOOR_HINTS, SLEEP_MIN, isTrap, isPool, isGap } from '../data/terrain.js';
import { rnd, rint, pick, shuffle, cheb, josa, DIRS8 } from './util.js';
import {
  createMap, carveRooms, carveArena, idx, inMap, passable, squeeze, distMap, lineOfSight, computeFOV,
  FLOOR, STAIRS, ORE, UPSTAIRS, GRAVE, LOCKED, DOOR, HIVE, WEED,
} from './dungeon.js';
import { decorate, decorateArena, placeTraps, placeGrumps } from './decorate.js';
import { placeSpecials, SET_PIECES } from './specials.js';
import { carveChasms, fillPools } from './cliffs.js';
import { NPC_TEXT, PEDDLER_FLOORS, STALL } from '../data/npcs.js';
import { TAG_LINES } from '../data/lore.js';
import { ROUTES } from '../data/routes.js';
import { REQUESTS, pickRequest } from '../data/requests.js';
import { isOpen, openNew, RELIC_GATES } from '../data/unlocks.js';
import { caged, cleared, stageOpen, loopsOpen, loopFoe, loopGold, FRIENDS } from '../data/stages.js';
import { daresOn, daresOpen, dareGold } from '../data/dares.js';
import { enemyAct, rouse, awaken, angerSwarm, twist, inReach, canSee, brawl } from './ai.js';
import { onEnter, explosion, envTick, waterBody, ignite, addGas, spotTraps, revealTraps, openGrave, setBurn, springTrap } from './world.js';

export const zoneOf = floor => ZONES[Math.floor((floor - 1) / B.FLOORS_PER_ZONE)];
export const isBossFloor = floor => floor % B.FLOORS_PER_ZONE === 0;
export const BOMB_RANGE = 5;

export class Run {
  // `stage`: which zone this trip goes into (0-based, data/stages.js); `loop`: the 회차
  constructor(meta, charId, { stage = 0, loop = 1 } = {}) {
    this.meta = meta;
    this.charId = charId;
    this.char = CHARACTERS[charId];
    this.stage = stage;
    this.loop = loop;
    this.startFloor = stage * B.FLOORS_PER_ZONE + 1;
    this.bossFloor = this.startFloor + B.FLOORS_PER_ZONE - 1;
    this.floor = this.startFloor;
    this.dares = daresOn(meta);
    this.turn = 0;
    this.gold = 0;
    this.kills = 0;
    this.rerolls = meta.up.reroll;
    this.queue = [];        // pending choices: { kind: 'level' | 'kit' | 'chest' | 'talk', ... }
    this.over = false;
    this.victory = false;
    this.cause = '';        // what knocked you out, for the summary
    this.found = [];        // discoveries made this run
    this.newRecipes = [];   // recipes found for the first time this run
    this.newCritters = [];  // kinds of critter met for the first time this run
    this.told = {};         // one-time hints already shown
    this.floors = {};       // floors you left, kept as they were so you can go back for what you missed
    this.trail = [];        // your last steps on this floor; hunting enemies follow them
    // the two quest folk and the floor each one lives on
    const f0 = this.startFloor;
    this.quests = {
      ghost: { floor: f0 + rint(0, 1), state: 'idle' },              // idle -> asked -> found -> done
      smith: { floor: f0 + rint(1, 2), state: 'idle', chunk: null },  // chunk: grade of the big ore you broke there
      peddler: { met: false },
    };
    // a friend still locked up in this stage at this 회차 waits in a cage on the second or third field,
    // its key carried by a crowned 우두머리 (data/stages.js)
    this.friend = isOpen(meta, 'cage') ? caged(meta, stage, loop) : null;
    if (!CHARACTERS[this.friend]) this.friend = null;
    this.cageFloor = this.friend ? f0 + rint(1, 2) : 0;
    this.rescued = [];
    // the pet that comes along (data/pets.js)
    this.pet = meta.pet && meta.pets?.[meta.pet] && PETS[meta.pet] ? meta.pet : null;
    this.stall = [];
    this.request = isOpen(meta, 'request') ? pickRequest(meta, stage) : null;   // the guild's request of the day (data/requests.js)
    this.startStats = JSON.parse(JSON.stringify(meta.stats));
    this.listeners = [];
    this.p = {
      x: 0, y: 0, hp: 0, lvl: 1, xp: 0, face: 1,
      burn: 0, sleep: 0, stun: 0, wokeAt: -1,
      relics: { ...this.char.start },
      // 햄스터's cheek pouch packs more potions; 펭귄 sets off with a bag of bombs
      items: {
        potion: this.dare('nopotion') ? 0 : meta.up.pot + (this.char.pouch || 0), bomb: this.char.bombs || (isOpen(meta, 'bomb') ? 1 : 0), map: 0,
        ...Object.fromEntries(TOOLS.map(id => [id, 0])),
      },
      // 마법사's wand: sparks left, and turns since the last one came back
      charges: this.char.wand ? B.WAND_CHARGES : 0, wandT: 0,
    };
    // the relic packed in town for this run (paid for already)
    if (meta.pack && RELICS[meta.pack] && !tierOf(meta.pack)) {
      const id = meta.pack;
      this.p.relics[id] = Math.min(maxLevelOf(id), (this.p.relics[id] || 0) + 1);
      this.packed = id;
      meta.pack = null;
    }
    // what the smith made to order (ui/hub.js): out of the forge at Lv1, already paid for
    if (meta.forge && RELICS[meta.forge] && [1, 2].includes(tierOf(meta.forge))) {
      this.p.relics[meta.forge] = 1;
      this.forged = meta.forge;
      meta.forge = null;
    }
    // 출발 보급 (balance.js stageKit): the level now, the relic picks when the trip starts
    const kit = B.stageKit(stage);
    this.p.lvl = kit.lvl;
    this.kit = kit.picks;
    this.p.kitAtk = kit.atk;
    this.p.kitHp = kit.hp;
    this.p.hp = this.stat().maxHp;
    meta.stats.runs++;
    meta.stats.maxFloor = Math.max(meta.stats.maxFloor, this.floor);
  }

  // how many relics you can carry (가벼운 가방 takes two away)
  get slots() { return MAX_SLOTS - (this.dare('light') ? B.DARE_SLOTS : 0); }

  // is this rival's dare on for the trip (data/dares.js)
  dare(id) { return this.dares.includes(id); }
  // gold from everything picked up: the 회차 and the dares taken pay more
  get goldBonus() { return loopGold(this.loop) * dareGold(this.dares.length); }

  // ---------- events ----------
  on(fn) { this.listeners.push(fn); }
  emit(type, data = {}) {
    for (const fn of this.listeners) fn(type, data);
    // 소문 빠른 들판: a critter that spots you shouts, and the others round it come looking
    if (type === 'alert' && data.enemy.state === 'hunt' && this.dare('swarm') && !this.calling) {
      this.calling = true;
      this.noise(data.enemy.x, data.enemy.y, B.DARE_CALL);
      this.calling = false;
    }
    if (this.request && !this.request.done) this.trackRequest(type, data);
  }

  // the request of the day: count what it asks for, and pay the moment it is met
  trackRequest(type, d) {
    const q = this.request, c = REQUESTS[q.id].count(type, d, this);
    if (!c) return;
    q.got = c.set ?? q.got + 1;
    if (q.got < q.n) { this.emit('requestStep', q); return; }
    q.got = q.n;
    q.done = true;
    this.gold += q.pay;
    this.emit('gold', { x: this.p.x, y: this.p.y, n: q.pay });
    this.emit('request', q);
    this.log(`조합 의뢰 완료! ${q.text}. 일당 ${q.pay}G를 받았다.`, 'good');
  }
  log(text, cls) { this.emit('log', { text, cls }); }
  say(who, text) { this.emit('say', { who, text }); }

  // ---------- derived stats ----------
  stat() {
    const L = this.levels(), ch = this.char, up = this.meta.up, pet = PETS[this.pet] || {};
    const lv = id => L[id] || 0, on = id => lv(id) > 0;
    // `f(id, base, per)`: nothing without the relic, else base + per × level
    const f = (id, base, per) => (on(id) ? base + per * lv(id) : 0);
    const best = (...xs) => Math.max(...xs);
    const wet = ch.swim && this.inWater();
    return {
      atk: ch.atk + up.atk + (this.p.kitAtk || 0) + (wet ? 3 : 0) + 2 * lv('blade') + f('flamesword', 4, 2) + 2 * lv('volcano') + (on('minecrown') ? 5 : 0) +
        f('bloodblade', 3, 1) + f('whirl', 4, 1) + f('dagger', 2, 1) + lv('giantfist') + 2 * lv('bloodmoon') + lv('stormlord') + lv('whirlwind') + (on('godhammer') ? 5 : 0),
      def: ch.def + lv('shield') + f('fortress', 2, 1) + lv('undying') + lv('ironheart') + f('embermail', 1, 1) + lv('guardian'),
      maxHp: ch.hp + up.hp * B.UP_HP + (this.p.kitHp || 0) + 8 * lv('heart') + f('bloodcrown', 15, 5) + 10 * lv('lifetree') + (on('eternity') ? 30 : 0) +
        f('ironheart', 10, 5) + f('pillow', 16, 4) + f('giantfist', 12, 4) + 10 * lv('guardian') + (on('bloodking') ? 20 : 0) +
        (this.p.lvl - 1) * B.HP_PER_LEVEL + (this.p.honey || 0),
      goldMult: (1 + 0.4 * lv('coin') + f('goldbolt', 0.75, 0.25) + 0.25 * lv('goldstorm') + (on('minecrown') ? 0.5 : 0) + 0.1 * up.greed +
        f('luckycharm', 1, 0.25) + f('goldfang', 0.8, 0.2) + 0.25 * lv('fortune') + (on('dawnstar') ? 0.5 : 0) + (pet.greed || 0)) * this.goldBonus,
      // never more than 60%: something always gets through
      dodge: Math.min(0.6, (ch.dodge || 0) + (wet ? 0.25 : 0) + 0.08 * lv('cloak') + f('shadow', 0.15, 0.05) + 0.05 * lv('phantom') +
        f('luckycharm', 0.2, 0.05) + f('spikecloak', 0.2, 0.05) + 0.05 * lv('fortune') + (on('dawnstar') ? 0.1 : 0)),
      // damage multiplier on a surprise attack: the best of the sneaky relics, plus what legends add on top
      sneak: best(1.5 + 0.25 * lv('boots'), f('shadow', 2.25, 0.25), f('dagger', 2.5, 0.25), f('owleye', 2, 0.25)) +
        0.5 * lv('phantom') + 0.5 * lv('nightowl') + (on('eclipse') ? 2 : 0) + (on('dawnstar') ? 1 : 0) + (ch.sneak || 0),
      sight: Math.min(B.SIGHT + 6, B.SIGHT + lv('lantern') + f('dreamlamp', 1, 1) + f('owleye', 1, 1) + f('headlamp', 1, 1) + f('sunlamp', 1, 1) + lv('nightowl')) - (this.dare('dark') ? B.DARE_DARK : 0) -
        (this.zone.style === 'marsh' ? B.MARSH_DARK : 0) + Math.min(B.FLY_MAX, this.flies || 0) + (ch.sight || 0) + (pet.sight || 0) -
        (this.p?.inked > 0 ? 3 : 0),
      oreMult: best(1 + 0.5 * lv('pick'), f('goldrush', 1.5, 0.5), f('headlamp', 1.5, 0.5)),
      // extra chance a swing finds a better grade
      oreRise: best(0.05 * lv('pick'), f('goldrush', 0.1, 0.05), f('headlamp', 0.1, 0.05)) + (on('minecrown') ? 0.15 : 0),
      magnet: Math.max(on('goldrush') ? 1 + lv('goldrush') : on('magnet') ? lv('magnet') + 1 : 0, ch.pouch ? 2 : 0),
    };
  }
  // standing in a puddle (개구리)
  inWater() { return !!this.map && this.map.ter[idx(this.p.x, this.p.y)] === T.WATER; }

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
  // next to each other, and not only across the corner crack between two walls (dungeon.js squeeze)
  touching(a, b) { return cheb(a, b) === 1 && !squeeze(this.map, a.x, a.y, b.x - a.x, b.y - a.y); }
  randomFloorTile() {
    for (let t = 0; t < 100; t++) {
      const x = rnd(this.map.w), y = rnd(this.map.h);
      if (this.canEnemyEnter(x, y)) return { x, y };
    }
    return { x: this.p.x, y: this.p.y };
  }
  // true if this enemy will hit you on its next turn (shown as a claw mark on your tile)
  willHit(e) {
    if (e.foe != null) return false;
    if (e.hp > 0 && e.state === 'hunt' && !e.stun && inReach(this, e)) return true;
    return e.hp > 0 && e.state === 'hunt' && this.touching(e, this.p) && !e.aim && !e.slam && !e.stun && !e.d.drift && !e.d.mirror && !e.dug && !e.shellT &&
      !e.stoneT && !e.backoff && !e.charge && !e.diving && !e.lick && !(e.d.slow && !e.skip);
  }
  get zone() { return ZONES[this.stage]; }
  // 깊은 곳 (v0.23): how far below the boss's floor you are, 0 up to the boss
  // critters' stat multiplier here; down in 깊은 곳 it keeps climbing from the last field before the boss
  get foeScale() { return this.depth ? B.enemyScale(this.bossFloor - 1) * (1 + B.DEEP_UP * this.depth) : B.enemyScale(this.floor); }
  get oddScale() { return this.depth ? B.gimmickScale(this.bossFloor - 1) * (1 + B.DEEP_UP * this.depth) : B.gimmickScale(this.floor); }
  get depth() { return Math.max(0, this.floor - this.bossFloor); }
  // how far every tile is from you for something with wings (over drops, water and lava), once a turn
  flyMap() {
    const k = `${this.turn}:${this.p.x},${this.p.y}`;
    if (this.flyDm?.k !== k) this.flyDm = { k, dm: distMap(this.map, this.p.x, this.p.y, { fly: true }) };
    return this.flyDm.dm;
  }

  // ---------- floors ----------
  start() {
    this.arrival = { dir: 0 };
    this.genFloor();
    this.log(`${josa(this.char.name, '으로', '로')} ${this.zone.name}에 나왔다. 깃발 꽂힌 땅굴을 찾아 앞으로 가자.`, 'good');
    if (this.request) this.log(`오늘의 조합 의뢰: ${this.request.text} (일당 ${this.request.pay}G)`, 'quest');
    if (this.packed) this.log(`챙겨 온 ${RELICS[this.packed].name} Lv${this.p.relics[this.packed]}`, 'good');
    if (this.forged) this.log(`대장장이가 만들어 준 ${josa(RELICS[this.forged].name, '을', '를')} 들고 나왔다.`, 'good');
    // 도구 주머니 (village upgrade): a meadow tool or two to start with
    const pouch = [];
    for (let k = 0; k < (this.meta.up.tool || 0); k++) { const t = this.pickTool(); if (t) { this.p.items[t]++; pouch.push(ITEMS[t].name); } }
    if (pouch.length) this.log(`도구 주머니에 ${josa(pouch.join(', '), '을', '를')} 챙겨 왔다.`, 'good');
    if (this.kit) {
      for (let k = 1; k <= this.kit; k++) this.queue.push({ kind: 'kit', k, n: this.kit });
      this.log(`조합이 출발 보급을 챙겨 줬다. 유물 ${this.kit}개를 고른다.`, 'good');
    }
    this.emit('banner', { text: this.floorName() });
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
    if (this.floor === this.bossFloor) this.genBossFloor();
    else this.genNormalFloor();
    this.enterFloor();
  }

  enterFloor() {
    // fell down a drop: you land anywhere on the field, not at its burrow
    if (this.landing) {
      this.landing = false;
      const t = this.landSpot();
      if (t) this.arriveAt(t.x, t.y);
    }
    this.telegraph = [];
    this.puffs = [];
    this.rocks = [];
    this.p.held = null;
    this.trail = [{ x: this.p.x, y: this.p.y }];
    this.bandageUsed = 0;
    this.stunk = false;
    this.refreshDoors();
    if (this.char.sniff) this.sniff();
    computeFOV(this.map, this.p.x, this.p.y, this.stat().sight, this.lights());
    // 반딧불 모자: every sparkle boulder on the field glows through the dark from the moment you arrive
    if (this.lv('headlamp')) for (const o of this.map.ores) for (const c of o.cells) this.map.explored[idx(c.x, c.y)] = 1;
    // 새벽별: day breaks over the field; the whole of it is on your map, its hidden traps too
    if (this.lv('dawnstar')) {
      this.map.explored.fill(1);
      revealTraps(this);
      this.emit('dawn', { x: this.p.x, y: this.p.y });
      if (!this.told.dawnstar) { this.told.dawnstar = true; this.log('새벽별이 떠올라 구역이 환히 밝았다.', 'evo'); }
    } else if (this.lv('nightowl') && !this.told.nightowl) { this.told.nightowl = true; this.log('밤의 눈이 뜨였다. 벽 너머의 적까지 모두 보인다.', 'evo'); }
    if (this.lv('eclipse') && !this.told.eclipse) { this.told.eclipse = true; this.log('해가 가려졌다. 적들은 두 칸 앞도 잘 못 본다.', 'evo'); }
    // `dir`: 1 down a burrow to the next field, -1 back, 0 the first field; `from`: the hole you went into
    this.emit('floor', this.arrival || {});
    if (this.routeSaid) { this.log(`표지판대로, 이 들판엔 ${ROUTES[this.routeSaid].sign}.`, 'good'); this.routeSaid = null; }
    this.arrival = null;
    this.spotVeins();
  }

  // 여우: chests, keys and what else lies about show on the map, and the hidden traps with them
  sniff() {
    const m = this.map;
    let n = 0;
    for (const q of this.pickups) if (q.type !== 'gold' && !m.explored[idx(q.x, q.y)]) { m.explored[idx(q.x, q.y)] = 1; n++; }
    n += revealTraps(this);
    if (n && !(this.sniffed ||= new Set()).has(this.floor)) { this.sniffed.add(this.floor); this.log('킁킁, 이 들판 어디에 뭐가 있는지 냄새로 알겠다.', 'good'); }
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
    const map = this.map, rooms = carveRooms(map), start = rooms[0], route = this.route;
    this.route = null;
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
    if (this.floor > this.startFloor) { map.tiles[idx(start.cx, start.cy)] = UPSTAIRS; map.up = { x: start.cx, y: start.cy }; }
    const zi = Math.floor((this.floor - 1) / B.FLOORS_PER_ZONE);
    const stairs = { x: far.cx, y: far.cy };
    const deco = decorate(map, rooms, { start: this.p, stairs, floor: this.floor, style: this.zone.style });
    this.has = deco.has;
    const sp = placeSpecials(map, rooms, deco, {
      floor: this.floor, start: this.p, stairs, open: id => this.open(id),
      relicOffers: n => this.offers(n).filter(o => o.kind === 'relic').map(o => o.id),
      cage: this.floor === this.cageFloor && caged(this.meta, this.stage, this.loop) ? 'cage' : null,
      chief: () => pick(this.zone.enemies.filter(t => !ENEMIES[t].pack) || this.zone.enemies) || this.zone.enemies[0],
      den: route === 'den',
      napper: () => pick(this.zone.enemies.filter(t => !ENEMIES[t].lurk)),
      gold: () => Math.round((B.gs(zi) + 1) * rint(5, 9)),
      tool: () => this.pickTool(),
    });
    if (sp.cage) this.has.add('cage');
    // 온천: up in the hills, a flooded room's pool may be warm (map.spring: its tiles); set pieces
    // have taken their rooms by now, so a flooded room is still flooded
    const flood = rooms.findIndex((r, i) => deco.themes[i] === 'flood');
    if (flood >= 0 && this.open('spring') && Math.random() < B.SPRING_CHANCE[zi]) {
      const r = rooms[flood];
      map.spring = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (map.ter[idx(x, y)] === T.WATER) map.spring.push(idx(x, y));
      if (!map.spring.length) delete map.spring;
    }
    // v0.23: drops and a bridge by the sea, fallen floors in the ruins, ice and lava pools
    const taken = new Set([...sp.pickups, ...sp.enemies].map(o => idx(o.x, o.y)));
    if (this.zone.wet) fillPools(map, this.zone.wet, this.p, taken);
    if (this.zone.chasm) {
      const inR = (r, t) => t.x >= r.x && t.y >= r.y && t.x < r.x + r.w && t.y < r.y + r.h;
      carveChasms(map, rooms.filter((r, i) => i > 0 && !SET_PIECES.has(deco.themes[i])), this.zone.style,
        { start: this.p, taken, skip: r => inR(r, stairs) || inR(r, this.p) });
      if (map.ter.includes(T.CHASM)) this.has.add('chasm');
    }
    // loose traps, enemies and loot stay out of the set pieces
    const open = rooms.filter((r, i) => !SET_PIECES.has(deco.themes[i]));
    if (placeTraps(map, open, { start: this.p, stairs }, this.floor, this.open('traps'))) this.has.add('trap');
    if (this.open('grump') && Math.random() < B.GRUMP_CHANCE && placeGrumps(map, open, { start: this.p, stairs })) this.has.add('grump');
    for (const o of map.ores) o.tier = Math.min(ORES.length - 1, Math.floor(B.gs(zi)) + (Math.random() < B.ORE_START_BONUS ? 1 : 0));

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
    const scale = this.foeScale;
    // about half of them start asleep
    for (let i = 0; i < B.enemiesPerFloor(this.floor) - Math.floor((sp.den || 0) / 2); i++) {
      place(s => {
        // nothing awake near where you come in: the first steps of a field are yours to look around
        const type = pick(this.zone.enemies), state = cheb(s, this.p) < B.CALM_START || Math.random() < B.START_ASLEEP ? 'sleep' : 'wander';
        const e = this.spawnEnemy(type, s.x, s.y, scale);
        e.state = state;
        // pack animals bring friends, curled up right beside them
        // (on the very first field, two at most)
        for (let k = 1, n = e.d.pack ? rint(2, this.floor === 1 ? 2 : e.d.pack) : 1; k < n; k++) {
          const t = shuffle(DIRS8.slice()).map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy }))
            .find(t => map.tiles[idx(t.x, t.y)] === FLOOR && this.canEnemyEnter(t.x, t.y));
          if (t) this.spawnEnemy(type, t.x, t.y, scale).state = state;
        }
      });
    }
    if (this.open('turtle') && Math.random() < B.TURTLE_CHANCE) {
      place(s => { this.spawnEnemy('turtle', s.x, s.y, scale).state = Math.random() < 0.5 ? 'sleep' : 'wander'; });
    }
    for (let i = 0, n = rint(2, 4); i < n; i++) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'gold', amount: Math.round((B.gs(zi) + 1) * rint(3, 7)) }));
    place(s => this.addChest(s.x, s.y));
    if (this.floor === 1) place(s => this.addChest(s.x, s.y));
    // 깊은 곳: a locked-chest's worth of loot lying open on every floor, for the build to keep growing
    if (this.depth) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'chest', rich: true }));
    if (!this.dare('nopotion') && Math.random() < B.POTION_CHANCE) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'potion' }));
    if (this.open('bomb') && Math.random() < 0.5) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'bomb' }));
    if (this.open('map') && Math.random() < 0.3) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'map' }));
    // 들판 도구: one of the meadow tools opened so far, lying in the grass
    if (this.pickTool() && Math.random() < B.TOOL_CHANCE) place(s => this.pickups.push({ x: s.x, y: s.y, type: this.pickTool() }));
    if (this.pickTool() && Math.random() < B.TOOL_MORE) place(s => this.pickups.push({ x: s.x, y: s.y, type: this.pickTool() }));
    // now and then an old worker's name tag in the grass; in the ruins, a few on every floor
    for (let i = 0, n = B.tagsPerFloor(this.stage); i < n; i++) place(s => this.pickups.push({ x: s.x, y: s.y, type: 'tag' }));

    this.pickups.push(...sp.pickups);
    for (const o of sp.enemies) {
      const e = this.spawnEnemy(o.type, o.x, o.y, ENEMIES[o.type].swarm || o.chief || o.den ? this.foeScale : this.oddScale);
      e.state = o.state;
      if (o.den) Object.assign(e, { doze: o.doze, den: true });
      if (o.chief) this.crown(e);
      if (o.type === 'cage') e.friend = this.friend;
    }
    this.zoneFeatures(rooms, open);
    // the quest folk, on their floors
    const q = this.quests;
    if (this.floor === q.ghost.floor && this.open('ghost')) place(s => { this.spawnEnemy('ghost', s.x, s.y).state = 'npc'; });
    // the shopkeeper's stall, the floor before each boss: what's for sale, priced for the zone
    this.stall = [];
    if (this.floor === this.bossFloor - 1 && this.open('stall')) {
      this.stall = Object.entries(STALL).filter(([what]) => what !== 'tools' || this.pickTool())
        .map(([what, it]) => ({ what, price: Math.round(it.price * (B.gs(zi) + 1)), sold: false }));
      place(s => { this.spawnEnemy('peddler', s.x, s.y).state = 'npc'; });
    }
    if (this.floor === q.smith.floor && this.open('smith')) {
      place(s => {
        this.spawnEnemy('smith', s.x, s.y).state = 'npc';
        const a = DIRS8.map(([dx, dy]) => ({ x: s.x + dx, y: s.y + dy }))
          .find(t => map.tiles[idx(t.x, t.y)] === FLOOR && map.ter[idx(t.x, t.y)] === T.NONE && !this.pickups.some(o => o.x === t.x && o.y === t.y));
        if (a) map.ter[idx(a.x, a.y)] = T.ANVIL;
      });
    }
    // 갈림길: what the sign by the burrow you came down promised is here; and from here on, two ways
    if (route) this.routeBonus(route, place);
    if (this.open('fork') && B.localOf(this.floor) < B.FLOORS_PER_ZONE - 1) this.fork(open);
  }

  // One of the meadow tools opened so far (null before any), the stage's own (ZONE_TOOL) half the time
  pickTool() {
    const open = TOOLS.filter(id => this.open(id)), own = ZONE_TOOL[this.zone.style];
    if (!open.length) return null;
    return open.includes(own) && Math.random() < 0.5 ? own : pick(open);
  }

  // The second burrow on a field: in a room far from where you came in and from the first one, never
  // by a door or a trap, and a sign by each (map.routes) saying what the field past it has (ROUTES).
  // One of the two is always a breather; the other a prize.
  fork(open) {
    const m = this.map, first = m.down, dm = distMap(m, this.p.x, this.p.y), d2 = distMap(m, first.x, first.y);
    let best = null, bs = -1;
    for (const r of open.slice(1)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = idx(x, y);
      if (m.tiles[i] !== FLOOR || ![T.NONE, T.GRASS].includes(m.ter[i]) || dm[i] >= 9999 || dm[i] < B.FORK_APART || d2[i] < B.FORK_APART) continue;
      if (this.enemyAt(x, y) || this.pickups.some(q => q.x === x && q.y === y)) continue;
      if (DIRS8.some(([dx, dy]) => !inMap(x + dx, y + dy) || isTrap(m.ter[idx(x + dx, y + dy)]) || [DOOR, STAIRS, UPSTAIRS, ORE].includes(m.tiles[idx(x + dx, y + dy)]))) continue;
      const sc = Math.min(dm[i], d2[i]) + Math.random() * 4;
      if (sc > bs) { bs = sc; best = { x, y }; }
    }
    if (!best) return;
    m.tiles[idx(best.x, best.y)] = STAIRS;
    const safe = TOOLS.some(id => this.open(id)) && Math.random() < 0.5 ? 'tools' : 'rest';
    const prize = pick(['chest', 'gold', 'chief', ...(this.open('candy') ? ['candy'] : []), ...(this.open('den') ? ['den'] : [])]);
    const [a, b] = shuffle([safe, prize]);
    m.routes = [{ x: first.x, y: first.y, kind: a }, { x: best.x, y: best.y, kind: b }];
    this.has.add('fork');
  }

  // Down a burrow with a sign: the next field (when it is new) is made with what the sign said.
  takeBurrow(x, y) {
    const m = this.map, r = m.routes?.find(o => o.x === x && o.y === y);
    m.down = { x, y };
    if (r && !this.floors[this.floor + 1]) { this.route = r.kind; (this.routesTaken ||= []).push(r.kind); }
  }

  routeBonus(kind, place) {
    const m = this.map;
    if (kind === 'chest') place(s => this.addChest(s.x, s.y));
    if (kind === 'candy') place(s => this.pickups.push({ x: s.x, y: s.y, type: 'candy', n: B.candySteps(this.floor) }));
    if (kind === 'tools') for (let k = 0; k < 2; k++) place(s => this.pickups.push({ x: s.x, y: s.y, type: this.pickTool() || 'bomb' }));
    if (kind === 'rest') {
      place(s => this.pickups.push({ x: s.x, y: s.y, type: 'potion' }));
      place(s => { if (this.bareSpot(s.x, s.y)) m.ter[idx(s.x, s.y)] = T.BERRY; });
    }
    if (kind === 'gold') for (const o of m.ores) o.tier = Math.min(ORES.length - 1, o.tier + 1);
    if (kind === 'den' && !m.den) place(s => this.addChest(s.x, s.y));   // no room would take it: a chest all the same
    if (kind === 'chief') {
      place(s => {
        const type = pick(this.zone.enemies.filter(t => !ENEMIES[t].pack)) || this.zone.enemies[0];
        const e = this.spawnEnemy(type, s.x, s.y, this.foeScale);
        e.state = 'sleep';
        this.crown(e);
        e.prize = true;
      });
    }
    this.routeSaid = kind;
    m.routeKind = kind;
  }

  // What each new zone adds to a field: the marsh's diving beetles slip under the water and fireflies
  // drift over it; the cave's rooms get stalactites overhead.
  zoneFeatures(rooms, open) {
    const map = this.map, style = this.zone.style;
    const far = (x, y, d) => cheb({ x, y }, this.p) > d && !(map.down && map.down.x === x && map.down.y === y);
    const roomFloor = r => {
      const out = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (map.tiles[idx(x, y)] === FLOOR) out.push({ x, y });
      return out;
    };
    for (const e of this.enemies) if (e.d.lurk) this.sink(e);
    if (style === 'marsh') {
      const spots = shuffle(open.slice(1).flatMap(roomFloor)).filter(t => far(t.x, t.y, 3) && !this.enemyAt(t.x, t.y));
      map.flies = [];
      for (const t of spots) {
        if (map.flies.length >= rint(...B.FLIES_PER_FLOOR)) break;
        if (map.flies.some(f => cheb(f, t) < 6)) continue;
        map.flies.push({ x: t.x, y: t.y });
      }
    }
    if (style === 'cave') {
      map.drips = [];
      for (const r of open.slice(1)) {
        if (r.w * r.h < 12) continue;
        const spots = shuffle(roomFloor(r)).filter(t => far(t.x, t.y, 3) && map.ter[idx(t.x, t.y)] !== T.WATER &&
          !DIRS8.some(([dx, dy]) => map.tiles[idx(t.x + dx, t.y + dy)] === DOOR));
        for (const t of spots.slice(0, rint(...B.DRIPS_PER_ROOM))) map.drips.push(t);
      }
    }
  }

  // 물방개: under the water somewhere away from where you come in, bubbles showing (state 'lurk')
  sink(e) {
    const map = this.map, pools = [];
    for (let i = 0; i < map.tiles.length; i++) {
      if (map.ter[i] !== T.WATER || map.tiles[i] !== FLOOR) continue;
      const x = i % map.w, y = (i / map.w) | 0;
      if (cheb({ x, y }, this.p) > 4 && !this.enemyAt(x, y)) pools.push({ x, y });
    }
    const t = pick(pools);
    if (!t) return;
    e.x = t.x; e.y = t.y;
    e.state = 'lurk';
  }

  // A chest, or from floor 2 on now and then a mimic pretending to be one.
  addChest(x, y) {
    if (this.floor >= 2 && this.open('mimic') && Math.random() < B.MIMIC_CHANCE) {
      this.spawnEnemy('mimic', x, y, this.oddScale).state = 'hide';
      this.has.add('mimic');
    } else this.pickups.push({ x, y, type: 'chest' });
  }

  genBossFloor() {
    const type = this.zone.boss, layout = pick(ENEMIES[type].arenas || ['pillars']);
    const spots = carveArena(this.map, layout), map = this.map;
    this.p.x = spots.start.x; this.p.y = spots.start.y;
    map.up = { ...spots.start }; // the way back opens once the boss is down
    const near = (x, y) => cheb({ x, y }, spots.start) <= 1 || cheb({ x, y }, spots.boss) <= 1;
    decorateArena(map, spots.room, near, layout);
    // the cave's arena has stalactites overhead; the marsh's has fireflies over the pond
    const r = spots.room, open = [];
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      if (map.tiles[idx(x, y)] === FLOOR && !near(x, y) && cheb({ x, y }, spots.start) > 3) open.push({ x, y });
    }
    fillPools(map, this.zone.wet, spots.start, new Set([idx(spots.boss.x, spots.boss.y)]));
    if (this.zone.style === 'cave') map.drips = shuffle(open.filter(t => map.ter[idx(t.x, t.y)] !== T.WATER)).slice(0, 6);
    if (this.zone.style === 'marsh') {
      map.flies = [];
      for (const t of shuffle(open)) if (map.flies.length < 3 && !map.flies.some(o => cheb(o, t) < 5)) map.flies.push(t);
    }
    const b = this.spawnEnemy(type, spots.boss.x, spots.boss.y, B.bossScale(this.floor));
    b.state = 'hunt';
    this.boss = b;
    this.log(`${josa(ENEMIES[type].name, '이', '가')} 나타났다! ${ENEMIES[type].tip}`, 'warn');
    this.log('쓰러뜨리기 전에는 돌아갈 수 없다.');
  }

  spawnEnemy(type, x, y, scale = 1) {
    const d = ENEMIES[type];
    // the 회차 and the rival's dares make every critter tougher (not the folk you talk to)
    const k = d.npc ? 1 : loopFoe(this.loop) * (this.dare('fierce') ? B.DARE_FOE : 1);
    const kb = d.boss && this.dare('boss') ? [B.DARE_BOSS_HP, B.DARE_BOSS_ATK] : [1, 1];
    const hp = Math.round(d.hp * scale * k * kb[0]);
    const e = {
      id: Run.nextId++, type, d, x, y,
      hp, maxHp: hp, atk: Math.round(d.atk * (1 + (scale - 1) * B.ATK_SHARE) * k * kb[1]),
      def: d.def || 0, aim: false, aimAt: null, skip: false, slam: false, timer: 0, face: -1,
      state: d.boss ? 'hunt' : Math.random() < 0.65 ? 'sleep' : 'wander',
      wake: 0, doze: 0, last: null, target: null, searchT: 0,
      burn: 0, stun: 0,
    };
    this.enemies.push(e);
    this.emit('spawn', { enemy: e });
    return e;
  }

  // 우두머리: a critter of the field grown big, with a crown and the key to a friend's cage
  crown(e) {
    e.chief = true;
    e.hp = e.maxHp = Math.round(e.maxHp * B.CHIEF_HP);
    e.atk = Math.round(e.atk * B.CHIEF_ATK);
    e.xp = (e.d.xp || 1) * 4;
  }

  // the banner and HUD name of a floor: the zone and how deep into this trip, or its boss
  floorName(floor = this.floor) {
    const name = this.zone.name;
    return floor === this.bossFloor ? `${name} · 대장` : floor > this.bossFloor ? `${name} · 깊은 곳 ${floor - this.bossFloor}` : `${name} ${B.localOf(floor)}`;
  }

  // dir = 1 down, -1 up. Floors you have been on come back exactly as you left them.
  changeFloor(dir) {
    this.arrival = { dir, from: this.fallAt || { x: this.p.x, y: this.p.y }, fell: !!this.fallAt };
    this.fallAt = null;
    this.floors[this.floor] = {
      map: this.map, enemies: this.enemies.filter(e => e.hp > 0), pickups: this.pickups,
      boss: this.boss, has: this.has, gasActive: this.gasActive, overheard: this.overheard, respawnT: this.respawnT, stall: this.stall,
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
    this.emit('banner', { text: this.floorName() });
    this.log(dir > 0 ? `${this.floorName()}에 왔다.` : `${this.floorName()}으로 돌아왔다.`);
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

  // Reeled in by a frog's tongue: you land beside it, on whatever is there (a trap goes off).
  pullPlayer(x, y) {
    const p = this.p, from = { x: p.x, y: p.y };
    p.x = x; p.y = y;
    this.trail.push({ x, y });
    if (this.trail.length > 40) this.trail.shift();
    this.emit('pull', { from, to: { x, y } });
    onEnter(this, 'player', x, y);
    this.pickupAt(x, y);
    this.catchFly(x, y);
  }

  // Sliding on ice (or one tile on a snail's slime) the way you stepped, picking things up as you go;
  // the slide stops where the ice ends, at a wall, a drop's edge, someone in the way or a burrow.
  slidePlayer(dx, dy, once) {
    const p = this.p, map = this.map, from = { x: p.x, y: p.y };
    let n = 0;
    while (n < 12) {
      const x = p.x + dx, y = p.y + dy;
      if (!this.passable(x, y) || this.enemyAt(x, y) || squeeze(map, p.x, p.y, dx, dy)) break;
      p.x = x; p.y = y; n++;
      this.trail.push({ x, y });
      if (this.trail.length > 40) this.trail.shift();
      onEnter(this, 'player', x, y);
      this.pickupAt(x, y);
      this.catchFly(x, y);
      const i = idx(x, y);
      if (once || map.ter[i] !== T.ICE || map.tiles[i] === STAIRS || map.tiles[i] === UPSTAIRS) break;
    }
    if (!n) return;
    this.emit('slide', { from, to: { x: p.x, y: p.y } });
    if (!this.told.ice && !once) { this.told.ice = true; this.log('미끄덩! 빙판에서는 끝까지 미끄러진다.', 'warn'); }
  }

  // Down a drop, by jumping or knocked over the edge: the fall hurts, and you land somewhere on the
  // next field. A shortcut, if you can take the knock.
  leap(knocked) {
    const p = this.p;
    this.emit('fall', { x: p.x, y: p.y });
    this.log(knocked ? '떠밀려서 낭떠러지 아래로 떨어졌다!' : '에잇! 낭떠러지 아래로 뛰어내렸다!', 'warn');
    this.hurtPlayer(Math.max(3, Math.round(this.stat().maxHp * B.FALL_HURT)), '낭떠러지에서 떨어졌다', 'fall');
    if (p.hp <= 0) { this.afterTurn(); return true; }
    this.landing = true;
    this.changeFloor(1);
    return true;
  }
  // somewhere open to land, with no critter right beside it
  landSpot() {
    const m = this.map;
    for (let t = 0; t < 400; t++) {
      const x = rnd(m.w), y = rnd(m.h), i = idx(x, y);
      if (m.tiles[i] !== FLOOR || ![T.NONE, T.GRASS, T.BRUSH, T.ASH].includes(m.ter[i])) continue;
      if (this.enemies.some(e => e.hp > 0 && cheb(e, { x, y }) <= 2) || this.pickups.some(q => q.x === x && q.y === y)) continue;
      return { x, y };
    }
    return null;
  }

  // A snowball knocks you a tile back: a wall or someone stops you; over a drop you fall (at the end of
  // the critters' turn); into lava you are burnt and bounce back out.
  shovePlayer(src) {
    const p = this.p, dx = Math.sign(p.x - src.x), dy = Math.sign(p.y - src.y), x = p.x + dx, y = p.y + dy;
    if (!inMap(x, y) || (!dx && !dy)) return;
    const ter = this.map.ter[idx(x, y)];
    if (ter === T.CHASM) { this.pendingFall = true; this.fallAt = { x, y }; return; }
    if (ter === T.LAVA) {
      this.emit('bonk', { x: p.x, y: p.y, dx, dy });
      this.hurtPlayer(B.lavaHurt(this.floor), '용암에 빠져 데었다', 'burn');
      setBurn(this, 'player', 3);
      return;
    }
    if (!this.passable(x, y) || this.enemyAt(x, y) || squeeze(this.map, p.x, p.y, dx, dy)) { this.emit('bonk', { x: p.x, y: p.y, dx, dy }); return; }
    const from = { x: p.x, y: p.y };
    p.x = x; p.y = y;
    this.trail.push({ x, y });
    if (this.trail.length > 40) this.trail.shift();
    this.emit('pull', { from, to: { x, y } });
    onEnter(this, 'player', x, y);
    this.pickupAt(x, y);
    if (ter === T.ICE) this.slidePlayer(dx, dy, false);
  }

  // A snail's slime trail or the queen's honey on the ground; it dries up after a while (GOO_TURNS)
  goo(x, y, kind) {
    const m = this.map, i = idx(x, y);
    if (m.tiles[i] !== FLOOR || ![T.NONE, T.GRASS, T.ASH].includes(m.ter[i])) return;
    m.ter[i] = kind;
    (m.goo ||= {})[i] = this.turn + B.GOO_TURNS;
    this.emit('tiles', { list: [i], soft: true });
  }
  dryGoo() {
    const m = this.map, done = [];
    for (const [i, t] of Object.entries(m.goo || {})) {
      if (this.turn < t) continue;
      delete m.goo[i];
      if (m.ter[i] === T.SLIME || m.ter[i] === T.HONEY) { m.ter[i] = T.NONE; done.push(+i); }
    }
    if (done.length) this.emit('tiles', { list: done, soft: true });
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
    if (!inMap(nx, ny) || squeeze(map, p.x, p.y, dx, dy)) return false;
    if (dx) p.face = Math.sign(dx);
    p.blend = p.tucked = false;
    const e = this.enemyAt(nx, ny);
    if (e && e.d.npc) { this.talk(e); return true; }
    if (e && e.state === 'hide') {
      // you reach for the chest and it bites
      awaken(this, e);
      this.endTurn();
      return true;
    }
    if (e) {
      // 염소: two or more steps the same way and then into them
      const ram = this.char.ram && p.dash?.n >= 2 && p.dash.dx === dx && p.dash.dy === dy;
      p.dash = null;
      this.emit('attack', { from: { x: p.x, y: p.y }, to: { x: nx, y: ny }, who: 'player' });
      this.playerAttack(e, ram);
      this.endTurn();
      return true;
    }
    const i = idx(nx, ny);
    if (map.tiles[i] === ORE) return this.mineOre(this.oreAt(nx, ny), { x: nx, y: ny });
    if (map.tiles[i] === GRAVE) { openGrave(this, nx, ny); this.endTurn(); return true; }
    if (map.tiles[i] === LOCKED) return this.unlock(nx, ny);
    if (map.tiles[i] === HIVE) return this.takeHoney(nx, ny);
    if (map.tiles[i] === WEED) return this.pullWeed(nx, ny);
    // 낭떠러지: the first step stops at the edge; walking on over it is a jump down to the next field
    if (map.ter[i] === T.CHASM) {
      if (p.brink?.x === nx && p.brink.y === ny) { p.brink = null; this.fallAt = { x: nx, y: ny }; return this.leap(false); }
      p.brink = { x: nx, y: ny };
      this.emit('brink', { x: nx, y: ny });
      this.log('낭떠러지 끝이다. 한 걸음 더 가면 뛰어내린다. 아래 구역으로 떨어지지만 크게 다친다.', 'warn');
      return false;
    }
    if (map.ter[i] === T.LAVA) {
      if (!this.told.lava) { this.told.lava = true; this.log('부글부글 끓는 용암이다. 들어갈 수 없다.', 'warn'); }
      return false;
    }
    if (!this.passable(nx, ny)) return false;
    // 꿀: a foot stuck in honey takes a turn to pull free
    if (p.sticky) {
      p.sticky = 0;
      this.emit('struggle', { x: p.x, y: p.y, dx, dy });
      this.log('꿀에 붙은 발을 떼느라 한 턴이 갔다.', 'warn');
      this.endTurn();
      return true;
    }
    // 가재 집게: held fast, you can hit back but not walk off; trying shakes you loose and takes the turn
    if (p.held && this.enemies.some(o => o.id === p.held && o.hp > 0 && this.touching(o, p))) {
      this.emit('struggle', { x: p.x, y: p.y, dx, dy });
      this.log('집게를 뿌리치느라 한 턴이 갔다.', 'warn');
      this.endTurn();
      return true;
    }
    p.x = nx; p.y = ny;
    p.walk = (p.walk || 0) + 1;
    p.dash = p.dash?.dx === dx && p.dash.dy === dy ? { dx, dy, n: p.dash.n + 1 } : { dx, dy, n: 1 };
    this.trail.push({ x: nx, y: ny });
    if (this.trail.length > 40) this.trail.shift();
    this.lastMove = { dx, dy };
    this.emit('move', { x: nx, y: ny, ter: map.ter[i] });
    onEnter(this, 'player', nx, ny);
    this.pickupAt(nx, ny);
    this.catchFly(nx, ny);
    // 빙판 and 달팽이 점액: you slide on the same way (to the end of the ice; one tile on slime)
    if (map.ter[i] === T.ICE || map.ter[i] === T.SLIME) this.slidePlayer(dx, dy, map.ter[i] === T.SLIME);
    const at = map.tiles[idx(p.x, p.y)];
    if (at === STAIRS) { this.takeBurrow(p.x, p.y); this.changeFloor(1); return true; }
    if (at === UPSTAIRS) { this.changeFloor(-1); return true; }
    // 토끼: every few steps one is a hop, over before anyone else can move
    if (this.char.hop && (p.hops = (p.hops || 0) + 1) % this.char.hop === 0) { this.quick = true; this.emit('hop', { x: nx, y: ny, dx, dy }); }
    this.endTurn();
    return true;
  }

  wait() {
    if (!this.canAct()) return false;
    // 꿀잠 베개: a proper rest, as long as nobody is in sight
    const L = this.levels(), p = this.p;
    p.dash = null;
    if (this.char.shell) { if (!p.tucked) this.emit('shell', { x: p.x, y: p.y }); p.shell = p.tucked = true; }
    // 수호 거북: a rest is a turn tucked into the shell (damagePlayer)
    if (L.guardian) {
      if (!p.guard) this.emit('shell', { x: p.x, y: p.y });
      p.guard = true;
      if (!this.told.guardian && this.enemies.some(e => e.hp > 0 && e.state === 'hunt' && this.isVisible(e.x, e.y))) {
        this.told.guardian = true;
        this.log('등껍질에 쏙 숨었다. 이번 턴엔 맞아도 거의 안 아프다.', 'evo');
      }
    }
    if (this.char.blend && !p.blend) { p.blend = true; this.emit('blend', { x: p.x, y: p.y }); }
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

  // 벌집 그루터기: the honey pot is eaten on the spot (max HP for the rest of the run), and every bee
  // that is awake comes after you. Bees put to sleep by smoke or pollen first don't notice.
  takeHoney(x, y) {
    const h = this.map.hive;
    if (!h || !h.honey) { this.log('꿀을 다 꺼낸 벌집이다.'); return false; }
    h.honey = false;
    const n = B.honeyHp(this.floor);
    this.withMaxHpDelta(() => { this.p.honey = (this.p.honey || 0) + n; });
    this.emit('tiles', { list: [idx(x, y)], soft: true });
    this.emit('honey', { x, y, n });
    this.log(`벌집에서 꿀단지를 꺼내 먹었다! 최대 체력 +${n}`, 'good');
    if (angerSwarm(this)) this.log('윙윙! 벌들이 화났다! 벌집에서 멀리 달아나면 돌아간다.', 'warn');
    else if (this.enemies.some(e => e.d.swarm && e.hp > 0)) this.log('벌들이 쿨쿨 자는 사이에 살짝 꺼냈다.', 'good');
    this.endTurn();
    return true;
  }

  // 풀뽑기: pull a weed for a little pay, leaving loose soil. A screaming root jumps out yelling and
  // runs (ai.js scream); the last weed of the patch has a star candy under it.
  pullWeed(x, y) {
    const map = this.map, i = idx(x, y), patch = map.weeds || { left: 1, roots: [] };
    map.tiles[i] = FLOOR;
    map.ter[i] = T.DUG;
    patch.left--;
    this.weeds = (this.weeds || 0) + 1;
    this.emit('tiles', { list: [i], soft: true });
    const root = patch.roots.includes(i);
    this.emit('pluck', { x, y, root });
    if (root) {
      const e = this.spawnEnemy('root', x, y);
      Object.assign(e, { state: 'flee', left: B.ROOT_TURNS });
      this.screams = (this.screams || 0) + 1;
      this.emit('scream', { x, y, first: true });
      this.noise(x, y, B.SCREAM_RANGE);
      this.log('잡초를 뽑았더니 비명 뿌리였다! 꺄아아 소리에 적들이 몰려온다!', 'warn');
    } else {
      this.addGold(B.weedGold(this.floor));
      if (!this.told.weed) { this.told.weed = true; this.log('잡초를 쏙 뽑았다. 풀뽑기 일당이 조금 나온다.', 'good'); }
    }
    if (patch.left === 0) {
      if (this.open('candy')) {
        this.pickups.push({ x, y, type: 'candy' });
        this.log('밭을 다 뽑았다! 마지막 풀 밑에서 별사탕이 나왔다!', 'good');
      } else {
        this.addGold(B.weedGold(this.floor) * 3);
        this.log('밭을 다 뽑았다! 일당을 두둑이 받았다.', 'good');
      }
      this.emit('weedsDone', { x, y });
    }
    this.endTurn();
    return true;
  }

  // ---------- quest folk ----------
  // Talking takes no turn. What they say goes up as a sheet (queue kind 'talk').
  talk(e) {
    if (e.type === 'cage') { this.openCage(e); return; }
    const q = this.quests[e.type], text = NPC_TEXT[e.type];
    const sheet = (body, opts, extra = {}) => this.queue.push({ kind: 'talk', who: e.type, text: body, opts, ...extra });
    const ok = () => [{ kind: 'ok', name: text.ok[0], desc: text.ok[1] }];
    if (e.type === 'ghost') {
      if (q.state === 'idle') {
        q.state = 'asked';
        const s = this.hiddenSpot() || this.randomFloorTile();
        this.spawnEnemy('thief', s.x, s.y, this.oddScale).state = 'wander';
        sheet(text.ask, ok());
      } else if (q.state === 'found') {
        q.state = 'done';
        sheet(text.thanks, this.offers(3), { noReroll: true });
        e.hp = 0;
        this.enemies = this.enemies.filter(o => o !== e);
        this.emit('vanish', { x: e.x, y: e.y });
        this.log(text.bye, 'good');
      } else this.say(e, text.wait);
    } else if (e.type === 'peddler') {
      const canGrow = Object.keys(this.p.relics).some(id => this.p.relics[id] < maxLevelOf(id));
      const stock = this.stall.filter(s => !s.sold && (s.what !== 'grow' || canGrow));
      if (!stock.length) this.say(e, text.empty);
      else sheet(q.met ? text.again : text.greet, [...stock.map(s => ({ kind: 'buy', what: s.what, price: s.price })), ...ok()], { noReroll: true });
      q.met = true;
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

  // 우리: the 우두머리's key opens it, and the friend inside runs home to the village for good
  openCage(e) {
    const text = NPC_TEXT.cage;
    if (!this.map.cageKey) { this.say(e, text.locked); this.log('우리 열쇠는 왕관 쓴 우두머리가 물고 있다.'); return; }
    const id = e.friend;
    this.map.cageKey = false;
    this.meta.chars[id] = true;
    this.rescued.push(id);
    e.hp = 0;
    this.enemies = this.enemies.filter(o => o !== e);
    this.emit('rescue', { x: e.x, y: e.y, hero: id, sprite: CHARACTERS[id].sprite, text: text.free });
    const c = CHARACTERS[id];
    this.log(`우리를 열었다! ${c.kind} ${josa(c.name, '이', '가')} 마을로 달려갔다. 이제 함께 탐험할 수 있다.`, 'good');
    this.endTurn();
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
    // a pebble (반짝돌 왕관's petrified critter) cracks in two swings, while they are still quiet ones
    const k = ore.hits - 1, last = ore.hits >= (ore.pebble ? 2 : B.ORE_HITS) - (this.char.dig || 0), top = ORES.length - 1;
    if (ore.hits === 1) this.meetOre(ore.tier);
    const nugget = !last && Math.random() < B.ORE_NUGGET[k];
    const above = Math.max(0, ore.tier - Math.floor(B.gs(B.stageOf(this.floor))));
    const rise = B.ORE_RISE[k] * B.ORE_RISE_DECAY ** above + s.oreRise;
    const rose = !last && ore.tier < top && (nugget || Math.random() < rise);
    if (rose) { ore.tier++; this.meetOre(ore.tier); }
    const g = ORES[ore.tier];
    const r = Math.round((B.ORE_NOISE[k] + (nugget ? 2 : 0)) * (this.char.quiet ? 0.75 : 1));
    let gold;
    // the pickaxe and the coin relics add up on sparkle rocks rather than multiply: a gold build pays
    // well without one lucky run buying out the whole village
    const oreCut = s.goldMult + (s.oreMult - 1) * this.goldBonus;
    if (!last) gold = Math.round(B.oreGold(this.floor) * g.mult * B.ORE_SWING[k] * oreCut * big * (nugget ? B.ORE_NUGGET_MULT : 1));
    this.emit('mine', { x: at.x, y: at.y, cells: ore.cells, size: ore.size, from: { x: p.x, y: p.y }, hits: ore.hits, r, last, tier: ore.tier, rose, nugget, pebble: ore.pebble });
    if (ore.vent) addGas(this, ore.vent.x, ore.vent.y, 'mine', B.ORE_GAS);
    if (!last) this.addGold(gold, true);
    else {
      for (const c of ore.cells) map.tiles[idx(c.x, c.y)] = FLOOR;
      map.ores = map.ores.filter(o => o !== ore);
      this.meta.ores[g.id] = (this.meta.ores[g.id] || 0) + 1;
      // the haul lies in a heap on every tile the vein filled; a 2x2 jackpot holds a richer chest
      const haul = Math.round(B.oreJackpot(this.floor) * g.mult * oreCut * big / ore.size * (ore.pebble ? B.PEBBLE_HAUL : 1));
      for (const c of ore.cells) this.pickups.push({ x: c.x, y: c.y, type: 'gold', amount: haul, ore: ore.tier, raw: true });
      if (!ore.pebble) this.pickups.push({ x: ore.x, y: ore.y, type: 'chest', rich: ore.size >= 4, vein: ore.size >= 4 });
      if (!ore.pebble && this.open('candy') && Math.random() < B.CANDY_ORE[ore.size - 1]) { const c = ore.cells[ore.cells.length - 1]; this.pickups.push({ x: c.x, y: c.y, type: 'candy' }); }
      this.discover('ore_jackpot', true);
      // the blacksmith on this floor wants a chunk of it
      const smith = this.quests.smith;
      if (!ore.pebble && this.floor === smith.floor && smith.state !== 'done' && (smith.chunk === null || ore.tier > smith.chunk)) {
        smith.chunk = ore.tier;
        this.log(`반짝돌 덩어리를 하나 챙겼다.${smith.state === 'asked' ? ' 대장장이에게 가져가자.' : ''}`, 'good');
      }
      this.emit('tiles', { list: ore.cells.map(c => idx(c.x, c.y)) });
    }
    const heard = this.noise(ore.x, ore.y, r);
    // the deeper you dig, the more the mine answers: monsters crawl out of the dark toward the sound
    const came = [];
    // the first field only wakes who is already there: it is where you learn that digging is heard
    const wave = this.floor === 1 ? 0 : B.ORE_WAVE[k] + (B.ORE_WAVE[k] ? B.ORE_SIZE_WAVE[ore.size - 1] : 0);
    for (let n = 0; n < (this.char.quiet ? wave - 1 : wave); n++) {
      const t = this.waveSpot(ore);
      if (!t) break;
      const e = this.spawnEnemy(pick(this.zone.enemies), t.x, t.y, this.foeScale);
      e.state = 'search'; e.searchT = 0; e.last = { x: ore.x, y: ore.y };
      came.push(e);
    }
    if (heard.length || came.length) this.emit('heard', { x: p.x, y: p.y, list: [...heard, ...came] });
    this.endTurn();
    return true;
  }

  useItem(id) {
    if (!this.canAct() || !this.p.items[id] || ITEMS[id].throw) return false;
    const p = this.p;
    p.items[id]--;
    p.blend = false;
    if (id === 'dandelion') { this.blowAway(); (this.toolUse ||= {}).dandelion = (this.toolUse.dandelion || 0) + 1; }
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

  // `id`: what is thrown; a chili has to land on a critter you can see (not a chest that might be one)
  canThrowAt(x, y, id = 'bomb') {
    if (!inMap(x, y) || !this.isVisible(x, y) || cheb({ x, y }, this.p) > BOMB_RANGE || (x === this.p.x && y === this.p.y)) return false;
    if (!ITEMS[id]?.foe) return true;
    const e = this.enemyAt(x, y);
    return !!e && !e.d.npc && !['hide', 'stone', 'lurk'].includes(e.state) && !e.diving;
  }

  // Anything thrown: picked on the map, flown there in an arc, and it costs the turn. Each meadow tool
  // does one thing where it lands (data/items.js).
  throwTool(id, x, y) {
    if (id === 'bomb') return this.throwBomb(x, y);
    const p = this.p;
    if (!this.canAct() || !ITEMS[id]?.throw || !p.items[id] || !this.canThrowAt(x, y, id)) return false;
    p.items[id]--;
    p.blend = false;
    (this.toolUse ||= {})[id] = (this.toolUse[id] || 0) + 1;   // for the village gossip
    if (x !== p.x) p.face = Math.sign(x - p.x);
    this.emit('throw', { from: { x: p.x, y: p.y }, to: { x, y }, sprite: ITEMS[id].sprite });
    if (id === 'pinecone') this.pinecone(x, y);
    else if (id === 'honeyjar') this.splashHoney(x, y);
    else if (id === 'sleepy') this.sleepPuff(x, y);
    else if (id === 'chili') this.chili(this.enemyAt(x, y));
    else if (id === 'bell') this.dropBell(x, y);
    this.endTurn();
    return true;
  }

  // 솔방울: a critter it hits is knocked a tile away (over a drop, onto a trap, into another one...) and
  // left seeing stars for a turn, so the blow after that is a surprise. On bare ground it goes 톡, and
  // whoever is close turns to look (a stone thrown to draw a guard off), and a trap it lands on goes off.
  pinecone(x, y) {
    const e = this.enemyAt(x, y);
    if (e && !e.d.npc) {
      this.emit('pine', { x, y, hit: true });
      if (this.isVisible(x, y)) this.log(`솔방울이 ${josa(e.d.name, '을', '를')} 딱 맞혔다!`, 'good');
      this.hurt(e, B.pineDamage(this.floor), 'pine');
      if (e.hp > 0 && !e.d.boss && !['hide', 'stone', 'lurk'].includes(e.state)) {
        // where it is knocked to: over a cliff edge, or onto a trap, is a thing to remember
        const tx = e.x + Math.sign(e.x - this.p.x), ty = e.y + Math.sign(e.y - this.p.y), to = inMap(tx, ty) ? this.map.ter[idx(tx, ty)] : T.NONE;
        const bumped = this.knock(e, 2 + Math.floor(this.floor / 4));
        if (e.x === tx && e.y === ty && this.isVisible(tx, ty)) {
          if (to === T.CHASM) this.discover('pine_cliff');
          else if (isTrap(to)) this.discover('pine_trap');
        }
        // knocked into another one, and now that one is after it
        if (bumped?.foe === e.id && this.isVisible(bumped.x, bumped.y)) this.discover('pine_brawl');
      }
      if (e.hp > 0 && !['hide', 'stone', 'lurk'].includes(e.state)) {
        e.stun = Math.max(e.stun || 0, 1);
        this.emit('stun', { x: e.x, y: e.y });
      }
      return;
    }
    this.emit('pine', { x, y, hit: false });
    const ter = this.map.ter[idx(x, y)];
    if (isTrap(ter)) { springTrap(this, x, y); return; }
    const heard = this.noise(x, y, B.PINE_NOISE);
    this.log(heard.length ? '톡! 솔방울 소리에 근처 녀석이 고개를 돌렸다.' : '톡! 솔방울이 데구루루 굴러갔다.');
    if (heard.length) this.emit('heard', { x, y, list: heard });
  }

  // 꿀 병: it breaks and honey pours over the tile and the ones round it; whoever stands there is stuck
  // fast (a boss pulls free sooner), and anyone who walks in later loses a turn on every step, as with
  // the queen bee's honey
  splashHoney(x, y) {
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) this.goo(x + k, y + j, T.HONEY);
    const stuck = this.enemies.filter(e => e.hp > 0 && !e.d.npc && !e.d.flies && e.type !== 'queen' && cheb(e, { x, y }) <= 1
      && !['hide', 'stone', 'lurk'].includes(e.state));
    for (const e of stuck) e.stun = Math.max(e.stun || 0, e.d.boss ? 1 : 2);
    if (cheb(this.p, { x, y }) <= 1) this.p.sticky = 1;
    this.emit('honeyPour', { x, y, list: stuck });
    this.log(stuck.length ? `꿀 병이 깨지며 꿀이 쏟아졌다! ${stuck.length > 1 ? `${stuck.length}마리가` : josa(stuck[0].d.name, '이', '가')} 꿀에 붙어 버둥거린다.` : '꿀 병이 깨지며 꿀이 쏟아졌다! 끈적끈적.', 'good');
  }

  // 졸음 꽃: pops into a cloud of sleep pollen, the same as the trap. Whoever is in it nods off at once
  // (and stays asleep while the cloud hangs there); it drifts, so too close and you go too.
  sleepPuff(x, y) {
    addGas(this, x, y, 'sleep', 60);
    for (const [dx, dy] of DIRS8) addGas(this, x + dx, y + dy, 'sleep', 30);
    this.emit('puff', { x, y, kind: 'sleep' });
    const g = this.map.gas.sleep, slept = [];
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.d.npc || e.state === 'sleep' || ['hide', 'stone', 'lurk'].includes(e.state) || g[idx(e.x, e.y)] < SLEEP_MIN) continue;
      Object.assign(e, { state: 'sleep', wake: 0, doze: 2, aim: false });
      slept.push(e);
    }
    this.emit('doze', { list: slept });
    this.log(slept.length ? `졸음 꽃이 퐁! ${slept.length > 1 ? `${slept.length}마리가` : josa(slept[0].d.name, '이', '가')} 꾸벅꾸벅 잠들었다.` : '졸음 꽃이 퐁 터지며 꽃가루가 퍼졌다.', 'good');
  }

  // 매운 고추: too hot to think of anything but running (ai.js e.fear); it tires as anything running
  // does, and fights back only when cornered
  chili(e) {
    if (!e) return;
    e.fear = e.d.boss ? B.CHILI_BOSS : B.CHILI_TURNS;
    Object.assign(e, { state: 'flee', ran: 0, pants: 0, aim: false, wake: 0, doze: 0 });
    this.emit('chili', { enemy: e });
    this.say(e, pick(['매워!', '맵다맵다!', '혀가 불타!', '물! 물!']));
    if (this.isVisible(e.x, e.y)) this.log(e.d.boss ? `${josa(e.d.name, '이', '가')} 매워서 펄쩍 뛰었다! 금방 정신을 차릴 것 같다.` : `${josa(e.d.name, '이', '가')} 매워서 펄쩍 뛰었다! 허둥지둥 달아난다.`, 'good');
  }

  // 방울: it rings where it lands for a few turns (ringBells, every turn before the critters move), and
  // then lies there to be picked up again
  dropBell(x, y) {
    (this.map.bells ||= []).push({ x, y, t: B.BELL_TURNS });
    this.log('딸랑딸랑! 방울이 울린다.', 'good');
  }

  // Every critter in earshot that is not after you turns to the bell (a sleeper wakes and comes to
  // look); one chasing you that cannot see you right now goes to the bell too. A boss is not fooled.
  ringBells() {
    const bells = this.map.bells;
    if (!bells?.length) return;
    for (const b of bells.slice()) {
      this.emit('ring', { x: b.x, y: b.y });
      const heard = this.noise(b.x, b.y, B.BELL_RANGE);
      // the nappers of a 낮잠 방 trooping off to the bell, the chest left alone
      const den = this.map.den, troop = heard.filter(e => e.den);
      if (troop.length && ((den && this.isVisible(den.x, den.y)) || troop.some(e => this.isVisible(e.x, e.y)))) this.discover('bell_den');
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.d.npc || e.d.boss || this.calm(e) || cheb(e, b) > B.BELL_RANGE || e.fear > 0) continue;
        if (!['search', 'wander', 'hunt'].includes(e.state) || (e.state === 'hunt' && canSee(this, e, 9))) continue;
        if (e.state !== 'search' && !heard.includes(e)) heard.push(e);
        Object.assign(e, { state: 'search', searchT: 0, last: { x: b.x, y: b.y }, aim: false, lured: this.turn });
      }
      if (heard.length) this.emit('heard', { x: b.x, y: b.y, list: heard });
      if (--b.t <= 0) {
        bells.splice(bells.indexOf(b), 1);
        this.pickups.push({ x: b.x, y: b.y, type: 'bell' });
        this.emit('bellDone', { x: b.x, y: b.y });
      }
    }
  }

  // 민들레 홀씨: blown off on the wind to open ground far away on this field (somewhere you could walk
  // to, never into a locked room, not beside a critter), and whoever was chasing you has lost you
  blowAway() {
    const p = this.p, m = this.map, from = { x: p.x, y: p.y }, dm = distMap(m, p.x, p.y);
    const bad = [T.LAVA, T.CHASM, T.HONEY, T.SLIME, T.ICE, T.RING];
    const spots = [];
    let far = null;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = idx(x, y), d = dm[i];
      if (m.tiles[i] !== FLOOR || d >= 9999 || !this.canEnemyEnter(x, y) || bad.includes(m.ter[i]) || isPool(m.ter[i]) || m.fire[i] > 0) continue;
      if (this.enemies.some(e => e.hp > 0 && !e.d.npc && !this.calm(e) && cheb(e, { x, y }) <= 3)) continue;
      if (!far || d > dm[idx(far.x, far.y)]) far = { x, y };
      if (d >= B.BLOW_MIN) spots.push({ x, y });
    }
    const to = spots.length ? pick(spots) : far;
    if (!to) { this.log('바람이 없어서 홀씨가 제자리에 내려앉았다.'); return; }
    p.x = to.x; p.y = to.y;
    this.trail = [{ x: to.x, y: to.y }];
    p.sticky = 0; p.held = null;
    let lost = 0;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.state !== 'hunt') continue;
      Object.assign(e, { state: 'search', searchT: 0, last: from, aim: false });
      lost++;
    }
    this.emit('blow', { from, to });
    this.log(lost ? '민들레 홀씨를 후 불었다. 바람을 타고 훨훨! 쫓아오던 녀석들이 나를 놓쳤다.' : '민들레 홀씨를 후 불었다. 바람을 타고 훨훨 날아갔다!', 'good');
    onEnter(this, 'player', to.x, to.y);
    this.pickupAt(to.x, to.y);
  }

  throwBomb(x, y) {
    if (!this.canAct() || !this.p.items.bomb || !this.canThrowAt(x, y)) return false;
    const p = this.p;
    p.items.bomb--;
    p.blend = false;
    if (x !== p.x) p.face = Math.sign(x - p.x);
    this.emit('throw', { from: { x: p.x, y: p.y }, to: { x, y } });
    const bag = this.lv('bombbag'), fb = this.lv('firebomb');
    const mult = fb ? 1.25 + 0.25 * fb : 1 + 0.25 * Math.max(0, bag - 1);
    explosion(this, x, y, 1, { dmg: Math.round(B.bombDamage(this.floor) * mult), cause: '내가 던진 폭탄에 휘말렸다', burn: fb ? 3 : 0, own: true });
    this.endTurn();
    return true;
  }

  // 마법사's wand (v0.23): tap a monster you can see two to four tiles off and a spark of magic flies at
  // it; the first one in its way takes it. It costs the turn and a spark, and a spark comes back every
  // few turns, so the wand opens a fight but does not win it while you run. (Before v0.23 the mage's
  // bolt went off by itself every few turns, and running in circles won every fight.)
  canZapAt(x, y) {
    const p = this.p, e = inMap(x, y) && this.enemyAt(x, y);
    return !!(this.char.wand && p.charges > 0 && e && e.hp > 0 && !e.d.npc && e.state !== 'hide' && this.isVisible(x, y)
      && cheb(e, p) >= 2 && cheb(e, p) <= B.WAND_RANGE);
  }

  castWand(x, y) {
    if (!this.canAct() || !this.canZapAt(x, y)) return false;
    const p = this.p, s = this.stat();
    // along the line toward the target: whoever stands in the way first
    let e = this.enemyAt(x, y), cx = p.x, cy = p.y;
    const dx = Math.abs(x - cx), dy = -Math.abs(y - cy), sx = cx < x ? 1 : -1, sy = cy < y ? 1 : -1;
    for (let err = dx + dy; !(cx === x && cy === y);) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; cx += sx; }
      if (e2 <= dx) { err += dx; cy += sy; }
      const o = this.enemyAt(cx, cy);
      if (o && o.hp > 0 && !o.d.npc && o.state !== 'hide') { e = o; break; }
    }
    p.charges--;
    p.wandT = 0;
    p.blend = false;
    if (e.x !== p.x) p.face = Math.sign(e.x - p.x);
    (this.struck ||= new Set()).add(e.id);
    this.emit('wand', { from: { x: p.x, y: p.y }, to: { x: e.x, y: e.y } });
    // half again as hard as a swing of your staff, and it shocks the water the target stands in
    this.zapHit({ x: p.x, y: p.y }, e, Math.max(1, Math.round((s.atk + rnd(2)) * B.WAND_POWER) - e.def), new Set(), true);
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
      else if (q.type === 'gold') this.addGold(q.amount, q.raw);
      else if (q.type === 'chest') {
        this.meta.stats.chests = (this.meta.stats.chests || 0) + 1;
        this.queue.push({ kind: 'chest', rich: !!q.rich, vein: !!q.vein });
        this.log('보물 상자를 열었다!', 'good');
        if (q.guarded) this.wakeStatues(x, y);
      } else if (q.type === 'bossChest') {
        // the stage's prize: the gold comes out in a heap, every relic you carry grows a level (and
        // whatever that completes evolves, one after another), and then you choose: home with the
        // win, or down through the floor to 깊은 곳 (bank adds the gold either way)
        this.meta.stats.chests = (this.meta.stats.chests || 0) + 1;
        this.emit('bossChest', { x, y, gold: Math.round(B.stageBonus(this.stage) * this.goldBonus) });
        this.log('대장의 보물 상자를 열었다!', 'good');
        this.bossPrize();
        this.queue.push({ kind: 'deeper' });
      } else if (q.type === 'lockedChest') {
        map.keyHeld = false;
        this.queue.push({ kind: 'chest', rich: true });
        this.log('열쇠로 잠긴 상자를 열었다!', 'good');
      } else if (q.type === 'cageKey') {
        map.cageKey = true;
        this.log('우리 열쇠를 주웠다! 갇힌 친구에게 가자.', 'good');
      } else if (q.type === 'key') {
        map.keyHeld = true;
        this.log('작은 열쇠를 주웠다. 이 구역의 잠긴 곳을 연다.', 'good');
      } else if (q.type === 'candy') this.fission(q.n || B.candySteps(this.floor), x, y);
      else if (q.type === 'crystal') this.takeCrystal(q);
      else if (q.type === 'tag') this.takeTag();
      else if (q.type === 'necklace') {
        this.quests.ghost.state = 'found';
        this.log('아기새 리본을 찾았다! 울보 아기새에게 돌려주자.', 'good');
      } else { this.p.items[q.type] = (this.p.items[q.type] || 0) + 1; this.log(`${josa(ITEMS[q.type].name, '을', '를')} 주웠다.`); }
    }
  }

  // An old worker's name tag: the guild pays a little for each one brought back, and asks nothing.
  takeTag() {
    const st = this.meta.stats, n = st.tags = (st.tags || 0) + 1;
    this.addGold(B.TAG_GOLD * (1 + this.stage));
    this.log(n === 1 ? '낡은 일꾼 명찰을 주웠다. 이름 자리가 긁혀 있다. 조합에서 골드로 바꿔 준다.' : pick(TAG_LINES));
  }

  // A relic from a crystal vault: the other crystals of that vault shatter.
  takeCrystal(q) {
    const rl = this.p.relics, id = q.relic;
    const fits = rl[id] ? rl[id] < maxLevelOf(id) : Object.keys(rl).length < this.slots;
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
  // ...or still seeing stars after a stun (ai.js e.dazed), too dizzy to see a blow coming. A boss
  // shakes it off quicker: only its last dizzy turn counts.
  // (one busy scrapping with another critter does not see you coming either)
  unaware(e) { return ['sleep', 'wander', 'search'].includes(e.state) || this.calm(e) || this.dizzy(e) || e.foe != null; }
  dizzy(e) { return !!e.dazed || (e.stun > 0 && !e.d.boss); }

  playerAttack(e, ram = false) {
    const s = this.stat(), L = this.levels(), p = this.p;
    (this.struck ||= new Set()).add(e.id);
    // 붉은 달: the lower your health, the harder you hit
    const rage = L.bloodmoon ? 1 + (0.5 + 0.25 * L.bloodmoon) * (1 - p.hp / s.maxHp) : 1;
    const base = Math.round((s.atk + rnd(2)) * (ram ? 2 : 1) * rage);
    if (ram) this.emit('ram', { x: e.x, y: e.y, from: { x: p.x, y: p.y } });
    if (rage >= 1.4) {
      this.emit('bloodrage', { x: p.x, y: p.y });
      if (!this.told.bloodmoon) { this.told.bloodmoon = true; this.log('붉은 달이 차오른다. 아플수록 힘이 솟는다!', 'evo'); }
    }
    // 그림자 걸음: right after a kill you are still in the shadows, so the next blow is a surprise too
    const shade = p.shade > 0 && !this.unaware(e);
    if (this.unaware(e) || shade) {
      p.shade = 0;
      const dizzy = !shade && !['sleep', 'wander', 'search'].includes(e.state) && this.dizzy(e);
      this.emit('sneak', { x: e.x, y: e.y, from: { x: p.x, y: p.y } });
      this.log(shade ? `그림자 속에서 튀어나와 ${josa(e.d.name, '을', '를')} 내리쳤다!` : `${e.state === 'sleep' ? '자고 있는' : dizzy ? '어질어질한' : '나를 못 본'} ${josa(e.d.name, '을', '를')} 세게 내리쳤다!`, 'good');
      if (dizzy) this.discover('daze_sneak');
      this.strike(e, Math.round(base * s.sneak), 'sneak');
      // 암살 단검: a surprise kill is over before anyone can react; they all lose this turn
      if (e.hp <= 0 && L.dagger) { this.quick = true; this.emit('quick', { x: p.x, y: p.y }); }
    } else this.strike(e, base, 'normal');
    // 화산 망치: the ground round what you hit bursts into flame
    if (L.volcano) this.erupt(e, 3 + 2 * L.volcano);
    // 신의 망치: and a bolt comes down on it
    if (L.godhammer && e.hp > 0) this.smite(e);
    // 곰: whoever is still standing goes back a tile
    if (this.char.shove && e.hp > 0 && !e.d.boss && !e.d.npc) this.knock(e, 2 + Math.floor(this.floor / 4));
    // 수정 고슴도치: a blow on its spines pricks back
    if (e.d.spiky) { this.emit('prick', { x: p.x, y: p.y, from: { x: e.x, y: e.y } }); this.hurtPlayer(e.d.spiky, `${e.d.name}의 가시에 찔렸다`, 'thorns'); }
    // 해파리: touching it to hit it stings too
    if (e.d.sting) { this.emit('sting', { x: p.x, y: p.y }); this.hurtPlayer(2 + Math.floor(this.floor / 8), `${e.d.name}에 쏘였다`, 'thorns'); }
    // the swing carries on into everyone else standing next to you
    const share = L.quake || L.whirlwind ? 1 : L.whirl ? 0.6 + 0.1 * L.whirl : 0.3 * (L.sweep || 0);
    if (share) {
      for (const o of this.enemies.filter(o => o !== e && o.hp > 0 && this.touching(o, this.p))) {
        this.emit('attack', { from: { x: this.p.x, y: this.p.y }, to: { x: o.x, y: o.y }, who: 'player' });
        this.strike(o, Math.max(1, Math.round(base * share)), 'normal');
        // 칼바람: the ones beside you are blown a tile away (over a drop, into lava, onto a trap...)
        if (L.whirlwind && o.hp > 0 && !o.d.boss && !o.d.npc) this.knock(o, 2 + Math.floor(this.floor / 4));
      }
    }
  }

  // 화산 망치: fire bursts up from the ground round the one you hit, scorching and setting alight
  // every other critter there (not you, and not a calm one minding its own business)
  erupt(e, dmg) {
    const at = { x: e.x, y: e.y }, tiles = [];
    for (const [dx, dy] of DIRS8) if (this.passable(at.x + dx, at.y + dy) && !(at.x + dx === this.p.x && at.y + dy === this.p.y)) tiles.push({ x: at.x + dx, y: at.y + dy });
    this.emit('erupt', { x: at.x, y: at.y, tiles });
    const near = this.enemies.filter(o => o !== e && o.hp > 0 && !o.d.npc && !this.calm(o) && cheb(o, at) === 1);
    for (const o of near) {
      this.hurt(o, dmg, 'fire');
      if (o.hp > 0) setBurn(this, o, 2);
    }
    if (near.length && !this.told.volcano) { this.told.volcano = true; this.log('쿠웅! 화산 망치가 땅을 치자 둘레에서 불기둥이 솟았다!', 'evo'); }
  }

  // 신의 망치: every blow calls a bolt down from the sky onto what you hit
  smite(e) {
    const L = this.levels(), dmg = 6 + 2 * (L.thunder || 1), hit = new Set();
    this.zapHit({ x: e.x, y: e.y - 8 }, e, dmg, hit);
    if (L.stormlord) this.chain(e, dmg, hit, L.stormlord);
  }

  // One blow from you: defence, then the relics that ride along with every hit.
  strike(e, raw, kind) {
    const L = this.levels(), dealt = Math.max(1, raw - e.def);
    this.hurt(e, dealt, kind);
    // 피의 군주: a share of every blow comes back to you as health
    const steal = (this.char.lifesteal || 0) + (L.bloodblade ? (L.bloodblade < 3 ? 1 : 2) : 0) + (L.bloodking ? Math.round(dealt * 0.3) : 0);
    if (steal && !e.d.npc) this.heal(steal);
    if (e.hp <= 0) return;
    // the flame sword always burns; the fire ring now and then, and what it catches goes on burning
    const lit = L.ring && Math.random() < 0.3;
    const fire = (L.flamesword ? 2 + L.flamesword : 0) + (lit ? 3 * L.ring : 0);
    if (fire) {
      this.hurt(e, fire, 'fire');
      const t = this.map.ter[idx(e.x, e.y)];
      if (t === T.BRUSH) ignite(this, e.x, e.y);
      if (lit && e.hp > 0) setBurn(this, e, 2);
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
    const other = this.enemyAt(x, y), ter = inMap(x, y) ? this.map.ter[idx(x, y)] : T.NONE;
    // over the edge it goes (a boss, a crowned one or a flier holds on)
    if (ter === T.CHASM && !e.d.flies && !e.d.boss && !e.chief) { this.plunge(e, { x, y }); return; }
    if (ter === T.LAVA && !e.d.flies && !e.d.fireproof) {
      this.emit('bonk', { x: e.x, y: e.y, dx, dy });
      this.hurt(e, B.lavaHurt(this.floor) * 2, 'fire');
      if (e.hp > 0) setBurn(this, e, 3);
      return;
    }
    if (!this.passable(x, y) || other || (x === this.p.x && y === this.p.y)) {
      this.emit('bonk', { x: e.x, y: e.y, dx, dy });
      this.hurt(e, dmg, 'bonk');
      // and the one it was knocked into blames it (다툼)
      if (other) this.hurt(other, dmg, 'bonk', e.hp > 0 ? e : null);
      return other;
    }
    const from = { x: e.x, y: e.y };
    e.x = x; e.y = y;
    this.emit('push', { enemy: e, from, to: { x, y } });
    onEnter(this, e, x, y);
    if (isTrap(this.map.ter[idx(x, y)])) springTrap(this, x, y);
  }

  // `by`: the critter whose blow it was (ai.js brawl), when it was not yours
  hurt(e, dmg, kind, by) {
    if (e.hp <= 0 || e.d.npc) return;
    if (e.stoneT > 0 || e.shellT > 0) dmg = 1; // a gargoyle gone to stone, a hermit crab in its shell
    if (e.state === 'dead') dmg = e.hp;         // a ladybug playing dead: one more blow and it is over
    e.hp -= dmg;
    e.hitAt = this.turn;
    this.emit('hit', { enemy: e, x: e.x, y: e.y, dmg, kind });
    // 무당벌레: the first time it should fall, it flips over and plays dead
    if (e.hp <= 0 && e.d.playDead && !e.faked) {
      Object.assign(e, { faked: true, hp: Math.max(1, Math.round(e.maxHp * 0.3)), state: 'dead', fakeT: 3, aim: false });
      this.emit('fakeDeath', { enemy: e });
      if (this.isVisible(e.x, e.y)) this.log(`${josa(e.d.name, '이', '가')} 발랑 뒤집혔다.`, 'good');
      return;
    }
    if (e.d.twist && !e.twisted && e.hp > 0) twist(this, e);
    // 소라게: tucks into its shell for two turns; half beaten, it leaves the shell and runs
    if (e.d.shell && e.hp > 0 && !e.bare) {
      if (e.hp <= e.maxHp / 2) {
        Object.assign(e, { bare: true, def: 0, shellT: 0, look: 'hermitBare', state: 'flee', ran: 0, pants: 0 });
        this.pickups.push({ x: e.x, y: e.y, type: 'gold', amount: (Math.floor((this.floor - 1) / 4) + 1) * rint(2, 4) });
        this.emit('shed', { enemy: e });
        if (this.isVisible(e.x, e.y)) this.log(`${josa(e.d.name, '이', '가')} 껍데기를 버리고 맨몸으로 달아난다! 껍데기 안에 동전이 있었다.`, 'good');
      } else if (!e.shellT) {
        e.shellT = 2; e.look = 'hermitIn';
        this.emit('tuck', { enemy: e });
      }
    }
    if (e.hp <= 0) {
      if (by && this.isVisible(e.x, e.y)) this.log(`${josa(by.d.name, '이', '가')} ${josa(e.d.name, '을', '를')} 쓰러뜨렸다!`, 'good');
      this.onKill(e);
      if (by && by.hp > 0 && !by.d.boss && !by.d.npc && !by.big) this.puffUp(by);
    } else {
      // 다툼: a blow of yours (not the fire, the spores or a falling stone) turns a scrapper back to you
      if (e.foe != null && !by && !['fire', 'bones', 'rock', 'slam'].includes(kind)) Object.assign(e, { foe: null, foeT: 0, state: 'hunt', last: { x: this.p.x, y: this.p.y } });
      // another critter's blow: it goes for that one if it is the brawling kind; either way it was not
      // you, so nothing turns on you for it
      if (by) brawl(this, e, by);
      // bees singed by fire are in its smoke too (world.js smokeHive): dozy, not angry
      else if (!(kind === 'fire' && e.d.swarm)) rouse(this, e, 'hit');
      if (e.d.splits && e.hp >= 4) this.split(e);
      // caught: a goblin hit while it carries your gold lets go of the pouch, and runs off empty-handed
      if (e.loot) {
        this.pickups.push({ x: e.x, y: e.y, type: 'gold', amount: e.loot, stolen: true });
        this.emit('dropLoot', { enemy: e, x: e.x, y: e.y, n: e.loot });
        this.log(`${josa(e.d.name, '이', '가')} 훔친 골드를 떨어뜨렸다!`, 'good');
        e.loot = 0;
      }
    }
  }

  // 다툼: the winner swells up a size (once), the way Shiren's monsters grow on a kill: tougher, bitier,
  // and worth twice the experience. Let a scrap run its course and this is what is left; jump in first
  // and it never happens.
  puffUp(e) {
    const add = Math.max(2, Math.round(e.maxHp * B.SWELL_HP));
    Object.assign(e, { big: true, maxHp: e.maxHp + add, hp: e.hp + add, atk: e.atk + Math.max(1, Math.round(e.atk * B.SWELL_ATK)), xp: 2 * (e.xp ?? e.d.xp) });
    this.emit('puffUp', { enemy: e });
    if (this.isVisible(e.x, e.y)) {
      this.say(e, '흥!');
      this.log(`싸움에서 이긴 ${josa(e.d.name, '이', '가')} 기세등등하게 부풀었다!`, 'warn');
    }
  }

  // Knocked over a drop: it falls away for good. It counts, but whatever it carried falls with it.
  plunge(e, to) {
    this.emit('plunge', { enemy: e, from: { x: e.x, y: e.y }, to });
    e.x = to.x; e.y = to.y;
    e.hp = 0;
    this.log(`${josa(e.d.name, '이', '가')} 낭떠러지 아래로 떨어졌다!`, 'good');
    this.kills++; this.meta.stats.kills++;
    const book = this.meta.critters ||= {};
    book[e.type] = (book[e.type] || 0) + 1;
    this.emit('kill', { enemy: e, fell: true });
    this.gainXp(e.xp ?? e.d.xp);
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
    const book = this.meta.critters ||= {};
    book[e.type] = (book[e.type] || 0) + 1;
    this.emit('kill', { enemy: e });
    // 연속 처치 (v0.23): monsters knocked down one right after another (each within a couple of turns
    // of the last; a bomb or a chain of lightning does several at once) drop more gold each, and the
    // cheer climbs with the count
    if (!e.d.boss && !e.d.npc) {
      const c = this.combo ||= { n: 0, t: -9 };
      c.n = this.turn - c.t <= B.COMBO_TURNS ? c.n + 1 : 1;
      c.t = this.turn;
      if (c.n >= 2) {
        this.addGold(Math.min(c.n, 6) * (1 + B.gs(this.stage)) * B.COMBO_GOLD);
        this.emit('combo', { n: c.n, x: e.x, y: e.y });
        stats.bestCombo = Math.max(stats.bestCombo || 0, c.n);
        if (c.n === 5) this.log('다섯 마리 연속! 대박!', 'evo');
      }
    }
    if (e.d.boss) {
      if (!stats.bosses.includes(e.type)) stats.bosses.push(e.type);
      this.log(`${josa(e.d.name, '을', '를')} 쓰러뜨렸다!`, 'good');
      // the stage's last boss leaves a big chest; the trip is won when you open it
      if (this.floor >= this.bossFloor) {
        this.pickups.push({ x: e.x, y: e.y, type: 'bossChest' });
        this.log('대장이 커다란 보물 상자를 남겼다! 열면 탐험 성공이다.', 'good');
      } else {
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
      this.addGold(30 * (B.gfl(this.floor) / 3));
      this.dropNear(e.x, e.y, { type: 'candy', n: B.candySteps(this.floor) + B.CANDY_BOSS });
    } else if (e.chief && e.prize) {
      // the crowned one the sign by the burrow warned of (갈림길): the prize it was guarding
      this.dropNear(e.x, e.y, { type: 'chest', rich: true });
      this.log(`${josa(this.chiefName(e), '이', '가')} 쓰러지며 좋은 보물 상자를 떨궜다!`, 'good');
    } else if (e.chief) {
      this.dropNear(e.x, e.y, { type: 'cageKey' });
      this.log(`${josa(this.chiefName(e), '이', '가')} 쓰러지며 우리 열쇠를 떨궜다!`, 'good');
    } else if (e.d.treasure) {
      this.pickups.push({ x: e.x, y: e.y, type: 'chest' }, { x: e.x, y: e.y, type: 'gold', amount: B.turtleGold(this.floor) });
      if (this.open('candy')) this.dropNear(e.x, e.y, { type: 'candy' });
      this.log(`${josa(e.d.name, '이', '가')} 등에 지고 있던 보물을 떨궜다!`, 'good');
    } else if (e.d.quest) {
      this.pickups.push({ x: e.x, y: e.y, type: 'necklace' });
      this.log('도둑 들쥐가 리본을 떨궜다!', 'good');
    } else if (e.loot) {
      this.pickups.push({ x: e.x, y: e.y, type: 'gold', amount: e.loot, stolen: true });
    } else if (L.minecrown && !e.d.bones && !e.d.head && this.petrify(e)) {
      // 반짝돌 왕관: it sets hard into a little sparkle rock where it fell (instead of dropping coins)
    } else if (L.goldfang || Math.random() < B.GOLD_DROP_CHANCE) {
      this.pickups.push({ x: e.x, y: e.y, type: 'gold', amount: (Math.floor((this.floor - 1) / 3) + 1) * rint(1, 4) });
    }
    if (e.d.bones) this.swell(e);
    this.afterlife(e);
    if (L.shadow && !e.d.npc) { this.p.shade = 3; this.emit('shade', { x: this.p.x, y: this.p.y }); }
    // 달그림자: you melt into the dark, and whoever was after you loses you (ai.js canSee)
    if (L.phantom && !e.d.npc) {
      if (!(this.p.vanish > 0)) this.emit('fade', { x: this.p.x, y: this.p.y });
      this.p.vanish = Math.max(this.p.vanish || 0, 1 + L.phantom);
      if (!this.told.phantom) { this.told.phantom = true; this.log('달그림자 속으로 모습이 사라졌다. 적들이 나를 놓쳤다.', 'evo'); }
    }
    // 생명의 나무: now and then a berry bush springs up where it fell
    if (L.lifetree && !e.d.npc && Math.random() < 0.15 + 0.15 * L.lifetree) this.sprout(e.x, e.y);
    const heal = 2 * (L.fang || 0) + (L.bloodcrown ? 4 + 2 * L.bloodcrown : 0) + (L.goldfang ? 5 + L.goldfang : 0);
    if (heal) this.heal(heal);
    this.gainXp(e.xp ?? e.d.xp);
  }

  chiefName(e) { return `우두머리 ${e.d.name}`; }

  // bare ground (or flattened grass, or ash) that is not on fire
  bareSpot(x, y) {
    const m = this.map, i = idx(x, y);
    return m.tiles[i] === FLOOR && !m.fire[i] && [T.NONE, T.GRASS, T.ASH].includes(m.ter[i]);
  }
  // ...in a room, with nothing lying on it and all eight tiles round it walkable, so a rock here closes no way
  openSpot(x, y) {
    const m = this.map;
    if (!this.bareSpot(x, y) || m.room[idx(x, y)] < 0 || this.pickups.some(q => q.x === x && q.y === y)) return false;
    return DIRS8.every(([dx, dy]) => inMap(x + dx, y + dy) && m.tiles[idx(x + dx, y + dy)] === FLOOR && !isGap(m.ter[idx(x + dx, y + dy)]));
  }

  // 생명의 나무: a berry bush, ripe already (walk in to eat; world.js eatBerries)
  sprout(x, y) {
    const i = idx(x, y);
    if (!this.bareSpot(x, y)) return;
    this.map.ter[i] = T.BERRY;
    this.emit('tiles', { list: [i], soft: true });
    this.emit('sprout', { x, y });
    if (!this.told.lifetree) { this.told.lifetree = true; this.log('쓰러진 자리에서 산딸기 덤불이 쑥 자라났다!', 'evo'); }
  }

  // 반짝돌 왕관: the fallen critter sets into a pebble of sparkle rock, two swings to crack (mineOre)
  petrify(e) {
    if (e.d.boss || e.chief || e.d.flies || !this.openSpot(e.x, e.y)) return false;
    const i = idx(e.x, e.y), tier = Math.min(ORES.length - 1, Math.floor(B.gs(this.stage)));
    this.map.tiles[i] = ORE;
    this.map.ores.push({ x: e.x, y: e.y, cells: [{ x: e.x, y: e.y }], size: 1, hits: 0, tier, vent: null, pebble: true });
    this.emit('tiles', { list: [i] });
    this.emit('petrify', { x: e.x, y: e.y });
    if (!this.told.minecrown) { this.told.minecrown = true; this.log('쓰러진 적이 반짝 바위로 굳어 버렸다…', 'evo'); }
    return true;
  }

  // what some v0.23 critters leave when they fall
  afterlife(e) {
    const d = e.d, scale = this.foeScale, seen = this.isVisible(e.x, e.y);
    // 눈사람: the head rolls off and keeps throwing
    if (d.head) {
      const h = this.spawnEnemy('snowhead', e.x, e.y, scale);
      Object.assign(h, { state: 'hunt', last: { x: this.p.x, y: this.p.y } });
      if (seen) this.log('눈사람 머리가 데굴데굴 굴러 나왔다!', 'warn');
    }
    // 빈 갑옷: the pieces lie there, and put themselves back together unless scattered
    if (d.reform && !e.reformed) {
      const pile = this.spawnEnemy('armorpile', e.x, e.y);
      Object.assign(pile, { reformT: d.reform, armorAtk: e.atk, state: 'hunt' });
      if (seen) this.log('갑옷이 와르르 무너졌다. 조각이 덜그럭거린다…', 'warn');
    }
    if (e.type === 'armorpile' && seen) this.log('갑옷 조각을 흩어 놓았다. 이제 조용하다.', 'good');
    // 불나방: sparks fly about where it falls
    if (d.lantern) {
      // (never onto you: you swatted it, you get a moment to step back from the flames)
      const near = shuffle(DIRS8.filter(([dx, dy]) => e.x + dx !== this.p.x || e.y + dy !== this.p.y)).slice(0, 3);
      this.emit('sparks', { x: e.x, y: e.y });
      for (const [dx, dy] of near) ignite(this, e.x + dx, e.y + dy, true);
    }
    if (e.type === 'bigmask') this.log('큰 가면이 툭 떨어졌다. 가면 뒤에는… 아무도 없었다.', 'warn');
  }

  // 숯덩이 burnt out: a heap of ash
  crumble(e) {
    const i = idx(e.x, e.y);
    if (this.map.tiles[i] === FLOOR && [T.NONE, T.GRASS].includes(this.map.ter[i])) { this.map.ter[i] = T.ASH; this.emit('tiles', { list: [i] }); }
    this.emit('crumble', { enemy: e });
    if (this.isVisible(e.x, e.y)) this.log(`${josa(e.d.name, '이', '가')} 다 타서 재가 되었다.`, 'good');
    e.shellT = 0; e.stoneT = 0;
    this.hurt(e, e.hp, 'fire');
  }

  // A poison mushroom that falls swells up, and bursts after your next move: everyone next to it then
  // takes a hit, monsters too. The tiles around it glow, so one step away keeps you out of it.
  swell(e) {
    this.puffs.push({ x: e.x, y: e.y, dmg: e.atk + rint(1, 3), t: 1 });
    this.emit('swell', { x: e.x, y: e.y });
    if (this.isVisible(e.x, e.y)) this.log('독버섯이 부풀어 오른다. 곧 터진다!', 'warn');
  }

  burstPuffs() {
    const due = this.puffs.filter(f => f.t-- <= 0);
    if (!due.length) return;
    this.puffs = this.puffs.filter(f => f.t >= 0);
    for (const f of due) {
      this.emit('bones', { x: f.x, y: f.y });
      for (const o of this.enemies.filter(o => o.hp > 0 && cheb(o, f) <= 1)) this.hurt(o, f.dmg * 2, 'bones');
      if (cheb(this.p, f) <= 1) this.hurtPlayer(Math.max(1, f.dmg - this.stat().def), '독버섯 포자에 맞았다', 'bones');
    }
  }

  // Stones about to come down (the boar chief's crash, a cave's stalactites shaken loose): their tiles
  // show red, you get one move to step off, then whoever stands there is hit, critters twice as hard.
  dropRock(x, y, dmg, cause) {
    if (!passable(this.map, x, y) || this.rocks.some(r => r.x === x && r.y === y)) return;
    this.rocks.push({ x, y, dmg, cause, due: this.turn + (this.enemyPhase ? 1 : 2) });
  }
  dropRocks() {
    const due = this.rocks.filter(r => r.due <= this.turn);
    if (!due.length) return;
    this.rocks = this.rocks.filter(r => r.due > this.turn);
    for (const r of due) {
      this.emit('rockfall', { x: r.x, y: r.y });
      const e = this.enemyAt(r.x, r.y);
      if (e && !e.d.npc) this.hurt(e, r.dmg * 2, 'rock');
      if (this.p.x === r.x && this.p.y === r.y) this.hurtPlayer(r.dmg, r.cause, 'rock');
    }
  }

  damagePlayer(raw, src, kind = 'melee') {
    const s = this.stat(), L = this.levels(), p = this.p;
    // 불사의 심장: just back on your feet, nothing can touch you for a few turns
    if (p.invuln > 0) { this.emit('ward', { x: p.x, y: p.y }); return false; }
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
    // 거북이: tucked in the shell, a blow lands at half strength
    if (p.shell) { dmg = Math.max(1, Math.ceil(dmg / 2)); this.emit('shellhit', { x: p.x, y: p.y }); }
    // 강철 심장: with a third of your health or less, blows glance off at half strength
    if (L.ironheart && p.hp <= s.maxHp / 3) { dmg = Math.max(1, Math.ceil(dmg / 2)); this.emit('iron', { x: p.x, y: p.y }); }
    // 수호 거북: tucked into the shell after a rest, a blow is a knock on the shell (a boss's, half of it)
    if (p.guard) { dmg = src?.d?.boss ? Math.max(1, Math.ceil(dmg / 2)) : 1; this.emit('shellhit', { x: p.x, y: p.y }); }
    this.hurtPlayer(dmg, `${src.d.name}에게 당했다`, kind);
    if (src && (kind === 'melee' || kind === 'charge')) {
      const thorn = (L.fortress ? 4 + 2 * L.fortress : 2 * (L.thorns || 0)) + (L.spikecloak ? 4 + 2 * L.spikecloak : 0) + (this.char.thorns || 0);
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
    if (p.invuln > 0) { this.emit('ward', { x: p.x, y: p.y }); return; }
    // no last-moment rescue (v0.20): a careless step can end the trip, like Shattered Pixel Dungeon
    p.hp -= dmg;
    this.cause = cause;
    if (p.sleep) { p.sleep = 0; p.wokeAt = this.turn; this.log('아파서 잠이 확 깼다!', 'warn'); }
    this.emit('phit', { x: p.x, y: p.y, dmg, kind });
    const L = this.levels(), maxHp = this.stat().maxHp;
    const relicLives = (L.eternity ? 2 : L.undying ? 1 : 0) + (L.bloodking ? 1 : 0), band = L.herbal ? 6 + 4 * L.herbal : 6 * (L.bandage || 0);
    if (p.hp <= 0 && (this.revives || 0) < relicLives + (this.char.lives || 0)) {
      this.revives = (this.revives || 0) + 1;
      p.hp = 0;
      // the relics' lives go first; the cat's own spare one is last
      const relic = this.revives <= relicLives;
      // 영원의 심장 brings you back whole, the others halfway
      this.heal(relic && L.eternity ? maxHp : Math.round(maxHp / 2));
      const heart = !relic ? '아홉 목숨' : this.revives <= (L.eternity ? 2 : L.undying ? 1 : 0) ? RELICS[L.eternity ? 'eternity' : 'undying'].name : RELICS.bloodking.name;
      this.log(`${heart}의 힘으로 쓰러졌다가 다시 일어났다.`, 'evo');
      this.emit('banner', { text: `${heart}!` });
      // a relic's life: a few turns no harm can touch you, and the blast of it throws back whoever stood close
      if (relic) {
        p.invuln = 1 + (L.undying || 1);
        const near = this.enemies.filter(o => o.hp > 0 && !o.d.npc && !o.d.boss && cheb(o, p) === 1);
        this.emit('revive', { x: p.x, y: p.y });
        for (const o of near) this.knock(o, 4 + 2 * (L.fortress || 1));
        this.log('잠깐 동안은 아무것도 나를 다치게 하지 못한다!', 'good');
      }
    } else if (p.hp > 0 && band && this.bandageUsed < (L.herbal ? 2 : 1) && p.hp < maxHp / 3) {
      this.bandageUsed++;
      this.heal(band);
      this.log('비상 붕대를 감았다.', 'good');
    }
    // 스컹크: badly hurt, a smell so bad that everyone close reels (once a field)
    if (this.char.stink && !this.stunk && p.hp > 0 && p.hp < maxHp / 3) {
      this.stunk = true;
      const list = this.enemies.filter(e => e.hp > 0 && !e.d.npc && cheb(e, p) <= 2);
      for (const e of list) e.stun = Math.max(e.stun || 0, e.d.boss ? 1 : 2);
      this.emit('stink', { x: p.x, y: p.y, list });
      this.log(list.length ? '뿌웅… 지독한 냄새에 주변 적들이 어질어질하다!' : '뿌웅… 아무도 없는 데서 냄새만 퍼졌다.', 'good');
    }
  }

  heal(n) {
    const before = this.p.hp;
    this.p.hp = Math.min(this.stat().maxHp, this.p.hp + n);
    if (this.p.hp > before) this.emit('heal', { x: this.p.x, y: this.p.y, n: this.p.hp - before });
  }

  // `raw`: the amount already has the gold bonuses in it (sparkle-rock gold)
  addGold(n, raw = false) {
    const g = Math.max(1, Math.round(raw ? n : n * this.stat().goldMult));
    this.gold += g;
    this.emit('gold', { x: this.p.x, y: this.p.y, n: g });
  }

  gainXp(n) {
    const p = this.p;
    p.xp += n;
    while (p.xp >= B.xpToLevel(p.lvl)) {
      p.xp -= B.xpToLevel(p.lvl);
      this.withMaxHpDelta(() => { p.lvl++; });
      this.queue.push({ kind: 'level' });
      this.emit('levelup', { lvl: p.lvl });
    }
  }

  // Loud things wake sleepers nearby and draw wanderers over.
  // Wakes and draws enemies within r. Returns the ones that heard it and are now coming to look.
  noise(x, y, r) {
    let woke = 0;
    const heard = [];
    // in the cave, a loud enough noise shakes the stalactites above it loose
    const drips = this.map.drips?.filter(d => cheb(d, { x, y }) <= Math.min(r, B.DRIP_SHAKE)) || [];
    if (drips.length) {
      this.map.drips = this.map.drips.filter(d => !drips.includes(d));
      for (const d of drips) this.dropRock(d.x, d.y, B.rockDmg(this.floor), '떨어진 종유석에 맞았다');
      this.emit('rumble', { x, y });
      if (!this.told.drip) { this.told.drip = true; this.log('우르르… 천장의 종유석이 흔들린다! 붉은 칸에서 비키자.', 'warn'); }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.d.screams || cheb(e, { x, y }) > r) continue;
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
    if (p.inked > 0) p.inked--;
    if (this.char.wand && p.charges < B.WAND_CHARGES && ++p.wandT >= B.WAND_RECHARGE) { p.charges++; p.wandT = 0; this.emit('recharge', { n: p.charges }); }
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
    if (this.char.breath && this.turn % this.char.breath === 0) this.breathe();
    if (this.pet) this.petTick();

    // doors shut the moment nobody stands in them, so a chaser right behind you loses sight of you
    // as you step through (the Shattered Pixel Dungeon door ambush)
    this.refreshDoors();
    this.ringBells();
    this.burstPuffs();
    this.dropRocks();
    if (p.hp <= 0) { this.afterTurn(); return; }
    const dm = distMap(this.map, p.x, p.y);
    p.held = null;
    this.enemyPhase = true;
    if (!quick) for (const e of this.enemies.slice()) {
      if (e.hp > 0 && p.hp > 0 && !this.pendingFall) enemyAct(this, e, dm);
    }
    this.enemyPhase = false;
    this.lastMove = null;
    this.struck = null;
    p.brink = null;
    p.shell = p.guard = false;
    if (p.vanish > 0 && --p.vanish === 0) this.emit('unfade', { x: p.x, y: p.y });
    if (p.invuln > 0) p.invuln--;
    if (p.hp > 0 && !this.pendingFall) envTick(this);
    this.enemies = this.enemies.filter(e => e.hp > 0);
    this.dryGoo();
    if (this.pendingFall && p.hp > 0) { this.pendingFall = false; this.leap(true); return; }
    this.pendingFall = false;
    if (p.hp > 0) { this.chatter(); spotTraps(this); }
    this.magnetize();
    this.respawnTick();
    this.afterTurn();
  }

  // the pet's little help, once a turn
  petTick() {
    const pet = PETS[this.pet], p = this.p;
    if (pet.peck && (p.walk || 0) >= pet.peck) {
      p.walk = 0;
      const pecks = (this.pecks ||= {});
      if ((pecks[this.floor] || 0) < PECKS_PER_FIELD) {
        pecks[this.floor] = (pecks[this.floor] || 0) + 1;
        this.emit('peck', { x: p.x, y: p.y });
        this.addGold(peckGold(this.floor));
      }
    }
    if (pet.drizzle && this.turn % pet.drizzle === 0 && p.hp < this.stat().maxHp) {
      this.emit('drizzle', { x: p.x, y: p.y });
      this.heal(1);
    }
    if (pet.feel) {
      const m = this.map, list = [];
      for (let y = p.y - pet.feel; y <= p.y + pet.feel; y++) for (let x = p.x - pet.feel; x <= p.x + pet.feel; x++) {
        if (inMap(x, y) && m.hidden[idx(x, y)]) { m.hidden[idx(x, y)] = 0; list.push(idx(x, y)); }
      }
      if (list.length) {
        this.emit('tiles', { list, soft: true });
        this.emit('feel', { x: p.x, y: p.y, at: list.map(i => ({ x: i % m.w, y: (i / m.w) | 0 })) });
        this.log(`${pet.name}의 더듬이가 쫑긋! 숨은 함정을 찾았다.`, 'good');
      }
    }
  }

  // 아기 용: a puff of fire at the nearest critter within two tiles that you can see
  breathe() {
    const p = this.p;
    const e = this.enemies.filter(o => o.hp > 0 && !o.d.npc && !this.calm(o) && cheb(o, p) <= 2 && this.isVisible(o.x, o.y) &&
      !['hide', 'stone', 'lurk'].includes(o.state) && !o.diving).sort((a, b) => cheb(a, p) - cheb(b, p))[0];
    if (!e) return;
    if (e.x !== p.x) p.face = Math.sign(e.x - p.x);
    this.emit('breath', { from: { x: p.x, y: p.y }, to: { x: e.x, y: e.y } });
    this.hurt(e, 3 + Math.floor(this.floor / 3), 'fire');
    if (e.hp > 0) setBurn(this, e, 3);
  }

  // the magnet relics pull in gold you can see
  magnetize() {
    const r = this.stat().magnet, p = this.p;
    if (!r) return;
    for (const q of this.pickups.filter(q => q.type === 'gold' && cheb(q, p) <= r && this.isVisible(q.x, q.y))) {
      this.pickups.splice(this.pickups.indexOf(q), 1);
      this.emit('pickup', { x: q.x, y: q.y, type: 'gold' });
      this.addGold(q.amount, q.raw);
    }
  }

  // 부엉이 눈: a sleeping monster out of sight but not far is felt through the walls; 밤의 눈: every
  // critter on the field is (a mimic still passes for a chest, and a statue for a statue)
  sensed(e) {
    if (this.isVisible(e.x, e.y) || e.d.npc || e.state === 'hide' || e.state === 'stone') return false;
    if (this.lv('nightowl')) return true;
    return e.state === 'sleep' && cheb(e, this.p) <= 12 && this.lv('owleye') > 0;
  }

  // a peaceful monster nobody has picked a fight with yet
  calm(e) { return !!e.d.peaceful && !e.angry; }

  // Like Shattered Pixel Dungeon: once you thin a floor out, a new enemy wanders in now and then,
  // somewhere out of sight, and roams until it runs into you.
  respawnTick() {
    if (this.floor === this.bossFloor || this.over) return;
    const hostile = this.enemies.filter(e => !e.d.peaceful && !e.d.gimmick).length;
    if (hostile >= B.enemiesPerFloor(this.floor)) { this.respawnT = 0; return; }
    if (++this.respawnT < B.RESPAWN_TURNS) return;
    const spot = this.hiddenSpot();
    if (!spot) return;
    this.respawnT = 0;
    this.spawnEnemy(pick(this.zone.enemies), spot.x, spot.y, this.foeScale).state = 'wander';
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
    const hit = new Set(), storm = this.lv('stormlord');
    for (const e of targets) {
      this.zapHit({ x: this.p.x, y: this.p.y }, e, dmg, hit);
      if (storm) this.chain(e, dmg, hit, storm);
    }
  }

  // 폭풍 망치: a bolt jumps on from what it struck to the nearest other critter within two tiles,
  // at half strength, `n` times
  chain(from, dmg, hit, n) {
    let at = { x: from.x, y: from.y };
    for (let k = 0; k < n; k++) {
      const o = this.enemies
        .filter(o => o.hp > 0 && !hit.has(o.id) && !o.d.npc && !this.calm(o) && o.state !== 'hide' && o.state !== 'stone' && cheb(o, at) <= 2)
        .sort((a, b) => cheb(a, at) - cheb(b, at))[0];
      if (!o) return;
      this.zapHit(at, o, Math.ceil(dmg / 2), hit);
      at = { x: o.x, y: o.y };
    }
  }

  // A rock from the sky onto the nearest enemy you can see, and a share of it on whoever stands beside it.
  meteor(dmg) {
    const e = this.enemies
      .filter(e => e.hp > 0 && this.isVisible(e.x, e.y) && !this.calm(e) && e.state !== 'hide' && e.state !== 'stone' && !e.d.npc)
      .sort((a, b) => cheb(a, this.p) - cheb(b, this.p))[0];
    if (!e) return;
    this.emit('meteor', { x: e.x, y: e.y });
    // whatever it hits is left burning, and the one it lands on sees stars
    for (const o of this.enemies.filter(o => o.hp > 0 && cheb(o, e) <= 1 && !o.d.npc)) {
      this.hurt(o, o === e ? dmg : Math.ceil(dmg / 2), 'fire');
      if (o.hp > 0) setBurn(this, o, 3);
    }
    if (e.hp > 0 && !e.d.boss) { e.stun = Math.max(e.stun || 0, 1); this.emit('stun', { x: e.x, y: e.y }); }
  }

  // 황금 폭풍: coins spray out over the spot and the tiles round it
  goldShower(at) {
    const spots = [at, ...shuffle(DIRS8.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy }))).filter(t => this.passable(t.x, t.y) && this.map.tiles[idx(t.x, t.y)] === FLOOR)].slice(0, 3);
    for (const t of spots) this.pickups.push({ x: t.x, y: t.y, type: 'gold', amount: (Math.floor((this.floor - 1) / 3) + 1) * rint(1, 3) });
    this.emit('goldburst', { x: at.x, y: at.y, spots });
    if (!this.told.goldstorm) { this.told.goldstorm = true; this.log('번개 맞은 적이 골드를 와르르 쏟았다!', 'evo'); }
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

  zapHit(from, e, dmg, hit, wand = false) {
    if (hit.has(e.id) || e.hp <= 0) return;
    hit.add(e.id);
    const at = { x: e.x, y: e.y };
    if (!wand) this.emit('zap', { from, to: at });
    this.hurt(e, dmg, 'bolt');
    // 황금 폭풍: what the lightning knocks down bursts into coins
    if (e.hp <= 0 && !e.d.npc && !wand && this.lv('goldstorm')) this.goldShower(at);
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
    computeFOV(this.map, this.p.x, this.p.y, this.stat().sight, this.lights());
    this.meetCritters();
    // 낮잠 방: a word the first time you see into it
    const den = this.map.den;
    if (den && !this.map.denSeen && this.isVisible(den.x, den.y)) {
      this.map.denSeen = true;
      this.log('쉿… 녀석들이 상자를 둘러싸고 한데 모여 낮잠을 자고 있다.', 'warn');
    }
    // 갈림길: the first time a burrow with a sign comes into view, a word on what the sign is
    if (!this.meta.found.fork_seen && this.map.routes?.some(r => this.isVisible(r.x, r.y))) {
      this.meta.found.fork_seen = true;
      this.log('땅굴 옆에 표지판이 서 있다. 굴 너머 들판에 뭐가 있는지 그려져 있다. 땅굴은 하나 더 있다.', 'good');
    }
    if (this.p.hp <= 0) { this.p.hp = 0; this.finish(false); return; }
    if (this.victory) { this.finish(true); return; }
    this.emit('turn');
    this.spotVeins();
  }

  // what glows on this field: the marsh's fireflies not caught yet
  lights() { return (this.map.flies || []).map(f => ({ x: f.x, y: f.y, r: B.FLY_LIGHT })); }

  // 반딧불 늪: walk into a firefly swarm and it goes in a jar; each jar gives a tile of sight for the trip
  catchFly(x, y) {
    const f = this.map.flies?.find(o => o.x === x && o.y === y);
    if (!f) return;
    this.map.flies.splice(this.map.flies.indexOf(f), 1);
    this.flies = (this.flies || 0) + 1;
    this.emit('fly', { x, y, n: this.flies });
    this.log(this.flies <= B.FLY_MAX ? '반딧불이를 병에 담았다. 조금 더 멀리 보인다.' : '반딧불이를 병에 담았다. 병이 꽉 찼다.', 'good');
  }

  // the critter book (구조대원) fills in each kind the first time you see one
  meetCritters() {
    const book = this.meta.critters ||= {};
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.d.npc || e.type in book || !this.isVisible(e.x, e.y) || e.state === 'lurk' || e.diving) continue;
      if (e.d.shade && cheb(e, this.p) > e.d.shade) continue;
      book[e.type] = 0;
      (this.newCritters ||= []).push(e.type);
    }
  }

  // Returns true if the boss used its whole turn on a special move.
  bossSpecial(e) {
    const p = this.p;
    if (e.type === 'skelking') {
      if (e.slam) {
        e.slam = false;
        const hit = this.telegraph.some(t => t.x === p.x && t.y === p.y);
        this.emit('slam', { tiles: this.telegraph, hit });
        if (hit) { this.hurtPlayer(12 + 2 * this.floor, '버섯 왕의 버섯 망치에 맞았다', 'slam'); this.log('버섯 왕의 내려치기에 맞았다!', 'warn'); }
        else this.log('내려치기를 피했다!', 'good');
        // the slam shakes spores loose: a little mushroom pops up where the hammer fell (one at a time)
        const spot = shuffle(this.telegraph.length ? this.telegraph.slice() : []).find(t => this.canEnemyEnter(t.x, t.y));
        if (spot && this.enemies.filter(m => m.hp > 0 && m.sprout).length < 1) {
          const m = this.spawnEnemy('skel', spot.x, spot.y, this.foeScale);
          Object.assign(m, { hp: Math.ceil(m.hp / 2), maxHp: Math.ceil(m.maxHp / 2), state: 'hunt', last: { x: p.x, y: p.y }, small: true, sprout: true, xp: 1 });
          this.log('내려친 자리에서 꼬마 독버섯이 솟아났다!', 'warn');
        }
        this.telegraph = [];
        return true;
      }
      if (e.timer % 3 === 0) {
        e.slam = true;
        this.telegraph = [];
        // a cross on you: one step on the slant takes you out of it (a 3x3 square could not be left in one step)
        for (const [i, j] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (passable(this.map, p.x + i, p.y + j)) this.telegraph.push({ x: p.x + i, y: p.y + j });
        }
        this.log('버섯 왕이 커다란 버섯 망치를 들어 올렸다. 붉은 칸에서 벗어나야 한다!', 'warn');
        return true;
      }
    }
    // 개굴 대왕: dives, then a turn later bursts up out of the ripples beside you and comes down on the
    // ring around it; at half health it croaks once and two frogs come
    if (e.type === 'toadking') {
      if (e.dive) {
        e.dive = null; e.diving = false;
        const hit = this.telegraph.some(t => t.x === p.x && t.y === p.y);
        this.emit('splash', { enemy: e, tiles: this.telegraph, hit });
        if (hit) { this.hurtPlayer(Math.round(e.atk * 1.6), '개굴 대왕에게 깔렸다', 'slam'); this.log('개굴 대왕이 튀어나와 덮쳤다!', 'warn'); }
        else this.log('첨벙! 덮치기를 피했다!', 'good');
        this.telegraph = [];
        return true;
      }
      if (!e.rage && e.hp <= e.maxHp / 2) {
        e.rage = true;
        let n = 0;
        for (const [dx, dy] of shuffle(DIRS8.slice())) {
          if (n < 2 && this.canEnemyEnter(e.x + dx, e.y + dy)) { this.spawnEnemy('frog', e.x + dx, e.y + dy, this.foeScale).state = 'hunt'; n++; }
        }
        this.emit('rage', { enemy: e });
        this.log('개굴 대왕이 개굴개굴 울었다! 개구리들이 몰려온다!', 'warn');
        return true;
      }
      if (e.timer % 4 === 0) {
        const near = DIRS8.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).filter(t => this.canEnemyEnter(t.x, t.y));
        const wet = near.filter(t => this.map.ter[idx(t.x, t.y)] === T.WATER);
        const to = pick(wet.length ? wet : near);
        if (to) {
          this.emit('dive', { enemy: e, from: { x: e.x, y: e.y }, to });
          e.x = to.x; e.y = to.y;
          e.dive = to; e.diving = true; e.aim = false; e.lick = null;
          this.refreshDoors();
          this.telegraph = DIRS8.map(([dx, dy]) => ({ x: to.x + dx, y: to.y + dy })).filter(t => passable(this.map, t.x, t.y));
          this.log('개굴 대왕이 물속으로 첨벙 뛰어들었다! 물결 둘레에서 벗어나자!', 'warn');
          return true;
        }
      }
    }
    // 대왕 문어: a tentacle comes down on a row of tiles through you (step off it, across); badly hurt,
    // it sprays ink and you see only what is close
    if (e.type === 'octopus') {
      if (e.slam) {
        e.slam = false;
        const hit = this.telegraph.some(t => t.x === p.x && t.y === p.y);
        this.emit('slam', { tiles: this.telegraph, hit });
        for (const o of this.enemies.filter(o => o !== e && o.hp > 0 && this.telegraph.some(t => t.x === o.x && t.y === o.y))) this.hurt(o, 12, 'slam');
        if (hit) { this.hurtPlayer(10 + 2 * this.floor, '대왕 문어 다리에 맞았다', 'slam'); this.log('철썩! 문어 다리에 맞았다!', 'warn'); }
        else this.log('문어 다리를 피했다!', 'good');
        this.telegraph = [];
        return true;
      }
      if (!e.rage && e.hp <= e.maxHp / 2) {
        e.rage = true;
        p.inked = 8;
        this.emit('ink', { x: e.x, y: e.y });
        this.log('대왕 문어가 먹물을 푸악 뿜었다! 앞이 깜깜하다!', 'warn');
        return true;
      }
      if (e.timer % 3 === 0 && cheb(e, p) <= 7) {
        e.slam = true;
        const across = Math.abs(p.x - e.x) >= Math.abs(p.y - e.y);
        this.telegraph = [];
        for (let k = -2; k <= 2; k++) {
          const t = across ? { x: p.x + k, y: p.y } : { x: p.x, y: p.y + k };
          if (passable(this.map, t.x, t.y)) this.telegraph.push(t);
        }
        this.log('대왕 문어가 다리를 번쩍 들었다! 붉은 줄에서 옆으로 비키자!', 'warn');
        return true;
      }
    }
    // 여왕벌: every few turns two angry bees; she drips honey as she goes (ai.js moveEnemy)
    if (e.type === 'queen' && e.timer % 5 === 0) {
      let n = 0;
      for (const [dx, dy] of shuffle(DIRS8.slice())) {
        if (n < 2 && this.canEnemyEnter(e.x + dx, e.y + dy)) {
          const b = this.spawnEnemy('bee', e.x + dx, e.y + dy, this.foeScale);
          Object.assign(b, { angry: true, state: 'hunt', last: { x: p.x, y: p.y } });
          n++;
        }
      }
      if (n) { this.log('여왕벌이 윙윙 꿀벌을 불렀다!', 'warn'); return true; }
    }
    // 용암 거북: breathes a line of fire that keeps burning; in the lava its wounds close
    if (e.type === 'lavaturtle') {
      const inLava = this.map.ter[idx(e.x, e.y)] === T.LAVA;
      if (inLava && e.hp < e.maxHp) { const n = Math.min(4, e.maxHp - e.hp); e.hp += n; this.emit('regen', { enemy: e, n }); }
      if (e.breath) {
        e.breath = false;
        const hit = this.telegraph.some(t => t.x === p.x && t.y === p.y);
        this.emit('lavabreath', { from: { x: e.x, y: e.y }, tiles: this.telegraph, hit });
        for (const t of this.telegraph) {
          ignite(this, t.x, t.y, true);
          const i = idx(t.x, t.y);
          if (passable(this.map, t.x, t.y)) this.map.fire[i] = Math.max(this.map.fire[i], 3);
        }
        if (hit) { this.hurtPlayer(8 + this.floor, '용암 거북의 불길에 휩싸였다', 'burn'); this.log('화르륵! 불길에 휩싸였다!', 'warn'); }
        this.telegraph = [];
        return true;
      }
      const dist = cheb(e, p);
      if (e.timer % 4 === 0 && dist >= 2 && dist <= 6) {
        const sx = Math.sign(p.x - e.x), sy = Math.sign(p.y - e.y);
        this.telegraph = [];
        for (let k = 1; k <= 6; k++) {
          const x = e.x + sx * k, y = e.y + sy * k;
          if (!inMap(x, y) || this.map.tiles[idx(x, y)] === 0) break;
          if (passable(this.map, x, y)) this.telegraph.push({ x, y });
        }
        // a line that misses you entirely is not worth the breath
        if (this.telegraph.length && (sx === 0 || sy === 0 || Math.abs(p.x - e.x) === Math.abs(p.y - e.y))) {
          e.breath = true;
          this.log('용암 거북이 숨을 크게 들이쉰다! 붉은 줄에서 비키자!', 'warn');
          return true;
        }
        this.telegraph = [];
      }
      // badly hurt, it wades back into the lava to cool off
      if (!inLava && e.hp < e.maxHp * 0.5) {
        const lava = DIRS8.map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy })).find(t => inMap(t.x, t.y) && this.map.ter[idx(t.x, t.y)] === T.LAVA && !this.enemyAt(t.x, t.y));
        if (lava) {
          const from = { x: e.x, y: e.y };
          e.x = lava.x; e.y = lava.y;
          this.emit('wade', { enemy: e, from, to: lava });
          return true;
        }
      }
    }
    // 큰 가면: pops up somewhere that can see you and aims; at half, two masked workers come
    if (e.type === 'bigmask') {
      if (!e.rage && e.hp <= e.maxHp / 2) {
        e.rage = true;
        let n = 0;
        for (const [dx, dy] of shuffle(DIRS8.slice())) {
          if (n < 2 && this.canEnemyEnter(e.x + dx, e.y + dy)) {
            const m = this.spawnEnemy('maskman', e.x + dx, e.y + dy, this.foeScale);
            Object.assign(m, { state: 'hunt', last: { x: p.x, y: p.y } });
            n++;
          }
        }
        this.emit('rage', { enemy: e });
        this.log('큰 가면이 손짓했다. 똑같은 가면을 쓴 일꾼들이 걸어 나온다.', 'warn');
        return true;
      }
      if (e.timer % 5 === 0 && !e.aim) {
        const spots = [];
        for (let y = p.y - 6; y <= p.y + 6; y++) for (let x = p.x - 6; x <= p.x + 6; x++) {
          const dd = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
          if (dd >= 3 && this.canEnemyEnter(x, y) && lineOfSight(this.map, x, y, p.x, p.y)) spots.push({ x, y });
        }
        if (spots.length) {
          const t = pick(spots);
          this.emit('teleport', { enemy: e, from: { x: e.x, y: e.y }, to: t });
          e.x = t.x; e.y = t.y;
          e.aim = true; e.aimAt = { x: p.x, y: p.y };
          return true;
        }
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
    // the last boss gets angry at half health: a swarm of bats, and it blinks around twice as often
    if (e.type === 'lord' && !e.rage && e.hp <= e.maxHp / 2) {
      e.rage = true;
      let n = 0;
      for (const [dx, dy] of shuffle(DIRS8.slice())) {
        if (n < 3 && this.canEnemyEnter(e.x + dx, e.y + dy)) { this.spawnEnemy('bat', e.x + dx, e.y + dy).state = 'hunt'; n++; }
      }
      this.emit('rage', { enemy: e });
      this.log('박쥐 대왕이 화났다! 박쥐 떼가 몰려온다!', 'warn');
      return true;
    }
    if (e.type === 'lord' && e.timer % (e.rage ? 4 : 6) === 0 && !e.aim) {
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

  // 멧돼지 대장 crashed into the rock: stones come loose over the ground around you (one always right
  // over you, so you have to move), more of them once it is badly hurt
  quake(e) {
    const p = this.p, spots = [];
    for (let y = p.y - 2; y <= p.y + 2; y++) for (let x = p.x - 2; x <= p.x + 2; x++) {
      if (passable(this.map, x, y) && !(x === e.x && y === e.y) && !(x === p.x && y === p.y)) spots.push({ x, y });
    }
    const n = e.hp <= e.maxHp / 2 ? 6 : 4;
    const ice = e.type === 'yeti';
    for (const t of [{ x: p.x, y: p.y }, ...shuffle(spots).slice(0, n - 1)]) this.dropRock(t.x, t.y, B.rockDmg(this.floor), ice ? '떨어진 고드름에 맞았다' : '떨어진 돌에 맞았다');
    this.emit('quake', { x: e.x, y: e.y, ice });
    this.log(ice ? '쿠웅! 설인이 벽에 박았다! 고드름이 떨어진다!' : '쿠웅! 멧돼지 대장이 바위에 박았다! 돌이 떨어진다!', 'warn');
  }

  // ---------- relic choices ----------
  // a shop relic once bought; a basic one once its unlock has come (data/unlocks.js)
  relicAvailable(id) {
    if (RELICS[id].locked) return !!this.meta.relicUnlock[id];
    return !RELIC_GATES[id] || this.open(RELIC_GATES[id]);
  }
  open(id) { return isOpen(this.meta, id); }

  offers(n = 3) {
    // 행운의 여신: one card more to choose from
    n += (this.char.choices || 3) - 3 + (this.lv('fortune') ? 1 : 0);
    const rl = this.p.relics, full = Object.keys(rl).length >= this.slots, known = this.meta.recipes, have = this.levels();
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
    const q = this.queue.shift();
    if (o.kind === 'heal') this.heal(Math.round(this.stat().maxHp * 0.5));
    else if (o.kind === 'gold') this.addGold(o.amount || 25);
    // 출발 보급 packs a relic two levels' worth
    else if (o.kind === 'relic' && q?.kind === 'kit') { this.gainRelic(o.id); if (this.p.relics[o.id] < maxLevelOf(o.id)) this.gainRelic(o.id); }
    else if (o.kind === 'relic') this.gainRelic(o.id);
    else if (o.kind === 'fuse') this.fuse(o.a, o.b);
    else if (o.kind === 'buy') this.buy(o.what);
    else if (o.kind === 'twin') { for (const id of [o.a, o.b]) if (this.p.relics[id] && this.p.relics[id] < maxLevelOf(id)) this.gainRelic(id); }
    else if (o.act === 'home') { this.finish(true); return; }
    else if (o.act === 'deeper') { this.goDeeper(); return; }
    this.emit('relics');
  }

  // 대장의 보물: every relic not at its top grows one level, the lowest first, so a pair that was one
  // level short meets and evolves, and an evolved pair may go on into a legend
  bossPrize() {
    const rl = this.p.relics, ids = Object.keys(rl).filter(id => rl[id] < maxLevelOf(id)).sort((a, b) => rl[a] - rl[b]);
    if (!ids.length) return;
    this.log('대장의 보물: 가방 속 유물이 모두 한 단계씩 자랐다!', 'evo');
    for (const id of ids) if (rl[id] && rl[id] < maxLevelOf(id)) this.gainRelic(id);
  }

  // 깊은 곳: the stage is won here and now (bank), and you drop through a hole in the boss's floor to a
  // field below it with this stage's critters grown stronger, a rich chest lying out on each floor,
  // and better rocks. The stairs keep going down; going home (나가기) or falling there still counts
  // as the win, with all the gold.
  goDeeper() {
    if (!this.banked) this.bank();
    const p = this.p;
    this.map.tiles[idx(p.x, p.y)] = STAIRS;
    this.map.down = { x: p.x, y: p.y };
    this.emit('tiles', { list: [idx(p.x, p.y)] });
    this.fallAt = { x: p.x, y: p.y };
    this.landing = true;
    this.deepest = Math.max(this.deepest || 0, 1);
    this.log('대장 방 바닥의 구멍으로 뛰어내렸다. 더 깊은 곳이다.', 'warn');
    this.changeFloor(1);
  }

  // The win, written down: the stage's clear, what it opens, and the stage bonus into the purse.
  bank() {
    const meta = this.meta, stats = meta.stats, news = { stage: null, loop: 0, dares: 0 };
    stats.wins++;
    this.bonus = Math.round(B.stageBonus(this.stage) * this.goldBonus);
    this.gold += this.bonus;
    // the first win of this stage at this 회차 opens the next stage, and the last one the next 회차
    const loopsBefore = loopsOpen(meta), daresBefore = daresOpen(meta);
    this.firstClear = cleared(meta, this.stage) < this.loop;
    meta.clears = { ...meta.clears, [this.stage]: Math.max(cleared(meta, this.stage), this.loop) };
    if (this.firstClear && this.stage + 1 < FRIENDS.length && stageOpen(meta, this.stage + 1, this.loop)) news.stage = this.stage + 1;
    if (loopsOpen(meta) > loopsBefore) news.loop = loopsOpen(meta);
    if (daresOpen(meta) > daresBefore) news.dares = daresOpen(meta);
    // the rival keeps count: the furthest stage you have won with each dare on
    for (const id of this.dares) meta.dares.won[id] = Math.max(meta.dares.won[id] || 0, this.stage + 1);
    this.banked = news;
    this.goldBanked = this.gold;
    this.emit('banked', { news });
    return news;
  }

  // Buying at the stall: the gold goes now (it won't come home with you); a relic buy opens its pick.
  buy(what) {
    const s = this.stall.find(s => s.what === what), it = STALL[what], text = NPC_TEXT.peddler;
    if (!s || s.sold || this.gold < s.price) { this.log('골드가 모자라다.', 'bad'); return; }
    this.gold -= s.price;
    s.sold = true;
    this.log(`${josa(it.name, '을', '를')} 샀다. -${s.price}G`, 'good');
    this.emit('buy', { what, price: s.price });
    if (what === 'potion' || what === 'bomb') this.p.items[what] = (this.p.items[what] || 0) + 1;
    else if (what === 'tools') {
      const got = [this.pickTool(), this.pickTool()];
      for (const id of got) this.p.items[id] = (this.p.items[id] || 0) + 1;
      const names = got[0] === got[1] ? `${ITEMS[got[0]].name} 두 개` : `${ITEMS[got[0]].name}, ${ITEMS[got[1]].name}`;
      this.log(`꾸러미를 풀어 보니 ${josa(names, '이', '가')} 들어 있다.`, 'good');
    }
    else if (what === 'grow') this.queue.push({ kind: 'talk', who: 'peddler', text: text.grow, smithPick: true, noReroll: true });
    else if (what === 'box') this.queue.push({ kind: 'talk', who: 'peddler', text: text.box, opts: this.offers(3), noReroll: true });
  }

  gainRelic(id) {
    const rl = this.p.relics;
    this.withMaxHpDelta(() => { rl[id] = (rl[id] || 0) + 1; });
    this.log(`${RELICS[id].name} Lv${rl[id]}`, 'good');
    this.emit('grow', { id, lvl: rl[id], max: maxLevelOf(id) > 1 && rl[id] >= maxLevelOf(id) });
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
      if (!ids.length) { gold += 6 + 4 * Math.floor(B.gs(B.stageOf(this.floor))); steps.push({ gold: true }); continue; }
      const w = ids.map(id => (recipesWith(id).some(rc => rl[rc.a === id ? rc.b : rc.a]) ? 3 : 1));
      let r = Math.random() * w.reduce((a, b) => a + b, 0), id = ids[0];
      for (let i = 0; i < ids.length; i++) if ((r -= w[i]) < 0) { id = ids[i]; break; }
      this.withMaxHpDelta(() => { rl[id]++; });
      steps.push({ id, lvl: rl[id], max: rl[id] >= maxLevelOf(id) });
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
    const meta = this.meta, stats = meta.stats;
    // down in 깊은 곳 the stage is already won, however this ends
    if (this.banked) won = true;
    const news = this.banked || (won ? this.bank() : { stage: null, loop: 0, dares: 0 });
    if (this.depth) stats.deepest = { ...stats.deepest, [this.stage]: Math.max(stats.deepest?.[this.stage] || 0, this.depth) };
    // falling down there leaves behind the gold picked up past the boss (the win and the rest come home)
    if (this.depth && this.p.hp <= 0 && this.goldBanked != null && this.gold > this.goldBanked) {
      this.lostDeep = this.gold - this.goldBanked;
      this.gold = this.goldBanked;
    }
    meta.gold += this.gold;
    stats.bestGold = Math.max(stats.bestGold, this.gold);
    const opened = openNew(meta);
    this.emit('end', { won, fell: this.p.hp <= 0, rescued: this.rescued, news, opened });
  }
}
Run.nextId = 1;
