// The heroes, villagers and pets as smooth illustrations: one squat mochi blob each (head and body in
// one, wider than tall), a thick plum outline, flat colour with a soft shade on the back and bottom,
// dot eyes, pink cheeks and one or two things that say who they are (ears, a tail, a hat, a prop).
// They stand in a 3/4 view looking right; Phaser flips them to look left.
//
// Each drawing works in a 0-100 box (one tile). `o` carries the pose:
//   o.frame  0 standing, 1 and 2 the two walking steps (a foot up, the body bobbing)
//   o.expr   the face: '', blink, hit, grit, teary, sparkle, shock

import { C, INK, LW, ellipse, circle, blob, curve, within, paint, mix } from './ink.js';

const CX = 50, TOP = 31, BOT = 91, HW = 35;
const FX = 57, EY = 55;                 // face centre and eye line
const EYE_GAP = 11.5;

// ---------- the body ----------
function bodyPath(g, o) {
  const top = o.top + o.dy, bot = BOT + o.dy * 0.4, hw = o.hw, cx = CX, h = bot - top;
  g.beginPath();
  g.moveTo(cx, top);
  g.bezierCurveTo(cx + hw * 0.66, top, cx + hw, top + h * 0.24, cx + hw, top + h * 0.62);
  g.bezierCurveTo(cx + hw, bot - h * 0.04, cx + hw * 0.6, bot, cx, bot);
  g.bezierCurveTo(cx - hw * 0.6, bot, cx - hw, bot - h * 0.04, cx - hw, top + h * 0.62);
  g.bezierCurveTo(cx - hw, top + h * 0.24, cx - hw * 0.66, top, cx, top);
  g.closePath();
}

// a soft cool shade on the back (left) and lower edge of whatever path is clipped
function shade(g, cx, cy, rx, ry, col = '#d9c6d6') {
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.beginPath();
  g.rect(-50, -50, 200, 200);
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = col;
  g.fill('evenodd');
  g.restore();
}

// ---------- the face ----------
function eyes(g, o, f) {
  const y = EY + o.dy + (f.eyeY || 0), xs = [FX - EYE_GAP + (f.eyeDX || 0), FX + EYE_GAP + (f.eyeDX || 0)];
  const ink = f.eye || C.eye, line = (w = 2.6) => { g.lineWidth = w; g.strokeStyle = ink; g.lineCap = 'round'; g.stroke(); };
  const dot = (x, big = 1) => {
    ellipse(g, x, y, 3.1 * big, 4.1 * big); g.fillStyle = ink; g.fill();
    g.fillStyle = '#ffffff';
    circle(g, x + 1.1 * big, y - 1.5 * big, 1.25 * big); g.fill();
  };
  switch (o.expr) {
    case 'blink':
      for (const x of xs) { g.beginPath(); g.moveTo(x - 3.4, y); g.quadraticCurveTo(x, y + 2.8, x + 3.4, y); line(); }
      break;
    case 'hit':
      for (const [x, s] of [[xs[0], 1], [xs[1], -1]]) {
        g.beginPath(); g.moveTo(x - 3.4 * s, y - 3.4); g.lineTo(x + 2.6 * s, y); g.lineTo(x - 3.4 * s, y + 3.4); line(2.7);
      }
      break;
    case 'grit':
      for (const [x, s] of [[xs[0], 1], [xs[1], -1]]) { g.beginPath(); g.moveTo(x - 3.6, y + (s > 0 ? -0.6 : 0.6)); g.lineTo(x + 3.6, y + (s > 0 ? 0.6 : -0.6)); line(2.8); }
      // a crease between the brows
      g.beginPath(); g.moveTo(FX - 3, y - 7.5); g.lineTo(FX - 0.6, y - 5.6); g.moveTo(FX + 3, y - 7.5); g.lineTo(FX + 0.6, y - 5.6); line(1.8);
      break;
    case 'teary':
      for (const x of xs) {
        ellipse(g, x, y + 0.4, 3.5, 4.3); g.fillStyle = ink; g.fill();
        g.fillStyle = '#ffffff';
        circle(g, x + 1, y - 1.3, 1.6); g.fill();
        circle(g, x - 1.3, y + 1.9, 0.9); g.fill();
        // the welling tear along the lower lid
        g.beginPath(); g.ellipse(x, y + 4.4, 3.8, 1.6, 0, 0, Math.PI); g.fillStyle = '#8fd3f2'; g.fill();
      }
      break;
    case 'sparkle':
      for (const x of xs) {
        ellipse(g, x, y - 0.3, 3.8, 4.8); g.fillStyle = ink; g.fill();
        g.fillStyle = '#ffffff';
        circle(g, x + 1.3, y - 1.9, 1.6); g.fill();
        circle(g, x - 1.3, y + 1.7, 0.9); g.fill();
      }
      break;
    case 'shock':
      for (const x of xs) {
        circle(g, x, y - 0.5, 4.2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = ink; g.stroke();
        circle(g, x, y - 0.3, 1.9); g.fillStyle = ink; g.fill();
      }
      break;
    default:
      xs.forEach(x => dot(x));
  }
}

function mouth(g, o, f) {
  const x = FX + (f.mouthDX || 0), y = EY + 8.2 + o.dy + (f.mouthY || 0), ink = f.mouthInk || f.eye || C.eye;
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = ink;
  const open = (w, h) => {
    g.beginPath(); g.moveTo(x - w, y - 0.5); g.quadraticCurveTo(x, y + h * 2, x + w, y - 0.5); g.closePath();
    g.fillStyle = '#7a3348'; g.fill();
    within(g, () => { g.beginPath(); g.moveTo(x - w, y - 0.5); g.quadraticCurveTo(x, y + h * 2, x + w, y - 0.5); g.closePath(); }, () => {
      ellipse(g, x, y + h * 1.25, w * 0.75, h * 0.7); g.fillStyle = C.tongue; g.fill();
    });
    g.lineWidth = 1.8; g.stroke();
  };
  switch (o.expr) {
    case 'sparkle': open(3.6, 3.4); break;
    case 'shock':
      ellipse(g, x, y + 1.6, 2.2, 2.8); g.fillStyle = '#7a3348'; g.fill(); g.lineWidth = 1.7; g.stroke();
      break;
    case 'hit': open(3.2, 2.6); break;
    case 'grit':
      g.beginPath(); g.moveTo(x - 3.4, y + 1); g.lineTo(x + 3.4, y + 1); g.lineWidth = 2.2; g.stroke();
      break;
    case 'teary':
      // a wobbly little ㅅ
      g.beginPath(); g.moveTo(x - 3.6, y + 2.2); g.quadraticCurveTo(x - 1.8, y - 0.4, x, y + 0.6); g.quadraticCurveTo(x + 1.8, y - 0.4, x + 3.6, y + 2.2); g.lineWidth = 2; g.stroke();
      break;
    default:
      // a small ‿ smile, well apart from the cheeks
      g.beginPath(); g.moveTo(x - 3.3, y); g.quadraticCurveTo(x, y + 3.4, x + 3.3, y); g.lineWidth = 2.1; g.stroke();
  }
}

function cheeks(g, o, f) {
  if (f.noBlush) return;
  const y = EY + 5.6 + o.dy + (f.eyeY || 0) + (f.blushY || 0);
  g.fillStyle = f.blush || 'rgba(245,128,158,0.62)';
  ellipse(g, FX - EYE_GAP - 7.5 + (f.eyeDX || 0), y, 4.4, 2.6); g.fill();
  ellipse(g, FX + EYE_GAP + 7.5 + (f.eyeDX || 0), y, 4.8, 2.8); g.fill();
}

// ---------- feet and paws ----------
// standing: both feet down; step 1 the front foot lifts, step 2 the back one
function feet(g, o, col, line) {
  const lift = [[0, 0], [0, 4], [4, 0]][o.frame], fwd = [[0, 0], [-1, 3], [-3, 1]][o.frame];
  [[CX - 15 + fwd[0], lift[0]], [CX + 15 + fwd[1], lift[1]]].forEach(([x, up]) => {
    ellipse(g, x, BOT - 1 - up, 9, 6.2); paint(g, col, { line });
  });
}
function paws(g, o, col, line, beans) {
  const sw = [0, -3, 3][o.frame];
  const P = [[CX - o.hw + 4, 72 + o.dy * 0.7 - sw], [CX + o.hw - 3, 71 + o.dy * 0.7 + sw]];
  P.forEach(([x, y], k) => {
    ellipse(g, x, y, 6.6, 6); paint(g, col, { line });
    if (beans && k === 1) { g.fillStyle = C.pink; circle(g, x + 0.6, y + 1.2, 1.7); g.fill(); }
  });
}

// ---------- parts ----------
const P = {};
// pointed ears (cat, fox) with pink insides; `tip` colours the tips (the fox's black)
P.pointy = (col, inner = C.pink, { tall = 0, tip, wide = 0 } = {}) => (g, o) => {
  const y0 = o.top + o.dy;
  for (const [bx, s] of [[CX - 20, -1], [CX + 18, 1]]) {
    const pts = [[bx - 11 - wide, y0 + 9], [bx + s * 2, y0 - 16 - tall], [bx + 11 + wide, y0 + 7]];
    g.beginPath(); g.moveTo(...pts[0]);
    g.quadraticCurveTo(pts[1][0] - 3, pts[1][1] + 4, pts[1][0], pts[1][1]);
    g.quadraticCurveTo(pts[1][0] + 3, pts[1][1] + 4, ...pts[2]); g.closePath();
    const path = () => { g.beginPath(); g.moveTo(...pts[0]); g.quadraticCurveTo(pts[1][0] - 3, pts[1][1] + 4, pts[1][0], pts[1][1]); g.quadraticCurveTo(pts[1][0] + 3, pts[1][1] + 4, ...pts[2]); g.closePath(); };
    path(); g.fillStyle = col; g.fill();
    if (tip) within(g, path, () => { g.fillStyle = tip; g.fillRect(bx - 20, y0 - 30, 40, 18 + tall * 0.4); });
    g.beginPath(); g.moveTo(bx - 5.5, y0 + 6); g.quadraticCurveTo(bx + s * 1.5, y0 - 8 - tall * 0.7, bx + 5.5, y0 + 5); g.closePath();
    g.fillStyle = inner; g.fill();
    path(); paint(g, null);
  }
};
P.round = (col, inner = C.pink, r = 8.5) => (g, o) => {
  const y0 = o.top + o.dy;
  for (const x of [CX - 22, CX + 21]) {
    circle(g, x, y0 + 4, r); paint(g, col);
    if (inner) { circle(g, x, y0 + 5, r * 0.5); g.fillStyle = inner; g.fill(); }
  }
};
P.long = (col, inner = C.pink) => (g, o) => {
  const y0 = o.top + o.dy;
  for (const [x, rot] of [[CX - 12, -0.2], [CX + 12, 0.16]]) {
    ellipse(g, x, y0 - 12, 7.5, 19, rot); paint(g, col);
    ellipse(g, x + rot * 4, y0 - 10, 3.4, 13, rot); g.fillStyle = inner; g.fill();
  }
};
// floppy dog ears hang over the sides of the head (drawn after the body)
P.floppy = (col) => (g, o) => {
  const y0 = o.top + o.dy;
  for (const [x, s] of [[CX - 26, -1], [CX + 26, 1]]) {
    g.beginPath();
    g.moveTo(x - 6 * s, y0 + 3);
    g.bezierCurveTo(x + 10 * s, y0 - 2, x + 13 * s, y0 + 16, x + 7 * s, y0 + 24);
    g.bezierCurveTo(x + 2 * s, y0 + 29, x - 6 * s, y0 + 22, x - 6 * s, y0 + 14);
    g.closePath();
    paint(g, col);
  }
};
P.batEars = (col, inner) => (g, o) => {
  const y0 = o.top + o.dy;
  for (const [bx, s] of [[CX - 19, -1], [CX + 19, 1]]) {
    g.beginPath(); g.moveTo(bx - 12, y0 + 9); g.lineTo(bx + s * 8, y0 - 17); g.lineTo(bx + 12, y0 + 7); g.closePath();
    paint(g, col);
    g.beginPath(); g.moveTo(bx - 5, y0 + 6); g.lineTo(bx + s * 5, y0 - 8); g.lineTo(bx + 5, y0 + 5); g.closePath();
    g.fillStyle = inner; g.fill();
  }
};
// tails stick out behind, on the left
P.curlTail = (col, tip) => (g, o) => {
  const y = 70 + o.dy * 0.5;
  const pts = [[CX - 24, y + 10], [CX - 36, y + 5], [CX - 39, y - 7], [CX - 33, y - 15]];
  curve(g, pts); g.lineWidth = 8 + LW * 2; g.strokeStyle = INK; g.stroke();
  curve(g, pts); g.lineWidth = 8; g.strokeStyle = col; g.stroke();
  if (tip) { circle(g, ...pts[3], 3.9); g.fillStyle = tip; g.fill(); }
};
// a big tail standing up behind the left side (fox, skunk, raccoon); `rings` bands it
const tailPath = (g, y, big) => {
  g.beginPath();
  g.moveTo(CX - 16, y + 16);
  g.bezierCurveTo(CX - 40 * big, y + 18, CX - 46 * big, y - 4, CX - 40 * big, y - 26 * big);
  g.bezierCurveTo(CX - 37 * big, y - 34 * big, CX - 30 * big, y - 36 * big, CX - 27 * big, y - 30 * big);
  g.bezierCurveTo(CX - 26, y - 14, CX - 22, y - 4, CX - 14, y);
  g.closePath();
};
P.bushyTail = (col, tip, big = 1, rings) => (g, o) => {
  const y = 72 + o.dy * 0.5, path = () => tailPath(g, y, big);
  path(); g.fillStyle = col; g.fill();
  within(g, path, () => {
    if (tip) { circle(g, CX - 34 * big, y - 33 * big, 11 * big); g.fillStyle = tip; g.fill(); }
    if (rings) {
      g.strokeStyle = rings; g.lineWidth = 5;
      for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(CX - 50, y - 18 + k * 13); g.lineTo(CX - 20, y - 26 + k * 13); g.stroke(); }
    }
  });
  path(); paint(g, null);
};
P.ringTail = (col, ring) => P.bushyTail(col, null, 1, ring);
P.pomTail = col => (g, o) => { circle(g, CX - 35, 79 + o.dy * 0.4, 7.5); paint(g, col); };
P.spikeTail = (col, spike) => (g, o) => {
  const y = 80 + o.dy * 0.4;
  g.beginPath(); g.moveTo(CX - 24, y - 8); g.quadraticCurveTo(CX - 38, y - 2, CX - 42, y - 14); g.quadraticCurveTo(CX - 36, y + 10, CX - 22, y + 6); g.closePath();
  paint(g, col);
  g.beginPath(); g.moveTo(CX - 42, y - 14); g.lineTo(CX - 44, y - 22); g.lineTo(CX - 37, y - 16); g.closePath(); paint(g, spike, { w: LW * 0.7 });
};
P.curlyTail = col => (g, o) => {
  // the chameleon's tail rolled into a spiral
  const y = 78 + o.dy * 0.4;
  g.beginPath(); g.moveTo(CX - 24, y + 4); g.quadraticCurveTo(CX - 38, y + 4, CX - 38, y - 6);
  g.arc(CX - 32, y - 6, 6, Math.PI, Math.PI * 2.6);
  g.lineWidth = 7 + LW * 2; g.strokeStyle = INK; g.stroke();
  g.lineWidth = 7; g.strokeStyle = col; g.stroke();
};
P.wings = (col, inner, flap = 0) => (g, o) => {
  const y = 62 + o.dy * 0.7 - [0, 4, -2][o.frame] * flap;
  for (const s of [-1, 1]) {
    const x = CX + s * 30;
    g.beginPath(); g.moveTo(x - s * 4, y - 6);
    g.quadraticCurveTo(x + s * 11, y - 18, x + s * 15, y - 6);
    g.quadraticCurveTo(x + s * 11, y - 2, x + s * 12, y + 4);
    g.quadraticCurveTo(x + s * 7, y + 1, x + s * 5, y + 8);
    g.quadraticCurveTo(x + s * 2, y + 4, x - s * 2, y + 8);
    g.closePath();
    paint(g, col);
    if (inner) { g.strokeStyle = inner; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + s * 11, y - 7); g.moveTo(x, y); g.lineTo(x + s * 8, y + 3); g.stroke(); }
  }
};
// the hedgehog's spines: a spiky mantle behind the whole body
P.quills = (col, tipCol) => (g, o) => {
  const top = o.top + o.dy - 6, pts = [];
  const n = 13;
  for (let k = 0; k <= n; k++) {
    const a = Math.PI * (1.02 + k / n * 0.96);
    const r = k % 2 ? 34 : 43;
    pts.push([CX - 2 + Math.cos(a) * r * 1.05, top + 40 + Math.sin(a) * r * 0.95]);
  }
  g.beginPath(); g.moveTo(CX - 40, 84);
  pts.forEach(p => g.lineTo(...p));
  g.lineTo(CX + 42, 80); g.closePath();
  g.fillStyle = col; g.fill();
  if (tipCol) { g.save(); g.clip(); g.strokeStyle = tipCol; g.lineWidth = 2; pts.forEach((p, k) => { if (k % 2 === 0) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] * 0.8 + CX * 0.2, p[1] * 0.8 + 62 * 0.2); g.stroke(); } }); g.restore(); }
  g.beginPath(); g.moveTo(CX - 40, 84); pts.forEach(p => g.lineTo(...p)); g.lineTo(CX + 42, 80); g.closePath();
  g.lineJoin = 'round'; paint(g, null);
};
P.shell = (col, rim) => (g, o) => {
  const y = 58 + o.dy * 0.6;
  ellipse(g, CX - 9, y, 37, 31); paint(g, rim);
  ellipse(g, CX - 11, y - 3, 31, 26); g.fillStyle = col; g.fill();
  g.strokeStyle = mix(col, INK, 0.35); g.lineWidth = 2;
  for (const [x, yy] of [[CX - 26, y - 8], [CX - 10, y - 18], [CX - 33, y + 8], [CX + 6, y - 22]]) {
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(x + Math.cos(a) * 7, yy + Math.sin(a) * 6); }
    g.closePath(); g.stroke();
  }
};
P.wool = (col, shadeCol) => (g, o) => {
  // a sheep's fleece: a scalloped cloud that is the body's outline
  const top = o.top + o.dy, n = 14, pts = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2;
    pts.push([CX + Math.cos(a) * (o.hw + 3), top + 31 + Math.sin(a) * 31]);
  }
  g.beginPath();
  pts.forEach((p, k) => {
    const q = pts[(k + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const nx = mx - CX, ny = my - (top + 31), d = Math.hypot(nx, ny);
    if (k === 0) g.moveTo(...p);
    g.quadraticCurveTo(mx + nx / d * 7, my + ny / d * 7, ...q);
  });
  g.closePath();
  g.fillStyle = col; g.fill();
  paint(g, null);
};
P.horns = (col, { curl = true, y = 0, back = false } = {}) => (g, o) => {
  const y0 = o.top + o.dy + y;
  for (const [x, s0] of [[CX - 20, -1], [CX + 22, 1]]) {
    const s = back ? -1 : s0;
    g.beginPath();
    if (curl) { g.arc(x + s * 5, y0 + 4, 6.5, Math.PI * 1.1, Math.PI * 2.6); g.lineWidth = 5.5 + LW * 2; g.strokeStyle = INK; g.stroke(); g.lineWidth = 5.5; g.strokeStyle = col; g.stroke(); }
    else {
      g.moveTo(x - 5, y0 + 6); g.bezierCurveTo(x - 4, y0 - 10, x + s * 8, y0 - 18, x + s * 16, y0 - 12);
      g.bezierCurveTo(x + s * 8, y0 - 10, x + 5, y0 - 4, x + 5, y0 + 6); g.closePath(); paint(g, col);
      g.strokeStyle = mix(col, INK, 0.35); g.lineWidth = 1.6;
      for (const k of [0, 1]) { g.beginPath(); g.moveTo(x - 4 + k * 2, y0 - 2 - k * 5); g.lineTo(x + 4 + k * 2, y0 - 1 - k * 5); g.stroke(); }
    }
  }
};
P.nubHorns = (col) => (g, o) => {
  const y0 = o.top + o.dy;
  for (const x of [CX - 13, CX + 17]) {
    g.beginPath(); g.moveTo(x - 5, y0 + 4); g.quadraticCurveTo(x - 1, y0 - 12, x + 2, y0 - 12); g.quadraticCurveTo(x + 5, y0 - 4, x + 5, y0 + 4); g.closePath();
    paint(g, col);
  }
};
P.frogEyes = (col) => (g, o) => {
  const y0 = o.top + o.dy;
  for (const x of [FX - EYE_GAP - 1, FX + EYE_GAP + 1]) { circle(g, x, y0 + 2, 10.5); paint(g, col); }
};
P.owlTufts = (col) => (g, o) => {
  const y0 = o.top + o.dy;
  for (const [x, s] of [[CX - 24, -1], [CX + 24, 1]]) {
    g.beginPath(); g.moveTo(x - 9, y0 + 8); g.quadraticCurveTo(x + s * 4, y0 - 2, x + s * 9, y0 - 12); g.quadraticCurveTo(x + s * 4, y0 + 6, x + 9, y0 + 9); g.closePath();
    paint(g, col);
  }
};
P.crest = (col) => (g, o) => {
  const y0 = o.top + o.dy;
  g.beginPath(); g.moveTo(CX - 18, y0 + 6);
  g.quadraticCurveTo(CX - 10, y0 - 14, CX + 2, y0 - 10);
  g.quadraticCurveTo(CX + 14, y0 - 12, CX + 18, y0 + 4);
  g.closePath(); paint(g, col);
};
P.tuft = (col) => (g, o) => {
  const y0 = o.top + o.dy;
  g.beginPath(); g.moveTo(CX - 4, y0 + 3); g.quadraticCurveTo(CX - 2, y0 - 12, CX + 6, y0 - 12); g.quadraticCurveTo(CX + 2, y0 - 6, CX + 6, y0 + 3); g.closePath(); paint(g, col);
};

// ---------- markings inside the body ----------
const M = {};
M.belly = col => (g, o) => { ellipse(g, FX - 4, 80 + o.dy * 0.4, 22, 13); g.fillStyle = col; g.fill(); };
M.muzzle = col => (g, o) => { ellipse(g, FX, EY + 9 + o.dy, 12, 7.5); g.fillStyle = col; g.fill(); };
M.lowerFace = col => (g, o) => {
  // a light lower face and chest (hamster, fox, penguin)
  g.beginPath(); g.ellipse(FX - 2, 78 + o.dy * 0.6, 30, 26, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill();
};
M.faceMask = col => (g, o) => {
  // the penguin's white face: a heart shape around the eyes
  const y = EY + o.dy;
  g.beginPath(); g.moveTo(FX, y - 4);
  g.bezierCurveTo(FX - 8, y - 16, FX - 30, y - 8, FX - 22, y + 10);
  g.bezierCurveTo(FX - 16, y + 30, FX + 16, y + 30, FX + 22, y + 10);
  g.bezierCurveTo(FX + 30, y - 8, FX + 8, y - 16, FX, y - 4);
  g.closePath(); g.fillStyle = col; g.fill();
};
M.stripes = (col, n = 3) => (g, o) => {
  const y0 = o.top + o.dy;
  g.strokeStyle = col; g.lineCap = 'round';
  // tabby marks on the forehead and down the side
  g.lineWidth = 3.4;
  for (let k = 0; k < n; k++) { g.beginPath(); g.moveTo(FX - 6 + k * 6, y0 + 2); g.lineTo(FX - 5 + k * 6, y0 + 9); g.stroke(); }
  g.lineWidth = 4;
  for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(CX - 38, 58 + k * 9 + o.dy); g.quadraticCurveTo(CX - 30, 60 + k * 9 + o.dy, CX - 26, 64 + k * 9 + o.dy); g.stroke(); }
};
M.patch = (col, x, y, rx, ry, rot = 0) => (g, o) => { ellipse(g, x, y + o.dy, rx, ry, rot); g.fillStyle = col; g.fill(); };
M.eyePatches = col => (g, o) => {
  for (const [x, rot] of [[FX - EYE_GAP - 1, 0.5], [FX + EYE_GAP + 1, -0.5]]) { ellipse(g, x, EY + 1 + o.dy, 6.2, 8, rot); g.fillStyle = col; g.fill(); }
};
M.mask = col => (g, o) => {
  // a raccoon's mask: a band across the eyes, round under each one
  const y = EY + o.dy;
  g.beginPath(); g.moveTo(CX - 40, y - 4);
  g.quadraticCurveTo(FX, y - 10, CX + 40, y - 5);
  g.lineTo(CX + 40, y + 3);
  g.quadraticCurveTo(FX + EYE_GAP + 4, y + 10, FX + 2, y + 4);
  g.quadraticCurveTo(FX - EYE_GAP - 4, y + 10, CX - 40, y + 4);
  g.closePath(); g.fillStyle = col; g.fill();
};
M.stripe = col => (g, o) => {
  // the skunk's white stripe from the nose over the head
  g.beginPath(); g.moveTo(FX - 3, EY - 4 + o.dy); g.quadraticCurveTo(FX - 8, o.top + o.dy, CX - 18, o.top + 8 + o.dy);
  g.lineWidth = 6.5; g.strokeStyle = col; g.lineCap = 'round'; g.stroke();
};
M.spots = (col, list) => (g, o) => { g.fillStyle = col; list.forEach(([x, y, r]) => { circle(g, x, y + o.dy, r); g.fill(); }); };
M.chevrons = col => (g, o) => {
  g.strokeStyle = col; g.lineWidth = 1.8;
  for (const [x, y] of [[FX - 12, 76], [FX - 2, 80], [FX + 8, 76], [FX - 7, 84], [FX + 3, 85]]) { g.beginPath(); g.moveTo(x - 2.5, y + o.dy * 0.4); g.lineTo(x, y + 2 + o.dy * 0.4); g.lineTo(x + 2.5, y + o.dy * 0.4); g.stroke(); }
};
M.spineCap = (col, light) => (g, o) => {
  // the hedgehog's spines cover its back and the top of its head; the face peeks out in front
  const y = o.dy, top = o.top + o.dy;
  g.beginPath();
  g.moveTo(CX + 44, top - 4);
  g.lineTo(CX + 44, EY - 13 + y);
  g.bezierCurveTo(FX + 10, EY - 17 + y, FX - 16, EY - 16 + y, FX - 20, EY - 2 + y);
  g.bezierCurveTo(FX - 24, EY + 14 + y, CX - 22, 84, CX - 34, 96);
  g.lineTo(CX - 50, 96); g.lineTo(CX - 50, top - 4); g.closePath();
  g.fillStyle = col; g.fill();
  g.strokeStyle = light; g.lineWidth = 2.2;
  for (const [x, yy, a] of [[CX - 26, 50, -0.5], [CX - 14, 40, -0.2], [CX + 2, 36, 0.1], [CX + 18, 37, 0.4], [CX - 30, 66, -0.8], [CX - 20, 58, -0.5]]) {
    g.beginPath(); g.moveTo(x, yy + y); g.lineTo(x + Math.sin(a) * 7, yy + y - Math.cos(a) * 7); g.stroke();
  }
};
M.disc = col => (g, o) => {
  // an owl's facial disc
  const y = EY + o.dy;
  for (const x of [FX - EYE_GAP, FX + EYE_GAP]) { circle(g, x, y + 0.5, 9.5); g.fillStyle = col; g.fill(); }
};

// ---------- things worn and carried (after the face) ----------
const W = {};
W.nose = (col = C.pink) => (g, o) => { ellipse(g, FX, EY + 5.5 + o.dy, 2.4, 1.7); g.fillStyle = col; g.fill(); };
W.bigNose = (col) => (g, o) => { ellipse(g, FX + 1, EY + 5.5 + o.dy, 4.2, 3); paint(g, col, { w: 1.8 }); };
W.beak = (col) => (g, o) => {
  const y = EY + 5 + o.dy;
  g.beginPath(); g.moveTo(FX - 4.5, y); g.quadraticCurveTo(FX, y - 2.5, FX + 4.5, y); g.quadraticCurveTo(FX + 1, y + 6, FX, y + 6); g.quadraticCurveTo(FX - 1, y + 6, FX - 4.5, y); g.closePath();
  paint(g, col, { w: 1.8 });
};
W.scarf = (col, dark, knot = true) => (g, o) => {
  const y = 69 + o.dy * 0.8;
  g.beginPath(); g.moveTo(CX - 34, y - 2); g.quadraticCurveTo(FX, y + 9, CX + 36, y - 3);
  g.lineTo(CX + 36, y + 4); g.quadraticCurveTo(FX, y + 16, CX - 34, y + 5); g.closePath();
  paint(g, col);
  if (knot) {
    g.beginPath(); g.moveTo(CX - 26, y + 6); g.lineTo(CX - 33, y + 18); g.lineTo(CX - 22, y + 17); g.closePath(); paint(g, dark || col);
  }
};
W.bow = (col) => (g, o) => {
  const x = FX - 1, y = 70 + o.dy * 0.8;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 8, y - 5); g.lineTo(x + s * 8, y + 5); g.closePath(); paint(g, col, { w: LW * 0.8 }); }
  circle(g, x, y, 2.8); paint(g, col, { w: LW * 0.8 });
};
W.ruff = (col, alt) => (g, o) => {
  // an acrobat's frilly collar
  const y = 69 + o.dy * 0.8;
  for (let k = 0; k < 6; k++) {
    const x = CX - 26 + k * 10.5;
    g.beginPath(); g.moveTo(x - 6, y - 1 + Math.abs(k - 2.5)); g.lineTo(x, y + 8 + Math.abs(k - 2.5) * 0.4); g.lineTo(x + 6, y - 1 + Math.abs(k - 2.5)); g.closePath();
    paint(g, k % 2 ? alt : col, { w: LW * 0.75 });
  }
};
W.strawHat = (g, o) => {
  const y = o.top + o.dy + 4;
  ellipse(g, CX + 2, y + 2, 38, 8.5); paint(g, '#f2cf7e');
  g.beginPath(); g.moveTo(CX - 18, y + 1); g.quadraticCurveTo(CX - 17, y - 17, CX + 3, y - 17); g.quadraticCurveTo(CX + 22, y - 17, CX + 22, y + 1); g.closePath();
  paint(g, '#f6d98e');
  g.beginPath(); g.moveTo(CX - 18, y - 4); g.quadraticCurveTo(CX + 2, y - 1, CX + 22, y - 4); g.lineTo(CX + 22, y + 1); g.quadraticCurveTo(CX + 2, y + 4, CX - 18, y + 1); g.closePath();
  paint(g, C.red, { w: LW * 0.7 });
  g.strokeStyle = '#d9ab5a'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(CX - 30, y + 3); g.lineTo(CX + 30, y + 3); g.stroke();
};
W.witchHat = (col, dots, band) => (g, o) => {
  const y = o.top + o.dy + 4;
  ellipse(g, CX + 2, y + 2, 36, 8); paint(g, col);
  g.beginPath(); g.moveTo(CX - 17, y + 2);
  g.quadraticCurveTo(CX - 6, y - 14, CX + 6, y - 26);
  g.quadraticCurveTo(CX + 16, y - 34, CX + 28, y - 26);
  g.quadraticCurveTo(CX + 16, y - 24, CX + 14, y - 12);
  g.quadraticCurveTo(CX + 19, y - 2, CX + 21, y + 2);
  g.closePath(); paint(g, col);
  g.fillStyle = dots;
  for (const [x, yy, r] of [[CX - 6, y - 4, 2.2], [CX + 8, y - 13, 1.9], [CX + 10, y - 1, 1.7], [CX + 23, y - 27, 1.6]]) { circle(g, x, yy, r); g.fill(); }
  if (band) { g.beginPath(); g.moveTo(CX - 16, y - 1); g.quadraticCurveTo(CX + 2, y + 2, CX + 20, y - 1); g.lineWidth = 3.6; g.strokeStyle = band; g.stroke(); }
};
W.helmet = (col, plume) => (g, o) => {
  const y = o.top + o.dy + 8;
  g.beginPath(); g.moveTo(CX - 30, y + 6); g.quadraticCurveTo(CX - 30, y - 18, CX + 2, y - 18); g.quadraticCurveTo(CX + 33, y - 18, CX + 33, y + 6);
  g.quadraticCurveTo(CX + 2, y + 1, CX - 30, y + 6); g.closePath();
  paint(g, col);
  g.fillStyle = 'rgba(255,255,255,0.7)'; ellipse(g, CX - 14, y - 9, 6, 3, -0.4); g.fill();
  if (plume) {
    g.beginPath(); g.moveTo(CX - 2, y - 17); g.quadraticCurveTo(CX - 14, y - 34, CX + 6, y - 30); g.quadraticCurveTo(CX + 8, y - 22, CX + 6, y - 17); g.closePath();
    paint(g, plume);
  }
};
W.hardHat = (col, lamp) => (g, o) => {
  const y = o.top + o.dy + 7;
  g.beginPath(); g.moveTo(CX - 27, y + 3); g.quadraticCurveTo(CX - 26, y - 19, CX + 2, y - 19); g.quadraticCurveTo(CX + 30, y - 19, CX + 30, y + 3); g.closePath();
  paint(g, col);
  g.beginPath(); g.moveTo(CX - 31, y + 3); g.lineTo(CX + 38, y + 1); g.lineWidth = 5 + LW * 2; g.strokeStyle = INK; g.stroke(); g.lineWidth = 5; g.strokeStyle = col; g.stroke();
  g.beginPath(); g.moveTo(CX + 2, y - 18); g.lineTo(CX + 2, y + 1); g.lineWidth = 2; g.strokeStyle = mix(col, INK, 0.3); g.stroke();
  if (lamp) { circle(g, CX + 14, y - 8, 4.6); paint(g, lamp, { w: LW * 0.7 }); }
};
W.cap = (col, peak) => (g, o) => {
  const y = o.top + o.dy + 7;
  g.beginPath(); g.moveTo(CX - 24, y + 1); g.quadraticCurveTo(CX - 22, y - 14, CX + 2, y - 14); g.quadraticCurveTo(CX + 24, y - 14, CX + 25, y + 1); g.closePath();
  paint(g, col);
  g.beginPath(); g.moveTo(CX + 14, y); g.quadraticCurveTo(CX + 32, y - 3, CX + 40, y + 3); g.quadraticCurveTo(CX + 28, y + 6, CX + 14, y + 4); g.closePath();
  paint(g, peak || col);
};
W.deerstalker = (col, check) => (g, o) => {
  const y = o.top + o.dy + 7;
  g.beginPath(); g.moveTo(CX - 26, y + 2); g.quadraticCurveTo(CX - 24, y - 17, CX + 2, y - 17); g.quadraticCurveTo(CX + 28, y - 17, CX + 28, y + 2); g.closePath();
  g.fillStyle = col; g.fill();
  within(g, () => { g.beginPath(); g.moveTo(CX - 26, y + 2); g.quadraticCurveTo(CX - 24, y - 17, CX + 2, y - 17); g.quadraticCurveTo(CX + 28, y - 17, CX + 28, y + 2); g.closePath(); }, () => {
    g.strokeStyle = check; g.lineWidth = 2;
    for (let k = -30; k < 40; k += 8) { g.beginPath(); g.moveTo(CX + k, y - 20); g.lineTo(CX + k, y + 4); g.stroke(); g.beginPath(); g.moveTo(CX - 30, y - 16 + (k + 30) / 4); g.lineTo(CX + 30, y - 16 + (k + 30) / 4); g.stroke(); }
  });
  g.beginPath(); g.moveTo(CX - 26, y + 2); g.quadraticCurveTo(CX - 24, y - 17, CX + 2, y - 17); g.quadraticCurveTo(CX + 28, y - 17, CX + 28, y + 2); g.closePath(); paint(g, null);
  g.beginPath(); g.moveTo(CX + 20, y + 1); g.quadraticCurveTo(CX + 34, y - 1, CX + 38, y + 4); g.quadraticCurveTo(CX + 28, y + 7, CX + 20, y + 5); g.closePath(); paint(g, col);
  circle(g, CX + 2, y - 18, 3); paint(g, col, { w: LW * 0.7 });
};
W.sailor = (col, band) => (g, o) => {
  const y = o.top + o.dy + 2;
  g.beginPath(); g.moveTo(CX - 16, y + 4); g.lineTo(CX - 13, y - 9); g.quadraticCurveTo(CX + 3, y - 14, CX + 19, y - 9); g.lineTo(CX + 22, y + 4); g.closePath();
  paint(g, col);
  g.beginPath(); g.moveTo(CX - 15, y); g.quadraticCurveTo(CX + 3, y - 3, CX + 21, y); g.lineWidth = 3.4; g.strokeStyle = band; g.stroke();
};
W.leaf = (col) => (g, o) => {
  const y = o.top + o.dy + 1;
  g.beginPath(); g.moveTo(CX + 2, y + 2); g.lineTo(CX + 2, y - 6); g.lineWidth = 2 + LW; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2; g.strokeStyle = C.leafShade; g.stroke();
  for (const s of [-1, 1]) { ellipse(g, CX + 2 + s * 7, y - 9, 8, 4.4, s * -0.5); paint(g, col, { w: LW * 0.8 }); }
};
W.headband = (col) => (g, o) => {
  const y = o.top + o.dy + 9;
  g.beginPath(); g.moveTo(CX - 31, y + 4); g.quadraticCurveTo(CX, y - 6, CX + 32, y + 3); g.lineTo(CX + 33, y + 10); g.quadraticCurveTo(CX, y + 1, CX - 32, y + 11); g.closePath();
  paint(g, col, { w: LW * 0.8 });
  g.beginPath(); g.moveTo(CX - 31, y + 6); g.lineTo(CX - 42, y + 2); g.lineTo(CX - 40, y + 12); g.closePath(); paint(g, col, { w: LW * 0.8 });
};
W.goggles = (strap, lens) => (g, o) => {
  const y = o.top + o.dy + 9;
  g.beginPath(); g.moveTo(CX - 32, y + 3); g.quadraticCurveTo(CX, y - 5, CX + 34, y + 2); g.lineWidth = 4.5 + LW; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4.5; g.strokeStyle = strap; g.stroke();
  for (const x of [FX - 9, FX + 9]) { circle(g, x, y - 1, 6); paint(g, lens, { w: LW * 0.8 }); g.fillStyle = 'rgba(255,255,255,0.8)'; circle(g, x - 2, y - 3, 1.8); g.fill(); }
};
W.mustache = (col) => (g, o) => {
  const y = EY + 7 + o.dy;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(FX, y); g.quadraticCurveTo(FX + s * 6, y - 3, FX + s * 12, y + 2); g.quadraticCurveTo(FX + s * 6, y + 4, FX, y + 2); g.closePath(); paint(g, col, { w: LW * 0.6 }); }
};
W.beard = (col) => (g, o) => {
  const y = EY + 12 + o.dy;
  g.beginPath(); g.moveTo(FX - 4, y); g.quadraticCurveTo(FX, y + 12, FX + 2, y + 13); g.quadraticCurveTo(FX + 3, y + 6, FX + 5, y); g.closePath(); paint(g, col, { w: LW * 0.7 });
};
W.fangs = (g, o) => {
  const y = EY + 9.6 + o.dy;
  g.fillStyle = '#ffffff'; g.strokeStyle = C.eye; g.lineWidth = 1;
  for (const x of [FX - 2.4, FX + 2.4]) { g.beginPath(); g.moveTo(x - 1.4, y); g.lineTo(x, y + 3); g.lineTo(x + 1.4, y); g.closePath(); g.fill(); g.stroke(); }
};
W.collar = (col, gem) => (g, o) => {
  const y = 70 + o.dy * 0.8;
  g.beginPath(); g.moveTo(CX - 32, y - 3); g.quadraticCurveTo(FX, y + 7, CX + 34, y - 4); g.lineWidth = 4.6 + LW; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4.6; g.strokeStyle = col; g.stroke();
  if (gem) { circle(g, FX - 2, y + 4.4, 3.6); paint(g, gem, { w: LW * 0.6 }); }
};
W.cape = (col, inner) => (g, o) => {
  // a cape's high collar standing behind the head (drawn before the body)
  const y = 66 + o.dy * 0.8;
  g.beginPath(); g.moveTo(CX - 40, y + 26); g.lineTo(CX - 44, y - 10); g.quadraticCurveTo(CX - 30, y - 2, CX, y); g.quadraticCurveTo(CX + 30, y - 2, CX + 44, y - 10); g.lineTo(CX + 40, y + 26); g.closePath();
  paint(g, col);
  if (inner) { g.beginPath(); g.moveTo(CX - 38, y + 20); g.lineTo(CX - 40, y - 4); g.quadraticCurveTo(CX - 30, y + 2, CX - 22, y + 4); g.closePath(); g.fillStyle = inner; g.fill(); }
};
W.shield = (col, rim) => (g, o) => {
  const x = CX + 33, y = 75 + o.dy * 0.6 + [0, 2, -2][o.frame];
  g.beginPath(); g.moveTo(x - 10, y - 11); g.quadraticCurveTo(x, y - 14, x + 10, y - 11); g.quadraticCurveTo(x + 11, y + 6, x, y + 13); g.quadraticCurveTo(x - 11, y + 6, x - 10, y - 11); g.closePath();
  paint(g, rim);
  g.beginPath(); g.moveTo(x - 6, y - 7); g.quadraticCurveTo(x, y - 9, x + 6, y - 7); g.quadraticCurveTo(x + 6.5, y + 4, x, y + 8.5); g.quadraticCurveTo(x - 6.5, y + 4, x - 6, y - 7); g.closePath();
  g.fillStyle = col; g.fill();
};
W.lantern = (g, o) => {
  const x = CX + 38, y = 74 + o.dy * 0.6 + [0, 2, -2][o.frame];
  g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x, y - 9); g.lineWidth = 2 + LW * 0.8; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.roundRect(x - 6.5, y - 9, 13, 16, 4); paint(g, '#ffe58a', { w: LW * 0.8 });
  g.fillStyle = '#fff6c8'; ellipse(g, x, y - 1, 3, 4.5); g.fill();
  g.beginPath(); g.moveTo(x - 8, y - 9); g.lineTo(x + 8, y - 9); g.moveTo(x - 8, y + 7); g.lineTo(x + 8, y + 7); g.lineWidth = 3.4; g.strokeStyle = INK; g.stroke();
};
W.pick = (g, o) => {
  const x = CX + 36, y = 70 + o.dy * 0.6 + [0, 2, -2][o.frame];
  g.beginPath(); g.moveTo(x - 4, y + 14); g.lineTo(x + 4, y - 10); g.lineWidth = 3.6 + LW * 1.4; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3.6; g.strokeStyle = '#c9905a'; g.stroke();
  g.beginPath(); g.moveTo(x - 9, y - 9); g.quadraticCurveTo(x + 4, y - 18, x + 16, y - 6); g.quadraticCurveTo(x + 4, y - 12, x - 9, y - 6); g.closePath(); paint(g, '#c8cad6', { w: LW * 0.8 });
};
W.bag = (col, strap) => (g, o) => {
  // a satchel on a strap across the chest
  const y = o.dy * 0.7;
  g.beginPath(); g.moveTo(CX + 30, 62 + y); g.quadraticCurveTo(CX + 4, 72 + y, CX - 22, 84 + y); g.lineWidth = 3.4 + LW; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3.4; g.strokeStyle = strap; g.stroke();
  g.beginPath(); g.roundRect(CX - 36, 76 + y, 22, 15, 5); paint(g, col, { w: LW * 0.85 });
  g.beginPath(); g.moveTo(CX - 36, 82 + y); g.quadraticCurveTo(CX - 25, 88 + y, CX - 14, 82 + y); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
};
W.pack = (col, flap) => (g, o) => {
  // a big pack on the back, sticking out on the left (drawn before the body)
  const y = 50 + o.dy * 0.6;
  g.beginPath(); g.roundRect(CX - 43, y, 26, 30, 8); paint(g, col);
  g.beginPath(); g.roundRect(CX - 45, y - 3, 30, 11, 5); paint(g, flap);
};
W.apron = (col) => (g, o) => {
  const y = 66 + o.dy * 0.7;
  g.beginPath(); g.moveTo(FX - 16, y); g.lineTo(FX + 14, y); g.quadraticCurveTo(FX + 20, y + 16, FX + 14, y + 25); g.lineTo(FX - 18, y + 25); g.quadraticCurveTo(FX - 22, y + 14, FX - 16, y); g.closePath();
  paint(g, col, { w: LW * 0.8 });
  g.beginPath(); g.roundRect(FX - 7, y + 9, 12, 8, 2); g.lineWidth = 1.8; g.strokeStyle = mix(col, INK, 0.4); g.stroke();
};
W.overalls = (col) => (g, o) => {
  const y = 70 + o.dy * 0.7;
  g.beginPath(); g.moveTo(CX - 30, y); g.lineTo(CX + 32, y - 1); g.lineTo(CX + 36, 92); g.lineTo(CX - 34, 92); g.closePath();
  g.save(); g.clip();
  // the body's lower curve keeps it inside
  g.restore();
};
W.mailCap = W.cap;
W.cross = (g, o) => {
  const x = CX + 2, y = o.top + o.dy - 2;
  g.fillStyle = '#ffffff';
  g.fillRect(x - 2, y - 5, 4, 10); g.fillRect(x - 5, y - 2, 10, 4);
};
W.star = (col) => (g, o) => {
  const x = FX - 2, y = 72 + o.dy * 0.8, r = 6.5;
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); paint(g, col, { w: LW * 0.7 });
};
W.turrets = (col) => (g, o) => {
  for (const x of [FX - EYE_GAP, FX + EYE_GAP]) { circle(g, x, EY - 0.5 + o.dy, 7.4); paint(g, col, { w: LW * 0.6 }); }
};
W.cheekPuffs = (col) => (g, o) => {
  for (const x of [FX - 22, FX + 22]) { ellipse(g, x, EY + 9 + o.dy, 9, 7.5); g.fillStyle = col; g.fill(); }
};

// ---------- the cast ----------
// body: fill colour, shade: multiply colour, foot/paw colours default to the body's
const S = (o) => ({ hw: HW, top: TOP, back: [], marks: [], front: [], wear: [], face: {}, ...o });
export const FOLK = {
  // 일꾼: a white cat in a straw hat, the plain start
  adv: S({ body: C.white, back: [P.pointy(C.white), P.curlTail(C.white)], marks: [M.patch('#f2b27a', CX - 22, TOP + 6, 9, 7, 0.3)], wear: [W.nose(), W.strawHat], beans: true }),
  // 도적: a raccoon with a mask, a ringed tail and a blue bandana
  rogue: S({ body: '#bdb9c9', shadeCol: '#cfc4d4', back: [P.round('#bdb9c9', '#8f8aa3', 8), P.ringTail('#bdb9c9', '#5f5873')], marks: [M.mask('#6a6283'), M.muzzle('#f3eee8')], face: { blush: 'rgba(245,128,158,0.5)' }, wear: [W.nose(INK), W.scarf('#5b8de0', '#3a62b3')] }),
  // 마법사: a sheep in a purple witch's hat
  mage: S({ body: '#f6e6cf', wool: '#f8f2fb', back: [P.horns('#e8c48f'), P.pomTail('#f8f2fb')], woolly: true, wear: [W.witchHat('#8a6cc8', '#d9c8f2', '#ffd45a')], foot: '#6e4659' }),
  // 기사: a puppy in a steel helmet with a blue plume, and a little shield
  knightP: S({ body: '#f2d4a4', back: [P.pomTail('#f2d4a4')], marks: [M.muzzle('#fbf1e2')], wear: [W.bigNose(INK), W.helmet('#c8cad6', '#5b8de0'), P.floppy('#c98a55'), W.shield('#5b8de0', '#ffd45a')] }),
  // 흡혈귀: a little bat in a red-lined cape
  vamp: S({ body: '#c9b6ea', shadeCol: '#d4c4e6', back: [P.wings('#8a6cc0', '#6a4ea0', 1), P.batEars('#c9b6ea', '#f0a7c8')], wear: [W.fangs, W.collar(C.red, C.gold)] }),

  hero_rabbit: S({ body: C.white, back: [P.long(C.white), P.pomTail(C.white)], wear: [W.nose(), W.bag('#5b8de0', '#b5774a'), W.cap('#5b8de0', '#3a62b3')] }),
  hero_hamster: S({ body: '#f2b26b', hw: 39, back: [P.round('#f2b26b', C.pink, 7.5)], marks: [M.lowerFace('#fbf1e2')], wear: [W.nose(), W.cheekPuffs('rgba(255,255,255,0.0)')], face: { eyeY: -1 }, backpack: true, pre: [W.pack('#8fd06a', '#5ea64a')] }),
  hero_cat: S({ body: C.orange, shadeCol: '#e9c0c8', back: [P.pointy(C.orange), P.curlTail(C.orange, C.cream)], marks: [M.stripes(C.orangeShade), M.muzzle('#fbf1e2'), M.belly('#fbf1e2')], wear: [W.nose(), W.bow(C.red)], beans: true }),
  hero_hedgehog: S({ body: '#f3dfc1', shadeCol: '#ddc8cc', pre: [P.quills('#8a5a3c', null)], back: [P.round('#f3dfc1', C.pink, 6.5)], marks: [M.spineCap('#9a6a48', '#c9905a')], wear: [W.bigNose(INK), W.lantern] }),
  hero_owl: S({ body: '#d9a86c', shadeCol: '#e3c3b8', back: [P.owlTufts('#d9a86c'), P.wings('#b5824f', null)], marks: [M.disc('#f6e6cf'), M.belly('#f6e6cf'), M.chevrons('#b5824f')], wear: [W.beak('#ffc04a')], face: { noBlush: false } }),
  hero_fox: S({ body: '#f08a4b', shadeCol: '#e9c0c8', back: [P.pointy('#f08a4b', '#fbf1e2', { tall: 4, tip: '#5a3a33', wide: 1 }), P.bushyTail('#f08a4b', '#fbf6ee')], marks: [M.lowerFace('#fbf6ee')], wear: [W.nose(INK), W.deerstalker('#b5774a', '#8e5636')] }),
  hero_frog: S({ body: '#8fd06a', shadeCol: '#cfd9c4', back: [P.frogEyes('#8fd06a')], marks: [M.belly('#eef5c4')], wear: [W.scarf('#ffd45a', '#e5ab2e')], face: { eyeY: -21, blushY: 18 } }),
  hero_panda: S({ body: C.white, back: [P.round('#4a3d4f', null, 9)], marks: [M.eyePatches('#5d4f63')], face: { eye: '#1c1219' }, wear: [W.nose(INK), W.leaf('#8fd06a'), W.scarf('#8fd06a', '#5ea64a')], foot: '#4a3d4f', paw: '#4a3d4f' }),
  hero_turtle: S({ body: '#a8dc8a', shadeCol: '#cfd9c4', hw: 31, top: 37, pre: [P.shell('#c98a55', '#8e5636')], marks: [M.belly('#f2efc4')], wear: [W.headband(C.red)] }),
  hero_mole: S({ body: '#9b7564', shadeCol: '#d6c2cc', back: [P.round('#9b7564', null, 5)], marks: [M.muzzle('#d9b8a8')], wear: [W.bigNose('#f4a7b9'), W.hardHat('#ffd45a', '#fff6c8'), W.pick], paw: '#f4a7b9', face: { eye: '#2a1620' } }),
  hero_penguin: S({ body: '#4f5a7e', shadeCol: '#cfc9de', back: [P.tuft('#4f5a7e')], marks: [M.faceMask('#fbf6ee'), M.belly('#fbf6ee')], wear: [W.beak('#ffa64a'), W.goggles('#8e5636', '#8fd3f2'), W.scarf(C.red, C.redShade)], foot: '#ffa64a' }),
  hero_bear: S({ body: '#b5774a', shadeCol: '#dcc0c0', back: [P.round('#b5774a', '#e8c48f', 9)], marks: [M.muzzle('#e8c48f'), M.belly('#d9a06c')], wear: [W.bigNose(INK), W.headband('#5b8de0')] }),
  hero_goat: S({ body: C.white, back: [P.horns('#d9c4a0', { curl: false, y: 2, back: true }), P.pomTail(C.white)], wear: [W.nose(), W.beard('#d9d2cc'), W.collar('#e8555e', '#ffd45a')], face: {} }),
  hero_dragon: S({ body: '#9fe0c4', shadeCol: '#cad6d6', back: [P.nubHorns('#ffd45a'), P.wings('#6fbea3', '#4f9a84', 0.6), P.spikeTail('#9fe0c4', '#ffd45a')], marks: [M.belly('#f6eec4'), M.spots('#7fcbb0', [[CX - 30, 50, 3], [CX - 26, 42, 2.4], [CX + 30, 44, 2.2]])], wear: [W.nose('#5fae94')] }),
  hero_skunk: S({ body: '#5a5070', shadeCol: '#cfc6dd', back: [P.round('#5a5070', '#f4a7b9', 7), P.bushyTail('#5a5070', '#fbf6ee', 1.1)], marks: [M.stripe('#fbf6ee'), M.muzzle('#fbf6ee')], face: { eye: '#1c1219' }, wear: [W.nose(INK), W.bow('#f4a7b9')] }),
  hero_chameleon: S({ body: '#a6d86a', shadeCol: '#d0d9c4', under: [W.turrets('#a6d86a')], back: [P.crest('#7fbf4a'), P.curlyTail('#a6d86a')], marks: [M.belly('#e6f2b0'), M.spots('#86c255', [[CX - 26, 46, 3.4], [CX - 30, 62, 2.6], [CX + 26, 40, 2.4]])], wear: [W.scarf('#9a6fd6', '#7049ad')] }),

  // the village
  guildBoss: S({ body: '#a8714a', shadeCol: '#dcc0c0', hw: 40, top: 27, back: [P.round('#a8714a', '#e8c48f', 9.5)], marks: [M.muzzle('#e8c48f')], wear: [W.bigNose(INK), W.mustache('#5a3a33'), W.scarf('#5b8de0', '#3a62b3', false), W.star('#ffd45a')] }),
  shopkeep: S({ body: C.white, back: [P.pointy(C.white, C.pink), P.curlTail('#f29a52')], marks: [M.patch('#f29a52', CX - 20, TOP + 8, 12, 10, 0.4), M.patch('#5a4a4f', CX + 26, TOP + 18, 9, 8, -0.3)], wear: [W.nose(), W.apron('#5b8de0')] }),
  neighbor: S({ body: C.white, back: [P.long(C.white), P.pomTail(C.white)], wear: [W.nose(), W.scarf('#8fd3f2', '#4ea6d6')] }),
  rescuer: S({ body: '#c98a55', shadeCol: '#dcc0c0', back: [P.pomTail('#c98a55')], marks: [M.muzzle('#f6e3c3')], wear: [W.bigNose(INK), W.cap('#fbf6ee', C.red), W.cross, P.floppy('#8e5636'), W.bag(C.red, '#8e5636')] }),
  rival: S({ body: '#46405a', shadeCol: '#c9c2d8', back: [P.pointy('#46405a', '#c98aa0'), P.curlTail('#46405a')], face: { eye: '#ffe08a', blush: 'rgba(245,128,158,0.45)', mouthInk: '#fbe9c8' }, wear: [W.nose('#f4a7b9'), W.scarf('#5b8de0', '#3a62b3')] }),
  peddler: S({ body: C.white, pre: [W.pack('#c98a55', '#8e5636')], back: [P.pointy(C.white), P.curlTail('#f29a52')], marks: [M.patch('#f29a52', CX - 20, TOP + 8, 12, 10, 0.4)], wear: [W.nose(), W.scarf('#8fd06a', '#5ea64a')] }),
};

// the characters whose faces change (heroes; the village keeps one face)
export const HERO_KEYS = ['adv', 'rogue', 'mage', 'knightP', 'vamp', 'hero_rabbit', 'hero_hamster', 'hero_cat', 'hero_hedgehog', 'hero_owl', 'hero_fox', 'hero_frog', 'hero_panda', 'hero_turtle', 'hero_mole', 'hero_penguin', 'hero_bear', 'hero_goat', 'hero_dragon', 'hero_skunk', 'hero_chameleon'];

export function drawFolk(g, spec, frame = 0, expr = '') {
  const o = { frame, expr, dy: frame ? -2.5 : 0, top: spec.top, hw: spec.hw };
  const line = INK, foot = spec.foot || spec.body, paw = spec.paw || spec.body;
  g.lineJoin = 'round'; g.lineCap = 'round';
  // a soft round shadow on the ground
  ellipse(g, CX, BOT + 3, 34, 5); g.fillStyle = 'rgba(60,30,50,0.18)'; g.fill();
  (spec.pre || []).forEach(f => f(g, o));
  spec.back.forEach(f => f(g, o));
  feet(g, o, foot, line);
  if (spec.woolly) {
    P.wool(spec.wool, null)(g, o);
    // the sheep's face: a cream oval on the fleece
    const path = () => { ellipse(g, FX - 1, EY + 5 + o.dy, 24, 20); };
    path(); g.fillStyle = spec.body; g.fill();
    within(g, path, () => shade(g, FX + 3, EY + 2 + o.dy, 23, 19));
    path(); paint(g, null, { w: LW * 0.7 });
  } else {
    bodyPath(g, o); g.fillStyle = spec.body; g.fill();
    within(g, () => bodyPath(g, o), () => {
      spec.marks.forEach(f => f(g, o));
      const top = o.top + o.dy, h = BOT - top;
      shade(g, CX + 7, top + h * 0.44, o.hw - 1, h * 0.5 - 1, spec.shadeCol);
    });
    bodyPath(g, o); paint(g, null);
  }
  (spec.under || []).forEach(f => f(g, o));
  cheeks(g, o, spec.face);
  eyes(g, o, spec.face);
  mouth(g, o, spec.face);
  paws(g, o, paw, line, spec.beans);
  spec.wear.forEach(f => f(g, o));
}

// A pet trots behind you: small, round and simple.
export const PET_ART = {
  pet_chick: (g, f) => {
    const y = f ? -2 : 0;
    ellipse(g, 50, 93, 20, 3.5); g.fillStyle = 'rgba(60,30,50,0.18)'; g.fill();
    for (const x of [44, 56]) { g.beginPath(); g.moveTo(x - 4, 92); g.lineTo(x, 86); g.lineTo(x + 4, 92); g.lineWidth = 2.6 + LW; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.6; g.strokeStyle = '#ffa64a'; g.stroke(); }
    const body = () => { g.beginPath(); g.moveTo(50, 58 + y); g.bezierCurveTo(68, 58 + y, 74, 72 + y, 72, 80 + y); g.bezierCurveTo(70, 90 + y, 30, 90 + y, 28, 80 + y); g.bezierCurveTo(26, 70 + y, 32, 58 + y, 50, 58 + y); g.closePath(); };
    g.beginPath(); g.moveTo(48, 60 + y); g.quadraticCurveTo(46, 50 + y, 52, 50 + y); g.quadraticCurveTo(50, 55 + y, 54, 60 + y); paint(g, C.yellow);
    body(); g.fillStyle = C.yellow; g.fill();
    within(g, body, () => shade(g, 54, 70 + y, 21, 15));
    body(); paint(g, null);
    ellipse(g, 38, 76 + y, 7, 5, -0.5); paint(g, '#ffe48a', { w: LW * 0.8 });
    for (const x of [48, 61]) { ellipse(g, x, 70 + y, 2.3, 3); g.fillStyle = C.eye; g.fill(); }
    g.beginPath(); g.moveTo(52, 74 + y); g.lineTo(58, 74 + y); g.lineTo(55, 78 + y); g.closePath(); paint(g, '#ffa64a', { w: 1.6 });
    g.fillStyle = 'rgba(245,128,158,0.6)'; ellipse(g, 66, 76 + y, 3.4, 2); g.fill();
  },
  pet_butterfly: (g, f) => {
    const y = f ? -4 : 0;
    ellipse(g, 50, 93, 14, 3); g.fillStyle = 'rgba(60,30,50,0.14)'; g.fill();
    const open = f ? 0.7 : 1;
    for (const s of [-1, 1]) {
      ellipse(g, 50 + s * 13 * open, 56 + y, 13 * open, 11, s * 0.4); paint(g, '#f4a7c8');
      ellipse(g, 50 + s * 10 * open, 72 + y, 9 * open, 8, s * -0.3); paint(g, '#c9b6ea');
      g.fillStyle = '#ffffff'; circle(g, 50 + s * 15 * open, 54 + y, 3 * open); g.fill();
    }
    ellipse(g, 50, 64 + y, 4.2, 14); paint(g, '#6e4659');
    g.beginPath(); g.moveTo(48, 51 + y); g.quadraticCurveTo(44, 42 + y, 40, 42 + y); g.moveTo(52, 51 + y); g.quadraticCurveTo(56, 42 + y, 60, 42 + y); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
  },
  pet_ladybug: (g, f) => {
    const y = f ? -1.5 : 0;
    ellipse(g, 50, 92, 22, 3.5); g.fillStyle = 'rgba(60,30,50,0.18)'; g.fill();
    circle(g, 70, 78 + y, 8); paint(g, '#4a3d4f');
    for (const x of [67, 73]) { g.fillStyle = '#ffffff'; circle(g, x, 77 + y, 2); g.fill(); g.fillStyle = C.eye; circle(g, x + 0.5, 77.5 + y, 1.1); g.fill(); }
    const shellP = () => { g.beginPath(); g.moveTo(28, 88); g.bezierCurveTo(26, 60 + y, 66, 58 + y, 68, 88); g.closePath(); };
    shellP(); g.fillStyle = C.red; g.fill();
    within(g, shellP, () => { g.fillStyle = '#4a3d4f'; [[38, 76], [56, 72], [48, 84], [60, 83]].forEach(([x, yy]) => { circle(g, x, yy + y, 3.6); g.fill(); }); shade(g, 52, 70 + y, 20, 16); });
    shellP(); paint(g, null);
    g.beginPath(); g.moveTo(48, 64 + y); g.lineTo(48, 88); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  },
  pet_cloud: (g, f) => {
    const y = f ? -3 : 0;
    ellipse(g, 50, 93, 18, 3); g.fillStyle = 'rgba(60,30,50,0.12)'; g.fill();
    g.strokeStyle = '#8fd3f2'; g.lineWidth = 2.4;
    for (const x of [40, 50, 60]) { g.beginPath(); g.moveTo(x, 84 + (f ? 2 : 0)); g.lineTo(x - 1, 88 + (f ? 2 : 0)); g.stroke(); }
    const puff = () => {
      g.beginPath();
      g.moveTo(28, 76 + y);
      g.bezierCurveTo(22, 70 + y, 28, 60 + y, 36, 62 + y);
      g.bezierCurveTo(38, 50 + y, 58, 48 + y, 62, 60 + y);
      g.bezierCurveTo(72, 56 + y, 80, 68 + y, 72, 76 + y);
      g.closePath();
    };
    puff(); g.fillStyle = '#ffffff'; g.fill();
    within(g, puff, () => shade(g, 54, 64 + y, 26, 13, '#dfe3f0'));
    puff(); paint(g, null);
    for (const x of [44, 56]) { ellipse(g, x, 67 + y, 2, 2.6); g.fillStyle = C.eye; g.fill(); }
    g.fillStyle = 'rgba(245,128,158,0.6)'; ellipse(g, 38, 71 + y, 3.4, 2); g.fill(); ellipse(g, 62, 71 + y, 3.4, 2); g.fill();
  },
  pet_snail: (g, f) => {
    const y = f ? -1 : 0, s = f ? 2 : 0;
    ellipse(g, 50, 92, 26, 3.5); g.fillStyle = 'rgba(60,30,50,0.16)'; g.fill();
    g.beginPath(); g.moveTo(24, 90); g.quadraticCurveTo(24, 82, 34, 82); g.lineTo(70 + s, 80); g.quadraticCurveTo(80 + s, 70, 76 + s, 64);
    g.lineTo(70 + s, 64); g.quadraticCurveTo(68 + s, 80, 60, 86); g.lineTo(28, 90); g.closePath();
    g.beginPath(); g.moveTo(22, 90); g.quadraticCurveTo(22, 82, 34, 82); g.lineTo(66 + s, 82); g.quadraticCurveTo(78 + s, 80, 78 + s, 64); g.quadraticCurveTo(70 + s, 58, 66 + s, 66); g.quadraticCurveTo(66 + s, 76, 58, 78); g.lineTo(34, 78); g.quadraticCurveTo(20, 80, 22, 90); g.closePath();
    paint(g, '#f6dcc0');
    for (const [x, yy] of [[70, 56], [76, 58]]) { g.beginPath(); g.moveTo(72 + s, 64); g.lineTo(x + s, yy); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke(); circle(g, x + s, yy, 2); g.fillStyle = INK; g.fill(); }
    circle(g, 44, 66 + y, 17); paint(g, '#e8b46a');
    g.beginPath(); for (let k = 0; k < 40; k++) { const a = k * 0.32, r = 13 - k * 0.3; g.lineTo(44 + Math.cos(a) * r, 66 + y + Math.sin(a) * r); } g.lineWidth = 2.2; g.strokeStyle = '#b5774a'; g.stroke();
  },
};
