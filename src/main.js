// Entry point: connects the saved progress, the hub, the run rules, the Phaser scene and the HUD.

/* global Phaser */
import { DungeonScene } from './scenes/DungeonScene.js';
import { Run } from './core/run.js';
import { loadMeta, saveMeta } from './core/save.js';
import { pathTo, idx, isBump, isStairs } from './core/dungeon.js';
import { ENEMIES } from './data/enemies.js';
import { cheb } from './core/util.js';
import { isTrap } from './data/terrain.js';
import { Hud } from './ui/hud.js';
import { renderHub } from './ui/hub.js';
import { showChoice, showSummary, modalOpen } from './ui/modal.js';
import { describeTile } from './ui/tip.js';
import { $ } from './ui/dom.js';
import * as sfx from './audio/sfx.js';

let meta = loadMeta();
let run = null;
let scene = null;
let path = [];
let seenCount = 0;
let aiming = false;
let chase = null;   // an enemy tapped from afar: walk up to it and hit it once
let pinned = null;  // tile whose tip stays up after a long press on a phone

const hud = new Hud({
  onUseItem: id => {
    setBag(false);
    if (id === 'bomb') { setAim(!aiming); return; }
    if (canAct()) { clearPath(); setAim(false); run.useItem(id); }
  },
  onWait: () => restOnce(),
  onBag: () => setBag(!$('game').classList.contains('bag-open')),
});

const canAct = () => run && !run.over && !modalOpen() && run.canAct();
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
function showHub() {
  $('hub').hidden = false;
  $('game').hidden = true;
  game.loop.sleep();
  renderHub({ meta, onStart: startRun, setMeta: m => { meta = m; showHub(); } });
}

function startRun() {
  sfx.unlockAudio();
  $('hub').hidden = true;
  $('game').hidden = false;
  game.loop.wake();
  setBag(false);
  pinned = null;
  // the stage was hidden while the hub was open, so measure it again before drawing
  fitCanvas();
  run = new Run(meta, meta.sel);
  hud.reset();
  run.on(onRunEvent);
  scene.attach(run);
  run.start();
  // no manual up front: the first runs get one line on how to ask about anything
  if (meta.stats.runs < 2) run.log(TOUCH ? '모르는 게 보이면 꾹 눌러 보자. 설명이 나온다.' : '모르는 게 보이면 마우스를 올려 보자. 설명이 나온다.');
  setAim(false);
}

function onRunEvent(type, d) {
  sfx.onRunEvent(type, d);
  if (type === 'log') hud.log(d.text, d.cls);
  if (type === 'banner') hud.banner(d.text);
  if (type === 'discover') hud.banner(`새 발견! ${d.d.combo}`);
  if (type === 'floor') { clearPath(); seenCount = 0; }
  if (type === 'phit') clearPath();
  if (type === 'turn') afterTurn();
  if (type === 'end') {
    clearPath();
    setAim(false);
    saveMeta(meta);
    hud.update(run);
    showSummary({ won: d.won, run, newlyUnlockable: d.newlyUnlockable, onClose: () => { scene.detach(); run = null; showHub(); } });
  }
}

function afterTurn() {
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
  const title = q.kind === 'level' ? `레벨 ${run.p.lvl}!` : q.rich ? '잠긴 상자' : '보물 상자';
  const sub = q.kind === 'level' ? '최대 체력 +3. 유물을 하나 고르자.' : q.rich ? '좋은 상자다. 넷 중 하나를 가져가자.' : '안에 든 유물 중 하나를 가져가자.';
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
    const n = parseInt(ev.key, 10);
    const b = n && $('modal').querySelector(`.choice[data-key="${n}"]`);
    if (b) { ev.preventDefault(); b.click(); }
    return;
  }
  if (!run || $('game').hidden) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
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
    (tx, ty) => (isTrap(m.ter[idx(tx, ty)]) && !m.hidden[idx(tx, ty)]) || m.fire[idx(tx, ty)] > 0,
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

// sound on/off, remembered between visits
function showSoundState() { $('soundBtn').textContent = sfx.isMuted() ? '소리 끔' : '소리 켬'; }
function toggleSound() { sfx.unlockAudio(); sfx.setMuted(!sfx.isMuted()); showSoundState(); }
$('soundBtn').addEventListener('click', toggleSound);
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
  scene: new DungeonScene(s => {
    scene = s;
    scene.onTileClick = onTileClick;
    scene.onHover = (x, y) => { if (!pinned) showTip(x === null ? null : { x, y }); };
    scene.onHold = (x, y) => {
      pinned = { x, y };
      showTip(pinned);
      if (!$('tip').hidden) navigator.vibrate?.(12);
    };
    showHub();
  }),
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
window.__game = { get run() { return run; }, get meta() { return meta; }, get scene() { return scene; }, startRun, setAim };
