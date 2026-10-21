// Enemy stats are the base values for the first floor of their zone.
// slow: acts every other turn · fast: moves two tiles per turn
// ranged: aims one turn, then shoots the aimed tile (range in tiles)

export const ENEMIES = {
  rat:      { name: '쥐',     sprite: 'rat',    hp: 4,  atk: 1, xp: 1 },
  slime:    { name: '슬라임', sprite: 'slime',  hp: 9,  atk: 2, xp: 2, slow: true, tip: '느려서 두 턴에 한 번 움직여요.' },
  goblin:   { name: '고블린', sprite: 'goblin', hp: 7,  atk: 2, xp: 3 },
  bat:      { name: '박쥐',   sprite: 'bat',    hp: 6,  atk: 2, xp: 3, fast: true, tip: '한 턴에 두 칸 움직여요.' },
  skel:     { name: '해골',   sprite: 'skel',   hp: 13, atk: 3, xp: 5 },
  spider:   { name: '거미',   sprite: 'spider', hp: 7,  atk: 3, xp: 4, ranged: 5, tip: '조준선을 그은 다음 턴에 쏴요. 그 칸에서 벗어나면 피할 수 있어요.' },
  knight:   { name: '흑기사', sprite: 'knight', hp: 20, atk: 5, def: 1, xp: 8 },
  wizard:   { name: '마법사', sprite: 'wizard', hp: 10, atk: 5, xp: 7, ranged: 6, tip: '조준선을 그은 다음 턴에 쏴요.' },
  garg:     { name: '가고일', sprite: 'garg',   hp: 15, atk: 4, xp: 8, fast: true },

  ratking:  { name: '왕쥐',          sprite: 'rat',  hp: 45,  atk: 3, xp: 20, boss: true, tip: '가끔 쥐를 불러내요.' },
  skelking: { name: '해골 왕',       sprite: 'skel', hp: 80,  atk: 5, xp: 30, boss: true, tip: '붉게 표시된 칸을 내려쳐요. 칸 밖으로 피하세요.' },
  lord:     { name: '뱀파이어 군주', sprite: 'vamp', hp: 120, atk: 6, xp: 40, boss: true, ranged: 7, tip: '순간이동한 뒤 조준해요. 때리면 체력을 빨아들여요.' },
};

// Three floors per zone; the third floor of each zone is the boss.
export const ZONES = [
  { name: '하수도', enemies: ['rat', 'rat', 'slime', 'goblin'], boss: 'ratking',
    floor: '#36463b', floorDark: '#2e3c33', floorLight: '#43574a', wall: '#1c2620', wallTop: '#4d6655', wallLine: '#141b17' },
  { name: '동굴',   enemies: ['bat', 'skel', 'spider', 'goblin'], boss: 'skelking',
    floor: '#463b33', floorDark: '#3b322b', floorLight: '#56493f', wall: '#261f1a', wallTop: '#6b5a48', wallLine: '#1a1511' },
  { name: '성',     enemies: ['knight', 'wizard', 'garg', 'skel'], boss: 'lord',
    floor: '#3a374b', floorDark: '#312e40', floorLight: '#48445c', wall: '#1f1c2c', wallTop: '#5a5675', wallLine: '#15131f' },
];
