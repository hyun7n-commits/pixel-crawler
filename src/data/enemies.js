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
// swarm: bees of the honey stump (map.hive); anger one and every one awake comes, and they all go
//   home once you are far enough from the stump
// screams: a screaming root pulled from a weed patch; it never fights, only runs off yelling (every
//   critter nearby hears it) until it is caught or digs back in (ai.js scream)
// arenas: the boss room shapes this boss may get (core/dungeon.js carveArena)
// npc: someone to talk to; bumping into them talks instead of attacking, and they cannot be hurt
// The marsh and the cave (v0.21):
//   tongue: lines up a few tiles off, aims, and next turn pulls you right up to it if you stayed put
//   lurk: waits under the water as a few bubbles and bites whoever walks past (ai.js lurk)
//   grab: a pinch holds you for a turn; you can still hit back, not walk away
//   regen: heals this much every turn it is left alone · shade: melts into the dark farther than
//   this many tiles · spiky: hitting it pricks you for this much
// cage: a friend locked in a cage (the friend's id is the enemy's `friend`, and they are drawn as
//   themselves); the crowned 우두머리 of the field carries its key (Run.openCage)

const CAGE_TIP = '우리에 누가 갇혀 있다. 열쇠는 왕관 쓴 우두머리가 물고 있다.';

export const ENEMIES = {
  rat:      { name: '들쥐',   sprite: 'rat',    hp: 6,  atk: 2, xp: 1, flees: true, pack: 3, tip: '떼로 다닌다.' },
  slime:    { name: '슬라임', sprite: 'slime',  hp: 12, atk: 4, xp: 3, slow: true, splits: true, tip: '느리지만, 때리면 둘로 갈라진다.' },
  goblin:   { name: '도토리 다람쥐', sprite: 'goblin', hp: 10, atk: 4, xp: 4, thief: true, tip: '골드를 훔쳐 달아난다. 잡으면 돌려받는다.' },
  bat:      { name: '박쥐',   sprite: 'bat',    hp: 8,  atk: 4, xp: 4, fast: true, hitAndRun: true, tip: '빠르다. 물고 나면 물러났다가 다시 온다.' },
  skel:     { name: '독버섯', sprite: 'skel',   hp: 15, atk: 5, xp: 6, bones: true, tip: '쓰러지면 부풀었다가 다음 턴에 터진다. 한 걸음 물러나면 안 맞는다.' },
  spider:   { name: '거미',   sprite: 'spider', hp: 9,  atk: 4, xp: 5, ranged: 5, tip: '조준선을 그은 다음 턴에 쏜다. 그 칸에서 벗어나면 피할 수 있다.' },
  knight:   { name: '멧돼지', sprite: 'knight', hp: 23, atk: 6, def: 1, xp: 10, charge: 5, tip: '붉은 길을 그은 다음 돌진한다. 옆으로 비키면 부딪혀 어지러워한다.' },
  wizard:   { name: '여우',   sprite: 'wizard', hp: 12, atk: 6, xp: 9, ranged: 6, blink: true, tip: '조준한 다음 턴에 여우불을 쏜다. 다가가면 둔갑해서 달아난다.' },
  garg:     { name: '공벌레', sprite: 'garg',   hp: 18, atk: 7, xp: 10, fast: true, stoneSkin: true, tip: '때린 다음 턴에는 몸을 동그랗게 말아 거의 다치지 않는다.' },
  frog:     { name: '개구리', sprite: 'frog', hp: 12, atk: 5, xp: 7, tongue: 4,
              tip: '혀를 겨눈 다음 턴에 쭉 뻗어서 나를 끌어당긴다. 그 칸에서 비키면 헛친다.' },
  beetle:   { name: '물방개', sprite: 'beetle', hp: 13, atk: 6, xp: 8, lurk: true,
              tip: '물속에 숨어 있다가 옆을 지나가면 덥석 문다. 물 위에 이는 거품을 잘 보자.' },
  crab:     { name: '참게', sprite: 'crab', hp: 17, atk: 5, def: 1, xp: 9, grab: true,
              tip: '집게에 물리면 한 턴 동안 못 걸어간다. 붙잡힌 채로 때릴 수는 있다.' },
  axolotl:  { name: '우파루파', sprite: 'axolotl', hp: 16, atk: 6, xp: 9, regen: 2,
              tip: '맞지 않는 턴마다 상처가 아문다. 한 번에 몰아붙이자.' },
  shadecat: { name: '그림자 고양이', sprite: 'shadecat', hp: 13, atk: 7, xp: 10, shade: 2,
              tip: '두 칸보다 멀리 있으면 어둠에 녹아서 안 보인다.' },
  crystalhog: { name: '수정 고슴도치', sprite: 'crystalhog', hp: 20, atk: 6, def: 2, xp: 11, spiky: 3,
              tip: '수정 가시가 돋아서 때리면 나도 따끔하다. 폭탄이나 떨어지는 돌로 상대하자.' },
  turtle:   { name: '반짝 거북', sprite: 'turtle', hp: 26, atk: 5, def: 1, xp: 10, slow: true, peaceful: true, treasure: true,
              tip: '먼저 건드리지 않으면 싸우지 않는다. 튼튼하고 세지만 쓰러뜨리면 보물을 떨군다.' },

  mimic:    { name: '소라게 상자', sprite: 'mimic', hp: 10, atk: 3, xp: 6, treasure: true, gimmick: true,
              tip: '보물 상자에 눌러 사는 소라게. 열려고 하면 집게로 문다. 쓰러뜨리면 진짜 보물을 떨군다.' },
  statue:   { name: '허수아비', sprite: 'statue', hp: 18, atk: 3, def: 1, xp: 10, slow: true, gimmick: true,
              tip: '움직이는 허수아비. 느리지만 튼튼하다.', stoneTip: '보물 상자를 지키듯 서 있는 허수아비다.' },
  wraith:   { name: '화난 청설모', sprite: 'wraith', hp: 8, atk: 3, xp: 4, gimmick: true, tip: '도토리 창고를 파헤쳐서 화가 났다.' },
  thief:    { name: '리본 도둑 들쥐', sprite: 'thief', hp: 14, atk: 3, xp: 8, gimmick: true, quest: true,
              tip: '울보 아기새의 리본을 물고 있다.' },
  root:     { name: '비명 뿌리', sprite: 'root', hp: 3, atk: 0, xp: 2, screams: true, gimmick: true,
              tip: '풀밭에 숨어 있다가 뽑히면 꺄아아 소리치며 달아난다. 그 소리에 적이 몰려온다. 잡으면 조용해지고, 놔두면 잠시 뒤 땅속으로 숨는다.' },
  bee:      { name: '꿀벌', sprite: 'bee', hp: 4, atk: 1, xp: 1, fast: true, peaceful: true, swarm: true, gimmick: true,
              tip: '벌집 둘레를 윙윙 맴돈다. 벌집이나 벌을 건드리면 떼로 덤비지만, 멀리 달아나면 집으로 돌아간다.' },
  ghost:    { name: '울보 아기새', sprite: 'ghostNpc', hp: 1, atk: 0, xp: 0, npc: true, peaceful: true, tip: '말을 걸려면 부딪혀 보자.' },
  smith:    { name: '두더지 대장장이', sprite: 'mole', hp: 1, atk: 0, xp: 0, npc: true, peaceful: true, tip: '말을 걸려면 부딪혀 보자.' },
  cage:     { name: '갇힌 친구', sprite: 'rogue', hp: 1, atk: 0, xp: 0, npc: true, peaceful: true, tip: CAGE_TIP },
  peddler:  { name: '상점 주인', sprite: 'peddler', hp: 1, atk: 0, xp: 0, npc: true, peaceful: true, tip: '보스 앞에 좌판을 폈다. 부딪히면 물건을 판다. 여기서 쓴 골드는 마을로 못 가져간다.' },

  ratking:  { name: '왕쥐',          sprite: 'rat',  hp: 45,  atk: 3, xp: 20, boss: true, arenas: ['grove', 'pillars'], intro: '찍찍! 이 들판은 내 거다!', tip: '가끔 쥐를 불러낸다.' },
  skelking: { name: '버섯 왕',       sprite: 'skel', hp: 90, atk: 6, xp: 30, boss: true, arenas: ['ring', 'grove'], intro: '포자 냄새 좋지? 후후후…', tip: '붉게 표시된 칸을 내려친다. 칸 밖으로 피해야 한다. 내려친 자리엔 꼬마 독버섯이 솟는다.' },
  toadking: { name: '개굴 대왕', sprite: 'toadking', hp: 100, atk: 7, xp: 35, boss: true, arenas: ['pond'], tongue: 6, intro: '개굴! 내 늪에서 첨벙대는 게 누구냐!',
              tip: '물속으로 잠수했다가 물결이 이는 곳에서 튀어나와 둘레를 덮친다. 붉은 칸에서 벗어나자. 혀로 끌어당기기도 한다.' },
  boarchief: { name: '멧돼지 대장', sprite: 'boarchief', hp: 115, atk: 8, def: 1, xp: 40, boss: true, arenas: ['lanes', 'pillars'], charge: 9, intro: '쿵! 쿵! 내 산에서 나가라!',
              tip: '붉은 길을 그은 다음 끝까지 돌진한다. 비키면 벽에 박고 어지러워하는데, 그 충격에 천장에서 돌이 떨어진다.' },
  lord:     { name: '박쥐 대왕', sprite: 'vampLord', hp: 130, atk: 8, xp: 45, boss: true, arenas: ['cavern', 'ring'], ranged: 7, intro: '밤마다 들판이 왜 뒤척였는지 궁금했지?', tip: '순간이동한 뒤 조준한다. 때리면 체력을 빨아들인다. 반쯤 다치면 화가 나서 박쥐 떼를 부른다.' },
};

// Five zones, one per stage (data/stages.js); FLOORS_PER_ZONE fields each, the last one the boss.
// `style` picks how the walls and ground are drawn (see art/tiles.js): hedges on the meadow,
// a line of trees in the deep forest, reeds in the marsh, rock cliffs on the mountain, crystal-flecked
// rock in the cave. `void` is the unexplored dark around a field, a deep blue like still water.
// Colours: floor (and its dark and light flecks), the wall's top (with its light and dark), the
// wall's front face, and the water.
export const VILLAGE_GROUND = { name: '마을', style: 'meadow', void: '#2b4a5c',
  floor: '#afdc72', floorDark: '#95c85e', floorLight: '#c8ea94',
  wallTop: '#62bd5c', wallLight: '#8ad76e', wallFace: '#4c9c4c', wallDark: '#3b8044', wallLine: '#4a2a3c',
  water: '#7ccfec', waterLight: '#c8f1fb' };

export const ZONES = [
  { name: '초원', style: 'meadow', wallName: '산울타리', enemies: ['rat', 'rat', 'slime', 'goblin'], boss: 'ratking', void: '#2b4a5c',
    floor: '#a6d46a', floorDark: '#8cc157', floorLight: '#c2e58c',
    wallTop: '#5cb85a', wallLight: '#84d26a', wallFace: '#489a4a', wallDark: '#387d40', wallLine: '#4a2a3c',
    water: '#78cdea', waterLight: '#c4f0fa' },
  { name: '깊은숲', style: 'forest', wallName: '큰 나무', enemies: ['bat', 'skel', 'spider', 'goblin'], boss: 'skelking', void: '#203f45',
    floor: '#93b862', floorDark: '#7ca24f', floorLight: '#afcd7c',
    wallTop: '#3f9c66', wallLight: '#62bd76', wallFace: '#93623f', wallDark: '#2b6a4c', wallLine: '#4a2a3c',
    water: '#62c0d8', waterLight: '#c0ebf5' },
  { name: '반딧불 늪', style: 'marsh', wallName: '갈대숲', enemies: ['frog', 'frog', 'beetle', 'crab'], boss: 'toadking', void: '#1f3a44',
    floor: '#9cba78', floorDark: '#84a463', floorLight: '#b8d094',
    wallTop: '#b2c35e', wallLight: '#d3df84', wallFace: '#869b45', wallDark: '#62793a', wallLine: '#4a2a3c',
    water: '#5fbcc2', waterLight: '#bdeee8' },
  { name: '돌산', style: 'rock', wallName: '바위 절벽', enemies: ['knight', 'wizard', 'garg', 'skel'], boss: 'boarchief', void: '#2c3048',
    floor: '#dccbaa', floorDark: '#c5b28d', floorLight: '#ecdfc5',
    wallTop: '#b5aec6', wallLight: '#d4cfde', wallFace: '#8f88a4', wallDark: '#6f6887', wallLine: '#4a2a3c',
    water: '#6cb9df', waterLight: '#c4ecfa' },
  { name: '박쥐 동굴', style: 'cave', wallName: '동굴 벽', enemies: ['bat', 'axolotl', 'shadecat', 'crystalhog'], boss: 'lord', void: '#191630',
    floor: '#9088aa', floorDark: '#7b7396', floorLight: '#a8a0bf',
    wallTop: '#615784', wallLight: '#7d73a3', wallFace: '#493f69', wallDark: '#372f55', wallLine: '#4a2a3c',
    water: '#5b90d2', waterLight: '#aad1f5' },
];
