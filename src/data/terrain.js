// Floor features, gases and the combinations players can discover.
// Each floor tile has at most one feature (map.ter). Gases float on top (map.gas).
// Kept small on purpose: every feature must read at a glance, cost no extra turns,
// and tie into the big ore or a life-or-death choice. Parked ideas live in git history (v0.3).

export const T = {
  NONE: 0, BRUSH: 1, ASH: 2, WATER: 3, VENT: 4, GRASS: 5,
  TRAP_SLEEP: 6, TRAP_SUMMON: 7, TRAP_ALARM: 8, TRAP_SPIKE: 9, TRAP_OFF: 10,
  DUG: 11, ANVIL: 12, RING: 13,
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
  [T.WATER]:      { name: '물웅덩이', tip: '몸에 불이 붙었을 때 들어가면 꺼진다.' },
  [T.VENT]:       { name: '늪 거품 구멍', sprite: 'vent',      tip: '반짝 바위를 캘 때마다 늪 가스가 보글보글 올라온다.' },
  [T.TRAP_SLEEP]: { name: '졸음 꽃',     sprite: 'trapSleep',  tip: '밟으면 졸음 꽃가루가 퍼진다.' },
  [T.TRAP_SUMMON]: { name: '수상한 굴',  sprite: 'trapSummon', tip: '밟으면 굴 속에서 몬스터가 우르르 튀어나온다.' },
  [T.TRAP_ALARM]: { name: '방울 덫',      sprite: 'trapAlarm',  tip: '밟으면 방울이 울려 구역 전체의 적이 몰려온다.' },
  [T.TRAP_SPIKE]: { name: '밤송이',       sprite: 'trapSpike',  tip: '밟으면 가시에 찔린다.' },
  [T.TRAP_OFF]:   { name: '밟힌 덫',      sprite: 'trapOff',    tip: '이미 작동한 덫이다.' },
  [T.DUG]:        { name: '파헤친 흙',    sprite: 'dug',        tip: '누군가 파헤친 자리다.' },
  [T.ANVIL]:      { name: '모루',         sprite: 'anvil',      tip: '대장장이의 모루다.' },
  [T.RING]:       { name: '요정 고리',    sprite: 'fairyRing',  tip: '버섯이 동그랗게 났다. 들어가면 이 구역 어딘가의 짝 고리로 뿅 하고 나간다.' },
};

export const TILE_INFO = {
  stairs:  { name: '다음 구역 땅굴', tip: '쏙 들어가면 다음 구역으로 간다.' },
  upStairs: { name: '돌아가는 땅굴', tip: '앞 구역으로 돌아간다. 지나온 구역은 떠날 때 모습 그대로 남아 있다.' },
  door:    { name: '나무 문', tip: '열기 전에는 안이 안 보인다.' },
  grave:   { name: '흙 둔덕', tip: '다람쥐가 도토리를 묻어 둔 자리. 부딪히면 파헤친다. 보물이 나오기도 하고, 화난 청설모가 튀어나오기도 한다.' },
  graveBig: { name: '큰 참나무 그루터기', tip: '다람쥐들의 도토리 창고. 부딪히면 파헤친다. 큰 보물과 다람쥐가 훔쳐 간 골드가 모여 있지만, 청설모가 꼭 튀어나온다.' },
  hive:    { name: '벌집 그루터기', tip: '꿀이 가득한 벌집. 부딪히면 꿀단지를 꺼내 먹는다(최대 체력이 늘어난다). 대신 벌들이 화를 낸다.' },
  hiveEmpty: { name: '빈 벌집 그루터기', tip: '꿀은 다 꺼냈다.' },
  weed:    { name: '잡초', tip: '부딪히면 쏙 뽑는다. 뽑을 때마다 풀뽑기 일당이 조금 나오고, 밭을 다 뽑으면 마지막 풀 밑에서 별사탕이 나온다. 바들바들 떠는 풀은 비명 뿌리다.' },
  locked:  { name: '잠긴 문', tip: '이 구역 어딘가에 있는 열쇠로 연다.' },
  bigOre:  { name: '반짝 바위', tip: '부딪혀서 캔다. 칠수록 더 좋은 반짝돌이 나오기도 하지만, 소리가 커져서 적이 찾아온다.' },
  fire:    { name: '불', tip: '닿으면 몸에 불이 붙는다. 웅덩이에 들어가면 꺼진다.' },
  floor:   { name: '땅', tip: '아무것도 없다.' },
  wall:    { name: '덤불', tip: '지나갈 수 없다. 폭탄으로 날려 버릴 수 있다.' },
};

export const GASES = {
  sleep: { name: '졸음 꽃가루', color: 0xb58cf0, tip: '마시면 잠든다. 적도 잠든다.' },
  mine:  { name: '늪 가스', color: 0xf4d35a, tip: '그 자체는 무해하다.' },
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
  { id: 'bomb_wall',   combo: '폭탄 + 덤불',        result: '덤불에 구멍이 뚫린다', basic: true },
  { id: 'noise_sleep', combo: '큰 소리 + 자는 적',  result: '적이 깨서 소리 난 곳으로 온다', basic: true },
  { id: 'sleep_enemy', combo: '졸음 꽃가루 + 적',   result: '적도 꾸벅꾸벅 잠든다', hint: '졸음 꽃 꽃가루는 적한테도 똑같이 듣는대.' },
  { id: 'fire_mine',   combo: '불 + 늪 가스',       result: '가스 전체가 한 번에 대폭발', hint: '반짝 바위 옆에서 불 켜면 큰일 난대.' },
  { id: 'ore_jackpot', combo: '반짝 바위 + 끝까지', result: '반짝돌이 통째로 쏟아진다', hint: '반짝 바위 끝까지 캐면 대박이래.' },
  { id: 'bomb_trap',   combo: '폭탄 + 함정',        result: '멀리서 함정을 터뜨린다', hint: '함정에 폭탄 던지면 멀리서도 터진대.' },
  { id: 'bolt_water',  combo: '번개 + 웅덩이',      result: '웅덩이에 있는 모두가 감전', hint: '웅덩이에 번개 떨어지면 다 찌릿하대.' },
  { id: 'smoke_bees',  combo: '연기 + 벌집',        result: '벌들이 꾸벅꾸벅 존다', hint: '벌집 옆에 불을 피우면 벌들이 졸린대.' },
];

// Things enemies mutter when you overhear them unseen
export const GOSSIP = [
  '반짝 바위를 계속 두드리면 속에서 더 좋은 반짝돌이 나오기도 한대.',
  '멀리 갈수록 반짝돌이 좋아진대. 다이아몬드 위로는 보석이래.',
  '무지개석이라는 게 있다던데, 본 사람이 거의 없대.',
  '금 곡괭이를 쥐면 보석이 더 잘 나온대.',
  '어제 그 일꾼 또 실려 갔대.',
  '조합장 요즘 예민하더라.',
  '상점 주인 또 가격 올렸대.',
  '반짝돌 하나만 주우면 소원이 없겠다.',
  '라이벌 일꾼이 돌산까지 갔다던데?',
  '요정 고리는 일꾼만 태워 준대. 우리는 못 따라간대.',
  '돌산 온천에 들어가 있으면 다친 데가 낫는대. 우리도 가끔 가.',
  '벌집 꿀 먹으면 힘이 불끈 난대. 벌한테 쏘여도.',
  '잡초 밭에서 바들바들 떠는 풀은 뽑지 마. 꺄아아 하고 소리 지른대.',
  '구조대원이 몇 번째인지 세고 있대.',
  '밤마다 깊은숲이 뒤척이는 소리 들었어?',
  '반짝 거북은 먼저 건드리지만 않으면 순하대.',
  '잠든 일꾼 코 고는 소리에 들쥐들이 몰려들었대.',
  '불꽃 검을 든 채로 땅을 흔들면 화산이 깨어난대.',
  '가시로 둘러싼 피의 왕은 죽지 않는다는 전설이 있어.',
  '금빛 번개가 반짝 바위를 휩쓸면 황금 폭풍이 분대.',
  '보물 상자인 줄 알고 열었다가 집게에 물렸대. 소라게가 살고 있었대.',
  '허수아비 앞 상자를 집으면 허수아비가 따라온대. 느리긴 하대.',
  '초원 어딘가에서 아기새가 삐약삐약 울고 있대.',
  '두더지 대장장이는 반짝돌 덩어리만 보면 눈이 반짝인대.',
];
export const SLEEP_TALK = ['음냐… 반짝돌…', '쿨… 쿨…', '으음… 오 분만…', '음냐… 치즈…'];

// Real hints about what is on this floor; one that fits is picked at random
export const FLOOR_HINTS = [
  { has: 'ore',    text: '반짝 바위 캐는 소리 나면 다 몰려가자.' },
  { has: 'ore',    text: '반짝 바위 옆 틈에서 가스 샌다던데. 불은 조심해.' },
  { has: 'garden', text: '저쪽 풀숲은 키가 커서 안이 하나도 안 보여.' },
  { has: 'trap',   text: '이 구역 땅 어딘가에 함정이 숨어 있대. 발밑 조심해.' },
  { has: 'vault',  text: '잠긴 비밀 정원이 있대. 열쇠는 다른 방에 있다던데.' },
  { has: 'locked', text: '잠긴 상자가 하나 있대. 열쇠만 찾으면 좋은 게 들었대.' },
  { has: 'grave',  text: '다람쥐 도토리 창고가 있대. 파헤치면 청설모가 화낸대.' },
  { has: 'grave',  text: '다람쥐가 훔쳐 간 골드는 큰 참나무 그루터기에 모아 둔대.' },
  { has: 'statue', text: '허수아비 옆 상자를 집으면 허수아비가 깨어난대.' },
  { has: 'traps',  text: '함정이 빼곡한 방 끝에 상자가 있대. 길이 하나는 있대.' },
  { has: 'mimic',  text: '이 구역 상자 중 하나에는 소라게가 산대.' },
  { has: 'flood',  text: '물에 잠긴 방에 번개 떨어지면 다 찌릿하대.' },
  { has: 'weeds',  text: '이 구역에 잡초 밭이 있대. 다 뽑으면 별사탕이 나온다던데.' },
];
