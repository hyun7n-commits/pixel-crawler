// Shapes for Phaser graphics drawn the pixel-art way: whole world pixels and stepped edges, so a round
// coin, a shadow or a bubble sits on the same grid as the sprites instead of a smooth curve at the
// screen's resolution. Colours come from the graphics' current fillStyle.

// an ellipse `w` by `h` pixels centred on (cx, cy)
export function pixEllipse(g, cx, cy, w, h) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const left = Math.round(cx - w / 2), top = Math.round(cy - h / 2);
  for (let j = 0; j < h; j++) {
    const v = (j + 0.5 - h / 2) / (h / 2), half = (w / 2) * Math.sqrt(Math.max(0, 1 - v * v));
    const x0 = Math.round(w / 2 - half), x1 = Math.round(w / 2 + half);
    if (x1 > x0) g.fillRect(left + x0, top + j, x1 - x0, 1);
  }
  return g;
}

// a disc of radius r (half pixels are fine: 2.5 is five across)
export const pixDisc = (g, cx, cy, r) => pixEllipse(g, cx, cy, r * 2, r * 2);

// a line one pixel thick (or `t` thick) from one point to another, stepping like a hand-placed line
export function pixLine(g, x0, y0, x1, y1, t = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, o = Math.floor((t - 1) / 2);
  for (let n = 0; n < 400; n++) {
    g.fillRect(x0 - o, y0 - o, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return g;
}

// a small four-pointed glint (a diamond with a bright middle) of radius r
export function pixDiamond(g, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let j = -r; j <= r; j++) { const w = r - Math.abs(j); g.fillRect(cx - w, cy + j, w * 2 + 1, 1); }
  return g;
}

// a filled triangle pointing along `ang` from (x, y), stepped
export function pixArrow(g, x, y, ang, len = 6, wide = 5) {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  for (let k = 0; k <= len; k++) {
    const w = Math.round((len - k) / len * wide / 2), cx = x + ux * (k - len / 2), cy = y + uy * (k - len / 2);
    pixLine(g, cx - uy * w, cy + ux * w, cx + uy * w, cy - ux * w);
  }
  return g;
}
