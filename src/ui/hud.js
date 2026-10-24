// Side panel during a run: floor, HP, XP, relics, consumables, message log.
// On a phone the same panel is a bag sheet, with a slim status bar on top and a toolbar below.

import { $, el, button, icon } from './dom.js';
import { RELICS, MAX_LEVEL, tierOf, maxLevelOf, isFused, fusedParts, relicName, recipesWith, recipeKey } from '../data/relics.js';
import { recipeFor, relicIcon } from './recipe.js';

const TIER_CLASS = ['', ' evo', ' legend', ' myth'];
const TIER_NAME = ['', ' (진화)', ' (전설)', ' (신화)'];
const relicDesc = (id, l) => (isFused(id) ? fusedParts(id).map(p => RELICS[p].desc(maxLevelOf(p))).join(' / ') : RELICS[id].desc(l));
import { ITEMS } from '../data/items.js';
import { isOpen } from '../data/unlocks.js';
import { xpToLevel, WAND_CHARGES, WAND_RECHARGE } from '../data/balance.js';
import { playerStatus } from './tip.js';
import { wait, fissionMs, FISSION_LEAD, FISSION_STEP, GROW_MS } from './beat.js';

// The consumables you can have by now: bombs and maps only show once they have opened (data/unlocks.js),
// the meadow tools only while you carry one.
const shownItems = run => Object.entries(ITEMS).filter(([id, d]) => run.p.items[id] > 0 || (!d.tool && isOpen(run.meta, id)));

// What the quest folk asked of you and have not had back yet.
function questLines(run) {
  const { ghost, smith } = run.quests, out = [], q = run.request, at = f => run.floorName(f);
  if (q) out.push(q.done ? `조합 의뢰 완료! ${q.text} (+${q.pay}G)` : `조합 의뢰: ${q.text} (${q.got}/${q.n}) · 일당 ${q.pay}G`);
  if (ghost.state === 'asked') out.push(`울보 아기새의 부탁: 리본 도둑 들쥐를 잡자 (${at(ghost.floor)})`);
  if (ghost.state === 'found') out.push(`울보 아기새에게 리본을 돌려주자 (${at(ghost.floor)})`);
  if (smith.state === 'asked') {
    out.push(smith.chunk === null ? `대장장이의 부탁: ${at(smith.floor)} 반짝 바위를 끝까지 캐자` : `대장장이에게 반짝돌 덩어리를 가져가자 (${at(smith.floor)})`);
  }
  // 깊은 곳: what is at stake (it comes home only by a burrow's 돌아간다)
  if (run.deepGold) out.push(`깊은 곳에서 주운 ${run.deepGold}G: 땅굴에서 돌아가야 들고 간다`);
  if (run.has?.has('cage') && !run.rescued.length) {
    out.push(run.map.cageKey ? '우리 열쇠를 찾았다! 갇힌 친구에게 가자' : '이 들판 어딘가에 누가 갇혀 있다. 열쇠는 우두머리가 물고 있다');
  }
  return out;
}

export class Hud {
  constructor({ onUseItem, onWait, onBag, onLook, onWand }) {
    this.onUseItem = onUseItem;
    this.onWand = onWand;
    this.onWait = onWait;
    this.onBag = onBag;
    this.onLook = onLook;
    this.looking = false;
    this.selected = null;
    this.lines = [];
    this.bannerTimer = 0;
    this.aiming = null;    // the item being thrown, while its spot is picked (main.js setAim)
    this.trayOpen = false; // phone: the 도구 tray over the toolbar
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

  // A star candy's burst: each relic it grows gives its slot a little bounce, in step with the field.
  fission(d) {
    const delay = wait(d, fissionMs(d.steps.length));
    d.steps.forEach((st, k) => st.id && setTimeout(() => this.ding(st.id), delay + FISSION_LEAD + k * FISSION_STEP));
  }

  // a relic you picked: its slot bounces as it lands over your head
  grow(d) { setTimeout(() => this.ding(d.id), wait(d, GROW_MS)); }

  ding(id) {
    const b = $('relics').querySelector(`[data-id="${id}"]`);
    if (!b) return;
    b.classList.remove('ding');
    void b.offsetWidth;
    b.classList.add('ding');
  }

  banner(text, ms = 1600) {
    const b = $('banner');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
  }

  update(run) {
    const s = run.stat(), p = run.p;
    // the zone, how far into the trip (the last field is its boss), the 회차 and the dares taken
    const boss = run.floor === run.bossFloor, local = run.floor - run.startFloor + 1;
    const where = run.depth ? `깊은 곳 ${run.depth}` : boss ? '대장' : `${local}/${run.bossFloor - run.startFloor}`;
    const extra = `${run.loop}회차${run.dares.length ? ` · 내기 ${run.dares.length}` : ''}`;
    $('floorLabel').innerHTML = `${run.zone.name} ${where}<small>${extra}</small>`;
    // 깊은 곳: the gold picked up down there apart, in orange (a burrow's 돌아간다 takes it home)
    const deep = run.deepGold, purse = deep ? `${run.gold - deep}G<small class="risk">+${deep}G</small>` : `${run.gold}G`;
    $('goldNow').innerHTML = purse;
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
    if (run.map?.cageKey) st.push('우리 열쇠');
    $('pstatus').innerHTML = '';
    for (const t of st) $('pstatus').append(el('span', 'chip', t));
    $('quests').innerHTML = '';
    for (const t of questLines(run)) $('quests').append(el('div', 'quest', t));

    $('mFloor').innerHTML = `${run.zone.name} ${where}<small>${extra}</small>`;
    $('mGold').innerHTML = purse;
    $('mHpText').textContent = `${Math.max(0, p.hp)} / ${s.maxHp}`;
    $('mHp').firstElementChild.style.width = $('hpbar').firstElementChild.style.width;
    $('mXp').firstElementChild.style.width = $('xpbar').firstElementChild.style.width;
    $('mStatus').innerHTML = '';
    for (const t of st) $('mStatus').append(el('span', 'chip', t));
    // phone: the request of the day as a small chip until it is done
    const q = run.request;
    if (q && !q.done) $('mStatus').append(el('span', 'chip req', `의뢰 ${q.got}/${q.n}`));
    this.renderBar(run);

    const ids = Object.keys(p.relics);
    $('slotText').textContent = `${ids.length}/${run.slots}`;
    const box = $('relics');
    box.innerHTML = '';
    for (let i = 0; i < run.slots; i++) {
      const id = ids[i];
      if (!id) { const b = button('relic empty'); b.disabled = true; box.append(b); continue; }
      // a relic at its top level says MAX in gold: fully grown, the way basic ones must be to evolve
      const top = maxLevelOf(id), maxed = top > 1 && p.relics[id] >= top;
      const b = button('relic' + (isFused(id) ? ' fused' : TIER_CLASS[tierOf(id)]) + (maxed ? ' maxed' : ''), null, () => {
        this.selected = this.selected === id ? null : id;
        this.update(run);
      });
      b.append(relicIcon(id), el('span', 'lv', top === 1 ? '★' : maxed ? 'MAX' : String(p.relics[id])));
      b.setAttribute('aria-label', relicName(id));
      b.dataset.id = id;
      b.setAttribute('aria-pressed', String(this.selected === id));
      box.append(b);
    }

    const info = $('relicInfo');
    if (this.selected && p.relics[this.selected]) {
      const id = this.selected, lv = p.relics[id];
      const tag = isFused(id) ? ' (합체)' : maxLevelOf(id) === 1 ? TIER_NAME[tierOf(id)] : `${TIER_NAME[tierOf(id)]} Lv${lv}`;
      info.innerHTML = `<b>${relicName(id)}${tag}</b> · ${relicDesc(id, lv)}`;
      // how many of the recipes this relic goes into you have found; the rest stay a secret
      const uses = isFused(id) ? [] : recipesWith(id);
      if (uses.length) info.append(el('div', 'rc-count', `이 유물이 들어가는 조합 ${uses.filter(rc => run.meta.recipes[recipeKey(rc)]).length}/${uses.length} 찾음`));
      const rc = recipeFor(run, id);
      if (rc) info.append(rc);
    } else {
      info.textContent = '유물을 누르면 효과가 보인다.';
    }

    const items = $('items');
    items.innerHTML = '';
    // 마법사's wand: its sparks, full and spent
    if (run.char.wand) {
      const b = button('item wand', null, this.onWand);
      b.append(icon('wand'), el('span', null, `마법 지팡이 ${'●'.repeat(p.charges)}${'○'.repeat(WAND_CHARGES - p.charges)}`), el('kbd', null, '키 X'));
      b.title = `멀리(2~4칸) 있는 적을 누르면 마법 화살을 쏜다. ${WAND_RECHARGE}턴마다 한 발씩 다시 찬다.`;
      b.disabled = !p.charges;
      items.append(b);
    }
    for (const [id, d] of shownItems(run)) {
      const aim = this.aiming === id;
      const b = button('item' + (aim ? ' aiming' : ''), null, () => this.onUseItem(id));
      b.append(icon(d.sprite), el('span', null, aim ? '던질 곳 고르기…' : `${d.name} ×${p.items[id] || 0}`), el('kbd', null, `키 ${d.key}`));
      b.title = d.desc;
      b.disabled = !p.items[id];
      items.append(b);
    }
  }

  // phone toolbar: rest, a look at something, the consumables and the bag, big enough for a thumb
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
    if (run.char.wand) {
      const b = button('mb', null, this.onWand);
      b.append(icon('wand'), el('span', null, `지팡이 ${p.charges}`));
      b.disabled = !p.charges;
      bar.append(b);
    }
    add(this.looking ? 'aiming' : '', 'look', this.looking ? '누르기' : '살펴보기', this.onLook);
    // the potion keeps its own button; everything else waits in the 도구 tray, so the bar stays the
    // same five buttons however full your pockets get
    const shown = shownItems(run), potion = shown.find(([id]) => id === 'potion'), rest = shown.filter(([id]) => id !== 'potion');
    if (potion) add('', 'potion', `물약 ${p.items.potion || 0}`, () => this.onUseItem('potion'), !p.items.potion);
    if (rest.length) {
      const aim = this.aiming && ITEMS[this.aiming];
      const n = rest.reduce((a, [id]) => a + (p.items[id] || 0), 0);
      add(aim ? 'aiming' : this.trayOpen ? 'on' : '', aim ? aim.sprite : 'toolpouch', aim ? '던질 곳' : `도구 ${n}`, () => {
        if (this.aiming) { this.onUseItem(this.aiming); return; }   // a second press puts it away again
        this.trayOpen = !this.trayOpen;
        this.renderTray(run);
        this.renderBar(run);
      }, !n && !aim);
    }
    add('', 'bag', `가방 ${Object.keys(p.relics).length}/${run.slots}`, this.onBag);
    if (this.trayOpen && (!rest.some(([id]) => p.items[id] > 0) || this.aiming)) this.trayOpen = false;
    this.renderTray(run);
  }

  // phone: what the 도구 button holds, in a row over the map; one tap uses it (or picks where to throw it)
  renderTray(run) {
    const tray = $('mtray'), p = run.p;
    if (!tray) return;
    tray.innerHTML = '';
    tray.hidden = !this.trayOpen;
    if (!this.trayOpen) return;
    for (const [id, d] of shownItems(run).filter(([id]) => id !== 'potion')) {
      const b = button('mt', null, () => { this.trayOpen = false; tray.hidden = true; this.onUseItem(id); });
      b.append(icon(d.sprite), el('span', null, `${d.name} ${p.items[id] || 0}`));
      b.title = d.desc;
      b.disabled = !p.items[id];
      tray.append(b);
    }
  }
}

// 0: fine · 1: low (30% or less) · 2: one more hit could do it (15% or less, or hanging on at 1)
export function lowHealth(run) {
  if (!run || run.over || run.p.hp <= 0) return 0;
  const f = run.p.hp / run.stat().maxHp;
  return f <= 0.15 || run.p.hp === 1 ? 2 : f <= 0.3 ? 1 : 0;
}
