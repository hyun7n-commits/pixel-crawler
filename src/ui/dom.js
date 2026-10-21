import { spriteForDom } from '../scenes/textures.js';

export const $ = id => document.getElementById(id);

export const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export const button = (cls, html, onClick) => {
  const b = el('button', cls, html);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
};

// A pixel sprite as a crisp DOM canvas, sized with CSS.
export function icon(name, size) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8; c.className = 'pix';
  c.getContext('2d').drawImage(spriteForDom(name), 0, 0);
  if (size) { c.style.width = `${size}px`; c.style.height = `${size}px`; }
  return c;
}
