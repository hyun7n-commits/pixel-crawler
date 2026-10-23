// A boss steps into view: a dark band slides across the field with the boss big on it, its name and
// one line of what it has to say. It goes by itself after a moment, or at a tap.
import { $, el, icon } from './dom.js';

const SHOW_MS = 2300;

export function bossCard(e) {
  $('bossCard')?.remove();
  const card = el('div', 'bosscard');
  card.id = 'bossCard';
  const band = el('div', 'bc-band');
  // the boss as it stands in the field, crown and all
  const pic = el('div', 'bc-pic');
  const crown = icon('crown', 40);
  crown.classList.add('bc-crown');
  pic.append(icon(e.d.sprite, 96), crown);
  const text = el('div', 'bc-text');
  text.append(el('small', null, '보스 등장'), el('b', null, e.d.name));
  if (e.d.intro) text.append(el('p', null, `“${e.d.intro}”`));
  band.append(pic, text);
  card.append(band);
  let gone = false;
  const close = () => {
    if (gone) return;
    gone = true;
    card.classList.add('out');
    setTimeout(() => card.remove(), 300);
  };
  card.addEventListener('click', ev => { ev.stopPropagation(); close(); });
  $('stage').append(card);
  setTimeout(close, SHOW_MS);
}
