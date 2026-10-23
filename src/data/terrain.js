// Floor features, gases and the combinations players can discover.
// Each floor tile has at most one feature (map.ter). Gases float on top (map.gas).
// Kept small on purpose: every feature must read at a glance, cost no extra turns,
// and tie into the big ore or a life-or-death choice. Parked ideas live in git history (v0.3).

export const T = {
  NONE: 0, BRUSH: 1, ASH: 2, WATER: 3, VENT: 4, GRASS: 5,
  TRAP_SLEEP: 6, TRAP_SUMMON: 7, TRAP_ALARM: 8, TRAP_SPIKE: 9, TRAP_OFF: 10,
  DUG: 11, ANVIL: 12, RING: 13, BERRY: 14,
  // v0.23: the new stages' grounds
  LAVA: 15, ICE: 16, CHASM: 17, BRIDGE: 18, SLIME: 19, HONEY: 20,
  // v0.26: 심술 버섯, a plant that goes off like a trap (always in plain sight)
  TRAP_GRUMP: 21,
};
// you cannot walk onto these (a drop, molten rock), but you can see across them
export const isGap = t => t === T.CHASM || t === T.LAVA;
// what fills a zone's pools: water, or (zone.wet) ice on the snowy plateau and lava on the volcano
export const POOLS = [T.WATER, T.ICE, T.LAVA];
export const isPool = t => t === T.WATER || t === T.ICE || t === T.LAVA;
// Like Shattered Pixel Dungeon traps: a plate that goes off once when stepped on (or blown up).
// Some are hidden (map.hidden) until you spot them standing next to them.
export const TRAPS = [T.TRAP_SLEEP, T.TRAP_SUMMON, T.TRAP_ALARM, T.TRAP_SPIKE];
export const isTrap = t => (t >= T.TRAP_SLEEP && t <= T.TRAP_SPIKE) || t === T.TRAP_GRUMP;

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
  [T.TRAP_GRUMP]: { name: '심술 버섯',    sprite: 'trapGrump',  tip: '밟거나 뭘 던져 맞히면 포자가 퍼진다. 포자를 마신 녀석은 심술이 나서 옆에 있는 녀석을 문다. 나는 재채기만 난다.' },
  [T.TRAP_OFF]:   { name: '밟힌 덫',      sprite: 'trapOff',    tip: '이미 작동한 덫이다.' },
  [T.DUG]:        { name: '파헤친 흙',    sprite: 'dug',        tip: '누군가 파헤친 자리다.' },
  [T.ANVIL]:      { name: '모루',         sprite: 'anvil',      tip: '대장장이의 모루다.' },
  [T.BERRY]:      { name: '산딸기 덤불',  sprite: 'berry',     burn: 4, tip: '빨간 산딸기가 열렸다. 들어가면 따 먹고 체력이 조금 찬다. 덤불이라 앞을 가린다.' },
  [T.LAVA]:      { name: '용암', tip: '부글부글 끓는다. 들어갈 수 없다. 떠밀려 빠지면 크게 데인다. 불에 강한 녀석들은 헤엄쳐 다닌다.' },
  [T.ICE]:       { name: '빙판', tip: '올라서면 미끄러져서 빙판 끝까지 쭉 간다. 적도 미끄러진다.' },
  [T.CHASM]:     { name: '낭떠러지', tip: '아찔하게 깊다. 한 번 더 걸어 들어가면 뛰어내려서 다음 구역으로 떨어진다. 대신 크게 다친다. 떠밀린 적은 그대로 떨어진다.' },
  [T.BRIDGE]:    { name: '외나무다리', burn: 3, tip: '낭떠러지를 건너는 좁은 나무다리. 한 줄로만 지나갈 수 있다. 불이 붙으면 타서 무너진다.' },
  [T.SLIME]:     { name: '달팽이 점액', sprite: 'goo', tip: '미끌미끌하다. 밟으면 한 칸 더 미끄러진다. 곧 마른다.' },
  [T.HONEY]:     { name: '꿀', sprite: 'honey', tip: '끈적끈적하다. 밟으면 다음 걸음은 발을 떼느라 한 턴이 간다. 곧 마른다.' },
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
  prop:    { name: '덤불', tip: '방 한가운데 자란 덤불. 지나갈 수도 너머를 볼 수도 없어서 숨거나 돌아가기 좋다. 폭탄으로 날려 버릴 수 있다.' },
  drip:    { name: '종유석', tip: '천장에 종유석이 매달려 있다. 근처에서 큰 소리가 나면 떨어져서 밑에 있는 누구든 다친다. 적을 꾀어 오자.' },
  fly:     { name: '반딧불이', tip: '둘레를 밝힌다. 들어가면 병에 담겨서 이번 탐험 동안 조금 더 멀리 보인다.' },
};

export const GASES = {
  sleep: { name: '졸음 꽃가루', color: 0xb58cf0, tip: '마시면 잠든다. 적도 잠든다.' },
  mine:  { name: '늪 가스', color: 0xf4d35a, tip: '그 자체는 무해하다.' },
  grump: { name: '심술 포자', color: 0xf08c3a, tip: '마신 녀석은 심술이 나서 옆에 있는 녀석을 문다. 나는 재채기만 난다.' },
};
export const GAS_KEYS = ['sleep', 'mine', 'grump'];

// How strong a gas must be to do something
export const SLEEP_MIN = 2;
export const MINE_MIN = 1;
export const GRUMP_MIN = 2;

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
  { id: 'hush_root',   combo: '졸음 꽃가루 + 비명 뿌리', result: '비명 뿌리가 쿨쿨 잠들어 조용해진다', hint: '꺄아아 우는 뿌리도 졸음 꽃가루엔 못 버틴대.' },
  { id: 'daze_sneak',  combo: '어질어질한 적 + 공격', result: '별이 도는 동안은 기습이 된다', hint: '별이 빙빙 도는 녀석은 내가 다가오는 걸 못 본대. 그때 치면 기습이래.' },
  // v0.26: the meadow tools meet the rules of the fields
  { id: 'pine_cliff',  combo: '솔방울 + 절벽 끝',   result: '맞은 녀석이 절벽 아래로 데굴데굴', hint: '절벽 끝에 선 녀석한테 솔방울을 던지면 떨어진대.' },
  { id: 'pine_trap',   combo: '솔방울 + 함정',      result: '밀려난 녀석이 함정을 밟는다', hint: '솔방울에 맞고 밀려난 녀석이 함정을 밟았대.' },
  { id: 'pine_squirrel', combo: '솔방울 + 도토리 다람쥐', result: '덥석 받아 들고 묻으러 간다. 훔친 골드도 내팽개친다', hint: '도토리 다람쥐는 솔방울만 보면 정신을 못 차린대. 훔친 골드도 내팽개칠 만큼.' },
  { id: 'bell_honey',  combo: '방울 + 꿀',          result: '방울 소리 따라온 녀석이 꿀에 붙는다', hint: '방울 둘레에 꿀을 부어 두면 몰려온 녀석들이 다 붙는대.' },
  { id: 'bell_den',    combo: '방울 + 낮잠 방',     result: '자던 녀석들이 우르르 방울 쪽으로 몰려간다', hint: '모여 자는 녀석들 근처에서 방울을 울리면 다 같이 보러 간대.' },
  { id: 'brawl',       combo: '빗나간 공격 + 다른 녀석', result: '대신 맞은 녀석이 화가 나서 둘이 싸운다', hint: '멧돼지 돌진을 옆으로 피하면 뒤에 있던 녀석이 대신 받힌대. 그럼 둘이 싸운대.' },
  { id: 'pine_brawl',  combo: '솔방울 + 두 녀석',   result: '부딪힌 녀석이 밀고 온 녀석과 싸운다', hint: '솔방울로 한 녀석을 다른 녀석한테 밀어붙이면 둘이 싸운대.' },
  { id: 'grump_brawl', combo: '심술 포자 + 녀석들', result: '심술 난 녀석들끼리 물고 뜯는다', hint: '빨간 버섯 포자를 마신 녀석은 옆에 있는 녀석을 문대. 몰려 있을 때 터뜨려 봐.' },
  { id: 'big_prize',   combo: '기세등등한 녀석 + 공격', result: '쓰러뜨리면 별사탕을 떨군다', hint: '싸움에서 이기고 부푼 녀석을 쓰러뜨리면 별사탕을 떨군대.' },
  { id: 'well_evo',    combo: '소원 우물 + 유물',  result: '떠오른 유물이 가방 속 유물과 만나 진화한다', hint: '소원 우물에 유물을 던졌더니 떠오른 게 바로 진화했대.' },
  { id: 'den_sneak',   combo: '살금살금 + 낮잠 방', result: '다 자는 동안 연 상자는 넷 중 하나를 고른다', hint: '낮잠 방 녀석들이 다 자는 동안 상자를 열면 더 좋은 게 들어 있대. 졸음 꽃가루를 뿌려 두면 쉽대.' },
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
  '박하사탕 물고 졸음 꽃가루 속에 들어가면 잠든 녀석들을 마음껏 때릴 수 있대.',
  '불꽃 반지 낀 일꾼이 풀밭에서 싸우다가 들판을 홀랑 태웠대.',
  '낭떠러지 옆에서 세게 밀쳐지면 그대로 떨어진대. 조심해.',
];
export const SLEEP_TALK = ['음냐… 반짝돌…', '쿨… 쿨…', '으음… 오 분만…', '음냐… 치즈…'];

// Real hints about what is on this floor; one that fits is picked at random
export const FLOOR_HINTS = [
  { has: 'ore',    text: '반짝 바위 캐는 소리 나면 다 몰려가자.' },
  { has: 'ore',    text: '반짝 바위 옆 틈에서 가스 샌다던데. 불은 조심해.' },
  { has: 'garden', text: '저쪽 풀숲은 키가 커서 안이 하나도 안 보여.' },
  { has: 'trap',   text: '이 구역 땅 어딘가에 함정이 숨어 있대. 발밑 조심해.' },
  { has: 'grump',  text: '빨간 버섯 근처에선 녀석들이 서로 물어뜯는대. 포자 때문이래.' },
  { has: 'well',   text: '이 들판 어딘가에 소원 우물이 있대. 뭘 빠뜨리면 딴 걸로 바꿔 준대.' },
  { has: 'vault',  text: '잠긴 비밀 정원이 있대. 열쇠는 다른 방에 있다던데.' },
  { has: 'locked', text: '잠긴 상자가 하나 있대. 열쇠만 찾으면 좋은 게 들었대.' },
  { has: 'grave',  text: '다람쥐 도토리 창고가 있대. 파헤치면 청설모가 화낸대.' },
  { has: 'grave',  text: '다람쥐가 훔쳐 간 골드는 큰 참나무 그루터기에 모아 둔대.' },
  { has: 'statue', text: '허수아비 옆 상자를 집으면 허수아비가 깨어난대.' },
  { has: 'traps',  text: '함정이 빼곡한 방 끝에 상자가 있대. 길이 하나는 있대.' },
  { has: 'mimic',  text: '이 구역 상자 중 하나에는 소라게가 산대.' },
  { has: 'flood',  text: '물에 잠긴 방에 번개 떨어지면 다 찌릿하대.' },
  { has: 'weeds',  text: '이 구역에 잡초 밭이 있대. 다 뽑으면 별사탕이 나온다던데.' },
  { has: 'den',    text: '구석 방에서 다 같이 낮잠 잔대. 깨우면 큰일 난대.' },
];
