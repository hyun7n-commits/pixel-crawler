// The stage select, BALL x PIT style: where today's trip goes and at which 회차 (data/stages.js).
// Each stage is a card: a little picture of its ground, its name, its boss once met, whether it has
// been beaten at this 회차, what the guild sends you off with (출발 보급), and the friend waiting there (a dark shape until rescued). Stages not open
// yet show only as a locked shape, one more opening each time the one before is beaten.

import { el, button, icon } from './dom.js';
import { openSheet, closeModal } from './modal.js';
import { ZONES, ENEMIES } from '../data/enemies.js';
import { CHARACTERS } from '../data/characters.js';
import { FRIENDS, LOOPS, loopsOpen, stageOpen, cleared, loopFoe, loopGold } from '../data/stages.js';
import { daresOn, dareGold, DARE_BY_ID } from '../data/dares.js';
import { josa } from '../core/util.js';
import { isOpen } from '../data/unlocks.js';
import { stageKit } from '../data/balance.js';
import { wallArt, floorArt, shadeArt, waterArt, N, E, S, W_, NE, SE, SW, NW } from '../art/tiles.js';

// a small view of the zone's ground, cut from the field's own tiles: a strip of its wall over its
// floor, the wall's shade on the ground, a pool in the corner. A stage not open yet is a blank card with a ?
function swatch(z, s, open) {
  const T = 128, c = document.createElement('canvas');
  c.width = T * 3; c.height = T * 2; c.className = 'stage-pic';
  const g = c.getContext('2d');
  if (!open) {
    g.fillStyle = '#ead9bc'; g.fillRect(0, 0, c.width, c.height);
    g.font = '150px Jua, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#c9ab88'; g.fillText('?', c.width / 2, c.height / 2 + 8);
    return c;
  }
  for (let x = 0; x < 3; x++) {
    g.drawImage(wallArt(z, s, S | SE | SW, N, x % 3), x * T, 0, T, T);
    g.drawImage(floorArt(z, s, x === 1 ? 4 : 0), x * T, T, T, T);
    g.drawImage(shadeArt(N | E | W_ | NE | NW), x * T, T, T, T);
  }
  g.drawImage(waterArt(z, 0, N | W_ | NW | NE | SW), 2 * T, T, T, T);
  return c;
}

export function showStages({ meta, onGo, onClose }) {
  const top = loopsOpen(meta);
  let loop = Math.min(meta.loop || 1, top);
  const draw = sh => {
    sh.innerHTML = '';
    sh.append(el('h2', null, '어디로 갈까?'));
    // the 회차 tabs: only the ones open so far
    if (top > 1) {
      const tabs = el('div', 'loop-tabs');
      for (let l = 1; l <= top; l++) {
        const b = button('btn' + (l === loop ? ' on' : ''), `${l}회차`, () => { loop = l; draw(sh); });
        tabs.append(b);
      }
      sh.append(tabs);
      if (loop > 1) sh.append(el('p', 'loop-note', `${loop}회차: 들판 친구들 체력과 공격 +${Math.round((loopFoe(loop) - 1) * 100)}%, 골드 +${Math.round((loopGold(loop) - 1) * 100)}%`));
    } else if (LOOPS > 1) sh.append(el('p', 'loop-note', '다섯 스테이지를 다 깨면 더 어려운 2회차가 열린다.'));
    const dares = daresOn(meta);
    if (dares.length) sh.append(el('p', 'loop-note dare-note', `라이벌 내기 ${dares.length}개: ${dares.map(id => DARE_BY_ID[id].name).join(', ')} · 골드 ×${dareGold(dares.length).toFixed(1)}`));

    const list = el('div', 'stages');
    ZONES.forEach((z, s) => {
      const open = stageOpen(meta, s, loop), won = cleared(meta, s) >= loop;
      const card = el('div', 'stage' + (open ? '' : ' locked') + (won ? ' won' : ''));
      card.append(swatch(z, s, open));
      const info = el('div', 'stage-info');
      info.append(el('b', null, open ? `${s + 1}. ${z.name}` : `${s + 1}. ???`));
      const boss = ENEMIES[z.boss], met = meta.critters?.[z.boss];
      info.append(el('span', 'stage-sub', !open ? '앞 스테이지를 깨면 열린다'
        : won ? `${loop}회차 깼다 · 대장 ${boss.name}` : met ? `대장 ${boss.name}` : '대장: ???'));
      // 출발 보급: what the guild sends you off with into a deeper stage
      const kit = stageKit(s);
      if (open && kit.picks) info.append(el('span', 'stage-sub kit', `출발 보급: 유물 ${kit.picks}개, 공격 +${kit.atk}, 체력 +${kit.hp}`));
      card.append(info);
      // the friend locked up here at this 회차: a dark shape until rescued
      const fid = isOpen(meta, 'cage') && FRIENDS[s][loop - 1], got = fid && meta.chars[fid];
      if (fid && CHARACTERS[fid]) {
        const pal = el('span', 'stage-friend' + (got ? ' got' : ''));
        pal.append(icon(CHARACTERS[fid].sprite, 32));
        pal.title = got ? `${CHARACTERS[fid].kind} ${josa(CHARACTERS[fid].name, '을', '를')} 구했다` : '누군가 갇혀 있다';
        card.append(pal);
      }
      if (open) {
        const go = button('btn primary', '출발', () => { meta.stage = s; meta.loop = loop; closeModal(); onGo(); });
        card.append(go);
        card.classList.add('can');
      }
      list.append(card);
    });
    sh.append(list);
    sh.append(el('p', 'loop-note', `${josa(CHARACTERS[meta.sel].name, '으로', '로')} 나간다.${isOpen(meta, 'cage') ? ' 들판 어딘가 왕관 쓴 우두머리가 갇힌 친구의 우리 열쇠를 갖고 있다.' : ''}`));
  };
  openSheet(draw, () => { closeModal(); onClose?.(); });
}
