// The village you come back to between runs. It starts as a little clearing in the woods (the guild's
// tent, the peddler's cart, an empty lot and the burrow out to the fields) and grows with every stage
// you beat at every 회차, forty clears in all: the woods draw back part by part, folk move in, and one
// new thing goes up after each new clear, until the whole place is a festival (village-map.js holds
// the grown village and when each part of it opens; BUILD below, what each clear brings).
// You walk around and bump into people. Villagers move in one by one as you get further (`when`), and
// each looks after part of your progress (`panel`, built in ui/hub.js). Some of them like a stroll
// round the paths (`stroll`: ms between steps; the rival jogs); the others keep to their doors.

import { josa } from '../core/util.js';
import { bookGiftsDue } from './balance.js';
import { RECIPES, recipeKey } from './relics.js';
import { FRIENDS, cleared } from './stages.js';
import { CHARACTERS } from './characters.js';
import { MAP, REGION, REGIONS } from './village-map.js';

export const VILLAGE_MAP = MAP;

// Footprints in tiles (odd widths, so the door sits in the middle of a tile). The door is the middle
// of the bottom row; the owner stands just below it. In street order (the neighbour's hints go by it).
export const HOUSES = [
  { id: 'guild', x: 28, y: 13, w: 5, h: 4, roof: '#3f6fb3', sign: 'flag' },
  { id: 'shop', x: 21, y: 17, w: 5, h: 4, roof: '#c0563a', sign: 'coin', awning: true },
  { id: 'carpenter', x: 46, y: 15, w: 5, h: 4, roof: '#5f9a4a', sign: 'saw', chimney: true },
  { id: 'smith', x: 19, y: 9, w: 5, h: 4, roof: '#6b6f7c', sign: 'hammer', chimney: true },
  { id: 'neighbor', x: 13, y: 19, w: 5, h: 4, roof: '#f29bb2', sign: 'heart' },
  { id: 'rescue', x: 38, y: 28, w: 5, h: 4, roof: '#f08c3a', sign: 'cross' },
  { id: 'rival', x: 37, y: 9, w: 5, h: 4, roof: '#7a4bb0', sign: 'star' },
];
export const doorOf = h => ({ x: h.x + Math.floor(h.w / 2), y: h.y + h.h });

// What goes up as the village grows (nobody to talk to; a word when you look): the forty pieces'
// buildings, and a cottage down the friends' lanes for each stage's pair of friends once one of them
// is home (`cond` f0..f9).
export const BUILDINGS = [
  { id: 'bakery', x: 1, y: 17, w: 5, h: 4, p: 7, name: '빵집', tip: '고소한 냄새가 마을까지 퍼진다', chimney: true, roof: '#7a4a3a', sign: 'bread' },
  { id: 'windmill', x: 2, y: 10, w: 3, h: 3, p: 9, name: '풍차', tip: '빵집에 갈 밀을 빻는다' },
  { id: 'gazebo', x: 34, y: 25, w: 3, h: 3, p: 18, name: '정자', tip: '연못을 바라보며 쉬는 곳' },
  { id: 'inn', x: 33, y: 35, w: 5, h: 4, p: 21, name: '여관', tip: '먼 들판에서 온 손님들이 묵어 간다', chimney: true, roof: '#4f7ab8', sign: 'moon' },
  { id: 'greenhouse', x: 7, y: 14, w: 5, h: 3, p: 22, name: '온실', tip: '겨울에도 딸기가 익는다' },
  { id: 'tower', x: 49, y: 3, w: 3, h: 3, p: 25, name: '전망대', tip: '올라가면 들판 끝까지 보인다고 한다' },
  { id: 'bandstand', x: 47, y: 31, w: 5, h: 4, p: 31, name: '무대', tip: '마을 악단이 연주한다' },
  { id: 'carousel', x: 53, y: 33, w: 5, h: 4, p: 32, name: '회전목마', tip: '빙글빙글, 끝없이 돈다' },
];
const COTTAGE_AT = [[17, 27], [13, 27], [9, 27], [5, 27], [1, 27], [19, 32], [15, 32], [11, 32], [7, 32], [3, 32]];
const COTTAGE_ROOF = ['#7cc45a', '#5a8fd8', '#4fae8a', '#e0a24a', '#9a8a7a', '#f08cb0', '#a8c8e8', '#6a6a8a', '#d9573a', '#b48ade'];
COTTAGE_AT.forEach(([x, y], s) => BUILDINGS.push({ id: `cot${s}`, cot: s, x, y, w: 3, h: 3, cond: `f${s}`, roof: COTTAGE_ROOF[s], tip: '구해 온 친구가 사는 통나무 오두막' }));
// a cottage goes by the friends of its stage who live there
export const cottageName = (m, s) => `${FRIENDS[s].filter(id => m.chars[id]).map(id => CHARACTERS[id].name).join(' · ')}네 집`;

// Odds and ends round the village (scenes/village-props.js), each standing on its tile(s) (`w`, `h` or
// `cells` from x, y); they come with a clear (`p`), go when something takes their place (`until`), or
// stand by someone's house (`cond`, the same as the house's). A few hang over the paths and you walk
// under them (WALK).
export const PROP_NAMES = {
  barrel: '나무통', crate: '나무 상자', hay: '건초 더미', well: '우물', pumpkin: '호박', mushroom: '빨간 버섯',
  logs: '장작더미', board: '조합 게시판', dummy: '짚 인형', hive: '꿀벌 통', rock: '이끼 낀 돌', veg: '텃밭',
  scarecrow: '허수아비', cart: '호박 수레', campfire: '모닥불', lamp: '반딧불 등', bench: '나무 벤치', fountain: '분수',
  stall: '장터 노점', arch: '꽃 아치', swings: '그네', seesaw: '시소', fruittree: '사과나무', flowerclock: '꽃 시계',
  balloon: '열기구', gate: '장터 문', foodstall: '먹거리 노점', statue: '영웅 동상', trellis: '장미 덩굴', rainbow: '무지개 꽃밭',
  topiary: '동물 나무', maypole: '축제 기둥', bunting: '깃발 줄', lanterns: '등불 줄', lights: '꼬마전구', pondlanterns: '연못 등불',
};
export const WALK = new Set(['bunting', 'lanterns', 'lights', 'pondlanterns', 'rainbow', 'arch', 'flowerclock']);
export const PROPS = [
  { x: 30, y: 22, kind: 'campfire', until: 12 },
  { x: 26, y: 25, kind: 'well', p: 2 },
  { x: 27, y: 19, kind: 'lamp', p: 4 },
  { x: 33, y: 19, kind: 'lamp', p: 4 },
  { x: 26, y: 24, kind: 'lamp', p: 4 },
  { x: 34, y: 24, kind: 'lamp', p: 4 },
  { x: 24, y: 15, kind: 'lamp', p: 4 },
  { x: 36, y: 15, kind: 'lamp', p: 4 },
  { x: 17, y: 24, kind: 'lamp', p: 4 },
  { x: 12, y: 21, kind: 'lamp', p: 4 },
  { x: 44, y: 19, kind: 'lamp', p: 4 },
  { x: 24, y: 28, kind: 'lamp', p: 4 },
  { x: 36, y: 33, kind: 'lamp', p: 4 },
  { x: 27, y: 27, kind: 'bench', p: 8, w: 2 },
  { x: 31, y: 27, kind: 'bench', p: 8, w: 2 },
  { x: 26, y: 32, kind: 'bench', p: 8, w: 2 },
  { x: 7, y: 10, kind: 'veg', p: 6 },
  { x: 8, y: 10, kind: 'veg', p: 6 },
  { x: 9, y: 10, kind: 'veg', p: 6 },
  { x: 10, y: 10, kind: 'veg', p: 6 },
  { x: 7, y: 12, kind: 'veg', p: 6 },
  { x: 8, y: 12, kind: 'veg', p: 6 },
  { x: 9, y: 12, kind: 'veg', p: 6 },
  { x: 10, y: 12, kind: 'veg', p: 6 },
  { x: 11, y: 11, kind: 'scarecrow', p: 6 },
  { x: 11, y: 18, kind: 'hay', p: 6 },
  { x: 12, y: 19, kind: 'hay', p: 6 },
  { x: 12, y: 15, kind: 'cart', p: 6 },
  { x: 29, y: 21, kind: 'fountain', p: 12, w: 3, h: 3 },
  { x: 37, y: 25, kind: 'stall', p: 13, w: 2, v: 0 },
  { x: 40, y: 25, kind: 'stall', p: 13, w: 2, v: 1 },
  { x: 30, y: 19, kind: 'arch', p: 14 },
  { x: 39, y: 23, kind: 'arch', p: 14 },
  { x: 21, y: 23, kind: 'arch', p: 14 },
  { x: 22, y: 28, kind: 'swings', p: 15, w: 2 },
  { x: 22, y: 26, kind: 'seesaw', p: 15, w: 2 },
  { x: 52, y: 14, kind: 'fruittree', p: 16 },
  { x: 54, y: 14, kind: 'fruittree', p: 16 },
  { x: 53, y: 16, kind: 'fruittree', p: 16 },
  { x: 55, y: 16, kind: 'fruittree', p: 16 },
  { x: 57, y: 17, kind: 'fruittree', p: 16 },
  { x: 51, y: 16, kind: 'fruittree', p: 16 },
  { x: 57, y: 21, kind: 'hive', p: 16 },
  { x: 57, y: 23, kind: 'hive', p: 16 },
  { x: 54, y: 29, kind: 'bigtree', p: 17, cells: [[-1, 0], [0, 0], [1, 0]] },
  { x: 26, y: 20, kind: 'bunting', p: 19, to: [34, 20] },
  { x: 26, y: 24, kind: 'lanterns', p: 23, to: [34, 24] },
  { x: 17, y: 16, kind: 'flowerclock', p: 24, w: 3, h: 2 },
  { x: 45, y: 6, kind: 'balloon', p: 26 },
  { x: 54, y: 29, kind: 'lights', p: 27 },
  { x: 47, y: 23, kind: 'stall', p: 28, w: 2, v: 2 },
  { x: 47, y: 26, kind: 'stall', p: 28, w: 2, v: 3 },
  { x: 30, y: 30, kind: 'pondlanterns', p: 29 },
  { x: 44, y: 25, kind: 'gate', p: 30, cells: [[0, 0], [2, 0]] },
  { x: 47, y: 37, kind: 'foodstall', p: 33, w: 2, v: 0 },
  { x: 50, y: 38, kind: 'foodstall', p: 33, w: 2, v: 1 },
  { x: 57, y: 38, kind: 'foodstall', p: 33, w: 2, v: 2 },
  { x: 30, y: 26, kind: 'statue', p: 34 },
  { x: 6, y: 4, kind: 'trellis', p: 35 },
  { x: 13, y: 4, kind: 'trellis', p: 35 },
  { x: 4, y: 7, kind: 'trellis', p: 35 },
  { x: 15, y: 7, kind: 'trellis', p: 35 },
  { x: 8, y: 6, kind: 'rainbow', p: 36, w: 4, h: 2 },
  { x: 10, y: 3, kind: 'topiary', p: 38 },
  { x: 3, y: 5, kind: 'topiary', p: 38 },
  { x: 16, y: 9, kind: 'topiary', p: 38 },
  { x: 30, y: 3, kind: 'maypole', p: 40 },
  { x: 27, y: 16, kind: 'board' },
  { x: 33, y: 16, kind: 'barrel' },
  { x: 26, y: 18, kind: 'crate' },
  { x: 20, y: 20, kind: 'barrel' },
  { x: 24, y: 11, kind: 'logs', cond: 'smith' },
  { x: 18, y: 12, kind: 'barrel', cond: 'smith' },
  { x: 42, y: 11, kind: 'dummy', cond: 'rival' },
  { x: 44, y: 29, kind: 'crate', cond: 'rescue' },
  { x: 51, y: 18, kind: 'logs', p: 1 },
  { x: 45, y: 15, kind: 'crate', p: 1 },
  { x: 18, y: 21, kind: 'mushroom', cond: 'neighbor' },
  { x: 12, y: 20, kind: 'pumpkin', cond: 'neighbor' },
];
export const propCells = pr => pr.cells || Array.from({ length: (pr.w || 1) * (pr.h || 1) }, (_, i) => [i % (pr.w || 1), Math.floor(i / (pr.w || 1))]);

// The big old tree in the orchard, taller than three houses: its trunk takes up `block`, the crown
// spreads over the grass, and you can walk underneath (the crown fades while you are under it).
export const BIG_TREE = { x: 54, y: 29, p: 17, block: [[53, 29], [54, 29], [55, 29]], crown: { x0: 50, x1: 58, y0: 21, y1: 28 } };

// Your own house (the story's dream, scenes/storyboards.js): an empty lot until the first stage you
// beat, when the guild hands it over as the prize and the beaver who built it moves in next door.
export const HOME = { id: 'home', x: 35, y: 17, w: 5, h: 4, roof: '#f4cf4f', sign: 'heart', chimney: true };
export const ownsHome = m => m.stats.wins > 0;

// ---------- growing ----------
// how far the village has grown: one for every stage beaten at every 회차 (0..40)
export const villageP = m => FRIENDS.reduce((n, _, s) => n + cleared(m, s), 0);
export const GROWN = 40;
// who has come to live here: the folk (FOLK `when`) and each stage's friends (f0..f9)
export function arrivals(m) {
  const a = new Set();
  for (const [id, f] of Object.entries(FOLK)) if (f.when(m)) a.add(id);
  FRIENDS.forEach((pair, s) => { if (pair.some(id => m.chars[id])) a.add(`f${s}`); });
  return a;
}
// a snapshot of the village for a save: how far grown, who is here
export const villageState = m => ({ P: villageP(m), arr: arrivals(m) });
export function regionOpen(ch, st) {
  const r = REGIONS[ch];
  return !!r && ((r.p != null && st.P >= r.p) || (r.cond != null && st.arr.has(r.cond)) || !!r.any?.some(c => st.arr.has(c)));
}
export const cellOpen = (x, y, st) => regionOpen(REGION[y]?.[x], st);
// is a building or a prop up in this state
export const shownIn = (o, st) => (o.p == null || st.P >= o.p) && (o.until == null || st.P < o.until) && (!o.cond || st.arr.has(o.cond)) && cellOpen(o.x, o.y, st);

// What the village is called as it grows, and how its oldest two houses look: the guild's log cabin
// becomes a log hall and then the clock-tower hall, the plank kiosk a shop of its own
// (scenes/village-buildings.js).
export const LEVELS = [
  { p: 0, name: '작은 마을' },
  { p: 10, name: '아늑한 마을' },
  { p: 20, name: '북적이는 마을' },
  { p: 30, name: '꽃피는 읍내' },
  { p: 40, name: '축제의 마을' },
];
export const levelOf = P => LEVELS.filter(l => P >= l.p).length - 1;
export const villageName = P => LEVELS[levelOf(P)].name;
export const guildLevel = P => (P >= 20 ? 2 : P >= 10 ? 1 : 0);
export const shopLevel = P => (P >= 10 ? 1 : 0);
// the cobbles go down over the dirt paths, the flower beds bloom
export const COBBLE_P = 11;
export const FLOWERS_P = 5;

// The forty clears, each with the thing it puts up (`at`: where the camera goes to watch, `say`: what
// the banner says when it is not just "...이 생겼다!"). Every tenth renames the village too.
export const BUILD = [
  { p: 1, name: '내 집과 목수네 공방', at: [41, 18], say: '드디어 내 집이 생겼다!' },
  { p: 2, name: '우물', at: [26, 25] },
  { p: 3, name: '연못', at: [30, 30] },
  { p: 4, name: '반딧불 등', at: [30, 21] },
  { p: 5, name: '꽃밭', at: [30, 28], say: '꽃밭에 꽃이 피었다!' },
  { p: 6, name: '텃밭', at: [9, 12] },
  { p: 7, name: '빵집', at: [3, 19] },
  { p: 8, name: '벤치', at: [29, 27] },
  { p: 9, name: '풍차', at: [3, 11] },
  { p: 10, name: '조합 회관과 새 가게', at: [27, 18] },
  { p: 11, name: '돌길', at: [30, 22], say: '마을 길에 돌이 깔렸다!' },
  { p: 12, name: '분수', at: [30, 22] },
  { p: 13, name: '장터 노점', at: [39, 24] },
  { p: 14, name: '꽃 아치', at: [30, 20] },
  { p: 15, name: '놀이터', at: [23, 27] },
  { p: 16, name: '과수원', at: [54, 17] },
  { p: 17, name: '큰 나무', at: [54, 25] },
  { p: 18, name: '정자', at: [35, 26] },
  { p: 19, name: '깃발 줄', at: [30, 20], say: '광장에 깃발 줄이 걸렸다!' },
  { p: 20, name: '개울과 다리', at: [30, 38] },
  { p: 21, name: '여관', at: [35, 36] },
  { p: 22, name: '온실', at: [9, 15] },
  { p: 23, name: '등불 줄', at: [30, 23], say: '광장에 등불 줄이 걸렸다!' },
  { p: 24, name: '꽃 시계', at: [18, 16] },
  { p: 25, name: '전망대 언덕', at: [50, 6], say: '언덕 위에 전망대가 생겼다!' },
  { p: 26, name: '열기구', at: [45, 5] },
  { p: 27, name: '큰 나무 꼬마전구', at: [54, 25], say: '큰 나무에 꼬마전구가 달렸다!' },
  { p: 28, name: '과일 노점', at: [48, 24] },
  { p: 29, name: '연못 등불', at: [30, 30], say: '연못에 등불이 떴다!' },
  { p: 30, name: '장터', at: [50, 32], say: '장터가 열렸다!' },
  { p: 31, name: '무대', at: [49, 33] },
  { p: 32, name: '회전목마', at: [55, 35] },
  { p: 33, name: '먹거리 노점', at: [51, 37] },
  { p: 34, name: '영웅 동상', at: [30, 25] },
  { p: 35, name: '꽃 정원', at: [9, 6] },
  { p: 36, name: '무지개 꽃밭', at: [10, 7] },
  { p: 37, name: '집집마다 깃발', at: [30, 17], say: '집집마다 깃발이 걸렸다!' },
  { p: 38, name: '동물 나무', at: [10, 5] },
  { p: 39, name: '불꽃놀이', at: [30, 20], say: '불꽃놀이가 시작됐다!' },
  { p: 40, name: '축제', at: [30, 6], say: '마을 축제가 열렸다!' },
];

const deaths = m => m.stats.runs - m.stats.wins;
export const FOLK = {
  guild: {
    name: '조합장', sprite: 'guildBoss', panel: 'chars', when: () => true,
    tip: '탐험 의뢰를 받고 같이 갈 동료를 고른다',
    lines: ['오늘도 탐험 부탁하네.', '무리하지 말고, 다치면 돌아오게.', '같이 갈 동료는 골랐나?'],
  },
  shop: {
    name: '상점 주인', sprite: 'shopkeep', panel: 'shop', when: () => true,
    tip: '골드로 영구 강화와 새 유물을 산다',
    lines: ['어서 와! 오늘은 뭐 사 갈래?', '반짝돌 덕에 장사가 잘돼.', '튼튼해져야 멀리 가지!'],
  },
  neighbor: {
    name: '수다쟁이 이웃', sprite: 'neighbor', panel: 'rumor', when: m => m.stats.runs >= 1, stroll: 900,
    tip: '지난 탐험 이야기와 소문을 들려준다',
    arrive: '안녕! 오늘 이사 왔어. 소문은 나한테 물어봐!',
    lines: ['들었어? 들었어?', '어제 그 얘기 해 줄까?', '소문 하나 알려 줄게!'],
  },
  smith: {
    name: '두더지 대장장이', sprite: 'mole', panel: 'books', when: m => m.stats.evos >= 1 || m.stats.maxFloor >= 5,
    tip: '찾아낸 합성 조합을 적어 두고, 만들어 본 진화 유물을 주문받아 만든다',
    arrive: '대장간을 차렸다. 찾은 조합은 내가 다 적어 두지!',
    hint: '요즘 두더지 하나가 마을을 기웃거려. 유물을 합쳐 보거나 깊은숲까지 가 보면 이사 올지도?',
    lines: [m => (bookGiftsDue(RECIPES.filter(rc => m.recipes[recipeKey(rc)]).length, m.bookGifts) > 0 ? '도감이 꽤 찼군! 선물이 있다.' : m.forge ? '주문한 건 다 만들어 놨다. 들고 가!' : '새 조합 찾았나?'), '반짝돌 냄새가 나는군.', '뚝딱뚝딱. 주문도 받는다.'],
  },
  rescue: {
    name: '구조대원', sprite: 'rescuer', panel: 'records', when: m => deaths(m) >= 2, stroll: 1100,
    tip: '지금까지의 기록과 들판 친구 도감을 적어 둔다',
    arrive: '오늘부터 마을 구조대야. 쓰러지면 내가 업어 올게!',
    hint: '들판에서 자꾸 쓰러지는 일꾼이 있다던데... 구조대가 생긴다는 소문이 있어.',
    lines: [m => `벌써 ${deaths(m)}번째 구조야.`, '오늘은 업혀 오지 마.', '구조 일지 볼래?'],
  },
  // 비버 목수: built your house and stayed; makes furniture, adds rooms on, and puts the village's new
  // things up after every clear (ui/hub.js carpenter)
  carpenter: {
    name: '비버 목수', sprite: 'beaver', panel: 'carpenter', when: ownsHome,
    tip: '가구를 만들어 팔고, 집을 넓혀 주고, 마을에 새 건물을 짓는다',
    arrive: '네 집, 내가 지었어! 가구가 필요하거나 집을 넓히고 싶으면 불러.',
    hint: '스테이지 하나를 끝까지 깨면 조합이 상으로 집을 준대. 그 집 지을 목수도 온대!',
    lines: ['뚝딱뚝딱.', m => (villageP(m) < GROWN ? `안 깬 스테이지를 하나 더 깨고 오면 ${josa(BUILD[villageP(m)].name, '을', '를')} 만들어 줄게.` : '이제 마을엔 더 지을 게 없네. 가구나 만들어야지.'), '가구 하나 들여놓을래?'],
  },
  rival: {
    name: '라이벌', sprite: 'rival', panel: 'rival', when: m => m.stats.bosses.length >= 1, stroll: 380,
    tip: '나보다 멀리 가 봤다고 큰소리친다',
    arrive: '왕쥐를 잡았다며? 흥, 나도 이 마을로 이사 왔다.',
    hint: '초원 끝의 왕쥐를 잡으면 웬 잘난 척쟁이가 찾아온대.',
    lines: ['흥.', '이번엔 내가 더 멀리 갈 거다.', '아직 멀었어.'],
  },
};

// What the unlocked heroes say when you pick them in town
export const HERO_LINES = ['오늘은 내가 갈게!', '맡겨 줘!', '나도 갈래!'];

// The neighbour's take on how the last run went (`last`: meta.lastRun), a few lines at most.
// `cause` reads like "들쥐에게 당했다", so "~면서?" turns it into hearsay.
// the later ones only once more tags have come back
const EERIE = [
  '명찰 주워 왔다며? 조합장이 고맙대. 근데 그 명찰들은 어디에 두는 걸까?',
  '깊은 곳에 가면 누가 이름을 부른대. 대답하면 안 된대!',
  '끝집 일꾼 요즘 안 보이더라. 이사 갔나 봐! …그치?',
  '조합장 방 벽에 가면이 잔뜩 걸려 있대. 폐허에서 하나씩 주워 온 거래.',
  '들판 친구들 말이야, 가끔 우리랑 똑같이 웃지 않아?',
];

const TOOL_TALK = {
  pinecone: '솔방울로 딱 맞혔다며? 다람쥐들이 그거 자기네 거라고 투덜대더라.',
  dandelion: '민들레 홀씨 타고 날아갔다며? 위에서 보면 들판이 어떻게 생겼어?',
  honeyjar: '꿀 병을 통째로 던졌다며? 아깝다… 다음엔 한 숟갈만 남겨 와.',
  sleepy: '졸음 꽃가루를 뿌렸다며? 그 동네 녀석들 아직도 하품한대.',
  chili: '고추를 먹였다며? 그 녀석 아직도 혀가 얼얼하대. 조금 불쌍해.',
  bell: '어제 저녁에 딸랑딸랑 소리 들리던데, 그거 네 방울이었어?',
};
// a critter's odd answer to a tool, or a trick, that you saw for the first time on this trip
const FOUND_TALK = {
  pine_roll: '공벌레로 볼링을 쳤다며? 데구르르 쾅! 나도 한 번 보고 싶다.',
  pine_seal: '물범이 코끝으로 솔방울 묘기를 부렸다며? 박수는 쳐 줬어?',
  pine_squirrel: '다람쥐가 네 솔방울을 받아서 묻으러 갔다며? 봄 되면 거기서 솔방울 나무 나겠다!',
  bell_frog: '개구리가 방울을 꿀꺽 삼켰다며? 딸꾹딸꾹 소리가 여기까지 들리는 것 같아.',
  bell_bats: '방울 소리에 박쥐들이 길을 잃었다며? 귀가 너무 밝아도 고생이구나.',
  bell_cat: '그림자 고양이가 방울 갖고 노느라 숨는 것도 잊었다며? 고양이는 다 똑같네.',
  honey_bees: '벌들이 쏟아진 꿀에 홀딱 빠졌다며? 벌도 꿀은 못 참나 봐.',
  chili_snow: '눈사람한테 고추를 줬다며? 주르륵 녹았겠다… 조금 미안하네.',
  chili_salamander: '불도마뱀이 고추를 받아먹고 부풀었다며? 매운 걸 좋아하는 녀석도 있구나.',
  den_sneak: '다들 자는 사이에 낮잠 방 상자를 열었다며? 발소리 하나 안 냈구나!',
  well_evo: '소원 우물에 유물을 던졌더니 진화해서 떠올랐다며? 나도 동전 하나 던져 볼까.',
  big_prize: '기세등등해진 녀석이 별사탕을 떨궜다며? 그거 진짜 달아?',
  grump_brawl: '심술 버섯 포자 때문에 녀석들끼리 물고 뜯었다며? 재채기는 멈췄어?',
};
// the last-moment line is the hero's own ("내가 던진 폭탄"); a neighbour says it back to you ("네가 던진 폭탄")
const yours = s => s.replace(/^내가 /, '네가 ').replace(/^내 /, '네 ');
const ROUTE_TALK = {
  chief: '왕관 쓴 녀석 있는 굴로 일부러 들어갔다며? 간도 크다!',
  rest: '표지판 보고 쉬어 가는 굴로 갔구나. 잘했어, 쉬는 것도 일이야.',
  den: '다 같이 낮잠 자는 방이 있다는 굴로 들어갔다며? 걔들 깨면 어쩌려고!',
};

export function gossip(last, meta) {
  if (!last) return ['아직 아무 일도 없었어. 얼른 들판에 다녀와!'];
  const out = [];
  if (last.won) out.push(`들었어? ${josa(last.who, '이', '가')} ${last.zone} 대장을 쓰러뜨렸대! 온 마을이 들썩들썩해.`);
  if (last.won && meta.stats.wins === 1) out.push('조합장이 상으로 집을 줬다며? 집들이 때 나도 꼭 불러 줘!');
  else if (last.grew && BUILD[last.grew - 1]) out.push(`마을에 ${josa(BUILD[last.grew - 1].name, '이', '가')} 생겼어! 비버 목수가 밤새 뚝딱뚝딱했대.`);
  else if (last.cause) out.push(`${last.zone}에서 ${yours(last.cause)}면서? 다들 걱정했어.`);
  if (last.friend) out.push(`우리에 갇혀 있던 ${josa(last.friend, '을', '를')} 구해 왔다며? 마을이 더 북적북적해졌어.`);
  if (last.kills >= 15) out.push(`적을 ${last.kills}마리나 쓰러뜨렸다며? 대단해.`);
  if (last.recipes) out.push(`새 합성 조합을 ${last.recipes}개나 찾았다던데? 대장장이가 궁금해하더라.`);
  if (last.gold >= 150) out.push(`${last.gold}G나 벌어 왔다며? 상점 주인이 싱글벙글이야.`);
  // the fields' odd corners you found
  if (last.spring && out.length < 3) out.push('돌산 온천에 몸 담갔다며? 부럽다… 다음엔 나도 데려가!');
  else if (last.ring && out.length < 3) out.push('요정 고리를 타 봤다며? 뿅 하고 나오면 어지럽지 않아?');
  else if (last.honey && out.length < 3) out.push('벌집 꿀 먹었다며? 벌한테 쏘인 데는 괜찮아? 꿀 냄새 난다.');
  else if (last.screams && out.length < 3) out.push('어제 들판에서 꺄아아 소리 들렸는데, 너였어? 비명 뿌리 뽑았구나.');
  else if (last.weeds && out.length < 3) out.push(`풀뽑기도 했다며? ${last.weeds}포기나! 일꾼 다 됐네.`);
  // something new you saw a critter do this trip
  const found = (last.found || []).find(id => FOUND_TALK[id]);
  if (found && out.length < 3) out.push(FOUND_TALK[found]);
  // the meadow tools you used and the burrows you took (v0.26): the one you used most gets a word
  const used = Object.entries(last.tools || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (used && out.length < 3) out.push(TOOL_TALK[used]);
  const route = (last.routes || []).find(k => ROUTE_TALK[k]);
  if (route && out.length < 3) out.push(ROUTE_TALK[route]);
  // 다툼: the critters you set on each other
  if (last.brawls >= 2 && out.length < 3) out.push(`녀석들끼리 ${last.brawls}번이나 싸움 붙였다며? 투닥투닥하는 거 구경하고 싶다!`);
  // and once in a while, after the name tags start turning up, something nobody quite finishes saying
  const tags = meta.stats?.tags || 0;
  if (tags >= 3 && out.length < 3 && Math.random() < 0.35) out.push(EERIE[Math.floor(Math.random() * Math.min(EERIE.length, 1 + (tags >> 1)))]);
  // what you have put up round your house (data/home.js) gets talked about too
  const home = meta.home || [];
  if (home.includes('dog') && out.length < 3) out.push('너네 강아지 오늘 우리 집 앞까지 놀러 왔더라. 귀여워!');
  else if (home.length && out.length < 3) out.push('너네 집 요즘 점점 예뻐진다? 나도 꽃 좀 심어야겠어.');
  if (out.length < 2) out.push(last.kills ? `이번엔 ${last.kills}마리를 쓰러뜨렸구나. 다음엔 더 멀리 가 보자!` : '다음엔 꼭 더 멀리 가 보자!');
  return out.slice(0, 3);
}
