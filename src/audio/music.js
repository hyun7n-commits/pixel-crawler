// Background music, made on the fly like the sound effects: a short looping tune for each place
// (the village, each of the ten grounds, a boss), a melody over a bass line
// and a soft beat, played quietly under everything. `setMusic(name)` fades over to another tune;
// the sound button mutes it with the rest (it plays through the effects' output).
//
// A tune is written as text, one token per eighth note: a note ('E5', 'F#4'), '-' to hold the one
// before, '.' for a rest. Drums: 'k' kick, 's' snare, 'h' hat. Bars are split with '|' for reading.

import { audioOut } from './sfx.js';

const TUNES = {
  // cosy, a little bouncy: C major, C - Am - F - G
  village: {
    bpm: 92, lead: 'triangle', vol: 1,
    melody: 'E5 - G5 - C6 - B5 A5 | G5 - - - E5 - - - | F5 - A5 - G5 - E5 C5 | D5 - - - - - . . | E5 - G5 - C6 - D6 E6 | D6 - C6 - A5 - G5 - | F5 - E5 - D5 - G5 - | C5 - - - - - . .',
    bass:   'C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | D3 . A3 . G2 . D3 . | C3 . G3 . C3 . . .',
    drums:  '. . h . . . h . | . . h . . . h . | . . h . . . h . | . . h . . . h . | . . h . . . h . | . . h . . . h . | . . h . . . h . | . . h . . . h .',
  },
  // out in the meadow: G major, light and cheerful
  meadow: {
    bpm: 112, lead: 'triangle', vol: 0.9,
    melody: 'D5 G5 B5 G5 D6 - B5 - | C6 - A5 - F#5 - D5 - | E5 G5 B5 G5 E6 - D6 - | C6 B5 A5 F#5 G5 - - - | B5 - B5 C6 D6 - B5 - | C6 - A5 - B5 - G5 - | A5 - F#5 - E5 - F#5 - | G5 - D5 - G5 - . .',
    bass:   'G2 . D3 . G2 . D3 . | D3 . A2 . D3 . A2 . | E3 . B2 . E3 . B2 . | C3 . G2 . D3 . F#2 . | G2 . D3 . G2 . D3 . | C3 . G2 . G2 . D3 . | D3 . A2 . D3 . C3 . | G2 . D3 . G2 . . .',
    drums:  'k . h . k k h . | k . h . k k h . | k . h . k k h . | k . h . k . s . | k . h . k k h . | k . h . k k h . | k . h . k k h . | k . s . k . . .',
  },
  // the deep forest: A minor, slower, a little mysterious
  forest: {
    bpm: 96, lead: 'sine', vol: 1.1,
    melody: 'A4 - - C5 E5 - - - | D5 - C5 - B4 - - - | A4 - - C5 E5 - G5 - | F5 - E5 - D5 - - - | E5 - - G5 A5 - - - | G5 - E5 - D5 - C5 - | B4 - - D5 C5 - B4 - | A4 - - - - - . .',
    bass:   'A2 - - . E3 - - . | G2 - - . E2 - - . | A2 - - . E3 - - . | D3 - - . A2 - - . | C3 - - . G2 - - . | C3 - - . G2 - - . | E2 - - . B2 - - . | A2 - - . A2 - - .',
    drums:  'k . . . . . h . | . . h . . . h . | k . . . . . h . | . . h . . . h . | k . . . . . h . | . . h . . . h . | k . . . . . h . | . . h . . . . .',
  },
  // the firefly marsh: D dorian, slow and swaying, like frogs answering each other
  marsh: {
    bpm: 88, lead: 'triangle', vol: 1,
    melody: 'D5 - F5 - . A5 G5 - | F5 - E5 - D5 - - - | C5 - E5 - G5 - F5 E5 | D5 - - - . . A4 - | D5 - F5 - A5 - C6 - | A5 - G5 - F5 - E5 - | F5 - D5 - E5 - C5 - | D5 - - - - - . .',
    bass:   'D3 - . A2 D3 - . A2 | C3 - . G2 C3 - . G2 | C3 - . G2 C3 - . E3 | D3 - . A2 D3 - . . | D3 - . A2 D3 - . A2 | F2 - . C3 F2 - . C3 | A2 - . E3 C3 - . G2 | D3 - . A2 D3 - . .',
    drums:  'k . . h . k h . | k . . h . . h . | k . . h . k h . | k . . h . . h . | k . . h . k h . | k . . h . . h . | k . . h . k h . | k . . h . . . .',
  },
  // the bat cave: E minor, slow, ringing in the dark
  cave: {
    bpm: 84, lead: 'sine', vol: 1.1,
    melody: 'E5 - - B4 E5 - G5 - | F#5 - - - D5 - - - | E5 - - B4 E5 - A5 - | G5 - F#5 - E5 - - - | C6 - - B5 A5 - G5 - | F#5 - - A5 G5 - E5 - | D#5 - - F#5 B4 - - - | E5 - - - - - . .',
    bass:   'E2 - - - B2 - - - | D2 - - - A2 - - - | C2 - - - G2 - - - | B1 - - - F#2 - - - | A1 - - - E2 - - - | D2 - - - A2 - - - | B1 - - - F#2 - - - | E2 - - - B1 - . .',
    drums:  'k . . . . . h . | . . . . s . . . | k . . . . . h . | . . . . s . . . | k . . . . . h . | . . . . s . . . | k . . . . . h . | . . . . s . . .',
  },
  // the rocky mountain: D dorian, striding
  rock: {
    bpm: 108, lead: 'square', vol: 0.55,
    melody: 'D5 - F5 - A5 - G5 F5 | E5 - C5 - D5 - - - | D5 - F5 - A5 - C6 - | B5 - G5 - A5 - - - | A5 - C6 - D6 - C6 A5 | G5 - B5 - A5 - F5 - | G5 - E5 - F5 - E5 C5 | D5 - - - - - . .',
    bass:   'D3 . D3 . A2 . D3 . | C3 . C3 . G2 . C3 . | D3 . D3 . A2 . D3 . | G2 . G2 . A2 . A2 . | F2 . F2 . C3 . F2 . | G2 . G2 . D3 . G2 . | C3 . C3 . A2 . C3 . | D3 . A2 . D3 . . .',
    drums:  'k . h . s . h . | k . h . s . h h | k . h . s . h . | k . h . s . s s | k . h . s . h . | k . h . s . h h | k . h . s . h . | k k s . s s s .',
  },
  // the seaside cliffs: F major, rolling like waves
  sea: {
    bpm: 100, lead: 'triangle', vol: 1,
    melody: 'C5 - F5 - A5 - G5 F5 | G5 - - - C5 - - - | D5 - F5 - A5 - C6 - | A#5 - A5 - G5 - - - | A5 - C6 - F6 - E6 D6 | C6 - A5 - G5 - F5 - | G5 - A5 - A#5 - G5 E5 | F5 - - - - - . .',
    bass:   'F2 - C3 - F2 - C3 - | C3 - G2 - C3 - G2 - | D3 - A2 - D3 - A2 - | A#2 - F2 - C3 - - - | F2 - C3 - F2 - C3 - | A#2 - F2 - C3 - G2 - | A#2 - F2 - C3 - C3 - | F2 - C3 - F2 - . .',
    drums:  'k . . h . . h . | k . . h . . h . | k . . h . . h . | k . . h . . s . | k . . h . . h . | k . . h . . h . | k . . h . . h . | k . . h . . . .',
  },
  // the giant flower garden: C lydian, bright and bouncy, a little too sweet
  garden: {
    bpm: 120, lead: 'triangle', vol: 0.9,
    melody: 'G5 E5 C5 E5 G5 - C6 - | B5 A5 F#5 A5 G5 - - - | A5 F#5 D5 F#5 A5 - D6 - | C6 B5 A5 B5 G5 - - - | E6 - D6 - C6 - B5 - | A5 - B5 - C6 - E6 - | D6 - C6 - B5 - A5 - | C6 - G5 - C6 - . .',
    bass:   'C3 . G3 . C3 . G3 . | D3 . A3 . D3 . A3 . | D3 . A3 . D3 . A3 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | D3 . A2 . G2 . D3 . | C3 . G2 . C3 . . .',
    drums:  'k . h h s . h . | k . h h s . h . | k . h h s . h . | k . h h s . s . | k . h h s . h . | k . h h s . h . | k . h h s . h . | k . s . s . . .',
  },
  // the snowy plateau: A minor, high and sparse like bells in the cold
  snow: {
    bpm: 76, lead: 'sine', vol: 1.1,
    melody: 'E6 - - - B5 - - - | C6 - - - A5 - - - | D6 - - - G5 - - - | B5 - - - E5 - - - | A5 - C6 - E6 - - - | D6 - C6 - B5 - - - | C6 - B5 - A5 - G#5 - | A5 - - - - - . .',
    bass:   'A2 - - - - - - - | F2 - - - - - - - | G2 - - - - - - - | E2 - - - - - - - | A2 - - - - - - - | F2 - - - - - - - | E2 - - - - - - - | A2 - - - - - . .',
    drums:  'k . . . . . . . | . . . . h . . . | k . . . . . . . | . . . . h . . . | k . . . . . . . | . . . . h . . . | k . . . . . . . | . . . . h . . .',
  },
  // the fire volcano: C phrygian, low and driving
  volcano: {
    bpm: 116, lead: 'square', vol: 0.5,
    melody: 'C5 - C#5 - C5 - G4 - | C5 - D#5 - F5 - D#5 C#5 | C5 - C#5 - C5 - G4 - | A#4 - C5 - - - . . | G5 - G#5 - G5 - D#5 - | F5 - D#5 - C#5 - C5 - | A#4 - C#5 - C5 - A#4 - | C5 - - - - - . .',
    bass:   'C2 . C3 . C2 . C3 . | C#2 . C#3 . C#2 . C#3 . | C2 . C3 . C2 . C3 . | A#1 . A#2 . A#1 . G1 . | C2 . C3 . C2 . C3 . | C#2 . C#3 . C#2 . C#3 . | A#1 . A#2 . G1 . G2 . | C2 . C3 . C2 . . .',
    drums:  'k . s . k k s . | k . s . k k s . | k . s . k k s . | k . s . k k s s | k . s . k k s . | k . s . k k s . | k . s . k k s . | k k s s k s s .',
  },
  // the old guild grounds: D minor, a slow music box with one note that is a little wrong
  ruins: {
    bpm: 80, lead: 'triangle', vol: 1,
    melody: 'D5 - F5 - A5 - G#5 - | A5 - - - . . . . | D5 - F5 - A5 - C6 - | A#5 - A5 - G#5 - - - | F5 - E5 - D5 - C#5 - | D5 - - - . . A4 - | A#4 - A4 - G#4 - A4 - | D5 - - - - - . .',
    bass:   'D2 - - - A2 - - - | D2 - - - G#2 - - - | D2 - - - A2 - - - | A#1 - - - E2 - - - | A#1 - - - F2 - - - | D2 - - - A1 - - - | A#1 - - - A1 - - - | D2 - - - - - . .',
    drums:  'k . . . h . . . | k . . . h . . . | k . . . h . . . | k . . . h . . . | k . . . h . . . | k . . . h . . . | k . . . h . . . | k . . . . . . .',
  },
  // a boss: E minor, fast and driving
  boss: {
    bpm: 138, lead: 'square', vol: 0.5,
    melody: 'E5 E5 G5 E5 B5 - A5 G5 | F#5 - D5 - E5 - - - | E5 E5 G5 E5 C6 - B5 A5 | B5 - G5 - F#5 - - - | E6 - D6 - B5 - G5 - | A5 - G5 - F#5 - D5 - | E5 - G5 - F#5 - D#5 - | E5 - - - B4 - . .',
    bass:   'E2 E3 E2 E3 E2 E3 E2 E3 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | B1 B2 B1 B2 B1 B2 B1 B2 | C2 C3 C2 C3 G2 G3 G2 G3 | D2 D3 D2 D3 D2 D3 D2 D3 | A1 A2 A1 A2 B1 B2 B1 B2 | E2 E3 E2 E3 E2 E3 E2 E3',
    drums:  'k h s h k h s h | k h s h k k s h | k h s h k h s h | k h s h k k s s | k h s h k h s h | k h s h k k s h | k h s h k h s h | k k s s k s s s',
  },
};

const MUSIC_VOL = 0.6;   // under the effects
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const freq = n => {
  const m = /^([A-G])(#?)(\d)$/.exec(n);
  return 440 * 2 ** ((NOTE[m[1]] + (m[2] ? 1 : 0) + 12 * (+m[3] + 1) - 69) / 12);
};
// the tokens as notes with their lengths in steps: [{ at, f, len }]
function parse(text) {
  const t = text.split(/\s+/).filter(x => x && x !== '|'), out = [];
  t.forEach((x, i) => {
    if (x === '.' || x === '-') return;
    let len = 1;
    while (t[i + len] === '-') len++;
    out[i] = { f: freq(x), len };
  });
  return { notes: out, steps: t.length };
}
const parsed = {};
const tune = name => (parsed[name] ||= (() => {
  const d = TUNES[name], m = parse(d.melody), b = parse(d.bass);
  return { ...d, melody: m.notes, bass: b.notes, drums: d.drums.split(/\s+/).filter(x => x && x !== '|'), steps: m.steps, step: 60 / d.bpm / 2 };
})());

const OFF_KEY = 'pixel-crawler-music-off';
let off = false;
try { off = localStorage.getItem(OFF_KEY) === '1'; } catch (e) { /* storage blocked */ }
export const musicOff = () => off;
export function setMusicOff(v) {
  off = v;
  try { localStorage.setItem(OFF_KEY, v ? '1' : '0'); } catch (e) { /* storage blocked */ }
  if (cur) cur.gain.gain.value = v ? 0 : MUSIC_VOL;
}

let want = null;     // the tune that should be playing
let cur = null;      // { name, gain, i, next }
const LOOKAHEAD = 0.2;

export function setMusic(name) {
  want = name || null;
  if (cur && cur.name === want) return;
  const a = audioOut();
  if (cur && a && cur.ctx === a.ctx) {
    // fade the old one out, then let it go
    const g = cur.gain;
    g.gain.cancelScheduledValues(a.ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, a.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, a.ctx.currentTime + 0.8);
    setTimeout(() => g.disconnect(), 1000);
  }
  cur = null;
}

function begin(a) {
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, a.ctx.currentTime);
  g.gain.linearRampToValueAtTime(off ? 0 : MUSIC_VOL, a.ctx.currentTime + 1.2);
  g.connect(a.out);
  cur = { name: want, gain: g, i: 0, next: a.ctx.currentTime + 0.1, ctx: a.ctx };
}

function voice(a, dest, type, f, t, dur, vol) {
  const o = a.ctx.createOscillator(), g = a.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(vol * 0.55, t + Math.min(dur, 0.18));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function drum(a, dest, kind, t) {
  if (kind === 'k') {
    const o = a.ctx.createOscillator(), g = a.ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.16);
    return;
  }
  const s = a.ctx.createBufferSource(), f = a.ctx.createBiquadFilter(), g = a.ctx.createGain();
  s.buffer = a.noiseBuf;
  f.type = kind === 'h' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'h' ? 7000 : 1800;
  const v = kind === 'h' ? 0.035 : 0.06, d = kind === 'h' ? 0.04 : 0.1;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
}

function tick() {
  const a = audioOut();
  if (!a || !want) return;
  // the sound was made anew (sfx.js unlockAudio): the tune starts over on the new one
  if (cur && cur.ctx !== a.ctx) cur = null;
  if (!cur) begin(a);
  const T = tune(cur.name);
  // a hidden tab stops the timer: start again from now instead of rushing to catch up
  if (cur.next < a.ctx.currentTime - 0.3) cur.next = a.ctx.currentTime + 0.05;
  while (cur.next < a.ctx.currentTime + LOOKAHEAD) {
    const i = cur.i, t = cur.next, m = T.melody[i], b = T.bass[i], d = T.drums[i];
    if (m) voice(a, cur.gain, T.lead, m.f, t, m.len * T.step * 0.95, 0.07 * T.vol);
    if (b) voice(a, cur.gain, 'triangle', b.f, t, b.len * T.step * 0.9, 0.11);
    if (d && d !== '.') drum(a, cur.gain, d, t);
    cur.i = (i + 1) % T.steps;
    cur.next += T.step;
  }
}
setInterval(tick, 50);
