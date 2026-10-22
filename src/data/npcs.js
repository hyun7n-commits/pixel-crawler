// What the quest folk say. They live on one floor each (Run.quests); talking is Run.talk.
//   ghost - a sad little ghost whose necklace a big rat ran off with (floor 1 or 2)
//   smith - a mole blacksmith who hammers a relic up a level for a chunk of the floor's sparkle boulder (floor 4 or 5)

export const NPC_TEXT = {
  ghost: {
    greet: '저기… 일꾼님…',
    ask: '흐윽… 내 반짝돌 목걸이를 커다란 쥐가 물어 갔어. 이 구역 어딘가에 있을 거야. 찾아 주면 내 보물을 나눠 줄게.',
    ok: ['찾아 줄게', '목걸이 도둑 쥐를 잡으러 간다.'],
    wait: '목걸이… 아직이야?',
    thanks: '내 목걸이! 정말 고마워. 약속한 대로 하나 골라 가.',
    bye: '꼬마 유령이 웃으며 사라졌다.',
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
};
