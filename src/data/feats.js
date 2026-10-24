// 몰래 해낸 일 (v0.30): things you happen to pull off out in the fields. Nothing lists them or says what
// they are; the first time you do one it chimes, and it gets its page in the 비밀 도감 (data/book.js).
// What each one takes is in core/feats.js (watching what goes on in a trip). Not on the very first
// trip out.
//   [id, name, line, pic]

export const FEAT_LIST = [
  // 싸움
  ['combo5', '다섯 연속', '다섯을 잇달아 쓰러뜨렸다. 숨이 차다.', { spr: 'blade' }],
  ['combo8', '여덟 연속', '여덟을 숨 돌릴 틈도 없이 쓰러뜨렸다.', { spr: 'flamesword' }],
  ['three_at_once', '한 번에 셋', '한 번에 셋이 한꺼번에 쓰러졌다.', { spr: 'bomb' }],
  ['five_at_once', '한 번에 다섯', '한 번에 다섯이 쓰러졌다. 무슨 일이 일어난 걸까.', { spr: 'meteor' }],
  ['sneak10', '살금살금', '몰래 다가가 기습한 게 열 번이 되었다.', { spr: 'dagger' }],
  ['sneak100', '그림자 일꾼', '기습 백 번. 이제 발소리가 거의 안 난다.', { spr: 'shadow' }],
  ['boss_nohit', '무사 대장전', '대장 들판에서 한 대도 맞지 않고 대장을 쓰러뜨렸다.', { spr: 'shield' }],
  ['boss_low', '간당간당', '체력이 바닥난 채로 대장을 쓰러뜨렸다.', { spr: 'heart' }],
  ['boss_pine', '솔방울 마무리', '대장을 솔방울로 마무리했다. 대장이 억울해 보였다.', { spr: 'pinecone' }],
  ['chili_boss', '매운맛 대장', '대장에게 고추를 먹였다. 눈물이 글썽글썽했다.', { spr: 'chili' }],
  ['fire5', '불바다', '한 번 탐험에서 다섯을 불로 쓰러뜨렸다.', { spr: 'firebomb' }],
  ['plunge', '낭떠러지 밀기', '들판 친구를 낭떠러지 아래로 밀어 떨어뜨렸다. 미안.', { spr: 'gap' }],
  ['chief3', '왕관 수집가', '왕관 쓴 우두머리를 셋 쓰러뜨렸다.', { spr: 'crown' }],
  ['big', '덩치 잡기', '숨은 방에서 보물을 깔고 자던 덩치를 쓰러뜨렸다.', { spr: 'napper' }],
  ['kills100', '백 번의 콩', '들판 친구들을 백 번 쓰러뜨렸다.', { spr: 'hammer' }],
  ['kills500', '오백 번의 콩', '들판 친구들을 오백 번 쓰러뜨렸다.', { spr: 'godhammer' }],
  ['kills1000', '천 번의 콩', '들판 친구들을 천 번 쓰러뜨렸다. 다들 나를 알아본다.', { spr: 'bloodking' }],
  ['hp1', '구사일생', '체력 1로 버텼다.', { spr: 'bandage' }],
  ['win_low', '너덜너덜 귀환', '쓰러지기 직전의 몸으로 탐험을 마쳤다.', { spr: 'undying' }],
  ['dodge10', '요리조리', '공격을 열 번 피했다.', { spr: 'whirl' }],
  // 조용히
  ['peace', '평화로운 들판', '아무도 쓰러뜨리지 않고 들판 하나를 지나갔다.', { find: ['flower', 'w'] }],
  ['unseen', '쉿', '아무에게도 들키지 않고 들판 하나를 지나갔다.', { spr: 'cloak' }],
  ['unhurt', '흠집 하나 없이', '한 대도 맞지 않고 들판 하나를 지나갔다.', { spr: 'fortress' }],
  ['habit_sneak', '딴짓 기습', '딴짓하던 친구를 기습했다. 좀 치사했다.', { spr: 'snail', mark: '!' }],
  ['doze3', '다 같이 꾸벅', '셋이 한꺼번에 꾸벅꾸벅 졸았다.', { spr: 'sleepflower' }],
  ['honey3', '꿀범벅', '셋을 한꺼번에 꿀범벅으로 만들었다.', { spr: 'honeyjar' }],
  ['heard6', '온 들판이 들었다', '한 번에 여섯이 무슨 소리인가 하고 고개를 들었다.', { spr: 'bell' }],
  ['brawl', '싸움 구경', '들판 친구들끼리 투닥거리는 걸 구경했다.', { spr: 'grump' }],
  ['robbed', '털렸다', '너구리가 내 골드를 들고 사라졌다.', { spr: 'thief' }],
  // 걷기
  ['steps1000', '천 걸음', '들판을 천 걸음 걸었다.', { spr: 'boots' }],
  ['steps10000', '만 걸음', '들판을 만 걸음 걸었다. 신발 밑창이 닳았다.', { find: ['sock', 'r'] }],
  ['wade100', '첨벙첨벙', '물속을 백 걸음 걸었다. 발이 쭈글쭈글하다.', { spr: 'ripple' }],
  ['grass500', '풀숲 헤치기', '키 큰 풀을 오백 번 헤치고 지나갔다.', { spr: 'sweep' }],
  ['slide8', '쭈우욱', '빙판에서 여덟 칸을 한 번에 미끄러졌다.', { find: ['flake', 'c'] }],
  ['jump', '번지 점프', '낭떠러지에서 스스로 뛰어내렸다.', { spr: 'gap', mark: '!' }],
  ['deep3', '깊은 곳 3', '깊은 곳 셋째 들판까지 내려갔다.', { spr: 'stairs' }],
  ['deep5', '깊은 곳 5', '깊은 곳 다섯째 들판까지 내려갔다. 위가 까마득하다.', { spr: 'stairsBare' }],
  ['quick', '번개 걸음', '들판에 들어온 지 서른 턴도 안 되어 다음 땅굴로 들어갔다.', { spr: 'thunder' }],
  ['slow', '느긋한 하루', '한 들판에서 사백 턴을 보냈다.', { spr: 'pet_snail' }],
  ['rest50', '쉬엄쉬엄', '한 번 탐험에서 쉰 번을 쉬었다.', { spr: 'rest' }],
  ['trap10', '함정 전문가', '함정을 열 번 밟았다. 일부러는 아니다.', { spr: 'trapSpike' }],
  ['bonk9', '혹 세 개', '벽에 머리를 아홉 번 박았다.', { spr: 'pebble' }],
  // 가방
  ['tools6', '도구 박사', '한 번 탐험에서 들판 도구 여섯 가지를 다 써 봤다.', { spr: 'toolpouch' }],
  ['pine10', '솔방울 투수', '한 번 탐험에서 솔방울을 열 번 던졌다.', { spr: 'pinecone', mark: '!' }],
  ['no_potion', '물약 없이', '물약을 한 번도 마시지 않고 탐험을 마쳤다.', { spr: 'potion' }],
  ['candy3', '단것 중독', '한 번 탐험에서 별사탕을 셋 먹었다.', { spr: 'candy' }],
  ['chests10', '상자 열 개', '보물 상자를 열 개 열었다.', { spr: 'chest' }],
  ['chests100', '상자 백 개', '보물 상자를 백 개 열었다.', { spr: 'richChest' }],
  ['gold500', '두둑한 주머니', '한 번 탐험에서 500골드를 모았다.', { spr: 'gold_4' }],
  ['gold2000', '황금 주머니', '한 번 탐험에서 2000골드를 모았다.', { spr: 'gold_5' }],
  ['full_bag', '가방 가득', '유물 칸을 가득 채웠다.', { spr: 'bag' }],
  ['evolve3', '세 번 조합', '한 번 탐험에서 유물을 세 번 조합했다.', { spr: 'gear' }],
  ['berry20', '열매 따기', '들판 열매를 스무 번 따 먹었다.', { spr: 'berry' }],
  ['ore50', '광부', '반짝 바위를 쉰 개 캐냈다.', { spr: 'pick' }],
  ['buy10', '단골 손님', '떠돌이 상인에게 열 번 물건을 샀다.', { spr: 'peddler' }],
  ['wish', '소원 빌기', '소원 우물에 유물을 던져 넣었다.', { spr: 'well' }],
  // 별난 것
  ['pat10', '쓰담쓰담', '순한 친구들을 열 번 쓰다듬었다.', { odd: 'baby', spr: 'rat' }],
  ['flower5', '꽃다발', '꽃단장 친구에게서 꽃을 다섯 송이 받았다.', { odd: 'flower', spr: 'slime' }],
  ['gold1', '황금 사냥', '황금 친구를 잡았다. 동전이 와르르 쏟아졌다.', { odd: 'gold', spr: 'rat' }],
  ['gold5', '황금 사냥꾼', '황금 친구를 다섯 번 잡았다.', { odd: 'gold', spr: 'goblin' }],
  ['lull3', '자장자장', '잠꾸러기 셋의 곁을 지켜 주었다.', { odd: 'sleepy', spr: 'snail' }],
  ['glint3', '보물 찾기', '한 번 탐험에서 반짝 흙을 세 군데 팠다.', { spr: 'glintDirt' }],
  ['dupe', '또 주웠다', '이미 있는 걸 또 주웠다. 그래도 반갑다.', { find: ['button', 'y'] }],
  ['odd5', '별난 날', '한 번 탐험에서 다섯 가지 별난 친구를 다 봤다.', { odd: 'old', spr: 'frog' }],
  // 도감
  ['book50', '도감 50쪽', '비밀 도감이 50쪽 채워졌다.', { find: ['pencil', 'y'] }],
  ['book100', '도감 100쪽', '비밀 도감이 100쪽 채워졌다.', { find: ['letter', 'iY'] }],
  ['book200', '도감 200쪽', '비밀 도감이 200쪽 채워졌다. 제법 두툼하다.', { find: ['photo', 'w'] }],
  ['book300', '도감 300쪽', '비밀 도감이 300쪽 채워졌다.', { find: ['glasses', 'L'] }],
  ['book500', '도감 500쪽', '비밀 도감이 500쪽 채워졌다. 들고 다니기 무겁다.', { find: ['badge', 'y'] }],
  ['book800', '도감 800쪽', '비밀 도감이 800쪽 채워졌다. 아직도 빈칸이 있다.', { find: ['crystal', 'p'] }],
];
export const FEATS = FEAT_LIST.map(([id, name, line, pic]) => ({ id, name, line, pic }));
export const featId = id => `feat:${id}`;
export const BOOK_FEATS = [50, 100, 200, 300, 500, 800];
