// One-line explanations for whatever is under the mouse, so nothing needs to be memorised.

import { T, TERRAIN, TILE_INFO, GASES, GAS_KEYS } from '../data/terrain.js';
import { ORE_HITS } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { idx, inMap, STAIRS, DOOR, ORE, UPSTAIRS } from '../core/dungeon.js';

const STATE = {
  sleep: '자는 중. 콧방울이 작아지면 곧 깬다',
  wander: '어슬렁거리는 중',
  hunt: '나를 쫓는 중',
  search: '나를 찾는 중',
  flee: '도망치는 중',
};

export function playerStatus(p, hidden) {
  const s = [];
  if (p.sleep) s.push('잠듦');
  if (p.stun) s.push('기절');
  if (p.burn) s.push('불붙음');
  if (hidden) s.push('숨음');
  return s;
}

export function describeTile(run, x, y) {
  if (!inMap(x, y)) return '';
  const map = run.map, i = idx(x, y), p = run.p;
  if (!map.explored[i]) return '';
  const lines = [];
  if (x === p.x && y === p.y) {
    const st = playerStatus(p, run.playerHidden());
    lines.push(`나${st.length ? ` · ${st.join(', ')}` : ''}`);
  }
  const e = run.enemyAt(x, y);
  if (e && run.isVisible(x, y)) {
    lines.push(`${e.d.name} · 체력 ${e.hp}/${e.maxHp} · 공격 ${e.atk} · ${STATE[e.state] || ''}${e.d.tip ? ` · ${e.d.tip}` : ''}`);
  }
  const t = map.tiles[i];
  if (t === STAIRS) lines.push(`${TILE_INFO.stairs.name}: ${TILE_INFO.stairs.tip}`);
  if (t === UPSTAIRS) lines.push(`${TILE_INFO.upStairs.name}: ${TILE_INFO.upStairs.tip}`);
  if (t === DOOR) lines.push(`${TILE_INFO.door.name}: ${TILE_INFO.door.tip}`);
  if (t === ORE && map.ore) lines.push(`${TILE_INFO.bigOre.name} (${map.ore.hits}/${ORE_HITS}): ${TILE_INFO.bigOre.tip}`);
  const ter = map.ter[i];
  if (ter !== T.NONE && TERRAIN[ter]) lines.push(`${TERRAIN[ter].name}: ${TERRAIN[ter].tip}`);
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
    lines.push(q.type === 'gold' ? `골드 ${q.amount}` : q.type === 'chest' ? '보물 상자: 열면 유물을 하나 고른다.' : `${ITEMS[q.type].name}: ${ITEMS[q.type].desc}`);
  }
  return lines.join('\n');
}
