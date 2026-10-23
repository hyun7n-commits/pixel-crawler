// Things on the ground of a field, drawn like the rest: gates and doors in the hedge gaps, burrows,
// traps, lily pads, berry bushes, lone props, hives and the rest. Each one fills a tile (0-100) and
// stands on its lower part, as if seen from a little above.

import { INK, LW, C, ellipse, circle, paint, within, mix, hexA, rng } from './ink.js';

const lw = LW * 0.85;
const wood = '#c98a55', woodLight = '#e8b47a', woodDark = '#9a6440';
const shadow = (g, x = 50, y = 92, rx = 34, ry = 6, a = 0.2) => { ellipse(g, x, y, rx, ry); g.fillStyle = `rgba(58,32,64,${a})`; g.fill(); };
const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

// gate posts at both sides of a gap, a little cap on each
function posts(g, col = wood, cap = woodLight, top = 14) {
  for (const x of [4, 82]) {
    rrect(g, x, top, 14, 96 - top - 4, 4); paint(g, col, { w: lw });
    ellipse(g, x + 7, top + 2, 8.5, 4.5); paint(g, cap, { w: lw });
  }
}
function slats(g, x0, x1, y0, y1, col, n) {
  const w = (x1 - x0) / n;
  for (let k = 0; k < n; k++) {
    g.beginPath(); g.moveTo(x0 + k * w + 1, y1); g.lineTo(x0 + k * w + 1, y0 + 4); g.quadraticCurveTo(x0 + k * w + w / 2, y0 - 3, x0 + (k + 1) * w - 1, y0 + 4); g.lineTo(x0 + (k + 1) * w - 1, y1); g.closePath();
    paint(g, col, { w: lw * 0.85 });
  }
}

const P = {};

// ---------- doors, one per zone ----------
P.door = g => { // a white picket gate
  shadow(g, 50, 92, 46, 5);
  slats(g, 16, 84, 24, 90, '#f6ecd8', 5);
  rrect(g, 14, 44, 72, 9, 3); paint(g, '#e8dcc2', { w: lw });
  rrect(g, 14, 70, 72, 9, 3); paint(g, '#e8dcc2', { w: lw });
  posts(g);
};
P.doorOpen = g => {
  shadow(g, 50, 92, 46, 5);
  // the gate swung back against one post, seen edge-on
  g.beginPath(); g.moveTo(18, 24); g.lineTo(30, 30); g.lineTo(30, 92); g.lineTo(18, 90); g.closePath(); paint(g, '#f6ecd8', { w: lw });
  posts(g);
};
P.door_forest = g => { // a round-topped log door
  shadow(g, 50, 92, 46, 5);
  g.beginPath(); g.moveTo(12, 94); g.lineTo(12, 40); g.quadraticCurveTo(12, 10, 50, 10); g.quadraticCurveTo(88, 10, 88, 40); g.lineTo(88, 94); g.closePath();
  paint(g, wood, { w: lw });
  within(g, () => { g.beginPath(); g.moveTo(12, 94); g.lineTo(12, 40); g.quadraticCurveTo(12, 10, 50, 10); g.quadraticCurveTo(88, 10, 88, 40); g.lineTo(88, 94); g.closePath(); }, () => {
    g.strokeStyle = woodDark; g.lineWidth = 2;
    for (const x of [31, 50, 69]) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 96); g.stroke(); }
    g.fillStyle = woodLight; g.fillRect(14, 14, 5, 80);
  });
  rrect(g, 10, 40, 80, 8, 3); paint(g, '#8f8fa6', { w: lw * 0.8 });
  rrect(g, 10, 72, 80, 8, 3); paint(g, '#8f8fa6', { w: lw * 0.8 });
  circle(g, 74, 60, 3.6); paint(g, '#ffd45a', { w: lw * 0.7 });
  // a vine creeping over it
  g.strokeStyle = '#5fa84a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(14, 20); g.quadraticCurveTo(30, 30, 24, 50); g.stroke();
  for (const [x, y, a] of [[18, 24, 0.5], [26, 36, -0.4], [22, 48, 0.8]]) { g.save(); g.translate(x, y); g.rotate(a); ellipse(g, 0, 0, 5, 3); paint(g, '#7cc35a', { w: 1.4 }); g.restore(); }
};
P.doorOpen_forest = g => {
  shadow(g, 50, 92, 46, 5);
  g.beginPath(); g.moveTo(10, 94); g.lineTo(10, 26); g.quadraticCurveTo(14, 12, 26, 14); g.lineTo(26, 94); g.closePath(); paint(g, wood, { w: lw });
  g.beginPath(); g.moveTo(90, 94); g.lineTo(90, 26); g.quadraticCurveTo(86, 12, 76, 14); g.lineTo(76, 94); g.closePath(); paint(g, woodDark, { w: lw });
};
P.door_marsh = g => { // a curtain of reeds between two bamboo poles
  shadow(g, 50, 92, 46, 5);
  for (let k = 0; k < 9; k++) {
    const x = 18 + k * 8;
    g.beginPath(); g.moveTo(x - 3, 16); g.quadraticCurveTo(x - 4 + (k % 2) * 3, 60, x, 92); g.quadraticCurveTo(x + 4 - (k % 2) * 3, 60, x + 3, 16); g.closePath();
    paint(g, k % 2 ? '#a8c25e' : '#c6d77a', { w: 1.6 });
  }
  rrect(g, 10, 12, 80, 8, 4); paint(g, '#d9c27a', { w: lw });
  for (const x of [6, 82]) { rrect(g, x, 8, 12, 88, 5); paint(g, '#c6d77a', { w: lw }); g.strokeStyle = INK; g.lineWidth = 1.6; for (const y of [34, 62]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12, y); g.stroke(); } }
};
P.doorOpen_marsh = g => {
  shadow(g, 50, 92, 46, 5);
  for (const [x, s] of [[20, 1], [80, -1]]) for (let k = 0; k < 3; k++) {
    const xx = x + s * k * 5;
    g.beginPath(); g.moveTo(xx - 2.5, 16); g.quadraticCurveTo(xx + s * 4, 60, xx, 92); g.quadraticCurveTo(xx + s * 7, 60, xx + 2.5, 16); g.closePath(); paint(g, '#c6d77a', { w: 1.6 });
  }
  rrect(g, 10, 12, 80, 8, 4); paint(g, '#d9c27a', { w: lw });
  for (const x of [6, 82]) { rrect(g, x, 8, 12, 88, 5); paint(g, '#c6d77a', { w: lw }); }
};
P.door_rock = g => { // a stone slab with iron studs
  shadow(g, 50, 92, 46, 5);
  rrect(g, 10, 16, 80, 78, 10); paint(g, '#a8a2b8', { w: lw });
  within(g, () => rrect(g, 10, 16, 80, 78, 10), () => {
    g.fillStyle = '#c8c3d4'; g.fillRect(10, 16, 80, 8);
    g.strokeStyle = hexA(INK, 0.45); g.lineWidth = 1.8; g.beginPath(); g.moveTo(50, 24); g.lineTo(50, 94); g.stroke();
  });
  for (const [x, y] of [[22, 34], [78, 34], [22, 76], [78, 76]]) { circle(g, x, y, 3.2); paint(g, '#6f6c86', { w: 1.4 }); }
  rrect(g, 44, 50, 12, 14, 3); paint(g, '#ffd45a', { w: lw * 0.7 });
};
P.doorOpen_rock = g => {
  shadow(g, 50, 92, 46, 5);
  rrect(g, 8, 16, 16, 78, 6); paint(g, '#a8a2b8', { w: lw });
  rrect(g, 76, 16, 16, 78, 6); paint(g, '#8f88a4', { w: lw });
};
P.door_cave = g => { // a curtain of glowing moss between crystal posts
  shadow(g, 50, 92, 46, 5);
  for (let k = 0; k < 8; k++) {
    const x = 20 + k * 8.5;
    g.beginPath(); g.moveTo(x - 4, 14); g.quadraticCurveTo(x, 70, x + (k % 2 ? 2 : -2), 90); g.quadraticCurveTo(x + 2, 60, x + 4, 14); g.closePath(); paint(g, k % 2 ? '#62b89d' : '#8ed8bd', { w: 1.6 });
  }
  for (const x of [10, 90]) crystalPost(g, x);
};
P.doorOpen_cave = g => {
  shadow(g, 50, 92, 46, 5);
  for (const [x, s] of [[20, 1], [80, -1]]) { g.beginPath(); g.moveTo(x - 4, 14); g.quadraticCurveTo(x + s * 6, 60, x, 90); g.quadraticCurveTo(x + s * 10, 60, x + 4, 14); g.closePath(); paint(g, '#8ed8bd', { w: 1.6 }); }
  for (const x of [10, 90]) crystalPost(g, x);
};
function crystalPost(g, x) {
  g.beginPath(); g.moveTo(x - 7, 96); g.lineTo(x - 7, 22); g.lineTo(x, 8); g.lineTo(x + 7, 22); g.lineTo(x + 7, 96); g.closePath(); paint(g, '#8fd3f2', { w: lw });
  g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 7, 22); g.lineTo(x + 7, 96); g.lineTo(x, 96); g.closePath(); g.fillStyle = '#5aaed6'; g.fill();
  g.beginPath(); g.moveTo(x - 7, 96); g.lineTo(x - 7, 22); g.lineTo(x, 8); g.lineTo(x + 7, 22); g.lineTo(x + 7, 96); g.closePath(); paint(g, null, { w: lw });
}
P.doorLocked = g => {
  P.door(g);
  rrect(g, 38, 46, 24, 20, 5); paint(g, '#ffd45a', { w: lw });
  g.beginPath(); g.arc(50, 46, 7, Math.PI, 0); g.lineWidth = 3.4 + lw; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3.4; g.strokeStyle = '#c8cad6'; g.stroke();
  circle(g, 50, 55, 2.6); g.fillStyle = INK; g.fill(); g.fillRect(49, 55, 2, 6);
};

// ---------- burrows ----------
function hole(g, rx, ry, rim = '#c9905a') {
  ellipse(g, 50, 70, rx + 8, ry + 6); paint(g, rim, { w: lw });
  ellipse(g, 50, 72, rx, ry); paint(g, '#3a2440', { w: lw * 0.8 });
  ellipse(g, 50, 76, rx * 0.7, ry * 0.45); g.fillStyle = '#26172b'; g.fill();
}
// the way on: a burrow with a little flag beside it
P.stairs = g => {
  hole(g, 30, 15);
  g.strokeStyle = INK; g.lineWidth = 3 + lw; g.beginPath(); g.moveTo(78, 70); g.lineTo(78, 22); g.stroke();
  g.strokeStyle = '#e8dcc2'; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.moveTo(79, 22); g.quadraticCurveTo(92, 26, 96, 32); g.quadraticCurveTo(88, 36, 79, 40); g.closePath(); paint(g, '#ffd45a', { w: lw * 0.8 });
};
P.upStairs = g => hole(g, 26, 12, '#b5824f');

// ---------- traps ----------
P.trapSpike = g => { // a chestnut burr
  shadow(g, 50, 82, 22, 4);
  const pts = [];
  for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2, rr = k % 2 ? 15 : 22; pts.push([50 + Math.cos(a) * rr, 64 + Math.sin(a) * rr * 0.8]); }
  g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); paint(g, '#7cc35a', { w: lw * 0.75 });
  ellipse(g, 50, 64, 12, 9); g.fillStyle = '#9ad46e'; g.fill();
  ellipse(g, 52, 62, 6, 4.4); paint(g, '#a8693f', { w: 1.6 });
};
P.trapSleep = g => { // a sleepy purple flower, nodding
  g.strokeStyle = '#5fa84a'; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 90); g.quadraticCurveTo(46, 66, 58, 50); g.stroke();
  ellipse(g, 40, 76, 9, 4.5, -0.5); paint(g, '#7cc35a', { w: 1.6 });
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ellipse(g, 60 + Math.cos(a) * 8, 46 + Math.sin(a) * 8, 7, 7); paint(g, '#b49fdc', { w: 1.6 }); }
  circle(g, 60, 46, 5.4); paint(g, '#ffd45a', { w: 1.6 });
  g.fillStyle = 'rgba(217,200,242,0.9)'; for (const [x, y, r] of [[30, 30, 2.4], [24, 20, 1.8], [36, 18, 1.4]]) { circle(g, x, y, r); g.fill(); }
};
P.trapAlarm = g => { // a bell hanging from a little frame
  shadow(g, 50, 92, 26, 4);
  g.strokeStyle = INK; g.lineWidth = 3 + lw;
  g.beginPath(); g.moveTo(24, 92); g.lineTo(24, 30); g.lineTo(76, 30); g.lineTo(76, 92); g.stroke();
  g.strokeStyle = woodLight; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.moveTo(36, 72); g.quadraticCurveTo(36, 40, 50, 40); g.quadraticCurveTo(64, 40, 64, 72); g.closePath(); paint(g, '#ffd45a', { w: lw });
  rrect(g, 32, 70, 36, 7, 3); paint(g, '#e5ab2e', { w: lw * 0.8 });
  circle(g, 50, 80, 3.6); paint(g, '#e5ab2e', { w: 1.6 });
  g.fillStyle = 'rgba(255,255,255,0.7)'; ellipse(g, 44, 52, 2.6, 7); g.fill();
};
P.trapSummon = g => { // a dark burrow with eyes in it
  hole(g, 24, 12, '#a87b5a');
  for (const x of [43, 57]) { ellipse(g, x, 72, 2.4, 3); g.fillStyle = '#ffe58a'; g.fill(); }
};
P.trapOff = g => { // a trodden-flat patch
  ellipse(g, 50, 70, 24, 9); g.fillStyle = 'rgba(150,100,70,0.45)'; g.fill();
  for (const [x, y, a] of [[40, 68, 0.3], [56, 72, -0.4], [50, 64, 1.2]]) { g.save(); g.translate(x, y); g.rotate(a); rrect(g, -5, -1.6, 10, 3.2, 1.6); paint(g, '#a8693f', { w: 1.2 }); g.restore(); }
};

// ---------- water and wet ground ----------
P.drip = g => { // where a stalactite drips: a small puddle and a falling drop
  ellipse(g, 50, 78, 14, 5); paint(g, 'rgba(143,211,242,0.75)', { w: 1.6 });
  g.beginPath(); g.moveTo(50, 50); g.quadraticCurveTo(55, 58, 50, 62); g.quadraticCurveTo(45, 58, 50, 50); g.closePath(); paint(g, '#8fd3f2', { w: 1.6 });
};
P.fly = g => { // one firefly
  for (const s of [-1, 1]) { ellipse(g, 50 + s * 5, 44, 5, 3, s * -0.4); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill(); }
  circle(g, 50, 50, 4); paint(g, '#efff9a', { w: 1.4 });
};
const lily = (g, x, y, r, rot) => {
  g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, rot + 0.35, rot + Math.PI * 2 - 0.15); g.closePath();
  paint(g, '#7cc35a', { w: 1.8 });
  g.strokeStyle = '#5fa84a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(rot + 2) * r * 0.8, y + Math.sin(rot + 2) * r * 0.8); g.stroke();
};
P.lily0 = g => { lily(g, 44, 56, 16, 0.4); lily(g, 68, 74, 9, 2.4); };
P.lily1 = g => {
  lily(g, 48, 60, 17, -0.6);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ellipse(g, 50 + Math.cos(a) * 5, 52 + Math.sin(a) * 3.4, 5, 3, a); paint(g, '#f9b3c8', { w: 1.4 }); }
  circle(g, 50, 52, 3); paint(g, '#ffd45a', { w: 1.2 });
};
P.berry = g => { // a raspberry bush you can walk into
  shadow(g, 50, 92, 38, 6);
  bush(g, 50, 60, 36, 30, '#5cb85a', '#84d26a');
  g.fillStyle = C.red;
  for (const [x, y] of [[34, 52], [58, 44], [66, 64], [44, 70], [52, 58], [74, 50]]) { circle(g, x, y, 3.6); paint(g, '#e8555e', { w: 1.4 }); g.fillStyle = 'rgba(255,255,255,0.7)'; circle(g, x - 1, y - 1.2, 1); g.fill(); }
};
function bush(g, cx, cy, rx, ry, col, light) {
  const pts = [];
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 - Math.PI / 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  const path = () => {
    g.beginPath();
    pts.forEach((p, k) => {
      const q = pts[(k + 1) % pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = mx - cx, ny = my - cy, d = Math.hypot(nx, ny);
      if (!k) g.moveTo(...p);
      g.quadraticCurveTo(mx + nx / d * 7, my + ny / d * 7, ...q);
    });
    g.closePath();
  };
  path(); g.fillStyle = col; g.fill();
  within(g, path, () => {
    g.fillStyle = light; ellipse(g, cx - rx * 0.3, cy - ry * 0.35, rx * 0.5, ry * 0.4); g.fill();
    g.fillStyle = 'rgba(58,32,64,0.18)'; ellipse(g, cx + rx * 0.2, cy + ry * 0.9, rx, ry * 0.5); g.fill();
  });
  path(); paint(g, null, { w: lw });
}

// ---------- lone things standing in a room ----------
P.prop_meadow = g => { shadow(g, 50, 92, 38, 6); bush(g, 50, 60, 36, 30, '#5cb85a', '#84d26a'); flowerDot(g, 38, 50); flowerDot(g, 62, 64); };
function flowerDot(g, x, y) { for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; circle(g, x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.2); g.fillStyle = '#fff'; g.fill(); } circle(g, x, y, 1.8); g.fillStyle = '#ffd45a'; g.fill(); }
P.prop_forest = g => { // a stump with rings
  shadow(g, 50, 92, 36, 6);
  g.beginPath(); g.moveTo(18, 52); g.lineTo(18, 82); g.quadraticCurveTo(10, 92, 6, 92); g.lineTo(94, 92); g.quadraticCurveTo(90, 92, 82, 82); g.lineTo(82, 52); g.closePath();
  paint(g, wood, { w: lw });
  g.strokeStyle = hexA(INK, 0.4); g.lineWidth = 1.6; for (const x of [32, 50, 66]) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, 84); g.stroke(); }
  ellipse(g, 50, 52, 32, 12); paint(g, '#f2cf9a', { w: lw });
  g.strokeStyle = '#c99c64'; g.lineWidth = 1.6; ellipse(g, 50, 52, 20, 7); g.stroke(); ellipse(g, 50, 52, 9, 3.4); g.stroke();
  leafSprout(g, 74, 50);
};
function leafSprout(g, x, y) { g.strokeStyle = '#5fa84a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 8); g.stroke(); ellipse(g, x + 6, y - 10, 5, 2.8, -0.5); paint(g, '#7cc35a', { w: 1.4 }); }
P.prop_marsh = g => { // a reed clump with cattails
  shadow(g, 50, 92, 32, 5);
  for (let k = 0; k < 9; k++) {
    const x = 24 + k * 6.5, lean = (k - 4) * 2.4, h = 52 + ((k * 37) % 26);
    g.beginPath(); g.moveTo(x - 3, 92); g.quadraticCurveTo(x + lean * 0.4, 92 - h * 0.6, x + lean, 92 - h); g.quadraticCurveTo(x + lean * 0.4 + 2, 92 - h * 0.6, x + 3, 92); g.closePath();
    paint(g, k % 2 ? '#a8c25e' : '#c6d77a', { w: 1.6 });
  }
  for (const [x, y] of [[38, 30], [64, 38]]) { rrect(g, x - 3.6, y, 7.2, 16, 3.6); paint(g, '#9a6a48', { w: 1.6 }); }
};
P.prop_rock = g => { // a round boulder
  shadow(g, 50, 92, 38, 6);
  g.beginPath(); g.moveTo(12, 88); g.bezierCurveTo(6, 60, 26, 30, 52, 32); g.bezierCurveTo(80, 32, 96, 58, 90, 88); g.closePath();
  g.fillStyle = '#b5aec6'; g.fill();
  within(g, () => { g.beginPath(); g.moveTo(12, 88); g.bezierCurveTo(6, 60, 26, 30, 52, 32); g.bezierCurveTo(80, 32, 96, 58, 90, 88); g.closePath(); }, () => {
    g.fillStyle = '#d4cfde'; g.beginPath(); g.moveTo(22, 58); g.lineTo(44, 38); g.lineTo(58, 46); g.lineTo(40, 64); g.closePath(); g.fill();
    g.fillStyle = 'rgba(58,32,64,0.18)'; ellipse(g, 60, 92, 40, 14); g.fill();
  });
  g.beginPath(); g.moveTo(12, 88); g.bezierCurveTo(6, 60, 26, 30, 52, 32); g.bezierCurveTo(80, 32, 96, 58, 90, 88); g.closePath(); paint(g, null, { w: lw });
};
P.prop_cave = g => { // a stalagmite with a crystal
  shadow(g, 50, 92, 30, 5);
  g.beginPath(); g.moveTo(24, 92); g.quadraticCurveTo(40, 50, 50, 14); g.quadraticCurveTo(60, 50, 76, 92); g.closePath(); paint(g, '#7d73a3', { w: lw });
  g.fillStyle = '#9a90bd'; g.beginPath(); g.moveTo(34, 90); g.quadraticCurveTo(44, 54, 50, 20); g.quadraticCurveTo(46, 56, 44, 90); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(66, 90); g.lineTo(70, 74); g.lineTo(76, 70); g.lineTo(80, 78); g.lineTo(78, 92); g.closePath(); paint(g, '#8fd3f2', { w: 1.6 });
};
P.weed = g => { // the screaming root's leaves above its mound
  ellipse(g, 50, 84, 22, 8); paint(g, '#a8693f', { w: lw * 0.8 });
  for (const [a, l, col] of [[-0.9, 30, '#5fa84a'], [-0.3, 36, '#7cc35a'], [0.35, 34, '#6cb34f'], [0.95, 28, '#86c862']]) {
    g.save(); g.translate(50, 80); g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-9, -l * 0.6, 0, -l); g.quadraticCurveTo(9, -l * 0.6, 0, 0); g.closePath(); paint(g, col, { w: 1.8 });
    g.strokeStyle = hexA(INK, 0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -l + 6); g.stroke();
    g.restore();
  }
};
P.hive = g => skep(g, true);
P.hiveEmpty = g => skep(g, false);
function skep(g, honey) { // a straw beehive
  shadow(g, 50, 92, 32, 5);
  g.beginPath(); g.moveTo(20, 90); g.bezierCurveTo(14, 50, 30, 20, 50, 20); g.bezierCurveTo(70, 20, 86, 50, 80, 90); g.closePath();
  g.fillStyle = '#f2c46a'; g.fill();
  within(g, () => { g.beginPath(); g.moveTo(20, 90); g.bezierCurveTo(14, 50, 30, 20, 50, 20); g.bezierCurveTo(70, 20, 86, 50, 80, 90); g.closePath(); }, () => {
    g.strokeStyle = '#c9905a'; g.lineWidth = 2;
    for (const y of [36, 50, 64, 78]) { g.beginPath(); g.moveTo(10, y); g.quadraticCurveTo(50, y + 5, 90, y); g.stroke(); }
    g.fillStyle = 'rgba(58,32,64,0.15)'; ellipse(g, 70, 70, 20, 30); g.fill();
  });
  g.beginPath(); g.moveTo(20, 90); g.bezierCurveTo(14, 50, 30, 20, 50, 20); g.bezierCurveTo(70, 20, 86, 50, 80, 90); g.closePath(); paint(g, null, { w: lw });
  ellipse(g, 50, 78, 8, 6); paint(g, '#5a3a33', { w: lw * 0.7 });
  if (honey) { g.beginPath(); g.moveTo(58, 82); g.quadraticCurveTo(64, 84, 64, 92); g.quadraticCurveTo(60, 94, 60, 86); g.closePath(); paint(g, '#ffb02e', { w: 1.4 }); }
}
P.fairyRing = g => { // mushrooms in a ring
  const r = rng(5);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, x = 50 + Math.cos(a) * 32, y = 58 + Math.sin(a) * 22, s = 0.8 + r() * 0.3;
    rrect(g, x - 2.2 * s, y - 2, 4.4 * s, 7 * s, 2); paint(g, '#f6ecd8', { w: 1.4 });
    g.beginPath(); g.ellipse(x, y - 2, 6 * s, 4.6 * s, 0, Math.PI, 0); g.closePath(); paint(g, k % 2 ? '#e8555e' : '#f9b3c8', { w: 1.4 });
    g.fillStyle = '#fff'; circle(g, x - 1.5, y - 4, 1.1); g.fill();
  }
  g.fillStyle = 'rgba(255,240,180,0.6)'; for (const [x, y] of [[46, 54], [56, 62], [52, 48]]) { circle(g, x, y, 1.4); g.fill(); }
};
P.dug = g => {
  ellipse(g, 50, 70, 26, 11); paint(g, '#b5824f', { w: lw * 0.7 });
  for (const [x, y] of [[36, 64], [58, 74], [64, 64]]) { ellipse(g, x, y, 4, 2.6); g.fillStyle = '#8e5636'; g.fill(); }
};
P.anvil = g => {
  shadow(g, 50, 90, 30, 5);
  rrect(g, 36, 62, 28, 26, 3); paint(g, '#6f6c86', { w: lw });
  g.beginPath(); g.moveTo(14, 44); g.lineTo(86, 44); g.quadraticCurveTo(90, 56, 74, 60); g.lineTo(28, 60); g.quadraticCurveTo(10, 56, 14, 44); g.closePath(); paint(g, '#8f8fa6', { w: lw });
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(22, 46, 50, 3);
};
P.ash = g => {
  for (const [x, y, rx] of [[40, 60, 14], [62, 70, 10], [46, 78, 8]]) { ellipse(g, x, y, rx, rx * 0.5); g.fillStyle = 'rgba(70,60,80,0.45)'; g.fill(); }
  g.fillStyle = '#ffb02e'; for (const [x, y] of [[44, 62], [60, 70]]) { circle(g, x, y, 1.6); g.fill(); }
};
P.vent = g => { // marsh mud with bubbles
  ellipse(g, 50, 72, 22, 9); paint(g, '#7a8a52', { w: lw * 0.7 });
  for (const [x, y, r] of [[44, 66, 4], [56, 70, 3], [50, 54, 2.6], [58, 44, 2]]) { circle(g, x, y, r); paint(g, 'rgba(200,240,250,0.8)', { w: 1.4 }); }
};
P.grave = g => { // a heap of earth with a sprout (someone buried their acorns)
  shadow(g, 50, 88, 26, 4);
  g.beginPath(); g.moveTo(22, 86); g.quadraticCurveTo(30, 58, 50, 58); g.quadraticCurveTo(70, 58, 78, 86); g.closePath(); paint(g, '#b5824f', { w: lw });
  leafSprout(g, 50, 60);
};
P.graveBig = g => { // a hollow stump
  shadow(g, 50, 92, 40, 6);
  g.beginPath(); g.moveTo(14, 92); g.lineTo(18, 30); g.quadraticCurveTo(50, 18, 82, 30); g.lineTo(86, 92); g.closePath(); paint(g, wood, { w: lw });
  ellipse(g, 50, 30, 32, 9); paint(g, '#f2cf9a', { w: lw });
  g.beginPath(); g.moveTo(38, 92); g.lineTo(38, 66); g.quadraticCurveTo(50, 54, 62, 66); g.lineTo(62, 92); g.closePath(); paint(g, '#3a2440', { w: lw });
};
P.bigOre = g => {
  shadow(g, 50, 92, 38, 6);
  P.prop_rock(g);
};

// the jar of fireflies hung on a wall
P.lamp = g => {
  g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.moveTo(50, 2); g.lineTo(50, 14); g.stroke();
  rrect(g, 36, 12, 28, 6, 3); paint(g, wood, { w: lw * 0.8 });
  g.beginPath(); g.moveTo(36, 18); g.lineTo(64, 18); g.quadraticCurveTo(70, 34, 64, 50); g.quadraticCurveTo(50, 56, 36, 50); g.quadraticCurveTo(30, 34, 36, 18); g.closePath();
  paint(g, 'rgba(220,250,190,0.85)', { w: lw });
  g.fillStyle = '#efff9a'; for (const [x, y] of [[44, 32], [55, 40], [52, 26]]) { circle(g, x, y, 3.2); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.8)'; ellipse(g, 40, 28, 2, 6); g.fill();
};

export const PROPS = P;
