// 오늘의 들판 (v0.32): every stage has its own weather on each trip, shown on the stage select and on the
// 출발 준비 sheet, so there is a reason to go to this stage today and no two trips out are quite alike.
// Dealt from the number of trips so far, the stage and the 회차, so it holds still while you look and
// changes when you come home. About two days in five are plain; the rest bend one or two things, said
// in one line, sometimes with a catch. Nothing before the third trip: the first fields are plain.
//
// What each one does (core/run.js reads these): `ores` more sparkle rocks a field, `gold` × gold,
// `sight` tiles of sight, `chests` more chests a field, `choices` more cards at every relic pick,
// `foes` × the strength of the field's critters (never the boss), `sleep` added to the chance a critter
// starts asleep, `odd` added to the chance of an odd critter, `crowd` more critters a field, `xp` ×
// experience, `tools` more meadow tools a field. `grade`: how the field's light is tinted (r, g, b).

import { make } from './icons.js';
import { TOOLS } from './items.js';
import { isOpen } from './unlocks.js';

export const WEATHER = {
  gold: {
    name: '금빛 날', rule: '반짝 바위가 하나씩 더 있고, 골드가 25% 더 나온다', short: '반짝 바위 +1, 골드 +25%', ores: 1, gold: 1.25, grade: [1.06, 1.0, 0.86],
    rows: [
      '................',
      '.......yy.......',
      '..y....yy....y..',
      '...y........y...',
      '.....yyyyyy.....',
      '....yyyyyyyy....',
      '....yyyyyyyy....',
      '.yy.yyyyyyyy.yy.',
      '.yy.yyyyyyyy.yy.',
      '....yyyyyyyy....',
      '....yyyyyyyy....',
      '.....yyyyyy.....',
      '...y........y...',
      '..y....yy....y..',
      '.......yy.......',
      '................',
    ],
  },
  fog: {
    name: '안개 낀 날', rule: '멀리 안 보이지만, 상자가 하나씩 더 있다', short: '시야 -2, 상자 +1', sight: -2, chests: 1, grade: [0.9, 0.94, 0.98],
    rows: [
      '................',
      '................',
      '....wwwwww......',
      '..wwwwwwwwwww...',
      '................',
      '.....llllllllll.',
      '...lllllllllll..',
      '................',
      '.wwwwwwwwww.....',
      '..wwwwwwwwwwww..',
      '................',
      '....lllllllll...',
      '..lllllllllll...',
      '................',
      '................',
      '................',
    ],
  },
  star: {
    name: '별똥별 밤', rule: '유물을 고를 때 하나 더 보인다. 대신 들판 친구들이 조금 사납다', short: '고르는 유물 +1, 들판 친구 +15%', choices: 1, foes: 1.15, grade: [0.86, 0.86, 1.02],
    rows: [
      '................',
      '...........y....',
      '...........y....',
      '........yyyyyyy.',
      '.........yyyyy..',
      '..........yyy...',
      '.........yy.yy..',
      '.......ccy...y..',
      '......cccc......',
      '.....ccc........',
      '....ccc.........',
      '...cc...........',
      '..cc............',
      '..c.............',
      '................',
      '................',
    ],
  },
  moon: {
    name: '보름달 밤', rule: '들판 친구들이 더 많이 자고, 별난 친구가 자주 보인다', short: '잠든 친구 많음, 별난 친구 자주', sleep: 0.25, odd: 0.3, grade: [0.82, 0.88, 1.06],
    rows: [
      '................',
      '................',
      '.....zzzzzz.....',
      '....zzzzzzzz....',
      '...zzzzzzzzzz...',
      '...zzziizzzzz...',
      '...zzziizzzzz...',
      '...zzzzzzziiz...',
      '...zzzzzzziiz...',
      '...zizzzzzzzz...',
      '....zzzzzzzz....',
      '.....zzzzzz.....',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  crowd: {
    name: '북적이는 날', rule: '들판 친구들이 셋씩 더 많지만, 경험치가 40% 더 든다', short: '들판 친구 +3, 경험치 +40%', crowd: 3, xp: 1.4,
    rows: [
      '................',
      '......wwww......',
      '.....wwwwww.....',
      '.....wkwwkw.....',
      '.....wwwwww.....',
      '......wwww......',
      '................',
      '................',
      '..qqqq....yyyy..',
      '.qqqqqq..yyyyyy.',
      '.qkqqkq..ykyyky.',
      '.qqqqqq..yyyyyy.',
      '..qqqq....yyyy..',
      '................',
      '................',
      '................',
    ],
  },
  wind: {
    name: '바람 부는 날', rule: '들판 도구가 둘씩 더 굴러다닌다', short: '들판 도구 +2', tools: 2, needs: 'tools',
    rows: [
      '................',
      '................',
      '..........cc....',
      '.........c..c...',
      '.............c..',
      '.ccccccccccccc..',
      '................',
      '...........gg...',
      '.cccccccc.gggg..',
      '..........ggg...',
      '................',
      '.cccccccccc.....',
      '...........c....',
      '.........cc.....',
      '................',
      '................',
    ],
  },
};
export const WEATHER_IDS = Object.keys(WEATHER);
for (const w of Object.values(WEATHER)) w.icon = make({ rows: w.rows });

// out of ten days: plain on four, and the rest shared out
const DAYS = ['', '', '', '', 'gold', 'fog', 'star', 'moon', 'crowd', 'wind'];
export const WEATHER_FROM = 3;   // trips made before the weather starts to change

// The weather at this stage and 회차 on the next trip out ('' for a plain day). No wind before a meadow
// tool is open (that day is plain).
export function weatherFor(meta, stage, loop = 1) {
  const runs = meta.stats?.runs || 0;
  if (runs < WEATHER_FROM) return '';
  let h = (runs * 2654435761 + stage * 40503 + loop * 9973) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  const id = DAYS[((h ^ (h >>> 16)) >>> 0) % DAYS.length];
  return id === 'wind' && !TOOLS.some(t => isOpen(meta, t)) ? '' : id;
}
