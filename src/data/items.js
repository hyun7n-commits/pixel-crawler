// Consumables. `key` is the keyboard shortcut.
//   throw: picked on the map and thrown (core/run.js throwTool), the rest are used on the spot
//   area: how far round the tile it lands on it reaches (the red square while aiming)
//   foe:  it has to be thrown at a critter
//   tool: one of the 들판 도구 (v0.26), the little meadow things that get you out of a tight spot;
//         each does one thing, the way it would (Shiren's rule: logical, never obscure), and leans on
//         a rule of the fields you already know: a knock, honey, sleep pollen, running away, a bell
// On a phone the potion keeps its own button and the rest sit in the 도구 tray (ui/hud.js).

export const ITEMS = {
  potion:    { name: '체력 물약', sprite: 'potion', key: '1', desc: '체력을 60% 회복한다' },
  bomb:      { name: '폭탄', sprite: 'bomb', key: '2', throw: true, area: 1, desc: '던진 곳과 주변 1칸에 큰 피해. 덤불과 바위도 날려 버린다. 너무 가까우면 나도 맞는다' },
  map:       { name: '지도', sprite: 'map', key: '3', desc: '이 구역 전체와 땅굴 위치를 보여 준다' },
  pinecone:  { name: '솔방울', sprite: 'pinecone', key: '4', throw: true, area: 0, tool: true, desc: '맞은 적은 한 칸 밀려나고 한 턴 어질어질하다. 빈 땅에 던지면 톡 소리에 근처 적이 그쪽을 보러 간다' },
  dandelion: { name: '민들레 홀씨', sprite: 'dandelion', key: '5', tool: true, desc: '후 불면 홀씨에 매달려 이 들판의 먼 곳으로 날아간다. 쫓아오던 적은 나를 놓친다' },
  honeyjar:  { name: '꿀 병', sprite: 'honeyjar', key: '6', throw: true, area: 1, tool: true, desc: '던진 곳과 주변 1칸에 꿀이 쏟아진다. 꿀에 빠진 적은 두 턴 동안 꼼짝 못 한다' },
  sleepy:    { name: '졸음 꽃', sprite: 'sleepflower', key: '7', throw: true, area: 1, tool: true, desc: '던진 곳에 졸음 꽃가루가 퍼진다. 들이마신 적은 잠든다. 너무 가까우면 나도 잠든다' },
  chili:     { name: '매운 고추', sprite: 'chili', key: '8', throw: true, area: 0, foe: true, tool: true, desc: '적에게 던지면 매워서 다섯 턴 동안 허둥지둥 달아난다. 대장은 금방 정신을 차린다' },
  bell:      { name: '방울', sprite: 'bell', key: '9', throw: true, area: 0, tool: true, desc: '던진 곳에서 네 턴 동안 딸랑딸랑 울린다. 나를 못 보는 적은 그리로 간다. 다 울리면 다시 주울 수 있다' },
};

// the meadow tools, in the order they open (data/unlocks.js)
export const TOOLS = Object.keys(ITEMS).filter(id => ITEMS[id].tool);

// What each stage's ground is rich in (Run.pickTool): half the tools lying about are this one once it
// is open. Dandelions on the meadow, pinecones under the forest and the seaside pines (good for
// knocking a crab off the cliff), sleep flowers in the misty marsh and the dim cave, goat bells on the
// rock and in the old union's ruins, honey in the giant garden, chilies on the snow (to keep warm)
// and in the volcano.
export const ZONE_TOOL = {
  meadow: 'dandelion', forest: 'pinecone', marsh: 'sleepy', sea: 'pinecone', rock: 'bell',
  garden: 'honeyjar', snow: 'chili', cave: 'sleepy', volcano: 'chili', ruins: 'bell',
};
