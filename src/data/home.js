// 집 꾸미기: once the guild has given you your house (village.js HOME), gold has one more use, the
// one the story was about from the start. Each piece has its own spot round the house (`at`: the
// tiles it stands on, left to right and top to bottom; the picture is drawn over them, taller ones
// reach up past the top row). Nothing here changes a run: it only makes the place yours, so it can
// soak up gold once the shop is bought out. Pictures are in scenes/home-art.js.

export const DECOR = [
  { id: 'flowers', name: '꽃밭', cost: 800, at: [[31, 29], [32, 29]], desc: '문 옆에 알록달록 꽃을 심는다' },
  { id: 'mailbox', name: '우편함', cost: 1400, at: [[34, 29]], desc: '이웃이 가끔 편지를 넣고 간다' },
  { id: 'pots', name: '화분', cost: 2000, at: [[30, 29]], desc: '벽 옆에 작은 화분 둘' },
  { id: 'garden', name: '텃밭', cost: 3000, at: [[37, 25], [38, 25], [37, 26], [38, 26]], desc: '당근과 양배추가 자란다' },
  { id: 'laundry', name: '빨랫줄', cost: 4400, at: [[27, 26], [28, 26], [29, 26]], desc: '작업복이 바람에 펄럭인다' },
  { id: 'bench', name: '나무 벤치', cost: 6000, at: [[37, 28], [38, 28]], desc: '탐험 다녀와서 쉬는 자리' },
  { id: 'dog', name: '강아지 집', cost: 9000, at: [[40, 26]], desc: '강아지 한 마리가 같이 산다' },
  { id: 'statue', name: '반짝돌 조각상', cost: 14000, at: [[40, 28]], desc: '제일 큰 반짝돌을 깎아 세운다' },
  { id: 'swing', name: '그네 나무', cost: 20000, at: [[41, 25], [42, 25]], desc: '마을에서 제일 좋은 그늘' },
];

export const hasDecor = (meta, id) => (meta.home || []).includes(id);

// With a mailbox, a letter is sometimes waiting when you come home from the fields (a '!' bobs over
// the box); bump the box to read it. Only from villagers who live here; `if` narrows it further.
export const LETTERS = [
  { from: 'neighbor', text: '집들이 언제 해? 케이크 구워 갈게! 이번엔 꼭 불러 줘.' },
  { from: 'neighbor', text: '너네 강아지가 우리 집 꽃밭에서 낮잠 잤어. 너무 귀여워서 그냥 뒀어!', if: m => hasDecor(m, 'dog') },
  { from: 'neighbor', text: '빨랫줄에 널린 작업복 봤어. 구멍 난 데 있던데? 다음에 꿰매 줄게.', if: m => hasDecor(m, 'laundry') },
  { from: 'shop', text: '단골 손님께. 요즘 반짝돌 시세가 좋아. 많이 캐 와! 덤도 챙겨 줄게.' },
  { from: 'shop', text: '텃밭 당근 남으면 가게에 좀 팔아 줘. 손님들이 찾더라고.', if: m => hasDecor(m, 'garden') },
  { from: 'smith', text: '밤새 망치 소리 시끄러웠으면 미안. 대신 다음엔 더 좋은 유물을 손봐 줄게.' },
  { from: 'smith', text: '조각상 봤다. 반짝돌 결을 잘 살렸더군. 누가 깎았는지 몰라도 솜씨가 좋아.', if: m => hasDecor(m, 'statue') },
  { from: 'rescue', text: '무리하지 마. 쓰러지면 또 업어 와야 하잖아. …그래도 언제든 부르고.' },
  { from: 'rival', text: '흥, 집 좀 생겼다고 방심하지 마. 다음엔 내가 더 멀리 간다!' },
  { from: 'rival', text: '그네… 한 번만 타 봐도 돼? 아, 아니야. 잊어버려.', if: m => hasDecor(m, 'swing') },
  { from: 'guild', text: '자네 덕에 들판이 한결 조용해졌네. 조합 일당은 늘 고맙게 생각하고 있어.' },
];
