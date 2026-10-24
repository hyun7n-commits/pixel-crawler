// Inside your house (scenes/HomeScene.js, data/home.js): the room and the furniture, drawn with
// pixkit at the village's scale (16 pixels a tile, the heroes 16 tall). The room is seen from the
// front and a little above, like the village: the back wall stands up at the top (two tiles high,
// plaster over a wooden dado, a window or two looking out on the grass), the floor of honey boards
// below, the side walls and the front wall only their tops, the door a gap in the middle of the front.
// Light comes in through the windows and from the upper left.

import { TILE } from './textures.js';
import { Pix, mixc, ramp, tone, hash, seeded, planks, plaster, stones, thatch, domeLit, roundWindow, signboard, windowBox, WOOD, WOOD_WARM, STONE } from './pixkit.js';
import { windowSlots } from '../data/home.js';

const PINE = ramp('#c9965a');
const HONEY = ramp('#d4a066');
const PLAS = ramp('#f1e4c8');
const BEAM = ramp('#6e4a2e');
const LEAF = ['#a6df6e', '#71c452', '#4aa446', '#33833d', '#215f30'];
const WATER = ['#e6f7ff', '#b4e2f4', '#7cc0dc', '#4f98bc', '#3a7398'];

// ---------- the room ----------
// Tiles: column 0 and w + 1 are the side walls, rows 0-1 the back wall, rows 2 .. h + 1 the floor, row
// h + 2 the front wall with the door in it. Floor cell (fx, fy) is tile (fx + 1, fy + 2).
export const WALL_ROWS = 2;
export const roomSize = room => ({ tw: room.w + 2, th: room.h + WALL_ROWS + 1 });

export function roomCanvas(room) {
  const { tw, th } = roomSize(room), W = tw * TILE, H = th * TILE, p = new Pix(W, H);
  const fx0 = TILE, fx1 = W - TILE - 1, fy0 = WALL_ROWS * TILE, fy1 = (th - 1) * TILE - 1, door = doorX(room);
  // the floor: long honey boards running across, their ends staggered, darker in the corners and
  // where the walls shade it
  p.fill(fx0, fy0, fx1, fy1, null, (x, y) => {
    const row = Math.floor((y - fy0) / 4), ly = (y - fy0) % 4, along = x - fx0 + row * 13, seg = Math.floor(along / 34);
    let v = 2 + (hash(seg, row, 301) - 0.5) * 0.7 + (x - fx0) / (fx1 - fx0) * 0.4 - 0.1;
    if (ly === 3 || along % 34 === 0) v += 1.3;
    else if (ly === 0) v -= 0.35;
    if (y < fy0 + 4) v += (fy0 + 4 - y) * 0.35;
    if (x < fx0 + 3) v += (fx0 + 3 - x) * 0.3;
    if (x > fx1 - 3) v += (x - fx1 + 3) * 0.3;
    if (ly === 1 && hash(x >> 2, row, 305) < 0.06) v += 0.5;
    return tone(HONEY, v, x, y);
  });
  // the back wall: a ceiling beam, plaster, a dado of upright boards, a skirting board
  const wy1 = fy0 - 1;
  plaster(p, [fx0, 0, fx1, wy1 - 9], null, PLAS, (x, y) => (x - fx0) / (fx1 - fx0) * 0.6 - 0.2 + (y < 6 ? (6 - y) * 0.3 : 0), { seed: 302 });
  for (let x = fx0 + 2; x < fx1; x += 6) for (let y = 8; y < wy1 - 10; y += 6) if (((x / 6 | 0) + (y / 6 | 0)) % 2 === 0) { p.set(x, y, '#e9c9cf'); p.set(x + 1, y, '#e9c9cf'); p.set(x, y + 1, '#d8b4bc'); }
  planks(p, [fx0, wy1 - 8, fx1, wy1 - 2], null, WOOD_WARM, (x) => (x - fx0) / (fx1 - fx0) * 0.6 + 0.1, { pw: 4, seed: 303 });
  p.rect(fx0, wy1 - 9, fx1 - fx0 + 1, 1, (x) => tone(WOOD_WARM, 0.6, x, 0));
  p.rect(fx0, wy1 - 1, fx1 - fx0 + 1, 2, (x, y, i, j) => tone(BEAM, j ? 3.4 : 2.2, x, y));
  p.rect(fx0, 0, fx1 - fx0 + 1, 4, (x, y, i, j) => tone(BEAM, j === 0 ? 1.6 : j === 3 ? 3.6 : 2.4, x, y));
  // posts holding up the beam, every few tiles
  for (let k = 0; k <= room.w; k += room.w >= 9 ? 3 : room.w) { const x = fx0 + Math.min(k, room.w) * TILE - (k ? 2 : 0); planks(p, [x, 4, x + 1, wy1 - 9], null, BEAM, () => 1.2 + (k ? 0.8 : 0), { pw: 2 }); }
  // windows looking out on the grass, light falling in on the floor under them
  for (const s of windowSlots(room)) {
    const wx = fx0 + s * TILE + 3, wyy = 7;
    p.rect(wx, wyy, 10, 13, (x, y, i, j) => (j < 6 ? mixc('#bfe6ff', '#e8f6ff', j / 6) : j < 9 ? tone(['#a6df6e', '#71c452', '#4aa446'], (i + j) % 3 === 0 ? 0 : 1, x, y) : tone(LEAF, 1.6 + (i % 4 === 0 ? 1 : 0), x, y)));
    p.ell(wx + 2.5, wyy + 8.5, 3.2, 2.6, (x, y, nx, ny) => LEAF[nx + ny < -0.4 ? 1 : 3]);
    windowBox(p, wx, wyy, 10, 13, { frame: WOOD, curtain: ['#f8b4cc', '#e58aa5'] });
    // light falling in on the floor, fainter further from the window, in three clean steps
    for (let y = fy0; y < fy0 + 18; y++) for (let x = Math.round(wx - 1 + (y - fy0) * 0.5); x < Math.round(wx + 11 + (y - fy0) * 0.5); x++) {
      const c = p.get(x, y);
      if (c) p.set(x, y, mixc(c, '#fff6c8', y < fy0 + 6 ? 0.2 : y < fy0 + 12 ? 0.12 : 0.06));
    }
  }
  // the side walls' tops, and their shadow on the floor
  for (const [x0, x1, sx] of [[fx0 - 6, fx0 - 1, 1], [fx1 + 1, fx1 + 6, -1]]) {
    p.rect(x0, 0, x1 - x0 + 1, fy1 + 7, (x, y, i) => tone(BEAM, (sx > 0 ? i === 5 : i === 0) ? 3.6 : (sx > 0 ? i === 0 : i === 5) ? 1.2 : 2.3 + (y % 9 === 0 ? 0.6 : 0), x, y));
  }
  // the front wall's top, with the door in it: a stone step, the light outside, a mat inside
  const dx0 = fx0 + door * TILE, dx1 = dx0 + TILE - 1;
  p.rect(fx0 - 6, fy1 + 1, fx1 - fx0 + 13, 6, (x, y, i, j) => (x >= dx0 && x <= dx1 ? null : tone(BEAM, j === 0 ? 1.2 : j === 5 ? 3.8 : 2.4, x, y)));
  p.rect(dx0, fy1 + 1, TILE, 6, (x, y, i, j) => tone(STONE, j < 2 ? 1 : 2.4 + (i % 5 === 0 ? 0.8 : 0), x, y));
  p.rect(dx0 + 2, fy1 - 9, TILE - 4, 8, (x, y, i, j) => (i === 0 || j === 0 || i === TILE - 5 || j === 7 ? '#8a5a3a' : (i + j) % 2 ? '#c98a5a' : '#b8764a'));
  return p.canvas();
}
export const doorX = room => (room.w - 1) / 2;

// ---------- round the room ----------
// The room is the inside of your straw-roofed house in the village, opened up like a doll's house: the
// same fat dome of thatch sits on top (the chimney behind it, the heart sign, a little attic window),
// and the grass and the path from the door spread out in front. Both go behind the room.
// `x0`: where the room's walls start, in room pixels.
const span = room => ({ x0: TILE - 6, w: roomSize(room).tw * TILE - 2 * TILE + 12 });
export const ROOF_OVER = 8, YARD_OVER = 22;
export const roofAt = room => ({ x: span(room).x0 - ROOF_OVER, bottom: 3 });
export const yardAt = room => ({ x: span(room).x0 - YARD_OVER, top: (roomSize(room).th - 1) * TILE + 6 });
export function roofCanvas(room) {
  const RW = span(room).w + ROOF_OVER * 2, RH = Math.min(56, Math.round(RW * 0.3)) + 8, p = new Pix(RW, RH);
  const straw = ramp('#e2b553'), stoneR = ramp('#a9a6ae'), eave = RH - 6, cx = RW / 2, cy = eave + 4, rx = RW / 2 + 0.5, ry = eave - 2;
  const chx = Math.round(RW * 0.72);
  stones(p, [chx, 3, chx + 8, Math.round(eave * 0.7)], null, stoneR, (x) => (x - chx) / 8 * 0.9 - 0.3, { ch: 3, wmin: 3, wmax: 5, seed: 31 });
  p.rect(chx - 1, 2, 11, 2, (x, y, i, j) => tone(stoneR, j === 0 ? 0.8 : 3, x, y));
  const inRoof = (x, y) => { const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; return nx * nx + ny * ny <= 1 && y <= eave + 3 + Math.floor(hash(x, 0, 35) * 3); };
  thatch(p, [0, 0, RW - 1, RH - 1], inRoof, straw, domeLit(cx, cy * 0.75, rx, ry), { bh: 6, seed: 36 });
  for (let x = Math.round(cx - rx * 0.55); x < cx + rx * 0.55; x++) {
    const y = Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2))) + 2;
    if (x % 3) p.set(x, y, straw[4]);
    p.set(x, y + 1, straw[x % 4 ? 3 : 4]);
  }
  roundWindow(p, cx - 0.5, Math.round(eave * 0.42), 3.4);
  signboard(p, cx, eave - 10, 'heart', true);
  p.outline();
  return p.canvas();
}
export function yardCanvas(room) {
  const { w } = span(room), YW = w + YARD_OVER * 2, YH = 30, p = new Pix(YW, YH), r = seeded(41);
  const G = ramp('#92c86a'), dx0 = YARD_OVER + 6 + doorX(room) * TILE;
  // a patch of lawn on a slab of earth, like a model: straight along the front of the house, its ends
  // and far edge rounded off
  const edge = x => { const t = Math.abs(x + 0.5 - YW / 2) / (YW / 2); return YH - 3 - Math.round(t ** 6 * 13 + (1 + Math.sin(x * 0.4)) * 0.5); };
  const inLawn = (x, y) => y <= edge(x) && y >= Math.round((Math.abs(x + 0.5 - YW / 2) / (YW / 2)) ** 10 * 5);
  p.fill(0, 0, YW - 1, YH - 1, inLawn, (x, y) => (y > edge(x) - 2 ? tone(ramp('#a8865e'), y === edge(x) ? 2.8 : 1.8, x, y)
    : tone(G, 2 + (y < 3 ? 0.9 - y * 0.3 : 0) + (hash(x >> 1, y >> 1, 42) - 0.5) * 0.7 + (Math.abs(x - YW / 2) / YW) * 0.6, x, y)));
  // the path from the door: flat stones in packed earth, a little wider as it goes
  for (let y = 0; y < YH - 3; y++) {
    const wpad = Math.floor(y / 8);
    for (let x = dx0 + 1 - wpad; x <= dx0 + 14 + wpad; x++) {
      if (!inLawn(x, y) || y > edge(x) - 2) continue;
      const st = hash(Math.floor((x - dx0) / 5 + (Math.floor(y / 4) & 1) * 0.5), Math.floor(y / 4), 43);
      p.set(x, y, (x - dx0 + (Math.floor(y / 4) & 1) * 2) % 5 === 0 || y % 4 === 3 ? '#a8865e' : st > 0.25 ? tone(STONE, 1.6 + st, x, y) : '#c9a878');
    }
  }
  // blades and flowers
  for (let k = 0; k < YW / 3; k++) {
    const x = Math.floor(r() * YW), y = 3 + Math.floor(r() * (YH - 8));
    if (!inLawn(x, y - 1) || y + 1 > edge(x) - 2 || (x >= dx0 - 2 && x <= dx0 + 17)) continue;
    p.set(x, y, G[0]); p.set(x, y + 1, G[1]);
    if (r() < 0.3) p.set(x, y - 1, ['#fff7f0', '#f8b4cc', '#f4cf4f', '#9fc2ff'][Math.floor(r() * 4)]);
  }
  p.outline();
  return p.canvas();
}

// ---------- furniture ----------
// each picture is `w` tiles wide and stands on the bottom of its `h` rows, reaching `up` pixels above
function pic(w, h, draw, o = {}) {
  const p = new Pix(w, h);
  draw(p, w, h);
  if (o.outline !== false) p.outline();
  o.front?.(p, w, h);
  return p.canvas(o.shadow === false ? null : g => { g.fillStyle = 'rgba(40,20,20,0.22)'; g.fillRect(2, h - 3, w - 3, 3); g.fillRect(1, h - 2, w - 1, 1); });
}

const ART = {
  // the straw bed from the guild: a plank headboard, a lumpy straw mattress, a green patched quilt
  bed: () => pic(16, 40, p => {
    planks(p, [1, 0, 14, 10], (x, y) => !(y < 2 && (x < 3 || x > 12)), PINE, (x) => (x - 1) / 13 * 0.9 - 0.2, { pw: 3, seed: 311 });
    for (const x of [1, 13]) p.rect(x, 0, 2, 38, (px, py, i) => tone(WOOD, i ? 2.8 : 1.6, px, py));
    p.rect(3, 8, 10, 28, (x, y) => tone(ramp('#e6c66a'), 1.6 + (hash(x, y, 312) < 0.2 ? 1 : 0), x, y));
    p.ell(8, 12.5, 5, 3, (x, y, nx, ny) => tone(ramp('#fff7f0'), 1 + nx * 0.6 + ny * 0.8, x, y));
    p.rect(3, 17, 10, 19, (x, y, i, j) => {
      const patch = (Math.floor(i / 5) + Math.floor(j / 5)) % 3;
      return tone(ramp(['#6fbf4e', '#5aad58', '#9ad86f'][patch]), 1.6 + (j === 0 ? -0.8 : 0) + (i > 7 ? 0.6 : 0) + ((i % 5 === 4 || j % 5 === 4) ? 0.8 : 0), x, y);
    });
    p.rect(3, 17, 10, 2, (x, y, i, j) => tone(ramp('#fff7f0'), j ? 2 : 1, x, y));
    p.rect(1, 36, 14, 2, (x, y, i, j) => tone(WOOD, j ? 3.4 : 2.2, x, y));
    for (const x of [1, 13]) p.rect(x, 38, 2, 2, WOOD[4]);
  }),
  // the cloud bed: a puffy white headboard, two pillows, a sky-blue quilt with stars
  cloudbed: () => pic(32, 42, p => {
    const puff = [[6, 6, 6], [15, 4, 7], [25, 6, 6], [11, 8, 5], [21, 8, 5]];
    for (const [cx, cy, r] of puff) p.ell(cx, cy, r, r * 0.9, (x, y, nx, ny) => tone(ramp('#f6f8ff'), 1.2 + nx * 0.5 + ny * 0.9, x, y));
    p.rect(2, 10, 28, 28, (x, y) => tone(ramp('#f4f0e8'), 2, x, y));
    for (const cx of [9, 22]) p.ell(cx, 14, 6, 3.4, (x, y, nx, ny) => tone(ramp('#fff7fa'), 1 + nx * 0.5 + ny * 0.8, x, y));
    p.rect(2, 19, 28, 19, (x, y, i, j) => tone(ramp('#9fc2ff'), 1.4 + (j === 0 ? -0.8 : 0) + i / 28 * 0.8 + (j > 15 ? 0.6 : 0), x, y));
    p.rect(2, 19, 28, 2, (x, y, i, j) => tone(ramp('#fff7f0'), j ? 2 : 1, x, y));
    for (const [sx, sy] of [[7, 25], [16, 29], [24, 24], [11, 33], [25, 33]]) { p.set(sx, sy, '#f4cf4f'); p.set(sx - 1, sy, '#f4cf4f'); p.set(sx + 1, sy, '#f4cf4f'); p.set(sx, sy - 1, '#f4cf4f'); p.set(sx, sy + 1, '#f4cf4f'); p.set(sx, sy, '#fff3b0'); }
    p.rect(2, 38, 28, 2, (x, y, i, j) => tone(ramp('#d8dcf0'), j ? 3 : 2, x, y));
    for (const x of [3, 27]) p.rect(x, 40, 2, 2, '#a8acc8');
  }),
  // a three-legged stool
  stool: () => pic(16, 16, p => {
    for (const [x0, x1] of [[4, 3], [11, 12], [8, 8]]) p.line(x0, 8, x1, 14, (k) => WOOD[x1 > 8 ? 3 : 2]);
    p.ell(8, 7, 6, 3, (x, y, nx, ny) => tone(PINE, 1.2 + nx * 0.8 + ny * 0.6, x, y));
    p.rect(2, 7, 12, 2, (x, y, i, j) => (j ? tone(PINE, 3.2, x, y) : p.get(x, y)));
  }),
  // a round wooden table, a lace runner across it, a teapot and a cup
  table: () => pic(16, 22, p => {
    for (const x of [3, 12]) p.rect(x, 11, 2, 10, (px, py, i) => tone(WOOD, 1.6 + i * 0.8 + (x > 8 ? 0.6 : 0), px, py));
    p.rect(2, 16, 12, 1, WOOD[3]);
    p.ell(8, 9, 7.5, 3.6, (x, y, nx, ny) => tone(WOOD_WARM, 1 + nx * 0.6 + ny * 0.5, x, y));
    p.rect(1, 10, 15, 2, (x, y, i, j) => tone(WOOD_WARM, j ? 3.4 : 2.4, x, y));
    p.rect(5, 6, 6, 6, (x, y, i, j) => (j === 5 && i % 2 ? null : '#fff7f0'));
    p.ell(6.5, 6, 3, 2.4, (x, y, nx, ny) => tone(ramp('#7aa4ff'), 1.4 + nx * 0.7 + ny * 0.6, x, y));
    p.set(6, 3, '#4f6fb3'); p.rect(9, 5, 2, 1, '#4f6fb3');
    p.rect(11, 6, 3, 2, '#fff7f0'); p.set(12, 6, '#c98a5a');
  }),
  // a clay pot and what is growing in it (`v`: 0 a sprout, 1 leaves, 2 a bud, 3 in flower)
  plant: v => pic(16, 22, p => {
    const pot = ramp('#c9764a');
    p.fill(4, 15, 11, 21, (x, y) => Math.abs(x + 0.5 - 8) <= 4 - (y - 15) * 0.15, (x, y) => tone(pot, 1.4 + (x - 4) / 7 * 1.2, x, y));
    p.rect(3, 14, 10, 2, (x, y, i, j) => tone(pot, j ? 2.6 : 1, x, y));
    p.rect(5, 14, 6, 1, '#5a3a2a');
    const leaf = (cx, cy, dx) => { p.set(cx, cy, LEAF[1]); p.set(cx + dx, cy, LEAF[2]); p.set(cx + dx * 2, cy - 1, LEAF[1]); p.set(cx + dx, cy - 1, LEAF[0]); };
    if (v === 0) { p.rect(8, 11, 1, 3, LEAF[2]); leaf(7, 11, -1); leaf(9, 11, 1); return; }
    p.rect(8, v >= 2 ? 4 : 8, 1, v >= 2 ? 10 : 6, LEAF[3]);
    for (const [y, d] of [[12, -1], [11, 1], [9, -1], [8, 1]]) leaf(8 + d, y, d);
    if (v >= 2) for (const [y, d] of [[6, -1], [5, 1]]) leaf(8 + d, y, d);
    if (v === 2) { p.ell(8.5, 3, 1.6, 2, '#e58aa5'); p.set(8, 2, '#f8b4cc'); }
    if (v === 3) for (const [cx, cy, c] of [[8.5, 2.5, '#f29bb2'], [4.5, 7.5, '#f4cf4f'], [12.5, 6.5, '#fff7f0']]) { p.ell(cx, cy, 2.3, 2, c); p.set(Math.floor(cx), Math.floor(cy), '#f4cf4f'); }
  }),
  // a round braided rug, lying flat (no outline, no shadow)
  rug: () => pic(32, 32, p => {
    p.ell(16, 16, 15.5, 13.5, (x, y, nx, ny) => {
      const r = Math.hypot(nx, ny), ring = Math.floor(r * 6);
      const c = ['#f8b4cc', '#fff3e6', '#9ad86f', '#f4cf4f', '#f29bb2', '#b48ade'][ring] || '#b48ade';
      return tone(ramp(c), 1.6 + (hash(x, y, 313) < 0.25 ? 0.6 : 0) + ny * 0.5 + (r > 0.94 ? 1.2 : 0), x, y);
    });
  }, { outline: false, shadow: false }),
  // a standing lamp: a brass foot, a pole, a paper shade lit warm (`v` 1) or not
  lamp: v => pic(16, 30, p => {
    p.ell(8, 27, 5, 1.8, (x, y, nx) => tone(ramp('#c99a2b'), 1.4 + nx, x, y));
    p.rect(7, 9, 2, 18, (x, y, i) => tone(ramp('#c99a2b'), 1 + i * 1.2, x, y));
    p.fill(2, 1, 13, 10, (x, y) => Math.abs(x + 0.5 - 8) <= 3 + (y - 1) * 0.35, (x, y) => (v ? tone(ramp('#ffe28a'), 0.4 + (y - 1) / 9 * 1.5 + (x > 9 ? 0.6 : 0), x, y) : tone(ramp('#e8dcc8'), 1.4 + (x > 9 ? 0.8 : 0), x, y)));
    p.rect(2, 10, 12, 1, v ? '#e6963e' : '#b8a890');
  }),
  // the iron stove: a fire behind a little door, a kettle on top, its pipe going up into the wall
  stove: v => pic(16, 34, p => {
    const iron = ramp('#4b4858');
    p.rect(6, 0, 4, 18, (x, y, i) => tone(iron, 1.2 + i * 0.6 + (y % 6 === 0 ? 0.8 : 0), x, y));
    p.rect(2, 16, 12, 14, (x, y, i, j) => tone(iron, 1.6 + i / 11 * 1.4 + (j === 0 ? -0.8 : 0), x, y));
    p.rect(1, 15, 14, 2, (x, y, i, j) => tone(iron, j ? 2.6 : 0.8, x, y));
    p.rect(5, 21, 6, 5, (x, y, i, j) => (v ? ['#fff3b0', '#ffd25a', '#f59a3a', '#d9542e'][Math.min(3, Math.floor(hash(x, y + v, 314) * 2) + (j > 2 ? 2 : 0))] : '#2e2c3e'));
    p.rect(4, 20, 8, 1, iron[4]); p.rect(4, 26, 8, 1, iron[4]);
    for (const x of [3, 11]) p.rect(x, 30, 2, 3, iron[3]);
    p.ell(11, 13, 2.8, 2.2, (x, y, nx, ny) => tone(ramp('#7aa4ff'), 1.4 + nx * 0.7 + ny * 0.5, x, y));
    p.set(13, 11, '#4f6fb3'); p.rect(10, 10, 2, 1, '#4f6fb3');
  }),
  // a tall bookshelf full of books, a little pot on top
  shelf: () => pic(32, 36, p => {
    planks(p, [1, 3, 30, 34], null, WOOD, (x) => (x - 1) / 29 * 0.9 - 0.1, { pw: 30, seed: 315 });
    const r = seeded(316), cols = ['#d9454a', '#4f7ab8', '#4fae8a', '#f4cf4f', '#b48ade', '#f08c3a', '#f29bb2', '#e6dcc8'];
    for (const sy of [5, 15, 25]) {
      p.rect(3, sy, 26, 8, (x, y) => tone(WOOD, 4, x, y));
      for (let x = 3; x < 29;) {
        const w = 2 + Math.floor(r() * 2), hgt = 5 + Math.floor(r() * 3), c = ramp(cols[Math.floor(r() * cols.length)]);
        if (x + w > 29) break;
        p.rect(x, sy + 8 - hgt, w, hgt, (px, py, i, j) => tone(c, 1.4 + (i === w - 1 ? 1 : 0) + (j === 1 ? -0.8 : 0), px, py));
        x += w + (r() < 0.15 ? 2 : 0);
      }
      p.rect(2, sy + 8, 28, 2, (x, y, i, j) => tone(WOOD, j ? 3 : 1.4, x, y));
    }
    p.rect(0, 2, 32, 2, (x, y, i, j) => tone(WOOD, j ? 2.6 : 1, x, y));
    p.rect(22, -2 + 2, 5, 2, '#c9764a'); p.set(23, -1 + 0, LEAF[1]); p.set(24, 0, LEAF[2]); p.set(25, 0, LEAF[1]);
  }),
  // a round wooden tub of hot water, bubbles on top
  tub: () => pic(32, 24, p => {
    planks(p, [1, 6, 30, 22], (x, y) => ((x + 0.5 - 16) / 15.5) ** 2 + ((y + 0.5 - 14) / 10) ** 2 <= 1.4 && y >= 6, PINE, (x) => (x - 1) / 29 * 1.2 - 0.3, { pw: 3, seed: 317 });
    for (const y of [10, 18]) p.rect(1, y, 30, 1, '#5e5a66');
    p.ell(16, 7, 14, 4.5, (x, y, nx, ny) => tone(PINE, 0.8 + nx * 0.6, x, y));
    p.ell(16, 7.5, 12, 3.4, (x, y, nx, ny) => (ny < -0.4 ? WATER[0] : tone(WATER, 1.4 + nx * 0.6 + ny, x, y)));
    for (const [bx, by, r] of [[8, 6, 2], [12, 5, 1.4], [21, 7, 2.2], [25, 5, 1.2], [16, 4, 1.6]]) p.ell(bx, by, r, r * 0.8, (x, y, nx, ny) => (nx + ny < -0.3 ? '#ffffff' : '#e6f2ff'));
  }),
  // a plump sofa with two cushions
  sofa: () => pic(32, 24, p => {
    const R = ramp('#e0646e');
    p.rect(3, 0, 26, 12, (x, y, i, j) => tone(R, 1.4 + i / 25 * 0.9 + (j === 0 ? -0.8 : 0) + (j > 9 ? 0.6 : 0), x, y));
    for (const x of [3, 16]) p.rect(x, 1, 1, 10, R[3]);
    p.rect(4, 11, 24, 6, (x, y, i, j) => tone(R, 1 + i / 23 * 0.9 + (j === 0 ? -0.6 : 0) + (i === 12 ? 1 : 0), x, y));
    for (const x0 of [0, 26]) p.rect(x0, 6, 6, 14, (x, y, i, j) => tone(R, 1.2 + (x0 ? 0.9 : 0) + (j === 0 ? -0.8 : 0) + (i === (x0 ? 0 : 5) ? 0.7 : 0), x, y));
    p.rect(4, 17, 24, 4, (x, y, i, j) => tone(R, 2.8 + i / 23 * 0.6, x, y));
    for (const x of [2, 28]) p.rect(x, 21, 2, 3, WOOD[3]);
    for (const [cx, c] of [[9, '#f4cf4f'], [23, '#fff7f0']]) p.ell(cx, 9, 3.4, 3, (x, y, nx, ny) => tone(ramp(c), 1.2 + nx * 0.6 + ny * 0.6, x, y));
  }),
  // a tall wardrobe, hearts cut in its doors
  wardrobe: () => pic(16, 36, p => {
    planks(p, [1, 3, 14, 33], null, WOOD_WARM, (x) => (x - 1) / 13 * 1.1 - 0.3, { pw: 7, seed: 318 });
    p.rect(0, 1, 16, 3, (x, y, i, j) => tone(WOOD_WARM, j === 0 ? 0.8 : j === 1 ? 1.6 : 3.2, x, y));
    p.rect(7, 5, 1, 27, WOOD_WARM[4]);
    for (const hx of [3, 10]) p.stamp(hx, 9, ['k.k', 'kkk', '.k.'], { k: WOOD_WARM[4] });
    p.set(6, 19, '#f4cf4f'); p.set(9, 19, '#f4cf4f');
    p.rect(1, 33, 14, 1, WOOD_WARM[4]); for (const x of [1, 13]) p.rect(x, 34, 2, 2, WOOD[4]);
  }),
  // a round fishbowl on a little stand, a goldfish going round (`v`: where it is)
  tank: v => pic(16, 28, p => {
    p.rect(3, 22, 10, 2, (x, y, i, j) => tone(WOOD, j ? 3 : 1.4, x, y));
    for (const x of [4, 11]) p.rect(x, 24, 1, 4, WOOD[3]);
    p.ell(8, 15, 6.5, 6.5, (x, y, nx, ny) => (ny < -0.45 ? mixc('#e6f7ff', '#ffffff', 0.4) : tone(WATER, 1.2 + nx * 0.5 + (ny + 0.45) * 1.2, x, y)), (x, y) => y < 22);
    p.rect(3, 9, 10, 1, '#c8ecf8');
    p.rect(5, 19, 1, 2, LEAF[2]); p.rect(6, 18, 1, 3, LEAF[1]); p.rect(10, 19, 2, 2, '#c9a878');
    const fx = [5, 7, 9, 10, 8, 6][v % 6], fy = [14, 13, 14, 15, 16, 15][v % 6], left = [1, 2, 3].includes(v % 6) ? 0 : 1;
    p.rect(fx, fy, 3, 2, '#f08c3a'); p.set(left ? fx - 1 : fx + 3, fy, '#f8b46a'); p.set(left ? fx - 1 : fx + 3, fy + 1, '#f8b46a'); p.set(left ? fx + 2 : fx, fy, '#1b1424');
    p.set(4, 12, '#ffffff'); p.set(4, 13, '#ffffff');
  }),
  // a round cushion for the puppy
  petbed: () => pic(16, 14, p => {
    p.ell(8, 8, 7.5, 5, (x, y, nx, ny) => tone(ramp('#d9454a'), 1.2 + nx * 0.6 + ny * 0.9 + ((x + y) % 4 === 0 ? 0.6 : 0), x, y));
    p.ell(8, 7.5, 5, 3, (x, y, nx, ny) => tone(ramp('#f4ead8'), 1.6 + nx * 0.4 - ny * 0.5, x, y));
  }),
  // the 비밀 상자: a little lavender keepsake box, gold-banded, a star on its clasp. The more secrets
  // found, the more sticks out from under the lid (`v` 0..3): an acorn, then a feather, then a cookie
  // and the lid can hardly shut
  secretbox: v => pic(16, 20, p => {
    const L = ramp('#b48ade'), G = ramp('#f4cf4f'), up = v ? 1 : 0, top = 10 - up;
    if (v >= 1) {
      p.rect(3, top - 2, 4, 2, (x, y, i) => tone(ramp('#d9a05a'), 1 + i * 0.7, x, y));
      p.rect(3, top - 4, 4, 1, (x, y, i) => (i % 2 ? '#7a5234' : '#8e6440'));
      p.rect(2, top - 3, 6, 1, (x, y, i) => (i % 2 ? '#8e6440' : '#7a5234'));
      p.set(5, top - 5, '#5a3a24');
    }
    if (v >= 2) { for (let k = 0; k < 6; k++) p.set(10 + (k > 3 ? 1 : 0), top - 1 - k, k > 3 ? '#f29bb2' : '#fff7f0'); p.set(11, top - 4, '#f8b4cc'); p.set(9, top - 3, '#fff7f0'); }
    if (v >= 3) { p.ell(7, top - 1.4, 2.2, 1.6, (x, y, nx, ny) => tone(ramp('#e6b06a'), 1.2 + nx * 0.6 + ny * 0.5, x, y)); p.set(6, top - 2, '#8a5634'); p.set(8, top - 1, '#8a5634'); }
    // the lid, rounded on top, a gold band along its rim
    p.fill(1, top, 13, top + 3, (x, y) => !(y === top && (x < 3 || x > 11)), (x, y, i, j) => tone(L, 0.8 + (x - 1) / 12 * 1.6 + (y === top ? -0.6 : 0), x, y));
    p.rect(1, top + 3, 13, 1, (x, y) => tone(G, 1.2 + (x - 1) / 12 * 1.4, x, y));
    if (up) p.rect(2, top + 4, 11, 1, '#3a2a4a');
    // the box
    p.rect(2, 14, 11, 5, (x, y, i, j) => tone(L, 1.6 + i / 10 * 1.6 + (j === 4 ? 1 : 0), x, y));
    for (const x of [2, 12]) p.rect(x, 14, 1, 5, (px, py) => tone(G, x === 2 ? 1.4 : 2.8, px, py));
    // the clasp: a gold star
    p.stamp(5, top + 2, ['..k..', '.kkk.', 'kkkkk', '.k.k.'], { k: G[1] });
    p.set(7, top + 3, G[0]);
  }),
  // a music box with its lid open, a little dancer on top, a crank
  musicbox: v => pic(16, 22, p => {
    p.rect(2, 10, 12, 10, (x, y, i, j) => tone(ramp('#b48ade'), 1.4 + i / 11 * 1.2 + (j === 0 ? -0.8 : 0), x, y));
    p.rect(2, 13, 12, 1, '#f4cf4f'); p.rect(2, 18, 12, 1, '#f4cf4f');
    p.rect(2, 3, 12, 7, (x, y, i, j) => tone(ramp('#9a6ac8'), 2.2 + (j === 0 ? -0.8 : 0), x, y));
    p.rect(3, 4, 10, 5, (x, y) => '#fff3e6');
    p.set(v ? 9 : 7, 5, '#f29bb2'); p.rect(v ? 8 : 6, 6, 3, 2, '#f29bb2'); p.set(v ? 9 : 7, 4, '#f6dca6');
    p.rect(14, 14, 2, 1, '#c99a2b'); p.rect(15, 12, 1, 3, '#c99a2b');
    for (const x of [3, 12]) p.rect(x, 20, 1, 2, '#6a4a7a');
  }),
};

// things on the back wall: `w` slots wide, hung `y` pixels from the top of the wall
const WALL_ART = {
  painting: () => pic(16, 15, p => {
    p.rect(0, 0, 16, 13, (x, y, i, j) => (i === 0 || j === 0 || i === 15 || j === 12 ? tone(ramp('#c99a2b'), i === 0 || j === 0 ? 0.8 : 2.4, x, y) : j < 6 ? mixc('#9fd4ff', '#e6f4ff', j / 6) : j < 8 ? '#9ad86f' : tone(LEAF, 1 + ((i + j) % 3 === 0 ? 1 : 0), x, y)));
    p.ell(5, 6, 2.4, 2.4, LEAF[1]); p.rect(5, 7, 1, 3, '#8a5634'); p.set(11, 3, '#fff3b0'); p.set(12, 3, '#fff3b0');
  }, { shadow: false }),
  clock: v => pic(16, 26, p => {
    p.poly([[1, 6], [8, 0], [15, 6]], (x, y) => tone(WOOD, 1.2 + (x > 8 ? 1 : 0), x, y));
    p.rect(2, 6, 12, 11, (x, y, i) => tone(WOOD_WARM, 1.4 + i / 11, x, y));
    p.ell(8, 11.5, 3.6, 3.6, (x, y, nx, ny) => (nx + ny < -0.6 ? '#ffffff' : '#fbf3dc'));
    p.set(8, 9, '#3d3a48'); p.set(8, 10, '#3d3a48'); p.set(9, 11, '#3d3a48');
    p.rect(6, 2, 4, 3, v ? '#f4cf4f' : '#2e2232');
    if (v) { p.set(10, 3, '#f08c3a'); p.set(7, 2, '#1b1424'); }
    for (const [x, l] of [[5, 6], [11, 4]]) { p.rect(x, 17, 1, l, '#c99a2b'); p.rect(x - 1, 17 + l, 3, 3, '#8a5634'); }
    p.rect(8, 17, 1, 5, '#c99a2b'); p.ell(8.5, 23, 1.6, 1.6, '#f4cf4f');
  }, { shadow: false }),
  garland: () => pic(32, 12, p => {
    for (let x = 1; x < 31; x++) { const y = Math.round(2 + 6 * Math.sin(Math.PI * (x - 1) / 30)); p.set(x, y, LEAF[2]); p.set(x, y + 1, LEAF[3]); if (x % 4 === 2) { const c = ['#f29bb2', '#f4cf4f', '#fff7f0', '#b48ade'][(x / 4 | 0) % 4]; p.set(x, y - 1, c); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y + 1 - 1, '#f4cf4f'); } }
    p.set(0, 1, '#5e5a66'); p.set(31, 1, '#5e5a66');
  }, { shadow: false }),
  // the map of the fields: a path through ten spots, a star on the ones beaten (`v`: how many)
  map: v => pic(32, 20, p => {
    // in a plain wooden frame, like the painting's gold one
    p.rect(0, 0, 32, 20, (x, y, i, j) => tone(WOOD, i === 0 || j === 0 ? 1.4 : i === 31 || j === 19 ? 3.4 : 2.4, x, y));
    p.rect(1, 1, 30, 18, (x, y, i, j) => tone(ramp('#f1e0b8'), 1.4 + (hash(x, y, 319) < 0.15 ? 0.7 : 0) + (i === 0 || j === 0 ? 0.7 : 0), x, y));
    const spots = [[4, 14], [8, 10], [12, 13], [15, 8], [19, 11], [21, 6], [25, 9], [27, 4], [23, 3], [29, 13]];
    for (let k = 0; k + 1 < spots.length; k++) p.line(spots[k][0], spots[k][1], spots[k + 1][0], spots[k + 1][1], (s) => (s % 2 ? null : '#b8946a'));
    spots.forEach(([x, y], k) => {
      if (k < v) { p.set(x, y - 1, '#f4cf4f'); p.set(x - 1, y, '#f4cf4f'); p.set(x, y, '#fff3b0'); p.set(x + 1, y, '#f4cf4f'); p.set(x, y + 1, '#c99a2b'); }
      else p.set(x, y, '#8a6a4a');
    });
    p.ell(6, 5, 2.4, 2, LEAF[2]); p.rect(14, 15, 5, 2, '#7cc0dc');
  }, { shadow: false }),
};
export const WALL_Y = { painting: 9, clock: 4, garland: 6, map: 8 };

// a boss plushie sits on a little round cushion (the boss's own sprite goes on top, HomeScene)
export const plushCushion = () => pic(16, 6, p => p.ell(8, 3, 7, 2.6, (x, y, nx, ny) => tone(ramp('#f8b4cc'), 1.2 + nx * 0.6 + ny, x, y)));

export function furnitureCanvas(id, v = 0) {
  if (WALL_ART[id]) return WALL_ART[id](v);
  return ART[id](v);
}
// how many frames a piece goes through (the fish swims, the fire flickers, the cuckoo pops out)
export const FRAMES = { tank: 6, stove: 3, clock: 2, musicbox: 2 };
