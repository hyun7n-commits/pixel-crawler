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
import { RELICS } from '../data/relics.js';

// a small view of the zone's ground: a strip of its wall over its floor, a pool in the corner
function swatch(z, open) {
  const c = document.createElement('canvas');
  c.width = 24; c.height = 16; c.className = 'pix stage-pic';
  const g = c.getContext('2d');
  if (!open) { g.fillStyle = '#16141f'; g.fillRect(0, 0, 24, 16); g.fillStyle = '#2a2638'; g.fillRect(0, 0, 24, 5); return c; }
  g.fillStyle = z.floor; g.fillRect(0, 0, 24, 16);
  g.fillStyle = z.floorDark;
  for (const [x, y] of [[3, 9], [9, 12], [15, 8], [20, 13], [6, 14], [12, 10]]) g.fillRect(x, y, 1, 1);
  g.fillStyle = z.floorLight;
  for (const [x, y] of [[5, 7], [17, 11], [11, 14], [2, 12]]) g.fillRect(x, y, 1, 1);
  g.fillStyle = z.wallFace; g.fillRect(0, 0, 24, 6);
  g.fillStyle = z.wallTop; g.fillRect(0, 0, 24, 4);
  g.fillStyle = z.wallLight; for (let x = 1; x < 24; x += 5) g.fillRect(x, 1, 2, 1);
  g.fillStyle = z.wallLine; g.fillRect(0, 6, 24, 1);
  g.fillStyle = z.water; g.fillRect(16, 10, 6, 4); g.fillRect(17, 9, 4, 6);
  g.fillStyle = z.waterLight; g.fillRect(18, 10, 2, 1);
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
    } else if (LOOPS > 1) sh.append(el('p', 'loop-note', '열 스테이지를 다 깨면 더 어려운 2회차가 열린다.'));
    const dares = daresOn(meta);
    if (dares.length) sh.append(el('p', 'loop-note dare-note', `라이벌 내기 ${dares.length}개: ${dares.map(id => DARE_BY_ID[id].name).join(', ')} · 골드 ×${dareGold(dares.length).toFixed(1)}`));
    // what the shop packed and the smith made to order go out with you, whichever stage it is
    const bag = [meta.forge, meta.pack].filter(Boolean);
    if (bag.length) {
      const note = el('p', 'loop-note packed-note');
      for (const id of bag) note.append(icon(id, 16), el('span', null, `${RELICS[id].name} 챙김`));
      sh.append(note);
    }

    const list = el('div', 'stages');
    ZONES.forEach((z, s) => {
      const open = stageOpen(meta, s, loop), won = cleared(meta, s) >= loop;
      const card = el('div', 'stage' + (open ? '' : ' locked') + (won ? ' won' : ''));
      card.append(swatch(z, open));
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
      const fid = isOpen(meta, 'cage') && FRIENDS[s]?.[loop - 1], got = fid && meta.chars[fid];
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
