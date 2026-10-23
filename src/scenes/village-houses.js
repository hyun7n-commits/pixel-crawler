// The village's houses, each its own shape: the guild's timber hall with a clock tower (once the
// village is big; its smaller halls and the shop's are in village-buildings.js), the smith's stone
// forge, a cherry tree you live inside, the rescue team's striped tent, the rival's witch-hat tower,
// and your own straw-roofed cottage. Each stands on its footprint (h.w x h.h
// tiles, the door in the middle of the bottom row) and rises above it by `up` pixels, so the canvas is
// placed by its bottom edge.
// v0.24: drawn with pixkit at the props' own detail (shingles a hand wide, stones a few pixels, leaf
// clumps a tree's size), lit from the upper left, an outline only round the outside, a shadow on the
// grass and grass growing over the foot of the walls, so they sit in the village rather than on it.

import { TILE } from './textures.js';
import {
  Pix, mixc, ramp, tone, hash, smooth, seeded, shingles, thatch, plaster, stones, planks, foliage, sprinkle, tufts,
  windowBox, roundWindow, doorway, lantern, signboard, groundShadow, WOOD, WOOD_WARM, STONE, INK,
  maker, wallLit, roundLit, domeLit,
} from './pixkit.js';
import { BUILDING_ART } from './village-buildings.js';

export { Pix, mixc };

const CREAM = '#efe0c2';
const PETALS = ['#f8b4cc', '#f4cf4f', '#fff7f0', '#e0646e'];

// Your cottage at building-on level `lvl` (0-2). The straw dome sits on the top floor's walls; level 2
// puts an upper floor between the ground floor and the roof.
function homeArt(lvl) {
  return (p, W, H, lived, h) => {
    const gy = H - 1, g0 = gy - 30, eave = lvl >= 2 ? g0 - 22 : g0, cx = W / 2, mk = maker(true);
    const straw = mk('#e2b553'), plas = mk(CREAM), stoneR = mk('#a9a6ae'), timber = mk('#7a4a2e');
    // the chimney, behind the roof
    stones(p, [55, 2, 63, eave - 27], null, stoneR, (x) => (x - 55) / 8 * 0.9 - 0.3, { ch: 3, wmin: 3, wmax: 5, seed: 11 });
    p.rect(54, 1, 11, 2, (x, y, i, j) => tone(stoneR, j === 0 ? 0.8 : 3, x, y));
    // walls: plaster over a stone footing, posts at the corners
    plaster(p, [9, g0, 70, gy - 4], null, plas, wallLit(9, 70, g0, gy), { seed: 12 });
    for (const x of [9, 69]) planks(p, [x, g0, x + 1, gy - 4], null, WOOD, () => (x > 40 ? 0.8 : 0), { pw: 2, seed: 13 });
    stones(p, [7, gy - 4, 72, gy], null, stoneR, (x) => (x - 7) / 65 * 0.8 - 0.1, { ch: 3, wmin: 4, wmax: 7, seed: 14 });
    // the upper floor: timber framing, braces, plaster between, a balcony along the front
    if (lvl >= 2) {
      plaster(p, [9, eave, 70, g0 - 1], null, plas, wallLit(9, 70, eave, g0), { seed: 18 });
      for (const x of [9, 24, 55, 69]) planks(p, [x, eave, x + 1, g0 - 1], null, timber, () => (x > 40 ? 0.9 : 0.2), { pw: 2, seed: 19 });
      p.rect(9, g0 - 2, 62, 2, (x, y, i, j) => tone(timber, j ? 3 : 1.2, x, y));
      // two braces leaning in toward the balcony door
      for (const [x0, x1] of [[26, 33], [53, 46]]) p.line(x0, g0 - 9, x1, eave + 5, () => tone(timber, 1.8, x0, 0));
      windowBox(p, 14, eave + 6, 7, 6, { shutters: mk('#5d8a5a'), box: ['#f29bb2', '#fff7f0'], curtain: ['#f8b4cc', '#e58aa5'] });
      windowBox(p, 59, eave + 6, 7, 6, { shutters: mk('#5d8a5a'), box: ['#f4cf4f', '#fff7f0'], curtain: ['#f8b4cc', '#e58aa5'] });
      // the balcony: a door out onto it, a rail of turned posts, flowers trailing over
      doorway(p, cx, g0 - 3, 8, 13, { arch: true, step: false, seed: 20 });
      p.rect(27, g0 - 1, 26, 3, (x, y, i, j) => tone(timber, j === 0 ? 1 : 3, x, y));
      for (let x = 27; x <= 52; x++) {
        p.set(x, g0 - 8, tone(timber, 1.2, x, 0));
        if ((x - 27) % 3 === 0) for (let y = g0 - 7; y < g0 - 1; y++) p.set(x, y, tone(timber, 2.2 + (y === g0 - 7 ? -0.8 : 0), x, y));
      }
      for (let x = 28; x < 52; x += 2) if (hash(x, 0, 21) < 0.6) { p.set(x, g0 + 2, '#5aad58'); p.set(x, g0 + 3 + (x % 4 === 0 ? 1 : 0), PETALS[(x >> 1) % 4]); }
    }
    // the straw roof: a fat dome, its fringe hanging ragged over the walls
    const cy = eave + 4, rx = W / 2 + 0.5, ry = eave - 2;
    const inRoof = (x, y) => { const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; return nx * nx + ny * ny <= 1 && y <= eave + 3 + Math.floor(hash(x, 0, 15) * 3); };
    thatch(p, [0, 0, W - 1, eave + 6], inRoof, straw, domeLit(cx, cy * 0.75, rx, ry), { bh: 6, seed: 16 });
    // a ridge of darker straw bound along the top
    for (let x = 22; x < 58; x++) { const y = Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2))) + 2; if (x % 3) p.set(x, y, straw[4]); p.set(x, y + 1, straw[x % 4 ? 3 : 4]); }
    // building on: a dormer window looking out of the thatch, and a round one under the ridge
    if (lvl >= 1) {
      const dx = 21, dy = eave - 17;
      plaster(p, [dx - 5, dy, dx + 5, dy + 10], (x, y) => y >= dy + Math.abs(x + 0.5 - dx) * 0.9, plas, (x) => (x - dx) / 5 * 0.4, { seed: 22 });
      for (let k = 0; k <= 6; k++) for (const sx of [-1, 1]) { p.set(Math.round(dx - 0.5 + sx * (k + 0.5)), dy - 2 + k, tone(straw, 3.4, k, 0)); p.set(Math.round(dx - 0.5 + sx * (k + 0.5)), dy - 1 + k, tone(straw, 2.4, k, 1)); }
      roundWindow(p, dx - 0.5, dy + 6, 2.4);
      roundWindow(p, cx - 0.5, Math.round(eave * 0.38), 2.6);
    }
    // windows with shutters and flower boxes, the door, a lantern (on the porch posts, once there is one)
    windowBox(p, 17, g0 + 9, 8, 7, { shutters: mk('#5d8a5a'), box: ['#f29bb2', '#f4cf4f', '#fff7f0'], curtain: ['#f8b4cc', '#e58aa5'] });
    windowBox(p, 55, g0 + 9, 8, 7, { shutters: mk('#5d8a5a'), box: ['#e0646e', '#f4cf4f', '#9fc2ff'], curtain: ['#f8b4cc', '#e58aa5'] });
    doorway(p, cx, gy, 10, 17, { arch: true, seed: 17 });
    if (lvl >= 1) {
      // the porch: two posts by the door holding up a little shingled canopy (or the balcony)
      for (const x of [cx - 10, cx + 9]) planks(p, [x, g0 + (lvl >= 2 ? 2 : 7), x + 1, gy - 2], null, timber, () => (x > cx ? 0.9 : 0.1), { pw: 2, seed: 23 });
      if (lvl === 1) {
        shingles(p, [cx - 13, g0 + 2, cx + 12, g0 + 7], (x, y) => y >= g0 + 2 + Math.max(0, 3 - Math.min(x - (cx - 13), cx + 12 - x)), mk('#c0583c'), (x) => (x - cx) / 13 * 0.6, { sw: 4, rh: 2, seed: 24 });
        p.rect(cx - 13, g0 + 8, 26, 1, (x) => tone(timber, 3.4, x, 0));
      }
      lantern(p, cx + 7, g0 + 11);
    } else lantern(p, cx + 8, gy - 17);
    signboard(p, cx, eave - 4, h.sign, true);
    p.outline();
    tufts(p, 5, W - 6, gy, 18);
  };
}

const HOUSE_ART = {
  // your own house: a cottage under a thick straw roof, a round stone chimney, shutters and flower
  // boxes, a heart over the door and a lantern beside it. As the beaver builds on inside (data/home.js
  // HOUSE_LEVELS) it grows here too: a dormer and a porch, then a whole timber-framed upper floor
  // with a balcony.
  home: { up: 18, smoke: [59, 2], draw: homeArt(0) },
  home1: { up: 26, smoke: [59, 2], draw: homeArt(1) },
  home2: { up: 42, smoke: [59, 2], draw: homeArt(2) },

  // the guild once the village is big (P 20 on): a big timber-framed hall with a clock tower rising
  // out of its roof, the double door between lanterns, the guild's flag on the spire. The tallest
  // thing in the village.
  guild2: { up: 46, draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = H - 33, mk = maker(lived);
    const roof = mk(h.roof), plas = mk(CREAM), wood = mk('#7a4a2e'), stoneR = mk('#a3a2ad');
    // the tower: plaster between corner posts, a clock face, a little window, a spire of shingles
    const tx0 = 30, tx1 = 49, tTop = 22;
    plaster(p, [tx0, tTop, tx1, wallTop], null, plas, (x, y) => (x - tx0) / 19 * 0.9 - 0.3 + (y < tTop + 4 ? (tTop + 4 - y) * 0.3 : 0), { seed: 21 });
    for (const x of [tx0, tx1 - 1]) planks(p, [x, tTop, x + 1, wallTop], null, wood, () => (x > 40 ? 0.8 : 0), { pw: 2 });
    p.rect(tx0, tTop + 22, 20, 2, (x, y, i, j) => tone(wood, j ? 3 : 1.4, x, y));
    p.ell(39.5, tTop + 11, 6.2, 6.2, (x, y, nx, ny) => tone(stoneR, nx + ny < -0.5 ? 1 : 3, x, y));
    p.ell(39.5, tTop + 11, 5, 5, (x, y, nx, ny) => (lived ? (nx + ny < -0.9 ? '#ffffff' : '#fbf3dc') : '#c9c4c8'));
    for (const [a, l] of [[-Math.PI / 2, 4], [0.5, 3]]) for (let k = 1; k <= l; k++) p.set(39 + Math.round(Math.cos(a) * k), tTop + 11 + Math.round(Math.sin(a) * k), '#3d3a48');
    for (const a of [0, 1, 2, 3]) p.set(39 + Math.round(Math.cos(a * Math.PI / 2) * 4.3), tTop + 11 + Math.round(Math.sin(a * Math.PI / 2) * 4.3), '#8a8794');
    p.set(39, tTop + 11, '#d9454a');
    windowBox(p, 37, tTop + 26, 5, 6, { lived, frame: wood });
    const spire = [[tx0 - 4, tTop + 1], [39.5, 3], [tx1 + 4, tTop + 1]];
    shingles(p, [tx0 - 4, 3, tx1 + 4, tTop + 1], (x, y) => inPolyF(spire, x, y), roof, (x, y) => (x < 39.5 ? -0.5 : 0.8) + (y - 3) / 20 * 0.4, { sw: 5, rh: 3, seed: 22 });
    p.rect(tx0 - 4, tTop, 28, 2, (x, y, i, j) => tone(roof, j ? 4 : 3, x, y));
    // the hall's hipped roof, the tower standing up through it
    const rTop = wallTop - 21, hall = [[-1, wallTop + 3], [13, rTop], [W - 13, rTop], [W, wallTop + 3]];
    shingles(p, [0, rTop, W - 1, wallTop + 3], (x, y) => inPolyF(hall, x, y) && !(x >= tx0 && x <= tx1 && y < rTop + 14 - Math.abs(x - 39.5) * 0), roof,
      (x, y) => { const t = (y - rTop) / (wallTop + 3 - rTop), left = 13 - 14 * t, right = W - 13 + 14 * t; return (x < left + 10 ? -0.7 : x > right - 10 ? 0.9 : 0) + t * 0.3; }, { sw: 6, rh: 4, seed: 23 });
    // tower in front of the ridge: redraw its face over the back slope
    plaster(p, [tx0, rTop, tx1, rTop + 13], null, plas, (x) => (x - tx0) / 19 * 0.9 - 0.3, { seed: 24 });
    for (const x of [tx0, tx1 - 1]) planks(p, [x, rTop, x + 1, rTop + 13], null, wood, () => (x > 40 ? 0.8 : 0), { pw: 2 });
    for (let x = tx0 - 1; x <= tx1 + 1; x++) p.set(x, rTop + 14, roof[4]);
    p.rect(2, wallTop + 2, W - 4, 2, (x, y, i, j) => tone(roof, j ? 5 : 4, x, y));
    // the hall: plaster panels in a timber frame, braces in the end bays, on a stone footing
    plaster(p, [3, wallTop + 4, W - 4, gy - 4], null, plas, wallLit(3, W - 4, wallTop + 4, gy), { seed: 25 });
    const beam = (x0, y0, w, hh) => planks(p, [x0, y0, x0 + w - 1, y0 + hh - 1], null, wood, (x) => (x - 3) / (W - 6) * 0.7 - 0.1, { pw: hh > w ? 2 : 9, vert: hh > w, seed: x0 + y0 });
    for (const x of [3, 21, W - 23, W - 5]) beam(x, wallTop + 4, 2, gy - wallTop - 8);
    beam(3, wallTop + 4, W - 6, 2); beam(3, gy - 6, W - 6, 2);
    for (const [x0, dir] of [[5, 1], [W - 21, -1]]) p.line(dir > 0 ? x0 : x0 + 15, gy - 7, dir > 0 ? x0 + 15 : x0, wallTop + 7, (k, n) => wood[k % 4 ? 2 : 3]);
    stones(p, [1, gy - 4, W - 2, gy], null, stoneR, (x) => (x - 1) / W * 0.8 - 0.1, { ch: 3, wmin: 4, wmax: 8, seed: 26 });
    // the double door under an arch, lanterns either side, a notice board with requests pinned up
    doorway(p, 39.5, gy, 13, 18, { arch: true, pw: 3, boarded: !lived, frame: wood });
    p.rect(39, gy - 15, 1, 15, wood[4]);
    lantern(p, 30, gy - 18, lived); lantern(p, 47, gy - 18, lived);
    windowBox(p, 9, wallTop + 10, 8, 8, { lived, frame: wood, box: lived ? ['#f29bb2', '#fff7f0', '#f4cf4f'] : null });
    windowBox(p, W - 17, wallTop + 10, 8, 8, { lived, frame: wood, box: lived ? ['#e0646e', '#f4cf4f', '#9fc2ff'] : null });
    signboard(p, 39.5, wallTop + 6, h.sign, lived);
    p.outline();
    // the flag, thin, after the outline
    for (let y = 0; y < 4; y++) p.set(39, y, '#3d3a48');
    p.rect(40, 0, 6, 3, lived ? '#d9454a' : '#8a8794'); p.rect(40, 0, 6, 1, lived ? '#f06a6a' : '#a3a2ad'); p.rect(40, 3, 3, 1, lived ? '#b02f3a' : '#77737f');
    tufts(p, 0, W - 1, gy, 27);
  } },

  // the smith: a squat stone forge under a slate dome, a fat brick chimney, the furnace glowing orange
  // in an arch at one end, an anvil and a water barrel out front
  smith: { up: 24, smoke: [58, 1], draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = H - 36, mk = maker(lived);
    const slate = mk(h.roof), stoneR = mk('#a8a6b0'), brick = mk('#b05a40');
    // chimney, behind the roof, sooty at the top
    p.rect(54, 8, 12, wallTop - 8, (x, y, i, j) => {
      const row = Math.floor(j / 3), lx = (i + (row & 1) * 3) % 6;
      let v = 2 + (i / 11) * 1.1 - 0.4;
      if (j % 3 === 2 || lx === 0) v += 1.3;
      if (j < 7 && hash(x, y, 41) < 0.55 - j * 0.07) v += 1.4;
      return tone(brick, v, x, y);
    });
    p.rect(53, 6, 14, 3, (x, y, i, j) => tone(stoneR, j === 0 ? 0.8 : j === 1 ? 2 : 3.6, x, y));
    // the slate dome
    const cx = W / 2, cy = wallTop + 4, rx = W / 2 - 3, ry = 26;
    shingles(p, [3, cy - ry, W - 4, cy], (x, y) => { const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; return nx * nx + ny * ny <= 1 && y <= wallTop + 3; },
      slate, domeLit(cx - 8, cy - 12, rx, ry, 1.5), { sw: 6, rh: 4, seed: 42 });
    p.rect(3, wallTop + 3, W - 6, 2, (x, y, i, j) => tone(slate, j ? 5 : 4, x, y));
    // the walls: rough stone courses
    stones(p, [5, wallTop + 5, W - 6, gy], null, stoneR, (x, y) => (x - 5) / (W - 10) * 1 - 0.35 + (y < wallTop + 9 ? (wallTop + 9 - y) * 0.3 : 0), { ch: 4, wmin: 4, wmax: 8, seed: 43 });
    // the furnace: an arch of big pale stones, dark inside, coals glowing at the bottom
    const fx = 59, fy = gy - 6;
    p.ell(fx, fy, 9, 10, (x, y, nx, ny) => {
      const seg = Math.floor((Math.atan2(ny, nx) + Math.PI) / (Math.PI / 6));
      return tone(stoneR, (seg & 1 ? 1.2 : 1.9) + (nx > 0.3 ? 0.8 : 0) + (Math.hypot(nx, ny) > 0.86 ? 0.9 : 0), x, y);
    }, (x, y) => y <= gy);
    p.ell(fx, fy + 1, 6.2, 8, (x, y, nx, ny) => {
      if (!lived) return ny > 0.5 ? '#3d3b50' : '#2e2c3e';
      if (ny > 0.55) return ['#fff3b0', '#ffd25a', '#f59a3a', '#ffd25a'][Math.floor(hash(x, y, 44) * 4)];
      return ['#d9542e', '#9a3a2a', '#5a2424', '#3a1c20'][Math.max(0, Math.min(3, Math.floor((0.55 - ny) * 2.6)))];
    }, (x, y) => y <= gy - 1);
    if (lived) for (const [ex, ey] of [[57, gy - 10], [61, gy - 12], [59, gy - 8]]) p.set(ex, ey, '#ffd25a');
    // the door, a window with shutters, the sign
    doorway(p, 30, gy, 10, 16, { boarded: !lived, pw: 2 });
    windowBox(p, 11, wallTop + 11, 7, 7, { lived, shutters: mk('#6a4a3a') });
    signboard(p, 30, wallTop + 7, h.sign, lived);
    // an anvil on a stump, a barrel of water
    const iron = ramp('#5e5c6c');
    p.rect(41, gy - 4, 6, 4, (x, y, i) => tone(WOOD, 1.6 + i * 0.35, x, y));
    p.rect(38, gy - 8, 11, 3, (x, y, i, j) => tone(iron, j === 0 ? 0.6 : 2 + i * 0.12, x, y));
    p.rect(36, gy - 8, 2, 2, (x, y, i, j) => iron[1 + j]);
    p.rect(42, gy - 5, 4, 1, iron[4]);
    planks(p, [71, gy - 8, 77, gy - 1], null, WOOD, (x) => (x - 71) / 6 - 0.3, { pw: 2 });
    for (const y of [gy - 7, gy - 3]) p.rect(71, y, 7, 1, '#4b4858');
    p.rect(72, gy - 8, 5, 1, lived ? '#7cc0dc' : '#4f4e64');
    p.outline();
    tufts(p, 3, W - 4, gy, 45, { flowers: 0.05 });
  } },

  // the neighbour lives inside a cherry tree: a fat trunk with a round door and round windows, roots
  // spreading over the grass, and a crown of blossom made of tree-sized clumps
  neighbor: { up: 40, draw(p, W, H, lived, h) {
    const gy = H - 1, trunkTop = 54, mk = maker(lived);
    const bark = mk('#8a5634'), pal = lived ? ['#ffe6ef', '#f9bfd3', '#ee97b7', '#cf6f97', '#9a4a72'] : ['#e6dde2', '#cbbfc6', '#ada0a8', '#8d8189', '#6d6269'];
    // trunk and roots: thick, a little waist, flaring out over the grass
    const half = y => { const t = (y - trunkTop) / (gy - trunkTop); return 17 - Math.sin(t * Math.PI) * 2 + Math.max(0, t - 0.7) ** 2 * 190; };
    const hw = y => (y < trunkTop ? 17 - (trunkTop - y) * 0.45 : half(y));
    p.fill(0, trunkTop - 14, W - 1, gy, (x, y) => Math.abs(x + 0.5 - W / 2) <= hw(y), (x, y) => {
      const u = (x + 0.5 - W / 2) / hw(y);
      let v = 2 + u * 1.3 - 0.25;
      // bark ridges running up the trunk, wandering a little
      const col = x + Math.round(smooth(x, y, 9, 50) * 3);
      if (col % 4 === 0) v += 0.9; else if (col % 4 === 1) v -= 0.4;
      if (hash(x, y, 52) < 0.03) v += 0.9;
      return tone(bark, v, x, y);
    });
    for (const [kx, ky] of [[26, 74], [55, 68], [50, 92]]) { p.ell(kx, ky, 2.2, 1.7, bark[4]); p.set(kx - 1, ky - 1, bark[1]); }
    // two big limbs forking out of the trunk up into the crown
    for (const [x0, x1, sgn] of [[33, 20, -1], [47, 60, 1]]) for (let y = trunkTop + 4; y >= 34; y--) {
      const t = (trunkTop + 4 - y) / (trunkTop - 30), xc = x0 + (x1 - x0) * t, hw = 5 - t * 2;
      for (let x = Math.floor(xc - hw); x <= xc + hw; x++) p.set(x, y, tone(bark, 2 + ((x - xc) / hw) * 1.1 + (sgn > 0 ? 0.4 : -0.1) + ((x + y) % 4 === 0 ? 0.6 : 0), x, y));
    }
    // the crown: lumps of blossom, a dip in the middle of its underside where the limbs go in
    const lumps = [[W / 2, 24, 35, 16], [19, 40, 19, 12], [W - 19, 39, 19, 12], [34, 9, 17, 8], [55, 12, 13, 8]];
    const shape = (x, y) => lumps.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
    const { own } = foliage(p, [0, 0, W - 1, 52], shape, pal, { seed: 53, mid: 0.36, step: 6.6, rmin: 4.2, rmax: 7.2, side: (x) => (x - W / 2) / W * 0.9, line: 1 });
    sprinkle(p, [2, 4, W - 3, 50], own, 30, 54, (x, y) => p.set(x, y, lived ? '#fff7fa' : '#f0eaee'));
    // the round door (warm boards in a bark frame), round windows, the sign, a lantern on a branch stub
    doorway(p, W / 2, gy, 11, 16, { arch: true, boarded: !lived, frame: mk('#c9a070') });
    roundWindow(p, 27, gy - 30, 3.6, { lived, frame: bark }); roundWindow(p, 53, gy - 37, 3.2, { lived, frame: bark });
    signboard(p, W / 2, gy - 29, h.sign, lived);
    p.rect(58, gy - 22, 7, 2, (x, y, i, j) => tone(bark, j ? 3 : 1.4, x, y));
    lantern(p, 62, gy - 20, lived);
    // little mushrooms among the roots
    for (const [mx, my] of [[14, gy - 2], [66, gy - 1]]) { p.rect(mx, my - 2, 3, 2, ['#e0646e', '#d9454a'][0]); p.set(mx + 1, my - 2, '#fff7f0'); p.set(mx + 1, my, '#efe0c2'); }
    p.outline();
    const r = seeded(55);
    if (lived) for (let k = 0; k < 9; k++) p.front(4 + Math.floor(r() * (W - 8)), gy - Math.floor(r() * 2), r() < 0.5 ? '#f9bfd3' : '#fff7fa');
    tufts(p, 2, W - 3, gy, 56);
  } },

  // the rescue team: a big round tent striped orange and cream, a red-cross pennant on the pole, guy
  // ropes pegged into the grass, a supply crate by the open flap
  rescue: { up: 18, draw(p, W, H, lived, h) {
    const gy = H - 1, eave = H - 30, mk = maker(lived), apex = 10;
    const orange = mk(h.roof), cream = mk('#f6efe2');
    // the pole
    for (let y = 0; y < apex + 2; y++) p.set(W / 2, y, y < 2 ? '#c9a878' : '#6a4a2a');
    // the cone: stripes running up to the top, folds, lit from the left
    p.poly([[1, eave + 2], [W / 2, apex], [W - 1, eave + 2]], (x, y) => {
      const t = (y - apex) / (eave + 2 - apex), u = (x + 0.5 - W / 2) / (W / 2 * Math.max(0.05, t));
      const k = Math.floor((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 12);
      const R = k & 1 ? cream : orange;
      let v = 2 + u * 1.3 - 0.2 + (1 - t) * -0.3;
      if (hash(Math.floor(x / 2), Math.floor(y / 6), 61) < 0.12) v += 0.6;
      return tone(R, v, x, y);
    });
    // a scalloped valance round the eave
    for (let x = 1; x < W - 1; x++) {
      const s = Math.floor(x / 6), lx = x % 6, R = s & 1 ? cream : orange, u = (x - W / 2) / (W / 2);
      const d = lx === 0 || lx === 5 ? 2 : lx === 1 || lx === 4 ? 3 : 4;
      for (let j = 0; j < d; j++) p.set(x, eave + 2 + j, tone(R, 1.6 + u * 1.2 + (j === d - 1 ? 0.7 : 0), x, j));
    }
    // the round wall, stripes bending round it
    p.fill(5, eave + 5, W - 6, gy, null, (x, y) => {
      const u = (x + 0.5 - W / 2) / (W / 2 - 5), k = Math.floor((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 10);
      let v = 2 + u * 1.3 - 0.2 + (y < eave + 9 ? (eave + 9 - y) * 0.35 : 0) + (y > gy - 2 ? 0.4 : 0);
      return tone(k & 1 ? cream : orange, v, x, y);
    });
    // the door flaps, tied back, the dark inside
    const fl = [[W / 2 - 10, gy + 1], [W / 2, eave + 6], [W / 2 + 10, gy + 1]];
    p.poly(fl, (x, y) => tone(orange, 3.4 + (x > W / 2 ? 0.6 : 0), x, y));
    p.poly([[W / 2 - 7, gy + 1], [W / 2, eave + 10], [W / 2 + 7, gy + 1]], (x, y) => (lived ? ['#5a3a2a', '#4a2e22', '#3a2420'][Math.min(2, Math.floor((y - eave - 10) / 6))] : '#2e2c3e'));
    if (lived) for (let y = gy - 8; y < gy; y++) p.set(W / 2 - 1 + ((y >> 1) & 1), y, '#f4cf4f');
    for (const sx of [-1, 1]) { p.set(W / 2 + sx * 8, gy - 9, '#c9a878'); p.set(W / 2 + sx * 8, gy - 8, '#8a6a4a'); }
    if (!lived) for (let k = 0; k < 6; k++) p.rect(W / 2 - 6 + k * 2, gy - 9 + (k & 1), 2, 1, '#c9a878');
    signboard(p, W / 2, eave - 10, h.sign, lived);
    // a crate of supplies with a red cross
    planks(p, [8, gy - 8, 18, gy - 1], null, WOOD_WARM, (x, y) => (y === gy - 8 ? -0.8 : 0) + (x > 15 ? 0.6 : 0), { pw: 3, vert: false, seed: 62 });
    if (lived) { p.rect(12, gy - 6, 3, 1, '#d9454a'); p.rect(13, gy - 7, 1, 3, '#d9454a'); }
    p.outline();
    // guy ropes and pegs (thin, over the outline)
    for (const [x0, x1] of [[4, -2], [W - 5, W + 1]]) for (let k = 0; k <= 8; k++) { const x = Math.round(x0 + (x1 - x0) * k / 8), y = eave + 4 + Math.round((gy - eave - 4) * k / 8); if (x >= 0 && x < W) p.front(x, y, '#d8c49c'); }
    if (lived) { p.front(W / 2 + 1, 1, '#f6efe2'); p.front(W / 2 + 2, 1, '#d9454a'); p.front(W / 2 + 3, 1, '#f6efe2'); p.front(W / 2 + 1, 2, '#d9454a'); p.front(W / 2 + 2, 2, '#d9454a'); p.front(W / 2 + 3, 2, '#d9454a'); p.front(W / 2 + 1, 3, '#f6efe2'); p.front(W / 2 + 2, 3, '#d9454a'); p.front(W / 2 + 3, 3, '#f6efe2'); p.front(W / 2 + 4, 2, '#f6efe2'); }
    tufts(p, 3, W - 4, gy, 63);
  } },

  // the rival: a round stone tower under a tall witch-hat roof of little purple shingles, the tip bent
  // over with a star on it, a broom by the door and a cauldron bubbling green
  rival: { up: 50, draw(p, W, H, lived, h) {
    const gy = H - 1, wallTop = H - 35, mk = maker(lived);
    const hat = mk(h.roof), stoneR = mk('#c9bfae'), band = mk('#e2b84a');
    // the tower: round, stone, lit from the left
    stones(p, [15, wallTop, W - 16, gy], null, stoneR, (x, y) => roundLit(W / 2, W / 2 - 15, 1.3)(x) - 0.1 + (y < wallTop + 6 ? (wallTop + 6 - y) * 0.35 : 0), { ch: 4, wmin: 4, wmax: 7, seed: 71 });
    // the hat: brim, cone leaning over to the right, the bent tip
    const tipX = 47, tipY = 12;
    const cone = [[13, wallTop - 1], [tipX - 4, tipY + 2], [tipX + 3, tipY], [W - 13, wallTop - 1]];
    shingles(p, [13, tipY, W - 13, wallTop], (x, y) => inPolyF(cone, x, y), hat,
      (x, y) => { const t = (y - tipY) / (wallTop - tipY), mid = tipX + (W / 2 - tipX) * t; return (x - mid) / (W / 2 - 13) * 1.4 - 0.2; }, { sw: 5, rh: 3, seed: 72 });
    const tip = [[tipX - 4, tipY + 3], [tipX + 1, tipY - 6], [tipX + 9, tipY - 9], [tipX + 15, tipY - 4], [tipX + 13, tipY - 2], [tipX + 8, tipY - 5], [tipX + 4, tipY + 1]];
    shingles(p, [tipX - 4, tipY - 10, tipX + 16, tipY + 3], (x, y) => inPolyF(tip, x, y), hat, (x, y) => (y < tipY - 5 ? -0.4 : 0.6), { sw: 5, rh: 3, seed: 73 });
    p.fill(13, wallTop - 6, W - 13, wallTop - 3, (x, y) => inPolyF(cone, x, y), (x, y, i) => tone(band, (y === wallTop - 6 ? 0.8 : 2) + (x - W / 2) / 30, x, y));
    p.ell(W / 2, wallTop + 1, W / 2 - 5, 5, (x, y, nx, ny) => tone(hat, (ny < 0 ? 1.2 : 3) + nx * 0.9, x, y));
    // windows with purple curtains, the arched door, the sign
    windowBox(p, 22, wallTop + 11, 6, 8, { lived, curtain: ['#b48ade', '#8a5fc0'], frame: mk('#6a4a7a') });
    windowBox(p, W - 28, wallTop + 11, 6, 8, { lived, curtain: ['#b48ade', '#8a5fc0'], frame: mk('#6a4a7a') });
    doorway(p, W / 2, gy, 10, 16, { arch: true, boarded: !lived, frame: mk('#6a4a7a'), wood: mk('#7a4f8a') });
    signboard(p, W / 2, wallTop + 6, h.sign, lived);
    // a broom leaning by the door, a cauldron
    p.line(50, gy - 15, 47, gy - 3, (k) => (k % 3 ? '#a0703f' : '#7a5232'));
    p.fill(44, gy - 4, 50, gy, (x, y) => Math.abs(x - 47) <= (y - gy + 5) * 0.8, (x, y) => tone(ramp('#d8b45a'), 1.5 + (x - 47) * 0.3, x, y));
    p.ell(66, gy - 3, 5, 3.6, (x, y, nx, ny) => tone(ramp('#4b4858'), 2 + nx + ny * 0.5, x, y), (x, y) => y >= gy - 4);
    p.rect(61, gy - 5, 11, 2, (x, y, i, j) => tone(ramp('#4b4858'), j ? 3 : 1, x, y));
    if (lived) for (const [bx, by, c] of [[64, gy - 6, '#9be07a'], [67, gy - 7, '#c9f5a8'], [69, gy - 6, '#6cc45a']]) p.set(bx, by, c);
    p.outline();
    p.stamp(tipX + 13, tipY - 7, ['.y.', 'yYy', '.y.'], { y: lived ? '#f4cf4f' : '#a8a296', Y: lived ? '#fff3b0' : '#c9c4c8' });
    tufts(p, 12, W - 13, gy, 74);
  } },
};

function inPolyF(P, x, y) {
  let inside = false;
  const px = x + 0.5, py = y + 0.5;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

Object.assign(HOUSE_ART, BUILDING_ART);

// how far above its footprint a house rises
export const houseUp = (h, lvl) => artOf(h, lvl)?.up || 0;
// where its chimney smoke comes out (if it has a chimney), from the footprint's top-left in pixels
export const chimneyAt = (h, lvl) => {
  const a = artOf(h, lvl), s = typeof a?.smoke === 'function' ? a.smoke(h) : a?.smoke;
  return s ? [s[0], s[1] - a.up] : null;
};

// the art for a house at a level (the guild and the shop grow with the village: data/village.js)
const artOf = (h, lvl = 0) => HOUSE_ART[`${h.id}${lvl ? lvl : ''}`] || HOUSE_ART[h.id] || (h.cot != null && HOUSE_ART.cottage);
export function houseArt(h, lived, lvl = 0) {
  const art = artOf(h, lvl);
  const W = h.w * TILE, H = h.h * TILE + art.up;
  const p = new Pix(W, H);
  art.draw(p, W, H, lived, h);
  return p.canvas(g => groundShadow(g, 2, W - 2, H - 1, 6, 7, 0.24));
}
export const hasHouseArt = (h, lvl) => !!artOf(h, lvl);
