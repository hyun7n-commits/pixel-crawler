// One-line explanations for whatever is under the mouse, so nothing needs to be memorised.

import { T, TERRAIN, TILE_INFO, GASES, GAS_KEYS } from '../data/terrain.js';
import { ORE_HITS, candySteps } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { ORES } from '../data/ores.js';
import { idx, inMap, STAIRS, DOOR, ORE, UPSTAIRS, WALL, GRAVE, LOCKED, HIVE, WEED } from '../core/dungeon.js';
import { RELICS } from '../data/relics.js';
import { cheb } from '../core/util.js';

const CHEST = '보물 상자: 열면 유물을 하나 고른다.';
const PICKUP = {
  chest: () => CHEST,
  lockedChest: () => '잠긴 상자: 이 구역의 열쇠로 열면 유물을 넷 중 하나 고른다.',
  bossChest: () => '대장의 보물 상자: 열면 탐험 성공. 골드가 한가득 나오고 가방 속 유물이 모두 자란다.',
  key: () => '작은 열쇠: 이 구역의 잠긴 문이나 상자를 연다.',
  cageKey: () => '우리 열쇠: 우두머리가 물고 있던 열쇠. 갇힌 친구의 우리를 연다.',
  necklace: () => '아기새 리본: 울보 아기새의 것이다.',
  tag: () => '낡은 일꾼 명찰: 조합 명찰이다. 이름 자리가 긁혀 있다.',
  candy: (q, run) => `별사탕: 먹으면 가진 유물들이 한꺼번에 ${q.n || candySteps(run.floor)}번 자란다.`,
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
  const shaded = e?.d.shade && cheb(e, p) > e.d.shade && !e.stun && !e.burn;
  if (e && run.isVisible(x, y) && !shaded) {
    if (e.state === 'hide') lines.push(CHEST); // a mimic looks just like one
    else if (e.state === 'lurk') lines.push('수상한 거품: 물 밑에서 보글보글 거품이 올라온다. 뭔가 숨어 있다.');
    else if (e.diving) lines.push(`${e.d.name}: 물속에 들어가 있다. 곧 튀어나온다!`);
    else if (e.state === 'stone') lines.push(`${e.d.name}: ${e.d.stoneTip}`);
    else if (e.d.npc) lines.push(`${e.d.name}: ${e.d.tip}`);
    else lines.push(`${e.chief ? '우두머리 ' : ''}${e.d.name} · 체력 ${e.hp}/${e.maxHp} · 공격 ${e.atk} · ${STATE[e.state] || ''}${e.d.tip ? ` · ${e.d.tip}` : ''}`);
  }
  const t = map.tiles[i], lm = map.landmark;
  if (t === WALL && lm && x >= lm.x && x < lm.x + lm.w && y >= lm.y && y < lm.y + lm.h) lines.push(`${lm.name}: ${lm.tip}`);
  else if (t === WALL && map.props?.[i]) lines.push(`${PROP_NAME[run.zone.style] || TILE_INFO.prop.name}: ${TILE_INFO.prop.tip}`);
  if (map.drips?.some(o => o.x === x && o.y === y)) lines.push(`${TILE_INFO.drip.name}: ${TILE_INFO.drip.tip}`);
  if (map.flies?.some(o => o.x === x && o.y === y)) lines.push(`${TILE_INFO.fly.name}: ${TILE_INFO.fly.tip}`);
  if (t === STAIRS) lines.push(`${TILE_INFO.stairs.name}: ${TILE_INFO.stairs.tip}`);
  if (t === UPSTAIRS) lines.push(`${TILE_INFO.upStairs.name}: ${TILE_INFO.upStairs.tip}`);
  if (t === DOOR) lines.push(`${TILE_INFO.door.name}: ${TILE_INFO.door.tip}`);
  if (t === LOCKED) lines.push(`${TILE_INFO.locked.name}: ${TILE_INFO.locked.tip}${map.keyHeld ? ' 열쇠가 있다!' : ''}`);
  if (t === GRAVE) { const g = TILE_INFO[map.bigGrave === i ? 'graveBig' : 'grave']; lines.push(`${g.name}: ${g.tip}`); }
  if (t === HIVE) { const g = TILE_INFO[map.hive?.honey ? 'hive' : 'hiveEmpty']; lines.push(`${g.name}: ${g.tip}`); }
  if (t === WEED) lines.push(`${TILE_INFO.weed.name}: ${TILE_INFO.weed.tip}`);
  const ore = t === ORE && map.ores.find(o => o.cells.some(c => idx(c.x, c.y) === i));
  if (ore) {
    const what = ore.size > 1 ? `${['', '', '두 칸짜리', '세 칸짜리', '네 칸짜리'][ore.size]} ${ORES[ore.tier].name} 반짝 바위` : `${ORES[ore.tier].name} 반짝 바위`;
    lines.push(`${what} (${ore.hits}/${ORE_HITS}): ${TILE_INFO.bigOre.tip}${ore.size > 1 ? ' 바위가 클수록 많이 나온다.' : ''}`);
  }
  const ter = map.ter[i];
  if (map.spring?.includes(i)) lines.push('온천: 따끈한 물. 들어가 있으면 체력이 조금씩 찬다. 적도 마찬가지다. 불도 꺼진다.');
  else if (ter !== T.NONE && TERRAIN[ter] && !map.hidden[i]) lines.push(`${TERRAIN[ter].name}: ${TERRAIN[ter].tip}`);
  if (map.fire[i] && map.visible[i]) lines.push(`${TILE_INFO.fire.name}: ${TILE_INFO.fire.tip}`);
  if (map.visible[i]) {
    for (const k of GAS_KEYS) {
      if (map.gas[k][i] < 0.5) continue;
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
