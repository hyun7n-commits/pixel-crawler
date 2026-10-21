// Entry point: connects the saved progress, the hub, the run rules, the Phaser scene and the HUD.

/* global Phaser */
import { DungeonScene } from './scenes/DungeonScene.js';
import { Run } from './core/run.js';
import { loadMeta, saveMeta } from './core/save.js';
import { pathTo, idx } from './core/dungeon.js';
import { cheb } from './core/util.js';
import { Hud } from './ui/hud.js';
import { renderHub } from './ui/hub.js';
import { showChoice, showSummary, modalOpen } from './ui/modal.js';
import { $ } from './ui/dom.js';

let meta = loadMeta();
let run = null;
let scene = null;
let path = [];
let seenCount = 0;

const hud = new Hud({ onUseItem: id => { if (canAct()) { clearPath(); run.useItem(id); } } });

const canAct = () => run && !run.over && !modalOpen() && run.canAct();
const clearPath = () => { path = []; if (scene) scene.path = path; };

// ---------- screens ----------
function showHub() {
  $('hub').hidden = false;
  $('game').hidden = true;
  game.loop.sleep();
  renderHub({ meta, onStart: startRun, setMeta: m => { meta = m; showHub(); } });
}

function startRun() {
  $('hub').hidden = true;
  $('game').hidden = false;
  game.loop.wake();
  game.scale.refresh();
  run = new Run(meta, meta.sel);
  hud.reset();
  run.on(onRunEvent);
  scene.attach(run);
  run.start();
  hud.update(run);
}

function onRunEvent(type, d) {
  if (type === 'log') hud.log(d.text, d.cls);
  if (type === 'banner') hud.banner(d.text);
  if (type === 'floor') { clearPath(); seenCount = 0; }
  if (type === 'phit') clearPath();
  if (type === 'turn') afterTurn();
  if (type === 'end') {
    clearPath();
    saveMeta(meta);
    hud.update(run);
    showSummary({ won: d.won, run, newlyUnlockable: d.newlyUnlockable, onClose: () => { scene.detach(); run = null; showHub(); } });
  }
}

function afterTurn() {
  // stop walking when a new enemy comes into view
  const seen = run.enemies.filter(e => run.isVisible(e.x, e.y)).length;
  if (path.length && seen > seenCount) clearPath();
  seenCount = seen;
  hud.update(run);
  nextChoice();
}

function nextChoice() {
  if (!run || run.over || modalOpen() || !run.queue.length) return;
  clearPath();
  const q = run.queue[0];
  const title = q.kind === 'level' ? `레벨 ${run.p.lvl}!` : '보물 상자';
  const sub = q.kind === 'level' ? '최대 체력 +3. 유물을 하나 고르세요.' : '안에 든 유물 중 하나를 가져가세요.';
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
  if (KEYS[k]) { ev.preventDefault(); clearPath(); if (canAct()) run.step(...KEYS[k]); return; }
  if (k === ' ' || k === '.') { ev.preventDefault(); clearPath(); if (canAct()) run.wait(); return; }
  const item = { 1: 'potion', 2: 'bomb', 3: 'map' }[k];
  if (item && canAct()) { clearPath(); run.useItem(item); }
});

function onTileClick(x, y) {
  if (!canAct()) return;
  const p = run.p, e = run.enemyAt(x, y);
  if (e && run.isVisible(x, y)) {
    if (cheb(e, p) === 1) { clearPath(); run.step(x - p.x, y - p.y); return; }
    hud.log(`${e.d.name} · 체력 ${e.hp}/${e.maxHp} · 공격 ${e.atk}${e.d.tip ? ' · ' + e.d.tip : ''}`);
  }
  if (x === p.x && y === p.y) { clearPath(); run.wait(); return; }
  if (!run.passable(x, y) || !run.map.explored[idx(x, y)]) return;
  path = pathTo(run.map, p.x, p.y, x, y);
  scene.path = path;
}

// auto-walk one step at a time so enemies get their turns in between
setInterval(() => {
  if (!path.length || !canAct()) return;
  const [nx, ny] = path.shift();
  if (run.enemyAt(nx, ny) || !run.step(nx - run.p.x, ny - run.p.y)) clearPath();
}, 120);

$('waitBtn').addEventListener('click', () => { if (canAct()) { clearPath(); run.wait(); } });
let quitArmed = 0;
$('quitBtn').addEventListener('click', () => {
  if (!canAct()) return;
  const b = $('quitBtn');
  if (Date.now() - quitArmed < 3000) { b.textContent = '포기하기'; run.finish(false); return; }
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
    showHub();
  }),
});

// test hook for automated play-testing; harmless in normal play
window.__game = { get run() { return run; }, get meta() { return meta; }, startRun };
