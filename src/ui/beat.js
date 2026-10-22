// One clock for celebrations that follow each other: a star candy's burst, then each evolution it sets
// off, play one after another instead of on top of each other. The rules have already happened; only
// the show waits its turn.
//
// `wait(d, ms)`: how long the moment in event `d` should wait before it starts, reserving `ms` for it.
// Several listeners see the same event object, so the first one books the slot and the rest reuse it.
let free = 0;
export function wait(d, ms) {
  if (d.wait == null) {
    const now = performance.now(), start = Math.max(now, free);
    free = start + ms;
    d.wait = start - now;
  }
  return d.wait;
}

// how long each moment takes
export const FISSION_LEAD = 250, FISSION_STEP = 170;   // the candy bursts, then one relic every step
export const fissionMs = steps => FISSION_LEAD + 100 + steps * FISSION_STEP;
export const EVOLVE_FLASH = 0.46;                       // share of the evolve moment when the two meet
export const evolveMs = d => (d.fused ? 1100 : [1100, 1500, 2000, 2400][d.tier || 0]);
