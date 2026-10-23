// The village you come back to between runs: a round path that loops around a pond plaza, cottages
// along it, and the signpost out to the fields on the east side. You walk around and bump into people.
// Villagers move in one by one as you get further (`when`), and each looks after part of your progress
// (`panel`, built in ui/hub.js). Until then their house stands empty with the door boarded up.
// Some of them like a stroll round the loop (`stroll`: ms between steps; the rival jogs); the others
// keep to their doors.
//   map: '#' hedge, '.' grass, ':' path, '~' pond, '*' flowers, 'L' firefly lamp, 'T' a tree, '>' the burrow out to the fields

import { josa } from '../core/util.js';
import { bookGiftsDue } from './balance.js';
import { RECIPES, recipeKey } from './relics.js';

export const VILLAGE_MAP = [
  '#############################################',
  '#########...........................#########',
  '######.................................######',
  '####..T...........T.......T....*......T..####',
  '###.......................................###',
  '###.....*......T.....*:......T...........*###',
  '##...*.T...........:::::::..........*T.....##',
  '##.............:::::::::::::::.............##',
  '##.........:::::......:*.....:::::.........##',
  '#.........:::.........:...*.....:::.*....T..#',
  '#...##...::....*..*...:........*..::...##...#',
  '#...##..::....*.....*.:..*........*::..##...#',
  '#..T...::......**.....:*............::...T..#',
  '#....*.:....*....L:::::::::L.........:......#',
  '#.....::.........::~~~~~~~::........*::.....#',
  '#....*:..........:~~~~~~~~~:..........:..####',
  '#.*...::::::::::::~~~~~~~~~:::::::::::::::::>',
  '#.....:.*........:~~~~~~~~~:.........*:..####',
  '#.....::.........::~~~~~~~::.........::.....#',
  '#......:*........L:::::::::L.........:..*...#',
  '#.T....::...........................::......#',
  '#.......::.........................::.......#',
  '#...**...::.:...................:.::......T.#',
  '##....*...:::.....T......*......:::...##...##',
  '##....##....::::......:......::::.....##...##',
  '##...T##.....**:::::::::::::::*............##',
  '###.....*..........:::::::......*.........###',
  '###.....*........*..................*..*.*###',
  '####.........T..##..........##...........####',
  '######..........##*.........##.....*...######',
  '#########*.*......*...........*.*...#########',
  '#############################################',
];

// Footprints in tiles (odd widths, so the door sits in the middle of a tile). The door is the middle
// of the bottom row; the owner stands just below it. The top three face the loop from outside it, the
// bottom three from inside its lower half.
export const HOUSES = [
  { id: 'guild', x: 20, y: 1, w: 5, h: 4, roof: '#3f6fb3', sign: 'flag', chimney: true },
  { id: 'shop', x: 9, y: 4, w: 5, h: 4, roof: '#d9454a', sign: 'coin', awning: true },
  { id: 'smith', x: 31, y: 4, w: 5, h: 4, roof: '#6b6f7c', sign: 'hammer', chimney: true },
  { id: 'neighbor', x: 10, y: 18, w: 5, h: 4, roof: '#f29bb2', sign: 'heart' },
  { id: 'rescue', x: 20, y: 20, w: 5, h: 4, roof: '#f08c3a', sign: 'cross' },
  { id: 'rival', x: 30, y: 18, w: 5, h: 4, roof: '#7a4bb0', sign: 'star', chimney: true },
];
export const doorOf = h => ({ x: h.x + Math.floor(h.w / 2), y: h.y + h.h });
// Your own house (the story's dream, scenes/storyboards.js): an empty lot until the guild's big prize
// for all three licenses, the first win; then a yellow-roofed house with a heart over the door.
export const HOME = { id: 'home', x: 31, y: 25, w: 5, h: 4, roof: '#f4cf4f', sign: 'heart', chimney: true };
export const ownsHome = m => m.stats.wins > 0;

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
    tip: '찾아낸 합성 조합과 반짝돌을 적어 둔다',
    arrive: '대장간을 차렸다. 찾은 조합은 내가 다 적어 두지!',
    hint: '요즘 두더지 하나가 마을을 기웃거려. 유물을 합쳐 보거나 깊은숲까지 가 보면 이사 올지도?',
    lines: [m => (bookGiftsDue(RECIPES.filter(rc => m.recipes[recipeKey(rc)]).length, m.bookGifts) > 0 ? '도감이 꽤 찼군! 선물이 있다.' : '새 조합 찾았나?'), '반짝돌 냄새가 나는군.', '뚝딱뚝딱.'],
  },
  rescue: {
    name: '구조대원', sprite: 'rescuer', panel: 'records', when: m => deaths(m) >= 2, stroll: 1100,
    tip: '지금까지의 기록과 들판 친구 도감을 적어 둔다',
    arrive: '오늘부터 마을 구조대야. 쓰러지면 내가 업어 올게!',
    hint: '들판에서 자꾸 쓰러지는 일꾼이 있다던데... 구조대가 생긴다는 소문이 있어.',
    lines: [m => `벌써 ${deaths(m)}번째 구조야.`, '오늘은 업혀 오지 마.', '구조 일지 볼래?'],
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
export function gossip(last, meta) {
  if (!last) return ['아직 아무 일도 없었어. 얼른 들판에 다녀와!'];
  const out = [];
  if (last.won) out.push(`들었어? ${josa(last.who, '이', '가')} ${last.zone} 대장을 쓰러뜨렸대! 온 마을이 들썩들썩해.`);
  if (last.won && last.stage === 4 && last.loop === 1 && meta.home?.length === 0) out.push('조합장이 상으로 집을 줬다며? 집들이 때 나도 꼭 불러 줘!');
  else if (last.cause) out.push(`${last.zone}에서 ${last.cause}면서? 다들 걱정했어.`);
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
  // what you have put up round your house (data/home.js) gets talked about too
  const home = meta.home || [];
  if (home.includes('dog') && out.length < 3) out.push('너네 강아지 오늘 우리 집 앞까지 놀러 왔더라. 귀여워!');
  else if (home.length && out.length < 3) out.push('너네 집 요즘 점점 예뻐진다? 나도 꽃 좀 심어야겠어.');
  if (out.length < 2) out.push(last.kills ? `이번엔 ${last.kills}마리를 쓰러뜨렸구나. 다음엔 더 멀리 가 보자!` : '다음엔 꼭 더 멀리 가 보자!');
  return out.slice(0, 3);
}
