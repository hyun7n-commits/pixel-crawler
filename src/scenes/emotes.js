// Manga marks over a head (!, ?, …, 💢, ♪, ♥), drawn as round strokes with the plum outline the
// pictures use, shared by the fields and the village. A mark pops in, rises a little and fades;
// `s.emote` holds the one showing. Also the little status bits (sweat drops, snot bubbles, stars).

export const INK = 0x4a2a3c;
const O = 0.75; // outline width, world px

// Each mark is a few parts in world px, its bottom at y = 0:
// ['dot', x, y, r] · ['seg', x1, y1, x2, y2, width] · ['arc', x, y, r, from, to, width] · ['heart', x, y, size]
export const EMOTES = {
  '!': { c: 0xffd45a, parts: [['seg', 0, -6.4, 0, -3, 2.1], ['dot', 0, -0.9, 1.1]] },
  '?': { c: 0x8fd3f2, parts: [['arc', 0, -5, 1.9, Math.PI * 1.05, Math.PI * 2.5, 1.5], ['seg', 0, -3.1, 0, -2.4, 1.5], ['dot', 0, -0.8, 1]] },
  '…': { c: 0xfbf6ee, parts: [['dot', -2.6, -1, 0.95], ['dot', 0, -1, 0.95], ['dot', 2.6, -1, 0.95]] },
  anger: { c: 0xe8555e, k: 1.2, parts: [-1, 1].flatMap(sx => [-1, 1].map(sy => {
    const a = Math.atan2(-sy, -sx);
    return ['arc', sx * 2.7, -3.4 + sy * 2.7, 2, a - 0.75, a + 0.75, 1.1];
  })) },
  '♪': { c: 0xf4a7c8, parts: [['seg', 0.6, -1.4, 0.6, -6.4, 0.9], ['seg', 0.6, -6.4, 2.6, -5, 0.9], ['dot', -0.6, -1.4, 1.5]] },
  '♥': { c: 0xff6b81, parts: [['heart', 0, -3.2, 3.4]] },
};

export function setEmote(s, kind, now, ms = 1100) {
  if (s) s.emote = { kind, at: now, until: now + ms };
}

function heartPts(x, y, r) {
  const pts = [];
  for (let k = 0; k < 28; k++) {
    const t = k / 28 * Math.PI * 2;
    pts.push({ x: x + r * 0.062 * 16 * Math.sin(t) ** 3, y: y - r * 0.062 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
  }
  return pts;
}

// one part, grown by `o` on every side (the outline pass draws it fat in ink, then the colour on top)
function part(g, p, X, Y, k, o, col, a) {
  const [kind] = p;
  g.fillStyle(col, a);
  if (kind === 'dot') g.fillCircle(X + p[1] * k, Y + p[2] * k, p[3] * k + o);
  else if (kind === 'seg') {
    const [, x1, y1, x2, y2, w] = p, r = w * k / 2 + o;
    g.lineStyle(r * 2, col, a);
    g.lineBetween(X + x1 * k, Y + y1 * k, X + x2 * k, Y + y2 * k);
    g.fillCircle(X + x1 * k, Y + y1 * k, r); g.fillCircle(X + x2 * k, Y + y2 * k, r);
  } else if (kind === 'arc') {
    const [, x, y, rr, a0, a1, w] = p, r = w * k / 2 + o;
    g.lineStyle(r * 2, col, a);
    g.beginPath(); g.arc(X + x * k, Y + y * k, rr * k, a0, a1, false); g.strokePath();
    for (const a of [a0, a1]) g.fillCircle(X + (x + Math.cos(a) * rr) * k, Y + (y + Math.sin(a) * rr) * k, r);
  } else if (kind === 'heart') {
    const pts = heartPts(X + p[1] * k, Y + p[2] * k, p[3] * k + o * 1.2);
    g.fillPoints(pts, true);
    if (o === 0) { g.fillStyle(0xffffff, a * 0.7); g.fillCircle(X + (p[1] - p[3] * 0.45) * k, Y + (p[2] - p[3] * 0.35) * k, p[3] * 0.18 * k); }
  }
}

// draws `s`'s mark (if any) with its bottom at (x, y) on graphics `g`
export function drawEmote(g, s, x, y, time) {
  const m = s.emote;
  if (!m || time > m.until) return;
  const E = EMOTES[m.kind], el = time - m.at, left = m.until - time;
  const k = (E.k || 1) * (el < 90 ? 0.4 + 0.8 * el / 90 : el < 160 ? 1.2 - 0.2 * (el - 90) / 70 : 1);
  const a = left < 200 ? left / 200 : 1;
  const Y = y - Math.min(el, 300) / 300 * 1.5;
  for (const p of E.parts) part(g, p, x, Y, k, O, INK, a);
  for (const p of E.parts) part(g, p, x, Y, k, 0, E.c, a);
}

// a drop of water or sweat, hanging from (x, y) and r wide
export function drawDrop(g, x, y, r, col = 0x8fd8f0, a = 1) {
  for (const [c, o] of [[INK, O * 0.8], [col, 0]]) {
    g.fillStyle(c, a);
    g.fillCircle(x, y + r * 1.6, r + o);
    g.fillTriangle(x - (r + o) * 0.9, y + r * 1.3, x + (r + o) * 0.9, y + r * 1.3, x, y - o * 1.4);
  }
  g.fillStyle(0xffffff, a * 0.8); g.fillCircle(x - r * 0.35, y + r * 1.4, r * 0.3);
}

// a little four-pointed twinkle
export function drawTwinkle(g, x, y, r, col = 0xffd45a, a = 1) {
  const pts = [];
  for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4, d = k % 2 ? r * 0.32 : r; pts.push({ x: x + Math.cos(t) * d, y: y + Math.sin(t) * d }); }
  g.fillStyle(INK, a); g.fillPoints(pts.map(p => ({ x: x + (p.x - x) * 1.35, y: y + (p.y - y) * 1.35 })), true);
  g.fillStyle(col, a); g.fillPoints(pts, true);
}

// a sleeper's snot bubble
export function drawSnot(g, x, y, r) {
  g.fillStyle(0xd8f2ff, 0.75); g.fillCircle(x, y, r);
  g.lineStyle(0.5, INK, 0.6); g.strokeCircle(x, y, r);
  g.fillStyle(0xffffff, 0.95); g.fillCircle(x - r * 0.35, y - r * 0.35, Math.max(0.35, r * 0.22));
}
