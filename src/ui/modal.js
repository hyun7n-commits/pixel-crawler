// Pop-up sheets: relic choice (level up / chest) and the end-of-run summary.

import { $, el, button, icon } from './dom.js';
import { RELICS } from '../data/relics.js';
import { recipeFor } from './recipe.js';
import { DISCOVERIES } from '../data/terrain.js';

export const modalOpen = () => !$('modal').hidden;

export function closeModal() {
  const m = $('modal');
  m.hidden = true;
  m.innerHTML = '';
}

function openSheet(build) {
  const m = $('modal');
  m.innerHTML = '';
  const sh = el('div', 'sheet');
  build(sh);
  m.append(sh);
  m.hidden = false;
  setTimeout(() => sh.querySelector('button')?.focus(), 0);
}

// opts: [{kind:'relic', id} | {kind:'heal'} | {kind:'gold', name?, amount?} | {kind:'ok', name, desc}]
// `who`: a sprite shown beside the title (quest folk talking)
export function showChoice({ title, sub, run, opts, onPick, onReroll, who }) {
  openSheet(sh => {
    if (who) {
      const head = el('div', 'talk-head');
      head.append(icon(who, 48), el('h2', null, title));
      sh.append(head, el('p', 'talk-text', sub));
    } else sh.append(el('h2', null, title), el('p', null, sub));
    const wrap = el('div', 'choices');
    opts.forEach((o, i) => {
      const b = button('choice', null, () => { closeModal(); onPick(o); });
      b.dataset.key = String(i + 1);
      const info = el('div');
      if (o.kind === 'relic') {
        const r = RELICS[o.id], cur = run.p.relics[o.id] || 0;
        b.append(icon(o.id));
        info.append(
          el('span', 'nm', r.name),
          el('span', cur ? 'tag' : 'tag new', cur ? `Lv${cur} → Lv${cur + 1}` : '새 유물'),
          el('span', 'ds', r.desc(cur + 1)),
        );
        const rc = recipeFor(run, o.id, o.id);
        if (rc) info.append(rc);
      } else if (o.kind === 'heal') {
        b.append(icon('heal'));
        info.append(el('span', 'nm', '응급 치료'), el('span', 'ds', '체력 50% 회복'));
      } else if (o.kind === 'ok') {
        info.append(el('span', 'nm', o.name), el('span', 'ds', o.desc));
      } else {
        b.append(icon('gold'));
        info.append(el('span', 'nm', o.name || '금화 주머니'), el('span', 'ds', `골드 +${o.amount || 25}`));
      }
      b.append(info);
      wrap.append(b);
    });
    sh.append(wrap);
    if (run.rerolls > 0 && onReroll) {
      const foot = el('div', 'sheet-foot');
      foot.append(button('btn', `다시 뽑기 (${run.rerolls}회 남음)`, onReroll));
      sh.append(foot);
    }
  });
}

export function showSummary({ won, run, newlyUnlockable, onClose }) {
  openSheet(sh => {
    sh.append(el('h2', null, won ? '던전을 정복했다!' : '쓰러졌다'));
    if (!won && run.cause) sh.append(el('p', 'cause', `마지막 순간: ${run.cause}`));
    sh.append(el('p', null, won
      ? '뱀파이어 군주를 쓰러뜨렸다. 보너스 골드 200을 받았다.'
      : '모은 골드는 그대로 가져간다. 마을에서 강해진 다음 다시 도전하자.'));
    const sum = el('div', 'summary');
    for (const [v, l] of [[`${run.floor}층`, '도달한 층'], [run.kills, '쓰러뜨린 적'], [`Lv${run.p.lvl}`, '레벨'], [`+${run.gold}`, '가져가는 골드']]) {
      const s = el('div', 'stat');
      s.append(el('b', null, String(v)), el('span', null, l));
      sum.append(s);
    }
    sh.append(sum);
    if (run.found.length) {
      const names = run.found.map(id => DISCOVERIES.find(d => d.id === id)).map(d => `${d.combo} = ${d.result}`);
      sh.append(el('div', 'unlock-note', `이번에 새로 발견한 것: ${names.join(' · ')}`));
    }
    if (newlyUnlockable.length) {
      sh.append(el('div', 'unlock-note', `새 캐릭터 조건 달성: ${newlyUnlockable.join(', ')}. 마을에서 골드로 데려올 수 있다.`));
    }
    const foot = el('div', 'sheet-foot');
    foot.append(button('btn primary', '마을로 돌아가기', () => { closeModal(); onClose(); }));
    sh.append(foot);
  });
}
