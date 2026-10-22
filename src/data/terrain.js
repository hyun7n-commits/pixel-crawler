// Floor features, gases and the combinations players can discover.
// Each floor tile has at most one feature (map.ter). Gases float on top (map.gas).
// Kept small on purpose: every feature must read at a glance, cost no extra turns,
// and tie into the big ore or a life-or-death choice. Parked ideas live in git history (v0.3).

export const T = {
  NONE: 0, BRUSH: 1, ASH: 2, WATER: 3, VENT: 4, GRASS: 5,
  TRAP_SLEEP: 6, TRAP_SUMMON: 7, TRAP_ALARM: 8, TRAP_SPIKE: 9, TRAP_OFF: 10,
};
// Like Shattered Pixel Dungeon traps: a plate that goes off once when stepped on (or blown up).
// Some are hidden (map.hidden) until you spot them standing next to them.
export const TRAPS = [T.TRAP_SLEEP, T.TRAP_SUMMON, T.TRAP_ALARM, T.TRAP_SPIKE];
export const isTrap = t => t >= T.TRAP_SLEEP && t <= T.TRAP_SPIKE;

// burn: turns a fire lasts on this feature (0 = does not burn)
// sprite: overlay drawn on the floor tile (see TER_SPR in sprites.js)
export const TERRAIN = {
  [T.BRUSH]:      { name: '키 큰 풀',     sprite: 'brush',     burn: 4, tip: '앞을 가린다. 누가 밟으면 쓰러진다. 불에 잘 탄다.' },
  [T.GRASS]:      { name: '쓰러진 풀',    sprite: 'grass',     burn: 2, tip: '누가 밟고 지나간 풀이다. 이제 앞을 가리지 않는다.' },
  [T.ASH]:        { name: '탄 자국',      sprite: 'ash',       tip: '불에 타고 남은 자리다.' },
  [T.WATER]:      { name: '지하수 웅덩이', tip: '몸에 불이 붙었을 때 들어가면 꺼진다.' },
  [T.VENT]:       { name: '가스 틈',      sprite: 'vent',      tip: '큰 광석을 캘 때마다 광산 가스가 샌다.' },
  [T.TRAP_SLEEP]: { name: '졸음 가스 함정', sprite: 'trapSleep',  tip: '밟으면 졸음 가스가 뿜어져 나온다.' },
  [T.TRAP_SUMMON]: { name: '소환 함정',   sprite: 'trapSummon', tip: '밟으면 몬스터가 우르르 나타난다.' },
  [T.TRAP_ALARM]: { name: '경보 함정',    sprite: 'trapAlarm',  tip: '밟으면 종이 울려 층 전체의 적이 몰려온다.' },
  [T.TRAP_SPIKE]: { name: '가시 함정',    sprite: 'trapSpike',  tip: '밟으면 가시가 솟는다.' },
  [T.TRAP_OFF]:   { name: '망가진 함정',  sprite: 'trapOff',    tip: '이미 작동한 함정이다.' },
};

export const TILE_INFO = {
  stairs:  { name: '내려가는 계단', tip: '아래층으로 내려간다.' },
  upStairs: { name: '올라가는 계단', tip: '위층으로 돌아간다. 지나온 층은 떠날 때 모습 그대로 남아 있다.' },
  door:    { name: '문', tip: '열기 전에는 안이 안 보인다.' },
  bigOre:  { name: '큰 광석', tip: '부딪혀서 캔다. 칠수록 더 좋은 광석이 나오기도 하지만, 소리가 커져서 적이 찾아온다.' },
  fire:    { name: '불', tip: '닿으면 몸에 불이 붙는다. 웅덩이에 들어가면 꺼진다.' },
  floor:   { name: '바닥', tip: '아무것도 없다.' },
  wall:    { name: '벽', tip: '지나갈 수 없다. 폭탄으로 부술 수 있다.' },
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
  { id: 'fire_brush',  combo: '불 + 풀',            result: '불이 풀을 타고 번진다', basic: true },
  { id: 'water_fire',  combo: '물 + 불',            result: '몸에 붙은 불이 꺼진다', basic: true },
  { id: 'bomb_wall',   combo: '폭탄 + 벽',          result: '벽에 구멍이 뚫린다', basic: true },
  { id: 'noise_sleep', combo: '큰 소리 + 자는 적',  result: '적이 깨서 소리 난 곳으로 온다', basic: true },
  { id: 'sleep_enemy', combo: '졸음 가스 + 적',     result: '적도 꾸벅꾸벅 잠든다', hint: '졸음 가스 함정은 적한테도 똑같이 듣는대.' },
  { id: 'fire_mine',   combo: '불 + 광산 가스',     result: '가스 전체가 한 번에 대폭발', hint: '광석 방에서 불 켜면 큰일 난대.' },
  { id: 'ore_jackpot', combo: '큰 광석 + 끝까지',   result: '광석이 통째로 쏟아진다', hint: '큰 광석 끝까지 캐면 대박이래.' },
  { id: 'bomb_trap',   combo: '폭탄 + 함정',        result: '멀리서 함정을 터뜨린다', hint: '함정에 폭탄 던지면 멀리서도 터진대.' },
  { id: 'bolt_water',  combo: '번개 + 웅덩이',      result: '웅덩이에 있는 모두가 감전', hint: '웅덩이에 번개 떨어지면 다 찌릿하대.' },
];

// Things enemies mutter when you overhear them unseen
export const GOSSIP = [
  '큰 광석을 계속 두드리면 속에서 더 좋은 광석이 나오기도 한대.',
  '깊이 내려갈수록 광석이 좋아진대. 다이아몬드 위로는 보석이래.',
  '무지개석이라는 게 있다던데, 본 사람이 거의 없대.',
  '금 곡괭이를 쥐면 보석이 더 잘 나온대.',
  '어제 그 광부 또 실려 갔대.',
  '조합장 요즘 예민하더라.',
  '상점 주인 또 가격 올렸대.',
  '반짝돌 하나만 주우면 소원이 없겠다.',
  '라이벌 광부가 꽤 깊이 내려갔다던데?',
  '구조대원이 몇 번째인지 세고 있대.',
  '밤마다 광산이 뒤척이는 소리 들었어?',
  '광석 거북은 먼저 건드리지만 않으면 순하대.',
  '잠든 광부 코 고는 소리에 쥐들이 몰려들었대.',
  '불꽃 검을 든 채로 땅을 흔들면 화산이 깨어난대.',
  '가시로 둘러싼 피의 왕은 죽지 않는다는 전설이 있어.',
  '금빛 번개가 금광을 휩쓸면 황금 폭풍이 분대.',
];
export const SLEEP_TALK = ['음냐… 반짝돌…', '쿨… 쿨…', '으음… 오 분만…', '음냐… 치즈…'];

// Real hints about what is on this floor; one that fits is picked at random
export const FLOOR_HINTS = [
  { has: 'ore',    text: '큰 광석 캐는 소리 나면 다 몰려가자.' },
  { has: 'ore',    text: '광석 방 틈에서 가스 샌다던데. 불은 조심해.' },
  { has: 'garden', text: '저쪽 풀숲은 키가 커서 안이 하나도 안 보여.' },
  { has: 'trap',   text: '이 층 바닥 어딘가에 함정이 숨어 있대. 발밑 조심해.' },
  { has: 'flood',  text: '물에 잠긴 방에 번개 떨어지면 다 찌릿하대.' },
];
