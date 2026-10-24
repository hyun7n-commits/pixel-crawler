// What a pet is like when it is off duty (v0.30, data/pets.js): the same creature at home
// (scenes/home-pets.js) and tagging along round the village (scenes/village-pets.js). Its fidgets when
// it is just standing about, what it does when you pet it, its voice (a sound word in a bubble and a
// little noise: a pet never says words), how it dozes, and the shadow under it.
//   a pet here is { id, s, fly } with `s` its picture (the field sprite, data/sprites.js): s.hop lifts it
//   off the ground, s.sx / s.sy stretch it, s.dip presses it down; the scene puts those onto the picture
//   every frame with petPose, so a fidget is a tween on those and nothing else

import { PETS } from '../data/pets.js';
import { pixEllipse } from './pix.js';
import { setEmote } from './emotes.js';

// the sound word each one makes when it is pleased, and the noise that goes with it (audio/sfx.js)
export const VOICE = {
  chick: ['삐약', 'chirp'], butterfly: ['팔랑', 'pop'], ladybug: ['꼬물', 'pop'], mouse: ['찍찍', 'squeak'], bookworm: ['꼬물꼬물', 'pop'],
  duckling: ['꽥', 'chirp'], bee: ['붕붕', 'buzz'], piglet: ['꿀꿀', 'pop'], sparrow: ['짹짹', 'chirp'], cloud: ['보슬보슬', 'puff'],
  firefly: ['반짝', 'pluck'], squirrel: ['찍', 'squeak'], slime: ['말랑', 'pop'], snail: ['느릿', 'pop'], jelly: ['둥실', 'pop'],
};
export const flies = id => !!PETS[id]?.fly;
// how high a flier hovers over its tile, and its slow bob
export const hover = (pet, time) => (pet.fly ? 7 + 2 * Math.sin(time / 260 + (pet.seed || 0)) : 0);

// the picture as the pet is right now: lifted by s.hop, stretched by s.sx / s.sy, pressed by s.dip; `k`
// is the scale a tile wants, `breathe` the slow in-and-out (flatter and slower asleep)
export function petPose(s, k, breathe = 1) {
  const sx = s.sx || 1, sy = (s.sy || 1) * (1 - (s.dip || 0) / 16);
  s.setScale(k * sx * (1 + (1 - breathe) * 0.4), k * sy * breathe).setOrigin(0.5, 1 + (s.hop || 0) / (s.frame.height * k));
}
export const breath = (pet, time) => (pet.asleep ? 0.88 + 0.03 * Math.sin(time / 700 + (pet.seed || 0)) : 1 + 0.035 * Math.sin(time / 420 + (pet.seed || 0)));

// one fidget, the kind's own: a peck, a look round, a stretch, a wobble, a little rise
export function petIdle(sc, pet, time) {
  const s = pet.s, tw = cfg => sc.tweens.add({ targets: s, ...cfg });
  switch (pet.id) {
    case 'chick': tw({ dip: 3, duration: 90, yoyo: true, repeat: 2, ease: 'Quad.out' }); break;                     // pecks at the ground
    case 'duckling': tw({ angle: s.flipX ? -8 : 8, duration: 90, yoyo: true, repeat: 3 }); break;                   // wags its tail
    case 'sparrow': tw({ hop: 3, duration: 110, yoyo: true, ease: 'Quad.out' }); break;                             // a hop
    case 'squirrel': tw({ sx: 1.15, duration: 80, yoyo: true, repeat: 1 }); break;                                  // flicks its tail
    case 'mouse': { const was = s.flipX; s.setFlipX(!was); sc.time.delayedCall(420, () => s.active && s.setFlipX(was)); break; } // looks round
    case 'bookworm': case 'snail': tw({ sx: 1.2, duration: 420, yoyo: true, ease: 'Sine.inOut' }); break;          // a slow stretch
    case 'ladybug': tw({ sy: 1.15, duration: 70, yoyo: true, repeat: 3 }); break;                                   // opens its wings
    case 'piglet': tw({ sx: 1.08, sy: 0.92, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.out' }); break;      // a snuffle
    case 'slime': tw({ sx: 1.18, sy: 0.84, duration: 110, yoyo: true, repeat: 1, ease: 'Sine.inOut' }); break;     // a wobble
    default: tw({ hop: 4, duration: 380, yoyo: true, ease: 'Sine.inOut' }); break;                                 // the fliers rise a little
  }
  if (Math.random() < 0.25) setEmote(s, '♪', time, 1000);
}

// petted: a roll over, a happy bounce, a curl, a loop in the air; a heart, its sound word and its noise
export function petReact(sc, pet, time) {
  const s = pet.s, tw = cfg => sc.tweens.add({ targets: s, ...cfg });
  const [word, noise] = VOICE[pet.id] || ['♪', 'pop'];
  switch (pet.id) {
    case 'piglet': case 'slime': case 'ladybug':
      tw({ angle: s.flipX ? -360 : 360, duration: 520, ease: 'Quad.inOut', onComplete: () => s.setAngle(0) });
      break;
    case 'chick': case 'sparrow': case 'duckling': case 'mouse': case 'squirrel':
      tw({ hop: 5, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.out' });
      break;
    case 'bookworm': case 'snail':
      tw({ sx: 0.75, sy: 1.15, duration: 160, yoyo: true, hold: 200, ease: 'Quad.out' });
      break;
    default:
      tw({ hop: 9, duration: 260, yoyo: true, ease: 'Sine.inOut' });
      tw({ angle: s.flipX ? 360 : -360, duration: 520, onComplete: () => s.setAngle(0) });
  }
  setEmote(s, Math.random() < 0.6 ? '♥' : '♪', time, 1200);
  sc.say(s, word, 1000);
  sc.hooks.onSound?.(noise);
  if (pet.id === 'firefly') sc.spark.explode(6, s.x, s.y - 8);
}

// dozing: a z now and then (the flatter, slower breathing is in `breath`)
export function petDoze(pet, time) {
  if (time < (pet.nextZ || 0)) return;
  pet.nextZ = time + 2200 + Math.random() * 900;
  setEmote(pet.s, 'z', time, 900);
}
// woken: a little start
export function petWake(sc, pet) {
  if (!pet.asleep) return;
  pet.asleep = false;
  pet.nextZ = 0;
  pet.s.emote = null;
  sc.tweens.add({ targets: pet.s, hop: 2, duration: 90, yoyo: true, ease: 'Quad.out' });
}

// the shadow under it, on the ground at `gy` (a flier's is smaller, as it is off the ground)
export function petShadow(g, s, fly, gy) {
  g.fillStyle(0x000000, 0.22);
  pixEllipse(g, s.x, gy - 1, fly ? 5 : 8, fly ? 2 : 3);
}
