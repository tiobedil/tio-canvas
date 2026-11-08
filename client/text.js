import { TEXT_SIZES, TEXT_LINE_HEIGHT, sanitizeHtml, plainToHtml, readTexts, rubberBand } from './text-format.js';
import { intersects, bounds, snapRect } from './geometry.js';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const DIRECTIONS = [['nw', 0, 0], ['n', 50, 0], ['ne', 100, 0], ['e', 100, 50], ['se', 100, 100], ['s', 50, 100], ['sw', 0, 100], ['w', 0, 50]];

// Text objects live in the world like screens. The element is the text; the
// selection frame and its handles are separate, in screen space, so a pull past
// a limit can stretch the frame while the words stay exactly as they are.
export function createTexts({ viewport, world, camera, extent, saved, checkpoint, commit, clearScreens, screenSelectionCount, rank, schedule, stopCanvas, setTool, snapTargets, drawGuides, companions, duplicateCompanions, discardCompanions }) {
  let texts = readTexts(saved), tool = 'cursor', drag = null, editing = null, editBefore = null, settleTimer = 0, lastPress = null, selDrag = null;
  const chosen = new Set(), elements = new Map();
  const layer = document.createElement('div'); layer.id = 'text-layer'; world.append(layer);
  const nodes = document.createElement('div'); nodes.id = 'text-nodes'; viewport.append(nodes);
  const frame = document.createElement('div'); frame.className = 'text-frame'; frame.hidden = true; nodes.append(frame);
  const outlines = document.createElement('div'); outlines.className = 'text-outlines'; nodes.append(outlines);
  for (const [direction, x, y] of DIRECTIONS) {
    const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'handle'; handle.dataset.textHandle = direction;
    handle.setAttribute('aria-label', `Resize text ${direction}`); handle.style.cssText = `left:${x}%;top:${y}%;cursor:${direction}-resize`;
    if (direction.length === 1) handle.dataset.side = x === 50 ? 'horizontal' : 'vertical';
    frame.append(handle);
  }
  const toolbar = document.querySelector('#text-inspector');
  const sizeField = toolbar.querySelector('select[data-text-field="size"]');
  const buttons = { bold: toolbar.querySelector('#text-bold'), italic: toolbar.querySelector('#text-italic') };
  const textButton = document.querySelector('#tool-text');

  const pointAt = event => ({ x: (event.clientX - camera.x) / camera.scale, y: (event.clientY - camera.y) / camera.scale });
  const selected = () => texts.filter(t => chosen.has(t.id));
  const find = id => texts.find(t => t.id === id);
  const elementOf = text => elements.get(text.id);
  const minWidth = text => TEXT_SIZES[text.size] * 1.5;
  const minHeight = text => TEXT_SIZES[text.size] * TEXT_LINE_HEIGHT;

  function choose(text, toggle = false) {
    if (!toggle) { clearScreens(); chosen.clear(); }
    if (text) { if (toggle && chosen.has(text.id)) chosen.delete(text.id); else chosen.add(text.id); }
    schedule();
  }

  // ---- Elements -----------------------------------------------------------
  function ensure(text) {
    let el = elements.get(text.id);
    if (el) return el;
    el = document.createElement('div'); el.className = 'text-object'; el.dataset.textId = text.id; el.tabIndex = 0;
        el.addEventListener('focus', () => { const t = find(el.dataset.textId); if (t && !editing && el.matches(':focus-visible') && !chosen.has(t.id)) choose(t); });
    el.addEventListener('keydown', event => {
      const t = find(el.dataset.textId); if (!t) return;
      if (editing === t) {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); finishEdit(); el.focus({ preventScroll: true }); }
        else if (hotkey(event)) event.preventDefault();
      } else if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); event.stopPropagation(); startEdit(t); }
    });
    el.addEventListener('mousedown', event => {
      if (editing !== find(el.dataset.textId) || event.button !== 0) return;
      if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
      const c = caretAt(el, event.clientX, event.clientY); if (!c) return;
      event.preventDefault(); el.focus({ preventScroll: true });
      const sel = getSelection();
      sel.setBaseAndExtent(c.node, c.offset, c.node, c.offset);
      if (event.detail === 2) { sel.modify('move', 'backward', 'word'); sel.modify('extend', 'forward', 'word'); }
      else if (event.detail >= 3) sel.selectAllChildren(el);
      else { selDrag = { anchor: c, focus: c, outside: false }; document.body.dataset.textSelect = ''; }
    });
    el.addEventListener('input', () => { const t = find(el.dataset.textId); if (t && editing === t) { t.fit = true; t.html = el.innerHTML; el.dataset.html = t.html; schedule(); } });
    el.addEventListener('paste', event => {
      if (editing !== find(el.dataset.textId)) return;
      event.preventDefault();
      document.execCommand('insertHTML', false, plainToHtml(event.clipboardData?.getData('text/plain') ?? ''));
    });
    el.addEventListener('focusout', event => {
      const t = find(el.dataset.textId);
      if (editing !== t || toolbar.contains(event.relatedTarget)) return;
      finishEdit();
    });
    layer.append(el); elements.set(text.id, el);
    return el;
  }
  function setHtml(text, el, html) { el.innerHTML = html; el.dataset.html = html; el.setAttribute('aria-label', `Text: ${el.textContent.slice(0, 60) || 'empty'}`); }
  function paint(text) {
    const el = ensure(text), order = rank(text.id);
    const key = `${text.x}|${text.y}|${text.width}|${text.fit ? 'a' : text.height}|${text.size}|${order}`;
    if (el.dataset.key !== key) {
      Object.assign(el.style, { left: `${text.x}px`, top: `${text.y}px`, width: `${text.width}px`, height: text.fit ? 'auto' : `${text.height}px`, fontSize: `${TEXT_SIZES[text.size]}px`, zIndex: String(order) });
      el.dataset.key = key;
    }
    if (editing !== text && el.dataset.html !== text.html) setHtml(text, el, text.html);
    el.toggleAttribute('data-editing', editing === text);
    return el;
  }
  // Read a measurement with temporary inline styles, then put the styles back.
  function probe(el, css, read) {
    const kept = {}; for (const name of Object.keys(css)) { kept[name] = el.style[name]; el.style[name] = css[name]; }
    const value = read(); for (const name of Object.keys(kept)) el.style[name] = kept[name];
    return value;
  }
  const worldSize = (el, axis) => Math.ceil(el.getBoundingClientRect()[axis] / camera.scale - .01);
  const maxWidth = text => probe(paint(text), { width: 'max-content', height: 'auto' }, () => worldSize(elementOf(text), 'width'));
  const contentHeight = (text, width) => probe(paint(text), { width: `${width}px`, height: 'auto' }, () => worldSize(elementOf(text), 'height'));
  // A text is never wider or taller than the words inside it.
  function fitToContent(text) {
    const max = maxWidth(text);
    text.width = text.fitWidth ? Math.min(max, extent.width - text.x) : Math.min(text.width, max);
    if (text.width >= max) text.fitWidth = true;
    const height = contentHeight(text, text.width);
    text.fit = true; text.height = height;
  }

  // ---- Editing ------------------------------------------------------------
  function startEdit(text, before = editBefore ?? checkpoint()) {
    if (!text || editing === text) return;
    if (editing) finishEdit();
    stopCanvas(); choose(text);
    editing = text; editBefore = before;
    const el = paint(text); el.contentEditable = 'true'; el.spellcheck = false; el.setAttribute('role', 'textbox'); el.setAttribute('aria-multiline', 'true');
    el.focus({ preventScroll: true });
    const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    schedule();
  }
  function finishEdit() {
    const text = editing; if (!text) return;
    editing = null;
    const el = elementOf(text);
    el.removeAttribute('contenteditable'); el.removeAttribute('role'); el.removeAttribute('aria-multiline');
    if (el.contains(getSelection().anchorNode)) getSelection().removeAllRanges();
    text.html = sanitizeHtml(el.innerHTML); setHtml(text, el, text.html);
    if (!el.textContent.trim()) { texts = texts.filter(t => t !== text); chosen.delete(text.id); el.remove(); elements.delete(text.id); }
    else fitToContent(text);
    const before = editBefore; editBefore = null;
    if (before) commit(before);
    schedule();
  }

  // ---- Formatting ---------------------------------------------------------
  const rangeIn = el => { const s = getSelection(); return s.rangeCount && el.contains(s.getRangeAt(0).commonAncestorContainer) ? s.getRangeAt(0).cloneRange() : null; };
  const offsetOf = (root, node, offset) => { const r = document.createRange(); r.setStart(root, 0); r.setEnd(node, offset); return r.toString().length; };
  function pointAtOffset(root, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node, left = offset;
    while ((node = walker.nextNode())) { if (left <= node.data.length) return [node, left]; left -= node.data.length; }
    return [root, root.childNodes.length];
  }
  // With a range selected the format applies to it; with none, to the whole text.
  function applyFormat(text, command) {
    const el = paint(text), live = editing === text;
    if (!live) { el.contentEditable = 'true'; el.focus({ preventScroll: true }); }
    const selection = getSelection();
    let range = rangeIn(el), caret = null;
    const ranged = !!range && !range.collapsed;
    if (!ranged) { caret = range ? offsetOf(el, range.endContainer, range.endOffset) : null; range = document.createRange(); range.selectNodeContents(el); }
    selection.removeAllRanges(); selection.addRange(range);
    document.execCommand('styleWithCSS', false, false);
    document.execCommand(command);
    if (!ranged) {
      if (live && caret !== null) { const [node, offset] = pointAtOffset(el, caret); const r = document.createRange(); r.setStart(node, offset); r.collapse(true); selection.removeAllRanges(); selection.addRange(r); }
      else selection.removeAllRanges();
    }
    if (live) { text.html = el.innerHTML; el.dataset.html = text.html; }
    else { el.removeAttribute('contenteditable'); el.blur(); text.html = sanitizeHtml(el.innerHTML); setHtml(text, el, text.html); fitToContent(text); }
  }
  function formatSelected(command) {
    const targets = editing ? [editing] : selected(); if (!targets.length) return;
    const before = editing ? null : checkpoint();
    for (const text of targets) applyFormat(text, command);
    if (before) commit(before);
    schedule();
  }
  // Is every word in range (or in the whole text) inside the given tag?
  function covered(text, selector) {
    const el = elementOf(text); if (!el) return false;
    const range = editing === text ? rangeIn(el) : null, partial = range && !range.collapsed;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let node, any = false;
    while ((node = walker.nextNode())) {
      if (!node.data.trim() || (partial && !range.intersectsNode(node))) continue;
      any = true;
      const owner = node.parentElement.closest(selector);
      if (!owner || !el.contains(owner)) return false;
    }
    return any;
  }
  // Cmd/Ctrl+B and I. With words selected they format those; otherwise the whole text.
  function hotkey(event) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
    const name = { b: 'bold', i: 'italic' }[event.key.toLowerCase()];
    if (!name) return false;
    formatSelected(name);
    return true;
  }
  toolbar.addEventListener('submit', event => event.preventDefault());
  // The editor keeps its focus and selection while a format button is pressed.
  toolbar.addEventListener('mousedown', event => { if (event.target.closest('[data-text-format]')) event.preventDefault(); });
  buttons.bold.addEventListener('click', () => formatSelected('bold'));
  buttons.italic.addEventListener('click', () => formatSelected('italic'));
  let syncing = false;
  sizeField.addEventListener('change', () => {
    if (syncing || !sizeField.value) return;
    const targets = selected(); if (!targets.length) return;
    const before = editing ? null : checkpoint();
    for (const text of targets) { text.size = sizeField.value; fitToContent(text); }
    if (before) commit(before);
    schedule();
  });
  // Selecting words by dragging is done here, not by the browser: the browser drops the
  // selection the moment the pointer leaves the text. The anchor is where the press
  // landed and the other end follows the pointer, nearest point on the text when it is outside.
  function caretAt(el, x, y) {
    const p = document.caretPositionFromPoint?.(x, y);
    const c = p ? { node: p.offsetNode, offset: p.offset } : (() => { const r = document.caretRangeFromPoint?.(x, y); return r ? { node: r.startContainer, offset: r.startOffset } : null; })();
    return c && el.contains(c.node) ? c : null;
  }
  const paintSelection = d => getSelection().setBaseAndExtent(d.anchor.node, d.anchor.offset, d.focus.node, d.focus.offset);
  window.addEventListener('pointermove', event => {
    if (!selDrag || !editing) return;
    const el = elementOf(editing), r = el.getBoundingClientRect();
    // Outside the text the pointer is read as its nearest point on the text, so moving
    // above, below or beside it keeps steering the selection instead of dropping it.
    const x = clamp(event.clientX, r.left + 1, r.right - 1), y = clamp(event.clientY, r.top + 1, r.bottom - 1);
    const c = caretAt(el, x, y);
    if (c && (c.node !== selDrag.focus.node || c.offset !== selDrag.focus.offset)) { selDrag.focus = c; paintSelection(selDrag); }
  });
  const endSelDrag = () => { selDrag = null; delete document.body.dataset.textSelect; };
  window.addEventListener('pointerup', endSelDrag); window.addEventListener('pointercancel', endSelDrag);
  document.addEventListener('selectionchange', () => { if (editing) schedule(); });

  // ---- Pointer ------------------------------------------------------------
  function begin(event, text, kind, part) {
    if (drag || event.button !== 0) return;
    stopCanvas(); event.preventDefault(); event.stopPropagation(); viewport.focus({ preventScroll: true });
    clearTimeout(settleTimer); delete frame.dataset.settling;
    const before = kind === 'create' ? editBefore : checkpoint(), origin = pointAt(event);
    drag = { id: event.pointerId, kind, part, text, before, origin, moved: false, over: { w: 0, h: 0 },
      originals: selected().map(t => ({ text: t, x: t.x, y: t.y })), companions: kind === 'move' ? companions().map(model => ({ model, x: model.x, y: model.y })) : [], base: { x: text.x, y: text.y, width: text.width, height: text.height, fit: text.fit, fitWidth: text.fitWidth }, maxW: kind === 'resize' ? maxWidth(text) : 0 };
    document.body.dataset.textDrag = ''; viewport.setPointerCapture(event.pointerId); schedule();
  }
  viewport.addEventListener('pointerdown', event => {
    if (document.body.hasAttribute('data-fullscreen') || document.body.hasAttribute('data-space') || event.button !== 0 || event.target.closest('#text-inspector')) return;
    if (editing && !elementOf(editing).contains(event.target) && !event.target.closest('.icon-options')) finishEdit();
    const handle = event.target.closest('[data-text-handle]');
    if (handle && selected().length === 1) { begin(event, selected()[0], 'resize', handle.dataset.textHandle); return; }
    const hit = event.target.closest('.text-object'), text = hit && find(hit.dataset.textId);
    if (tool === 'text') {
      if (text) { event.preventDefault(); event.stopPropagation(); setTool('cursor'); startEdit(text); return; }
      if (texts.length >= 500) { event.preventDefault(); event.stopPropagation(); document.querySelector('#canvas-status').textContent = 'The canvas supports up to 500 texts.'; return; }
      editBefore = checkpoint();
      const point = pointAt(event);
      const created = { id: crypto.randomUUID(), x: Math.round(clamp(point.x, 0, extent.width - 8)), y: Math.round(clamp(point.y, 0, extent.height - 8)), width: 8, height: 0, fit: true, fitWidth: false, size: 'md', html: '' };
      texts.push(created); clearScreens(); chosen.clear(); chosen.add(created.id); paint(created);
      begin(event, created, 'create'); return;
    }
    if (tool !== 'cursor' || !text) return;
    if (editing === text) return;
    // Two quick presses on the same text edit it. Cancelling pointerdown below also
    // cancels the browser's own dblclick in some engines, so the pair is counted here.
    const now = performance.now(), again = lastPress && lastPress.id === text.id && now - lastPress.time < 400 && Math.hypot(event.clientX - lastPress.x, event.clientY - lastPress.y) < 6;
    lastPress = again || event.shiftKey ? null : { id: text.id, time: now, x: event.clientX, y: event.clientY };
    if (again) { event.preventDefault(); event.stopPropagation(); startEdit(text); return; }
    if (event.shiftKey) { event.preventDefault(); event.stopPropagation(); choose(text, true); return; }
    if (!chosen.has(text.id)) choose(text);
    begin(event, text, 'move');
  }, true);
  function move(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag.last = event;
    const { kind, text, origin, base } = drag, point = pointAt(event), dx = point.x - origin.x, dy = point.y - origin.y;
    if (!drag.moved && kind !== 'create' && Math.hypot(dx, dy) * camera.scale < 3) return;
    drag.moved = true;
    if (kind === 'move') {
      // Same snapping and axis lock as a screen: edges and centres align with the
      // other objects, equal gaps are offered, and Shift keeps to one axis.
      // Option/Alt copies the selection and carries on with the copies, as with screens.
      drag.duplicate ||= event.altKey === true;
      if (drag.duplicate && !drag.duplicated && !drag.denied) duplicateDrag();
      const rects = [...drag.originals.map(({ text: t, x, y }) => ({ x, y, width: t.width, height: t.height })), ...drag.companions.map(({ model, x, y }) => ({ x, y, width: model.width, height: model.height }))], original = bounds(rects);
      const axis = event.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : null;
      const proposal = { ...original, x: original.x + (axis === 'y' ? 0 : dx), y: original.y + (axis === 'x' ? 0 : dy) };
      const moving = new Set([...drag.originals.map(o => o.text.id), ...drag.companions.map(o => o.model.id)]);
      const snap = snapRect(proposal, snapTargets().filter(o => !moving.has(o.id)), 6 / camera.scale);
      if (axis === 'x') snap.y = original.y; if (axis === 'y') snap.x = original.x;
      const ox = Math.round(clamp(snap.x, 0, extent.width - original.width)) - original.x, oy = Math.round(clamp(snap.y, 0, extent.height - original.height)) - original.y;
      for (const { text: t, x, y } of drag.originals) { t.x = x + ox; t.y = y + oy; }
      for (const { model, x, y } of drag.companions) { model.x = x + ox; model.y = y + oy; }
      const lines = axis ? snap.guides.filter(line => line.kind === 'gap' ? line.axis !== axis : line.axis === axis) : snap.guides;
      if (axis) {
        const horizontal = axis === 'x';
        lines.push({ axis: horizontal ? 'y' : 'x', value: original[horizontal ? 'y' : 'x'] + original[horizontal ? 'height' : 'width'] / 2, from: Math.min(original[axis], original[axis] + (horizontal ? ox : oy)), to: Math.max(original[axis] + original[horizontal ? 'width' : 'height'], original[axis] + (horizontal ? ox : oy) + original[horizontal ? 'width' : 'height']), kind: 'axis' });
      }
      drawGuides(lines);
    } else if (kind === 'create') {
      text.width = Math.round(clamp(Math.abs(dx), 8, extent.width)); text.x = Math.round(clamp(Math.min(origin.x, point.x), 0, extent.width - text.width));
      drag.moved = Math.abs(dx) * camera.scale >= 4;
    } else {
      const part = drag.part, horizontal = /[ew]/.test(part), vertical = /[ns]/.test(part);
      const rawWidth = base.width + (part.includes('e') ? dx : part.includes('w') ? -dx : 0);
      const width = horizontal ? Math.round(clamp(rawWidth, Math.min(minWidth(text), drag.maxW), drag.maxW)) : base.width;
      const content = contentHeight(text, width);
      let height = base.fit ? content : Math.min(base.height, content), fit = base.fit, rawHeight = height;
      if (vertical) {
        rawHeight = base.height + (part.includes('s') ? dy : -dy);
        height = content;
        fit = true;
      }
      drag.over = { w: horizontal ? rawWidth - width : 0, h: vertical ? rawHeight - height : 0 };
      text.fitWidth = horizontal ? width >= drag.maxW : base.fitWidth;
      text.width = width; text.fit = fit; text.height = fit ? content : Math.round(height);
      text.x = part.includes('w') ? Math.round(base.x + base.width - text.width) : base.x;
      text.y = part.includes('n') ? Math.round(base.y + base.height - text.height) : base.y;
    }
    schedule();
  }
  function release() {
    const previous = drag; drag = null;
    if (viewport.hasPointerCapture?.(previous.id)) viewport.releasePointerCapture(previous.id);
    delete document.body.dataset.textDrag; drawGuides([]);
    return previous;
  }
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    move(event);
    const previous = release();
    if (previous.kind === 'create') {
      previous.text.fitWidth = !previous.moved;
      if (!previous.moved) previous.text.width = Math.round(TEXT_SIZES[previous.text.size] * .6);
      previous.text.x = Math.round(clamp(previous.text.x, 0, extent.width - previous.text.width));
      setTool('cursor'); startEdit(previous.text, previous.before);
    } else {
      if (previous.kind === 'resize' && (previous.over.w || previous.over.h) && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        frame.dataset.settling = ''; clearTimeout(settleTimer); settleTimer = setTimeout(() => delete frame.dataset.settling, 450);
      }
      commit(previous.before);
    }
    schedule();
  }
  function cancel() {
    if (drag) {
      const previous = release();
      if (previous.kind === 'create') { texts = texts.filter(t => t !== previous.text); chosen.delete(previous.text.id); elementOf(previous.text)?.remove(); elements.delete(previous.text.id); editBefore = null; }
      else if (previous.kind === 'move') {
        if (previous.duplicated) {
          const gone = new Set(previous.originals.map(o => o.text.id));
          texts = texts.filter(t => !gone.has(t.id)); chosen.clear(); for (const id of previous.sourceIds) chosen.add(id);
          for (const o of previous.originals) { elementOf(o.text)?.remove(); elements.delete(o.text.id); }
          if (previous.companionCopies) discardCompanions(previous.companionCopies, previous.companionSources);
        } else {
          for (const { text, x, y } of previous.originals) Object.assign(text, { x, y });
          for (const { model, x, y } of previous.companions) Object.assign(model, { x, y });
        }
      }
      else Object.assign(previous.text, previous.base);
      schedule(); return true;
    }
    if (editing) { finishEdit(); return true; }
    return false;
  }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel);
  function duplicateDrag() {
    if (texts.length + drag.originals.length > 500) { drag.denied = true; document.querySelector('#canvas-status').textContent = 'The canvas supports up to 500 texts.'; return; }
    drag.duplicated = true; drag.sourceIds = drag.originals.map(o => o.text.id);
    drag.originals = drag.originals.map(({ text, x, y }) => {
      Object.assign(text, { x, y });
      const copy = { ...structuredClone(text), id: crypto.randomUUID() }; texts.push(copy);
      return { text: copy, x, y };
    });
    chosen.clear(); for (const o of drag.originals) chosen.add(o.text.id);
    if (drag.companions.length) {
      for (const { model, x, y } of drag.companions) Object.assign(model, { x, y });
      drag.companionSources = drag.companions.map(c => c.model);
      drag.companionCopies = duplicateCompanions();
      drag.companions = drag.companionCopies.map(model => ({ model, x: model.x, y: model.y }));
    }
  }
  const shiftChanged = event => { if (['Shift', 'Alt'].includes(event.key) && drag?.kind === 'move' && drag.last) move({ pointerId: drag.id, clientX: drag.last.clientX, clientY: drag.last.clientY, shiftKey: event.shiftKey, altKey: event.altKey }); };
  window.addEventListener('keyup', shiftChanged);
  window.addEventListener('keydown', event => {
    shiftChanged(event);
    if (document.body.hasAttribute('data-fullscreen') || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && !event.target.closest?.('input,textarea,select,[contenteditable],.icon-options')) { if (!cancel()) { chosen.clear(); schedule(); } return; }
    if (event.key.toLowerCase() === 't' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest?.('input,textarea,select,[contenteditable],.icon-options')) setTool('text');
    if (!editing && chosen.size && !event.target.closest?.('input,textarea,select,[contenteditable],.icon-options,dialog') && hotkey(event)) event.preventDefault();
  });
  document.addEventListener('tio-canvas:tool', event => {
    tool = event.detail; if (editing) finishEdit();
    schedule();
  });
  textButton.onclick = () => setTool('text');

  // ---- Render -------------------------------------------------------------
  function frameRect(text) {
    const scale = camera.scale; let { x, y, width, height } = text;
    if (drag?.kind === 'resize' && drag.text === text) {
      const w = rubberBand(drag.over.w * scale) / scale, h = rubberBand(drag.over.h * scale) / scale, part = drag.part;
      if (part.includes('e')) width += w; else if (part.includes('w')) { x -= w; width += w; }
      if (part.includes('s')) height += h; else if (part.includes('n')) { y -= h; height += h; }
      width = Math.max(width, 8 / scale); height = Math.max(height, 8 / scale);
    }
    return { left: camera.x + x * scale, top: camera.y + y * scale, width: width * scale, height: height * scale };
  }
  function render() {
    const alive = new Set(texts.map(t => t.id));
    for (const [id, el] of elements) if (!alive.has(id)) { el.remove(); elements.delete(id); }
    for (const text of texts) {
      // While typing, a text that hugs its words keeps hugging them as they grow.
      if (editing === text && text.fitWidth) text.width = Math.max(Math.min(maxWidth(text), extent.width - text.x), Math.round(TEXT_SIZES[text.size] * .6));
      const el = paint(text);
      if (text.fit) text.height = Math.max(el.offsetHeight, Math.ceil(minHeight(text)));
      el.toggleAttribute('data-selected', chosen.has(text.id));
    }
    const targets = selected(), single = targets.length === 1 && !screenSelectionCount();
    frame.hidden = !single;
    if (single) {
      const r = frameRect(targets[0]);
      Object.assign(frame.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      frame.toggleAttribute('data-editing', editing === targets[0]);
    }
    outlines.replaceChildren(...(single ? [] : targets.map(text => {
      const r = frameRect(text), box = document.createElement('div'); box.className = 'text-outline';
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }); return box;
    })));
    toolbar.hidden = !targets.length || !!drag;
    if (toolbar.hidden) return;
    const sizes = targets.map(t => t.size), same = sizes.every(s => s === sizes[0]);
    const size = same ? sizes[0] : '';
    if (sizeField.value !== size || sizeField.dataset.painted !== 'true') {
      syncing = true; sizeField.value = size; sizeField.dispatchEvent(new Event('change')); syncing = false; sizeField.dataset.painted = 'true';
    }
    buttons.bold.setAttribute('aria-pressed', String(targets.every(t => covered(t, 'b'))));
    buttons.italic.setAttribute('aria-pressed', String(targets.every(t => covered(t, 'i'))));
    const main = document.querySelector('#edit-tools').getBoundingClientRect(), inset = parseFloat(getComputedStyle(toolbar).getPropertyValue('--canvas-panel-inset'));
    const center = Math.max(inset + toolbar.offsetWidth / 2, Math.min(innerWidth - inset - toolbar.offsetWidth / 2, main.left + main.width / 2));
    toolbar.style.left = `${center}px`; toolbar.style.bottom = `${innerHeight - main.top + inset}px`;
  }
  function removeSelected() {
    if (editing && chosen.has(editing.id)) { editing = null; editBefore = null; }
    texts = texts.filter(t => !chosen.has(t.id)); chosen.clear(); schedule();
  }
  return {
    render, cancel, removeSelected,
    capture: () => structuredClone(texts),
    restore(value, ids) {
      drag && release(); if (editing) { elementOf(editing)?.removeAttribute('contenteditable'); editing = null; editBefore = null; }
      texts = readTexts(value); chosen.clear();
      for (const id of Array.isArray(ids) ? ids : []) if (find(id)) chosen.add(id);
      for (const el of elements.values()) delete el.dataset.html;
      schedule();
    },
    layers: () => texts.map(({ id, html }) => ({ id, html })),
    objects: () => texts.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
    get ids() { return texts.map(t => t.id); },
    get selectedIds() { return [...chosen]; },
    selectedModels: () => selected(),
    selectOnly(id) { const text = find(id); if (text && !chosen.has(id)) choose(text); },
    duplicateSelected(dx = 24, dy = dx) {
      const sources = selected();
      if (!sources.length || texts.length + sources.length > 500) return null;
      const copies = sources.map(t => ({ ...structuredClone(t), id: crypto.randomUUID(), x: Math.round(clamp(t.x + dx, 0, extent.width - t.width)), y: Math.round(clamp(t.y + dy, 0, extent.height - t.height)) }));
      texts.push(...copies); chosen.clear(); for (const c of copies) chosen.add(c.id);
      schedule(); return copies;
    },
    clearSelection() { if (editing) finishEdit(); chosen.clear(); schedule(); },
    selectRect(box, initial = []) {
      chosen.clear(); for (const id of initial) if (find(id)) chosen.add(id);
      if (box) for (const text of texts) if (intersects(box, text)) chosen.add(text.id);
      schedule();
    },
  };
}
