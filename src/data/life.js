// 마을 생활 (v0.30): what there is to do in the village between trips besides getting ready for the
// next one. Fishing in the pond (and the creek, once the village has one), catching bugs, a vegetable
// garden by your house, what grows wild round the village, and cooking at the stove at home. A village
// day passes with each trip (meta.day): the fish bite again, the bugs and the wild things come back, the
// garden grows a little. What you catch, grow, pick and cook goes in your basket (meta.bag), each kind
// gets its page in the 비밀 도감 the first time (data/book.js), and it can be cooked (a dish eaten before
// a trip helps on that trip) or given to someone who likes it (data/affinity.js).
// The rod, the net, the watering can and the seeds come from the shop as its shelves fill up
// (data/shop.js); the garden is the 텃밭 the carpenter makes in your yard (data/home.js DECOR).
// How it all happens in the village: scenes/village-life.js; the basket and the cooking: ui/life.js.

// ---------- 물고기 ----------
// [id, name, line, shape, pal, where (pond · creek · both), rod (the rod it takes), w (how often)]
// `junk`: not a fish at all; `need`: only once the village has that (data/village.js: the pond's
// lanterns go up at 29 clears)
export const FISH_LIST = [
  ['minnow', '송사리', '연못 가장자리에 떼 지어 다닌다. 작아도 물고기다.', 'fish', 'lLw', 'pond', 1, 10],
  ['crucian', '붕어', '연못의 터줏대감. 꼬리를 힘차게 흔든다.', 'fish', 'YNz', 'pond', 1, 10],
  ['carp', '잉어', '수염이 근사하다. 연못에서 제일 점잖다.', 'carp', 'JNa', 'pond', 1, 6],
  ['goldfish', '금붕어', '누가 연못에 놓아 준 걸까. 지느러미가 하늘하늘하다.', 'fish', 'orw', 'pond', 1, 6],
  ['loach', '미꾸라지', '손에서 자꾸 미끄러져 나간다.', 'eel', 'nNJ', 'pond', 1, 7],
  ['catfish', '메기', '입이 아주 크다. 비 오기 전에 잘 문다고 한다.', 'carp', 'dXl', 'pond', 2, 4],
  ['koi', '비단잉어', '하얀 몸에 주황 무늬. 연못이 환해진다.', 'carp', 'wor', 'pond', 2, 3],
  ['tadpole', '올챙이', '물고기가 아니다. 곧 개구리가 될 거다.', 'fish', 'XZ3', 'pond', 1, 6],
  ['snakehead', '가물치', '힘이 장사다. 낚싯대가 휘청했다.', 'eel', 'GXv', 'pond', 2, 3],
  ['snail', '우렁이', '물고기는 아니지만 낚싯바늘을 꽉 물고 있었다.', 'snail', 'nN', 'pond', 1, 4],
  ['boot', '낡은 장화', '묵직해서 월척인 줄 알았다. 누가 버린 장화다.', 'sock', 'hH', 'both', 1, 3, { junk: true }],
  ['can', '빈 깡통', '딸그락. 연못에 쓰레기를 버리면 안 된다.', 'tin', 'l', 'pond', 1, 3, { junk: true }],
  ['pebble', '돌멩이', '바닥에 걸린 줄 알았는데 돌이 따라 올라왔다.', 'pebble', 'L', 'both', 1, 3, { junk: true }],
  ['puffer', '복어', '이 연못에 왜 복어가 있을까. 건드리면 빵빵해진다.', 'puffer', 'yvw', 'pond', 2, 1.2],
  ['goldcarp', '황금 잉어', '비늘이 금화처럼 반짝인다. 보기만 해도 운이 좋아진다.', 'carp', 'yYz', 'pond', 3, 0.8, { rare: true }],
  ['ghost', '유령 물고기', '몸이 비쳐 보인다. 연못 바닥이 그대로 보인다.', 'fish', 'aWt', 'pond', 2, 1, { rare: true }],
  ['rainbow', '무지개 물고기', '비늘마다 색이 다르다. 비 갠 날 잘 보인다고 한다.', 'fish', 'bqy', 'pond', 2, 1, { rare: true }],
  ['lantern', '등불 물고기', '배가 등불처럼 은은하게 빛난다. 연못 등불을 좋아한다.', 'fish', 'oOz', 'pond', 2, 2, { need: 'lanterns' }],
  ['lord', '연못의 주인', '아주 오래 산 커다란 물고기. 눈이 마주쳤다. 놓아줄까 잠깐 고민했다.', 'carp', 'XZ3', 'pond', 3, 0.3, { rare: true }],
  ['trout', '송어', '등에 분홍 줄무늬가 있다. 차가운 물을 좋아한다.', 'fish', 'vqw', 'creek', 1, 8],
  ['sweetfish', '은어', '수박 냄새가 난다고 한다. 정말이다.', 'fish', 'lcw', 'creek', 1, 8],
  ['mandarin', '쏘가리', '얼룩무늬가 멋지다. 개울의 사냥꾼.', 'carp', 'YXz', 'creek', 2, 4],
  ['eel', '뱀장어', '바다까지 갔다 온다고 한다. 먼 길이다.', 'eel', 'NXJ', 'creek', 2, 4],
  ['chub', '피라미', '지느러미에 분홍빛이 돈다. 개울에 제일 많다.', 'fish', 'lpw', 'creek', 1, 10],
  ['salmon', '연어', '고향 개울을 찾아 거슬러 올라왔다.', 'carp', 'qrw', 'creek', 2, 3],
  ['gudgeon', '모래무지', '모래에 몸을 묻고 눈만 내놓고 있었다.', 'fish', 'JNa', 'creek', 1, 6],
  ['bitterling', '납자루', '작은데 색이 곱다. 조개 속에 알을 낳는다.', 'fish', 'pqc', 'creek', 1, 5],
  ['sturgeon', '철갑상어', '갑옷을 입은 물고기. 아주 옛날부터 이 모습이었다고 한다.', 'eel', 'LdW', 'creek', 3, 0.8, { rare: true }],
  ['moonfish', '달빛 물고기', '물속에서도 달처럼 빛난다. 잡고 나니 조금 미안했다.', 'fish', 'cbt', 'creek', 2, 1, { rare: true }],
  ['bottle', '병 편지', '떠내려온 병 속에 쪽지가 있다. 숫자만 빽빽하고, 맨 끝에 "미안" 한 마디.', 'bottle', 'w', 'creek', 1, 1, { junk: true, rare: true }],
];

// ---------- 곤충 ----------
// [id, name, line, shape, pal, where (flower · tree · grass · pond), net (the net it takes), w, shy (it
// flies off when you come close, unless you creep up slowly)]
export const BUG_LIST = [
  ['white', '배추흰나비', '배추밭을 좋아한다. 오늘은 꽃밭에 놀러 왔다.', 'bfly', 'wl', 'flower', 1, 10],
  ['yellow', '노랑나비', '봄이 오면 제일 먼저 보인다고 한다.', 'bfly', 'yY', 'flower', 1, 9],
  ['swallow', '호랑나비', '날개에 호랑이 무늬. 크고 멋지다.', 'bfly', 'zX', 'flower', 1, 5],
  ['blackbfly', '제비나비', '검은 날개가 빛을 받으면 푸르게 빛난다.', 'bfly', 'Xc', 'flower', 2, 1.5, true],
  ['honeybee', '꿀벌', '꽃가루를 다리에 잔뜩 묻히고 다닌다. 일을 참 열심히 한다.', 'bee', 'ycX', 'flower', 1, 8],
  ['bumble', '호박벌', '통통하고 털이 복슬복슬하다. 날갯소리가 크다.', 'bee', 'YcX', 'flower', 1, 5],
  ['ladybug', '무당벌레', '점이 일곱 개. 세어 봤다.', 'lbug', 'rX', 'flower', 1, 8],
  ['yladybug', '노랑 무당벌레', '노란 옷을 입은 무당벌레. 좀처럼 안 보인다.', 'lbug', 'yX', 'flower', 2, 2],
  ['chafer', '꽃무지', '꽃 속에 머리를 박고 꿀을 먹는다. 꽃 냄새가 난다.', 'beetle', 'gXt', 'flower', 1, 5],
  ['moth', '나방', '불빛만 보면 달려든다. 날개에 가루가 묻어 있다.', 'moth', 'WN', 'grass', 1, 6],
  ['firefly', '반딧불이', '꽁무니가 반짝반짝. 손바닥 안이 환해졌다.', 'firefly', 'XLy', 'pond', 2, 3, true],
  ['cicada', '매미', '맴맴. 잡으니까 조용해졌다.', 'cicada', 'Gc', 'tree', 1, 8],
  ['rhino', '장수풍뎅이', '뿔이 멋지다. 힘이 아주 세다.', 'beetle', 'BXt', 'tree', 2, 3],
  ['stag', '사슴벌레', '집게가 사슴뿔 같다. 손가락을 조심하자.', 'beetle', 'CBt', 'tree', 2, 3],
  ['jewel', '비단벌레', '등이 보석처럼 반짝인다. 숨을 죽이고 다가갔다.', 'beetle', 'gpz', 'tree', 3, 1, true],
  ['longhorn', '하늘소', '더듬이가 몸보다 길다. 하늘을 날 것 같은 이름이다.', 'beetle', 'Bwt', 'tree', 2, 3],
  ['goldbeetle', '황금 풍뎅이', '온몸이 황금빛이다. 들고 있으니 부자가 된 기분이다.', 'beetle', 'yYz', 'tree', 3, 0.7, true],
  ['grasshopper', '메뚜기', '폴짝! 잡았다 싶으면 저만치 가 있다.', 'hopper', 'gG', 'grass', 1, 10],
  ['cricket', '귀뚜라미', '밤마다 노래하는 그 녀석이다.', 'hopper', 'uU', 'grass', 1, 7],
  ['longhopper', '방아깨비', '뒷다리를 잡으면 방아를 찧는다. 콩콩.', 'hopper', 'vg', 'grass', 1, 6],
  ['mantis', '사마귀', '앞발을 들고 이쪽을 노려본다. 무섭지만 귀엽다.', 'hopper', 'Gv', 'grass', 2, 3],
  ['reddfly', '고추잠자리', '꼬리가 고추처럼 빨갛다. 가을이 왔나 보다.', 'dfly', 'rc', 'pond', 1, 8],
  ['bigdfly', '장수잠자리', '날개가 아주 크다. 연못을 크게 한 바퀴 돈다.', 'dfly', 'bc', 'pond', 2, 3, true],
  ['damsel', '실잠자리', '실처럼 가늘다. 바람이 불면 날아갈 것 같다.', 'dfly', 'cw', 'pond', 1, 6],
];

// ---------- 텃밭 작물 ----------
// [id, name, line, shape, pal, days (village days from seed to harvest; a day watered counts double)]
export const CROP_LIST = [
  ['turnip', '순무', '심은 지 이틀이면 쑥 자란다. 성격이 급하다.', 'turnip', 'wgp', 2],
  ['carrot', '당근', '흙을 털면 주황빛이 반짝. 토끼가 좋아한다.', 'carrot', 'og', 3],
  ['potato', '감자', '하나 캤는데 줄줄이 따라 나왔다.', 'potato', 'J', 3],
  ['cabbage', '배추', '속이 꽉 찼다. 무겁다.', 'cabbage', 'wgv', 3],
  ['strawberry', '딸기', '빨갛게 잘 익었다. 하나는 그 자리에서 먹었다.', 'berry', 'rgy', 3],
  ['pepper', '고추', '작아도 맵다. 아주 맵다.', 'pepper', 'rg', 3],
  ['tomato', '토마토', '햇볕을 듬뿍 받아 새빨갛다.', 'round', 'rg', 4],
  ['corn', '옥수수', '수염이 났다. 알이 꽉 찼다.', 'corn', 'yg', 4],
  ['eggplant', '가지', '반질반질 보랏빛. 텃밭의 멋쟁이.', 'long', 'pg', 4],
  ['sunflower', '해바라기', '해만 따라 고개를 돌린다. 씨가 잔뜩 들었다.', 'sunflower', 'yNg', 4],
  ['pumpkin', '호박', '혼자 들기 힘들 만큼 컸다.', 'pumpkin', 'oGO', 5],
  ['watermelon', '수박', '통통 두드리면 잘 익은 소리가 난다.', 'melon', 'Gv', 5],
];

// ---------- 들에서 나는 것 ----------
// [id, name, line, shape, pal, where (grass · tree · flower · hive · none: never lying about)]
export const FORAGE_LIST = [
  ['rasp', '산딸기', '덤불 사이에 빨갛게 숨어 있었다. 새콤달콤.', 'rasp', 'rg', 'tree'],
  ['shroom', '버섯', '갓이 동그란 갈색 버섯. 먹어도 되는 쪽이다.', 'shroom', 'nJa', 'tree'],
  ['mugwort', '쑥', '향이 진하다. 떡을 하면 맛있다.', 'herb', 'gG', 'grass'],
  ['dandelion', '민들레', '노란 꽃은 따고, 홀씨는 불었다.', 'flower', 'y', 'grass'],
  ['acorn', '도토리', '다람쥐가 묻어 둔 걸 깜빡했나 보다.', 'acorn', 'nN', 'tree'],
  ['chestnut', '밤', '가시 송이 속에서 반질반질한 밤이 나왔다.', 'chestnut', 'NJ', 'tree'],
  ['clover', '클로버', '잎이 세 개. 네 잎은 다음에 찾자.', 'clover', 'g', 'grass'],
  ['rose', '들장미', '향기가 좋다. 가시를 조심하자.', 'flower', 'q', 'flower'],
  ['pinemush', '송이버섯', '솔향이 난다. 아주 귀한 버섯이다.', 'shroom', 'JIa', 'tree', { rare: true }],
  ['honey', '벌집 꿀', '꿀벌 통 옆에 떨어진 벌집 조각. 꿀벌들이 나눠 준 걸로 하자.', 'comb', 'yY', 'hive'],
  // not lying about: what a village day gives you (data/play.js DAYS), `price` at the shop
  ['egg', '달걀', '병아리들을 찾아 줬더니 엄마 닭이 낳아 준 달걀. 아직 따뜻하다.', 'egg', 'w', 'none', { price: 12 }],
  ['giantturnip', '커다란 순무', '다 같이 영차영차 뽑은 순무. 혼자서는 들 수도 없다.', 'turnip', 'wGP', 'none', { price: 300 }],
];

// ---------- 요리 ----------
// [id, name, line, shape, pal, buff, recipe]
// recipe: one or two parts, each an ingredient id or a kind (TAGS); the first recipe that fits what
// went in the pot is what comes out (the more particular ones first), and anything else makes
// 정체불명 스튜. A dish eaten before a trip (ui/life.js eat; meta.meal) helps for that trip only:
//   hp: max health · atk · def · gold: more gold (a fraction) · sight · xp: faster growing (a fraction) ·
//   regen: health back on each new field · sneak: harder surprise blows · luck: odd things more often
//   (core/wonders.js) · tool: a meadow tool in the pocket
export const DISH_LIST = [
  ['turnipfeast', '순무 잔치', '커다란 순무 하나로 온 마을이 배불리 먹었다.', 'pot', 'wg', { hp: 12, regen: 1 }, ['giantturnip']],
  ['goldfeast', '임금님 수라상', '황금빛 생선 요리가 한 상 가득. 먹기 아깝다.', 'plate', 'yr', { hp: 10, atk: 2, gold: 0.1 }, ['king']],
  ['pinerice', '송이 솥밥', '솥뚜껑을 여니 솔향이 확 퍼진다.', 'pot', 'Jw', { hp: 10, atk: 1 }, ['pinemush', 'any']],
  ['kimchi', '배추김치', '맵고 시원하다. 힘이 불끈 난다.', 'bowl', 'rv', { atk: 1, hp: 3 }, ['cabbage', 'pepper']],
  ['honeycarrot', '꿀 당근 조림', '달큰하게 졸인 당근. 토끼가 침을 흘린다.', 'plate', 'oy', { hp: 6, regen: 1 }, ['carrot', 'honey']],
  ['strawjam', '딸기잼', '빵에 듬뿍 발라 먹자.', 'bottle', 'r', { gold: 0.1 }, ['strawberry', 'honey']],
  ['raspjam', '산딸기잼', '새콤한 잼. 한 숟가락씩 몰래 먹게 된다.', 'bottle', 'm', { gold: 0.08, hp: 2 }, ['rasp', 'honey']],
  ['tomatostew', '토마토 생선 스튜', '보글보글 끓인 빨간 스튜. 몸이 데워진다.', 'pot', 'rw', { hp: 8 }, ['tomato', 'fish']],
  ['spicyfish', '매운 생선 조림', '입에서 불이 난다. 하지만 멈출 수 없다.', 'plate', 'rL', { atk: 1, hp: 3 }, ['pepper', 'fish']],
  ['potatocake', '감자전', '바삭바삭. 비 오는 날 생각나는 맛.', 'plate', 'yJ', { hp: 5, def: 1 }, ['potato', 'potato']],
  ['cornsoup', '옥수수 수프', '고소하고 부드럽다. 속이 든든하다.', 'bowl', 'yw', { hp: 5, regen: 1 }, ['corn', 'veg']],
  ['punch', '수박 화채', '수박 그릇에 과일이 동동. 시원하다.', 'bowl', 'qr', { sight: 1, hp: 2 }, ['watermelon', 'any']],
  ['pumpkinmash', '호박 꿀찜', '노랗고 달콤하다. 숟가락이 멈추지 않는다.', 'bowl', 'oy', { hp: 8 }, ['pumpkin', 'honey']],
  ['pumpkinsoup', '호박죽', '따끈한 호박죽 한 그릇. 마음까지 노래진다.', 'bowl', 'o', { hp: 6 }, ['pumpkin']],
  ['ssukcake', '쑥떡', '쫀득쫀득. 쑥 향이 입안 가득.', 'onigiri', 'gw', { hp: 4, def: 1 }, ['mugwort', 'nut']],
  ['eelbowl', '장어덮밥', '윤기가 자르르. 먹고 나니 기운이 넘친다.', 'bowl', 'Nw', { atk: 1, hp: 4 }, ['eel', 'any']],
  ['seeds', '해바라기씨 볶음', '까먹다 보면 시간 가는 줄 모른다.', 'plate', 'NJ', { xp: 0.15 }, ['sunflower']],
  ['fishveg', '생선 조림', '생선과 채소를 함께 졸였다. 밥도둑이다.', 'plate', 'Lo', { hp: 5 }, ['fish', 'veg']],
  ['fishmush', '생선 버섯찜', '버섯 향이 밴 생선. 부드럽다.', 'pot', 'Ln', { hp: 6 }, ['fish', 'mushroom']],
  ['fishsoup', '맑은 생선탕', '나물을 넣어 국물이 시원하다.', 'bowl', 'lG', { hp: 4, regen: 1 }, ['fish', 'herb']],
  ['fishfruit', '새콤 생선 무침', '과일을 넣었더니 새콤달콤하다. 의외로 맛있다.', 'plate', 'Lr', { hp: 3, sight: 1 }, ['fish', 'fruit']],
  ['sashimi', '생선 꼬치 모둠', '이것저것 꿰어 구웠다. 한 꼬치씩 나눠 먹자.', 'skewer', 'LN', { hp: 6, atk: 1 }, ['fish', 'fish']],
  ['vegsoup', '채소 수프', '텃밭에서 난 것을 다 넣었다.', 'bowl', 'og', { hp: 4 }, ['veg', 'veg']],
  ['mushfry', '버섯 볶음', '지글지글. 버섯이 쫄깃하다.', 'plate', 'nJ', { hp: 4, def: 1 }, ['veg', 'mushroom']],
  ['salad', '고소한 샐러드', '견과를 뿌린 샐러드. 아삭아삭 고소하다.', 'plate', 'gn', { sneak: 0.25 }, ['veg', 'nut']],
  ['fruitbowl', '과일 화채', '과일을 잔뜩 넣었다. 달고 시원하다.', 'bowl', 'qr', { sight: 1 }, ['fruit', 'fruit']],
  ['gangjeong', '꿀 강정', '견과를 꿀로 뭉쳤다. 주머니에 넣어 다니기 좋다.', 'cookie', 'Y', { gold: 0.1 }, ['nut', 'honey']],
  ['herbtea', '약초 꿀차', '한 모금 마시면 몸이 노곤노곤 풀린다.', 'cup', 'g', { regen: 2 }, ['herb', 'honey']],
  ['flowertea', '꽃차', '찻잔에 꽃이 피었다. 왠지 좋은 일이 생길 것 같다.', 'cup', 'q', { luck: 0.3 }, ['flower', 'any']],
  ['hotpot', '버섯전골', '버섯이 잔뜩. 보글보글 끓여 다 같이 먹는 요리.', 'pot', 'n', { hp: 7 }, ['mushroom', 'mushroom']],
  ['berrytart', '산딸기 타르트', '바삭한 과자 위에 산딸기가 소복하다.', 'pie', 'r', { hp: 4, gold: 0.05 }, ['fruit', 'nut']],
  ['eggroll', '달걀말이', '도톰하게 말았다. 채소가 알록달록 박혀 있다.', 'plate', 'y', { hp: 4, def: 1 }, ['egg', 'veg']],
  ['grilledfish', '생선구이', '노릇노릇 구웠다. 소금만 뿌려도 맛있다.', 'skewer', 'L', { hp: 3 }, ['fish']],
  ['steamveg', '찐 채소', '푹 쪘다. 몸에 좋은 맛이다.', 'plate', 'g', { hp: 2, regen: 1 }, ['veg']],
  ['grillmush', '버섯구이', '불에 구우니 향이 확 올라온다.', 'skewer', 'n', { hp: 2, def: 1 }, ['mushroom']],
  ['fruitskewer', '과일 꼬치', '알록달록 과일을 꼬치에 꿰었다.', 'skewer', 'r', { hp: 2, sight: 1 }, ['fruit']],
  ['namul', '나물무침', '조물조물 무쳤다. 향긋하다.', 'plate', 'G', { hp: 2, xp: 0.05 }, ['herb']],
  ['roastnut', '군밤', '호호 불어 가며 까먹는다.', 'cookie', 'N', { hp: 2, gold: 0.05 }, ['nut']],
  ['honeywater', '꿀물', '달다. 힘이 난다.', 'cup', 'y', { regen: 1 }, ['honey']],
  ['steamegg', '달걀찜', '보들보들 부풀어 올랐다. 숟가락이 쏙 들어간다.', 'bowl', 'y', { hp: 5 }, ['egg']],
  // not cooked: given to you on a village day (data/play.js DAYS moon, picnic)
  ['mooncookie', '달 과자', '큰 나무 작은 문 안에서 받은 과자. 달처럼 동그랗고 노랗다.', 'cookie', 'z', { sight: 1, luck: 0.2 }, null],
  ['picnicbox', '소풍 도시락', '소풍에서 나눠 받은 도시락. 김밥이 가지런하다.', 'onigiri', 'gw', { hp: 4, regen: 1 }, null],
  ['mystery', '정체불명 스튜', '무엇을 넣었는지 기억나지 않는다. 먹으면… 어떻게 될까?', 'pot', 'X', { mystery: true }, null],
];

// what kind each ingredient is, for the recipes (and for what folk like, data/affinity.js)
export const TAGS = {
  fish: FISH_LIST.filter(f => !f[8]?.junk).map(f => f[0]),
  veg: ['turnip', 'carrot', 'potato', 'cabbage', 'pepper', 'tomato', 'corn', 'eggplant', 'pumpkin'],
  fruit: ['strawberry', 'watermelon', 'rasp'],
  mushroom: ['shroom', 'pinemush'],
  herb: ['mugwort', 'dandelion', 'clover'],
  nut: ['acorn', 'chestnut'],
  flower: ['rose', 'sunflower', 'dandelion'],
  honey: ['honey'],
  egg: ['egg'],
  eel: ['eel', 'loach'],
  king: ['goldcarp', 'lord'],
  bug: BUG_LIST.map(b => b[0]),
  junk: FISH_LIST.filter(f => f[8]?.junk).map(f => f[0]),
};

// ---------- 생활 도구 (bought at the shop, data/shop.js) ----------
export const LIFE_TOOLS = {
  rod1: { name: '낚싯대', slot: 'rod', lv: 1, pic: { find: ['rod', 'n'] }, cost: 250, desc: '마을 연못에서 낚시를 할 수 있다' },
  rod2: { name: '튼튼한 낚싯대', slot: 'rod', lv: 2, pic: { find: ['rod', 'L'] }, cost: 1500, desc: '큰 물고기도 버틴다. 더 귀한 물고기가 문다' },
  rod3: { name: '황금 낚싯대', slot: 'rod', lv: 3, pic: { find: ['rod', 'Y'] }, cost: 6000, desc: '전설로만 듣던 물고기가 문다는 낚싯대' },
  net1: { name: '잠자리채', slot: 'net', lv: 1, pic: { find: ['net', 'L'] }, cost: 250, desc: '마을의 곤충을 잡을 수 있다' },
  net2: { name: '큰 잠자리채', slot: 'net', lv: 2, pic: { find: ['net', 'C'] }, cost: 1500, desc: '날쌘 곤충도 잡는다' },
  net3: { name: '황금 잠자리채', slot: 'net', lv: 3, pic: { find: ['net', 'Y'] }, cost: 6000, desc: '아주 귀한 곤충도 놓치지 않는다' },
  can: { name: '물뿌리개', slot: 'can', lv: 1, pic: { find: ['can', 'b'] }, cost: 600, desc: '텃밭에 물을 주면 그날은 두 배로 자란다' },
  plot2: { name: '텃밭 넓히기', slot: 'plots', lv: 2, pic: { find: ['shovel', 'Ln'] }, cost: 1200, desc: '집 마당 텃밭이 두 칸 더 늘어난다' },
};
// seeds come in a packet of SEED_PACK; their price by how long the crop takes
export const SEED_PACK = 3;
export const seedCost = days => 40 + 30 * days;

// how many bites a spot has in a day, bugs about, wild things to pick
export const BITES = { pond: 4, creek: 4 };
export const BUGS_A_DAY = 5, FORAGE_A_DAY = 4;
// the chance a cast gets a bite at all, and how long the bobber waits for a tap (ms) by the rod
export const BITE_WINDOW = [0, 700, 850, 1000];
// the chance a swing of the net gets the bug, by net level and how hard the bug is (net it takes)
export const NET_CATCH = (net, need) => (net >= need ? 0.85 : 0.35 - 0.1 * (need - net - 1));

// ---------- tables ----------
const opts = o => o || {};
export const FISH = Object.fromEntries(FISH_LIST.map(([id, name, line, shape, pal, where, rod, w, o]) => [id, { id, name, line, pic: { find: [shape, pal] }, where, rod, w, ...opts(o), cat: 'fish' }]));
export const BUGS = Object.fromEntries(BUG_LIST.map(([id, name, line, shape, pal, where, net, w, shy]) => [id, { id, name, line, pic: { find: [shape, pal] }, where, net, w, shy: !!shy, cat: 'bug' }]));
export const CROPS = Object.fromEntries(CROP_LIST.map(([id, name, line, shape, pal, days]) => [id, { id, name, line, pic: { find: [shape, pal] }, days, cat: 'crop' }]));
export const FORAGE = Object.fromEntries(FORAGE_LIST.map(([id, name, line, shape, pal, where, o]) => [id, { id, name, line, pic: { find: [shape, pal] }, where, ...opts(o), cat: 'forage' }]));
export const DISHES = Object.fromEntries(DISH_LIST.map(([id, name, line, shape, pal, buff, recipe]) => [id, { id, name, line, pic: { find: [shape, pal] }, buff, recipe, cat: 'dish' }]));
// everything that can be in the basket, by id (seeds are `seed:<crop>`)
export const ITEM = { ...FISH, ...BUGS, ...CROPS, ...FORAGE, ...DISHES };
export const seedId = crop => `seed:${crop}`;
export const isSeed = id => id.startsWith('seed:');
export const itemName = id => (isSeed(id) ? `${CROPS[id.slice(5)]?.name} 씨앗` : ITEM[id]?.name || id);

// does `id` fit a recipe part (an id or a kind)
export const fits = (id, part) => part === 'any' ? !TAGS.junk.includes(id) && !TAGS.bug.includes(id) : part === id || (TAGS[part] || []).includes(id);
// can it go in the pot at all (bugs and junk cannot)
export const cookable = id => !!ITEM[id] && ITEM[id].cat !== 'bug' && ITEM[id].cat !== 'dish' && !TAGS.junk.includes(id);

// What comes out of the pot for these (one or two ingredient ids): the first dish whose recipe takes
// exactly that many parts and fits them either way round.
export function cook(ids) {
  for (const d of DISH_LIST) {
    const r = d[6];
    if (!r || r.length !== ids.length) continue;
    if (ids.length === 1 ? fits(ids[0], r[0]) : (fits(ids[0], r[0]) && fits(ids[1], r[1])) || (fits(ids[0], r[1]) && fits(ids[1], r[0]))) return DISHES[d[0]];
  }
  return DISHES.mystery;
}

// a dish's help, in words, for its card
const BUFF_WORDS = {
  hp: n => `최대 체력 +${n}`, atk: n => `공격력 +${n}`, def: n => `방어 +${n}`, gold: n => `골드 +${Math.round(n * 100)}%`,
  sight: n => `시야 +${n}`, xp: n => `경험치 +${Math.round(n * 100)}%`, regen: n => `새 들판마다 체력 +${n}`,
  sneak: n => `기습 피해 +${Math.round(n * 100)}%`, luck: () => '별난 것들이 더 자주 보인다', tool: () => '들판 도구 하나를 챙겨 간다',
  mystery: () => '먹어 보기 전엔 모른다',
};
export const buffText = buff => Object.entries(buff || {}).map(([k, v]) => BUFF_WORDS[k]?.(v)).filter(Boolean).join(' · ');
// 정체불명 스튜: what it turns out to do, decided when it is eaten
export const MYSTERY = [{ hp: 6 }, { atk: 1 }, { gold: 0.1 }, { sight: 1 }, { luck: 0.3 }, { regen: 1 }, {}];


// ---------- a village day ----------
// A day passes with every trip (main.js, when one ends): the garden grows (twice as much on a day it was
// watered), and the fish, the bugs and the wild things come back (the village rolls those when you walk
// in on a new day: scenes/village-life.js, rollDay).
// The 텃밭 the carpenter makes has GARDEN_BASE plots; 텃밭 넓히기 two more (data/home.js DECOR garden).
export const GARDEN_BASE = 4;
export const plotCount = meta => (meta.tools?.plots >= 2 ? GARDEN_BASE + 2 : GARDEN_BASE);
export function passDay(meta) {
  meta.day = (meta.day || 0) + 1;
  for (const p of meta.garden || []) {
    if (!p?.crop) continue;
    p.grown = (p.grown || 0) + (p.wet ? 2 : 1);
    p.wet = false;
  }
}
export const ripe = p => !!p?.crop && p.grown >= CROPS[p.crop].days;
// how far along a plot is: -1 empty, 0 just sown, 1 sprouting, 2 nearly there, 3 ready to pull up
export const cropStage = p => (!p?.crop ? -1 : ripe(p) ? 3 : Math.min(2, Math.floor((3 * (p.grown || 0)) / CROPS[p.crop].days)));
// the days still to go (0 when ready); watering today takes one more off
export const daysLeft = p => Math.max(0, CROPS[p.crop].days - (p.grown || 0));

// one of a list by how often each turns up (`w`; 1 when not given)
function weighted(list, rnd) {
  const total = list.reduce((n, o) => n + (o.w ?? 1), 0);
  let r = rnd() * total;
  for (const o of list) if ((r -= o.w ?? 1) < 0) return o;
  return list[list.length - 1];
}
// What bites at a spot ('pond' or 'creek') with the rod you have; `P`: how grown the village is (the
// 등불 물고기 comes once the pond's lanterns are up)
export const LANTERNS_P = 29;
export function fishFor(where, rod, P, rnd = Math.random) {
  const can = Object.values(FISH).filter(f => (f.where === where || f.where === 'both') && f.rod <= rod && (f.need !== 'lanterns' || P >= LANTERNS_P));
  return weighted(can, rnd);
}
// A new village day: today's bites, BUGS_A_DAY bugs and FORAGE_A_DAY wild things, each on a free spot
// of its kind (`bugAt`, `wildAt`: { flower, tree, grass, pond, hive } lists of cells, from the village as
// it is: a bug's tree is the tree itself, a wild thing's the grass under one), never two on one cell.
// `mods`: what the day's goings-on add (data/play.js DAY_LIFE): bites in each water, more bugs, so many
// of one bug or wild thing on top.
export function rollDay(meta, bugAt, wildAt, rnd = Math.random, mods = null) {
  const used = new Set(), out = { bugs: [], forage: [] };
  const place = (spots, where, id, into) => {
    const free = (spots[where] || []).filter(c => !used.has(`${c.x},${c.y}`));
    if (!free.length) return false;
    const c = free[Math.floor(rnd() * free.length)];
    used.add(`${c.x},${c.y}`);
    into.push({ id, x: c.x, y: c.y });
    return true;
  };
  const bugs = Object.values(BUGS).filter(b => (bugAt[b.where] || []).length);
  for (let k = 0, tries = 0; k < BUGS_A_DAY + (mods?.bugs || 0) && bugs.length && tries < 60; tries++) {
    const b = weighted(bugs, rnd);
    if (place(bugAt, b.where, b.id, out.bugs)) k++;
  }
  for (const [id, n] of Object.entries(mods?.only || {})) for (let k = 0; k < n; k++) place(bugAt, BUGS[id].where, id, out.bugs);
  for (const [id, n] of Object.entries(mods?.forage || {})) for (let k = 0; k < n; k++) place(wildAt, FORAGE[id].where, id, out.forage);
  const wild = Object.values(FORAGE).filter(f => (wildAt[f.where] || []).length).map(f => ({ ...f, w: f.rare ? 0.4 : f.where === 'hive' ? 1.5 : 2 }));
  for (let k = 0, tries = 0; k < FORAGE_A_DAY && wild.length && tries < 40; tries++) {
    const f = weighted(wild, rnd);
    if (place(wildAt, f.where, f.id, out.forage)) k++;
  }
  const bites = Object.fromEntries(Object.entries(BITES).map(([w, n]) => [w, n + (mods?.bites || 0)]));
  meta.life = { day: meta.day || 0, bites, bugs: out.bugs, forage: out.forage };
  return meta.life;
}

// ---------- the basket ----------
export const bagCount = (meta, id) => meta.bag?.[id] || 0;
export function addToBag(meta, id, n = 1) {
  meta.bag ||= {};
  meta.bag[id] = (meta.bag[id] || 0) + n;
  if (meta.bag[id] <= 0) delete meta.bag[id];
}
// What the shop pays for one (ui/hub.js 팔기): by how often it turns up and the rod or net it takes;
// junk next to nothing; a crop half again what its seed cost. Dishes and seeds are not for selling.
export function sellPrice(id) {
  const it = ITEM[id];
  if (!it || it.cat === 'dish') return 0;
  if (it.price) return it.price;
  if (TAGS.junk.includes(id)) return id === 'bottle' ? 20 : 1;
  if (it.cat === 'crop') return Math.round((seedCost(it.days) / SEED_PACK) * 1.5);
  if (it.cat === 'forage') return it.rare ? 40 : id === 'honey' ? 14 : 5;
  const need = it.rod || it.net || 1;
  return Math.round(2 + (12 / Math.sqrt(it.w)) * need);
}
// the book's page for one (data/book.js): `fish:minnow`, `dish:kimchi`...
export const lifeEntry = id => (ITEM[id] ? `${ITEM[id].cat}:${id}` : null);
