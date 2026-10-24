// Pop-up sheets: relic choice (level up / chest), the end-of-run summary, and talking in the village.

import { $, el, button, icon, weatherPic } from './dom.js';
import { RELICS, recipeKey, tierOf, maxLevelOf } from '../data/relics.js';
import { recipeFor, foldRecipes } from './recipe.js';
import { josa } from '../core/util.js';
import { DISCOVERIES } from '../data/terrain.js';
import { STALL } from '../data/npcs.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { CHARACTERS } from '../data/characters.js';
import { goodInfo } from '../data/shop.js';
import { PETS, petNote } from '../data/pets.js';
import { bookPic } from './book.js';
import { UPGRADES } from '../data/upgrades.js';
import { upCap, stocked as onShelf } from '../data/shop.js';
import { isOpen } from '../data/unlocks.js';
import { WEATHER, weatherFor } from '../data/weather.js';
import { FRIENDS } from '../data/stages.js';

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
      purse.append(icon('gold', 32), el('span', null, '내 골드'), el('b', null, `${run.gold}G`));
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
        if (rc) info.append(foldRecipes(rc));
      } else if (o.kind === 'swap') {
        // 소원 우물: this one goes in, and something else of its kind comes up at its level
        const lv = run.p.relics[o.id] || 1;
        b.append(icon(o.id));
        if (tierOf(o.id)) b.classList.add('t' + tierOf(o.id));
        info.append(el('span', 'nm', RELICS[o.id].name), el('span', 'tag', `Lv${lv} 던져 넣기`),
          el('span', 'ds', `${tierOf(o.id) ? '다른 진화 유물' : '다른 유물'} Lv${lv}로 바뀌어 떠오른다`));
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

// 새로 열림 rows (data/unlocks.js): a picture, the name and one line each
function openedBox(opened) {
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
  return box;
}

// 상점에 새 물건 (data/shop.js): what came into the shop at the end of this trip
function stockBox(goods) {
  const box = el('div', 'opened stocked');
  box.append(el('h3', null, '상점에 새 물건이 들어왔다'));
  for (const g of goods) {
    const info = goodInfo(g.id), row = el('div', 'open-row');
    row.append(bookPic(info.pic, 32));
    const t = el('div');
    t.append(el('b', null, info.name), el('span', null, info.line));
    row.append(t);
    box.append(row);
  }
  return box;
}

// Back in the village after an update: what opened while you were away (data/unlocks.js sinceUpdate),
// and what the shop got in (data/shop.js stockSince)
export function showUpdateNews(opened, stocked = []) {
  openSheet(sh => {
    sh.append(el('h2', null, '그새 마을과 들판이 달라졌다'));
    if (opened.length) sh.append(el('p', null, '다음 탐험부터 나온다.'), openedBox(opened));
    if (stocked.length) sh.append(stockBox(stocked));
    const foot = el('div', 'sheet-foot');
    foot.append(button('btn primary', '좋아', closeModal));
    sh.append(foot);
  });
}

// 다음엔 (v0.32): after a trip, what is next within reach: what the gold buys now (or how much more it
// takes), and this stage's weather on the next trip out.
function nextUp(meta, run) {
  const lines = [];
  const ups = Object.entries(UPGRADES).filter(([id, u]) => (!u.open || isOpen(meta, u.open)) && (meta.up[id] || 0) < upCap(meta, id))
    .map(([id, u]) => ({ name: u.name, lv: (meta.up[id] || 0) + 1, cost: u.costs[meta.up[id] || 0] })).sort((a, b) => a.cost - b.cost);
  const can = ups.filter(u => u.cost <= meta.gold).pop(), cheap = ups[0];
  if (can) lines.push({ text: `가진 골드 ${meta.gold}G. 가게에서 ${can.name} Lv${can.lv}(${can.cost}G)를 살 수 있다.` });
  else if (cheap) lines.push({ text: `가진 골드 ${meta.gold}G. ${cheap.cost - meta.gold}G 더 모으면 가게에서 ${cheap.name} Lv${cheap.lv}를 살 수 있다.` });
  else if (onShelf(meta, 'svc:pack') && isOpen(meta, 'shelf')) lines.push({ text: `가진 골드 ${meta.gold}G. 출발 준비에서 유물을 챙겨 더 세게 나갈 수 있다.` });
  const w = weatherFor(meta, run.stage, run.loop);
  if (w) lines.push({ text: `다음 판 ${run.zone.name}: ${WEATHER[w].name} · ${WEATHER[w].short}`, pic: w });
  // the friend still locked up here at this 회차
  const fid = isOpen(meta, 'cage') && FRIENDS[run.stage]?.[run.loop - 1];
  if (fid && CHARACTERS[fid] && !meta.chars[fid]) lines.push({ text: `${run.zone.name}에는 아직 누군가 갇혀 있다. 왕관 쓴 우두머리가 열쇠를 갖고 있다.` });
  return lines;
}

// `near` (a trip that ended short of the boss's fall, main.js nearMiss): how far it got, and the boss's
// health left if it came to that. `onClose(again)`: again when 바로 다시 출발 was pressed.
export function showSummary({ won, run, meta, near = null, rescued = [], news = {}, opened = [], stocked = [], pet = null, onClose }) {
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
    // so close: the boss's health left, or how many fields short of it (and whether it was the furthest yet)
    if (near) {
      const box = el('div', 'near');
      if (near.boss) {
        const f = near.boss.hp / near.boss.max, bar = el('div', 'near-bar'), fill = el('i');
        fill.style.width = `${Math.max(2, Math.round(f * 100))}%`;
        bar.append(fill);
        box.append(el('span', null, `대장 ${near.boss.name} 체력 ${near.boss.hp} / ${near.boss.max}`), bar);
        if (f <= 0.35) box.append(el('b', null, '조금만 더 했으면 됐다!'));
      } else box.append(el('span', null, near.left ? `대장까지 들판 ${near.left}개 남았다.` : '대장 방 앞까지 왔다.'));
      if (near.best) box.append(el('b', 'near-best', '이 스테이지에서 가장 멀리 왔다!'));
      sh.append(box);
    }
    // the heroes let out of their cages this trip: they are waiting in the village
    for (const id of rescued) {
      const c = CHARACTERS[id], row = el('div', 'unlock-note rescued');
      row.append(icon(c.sprite), el('span', null, `우리에서 구해 준 ${c.kind} ${josa(c.name, '이', '가')} 마을로 이사 온다. 조합장에게서 골라 함께 나갈 수 있다.`));
      sh.append(row);
    }
    // 새로 열림: what this trip opened up (data/unlocks.js), a line or two each time
    if (opened.length) sh.append(openedBox(opened));
    if (stocked.length) sh.append(stockBox(stocked));
    // the pet that came along grew
    if (pet?.up) {
      const row = el('div', 'unlock-note req-done pet-up');
      row.append(icon(PETS[pet.id].sprite), el('span', null, `${josa(PETS[pet.id].name, '이', '가')} Lv${pet.lv}이 됐다! ${petNote(pet.id, pet.lv)}`));
      sh.append(row);
    }
    for (const q of run.requests || []) sh.append(el('div', 'unlock-note' + (q.done ? ' req-done' : ''), q.done ? `조합 의뢰 완료: ${q.text} · 일당 ${q.pay}G를 받았다` : `조합 의뢰 미완료: ${q.text} (${q.got}/${q.n})`));
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
    // 다음엔: what is in reach now
    const next = meta ? nextUp(meta, run) : [];
    if (next.length) {
      const box = el('div', 'next-up');
      box.append(el('b', null, '다음엔'));
      for (const l of next) {
        const row = el('span', 'next-line');
        if (l.pic) row.append(weatherPic(l.pic, 16));
        row.append(el('span', null, l.text));
        box.append(row);
      }
      sh.append(box);
    }
    const foot = el('div', 'sheet-foot');
    foot.append(button('btn', '마을로 돌아가기', () => { closeModal(); onClose(false); }), button('btn primary', '바로 다시 출발', () => { closeModal(); onClose(true); }));
    sh.append(foot);
  });
}
