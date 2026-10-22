// Sound effects, made on the fly with the Web Audio API, so there are no sound files yet.
// Each sound is a few short tones and noise bursts. Swap these for recorded sounds later
// by changing SOUNDS only; the rest of the game just calls onRunEvent.
import { T } from '../data/terrain.js';
import { wait, fissionMs, evolveMs, FISSION_LEAD, FISSION_STEP, EVOLVE_FLASH } from '../ui/beat.js';

const VOLUME = 0.4;
const MUTE_KEY = 'pixel-crawler-muted';

let ctx = null, out = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* storage blocked */ }

export const isMuted = () => muted;
// the music (audio/music.js) plays through the same output, so the sound button mutes it too
export const audioOut = () => (ctx && ctx.state === 'running' ? { ctx, out, noiseBuf } : null);
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* storage blocked */ }
  if (out) out.gain.value = m ? 0 : VOLUME;
}

// Browsers only allow sound after a click or a key press, so call this from one.
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = muted ? 0 : VOLUME;
    const comp = ctx.createDynamicsCompressor(); // so stacked sounds never clip
    out.connect(comp);
    comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  // iPhone suspends (or "interrupts") the sound after a call or a trip to another app
  if (ctx.state !== 'running') ctx.resume()?.catch?.(() => {});
}

function envelope(g, t, vol, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// A pitched blip; `to` slides the pitch.
function tone(freq, dur, { type = 'sine', vol = 0.3, to = null, delay = 0, attack = 0.005 } = {}) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  envelope(g, t, vol, attack, dur);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// A burst of filtered noise: cracks, thuds, rumbles; `to` sweeps the filter.
function hiss(dur, { vol = 0.3, freq = 1000, to = null, type = 'bandpass', q = 1, delay = 0, attack = 0.003 } = {}) {
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  s.loop = true;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  envelope(g, t, vol, attack, dur);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const chime = (notes, gap, vol = 0.13, dur = 0.18, delay = 0) =>
  notes.forEach((f, i) => tone(f, dur, { type: 'triangle', vol, delay: delay + i * gap }));

const SOUNDS = {
  // the pick on the big ore: each swing rings higher and lands heavier
  mine(hits) {
    const up = 1 + hits * 0.18;
    tone(1250 * up, 0.16, { type: 'triangle', vol: 0.22 });
    tone(1870 * up, 0.1, { type: 'square', vol: 0.05 });
    hiss(0.07, { vol: 0.35, freq: 4200, type: 'highpass' });
    tone(140, 0.18 + hits * 0.05, { vol: 0.22 + hits * 0.07, to: 50 });
    hiss(0.2 + hits * 0.07, { vol: 0.06 + hits * 0.05, freq: 500, to: 110, type: 'lowpass' });
  },
  // the last swing: the whole ore gives way and coins pour out
  jackpot() {
    hiss(1.0, { vol: 0.7, freq: 2600, to: 80, type: 'lowpass' });
    tone(95, 0.9, { vol: 0.7, to: 32 });
    chime([1319, 1568, 1976, 2637, 3136, 2637, 3136], 0.06, 0.12, 0.16, 0.3);
  },
  // the ore cracks into a better grade: a bright rising sparkle, higher for better grades
  rise(tier) {
    const b = 1 + tier * 0.08;
    chime([1047 * b, 1319 * b, 1568 * b, 2093 * b], 0.045, 0.12, 0.2, 0.05);
    hiss(0.25, { vol: 0.12, freq: 6000, type: 'highpass', delay: 0.05 });
  },
  // a bonanza: a cascade of coins
  heartbeat() {
    tone(62, 0.12, { vol: 0.32, to: 44, attack: 0.01 });
    tone(58, 0.1, { vol: 0.22, to: 42, attack: 0.01, delay: 0.17 });
  },
  // you'd have gone down, but you hang on at 1: a thump, and the world holds its breath
  hangon() {
    tone(80, 0.5, { vol: 0.5, to: 30 });
    hiss(0.6, { vol: 0.2, freq: 300, to: 80, type: 'lowpass' });
    chime([523, 392], 0.18, 0.1, 0.4, 0.25);
  },
  // a big vein comes into view: a bright shimmer that climbs, longer for a 2x2
  vein(size) {
    const notes = size >= 4 ? [784, 988, 1175, 1568, 1976, 2349, 3136] : [880, 1109, 1319, 1760];
    chime(notes, 0.06, 0.14, 0.18, 0.02);
    hiss(0.5, { vol: 0.1, freq: 7000, type: 'highpass', delay: 0.05 });
  },
  nugget() {
    for (let i = 0; i < 9; i++) tone(1800 + ((i * 397) % 900), 0.07, { type: 'triangle', vol: 0.09, delay: 0.08 + i * 0.045 });
    chime([784, 1047, 1319, 1568, 2093], 0.07, 0.13, 0.22, 0.12);
  },
  // a low two-note sting: something heard you
  heard() {
    tone(98, 0.24, { type: 'triangle', vol: 0.28, delay: 0.14 });
    tone(92.5, 0.4, { type: 'triangle', vol: 0.28, delay: 0.38 });
  },
  // footsteps: a soft scuff on stone, a splash in water; `alt` swaps feet so steps don't sound identical
  step(alt) { hiss(0.05, { vol: 0.09, freq: alt ? 520 : 430, type: 'lowpass', attack: 0.004 }); tone(alt ? 110 : 95, 0.04, { vol: 0.05, to: 60 }); },
  splash() { hiss(0.12, { vol: 0.14, freq: 1400, to: 500, q: 0.9 }); },
  hit() { hiss(0.06, { vol: 0.3, freq: 1500, q: 0.8 }); tone(180, 0.08, { vol: 0.25, to: 90 }); },
  sneak() { hiss(0.14, { vol: 0.4, freq: 3200, to: 800, q: 0.7 }); tone(280, 0.16, { vol: 0.4, to: 60 }); },
  hurt() { tone(230, 0.14, { type: 'square', vol: 0.1, to: 110 }); hiss(0.08, { vol: 0.2, freq: 700 }); },
  kill() { tone(560, 0.13, { type: 'triangle', vol: 0.2, to: 150 }); },
  gold() { tone(1568, 0.06, { type: 'triangle', vol: 0.1 }); tone(2093, 0.09, { type: 'triangle', vol: 0.1, delay: 0.05 }); },
  chest() { chime([784, 988, 1175, 1568], 0.06, 0.14); },
  // the village: a little two-note "hm?" when someone turns to talk, a welcome tune when someone moves in
  talk() { tone(660, 0.07, { type: 'triangle', vol: 0.12 }); tone(880, 0.09, { type: 'triangle', vol: 0.12, delay: 0.08 }); },
  welcome() { chime([523, 659, 784, 659, 784, 1047], 0.1, 0.12, 0.2, 0.1); },
  swap() { chime([784, 1175], 0.07, 0.1); },
  boom() { hiss(0.8, { vol: 0.65, freq: 1800, to: 70, type: 'lowpass' }); tone(70, 0.6, { vol: 0.5, to: 28 }); },
  alert() { tone(880, 0.05, { type: 'square', vol: 0.05 }); tone(1320, 0.07, { type: 'square', vol: 0.05, delay: 0.05 }); },
  snore() { hiss(0.55, { vol: 0.14, freq: 320, to: 160, type: 'lowpass', attack: 0.25 }); },
  zap() { tone(1400, 0.12, { type: 'sawtooth', vol: 0.06, to: 300 }); hiss(0.1, { vol: 0.15, freq: 5000, type: 'highpass' }); },
  // into a burrow: a scuffle of dirt and a sliding whistle down (쏙)
  dive() {
    hiss(0.18, { vol: 0.16, freq: 900, to: 300, q: 0.7, delay: 0.12 });
    tone(900, 0.3, { type: 'triangle', vol: 0.12, to: 180, delay: 0.16 });
  },
  // and out the other end with a pop (뿅)
  pop(delay = 0) {
    hiss(0.12, { vol: 0.14, freq: 700, to: 1600, q: 0.8, delay });
    tone(320, 0.14, { type: 'triangle', vol: 0.16, to: 900, delay: delay + 0.04 });
  },  dodge() { hiss(0.12, { vol: 0.12, freq: 2000, to: 4500, q: 2 }); },
  puff() { hiss(0.35, { vol: 0.15, freq: 900, to: 300, q: 0.6, attack: 0.02 }); },
  levelup() { chime([659, 784, 988, 1319], 0.07, 0.13); },
  // a star candy: a pop, then one bright pip per relic it grows, climbing the scale (다다다닥)
  candy(n, delay) {
    hiss(0.2, { vol: 0.14, freq: 5200, type: 'highpass', delay });
    tone(1800, 0.06, { type: 'triangle', vol: 0.12, to: 900, delay });
    const scale = [784, 880, 988, 1175, 1319, 1568, 1760, 1976, 2349, 2637];
    for (let k = 0; k < n; k++) {
      const f = scale[Math.min(k, scale.length - 1)], t = delay + (FISSION_LEAD + k * FISSION_STEP) / 1000;
      tone(f, 0.08, { type: 'square', vol: 0.04, delay: t });
      tone(f * 2, 0.14, { type: 'triangle', vol: 0.11, delay: t });
    }
  },
  // two relics wind up as they slide together, then the flash: a thump and a chime, brighter for legends
  evolve(tier, start, flash) {
    const b = [1, 1, 1.12, 1.26][tier || 0];
    hiss(flash, { vol: 0.12, freq: 300, to: 2600, q: 1.2, attack: flash * 0.8, delay: start });
    tone(130 * b, 0.6, { vol: 0.3, to: 60, delay: start + flash });
    chime([523, 659, 784, 1047, 1319, 1568].map(f => f * b), 0.06, 0.14, 0.3, start + flash);
    if (tier >= 2) chime([1568, 1976, 2349, 3136].map(f => f * b), 0.05, 0.09, 0.35, start + flash + 0.42);
  },
};

export function play(name, ...args) {
  if (!ctx || muted || ctx.state !== 'running') return;
  try { SOUNDS[name]?.(...args); } catch (e) { /* never let a sound break the game */ }
}

let stepN = false;

// A heartbeat while your health is low: lub-dub, faster when it's really close (see lowHealth in hud.js).
let beatTimer = null, beatLevel = 0;
export function setHeartbeat(level) {
  if (level === beatLevel) return;
  beatLevel = level;
  clearInterval(beatTimer);
  beatTimer = level ? setInterval(() => play('heartbeat'), level > 1 ? 700 : 1050) : null;
  if (level) play('heartbeat');
}
// Which sound goes with which game event (see the emit calls in core/).
export function onRunEvent(type, d) {
  switch (type) {
    case 'mine':
      play('mine', d.hits);
      if (d.last) play('jackpot');
      if (d.nugget) play('nugget'); else if (d.rose) play('rise', d.tier);
      break;
    case 'heard': play('heard'); break;
    case 'vein': play('vein', d.size); break;
    case 'newOre': play('rise', d.tier); break;
    case 'hangon': play('hangon'); break;
    case 'move': if (d.ter === T.WATER) play('splash'); else play('step', (stepN = !stepN)); break;
    case 'hit': if (d.kind !== 'sneak') play('hit'); break;
    case 'sneak': play('sneak'); break;
    case 'phit': play('hurt'); break;
    case 'kill': play('kill'); break;
    case 'pickup': if (d.type !== 'candy') play(d.type === 'chest' ? 'chest' : 'gold'); break;
    case 'boom': case 'gasboom': play('boom'); break;
    case 'alert': play('alert'); break;
    case 'snore': play('snore'); break;
    case 'zap': play('zap'); break;
    case 'floor': if (d.dir) play('dive'); play('pop', d.dir ? 0.62 : 0.05); break;
    case 'dodge': play('dodge'); break;
    case 'puff': play('puff'); break;
    case 'levelup': play('levelup'); break;
    case 'evolve': { const ms = evolveMs(d); play('evolve', d.fused ? 0 : d.tier, wait(d, ms) / 1000, EVOLVE_FLASH * ms / 1000); break; }
    case 'fission': play('candy', d.steps.length, wait(d, fissionMs(d.steps.length)) / 1000); break;
    case 'steal': play('gold'); play('dodge'); break;
    case 'escape': play('puff'); break;
    case 'bones': play('kill'); play('hit'); break;
    case 'split': play('splash'); break;
    case 'aimCharge': play('alert'); break;
    case 'charge': if (!d.hit) play('boom'); break;
    case 'meteor': play('boom'); break;
    case 'rage': play('boom'); play('alert'); break;
    case 'request': play('jackpot'); break;
    case 'sunbeam': play('rise', 2); break;
    case 'block': play('hit'); play('dodge'); break;
    default: break;
  }
}
