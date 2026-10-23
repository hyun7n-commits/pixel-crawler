// A speech bubble over someone's head: a round cream box with the plum outline and a little tail,
// shared by the fields, the village and the stories. Sizes are CSS pixels; `k` turns them into world
// pixels at the camera's zoom and `res` draws the words sharp. The bubble's (0, 0) is the tail's tip,
// so it is placed like a text with origin (0.5, 1); its displayWidth is the box's.

export const FONT = 'Jua, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const PAPER = 0xfffaf0, INK = 0x4a2a3c;

export function speechBubble(scene, x, y, text, { k = 1, res = 3, depth = 0, size = 13, wrap = 190, pad = [8, 4] } = {}) {
  const t = scene.add.text(0, 0, text, {
    fontFamily: FONT, fontSize: `${size * k}px`, color: '#5b3a2e', align: 'center',
    wordWrap: { width: wrap * k, useAdvancedWrap: true },
  }).setResolution(res);
  const tail = 4 * k, line = 1.6 * k;
  const w = t.width + pad[0] * 2 * k, h = t.height + pad[1] * 2 * k, r = Math.min(9 * k, h / 2);
  t.setOrigin(0.5, 0).setPosition(0, -tail - h + pad[1] * k);
  const g = scene.add.graphics();
  g.fillStyle(INK, 1);
  g.fillRoundedRect(-w / 2 - line, -tail - h - line, w + line * 2, h + line * 2, r + line);
  g.fillTriangle(-tail * 1.2 - line, -tail - 1, tail * 1.2 + line, -tail - 1, 0, line * 0.8);
  g.fillStyle(PAPER, 1);
  g.fillRoundedRect(-w / 2, -tail - h, w, h, r);
  g.fillTriangle(-tail * 1.2, -tail - 1, tail * 1.2, -tail - 1, 0, -line * 0.6);
  const c = scene.add.container(x, y, [g, t]).setDepth(depth);
  c.setSize(w + line * 2, h + tail + line);
  return c;
}
