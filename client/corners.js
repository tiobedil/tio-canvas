// Coordinate visible floating buttons in the current page and its fullscreen host.
const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export function claimCorner(element, desired) {
  let docs = [document];
  try {
    const frame = window.frameElement;
    if (frame?.closest('.screen[data-fullscreen]')) docs.push(window.parent.document);
    else if (!frame && document.body.hasAttribute('data-fullscreen')) {
      const child = document.querySelector('.screen[data-fullscreen] iframe')?.contentDocument;
      if (child) docs.push(child);
    }
  } catch { /* A cross-origin frame cannot share the canvas controls. */ }
  const occupied = new Set();
  for (const doc of docs) for (const other of doc.querySelectorAll('[data-floating-corner]')) {
    if (other !== element && !other.hidden) occupied.add(other.dataset.floatingCorner);
  }
  const [vertical, horizontal] = desired.split('-');
  const order = [desired, `${vertical === 'top' ? 'bottom' : 'top'}-${horizontal}`, `${vertical}-${horizontal === 'left' ? 'right' : 'left'}`, ...corners];
  const chosen = order.find(corner => !occupied.has(corner)) ?? desired;
  element.dataset.floatingCorner = chosen;
  return chosen;
}
