// 갈림길 (v0.26): once it has opened, a field that is not the one before the boss has two burrows on,
// and a little sign by each says what the field past it has, the way Hades shows what waits behind each
// door and Slay the Spire lays its map out ahead: one way is a breather, the other a prize, sometimes
// with a risk to it. The sign is all there is to read, and what it says is exactly what you get.
//   icon: the picture on the sign · sign: what the burrow's tip says lies beyond
//   safe: a breather (one of the two always is)

export const ROUTES = {
  rest:  { icon: 'potion', name: '쉼터', sign: '물약 하나와 산딸기 덤불이 있다', safe: true },
  tools: { icon: 'toolpouch', name: '도구', sign: '들판 도구가 둘 있다', safe: true },
  chest: { icon: 'chest', name: '보물', sign: '보물 상자가 하나 더 있다' },
  candy: { icon: 'candy', name: '별사탕', sign: '별사탕이 하나 있다' },
  gold:  { icon: 'gold', name: '반짝 바위', sign: '반짝 바위가 모두 한 등급 좋다' },
  chief: { icon: 'crown', name: '우두머리', sign: '왕관 쓴 우두머리가 있다. 쓰러뜨리면 좋은 보물 상자를 떨군다' },
  den:   { icon: 'napper', name: '낮잠 방', sign: '녀석들이 상자를 둘러싸고 모여 자는 방이 있다' },
};
