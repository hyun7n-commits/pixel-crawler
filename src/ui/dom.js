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
  const src = spriteForDom(name);
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height; c.className = 'pix';
  c.getContext('2d').drawImage(src, 0, 0);
  if (size) { c.style.width = `${size}px`; c.style.height = `${size}px`; }
  return c;
}
