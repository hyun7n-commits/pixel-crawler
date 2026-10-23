// Entry point: connects the saved progress, the village, the run rules, the Phaser scenes and the HUD.

/* global Phaser */
import { DungeonScene } from './scenes/DungeonScene.js';
import { VillageScene } from './scenes/VillageScene.js';
import { StoryScene } from './scenes/StoryScene.js';
import { playStory } from './ui/story.js';
import { Run, BOMB_RANGE } from './core/run.js';
import { loadMeta, saveMeta } from './core/save.js';
import { suspend, resume, clearSuspended, savedRun } from './core/suspend.js';
import { pathTo, idx, isBump, isStairs } from './core/dungeon.js';
import { ENEMIES, ZONES } from './data/enemies.js';
import { cleared } from './data/stages.js';
import { cheb, josa } from './core/util.js';
import { ITEMS } from './data/items.js';
import { T, isTrap } from './data/terrain.js';
import { Hud, lowHealth } from './ui/hud.js';
import { renderPanel, renderVillageHud } from './ui/hub.js';
import { showChoice, showSummary, showTalk, closeTalk, closeModal, modalOpen } from './ui/modal.js';
import { showStages } from './ui/stages.js';
import { showEvolve } from './ui/evo.js';
import { showsLeft } from './ui/beat.js';
import { speed, pace, nextSpeed } from './ui/speed.js';
import { bossCard } from './ui/bosscard.js';
import { FOLK } from './data/village.js';
import { DECOR } from './data/home.js';
import { CHARACTERS } from './data/characters.js';
import { describeTile } from './ui/tip.js';
import { $ } from './ui/dom.js';
import * as sfx from './audio/sfx.js';
import { setMusic, musicOff, setMusicOff } from './audio/music.js';

let meta = loadMeta();
let run = null;
let scene = null;
let path = [];
let seenCount = 0;
let aiming = null;  // what is being thrown (data/items.js) while a spot on the map is picked
let chase = null;   // an enemy tapped from afar: walk up to it and hit it once
let pinned = null;  // tile whose tip stays up after a long press on a phone, or a tap while looking
let looking = false; // 살펴보기: a tap on the map shows what is there instead of walking (L key)
let inVillage = false;

const hud = new Hud({
  onUseItem: id => {
    setBag(false);
    if (ITEMS[id].throw) { setAim(aiming === id ? null : id); return; }
    if (canAct()) { clearPath(); setAim(null); run.useItem(id); }
  },
  onWait: () => restOnce(),
  onBag: () => setBag(!$('game').classList.contains('bag-open')),
  onLook: () => setLook(!looking),
  onWand: () => { setBag(false); zapNearest(); },
});

// 마법사: a spark at the nearest monster the wand can reach (X, or the wand button)
function zapNearest() {
  if (!canAct() || !run.char.wand) return;
  const e = run.enemies.filter(e => run.canZapAt(e.x, e.y)).sort((a, b) => cheb(a, run.p) - cheb(b, run.p))[0];
  if (e) { clearPath(); setAim(false); run.castWand(e.x, e.y); }
  else run.log(run.p.charges ? '지팡이가 닿는 곳(2~4칸)에 적이 없다.' : '지팡이가 다시 찰 때까지 기다려야 한다.');
}

const canAct = () => run && !run.over && !modalOpen() && run.canAct() && !scene?.busy();
const clearPath = () => { path = []; chase = null; if (scene) scene.path = path; };
const tipAt = () => pinned || scene?.hover;

function restOnce() {
  setLook(false);
  if (canAct()) { clearPath(); setAim(false); run.wait(); }
}

// 살펴보기: press it, then tap a critter, a tile or a thing on the map to read about it, as many as you
// like; press it again (or Esc, or move) to go back to walking
function setLook(on) {
  looking = !!(on && run && !run.over);
  if (looking) setAim(false);
  pinned = null;
  hud.looking = looking;
  if (run) hud.update(run);
  $('lookBtn')?.classList.toggle('on', looking);
  showTip(tipAt());
}

// On a phone the side panel is a bag that slides up from the bottom.
function setBag(open) {
  $('game').classList.toggle('bag-open', !!open);
}

// Throwing something (a bomb, a pinecone...): press it (or its number key), then pick a tile on the map.
function setAim(id) {
  aiming = id && canAct() && run.p.items[id] > 0 ? id : null;
  if (aiming && looking) { looking = false; hud.looking = false; $('lookBtn')?.classList.remove('on'); }
  if (scene) scene.aim = aiming;
  hud.aiming = aiming;
  if (run) hud.update(run);
  showTip(tipAt());
}

function showTip(h) {
  const tip = $('tip');
  let text = '';
  if (run && aiming) {
    const it = ITEMS[aiming];
    const touch = matchMedia('(pointer: coarse)').matches;
    text = `${josa(it.name, '을', '를')} ${it.foe ? '던질 적을' : '던질 곳을'} 고른다 · 취소: ${touch ? '던질 곳 버튼을 한 번 더' : `Esc 또는 ${it.name} 버튼`}`;
    if (!touch) text += ' · 방향키로 옮기고 Enter로 던진다';
    // too close for comfort: what lands next to you gets you too
    const near = { bomb: '바로 옆이라 나도 맞는다!', sleepy: '바로 옆이라 나도 잠들지 모른다!', honeyjar: '바로 옆이라 내 발에도 꿀이 묻는다!' }[aiming];
    if (near && h && run.canThrowAt(h.x, h.y, aiming) && cheb(h, run.p) <= 1) text += `\n${near}`;
  } else if (run && h) {
    text = describeTile(run, h.x, h.y, h === pinned);
    if (run.canZapAt(h.x, h.y)) text += `\n누르면 지팡이로 마법 화살을 쏜다 (남은 ${run.p.charges}발)`;
  }
  else if (run && looking) text = '살펴볼 곳을 누른다 · 다시 누르면 끝';
  tip.textContent = text;
  tip.hidden = !text;
}

// ---------- screens ----------
// Between runs you are in the village (scenes/VillageScene.js): the run's HUD hides and the map
// shows the village instead. `from`: 'run' when coming back from the fields.
const village = () => game.scene.getScene('village');

function showVillage(from) {
  sfx.setHeartbeat(0);
  setMusic('village');
  inVillage = true;
  pinned = null;
  looking = false; hud.looking = false; $('lookBtn')?.classList.remove('on');
  showTip(null);
  const g = $('game');
  g.hidden = false;
  g.classList.add('village');
  g.classList.remove('low', 'bag-open');
  fitCanvas();
  game.scene.sleep('dungeon');
  // first time: start the scene; after a run: wake it up; already showing (a reset): rebuild it
  if (village().sys.isActive()) village().enter({ meta, from });
  else game.scene.run('village', { meta, from });
  renderVillageHud(meta);
}

// The picture book (ui/story.js): the opening on the very first launch, a license from the guild the
// first time each zone boss falls, and the ending after the first win. Each is shown once.
function showStory(id, then) {
  sfx.setHeartbeat(0);
  setMusic(id === 'ending' ? 'meadow' : 'village');
  inVillage = false;
  showTip(null);
  const g = $('game');
  g.hidden = false;
  g.classList.add('village');
  g.classList.remove('low', 'bag-open');
  fitCanvas();
  playStory(game, id, () => {
    meta.story[id] = true;
    saveMeta(meta);
    then?.();
  });
}

function afterRunStory() {
  const st = meta.story, beat = meta.stats.bosses;
  // the ending comes the first time the last stage falls
  const id = cleared(meta, ZONES.length - 1) && !st.ending ? 'ending' : ['ratking', 'skelking'].find(b => beat.includes(b) && !st[b]);
  // the ending covers the licenses that came with it
  if (id === 'ending') st.ratking = st.skelking = true;
  if (id) showStory(id, () => showVillage('run'));
  else showVillage('run');
}

// `restored`: a run left off last time (core/suspend.js), picked up where it was
// Heading out: first the stage select (ui/stages.js), then the trip it picked
function chooseStage() {
  if (run) return;
  // a trip saved halfway is picked up where it was left
  const left = savedRun() && resume(meta);
  if (left) { startRun(left); return; }
  sfx.play('talk');
  showVillageTip('');
  showStages({ meta, onGo: () => { saveMeta(meta); startRun(); } });
}

function startRun(left) {
  if (run) return;
  const restored = left instanceof Run ? left : null;   // a click passes its event here
  sfx.unlockAudio();
  closeModal();
  inVillage = false;
  $('game').hidden = false;   // a run picked up at launch comes straight here
  $('game').classList.remove('village');
  game.scene.sleep('village');
  game.scene.run('dungeon');
  setBag(false);
  pinned = null;
  showVillageTip('');
  // the stage changed shape, so measure it again before drawing
  fitCanvas();
  run = restored || new Run(meta, meta.sel, { stage: meta.stage || 0, loop: meta.loop || 1 });
  hud.reset();
  run.on(onRunEvent);
  scene.attach(run);
  if (restored) {
    setMusic(run.floor === run.bossFloor ? 'boss' : run.zone.style);
    run.log('하던 탐험을 이어서 한다.', 'good');
    run.emit('turn');
    return;
  }
  run.start();
  // no manual up front: the first runs get one line on how to ask about anything
  if (meta.stats.runs < 2) run.log(TOUCH ? '모르는 게 보이면 꾹 눌러 보자. 설명이 나온다.' : '방향키나 WASD, 클릭으로 걷는다. 모르는 게 보이면 마우스를 올려 보자. 설명이 나온다.');
  setAim(false);
}

// Bumping into a villager: they turn, say something, and open what they look after.
function talkTo(id, line) {
  const f = FOLK[id];
  sfx.play('talk');
  showVillageTip('');
  showTalk({
    who: f.sprite, name: f.name, line,
    build: (box, redraw) => renderPanel(f.panel, box, {
      meta,
      onStart: chooseStage,
      changed: () => { saveMeta(meta); redraw(); renderVillageHud(meta); village().resync(); },
      setMeta: m => { meta = m; closeModal(); showVillage(); },
      onStory: () => { closeTalk(); showStory('intro', () => showVillage()); },
    }),
  });
}

// Bumping into your own house: the 집 꾸미기 list. Buying a piece closes the sheet so you can watch
// it go up beside the house.
function openHome() {
  const n = (meta.home || []).length, all = n >= DECOR.length;
  sfx.play('talk');
  showVillageTip('');
  showTalk({
    who: CHARACTERS[meta.sel].sprite, name: '내 집',
    line: all ? '더 바랄 게 없는 내 집이다!' : n ? '조금씩 내 집 같아진다. 다음엔 뭘 놓을까?' : '조합에서 받은 내 집. 아직 휑하다… 뭐부터 놓을까?',
    build: (box, redraw) => renderPanel('home', box, {
      meta,
      changed: () => { saveMeta(meta); redraw(); renderVillageHud(meta); },
      onDecor: id => { closeTalk(); sfx.play('buy'); village().showDecor(id); },
    }),
  });
}

const villageHooks = {
  onTalk: talkTo,
  onHome: openHome,
  onPet: () => sfx.play('bark'),
  // a letter from the mailbox (data/home.js LETTERS)
  onMail: letter => {
    const f = FOLK[letter.from];
    sfx.play('letter');
    showVillageTip('');
    showTalk({ who: f.sprite, name: `${f.name}의 편지`, line: letter.text, build: () => {} });
  },
  onSwap: id => {
    meta.sel = id;
    saveMeta(meta);
    village().swapHero(id);
    sfx.play('swap');
    renderVillageHud(meta);
  },
  onDive: () => { sfx.unlockAudio(); sfx.play('dive'); },
  onLeave: () => chooseStage(),
  onArrive: id => {
    meta.village.seen[id] = true;
    saveMeta(meta);
    hud.banner(`새 이웃! ${FOLK[id].name}`);
    sfx.play('welcome');
  },
  onStep: alt => sfx.play('step', alt),
  onHover: (text, flash) => showVillageTip(text, flash),
  onFind: n => {
    meta.gold += n;
    saveMeta(meta);
    sfx.play('nugget');
    renderVillageHud(meta);
  },
};

// The village's tip line: who someone is when the mouse rests on them, or a short note after a tap.
let villageTipTimer = 0;
function showVillageTip(text, flash) {
  if (!inVillage && text) return;
  const tip = $('tip');
  tip.textContent = text;
  tip.hidden = !text;
  clearTimeout(villageTipTimer);
  if (flash && text) villageTipTimer = setTimeout(() => { tip.hidden = true; }, 1800);
}

function onRunEvent(type, d) {
  sfx.onRunEvent(type, d);
  sfx.setHeartbeat(lowHealth(run));
  if (type === 'log') hud.log(d.text, d.cls);
  // a new field's name shows once you have popped out of the burrow
  if (type === 'banner') setTimeout(() => hud.banner(d.text), Math.max(scene?.busy() ? 650 : 0, showsLeft()));
  if (type === 'discover') hud.banner(`새 발견! ${d.d.combo}`);
  if (type === 'request') setTimeout(() => hud.banner(`조합 의뢰 완료! +${d.pay}G`), 300);
  if (type === 'evolve') showEvolve(d);
  if (type === 'fission') hud.fission(d);
  if (type === 'grow') hud.grow(d);
  if (type === 'floor') { clearPath(); seenCount = 0; setMusic(run.floor === run.bossFloor ? 'boss' : run.zone.style); }
  if (type === 'kill' && d.enemy.d.boss && !run.victory) setMusic(run.zone.style);
  if (type === 'phit') clearPath();
  if (type === 'turn') afterTurn();
  // written down now and then, so closing the page mid-run loses nothing (core/suspend.js)
  if ((type === 'floor' || (type === 'turn' && run.turn % 10 === 0)) && !run.over) setTimeout(putAway, 0);
  // the stage won on the way down to 깊은 곳: written to the save right away
  if (type === 'banked') saveMeta(meta);
  if (type === 'end') {
    clearSuspended();
    setMusic(null);
    clearPath();
    setAim(false);
    // what the neighbour will be talking about when you get back
    meta.lastRun = {
      won: d.won, floor: run.floor - run.startFloor + 1, zone: run.zone.name, stage: run.stage, loop: run.loop, cause: run.cause, kills: run.kills, gold: run.gold,
      recipes: run.newRecipes.length, who: CHARACTERS[meta.sel].name, friend: run.rescued.length ? CHARACTERS[run.rescued[0]].kind : null,
      honey: run.p.honey || 0, ring: !!run.told.ring, spring: !!run.told.spring, weeds: run.weeds || 0, screams: run.screams || 0,
      tools: run.toolUse || {}, routes: run.routesTaken || [],
    };
    saveMeta(meta);
    hud.update(run);
    const summary = () => showSummary({ won: d.won, run, rescued: d.rescued, news: d.news, opened: d.opened, onClose: () => { scene.detach(); run = null; afterRunStory(); } });
    if (d.won && !d.fell) summary();
    else fallen(summary);
  }
}

// Down: the field turns grey and quiet, then one line says where and to what ("초원 2 · 들쥐에게 당했다"),
// like Shattered Pixel Dungeon's "Killed by a marsupial rat on depth 2". A tap (or a few seconds) moves on.
function fallen(then) {
  sfx.setHeartbeat(0);
  sfx.play('fall');
  const line = $('fallen');
  let gone = false;
  const go = () => { if (gone) return; gone = true; line.hidden = true; line.onclick = null; then(); };
  scene.fall(() => {
    line.textContent = `${run.floorName()} · ${run.cause || '쓰러졌다'}`;
    line.hidden = false;
    line.onclick = go;
    setTimeout(go, 2600);
  });
}

function afterTurn() {
  // a boss comes into view for the first time this floor: it steps out on its card
  const boss = run.enemies.find(e => e.d.boss && e.hp > 0 && run.isVisible(e.x, e.y));
  if (boss && run.bossShown !== boss.id) { run.bossShown = boss.id; clearPath(); bossCard(boss); sfx.play('boom'); sfx.play('alert'); }
  // stop walking when a new enemy comes into view or something holds you
  const seen = visibleEnemies();
  if (path.length && (seen > seenCount || run.p.sleep)) clearPath();
  seenCount = seen;
  if (aiming && !canAct()) setAim(false);
  hud.update(run);
  showTip(tipAt());
  nextChoice();
}

function nextChoice() {
  if (!run || run.over || modalOpen() || !run.queue.length) return;
  clearPath();
  setAim(false);
  setBag(false);
  const q = run.queue[0];
  const onPick = o => { run.choose(o); if (run) hud.update(run); nextChoice(); };
  // the boss's chest is open: home with the win, or on down into 깊은 곳
  if (q.kind === 'deeper') {
    showChoice({
      title: '대장을 쓰러뜨렸다!', sub: `${run.zone.name} 돌파. 대장 방 바닥에 구멍이 하나 나 있다. 아래에서 찬 바람이 올라온다.`, run, onPick,
      opts: [
        { kind: 'ok', act: 'home', icon: 'gold', name: '마을로 돌아간다', desc: '탐험 성공. 모은 골드와 돌파 보너스를 들고 간다.' },
        { kind: 'ok', act: 'deeper', icon: 'stairs', name: '더 깊이 들어간다', desc: '지금 유물 그대로 더 센 들판으로. 층마다 좋은 상자가 있다. 쓰러지면 깊은 곳에서 주운 골드는 두고 온다. 언제든 메뉴에서 돌아갈 수 있다.' },
      ],
    });
    return;
  }
  if (q.kind === 'talk') {
    const npc = ENEMIES[q.who];
    showChoice({ title: npc.name, sub: q.text, run, who: npc.sprite, opts: q.smithPick ? run.smithOffers() : q.opts, onPick });
    return;
  }
  const title = q.kind === 'level' ? `레벨 ${run.p.lvl}!` : q.kind === 'kit' ? `출발 보급 ${q.k}/${q.n}` : q.vein ? '바위 속 상자' : q.rich ? '잠긴 상자' : '보물 상자';
  const sub = q.kind === 'level' ? '유물을 하나 고르자.' : q.kind === 'kit' ? '조합이 챙겨 준 보급품이다. 하나 고르자.'
    : q.rich ? '좋은 상자다. 넷 중 하나를 가져가자.' : '안에 든 유물 중 하나를 가져가자.';
  const open = () => showChoice({
    title, sub, run, opts: run.offers(q.rich ? 4 : 3), onPick,
    onReroll: () => { run.rerolls--; open(); },
  });
  open();
}

// ---------- input ----------
const KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
  Home: [-1, -1], PageUp: [1, -1], End: [-1, 1], PageDown: [1, 1],
};

// Arrow keys (or WASD) pressed together walk diagonally: a key waits a moment for its partner.
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']);
const held = new Set(), tapped = new Set();
let lastKeyStep = 0;
let chordTimer = 0;
function chordStep() {
  chordTimer = 0;
  let dx = 0, dy = 0;
  for (const k of new Set([...held, ...tapped])) { dx += KEYS[k][0]; dy += KEYS[k][1]; }
  tapped.clear();
  dx = Math.sign(dx); dy = Math.sign(dy);
  if ((dx || dy) && canAct()) run.step(dx, dy);
}
document.addEventListener('keyup', ev => { held.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key); });
window.addEventListener('blur', () => held.clear());

document.addEventListener('keydown', ev => {
  if (modalOpen()) {
    if (ev.key === 'Escape' && closeTalk()) return;
    const n = parseInt(ev.key, 10);
    const b = n && $('modal').querySelector(`.choice[data-key="${n}"]`);
    if (b) { ev.preventDefault(); b.click(); return; }
    // keyboard (or a pad through Steam Input): arrows walk the focus through the sheet's buttons,
    // Enter or Space presses the one in focus, and Enter the sheet's main button when none is (not
    // Space, which you may still be tapping to wait when the run ends)
    const buttons = [...$('modal').querySelectorAll('button:not([disabled])')].filter(x => x.offsetParent);
    const at = buttons.indexOf(document.activeElement);
    if (ev.key.startsWith('Arrow') && buttons.length) {
      ev.preventDefault();
      const back = ev.key === 'ArrowUp' || ev.key === 'ArrowLeft';
      const next = buttons[at < 0 ? 0 : (at + (back ? -1 : 1) + buttons.length) % buttons.length];
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter' && !ev.repeat && at < 0) {
      const main = $('modal').querySelector('.btn.primary:not([disabled])');
      if (main) { ev.preventDefault(); main.click(); }
    }
    return;
  }
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  // in the village: walk a step, or bump whoever is there; Enter heads out
  if (inVillage) {
    if (KEYS[k]) { ev.preventDefault(); village().step(...KEYS[k]); }
    if (k === 'Enter' && document.activeElement === document.body) chooseStage();
    if (k === 'm') toggleSound();
    return;
  }
  if (!run || $('game').hidden) return;
  if (k === 'Escape') { setAim(false); setLook(false); clearPath(); return; }
  if (k === 'l') { setLook(!looking); return; }
  // aiming from the keyboard: arrows move the mark, Enter or Space throws
  if (aiming && (KEYS[k] || k === 'Enter' || k === ' ')) {
    ev.preventDefault();
    const h = scene.hover && cheb(scene.hover, run.p) <= BOMB_RANGE ? scene.hover : { x: run.p.x, y: run.p.y };
    if (KEYS[k]) {
      const t = { x: h.x + KEYS[k][0], y: h.y + KEYS[k][1] };
      if (cheb(t, run.p) <= BOMB_RANGE) scene.hover = t;
      showTip(scene.hover);
    } else if (run.canThrowAt(h.x, h.y, aiming) && canAct()) { clearPath(); run.throwTool(aiming, h.x, h.y); setAim(null); }
    return;
  }
  // a held key repeats faster than the hero walks: keep to the walk's beat so each step can glide
  if (ev.repeat && (ARROWS.has(k) || KEYS[k]) && performance.now() - lastKeyStep < 120 / pace()) { ev.preventDefault(); return; }
  if (ARROWS.has(k) || KEYS[k]) { lastKeyStep = performance.now(); if (looking) setLook(false); }
  if (ARROWS.has(k)) {
    ev.preventDefault(); clearPath(); setAim(false);
    held.add(k); tapped.add(k);
    if (!chordTimer) chordTimer = setTimeout(chordStep, 45);
    return;
  }
  if (KEYS[k]) { ev.preventDefault(); clearPath(); setAim(false); if (canAct()) run.step(...KEYS[k]); return; }
  if (k === ' ' || k === '.') { ev.preventDefault(); clearPath(); setAim(false); if (canAct()) run.wait(); return; }
  // the number keys: 1 potion, 2 bomb, 3 map, 4-9 the meadow tools (data/items.js)
  const item = Object.keys(ITEMS).find(id => ITEMS[id].key === k);
  if (item && ITEMS[item].throw) {
    setAim(aiming === item ? null : item);
    // the mark starts on the nearest critter you could hit
    if (aiming) {
      const t = run.enemies.filter(e => e.hp > 0 && !e.d.npc && run.isVisible(e.x, e.y) && run.canThrowAt(e.x, e.y, aiming)).sort((a, b) => cheb(a, run.p) - cheb(b, run.p))[0];
      scene.hover = t ? { x: t.x, y: t.y } : { x: run.p.x, y: run.p.y };
      showTip(scene.hover);
    }
    return;
  }
  if (k === 'm') { toggleSound(); return; }
  // 마법사: X sends a spark at the nearest monster in reach (Z is a step down and to the left)
  if (k === 'x' && run?.char.wand) { zapNearest(); return; }
  if (k === 'f') { nextSpeed(); showSpeed(); return; }
  if (item && canAct()) { clearPath(); setAim(null); run.useItem(item); }
});

// Click-walking steps around things you would rather not step on by accident: traps you know of, and fire.
// Ice, goo and honey too, when there is another way; tapping right onto them still walks you there.
const SKIRT = [T.RING, T.ICE, T.SLIME, T.HONEY];

function onTileClick(x, y) {
  // the 도구 tray is open: a tap on the map just puts it away
  if (hud.trayOpen) { hud.trayOpen = false; if (run) hud.update(run); return; }
  // looking: the tap shows what is there and nothing else happens
  if (looking) { pinned = { x, y }; showTip(pinned); return; }
  // a tap first puts away a tip left up by a long press, like closing an info window in SPD
  if (pinned) { pinned = null; showTip(scene.hover); return; }
  if (!canAct()) return;
  const p = run.p;
  if (aiming) {
    if (run.canThrowAt(x, y, aiming)) { clearPath(); run.throwTool(aiming, x, y); setAim(null); }
    else if (x === p.x && y === p.y) setAim(false);
    return;
  }
  const e = run.enemyAt(x, y);
  if (e && run.isVisible(x, y)) {
    clearPath();
    if (run.touching(e, p)) { run.step(x - p.x, y - p.y); return; }
    // 마법사: a monster a few tiles off gets a spark from the wand instead of being walked up to
    if (run.canZapAt(x, y)) { run.castWand(x, y); return; }
    path = walkTo(x, y);
    if (path.length) { chase = e; scene.path = path; seenCount = visibleEnemies(); }
    return;
  }
  if (x === p.x && y === p.y) { clearPath(); run.wait(); return; }
  const m = run.map;
  // the big ore, a grave, a locked door: bump it when next to it, otherwise walk up to it
  if (isBump(m.tiles[idx(x, y)]) && m.explored[idx(x, y)]) {
    clearPath();
    if (cheb({ x, y }, p) === 1) { run.step(x - p.x, y - p.y); return; }
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => walkTo(x + dx, y + dy)).filter(q => q.length);
    if (near.length) { path = near.sort((a, b) => a.length - b.length)[0]; scene.path = path; }
    return;
  }
  if (!run.passable(x, y) || !m.explored[idx(x, y)]) return;
  path = walkTo(x, y);
  scene.path = path;
  seenCount = visibleEnemies();
}

// a mimic still posing as a chest, or someone to talk to, does not count as a threat
// (nor a beetle under the water, nor a shadow cat still melted into the dark)
const visibleEnemies = () => run.enemies.filter(e => e.hp > 0 && run.isVisible(e.x, e.y) && !['hide', 'npc', 'lurk'].includes(e.state) &&
  !(e.d.shade && cheb(e, run.p) > e.d.shade)).length;

function walkTo(x, y) {
  const m = run.map, p = run.p;
  if (!run.passable(x, y) || !m.explored[idx(x, y)]) return [];
  return pathTo(m, p.x, p.y, x, y,
    (tx, ty) => (isTrap(m.ter[idx(tx, ty)]) && !m.hidden[idx(tx, ty)]) || m.fire[idx(tx, ty)] > 0 || SKIRT.includes(m.ter[idx(tx, ty)]),
    // never change floors by walking over stairs on the way somewhere else
    (tx, ty) => isStairs(m.tiles[idx(tx, ty)]));
}

// auto-walk one step at a time so enemies get their turns in between (faster at 2x and 3x)
function walkTick() {
  setTimeout(walkTick, 120 / pace());
  if (!canAct()) return;
  if (chase) {
    const e = chase;
    if (e.hp <= 0 || !run.isVisible(e.x, e.y)) { clearPath(); return; }
    if (run.touching(e, run.p)) { clearPath(); run.step(e.x - run.p.x, e.y - run.p.y); return; }
    path = walkTo(e.x, e.y);
    scene.path = path;
  }
  if (!path.length) return;
  const [nx, ny] = path.shift();
  if (run.enemyAt(nx, ny) || !run.step(nx - run.p.x, ny - run.p.y)) { clearPath(); return; }
  // slid on ice or goo, or fell: find the way again from wherever you ended up
  if (path.length && cheb({ x: path[0][0], y: path[0][1] }, run.p) !== 1) {
    const [tx, ty] = path[path.length - 1];
    path = run.map ? walkTo(tx, ty) : [];
    scene.path = path;
  }
}
walkTick();

// asleep or knocked out: the turns pass by themselves
function dozeTick() {
  setTimeout(dozeTick, 380 / pace());
  if (run && !run.over && !modalOpen() && run.queue.length === 0 && (run.p.sleep || run.p.stun)) run.passTurn();
}
dozeTick();

// 배속 1x → 2x → 3x
function showSpeed() { $('speedBtn').textContent = `배속 ${speed()}x`; }
$('speedBtn').addEventListener('click', () => { nextSpeed(); showSpeed(); });
showSpeed();

// sound: all on → effects only (no music) → all off, remembered between visits
function showSoundState() {
  const t = sfx.isMuted() ? '소리 끔' : musicOff() ? '효과음만' : '소리 켬';
  for (const id of ['soundBtn', 'vSound']) $(id).textContent = t;
}
function toggleSound() {
  sfx.unlockAudio();
  if (sfx.isMuted()) { sfx.setMuted(false); setMusicOff(false); }
  else if (!musicOff()) setMusicOff(true);
  else sfx.setMuted(true);
  showSoundState();
}
$('soundBtn').addEventListener('click', toggleSound);
$('vSound').addEventListener('click', toggleSound);
// 32px or 16px characters: the textures are built once, so switching reloads the page (the save is kept)
$('vGo').addEventListener('click', () => chooseStage());
showSoundState();
// browsers allow sound only after the first click or key press
// (iPhone only counts a finger lifting or a click, so listen for those every time, not just once)
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => sfx.unlockAudio(), { passive: true });
// iPhone Safari zooms the whole page on a pinch even over the map; the map does its own zoom
document.addEventListener('gesturestart', ev => ev.preventDefault());

$('waitBtn').addEventListener('click', restOnce);
$('lookBtn').addEventListener('click', () => setLook(!looking));
$('bagClose').addEventListener('click', () => setBag(false));
$('shade').addEventListener('click', () => setBag(false));
// 나가기: save the trip and go home (pick it up later from the village), or give it up for good
$('quitBtn').addEventListener('click', () => {
  if (!run || run.over || modalOpen()) return;
  clearPath();
  setAim(false);
  showChoice({
    title: '탐험을 멈출까?', sub: '탐험은 저절로 저장된다. 언제 꺼도 이 순간부터 이어서 할 수 있다.', run,
    opts: [
      { kind: 'ok', id: 'save', name: '저장하고 마을로', desc: '지금 이대로 두고 마을에 간다. 마을의 이어서 탐험 버튼으로 돌아온다.' },
      run.banked ? { kind: 'ok', id: 'quit', name: '마을로 돌아가기', desc: '돌파는 이미 했다. 깊은 곳에서 모은 것까지 다 들고 간다.' }
        : { kind: 'ok', id: 'quit', name: '탐험 포기', desc: '여기서 끝내고 돌아간다. 지금까지 주운 골드는 가져간다.' },
      { kind: 'ok', id: 'stay', name: '계속하기', desc: '들판으로 돌아간다.' },
    ],
    onPick: o => {
      if (o.id === 'save') saveAndLeave();
      if (o.id === 'quit') { run.cause = '스스로 돌아왔다'; run.finish(!!run.banked); }
    },
  });
});
function saveAndLeave() {
  putAway();
  scene.detach();
  run = null;
  showVillage();
  showVillageTip('탐험을 저장했다. 이어서 탐험을 누르면 그 자리로 돌아간다.', true);
}

// ---------- boot ----------
// The canvas has one pixel per screen pixel (sharp on phones), shown at the stage's CSS size.
const DPR = Math.min(3, window.devicePixelRatio || 1);
const TOUCH = window.matchMedia('(pointer: coarse)').matches;
// the pixel fonts (fonts/, styles.css) are in before the first word is drawn on the canvas
const fontsIn = Promise.all(['10px Galmuri9', '12px Galmuri11', 'bold 12px Galmuri11', '15px Galmuri14'].map(f => document.fonts.load(f))).catch(() => {});
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'phaser',
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#07060a',
  scale: { mode: Phaser.Scale.NONE, width: 320, height: 240, zoom: 1 / DPR },
  callbacks: { preBoot: g => { g.registry.set('dpr', DPR); g.registry.set('touch', TOUCH); } },
  scene: [new DungeonScene(s => {
    scene = s;
    scene.onTileClick = onTileClick;
    scene.onHover = (x, y) => { if (!pinned) showTip(x === null ? null : { x, y }); };
    scene.onHold = (x, y) => {
      pinned = { x, y };
      showTip(pinned);
      if (!$('tip').hidden) navigator.vibrate?.(12);
    };
    // the dungeon scene builds every texture; once it is up, open in the village (the very first
    // time, after the opening picture book)
    // a run left off last time picks up where it was; otherwise the village
    fontsIn.then(() => {
      const left = meta.story.intro && resume(meta);
      if (left) {
        try { startRun(left); return; } catch (e) { clearSuspended(); run = null; console.warn('could not pick the run up again', e); }
      }
      meta.story.intro ? showVillage() : showStory('intro', () => showVillage());
    });
  }), new VillageScene(villageHooks), new StoryScene()],
});

function fitCanvas() {
  const box = $('phaser').getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return;
  const w = Math.round(box.width * DPR), h = Math.round(box.height * DPR);
  if (w !== game.scale.width || h !== game.scale.height) game.scale.resize(w, h);
  game.scale.updateBounds();
}
new ResizeObserver(fitCanvas).observe($('phaser'));

// the page going away (tab closed, app switched, phone locked): write the run down, and the save with
// it (kills, finds and recipes count as they happen, so they must match the run that comes back)
function putAway() {
  if (!run || run.over) return;
  suspend(run);
  saveMeta(meta);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) putAway(); });
window.addEventListener('pagehide', putAway);

// test hook for automated play-testing; harmless in normal play
window.__game = { get run() { return run; }, get meta() { return meta; }, get scene() { return scene; }, get village() { return village(); }, startRun, setAim, showVillage, showStory, talkTo };
