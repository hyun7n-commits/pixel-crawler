// One trip into the dungeon. Holds all run state and the turn rules.
// It never touches the screen: it emits events that the scene and HUD listen to.

import * as B from '../data/balance.js';
import { RELICS, EVOLUTIONS, MAX_LEVEL, MAX_SLOTS } from '../data/relics.js';
import { CHARACTERS } from '../data/characters.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { rnd, rint, pick, shuffle, cheb, josa, DIRS8 } from './util.js';
import {
  createMap, carveRooms, carveArena, idx, inMap, passable, distMap, lineOfSight, computeFOV, FLOOR, STAIRS,
} from './dungeon.js';

export const zoneOf = floor => ZONES[Math.floor((floor - 1) / B.FLOORS_PER_ZONE)];
export const isBossFloor = floor => floor % B.FLOORS_PER_ZONE === 0;

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
    this.startStats = JSON.parse(JSON.stringify(meta.stats));
    this.listeners = [];
    this.p = {
      x: 0, y: 0, hp: 0, lvl: 1, xp: 0,
      relics: { ...this.char.start },
      items: { potion: meta.up.pot, bomb: 0, map: 0 },
    };
    this.p.hp = this.stat().maxHp;
    meta.stats.runs++;
    meta.stats.maxFloor = Math.max(meta.stats.maxFloor, 1);
  }

  // ---------- events ----------
  on(fn) { this.listeners.push(fn); }
  emit(type, data = {}) { for (const fn of this.listeners) fn(type, data); }
  log(text, cls) { this.emit('log', { text, cls }); }

  // ---------- derived stats ----------
  stat() {
    const rl = this.p.relics, ch = this.char, up = this.meta.up;
    const lv = id => rl[id] || 0;
    return {
      atk: ch.atk + up.atk + 2 * lv('blade') + (rl.flamesword ? 8 : 0),
      def: ch.def + lv('shield') + (rl.fortress ? 5 : 0),
      maxHp: ch.hp + up.hp * 4 + 8 * lv('heart') + (rl.bloodcrown ? 10 : 0) + (this.p.lvl - 1) * B.HP_PER_LEVEL,
      goldMult: 1 + 0.4 * lv('coin') + 0.1 * up.greed,
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
  get zone() { return zoneOf(this.floor); }

  // ---------- floors ----------
  start() {
    this.genFloor();
    this.log(`${josa(this.char.name, '으로', '로')} 던전에 들어왔어요. 계단을 찾아 내려가세요.`, 'good');
    this.emit('banner', { text: `1층 · ${this.zone.name}` });
    this.afterTurn();
  }

  genFloor() {
    this.map = createMap();
    this.enemies = [];
    this.pickups = [];
    this.telegraph = [];
    this.boss = null;
    if (isBossFloor(this.floor)) this.genBossFloor();
    else this.genNormalFloor();
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

    const free = () => {
      for (let t = 0; t < 200; t++) {
        const r = pick(rooms.slice(1));
        const x = rint(r.x, r.x + r.w - 1), y = rint(r.y, r.y + r.h - 1);
        if (map.tiles[idx(x, y)] !== FLOOR) continue;
        if (this.enemyAt(x, y) || this.pickups.some(q => q.x === x && q.y === y)) continue;
        if (Math.abs(x - this.p.x) + Math.abs(y - this.p.y) < 6) continue;
        return { x, y };
      }
      return null;
    };
    const place = (fn) => { const s = free(); if (s) fn(s); };
    const scale = B.enemyScale(this.floor);
    for (let i = 0; i < B.enemiesPerFloor(this.floor); i++) place(s => this.spawnEnemy(pick(this.zone.enemies), s.x, s.y, scale));
    const z = Math.floor((this.floor - 1) / B.FLOORS_PER_ZONE) + 1;
    for (let i = 0, n = rint(5, 7); i < n; i++) place(s => this.pickups.push({ ...s, type: 'gold', amount: z * rint(3, 7) }));
    place(s => this.pickups.push({ ...s, type: 'chest' }));
    if (this.floor === 1) place(s => this.pickups.push({ ...s, type: 'chest' }));
    if (Math.random() < 0.6) place(s => this.pickups.push({ ...s, type: 'potion' }));
    if (Math.random() < 0.35) place(s => this.pickups.push({ ...s, type: 'bomb' }));
    if (Math.random() < 0.3) place(s => this.pickups.push({ ...s, type: 'map' }));
  }

  genBossFloor() {
    const spots = carveArena(this.map);
    this.p.x = spots.start.x; this.p.y = spots.start.y;
    const type = this.zone.boss;
    const b = this.spawnEnemy(type, spots.boss.x, spots.boss.y, B.bossScale(this.floor));
    b.awake = true;
    this.boss = b;
    this.log(`${josa(ENEMIES[type].name, '이', '가')} 나타났어요! ${ENEMIES[type].tip}`, 'warn');
  }

  spawnEnemy(type, x, y, scale = 1) {
    const d = ENEMIES[type];
    const e = {
      id: Run.nextId++, type, d, x, y,
      hp: Math.round(d.hp * scale), maxHp: Math.round(d.hp * scale), atk: Math.round(d.atk * scale),
      def: d.def || 0, awake: false, aim: false, aimAt: null, skip: false, slam: false, timer: 0,
    };
    this.enemies.push(e);
    this.emit('spawn', { enemy: e });
    return e;
  }

  descend() {
    this.floor++;
    this.meta.stats.maxFloor = Math.max(this.meta.stats.maxFloor, this.floor);
    this.genFloor();
    this.emit('banner', { text: isBossFloor(this.floor) ? `${this.floor}층 · 보스` : `${this.floor}층 · ${this.zone.name}` });
    this.log(`${this.floor}층에 내려왔어요.`);
    this.afterTurn();
  }

  // ---------- player actions (return true if a turn was spent) ----------
  canAct() { return !this.over && this.queue.length === 0; }

  step(dx, dy) {
    if (!this.canAct()) return false;
    const p = this.p, nx = p.x + dx, ny = p.y + dy;
    const e = this.enemyAt(nx, ny);
    if (e) {
      this.emit('attack', { from: { x: p.x, y: p.y }, to: { x: nx, y: ny }, who: 'player' });
      this.playerAttack(e);
      this.endTurn();
      return true;
    }
    if (!this.passable(nx, ny)) return false;
    p.x = nx; p.y = ny;
    this.pickupAt(nx, ny);
    if (this.map.tiles[idx(nx, ny)] === STAIRS) { this.descend(); return true; }
    this.endTurn();
    return true;
  }

  wait() {
    if (!this.canAct()) return false;
    this.endTurn();
    return true;
  }

  useItem(id) {
    if (!this.canAct() || !this.p.items[id]) return false;
    const p = this.p;
    p.items[id]--;
    if (id === 'potion') {
      this.heal(Math.round(this.stat().maxHp * B.POTION_HEAL));
      this.log('체력 물약을 마셨어요.', 'good');
    }
    if (id === 'bomb') {
      this.emit('boom', { x: p.x, y: p.y });
      const dmg = B.bombDamage(this.floor);
      for (const e of this.enemies.filter(e => e.hp > 0 && cheb(e, p) <= 2)) this.hurt(e, dmg, 'fire');
      this.log('폭탄이 터졌어요!', 'good');
    }
    if (id === 'map') {
      const m = this.map;
      for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i]) m.explored[i] = 1;
      this.log('지도를 펼쳤어요. 계단 위치가 보여요.', 'good');
    }
    this.endTurn();
    return true;
  }

  pickupAt(x, y) {
    for (const q of this.pickups.filter(q => q.x === x && q.y === y)) {
      this.pickups.splice(this.pickups.indexOf(q), 1);
      this.emit('pickup', { x, y, type: q.type });
      if (q.type === 'gold') this.addGold(q.amount);
      else if (q.type === 'chest') { this.queue.push({ kind: 'chest' }); this.log('보물 상자를 열었어요!', 'good'); }
      else { this.p.items[q.type]++; this.log(`${josa(ITEMS[q.type].name, '을', '를')} 주웠어요.`); }
    }
  }

  // ---------- combat ----------
  playerAttack(e) {
    const s = this.stat(), rl = this.p.relics;
    this.hurt(e, Math.max(1, s.atk + rnd(2) - e.def), 'normal');
    let fire = 0;
    if (rl.flamesword) fire = 5;
    else if (rl.ring && Math.random() < 0.3) fire = 3 * rl.ring;
    if (fire && e.hp > 0) this.hurt(e, fire, 'fire');
  }

  hurt(e, dmg, kind) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    this.emit('hit', { enemy: e, x: e.x, y: e.y, dmg, kind });
    if (e.hp <= 0) this.onKill(e);
  }

  onKill(e) {
    const rl = this.p.relics, stats = this.meta.stats;
    this.kills++; stats.kills++;
    this.emit('kill', { enemy: e });
    if (e.d.boss) {
      if (!stats.bosses.includes(e.type)) stats.bosses.push(e.type);
      this.log(`${josa(e.d.name, '을', '를')} 쓰러뜨렸어요!`, 'good');
      if (this.floor >= B.LAST_FLOOR) this.victory = true;
      else {
        this.map.tiles[idx(e.x, e.y)] = STAIRS;
        this.emit('stairs', { x: e.x, y: e.y });
        this.log('계단이 나타났어요.', 'good');
      }
      this.addGold(30 * (this.floor / 3));
    } else if (Math.random() < B.GOLD_DROP_CHANCE) {
      this.pickups.push({ x: e.x, y: e.y, type: 'gold', amount: (Math.floor((this.floor - 1) / 3) + 1) * rint(1, 4) });
    }
    if (rl.goldbolt) this.addGold(3);
    const heal = 2 * (rl.fang || 0) + (rl.bloodcrown ? 10 : 0);
    if (heal) this.heal(heal);
    this.gainXp(e.d.xp);
  }

  damagePlayer(raw, src, kind = 'melee') {
    const s = this.stat(), rl = this.p.relics, p = this.p;
    if (s.dodge && Math.random() < s.dodge) { this.emit('dodge', { x: p.x, y: p.y }); return; }
    const dmg = Math.max(1, raw + rnd(2) - s.def);
    p.hp -= dmg;
    this.emit('phit', { x: p.x, y: p.y, dmg, kind });
    if (src && kind === 'melee') {
      const thorn = rl.fortress ? 8 : 2 * (rl.thorns || 0);
      if (thorn) this.hurt(src, thorn, 'thorns');
      if (src.type === 'lord' && src.hp > 0) src.hp = Math.min(src.maxHp, src.hp + dmg);
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

  // ---------- turn ----------
  endTurn() {
    const p = this.p, rl = p.relics;
    this.turn++;
    if (rl.goldbolt && this.turn % 3 === 0) this.zap(3, 10);
    else if (rl.bolt && this.turn % 6 === 0) this.zap(1, 4 * rl.bolt);
    if (rl.moss && this.turn % [6, 4, 2][rl.moss - 1] === 0) this.heal(1);

    const dm = distMap(this.map, p.x, p.y);
    for (const e of this.enemies.slice()) {
      if (e.hp > 0 && p.hp > 0) this.enemyAct(e, dm);
    }
    this.enemies = this.enemies.filter(e => e.hp > 0);
    this.afterTurn();
  }

  zap(count, dmg) {
    const targets = this.enemies
      .filter(e => e.hp > 0 && this.isVisible(e.x, e.y))
      .sort((a, b) => cheb(a, this.p) - cheb(b, this.p))
      .slice(0, count);
    for (const e of targets) {
      this.emit('zap', { from: { x: this.p.x, y: this.p.y }, to: { x: e.x, y: e.y } });
      this.hurt(e, dmg, 'bolt');
    }
  }

  afterTurn() {
    computeFOV(this.map, this.p.x, this.p.y);
    if (this.p.hp <= 0) { this.p.hp = 0; this.finish(false); return; }
    if (this.victory) { this.finish(true); return; }
    this.emit('turn');
  }

  // ---------- enemies ----------
  stepToward(e, dm) {
    let best = null, bd = dm[idx(e.x, e.y)];
    for (const [dx, dy] of shuffle(DIRS8.slice())) {
      const nx = e.x + dx, ny = e.y + dy;
      if (!this.passable(nx, ny) || this.enemyAt(nx, ny) || (nx === this.p.x && ny === this.p.y)) continue;
      if (dm[idx(nx, ny)] < bd) { bd = dm[idx(nx, ny)]; best = [nx, ny]; }
    }
    if (!best) return false;
    [e.x, e.y] = best;
    return true;
  }

  enemyAct(e, dm) {
    const p = this.p, d = e.d;
    if (!e.awake) {
      if (this.isVisible(e.x, e.y) && cheb(e, p) <= 6) e.awake = true;
      else return;
    }
    if (d.slow) { e.skip = !e.skip; if (e.skip) return; }
    e.timer++;

    if (this.bossSpecial(e)) return;

    const dist = cheb(e, p);
    if (d.ranged) {
      if (e.aim) {
        e.aim = false;
        const stillThere = e.aimAt && e.aimAt.x === p.x && e.aimAt.y === p.y;
        const hit = stillThere && dist <= d.ranged && lineOfSight(this.map, e.x, e.y, p.x, p.y);
        this.emit('shot', { from: { x: e.x, y: e.y }, to: e.aimAt || { x: p.x, y: p.y }, hit });
        if (hit) this.damagePlayer(e.atk, e, 'ranged');
        else this.log(`${d.name}의 공격을 피했어요.`, 'good');
        return;
      }
      if (dist > 1 && dist <= d.ranged && lineOfSight(this.map, e.x, e.y, p.x, p.y) && Math.random() < 0.7) {
        e.aim = true;
        e.aimAt = { x: p.x, y: p.y };
        return;
      }
    }

    if (dist === 1) {
      this.emit('attack', { from: { x: e.x, y: e.y }, to: { x: p.x, y: p.y }, who: e });
      this.damagePlayer(e.atk, e, 'melee');
      return;
    }
    const moves = d.fast ? 2 : 1;
    for (let i = 0; i < moves; i++) {
      if (!this.stepToward(e, dm)) break;
      if (cheb(e, p) === 1) break;
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
        this.telegraph = [];
        if (hit) { this.damagePlayer(10 + this.floor, e, 'slam'); this.log('해골 왕의 내려치기에 맞았어요!', 'warn'); }
        else this.log('내려치기를 피했어요!', 'good');
        return true;
      }
      if (e.timer % 4 === 0) {
        e.slam = true;
        this.telegraph = [];
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          if (this.passable(p.x + i, p.y + j)) this.telegraph.push({ x: p.x + i, y: p.y + j });
        }
        this.log('해골 왕이 뼈망치를 들어 올렸어요. 붉은 칸에서 벗어나세요!', 'warn');
        return true;
      }
    }
    if (e.type === 'ratking' && e.timer % 5 === 0) {
      let n = 0;
      for (const [dx, dy] of shuffle(DIRS8.slice())) {
        const nx = e.x + dx, ny = e.y + dy;
        if (n < 2 && this.passable(nx, ny) && !this.enemyAt(nx, ny) && !(nx === p.x && ny === p.y)) {
          this.spawnEnemy('rat', nx, ny).awake = true;
          n++;
        }
      }
      if (n) this.log('왕쥐가 쥐를 불러냈어요.', 'warn');
    }
    if (e.type === 'lord' && e.timer % 6 === 0 && !e.aim) {
      const spots = [];
      for (let y = p.y - 6; y <= p.y + 6; y++) for (let x = p.x - 6; x <= p.x + 6; x++) {
        const dd = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
        if (dd >= 4 && this.passable(x, y) && !this.enemyAt(x, y) && lineOfSight(this.map, x, y, p.x, p.y)) spots.push({ x, y });
      }
      if (spots.length) {
        const s = pick(spots);
        this.emit('teleport', { enemy: e, from: { x: e.x, y: e.y }, to: s });
        e.x = s.x; e.y = s.y;
        e.aim = true; e.aimAt = { x: p.x, y: p.y };
        this.log('뱀파이어 군주가 순간이동해 조준하고 있어요!', 'warn');
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
      const ev = EVOLUTIONS.find(e => e.a === id);
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
        this.withMaxHpDelta(() => { delete rl[ev.a]; rl[ev.id] = 1; });
        this.meta.stats.evos++;
        this.log(`진화! ${RELICS[ev.a].name} → ${RELICS[ev.id].name}`, 'evo');
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
