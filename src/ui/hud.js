// Side panel during a run: floor, HP, XP, relics, consumables, message log.

import { $, el, button, icon } from './dom.js';
import { RELICS, MAX_SLOTS, evolutionOf, legendOf } from '../data/relics.js';
import { ITEMS } from '../data/items.js';
import { LAST_FLOOR, xpToLevel } from '../data/balance.js';
import { zoneOf, isBossFloor } from '../core/run.js';
import { playerStatus } from './tip.js';

export class Hud {
  constructor({ onUseItem }) {
    this.onUseItem = onUseItem;
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
  }

  renderLog() {
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

  evolutionLine(run, id) {
    const lg = legendOf(id);
    if (lg) {
      if (!run.meta.legends[lg.id]) return `전설 조합: ??? · 소문: "${lg.hint}"`;
      const part = x => `${RELICS[x].name}${run.p.relics[x] ? ' ✓' : ''}`;
      return `전설: ${part(lg.a)} + ${part(lg.b)} → ${RELICS[lg.id].name}`;
    }
    const ev = evolutionOf(id);
    if (!ev) return '';
    const part = x => `${RELICS[x].name} Lv${run.p.relics[x] || 0}/3`;
    return `진화: ${part(ev.a)} + ${part(ev.b)} → ${RELICS[ev.id].name}`;
  }

  update(run) {
    const s = run.stat(), p = run.p;
    $('floorLabel').innerHTML = `${run.floor}층<small>${isBossFloor(run.floor) ? '보스' : zoneOf(run.floor).name} · ${LAST_FLOOR}층까지</small>`;
    $('goldNow').textContent = `${run.gold}G`;
    $('hpText').textContent = `${Math.max(0, p.hp)} / ${s.maxHp}`;
    $('hpbar').firstElementChild.style.width = `${(Math.max(0, p.hp) / s.maxHp) * 100}%`;
    $('lvText').textContent = `Lv${p.lvl} · 경험치 ${p.xp}/${xpToLevel(p.lvl)}`;
    $('atkText').textContent = `공격 ${s.atk} · 방어 ${s.def}`;
    $('xpbar').firstElementChild.style.width = `${(p.xp / xpToLevel(p.lvl)) * 100}%`;
    const st = playerStatus(p, run.playerHidden());
    $('pstatus').innerHTML = '';
    for (const t of st) $('pstatus').append(el('span', 'chip', t));

    const ids = Object.keys(p.relics);
    $('slotText').textContent = `${ids.length}/${MAX_SLOTS}`;
    const box = $('relics');
    box.innerHTML = '';
    for (let i = 0; i < MAX_SLOTS; i++) {
      const id = ids[i];
      if (!id) { const b = button('relic empty'); b.disabled = true; box.append(b); continue; }
      const r = RELICS[id];
      const b = button('relic' + (r.legend ? ' legend' : r.evo ? ' evo' : ''), null, () => {
        this.selected = this.selected === id ? null : id;
        this.update(run);
      });
      b.append(icon(id), el('span', 'lv', r.evo ? '★' : String(p.relics[id])));
      b.setAttribute('aria-label', r.name);
      b.setAttribute('aria-pressed', String(this.selected === id));
      box.append(b);
    }

    const info = $('relicInfo');
    if (this.selected && p.relics[this.selected]) {
      const id = this.selected, r = RELICS[id];
      const ev = this.evolutionLine(run, id);
      info.innerHTML = `<b>${r.name}${r.legend ? ' (전설)' : r.evo ? ' (진화)' : ` Lv${p.relics[id]}`}</b> · ${r.desc(p.relics[id])}` +
        (ev ? `<br><span class="evo-line">${ev}</span>` : '');
    } else {
      info.textContent = '유물을 누르면 효과와 진화 조합이 보인다.';
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
}
