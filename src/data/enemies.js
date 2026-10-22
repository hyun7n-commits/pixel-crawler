// Enemy stats are the base values for the first floor of their zone.
// slow: acts every other turn · fast: moves two tiles per turn
// ranged: aims one turn, then shoots the aimed tile (range in tiles)
// flees: runs away when badly hurt
// peaceful: never starts a fight, but fights back once hit · treasure: drops a chest and gold
// Each roster monster has one thing of its own, shown on the map so you can plan around it:
//   pack: comes in a group of up to this many · splits: a hit splits it in two (fight it in a doorway)
//   thief: a hit steals gold and it runs; catch it to get the gold back · hitAndRun: bites, then backs off
//   bones: bursts into bone shards when it dies, hurting everyone next to it (it rattles when low)
//   charge: lines up, paints a red lane, then rams down it next turn; step aside and it crashes, dizzy
//   blink: teleports away when you get next to it, then aims · stoneSkin: after it attacks it turns to
//   stone for a turn and barely feels hits
// gimmick: not part of a zone's roster; placed by special rooms and grows with the zone (see gimmickScale)
// npc: someone to talk to; bumping into them talks instead of attacking, and they cannot be hurt

export const ENEMIES = {
  rat:      { name: '들쥐',   sprite: 'rat',    hp: 6,  atk: 2, xp: 1, flees: true, pack: 3, tip: '떼로 다닌다.' },
  slime:    { name: '슬라임', sprite: 'slime',  hp: 12, atk: 5, xp: 3, slow: true, splits: true, tip: '느리지만, 때리면 둘로 갈라진다.' },
  goblin:   { name: '도토리 다람쥐', sprite: 'goblin', hp: 10, atk: 4, xp: 4, thief: true, tip: '골드를 훔쳐 달아난다. 잡으면 돌려받는다.' },
  bat:      { name: '박쥐',   sprite: 'bat',    hp: 8,  atk: 4, xp: 4, fast: true, hitAndRun: true, tip: '빠르다. 물고 나면 물러났다가 다시 온다.' },
  skel:     { name: '독버섯', sprite: 'skel',   hp: 15, atk: 5, xp: 6, bones: true, tip: '쓰러지면 부풀었다가 다음 턴에 터진다. 한 걸음 물러나면 안 맞는다.' },
  spider:   { name: '거미',   sprite: 'spider', hp: 9,  atk: 4, xp: 5, ranged: 5, tip: '조준선을 그은 다음 턴에 쏜다. 그 칸에서 벗어나면 피할 수 있다.' },
  knight:   { name: '멧돼지', sprite: 'knight', hp: 23, atk: 6, def: 1, xp: 10, charge: 5, tip: '붉은 길을 그은 다음 돌진한다. 옆으로 비키면 부딪혀 어지러워한다.' },
  wizard:   { name: '여우',   sprite: 'wizard', hp: 12, atk: 6, xp: 9, ranged: 6, blink: true, tip: '조준한 다음 턴에 여우불을 쏜다. 다가가면 둔갑해서 달아난다.' },
  garg:     { name: '공벌레', sprite: 'garg',   hp: 18, atk: 7, xp: 10, fast: true, stoneSkin: true, tip: '때린 다음 턴에는 몸을 동그랗게 말아 거의 다치지 않는다.' },
  turtle:   { name: '반짝 거북', sprite: 'turtle', hp: 26, atk: 5, def: 1, xp: 10, slow: true, peaceful: true, treasure: true,
              tip: '먼저 건드리지 않으면 싸우지 않는다. 튼튼하고 세지만 쓰러뜨리면 보물을 떨군다.' },

  mimic:    { name: '소라게 상자', sprite: 'mimic', hp: 10, atk: 3, xp: 6, treasure: true, gimmick: true,
              tip: '보물 상자에 눌러 사는 소라게. 열려고 하면 집게로 문다. 쓰러뜨리면 진짜 보물을 떨군다.' },
  statue:   { name: '허수아비', sprite: 'statue', hp: 18, atk: 3, def: 1, xp: 10, slow: true, gimmick: true,
              tip: '움직이는 허수아비. 느리지만 튼튼하다.', stoneTip: '보물 상자를 지키듯 서 있는 허수아비다.' },
  wraith:   { name: '화난 청설모', sprite: 'wraith', hp: 8, atk: 3, xp: 4, gimmick: true, tip: '도토리 창고를 파헤쳐서 화가 났다.' },
  thief:    { name: '리본 도둑 들쥐', sprite: 'thief', hp: 14, atk: 3, xp: 8, gimmick: true, quest: true,
              tip: '울보 아기새의 리본을 물고 있다.' },
  ghost:    { name: '울보 아기새', sprite: 'ghostNpc', hp: 1, atk: 0, xp: 0, npc: true, peaceful: true, tip: '말을 걸려면 부딪혀 보자.' },
  smith:    { name: '두더지 대장장이', sprite: 'mole', hp: 1, atk: 0, xp: 0, npc: true, peaceful: true, tip: '말을 걸려면 부딪혀 보자.' },

  ratking:  { name: '왕쥐',          sprite: 'rat',  hp: 45,  atk: 3, xp: 20, boss: true, tip: '가끔 쥐를 불러낸다.' },
  skelking: { name: '버섯 왕',       sprite: 'skel', hp: 100, atk: 6, xp: 30, boss: true, tip: '붉게 표시된 칸을 내려친다. 칸 밖으로 피해야 한다. 내려친 자리엔 꼬마 독버섯이 솟는다.' },
  lord:     { name: '박쥐 대왕', sprite: 'vampLord', hp: 140, atk: 8, xp: 40, boss: true, ranged: 7, tip: '순간이동한 뒤 조준한다. 때리면 체력을 빨아들인다. 반쯤 다치면 화가 나서 박쥐 떼를 부른다.' },
};

// Three floors per zone; the third floor of each zone is the boss.
// `style` picks how the walls and ground are drawn (see scenes/textures.js): hedges on the meadow,
// a line of trees in the deep forest, rock cliffs on the mountain. `void` is the unexplored dark.
export const ZONES = [
  { name: '초원', style: 'meadow', wallName: '산울타리', enemies: ['rat', 'rat', 'slime', 'goblin'], boss: 'ratking', void: '#0c1a10',
    floor: '#92c86a', floorDark: '#7cb458', floorLight: '#acdc86',
    wallTop: '#3a8448', wallLight: '#5aad58', wallFace: '#2c6b3a', wallDark: '#1f5230', wallLine: '#10301c',
    water: '#4a9fc4', waterLight: '#8fd8f0' },
  { name: '깊은숲', style: 'forest', wallName: '큰 나무', enemies: ['bat', 'skel', 'spider', 'goblin'], boss: 'skelking', void: '#08110b',
    floor: '#66683f', floorDark: '#535633', floorLight: '#7d7f4f',
    wallTop: '#2b6638', wallLight: '#46914a', wallFace: '#6b4a2e', wallDark: '#1c4628', wallLine: '#0d1a10',
    water: '#2f6f80', waterLight: '#5fa8b8' },
  { name: '돌산', style: 'rock', wallName: '바위 절벽', enemies: ['knight', 'wizard', 'garg', 'skel'], boss: 'lord', void: '#0f0e14',
    floor: '#a39478', floorDark: '#86795f', floorLight: '#bcae90',
    wallTop: '#81858f', wallLight: '#a9adb6', wallFace: '#6a6e7a', wallDark: '#4c4f5a', wallLine: '#2a2c34',
    water: '#3f86ab', waterLight: '#7cc0dc' },
];
