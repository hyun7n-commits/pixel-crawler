import { HIRES } from './textures.js';

// The canvas is drawn at the screen's real pixel density (main.js), so zoom is counted in device
// pixels per art pixel and always stays a whole number to keep the pixel art crisp.
// Close up, like Shattered Pixel Dungeon: on a phone about seven tiles across, so faces and little
// moves read at a glance; a big screen shows about thirteen. 0 = not laid out yet. Pinch or the
// mouse wheel zooms from there (DungeonScene.zoomBy).
// With 32px characters (drawn at half scale) a low zoom is kept even, so their pixels stay square too.
export function baseZoom(scene, tilePx = 16) {
  const r = scene.game.registry.get('dpr') || 1, w = scene.scale.gameSize.width / r, h = scene.scale.gameSize.height / r;
  if (w < 16 || h < 16) return 0;
  let tile = Math.min(w / 13, h / 9.5);
  if (scene.game.registry.get('touch')) tile = Math.max(tile, Math.min(w, h) / 7);
  const z = Math.max(1, Math.floor(Math.max(tile, 32) * r / tilePx));
  return HIRES && z % 2 && z < 6 ? z + 1 : z;
}
