// Floor features, gases and the combinations players can discover.
// Each floor tile has at most one feature (map.ter). Gases float on top (map.gas).
// Kept small on purpose: every feature must read at a glance, cost no extra turns,
// and tie into the big ore or a life-or-death choice. Parked ideas live in git history (v0.3).

export const T = { NONE: 0, BRUSH: 1, ASH: 2, WATER: 3, VENT: 4, MUSH_SLEEP: 5 };

// burn: turns a fire lasts on this feature (0 = does not burn)
// sprite: overlay drawn on the floor tile (see TER_SPR in sprites.js)
export const TERRAIN = {
  [T.BRUSH]:      { name: '버섯 덤불',    sprite: 'brush',     burn: 4, tip: '시야를 가린다. 안에 숨으면 멀리 있는 적이 나를 못 본다. 불에 잘 탄다.' },
  [T.ASH]:        { name: '탄 자국',      sprite: 'ash',       tip: '불에 타고 남은 자리다.' },
  [T.WATER]:      { name: '지하수 웅덩이', tip: '몸에 불이 붙었을 때 들어가면 꺼진다.' },
  [T.VENT]:       { name: '가스 틈',      sprite: 'vent',      tip: '큰 광석을 캘 때마다 광산 가스가 샌다.' },
  [T.MUSH_SLEEP]: { name: '졸음 버섯',    sprite: 'mushSleep', burn: 1, tip: '밟거나 터뜨리면 졸음 가스가 퍼진다.' },
};

export const TILE_INFO = {
  stairs:  { name: '내려가는 계단', tip: '아래층으로 내려간다.' },
  upStairs: { name: '올라가는 계단', tip: '위층으로 돌아간다. 지나온 층은 떠날 때 모습 그대로 남아 있다.' },
  door:    { name: '문', tip: '열기 전에는 안이 안 보인다.' },
  bigOre:  { name: '큰 광석', tip: '부딪혀서 캔다. 캘수록 소리가 커져서 적이 찾아온다.' },
  fire:    { name: '불', tip: '닿으면 몸에 불이 붙는다. 웅덩이에 들어가면 꺼진다.' },
};

export const GASES = {
  sleep: { name: '졸음 가스', color: 0xb58cf0, tip: '마시면 잠든다. 적도 잠든다.' },
  mine:  { name: '광산 가스', color: 0xf4d35a, tip: '그 자체는 무해하다.' },
};
export const GAS_KEYS = ['sleep', 'mine'];

// How strong a gas must be to do something
export const SLEEP_MIN = 2;
export const MINE_MIN = 1;

// basic: the rule is common sense and its tooltip already says it
// hint: what villagers or overheard enemies say before you find it
export const DISCOVERIES = [
  { id: 'fire_brush',  combo: '불 + 버섯 덤불',     result: '불이 덤불을 타고 번진다', basic: true },
  { id: 'water_fire',  combo: '물 + 불',            result: '몸에 붙은 불이 꺼진다', basic: true },
  { id: 'bomb_wall',   combo: '폭탄 + 벽',          result: '벽에 구멍이 뚫린다', basic: true },
  { id: 'noise_sleep', combo: '큰 소리 + 자는 적',  result: '적이 깨서 소리 난 곳으로 온다', basic: true },
  { id: 'sleep_enemy', combo: '졸음 가스 + 적',     result: '적도 꾸벅꾸벅 잠든다', hint: '버섯 정원에선 다들 졸려 해.' },
  { id: 'fire_mine',   combo: '불 + 광산 가스',     result: '가스 전체가 한 번에 대폭발', hint: '광석 방에서 불 켜면 큰일 난대.' },
  { id: 'ore_jackpot', combo: '큰 광석 + 끝까지',   result: '광석이 통째로 쏟아진다', hint: '큰 광석 끝까지 캐면 대박이래.' },
  { id: 'bolt_water',  combo: '번개 + 웅덩이',      result: '웅덩이에 있는 모두가 감전', hint: '웅덩이에 번개 떨어지면 다 찌릿하대.' },
];

// Things enemies mutter when you overhear them from inside a brush
export const GOSSIP = [
  '어제 그 광부 또 실려 갔대.',
  '조합장 요즘 예민하더라.',
  '상점 주인 또 가격 올렸대.',
  '반짝돌 하나만 주우면 소원이 없겠다.',
  '라이벌 광부가 꽤 깊이 내려갔다던데?',
  '구조대원이 몇 번째인지 세고 있대.',
  '밤마다 광산이 뒤척이는 소리 들었어?',
];
export const SLEEP_TALK = ['음냐… 반짝돌…', '쿨… 쿨…', '으음… 오 분만…', '음냐… 치즈…'];

// Real hints about what is on this floor; one that fits is picked at random
export const FLOOR_HINTS = [
  { has: 'ore',    text: '큰 광석 캐는 소리 나면 다 몰려가자.' },
  { has: 'ore',    text: '광석 방 틈에서 가스 샌다던데. 불은 조심해.' },
  { has: 'garden', text: '버섯 정원 쪽은 조용히 지나가. 다 자고 있어.' },
  { has: 'flood',  text: '물에 잠긴 방에 번개 떨어지면 다 찌릿하대.' },
];
