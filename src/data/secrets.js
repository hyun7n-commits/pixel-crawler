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
  { id: 'pocket', where: 'home', name: '작업복 주머니', got: '옷장 속 작업복을 다 뒤졌더니 주머니에서 꼬깃꼬깃한 골드가 나왔다.', hint: '옷장 속 작업복 주머니를 끝까지 다 뒤져 본 적 있어?' },
  { id: 'bonk', where: 'field', name: '머리 쿵', got: '같은 데에 세 번 머리를 박았더니 혹이 났다. 위에서 뭔가 떨어졌다.', hint: '들판에서 같은 데를 자꾸 들이받으면 위에서 뭐가 떨어진대.' },
  { id: 'rustle', where: 'field', name: '덤불 속 아기', got: '덤불을 툭 쳤더니 자던 아기 동물이 튀어나와서 뭔가를 두고 도망갔다.', hint: '방에 혼자 선 덤불이 가끔 들썩이면 아기 동물이 자고 있는 거래.' },
  { id: 'nook', where: 'field', name: '틈 너머 비밀 터', got: '빛이 새는 틈으로 비집고 들어갔더니 아무도 모르는 작은 터가 있었다.', hint: '들판 벽에 빛이 새는 틈이 보이면 비집고 들어갈 수 있대.' },
  { id: 'spirit', where: 'field', name: '연못 신령', got: '연못에 도구를 던졌더니 신령님이 나와서 물었다. "이게 네 것이냐, 이 황금 도구가 네 것이냐?"', hint: '큰 연못에 도구를 던지면 신령님이 나온대. 거짓말은 안 통한대.' },
  { id: 'dream', where: 'field', name: '낮잠 꿈', got: '아무도 없는 들판에서 한참 쉬다가 깜빡 잠들었다. 이상한 꿈을 꿨다.', hint: '들판에서 아무도 없을 때 오래오래 쉬면 꿈을 꾼대. 이상한 꿈이래.' },
];
export const secretOf = id => SECRETS.find(s => s.id === id);
export const secretsFound = m => SECRETS.filter(s => m.secrets?.[s.id]).length;

// what the dozing worker dreams about out in the fields (core/run.js): the hidden story, never more
// than a glimpse
export const DREAMS = [
  '꿈속에서 작업복을 입은 들쥐가 반짝 바위를 캐고 있었다. 이쪽을 보더니 손을 흔들었다.',
  '꿈속에서 누가 내 이름을 불렀다. 돌아보니 조합 게시판만 덩그러니 서 있었다.',
  '꿈속에서 일꾼들이 줄지어 땅굴로 들어갔다. 나오는 일꾼은 하나도 없었다.',
  '꿈속에서 들판 친구들이 모닥불에 둘러앉아 조합 출근 노래를 불렀다.',
  '꿈속에서 커다란 가면이 웃었다. 깨어 보니 볼이 젖어 있었다.',
  '꿈속에서 우리 집 문을 두드리는 소리가 났다. 문을 열었더니 명찰 하나만 떨어져 있었다.',
];
