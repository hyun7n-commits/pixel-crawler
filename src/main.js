// Entry point: connects the saved progress, the village, the run rules, the Phaser scenes and the HUD.

/* global Phaser */
import { DungeonScene } from './scenes/DungeonScene.js';
import { VillageScene } from './scenes/VillageScene.js';
import { HomeScene } from './scenes/HomeScene.js';
import { StoryScene } from './scenes/StoryScene.js';
import { playStory } from './ui/story.js';
import { Run, BOMB_RANGE } from './core/run.js';
import { loadMeta, saveMeta } from './core/save.js';
import { suspend, resume, clearSuspended, savedRun } from './core/suspend.js';
import { pathTo, idx, isBump, isStairs, WALL } from './core/dungeon.js';
import { ENEMIES, ZONES } from './data/enemies.js';
import { cleared } from './data/stages.js';
import { cheb, josa } from './core/util.js';
import { ITEMS } from './data/items.js';
import { T, isTrap } from './data/terrain.js';
import { Hud, lowHealth } from './ui/hud.js';
import { renderPanel, renderVillageHud } from './ui/hub.js';
import { renderHomeHud, heartLine } from './ui/homehud.js';
import { showChoice, showSummary, showTalk, closeTalk, closeModal, modalOpen, showUpdateNews, openSheet } from './ui/modal.js';
import { sinceUpdate, isOpen } from './data/unlocks.js';
import { showStages } from './ui/stages.js';
import { showBoard } from './ui/board.js';
import { showEvolve } from './ui/evo.js';
import { showsLeft } from './ui/beat.js';
import { speed, pace, nextSpeed } from './ui/speed.js';
import { bossCard } from './ui/bosscard.js';
import { FOLK, villageP, ownsHome } from './data/village.js';
import { placed, rollVisitor, roomOf, bringIn } from './data/home.js';
import { CHARACTERS } from './data/characters.js';
import { describeTile } from './ui/tip.js';
import { secretOf } from './data/secrets.js';
import { record, bookCount } from './data/book.js';
import { toast } from './ui/toast.js';
import { renderBook } from './ui/book.js';
import { $, el, button, icon } from './ui/dom.js';
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
let inHome = false;   // inside your house (scenes/HomeScene.js); the village sleeps meanwhile

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
  g.classList.remove('low', 'bag-open', 'home');
  if (inHome) { inHome = false; game.scene.sleep('home'); }
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
  // the stage, then the guild's board (ui/board.js) once requests are open, then out
  showStages({
    meta,
    onGo: () => {
      saveMeta(meta);
      if (!isOpen(meta, 'request')) { startRun(); return; }
      showBoard({ meta, onGo: () => { saveMeta(meta); startRun(); }, onBack: () => { saveMeta(meta); chooseStage(); } });
    },
  });
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
      // the carpenter's: a yard piece goes up while you watch; furniture and building on show inside
      onDecor: d => { closeTalk(); sfx.play('buy'); village().showDecor(d); },
      onFurniture: () => sfx.play('buy'),
      onExtend: () => { closeTalk(); sfx.play('levelup'); hud.banner(`집이 넓어졌다! ${roomOf(meta).name}`); village().showHomeGrow(); },
      onGoHome: ownsHome(meta) ? () => { closeTalk(); showHome(); } : null,
    }),
  });
}

// Through your own door (scenes/HomeScene.js): the village sleeps while you are in, and wakes with you
// on the doorstep when you come out.
const home = () => game.scene.getScene('home');

function showHome() {
  if (inHome) return;
  inVillage = false;
  inHome = true;
  showVillageTip('');
  sfx.play('door');
  $('game').classList.add('home');
  game.scene.sleep('village');
  const first = !meta.house.seen;
  meta.house.seen = true;
  // a 비밀 상자 found before there was a house to put it in goes in the first time you are in
  if (first && meta.house.own.secretbox && !placed(meta).secretbox) bringIn(meta, 'secretbox');
  saveMeta(meta);
  game.scene.run('home', { meta, first });
  homeHud();
  requestAnimationFrame(() => home().fit());
}

function leaveHome() {
  if (!inHome) return;
  inHome = false;
  showVillageTip('');
  sfx.play('door');
  $('game').classList.remove('home');
  game.scene.sleep('home');
  inVillage = true;
  game.scene.run('village', { meta, from: 'home' });
  renderVillageHud(meta);
}

// the bar over the room (ui/homehud.js), and the tray while arranging
function homeHud() {
  const h = home();
  renderHomeHud(meta, {
    editing: !!h?.editing, held: h?.held,
    onPick: id => h.holdNew(id),
    onAway: () => h.putAway(),
  });
}
function setHomeEdit(on) {
  const h = home();
  if (!inHome || !h) return;
  h.setEditing(on);
  homeHud();
  // the tray takes room at the bottom: the room settles above it
  requestAnimationFrame(() => h.fit());
}

const homeHooks = {
  onExit: () => leaveHome(),
  onStep: alt => sfx.play('step', alt),
  onHover: (text, flash) => showVillageTip(text, flash),
  onSound: name => sfx.play(name),
  onChange: () => { saveMeta(meta); homeHud(); },
  onHeld: () => homeHud(),
  // the friend who dropped in left a little something
  onGift: n => {
    meta.gold += n;
    saveMeta(meta);
    sfx.play('nugget');
    hud.banner(`선물 +${n}G`);
    homeHud();
  },
  onSecret: id => foundSecret(id),
  onEntry: id => foundEntry(id),
  onCoins: n => { meta.gold += n; saveMeta(meta); sfx.play('nugget'); homeHud(); },
  // the 비밀 상자: the 비밀 도감, every odd thing found so far (ui/book.js)
  onSecrets: () => openBook('비밀 상자'),
  // the bookshelf: the trip records and the critter book
  onBook: () => {
    sfx.play('pluck');
    showVillageTip('');
    showTalk({
      who: CHARACTERS[meta.sel].sprite, name: '책장', line: '탐험 일지랑 들판 친구 도감이 꽂혀 있다.',
      build: box => renderPanel('records', box, { meta }),
    });
  },
  // how much room the bars take, top and bottom (CSS pixels)
  insets: () => {
    const st = $('stage').getBoundingClientRect();
    const top = document.querySelector('#hhud .vh-top').getBoundingClientRect(), bot = document.querySelector('#hhud .hh-bottom').getBoundingClientRect();
    return { top: Math.max(0, top.bottom - st.top) + 4, bottom: Math.max(0, st.bottom - bot.top) + 4 };
  },
};

const villageHooks = {
  onTalk: talkTo,
  onHome: () => showHome(),
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
  // the village as you saw it this time, so the next visit can show what has grown since
  onSeen: st => {
    meta.village.last = { P: st.P, arr: [...st.arr] };
    saveMeta(meta);
  },
  // something new in the village (a clear's piece, a friend's cottage), or the village's new name
  onGrow: (text, big) => {
    hud.banner(text);
    sfx.play(big ? 'welcome' : 'buy');
  },
  onStep: alt => sfx.play('step', alt),
  onHover: (text, flash) => showVillageTip(text, flash),
  onFind: n => {
    meta.gold += n;
    saveMeta(meta);
    sfx.play('nugget');
    renderVillageHud(meta);
  },
  onSound: name => sfx.play(name),
  onSecret: id => foundSecret(id),
  onEntry: id => foundEntry(id),
  found: id => !!meta.secrets[id],
};

// 비밀 (data/secrets.js): the first time one turns up, a chime, a banner, and its page in the 비밀 도감.
// Out in the fields the run has written it down already (core/run.js secret).
function foundSecret(id) {
  if (!secretOf(id) || !record(meta, `secret:${id}`)) return false;
  announceSecret(id);
  return true;
}
function announceSecret(id) {
  boxHome();
  saveMeta(meta);
  sfx.play('secret');
  hud.banner(`비밀 발견! ${secretOf(id).name}`, 2800);
  toast(meta, `secret:${id}`, () => renderVillageHud(meta));
}
// The first find of anything brings the 비밀 상자 home, straight into the room if there is one and room in it
function boxHome() {
  if (meta.house.own.secretbox) return;
  meta.house.own.secretbox = true;
  if (ownsHome(meta)) bringIn(meta, 'secretbox');
}
// 비밀 도감 (data/book.js): anything else odd turning up in the village or at home; out in the fields the
// run writes it down (core/run.js find) and says so here (onRunEvent 'find')
function foundEntry(id) {
  if (!record(meta, id)) return false;
  announceFind(id);
  return true;
}
function announceFind(id) {
  boxHome();
  saveMeta(meta);
  toast(meta, id, () => { sfx.play('find'); if (inVillage) renderVillageHud(meta); });
}
// the book itself, from the 비밀 상자 at home or the village's top bar
function openBook(name = '비밀 도감') {
  sfx.play('pluck');
  showVillageTip('');
  showTalk({
    who: CHARACTERS[meta.sel].sprite, name, line: bookCount(meta) ? '찾아낸 것마다 한 칸씩 채워 둔다. 아직 빈칸이 많다.' : '아직 아무것도 없다. 이상한 걸 보면 여기 적어 두자.',
    build: (box, redraw) => renderBook(box, meta, { changed: () => { saveMeta(meta); sfx.play('buy'); redraw(); renderVillageHud(meta); if (inHome) homeHud(); } }),
  });
}

// The village's tip line: who someone is when the mouse rests on them, or a short note after a tap.
let villageTipTimer = 0;
function showVillageTip(text, flash) {
  if (!inVillage && !inHome && text) return;
  const tip = $('tip');
  tip.textContent = text;
  tip.hidden = !text;
  clearTimeout(villageTipTimer);
  if (flash && text) villageTipTimer = setTimeout(() => { tip.hidden = true; }, Math.max(1800, text.length * 55));
}

function onRunEvent(type, d) {
  sfx.onRunEvent(type, d);
  sfx.setHeartbeat(lowHealth(run));
  if (type === 'log') hud.log(d.text, d.cls);
  // a new field's name shows once you have popped out of the burrow
  if (type === 'banner') setTimeout(() => hud.banner(d.text), Math.max(scene?.busy() ? 650 : 0, showsLeft()));
  if (type === 'discover') hud.banner(`새 발견! ${d.d.combo}`);
  // a boss down: a short fanfare and a word across the screen (v0.29)
  if (type === 'bossDown') setTimeout(() => { sfx.play('fanfare'); hud.banner(d.last ? '대장을 쓰러뜨렸다!' : `${josa(d.name, '을', '를')} 쓰러뜨렸다!`, 2400); }, 350);
  if (type === 'secret') setTimeout(() => announceSecret(d.id), d.delay || 0);
  if (type === 'find') setTimeout(() => announceFind(d.id), d.delay || 0);
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
      tools: run.toolUse || {}, routes: run.routesTaken || [], brawls: run.brawls || 0, found: [...(run.found || [])],
      // a stage beaten at a 회차 for the first time: the village puts its next piece up (data/village.js BUILD)
      grew: d.won && run.firstClear ? villageP(meta) : 0,
    };
    // at home meanwhile: the plant grew a little, and maybe a friend dropped in (one who is still
    // waiting with a present stays)
    if (placed(meta).plant) meta.house.plant = (meta.house.plant || 0) + 1;
    if (!(meta.house.visit?.gift > 0)) meta.house.visit = ownsHome(meta) ? rollVisitor(meta, villageP(meta), meta.sel) : null;
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
  // some things take a moment to come up (the pond spirit rising, nodding off): the sheet waits for them
  if (q.delay) {
    q.at ||= Date.now() + q.delay / pace();
    const left = Math.min(q.delay, q.at - Date.now());
    if (left > 20) { clearTimeout(nextChoice.wait); nextChoice.wait = setTimeout(nextChoice, left); return; }
  }
  const onPick = o => { run.choose(o); if (run) hud.update(run); nextChoice(); };
  // 낮잠 꿈 (v0.28): a glimpse of something in a dream, and waking up
  if (q.kind === 'dream') {
    showChoice({
      title: '꿈', sub: q.text, run, onPick, who: q.pic || CHARACTERS[run.charId].sprite,
      opts: [{ kind: 'ok', act: 'wake', name: '눈을 뜬다', desc: '…꿈이었다. 한숨 자고 나니 몸이 개운하다.' }],
    });
    return;
  }
  // 연못 신령 (v0.28): up from the pond with what you threw in and a golden one, and a question
  if (q.kind === 'spirit') {
    const it = ITEMS[q.tool], gold = `황금 ${it.name}`;
    showChoice({
      title: '연못 신령', who: 'spirit', run, onPick,
      sub: `"이 ${josa(it.name, '이', '가')} 네 것이냐? 아니면 이 ${josa(gold, '이', '가')} 네 것이냐?"`,
      opts: [
        { kind: 'ok', act: 'honest', icon: it.sprite, name: `그냥 ${josa(it.name, '이에요', '예요')}.`, desc: '내가 던진 건 평범한 거였다.' },
        { kind: 'ok', act: 'greedy', icon: 'gold', name: `${josa(gold, '이에요', '예요')}!`, desc: '금으로 된 쪽이 훨씬 좋아 보인다.' },
      ],
    });
    return;
  }
  // into the hole behind the boss's chest, or a burrow down in 깊은 곳: home with all of it, or another
  // floor down for more (and harder); or not yet
  if (q.kind === 'deeper') {
    const deep = run.deepGold, depth = run.depth;
    showChoice({
      title: depth ? `깊은 곳 ${depth}의 땅굴` : '대장 방 바닥의 구멍',
      sub: deep ? `깊은 곳에서 ${deep}G를 주웠다. 여기서 돌아가면 다 내 것이다.` : '굴 아래에서 찬 바람이 올라온다.', run, onPick,
      opts: [
        { kind: 'ok', act: 'home', icon: 'gold', name: '마을로 돌아간다', desc: deep ? `주운 ${deep}G와 돌파 보너스를 다 들고 간다.` : '탐험 성공. 모은 골드와 돌파 보너스를 들고 간다.' },
        depth ? { kind: 'ok', act: 'deeper', icon: 'stairs', name: '더 내려간다', desc: `깊은 곳 ${depth + 1}: 적은 더 세지고 골드는 더 많이 나온다. 쓰러지면 깊은 곳에서 주운 골드를 모두 두고 온다.` }
          : { kind: 'ok', act: 'deeper', icon: 'stairs', name: '더 깊이 들어간다', desc: '한 층 내려갈 때마다 적이 훨씬 세지고 골드도 더 많이 나온다. 깊은 곳에서 주운 골드는 땅굴에서 돌아가야 들고 간다. 쓰러지면 두고 온다.' },
        { kind: 'ok', act: 'stay', icon: 'look', name: '조금 더 둘러본다', desc: depth ? '이 들판에 남는다. 땅굴은 그대로 있다.' : '대장 방에 남는다. 구멍은 그대로 있다.' },
      ],
    });
    return;
  }
  // 소원 우물: one relic in, another out, or leave it for later
  if (q.kind === 'well') {
    showChoice({
      title: '소원 우물', sub: '유물을 하나 던져 넣으면 같은 레벨의 다른 유물로 바뀌어 떠오른다. 무엇이 될지는 모른다. 한 번뿐이다.', run, onPick,
      opts: [...run.wellOffers(), { kind: 'ok', act: 'leave', icon: 'well', name: '그냥 둔다', desc: '우물은 그대로 있다. 나중에 다시 와도 된다.' }],
    });
    return;
  }
  if (q.kind === 'talk') {
    const npc = ENEMIES[q.who];
    showChoice({ title: npc.name, sub: q.text, run, who: npc.sprite, opts: q.smithPick ? run.smithOffers() : q.opts, onPick });
    return;
  }
  const title = q.kind === 'level' ? `레벨 ${run.p.lvl}!` : q.kind === 'kit' ? `출발 보급 ${q.k}/${q.n}` : q.sneak ? '낮잠 방 상자' : q.vein ? '바위 속 상자' : q.locked ? '잠긴 상자' : q.rich ? '금테 상자' : '보물 상자';
  const sub = q.kind === 'level' ? '유물을 하나 고르자.' : q.kind === 'kit' ? '조합이 챙겨 준 보급품이다. 고른 유물은 다 자란 채로 받는다.'
    : q.sneak ? '아무도 깨지 않았다. 넷 중 하나를 가져가자.' : q.rich ? '좋은 상자다. 넷 중 하나를 가져가자.' : '안에 든 유물 중 하나를 가져가자.';
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
  // in the house: walk, bump the furniture; while arranging, the arrows move the mark and Enter picks
  // up or puts down; Esc puts back what is in hand, finishes arranging, or goes out
  if (inHome) {
    const h = home();
    if (KEYS[k]) { ev.preventDefault(); h.step(...KEYS[k]); }
    if ((k === 'Enter' || k === ' ') && h.editing && document.activeElement === document.body) { ev.preventDefault(); h.confirmCursor(); }
    if (k === 'Escape') { if (h.held) h.putBack(); else if (h.editing) setHomeEdit(false); else leaveHome(); }
    if (k === 'm') toggleSound();
    return;
  }
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
  // a wall right beside you: a nudge at it, like walking into it (a gap of light in it, or a bush with
  // someone asleep in it, gives itself away like that)
  if (m.tiles[idx(x, y)] === WALL && m.explored[idx(x, y)] && cheb({ x, y }, p) === 1) { clearPath(); run.step(x - p.x, y - p.y); return; }
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
    // never change floors by walking over stairs on the way somewhere else, nor pick up a caged relic
    // on the way to another (taking one shatters the rest: v0.29, a tap on one took the one in between)
    (tx, ty) => isStairs(m.tiles[idx(tx, ty)]) || run.pickups.some(q => q.type === 'crystal' && q.x === tx && q.y === ty));
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
// 설정 (v0.29): on a phone the sound, the speed and giving up sit behind a cog at the top, out on the
// field, instead of only in the bag
const soundLabel = () => (sfx.isMuted() ? '소리 끔' : musicOff() ? '효과음만' : '소리 켬');
function showOptions() {
  if (!run || run.over || modalOpen()) return;
  clearPath();
  setAim(false);
  setBag(false);
  openSheet(sh => {
    sh.append(el('h2', null, '설정'));
    const list = el('div', 'opt-list');
    const snd = button('btn opt', `소리: ${soundLabel()}`, () => { toggleSound(); snd.textContent = `소리: ${soundLabel()}`; });
    const spd = button('btn opt', `배속: ${speed()}x`, () => { nextSpeed(); showSpeed(); spd.textContent = `배속: ${speed()}x`; });
    const out = button('btn opt', '탐험 그만두기', () => { closeModal(); $('quitBtn').click(); });
    list.append(snd, spd, out);
    sh.append(list);
  }, () => closeModal());
}
$('mOpt').append(icon('gear'));
$('mOpt').addEventListener('click', showOptions);
$('vSound').addEventListener('click', toggleSound);
$('vBook').addEventListener('click', () => { if (inVillage && !modalOpen()) openBook(); });
// 32px or 16px characters: the textures are built once, so switching reloads the page (the save is kept)
$('vGo').addEventListener('click', () => chooseStage());
// (the button lets go of the focus, so Enter and the arrows go on working the room)
$('hEdit').addEventListener('click', () => { setHomeEdit(!home().editing); $('hEdit').blur(); });
$('hOut').addEventListener('click', () => leaveHome());
$('hHeart').addEventListener('click', () => showVillageTip(heartLine(meta), true));
showSoundState();
// browsers allow sound only after the first click or key press
// (iPhone only counts a finger lifting or a click, so listen for those every time, not just once)
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => sfx.unlockAudio(), { passive: true });
// iPhone Safari zooms the whole page on a pinch even over the map; the map does its own zoom
document.addEventListener('gesturestart', ev => ev.preventDefault());

// 쉬기: a tap rests a turn; held down (like SPD's), it goes on resting until you let go or someone new
// comes into view
{
  const btn = $('waitBtn');
  let hold = 0, rep = 0, held = false;
  const stop = () => { clearTimeout(hold); clearInterval(rep); hold = rep = 0; };
  btn.addEventListener('pointerdown', () => {
    held = false;
    stop();
    hold = setTimeout(() => {
      if (!run || run.over) return;
      held = true;
      const seen = visibleEnemies();
      rep = setInterval(() => {
        if (!run || run.over || modalOpen() || visibleEnemies() > seen) { stop(); return; }
        if (canAct()) restOnce();
      }, 150 / pace());
    }, 420);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('contextmenu', ev => ev.preventDefault());
  btn.addEventListener('click', () => { if (held) held = false; else restOnce(); });
}
$('lookBtn').addEventListener('click', () => setLook(!looking));
$('bagClose').addEventListener('click', () => setBag(false));
$('shade').addEventListener('click', () => setBag(false));
// 나가기: give the trip up and go home. A trip is never put aside for a visit to the village (v0.29):
// closing the game keeps it, and opening the game again goes straight back to the same moment. Down in
// 깊은 곳 the only way home is a burrow, which asks each time: home, or deeper.
$('quitBtn').addEventListener('click', () => {
  if (!run || run.over || modalOpen()) return;
  clearPath();
  setAim(false);
  const deep = !!run.banked;
  showChoice({
    title: deep ? `돌아가는 길은 ${run.depth ? '땅굴' : '구멍'}뿐이다` : '탐험을 그만둘까?',
    sub: !deep ? '게임을 꺼도 탐험은 저장된다. 다시 켜면 이 순간부터 이어진다.'
      : run.depth ? '깊은 곳에서는 땅굴에 들어갈 때 마을로 돌아갈지 더 내려갈지 고른다.' : '대장 방 바닥의 구멍에 들어가면 마을로 돌아갈지 더 깊이 갈지 고른다.',
    run,
    opts: [
      ...(deep ? [] : [{ kind: 'ok', id: 'quit', name: '탐험 포기', desc: '여기서 끝내고 마을로 돌아간다. 지금까지 주운 골드는 가져간다.' }]),
      { kind: 'ok', id: 'stay', name: '계속하기', desc: '들판으로 돌아간다.' },
    ],
    onPick: o => {
      if (o.id === 'quit') { run.cause = '스스로 돌아왔다'; run.finish(false); }
    },
  });
});

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
      // back after an update: the first of what has come since is open already (data/unlocks.js)
      const news = sinceUpdate(meta);
      saveMeta(meta);
      if (!meta.story.intro) { showStory('intro', () => showVillage()); return; }
      showVillage();
      if (news.length) showUpdateNews(news);
    });
  }), new VillageScene(villageHooks), new HomeScene(homeHooks), new StoryScene()],
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
document.addEventListener('visibilitychange', () => { if (document.hidden) { putAway(); sfx.audioAway(); } });
window.addEventListener('pagehide', () => { putAway(); sfx.audioAway(); });

// test hook for automated play-testing; harmless in normal play
window.__game = { get run() { return run; }, get meta() { return meta; }, get scene() { return scene; }, get village() { return village(); }, get home() { return home(); }, startRun, setAim, showVillage, showStory, showHome, leaveHome, setHomeEdit, talkTo, foundEntry, openBook };
