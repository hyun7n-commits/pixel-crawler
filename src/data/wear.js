// 꾸미기 (v0.29): little things to dress your hero in, bought at the shop (ui/hub.js) and worn on every
// trip, round the village and at home: one for the head, one for the neck. They do nothing but look
// nice; they are where gold goes once the upgrades are bought. Whoever you play wears them.
// Every hero is drawn on the same 16px plan (data/sprites.js), so a neck piece always sits on row 11
// from x 3, under the mouth; a head piece is centred on the top right corner of the head (headSpot),
// which finds itself on an ear, a hat brim or a bare round head alike. Each piece has its own dark rim.

export const WEAR = {
  leaf:   { name: '나뭇잎 핀', slot: 'head', cost: 300, art: ['..kk', '.kgk', 'kgGk', 'kGk.', '.k..'] },
  flower: { name: '꽃 머리핀', slot: 'head', cost: 400, art: ['.k.k.', 'kekek', '.kzk.', 'kekek', '.k.k.'] },
  star:   { name: '별 머리핀', slot: 'head', cost: 900, art: ['..k..', '.kyk.', 'kyzyk', '.kYk.', 'k.k.k'] },
  ribbon: { name: '빨간 리본', slot: 'head', cost: 1600, art: ['kk.kk', 'krkrk', 'kRkRk', 'kk.kk'] },
  crown:  { name: '작은 왕관', slot: 'head', cost: 15000, art: ['k.k.k', 'kykyk', 'kyryk', 'kkkkk'] },
  scarf:  { name: '빨간 목도리', slot: 'neck', cost: 600, art: ['krrrrrrrrk', '..kRrk....', '..krRk....', '...kk.....'] },
  bell:   { name: '방울 목걸이', slot: 'neck', cost: 1200, art: ['kRRRRRRRRk', '....kyk...', '....kYk...', '.....k....'] },
  bowtie: { name: '나비넥타이', slot: 'neck', cost: 2500, art: ['..kk..kk..', '..krkkrk..', '..kk..kk..'] },
  stripe: { name: '줄무늬 목도리', slot: 'neck', cost: 4000, art: ['kbwbwbwbwk', '.kwbk.....', '.kbwk.....', '..kk......'] },
  lei:    { name: '꽃목걸이', slot: 'neck', cost: 7000, art: ['kezqezqezk', '.k.k.k.k..'] },
  rainbow: { name: '무지개 목도리', slot: 'neck', cost: 20000, art: ['kroygbprok', '..kpbk....', '..kgyk....', '...kk.....'] },
};
export const SLOTS = ['head', 'neck'];

// the top right corner of a hero's head (the first row reaching x 12, pulled in to x 12 at most)
export function headSpot(rows) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y].replace(/\.+$/, '');
    if (r.length - 1 >= 12) return [Math.min(r.length - 1, 13) - 1, y + 1];
  }
  return [11, 2];
}

// The hero's rows with what they wear stamped on (`wear`: { head, neck } of WEAR ids).
export function dressRows(rows, wear, spotRows = rows) {
  const g = rows.map(r => [...r]);
  const stamp = (art, x0, y0) => art.forEach((r, j) => [...r].forEach((c, i) => {
    if (c !== '.' && g[y0 + j]?.[x0 + i] !== undefined) g[y0 + j][x0 + i] = c;
  }));
  const head = WEAR[wear?.head], neck = WEAR[wear?.neck];
  if (head) {
    const [cx, cy] = headSpot(spotRows);
    stamp(head.art, cx - (head.art[0].length >> 1), cy - (head.art.length >> 1));
  }
  if (neck) stamp(neck.art, 3, 11);
  return g.map(r => r.join(''));
}

// what is worn now, as a short tag for texture keys ('' when nothing)
export const wearTag = wear => SLOTS.map(s => (WEAR[wear?.[s]] ? wear[s] : '')).filter(Boolean).join('+');
