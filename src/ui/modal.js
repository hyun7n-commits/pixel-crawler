// Pop-up sheets: relic choice (level up / chest), the end-of-run summary, and talking in the village.

import { $, el, button, icon } from './dom.js';
import { RELICS, recipeKey, tierOf, maxLevelOf } from '../data/relics.js';
import { recipeFor } from './recipe.js';
import { josa } from '../core/util.js';
import { DISCOVERIES } from '../data/terrain.js';
import { STALL } from '../data/npcs.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { CHARACTERS } from '../data/characters.js';

// the level a relic grows to, MAX when that is its top (as the bag shows it)
const lvTo = (id, n) => (n >= maxLevelOf(id) ? 'MAX' : `Lv${n}`);

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
export function openSheet(build, onX) {
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
      purse.append(icon('gold', 16), el('span', null, `가진 골드 ${run.gold}G`));
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
        if (tierOf(o.id)) b.classList.add('t' + tierOf(o.id));
        // a card that completes a recipe you know glows, and says what it turns into
        if (evo) b.classList.add('ready');
        info.append(
          el('span', 'nm', r.name),
          el('span', evo ? 'tag ready' : cur ? 'tag' : 'tag new', evo ? `진화! → ${RELICS[evo.id].name}` : cur ? `Lv${cur} → ${lvTo(o.id, cur + 1)}` : '새 유물'),
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
          el('span', 'ds', `${RELICS[o.a].name} Lv${lv(o.a)} → ${lvTo(o.a, lv(o.a) + 1)}, ${RELICS[o.b].name} Lv${lv(o.b)} → ${lvTo(o.b, lv(o.b) + 1)}`));
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
        if (o.icon) b.append(icon(o.icon));
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

export function showSummary({ won, run, rescued = [], news = {}, opened = [], onClose }) {
  openSheet(sh => {
    const zone = run.zone.name, boss = run.boss?.d?.name || ENEMIES[run.zone.boss].name;
    sh.append(el('h2', null, won ? `${zone} ${run.loop}회차 돌파!` : '쓰러졌다'));
    if (run.cause && (!won || run.p.hp <= 0)) sh.append(el('p', 'cause', `마지막 순간: ${run.cause}`));
    if (won && run.depth) sh.append(el('p', 'deep-note', `대장 방 아래 깊은 곳 ${run.depth}층까지 내려갔다.`));
    if (run.lostDeep) sh.append(el('p', 'deep-note', `깊은 곳에서 주운 ${run.lostDeep}G는 거기 두고 왔다.`));
    sh.append(el('p', null, won
      ? `${josa(boss, '을', '를')} 쓰러뜨렸다. 돌파 보너스 ${run.bonus || 0}G를 받았다.`
      : '모은 골드는 그대로 가져간다. 마을에서 강해진 다음 다시 도전하자.'));
    const sum = el('div', 'summary');
    for (const [v, l] of [[run.floorName(), '도달한 곳'], [run.kills, '쓰러뜨린 적'], [`Lv${run.p.lvl}`, '레벨'], [`+${run.gold}`, '가져가는 골드']]) {
      const s = el('div', 'stat');
      s.append(el('b', null, String(v)), el('span', null, l));
      sum.append(s);
    }
    sh.append(sum);
    // the heroes let out of their cages this trip: they are waiting in the village
    for (const id of rescued) {
      const c = CHARACTERS[id], row = el('div', 'unlock-note rescued');
      row.append(icon(c.sprite), el('span', null, `우리에서 구해 준 ${c.kind} ${josa(c.name, '이', '가')} 마을로 이사 온다. 조합장에게서 골라 함께 나갈 수 있다.`));
      sh.append(row);
    }
    // 새로 열림: what this trip opened up (data/unlocks.js), a line or two each time
    if (opened.length) {
      const box = el('div', 'opened');
      box.append(el('h3', null, '새로 열림'));
      for (const u of opened) {
        const row = el('div', 'open-row');
        if (u.relic || u.icon) row.append(icon(u.relic || u.icon));
        const t = el('div');
        t.append(el('b', null, u.relic ? RELICS[u.relic].name : u.what), el('span', null, u.relic ? `새 유물. 이제 유물 카드에 나온다. ${RELICS[u.relic].desc(1)}` : u.desc));
        row.append(t);
        box.append(row);
      }
      sh.append(box);
    }
    const q = run.request;
    if (q) sh.append(el('div', 'unlock-note' + (q.done ? ' req-done' : ''), q.done ? `조합 의뢰 완료: ${q.text} · 일당 ${q.pay}G를 받았다` : `조합 의뢰 미완료: ${q.text} (${q.got}/${q.n})`));
    if (run.newRecipes.length) {
      const made = run.newRecipes.map(k => k.split(':')[0]);
      const row = el('div', 'unlock-note new-recipes');
      row.append(el('span', null, '새로 찾은 조합'));
      for (const id of made) { const c = icon(id); c.classList.add('t' + tierOf(id)); row.append(c); }
      sh.append(row);
    }
    if (run.newCritters?.length) {
      const row = el('div', 'unlock-note new-recipes');
      row.append(el('span', null, '새로 만난 친구'));
      // a boss shares its kind's picture, so it wears its crown here as in the critter book
      for (const t of run.newCritters) {
        if (!ENEMIES[t].boss) { row.append(icon(ENEMIES[t].sprite)); continue; }
        const pic = el('span', 'crit-pic');
        pic.append(icon(ENEMIES[t].sprite), icon('crown'));
        row.append(pic);
      }
      sh.append(row);
    }
    if (run.found.length) {
      const names = run.found.map(id => DISCOVERIES.find(d => d.id === id)).map(d => `${d.combo} = ${d.result}`);
      sh.append(el('div', 'unlock-note', `이번에 새로 발견한 것: ${names.join(' · ')}`));
    }
    // what this win opened: the next stage, the next 회차, a new dare from the rival
    if (news.stage != null) sh.append(el('div', 'unlock-note req-done', `새 스테이지 열림: ${ZONES[news.stage].name}`));
    if (news.loop) sh.append(el('div', 'unlock-note req-done', `${news.loop}회차 열림! 모든 스테이지가 더 사나워진 대신 골드를 더 준다. 새 친구들도 갇혀 있다.`));
    if (news.dares) sh.append(el('div', 'unlock-note', '라이벌이 새 내기를 걸어 왔다. 라이벌 집에서 볼 수 있다.'));
    const foot = el('div', 'sheet-foot');
    foot.append(button('btn primary', '마을로 돌아가기', () => { closeModal(); onClose(); }));
    sh.append(foot);
  });
}
