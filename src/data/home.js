// 집 꾸미기: once the guild has given you your house (village.js HOME), gold has one more use, the
// one the story was about from the start. Each piece has its own spot round the house (`at`: the
// tiles it stands on, left to right and top to bottom; the picture is drawn over them, taller ones
// reach up past the top row). Nothing here changes a run: it only makes the place yours, so it can
// soak up gold once the shop is bought out. Pictures are in scenes/home-art.js.

export const DECOR = [
  { id: 'flowers', name: '꽃밭', cost: 400, at: [[31, 29], [32, 29]], desc: '문 옆에 알록달록 꽃을 심는다' },
  { id: 'mailbox', name: '우편함', cost: 700, at: [[34, 29]], desc: '이웃이 가끔 편지를 넣고 간다' },
  { id: 'pots', name: '화분', cost: 1000, at: [[30, 29]], desc: '벽 옆에 작은 화분 둘' },
  { id: 'garden', name: '텃밭', cost: 1500, at: [[37, 25], [38, 25], [37, 26], [38, 26]], desc: '당근과 양배추가 자란다' },
  { id: 'laundry', name: '빨랫줄', cost: 2200, at: [[27, 26], [28, 26], [29, 26]], desc: '작업복이 바람에 펄럭인다' },
  { id: 'bench', name: '나무 벤치', cost: 3000, at: [[37, 28], [38, 28]], desc: '토벌 다녀와서 쉬는 자리' },
  { id: 'dog', name: '강아지 집', cost: 4500, at: [[40, 26]], desc: '강아지 한 마리가 같이 산다' },
  { id: 'statue', name: '반짝돌 조각상', cost: 7000, at: [[40, 28]], desc: '제일 큰 반짝돌을 깎아 세운다' },
  { id: 'swing', name: '그네 나무', cost: 10000, at: [[41, 25], [42, 25]], desc: '마을에서 제일 좋은 그늘' },
];

export const hasDecor = (meta, id) => (meta.home || []).includes(id);
