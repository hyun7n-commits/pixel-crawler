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
// hint: what the villagers say before you find it (the critters never give hints: v0.28)
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
  { id: 'pine_roll', combo: '솔방울 + 공벌레', result: '동그랗게 말려 데굴데굴, 앞에 있던 녀석이 볼링 핀처럼 넘어진다', hint: '공벌레한테 솔방울을 던지면 공처럼 말려서 굴러간대. 그 앞에 누가 서 있으면 쾅!' },
  { id: 'pine_seal', combo: '솔방울 + 물범', result: '코끝으로 받아 묘기를 부리느라 나를 잊는다', hint: '물범한테 솔방울을 던지면 코끝으로 받아서 묘기를 부린대. 박수까지 친대.' },
  { id: 'pine_squirrel', combo: '솔방울 + 도토리 다람쥐', result: '덥석 받아 들고 묻으러 간다. 훔친 골드도 내팽개친다', hint: '도토리 다람쥐는 솔방울만 보면 정신을 못 차린대. 훔친 골드도 내팽개칠 만큼.' },
  { id: 'chili_snow',  combo: '매운 고추 + 눈사람', result: '땀을 뻘뻘 흘리다 녹아서 물웅덩이가 된다', hint: '눈사람한테 매운 고추를 먹이면 녹아 버린대. 머리까지 몽땅.' },
  { id: 'honey_bees',  combo: '꿀 병 + 화난 벌',    result: '벌들이 쏟아진 꿀로 몰려가서 나를 잊는다', hint: '벌집 털다 벌 떼한테 쫓기면 꿀 병을 던져 보래. 벌은 꿀을 못 지나친대.' },
  { id: 'bell_honey',  combo: '방울 + 꿀',          result: '방울 소리 따라온 녀석이 꿀에 붙는다', hint: '방울 둘레에 꿀을 부어 두면 몰려온 녀석들이 다 붙는대.' },
  { id: 'bell_frog', combo: '방울 + 개구리', result: '혀로 낚아채 꿀꺽 삼키고, 배 속에서 울리는 동안 딸꾹질만 한다', hint: '개구리는 눈앞에서 딸랑거리는 건 뭐든 혀로 낚아챈대. 방울을 삼키면 어떻게 될까?' },
  { id: 'bell_bats',   combo: '방울 + 박쥐',        result: '박쥐들이 방울 소리에 길을 잃고 어질어질 헤맨다', hint: '박쥐는 소리로 길을 찾는대. 바로 옆에서 방울이 울리면 정신을 못 차린대.' },
  { id: 'chili_salamander', combo: '매운 고추 + 불도마뱀', result: '한입에 꿀꺽하고 기세등등하게 부푼다', hint: '불도마뱀은 매운 걸 엄청 좋아한대. 고추를 던져 주면 신나서 몸집이 커진다나.' },
  { id: 'bell_cat',    combo: '방울 + 그림자 고양이', result: '방울을 갖고 노느라 나를 잊는다', hint: '그림자 고양이도 결국 고양이래. 딸랑딸랑 소리만 나면 사냥이고 뭐고 다 잊는다나.' },
  { id: 'bell_den',    combo: '방울 + 낮잠 방',     result: '자던 녀석들이 우르르 방울 쪽으로 몰려간다', hint: '모여 자는 녀석들 근처에서 방울을 울리면 다 같이 보러 간대.' },
  { id: 'brawl',       combo: '빗나간 공격 + 다른 녀석', result: '대신 맞은 녀석이 화가 나서 둘이 싸운다', hint: '멧돼지 돌진을 옆으로 피하면 뒤에 있던 녀석이 대신 받힌대. 그럼 둘이 싸운대.' },
  { id: 'pine_brawl',  combo: '솔방울 + 두 녀석',   result: '부딪힌 녀석이 밀고 온 녀석과 싸운다', hint: '솔방울로 한 녀석을 다른 녀석한테 밀어붙이면 둘이 싸운대.' },
  { id: 'grump_brawl', combo: '심술 포자 + 녀석들', result: '심술 난 녀석들끼리 물고 뜯는다', hint: '빨간 버섯 포자를 마신 녀석은 옆에 있는 녀석을 문대. 몰려 있을 때 터뜨려 봐.' },
  { id: 'big_prize',   combo: '기세등등한 녀석 + 공격', result: '쓰러뜨리면 별사탕을 떨군다', hint: '싸움에서 이기고 부푼 녀석을 쓰러뜨리면 별사탕을 떨군대.' },
  { id: 'well_evo',    combo: '소원 우물 + 유물',  result: '떠오른 유물이 가방 속 유물과 만나 진화한다', hint: '소원 우물에 유물을 던졌더니 떠오른 게 바로 진화했대.' },
  { id: 'den_sneak',   combo: '살금살금 + 낮잠 방', result: '다 자는 동안 연 상자는 넷 중 하나를 고른다', hint: '낮잠 방 녀석들이 다 자는 동안 상자를 열면 더 좋은 게 들어 있대. 졸음 꽃가루를 뿌려 두면 쉽대.' },
];
