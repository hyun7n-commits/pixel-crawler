// 들판의 일 (v0.30): little things that happen in a field now and then while you are about, five of
// each zone's own. Nothing to do with them but notice; the first time, a page in the 비밀 도감
// (data/book.js). Never on the very first trip out, never in the middle of a fight, one a field at most
// (core/wonders.js happen; how they look: scenes/DungeonScene.js happening).
//   kind: sound (a sound word somewhere at the edge of what you can see) · shower (bits drifting over
//   the field: `fx`) · flyby (`n` of a sprite crossing overhead) · peek (a critter peeks out of a bush
//   and ducks back) · fish (one jumps in a pond in view) · glow (`color` washes over the field; rainbow,
//   aurora) · glints (the walls sparkle) · parade (`n` little ones trotting past) · prints (a line of
//   footprints) · bubble (on the lava in view)
//   need: water / lava / landmark in view · up / wind: a shower that rises, or blows across · n: a sound
//   heard more than once

const H = (id, zone, name, line, kind, o = {}) => ({ id, zone, name, line, kind, ...o });

export const HAPPENINGS = [
  // 초원
  H('dandelion', 0, '홀씨 바람', '바람이 불자 민들레 홀씨가 한꺼번에 날아올랐다.', 'shower', { fx: 'fluff', up: true, pic: { spr: 'dandelion' } }),
  H('rainbow', 0, '작은 무지개', '하늘 한쪽에 작은 무지개가 걸렸다가 사라졌다.', 'glow', { color: 'rainbow', pic: { find: ['ribbon', 'ryb'] } }),
  H('lark', 0, '종달새', '종달새 한 마리가 하늘 높이 날아올랐다.', 'flyby', { spr: 'gull', n: 1, tint: 0xc9a27a, small: true, pic: { spr: 'gull' } }),
  H('cuckoo', 0, '뻐꾸기', '멀리서 뻐꾸기가 운다. 몇 번 우는지 세다가 잊어버렸다.', 'sound', { text: '뻐꾹', color: '#f4f0e8', n: 2, pic: { spr: 'gull', mark: '♪' } }),
  H('butterflies', 0, '나비 셋', '나비 세 마리가 줄지어 팔랑팔랑 지나갔다.', 'flyby', { spr: 'butterfly', n: 3, small: true, pic: { spr: 'butterfly' } }),
  // 깊은숲
  H('owl', 1, '부엉이', '어디선가 부엉이가 운다. 숲이 조금 더 어두워진 것 같다.', 'sound', { text: '부엉', color: '#d8c2ff', n: 2, pic: { find: ['feather', 'n'], mark: '♪' } }),
  H('leaffall', 1, '낙엽비', '바람에 나뭇잎이 우수수 떨어진다.', 'shower', { fx: 'leaf', pic: { find: ['leaf', 'g'] } }),
  H('fireflies', 1, '반딧불', '반딧불이 하나둘 켜지더니 금세 숲이 반짝반짝하다.', 'shower', { fx: 'firefly', up: true, pic: { find: ['star', 'v'] } }),
  H('peeker', 1, '덤불 속 눈', '덤불 사이로 누가 빼꼼 내다보다가 쏙 숨었다.', 'peek', { pic: { spr: 'hide_leaf1', mark: '?' } }),
  H('sporefall', 1, '반짝 포자', '거인 버섯에서 날린 포자가 반짝이며 내려앉는다.', 'shower', { fx: 'spore', pic: { spr: 'skel' } }),
  // 반딧불 늪
  H('chorus', 2, '개구리 합창', '개굴개굴, 늪 전체가 한꺼번에 노래하다가 뚝 그쳤다.', 'sound', { text: '개굴개굴', color: '#8fd36a', pic: { spr: 'frog', mark: '♪' } }),
  H('fishjump', 2, '물고기 점프', '물웅덩이에서 물고기가 퐁 뛰어올랐다.', 'fish', { need: 'water', pic: { spr: 'minnow' } }),
  H('mist', 2, '물안개', '물안개가 낮게 깔렸다가 천천히 걷혔다.', 'glow', { color: 0xe8f0f0, pic: { spr: 'ripple' } }),
  H('shower', 2, '여우비', '해가 났는데 빗방울이 후두둑 떨어지다 말았다.', 'shower', { fx: 'splash', pic: { spr: 'drip' } }),
  H('dragonfly', 2, '잠자리', '잠자리 한 마리가 머리 위를 맴돌다 갔다.', 'flyby', { spr: 'butterfly', n: 1, tint: 0x8fd8f0, small: true, pic: { spr: 'fly' } }),
  // 돌산
  H('rockfall', 4, '굴러가는 돌', '멀리서 돌멩이가 데구루루 굴러 내려간다.', 'sound', { text: '데구루루', color: '#b8bccb', pic: { spr: 'pebble', mark: '♪' } }),
  H('eagle', 4, '큰 그림자', '커다란 새 그림자가 머리 위를 스윽 지나갔다.', 'flyby', { spr: 'gull', n: 1, tint: 0x2c2536, big: true, pic: { find: ['feather', 'N'] } }),
  H('echo', 4, '메아리', '어디선가 메아리가 돌아왔다. 아무도 부르지 않았는데.', 'sound', { text: '…야호', color: '#f4f0e8', pic: { spr: 'prop_rock', mark: '♪' } }),
  H('gust', 4, '골짜기 바람', '골짜기 바람이 휘잉 불어 흙먼지가 일었다.', 'shower', { fx: 'dust', wind: true, pic: { find: ['feather', 'l'] } }),
  H('goatlook', 4, '산 위의 눈', '바위 위에서 누가 이쪽을 내려다보다가 사라졌다.', 'peek', { pic: { spr: 'prop_rock', mark: '?' } }),
  // 박쥐 동굴
  H('drip', 7, '물방울', '천장에서 물방울이 똑, 똑 떨어진다.', 'sound', { text: '똑', color: '#8fd8f0', n: 3, pic: { spr: 'drip', mark: '♪' } }),
  H('hum', 7, '수정 울림', '벽 속 수정들이 잠깐 웅웅 울리며 빛났다.', 'glints', { pic: { find: ['crystal', 'c'] } }),
  H('batswarm', 7, '박쥐 떼', '박쥐 떼가 머리 위로 우르르 지나갔다.', 'flyby', { spr: 'bat', n: 5, small: true, pic: { spr: 'bat' } }),
  H('glowcaps', 7, '빛 버섯', '발밑 빛 버섯들이 차례로 깜빡였다.', 'shower', { fx: 'magic', up: true, pic: { spr: 'prop_cave' } }),
  H('deepwind', 7, '깊은 바람', '동굴 깊은 곳에서 바람 소리가 올라온다. 숨소리 같기도 하다.', 'sound', { text: '휘이잉', color: '#b8bccb', pic: { spr: 'prop_cave', mark: '♪' } }),
  // 바닷가 절벽
  H('whale', 3, '고래', '먼바다에서 고래가 물을 높이 뿜었다.', 'sound', { text: '푸우', color: '#8fd8f0', pic: { spr: 'ripple', mark: '♪' } }),
  H('gulls', 3, '갈매기 떼', '갈매기 떼가 끼룩대며 바다 쪽으로 날아갔다.', 'flyby', { spr: 'gull', n: 4, small: true, pic: { spr: 'gull' } }),
  H('waves', 3, '큰 파도', '절벽 아래로 큰 파도가 부서졌다. 물보라가 여기까지 튄다.', 'shower', { fx: 'splash', pic: { spr: 'prop_sea' } }),
  H('crabs', 3, '게 행진', '아기 게 셋이 옆걸음으로 줄지어 지나갔다.', 'parade', { spr: 'crab', n: 3, pic: { spr: 'crab' } }),
  H('seaglint', 3, '물비늘', '바다 위 햇빛이 반짝반짝 물비늘이 되었다.', 'glints', { pic: { find: ['star', 'c'] } }),
  // 거인 꽃밭
  H('petals', 5, '꽃잎 비', '거인 꽃에서 꽃잎이 비처럼 쏟아졌다.', 'shower', { fx: 'berry', pic: { find: ['flower', 'q'] } }),
  H('bigbee', 5, '꿀벌 비행', '통통한 꿀벌 한 마리가 윙 하고 지나갔다.', 'flyby', { spr: 'bee', n: 1, pic: { spr: 'bee' } }),
  H('sunflower', 5, '해바라기 인사', '거인 해바라기가 천천히 고개를 이쪽으로 돌렸다.', 'glow', { color: 0xfff1a8, need: 'landmark', pic: { spr: 'prop_garden' } }),
  H('dew', 5, '이슬', '풀잎마다 맺힌 이슬이 한꺼번에 반짝였다.', 'glints', { pic: { find: ['marble', 'c'] } }),
  H('ladyflight', 5, '무당벌레 비행', '무당벌레가 날개를 펴고 붕 날아갔다.', 'flyby', { spr: 'ladybug', n: 1, small: true, pic: { spr: 'ladybug' } }),
  // 눈 고원
  H('snowfall', 6, '함박눈', '함박눈이 소리 없이 내리기 시작했다.', 'shower', { fx: 'fluff', pic: { find: ['flake', 'c'] } }),
  H('avalanche', 6, '먼 눈사태', '멀리서 눈 무너지는 소리가 났다.', 'sound', { text: '쿠르릉', color: '#c8f6ff', pic: { spr: 'snowmound', mark: '♪' } }),
  H('aurora', 6, '오로라', '하늘에 초록빛 커튼이 일렁였다.', 'glow', { color: 'aurora', pic: { find: ['ribbon', 'g'] } }),
  H('hareprints', 6, '작은 발자국', '눈 위에 작은 발자국이 줄지어 나 있다. 어디로 갔을까.', 'prints', { pic: { spr: 'snowhare' } }),
  H('icicle', 6, '고드름', '어디선가 고드름이 떨어져 쨍그랑 깨졌다.', 'sound', { text: '쨍그랑', color: '#c8f6ff', pic: { find: ['shard', 'c'], mark: '♪' } }),
  // 불꽃 화산
  H('ashfall', 8, '화산재', '하늘에서 회색 재가 눈처럼 내린다.', 'shower', { fx: 'dust', pic: { spr: 'ash' } }),
  H('embers', 8, '불티', '불티가 바람을 타고 춤추듯 날아올랐다.', 'shower', { fx: 'ember', up: true, pic: { spr: 'coalLit' } }),
  H('rumble', 8, '땅 울림', '발밑에서 땅이 낮게 우르릉 울렸다.', 'sound', { text: '우르릉', color: '#ffb062', pic: { spr: 'vent', mark: '♪' } }),
  H('lavabubble', 8, '용암 거품', '용암 웅덩이에서 커다란 거품이 부풀다가 퐁 터졌다.', 'bubble', { need: 'lava', pic: { find: ['marble', 'o'] } }),
  H('smokering', 8, '연기 고리', '땅 틈에서 연기가 동그란 고리 모양으로 피어올랐다.', 'shower', { fx: 'steam', up: true, pic: { find: ['ring', 'l'] } }),
  // 옛 조합 터
  H('bell', 9, '종소리', '어디선가 종이 한 번 울렸다. 남아 있는 종은 없는데.', 'sound', { text: '데엥', color: '#f4cf4f', pic: { spr: 'bell', mark: '♪' } }),
  H('siren', 9, '사이렌', '멀리서 오래된 사이렌이 짧게 울리다 멈췄다.', 'sound', { text: '삐이이', color: '#ff8080', pic: { find: ['whistle', 'r'], mark: '♪' } }),
  H('paper', 9, '날아가는 서류', '바람에 낡은 서류 한 장이 날아갔다. 숫자만 빽빽하다.', 'flyby', { spr: 'letter', n: 1, find: true, pic: { find: ['letter', 'w'] } }),
  H('worker', 9, '불빛 끝의 그림자', '불빛 끝에 누가 서 있었던 것 같다. 다시 보니 아무도 없다.', 'peek', { spr: 'maskman', pic: { spr: 'maskman', mark: '?' } }),
  H('clock', 9, '시계 소리', '어디선가 시계 소리가 들린다. 째깍, 째깍. 출근 시간인가 보다.', 'sound', { text: '째깍', color: '#f4f0e8', n: 2, pic: { find: ['coin', 'y'], mark: '♪' } }),
];
export const HAPPEN = Object.fromEntries(HAPPENINGS.map(h => [h.id, h]));
export const happenId = id => `happen:${id}`;
