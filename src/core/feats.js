// 몰래 해낸 일 (v0.30, data/feats.js): Run.emit hands everything that goes on in a trip to watchFeats,
// which keeps a tally for the trip (run.tally, a field's own in run.tally.field) and one for good
// (meta.tally), and puts each feat in the book the first time it is done. Not on the very first trip
// out (Run.wonders), though the tallies count from the start.

import { featId, BOOK_FEATS } from '../data/feats.js';
import { bookCount } from '../data/book.js';
import { T } from '../data/terrain.js';
import { TOOLS } from '../data/items.js';
import { cheb } from './util.js';

const CHESTS = new Set(['chest', 'lockedChest', 'bossChest']);
// a field counts for the quiet ones only once you have been on it a while
const FIELD_TURNS = 25;

const newField = run => ({ at: run.turn, kills: 0, alerts: 0, hurt: 0 });

export function watchFeats(run, type, d) {
  if (!run.meta || type === 'tiles' || type === 'turn' || type === 'log') return;
  const t = run.tally ||= { kills: 0, fire: 0, killTurn: -1, now: 0, rests: 0, glints: 0, candy: 0, evolves: 0, drank: 0, field: newField(run) };
  const L = run.meta.tally ||= {};
  const add = (k, n = 1) => (L[k] = (L[k] || 0) + n);
  const got = id => run.wonders && run.find(featId(id), 700);
  const low = () => run.p.hp > 0 && run.p.hp <= Math.max(1, Math.round(run.stat().maxHp * 0.15));
  switch (type) {
    case 'move': {
      const n = add('steps');
      if (n >= 1000) got('steps1000');
      if (n >= 10000) got('steps10000');
      if (d.ter === T.WATER && add('wade') >= 100) got('wade100');
      if (d.ter === T.BRUSH && add('grass') >= 500) got('grass500');
      if (run.turn - t.field.at >= 400) got('slow');
      break;
    }
    case 'floor': {
      // the field just left: how it went
      const f = t.field, turns = run.turn - f.at;
      if (d.dir === 1 && turns > 0) {
        if (turns >= FIELD_TURNS && !f.kills) got('peace');
        if (turns >= FIELD_TURNS && !f.alerts) got('unseen');
        if (turns >= FIELD_TURNS && !f.hurt) got('unhurt');
        if (turns <= 30) got('quick');
      }
      if (run.depth >= 3) got('deep3');
      if (run.depth >= 5) got('deep5');
      t.field = newField(run);
      break;
    }
    case 'hit': d.enemy.lastKind = d.kind; break;
    case 'kill': {
      const e = d.enemy;
      t.kills++; t.field.kills++;
      if (run.turn === t.killTurn) t.now++; else { t.killTurn = run.turn; t.now = 1; }
      if (t.now >= 3) got('three_at_once');
      if (t.now >= 5) got('five_at_once');
      if (e.lastKind === 'fire' && ++t.fire >= 5) got('fire5');
      if (d.fell) got('plunge');
      if (e.chief && add('chiefs') >= 3) got('chief3');
      if (e.hid) got('big');
      if (e.d.boss) {
        if (e.lastKind === 'pine') got('boss_pine');
        if (run.floor === run.bossFloor && !t.field.hurt) got('boss_nohit');
        if (low()) got('boss_low');
      }
      const n = add('kills');
      if (n >= 100) got('kills100');
      if (n >= 500) got('kills500');
      if (n >= 1000) got('kills1000');
      break;
    }
    case 'phit':
      t.field.hurt++;
      if (run.p.hp === 1) got('hp1');
      break;
    case 'dodge': if (add('dodges') >= 10) got('dodge10'); break;
    case 'alert': if (d.enemy?.state === 'hunt') t.field.alerts++; break;
    case 'sneak': {
      const n = add('sneaks');
      if (n >= 10) got('sneak10');
      if (n >= 100) got('sneak100');
      if (run.enemyAt(d.x, d.y)?.habitT > 0) got('habit_sneak');
      break;
    }
    case 'combo':
      if (d.n >= 5) got('combo5');
      if (d.n >= 8) got('combo8');
      break;
    case 'chili': if (d.enemy?.d?.boss) got('chili_boss'); break;
    case 'doze': if (d.list?.length >= 3) got('doze3'); break;
    case 'honeyPour': if (d.list?.length >= 3) got('honey3'); break;
    case 'heard': if (d.list?.length >= 6) got('heard6'); break;
    case 'brawl': got('brawl'); break;
    case 'escape': got('robbed'); break;
    case 'slide': if (cheb(d.from, d.to) >= 8) got('slide8'); break;
    case 'fall': if (!d.knocked) got('jump'); break;
    case 'rest': if (++t.rests >= 50) got('rest50'); break;
    case 'trap': if (add('traps') >= 10) got('trap10'); break;
    case 'headbonk': if (d.n >= 9) got('bonk9'); break;
    case 'throw': case 'blow':
      if (TOOLS.every(k => run.toolUse?.[k])) got('tools6');
      if ((run.toolUse?.pinecone || 0) >= 10) got('pine10');
      break;
    case 'drink': t.drank++; break;
    case 'end':
      if (d.won && !t.drank) got('no_potion');
      if (d.won && low()) got('win_low');
      break;
    case 'pickup':
      if (CHESTS.has(d.type)) {
        const n = add('chests');
        if (n >= 10) got('chests10');
        if (n >= 100) got('chests100');
      }
      if (d.type === 'candy' && ++t.candy >= 3) got('candy3');
      break;
    case 'gold':
      if (run.gold >= 500) got('gold500');
      if (run.gold >= 2000) got('gold2000');
      break;
    case 'relics': if (Object.values(run.p.relics).filter(v => v > 0).length >= run.slots) got('full_bag'); break;
    case 'evolve': if (++t.evolves >= 3) got('evolve3'); break;
    case 'berry': if (add('berries') >= 20) got('berry20'); break;
    case 'mine': if (d.last && add('ores') >= 50) got('ore50'); break;
    case 'buy': if (add('buys') >= 10) got('buy10'); break;
    case 'well': got('wish'); break;
    case 'pat': if (add('pats') >= 10) got('pat10'); break;
    case 'flower': if (add('flowers') >= 5) got('flower5'); break;
    case 'goldburst': {
      const n = add('goldCatch');
      got('gold1');
      if (n >= 5) got('gold5');
      break;
    }
    case 'lull': if (d.enemy?.deep && add('rollovers') >= 3) got('lull3'); break;
    case 'gift': if (d.up && ++t.glints >= 3) got('glint3'); break;
    case 'dupe': got('dupe'); break;
    case 'oddSeen': if (d.n >= 5) got('odd5'); break;
    case 'find': {
      const n = bookCount(run.meta);
      for (const k of BOOK_FEATS) if (n >= k) got(`book${k}`);
      break;
    }
  }
}
