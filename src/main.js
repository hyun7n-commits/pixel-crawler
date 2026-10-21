// Entry point: connects the saved progress, the hub, the run rules, the Phaser scene and the HUD.

/* global Phaser */
import { DungeonScene } from './scenes/DungeonScene.js';
import { Run } from './core/run.js';
import { loadMeta, saveMeta } from './core/save.js';
import { pathTo, idx, ORE, isStairs } from './core/dungeon.js';
import { cheb } from './core/util.js';
import { T } from './data/terrain.js';
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

const hud = new Hud({
  onUseItem: id => {
    if (id === 'bomb') { setAim(!aiming); return; }
    if (canAct()) { clearPath(); setAim(false); run.useItem(id); }
  },
});

const canAct = () => run && !run.over && !modalOpen() && run.canAct();
const clearPath = () => { path = []; if (scene) scene.path = path; };

// Throwing a bomb: press the bomb (or 2), then pick a tile on the map.
function setAim(on) {
  aiming = !!(on && canAct() && run.p.items.bomb > 0);
  if (scene) scene.aim = aiming;
  hud.aiming = aiming;
  if (run) hud.update(run);
  showTip(scene?.hover);
}

function showTip(h) {
  const tip = $('tip');
  let text = '';
  if (run && aiming) {
    text = '폭탄을 던질 곳을 고른다 · 취소: Esc 또는 폭탄 버튼';
    if (h && run.canThrowAt(h.x, h.y) && cheb(h, run.p) <= 1) text += '\n바로 옆이라 나도 맞는다!';
  } else if (run && h) text = describeTile(run, h.x, h.y);
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
  // the stage was hidden while the hub was open, so measure it again before drawing
  game.scale.getParentBounds();
  game.scale.refresh();
  run = new Run(meta, meta.sel);
  hud.reset();
  run.on(onRunEvent);
  scene.attach(run);
  run.start();
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
  const seen = run.enemies.filter(e => run.isVisible(e.x, e.y)).length;
  if (path.length && (seen > seenCount || run.p.sleep)) clearPath();
  seenCount = seen;
  if (aiming && !canAct()) setAim(false);
  hud.update(run);
  showTip(scene?.hover);
  nextChoice();
}

function nextChoice() {
  if (!run || run.over || modalOpen() || !run.queue.length) return;
  clearPath();
  setAim(false);
  const q = run.queue[0];
  const title = q.kind === 'level' ? `레벨 ${run.p.lvl}!` : '보물 상자';
  const sub = q.kind === 'level' ? '최대 체력 +3. 유물을 하나 고르자.' : '안에 든 유물 중 하나를 가져가자.';
  const open = () => showChoice({
    title, sub, run, opts: run.offers(),
    onPick: o => { run.choose(o); hud.update(run); nextChoice(); },
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
  if (KEYS[k]) { ev.preventDefault(); clearPath(); setAim(false); if (canAct()) run.step(...KEYS[k]); return; }
  if (k === ' ' || k === '.') { ev.preventDefault(); clearPath(); setAim(false); if (canAct()) run.wait(); return; }
  if (k === '2') { setAim(!aiming); return; }
  if (k === 'm') { toggleSound(); return; }
  const item = { 1: 'potion', 3: 'map' }[k];
  if (item && canAct()) { clearPath(); setAim(false); run.useItem(item); }
});

// Click-walking steps around things you would rather not step on by accident.
const AVOID = new Set([T.MUSH_SLEEP]);

function onTileClick(x, y) {
  if (!canAct()) return;
  const p = run.p;
  if (aiming) {
    if (run.canThrowAt(x, y)) { clearPath(); run.throwBomb(x, y); setAim(false); }
    else if (x === p.x && y === p.y) setAim(false);
    return;
  }
  const e = run.enemyAt(x, y);
  if (e && run.isVisible(x, y) && run.touching(e, p)) { clearPath(); run.step(x - p.x, y - p.y); return; }
  if (x === p.x && y === p.y) { clearPath(); run.wait(); return; }
  const m = run.map;
  // the big ore: swing at it when next to it, otherwise walk up to it
  if (m.tiles[idx(x, y)] === ORE && m.explored[idx(x, y)]) {
    clearPath();
    if (cheb({ x, y }, p) === 1) { run.step(x - p.x, y - p.y); return; }
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => walkTo(x + dx, y + dy)).filter(q => q.length);
    if (near.length) { path = near.sort((a, b) => a.length - b.length)[0]; scene.path = path; }
    return;
  }
  if (!run.passable(x, y) || !m.explored[idx(x, y)]) return;
  path = walkTo(x, y);
  scene.path = path;
}

function walkTo(x, y) {
  const m = run.map, p = run.p;
  if (!run.passable(x, y) || !m.explored[idx(x, y)]) return [];
  return pathTo(m, p.x, p.y, x, y,
    (tx, ty) => AVOID.has(m.ter[idx(tx, ty)]) || m.fire[idx(tx, ty)] > 0,
    // never change floors by walking over stairs on the way somewhere else
    (tx, ty) => isStairs(m.tiles[idx(tx, ty)]));
}

// auto-walk one step at a time so enemies get their turns in between
setInterval(() => {
  if (!path.length || !canAct()) return;
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
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => sfx.unlockAudio(), { once: true });

$('waitBtn').addEventListener('click', () => { if (canAct()) { clearPath(); setAim(false); run.wait(); } });
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
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'phaser',
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#07060a',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: new DungeonScene(s => {
    scene = s;
    scene.onTileClick = onTileClick;
    scene.onHover = (x, y) => showTip(x === null ? null : { x, y });
    showHub();
  }),
});

// test hook for automated play-testing; harmless in normal play
window.__game = { get run() { return run; }, get meta() { return meta; }, get scene() { return scene; }, startRun, setAim };
