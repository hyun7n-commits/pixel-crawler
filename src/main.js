// Entry point: connects the saved progress, the village, the run rules, the Phaser scenes and the HUD.

/* global Phaser */
import { DungeonScene } from './scenes/DungeonScene.js';
import { VillageScene } from './scenes/VillageScene.js';
import { StoryScene } from './scenes/StoryScene.js';
import { playStory } from './ui/story.js';
import { Run, isBossFloor } from './core/run.js';
import { loadMeta, saveMeta } from './core/save.js';
import { suspend, resume, clearSuspended } from './core/suspend.js';
import { pathTo, idx, isBump, isStairs } from './core/dungeon.js';
import { ENEMIES } from './data/enemies.js';
import { cheb } from './core/util.js';
import { T, isTrap } from './data/terrain.js';
import { Hud, lowHealth } from './ui/hud.js';
import { renderPanel, renderVillageHud } from './ui/hub.js';
import { showChoice, showSummary, showTalk, closeTalk, closeModal, modalOpen } from './ui/modal.js';
import { showEvolve } from './ui/evo.js';
import { bossCard } from './ui/bosscard.js';
import { FOLK } from './data/village.js';
import { DECOR } from './data/home.js';
import { CHARACTERS } from './data/characters.js';
import { describeTile } from './ui/tip.js';
import { $ } from './ui/dom.js';
import * as sfx from './audio/sfx.js';
import { setMusic, musicOff, setMusicOff } from './audio/music.js';
import { HIRES, setHires } from './scenes/textures.js';

let meta = loadMeta();
let run = null;
let scene = null;
let path = [];
let seenCount = 0;
let aiming = false;
let chase = null;   // an enemy tapped from afar: walk up to it and hit it once
let pinned = null;  // tile whose tip stays up after a long press on a phone
let inVillage = false;

const hud = new Hud({
  onUseItem: id => {
    setBag(false);
    if (id === 'bomb') { setAim(!aiming); return; }
    if (canAct()) { clearPath(); setAim(false); run.useItem(id); }
  },
  onWait: () => restOnce(),
  onBag: () => setBag(!$('game').classList.contains('bag-open')),
});

const canAct = () => run && !run.over && !modalOpen() && run.canAct() && !scene?.busy();
const clearPath = () => { path = []; chase = null; if (scene) scene.path = path; };
const tipAt = () => pinned || scene?.hover;

function restOnce() {
  if (canAct()) { clearPath(); setAim(false); run.wait(); }
}

// On a phone the side panel is a bag that slides up from the bottom.
function setBag(open) {
  $('game').classList.toggle('bag-open', !!open);
}

// Throwing a bomb: press the bomb (or 2), then pick a tile on the map.
function setAim(on) {
  aiming = !!(on && canAct() && run.p.items.bomb > 0);
  if (scene) scene.aim = aiming;
  hud.aiming = aiming;
  if (run) hud.update(run);
  showTip(tipAt());
}

function showTip(h) {
  const tip = $('tip');
  let text = '';
  if (run && aiming) {
    text = '폭탄을 던질 곳을 고른다 · 취소: Esc 또는 폭탄 버튼';
    if (h && run.canThrowAt(h.x, h.y) && cheb(h, run.p) <= 1) text += '\n바로 옆이라 나도 맞는다!';
  } else if (run && h) text = describeTile(run, h.x, h.y, h === pinned);
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
  const id = meta.stats.wins && !st.ending ? 'ending' : ['ratking', 'skelking'].find(b => beat.includes(b) && !st[b]);
  // the ending covers the licenses that came with it
  if (id === 'ending') st.ratking = st.skelking = true;
  if (id) showStory(id, () => showVillage('run'));
  else showVillage('run');
}

// `restored`: a run left off last time (core/suspend.js), picked up where it was
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
  run = restored || new Run(meta, meta.sel);
  hud.reset();
  run.on(onRunEvent);
  scene.attach(run);
  if (restored) {
    setMusic(isBossFloor(run.floor) ? 'boss' : run.zone.style);
    run.log('하던 토벌을 이어서 한다.', 'good');
    run.emit('turn');
    return;
  }
  run.start();
  // no manual up front: the first runs get one line on how to ask about anything
  if (meta.stats.runs < 2) run.log(TOUCH ? '모르는 게 보이면 꾹 눌러 보자. 설명이 나온다.' : '모르는 게 보이면 마우스를 올려 보자. 설명이 나온다.');
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
      onStart: startRun,
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
  onLeave: () => startRun(),
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
  if (type === 'banner') setTimeout(() => hud.banner(d.text), scene?.busy() ? 650 : 0);
  if (type === 'discover') hud.banner(`새 발견! ${d.d.combo}`);
  if (type === 'request') setTimeout(() => hud.banner(`조합 의뢰 완료! +${d.pay}G`), 300);
  if (type === 'evolve') showEvolve(d);
  if (type === 'fission') hud.fission(d);
  if (type === 'floor') { clearPath(); seenCount = 0; setMusic(isBossFloor(run.floor) ? 'boss' : run.zone.style); }
  if (type === 'kill' && d.enemy.d.boss && !run.victory) setMusic(run.zone.style);
  if (type === 'phit') clearPath();
  if (type === 'turn') afterTurn();
  // written down now and then, so closing the page mid-run loses nothing (core/suspend.js)
  if ((type === 'floor' || (type === 'turn' && run.turn % 10 === 0)) && !run.over) setTimeout(putAway, 0);
  if (type === 'end') {
    clearSuspended();
    setMusic(null);
    clearPath();
    setAim(false);
    // what the neighbour will be talking about when you get back
    meta.lastRun = {
      won: d.won, floor: run.floor, zone: run.zone.name, cause: run.cause, kills: run.kills, gold: run.gold,
      recipes: run.newRecipes.length, who: CHARACTERS[meta.sel].name,
    };
    saveMeta(meta);
    hud.update(run);
    showSummary({ won: d.won, run, newlyUnlockable: d.newlyUnlockable, stepOpened: d.stepOpened, onClose: () => { scene.detach(); run = null; afterRunStory(); } });
  }
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
  const onPick = o => { run.choose(o); hud.update(run); nextChoice(); };
  if (q.kind === 'talk') {
    const npc = ENEMIES[q.who];
    showChoice({ title: npc.name, sub: q.text, run, who: npc.sprite, opts: q.smithPick ? run.smithOffers() : q.opts, onPick });
    return;
  }
  const title = q.kind === 'level' ? `레벨 ${run.p.lvl}!` : q.vein ? '바위 속 상자' : q.rich ? '잠긴 상자' : '보물 상자';
  const sub = q.kind === 'level' ? '유물을 하나 고르자.' : q.rich ? '좋은 상자다. 넷 중 하나를 가져가자.' : '안에 든 유물 중 하나를 가져가자.';
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
    if (b) { ev.preventDefault(); b.click(); }
    return;
  }
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  // in the village: walk a step, or bump whoever is there; Enter heads out
  if (inVillage) {
    if (KEYS[k]) { ev.preventDefault(); village().step(...KEYS[k]); }
    if (k === 'Enter' && document.activeElement === document.body) startRun();
    if (k === 'm') toggleSound();
    return;
  }
  if (!run || $('game').hidden) return;
  if (k === 'Escape') { setAim(false); clearPath(); return; }
  if (ARROWS.has(k)) {
    ev.preventDefault(); clearPath(); setAim(false);
    held.add(k); tapped.add(k);
    if (!chordTimer) chordTimer = setTimeout(chordStep, 45);
    return;
  }
  if (KEYS[k]) { ev.preventDefault(); clearPath(); setAim(false); if (canAct()) run.step(...KEYS[k]); return; }
  if (k === ' ' || k === '.') { ev.preventDefault(); clearPath(); setAim(false); if (canAct()) run.wait(); return; }
  if (k === '2') { setAim(!aiming); return; }
  if (k === 'm') { toggleSound(); return; }
  const item = { 1: 'potion', 3: 'map' }[k];
  if (item && canAct()) { clearPath(); setAim(false); run.useItem(item); }
});

// Click-walking steps around things you would rather not step on by accident: traps you know of, and fire.

function onTileClick(x, y) {
  // a tap first puts away a tip left up by a long press, like closing an info window in SPD
  if (pinned) { pinned = null; showTip(scene.hover); return; }
  if (!canAct()) return;
  const p = run.p;
  if (aiming) {
    if (run.canThrowAt(x, y)) { clearPath(); run.throwBomb(x, y); setAim(false); }
    else if (x === p.x && y === p.y) setAim(false);
    return;
  }
  const e = run.enemyAt(x, y);
  if (e && run.isVisible(x, y)) {
    clearPath();
    if (run.touching(e, p)) { run.step(x - p.x, y - p.y); return; }
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
const visibleEnemies = () => run.enemies.filter(e => e.hp > 0 && run.isVisible(e.x, e.y) && e.state !== 'hide' && e.state !== 'npc').length;

function walkTo(x, y) {
  const m = run.map, p = run.p;
  if (!run.passable(x, y) || !m.explored[idx(x, y)]) return [];
  return pathTo(m, p.x, p.y, x, y,
    (tx, ty) => (isTrap(m.ter[idx(tx, ty)]) && !m.hidden[idx(tx, ty)]) || m.fire[idx(tx, ty)] > 0 || m.ter[idx(tx, ty)] === T.RING,
    // never change floors by walking over stairs on the way somewhere else
    (tx, ty) => isStairs(m.tiles[idx(tx, ty)]));
}

// auto-walk one step at a time so enemies get their turns in between
setInterval(() => {
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
  if (run.enemyAt(nx, ny) || !run.step(nx - run.p.x, ny - run.p.y)) clearPath();
}, 120);

// asleep or knocked out: the turns pass by themselves
setInterval(() => {
  if (run && !run.over && !modalOpen() && run.queue.length === 0 && (run.p.sleep || run.p.stun)) run.passTurn();
}, 380);

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
$('vArt').textContent = HIRES ? '그림 32' : '그림 16';
$('vArt').addEventListener('click', () => { setHires(!HIRES); location.reload(); });
$('vGo').addEventListener('click', () => startRun());
showSoundState();
// browsers allow sound only after the first click or key press
// (iPhone only counts a finger lifting or a click, so listen for those every time, not just once)
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => sfx.unlockAudio(), { passive: true });
// iPhone Safari zooms the whole page on a pinch even over the map; the map does its own zoom
document.addEventListener('gesturestart', ev => ev.preventDefault());

$('waitBtn').addEventListener('click', restOnce);
$('bagClose').addEventListener('click', () => setBag(false));
$('shade').addEventListener('click', () => setBag(false));
let quitArmed = 0;
$('quitBtn').addEventListener('click', () => {
  if (!run || run.over || modalOpen()) return;
  const b = $('quitBtn');
  if (Date.now() - quitArmed < 3000) { b.textContent = '포기하기'; run.cause = '스스로 돌아왔다'; run.finish(false); return; }
  quitArmed = Date.now();
  b.textContent = '한 번 더 누르면 포기';
  setTimeout(() => { b.textContent = '포기하기'; }, 3000);
});

// ---------- boot ----------
// The canvas has one pixel per screen pixel (sharp on phones), shown at the stage's CSS size.
const DPR = Math.min(3, window.devicePixelRatio || 1);
const TOUCH = window.matchMedia('(pointer: coarse)').matches;
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
    setTimeout(() => {
      const left = meta.story.intro && resume(meta);
      if (left) {
        try { startRun(left); return; } catch (e) { clearSuspended(); run = null; console.warn('could not pick the run up again', e); }
      }
      meta.story.intro ? showVillage() : showStory('intro', () => showVillage());
    }, 0);
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

// test hook for automated play-testing; harmless in normal play
// the page going away (tab closed, app switched, phone locked): write the run down, and the save with
// it (kills, finds and recipes count as they happen, so they must match the run that comes back)
function putAway() {
  if (!run || run.over) return;
  suspend(run);
  saveMeta(meta);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) putAway(); });
window.addEventListener('pagehide', putAway);

window.__game = { get run() { return run; }, get meta() { return meta; }, get scene() { return scene; }, get village() { return village(); }, startRun, setAim, showVillage, showStory };
