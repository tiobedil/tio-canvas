import { h } from './dom.js';
import { Icon } from './icons.js';
import { Input } from './field.js';
import { Checkbox } from './list.js';
import { Kbd, Pill } from './content.js';
import { searchGroups, createSpotlightState } from './spotlight-model.js';

const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The matched part of a text, marked. */
function marked(text, range) {
  if (!range) return [text];
  return [text.slice(0, range[0]), h('mark', {}, text.slice(range[0], range[1])), text.slice(range[1])];
}

/**
 * A search panel that floats above the toolbar (like macOS Spotlight) and adds
 * several of a list of items at once. No scrim: the canvas behind stays usable.
 *
 *   const spotlight = Spotlight({ id: 'add-pages', label: 'Add pages', trigger: button,
 *     groups: [{ id: 'production', label: 'Production' }],
 *     items: [{ id, group, title, description }],
 *     thumbnail: item => url, count: item => n, remaining: () => slots left,
 *     onAdd: ids => true | false, empty: node })
 *   document.body.append(spotlight)
 *
 * A query matches an item's title or a group's name. Up and Down move the
 * highlight, Shift with them selects a range, Enter adds the selection (or the
 * highlighted row), Escape clears the selection, then the query, then closes.
 * The query survives closing. Cmd or Ctrl+K opens and closes it.
 *   trigger     the button that opens it; it shows aria-expanded
 *   enabled     () => boolean; false stops the shortcut (a dialog is open, say)
 *   empty       what to show when `items` is empty
 *   onOpen, onClose
 * The returned element has open(), close() and toggle().
 */
export function Spotlight({ id, label, placeholder = 'Search', groups, items, thumbnail, count = () => 0, remaining = () => Infinity, onAdd, empty, trigger, enabled = () => true, onOpen, onClose }) {
  const state = createSpotlightState();
  const order = groups.flatMap(group => items.filter(item => item.group === group.id)).map(item => item.id);
  let reachable = [], error = '', opened = false;

  const input = Input({ id: `${id}-search`, role: 'combobox', 'aria-label': label, 'aria-controls': `${id}-list`, 'aria-expanded': 'true', 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false', placeholder, disabled: !items.length });
  const notice = h('p', { class: 'ui-spotlight-notice', role: 'status', hidden: true });
  const hiddenBox = Checkbox({ label: 'Unselect the pages the search hides', checked: true, tabIndex: -1 });
  const hiddenText = h('span', {});
  const hiddenBar = h('div', { class: 'ui-spotlight-hidden', hidden: true }, hiddenBox, hiddenText);
  const list = h('div', { id: `${id}-list`, class: 'ui-spotlight-list', role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': label });
  const emptyEl = h('div', { class: 'ui-spotlight-empty', role: 'status', hidden: true });
  const addHint = h('span', {}, 'add');
  const selectedCount = h('span', { class: 'ui-spotlight-count' });
  const footer = h('footer', { class: 'ui-spotlight-footer' },
    h('span', { class: 'ui-spotlight-hints' },
      h('span', {}, Kbd({}, '↑'), Kbd({}, '↓'), ' move'),
      h('span', {}, Kbd({}, '⇧'), Kbd({}, '↑↓'), ' select'),
      h('span', {}, Kbd({}, '↵'), ' ', addHint)),
    selectedCount);
  const root = h('div', { id, class: 'ui-spotlight', popover: 'manual', role: 'dialog', 'aria-label': label },
    h('div', { class: 'ui-spotlight-search' }, Icon('search'), input), notice, hiddenBar, list, emptyEl, footer);

  // One row per item, built once and moved as the query changes (so thumbnails do not reload).
  const rows = new Map();
  items.forEach((item, index) => {
    const url = thumbnail?.(item);
    const image = url ? h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async', draggable: false }) : null;
    image?.addEventListener('error', () => image.remove(), { once: true });
    const row = {
      item, title: h('span', { class: 'ui-spotlight-title' }), pill: Pill({ hidden: true }),
      check: Checkbox({ label: `Select ${item.title}`, tabIndex: -1, 'aria-hidden': 'true' }),
    };
    row.el = h('div', { class: 'ui-row ui-spotlight-row', role: 'option', id: `${id}-option-${index}`, dataset: { id: item.id } },
      row.check, h('span', { class: 'ui-spotlight-thumb', 'aria-hidden': 'true' }, image),
      h('span', { class: 'ui-spotlight-label' }, row.title, h('small', {}, item.description)), row.pill);
    rows.set(item.id, row);
  });

  function message() {
    const left = remaining();
    if (error) return error;
    if (left <= 0) return 'The canvas is full. Remove screens to add more pages.';
    if (state.size > left) return `Only ${plural(left, 'more page fits', 'more pages fit')}. Select fewer pages.`;
    return '';
  }

  /** Build the list for the current query. */
  function render() {
    const query = input.value;
    const results = searchGroups(groups, items, query);
    const full = remaining() <= 0;
    reachable = full ? [] : results.flatMap(group => group.items.map(entry => entry.item.id));
    list.replaceChildren(...results.map(({ group, range, items: found }) => h('div', { class: 'ui-spotlight-group', role: 'group', 'aria-labelledby': `${id}-group-${group.id}` },
      h('div', { id: `${id}-group-${group.id}`, class: 'ui-spotlight-heading' }, h('span', {}, ...marked(group.label, range)), h('span', { class: 'ui-spotlight-heading-count' }, String(found.length))),
      ...found.map(({ item, range: at }) => {
        const row = rows.get(item.id);
        row.title.replaceChildren(...marked(item.title, at));
        return row.el;
      }))));
    for (const row of rows.values()) {
      const number = count(row.item.id);
      row.pill.hidden = !number;
      row.pill.textContent = number ? `${number} on canvas` : '';
      row.el.toggleAttribute('data-disabled', full);
      row.el.setAttribute('aria-disabled', String(full));
    }
    const none = items.length > 0 && !results.length;
    root.dataset.state = !items.length ? 'empty' : none ? 'none' : 'results';
    list.hidden = !results.length;
    emptyEl.hidden = !(none || !items.length);
    footer.hidden = !items.length;
    if (!items.length) emptyEl.replaceChildren(empty ?? 'No pages');
    else if (none) emptyEl.replaceChildren(h('strong', {}, `No results for “${query.trim()}”`), h('p', {}, 'Try a page or group name.'));
    sync();
  }

  const visibleIds = () => [...rows.keys()].filter(key => list.contains(rows.get(key).el));

  /** Reflect the highlight and the selection on screen. */
  function sync(scroll = false) {
    for (const [rowId, row] of rows) {
      const active = rowId === state.active && reachable.includes(rowId), chosen = state.selected.has(rowId);
      row.el.toggleAttribute('data-active', active);
      row.el.dataset.checked = String(chosen);
      row.el.setAttribute('aria-selected', String(chosen));
      row.check.setAttribute('aria-checked', String(chosen));
      if (active) { input.setAttribute('aria-activedescendant', row.el.id); if (scroll) row.el.scrollIntoView({ block: 'nearest' }); }
    }
    if (!reachable.includes(state.active)) input.removeAttribute('aria-activedescendant');
    const hiddenIds = state.hidden(visibleIds());
    hiddenBar.hidden = !hiddenIds.length;
    hiddenText.textContent = `${plural(hiddenIds.length, 'selected page', 'selected pages')} hidden by search`;
    const text = message();
    notice.hidden = !text; notice.textContent = text;
    selectedCount.textContent = state.size ? `${state.size} selected` : '';
    addHint.textContent = state.size > 1 ? `add ${state.size} pages` : 'add';
  }

  function commit(ids) {
    const chosen = ids ?? (state.size ? order.filter(key => state.selected.has(key)) : state.active && reachable.includes(state.active) ? [state.active] : []);
    if (!chosen.length || remaining() <= 0 || chosen.length > remaining()) { sync(); return; }
    if (onAdd(chosen) === false) { error = 'Cannot add these pages. Remove screens or select fewer pages.'; sync(); return; }
    input.value = ''; state.clear();
    close();
  }

  function open() {
    if (opened) return;
    opened = true; error = '';
    onOpen?.();
    for (const menu of document.querySelectorAll('.ui-menu:popover-open')) menu.hidePopover();
    root.showPopover();
    trigger?.setAttribute('aria-expanded', 'true');
    render(); state.reset(reachable); sync(true);
    input.focus({ preventScroll: true }); input.select();
  }
  function close() {
    if (!opened) return;
    opened = false; error = '';
    state.clear();
    root.hidePopover();
    trigger?.setAttribute('aria-expanded', 'false');
    onClose?.();
  }
  const toggle = () => (opened ? close() : open());
  Object.assign(root, { open, close, toggle });
  trigger?.setAttribute('aria-haspopup', 'dialog'); trigger?.setAttribute('aria-expanded', 'false'); trigger?.setAttribute('aria-controls', id);
  trigger?.addEventListener('click', toggle);

  input.addEventListener('input', () => { error = ''; render(); state.reset(reachable); sync(true); });
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    const key = event.key, mod = event.metaKey || event.ctrlKey;
    if (key !== 'Enter') error = '';
    if (key === 'ArrowDown' || key === 'ArrowUp') { event.preventDefault(); state.move(reachable, key === 'ArrowDown' ? 1 : -1, event.shiftKey); sync(true); }
    else if ((key === 'Home' || key === 'End') && !mod) { event.preventDefault(); state.move(reachable, key.toLowerCase(), event.shiftKey); sync(true); }
    else if (key === 'Enter') { event.preventDefault(); commit(); }
    else if (key === 'Escape') {
      event.preventDefault();
      if (state.size) { state.clear(); sync(); }
      else if (input.value) { input.value = ''; render(); state.reset(reachable); sync(true); }
      else close();
    } else if (mod && !event.altKey && key.toLowerCase() === 'a') { event.preventDefault(); state.selectAll(reachable); sync(); }
  });

  // Focus stays in the search field; a click never takes it away.
  root.addEventListener('pointerdown', event => { if (event.target !== input) event.preventDefault(); });
  const rowOf = event => event.target.closest?.('.ui-spotlight-row');
  list.addEventListener('pointermove', event => {
    const row = rowOf(event);
    if (!row || row.hasAttribute('data-disabled') || row.dataset.id === state.active) return;
    state.highlight(row.dataset.id); sync();
  });
  list.addEventListener('click', event => {
    const row = rowOf(event);
    if (!row || row.hasAttribute('data-disabled')) return;
    error = '';
    const rowId = row.dataset.id;
    if (event.shiftKey) state.rangeTo(reachable, rowId);
    else if (event.target.closest('.ui-checkbox') || state.size) state.toggle(rowId);
    else { commit([rowId]); return; }
    sync();
  });
  hiddenBar.addEventListener('click', () => { state.unselectHidden(visibleIds()); sync(); });

  // Outside the panel: a click closes it, and Cmd or Ctrl+K opens and closes it.
  document.addEventListener('pointerdown', event => {
    if (opened && !root.contains(event.target) && !trigger?.contains(event.target)) close();
  }, true);
  document.addEventListener('keydown', event => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k') return;
    if (event.target !== input && event.target.closest?.(TYPING)) return;
    if (!opened && !enabled()) return;
    event.preventDefault();
    toggle();
  });
  return root;
}
