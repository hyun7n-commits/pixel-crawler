// 새로 열림: the first trip out is plain (critters, one sparkle boulder, chests, grass, water, doors,
// potions and six basic relics), and everything else opens one thing at a time as you play, the way
// Vampire Crawlers and BALL x PIT hand out something new after almost every run.
// At the end of a trip the first entries (in this order) whose `when` holds are opened, at most
// PER_TRIP of them, and listed on the trip's end card; the rest wait for the next trip, so even a
// big leap forward is learned a piece at a time.
//   relic: a basic relic joining the cards you can be offered · what/desc: the line on the end card
//   icon: the picture beside it (a sprite or relic id)
// Gates are read with isOpen(meta, id) where the thing would appear (core/run.js, core/specials.js).

export const PER_TRIP = 2;

const broken = m => Object.values(m.ores || {}).reduce((a, b) => a + b, 0);
const beat = (m, boss) => m.stats.bosses.includes(boss);

export const UNLOCKS = [
  { id: 'request', icon: 'guildBoss', what: '조합 의뢰', desc: '나갈 때마다 작은 의뢰가 붙는다. 해내면 그 자리에서 일당을 준다', when: m => m.stats.runs >= 1 },
  { id: 'fang', relic: 'fang', when: m => m.stats.runs >= 1 },
  { id: 'weeds', icon: 'weed', what: '풀뽑기 밭', desc: '들판에 잡초 밭이 생긴다. 한 포기씩 뽑으면 일당. 가끔 뭔가 소리를 지른다', when: m => m.stats.maxFloor >= 2 },
  { id: 'hammer', relic: 'hammer', when: m => m.stats.maxFloor >= 2 },
  { id: 'keys', icon: 'key', what: '잠긴 상자와 열쇠', desc: '2구역부터 잠긴 상자가 있다. 열쇠는 같은 구역 어딘가에', when: m => m.stats.runs >= 2 && m.stats.maxFloor >= 2 },
  { id: 'bomb', icon: 'bomb', what: '폭탄', desc: '상자와 들판에서 폭탄이 나온다. 던지면 덤불도 바위도 날아간다', when: m => m.stats.maxFloor >= 3 },
  { id: 'ring', relic: 'ring', when: m => m.stats.maxFloor >= 3 },
  { id: 'candy', icon: 'candy', what: '별사탕', desc: '반짝 바위와 잡초 밭에서도 별사탕이 나온다. 먹으면 유물이 다다닥 자란다', when: m => beat(m, 'ratking') },
  { id: 'stall', icon: 'peddler', what: '보스 앞 좌판', desc: '보스 바로 앞 구역에 상점 주인이 좌판을 편다', when: m => beat(m, 'ratking') },
  { id: 'shelf', icon: 'shopkeep', what: '상점 유물 진열대', desc: '마을 상점에서 새 유물을 사서 들판에 풀 수 있다', when: m => beat(m, 'ratking') },
  { id: 'coin', relic: 'coin', when: m => broken(m) >= 4 },
  { id: 'ghost', icon: 'ghostNpc', what: '울보 아기새', desc: '들판 어딘가에서 아기새가 운다. 부탁을 들어주면 보답한다', when: m => m.stats.runs >= 3 },
  { id: 'hive', icon: 'hive', what: '꿀벌 그루터기', desc: '꿀단지를 먹으면 최대 체력이 오른다. 벌들은 화를 낸다', when: m => m.stats.maxFloor >= 4 },
  { id: 'rings', icon: 'fairyRing', what: '요정 고리', desc: '들어가면 멀리 있는 다른 고리로 뿅 나온다', when: m => m.stats.maxFloor >= 4 },
  { id: 'map', icon: 'map', what: '지도', desc: '구역 전체와 땅굴 자리를 보여 주는 지도가 나온다', when: m => m.stats.maxFloor >= 4 },
  { id: 'mint', relic: 'mint', when: m => m.stats.maxFloor >= 4 },
  { id: 'pick', relic: 'pick', when: m => broken(m) >= 8 },
  { id: 'turtle', icon: 'turtle', what: '반짝 거북', desc: '먼저 건드리지 않으면 싸우지 않는 거북. 쓰러뜨리면 보물을 떨군다', when: m => m.stats.kills >= 60 },
  { id: 'traps', icon: 'trapAlarm', what: '숨은 함정', desc: '함정이 늘고, 어떤 건 풀숲처럼 숨어 있다', when: m => m.stats.maxFloor >= 5 },
  { id: 'statue', icon: 'statue', what: '허수아비 방', desc: '허수아비가 지키는 상자. 집으면 허수아비가 걷기 시작한다', when: m => m.stats.maxFloor >= 5 },
  { id: 'mimic', icon: 'mimic', what: '소라게 상자', desc: '어떤 상자는 소라게가 눌러 산다', when: m => (m.stats.chests || 0) >= 10 },
  { id: 'smith', icon: 'mole', what: '떠돌이 대장장이', desc: '깊은숲 어딘가에 두더지 대장장이가 모루를 폈다', when: m => m.stats.maxFloor >= 5 },
  { id: 'vault', icon: 'pedestal', what: '수정 금고', desc: '유리 덮개 속 유물 셋 중 하나를 고른다. 열쇠는 같은 구역 어딘가에', when: m => beat(m, 'skelking') },
  { id: 'grave', icon: 'wraith', what: '도토리 창고', desc: '청설모들이 도토리를 묻어 둔 곳. 파 보면 뭐가 나올지 모른다', when: m => m.stats.maxFloor >= 6 },
  { id: 'spring', what: '온천', desc: '돌산 웅덩이 중엔 따뜻한 온천이 있다. 몸을 담그면 낫는다', when: m => m.stats.maxFloor >= 7 },
];

export const UNLOCK_BY_ID = Object.fromEntries(UNLOCKS.map(u => [u.id, u]));
// the basic relics that wait for an unlock before any card can offer them
export const RELIC_GATES = Object.fromEntries(UNLOCKS.filter(u => u.relic).map(u => [u.relic, u.id]));

export const isOpen = (meta, id) => !UNLOCK_BY_ID[id] || !!meta.open?.[id];

// What this trip's end opens (and records as open): a list of unlock entries, at most PER_TRIP.
export function openNew(meta) {
  meta.open ||= {};
  const out = [];
  for (const u of UNLOCKS) {
    if (out.length >= PER_TRIP) break;
    if (meta.open[u.id] || !u.when(meta)) continue;
    meta.open[u.id] = true;
    out.push(u);
  }
  return out;
}
