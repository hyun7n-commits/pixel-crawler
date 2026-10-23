// Things you pick up and keep: chests, coins, potions, keys, and every relic's icon. Each is drawn in a
// 0-100 box. Relic icons are small on the map but big on the cards, so their outline is a little
// thicker than a critter's and their shapes are simple.

import { INK, C, ellipse, circle, paint as paint0, within, mix, hexA, rng } from './ink.js';
import { chestShape } from './critters.js';

const LW = 5.4;
const paint = (g, fill, w = LW) => paint0(g, fill, { w });
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const glint = (g, x, y, rx = 3, ry = 6, rot = -0.5) => { g.fillStyle = 'rgba(255,255,255,0.75)'; ellipse(g, x, y, rx, ry, rot); g.fill(); };
const star = (g, x, y, r, inner = 0.45, n = 5, rot = -Math.PI / 2) => {
  g.beginPath();
  for (let k = 0; k < n * 2; k++) { const a = rot + k * Math.PI / n, d = k % 2 ? r * inner : r; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  g.closePath();
};
const sparkle = (g, x, y, r, col = '#fff') => { star(g, x, y, r, 0.28, 4, 0); g.fillStyle = col; g.fill(); };

// ---------- the pieces many icons share ----------
function sword(g, blade = '#dfe3f0', hilt = '#c98a55', guard = '#ffd45a', s = 1, x = 50, y = 50) {
  g.save(); g.translate(x, y); g.rotate(-Math.PI / 4); g.scale(s, s);
  g.beginPath(); g.moveTo(-7, 6); g.lineTo(-7, -36); g.lineTo(0, -46); g.lineTo(7, -36); g.lineTo(7, 6); g.closePath(); paint(g, blade);
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-4, -34, 3, 36);
  rr(g, -18, 6, 36, 9, 4); paint(g, guard);
  rr(g, -5, 15, 10, 22, 4); paint(g, hilt);
  circle(g, 0, 41, 6); paint(g, guard);
  g.restore();
}
function shield(g, face = '#5b8de0', rim = '#ffd45a', mark = true) {
  const path = () => { g.beginPath(); g.moveTo(50, 8); g.quadraticCurveTo(70, 18, 88, 16); g.quadraticCurveTo(92, 66, 50, 92); g.quadraticCurveTo(8, 66, 12, 16); g.quadraticCurveTo(30, 18, 50, 8); g.closePath(); };
  path(); paint(g, rim);
  g.beginPath(); g.moveTo(50, 18); g.quadraticCurveTo(66, 26, 79, 25); g.quadraticCurveTo(80, 62, 50, 82); g.quadraticCurveTo(20, 62, 21, 25); g.quadraticCurveTo(34, 26, 50, 18); g.closePath();
  g.fillStyle = face; g.fill();
  if (mark) { star(g, 50, 48, 14); g.fillStyle = '#fff6c8'; g.fill(); }
  glint(g, 30, 34, 3, 8, 0.4);
}
function heart(g, col = '#e8555e', x = 50, y = 54, s = 1) {
  g.beginPath();
  g.moveTo(x, y + 30 * s);
  g.bezierCurveTo(x - 46 * s, y + 2 * s, x - 34 * s, y - 40 * s, x, y - 18 * s);
  g.bezierCurveTo(x + 34 * s, y - 40 * s, x + 46 * s, y + 2 * s, x, y + 30 * s);
  g.closePath(); paint(g, col);
  glint(g, x - 18 * s, y - 14 * s, 4 * s, 7 * s, 0.6);
}
function coin(g, x = 50, y = 50, r = 36, face = '#ffd45a', mark = true) {
  circle(g, x, y + 3, r); paint(g, '#d99a22');
  circle(g, x, y, r); paint(g, face);
  circle(g, x, y, r * 0.72); g.lineWidth = 2.6; g.strokeStyle = '#e5ab2e'; g.stroke();
  if (mark) { star(g, x, y, r * 0.42); g.fillStyle = '#fff3b0'; g.fill(); }
  glint(g, x - r * 0.45, y - r * 0.4, r * 0.1, r * 0.22, 0.6);
}
function bolt(g, col = '#ffd45a', s = 1, x = 50, y = 50) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(8, -44); g.lineTo(-22, 6); g.lineTo(-2, 6); g.lineTo(-10, 44); g.lineTo(24, -10); g.lineTo(4, -10); g.closePath(); paint(g, col);
  g.restore();
}
function hammer(g, head = '#8f8fa6', handle = '#c98a55', x = 50, y = 50, s = 1) {
  g.save(); g.translate(x, y); g.rotate(-Math.PI / 5); g.scale(s, s);
  rr(g, -5, -10, 10, 54, 4); paint(g, handle);
  rr(g, -26, -36, 52, 28, 8); paint(g, head);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-20, -32, 40, 5);
  g.restore();
}
function pick(g, head = '#ffd45a', handle = '#c98a55') {
  g.save(); g.translate(50, 54); g.rotate(-Math.PI / 4);
  rr(g, -5, -24, 10, 66, 4); paint(g, handle);
  g.beginPath(); g.moveTo(-40, -8); g.quadraticCurveTo(-20, -40, 0, -40); g.quadraticCurveTo(20, -40, 40, -8); g.quadraticCurveTo(20, -24, 0, -24); g.quadraticCurveTo(-20, -24, -40, -8); g.closePath(); paint(g, head);
  g.fillStyle = 'rgba(255,255,255,0.55)'; ellipse(g, -8, -35, 10, 2.4); g.fill();
  g.restore();
}
function flame(g, x, y, s = 1, outer = '#f29a52', inner = '#ffd45a') {
  g.beginPath(); g.moveTo(x, y + 18 * s);
  g.bezierCurveTo(x - 18 * s, y + 16 * s, x - 18 * s, y - 4 * s, x - 6 * s, y - 14 * s);
  g.quadraticCurveTo(x - 4 * s, y - 4 * s, x, y - 6 * s);
  g.quadraticCurveTo(x + 2 * s, y - 18 * s, x + 6 * s, y - 24 * s);
  g.bezierCurveTo(x + 20 * s, y - 8 * s, x + 18 * s, y + 16 * s, x, y + 18 * s);
  g.closePath(); paint(g, outer);
  ellipse(g, x + 1 * s, y + 8 * s, 6 * s, 8 * s); g.fillStyle = inner; g.fill();
}
function lanternJar(g, glow = '#efff9a', glass = 'rgba(220,250,190,0.95)', cap = '#c98a55') {
  g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(50, 14, 9, Math.PI, 0); g.stroke();
  rr(g, 30, 14, 40, 12, 5); paint(g, cap);
  g.beginPath(); g.moveTo(30, 26); g.lineTo(70, 26); g.quadraticCurveTo(82, 54, 70, 86); g.quadraticCurveTo(50, 94, 30, 86); g.quadraticCurveTo(18, 54, 30, 26); g.closePath(); paint(g, glass);
  g.fillStyle = glow; for (const [x, y, r] of [[42, 50, 6], [58, 64, 5], [54, 40, 4], [44, 72, 4]]) { circle(g, x, y, r); g.fill(); }
  glint(g, 36, 46, 3, 10, 0.1);
}
function crown(g, col = '#ffd45a', gem = '#e8555e', y = 50) {
  g.beginPath(); g.moveTo(12, y + 26); g.lineTo(8, y - 18); g.lineTo(30, y + 2); g.lineTo(50, y - 28); g.lineTo(70, y + 2); g.lineTo(92, y - 18); g.lineTo(88, y + 26); g.closePath(); paint(g, col);
  rr(g, 10, y + 18, 80, 14, 5); paint(g, mix(col, '#000000', 0.12));
  for (const [x, yy] of [[8, y - 18], [50, y - 28], [92, y - 18]]) { circle(g, x, yy, 5); paint(g, '#fff3b0', 3); }
  circle(g, 50, y + 5, 7); paint(g, gem, 3.6);
}
function boot(g, col = '#a8693f', cuff = '#e8c48f') {
  g.beginPath(); g.moveTo(30, 12); g.lineTo(62, 12); g.lineTo(62, 56); g.quadraticCurveTo(90, 58, 90, 76); g.lineTo(90, 86); g.lineTo(22, 86); g.lineTo(26, 56); g.closePath(); paint(g, col);
  rr(g, 26, 10, 40, 14, 5); paint(g, cuff);
  g.strokeStyle = hexA(INK, 0.5); g.lineWidth = 2.6; g.beginPath(); g.moveTo(24, 76); g.lineTo(90, 76); g.stroke();
}
function cloakShape(g, col = '#5b8de0', inner = '#8fd3f2') {
  g.beginPath(); g.moveTo(34, 14); g.quadraticCurveTo(50, 22, 66, 14); g.quadraticCurveTo(88, 50, 86, 88); g.quadraticCurveTo(68, 80, 50, 90); g.quadraticCurveTo(32, 80, 14, 88); g.quadraticCurveTo(12, 50, 34, 14); g.closePath(); paint(g, col);
  g.beginPath(); g.moveTo(40, 22); g.quadraticCurveTo(50, 50, 50, 88); g.quadraticCurveTo(50, 50, 60, 22); g.closePath(); g.fillStyle = inner; g.fill();
  circle(g, 50, 18, 6); paint(g, '#ffd45a', 3.6);
}
function feather(g, col = '#8fd3f2', x = 50, y = 50, rot = 0.6) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.moveTo(0, 40); g.quadraticCurveTo(-20, 0, 0, -40); g.quadraticCurveTo(20, 0, 0, 40); g.closePath(); paint(g, col);
  g.strokeStyle = hexA(INK, 0.6); g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, 46); g.lineTo(0, -32); g.stroke();
  g.restore();
}
function bombBall(g, x = 50, y = 58, r = 30, col = '#4a3d4f') {
  circle(g, x, y, r); paint(g, col);
  glint(g, x - r * 0.4, y - r * 0.4, r * 0.14, r * 0.26, 0.7);
  rr(g, x - 8, y - r - 6, 16, 10, 3); paint(g, '#8f8fa6', 4);
  g.strokeStyle = INK; g.lineWidth = 4.4; g.beginPath(); g.moveTo(x, y - r - 6); g.quadraticCurveTo(x + 6, y - r - 18, x + 16, y - r - 18); g.stroke();
  g.strokeStyle = '#c98a55'; g.lineWidth = 2; g.stroke();
  sparkle(g, x + 18, y - r - 20, 9, '#ffd45a');
}
function sack(g, col = '#c98a55', tie = '#8e5636') {
  g.beginPath(); g.moveTo(36, 30); g.quadraticCurveTo(10, 50, 16, 76); g.quadraticCurveTo(20, 92, 50, 92); g.quadraticCurveTo(80, 92, 84, 76); g.quadraticCurveTo(90, 50, 64, 30); g.closePath(); paint(g, col);
  g.beginPath(); g.moveTo(36, 30); g.lineTo(28, 14); g.lineTo(42, 20); g.lineTo(50, 10); g.lineTo(58, 20); g.lineTo(72, 14); g.lineTo(64, 30); g.closePath(); paint(g, col);
  rr(g, 32, 26, 36, 8, 4); paint(g, tie, 4);
}
function eye(g, iris = '#ffd45a', x = 50, y = 54) {
  g.beginPath(); g.moveTo(10, y); g.quadraticCurveTo(50, y - 40, 90, y); g.quadraticCurveTo(50, y + 40, 10, y); g.closePath(); paint(g, '#fff');
  circle(g, x, y, 17); paint(g, iris, 4);
  circle(g, x, y, 8); g.fillStyle = INK; g.fill();
  circle(g, x - 5, y - 6, 4); g.fillStyle = '#fff'; g.fill();
}
function moon(g, col = '#ffe58a', x = 50, y = 50, r = 38) {
  g.beginPath(); g.arc(x, y, r, Math.PI * 0.35, Math.PI * 1.65); g.arc(x + r * 0.5, y - r * 0.2, r * 0.8, Math.PI * 1.55, Math.PI * 0.45, true); g.closePath(); paint(g, col);
}
function swirl(g, col = '#8fd3f2', x = 50, y = 50, r = 30) {
  g.strokeStyle = INK; g.lineWidth = 9 + LW; g.beginPath();
  for (let k = 0; k < 40; k++) { const a = k * 0.28, d = r * (1 - k / 44); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  g.stroke(); g.strokeStyle = col; g.lineWidth = 9; g.stroke();
}
function tree(g, crownCol = '#5cb85a', light = '#84d26a') {
  rr(g, 42, 52, 16, 40, 5); paint(g, '#a8693f');
  for (const [x, y, r] of [[30, 48, 20], [70, 48, 20], [50, 30, 26]]) { circle(g, x, y, r); paint(g, crownCol); }
  for (const [x, y, r] of [[30, 48, 20], [70, 48, 20], [50, 30, 26]]) { circle(g, x - r * 0.25, y - r * 0.3, r * 0.45); g.fillStyle = light; g.fill(); }
}
function sun(g, col = '#ffd45a', x = 50, y = 50, r = 22) {
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(x + Math.cos(a - 0.2) * (r + 4), y + Math.sin(a - 0.2) * (r + 4)); g.lineTo(x + Math.cos(a) * (r + 18), y + Math.sin(a) * (r + 18)); g.lineTo(x + Math.cos(a + 0.2) * (r + 4), y + Math.sin(a + 0.2) * (r + 4)); g.closePath(); paint(g, '#ffb02e', 4); }
  circle(g, x, y, r); paint(g, col);
}
function fist(g, col = '#f2cf9a') {
  rr(g, 18, 26, 64, 56, 22); paint(g, col);
  g.strokeStyle = hexA(INK, 0.6); g.lineWidth = 3;
  for (const x of [34, 50, 66]) { g.beginPath(); g.moveTo(x, 28); g.lineTo(x, 46); g.stroke(); }
  rr(g, 10, 46, 26, 22, 10); paint(g, col);
}
function clover(g, col = '#7cc35a') {
  g.strokeStyle = INK; g.lineWidth = 4 + LW; g.beginPath(); g.moveTo(50, 54); g.quadraticCurveTo(56, 76, 66, 92); g.stroke(); g.strokeStyle = '#5fa84a'; g.lineWidth = 4; g.stroke();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; heart0(g, 50 + Math.cos(a) * 18, 46 + Math.sin(a) * 18, a + Math.PI / 2, col); }
}
function heart0(g, x, y, rot, col) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(0.42, 0.42);
  g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-46, 2, -34, -40, 0, -18); g.bezierCurveTo(34, -40, 46, 2, 0, 30); g.closePath();
  g.fillStyle = col; g.fill(); g.lineWidth = LW / 0.42; g.strokeStyle = INK; g.stroke();
  g.restore();
}
function gemShape(g, col, light, x = 50, y = 50, s = 1) {
  g.beginPath(); g.moveTo(x - 24 * s, y - 10 * s); g.lineTo(x - 12 * s, y - 24 * s); g.lineTo(x + 12 * s, y - 24 * s); g.lineTo(x + 24 * s, y - 10 * s); g.lineTo(x, y + 26 * s); g.closePath(); paint(g, col);
  g.beginPath(); g.moveTo(x - 12 * s, y - 24 * s); g.lineTo(x - 4 * s, y - 10 * s); g.lineTo(x, y + 26 * s); g.lineTo(x - 24 * s, y - 10 * s); g.closePath(); g.fillStyle = light; g.fill();
  g.beginPath(); g.moveTo(x - 24 * s, y - 10 * s); g.lineTo(x - 12 * s, y - 24 * s); g.lineTo(x + 12 * s, y - 24 * s); g.lineTo(x + 24 * s, y - 10 * s); g.lineTo(x, y + 26 * s); g.closePath(); paint(g, null);
}

// ---------- the relics ----------
const R = {};
R.blade = g => sword(g);
R.shield = g => shield(g);
R.fang = g => {
  for (const [x, s] of [[34, 1], [66, 1]]) { g.beginPath(); g.moveTo(x - 14, 22); g.quadraticCurveTo(x, 18, x + 14, 22); g.quadraticCurveTo(x + 8, 60, x, 82); g.quadraticCurveTo(x - 8, 60, x - 14, 22); g.closePath(); paint(g, '#fbf6ee'); }
  g.beginPath(); g.moveTo(66, 70); g.quadraticCurveTo(74, 82, 66, 90); g.quadraticCurveTo(58, 82, 66, 70); g.closePath(); paint(g, '#e8555e', 3.6);
};
R.ring = g => {
  ellipse(g, 50, 62, 30, 26); g.lineWidth = 12 + LW * 2; g.strokeStyle = INK; g.stroke(); g.lineWidth = 12; g.strokeStyle = '#ffd45a'; g.stroke();
  flame(g, 50, 26, 0.9, '#e8555e', '#ffd45a');
};
R.coin = g => coin(g);
R.heart = g => heart(g);
R.thorns = g => { // an armour vest bristling with spikes
  for (let k = 0; k < 8; k++) { const a = -Math.PI * 0.95 + k * Math.PI * 0.27; g.beginPath(); g.moveTo(50 + Math.cos(a - 0.15) * 30, 56 + Math.sin(a - 0.15) * 30); g.lineTo(50 + Math.cos(a) * 46, 56 + Math.sin(a) * 46); g.lineTo(50 + Math.cos(a + 0.15) * 30, 56 + Math.sin(a + 0.15) * 30); g.closePath(); paint(g, '#c8cad6', 4); }
  rr(g, 22, 26, 56, 60, 18); paint(g, '#8f8fa6');
  g.strokeStyle = hexA(INK, 0.5); g.lineWidth = 2.6; g.beginPath(); g.moveTo(50, 28); g.lineTo(50, 84); g.stroke();
};
R.bolt = g => { // a paper charm with a bolt on it
  rr(g, 24, 10, 52, 80, 6); paint(g, '#fbf1d8');
  bolt(g, '#ffd45a', 0.72);
  g.strokeStyle = '#e8555e'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 18); g.lineTo(68, 18); g.stroke();
};
R.moss = g => {
  g.beginPath(); g.moveTo(12, 78); g.quadraticCurveTo(14, 46, 34, 46); g.quadraticCurveTo(40, 30, 56, 34); g.quadraticCurveTo(76, 30, 80, 50); g.quadraticCurveTo(94, 58, 88, 78); g.closePath(); paint(g, '#7cc35a');
  for (const [x, y] of [[36, 46], [62, 40]]) { g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 14); g.stroke(); ellipse(g, x + 6, y - 16, 7, 4, -0.5); paint(g, '#a8dc7a', 3); }
  g.fillStyle = '#9ed46e'; for (const [x, y] of [[30, 62], [52, 56], [70, 64]]) { circle(g, x, y, 5); g.fill(); }
};
R.boots = g => boot(g);
R.lantern = g => lanternJar(g);
R.hammer = g => hammer(g);
R.pick = g => pick(g);
R.cloak = g => feather(g);
R.mint = g => { // a wrapped peppermint
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 22, 50); g.lineTo(50 + s * 44, 34); g.lineTo(50 + s * 44, 66); g.closePath(); paint(g, '#fbf6ee', 4); }
  circle(g, 50, 50, 26); paint(g, '#fbf6ee');
  within(g, () => circle(g, 50, 50, 26), () => { g.fillStyle = '#62c08a'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(50, 50); g.arc(50, 50, 30, k * Math.PI / 2, k * Math.PI / 2 + 0.6); g.closePath(); g.fill(); } });
  circle(g, 50, 50, 26); paint(g, null);
};
R.sweep = g => { // a glove with a swoosh
  g.strokeStyle = '#8fd3f2'; g.lineWidth = 6; g.lineCap = 'round';
  for (const [r, a] of [[40, 0.9], [32, 0.7]]) { g.beginPath(); g.arc(50, 56, r, Math.PI * 1.05, Math.PI * (1.05 + a)); g.stroke(); }
  rr(g, 34, 40, 40, 40, 14); paint(g, '#ffd45a');
  rr(g, 22, 50, 18, 14, 7); paint(g, '#ffd45a');
  rr(g, 36, 76, 36, 12, 5); paint(g, '#e5ab2e');
};
R.bombbag = g => { sack(g); bombBall(g, 50, 66, 16); };
R.magnet = g => {
  g.beginPath(); g.moveTo(16, 18); g.lineTo(38, 18); g.lineTo(38, 54); g.arc(50, 54, 12, Math.PI, 0, true); g.lineTo(62, 18); g.lineTo(84, 18); g.lineTo(84, 54); g.arc(50, 54, 34, 0, Math.PI); g.closePath(); paint(g, '#e8555e');
  rr(g, 16, 14, 22, 14, 3); paint(g, '#dfe3f0', 4); rr(g, 62, 14, 22, 14, 3); paint(g, '#dfe3f0', 4);
  sparkle(g, 50, 30, 10, '#ffd45a');
};
R.bandage = g => {
  rr(g, 14, 30, 72, 40, 18); paint(g, '#fbf6ee');
  g.strokeStyle = hexA(INK, 0.3); g.lineWidth = 2.4; for (const x of [30, 70]) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x, 68); g.stroke(); }
  rr(g, 44, 38, 12, 24, 3); g.fillStyle = '#e8555e'; g.fill(); rr(g, 38, 44, 24, 12, 3); g.fill();
};
// fusions
R.flamesword = g => { flame(g, 62, 34, 1.4, '#f29a52', '#ffd45a'); sword(g, '#ffd8a8', '#a8693f', '#e8555e'); };
R.fortress = g => {
  for (const [x, y] of [[10, 24], [90, 24], [16, 64], [84, 64], [50, 96]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(50 + (x - 50) * 0.6, y + (y < 50 ? 10 : -6)); g.lineTo(50 + (x - 50) * 0.75, y + (y < 50 ? -6 : -14)); g.closePath(); paint(g, '#c8cad6', 3.6); }
  shield(g, '#6f6c86', '#c8cad6');
};
R.bloodcrown = g => { crown(g, '#e8555e', '#ffd45a', 56); g.beginPath(); g.moveTo(80, 70); g.quadraticCurveTo(88, 82, 80, 90); g.quadraticCurveTo(72, 82, 80, 70); g.closePath(); paint(g, '#c83a4e', 3.4); };
R.goldbolt = g => { bolt(g, '#ffe58a', 1.05); sparkle(g, 76, 22, 9, '#fff'); sparkle(g, 22, 76, 7, '#fff'); };
R.shadow = g => { g.fillStyle = 'rgba(106,98,131,0.6)'; for (const [x, y, r] of [[20, 80, 8], [12, 66, 5], [26, 92, 6]]) { circle(g, x, y, r); g.fill(); } boot(g, '#5a4f7a', '#9a8fbd'); };
R.quake = g => {
  g.strokeStyle = INK; g.lineWidth = 3.4; g.beginPath(); g.moveTo(10, 92); g.lineTo(26, 82); g.lineTo(34, 92); g.moveTo(66, 92); g.lineTo(74, 80); g.lineTo(90, 90); g.stroke();
  hammer(g, '#a8693f', '#8e5636', 50, 46, 1.1);
};
R.goldrush = g => { pick(g, '#ffe58a'); coin(g, 72, 72, 16); };
R.dreamlamp = g => { lanternJar(g, '#fff3b0', 'rgba(217,200,242,0.95)', '#9a6fd6'); sparkle(g, 82, 26, 8, '#ffd45a'); sparkle(g, 16, 40, 6, '#ffd45a'); };
R.firebomb = g => { bombBall(g, 50, 60, 30, '#c83a4e'); flame(g, 50, 60, 0.7, '#f29a52', '#ffd45a'); };
R.herbal = g => { sack(g, '#8fd06a', '#5ea64a'); for (const a of [-0.5, 0.3]) { g.save(); g.translate(50, 14); g.rotate(a); ellipse(g, 0, -8, 6, 12); paint(g, '#5fa84a', 3.4); g.restore(); } };
R.bloodblade = g => sword(g, '#f29aa8', '#6e4659', '#c83a4e');
R.ironheart = g => { heart(g, '#c8cad6'); g.strokeStyle = hexA(INK, 0.5); g.lineWidth = 2.6; for (const [x, y] of [[36, 50], [64, 50], [50, 70]]) { circle(g, x, y, 2.4); g.stroke(); } };
R.owleye = g => {
  for (const x of [24, 76]) { g.beginPath(); g.moveTo(x - 10, 34); g.lineTo(x + (x < 50 ? -6 : 6), 10); g.lineTo(x + 10, 30); g.closePath(); paint(g, '#b5824f', 4); }
  circle(g, 50, 54, 40); paint(g, '#d9a86c');
  for (const x of [32, 68]) { circle(g, x, 50, 15); paint(g, '#fff', 4); circle(g, x, 50, 8); g.fillStyle = '#ffb02e'; g.fill(); circle(g, x, 50, 4); g.fillStyle = INK; g.fill(); }
  g.beginPath(); g.moveTo(44, 62); g.lineTo(56, 62); g.lineTo(50, 74); g.closePath(); paint(g, '#ffc04a', 3.4);
};
R.luckycharm = g => clover(g);
R.thunder = g => { hammer(g, '#ffd45a', '#c98a55', 46, 54); bolt(g, '#fff3b0', 0.5, 74, 26); };
R.whirl = g => { swirl(g, '#c8f0fa', 50, 50, 40); sword(g, '#dfe3f0', '#c98a55', '#ffd45a', 0.62, 50, 50); };
R.pillow = g => {
  rr(g, 10, 34, 80, 46, 20); paint(g, '#fbf6ee');
  g.strokeStyle = '#d9c8f2'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, 56); g.quadraticCurveTo(50, 66, 84, 56); g.stroke();
  g.fillStyle = '#9a6fd6'; g.font = 'bold 26px sans-serif'; g.fillText('z', 62, 28); g.font = 'bold 18px sans-serif'; g.fillText('z', 80, 14);
};
R.spikecloak = g => { cloakShape(g, '#9a6a48', '#c9905a'); for (let k = 0; k < 5; k++) { const x = 22 + k * 14; g.beginPath(); g.moveTo(x - 5, 46 + Math.abs(k - 2) * 8); g.lineTo(x, 30 + Math.abs(k - 2) * 8); g.lineTo(x + 5, 46 + Math.abs(k - 2) * 8); g.closePath(); paint(g, '#c8cad6', 3); } };
R.goldfang = g => { g.beginPath(); g.moveTo(30, 18); g.quadraticCurveTo(50, 12, 70, 18); g.quadraticCurveTo(62, 66, 50, 90); g.quadraticCurveTo(38, 66, 30, 18); g.closePath(); paint(g, '#ffd45a'); glint(g, 42, 34, 3, 9, 0.2); sparkle(g, 76, 30, 9); };
R.headlamp = g => {
  g.beginPath(); g.moveTo(14, 72); g.quadraticCurveTo(14, 26, 50, 26); g.quadraticCurveTo(86, 26, 86, 72); g.closePath(); paint(g, '#ffd45a');
  rr(g, 8, 66, 84, 14, 6); paint(g, '#e5ab2e');
  circle(g, 50, 46, 12); paint(g, '#fff6c8', 4);
  g.fillStyle = 'rgba(255,246,200,0.5)'; g.beginPath(); g.moveTo(42, 40); g.lineTo(20, 4); g.lineTo(80, 4); g.lineTo(58, 40); g.closePath(); g.fill();
};
R.embermail = g => {
  rr(g, 18, 18, 64, 70, 20); paint(g, '#c8cad6');
  for (const x of [16, 84]) { circle(g, x, 28, 12); paint(g, '#a8a2b8'); }
  flame(g, 50, 56, 0.9, '#f29a52', '#ffd45a');
};
R.dagger = g => sword(g, '#d9c8f2', '#4a3d4f', '#9a6fd6', 0.75);
R.sunlamp = g => { sun(g, '#ffe58a', 50, 50, 20); };
R.giantfist = g => fist(g);
R.volcano = g => {
  g.beginPath(); g.moveTo(6, 92); g.lineTo(34, 34); g.lineTo(66, 34); g.lineTo(94, 92); g.closePath(); paint(g, '#8e5636');
  g.beginPath(); g.moveTo(34, 34); g.lineTo(66, 34); g.lineTo(60, 48); g.lineTo(54, 42); g.lineTo(46, 54); g.lineTo(40, 44); g.closePath(); g.fillStyle = '#f29a52'; g.fill();
  flame(g, 50, 20, 0.8, '#e8555e', '#ffd45a');
};
R.undying = g => {
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 20, 50); g.quadraticCurveTo(50 + s * 46, 20, 50 + s * 48, 50); g.quadraticCurveTo(50 + s * 40, 52, 50 + s * 44, 64); g.quadraticCurveTo(50 + s * 32, 62, 50 + s * 22, 68); g.closePath(); paint(g, '#fbf6ee', 4); }
  heart(g, '#e8555e', 50, 58, 0.72);
  ellipse(g, 50, 14, 16, 5); g.lineWidth = 4; g.strokeStyle = '#ffd45a'; g.stroke();
};
R.goldstorm = g => {
  g.beginPath(); g.moveTo(16, 50); g.quadraticCurveTo(10, 30, 30, 30); g.quadraticCurveTo(38, 12, 58, 18); g.quadraticCurveTo(80, 16, 82, 36); g.quadraticCurveTo(96, 44, 84, 54); g.closePath(); paint(g, '#fff3b0');
  bolt(g, '#ffd45a', 0.55, 36, 72); bolt(g, '#ffd45a', 0.45, 66, 74);
};
R.phantom = g => { moon(g, '#d9c8f2', 44, 50, 38); sparkle(g, 78, 26, 9, '#fff'); sparkle(g, 74, 70, 6, '#fff'); };
R.meteor = g => {
  g.fillStyle = 'rgba(242,154,82,0.6)'; g.beginPath(); g.moveTo(90, 10); g.lineTo(52, 40); g.lineTo(62, 50); g.closePath(); g.fill();
  circle(g, 42, 60, 26); paint(g, '#a8693f');
  flame(g, 46, 54, 0.8, '#f29a52', '#ffd45a');
};
R.lifetree = g => tree(g);
R.bloodmoon = g => { circle(g, 50, 50, 38); paint(g, '#e8555e'); g.fillStyle = 'rgba(160,40,60,0.5)'; for (const [x, y, r] of [[36, 38, 7], [60, 60, 9], [62, 34, 4]]) { circle(g, x, y, r); g.fill(); } };
R.stormlord = g => {
  hammer(g, '#5b8de0', '#8e5636', 50, 56, 1);
  g.beginPath(); g.moveTo(14, 24); g.quadraticCurveTo(14, 8, 34, 10); g.quadraticCurveTo(46, 0, 60, 8); g.quadraticCurveTo(76, 6, 74, 22); g.closePath(); paint(g, '#c8cad6', 4);
  bolt(g, '#ffd45a', 0.32, 80, 36);
};
R.guardian = g => {
  ellipse(g, 50, 60, 42, 30); paint(g, '#8fd06a');
  ellipse(g, 50, 52, 36, 26); paint(g, '#c98a55');
  g.strokeStyle = hexA(INK, 0.55); g.lineWidth = 2.6;
  for (const [x, y] of [[50, 44], [30, 54], [70, 54], [50, 64]]) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 7); } g.closePath(); g.stroke(); }
};
R.fortune = g => { star(g, 50, 52, 42); paint(g, '#ffd45a'); star(g, 50, 52, 18); g.fillStyle = '#fff3b0'; g.fill(); sparkle(g, 84, 18, 9); sparkle(g, 14, 84, 7); };
R.whirlwind = g => { swirl(g, '#c8f0fa', 34, 40, 26); swirl(g, '#f29a52', 66, 62, 26); };
R.minecrown = g => { crown(g, '#ffd45a', '#8fd3f2', 56); sparkle(g, 18, 18, 8); sparkle(g, 84, 22, 10); gemShape(g, '#d9c8f2', '#f0e8ff', 50, 16, 0.4); };
R.eternity = g => {
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.strokeStyle = ['#e8555e', '#ffd45a', '#8fd06a', '#8fd3f2', '#9a6fd6', '#f4a7c8'][k % 6]; g.lineWidth = 5; g.beginPath(); g.moveTo(50 + Math.cos(a) * 36, 54 + Math.sin(a) * 36); g.lineTo(50 + Math.cos(a) * 47, 54 + Math.sin(a) * 47); g.stroke(); }
  heart(g, '#f4a7c8', 50, 56, 0.85);
};
R.eclipse = g => {
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.strokeStyle = '#ffd45a'; g.lineWidth = 4.4; g.beginPath(); g.moveTo(50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36); g.lineTo(50 + Math.cos(a) * 47, 50 + Math.sin(a) * 47); g.stroke(); }
  circle(g, 50, 50, 32); paint(g, '#ffd45a'); circle(g, 56, 46, 28); paint(g, '#3a2440', 3.6);
};
R.godhammer = g => { ellipse(g, 50, 14, 24, 6); g.lineWidth = 4.4; g.strokeStyle = '#ffd45a'; g.stroke(); hammer(g, '#ffe58a', '#fbf6ee', 50, 58, 1); };
R.bloodking = g => { g.beginPath(); g.moveTo(18, 54); g.quadraticCurveTo(10, 84, 20, 94); g.lineTo(80, 94); g.quadraticCurveTo(90, 84, 82, 54); g.closePath(); paint(g, '#c83a4e'); crown(g, '#ffd45a', '#c83a4e', 44); };
R.dawnstar = g => { star(g, 50, 50, 46, 0.22, 4, 0); paint(g, '#fff3b0'); star(g, 50, 50, 30, 0.3, 4, Math.PI / 4); g.fillStyle = '#ffd45a'; g.fill(); circle(g, 50, 50, 8); g.fillStyle = '#fff'; g.fill(); };
const owlSmall = g => {
  g.save(); g.translate(56, 54); g.scale(0.6, 0.6); g.translate(-50, -50);
  circle(g, 50, 54, 40); paint(g, '#6a6283');
  for (const x of [32, 68]) { circle(g, x, 50, 14); paint(g, '#fff', 4); circle(g, x, 50, 7); g.fillStyle = '#ffd45a'; g.fill(); circle(g, x, 50, 3.4); g.fillStyle = INK; g.fill(); }
  g.restore();
};
R.nightowl = g => { moon(g, '#ffe58a', 30, 40, 24); owlSmall(g); };
export const RELIC_ART = R;

// ---------- things on the floor and in the menus ----------
const I = {};
const floorShadow = (g, rx = 30) => { ellipse(g, 50, 90, rx, 5); g.fillStyle = 'rgba(58,32,64,0.2)'; g.fill(); };
I.chest = g => { floorShadow(g, 36); chestShape(g, '#c98a55', '#ffd45a'); };
I.lockedChest = g => {
  floorShadow(g, 36); chestShape(g, '#8f6aa8', '#c8cad6');
  rr(g, 40, 50, 20, 18, 4); paint(g, '#ffd45a', 4.4);
  g.beginPath(); g.arc(50, 50, 6, Math.PI, 0); g.lineWidth = 3 + 4; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#c8cad6'; g.stroke();
};
I.bossChest = g => {
  floorShadow(g, 40);
  chestShape(g, '#7a4fb0', '#ffd45a', 0, '#e8555e');
  g.save(); g.translate(50, 24); g.scale(0.5, 0.5); g.translate(-50, -50); crown(g, '#ffd45a', '#8fd3f2', 50); g.restore();
  sparkle(g, 14, 30, 7); sparkle(g, 88, 40, 6);
};
I.gold = g => { floorShadow(g, 30); coin(g, 34, 70, 16); coin(g, 64, 72, 15); coin(g, 50, 56, 17); };
I.potion = g => {
  floorShadow(g, 22);
  g.beginPath(); g.moveTo(40, 24); g.lineTo(60, 24); g.lineTo(60, 40); g.quadraticCurveTo(80, 50, 78, 70); g.quadraticCurveTo(76, 90, 50, 90); g.quadraticCurveTo(24, 90, 22, 70); g.quadraticCurveTo(20, 50, 40, 40); g.closePath(); paint(g, 'rgba(250,240,255,0.95)');
  within(g, () => { g.beginPath(); g.moveTo(40, 24); g.lineTo(60, 24); g.lineTo(60, 40); g.quadraticCurveTo(80, 50, 78, 70); g.quadraticCurveTo(76, 90, 50, 90); g.quadraticCurveTo(24, 90, 22, 70); g.quadraticCurveTo(20, 50, 40, 40); g.closePath(); }, () => {
    g.fillStyle = '#e8555e'; g.fillRect(10, 56, 80, 40); heart(g, '#ffb3c0', 50, 72, 0.3);
  });
  g.beginPath(); g.moveTo(40, 24); g.lineTo(60, 24); g.lineTo(60, 40); g.quadraticCurveTo(80, 50, 78, 70); g.quadraticCurveTo(76, 90, 50, 90); g.quadraticCurveTo(24, 90, 22, 70); g.quadraticCurveTo(20, 50, 40, 40); g.closePath(); paint(g, null);
  rr(g, 38, 12, 24, 14, 4); paint(g, '#c98a55', 4.4);
  glint(g, 32, 60, 3, 8, 0.2);
};
I.bomb = g => { floorShadow(g, 26); bombBall(g, 50, 62, 26); };
I.map = g => {
  floorShadow(g, 34);
  g.beginPath(); g.moveTo(14, 22); g.lineTo(86, 18); g.lineTo(86, 78); g.lineTo(14, 82); g.closePath(); paint(g, '#fbf1d8');
  g.strokeStyle = '#c99c64'; g.lineWidth = 2.6; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(24, 70); g.quadraticCurveTo(40, 40, 56, 56); g.quadraticCurveTo(66, 66, 72, 34); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#e8555e'; g.lineWidth = 4; g.beginPath(); g.moveTo(66, 28); g.lineTo(78, 40); g.moveTo(78, 28); g.lineTo(66, 40); g.stroke();
  for (const x of [14, 86]) { rr(g, x - 5, 14, 10, 72, 5); paint(g, '#e8c48f', 4); }
};
function keyShape(g, col = '#ffd45a') {
  g.save(); g.translate(50, 54); g.rotate(-0.6);
  circle(g, -22, 0, 16); paint(g, col); circle(g, -22, 0, 7); g.fillStyle = mix(col, '#000', 0.25); g.fill();
  rr(g, -8, -5, 46, 10, 4); paint(g, col);
  rr(g, 26, 4, 7, 12, 2); paint(g, col, 4); rr(g, 14, 4, 7, 9, 2); paint(g, col, 4);
  g.restore();
}
I.key = g => { floorShadow(g, 26); keyShape(g); };
I.cageKey = g => {
  floorShadow(g, 26); keyShape(g, '#ffd45a');
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(26, 40); g.lineTo(26 + s * 12, 32); g.lineTo(26 + s * 12, 46); g.closePath(); paint(g, '#e8555e', 3.6); }
  circle(g, 26, 40, 4); paint(g, '#e8555e', 3);
};
I.pedestal = g => {
  floorShadow(g, 30);
  rr(g, 22, 70, 56, 18, 5); paint(g, '#a8a2b8');
  rr(g, 32, 52, 36, 22, 4); paint(g, '#c8c3d4');
  rr(g, 26, 44, 48, 10, 4); paint(g, '#8fd3f2', 4);
};
I.necklace = g => {
  floorShadow(g, 24);
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50, 56); g.quadraticCurveTo(50 + s * 30, 30, 50 + s * 34, 50); g.quadraticCurveTo(50 + s * 30, 70, 50, 56); g.closePath(); paint(g, '#f4a7c8'); }
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50, 58); g.lineTo(50 + s * 16, 86); g.lineTo(50 + s * 6, 84); g.closePath(); paint(g, '#f4a7c8', 4); }
  circle(g, 50, 56, 8); paint(g, '#f9c4d8');
};
I.candy = g => { // a star candy
  floorShadow(g, 24);
  star(g, 50, 54, 32, 0.5); paint(g, '#f9b3c8');
  star(g, 50, 54, 14, 0.5); g.fillStyle = '#fff'; g.fill();
  sparkle(g, 84, 22, 9, '#ffd45a'); sparkle(g, 16, 30, 7, '#8fd3f2');
};
I.crown = g => crown(g);
I.heal = g => heart(g, '#e8555e');
I.rest = g => { // an hourglass
  rr(g, 22, 8, 56, 12, 5); paint(g, '#c98a55'); rr(g, 22, 80, 56, 12, 5); paint(g, '#c98a55');
  g.beginPath(); g.moveTo(30, 20); g.lineTo(70, 20); g.quadraticCurveTo(70, 40, 54, 50); g.quadraticCurveTo(70, 60, 70, 80); g.lineTo(30, 80); g.quadraticCurveTo(30, 60, 46, 50); g.quadraticCurveTo(30, 40, 30, 20); g.closePath(); paint(g, 'rgba(230,246,255,0.95)');
  g.beginPath(); g.moveTo(36, 78); g.quadraticCurveTo(50, 62, 64, 78); g.closePath(); g.fillStyle = '#ffd45a'; g.fill();
  g.beginPath(); g.moveTo(40, 30); g.lineTo(60, 30); g.quadraticCurveTo(56, 42, 50, 46); g.quadraticCurveTo(44, 42, 40, 30); g.closePath(); g.fill();
};
I.bag = g => {
  g.beginPath(); g.moveTo(34, 30); g.quadraticCurveTo(34, 10, 50, 10); g.quadraticCurveTo(66, 10, 66, 30); g.lineWidth = 6 + LW; g.strokeStyle = INK; g.stroke(); g.lineWidth = 6; g.strokeStyle = '#8e5636'; g.stroke();
  rr(g, 12, 28, 76, 60, 14); paint(g, '#c98a55');
  rr(g, 12, 28, 76, 22, 12); paint(g, '#e8b47a');
  rr(g, 42, 42, 16, 14, 3); paint(g, '#ffd45a', 4);
};
export const ITEM_ART = I;
export const ITEM_SIZE = { crown: 8, heal: 8, rest: 8, bag: 8 };
