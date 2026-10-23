// The critters of the fields, drawn like plush toys (Nagano's Pokémon drawings were the brief): round
// bodies, dot eyes, pink cheeks. Their threat shows in a frown, a colour or a prop, never in fangs and
// claws. They look right (Phaser flips them), in the same 0-100 tile box as the heroes.

import { INK, LW, C, ellipse, circle, paint, within, mix, hexA, curve, rng } from './ink.js';

const EYE = C.eye;
const ground = (g, rx = 30, x = 50) => { ellipse(g, x, 93, rx, 4.6); g.fillStyle = 'rgba(58,32,64,0.2)'; g.fill(); };

// fill a shape, shade its back and bottom, outline it
function body(g, path, col, { shadeCol = '#d9c6d6', sx = 6, sy = -4, cx = 50, cy = 60, rx = 30, ry = 26, marks } = {}) {
  path(); g.fillStyle = col; g.fill();
  within(g, path, () => {
    marks?.();
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.beginPath(); g.rect(-20, -20, 140, 140); g.ellipse(cx + sx, cy + sy, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = shadeCol; g.fill('evenodd');
    g.restore();
  });
  path(); paint(g, null);
}

// two dot eyes, cheeks and a little mouth; `brow` frowns (-1) or worries (1)
function face(g, x, y, { gap = 10, brow = 0, eye = EYE, blush = true, mouth = 'smile', big = 1, cheekCol } = {}) {
  const xs = [x - gap / 2, x + gap / 2];
  if (blush) {
    g.fillStyle = cheekCol || 'rgba(245,128,158,0.6)';
    ellipse(g, xs[0] - 5, y + 5.4, 3.8, 2.3); g.fill(); ellipse(g, xs[1] + 5, y + 5.4, 4, 2.4); g.fill();
  }
  for (const ex of xs) {
    ellipse(g, ex, y, 2.6 * big, 3.5 * big); g.fillStyle = eye; g.fill();
    g.fillStyle = '#fff'; circle(g, ex + 0.9 * big, y - 1.3 * big, 1 * big); g.fill();
  }
  if (brow) {
    g.strokeStyle = eye; g.lineWidth = 2; g.lineCap = 'round';
    for (const [ex, s] of [[xs[0], -1], [xs[1], 1]]) {
      g.beginPath();
      g.moveTo(ex - 3.4, y - 5.6 + (brow < 0 ? -1.6 * s : 1.4 * s) * -1);
      g.lineTo(ex + 3.4, y - 5.6 + (brow < 0 ? 1.6 * s : -1.4 * s) * -1);
      g.stroke();
    }
  }
  const mx = (xs[0] + xs[1]) / 2, my = y + 5.6;
  g.strokeStyle = eye; g.lineWidth = 1.9; g.lineCap = 'round';
  if (mouth === 'smile') { g.beginPath(); g.moveTo(mx - 2.6, my); g.quadraticCurveTo(mx, my + 2.8, mx + 2.6, my); g.stroke(); }
  else if (mouth === 'flat') { g.beginPath(); g.moveTo(mx - 2.4, my + 0.8); g.lineTo(mx + 2.4, my + 0.8); g.stroke(); }
  else if (mouth === 'grr') { g.beginPath(); g.moveTo(mx - 3, my + 1.6); g.quadraticCurveTo(mx, my - 1, mx + 3, my + 1.6); g.stroke(); }
  else if (mouth === 'open') {
    g.beginPath(); g.ellipse(mx, my + 1.6, 2.8, 3.2, 0, 0, Math.PI * 2); g.fillStyle = '#7a3348'; g.fill(); g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.ellipse(mx, my + 3, 1.8, 1.4, 0, 0, Math.PI * 2); g.fillStyle = C.tongue; g.fill();
  }
}

const tube = (g, pts, w, col) => {
  curve(g, pts); g.lineWidth = w + LW * 2; g.strokeStyle = INK; g.stroke();
  curve(g, pts); g.lineWidth = w; g.strokeStyle = col; g.stroke();
};
const feetPair = (g, xs, y, col, rx = 6.5, ry = 4.6) => xs.forEach(x => { ellipse(g, x, y, rx, ry); paint(g, col); });

const K = {};

K.rat = (g, o = {}) => {
  const col = o.col || '#bdbccc';
  ground(g, 30);
  tube(g, [[24, 80], [12, 76], [8, 64], [14, 56]], 3.2, '#f4a7b9');
  feetPair(g, [36, 64], 91, '#f4a7b9', 5.5, 3.8);
  // ears
  for (const [x, y, r] of [[52, 36, 9.5], [70, 34, 10.5]]) { circle(g, x, y, r); paint(g, col); circle(g, x, y + 1, r * 0.55); g.fillStyle = C.pink; g.fill(); }
  const path = () => { g.beginPath(); g.moveTo(22, 82); g.bezierCurveTo(16, 56, 40, 40, 62, 42); g.bezierCurveTo(78, 42, 92, 56, 92, 70); g.bezierCurveTo(92, 82, 82, 88, 64, 88); g.bezierCurveTo(44, 90, 26, 90, 22, 82); g.closePath(); };
  body(g, path, col, { cx: 58, cy: 62, rx: 34, ry: 24, marks: () => { ellipse(g, 74, 76, 16, 10); g.fillStyle = '#f2eee8'; g.fill(); } });
  ellipse(g, 92, 70, 3.4, 2.8); paint(g, C.pink, { w: 1.6 });
  face(g, 74, 60, { gap: 11, brow: o.brow ?? 0, mouth: o.mouth || 'smile' });
  g.strokeStyle = hexA(INK, 0.6); g.lineWidth = 1.2; for (const dy of [-2, 2]) { g.beginPath(); g.moveTo(88, 70 + dy); g.lineTo(98, 68 + dy * 2); g.stroke(); }
};
K.thief = g => {
  K.rat(g, { col: '#c9c4d6', brow: -1, mouth: 'smile' });
  // a pink ribbon held up proudly
  const x = 60, y = 80;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 9, y - 6); g.lineTo(x + s * 9, y + 6); g.closePath(); paint(g, '#f4a7c8', { w: LW * 0.7 }); }
  circle(g, x, y, 3); paint(g, '#f4a7c8', { w: LW * 0.7 });
  // a bandit's mask band
  g.fillStyle = 'rgba(74,61,79,0.55)'; g.beginPath(); g.roundRect(64, 55, 22, 7, 3.5); g.fill();
};
K.wraith = g => { // an angry squirrel
  ground(g, 28);
  tail(g, '#a8a4b8', '#d8d4e4');
  const col = '#b8b4c8';
  for (const x of [56, 72]) { g.beginPath(); g.moveTo(x - 6, 40); g.lineTo(x, 24); g.lineTo(x + 6, 40); g.closePath(); paint(g, col); }
  const path = () => { g.beginPath(); g.ellipse(64, 64, 24, 27, 0, 0, Math.PI * 2); };
  body(g, path, col, { cx: 66, cy: 60, rx: 24, ry: 26, marks: () => { ellipse(g, 68, 78, 14, 12); g.fillStyle = '#f2eee8'; g.fill(); } });
  face(g, 68, 60, { gap: 12, brow: -1, mouth: 'grr', cheekCol: 'rgba(232,85,94,0.7)' });
  // an anger mark
  g.strokeStyle = C.red; g.lineWidth = 2.4;
  const ax = 84, ay = 36;
  for (const [a, b] of [[[-3, -1], [-1, -3]], [[1, -3], [3, -1]], [[3, 1], [1, 3]], [[-1, 3], [-3, 1]]]) { g.beginPath(); g.moveTo(ax + a[0] * 1.6, ay + a[1] * 1.6); g.quadraticCurveTo(ax, ay, ax + b[0] * 1.6, ay + b[1] * 1.6); g.stroke(); }
  feetPair(g, [54, 76], 91, col);
};
function tail(g, col, light) {
  const path = () => { g.beginPath(); g.moveTo(46, 86); g.bezierCurveTo(18, 90, 8, 60, 20, 36); g.bezierCurveTo(26, 22, 44, 24, 42, 38); g.bezierCurveTo(40, 50, 30, 52, 36, 66); g.bezierCurveTo(40, 74, 48, 76, 50, 80); g.closePath(); };
  path(); g.fillStyle = col; g.fill();
  within(g, path, () => { g.fillStyle = light; ellipse(g, 28, 40, 9, 12); g.fill(); });
  path(); paint(g, null);
}
K.goblin = g => { // an acorn squirrel with an acorn-cap hat
  ground(g, 28);
  tail(g, '#c9783e', '#e8a36a');
  const col = '#e08a4a';
  for (const x of [58, 74]) { g.beginPath(); g.moveTo(x - 6, 42); g.lineTo(x, 28); g.lineTo(x + 6, 42); g.closePath(); paint(g, col); }
  const path = () => { g.beginPath(); g.ellipse(64, 66, 24, 25, 0, 0, Math.PI * 2); };
  body(g, path, col, { cx: 66, cy: 62, rx: 24, ry: 24, marks: () => { ellipse(g, 70, 80, 14, 11); g.fillStyle = '#fbeedb'; g.fill(); } });
  face(g, 70, 62, { gap: 12, brow: -1, mouth: 'smile' });
  // the acorn cap, worn at an angle
  g.beginPath(); g.ellipse(66, 42, 15, 8, -0.2, Math.PI, 0); g.closePath(); paint(g, '#a8693f');
  g.strokeStyle = hexA(INK, 0.45); g.lineWidth = 1.2; for (const x of [58, 64, 70]) { g.beginPath(); g.moveTo(x, 36); g.lineTo(x + 3, 41); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(66, 34); g.lineTo(68, 29); g.stroke();
  // and an acorn hugged to its chest
  ellipse(g, 80, 80, 6, 7); paint(g, '#c98a55', { w: LW * 0.8 });
  g.beginPath(); g.ellipse(80, 75, 6.6, 3.6, 0, Math.PI, 0); g.closePath(); paint(g, '#8e5636', { w: LW * 0.8 });
  feetPair(g, [56, 76], 91, col);
};
K.slime = g => {
  ground(g, 32);
  const path = () => { g.beginPath(); g.moveTo(16, 90); g.bezierCurveTo(12, 70, 30, 54, 44, 44); g.bezierCurveTo(52, 38, 50, 30, 54, 28); g.bezierCurveTo(60, 36, 66, 42, 76, 52); g.bezierCurveTo(90, 64, 92, 82, 84, 90); g.closePath(); };
  body(g, path, '#8fd36a', { shadeCol: '#cfe0c0', cx: 56, cy: 62, rx: 34, ry: 26 });
  g.fillStyle = 'rgba(255,255,255,0.75)'; ellipse(g, 36, 62, 4, 8, 0.4); g.fill(); circle(g, 42, 52, 2.2); g.fill();
  face(g, 60, 70, { gap: 13, mouth: 'smile' });
};
K.bat = (g, o = {}) => {
  const col = o.col || '#a08ad4', wing = o.wing || '#7a62b8';
  ground(g, 22);
  for (const s of [-1, 1]) {
    const x = 50 + s * 18;
    g.beginPath(); g.moveTo(x - s * 4, 54);
    g.quadraticCurveTo(x + s * 16, 30, x + s * 28, 40);
    g.quadraticCurveTo(x + s * 22, 48, x + s * 24, 58);
    g.quadraticCurveTo(x + s * 17, 54, x + s * 14, 64);
    g.quadraticCurveTo(x + s * 10, 58, x - s * 2, 66);
    g.closePath(); paint(g, wing);
  }
  for (const x of [40, 60]) { g.beginPath(); g.moveTo(x - 7, 46); g.lineTo(x + (x < 50 ? -4 : 4), 26); g.lineTo(x + 7, 44); g.closePath(); paint(g, col); }
  const path = () => { g.beginPath(); g.ellipse(50, 58, 21, 19, 0, 0, Math.PI * 2); };
  body(g, path, col, { cx: 52, cy: 56, rx: 20, ry: 18 });
  face(g, 52, 56, { gap: 12, brow: o.brow ?? -1, mouth: 'smile' });
  g.fillStyle = '#fff'; for (const x of [50, 55]) { g.beginPath(); g.moveTo(x - 1.2, 62); g.lineTo(x, 65); g.lineTo(x + 1.2, 62); g.closePath(); g.fill(); }
};
K.vampLord = g => {
  // the bat king: deeper colours, a red cape behind
  g.beginPath(); g.moveTo(30, 50); g.quadraticCurveTo(20, 80, 26, 92); g.lineTo(74, 92); g.quadraticCurveTo(80, 80, 70, 50); g.closePath(); paint(g, '#c83a4e');
  K.bat(g, { col: '#8a6cc0', wing: '#5a3f8f', brow: -1 });
  g.beginPath(); g.moveTo(34, 68); g.quadraticCurveTo(50, 78, 66, 68); g.lineTo(62, 74); g.quadraticCurveTo(50, 82, 38, 74); g.closePath(); paint(g, '#c83a4e', { w: LW * 0.8 });
  circle(g, 50, 76, 3); paint(g, C.gold, { w: LW * 0.6 });
};
K.skel = g => { // a cross toadstool
  ground(g, 26);
  feetPair(g, [40, 60], 91, '#f6ecd8');
  const stalk = () => { g.beginPath(); g.moveTo(30, 88); g.bezierCurveTo(28, 66, 34, 54, 50, 54); g.bezierCurveTo(66, 54, 72, 66, 70, 88); g.quadraticCurveTo(50, 94, 30, 88); g.closePath(); };
  body(g, stalk, '#f6ecd8', { cx: 54, cy: 70, rx: 22, ry: 18 });
  face(g, 54, 72, { gap: 13, brow: -1, mouth: 'grr' });
  const cap = () => { g.beginPath(); g.moveTo(10, 56); g.bezierCurveTo(10, 22, 34, 12, 50, 12); g.bezierCurveTo(66, 12, 90, 22, 90, 56); g.quadraticCurveTo(50, 64, 10, 56); g.closePath(); };
  body(g, cap, '#a77fd8', { cx: 56, cy: 32, rx: 40, ry: 24, marks: () => { g.fillStyle = '#fbf6ee'; for (const [x, y, r] of [[30, 34, 6], [52, 22, 5], [70, 36, 6.5], [44, 46, 3.6], [80, 50, 3]]) { circle(g, x, y, r); g.fill(); } } });
};
K.spider = g => {
  ground(g, 30);
  const col = '#6a5a8e';
  g.strokeStyle = INK; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
    const x0 = 50 + s * 12, y0 = 66 + k * 4, x1 = 50 + s * (28 + k * 3), y1 = 60 + k * 6;
    tube(g, [[x0, y0], [x1, y1 - 10], [x1 + s * 3, y1 + 12]], 3.4, col);
  }
  const path = () => { g.beginPath(); g.ellipse(50, 64, 24, 21, 0, 0, Math.PI * 2); };
  body(g, path, col, { shadeCol: '#cdc3dc', cx: 52, cy: 60, rx: 23, ry: 20, marks: () => { g.fillStyle = '#8a78b0'; circle(g, 40, 50, 8); g.fill(); } });
  face(g, 54, 64, { gap: 12, brow: -1, mouth: 'smile', eye: '#2a1830' });
  g.fillStyle = '#2a1830'; for (const x of [49, 59]) { circle(g, x, 55, 1.5); g.fill(); }
};
K.knight = (g, o = {}) => { // a boar
  ground(g, 34);
  const col = o.col || '#a8714a';
  feetPair(g, [30, 48, 66, 80], 91, '#7a4a32', 5, 4);
  const path = () => { g.beginPath(); g.moveTo(14, 78); g.bezierCurveTo(10, 50, 34, 36, 58, 38); g.bezierCurveTo(80, 40, 92, 54, 92, 70); g.bezierCurveTo(92, 84, 80, 90, 56, 90); g.bezierCurveTo(30, 90, 16, 88, 14, 78); g.closePath(); };
  body(g, path, col, { shadeCol: '#dcc0c0', cx: 58, cy: 60, rx: 36, ry: 26 });
  // the bristly ridge along its back
  g.beginPath(); g.moveTo(26, 46); for (let k = 0; k < 7; k++) { g.lineTo(30 + k * 7, 36 - (k % 2) * 6); } g.lineTo(76, 42); g.closePath(); paint(g, o.ridge || '#6e4232', { w: LW * 0.8 });
  g.beginPath(); g.moveTo(66, 44); g.lineTo(74, 32); g.lineTo(78, 46); g.closePath(); paint(g, col);
  ellipse(g, 90, 70, 7, 6.5); paint(g, '#e8a7a0');
  g.fillStyle = INK; for (const y of [68, 72]) { circle(g, 90, y, 1.2); g.fill(); }
  // small white tusks
  g.beginPath(); g.moveTo(84, 78); g.quadraticCurveTo(88, 74, 90, 80); g.quadraticCurveTo(86, 82, 84, 78); g.closePath(); paint(g, '#fbf6ee', { w: 1.6 });
  face(g, 74, 60, { gap: 10, brow: -1, mouth: 'flat' });
  if (o.paint) { g.strokeStyle = C.red; g.lineWidth = 2.4; for (const dx of [0, 5]) { g.beginPath(); g.moveTo(58 + dx, 66); g.lineTo(62 + dx, 76); g.stroke(); } }
};
K.boarchief = g => {
  K.knight(g, { col: '#8e5636', ridge: '#4a2e26', paint: true });
  // a leaf headband
  g.beginPath(); g.moveTo(52, 48); g.quadraticCurveTo(70, 42, 88, 52); g.lineWidth = 4 + LW; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#5fa84a'; g.stroke();
};
K.wizard = g => { // a fox with a will-o'-the-wisp
  ground(g, 30);
  const col = '#f08a4b';
  const t = () => { g.beginPath(); g.moveTo(40, 84); g.bezierCurveTo(14, 86, 6, 60, 16, 44); g.bezierCurveTo(24, 50, 28, 62, 44, 70); g.closePath(); };
  t(); g.fillStyle = col; g.fill(); within(g, t, () => { g.fillStyle = '#fbf6ee'; circle(g, 15, 46, 9); g.fill(); }); t(); paint(g, null);
  for (const x of [56, 74]) { g.beginPath(); g.moveTo(x - 7, 46); g.lineTo(x + 1, 26); g.lineTo(x + 7, 44); g.closePath(); paint(g, col); g.beginPath(); g.moveTo(x - 3, 42); g.lineTo(x + 1, 32); g.lineTo(x + 3.5, 42); g.closePath(); g.fillStyle = '#5a3a33'; g.fill(); }
  const path = () => { g.beginPath(); g.ellipse(62, 66, 26, 24, 0, 0, Math.PI * 2); };
  body(g, path, col, { shadeCol: '#e9c0c8', cx: 64, cy: 62, rx: 26, ry: 22, marks: () => { ellipse(g, 70, 80, 18, 12); g.fillStyle = '#fbf6ee'; g.fill(); } });
  // sly, half-shut eyes
  g.strokeStyle = EYE; g.lineWidth = 2.4;
  for (const x of [64, 76]) { g.beginPath(); g.moveTo(x - 3.4, 62); g.quadraticCurveTo(x, 59, x + 3.4, 62); g.stroke(); }
  g.fillStyle = 'rgba(245,128,158,0.6)'; ellipse(g, 58, 67, 3.6, 2.2); g.fill(); ellipse(g, 82, 67, 3.6, 2.2); g.fill();
  g.beginPath(); g.moveTo(68, 68); g.quadraticCurveTo(70, 71, 72, 68); g.stroke();
  // the foxfire
  g.beginPath(); g.moveTo(90, 50); g.quadraticCurveTo(98, 40, 92, 26); g.quadraticCurveTo(90, 34, 84, 36); g.quadraticCurveTo(80, 44, 90, 50); g.closePath(); paint(g, '#8fd3f2', { w: LW * 0.7 });
  g.fillStyle = '#e6f8ff'; ellipse(g, 89, 42, 2.4, 4); g.fill();
};
K.garg = g => { // a pill bug
  ground(g, 34);
  for (let k = 0; k < 5; k++) { g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(26 + k * 11, 86); g.lineTo(24 + k * 11, 92); g.stroke(); }
  const path = () => { g.beginPath(); g.moveTo(10, 88); g.bezierCurveTo(10, 50, 34, 34, 54, 34); g.bezierCurveTo(78, 34, 94, 56, 92, 88); g.closePath(); };
  body(g, path, '#8f8fa6', { shadeCol: '#d4cfe0', cx: 56, cy: 58, rx: 36, ry: 24, marks: () => {
    g.strokeStyle = hexA(INK, 0.6); g.lineWidth = 2;
    for (const x of [26, 40, 54, 68]) { g.beginPath(); g.moveTo(x, 90); g.quadraticCurveTo(x + 2, 50, x + 10, 34); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.4)'; ellipse(g, 40, 44, 14, 4, -0.3); g.fill();
  } });
  for (const [x, a] of [[86, -0.5], [90, -0.2]]) { g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, 56); g.quadraticCurveTo(x + 2, 46, x + 8 + a * 4, 42); g.stroke(); }
  face(g, 80, 70, { gap: 9, brow: -1, mouth: 'flat' });
};
K.frog = (g, o = {}) => {
  ground(g, 32);
  const col = o.col || '#8fd06a';
  feetPair(g, [28, 74], 90, col, 9, 5);
  for (const x of [40, 64]) { circle(g, x, 46, 11); paint(g, col); }
  const path = () => { g.beginPath(); g.moveTo(14, 82); g.bezierCurveTo(12, 56, 30, 46, 52, 46); g.bezierCurveTo(74, 46, 90, 56, 88, 82); g.quadraticCurveTo(50, 94, 14, 82); g.closePath(); };
  body(g, path, col, { shadeCol: '#cfd9c4', cx: 54, cy: 64, rx: 36, ry: 22, marks: () => { ellipse(g, 54, 84, 24, 10); g.fillStyle = '#eef5c4'; g.fill(); if (o.warts) { g.fillStyle = hexA(INK, 0.18); for (const [x, y] of [[26, 66], [34, 58], [74, 62], [80, 72]]) { circle(g, x, y, 2.4); g.fill(); } } } });
  for (const x of [40, 64]) { circle(g, x, 46, 7.4); g.fillStyle = '#fff'; g.fill(); circle(g, x + 1, 47, 3.6); g.fillStyle = EYE; g.fill(); g.fillStyle = '#fff'; circle(g, x + 2, 45.6, 1.1); g.fill(); }
  if (o.brow ?? true) { g.strokeStyle = EYE; g.lineWidth = 2.2; g.beginPath(); g.moveTo(34, 36); g.lineTo(44, 39); g.moveTo(70, 36); g.lineTo(60, 39); g.stroke(); }
  g.fillStyle = 'rgba(245,128,158,0.6)'; ellipse(g, 30, 66, 4.4, 2.6); g.fill(); ellipse(g, 76, 66, 4.4, 2.6); g.fill();
  g.strokeStyle = EYE; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 66); g.quadraticCurveTo(52, 72, 64, 66); g.stroke();
};
K.toadking = g => {
  K.frog(g, { col: '#5aa85a', warts: true });
  // a lily pad worn as a mantle on its back
  g.beginPath(); g.moveTo(16, 60); g.arc(20, 72, 12, Math.PI * 1.2, Math.PI * 2.3); g.closePath(); paint(g, '#8fd06a', { w: LW * 0.8 });
};
K.beetle = g => { // a diving beetle
  ground(g, 32);
  for (const [x, s] of [[30, -1], [50, -1], [70, 1]]) { g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x, 82); g.quadraticCurveTo(x + s * 6, 88, x + s * 10, 90); g.stroke(); }
  const path = () => { g.beginPath(); g.ellipse(48, 66, 34, 22, 0, 0, Math.PI * 2); };
  body(g, path, '#3f8a6a', { shadeCol: '#c6d6d0', cx: 50, cy: 62, rx: 34, ry: 20, marks: () => {
    g.strokeStyle = '#ffd45a'; g.lineWidth = 4; g.beginPath(); g.ellipse(48, 66, 34, 22, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = hexA(INK, 0.5); g.lineWidth = 1.8; g.beginPath(); g.moveTo(40, 46); g.quadraticCurveTo(44, 66, 40, 88); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(g, 30, 56, 10, 4, -0.4); g.fill();
  } });
  const head = () => { g.beginPath(); g.ellipse(80, 64, 13, 12, 0, 0, Math.PI * 2); };
  body(g, head, '#4f9a78', { cx: 82, cy: 62, rx: 12, ry: 11 });
  face(g, 82, 62, { gap: 8, brow: -1, mouth: 'flat', blush: false });
};
K.crab = g => {
  ground(g, 34);
  const col = '#e8555e';
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.moveTo(50 + s * (14 + k * 5), 80); g.lineTo(50 + s * (24 + k * 6), 90); g.stroke(); }
  for (const s of [-1, 1]) {
    tube(g, [[50 + s * 20, 70], [50 + s * 30, 58], [50 + s * 30, 44]], 4, col);
    g.beginPath(); g.moveTo(50 + s * 30, 46); g.arc(50 + s * 30, 38, 9, Math.PI * 0.5, Math.PI * 2.1); g.closePath(); paint(g, col);
    g.beginPath(); g.moveTo(50 + s * 30, 38); g.lineTo(50 + s * 38, 34); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  }
  for (const x of [42, 58]) { tube(g, [[x, 60], [x, 50]], 2.4, col); circle(g, x, 48, 4.6); paint(g, '#fff', { w: 1.6 }); circle(g, x + 0.8, 48.5, 2.2); g.fillStyle = EYE; g.fill(); }
  const path = () => { g.beginPath(); g.ellipse(50, 72, 28, 16, 0, 0, Math.PI * 2); };
  body(g, path, col, { shadeCol: '#e3c3c8', cx: 52, cy: 68, rx: 28, ry: 15 });
  g.fillStyle = 'rgba(245,170,190,0.7)'; ellipse(g, 36, 74, 4, 2.4); g.fill(); ellipse(g, 64, 74, 4, 2.4); g.fill();
  g.strokeStyle = EYE; g.lineWidth = 2; g.beginPath(); g.moveTo(46, 74); g.quadraticCurveTo(50, 77, 54, 74); g.stroke();
};
K.axolotl = g => {
  ground(g, 30);
  const col = '#f6b3c8';
  tube(g, [[30, 78], [16, 76], [10, 66]], 6, col);
  feetPair(g, [36, 70], 90, col, 5, 4);
  // frilly gills
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = 60 + s * 24, y = 46 + k * 9;
    g.beginPath(); g.ellipse(x + s * 6, y, 7, 3, s * (0.3 - k * 0.3), 0, Math.PI * 2); paint(g, '#e8738c', { w: LW * 0.7 });
  }
  const path = () => { g.beginPath(); g.ellipse(58, 66, 26, 23, 0, 0, Math.PI * 2); };
  body(g, path, col, { shadeCol: '#e6cbd6', cx: 60, cy: 62, rx: 26, ry: 22 });
  face(g, 62, 64, { gap: 14, mouth: 'smile', cheekCol: 'rgba(232,115,140,0.6)' });
};
K.shadecat = g => {
  ground(g, 30);
  const col = '#4a3f66';
  tube(g, [[34, 82], [20, 76], [16, 62], [22, 52]], 4, col);
  for (const x of [52, 72]) { g.beginPath(); g.moveTo(x - 8, 46); g.lineTo(x, 26); g.lineTo(x + 8, 44); g.closePath(); paint(g, col); }
  const path = () => { g.beginPath(); g.ellipse(60, 66, 28, 25, 0, 0, Math.PI * 2); };
  body(g, path, col, { shadeCol: '#c9c2d8', cx: 62, cy: 62, rx: 28, ry: 23 });
  // glowing eyes in the dark
  for (const x of [56, 72]) { ellipse(g, x, 62, 4, 4.6); g.fillStyle = '#ffe58a'; g.fill(); ellipse(g, x, 62, 1.3, 3.6); g.fillStyle = '#2a1830'; g.fill(); }
  g.strokeStyle = '#ffe8c8'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(61, 71); g.quadraticCurveTo(64, 73, 67, 71); g.stroke();
  // wisps of shadow trailing off
  g.fillStyle = 'rgba(74,63,102,0.5)'; for (const [x, y, r] of [[24, 84, 5], [16, 80, 3.4], [10, 72, 2.2]]) { circle(g, x, y, r); g.fill(); }
};
K.crystalhog = g => {
  ground(g, 32);
  // crystal spines: blue shards fanned over the back
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (1.05 + k * 0.12), x = 46 + Math.cos(a) * 26, y = 66 + Math.sin(a) * 26;
    const tx = 46 + Math.cos(a) * 44, ty = 66 + Math.sin(a) * 40;
    g.beginPath(); g.moveTo(x - 6 * Math.sin(a), y + 6 * Math.cos(a)); g.lineTo(tx, ty); g.lineTo(x + 6 * Math.sin(a), y - 6 * Math.cos(a)); g.closePath(); paint(g, k % 2 ? '#8fd3f2' : '#b8e6fa', { w: LW * 0.7 });
  }
  feetPair(g, [40, 66], 91, '#c9a88a', 5, 4);
  const path = () => { g.beginPath(); g.ellipse(54, 70, 28, 20, 0, 0, Math.PI * 2); };
  body(g, path, '#e8d2b8', { shadeCol: '#ddc8cc', cx: 56, cy: 66, rx: 28, ry: 18 });
  ellipse(g, 82, 74, 3.4, 2.8); paint(g, EYE, { w: 1.2 });
  face(g, 68, 68, { gap: 10, brow: -1, mouth: 'smile' });
};
K.turtle = g => { // a turtle with a glittering shell (it carries treasure)
  ground(g, 34);
  feetPair(g, [30, 70], 90, '#a8dc8a', 7, 5);
  const head = () => { g.beginPath(); g.ellipse(80, 64, 13, 12, 0, 0, Math.PI * 2); };
  body(g, head, '#a8dc8a', { cx: 82, cy: 62, rx: 12, ry: 11 });
  face(g, 82, 64, { gap: 8, mouth: 'smile' });
  const shell = () => { g.beginPath(); g.moveTo(12, 84); g.bezierCurveTo(12, 46, 34, 38, 46, 38); g.bezierCurveTo(60, 38, 76, 48, 76, 84); g.closePath(); };
  body(g, shell, '#e5ab2e', { shadeCol: '#e8d0b0', cx: 46, cy: 58, rx: 32, ry: 22, marks: () => {
    g.strokeStyle = hexA(INK, 0.5); g.lineWidth = 2;
    for (const [x, y] of [[30, 64], [48, 54], [62, 68], [44, 76]]) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 6); } g.closePath(); g.stroke(); }
    g.fillStyle = '#fff6c8'; for (const [x, y] of [[26, 58], [52, 48], [60, 74]]) { circle(g, x, y, 2); g.fill(); }
  } });
};
K.mimic = g => { // a hermit crab living in a treasure chest
  ground(g, 34);
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { g.strokeStyle = INK; g.lineWidth = 2.8; g.beginPath(); g.moveTo(50 + s * (22 + k * 6), 84); g.lineTo(50 + s * (30 + k * 6), 92); g.stroke(); }
  chestShape(g, '#c98a55', '#ffd45a', 0.35);
  for (const x of [42, 58]) { g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, 50); g.lineTo(x + (x < 50 ? -3 : 3), 38); g.stroke(); circle(g, x + (x < 50 ? -3 : 3), 36, 4.4); paint(g, '#fff', { w: 1.6 }); circle(g, x + (x < 50 ? -2.4 : 3.6), 36.6, 2); g.fillStyle = EYE; g.fill(); }
  g.beginPath(); g.moveTo(74, 54); g.arc(80, 48, 7, Math.PI * 0.8, Math.PI * 2.4); g.closePath(); paint(g, '#e8555e', { w: LW * 0.8 });
};
// a treasure chest: body and lid; `open` lifts the lid a little
export function chestShape(g, wood, trim, open = 0, gem) {
  const lift = open * 16;
  g.beginPath(); g.roundRect(16, 54, 68, 36, 6); paint(g, wood);
  within(g, () => { g.beginPath(); g.roundRect(16, 54, 68, 36, 6); }, () => { g.fillStyle = 'rgba(58,32,64,0.18)'; g.fillRect(16, 80, 68, 12); });
  if (open) { g.beginPath(); g.roundRect(20, 50, 60, 8, 3); g.fillStyle = '#3a2440'; g.fill(); }
  g.beginPath(); g.moveTo(14, 56 - lift); g.lineTo(14, 44 - lift); g.quadraticCurveTo(14, 30 - lift, 50, 30 - lift); g.quadraticCurveTo(86, 30 - lift, 86, 44 - lift); g.lineTo(86, 56 - lift); g.closePath();
  paint(g, mix(wood, '#ffffff', 0.12));
  for (const x of [24, 70]) { g.beginPath(); g.roundRect(x, 32 - lift, 6, 56 + lift, 2); paint(g, trim, { w: LW * 0.7 }); }
  g.beginPath(); g.roundRect(44, 50, 12, 14, 3); paint(g, trim, { w: LW * 0.8 });
  if (gem) { circle(g, 50, 42 - lift, 4.4); paint(g, gem, { w: LW * 0.7 }); }
  circle(g, 50, 56, 1.8); g.fillStyle = INK; g.fill();
}
K.statue = g => { // a scarecrow
  ground(g, 22);
  g.strokeStyle = INK; g.lineWidth = 5 + LW; g.beginPath(); g.moveTo(50, 94); g.lineTo(50, 60); g.moveTo(14, 58); g.lineTo(86, 58); g.stroke();
  g.strokeStyle = '#c98a55'; g.lineWidth = 5; g.stroke();
  g.beginPath(); g.moveTo(30, 54); g.lineTo(70, 54); g.lineTo(74, 84); g.lineTo(26, 84); g.closePath(); paint(g, '#5b8de0');
  g.strokeStyle = 'rgba(232,85,94,0.8)'; g.lineWidth = 2.4; for (const x of [38, 50, 62]) { g.beginPath(); g.moveTo(x, 55); g.lineTo(x + 1, 83); g.stroke(); }
  for (const s of [-1, 1]) { g.fillStyle = '#f2cf7e'; g.beginPath(); g.moveTo(50 + s * 36, 54); g.lineTo(50 + s * 42, 50); g.lineTo(50 + s * 42, 62); g.closePath(); g.fill(); }
  const head = () => { g.beginPath(); g.ellipse(50, 40, 16, 15, 0, 0, Math.PI * 2); };
  body(g, head, '#e8d2a8', { cx: 52, cy: 38, rx: 15, ry: 14 });
  g.strokeStyle = EYE; g.lineWidth = 2;
  for (const x of [44, 56]) { g.beginPath(); g.moveTo(x - 2.4, 38); g.lineTo(x + 2.4, 42); g.moveTo(x + 2.4, 38); g.lineTo(x - 2.4, 42); g.stroke(); }
  g.beginPath(); g.moveTo(44, 47); g.quadraticCurveTo(50, 51, 56, 47); g.stroke();
  ellipse(g, 50, 28, 26, 5); paint(g, '#f2cf7e');
  g.beginPath(); g.moveTo(38, 27); g.quadraticCurveTo(40, 12, 50, 12); g.quadraticCurveTo(60, 12, 62, 27); g.closePath(); paint(g, '#f6d98e');
};
K.root = g => { // the screaming mandrake
  ground(g, 22);
  for (const [a, l] of [[-0.5, 22], [0, 26], [0.5, 20]]) { g.save(); g.translate(50, 40); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-8, -l * 0.6, 0, -l); g.quadraticCurveTo(8, -l * 0.6, 0, 0); g.closePath(); paint(g, '#7cc35a', { w: LW * 0.8 }); g.restore(); }
  for (const s of [-1, 1]) { g.strokeStyle = INK; g.lineWidth = 3.4 + LW * 1.2; g.beginPath(); g.moveTo(50 + s * 10, 84); g.lineTo(50 + s * 14, 94); g.stroke(); g.lineWidth = 3.4; g.strokeStyle = '#f2e4cc'; g.stroke(); }
  const path = () => { g.beginPath(); g.moveTo(50, 38); g.bezierCurveTo(70, 40, 74, 62, 66, 80); g.quadraticCurveTo(50, 92, 34, 80); g.bezierCurveTo(26, 62, 30, 40, 50, 38); g.closePath(); };
  body(g, path, '#f2e4cc', { cx: 52, cy: 60, rx: 18, ry: 20 });
  face(g, 52, 60, { gap: 12, brow: 1, mouth: 'open' });
};
K.bee = g => {
  ground(g, 16);
  for (const s of [-1, 1]) { ellipse(g, 48 + s * 8, 42, 9, 12, s * 0.5); paint(g, 'rgba(230,246,255,0.9)', { w: LW * 0.7 }); }
  const path = () => { g.beginPath(); g.ellipse(50, 62, 22, 18, 0, 0, Math.PI * 2); };
  body(g, path, '#ffd45a', { cx: 52, cy: 58, rx: 22, ry: 17, marks: () => { g.fillStyle = '#4a3d4f'; for (const x of [34, 46]) { g.fillRect(x, 40, 6, 44); } } });
  g.beginPath(); g.moveTo(28, 62); g.lineTo(22, 64); g.lineTo(28, 66); g.closePath(); paint(g, INK, { w: 1 });
  face(g, 60, 60, { gap: 10, mouth: 'smile' });
  for (const x of [58, 66]) { g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, 46); g.quadraticCurveTo(x + 2, 38, x + 6, 36); g.stroke(); }
};
K.ghostNpc = g => { // the crying baby bird
  ground(g, 22);
  feetPair(g, [42, 58], 92, '#ffa64a', 4.6, 3);
  const path = () => { g.beginPath(); g.moveTo(50, 40); g.bezierCurveTo(70, 40, 76, 60, 74, 74); g.bezierCurveTo(72, 90, 28, 90, 26, 74); g.bezierCurveTo(24, 60, 30, 40, 50, 40); g.closePath(); };
  g.beginPath(); g.moveTo(48, 42); g.quadraticCurveTo(44, 30, 52, 30); g.quadraticCurveTo(50, 36, 56, 42); paint(g, '#ffe48a');
  body(g, path, '#ffe48a', { cx: 54, cy: 60, rx: 22, ry: 20 });
  ellipse(g, 32, 70, 7, 5, -0.6); paint(g, '#ffd45a', { w: LW * 0.8 });
  for (const x of [48, 62]) { ellipse(g, x, 60, 3, 3.6); g.fillStyle = EYE; g.fill(); g.fillStyle = '#fff'; circle(g, x + 1, 58.6, 1.2); g.fill(); g.fillStyle = '#8fd3f2'; g.beginPath(); g.ellipse(x, 64, 3, 1.4, 0, 0, Math.PI); g.fill(); }
  g.beginPath(); g.moveTo(53, 64); g.lineTo(58, 64); g.lineTo(55.5, 68); g.closePath(); paint(g, '#ffa64a', { w: 1.4 });
  g.fillStyle = '#8fd3f2'; for (const [x, y] of [[44, 70], [66, 72]]) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2.6, y + 5, x, y + 6); g.quadraticCurveTo(x - 2.6, y + 5, x, y); g.fill(); }
};
K.mole = g => { // the mole smith with an apron and a hammer
  ground(g, 30);
  feetPair(g, [38, 62], 91, '#f4a7b9');
  const col = '#8e6a5a';
  const path = () => { g.beginPath(); g.moveTo(50, 32); g.bezierCurveTo(74, 32, 82, 56, 80, 76); g.bezierCurveTo(78, 92, 22, 92, 20, 76); g.bezierCurveTo(18, 56, 26, 32, 50, 32); g.closePath(); };
  body(g, path, col, { shadeCol: '#d6c2cc', cx: 52, cy: 58, rx: 30, ry: 26, marks: () => {
    g.beginPath(); g.moveTo(32, 66); g.lineTo(70, 66); g.lineTo(74, 92); g.lineTo(28, 92); g.closePath(); g.fillStyle = '#c98a55'; g.fill();
    g.strokeStyle = hexA(INK, 0.5); g.lineWidth = 1.6; g.beginPath(); g.moveTo(32, 66); g.lineTo(70, 66); g.stroke();
  } });
  ellipse(g, 58, 56, 6, 4.4); paint(g, '#f4a7b9', { w: 1.8 });
  g.strokeStyle = EYE; g.lineWidth = 2.2; for (const x of [46, 68]) { g.beginPath(); g.moveTo(x - 2.6, 48); g.lineTo(x + 2.6, 48); g.stroke(); }
  g.fillStyle = 'rgba(245,128,158,0.6)'; ellipse(g, 40, 56, 3.6, 2.2); g.fill(); ellipse(g, 76, 56, 3.6, 2.2); g.fill();
  // the hammer over one shoulder
  g.strokeStyle = INK; g.lineWidth = 3.4 + LW * 1.2; g.beginPath(); g.moveTo(80, 82); g.lineTo(88, 46); g.stroke(); g.lineWidth = 3.4; g.strokeStyle = '#c98a55'; g.stroke();
  g.beginPath(); g.roundRect(78, 34, 22, 13, 3); paint(g, '#8f8fa6', { w: LW * 0.8 });
  for (const x of [26, 76]) { ellipse(g, x, 74, 6, 5); paint(g, '#f4a7b9', { w: LW * 0.8 }); }
};
K.ripple = (g, f = 0) => {
  g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,255,255,0.9)';
  ellipse(g, 50, 74, 18, 6); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; ellipse(g, 50, 74, 30, 10); g.stroke();
  for (const x of [44, 56]) { circle(g, x, 70, 2.2); g.fillStyle = 'rgba(40,30,50,0.6)'; g.fill(); }
};
K.cage = g => { // wooden bars round a caught friend (drawn over them)
  g.beginPath(); g.roundRect(8, 10, 84, 10, 5); paint(g, '#c98a55');
  g.beginPath(); g.roundRect(8, 84, 84, 10, 5); paint(g, '#c98a55');
  for (const x of [14, 32, 50, 68, 86]) { g.beginPath(); g.roundRect(x - 3, 16, 6, 72, 3); paint(g, '#e8b47a', { w: LW * 0.75 }); }
  g.beginPath(); g.roundRect(42, 46, 16, 14, 3); paint(g, '#ffd45a', { w: LW * 0.8 });
};

export const CRITTERS = K;
