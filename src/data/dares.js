// 라이벌의 내기: Shattered Pixel Dungeon's challenges, offered by the rival. Each one is a single rule
// that makes the fields harder for the whole trip; every one you take on adds GOLD to what you pick up.
// They open one at a time: the first when the rival moves in (after the first boss), one more for
// every other stage boss you have beaten, the last when the second 회차 opens. Picked at the rival's house
// (ui/hub.js), read in core/run.js through run.dare(id).
//   name / desc: the card · brag: what the rival says about it · icon: a sprite id

import { loopsOpen } from './stages.js';

export const DARE_GOLD = 0.3;           // gold per dare taken, added up (two dares: ×1.6)

export const DARES = [
  { id: 'fierce', icon: 'knight', name: '사나운 들판', desc: '들판 친구들의 체력과 공격이 40% 세다',
    brag: '나는 사나운 놈들만 골라서 상대하거든.' },
  { id: 'dark', icon: 'bat', name: '작은 등불', desc: '등불이 작아서 3칸 덜 보인다',
    brag: '등불? 난 반만 켜고 다닌다.' },
  { id: 'nopotion', icon: 'potion', name: '물약 없이', desc: '들판에서 물약이 나오지 않고, 집에서 챙겨 갈 수도 없다',
    brag: '물약 같은 건 겁쟁이나 마시는 거야.' },
  { id: 'swarm', icon: 'rat', name: '소문 빠른 들판', desc: '한 마리가 나를 보면 소리쳐서 근처의 친구들을 부른다',
    brag: '나는 다 깨워 놓고 지나간다고.' },
  { id: 'boss', icon: 'crown', name: '화난 대장', desc: '구역 대장들의 체력이 50%, 공격이 25% 세다',
    brag: '대장들? 화나 있을 때가 더 재밌지.' },
  { id: 'light', icon: 'bag', name: '가벼운 가방', desc: '유물 칸이 두 칸 줄어든다',
    brag: '짐이 많으면 느려져. 난 몇 개만 들고 간다.' },
];

export const DARE_BY_ID = Object.fromEntries(DARES.map(d => [d.id, d]));

// how many dares are open: one per stage boss beaten (the rival comes after the first), the last
// once the second 회차 opens
export const daresOpen = m => Math.min(DARES.length, m.stats.bosses.length + (loopsOpen(m) >= 2 ? 1 : 0));

// the dares switched on for the next trip (only open ones count)
export const daresOn = m => DARES.slice(0, daresOpen(m)).filter(d => m.dares?.on?.[d.id]).map(d => d.id);

export const dareGold = n => 1 + DARE_GOLD * n;
