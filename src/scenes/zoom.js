// The canvas is drawn at the screen's real pixel density (main.js), so zoom is counted in device
// pixels per art pixel and always stays a whole number to keep the pixel art crisp.
// Whole rooms fit on a big screen; on a phone a tile is at least a fingertip wide. 0 = not laid out yet.
export function baseZoom(scene, tilePx = 16) {
  const r = scene.game.registry.get('dpr') || 1, w = scene.scale.gameSize.width / r, h = scene.scale.gameSize.height / r;
  if (w < 16 || h < 16) return 0;
  let tile = Math.min(w / 15, h / 11);
  if (scene.game.registry.get('touch')) tile = Math.max(tile, Math.min(w, h) / 10);
  return Math.max(1, Math.floor(Math.max(tile, 32) * r / tilePx));
}
