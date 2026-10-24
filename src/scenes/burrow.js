// Down a burrow (v0.28), for the fields and the village alike: one hop up off the ground and over the
// mouth, then straight down the hole, feet first. The mouth's front rim is a line across the hole, and
// whatever of you is below it is down the hole, so it is cut away: you go in behind the rim, never over
// the hole, narrowing a little to fit it.
//   x: the middle of the hole; rim: the y of its front rim; k: the sprite's own scale
//   onRim(): your feet are in; done(): you are all the way down
export function diveInto(scene, s, { x, rim, k, ms = 340, onRim, done }) {
  const H = s.frame.height, W = s.frame.width, x0 = s.x, y0 = s.y;
  const peak = Math.min(y0, rim) - 6, end = rim + H * k * 1.2 + 1, up = 0.28;
  let inHole = false;
  s.setCrop().setOrigin(0.5, 1).setRotation(0).setScale(k);
  return scene.tweens.addCounter({
    from: 0, to: 1, duration: ms, ease: 'Linear',
    onUpdate: tw => {
      const f = tw.getValue();
      // up, easing off at the top, while drifting over the mouth (in front of the hole, if that is where
      // you came from); then down into it, faster and faster
      if (f < up) {
        const u = f / up;
        s.setPosition(Math.round(x0 + (x - x0) * u), Math.round(y0 + (peak - y0) * Math.sin(u * Math.PI / 2)));
        return;
      }
      const u = (f - up) / (1 - up), py = peak + (end - peak) * u ** 1.7;
      const deep = Math.max(0, py - rim), squeeze = Math.min(1, deep / (H * k * 0.4)), sy = k * (1 + 0.2 * squeeze);
      s.setScale(k * (1 - 0.3 * squeeze), sy).setPosition(x, Math.round(py));
      const rows = Math.min(H, Math.floor((rim - (s.y - H * sy)) / sy));
      if (rows <= 0) s.setVisible(false);
      else s.setCrop(0, 0, W, rows);
      if (deep > 0 && !inHole) { inHole = true; onRim?.(); }
    },
    onComplete: () => { s.setVisible(false); done?.(); },
  });
}
