// 꿈 (v0.30): what you dream when you nod off, out in a field after a long rest with nobody about (once a
// trip, core/run.js dream) or in your own bed at home (the first nap of each visit, scenes/HomeScene.js).
// Most are just dreams; a few are not quite. Each one dreamt for the first time gets its page in the 비밀
// 도감 (data/book.js); the ones not dreamt yet come first.
//   [id, name, line, pic (a sprite, shown in the dream's cloud and in the book)]

export const DREAM_LIST = [
  // (v0.28's six, the ones that are not quite dreams)
  ['worker_rat', '일하는 들쥐', '꿈속에서 작업복을 입은 들쥐가 반짝 바위를 캐고 있었다. 이쪽을 보더니 손을 흔들었다.', 'rat'],
  ['calling', '부르는 소리', '꿈속에서 누가 내 이름을 불렀다. 돌아보니 조합 게시판만 덩그러니 서 있었다.', 'routeSign'],
  ['line_in', '줄지은 일꾼들', '꿈속에서 일꾼들이 줄지어 땅굴로 들어갔다. 나오는 일꾼은 하나도 없었다.', 'maskman'],
  ['work_song', '출근 노래', '꿈속에서 들판 친구들이 모닥불에 둘러앉아 조합 출근 노래를 불렀다.', 'skel'],
  ['big_smile', '웃는 가면', '꿈속에서 커다란 가면이 웃었다. 깨어 보니 볼이 젖어 있었다.', 'bigmask'],
  ['knock', '문 두드리는 소리', '꿈속에서 우리 집 문을 두드리는 소리가 났다. 문을 열었더니 명찰 하나만 떨어져 있었다.', 'workertag'],
  // just dreams
  ['flying', '하늘을 나는 꿈', '꿈속에서 민들레 홀씨를 타고 들판 위를 날았다. 우리 마을이 손톱만 하게 보였다.', 'dandelion'],
  ['cake', '커다란 케이크', '꿈속에서 집채만 한 케이크를 들판 친구들과 나눠 먹었다. 슬라임이 제일 많이 먹었다.', 'slime'],
  ['falling', '떨어지는 꿈', '꿈속에서 땅굴 속으로 끝없이 떨어졌다. 바닥에 닿기 직전에 눈이 떠졌다.', 'mole'],
  ['goldrain', '골드 비', '꿈속에서 하늘에서 동전이 비처럼 쏟아졌다. 주우려고 손을 내밀면 사라졌다.', 'gold'],
  ['bigrock', '거대한 반짝 바위', '꿈속에서 산만 한 반짝 바위를 캤다. 곡괭이질 한 번에 하루가 지나갔다.', 'pick'],
  ['test', '시험 보는 꿈', '꿈속에서 조합 시험을 봤다. 문제는 전부 들쥐 그림이었다.', 'rat'],
  ['late', '지각하는 꿈', '꿈속에서 출근이 늦었다. 아무리 달려도 땅굴이 멀어졌다.', 'boots'],
  ['teeth', '이가 빠지는 꿈', '꿈속에서 이가 쏙 빠졌다. 들여다보니 도토리였다.', 'pinecone'],
  ['swim', '헤엄치는 꿈', '꿈속에서 물고기처럼 늪을 헤엄쳤다. 개구리들이 박수를 쳐 줬다.', 'frog'],
  ['snowball', '눈싸움', '꿈속에서 눈사람들과 눈싸움을 했다. 눈사람이 자꾸 제 머리를 던졌다.', 'snowman'],
  ['tea', '버섯 다과회', '꿈속에서 독버섯들과 다과회를 했다. 차에서 포자 맛이 났다.', 'skel'],
  ['crown', '왕이 된 꿈', '꿈속에서 왕쥐 왕관을 썼다. 너무 커서 눈까지 덮였다.', 'crown'],
  ['giant', '거인이 된 꿈', '꿈속에서 거인이 되어 거인 해바라기를 꺾었다. 해바라기가 서운해했다.', 'giantfist'],
  ['tiny', '작아지는 꿈', '꿈속에서 콩알만 하게 작아졌다. 아기 메뚜기가 등에 태워 줬다.', 'hopper'],
  ['party', '마을 잔치', '꿈속에서 마을에 잔치가 열렸다. 다 아는 얼굴인데 이름이 하나도 기억나지 않았다.', 'neighbor'],
  ['home', '집에 가는 길', '꿈속에서 집에 가는 길을 걸었다. 걷고 또 걸어도 집 앞이었다.', 'adv'],
  ['star', '별 줍기', '꿈속에서 떨어진 별을 주웠다. 별사탕 맛이 났다.', 'candy'],
  ['moon', '달 위의 토끼', '꿈속에서 달에 사는 눈토끼가 떡을 찧고 있었다. 하나 얻어먹었다.', 'snowhare'],
  ['sea', '바닷속 마을', '꿈속에서 바닷속에도 우리 같은 마을이 있었다. 소라게가 이장이었다.', 'hermit'],
  ['bees', '꿀벌 왕국', '꿈속에서 꿀벌들이 꿀 한 병을 주며 여왕님께 인사하라고 했다.', 'queen'],
  ['lava', '용암 온천', '꿈속에서 용암 거북 등에 앉아 용암 온천을 했다. 생각보다 미지근했다.', 'lavaturtle'],
  ['owl', '부엉이 선생님', '꿈속에서 부엉이 선생님이 별자리를 가르쳐 줬다. 전부 반짝 바위 모양이었다.', 'hero_owl'],
  ['race', '달리기 시합', '꿈속에서 거북이랑 달리기를 했다. 거북이가 이겼다. 억울했다.', 'turtle'],
  ['pillow', '구름 베개', '꿈속에서 구름을 베고 잤다. 꿈속에서 또 잤다.', 'pet_cloud'],
  ['chickens', '병아리 행진', '꿈속에서 병아리 백 마리가 졸졸 따라왔다. 돌아볼 때마다 한 마리씩 늘었다.', 'pet_chick'],
  ['library', '끝없는 도감', '꿈속에서 비밀 도감을 펼쳤더니 칸이 끝도 없이 이어졌다. 전부 채워져 있었다.', 'pillow'],
  ['rain', '빗소리', '꿈속에서 빗소리를 들으며 또 잤다. 일어나 보니 진짜로 비가 오지는 않았다.', 'ripple'],
  ['snail', '달팽이 경주', '꿈속에서 달팽이 경주를 구경했다. 아직도 결승선에 아무도 안 왔다.', 'snail'],
  ['ghost', '울보 아기새', '꿈속에서 울보 아기새가 리본을 매고 웃고 있었다. 이제 안 우는 것 같았다.', 'ghostNpc'],
  ['shop', '공짜 가게', '꿈속에서 가게 물건이 전부 공짜였다. 가방이 작아서 하나밖에 못 들었다.', 'shopkeep'],
  ['dragon', '용 친구', '꿈속에서 아기 용이 불을 뿜어 고구마를 구워 줬다.', 'hero_dragon'],
  ['map', '보물 지도', '꿈속에서 보물 지도를 따라갔더니 우리 집 마당이었다.', 'map'],
  ['bell', '방울 숲', '꿈속에서 나무마다 방울이 열려 바람이 불 때마다 딸랑거렸다.', 'bell'],
  ['honey', '꿀 강', '꿈속에서 꿀이 강처럼 흘렀다. 발이 붙어서 한 걸음도 못 갔다.', 'honeyjar'],
  ['penguin', '얼음 미끄럼틀', '꿈속에서 펭귄이랑 빙판 미끄럼틀을 탔다. 끝없이 미끄러졌다.', 'hero_penguin'],
  ['bear', '곰 이불', '꿈속에서 커다란 곰이 이불이 되어 줬다. 따뜻해서 꿈속에서도 졸렸다.', 'hero_bear'],
  ['crystal', '수정 동굴 노래', '꿈속에서 동굴 수정들이 노래를 불렀다. 깨어나서도 흥얼거렸다.', 'crystalhog'],
  ['seal', '물범 서커스', '꿈속에서 물범 서커스를 봤다. 솔방울 열 개를 한꺼번에 돌렸다.', 'seal'],
  ['mirror', '거울 속의 나', '꿈속에서 거울을 봤는데 거울 속 내가 먼저 웃었다.', 'mimic'],
  ['hole', '구멍 속 마을', '꿈속에서 대장이 사라진 구멍 아래를 내려다봤다. 아주 깊은 곳에 불빛이 하나 켜져 있었다.', 'cage'],
  ['ledger', '장부', '꿈속에서 끝없이 긴 장부에 내 이름이 적혀 있었다. 옆 칸은 비어 있었다.', 'pedestal'],
  ['wave', '손 흔드는 친구들', '꿈속에서 들판 친구들이 다 같이 손을 흔들었다. 잘 가라는 건지, 어서 오라는 건지 알 수 없었다.', 'goblin'],
  ['spring', '봄', '꿈속에서 마을에 꽃이 한꺼번에 피었다. 일어나 보니 베개에 꽃잎 하나가 붙어 있었다.', 'pet_butterfly'],
  ['nothing', '아무 꿈도', '아무 꿈도 꾸지 않았다. 그런데 이상하게 아주 긴 꿈을 꾼 것 같다.', 'rest'],
];
export const DREAMS = DREAM_LIST.map(([id, name, line, pic]) => ({ id, name, line, pic }));
export const DREAM = Object.fromEntries(DREAMS.map(d => [d.id, d]));
export const dreamId = id => `dream:${id}`;
