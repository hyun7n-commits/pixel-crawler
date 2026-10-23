// v0.21 art: the game is drawn in code as smooth illustrations, in the manner of Neptune/Treeplla's
// cat games (고양이 마법학교): chubby shapes, a thick soft plum outline round everything, flat warm
// colours with one hard-edged shade, small dot eyes and pink cheeks.
//
// Every picture is drawn on a canvas RES times the size of a tile (a tile is 16 world pixels), and
// shown scaled back down (`ART`), so it stays smooth however close the camera gets. Drawings work in
// a 0-100 box per tile (`unit`), so the numbers read as percentages of the tile.

export const RES = 8;            // canvas pixels per world pixel
export const ART = 1 / RES;      // the scale to show an art texture at its world size
export const TILE_PX = 16 * RES; // one tile's canvas size

// the palette the whole game shares
export const INK = '#4a2a3c';    // the outline: a deep soft plum, never black
export const LW = 4.6;           // outline width, in tile units (0-100)
export const C = {
  ink: INK, inkSoft: '#6e4659',
  white: '#fbf6ee', whiteShade: '#e3d6cc', cream: '#f6e3c3', creamShade: '#e2c39c',
  pink: '#f4a7b9', blush: '#f58fa8', tongue: '#e8738c',
  orange: '#f29a52', orangeShade: '#d8743a', ginger: '#c8622f',
  brown: '#b5774a', brownShade: '#8e5636', dark: '#5a3a33',
  tan: '#e8c48f', tanShade: '#c99c64',
  grey: '#b8b8c8', greyShade: '#8f8fa6', slate: '#6f6c86', slateShade: '#55526c',
  yellow: '#ffd45a', yellowShade: '#e5ab2e', gold: '#ffcf4a', goldShade: '#d99a22',
  red: '#e8555e', redShade: '#b83a4a',
  green: '#8fd06a', greenShade: '#5ea64a', leaf: '#5fb36a', leafShade: '#3f8a55',
  mint: '#a6e6cf', mintShade: '#62b89d', teal: '#4fb3a8', tealShade: '#2f8580',
  sky: '#8fd3f2', skyShade: '#4ea6d6', blue: '#5b8de0', blueShade: '#3a62b3',
  purple: '#9a6fd6', purpleShade: '#7049ad', lilac: '#d9c8f2', lilacShade: '#b49fdc',
  eye: '#3a2030',
};

export function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round(h);
  const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  return [c, g];
}

// a canvas `tw` x `th` tiles big whose drawing space is 0-100 units per tile
export function unit(tw = 1, th = tw) {
  const [c, g] = canvas(TILE_PX * tw, TILE_PX * th);
  g.scale(TILE_PX / 100, TILE_PX / 100);
  return [c, g];
}

// small deterministic randomness so a drawing never changes between frames
export function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// fill the current path, then outline it
export function paint(g, fill, { line = INK, w = LW } = {}) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (line) { g.lineWidth = w; g.strokeStyle = line; g.stroke(); }
}

export function ellipse(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
export function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }
export function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// a smooth closed shape through the points (a Catmull-Rom loop)
export function blob(g, pts, tension = 0.5) {
  const n = pts.length, P = i => pts[(i + n) % n];
  g.beginPath();
  g.moveTo(P(0)[0], P(0)[1]);
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), t = tension / 3;
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
  }
  g.closePath();
}

// an open smooth line through the points
export function curve(g, pts, tension = 0.5) {
  const n = pts.length, P = i => pts[Math.max(0, Math.min(n - 1, i))];
  g.beginPath();
  g.moveTo(P(0)[0], P(0)[1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), t = tension / 3;
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
  }
}

// a thick outlined tube along a line (tails, stalks, legs): the outline, then the colour inside it
export function tube(g, pts, width, fill, { line = INK, w = LW } = {}) {
  curve(g, pts);
  g.lineWidth = width + w * 2; g.strokeStyle = line; g.stroke();
  g.lineWidth = width; g.strokeStyle = fill; g.stroke();
}

// draws `inner` clipped to the current path (markings, shading), keeping the path for the outline
export function within(g, path, inner) {
  g.save();
  path();
  g.clip();
  inner();
  g.restore();
}

// a hard-edged shade on the back (left) and lower side of a shape, like the cat school's
export function shadeSide(g, path, col, { dx = -0.22, dy = 0.1, box = [0, 0, 100, 100] } = {}) {
  const [x, y, w, h] = box;
  within(g, path, () => {
    g.fillStyle = col;
    ellipse(g, x + w / 2 + w * (-dx), y + h / 2 - h * dy, w * 0.62, h * 0.66);
    // everything outside that ellipse is in shade
    g.rect(x - 10, y - 10, w + 20, h + 20);
    g.fill('evenodd');
  });
}

export function shine(g, x, y, r = 2.4, a = 0.85) {
  g.fillStyle = `rgba(255,255,255,${a})`;
  circle(g, x, y, r); g.fill();
}

export const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}
