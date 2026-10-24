// 마을 놀이 (v0.30): what there is to play at in the village between trips, and what goes on there on
// a given day. The pieces the village puts up as it grows each have a game in them: the flat stones by
// the pond to skip, the swings to leap off, the seesaw with a friend, the fountain to toss a coin in for
// a wish, the balloon to see the whole place from, and a race with the rival. And on every village day
// (one passes with each trip, data/life.js passDay) something is going on: a rainbow after the rain,
// market day, shooting stars, a turnip too big to pull up alone, hide-and-seek... Nothing says so; you
// see it when you walk in, and the neighbour may let it slip.
// Treasure maps (a bottle in the pond, the market, a friend) each lead to something buried somewhere in
// the village: walk onto the X and you dig it up. On a foggy morning a light at the edge of the woods
// leads somewhere too.
// How it happens: scenes/village-play.js (the games, the maps), scenes/village-days.js (the days). What
// turns up gets its page in the 비밀 도감 (data/book.js chapters 놀이, 마을의 하루, 숨바꼭질, 마을 보물).

import { CHARACTERS } from './characters.js';
import { regionOpen, villageState } from './village.js';
import { REGION } from './village-map.js';

// ---------- 놀이 ----------
// The games' pages: reached by how far you got (meta.games keeps the best of each).
//   [id, name, line, pic]
export const PLAY_LIST = [
  ['skip1', '물수제비', '납작한 돌이 물 위에서 통 튀었다.', { find: ['pebble', 'L'] }],
  ['skip3', '물수제비 세 번', '통, 통, 통! 돌이 세 번 튀었다.', { find: ['pebble', 'l'] }],
  ['skip5', '물수제비 다섯 번', '돌이 물 위를 달려갔다. 오리들이 고개를 돌려 쳐다봤다.', { find: ['pebble', 'c'] }],
  ['skip8', '물수제비 여덟 번', '연못 저 끝까지 튀어 갔다. 잉어가 입을 벌리고 봤다.', { find: ['pebble', 'b'] }],
  ['skip12', '물 위를 걷는 돌', '돌이 연못을 다 건너서 맞은편 풀밭에 똑바로 섰다.', { find: ['pebble', 'Y'] }],
  ['swing1', '그네 점프', '그네에서 뛰어내렸다. 엉덩방아를 찧었다.', { find: ['feather', 'w'] }],
  ['swing3', '그네 점프 세 칸', '휙 날아서 세 칸 너머에 착지했다.', { find: ['feather', 'c'] }],
  ['swing5', '그네 점프 다섯 칸', '바람을 가르고 다섯 칸! 지켜보던 참새가 날아올랐다.', { find: ['feather', 'b'] }],
  ['swing7', '하늘을 나는 그네', '그네에서 날아올라 일곱 칸 너머에 내렸다. 잠깐 새가 된 것 같았다.', { find: ['feather', 'Y'] }],
  ['seesaw1', '시소', '친구랑 시소를 탔다. 쿵덕쿵덕.', { find: ['heart', 'q'] }],
  ['seesaw10', '시소 열 번', '한 번도 안 놓치고 열 번! 친구가 깔깔 웃었다.', { find: ['heart', 'r'] }],
  ['seesaw20', '시소 공중제비', '스무 번째에 친구가 높이 솟아 공중제비를 돌았다.', { find: ['star', 'y'] }],
  ['race1', '달리기 시합', '라이벌과 깃발까지 달렸다. 숨이 턱까지 찼다.', { spr: 'rival' }],
  ['racewin', '첫 승리', '라이벌보다 먼저 깃발을 잡았다! 라이벌은 신발 탓을 했다.', { find: ['ribbon', 'r'] }],
  ['race5', '다섯 번 이겼다', '라이벌이 몰래 달리기 연습을 시작했다고 한다.', { find: ['ribbon', 'b'] }],
  ['race10', '마을에서 제일 빠른 발', '열 번을 이겼다. 라이벌이 처음으로 "대단한데." 하고 말했다.', { find: ['ribbon', 'Y'] }],
  ['racetrip', '꽈당', '라이벌이 달리다 꽈당 넘어졌다. 못 본 척해 줬다.', { find: ['sock', 'v'] }],
  ['balloon', '하늘 산책', '열기구를 타고 마을을 내려다봤다. 우리 집 지붕이 손톱만 했다.', { spr: 'map' }],
  ['mallow1', '노릇노릇 마시멜로', '모닥불에 딱 좋게 구웠다. 겉은 바삭, 속은 말랑.', { find: ['mallow', 'o'] }],
  ['mallow2', '새까만 마시멜로', '불이 붙었다. 후후 불어 먹었다. 숯 맛이 났다.', { find: ['mallow', 'X'] }],
];
export const playId = id => `play:${id}`;
// how far each game has to go for its pages, best first
export const SKIP_MARKS = [[12, 'skip12'], [8, 'skip8'], [5, 'skip5'], [3, 'skip3'], [1, 'skip1']];
export const SWING_MARKS = [[7, 'swing7'], [5, 'swing5'], [3, 'swing3'], [1, 'swing1']];
export const SEESAW_MARKS = [[20, 'seesaw20'], [10, 'seesaw10'], [1, 'seesaw1']];
export const RACE_MARKS = [[10, 'race10'], [5, 'race5'], [1, 'racewin']];
export const marksUpTo = (marks, n) => marks.filter(([k]) => n >= k).map(([, id]) => id);

// 분수 소원: a coin (WISH_COST) in the fountain once a day, and something comes of it (the help for a
// trip, `boon`, lasts the next trip only: core/run.js)
//   [id, name, line, w (how often), what]
export const WISH_COST = 10;
export const WISH_LIST = [
  ['plop', '퐁당', '동전이 퐁당 가라앉았다. 아무 일도 없었다. 그래도 왠지 기분이 좋다.', 30, {}],
  ['luck', '행운의 물결', '물결이 반짝 일었다. 다음 탐험에서는 별난 것들을 더 자주 만날 것 같다.', 16, { boon: { luck: 0.3 } }],
  ['coins', '동전 세 닢', '분수가 동전을 퐁퐁퐁 뱉어 냈다. 하나 넣었는데 셋이 나왔다.', 14, { gold: 30 }],
  ['seed', '씨앗 봉지', '물 위로 씨앗 봉지가 둥실 떠올랐다.', 12, { seed: true }],
  ['fish', '분수 금붕어', '금붕어가 퐁 튀어나와 품에 안겼다.', 10, { item: 'goldfish' }],
  ['rainbow', '작은 무지개', '물보라에 작은 무지개가 걸렸다. 다음 탐험에서는 골드가 조금 더 모일 것 같다.', 10, { boon: { gold: 0.1 } }],
  ['toad', '두꺼비', '동전 대신 두꺼비가 튀어나왔다. "개굴." 소원은 두꺼비가 가져갔다.', 6, {}],
  ['wish', '소원 성취', '분수가 환하게 빛났다. 무슨 소원을 빌었는지는 비밀이다.', 2, { gold: 200 }],
];
export const WISHES = Object.fromEntries(WISH_LIST.map(([id, name, line, w, what]) => [id, { id, name, line, w, ...what }]));
export const wishId = id => `wish:${id}`;
export function rollWish(rnd = Math.random) {
  const list = Object.values(WISHES), total = list.reduce((n, o) => n + o.w, 0);
  let r = rnd() * total;
  for (const o of list) if ((r -= o.w) < 0) return o;
  return list[0];
}

// ---------- 마을의 하루 ----------
// What is going on today. `need` takes what the village is like ({ P, arr, heroes, garden, fogLeft,
// day }); `w`: how often. The page is written when you do the day's thing (scenes/village-days.js).
const d = (id, name, line, pic, w, need) => ({ id, name, line, pic, w, need });
export const DAYS = [
  d('rain', '비 온 뒤 무지개', '밤새 비가 오더니 무지개가 떴다. 무지개 끝에 가 보니 정말로 뭔가 반짝였다.', { find: ['star', 'b'] }, 3, c => c.P >= 3),
  d('market', '장날', '장터 노점에 상점 주인이 평소엔 안 파는 물건을 늘어놓았다.', { spr: 'shopkeep' }, 2, c => c.P >= 13),
  d('stars', '별똥별 내리는 밤', '하늘을 가로지르는 별똥별에 소원을 빌었다. 빌자마자 뭔가 떨어졌다.', { find: ['star', 'y'] }, 3, c => c.day >= 3),
  d('fireflies', '반딧불이 밤', '연못가에 반딧불이가 가득했다. 하나가 손바닥에 내려앉았다.', { find: ['firefly', 'zX'] }, 2, c => c.P >= 3),
  d('turnip', '커다란 순무', '텃밭 옆에 순무가 너무 크게 자랐다. 다 같이 영차영차 뽑았다.', { find: ['turnip', 'wgp'] }, 2, c => c.garden),
  d('laundry', '날아간 양말', '이웃네 빨랫줄에서 날아간 양말을 찾아 줬다. 고맙다고 과자를 줬다.', { find: ['sock', 'q'] }, 2, c => c.arr.has('neighbor')),
  d('kite', '나무에 걸린 연', '나무에 걸린 친구의 연을 흔들어서 떨어뜨려 줬다.', { find: ['kite', 'r'] }, 2, c => c.heroes >= 1),
  d('chicks', '병아리 소동', '마을에 흩어진 병아리 셋을 엄마 닭한테 데려다줬다. 달걀을 하나 얻었다.', { spr: 'pet_chick' }, 2, c => c.P >= 6),
  d('hide', '숨바꼭질', '친구들이 마을 곳곳에 숨었다. 셋을 다 찾았다.', { find: ['leaf', 'g'] }, 3, c => c.heroes >= 3),
  d('picnic', '연못가 소풍', '연못가에 돗자리를 깔고 다 같이 도시락을 먹었다.', { find: ['basket', 'nN'] }, 2, c => c.P >= 8),
  d('fog', '안개 낀 아침', '안개 속에서 작은 불빛이 앞서 갔다. 따라가 보니 뭔가가 떨어져 있었다.', { find: ['marble', 'z'] }, 2, c => c.P >= 4 && c.fogLeft > 0),
  d('moon', '보름달', '큰 나무의 작은 문틈으로 불빛이 샜다. 두드렸더니 달 모양 과자를 줬다.', { find: ['cookie', 'z'] }, 2, c => c.P >= 17),
  d('wind', '바람 부는 날', '바람에 날아간 조합장의 모자를 찾아 줬다.', { find: ['cap', 'b'] }, 2, c => c.day >= 2),
  d('bloom', '꽃 잔치', '마을에 꽃이 한꺼번에 피었다. 꽃을 한 아름 꺾었다.', { find: ['flower', 'q'] }, 2, c => c.P >= 5),
  d('cleanup', '대청소', '길에 떨어진 쓰레기를 다 주워서 조합에 갖다줬다.', { find: ['tin', 'l'] }, 2, c => c.day >= 2),
  d('concert', '광장 연주회', '친구가 광장에서 연주를 했다. 동전을 하나 넣었더니 신나는 곡을 한 곡 더 했다.', { find: ['whistle', 'y'] }, 2, c => c.P >= 12 && c.heroes >= 1),
  d('campfire', '모닥불 밤', '광장에 모닥불을 피우고 다 같이 둘러앉았다.', { spr: 'ash' }, 2, c => c.P >= 12),
];
export const DAY = Object.fromEntries(DAYS.map(o => [o.id, o]));
export const dayId = id => `day:${id}`;
// The day's goings-on, rolled the first time you walk into the village on a new day: not before the
// second trip, never the same two days running. meta.today keeps it, and how far it has got.
export function rollToday(meta, c, rnd = Math.random) {
  const was = meta.today?.ev, can = (meta.day || 0) >= 2 ? DAYS.filter(o => o.id !== was && o.need(c)) : [];
  let ev = null;
  if (can.length) {
    const total = can.reduce((n, o) => n + o.w, 0);
    let r = rnd() * total;
    ev = can.find(o => (r -= o.w) < 0)?.id || can[0].id;
  }
  meta.today = { day: meta.day || 0, ev, seed: Math.floor(rnd() * 1e9), done: false };
  return meta.today;
}

// 숨바꼭질: each friend found hiding gets a page of their own (how they gave themselves away)
export const HIDE_LINES = {
  adv: '밀짚모자 챙이 삐죽 나와 있었다. 모자부터 숨겨야지.',
  rogue: '복면까지 쓰고 숨었는데 줄무늬 꼬리가 다 보였다.',
  mage: '구름인 척하고 있었다. 구름은 땅에 앉지 않는다.',
  knight: '꼬리를 너무 세게 흔들어서 숨은 데가 같이 흔들렸다.',
  vamp: '거꾸로 매달려 자고 있었다. 숨바꼭질 중인 걸 잊었나 보다.',
  rabbit: '귀 두 개가 쫑긋. 귀는 숨길 수가 없다.',
  hamster: '볼에 간식을 잔뜩 넣고 숨어 있었다. 오물오물 소리가 났다.',
  cat: '숨은 줄 알았는데 꼬리가 살랑살랑.',
  hedgehog: '동그랗게 말려서 밤송이인 척했다.',
  owl: '눈을 꼭 감고 있었다. 눈을 감으면 안 보이는 줄 알았나 보다.',
  fox: '돋보기가 빼꼼 보였다. 나를 먼저 찾고 있었다.',
  frog: '눈 두 개만 빼꼼 내놓고 있었다.',
  panda: '풀을 뜯어 먹느라 숨는 걸 잊어버렸다.',
  turtle: '등껍질 속에 쏙. 그래도 등껍질은 다 보였다.',
  mole: '흙더미가 꿈틀꿈틀 움직였다.',
  penguin: '뒤뚱뒤뚱 숨을 곳을 찾다가 들켰다.',
  bear: '작은 나무 뒤에 숨었다. 곰이 나무보다 컸다.',
  goat: '뿔이 걸려서 빠져나오지 못하고 있었다.',
  dragon: '참다가 재채기를 했다. 연기가 피어올랐다.',
  skunk: '어디 숨었는지 냄새로 알았다.',
  chameleon: '감쪽같았다. 눈을 깜빡여서 들켰다.',
};
export const hideId = id => `hide:${id}`;
export const HIDE_IDS = Object.keys(HIDE_LINES).filter(id => CHARACTERS[id]);

// ---------- 마을 보물 ----------
// Twelve treasure maps, each to something buried at `spot` (a grass cell that is only there once its
// part of the village is: the map for it turns up only then). A map in the basket is `map:<id>`; walk
// onto its X and you dig the thing up, and what was in it besides (`gold`).
//   [id, name, line, shape, pal, spot, gold]
export const TREASURE_LIST = [
  ['oldcoin', '옛날 동전', '마을에 가게가 생기기 전에 쓰던 동전 꾸러미. 동전마다 조합 문장이 찍혀 있다.', 'coin', 'Y', [23, 29], 150],
  ['marbles', '유리구슬 주머니', '알록달록한 구슬이 가득. 누가 구슬치기에서 따서 묻어 뒀나 보다.', 'marble', 'b', [8, 9], 100],
  ['capsule', '타임캡슐', '깡통 안에 그림 한 장과 쪽지. "어른이 되면 열어 보기. 일꾼 반 일동."', 'tin', 'L', [26, 11], 200],
  ['spoon', '은수저', '반짝반짝 닦인 은수저. 손잡이에 작은 이름이 새겨져 있다.', 'spoon', 'l', [36, 10], 120],
  ['clover4', '눌린 네잎클로버', '책갈피처럼 눌린 네잎클로버. 아직 초록빛이다.', 'leaf', 'g', [36, 31], 100],
  ['medal', '오래 일한 일꾼 훈장', '조합이 오래 일한 일꾼에게 준 훈장. 이름 칸이 긁혀서 지워져 있다.', 'badge', 'Y', [56, 19], 250],
  ['photo', '빛바랜 단체 사진', '조합 앞에서 찍은 사진. 다들 웃고 있다. 뒷줄 몇 명은 얼굴에 동물 귀가 그려져 있다.', 'photo', 'w', [30, 36], 200],
  ['toyboat', '장난감 배', '나무를 깎아 만든 작은 배. 개울에 띄우면 잘 뜰 것 같다.', 'boat', 'n', [22, 33], 150],
  ['goldseed', '황금 씨앗', '작고 단단한 금빛 씨앗. 심어도 싹이 날 것 같지는 않다.', 'seed', 'Y', [53, 2], 300],
  ['papercrown', '종이 왕관', '옛날 축제 때 쓰던 종이 왕관. 별 스티커가 반쯤 떨어졌다.', 'star', 'o', [56, 38], 200],
  ['bell', '은방울', '흔들면 딸랑, 맑은 소리가 난다. 장미 덩굴 밑에 묻혀 있었다.', 'ring', 'l', [7, 2], 250],
  ['boxkey', '녹슨 상자 열쇠', '오래된 열쇠. 집에 와서 비밀 상자에 꽂아 봤더니 딱 맞았다.', 'key', 'N', [26, 2], 500],
];
// On foggy mornings (DAYS fog) a light leads you to these, one a fog day, in this order.
//   [id, name, line, shape, pal]
export const FOG_LIST = [
  ['fogtag', '빛바랜 명찰', '안개 속 불빛을 따라갔더니 풀숲에 명찰이 떨어져 있었다. 이름이 번져서 안 보인다.', 'tag', 'w'],
  ['fogboot', '작은 장화 한 짝', '아이 발만 한 장화. 진흙이 아직 덜 말랐다.', 'sock', 'h'],
  ['foglamp', '꺼진 작업등', '일꾼들이 들고 다니던 등. 심지가 다 타 버렸다.', 'bottle', 'Y'],
  ['fogletter', '젖은 편지', '"일이 끝나면 꼭 돌아갈게. 조합장님이 약속했어." 나머지는 번져서 못 읽겠다.', 'letter', 'c'],
  ['fogmask', '가면 조각', '하얀 가면의 깨진 조각. 들판 깊은 곳에서 본 그 가면과 닮았다.', 'shard', 'w'],
];
export const TREASURES = Object.fromEntries(TREASURE_LIST.map(([id, name, line, shape, pal, spot, gold]) => [id, { id, name, line, pic: { find: [shape, pal] }, spot, gold }]));
export const FOGS = FOG_LIST.map(([id, name, line, shape, pal]) => ({ id, name, line, pic: { find: [shape, pal] } }));
export const treasureId = id => `treasure:${id}`;
export const mapId = id => `map:${id}`;
export const isMap = id => id.startsWith('map:');
export const MAP_PIC = { find: ['map', 'c'] };
export const MAP_PRICE = 120;
// the next map there is to have: the first treasure not dug up yet, not already in the basket, whose
// spot is there in the village now (`open(x, y)`)
export function nextMap(meta, has, open) {
  return TREASURE_LIST.map(t => TREASURES[t[0]]).find(t => !has(treasureId(t.id)) && !(meta.bag?.[mapId(t.id)] > 0) && open(...t.spot)) || null;
}
// the map there is to be had now, for this save (its treasure's part of the village open)
export function mapToFind(meta) {
  const st = villageState(meta);
  return nextMap(meta, id => !!meta.book?.[id], (x, y) => regionOpen(REGION[y][x], st));
}
// the next fog find (null once all five are found)
export const nextFog = has => FOGS.find(f => !has(treasureId(f.id))) || null;
