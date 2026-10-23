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

  // v0.23: the five new stages' critters, and new ones so no stage shares a critter with another
  hopper:   { name: '메뚜기', sprite: 'hopper', hp: 7, atk: 3, xp: 2, hops: true,
              tip: '두 칸씩 통통 뛰어서 순식간에 다가온다. 한 대 치고 나면 저만치 뛰어 달아난다.' },
  woodpecker: { name: '딱따구리', sprite: 'woodpecker', hp: 11, atk: 3, xp: 6, drill: true,
              tip: '한 번에 두 번씩 콕콕 쫀다. 나무를 쪼아 구멍을 뚫는데, 그 소리에 근처 적이 깬다.' },
  snail:    { name: '달팽이', sprite: 'snail', hp: 17, atk: 5, def: 2, xp: 7, slow: true, slimy: true,
              tip: '느리고 껍데기가 단단하다. 지나간 자리에 점액을 남기는데, 밟으면 한 칸 더 미끄러진다.' },
  gull:     { name: '갈매기', sprite: 'gull', hp: 11, atk: 5, xp: 7, flies: true, dive: 4,
              tip: '날아다녀서 낭떠러지도 그냥 넘는다. 내 자리에 그림자를 찍고, 다음 턴에 내리꽂는다. 그 칸에서 비키면 헛친다.' },
  hermit:   { name: '소라게', sprite: 'hermit', hp: 16, atk: 5, def: 1, xp: 8, shell: true,
              tip: '맞으면 껍데기 속에 쏙 숨어서 두 턴 동안 거의 안 다친다. 반쯤 다치면 껍데기를 버리고 맨몸으로 후다닥 달아난다.' },
  jelly:    { name: '해파리', sprite: 'jelly', hp: 9, atk: 4, xp: 6, flies: true, drift: true, sting: true,
              tip: '바람 따라 둥실둥실 떠다닐 뿐 쫓아오지는 않는다. 닿으면 찌릿해서 한 턴 동안 몸이 굳는다. 때려도 찌릿하다.' },
  dungbeetle: { name: '쇠똥구리', sprite: 'dungbeetle', hp: 19, atk: 6, xp: 10, ball: 6,
              tip: '나와 일직선이 되면 길을 그은 다음 커다란 공을 굴려 보낸다. 공은 처음 부딪힌 누구든 아프게 한다. 적끼리도.' },
  ladybug:  { name: '무당벌레', sprite: 'ladybug', hp: 15, atk: 6, xp: 9, playDead: true,
              tip: '쓰러지면 발랑 뒤집혀 죽은 척한다. 그냥 지나가면 벌떡 일어나 쫓아온다. 확실히 한 대 더!' },
  butterfly: { name: '나비', sprite: 'butterfly', hp: 11, atk: 4, xp: 8, flies: true, pollen: 3,
              tip: '팔랑팔랑 날갯짓할 때마다 졸음 가루가 흩날린다. 옆에서 오래 싸우면 꾸벅꾸벅 존다.' },
  mantis:   { name: '사마귀', sprite: 'mantis', hp: 17, atk: 8, xp: 10, reach: 2, still: true,
              tip: '두 손을 모으고 가만히 서 있다. 일직선으로 두 칸 안에 들어오면 낫을 쓱 뻗는다.' },
  snowhare: { name: '눈토끼', sprite: 'snowhare', hp: 13, atk: 7, xp: 10, burrow: true,
              tip: '눈 속으로 파고들어 안 보이게 다가와서 바로 옆에서 튀어나온다. 눈 무더기가 꿈틀대면 조심.' },
  snowman:  { name: '눈사람', sprite: 'snowman', hp: 20, atk: 6, xp: 10, ranged: 5, still: true, knock: true, head: true,
              tip: '꼼짝 않고 눈덩이를 던진다. 맞으면 한 칸 밀려난다. 쓰러뜨리면 머리가 데굴데굴 굴러가서 계속 던진다!' },
  snowhead: { name: '눈사람 머리', sprite: 'snowhead', hp: 7, atk: 5, xp: 4, ranged: 4, knock: true, gimmick: true,
              tip: '몸을 잃은 눈사람 머리. 데굴데굴 굴러다니며 눈덩이를 던진다.' },
  seal:     { name: '물범', sprite: 'seal', hp: 23, atk: 7, xp: 11, slide: 7,
              tip: '눈밭에서는 느릿느릿 기지만, 얼음 위에서 나와 일직선이 되면 배로 쭉 미끄러져 들이받는다. 옆으로 비키자.' },
  salamander: { name: '불도마뱀', sprite: 'salamander', hp: 18, atk: 7, xp: 11, fireTrail: true, fireproof: true,
              tip: '지나간 자리에 불이 붙는다. 자기는 불에 안 탄다. 불붙은 데서 싸우지 말자.' },
  coal:     { name: '숯덩이', sprite: 'coal', hp: 26, atk: 7, def: 2, xp: 12, coal: true, fireproof: true,
              tip: '가만히 있으면 그냥 숯덩이처럼 보인다. 불이 닿으면 활활 타올라 빠르고 사나워지지만, 다 타면 재가 된다.' },
  moth:     { name: '불나방', sprite: 'moth', hp: 10, atk: 5, xp: 8, flies: true, lantern: true, fireproof: true,
              tip: '등불만 보면 어디서든 날아온다. 잠도 안 잔다. 쓰러지면 둘레에 불똥이 튄다.' },
  lostkid:  { name: '길 잃은 꼬마', sprite: 'lostkid', hp: 20, atk: 11, xp: 14, twist: true,
              tip: '훌쩍훌쩍 울고 있다. 길을 잃었나 보다.', twistTip: '입이 귀까지 찢어졌다! 이빨이 잔뜩 났다.' },
  maskman:  { name: '가면 일꾼', sprite: 'maskman', hp: 22, atk: 8, xp: 13, mirror: true,
              tip: '조합 가면을 쓴 일꾼. 내가 움직이면 거울처럼 똑같이 움직이고, 가만히 있으면 저도 가만히 있다.' },
  armor:    { name: '빈 갑옷', sprite: 'armor', hp: 25, atk: 9, def: 2, xp: 14, reform: 3,
              tip: '속이 텅 빈 갑옷. 쓰러뜨려도 세 턴 뒤 다시 맞춰진다. 흩어진 조각을 한 대 더 쳐서 흩어 놓아야 끝난다.' },
  armorpile: { name: '갑옷 조각', sprite: 'armorpile', hp: 1, atk: 0, xp: 0, gimmick: true, inert: true,
              tip: '흩어진 갑옷 조각. 덜그럭덜그럭 다시 맞춰지려 한다. 한 대 치면 흩어진다.' },

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
  octopus:  { name: '대왕 문어', sprite: 'octopus', hp: 105, atk: 7, xp: 38, boss: true, arenas: ['pond'], intro: '바다는 넓은데 왜 하필 여기로 왔니?',
              tip: '다리로 붉은 칸을 내려친다. 칸 밖으로 피하자. 크게 다치면 먹물을 뿜어 둘레를 깜깜하게 만든다.' },
  queen:    { name: '여왕벌', sprite: 'queen', hp: 120, atk: 7, xp: 42, boss: true, fast: true, arenas: ['grove', 'ring'], intro: '윙- 내 꽃밭에 발을 들였구나.',
              tip: '빠르다. 몇 턴마다 꿀벌을 부른다. 꿀을 흘려서 밟으면 한 턴 끈적하게 붙는다.' },
  yeti:     { name: '설인', sprite: 'yeti', hp: 135, atk: 8, def: 1, xp: 45, boss: true, arenas: ['lanes', 'pillars'], charge: 8, intro: '우오오… 춥지? 나도 추워.',
              tip: '붉은 길을 그은 다음 돌진한다. 비키면 벽에 박고, 그 충격에 고드름이 떨어진다. 얼음 위에서는 더 멀리 미끄러진다.' },
  lavaturtle: { name: '용암 거북', sprite: 'lavaturtle', hp: 150, atk: 8, def: 2, xp: 50, boss: true, slow: true, fireproof: true, arenas: ['cavern', 'pillars'], intro: '…뜨겁다. 너도 곧 뜨거워질 거다.',
              tip: '느리지만 단단하다. 몇 턴마다 줄을 그어 불을 뿜는다. 불길이 남으니 조심. 용암에 들어가면 상처가 아문다.' },
  bigmask:  { name: '큰 가면', sprite: 'bigmask', hp: 165, atk: 9, xp: 60, boss: true, arenas: ['ring', 'cavern'], ranged: 7, intro: '…일은 끝났나? 그럼 이제 쉬어도 된다.',
              tip: '순간이동해서 조준한다. 반쯤 다치면 가면 일꾼들을 부른다. 가면 뒤에 뭐가 있는지는 아무도 모른다.' },
  lord:     { name: '박쥐 대왕', sprite: 'vampLord', hp: 130, atk: 8, xp: 45, boss: true, arenas: ['cavern', 'ring'], ranged: 7, intro: '밤마다 들판이 왜 뒤척였는지 궁금했지?', tip: '순간이동한 뒤 조준한다. 때리면 체력을 빨아들인다. 반쯤 다치면 화가 나서 박쥐 떼를 부른다.' },
};

// Ten zones, one per stage (data/stages.js); FLOORS_PER_ZONE fields each, the last one the boss.
// `style` picks how the walls and ground are drawn (see scenes/textures.js): hedges on the meadow,
// a line of trees in the deep forest, reeds in the marsh, sea cliffs by the shore, rock cliffs on the
// mountain, giant stalks in the flower garden, snowy rocks on the plateau, crystal-flecked rock in the
// cave, black basalt on the volcano, crumbling brick in the old guild ruins. `void` is the unexplored dark.
// No critter turns up in two stages: every stage is its own lot of them.
// `wet`: what lies in its pools (lava burns, ice slides); `chasm`: drops you can fall down.
// The village keeps the bright daytime green: home is where it is light; the fields are walked at night.
export const VILLAGE_GROUND = { name: '마을', style: 'meadow', day: true, void: '#0c1a10',
  floor: '#92c86a', floorDark: '#7cb458', floorLight: '#acdc86',
  wallTop: '#3a8448', wallLight: '#5aad58', wallFace: '#2c6b3a', wallDark: '#1f5230', wallLine: '#10301c',
  water: '#4a9fc4', waterLight: '#8fd8f0' };

export const ZONES = [
  { name: '초원', style: 'meadow', wallName: '산울타리', enemies: ['rat', 'slime', 'goblin', 'hopper'], boss: 'ratking', void: '#07090a',
    floor: '#61774a', floorDark: '#536840', floorLight: '#728a57',
    wallTop: '#34573a', wallLight: '#4b7549', wallFace: '#28452d', wallDark: '#1b3221', wallLine: '#0b160e',
    water: '#33627c', waterLight: '#6b9db5' },
  { name: '깊은숲', style: 'forest', wallName: '큰 나무', enemies: ['skel', 'spider', 'woodpecker', 'snail'], boss: 'skelking', void: '#050706',
    floor: '#4f4f36', floorDark: '#42422d', floorLight: '#5e5f42',
    wallTop: '#244530', wallLight: '#346440', wallFace: '#4d3a26', wallDark: '#16301d', wallLine: '#070d08',
    water: '#26505c', waterLight: '#4e8592' },
  { name: '반딧불 늪', style: 'marsh', wallName: '갈대숲', enemies: ['frog', 'frog', 'beetle', 'crab'], boss: 'toadking', void: '#050807',
    floor: '#46553f', floorDark: '#3a4834', floorLight: '#56664b',
    wallTop: '#5d6b35', wallLight: '#808f46', wallFace: '#3c4826', wallDark: '#283119', wallLine: '#0a0f07',
    water: '#28504b', waterLight: '#5d917f' },
  { name: '바닷가 절벽', style: 'sea', wallName: '바다 절벽', enemies: ['gull', 'hermit', 'hermit', 'jelly'], boss: 'octopus', void: '#04070b', chasm: true,
    floor: '#827759', floorDark: '#71674c', floorLight: '#94896a',
    wallTop: '#858172', wallLight: '#a9a48f', wallFace: '#716656', wallDark: '#4b4239', wallLine: '#15110f',
    water: '#2a6688', waterLight: '#7cc0dc' },
  { name: '돌산', style: 'rock', wallName: '바위 절벽', enemies: ['knight', 'wizard', 'garg', 'dungbeetle'], boss: 'boarchief', void: '#09090c',
    floor: '#6f6857', floorDark: '#5e5849', floorLight: '#807967',
    wallTop: '#5c6068', wallLight: '#767a84', wallFace: '#484b54', wallDark: '#33353d', wallLine: '#18191e',
    water: '#2f5b75', waterLight: '#5e8ca8' },
  { name: '거인 꽃밭', style: 'garden', wallName: '거인 꽃대', enemies: ['ladybug', 'ladybug', 'butterfly', 'mantis'], boss: 'queen', void: '#070908',
    floor: '#5a6445', floorDark: '#4c553a', floorLight: '#6a7550',
    wallTop: '#3f6b3f', wallLight: '#5c8c52', wallFace: '#4d7442', wallDark: '#27452b', wallLine: '#0b140c',
    water: '#33637a', waterLight: '#80bcd6' },
  { name: '눈 고원', style: 'snow', wallName: '눈 덮인 바위', enemies: ['snowhare', 'snowman', 'seal', 'seal'], boss: 'yeti', void: '#080a10', wet: 'ice',
    floor: '#9aa3b2', floorDark: '#878fa0', floorLight: '#adb6c4',
    wallTop: '#c3cbd8', wallLight: '#dbe3ee', wallFace: '#5a6272', wallDark: '#3b4150', wallLine: '#14161c',
    water: '#7397b3', waterLight: '#c4e0f2' },
  { name: '박쥐 동굴', style: 'cave', wallName: '동굴 벽', enemies: ['bat', 'axolotl', 'shadecat', 'crystalhog'], boss: 'lord', void: '#060509',
    floor: '#4a4557', floorDark: '#3d3948', floorLight: '#5a5468',
    wallTop: '#383347', wallLight: '#554d6c', wallFace: '#2c2839', wallDark: '#201d2b', wallLine: '#0c0a12',
    water: '#27456a', waterLight: '#5b88b3' },
  { name: '불꽃 화산', style: 'volcano', wallName: '검은 현무암', enemies: ['salamander', 'salamander', 'coal', 'moth'], boss: 'lavaturtle', void: '#0a0504', wet: 'lava',
    floor: '#4b4541', floorDark: '#3d3835', floorLight: '#5b544e',
    wallTop: '#3b3337', wallLight: '#564a4e', wallFace: '#2b2529', wallDark: '#1d191b', wallLine: '#0a0708',
    water: '#c4501f', waterLight: '#ffb347' },
  { name: '옛 조합 터', style: 'ruins', wallName: '무너진 벽', enemies: ['lostkid', 'maskman', 'maskman', 'armor'], boss: 'bigmask', void: '#060506', chasm: true,
    floor: '#57534d', floorDark: '#484540', floorLight: '#67635b',
    wallTop: '#5a4a45', wallLight: '#766259', wallFace: '#4a3c37', wallDark: '#30262a', wallLine: '#100c0e',
    water: '#36474a', waterLight: '#748e8e' },
];
