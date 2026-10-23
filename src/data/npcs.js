// What the quest folk say. They live on one floor each (Run.quests); talking is Run.talk.
//   ghost - a crying baby bird whose ribbon a big field mouse ran off with (floor 1 or 2)
//   smith - a mole blacksmith who hammers a relic up a level for a chunk of the floor's sparkle boulder (floor 4 or 5)
//   peddler - the village shopkeeper, out in the fields with a stall on the floor before each boss (PEDDLER_FLOORS).
//             Gold spent there is gold you don't take home, so it is a real choice (see STALL).

export const PEDDLER_FLOORS = [2, 5, 8];

// What the stall sells; `price` is for the meadow and grows with each zone (Run.genFloor).
export const STALL = {
  potion: { name: '체력 물약', icon: 'potion', price: 35, desc: '체력 물약 하나. 위험할 때 마신다.' },
  bomb:   { name: '폭탄',      icon: 'bomb',   price: 25, desc: '폭탄 하나. 둘레 3x3에 펑!' },
  tools:  { name: '도구 꾸러미', icon: 'toolpouch', price: 40, desc: '들판 도구 두 개. 뭐가 들었는지는 풀어 봐야 안다.' },
  grow:   { name: '유물 손질', icon: 'anvil',  price: 80, desc: '가진 유물 하나를 골라 한 단계 올린다.' },
  box:    { name: '유물 꾸러미', icon: 'bag',  price: 110, desc: '유물 셋 중 하나를 골라 가진다.' },
};

// `greet` opens the talk sheet; it is also said over their head the first time you come near,
// unless a shorter `call` is given for that
export const NPC_TEXT = {
  // a friend locked in a cage (Run.openCage): `call` when you come near, `locked` without the key
  cage: { call: '여기야! 꺼내 줘! 열쇠는 우두머리가 갖고 있어!', locked: '열쇠! 저 왕관 쓴 녀석이 물고 있어!', free: '살았다! 고마워. 마을에서 보자!' },
  ghost: {
    greet: '삐약… 일꾼님…',
    ask: '흐윽… 내 리본을 커다란 들쥐가 물어 갔어. 이 구역 어딘가에 있을 거야. 찾아 주면 내 보물을 나눠 줄게.',
    ok: ['찾아 줄게', '리본 도둑 들쥐를 잡으러 간다.'],
    wait: '리본… 아직이야? 삐약.',
    thanks: '내 리본! 정말 고마워. 약속한 대로 하나 골라 가.',
    bye: '아기새가 리본을 달고 포르르 날아갔다.',
  },
  smith: {
    greet: '어이, 일꾼! 이리 와 봐.',
    ask: '이 구역 반짝 바위를 끝까지 캐서 덩어리를 가져와. 유물 하나를 두드려서 한 단계 올려 주지. 보석 덩어리면 두 개다!',
    ok: ['알았어', '반짝 바위를 끝까지 캐러 간다.'],
    wait: '반짝돌 덩어리는? 끝까지 캐야 나온다.',
    thanks: '좋은 덩어리군! 어느 유물을 두드려 줄까?',
    thanksGem: '이건 보석이잖아! 두 개 두드려 주지.',
    none: '두드릴 유물이 없네. 대신 덩어리 값을 쳐 주지.',
    after: '또 보자고, 일꾼.',
  },
  peddler: {
    call: '어머, 일꾼! 좌판 보고 가!',
    greet: '어머, 일꾼! 들판에서도 장사하지. 보스 앞이니까 단단히 챙겨 가. 여기서 쓴 골드는 마을로 못 가져가는 거 알지?',
    again: '또 왔네! 뭐 줄까?',
    ok: ['그냥 갈게', '좌판을 지나간다.'],
    grow: '어느 유물을 손질해 줄까?',
    box: '꾸러미 안에 이런 게 들었어. 하나 골라!',
    thanks: '고마워! 조심해서 가.',
    empty: '오늘 물건은 다 팔렸어!',
  },
};
