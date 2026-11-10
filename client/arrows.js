import { SIDES, boundPoint, resolvePoint, snapArrow, arrowGeometry, readArrows } from './arrow-geometry.js';
import { arrowBounds, arrowIntersects, resizeArrows } from './arrow-selection.js';
import { closeSelectMenus } from './ui/index.js';

const NS = 'http://www.w3.org/2000/svg';
const svgElement = (tag, attributes = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};
export function createArrows({ viewport, world, camera, objects, saved, checkpoint, commit, clearScreens, screenSelectionCount, rank, schedule, stopCanvas }) {
  let arrows = readArrows(saved), tool = 'cursor', drag = null, hover = null;
  const chosen = new Set();
  const layer = document.createElement('div');layer.id = 'arrow-layer';world.append(layer);
  const dots = document.createElement('div');dots.id = 'arrow-snaps';
  const nodes = document.createElement('div');nodes.id = 'arrow-nodes';viewport.append(dots, nodes);
  const toolbar = document.querySelector('#arrow-inspector');
  const fields = { update() { for (const field of toolbar.querySelectorAll('.ui-select-field')) field.sync(); }, close: closeSelectMenus };
  const cursorButton = document.querySelector('#tool-cursor'), arrowButton = document.querySelector('#tool-arrow'), textButton = document.querySelector('#tool-text');
  const pointAt = event => ({ x: (event.clientX - camera.x) / camera.scale, y: (event.clientY - camera.y) / camera.scale });
  const screenPoint = point => ({ x: camera.x + point.x * camera.scale, y: camera.y + point.y * camera.scale });
  const selected = () => arrows.filter(a => chosen.has(a.id));
  function choose(arrow, toggle = false) {
    if (!toggle) { chosen.clear();if (arrow) clearScreens(); }
    if (arrow) { if (toggle && chosen.has(arrow.id)) chosen.delete(arrow.id);else chosen.add(arrow.id); }
    schedule();
  }
  function setTool(value) {
    cancel();stopCanvas();fields.close();tool = value;
    document.body.dataset.canvasTool = tool;
    cursorButton.setAttribute('aria-pressed', String(tool === 'cursor'));arrowButton.setAttribute('aria-pressed', String(tool === 'arrow'));textButton.setAttribute('aria-pressed', String(tool === 'text'));
    if (tool === 'arrow' || tool === 'text') { clearScreens();chosen.clear(); }
    document.dispatchEvent(new CustomEvent('tio-canvas:tool', { detail: tool }));
    schedule();
  }
  cursorButton.onclick = () => setTool('cursor');arrowButton.onclick = () => setTool('arrow');
  function begin(event, arrow, part, before = checkpoint()) {
    if (drag || event.button !== 0) return;
    stopCanvas();fields.close();event.preventDefault();event.stopPropagation();viewport.focus({ preventScroll: true });
    if (arrow && !chosen.has(arrow.id)) choose(arrow);
    drag = { id: event.pointerId, arrow, part, before, origin: pointAt(event), originals: structuredClone(selected()), created: part === 'create', box: arrowBounds(selected(), objects()) };
    document.body.dataset.arrowDrag = '';viewport.setPointerCapture(event.pointerId);schedule();
  }
  viewport.addEventListener('pointerdown', event => {
    if (document.body.hasAttribute('data-fullscreen') || document.body.hasAttribute('data-space') || event.button !== 0 || event.target.closest('#arrow-inspector')) return;
    const corner = event.target.closest('[data-arrow-corner]');
    if (corner) { begin(event, null, corner.dataset.arrowCorner);return; }
    const handle = event.target.closest('[data-arrow-node]');
    if (handle && selected().length === 1) { begin(event, selected()[0], handle.dataset.arrowNode);return; }
    const hit = event.target.closest('[data-arrow-id]');
    if (tool === 'cursor' && hit) {
      const arrow = arrows.find(a => a.id === hit.dataset.arrowId);
      if (event.shiftKey) { event.preventDefault();event.stopPropagation();choose(arrow, true);return; }
      if (arrow) begin(event, arrow, 'move');return;
    }
    if (tool !== 'arrow') return;
    if (arrows.length >= 1000) { event.preventDefault();event.stopPropagation();document.querySelector('#canvas-status').textContent = 'The canvas supports up to 1,000 arrows.';return; }
    const before = checkpoint(), start = snapArrow(pointAt(event), objects(), camera.scale);
    const arrow = { id: crypto.randomUUID(), start, end: structuredClone(start), bend: 0, startStyle: 'line', endStyle: 'arrow', width: 4, pattern: 'solid' };
    arrows.push(arrow);choose(arrow);begin(event, arrow, 'create', before);
  }, true);
  function move(event) {
    if (!drag) { if (tool === 'arrow') { hover = pointAt(event);schedule(); }return; }
    if (event.pointerId !== drag.id) return;
    const { arrow, part, originals, origin } = drag, point = pointAt(event);
    if (!drag.moved && part !== 'create' && Math.hypot(point.x - origin.x, point.y - origin.y) * camera.scale < 3) return;
    drag.moved = true;
    if (['nw', 'ne', 'sw', 'se'].includes(part)) {
      const next = resizeArrows(originals, drag.box, part, point, origin);
      if (next) for (const model of next) Object.assign(arrows.find(a => a.id === model.id), model);
    } else if (part === 'middle') {
      const geometry = arrowGeometry(arrow, objects());
      arrow.bend = (point.x - geometry.midpoint.x) * geometry.normal.x + (point.y - geometry.midpoint.y) * geometry.normal.y;
      if (Math.abs(arrow.bend) * camera.scale < 3) arrow.bend = 0;
    } else if (part === 'move') {
      // A bound multi-selection is config-only; moving it would break its bindings.
      if (originals.length > 1 && originals.some(a => a.start.binding || a.end.binding)) return;
      for (const original of originals) for (const name of ['start', 'end']) {
        const base = resolvePoint(original[name], objects()), target = arrows.find(a => a.id === original.id);
        const nextPoint = { x: base.x + point.x - origin.x, y: base.y + point.y - origin.y };
        target[name] = originals.length > 1 ? nextPoint : snapArrow(nextPoint, objects(), camera.scale);
      }
    } else arrow[part === 'create' ? 'end' : part] = snapArrow(point, objects(), camera.scale);
    hover = point;schedule();
  }
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    move(event);const previous = drag;drag = null;
    if (viewport.hasPointerCapture(previous.id)) viewport.releasePointerCapture(previous.id);
    delete document.body.dataset.arrowDrag;
    if (previous.created && arrowGeometry(previous.arrow, objects()).length * camera.scale < 4) { arrows.splice(arrows.indexOf(previous.arrow), 1);chosen.clear(); }
    else if (previous.created) setTool('cursor');
    commit(previous.before);schedule();
  }
  function cancel() {
    if (!drag) return false;
    const previous = drag;drag = null;
    if (viewport.hasPointerCapture(previous.id)) viewport.releasePointerCapture(previous.id);
    if (previous.created) { arrows.splice(arrows.indexOf(previous.arrow), 1);chosen.clear(); }
    else for (const original of previous.originals) Object.assign(arrows.find(a => a.id === original.id), original);
    delete document.body.dataset.arrowDrag;schedule();return true;
  }
  window.addEventListener('pointermove', move);window.addEventListener('pointerup', finish);window.addEventListener('pointercancel', cancel);window.addEventListener('blur', cancel);
  window.addEventListener('keydown', event => {
    if (document.body.hasAttribute('data-fullscreen') || document.querySelector('dialog[open]') || event.target.closest?.('input,textarea,select,[contenteditable],.icon-options')) return;
    if (event.key === 'Escape') { cancel();choose(null);setTool('cursor'); }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === 'v') setTool('cursor');if (event.key.toLowerCase() === 'a') setTool('arrow');
    if (chosen.size && ['Delete', 'Backspace'].includes(event.key) && !event.defaultPrevented) { event.preventDefault();const before = checkpoint();removeSelected();commit(before); }
  });
  function removeSelected() { arrows = arrows.filter(a => !chosen.has(a.id));choose(null); }
  toolbar.addEventListener('submit', event => event.preventDefault());
  toolbar.addEventListener('change', event => {
    if (!chosen.size) return;
    const field = event.target.dataset.arrowField;if (!field) return;
    const value = field === 'width' ? Number(event.target.value) : event.target.value;
    if ((field === 'width' && ![2, 4, 6, 8, 10].includes(value)) || (['startStyle', 'endStyle'].includes(field) && !['line', 'arrow'].includes(value)) || (field === 'pattern' && !['solid', 'dashed'].includes(value))) return;
    const before = checkpoint();for (const arrow of selected()) arrow[field] = value;commit(before);schedule();
  });
  document.querySelector('#arrow-straight').onclick = () => { if (!chosen.size) return;const before = checkpoint();for (const arrow of selected()) arrow.bend = 0;commit(before);schedule(); };
  function render() {
    const all = objects(), targets = selected();
    for (const arrow of arrows) for (const name of ['start', 'end']) {
      const point = arrow[name];if (!point.binding) continue;
      const resolved = boundPoint(point.binding, all);if (resolved) Object.assign(point, resolved);else delete point.binding;
    }
    const focusedId = document.activeElement?.dataset?.arrowId, focusedNode = document.activeElement?.dataset?.arrowNode;
    const contents = [];
    for (const arrow of arrows) {
      const geometry = arrowGeometry(arrow, all), active = chosen.has(arrow.id);
      const svg = svgElement('svg', { class: 'arrow-object', 'data-object-id': arrow.id, width: 20000, height: 11250 });svg.style.zIndex = rank(arrow.id);
      const defs = svgElement('defs'), length = 6 + arrow.width * 2, headSize = length + arrow.width * 2;
      for (const end of ['start', 'end']) {
        const marker = svgElement('marker', { id: `arrow-${arrow.id}-${end}`, viewBox: `${-length - arrow.width} ${-headSize / 2} ${headSize} ${headSize}`, markerWidth: headSize, markerHeight: headSize, refX: 0, refY: 0, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse', overflow: 'visible' });
        marker.append(svgElement('path', { d: `M ${-length} ${-length / 2} L 0 0 L ${-length} ${length / 2}`, fill: 'none', stroke: 'context-stroke', 'stroke-width': arrow.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));defs.append(marker);
      }
      const path = svgElement('path', { d: geometry.path, class: 'arrow-line', 'stroke-width': arrow.width });
      if (arrow.pattern !== 'solid') path.setAttribute('stroke-dasharray', `${arrow.width * 2} ${arrow.width * 3}`);
      for (const end of ['start', 'end']) if (arrow[`${end}Style`] === 'arrow') path.setAttribute(`marker-${end}`, `url(#arrow-${arrow.id}-${end})`);
      svg.append(defs, path);
      if (active) {
        const highlight = svgElement('path', { d: geometry.path, class: 'arrow-highlight', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' });
        if (arrow.pattern !== 'solid') highlight.setAttribute('stroke-dasharray', `${arrow.width * 2 * camera.scale} ${arrow.width * 3 * camera.scale}`);
        svg.append(highlight);
      }
      const hit = svgElement('path', { d: geometry.path, class: 'arrow-hit', 'data-arrow-id': arrow.id, 'stroke-width': Math.max(16 / camera.scale, arrow.width + 8), tabindex: 0, role: 'button', 'aria-label': 'Select arrow', 'aria-pressed': String(active) });
      hit.addEventListener('focus', () => { if (!chosen.has(arrow.id)) choose(arrow); });
      hit.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault();choose(arrow, event.shiftKey); } });
      svg.append(hit);contents.push(svg);
    }
    layer.replaceChildren(...contents);
    if (focusedId) [...layer.querySelectorAll('[data-arrow-id]')].find(node => node.dataset.arrowId === focusedId)?.focus({ preventScroll: true });
    dots.replaceChildren();
    if (tool === 'arrow' || (drag && ['start', 'end', 'create'].includes(drag.part))) for (const object of all) {
      const near = !hover || (hover.x >= object.x - 60 / camera.scale && hover.x <= object.x + object.width + 60 / camera.scale && hover.y >= object.y - 60 / camera.scale && hover.y <= object.y + object.height + 60 / camera.scale);
      if (!near) continue;
      for (const side of SIDES) {
        const binding = { objectId: object.id, side, t: .5 }, p = screenPoint(boundPoint(binding, all));
        const dot = document.createElement('span');dot.className = 'arrow-snap';dot.dataset.side = side;
        if (drag && ['start', 'end', 'create'].includes(drag.part)) { const active = drag.arrow[drag.part === 'create' ? 'end' : drag.part].binding;dot.toggleAttribute('data-active', active?.objectId === object.id && active.side === side && active.t === .5); }
        dot.style.left = `${p.x}px`;dot.style.top = `${p.y}px`;dots.append(dot);
      }
    }
    nodes.replaceChildren();toolbar.hidden = !targets.length || !!drag;
    if (toolbar.hidden) fields.close();
    if (!targets.length) return;
    if (targets.length === 1 && !screenSelectionCount()) {
      const arrow = targets[0], geometry = arrowGeometry(arrow, all);
      for (const name of ['start', 'middle', 'end']) {
        const p = screenPoint(geometry[name]), button = document.createElement('button');button.type = 'button';button.className = 'smart-handle arrow-node';button.dataset.arrowNode = name;
        button.setAttribute('aria-label', name === 'middle' ? 'Bend arrow symmetrically' : `Move arrow ${name}`);button.style.left = `${p.x}px`;button.style.top = `${p.y}px`;
        nodes.append(button);
      }
    } else if (targets.length > 1 && !screenSelectionCount()) {
      const box = arrowBounds(targets, all), p = screenPoint(box), frame = document.createElement('div');frame.className = 'arrow-group-box';
      Object.assign(frame.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${box.width * camera.scale}px`, height: `${box.height * camera.scale}px` });nodes.append(frame);
      const locked = targets.some(a => a.start.binding || a.end.binding);frame.dataset.locked = String(locked);
      if (!locked) for (const [corner, x, y] of [['nw', 0, 0], ['ne', 100, 0], ['se', 100, 100], ['sw', 0, 100]]) {
        const button = document.createElement('button');button.type = 'button';button.className = 'handle';button.dataset.arrowCorner = corner;button.setAttribute('aria-label', `Resize arrows ${corner}`);
        button.style.cssText = `left:${x}%;top:${y}%;cursor:${corner}-resize`;frame.append(button);
      }
    }
    if (focusedNode && !drag) nodes.querySelector(`[data-arrow-node="${focusedNode}"]`)?.focus({ preventScroll: true });
    for (const field of toolbar.querySelectorAll('[data-arrow-field]')) {
      const values = targets.map(a => a[field.dataset.arrowField]), same = values.every(value => value === values[0]);
      if (document.activeElement !== field) field.value = same ? String(values[0]) : '';
    }
    fields.update();
    for (const element of toolbar.querySelectorAll('[data-curved-only]')) element.hidden = targets.every(a => Math.abs(a.bend) < .01);
    const main = document.querySelector('#edit-tools').getBoundingClientRect(), inset = parseFloat(getComputedStyle(toolbar).getPropertyValue('--canvas-panel-inset'));
    const center = Math.max(inset + toolbar.offsetWidth / 2, Math.min(innerWidth - inset - toolbar.offsetWidth / 2, main.left + main.width / 2));
    toolbar.style.left = `${center}px`;toolbar.style.bottom = `${innerHeight - main.top + inset}px`;
  }
  return {
    render,
    capture: () => structuredClone(arrows),
    restore(value, ids) { cancel();arrows = readArrows(value);chosen.clear();for (const id of Array.isArray(ids) ? ids : [ids]) if (arrows.some(a => a.id === id)) chosen.add(id);schedule(); },
    get ids() { return arrows.map(a => a.id); },
    get selectedIds() { return [...chosen]; },
    clearSelection() { choose(null); },
    selectRect(box, initial = []) { chosen.clear();for (const id of initial) if (arrows.some(a => a.id === id)) chosen.add(id);if (box) for (const arrow of arrows) if (arrowIntersects(arrow, box, objects())) chosen.add(arrow.id);schedule(); },
    removeSelected,
    cancel,
    setTool,
  };
}
