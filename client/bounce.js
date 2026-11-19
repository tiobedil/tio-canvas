// The one bounce every springy motion on the canvas shares: an arrow springing
// straight, a panel springing back from a pull past its size limit. Change it
// here and every bounce follows. Tuned in dev/prototypes/arrow-straighten.jsx.
export const BOUNCE = { visualDuration: .2, bounce: .45 };

// Spring constants for a visual duration (seconds) and bounce (0 none, 1 endless).
export function springConstants({ visualDuration, bounce } = BOUNCE) {
  const stiffness = (2 * Math.PI / (visualDuration * 1.2)) ** 2;
  return { stiffness, damping: 2 * (1 - bounce) * Math.sqrt(stiffness) };
}

// Springs a value from `from` to `to`, calling onUpdate each frame. Returns stop().
export function spring(from, to, onUpdate, options = BOUNCE) {
  const { stiffness, damping } = springConstants(options);
  let value = from - to, velocity = 0, time = performance.now(), frame = requestAnimationFrame(step);
  function step(now) {
    let dt = Math.min((now - time) / 1000, .064); time = now;
    while (dt > 0) { const h = Math.min(dt, 1 / 240); velocity += (-stiffness * value - damping * velocity) * h; value += velocity * h; dt -= h; }
    const done = Math.abs(value) < .05 && Math.abs(velocity) < 1;
    onUpdate(done ? to : to + value);
    if (!done) frame = requestAnimationFrame(step);
  }
  return () => cancelAnimationFrame(frame);
}
