// 비밀 (v0.28): little things nobody tells you about, found by poking at the world the way you would
// anyway: bumping into the woods, rattling a barrel, standing still in the flowers, resting a long
// while out in the fields. The first time, a chime and a banner with how many there are; each one
// leaves a keepsake in the 비밀 상자 at home, which makes the house that bit cosier (data/home.js). The
// ones still to find are only ever "???" there; the neighbour passes on a rumour about one of them now
// and then (data/village.js gossip), never more.
//   where: 'village' | 'home' | 'field'; got: the keepsake's line; hint: the rumour

export const SECRETS = [
  { id: 'acorn', where: 'village', name: '다람쥐의 도토리', got: '숲을 세 번 흔들었더니 머리 위로 도토리가 콩! 다람쥐가 킥킥 웃고 숨었다.', hint: '마을 숲 다람쥐가 장난꾸러기래. 나무를 자꾸 흔들면 뭐가 떨어진대.' },
  { id: 'cat', where: 'village', name: '통 속 고양이', got: '나무통을 덜컹덜컹 흔들었더니 낮잠 자던 고양이가 튀어나왔다.', hint: '마을 나무통 안에서 가끔 냥 소리가 난대.' },
  { id: 'koi', where: 'village', name: '연못 잉어', got: '연못을 콕콕 찔렀더니 커다란 잉어가 펄쩍 뛰어올랐다. 물벼락을 맞았다.', hint: '연못에 아주 큰 잉어가 산대. 물을 자꾸 건드리면 화를 낸대.' },
  { id: 'butterfly', where: 'village', name: '나비 친구', got: '꽃밭에 가만히 서 있었더니 나비들이 날아와 머리에 앉았다.', hint: '꽃밭에서 꼼짝 않고 있으면 나비가 꽃인 줄 안대.' },
  { id: 'door', where: 'village', name: '작은 문 너머', got: '큰 나무의 작은 문을 똑똑똑 두드렸더니 작은 손이 쿠키를 내밀었다. "쉿."', hint: '큰 나무 작은 문은 한 번 두드려서는 안 열린대.' },
  { id: 'pup', where: 'village', name: '강아지 재주', got: '강아지를 실컷 쓰다듬었더니 데굴 구르고 땅을 파서 뭔가를 물어 왔다.', hint: '강아지를 한참 쓰다듬어 주면 재주를 부린대.' },
  // v0.29
  { id: 'echo', where: 'village', name: '우물 메아리', got: '우물에 대고 야호를 세 번 외쳤더니, 한참 뒤에 아래에서 누가 대답했다. "…야호?"', hint: '우물에 대고 자꾸 부르면 누가 대답한대. 메아리는 아니래.' },
  { id: 'notice', where: 'village', name: '바랜 공고문', got: '조합 게시판을 자꾸 건드렸더니 뒤에서 누렇게 바랜 종이가 떨어졌다. "광부 구함. 돌아오면 큰 상."', hint: '조합 게시판 뒤에 오래된 종이가 끼어 있대. 흔들면 떨어질지도.' },
  { id: 'chick', where: 'village', name: '밀짚모자 병아리', got: '허수아비를 흔들었더니 밀짚모자 속에서 병아리가 삐약! 하고 튀어나왔다.', hint: '허수아비 모자 속이 따뜻한가 봐. 누가 거기 산대.' },
  { id: 'honey', where: 'village', name: '따끔한 꿀', got: '벌통을 자꾸 건드렸더니 벌들이 몰려와 따끔하게 쏘았다. 그래도 꿀 한 방울을 얻었다.', hint: '벌통은 두 번까지는 참아 준대. 세 번째는 몰라.' },
  { id: 'dummy', where: 'village', name: '짚 인형 쓰러뜨리기', got: '짚 인형을 여덟 번 연달아 쳤더니 쿵 쓰러졌다. 속에서 도토리가 굴러 나왔다.', hint: '라이벌네 짚 인형은 아무리 때려도 안 쓰러진대. 정말일까?' },
  { id: 'pocket', where: 'home', name: '작업복 주머니', got: '옷장 속 작업복을 다 뒤졌더니 주머니에서 꼬깃꼬깃한 골드가 나왔다.', hint: '옷장 속 작업복 주머니를 끝까지 다 뒤져 본 적 있어?' },
  { id: 'letter', where: 'home', name: '베개 밑 쪽지', got: '침대에서 세 번 낮잠을 잤더니 베개 밑에서 쪽지가 나왔다. "내일은 꼭 돌아올게." 내 글씨가 아니다.', hint: '그 집 베개가 좀 볼록하대. 푹 자 보면 알 거래.' },
  { id: 'goldfish', where: 'home', name: '금붕어 점프', got: '어항을 톡톡톡 두드렸더니 금붕어가 펄쩍 뛰어올랐다가 뽀옥 들어갔다.', hint: '어항 금붕어가 심심하대. 톡톡 두드려 주면 신나 한대.' },
  { id: 'shadow', where: 'home', name: '벽 위의 토끼', got: '호롱을 껐다 켰다 하며 놀았더니 벽에 토끼 그림자가 폴짝폴짝 지나갔다. 내 손은 가만히 있었는데.', hint: '불을 자꾸 껐다 켰다 하면 벽에 그림자 친구가 놀러 온대.' },
  { id: 'bonk', where: 'field', name: '머리 쿵', got: '같은 데에 세 번 머리를 박았더니 혹이 났다. 위에서 뭔가 떨어졌다.', hint: '들판에서 같은 데를 자꾸 들이받으면 위에서 뭐가 떨어진대.' },
  { id: 'rustle', where: 'field', name: '덤불 속 아기', got: '덤불을 툭 쳤더니 자던 아기 동물이 튀어나와서 뭔가를 두고 도망갔다.', hint: '방에 혼자 선 덤불이 가끔 들썩이면 아기 동물이 자고 있는 거래.' },
  { id: 'nook', where: 'field', name: '숨은 방', got: '살짝 헤쳐진 덤불을, 금 간 바위를 세 번 두드렸더니 숨은 방이 나왔다.', hint: '들판마다 숨은 방이 하나씩 있대. 덤불이 살짝 헤쳐졌거나 바위에 금이 간 데를 두드려 보래.' },
  { id: 'spirit', where: 'field', name: '연못 신령', got: '연못에 도구를 던졌더니 신령님이 나와서 물었다. "이게 네 것이냐, 이 황금 도구가 네 것이냐?"', hint: '큰 연못에 도구를 던지면 신령님이 나온대. 거짓말은 안 통한대.' },
  { id: 'dream', where: 'field', name: '낮잠 꿈', got: '아무도 없는 들판에서 한참 쉬다가 깜빡 잠들었다. 이상한 꿈을 꿨다.', hint: '들판에서 아무도 없을 때 오래오래 쉬면 꿈을 꾼대. 이상한 꿈이래.' },
  // v0.29
  { id: 'sleeper', where: 'field', name: '자장가', got: '자는 동물 바로 옆에서 꼼짝 않고 쉬었더니, 잠결에 데굴 돌아누우면서 깔고 자던 걸 굴려 줬다.', hint: '자는 동물 옆에서 숨죽이고 있으면 돌아눕는대. 깨면 큰일이고.' },
  { id: 'pebble', where: 'field', name: '절벽 아래', got: '절벽 아래로 도구를 던졌다. 한참 뒤에야 아주 작게 퐁, 소리가 났다.', hint: '바닷가 절벽은 얼마나 깊을까? 뭘 떨어뜨려 보면 안대.' },
  { id: 'roast', where: 'field', name: '군 솔방울', got: '용암에 솔방울을 던졌더니 타닥타닥 구워져서 고소한 잣이 톡톡 튀어나왔다.', hint: '불꽃 화산에서는 솔방울도 구워 먹는대. 고소하대.' },
  // v0.31: the pets
  { id: 'chase', where: 'village', name: '참새 쫓기', got: '데리고 나온 펫 옆에서 가만히 있었더니, 참다 참다 참새한테 달려갔다. 참새는 벌써 날아가고 없었다.', hint: '펫이 참새를 엄청 신경 쓰더라. 옆에 가만히 서 있으면 못 참을걸.' },
  { id: 'petnap', where: 'home', name: '다 같이 낮잠', got: '집 안의 펫들이 하나둘 꾸벅꾸벅 졸더니 다 같이 새근새근 잠들었다. 나도 하품이 나왔다.', hint: '집에 펫이 여럿이면 가만히 있어 봐. 하나둘 졸기 시작한대.' },
];
export const secretOf = id => SECRETS.find(s => s.id === id);
export const secretsFound = m => SECRETS.filter(s => m.secrets?.[s.id]).length;

// (what the dozing worker dreams about: data/dreams.js since v0.30)

