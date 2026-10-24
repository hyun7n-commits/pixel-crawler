// Manga marks over a head (!, ?, …, 💢, ♪, ♥), drawn in world pixels with a dark outline, shared by
// the fields and the village. A mark pops in, rises a little and fades; `s.emote` holds the one showing.

// 'c' is the mark's colour
export const EMOTES = {
  '!': { c: 0xf4cf4f, rows: ['cc', 'cc', 'cc', 'cc', '..', 'cc'] },
  '?': { c: 0x8fd8f0, rows: ['.cccc.', 'cc..cc', '....cc', '..ccc.', '..cc..', '......', '..cc..'] },
  '…': { c: 0xf4f0e8, rows: ['cc.cc.cc', 'cc.cc.cc'] },
  anger: { c: 0xff3b3b, line: null, k: 1.5, rows: ['.c.c.', 'cc.cc', '.....', 'cc.cc', '.c.c.'] }, // 💢, bare
  '♪': { c: 0xf29bb2, rows: ['..c..', '..cc.', '..c.c', '..c..', 'ccc..', 'ccc..'] },
  '♥': { c: 0xff6b81, rows: ['.cc.cc.', 'ccccccc', 'ccccccc', '.ccccc.', '..ccc..', '...c...'] },
  sweat: { c: 0x8fd8f0, rows: ['..c.', '.cc.', 'cccc', 'cccc', '.cc.'] }, // out of breath
  z: { c: 0xf4f0e8, rows: ['cccc', '..c.', '.c..', 'cccc'] }, // asleep
  stars: { c: 0xf4cf4f, rows: ['.c.....', 'ccc..c.', '.c..ccc', '.....c.'] }, // seeing stars (a bump on the head)
};

export function setEmote(s, kind, now, ms = 1100) {
  if (s) s.emote = { kind, at: now, until: now + ms };
}

// draws `s`'s mark (if any) with its bottom at (x, y) on graphics `g`
export function drawEmote(g, s, x, y, time) {
  const m = s.emote;
  if (!m || time > m.until) return;
  const E = EMOTES[m.kind], el = time - m.at, left = m.until - time;
  const k = (E.k || 1) * (el < 90 ? 0.4 + 0.8 * el / 90 : el < 160 ? 1.2 - 0.2 * (el - 90) / 70 : 1);
  const a = left < 200 ? left / 200 : 1;
  const w = E.rows[0].length, h = E.rows.length;
  const x0 = Math.round(x - w * k / 2), y0 = Math.round(y - h * k - Math.min(el, 300) / 300 * 1.5);
  const px = [];
  E.rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === 'c') px.push([x0 + i * k, y0 + j * k]); }));
  if (E.line !== null) {
    g.fillStyle(E.line ?? 0x1b1424, a);
    for (const [px0, py0] of px) g.fillRect(px0 - 1, py0 - 1, k + 2, k + 2);
  }
  g.fillStyle(E.c, a);
  for (const [px0, py0] of px) g.fillRect(px0, py0, k, k);
}
