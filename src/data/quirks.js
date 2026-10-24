// 작은 장난 (v0.30): little odd things that happen round the village and at home when you hang about,
// poke at something one time too many, carry the wrong thing past the wrong someone, or tag along
// behind a neighbour (scenes/village-quirks.js, scenes/home-quirks.js). Nothing says they are there;
// the first time each one happens, it gets its page in the 비밀 도감's first chapter (data/book.js).
// After that it still happens now and then; it is just yours now.
//   { id, where, name, line, pic } · pic as in data/book.js

export const quirkId = id => `quirk:${id}`;

const q = (id, where, name, line, pic) => ({ id, where, name, line, pic });

export const QUIRKS = [
  // ---------- the village ----------
  q('lampfly', 'village', '등불 속 반딧불이', '반딧불 등을 다섯 번 툭툭 쳤더니 불이 꺼지고 반딧불이 한 마리가 나왔다. 내 머리 위를 한 바퀴 돌고 다시 들어갔다.', { spr: 'pet_firefly' }),
  q('lampround', 'village', '등불 한 바퀴', '광장 등불 넷을 시계 방향으로 차례차례 만졌더니 불빛이 빙글 한 바퀴 돌았다. 등불들도 놀고 싶었나 보다.', { spr: 'lantern' }),
  q('needle', 'village', '건초 더미 속 바늘', '건초 더미를 다섯 번 뒤졌더니 정말로 바늘이 나왔다. 찾아 달라는 사람은 없었다.', { find: ['shard', 'l'] }),
  q('stare', 'village', '허수아비와 눈싸움', '허수아비 옆에 가만히 서 있었더니 허수아비가 고개를 돌려 나를 봤다. 먼저 눈을 피한 건 나였다.', { find: ['cap', 'y'] }),
  q('sneeze', 'village', '버섯 재채기', '빨간 버섯을 다섯 번 건드렸더니 에취! 재채기를 했다. 발밑에 꼬마 버섯이 송송 돋았다.', { find: ['shroom', 'r'] }),
  q('worm', 'village', '사과 속 손님', '사과나무를 다섯 번 흔들었더니 사과가 툭 떨어졌다. 한 입 먹으려는데 애벌레가 먼저 인사했다.', { find: ['round', 'r'] }),
  q('topiary', 'village', '폴짝 동물 나무', '동물 나무 옆에 한참 서 있었더니 나무가 폴짝 뛰었다. 다시 보니 처음 그 자리에 있었다.', { find: ['leaf', 'G'] }),
  q('benchnap', 'village', '벤치 낮잠', '벤치에 앉아 있다가 깜빡 졸았다. 깨어 보니 머리에 꽃잎이 한 장 얹혀 있었다.', { find: ['flower', 'q'] }),
  q('underecho', 'village', '땅속 메아리', '우물에 야호를 외치고 분수 옆에 섰더니 물속에서 "…호" 하고 들렸다. 땅 밑으로 다 이어져 있나 보다.', { find: ['marble', 'c'] }),
  q('reflect', 'village', '물속의 나', '분수에 비친 내 얼굴을 한참 들여다봤더니, 물속의 내가 먼저 눈을 깜빡였다.', { find: ['marble', 'b'] }),
  q('ducks', 'village', '오리 행렬', '연못가에 가만히 서 있었더니 아기 오리들이 뭍으로 올라와 내 뒤에 줄을 섰다. 엄마 오리는 물에서 지켜만 봤다.', { spr: 'pet_duckling' }),
  q('frog', 'village', '개구리 혀', '벌레를 들고 개울가에 섰더니 개구리 혀가 휙 날아왔다. 벌레 대신 내 코를 핥고 갔다.', { spr: 'frog' }),
  q('fishcat', 'village', '생선 냄새', '생선을 들고 나무통 옆에 섰더니 고양이가 나와서 졸졸 따라왔다. 내가 아니라 생선을 따라온 거다.', { spr: 'shadecat' }),
  q('farside', 'village', '건너편의 손짓', '다리 끝에 한참 서 있었더니 개울 건너편 나무 사이에서 누가 손을 흔들었다. 다시 보니 아무도 없었다.', { spr: 'workertag' }),
  q('goldleaf', 'village', '금빛 잎', '큰 나무 아래 딱 한 자리에 가만히 서 있었더니 금빛 잎 하나가 내 머리에 내려앉았다.', { find: ['leaf', 'Y'] }),
  q('mutter', 'village', '벽 너머 혼잣말', '조합 뒤에 서 있었더니 벽 너머로 조합장의 혼잣말이 들렸다. 뭔가를 세고 있는 것 같았다.', { spr: 'guildBoss' }),
  q('candy', 'village', '가게 뒤 사탕', '가게 뒤에서 상점 주인이 몰래 사탕을 먹고 있었다. 못 본 걸로 해 주기로 했다.', { spr: 'candy' }),
  q('practice', 'village', '라이벌의 연습', '라이벌 집 뒤에서 혼자 "고마워" 연습하는 소리를 들었다. 누구한테 할 말인지는 모르겠다.', { find: ['letter', 'p'] }),
  q('clover', 'village', '집 뒤 네잎클로버', '우리 집 뒤에 가만히 서 있었더니 발밑에 네잎클로버가 잔뜩 돋아났다. 집이 행운을 모아 두었나 보다.', { find: ['clover', 'g'] }),
  q('freeze', 'village', '무궁화 꽃이 피었습니다', '울타리 구석에 서 있었더니 참새들이 살금살금 다가왔다. 휙 돌아보면 딱 멈췄다.', { spr: 'pet_sparrow' }),
  q('voice', 'village', '땅굴 속 목소리', '땅굴 앞에 한참 서 있었더니 저 아래에서 "…어이" 하는 소리가 올라왔다. 메아리였을 거다.', { spr: 'headlamp' }),
  q('sparkheart', 'village', '하트 불티', '모닥불 옆에 가만히 있었더니 불티가 하트 모양으로 날아올랐다. 금방 흩어져서 나만 봤다.', { find: ['heart', 'o'] }),
  q('petals', 'village', '꽃잎 세례', '꽃 아치 셋을 한달음에 지나갔더니 꽃잎이 우수수 쏟아졌다. 무슨 축하인지는 몰라도 기분이 좋았다.', { find: ['flower', 'r'] }),
  q('bunsmoke', 'village', '빵 모양 연기', '빵집 앞에서 배가 꼬르륵 울렸더니 굴뚝 연기가 빵 모양으로 피어올랐다. 더 배고파졌다.', { find: ['pie', 'n'] }),
  q('mouse', 'village', '풍차 타는 생쥐', '풍차를 다섯 번 두드렸더니 날개에 매달린 생쥐가 한 바퀴 빙 돌고 떨어졌다. 어지러워 보였지만 또 탈 것 같다.', { spr: 'pet_mouse' }),
  q('heartglass', 'village', '유리창 하트', '온실 유리에 입김을 호 불었더니 안쪽에서 누가 하트를 그렸다. 온실 안에는 딸기밖에 없었다.', { find: ['heart', 'c'] }),
  q('guest', 'village', '여관 손님', '여관 문 앞에 서 있었더니 문틈으로 손님이 빼꼼 내다봤다. 쥐였다. 숙박비는 냈는지 모르겠다.', { spr: 'rat' }),
  q('spotlight', 'village', '무대 조명', '무대 앞 한가운데에 섰더니 조명이 탁 켜졌다. 어쩔 수 없이 춤을 췄다.', { find: ['star', 'z'] }),
  q('tangle', 'village', '리본 칭칭', '축제 기둥을 빙글빙글 두 바퀴 돌았더니 리본에 칭칭 감겼다. 풀려나는 데 한참 걸렸다.', { find: ['ribbon', 'p'] }),
  q('whisper', 'village', '졸졸 이웃', '수다쟁이 이웃을 졸졸 따라다녔더니 비밀을 하나 알려 줬다. 비밀이 아니라 소문 같았다.', { spr: 'neighbor' }),
  q('stretch', 'village', '따라 하지 마', '라이벌을 졸졸 따라 뛰었더니 "따라 하지 마!" 하고 소리쳤다. 결국 같이 체조를 했다.', { spr: 'rival' }),
  q('bandage', 'village', '반창고', '구조대원을 따라다녔더니 다친 줄 알고 반창고를 붙여 줬다. 아픈 데는 없었는데 든든했다.', { spr: 'bandage' }),
  q('hello', 'village', '다 같이 안녕', '마을 사람 모두에게 한 번씩 말을 걸었더니 다들 한꺼번에 손을 흔들어 줬다.', { find: ['heart', 'r'] }),
  q('snail', 'village', '우편함 속 달팽이', '빈 우편함을 다섯 번 두드렸더니 안에서 자던 달팽이가 화를 내며 나왔다. 편지는 없었다.', { spr: 'snail' }),
  q('pupnap', 'village', '강아지 베개', '강아지 옆에 가만히 서 있었더니 강아지가 기대 와서 잠들었다. 다리가 저렸지만 꾹 참았다.', { find: ['bone', 'n'] }),
  q('soap', 'village', '비누 냄새', '목욕하고 나와서 강아지를 쓰다듬었더니 킁킁대다가 에취! 비누 냄새는 싫은가 보다.', { find: ['bottle', 'c'] }),
  // ---------- at home ----------
  q('sparrow', 'home', '창밖 손님', '창가에 서 있었더니 참새가 날아와 유리창을 톡톡 두드렸다. 그냥 인사하러 온 거였다.', { find: ['feather', 'n'] }),
  q('peek', 'home', '창문 너머 라이벌', '창가에 서 있었더니 창밖에서 라이벌이 빼꼼 들여다봤다. 눈이 마주치자 후다닥 숨었다.', { find: ['glasses', 'p'] }),
  q('dustbunny', 'home', '침대 밑 먼지 뭉치', '침대를 들어 올렸더니 밑에서 먼지 뭉치가 후다닥 도망갔다. 눈이 달려 있었던 것 같다.', { find: ['yarn', 'l'] }),
  q('drawing', 'home', '옷장 뒤 그림', '옷장을 옮겼더니 뒤에 붙어 있던 크레용 그림이 팔랑 떨어졌다. 모자 쓴 꼬마 일꾼 셋이 손을 잡고 있었다.', { find: ['photo', 'y'] }),
  q('stars', 'home', '천장의 별', '불을 끄고 누웠더니 천장에 별이 떴다. 누가 몰래 야광별을 붙여 놓았나 보다.', { find: ['star', 'v'] }),
  q('cough', 'home', '난로가 콜록', '정체불명 스튜를 끓였더니 난로가 콜록콜록 기침을 했다. 내 얼굴도 까매졌다.', { find: ['pot', 'X'] }),
  q('fishnose', 'home', '생선 굽는 냄새', '생선 요리를 했더니 창밖에 고양이가 코를 붙이고 킁킁거렸다. 창문이 안 열려서 미안했다.', { find: ['fish', 'o'] }),
  q('cuckoo', 'home', '화난 뻐꾸기', '뻐꾸기 시계를 다섯 번 두드렸더니 뻐꾸기가 화가 나서 뻐꾹뻐꾹뻐꾹 하고 쏙 들어갔다.', { find: ['feather', 'o'] }),
  q('painting', 'home', '움직이는 그림', '들판 그림 앞에 한참 서 있었더니 그림 속 풀밭으로 작은 쥐가 쪼르르 지나갔다.', { find: ['photo', 'g'] }),
  q('burp', 'home', '화분의 트림', '화분에 물을 다섯 번 연달아 줬더니 화분이 "끄억" 하고 트림을 했다. 배가 불렀나 보다.', { find: ['flower', 'g'] }),
  q('duck', 'home', '고무 오리', '욕조에 세 번 연달아 들어갔더니 거품 속에서 고무 오리가 퐁 떠올랐다. 누구 건지는 모르겠다.', { find: ['egg', 'y'] }),
  q('lullaby', 'home', '자장가 오르골', '오르골을 감고 의자에 앉았더니 스르르 잠이 들었다. 오르골이 멈추는 소리에 화들짝 깼다.', { find: ['whistle', 'q'] }),
  q('chorus', 'home', '인형 합창', '인형들을 다섯 번 눌렀더니 다 같이 삑삑 합창을 했다. 박자는 하나도 안 맞았다.', { find: ['heart', 'q'] }),
  q('shoulder', 'home', '어깨 베개', '놀러 온 친구 옆에 앉아 있었더니 친구가 꾸벅꾸벅 졸다가 내 어깨에 기댔다.', { spr: 'pillow' }),
  q('book', 'home', '떨어진 책', '책장 옆에 서 있었더니 책 한 권이 툭 떨어졌다. 낡은 일꾼 명부였다. 몇 줄은 이름이 지워져 있었다.', { spr: 'pet_bookworm' }),
  q('sunplant', 'home', '창가 화분', '화분을 창가로 옮겼더니 햇볕을 받고 기지개를 켰다. 화분도 창가 자리가 좋은가 보다.', { find: ['sunflower', 'y'] }),
  q('cloud', 'home', '뽀송한 꿈', '목욕하고 바로 잤더니 뽀송뽀송한 양들이 울타리를 넘는 꿈을 꿨다. 세다가 잊어버렸다.', { find: ['yarn', 'w'] }),
];
export const QUIRK = Object.fromEntries(QUIRKS.map(o => [o.id, o]));

// what the chatty neighbour lets slip when you have been following her about (a few of them only)
export const QUIRK_HINTS = {
  needle: '건초 더미에 바늘이 있다는 말, 진짜일까?',
  farside: '다리 끝에 오래 서 있으면 건너편이 보인대.',
  mutter: '조합장님은 가끔 건물 뒤에서 혼잣말을 하신대.',
  candy: '상점 주인 말이야, 가게 뒤에서 뭘 몰래 먹더라.',
  goldleaf: '큰 나무 밑 어딘가에 금빛 잎이 떨어지는 자리가 있대.',
  reflect: '분수를 오래 들여다보면 이상한 게 보인대.',
  voice: '땅굴 앞에 오래 서 있지 마. 이상한 소리가 난대.',
  clover: '집 뒤에 행운이 숨어 있다더라.',
  lampround: '광장 등불은 시계 방향을 좋아한대.',
  tangle: '축제 기둥을 너무 많이 돌면 큰일 난대.',
  mouse: '풍차 날개에 누가 매달려 산대.',
  snail: '빈 우편함에도 손님이 산대.',
};

// what one scene wants the other to know for a little while (not saved): when you last had a bath
export const QK = { bathAt: -1e9 };
