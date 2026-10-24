// One-line explanations for whatever is under the mouse, so nothing needs to be memorised.

import { T, TERRAIN, TILE_INFO, GASES, GAS_KEYS } from '../data/terrain.js';
import { ORE_HITS, candySteps } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { ROUTES } from '../data/routes.js';
import { ORES } from '../data/ores.js';
import { idx, inMap, STAIRS, DOOR, ORE, UPSTAIRS, WALL, GRAVE, LOCKED, HIVE, WEED } from '../core/dungeon.js';
import { RELICS } from '../data/relics.js';
import { josa } from '../core/util.js';
import { TRINKET } from '../data/trinkets.js';
import { oddName, oddTip } from '../core/wonders.js';

// 숨은 방 (v0.30): the way into a hidden room, untouched and after each hit
const NOOK_TIP = {
  leaf: ['덤불이 살짝 헤쳐져 있다. 틈으로 바람이 솔솔 새어 나온다.', '덤불이 반쯤 헤쳐졌다. 안쪽이 휑하다.', '덤불이 거의 다 헤쳐졌다. 한 번만 더!'],
  rock: ['바위에 금이 가 있다. 틈으로 바람이 새어 나온다.', '금이 쩍 벌어졌다. 두드리면 안쪽에서 텅 빈 소리가 난다.', '바위가 금방이라도 무너질 것 같다. 한 번만 더!'],
};

const CHEST = '보물 상자: 열면 유물을 하나 고른다.';
const PICKUP = {
  chest: q => (q.rich ? '금테 상자: 좋은 상자다. 열면 유물을 넷 중 하나 고른다.' : CHEST),
  lockedChest: () => '잠긴 상자: 이 구역의 열쇠로 열면 유물을 넷 중 하나 고른다.',
  bossChest: () => '대장의 보물 상자: 열면 탐험 성공. 골드가 한가득 나오고 가방 속 유물이 모두 자란다.',
  key: () => '작은 열쇠: 이 구역의 잠긴 문이나 상자를 연다.',
  cageKey: () => '우리 열쇠: 우두머리가 물고 있던 열쇠. 갇힌 친구의 우리를 연다.',
  necklace: () => '아기새 리본: 울보 아기새의 것이다.',
  tag: () => '낡은 일꾼 명찰: 조합 명찰이다. 이름 자리가 긁혀 있다.',
  candy: (q, run) => `별사탕: 먹으면 가진 유물들이 한꺼번에 ${q.n || candySteps(run.floor)}번 자란다.`,
  glint: () => '반짝이는 흙: 뭔가 묻혀 있다.',
  cairn: q => q.used ? '돌탑: 누가 소원을 빌며 쌓아 둔 돌탑이다.' : '돌탑: 누가 소원을 빌며 쌓아 둔 돌탑이다. 왠지 마음이 편안해진다.',
  trinket: q => `${TRINKET[q.id]?.name || '작은 것'}: 누가 떨어뜨렸을까.`,
  crystal: (q, run) => {
    const lv = (run.p.relics[q.relic] || 0) + 1;
    return `유리 종 속 유물: ${RELICS[q.relic].name} Lv${lv}, ${RELICS[q.relic].desc(lv)}. 하나를 가지면 나머지 유리 종은 깨진다.`;
  },
};

const STATE = {
  sleep: '자는 중. 콧방울이 작아지면 곧 깬다',
  wander: '어슬렁거리는 중',
  hunt: '나를 쫓는 중',
  search: '나를 찾는 중',
  flee: '도망치는 중',
};

export function playerStatus(p) {
  const s = [];
  if (p.sleep) s.push('잠듦');
  if (p.stun) s.push('기절');
  if (p.burn) s.push('불붙음');
  if (p.vanish > 0) s.push('모습 사라짐');
  if (p.invuln > 0) s.push('무적');
  return s;
}

// what a lone wall standing in a room is, by zone
const PROP_NAME = { meadow: '둥근 덤불', forest: '그루터기', marsh: '갈대 무더기', rock: '바위', cave: '석순',
  sea: '따개비 바위', garden: '거인 꽃봉오리', snow: '얼음덩이', volcano: '식은 용암 덩이', ruins: '부러진 기둥' };

// by the sea, rock with no ground beside it is the sea far below the cliffs (see DungeonScene.buildTile)
function farSea(run, x, y) {
  const map = run.map;
  if (run.zone.style !== 'sea') return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!inMap(x + dx, y + dy)) continue;
    const j = idx(x + dx, y + dy);
    if (map.tiles[j] !== WALL && ![T.CHASM, T.BRIDGE].includes(map.ter[j])) return false;
  }
  return true;
}

export function describeTile(run, x, y, always = false) {
  if (!inMap(x, y)) return '';
  const map = run.map, i = idx(x, y), p = run.p;
  if (!map.explored[i]) return '';
  const lines = [];
  if (x === p.x && y === p.y) {
    const st = playerStatus(p);
    lines.push(`나${st.length ? ` · ${st.join(', ')}` : ''}`);
  }
  const e = run.enemyAt(x, y);
  // 그림자 고양이 farther than its reach is not there as far as you can tell
  const shaded = e && run.shaded(e);
  if (e && run.isVisible(x, y) && !shaded) {
    if (e.state === 'hide') lines.push(CHEST); // a mimic looks just like one
    else if (e.state === 'lurk') lines.push('수상한 거품: 물 밑에서 보글보글 거품이 올라온다. 뭔가 숨어 있다.');
    else if (e.diving) lines.push(`${e.d.name}: 물속에 들어가 있다. 곧 튀어나온다!`);
    else if (e.state === 'stone') lines.push(`${e.d.name}: ${e.d.stoneTip}`);
    else if (e.d.npc) lines.push(`${e.d.name}: ${e.d.tip}`);
    else {
      // stars round its head: a blow now is a surprise attack (run.unaware)
      const dizzy = run.dizzy(e) && !['sleep', 'wander', 'search'].includes(e.state) ? '어질어질해서 지금 치면 기습' : '';
      const fire = e.burn > 0 ? '불붙음' : '';
      // the meadow tools at work: a chili still burning its tongue, honey holding its feet
      const hot = e.fear > 0 ? `매워서 달아나는 중 (${e.fear}턴)` : '';
      const stuck = e.stun > 0 && map.ter[i] === T.HONEY ? '꿀에 붙어 꼼짝 못 함' : '';
      // 낮잠 방: one of the heap
      const heap = e.den && e.state === 'sleep' ? '모여 자는 중. 하나가 깨면 다 같이 깬다' : '';
      // 다툼: busy with another critter, it pays you no mind
      const foe = e.foe != null && run.enemies.find(o => o.id === e.foe && o.hp > 0);
      const scrap = foe ? `${josa(foe.d.name, '과', '와')} 싸우는 중. 나는 안중에도 없다 (지금 치면 기습)` : '';
      // 심술 버섯: cross with everyone
      const cross = e.grump > 0 ? `심술 나서 옆에 있는 녀석을 무는 중 (${e.grump}턴)` : '';
      // 도토리 다람쥐 with a pinecone in its paws
      const busy = e.belly ? '배 속에서 방울이 딸랑거려 딸꾹질하는 중 (지금 치면 기습)' : e.juggle > 0 ? '코끝에 솔방울을 올리고 묘기를 부리는 중. 나는 안중에도 없다 (지금 치면 기습)' : e.bury > 0 ? '솔방울을 묻으러 가는 중. 나는 안중에도 없다 (지금 치면 기습)' : e.sweetT > 0 ? (e.toy ? '방울을 갖고 노느라 정신이 없다 (지금 치면 기습)' : '쏟아진 꿀에 정신이 팔려 있다') : '';
      // 버릇 (v0.30): caught at one of its habits
      const habit = e.habitT > 0 && e.habitName ? `딴짓하는 중 (${e.habitName}). 나는 안중에도 없다 (지금 치면 기습)` : '';
      const how = [hot || stuck || cross || scrap || busy || habit || dizzy || heap || oddTip(e) || STATE[e.state] || '', fire].filter(Boolean).join(', ');
      // the gentle odd ones never fight: no numbers for those
      if (e.meek && !e.scared) lines.push(`${oddName(e)} · ${how}`);
      else lines.push(`${e.chief ? '우두머리 ' : e.big ? '기세등등한 ' : ''}${oddName(e)} · 체력 ${e.hp}/${e.maxHp} · 공격 ${e.atk} · ${how}${e.d.tip ? ` · ${e.d.tip}` : ''}`);
    }
  }
  const t = map.tiles[i], lm = map.landmark;
  if (t === WALL && lm && x >= lm.x && x < lm.x + lm.w && y >= lm.y && y < lm.y + lm.h) lines.push(`${lm.name}: ${lm.tip}`);
  else if (t === WALL && map.props?.[i]) lines.push(`${PROP_NAME[run.zone.style] || TILE_INFO.prop.name}: ${TILE_INFO.prop.tip}`);
  if (map.drips?.some(o => o.x === x && o.y === y)) lines.push(`${TILE_INFO.drip.name}: ${TILE_INFO.drip.tip}`);
  if (map.nests?.includes(i) && !e) lines.push('짚 잠자리: 낮잠 방 녀석이 웅크리고 자던 자리다. 아직 따뜻하다.');
  if (map.well && map.well.x === x && map.well.y === y) lines.push(map.well.dry ? '마른 우물: 바닥이 드러났다. 소원은 한 번뿐이었다.'
    : '소원 우물: 다가가서 유물을 하나 던져 넣으면 같은 레벨의 다른 유물로 바뀌어 떠오른다. 한 번뿐이다.');
  const bell = map.bells?.find(o => o.x === x && o.y === y && o.frog == null);
  if (bell) lines.push(`방울: 딸랑딸랑 울리는 중 (${bell.t}턴 더). 나를 못 보는 적은 이리로 온다. 다 울리면 주울 수 있다.`);
  if (map.flies?.some(o => o.x === x && o.y === y)) lines.push(`${TILE_INFO.fly.name}: ${TILE_INFO.fly.tip}`);
  // 숨은 방 (v0.30): what a sharp eye makes of its way in (never what is behind it)
  const nook = map.nook;
  if (nook?.gap === i && nook.hits != null) lines.push(`${run.zone.wallName}: ${NOOK_TIP[nook.kind][Math.min(2, nook.hits)]}`);
  const seam = map.seams?.find(o => o.i === i && o.left > 0);
  if (seam) lines.push(seam.kind === 'gem' ? `반짝 광맥: 벽에 보석이 ${seam.left}개 박혀 있다. 부딪쳐서 하나씩 캔다. 캘수록 값지고, 소리도 커진다.`
    : `황금 도토리: 덤불에 ${seam.left}개 걸려 있다. 부딪쳐서 하나씩 털어 낸다. 털수록 값지고, 소리도 커진다.`);
  if (t === STAIRS) {
    // 갈림길: the sign by the hole says what the field past it has
    const r = map.routes?.find(o => o.x === x && o.y === y);
    lines.push(`${TILE_INFO.stairs.name}: ${TILE_INFO.stairs.tip}${r ? `\n표지판: 이 굴 너머 들판엔 ${ROUTES[r.kind].sign}.` : ''}`);
  }
  if (t === UPSTAIRS) lines.push(`${TILE_INFO.upStairs.name}: ${TILE_INFO.upStairs.tip}`);
  if (t === DOOR) lines.push(`${TILE_INFO.door.name}: ${TILE_INFO.door.tip}`);
  if (t === LOCKED) lines.push(`${TILE_INFO.locked.name}: ${TILE_INFO.locked.tip}${map.keyHeld ? ' 열쇠가 있다!' : ''}`);
  if (t === GRAVE) { const g = TILE_INFO[map.bigGrave === i ? 'graveBig' : 'grave']; lines.push(`${g.name}: ${g.tip}`); }
  if (t === HIVE) { const g = TILE_INFO[map.hive?.honey ? 'hive' : 'hiveEmpty']; lines.push(`${g.name}: ${g.tip}`); }
  if (t === WEED) lines.push(`${TILE_INFO.weed.name}: ${TILE_INFO.weed.tip}`);
  const ore = t === ORE && map.ores.find(o => o.cells.some(c => idx(c.x, c.y) === i));
  if (ore) {
    const what = ore.size > 1 ? `${['', '', '두 칸짜리', '세 칸짜리', '네 칸짜리'][ore.size]} ${ORES[ore.tier].name} 반짝 바위` : `${ORES[ore.tier].name} 반짝 바위`;
    if (ore.pebble) lines.push(`작은 ${ORES[ore.tier].name} 반짝 바위 (${ore.hits}/2): 굳어 버린 녀석이다. 두 번이면 깨진다.`);
    else lines.push(`${what} (${ore.hits}/${ORE_HITS}): ${TILE_INFO.bigOre.tip}${ore.size > 1 ? ' 바위가 클수록 많이 나온다.' : ''}`);
  }
  const ter = map.ter[i];
  if (map.spring?.includes(i)) lines.push('온천: 따끈한 물. 들어가 있으면 체력이 조금씩 찬다. 적도 마찬가지다. 불도 꺼진다.');
  else if (ter !== T.NONE && TERRAIN[ter] && !map.hidden[i]) lines.push(`${TERRAIN[ter].name}: ${TERRAIN[ter].tip}`);
  if (map.fire[i] && map.visible[i]) lines.push(`${TILE_INFO.fire.name}: ${TILE_INFO.fire.tip}`);
  if (map.visible[i]) {
    for (const k of GAS_KEYS) {
      if (!(map.gas[k]?.[i] >= 0.5)) continue;
      const extra = k === 'mine' && run.meta.found.fire_mine ? ' 불이 닿으면 한꺼번에 터진다!' : '';
      lines.push(`${GASES[k].name}: ${GASES[k].tip}${extra}`);
    }
  }
  for (const q of run.pickups) {
    if (q.x !== x || q.y !== y) continue;
    lines.push(q.type === 'gold' ? `골드 ${q.amount}` : PICKUP[q.type] ? PICKUP[q.type](q, run) : `${ITEMS[q.type].name}: ${ITEMS[q.type].desc}`);
  }
  // a long press on a phone should always answer with something
  if (!lines.length && always) {
    lines.push(t === WALL && farSea(run, x, y) ? '바다: 절벽 저 아래에서 파도가 철썩인다. 여기로는 못 내려간다.'
      : t === WALL ? `${run.zone.wallName}: ${TILE_INFO.wall.tip}` : `${TILE_INFO.floor.name}: ${TILE_INFO.floor.tip}`);
  }
  return lines.join('\n');
}
