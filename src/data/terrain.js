// Floor features, gases and the combinations players can discover.
// Each floor tile has at most one feature (map.ter). Gases float on top (map.gas).

export const T = {
  NONE: 0, BRUSH: 1, ASH: 2, WATER: 3, STICKY: 4, RAIL_H: 5, RAIL_V: 6,
  TIMBER: 7, CRACKED: 8, VENT: 9, MUSH_SLEEP: 10, MUSH_POISON: 11, PIT: 12,
};

// burn: turns a fire lasts on this feature (0 = does not burn)
// sprite: overlay drawn on the floor tile (see TER_SPR in sprites.js)
export const TERRAIN = {
  [T.BRUSH]:       { name: '버섯 덤불',   sprite: 'brush',      burn: 4, tip: '시야를 가려요. 안에 숨으면 멀리 있는 적이 나를 못 봐요. 불에 잘 타요.' },
  [T.ASH]:         { name: '탄 자국',     sprite: 'ash',        tip: '불에 타고 남은 자리예요.' },
  [T.WATER]:       { name: '지하수 웅덩이', tip: '몸에 불이 붙었을 때 들어가면 꺼져요.' },
  [T.STICKY]:      { name: '끈적이 웅덩이', sprite: 'sticky',   tip: '밟으면 한 턴 붙잡혀요.' },
  [T.RAIL_H]:      { name: '광차 레일',   sprite: 'railH',      tip: '광차를 밀면 레일을 따라 굴러가요.' },
  [T.RAIL_V]:      { name: '광차 레일',   sprite: 'railV',      tip: '광차를 밀면 레일을 따라 굴러가요.' },
  [T.TIMBER]:      { name: '나무 갱목',   sprite: 'timber',     burn: 6, tip: '천장을 받치는 나무예요. 불에 타요.' },
  [T.CRACKED]:     { name: '금 간 천장',  sprite: 'cracked',    tip: '큰 충격이 오면 무너질 것 같아요.' },
  [T.VENT]:        { name: '가스 틈',     sprite: 'vent',       tip: '광산 가스가 조금씩 새어 나와요.' },
  [T.MUSH_SLEEP]:  { name: '졸음 버섯',   sprite: 'mushSleep',  burn: 1, tip: '밟거나 터뜨리면 졸음 가스가 퍼져요.' },
  [T.MUSH_POISON]: { name: '독 버섯',     sprite: 'mushPoison', burn: 1, tip: '밟거나 터뜨리면 독 가스가 퍼져요.' },
  [T.PIT]:         { name: '구덩이',      tip: '뛰어들면 아래층으로 떨어져요. 조금 아파요.' },
};

export const isRail = t => t === T.RAIL_H || t === T.RAIL_V;
export const isMushroom = t => t === T.MUSH_SLEEP || t === T.MUSH_POISON;

export const TILE_INFO = {
  crystal: { name: '수정', tip: '빛을 내서 주변을 밝혀요. 지나갈 수는 없어요.' },
  ore:     { name: '반짝돌 광맥', tip: '부딪혀서 캐면 골드가 나와요.' },
  rubble:  { name: '무너진 돌', tip: '부딪혀서 치울 수 있어요.' },
  stairs:  { name: '계단', tip: '아래층으로 내려가요.' },
  fire:    { name: '불', tip: '닿으면 몸에 불이 붙어요. 웅덩이에 들어가면 꺼져요.' },
  cart:    { name: '광차', tip: '부딪히면 레일 방향으로 밀려 굴러가요. 길에 있는 적을 들이받아요.' },
};

export const GASES = {
  sleep:  { name: '졸음 가스', color: 0xb58cf0, tip: '마시면 잠들어요. 적도 잠들어요.' },
  poison: { name: '독 가스',   color: 0x8fd35a, tip: '안에 있으면 턴마다 체력이 줄어요.' },
  mine:   { name: '광산 가스', color: 0xf4d35a, tip: '그 자체는 무해해요.' },
};
export const GAS_KEYS = ['sleep', 'poison', 'mine'];

// How strong a gas must be to do something
export const SLEEP_MIN = 2;
export const POISON_MIN = 1;
export const MINE_MIN = 1;

// basic: the rule is common sense and its tooltip already says it
// hint: what villagers or overheard enemies say before you find it
export const DISCOVERIES = [
  { id: 'fire_brush',   combo: '불 + 버섯 덤불',    result: '불이 덤불을 타고 번져요', basic: true },
  { id: 'water_fire',   combo: '물 + 불',           result: '몸에 붙은 불이 꺼져요', basic: true },
  { id: 'bomb_wall',    combo: '폭탄 + 벽',         result: '벽에 구멍이 뚫려요', basic: true },
  { id: 'noise_sleep',  combo: '큰 소리 + 자는 적', result: '적이 깨서 소리 난 곳으로 와요', basic: true },
  { id: 'fire_mine',    combo: '불 + 광산 가스',    result: '가스 전체가 한 번에 대폭발', hint: '광산 가스에 불 붙이면 큰일 난대.' },
  { id: 'bolt_water',   combo: '번개 + 웅덩이',     result: '웅덩이에 있는 모두가 감전', hint: '웅덩이에 번개 떨어지면 다 찌릿하대.' },
  { id: 'fire_poison',  combo: '불 + 독 가스',      result: '독 가스가 타서 사라져요', hint: '독 가스는 불에 탄다던데.' },
  { id: 'bomb_ceiling', combo: '폭발 + 금 간 천장', result: '천장이 무너져 아래 있는 걸 깔아요', hint: '금 간 천장 밑에서 터뜨리지 마.' },
  { id: 'fire_timber',  combo: '불 + 나무 갱목',    result: '다 타면 천장이 무너져요', hint: '갱목에 불 붙으면 천장 무너져.' },
  { id: 'bomb_cart',    combo: '폭탄 + 광차',       result: '폭탄 실은 광차가 굴러가다 터져요', hint: '광차에 뭘 실어서 밀면 재밌겠다.' },
  { id: 'bolt_crystal', combo: '번개 + 수정',       result: '번개가 수정에 튕겨 다른 적에게 가요', hint: '수정 근처에선 번개가 튄대.' },
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

// Hints that fit what is on this floor (checked in order)
export const FLOOR_HINTS = [
  { has: 'vent',    text: '저쪽 방 가스 냄새 나지 않냐?' },
  { has: 'pit',     text: '구덩이에 뛰어내리면 아래층으로 바로 간대.' },
  { has: 'ore',     text: '벽에 반짝이는 거, 캐면 돈 된대.' },
  { has: 'cart',    text: '광차에 뭘 실어서 밀면 재밌겠다.' },
  { has: 'timber',  text: '갱목에 불 붙으면 천장 무너져.' },
  { has: 'cracked', text: '금 간 천장 밑에서 터뜨리지 마.' },
  { has: 'crystal', text: '수정 근처에선 번개가 튄대.' },
];
