// 비밀 도감 (v0.30): every odd little thing there is to come across, out in the fields, in the village
// and at home, about a thousand of them, in chapters. Nothing says where they are; each one you come
// across for the first time chimes, pops up in the corner with its picture and how many you have now
// (ui/toast.js), and gets its page in the book (ui/book.js: at home in the 비밀 상자, and from the
// village's top bar once you have one). The ones still to find are only ever a dark shape.
// Found ones are kept in meta.book (id -> when); the hand-made secrets of v0.28-29 keep their own
// meta.secrets and are the first chapter.
//   entry: { id, ch, name, line, pic } · pic: { spr } a sprite, { find: [shape, pal] } a little find
//   (data/finds-art.js), { odd: variant, spr } a critter not quite like the rest, { spr, mark } a critter
//   at its habit, { spr, tool } a critter and the tool that got it

import { SECRETS } from './secrets.js';
import { QUIRKS, quirkId } from './quirks.js';
import { ENEMIES } from './enemies.js';
import { VARIANTS, VARIANT_IDS, ODD_KINDS, ODD_LINES, HABITS, oddId, habitId } from './odd.js';
import { TRICKS, TRICK_TOOLS, BOSS_TRICKS, trickId } from './tricks.js';
import { ITEMS } from './items.js';
import { TRINKETS, trinketId } from './trinkets.js';
import { HAPPENINGS, happenId } from './happen.js';
import { DREAMS, dreamId } from './dreams.js';
import { FEATS, featId } from './feats.js';
import { ROOMS, ROOM_KINDS, ROOM_PIC, roomId } from './rooms.js';
import { FISH, BUGS, CROPS, FORAGE, DISHES } from './life.js';
import { PLAY_LIST, playId, WISH_LIST, wishId, DAYS, dayId, HIDE_LINES, HIDE_IDS, hideId, TREASURES, FOGS, treasureId } from './play.js';
import { CHARACTERS } from './characters.js';
import { HEART_PAGES, PAIR_PAGES } from './affinity.js';

// the hand-made secrets' little pictures
const SECRET_PIC = {
  acorn: { find: ['acorn', 'nN'] }, cat: { spr: 'cat' }, koi: { find: ['marble', 'or'] }, butterfly: { spr: 'pet_butterfly' },
  door: { spr: 'door' }, pup: { find: ['bone', 'w'] }, echo: { spr: 'well' }, notice: { find: ['letter', 'iY'] },
  chick: { spr: 'pet_chick' }, honey: { spr: 'honeyjar' }, dummy: { spr: 'statue' }, pocket: { spr: 'gold_2' },
  letter: { find: ['letter', 'w'] }, goldfish: { find: ['marble', 'o'] }, shadow: { spr: 'rabbit' }, bonk: { spr: 'pebble' },
  rustle: { spr: 'hide_leaf0' }, nook: { spr: 'door_forest' }, spirit: { spr: 'spirit' }, dream: { spr: 'pillow' },
  sleeper: { spr: 'napper' }, pebble: { find: ['pebble', 'L'] }, roast: { spr: 'pinecone' },
  chase: { spr: 'pet_sparrow' }, petnap: { spr: 'pet_chick' },
};

const toolName = id => ITEMS[id]?.name || id;

export const CHAPTERS = [
  { id: 'secret', name: '비밀', pic: { spr: 'door' }, note: '마을과 집과 들판에 숨은 장난' },
  { id: 'odd', name: '별난 친구', pic: { odd: 'gold', spr: 'rat' }, note: '어딘가 조금 다른 들판 친구들' },
  { id: 'habit', name: '버릇', pic: { spr: 'snail', mark: 'z' }, note: '아무도 안 볼 때 하는 일' },
  { id: 'trick', name: '도구 장난', pic: { spr: 'seal', tool: 'pinecone' }, note: '도구를 받은 친구들이 한 일' },
  { id: 'trinket', name: '주운 것', pic: { find: ['button', 'y'] }, note: '들판에 떨어져 있던 작은 것들' },
  { id: 'room', name: '숨은 방', pic: { spr: 'cairn' }, note: '벽 너머에 숨어 있던 방들' },
  { id: 'happen', name: '들판의 일', pic: { spr: 'butterfly' }, note: '들판에서 가끔 일어나는 일' },
  { id: 'dream', name: '꿈', pic: { spr: 'pillow' }, note: '깜빡 잠들었을 때 꾼 꿈' },
  { id: 'feat', name: '해낸 일', pic: { spr: 'crown' }, note: '나도 모르게 해낸 일들' },
  // v0.30 마을 생활 (data/life.js)
  { id: 'fish', name: '물고기', pic: { find: ['fish', 'YNz'] }, note: '마을 연못과 개울에서 낚은 것' },
  { id: 'bug', name: '곤충', pic: { find: ['bfly', 'zX'] }, note: '마을에서 잠자리채로 잡은 것' },
  { id: 'crop', name: '텃밭', pic: { find: ['carrot', 'og'] }, note: '집 마당 텃밭에서 키운 것' },
  { id: 'forage', name: '들에서 난 것', pic: { find: ['rasp', 'rg'] }, note: '마을 여기저기서 주운 것' },
  { id: 'dish', name: '요리', pic: { find: ['bowl', 'ow'] }, note: '집 난로에서 만든 것' },
  // v0.30 마을 놀이 (data/play.js)
  { id: 'play', name: '놀이', pic: { find: ['ribbon', 'r'] }, note: '마을에서 놀다가 해낸 것' },
  { id: 'day', name: '마을의 하루', pic: { find: ['star', 'y'] }, note: '어느 날 마을에서 있었던 일' },
  { id: 'hide', name: '숨바꼭질', pic: { find: ['leaf', 'g'] }, note: '숨바꼭질에서 찾아낸 친구들' },
  { id: 'treasure', name: '마을 보물', pic: { find: ['map', 'c'] }, note: '마을 땅속과 안개 속에서 찾은 것' },
  // v0.30 친밀도 (data/affinity.js)
  { id: 'heart', name: '하트', pic: { find: ['heart', 'r'] }, note: '마을 이웃, 친구들과 가까워진 날' },
  { id: 'pair', name: '단짝', pic: { find: ['heart', 'q'] }, note: '마을 이웃들끼리 가까워진 일' },
];

const ENTRIES_ALL = [
  ...SECRETS.map(s => ({ id: `secret:${s.id}`, ch: 'secret', name: s.name, line: s.got, pic: SECRET_PIC[s.id] || { spr: 'door' }, secret: s.id })),
  ...QUIRKS.map(o => ({ id: quirkId(o.id), ch: 'secret', name: o.name, line: o.line, pic: o.pic })),
  ...ODD_KINDS.flatMap(kind => VARIANT_IDS.map((v, i) => ({
    id: oddId(kind, v), ch: 'odd', name: `${VARIANTS[v].prefix}${ENEMIES[kind].name}`, line: ODD_LINES[kind][i], pic: { odd: v, spr: ENEMIES[kind].sprite }, kind, variant: v,
  }))),
  ...ODD_KINDS.flatMap(kind => HABITS[kind].map(([name, line, , , mark], k) => ({
    id: habitId(kind, k), ch: 'habit', name: `${ENEMIES[kind].name}의 ${name}`, line, pic: { spr: ENEMIES[kind].sprite, mark: mark || '♪' }, kind,
  }))),
  ...Object.entries(TRICKS).flatMap(([kind, list]) => list.map(([name, line], i) => ({
    id: trickId(TRICK_TOOLS[i], kind), ch: 'trick', name: `${toolName(TRICK_TOOLS[i])} · ${name}`, line, pic: { spr: ENEMIES[kind].sprite, tool: ITEMS[TRICK_TOOLS[i]]?.sprite || TRICK_TOOLS[i] }, kind,
  }))),
  ...BOSS_TRICKS.map(([boss, tool, name, line]) => ({
    id: trickId(tool, boss), ch: 'trick', name: `${toolName(tool)} · ${name}`, line, pic: { spr: ENEMIES[boss].sprite, tool: ITEMS[tool]?.sprite || tool }, kind: boss, boss: true,
  })),
  ...TRINKETS.map(t => ({ id: trinketId(t.id), ch: 'trinket', name: t.name, line: t.line, pic: { find: [t.shape, t.pal] }, zone: t.zone })),
  ...ROOMS.flatMap((zone, z) => ROOM_KINDS.map(kind => ({ id: roomId(z, kind), ch: 'room', name: zone[kind][0], line: zone[kind][1], pic: ROOM_PIC[kind], zone: z }))),
  ...HAPPENINGS.map(h => ({ id: happenId(h.id), ch: 'happen', name: h.name, line: h.line, pic: h.pic, zone: h.zone })),
  ...DREAMS.map(d => ({ id: dreamId(d.id), ch: 'dream', name: d.name, line: d.line, pic: { spr: d.pic } })),
  ...FEATS.map(f => ({ id: featId(f.id), ch: 'feat', name: f.name, line: f.line, pic: f.pic })),
  ...[FISH, BUGS, CROPS, FORAGE, DISHES].flatMap(t => Object.values(t).map(it => ({ id: `${it.cat}:${it.id}`, ch: it.cat, name: it.name, line: it.line, pic: it.pic }))),
  ...PLAY_LIST.map(([id, name, line, pic]) => ({ id: playId(id), ch: 'play', name, line, pic })),
  ...WISH_LIST.map(([id, name, line]) => ({ id: wishId(id), ch: 'play', name: `분수 소원 · ${name}`, line, pic: { find: ['coin', id === 'wish' ? 'z' : 'Y'] } })),
  ...DAYS.map(o => ({ id: dayId(o.id), ch: 'day', name: o.name, line: o.line, pic: o.pic })),
  ...HIDE_IDS.map(id => ({ id: hideId(id), ch: 'hide', name: CHARACTERS[id].name, line: HIDE_LINES[id], pic: { spr: CHARACTERS[id].sprite } })),
  ...[...Object.values(TREASURES), ...FOGS].map(t => ({ id: treasureId(t.id), ch: 'treasure', name: t.name, line: t.line, pic: t.pic })),
  ...HEART_PAGES.map(e => ({ ...e, ch: 'heart' })),
  ...PAIR_PAGES.map(e => ({ ...e, ch: 'pair' })),
];

export const ENTRIES = ENTRIES_ALL;
export const ENTRY = Object.fromEntries(ENTRIES.map(e => [e.id, e]));
export const BOOK_TOTAL = ENTRIES.length;
export const byChapter = ch => ENTRIES.filter(e => e.ch === ch);

export const has = (meta, id) => {
  const e = ENTRY[id];
  return !!e && (e.secret ? !!meta.secrets?.[e.secret] : !!meta.book?.[id]);
};
export const bookCount = meta => ENTRIES.reduce((n, e) => n + (has(meta, e.id) ? 1 : 0), 0);
export const chapterCount = (meta, ch) => byChapter(ch).reduce((n, e) => n + (has(meta, e.id) ? 1 : 0), 0);

// Writes a find down; true the first time.
export function record(meta, id) {
  const e = ENTRY[id];
  if (!e || has(meta, id)) return false;
  if (e.secret) (meta.secrets ||= {})[e.secret] = Date.now();
  else (meta.book ||= {})[id] = Date.now();
  return true;
}

// 도감 선물: every GIFT_EVERY pages, a present in the 비밀 상자 (ui/book.js), a little bigger each time
export const GIFT_EVERY = 25;
export const bookGiftOf = k => 60 + 40 * k;
export const bookGiftsDue = meta => Math.floor(bookCount(meta) / GIFT_EVERY) - (meta.bookBox || 0);
