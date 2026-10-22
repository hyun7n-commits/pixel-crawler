// Enemy stats are the base values for the first floor of their zone.
// slow: acts every other turn · fast: moves two tiles per turn
// ranged: aims one turn, then shoots the aimed tile (range in tiles)
// flees: runs away when badly hurt
// peaceful: never starts a fight, but fights back once hit · treasure: drops a chest and gold
// gimmick: not part of a zone's roster; placed by special rooms and grows with the zone (see gimmickScale)
// npc: someone to talk to; bumping into them talks instead of attacking, and they cannot be hurt

export const ENEMIES = {
  rat:      { name: '쥐',     sprite: 'rat',    hp: 4,  atk: 2, xp: 1, flees: true },
  slime:    { name: '슬라임', sprite: 'slime',  hp: 9,  atk: 3, xp: 2, slow: true, tip: '느려서 두 턴에 한 번 움직인다.' },
  goblin:   { name: '고블린', sprite: 'goblin', hp: 7,  atk: 3, xp: 3, flees: true },
  bat:      { name: '박쥐',   sprite: 'bat',    hp: 6,  atk: 3, xp: 3, fast: true, flees: true, tip: '한 턴에 두 칸 움직인다.' },
  skel:     { name: '해골',   sprite: 'skel',   hp: 13, atk: 3, xp: 5 },
  spider:   { name: '거미',   sprite: 'spider', hp: 7,  atk: 3, xp: 4, ranged: 5, tip: '조준선을 그은 다음 턴에 쏜다. 그 칸에서 벗어나면 피할 수 있다.' },
  knight:   { name: '흑기사', sprite: 'knight', hp: 20, atk: 5, def: 1, xp: 8 },
  wizard:   { name: '마법사', sprite: 'wizard', hp: 10, atk: 5, xp: 7, ranged: 6, tip: '조준선을 그은 다음 턴에 쏜다.' },
  garg:     { name: '가고일', sprite: 'garg',   hp: 15, atk: 4, xp: 8, fast: true },
  turtle:   { name: '광석 거북', sprite: 'turtle', hp: 26, atk: 5, def: 1, xp: 10, slow: true, peaceful: true, treasure: true,
              tip: '먼저 건드리지 않으면 싸우지 않는다. 튼튼하고 세지만 쓰러뜨리면 보물을 떨군다.' },

  mimic:    { name: '미믹', sprite: 'mimic', hp: 10, atk: 3, xp: 6, treasure: true, gimmick: true,
              tip: '보물 상자인 척하다가 문다. 쓰러뜨리면 진짜 보물을 떨군다.' },
  statue:   { name: '광부 석상', sprite: 'statue', hp: 18, atk: 3, def: 1, xp: 10, slow: true, gimmick: true,
              tip: '깨어난 석상. 느리지만 튼튼하다.', stoneTip: '보물 상자를 지키듯 서 있는 석상이다.' },
  wraith:   { name: '원혼', sprite: 'wraith', hp: 8, atk: 3, xp: 4, gimmick: true, tip: '무덤을 파헤쳐서 깨어났다.' },
  thief:    { name: '목걸이 도둑 쥐', sprite: 'thief', hp: 14, atk: 3, xp: 8, gimmick: true, quest: true,
              tip: '유령 광부의 반짝돌 목걸이를 물고 있다.' },
  ghost:    { name: '유령 광부', sprite: 'ghostNpc', hp: 1, atk: 0, xp: 0, npc: true, peaceful: true, tip: '말을 걸려면 부딪혀 보자.' },
  smith:    { name: '두더지 대장장이', sprite: 'mole', hp: 1, atk: 0, xp: 0, npc: true, peaceful: true, tip: '말을 걸려면 부딪혀 보자.' },

  ratking:  { name: '왕쥐',          sprite: 'rat',  hp: 45,  atk: 3, xp: 20, boss: true, tip: '가끔 쥐를 불러낸다.' },
  skelking: { name: '해골 왕',       sprite: 'skel', hp: 80,  atk: 5, xp: 30, boss: true, tip: '붉게 표시된 칸을 내려친다. 칸 밖으로 피해야 한다.' },
  lord:     { name: '뱀파이어 군주', sprite: 'vampLord', hp: 120, atk: 6, xp: 40, boss: true, ranged: 7, tip: '순간이동한 뒤 조준한다. 때리면 체력을 빨아들인다.' },
};

// Three floors per zone; the third floor of each zone is the boss.
export const ZONES = [
  { name: '얕은 갱도', enemies: ['rat', 'rat', 'slime', 'goblin'], boss: 'ratking',
    floor: '#4a3d33', floorDark: '#3d322a', floorLight: '#5a4b3f', wall: '#241c17', wallTop: '#6e5a47', wallLine: '#17110d',
    water: '#2f5d78', waterLight: '#4f86a3' },
  { name: '수정 동굴', enemies: ['bat', 'skel', 'spider', 'goblin'], boss: 'skelking',
    floor: '#343f4f', floorDark: '#2b3442', floorLight: '#425066', wall: '#181e28', wallTop: '#4f5f7a', wallLine: '#10141b',
    water: '#2a5f80', waterLight: '#4c90b5' },
  { name: '옛 마을 유적', enemies: ['knight', 'wizard', 'garg', 'skel'], boss: 'lord',
    floor: '#3a374b', floorDark: '#312e40', floorLight: '#48445c', wall: '#1f1c2c', wallTop: '#5a5675', wallLine: '#15131f',
    water: '#33507a', waterLight: '#5577a8' },
];
