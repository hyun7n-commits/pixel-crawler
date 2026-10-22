// Leaving in the middle of a run (closing the tab, the phone tucking the browser away) and coming
// back to the very same moment. The run is written down when the page is hidden, on each new floor
// and every few turns, read back on the next start, and wiped when the run ends.
// Everything is plain data except: the maps' typed arrays (kept as base64), `has` (a Set), an enemy's
// stats `d` (looked up again by its type) and `boss` (kept as the id of one of that floor's enemies).

import { Run } from './run.js';
import { ENEMIES } from '../data/enemies.js';
import { CHARACTERS } from '../data/characters.js';

const KEY = 'pixel-crawler-run-v1';
const FORMAT = 1;   // bump when a saved run from an older build could no longer be read
const TYPED = { Uint8Array, Int16Array, Int32Array, Float32Array };
const LEAVE_OUT = new Set(['meta', 'listeners', 'char']);

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

function enc(v, key) {
  if (v === null || typeof v !== 'object') return v;
  if (ArrayBuffer.isView(v)) return { $t: v.constructor.name, b: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
  if (v instanceof Set) return { $s: [...v].map(x => enc(x)) };
  if (Array.isArray(v)) return v.map(x => enc(x));
  if (key === 'boss') return { $boss: v.id };
  const o = {};
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'function') continue;
    if (k === 'd' && ENEMIES[v.type] === x) continue;
    o[k] = enc(x, k);
  }
  return o;
}

function dec(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(dec);
  if (v.$t) return new TYPED[v.$t](unb64(v.b).buffer);
  if (v.$s) return new Set(v.$s.map(dec));
  const o = {};
  for (const [k, x] of Object.entries(v)) o[k] = dec(x);
  if (ENEMIES[o.type] && 'hp' in o && 'state' in o) o.d = ENEMIES[o.type];
  return o;
}

export function suspend(run) {
  if (!run || run.over) return;
  try {
    const o = {};
    for (const [k, v] of Object.entries(run)) if (!LEAVE_OUT.has(k) && !k.startsWith('_')) o[k] = enc(v, k);
    localStorage.setItem(KEY, JSON.stringify({ format: FORMAT, nextId: Run.nextId, run: o }));
  } catch (e) { /* storage full or blocked: this run just won't come back */ }
}

export function clearSuspended() {
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
}

// The run left off last time, rebuilt around today's `meta`, or null.
export function resume(meta) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved.format !== FORMAT || !CHARACTERS[saved.run.charId]) { clearSuspended(); return null; }
    const run = Object.create(Run.prototype);
    for (const [k, v] of Object.entries(saved.run)) run[k] = dec(v);
    Object.assign(run, { meta, listeners: [], char: CHARACTERS[run.charId] });
    const link = s => { const id = s.boss?.$boss; if (id !== undefined) s.boss = s.enemies.find(e => e.id === id) || null; };
    link(run);
    for (const f of Object.values(run.floors || {})) link(f);
    Run.nextId = Math.max(Run.nextId, saved.nextId || 1);
    return run;
  } catch (e) {
    clearSuspended();
    return null;
  }
}
