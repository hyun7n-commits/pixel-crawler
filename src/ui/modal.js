// Pop-up sheets: relic choice (level up / chest), the end-of-run summary, and talking in the village.

import { $, el, button, icon } from './dom.js';
import { RELICS, recipeKey, tierOf } from '../data/relics.js';
import { recipeFor } from './recipe.js';
import { josa } from '../core/util.js';
import { DISCOVERIES } from '../data/terrain.js';
import { STALL } from '../data/npcs.js';

export const modalOpen = () => !$('modal').hidden;
let talkClose = null; // set while a villager's talk sheet is open

export function closeModal() {
  const m = $('modal');
  m.hidden = true;
  m.innerHTML = '';
  m.onclick = null;
  talkClose = null;
}

// `onX`: the sheet gets a ✕ in its top right corner that stays put while the sheet scrolls
function openSheet(build, onX) {
  const m = $('modal');
  m.innerHTML = '';
  const sh = el('div', 'sheet');
  build(sh);
  if (onX) {
    const box = el('div', 'sheet-box'), x = button('x-close', '✕', onX);
    x.setAttribute('aria-label', '닫기');
    box.append(sh, x);
    m.append(box);
  } else m.append(sh);
  m.hidden = false;
  setTimeout(() => sh.querySelector('button')?.focus({ preventScroll: true }), 0);
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
    if (opts.some(o => o.kind === 'buy')) {
      const purse = el('p', 'stall-purse');
      purse.append(icon('gold', 18), el('span', null, `가진 골드 ${run.gold}G`));
      sh.append(purse);
    }
    const wrap = el('div', 'choices');
    opts.forEach((o, i) => {
      const b = button('choice', null, () => { closeModal(); onPick(o); });
      b.dataset.key = String(i + 1);
      const info = el('div');
      if (o.kind === 'relic') {
        const r = RELICS[o.id], cur = run.p.relics[o.id] || 0, evo = run.evolvesWith(o.id);
        b.append(icon(o.id));
        // a card that completes a recipe you know glows, and says what it turns into
        if (evo) b.classList.add('ready');
        info.append(
          el('span', 'nm', r.name),
          el('span', evo ? 'tag ready' : cur ? 'tag' : 'tag new', evo ? `진화! → ${RELICS[evo.id].name}` : cur ? `Lv${cur} → Lv${cur + 1}` : '새 유물'),
          el('span', 'ds', r.desc(cur + 1)),
        );
        const rc = recipeFor(run, o.id, o.id);
        if (rc) info.append(rc);
      } else if (o.kind === 'fuse') {
        // two full relics squeezed into one slot: both icons melt into one
        const pic = el('span', 'fuse-pic');
        pic.append(icon(o.a), el('span', 'rc-op', '+'), icon(o.b));
        b.append(pic);
        info.append(el('span', 'nm', '합체'), el('span', 'tag', '칸 하나 비우기'),
          el('span', 'ds', `${josa(RELICS[o.a].name, '과', '와')} ${josa(RELICS[o.b].name, '을', '를')} 한 칸에. 효과는 그대로, 더 자라지는 않는다.`));
      } else if (o.kind === 'twin') {
        // two of yours grow at once
        const pic = el('span', 'fuse-pic twin-pic');
        pic.append(icon(o.a), icon(o.b));
        b.append(pic);
        const lv = id => run.p.relics[id] || 0;
        info.append(el('span', 'nm', '둘 다 쑥쑥'), el('span', 'tag', '두 개 +1'),
          el('span', 'ds', `${RELICS[o.a].name} Lv${lv(o.a)} → Lv${lv(o.a) + 1}, ${RELICS[o.b].name} Lv${lv(o.b)} → Lv${lv(o.b) + 1}`));
      } else if (o.kind === 'buy') {
        // the stall: what it is and its price; greyed out when your purse is short
        const it = STALL[o.what];
        b.append(icon(it.icon));
        info.append(el('span', 'nm', it.name), el('span', 'tag price', `${o.price}G`), el('span', 'ds', it.desc));
        if (run.gold < o.price) { b.disabled = true; b.classList.add('poor'); }
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

// Talking to a villager: their face and what they say, then what they look after (`build` fills the
// body and can be called again through `redraw` after a purchase). Closes with the button, Esc, or a
// tap outside.
export function showTalk({ who, name, line, build, onClose }) {
  openSheet(sh => {
    sh.classList.add('talk');
    const head = el('div', 'talk-head');
    head.append(icon(who, 48), el('h2', null, name));
    sh.append(head, el('p', 'talk-text', line));
    const body = el('div', 'talk-body');
    const redraw = () => { const y = sh.scrollTop; body.innerHTML = ''; build(body, redraw); sh.scrollTop = y; };
    redraw();
    sh.append(body);
  }, () => closeTalk());
  talkClose = onClose || (() => {});
  $('modal').onclick = ev => { if (ev.target === $('modal')) closeTalk(); };
}
// true when there was a talk sheet to close
export function closeTalk() {
  if (!talkClose) return false;
  const done = talkClose;
  closeModal();
  done();
  return true;
}

export function showSummary({ won, run, newlyUnlockable, onClose }) {
  openSheet(sh => {
    sh.append(el('h2', null, won ? '들판을 모두 토벌했다!' : '쓰러졌다'));
    if (!won && run.cause) sh.append(el('p', 'cause', `마지막 순간: ${run.cause}`));
    sh.append(el('p', null, won
      ? '박쥐 대왕을 쓰러뜨렸다. 보너스 골드 200을 받았다.'
      : '모은 골드는 그대로 가져간다. 마을에서 강해진 다음 다시 도전하자.'));
    const sum = el('div', 'summary');
    for (const [v, l] of [[`${run.floor}구역`, '도달한 구역'], [run.kills, '쓰러뜨린 적'], [`Lv${run.p.lvl}`, '레벨'], [`+${run.gold}`, '가져가는 골드']]) {
      const s = el('div', 'stat');
      s.append(el('b', null, String(v)), el('span', null, l));
      sum.append(s);
    }
    sh.append(sum);
    const q = run.request;
    if (q) sh.append(el('div', 'unlock-note' + (q.done ? ' req-done' : ''), q.done ? `조합 의뢰 완료: ${q.text} · 일당 ${q.pay}G를 받았다` : `조합 의뢰 미완료: ${q.text} (${q.got}/${q.n})`));
    if (run.newRecipes.length) {
      const made = run.newRecipes.map(k => k.split(':')[0]);
      const row = el('div', 'unlock-note new-recipes');
      row.append(el('span', null, '새로 찾은 조합'));
      for (const id of made) { const c = icon(id); c.classList.add('t' + tierOf(id)); row.append(c); }
      sh.append(row);
    }
    if (run.found.length) {
      const names = run.found.map(id => DISCOVERIES.find(d => d.id === id)).map(d => `${d.combo} = ${d.result}`);
      sh.append(el('div', 'unlock-note', `이번에 새로 발견한 것: ${names.join(' · ')}`));
    }
    if (newlyUnlockable.length) {
      sh.append(el('div', 'unlock-note', `새 캐릭터 조건 달성: ${newlyUnlockable.join(', ')}. 마을의 조합장에게 가면 골드로 데려올 수 있다.`));
    }
    const foot = el('div', 'sheet-foot');
    foot.append(button('btn primary', '마을로 돌아가기', () => { closeModal(); onClose(); }));
    sh.append(foot);
  });
}
