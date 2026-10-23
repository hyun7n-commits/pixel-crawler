// 집 꾸미기: once the guild has given you your house (village.js HOME), gold has one more use, the
// one the story was about from the start. Round the house, the yard: each piece has its own spot
// (`at`: the tiles it stands on, left to right and top to bottom; the picture is drawn over them,
// taller ones reach up past the top row); the beaver carpenter puts them up. Pictures are in
// scenes/home-art.js. Inside, the room you furnish yourself (below): it is what the house is for.

import { ENEMIES } from './enemies.js';
import { CHARACTERS } from './characters.js';

export const DECOR = [
  { id: 'flowers', name: '꽃밭', cost: 800, at: [[35, 21], [36, 21]], desc: '문 옆에 알록달록 꽃을 심는다' },
  { id: 'mailbox', name: '우편함', cost: 1400, at: [[38, 21]], desc: '이웃이 가끔 편지를 넣고 간다' },
  { id: 'pots', name: '화분', cost: 2000, at: [[34, 20]], desc: '벽 옆에 작은 화분 둘' },
  { id: 'garden', name: '텃밭', cost: 3000, at: [[41, 18], [42, 18], [41, 19], [42, 19]], desc: '당근과 양배추가 자란다' },
  { id: 'laundry', name: '빨랫줄', cost: 4400, at: [[40, 17], [41, 17], [42, 17]], desc: '작업복이 바람에 펄럭인다' },
  { id: 'bench', name: '나무 벤치', cost: 6000, at: [[40, 22], [41, 22]], desc: '탐험 다녀와서 쉬는 자리' },
  { id: 'dog', name: '강아지 집', cost: 9000, at: [[40, 20]], desc: '강아지 한 마리가 같이 산다' },
  { id: 'statue', name: '반짝돌 조각상', cost: 14000, at: [[43, 20]], desc: '제일 큰 반짝돌을 깎아 세운다' },
  { id: 'swing', name: '그네 나무', cost: 20000, at: [[43, 17], [44, 17]], desc: '마을에서 제일 좋은 그늘' },
];

export const hasDecor = (meta, id) => (meta.home || []).includes(id);

// With a mailbox, a letter is sometimes waiting when you come home from the fields (a '!' bobs over
// the box); bump the box to read it. Only from villagers who live here; `if` narrows it further.
export const LETTERS = [
  { from: 'neighbor', text: '집들이 언제 해? 케이크 구워 갈게! 이번엔 꼭 불러 줘.' },
  { from: 'neighbor', text: '너네 강아지가 우리 집 꽃밭에서 낮잠 잤어. 너무 귀여워서 그냥 뒀어!', if: m => hasDecor(m, 'dog') },
  { from: 'neighbor', text: '빨랫줄에 널린 작업복 봤어. 구멍 난 데 있던데? 다음에 꿰매 줄게.', if: m => hasDecor(m, 'laundry') },
  { from: 'shop', text: '단골 손님께. 요즘 반짝돌 시세가 좋아. 많이 캐 와! 덤도 챙겨 줄게.' },
  { from: 'shop', text: '텃밭 당근 남으면 가게에 좀 팔아 줘. 손님들이 찾더라고.', if: m => hasDecor(m, 'garden') },
  { from: 'smith', text: '밤새 망치 소리 시끄러웠으면 미안. 대신 다음엔 더 좋은 유물을 손봐 줄게.' },
  { from: 'smith', text: '조각상 봤다. 반짝돌 결을 잘 살렸더군. 누가 깎았는지 몰라도 솜씨가 좋아.', if: m => hasDecor(m, 'statue') },
  { from: 'rescue', text: '무리하지 마. 쓰러지면 또 업어 와야 하잖아. …그래도 언제든 부르고.' },
  { from: 'rival', text: '흥, 집 좀 생겼다고 방심하지 마. 다음엔 내가 더 멀리 간다!' },
  { from: 'rival', text: '그네… 한 번만 타 봐도 돼? 아, 아니야. 잊어버려.', if: m => hasDecor(m, 'swing') },
  { from: 'guild', text: '자네 덕에 들판이 한결 조용해졌네. 조합 일당은 늘 고맙게 생각하고 있어.' },
];

// ---------- inside ----------
// The room grows when the carpenter builds on (floor w x h tiles, the door in the middle of the bottom
// row); what is in it stays where it was, the room growing round it.
export const HOUSE_LEVELS = [
  { name: '단칸방', w: 7, h: 4, cost: 0 },
  { name: '넓은 방', w: 9, h: 5, cost: 6000 },
  { name: '큰 집', w: 11, h: 6, cost: 18000 },
];
export const houseLevel = m => Math.min(HOUSE_LEVELS.length - 1, m.house?.lvl || 0);
export const roomOf = m => HOUSE_LEVELS[houseLevel(m)];
export const doorCell = room => ({ x: (room.w - 1) / 2, y: room.h - 1 });
// the back wall's windows (by floor column): nothing hangs over them
export const windowSlots = room => (room.w >= 9 ? [1, room.w - 2] : [1]);

// Furniture: `w` x `h` floor tiles (`wall`: hangs on the back wall, `w` slots wide; `rug`: lies flat,
// you walk over it and things stand on it), ♥ how cosy it makes the place, what bumping into it does
// (`act`, scenes/HomeScene.js). The bed and the stool come with the house; the carpenter makes the
// rest to order. Pictures: scenes/home-interior-art.js.
export const FURNITURE = {
  bed:      { name: '짚 침대', w: 1, h: 2, heart: 2, cost: 0, act: 'sleep', desc: '집이랑 같이 받은 침대. 조금 까슬까슬하다' },
  stool:    { name: '나무 의자', w: 1, h: 1, heart: 1, cost: 0, act: 'sit', desc: '다리 셋 달린 작은 의자' },
  table:    { name: '둥근 탁자', w: 1, h: 1, heart: 2, cost: 400, act: 'tea', desc: '찻주전자가 늘 따뜻하다' },
  plant:    { name: '화분', w: 1, h: 1, heart: 1, cost: 300, act: 'water', desc: '탐험을 다녀올 때마다 조금씩 자란다' },
  rug:      { name: '꽃 러그', w: 2, h: 2, heart: 3, cost: 800, rug: true, desc: '맨발로 밟으면 폭신하다' },
  lamp:     { name: '호롱 스탠드', w: 1, h: 1, heart: 2, cost: 600, act: 'lamp', desc: '노란 불빛이 방을 데운다' },
  stove:    { name: '무쇠 난로', w: 1, h: 1, heart: 3, cost: 1800, act: 'cook', desc: '탐험 갈 때마다 꿀물 도시락을 싸 준다 (체력 물약 +1)' },
  shelf:    { name: '책장', w: 2, h: 1, heart: 3, cost: 1500, act: 'book', desc: '탐험 일지와 들판 동물 책이 꽂혀 있다' },
  tub:      { name: '나무 욕조', w: 2, h: 1, heart: 4, cost: 2600, act: 'bath', desc: '탐험 다녀와서 뜨끈하게' },
  sofa:     { name: '폭신 소파', w: 2, h: 1, heart: 4, cost: 3000, act: 'sit', desc: '친구들이 놀러 오면 여기 앉는다' },
  wardrobe: { name: '옷장', w: 1, h: 1, heart: 2, cost: 1600, act: 'peek', desc: '작업복이 잔뜩 걸려 있다' },
  tank:     { name: '어항', w: 1, h: 1, heart: 3, cost: 3400, act: 'fish', desc: '연못에서 온 금붕어 한 마리' },
  petbed:   { name: '강아지 방석', w: 1, h: 1, heart: 2, cost: 700, act: 'pet', desc: '강아지 집이 있으면 강아지가 와서 잔다' },
  musicbox: { name: '오르골', w: 1, h: 1, heart: 3, cost: 4200, act: 'music', desc: '태엽을 감으면 마을 노래가 나온다' },
  cloudbed: { name: '구름 침대', w: 2, h: 2, heart: 7, cost: 7000, act: 'sleep', desc: '구름 위에서 자는 것 같다' },
  painting: { name: '들판 그림', w: 1, wall: true, heart: 2, cost: 900, desc: '처음 나갔던 초원을 그렸다' },
  clock:    { name: '뻐꾸기 시계', w: 1, wall: true, heart: 2, cost: 1200, desc: '가끔 뻐꾸기가 튀어나온다' },
  garland:  { name: '꽃 줄', w: 2, wall: true, heart: 2, cost: 500, desc: '말린 꽃을 엮어 걸었다' },
  map:      { name: '들판 지도', w: 2, wall: true, heart: 3, cost: 2400, desc: '가 본 들판에 별이 붙는다' },
};
// the order the carpenter shows them in
export const CATALOG = ['table', 'plant', 'rug', 'lamp', 'garland', 'petbed', 'painting', 'clock', 'shelf', 'wardrobe', 'stove', 'map', 'tub', 'sofa', 'tank', 'musicbox', 'cloudbed'];
// A plushie of every big boss you beat comes home with you (♥2 each, a squeak when bumped).
export const plushOf = type => `plush_${type}`;
export function furniture(id) {
  if (FURNITURE[id]) return FURNITURE[id];
  const type = id.startsWith('plush_') && id.slice(6);
  return type && ENEMIES[type] ? { name: `${ENEMIES[type].name} 인형`, w: 1, h: 1, heart: 2, act: 'squeak', plush: type, desc: '쓰러뜨린 대장을 닮은 봉제 인형' } : null;
}

// the plant grows a stage with every trip after it went in: a sprout, leaves, a bud, then flowers
export const plantStage = m => { const n = m.house?.plant || 0; return n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0; };
const heartOf = (m, id) => (id === 'plant' ? 1 + plantStage(m) : furniture(id)?.heart || 0);

export const STARTER = { bed: [0, 0], stool: [5, 1] };

// everything you have: what came with the house, what you ordered, a plushie for every boss beaten
export function owned(m) {
  const out = ['bed', 'stool', ...Object.keys(m.house?.own || {}).filter(id => FURNITURE[id])];
  for (const b of m.stats.bosses || []) if (ENEMIES[b]) out.push(plushOf(b));
  return out;
}
// where things stand: { id: [x, y] } (y -1 for the back wall); a house nobody has arranged yet has the
// bed and the stool where the guild left them
export const placed = m => m.house?.at || STARTER;
// ♥ for everything standing in the room (what is put away does not count)
export const comfort = m => Object.keys(placed(m)).reduce((n, id) => n + heartOf(m, id), 0);
// What the house does for the trips: every 5♥ is one more max HP to start with (up to 10), and the
// stove sends you off with a bottle of honey water.
export const COMFORT_STEP = 5, COMFORT_MAX = 10;
export function homePerks(m) {
  const h = comfort(m), at = placed(m);
  return { heart: h, hp: Math.min(COMFORT_MAX, Math.floor(h / COMFORT_STEP)), lunch: !!at.stove };
}


// Friends drop in while you are out: after a trip, now and then, one of the friends you rescued is
// sitting in your house when you get back, with a little something for you. Needs somewhere to sit.
export const VISIT_CHANCE = 0.45;
export const visitGift = P => 40 + 8 * P;
export const VISIT_LINES = [
  '집 좋다! 나도 이런 집 갖고 싶어. 이거, 집들이 선물이야.',
  '문이 열려 있길래 들어와서 기다렸어. 오다가 주웠어, 너 가져.',
  '여기 앉아 있으니까 졸려… 아, 맞다. 이거 주려고 왔지.',
  '탐험 잘 다녀왔어? 다친 데는 없지? 자, 용돈!',
  '네 집은 늘 따뜻해서 좋아. 고마워서 이거 들고 왔어.',
];
export function rollVisitor(m, P, hero) {
  const at = placed(m), seat = at.sofa || at.stool || at.table;
  const friends = Object.keys(m.chars).filter(id => m.chars[id] && id !== hero && CHARACTERS[id]);
  if (!seat || !friends.length || Math.random() >= VISIT_CHANCE) return null;
  return { id: friends[Math.floor(Math.random() * friends.length)], gift: visitGift(P), line: Math.floor(Math.random() * VISIT_LINES.length) };
}

// ---------- arranging ----------
// what is taken where: floor cells under furniture, under rugs, and the wall's slots (`skip`: leave
// one piece out, the one being moved)
export function taken(m, skip) {
  const out = { floor: new Set(), rug: new Set(), wall: new Set() };
  for (const [id, [x, y]] of Object.entries(placed(m))) {
    const f = furniture(id);
    if (!f || id === skip) continue;
    if (f.wall) { for (let i = 0; i < f.w; i++) out.wall.add(x + i); continue; }
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) (f.rug ? out.rug : out.floor).add(`${x + i},${y + j}`);
  }
  return out;
}
// can piece `id` go at (x, y)? (`block`: more floor cells to keep clear, like where someone stands)
export function fits(m, id, x, y, block = null, t = taken(m, id)) {
  const f = furniture(id), room = roomOf(m), door = doorCell(room);
  if (!f) return false;
  if (f.wall) {
    if (y !== -1 || x < 0 || x + f.w > room.w) return false;
    const win = windowSlots(room);
    for (let i = 0; i < f.w; i++) if (t.wall.has(x + i) || win.includes(x + i)) return false;
    return true;
  }
  if (x < 0 || y < 0 || x + f.w > room.w || y + f.h > room.h) return false;
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
    const k = `${x + i},${y + j}`;
    if (x + i === door.x && y + j === door.y) return false;
    if ((f.rug ? t.rug.has(k) : t.floor.has(k)) || block?.has(k)) return false;
  }
  return true;
}
// Would `id` at (x, y) still leave a way in to everything? Every free floor cell joined up with the
// door, and every piece with a free cell beside it to stand on and bump it from.
function keepsWay(m, id, x, y, t) {
  const f = furniture(id), room = roomOf(m), door = doorCell(room);
  if (f.wall || f.rug) return true;
  const solid = new Set(t.floor), pieces = [];
  for (const [pid, [px, py]] of [...Object.entries(placed(m)).filter(([pid]) => pid !== id), [id, [x, y]]]) {
    const pf = furniture(pid);
    if (!pf || pf.wall || pf.rug) continue;
    const cells = [];
    for (let j = 0; j < pf.h; j++) for (let i = 0; i < pf.w; i++) cells.push([px + i, py + j]);
    pieces.push(cells);
  }
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) solid.add(`${x + i},${y + j}`);
  const open = (cx, cy) => cx >= 0 && cy >= 0 && cx < room.w && cy < room.h && !solid.has(`${cx},${cy}`);
  const seen = new Set([`${door.x},${door.y}`]), q = [[door.x, door.y]];
  while (q.length) {
    const [cx, cy] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = `${nx},${ny}`;
      if (!open(nx, ny) || seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  for (let cy = 0; cy < room.h; cy++) for (let cx = 0; cx < room.w; cx++) if (open(cx, cy) && !seen.has(`${cx},${cy}`)) return false;
  return pieces.every(cells => cells.some(([cx, cy]) => [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => seen.has(`${cx + dx},${cy + dy}`)))));
}
// Where a new piece goes by itself (null: no room, it waits in the cupboard): wall pieces at the first
// free slot; a rug out in the open near the middle, where nothing stands; the rest from the back of
// the room forward, off the rug if they can be, always leaving a way in to everything.
export function freeSpot(m, id) {
  const f = furniture(id), room = roomOf(m), t = taken(m, id);
  if (f.wall) { for (let x = 0; x + f.w <= room.w; x++) if (fits(m, id, x, -1, null, t)) return [x, -1]; return null; }
  const cells = [];
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) cells.push([x, y]);
  if (f.rug) {
    const cx = (room.w - f.w) / 2, cy = (room.h - f.h) / 2;
    cells.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  }
  const ok = block => cells.find(([x, y]) => fits(m, id, x, y, block, t) && keepsWay(m, id, x, y, t));
  return ok(f.rug ? t.floor : t.rug) || ok(null) || null;
}
// a house nobody has arranged yet is arranged the way the guild left it
export function ownLayout(m) {
  if (!m.house.at) m.house.at = Object.fromEntries(Object.entries(STARTER).map(([id, at]) => [id, [...at]]));
  return m.house.at;
}
// the carpenter builds on: the room gets wider on both sides and deeper at the front, so everything
// keeps its place round the door (wall pieces that end up over a new window are taken down)
export function extendHouse(m) {
  const at = ownLayout(m);
  m.house.lvl = houseLevel(m) + 1;
  const win = windowSlots(roomOf(m));
  for (const [id, pos] of Object.entries(at)) {
    pos[0] += 1;
    const f = furniture(id);
    if (f?.wall && Array.from({ length: f.w }, (_, i) => pos[0] + i).some(x => win.includes(x))) delete at[id];
  }
}
// a new piece goes straight in where there is room (or waits in the cupboard: HomeScene's tray)
export function bringIn(m, id) {
  const at = ownLayout(m), spot = freeSpot(m, id);
  if (spot) at[id] = spot;
  return !!spot;
}
