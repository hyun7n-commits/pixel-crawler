// The bar over the inside of your house (scenes/HomeScene.js): the room's name, how cosy it is (♥)
// and what that does for the trips, the purse; at the bottom 꾸미기 and the way out. While arranging,
// the tray: what is put away, to take out and put somewhere, or a place to put away the piece in hand.

import { $, el, button, icon } from './dom.js';
import { roomOf, homePerks, owned, placed, furniture, plantStage, COMFORT_STEP, COMFORT_MAX } from '../data/home.js';
import { ENEMIES } from '../data/enemies.js';
import { furnitureCanvas } from '../scenes/home-interior-art.js';

// what the ♥ does, in a line or two (pressing the ♥ shows it)
export function heartLine(meta) {
  const { heart, hp, lunch } = homePerks(meta);
  const next = hp < COMFORT_MAX ? `♥${(hp + 1) * COMFORT_STEP}이 되면 +${hp + 1}.` : '더는 안 오른다.';
  return `아늑함 ♥${heart}: 탐험을 나갈 때 최대 체력 +${hp}. ${next}${lunch ? '\n난로가 꿀물 도시락(체력 물약 1개)을 싸 준다.' : ''}`;
}

export function renderHomeHud(meta, { editing = false, held = null, onPick, onAway } = {}) {
  const { heart, hp } = homePerks(meta);
  $('hPlace').innerHTML = `내 집<small>${roomOf(meta).name}</small>`;
  $('hHeart').innerHTML = `♥ ${heart}<small>체력 +${hp}</small>`;
  const purse = $('hPurse');
  purse.innerHTML = '';
  purse.append(icon('gold', 16), el('span', null, `${meta.gold}G`));
  const edit = $('hEdit');
  edit.textContent = editing ? '다 꾸몄다' : '꾸미기';
  edit.classList.toggle('on', editing);
  $('hOut').hidden = editing;
  const tray = $('hTray');
  tray.hidden = !editing;
  tray.innerHTML = '';
  if (!editing) return;
  if (held) {
    tray.append(button('tray-item away', '넣어 두기', onAway), el('p', 'tray-note', `${furniture(held.id).name}: 방의 빈 곳을 누르면 그 자리에 놓는다.`));
    return;
  }
  const at = placed(meta), away = owned(meta).filter(id => !at[id]);
  for (const id of away) {
    const f = furniture(id), b = button('tray-item', null, () => onPick?.(id));
    b.append(picture(meta, id, f), el('span', null, f.name), el('b', null, `♥${f.heart}`));
    tray.append(b);
  }
  tray.append(el('p', 'tray-note', away.length ? '눌러서 꺼낸 다음 방의 빈 곳을 누르면 놓는다. 방의 가구를 누르면 들어서 옮긴다.'
    : '방의 가구를 누르면 들어서 옮긴다. 새 가구는 비버 목수에게 주문한다.'));
}

// a piece's picture, fitted into the tray's 44 x 40 box
function picture(meta, id, f) {
  const c = f.plush ? icon(ENEMIES[f.plush].sprite) : furnitureCanvas(id, id === 'plant' ? plantStage(meta) : id === 'lamp' ? 1 : 0);
  const k = Math.min(2, 44 / c.width, 40 / c.height);
  c.className = 'pix';
  c.style.width = `${Math.round(c.width * k)}px`;
  c.style.height = `${Math.round(c.height * k)}px`;
  return c;
}
