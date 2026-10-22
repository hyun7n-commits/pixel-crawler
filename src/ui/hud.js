// Side panel during a run: floor, HP, XP, relics, consumables, message log.
// On a phone the same panel is a bag sheet, with a slim status bar on top and a toolbar below.

import { $, el, button, icon } from './dom.js';
import { RELICS, MAX_SLOTS, MAX_LEVEL, tierOf, maxLevelOf, isFused, fusedParts, relicName } from '../data/relics.js';
import { recipeFor, relicIcon } from './recipe.js';

const TIER_CLASS = ['', ' evo', ' legend', ' myth'];
const TIER_NAME = ['', ' (진화)', ' (전설)', ' (신화)'];
const relicDesc = (id, l) => (isFused(id) ? fusedParts(id).map(p => RELICS[p].desc(maxLevelOf(p))).join(' / ') : RELICS[id].desc(l));
import { ITEMS } from '../data/items.js';
import { LAST_FLOOR, xpToLevel } from '../data/balance.js';
import { zoneOf, isBossFloor } from '../core/run.js';
import { playerStatus } from './tip.js';

// What the quest folk asked of you and have not had back yet.
function questLines(run) {
  const { ghost, smith } = run.quests, out = [];
  if (ghost.state === 'asked') out.push(`유령 광부의 부탁: 목걸이 도둑 쥐를 잡자 (${ghost.floor}층)`);
  if (ghost.state === 'found') out.push(`유령 광부에게 목걸이를 돌려주자 (${ghost.floor}층)`);
  if (smith.state === 'asked') {
    out.push(smith.chunk === null ? `대장장이의 부탁: ${smith.floor}층 큰 광석을 끝까지 캐자` : `대장장이에게 광석 덩어리를 가져가자 (${smith.floor}층)`);
  }
  return out;
}

export class Hud {
  constructor({ onUseItem, onWait, onBag }) {
    this.onUseItem = onUseItem;
    this.onWait = onWait;
    this.onBag = onBag;
    this.selected = null;
    this.lines = [];
    this.bannerTimer = 0;
    this.aiming = false;
  }

  reset() {
    this.selected = null;
    this.lines = [];
    this.renderLog();
  }

  log(text, cls) {
    this.lines.push({ text, cls });
    if (this.lines.length > 40) this.lines.shift();
    this.renderLog();
    // phone: the newest lines float over the map for a few seconds, like SPD's game log
    const m = $('mlog');
    const d = el('div', cls || '');
    d.textContent = text;
    m.append(d);
    while (m.children.length > 3) m.firstElementChild.remove();
  }

  renderLog() {
    if (!this.lines.length) $('mlog').innerHTML = '';
    const box = $('log');
    box.innerHTML = '';
    for (const m of this.lines.slice(-7)) {
      const d = el('div', m.cls || '');
      d.textContent = m.text;
      box.append(d);
    }
  }

  banner(text) {
    const b = $('banner');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), 1600);
  }

  update(run) {
    const s = run.stat(), p = run.p;
    $('floorLabel').innerHTML = `${run.floor}층<small>${isBossFloor(run.floor) ? '보스' : zoneOf(run.floor).name} · ${LAST_FLOOR}층까지</small>`;
    $('goldNow').textContent = `${run.gold}G`;
    $('hpText').textContent = `${Math.max(0, p.hp)} / ${s.maxHp}`;
    $('hpbar').firstElementChild.style.width = `${(Math.max(0, p.hp) / s.maxHp) * 100}%`;
    // a hit or two from the end: the view's edges beat red, faster when it's really close
    const low = lowHealth(run);
    $('game').classList.toggle('low', low > 0);
    $('game').style.setProperty('--beat', low > 1 ? '0.7s' : '1.05s');
    $('lvText').textContent = `Lv${p.lvl} · 경험치 ${p.xp}/${xpToLevel(p.lvl)}`;
    $('atkText').textContent = `공격 ${s.atk} · 방어 ${s.def}`;
    $('xpbar').firstElementChild.style.width = `${(p.xp / xpToLevel(p.lvl)) * 100}%`;
    const st = playerStatus(p);
    if (run.map?.keyHeld) st.push('열쇠');
    $('pstatus').innerHTML = '';
    for (const t of st) $('pstatus').append(el('span', 'chip', t));
    $('quests').innerHTML = '';
    for (const t of questLines(run)) $('quests').append(el('div', 'quest', t));

    $('mFloor').innerHTML = `${run.floor}층<small>${isBossFloor(run.floor) ? '보스' : zoneOf(run.floor).name}</small>`;
    $('mGold').textContent = `${run.gold}G`;
    $('mHpText').textContent = `${Math.max(0, p.hp)} / ${s.maxHp}`;
    $('mHp').firstElementChild.style.width = $('hpbar').firstElementChild.style.width;
    $('mXp').firstElementChild.style.width = $('xpbar').firstElementChild.style.width;
    $('mStatus').innerHTML = '';
    for (const t of st) $('mStatus').append(el('span', 'chip', t));
    this.renderBar(run);

    const ids = Object.keys(p.relics);
    $('slotText').textContent = `${ids.length}/${MAX_SLOTS}`;
    const box = $('relics');
    box.innerHTML = '';
    for (let i = 0; i < MAX_SLOTS; i++) {
      const id = ids[i];
      if (!id) { const b = button('relic empty'); b.disabled = true; box.append(b); continue; }
      const b = button('relic' + (isFused(id) ? ' fused' : TIER_CLASS[tierOf(id)]), null, () => {
        this.selected = this.selected === id ? null : id;
        this.update(run);
      });
      b.append(relicIcon(id), el('span', 'lv', maxLevelOf(id) === 1 ? '★' : String(p.relics[id])));
      b.setAttribute('aria-label', relicName(id));
      b.setAttribute('aria-pressed', String(this.selected === id));
      box.append(b);
    }

    const info = $('relicInfo');
    if (this.selected && p.relics[this.selected]) {
      const id = this.selected, lv = p.relics[id];
      const tag = isFused(id) ? ' (합체)' : maxLevelOf(id) === 1 ? TIER_NAME[tierOf(id)] : `${TIER_NAME[tierOf(id)]} Lv${lv}`;
      info.innerHTML = `<b>${relicName(id)}${tag}</b> · ${relicDesc(id, lv)}`;
      const rc = recipeFor(run, id);
      if (rc) info.append(rc);
    } else {
      info.textContent = '유물을 누르면 효과가 보인다.';
    }

    const items = $('items');
    items.innerHTML = '';
    for (const [id, d] of Object.entries(ITEMS)) {
      const aim = id === 'bomb' && this.aiming;
      const b = button('item' + (aim ? ' aiming' : ''), null, () => this.onUseItem(id));
      b.append(icon(d.sprite), el('span', null, aim ? '던질 곳 고르기…' : `${d.name} ×${p.items[id]}`), el('kbd', null, `키 ${d.key}`));
      b.title = d.desc;
      b.disabled = !p.items[id];
      items.append(b);
    }
  }

  // phone toolbar: rest, the three consumables and the bag, big enough for a thumb
  renderBar(run) {
    const bar = $('mbar'), p = run.p;
    bar.innerHTML = '';
    const add = (cls, spr, label, onClick, disabled) => {
      const b = button('mb' + (cls ? ` ${cls}` : ''), null, onClick);
      b.append(icon(spr), el('span', null, label));
      b.disabled = !!disabled;
      bar.append(b);
    };
    add('', 'rest', '쉬기', this.onWait);
    for (const [id, d] of Object.entries(ITEMS)) {
      const aim = id === 'bomb' && this.aiming;
      add(aim ? 'aiming' : '', d.sprite, aim ? '던질 곳' : `${d.name.replace('체력 ', '')} ${p.items[id]}`, () => this.onUseItem(id), !p.items[id]);
    }
    add('', 'bag', `가방 ${Object.keys(p.relics).length}/${MAX_SLOTS}`, this.onBag);
  }
}

// 0: fine · 1: low (30% or less) · 2: one more hit could do it (15% or less, or hanging on at 1)
export function lowHealth(run) {
  if (!run || run.over || run.p.hp <= 0) return 0;
  const f = run.p.hp / run.stat().maxHp;
  return f <= 0.15 || run.p.hp === 1 ? 2 : f <= 0.3 ? 1 : 0;
}
