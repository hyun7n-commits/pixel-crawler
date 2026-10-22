// The picture-book player: shows a story from scenes/storyboards.js on the StoryScene, one line at
// a time in a text box at the bottom. A tap (or Space, Enter, →) shows the rest of a line that is
// still typing, or moves on; 건너뛰기 (or Esc) ends it. `onDone` runs once, however it ends.

import { $, el, button } from './dom.js';
import { STORIES } from '../scenes/storyboards.js';

const TYPE_MS = 28;

export function playStory(game, id, onDone) {
  const panels = STORIES[id];
  const stage = $('stage');
  if (!panels || $('story')) { onDone?.(); return; }
  const box = el('div', 'st-box'), who = el('b', 'st-who'), text = el('p', 'st-text'), next = el('span', 'st-next', '▼');
  box.append(who, text, next);
  const dots = el('div', 'st-dots');
  const lines = panels.flatMap((p, pi) => p.lines.map((l, li) => ({ ...l, pi, li })));
  for (let i = 0; i < panels.length; i++) dots.append(el('i'));
  const root = el('div', '', '');
  root.id = 'story';
  const skip = button('st-skip', '건너뛰기 ›', e => { e.stopPropagation(); end(); });
  root.append(dots, skip, box);
  stage.append(root);
  $('game').classList.add('story');

  // the scene: put the others to sleep and run the story stage
  for (const k of ['dungeon', 'village']) if (game.scene.isActive(k)) game.scene.sleep(k);
  game.registry.set('storyBox', Math.min(0.45, (box.offsetHeight + 28) / Math.max(1, stage.clientHeight)));
  let k = null, ctx = null, at = -1, typing = 0, full = '', done = false, shownPanel = -1;
  const ready = () => {
    k = game.scene.getScene('story');
    k.fit();
    show(0);
  };
  if (game.scene.isActive('story')) ready();
  else { game.scene.getScene('story').events.once('create', ready); game.scene.run('story'); }

  function show(i) {
    at = i;
    const l = lines[i];
    const run = () => {
      [...dots.children].forEach((d, j) => d.classList.toggle('on', j <= l.pi));
      who.textContent = l.who || '';
      who.hidden = !l.who;
      type(l.text);
      l.at?.(k, ctx);
    };
    if (l.pi !== shownPanel) {
      const first = shownPanel < 0;
      shownPanel = l.pi;
      const build = () => { k.clear(); ctx = panels[l.pi].build(k) || {}; k.fit(); run(); if (!first) k.cameras.main.fadeIn(220, 0, 0, 0); };
      if (first) build();
      else { k.cameras.main.fadeOut(160, 0, 0, 0); k.cameras.main.once('camerafadeoutcomplete', build); text.textContent = ''; }
    } else run();
  }

  function type(s) {
    clearInterval(typing);
    let n = 0;
    text.textContent = '';
    next.hidden = true;
    full = s;
    typing = setInterval(() => {
      n++;
      text.textContent = s.slice(0, n);
      if (n >= s.length) finishTyping();
    }, TYPE_MS);
  }
  function finishTyping() {
    if (!typing) return;
    text.textContent = full;
    clearInterval(typing);
    typing = 0;
    next.hidden = false;
  }

  function advance() {
    if (done) return;
    if (typing) { finishTyping(); return; }
    if (at + 1 < lines.length) show(at + 1);
    else end();
  }

  function end() {
    if (done) return;
    done = true;
    clearInterval(typing);
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    $('game').classList.remove('story');
    if (k) { k.clear(); game.scene.stop('story'); }
    onDone?.();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
    else if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); advance(); }
  }
  root.addEventListener('click', advance);
  document.addEventListener('keydown', onKey, true);
}
