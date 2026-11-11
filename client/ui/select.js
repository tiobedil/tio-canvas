import { h } from './dom.js';
import { Icon, setIcon, Chevron } from './icons.js';
import { Menu, MenuItem, MenuLabel, menuKeys, isOpen, closeMenu } from './menu.js';
import { menuPosition } from '../menu-position.js';

// Every select menu that exists, with the function that places it.
const placers = new Map();
const groupIcons = { Desktop: 'desktop', Mobile: 'phone', Tablet: 'tablet', Foldable: 'foldable' };

export function closeSelectMenus() { for (const menu of placers.keys()) closeMenu(menu); }
export function positionSelectMenus() { for (const [menu, place] of placers) if (isOpen(menu)) place(); }

// Wire a trigger to its menu: open, place beside free space, close, report state.
function connect(trigger, menu, focusItem) {
  trigger.setAttribute('aria-controls', menu.id);
  const place = () => {
    menu.style.removeProperty('max-height');
    // A select inside the dials opens as wide as its field.
    if (trigger.closest('.ui-dial-row')) { const width = `${trigger.getBoundingClientRect().width}px`; menu.style.boxSizing = 'border-box'; menu.style.width = width; menu.style.minWidth = width; }
    const anchor = trigger.getBoundingClientRect(), box = menu.getBoundingClientRect();
    const style = getComputedStyle(menu);
    const margin = parseFloat(style.getPropertyValue('--canvas-panel-inset'));
    const gap = parseFloat(style.getPropertyValue('--canvas-menu-offset'));
    const owner = trigger.closest('.ui-panel');
    const obstacles = [...document.querySelectorAll('.ui-panel')]
      .filter(element => element !== owner && !element.hasAttribute('popover') && getComputedStyle(element).position === 'fixed' && element.checkVisibility())
      .map(element => element.getBoundingClientRect());
    // offsetWidth ignores the open animation's scale, which would shift the menu off its field.
    const placement = menuPosition({ anchor, width: menu.offsetWidth, height: box.height,
      viewport: { width: innerWidth, height: innerHeight }, margin, gap, obstacles,
      aboveOnly: menu.dataset.variant === 'icons' });
    if (!placement) return;
    menu.style.maxHeight = `${placement.height}px`;
    menu.style.left = `${placement.x}px`;
    menu.style.top = `${placement.y}px`;
    // Scale from the trigger: its centre on x, the edge facing it on y.
    menu.style.transformOrigin = `${anchor.left + anchor.width / 2 - placement.x}px ${placement.y >= anchor.bottom - 1 ? '0' : '100%'}`;
  };
  placers.set(menu, place);
  // A popover="auto" menu is light-dismissed by the press that lands on its own
  // trigger, so by click time it is already closed and would reopen at once.
  let wasOpen = false;
  trigger.addEventListener('pointerdown', () => { wasOpen = isOpen(menu); });
  trigger.addEventListener('click', () => {
    const pressedWhileOpen = wasOpen;
    wasOpen = false;
    if (pressedWhileOpen || isOpen(menu)) {
      closeMenu(menu);
      // Closing with a pointer must not leave a keyboard ring on the trigger.
      if (pressedWhileOpen) trigger.blur();
      return;
    }
    closeSelectMenus();
    menu.showPopover();
    // Position in the opening task, before the browser can paint an old location.
    place();
    const item = focusItem();
    item?.focus({ preventScroll: true });
    item?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  });
  menu.addEventListener('beforetoggle', event => trigger.setAttribute('aria-expanded', String(event.newState === 'open')));
  window.addEventListener('resize', () => { if (isOpen(menu)) place(); });
}

/**
 * A choice of text options, opened from a button. The native <select> inside is the
 * data interface (value, options, change events) and is never shown; the menu is
 * rebuilt from it each time it opens, so options added later still appear.
 *   const field = SelectField({ id: 'size', label: 'Text size', options: [{ value: 'sm', label: '16 px' }], mixed: true })
 *   field.select  the <select>        field.sync()  refresh the label and ticks after setting select.value
 * options: { value, label } or { group: 'Desktop', options: […] }. mixed: add a "Mixed" placeholder.
 */
export function SelectField({ id, label, options = [], mixed, dataset }) {
  const select = h('select', { id, 'aria-label': label, hidden: true, dataset });
  if (mixed) select.append(h('option', { value: '', disabled: true, hidden: true }, 'Mixed'));
  for (const entry of options) {
    if (!entry.group) { select.append(h('option', { value: entry.value }, entry.label)); continue; }
    select.append(h('optgroup', { label: entry.group }, ...entry.options.map(option => h('option', { value: option.value }, option.label))));
  }
  const name = h('span', { id: id ? `${id}-label` : undefined, 'data-field-label': '', 'aria-hidden': 'true' });
  const trigger = h('button', { type: 'button', class: 'ui-select', 'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': 'false', dataset: { tooltip: label } }, name, Chevron());
  const menu = Menu({ id: `select-options-${id}`, label, variant: 'options' });
  document.body.append(menu);
  const root = h('span', { class: 'ui-select-field' }, trigger, select);

  const sync = () => {
    name.textContent = select.selectedOptions[0]?.textContent || 'Mixed';
    for (const item of menu.querySelectorAll('[data-value]')) item.setAttribute('aria-checked', String(item.dataset.value === select.value));
  };
  const rebuild = () => {
    menu.replaceChildren();
    let groupLabel;
    for (const item of select.options) {
      if (item.hidden || item.disabled) continue;
      const group = item.parentElement instanceof HTMLOptGroupElement ? item.parentElement.label : '';
      if (group && group !== groupLabel) { groupLabel = group; menu.append(MenuLabel({ icon: groupIcons[group] ?? 'desktop', text: group })); }
      menu.append(MenuItem({
        role: 'menuitemradio', checked: false, dataset: { value: item.value },
        onClick: () => {
          select.value = item.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          closeMenu(menu);
          document.activeElement?.blur();
          sync();
        },
      }, item.textContent));
    }
    sync();
  };
  trigger.addEventListener('click', rebuild);
  select.addEventListener('change', sync);
  connect(trigger, menu, () => { sync(); return menu.querySelector('[aria-checked="true"]') || menu.querySelector('[data-value]'); });
  menuKeys(menu, {
    onEscape: () => { closeMenu(menu); trigger.focus(); },
    onTab: () => { closeMenu(menu); trigger.focus(); },
  });
  rebuild();
  Object.assign(root, { select, trigger, menu, sync });
  return root;
}

/**
 * A choice of icons, opened from a button that shows the chosen one. No native
 * <select>: the trigger itself carries `value` and fires `change`.
 *   IconSelect({ label: 'Start style', dataset: { arrowField: 'startStyle' },
 *     options: [{ value: 'line', icon: 'end-line', label: 'Line' }, { value: 'arrow', icon: 'end-start', label: 'Left arrow' }] })
 * Set trigger.value, then call sync(); an empty value reads as "Mixed".
 */
export function IconSelect({ id, label, options, dataset }) {
  const shown = Icon(options[0].icon);
  const trigger = h('button', { type: 'button', class: 'ui-select', 'aria-haspopup': 'menu', 'aria-expanded': 'false', value: options[0].value, dataset }, shown, Chevron());
  const menu = Menu({ id: `${id}-options`, label, variant: 'icons' });
  for (const option of options) {
    menu.append(MenuItem({
      role: 'menuitemradio', icon: option.icon, label: option.label, checked: false, dataset: { value: option.value },
      onClick: () => {
        trigger.value = option.value;
        trigger.dispatchEvent(new Event('change', { bubbles: true }));
        closeMenu(menu);
        document.activeElement?.blur();
      },
    }));
  }
  document.body.append(menu);
  const root = h('span', { class: 'ui-select-field' }, trigger);
  const sync = () => {
    const chosen = options.find(option => option.value === trigger.value);
    setIcon(shown, (chosen ?? options[0]).icon);
    trigger.dataset.mixed = String(!trigger.value);
    trigger.setAttribute('aria-label', `${label}: ${chosen ? chosen.value : 'Mixed'}`);
    for (const item of menu.children) item.setAttribute('aria-checked', String(item.dataset.value === trigger.value));
  };
  connect(trigger, menu, () => menu.querySelector('[aria-checked="true"]') || menu.firstElementChild);
  menuKeys(menu, { horizontal: true, onEscape: () => { closeMenu(menu); trigger.focus(); } });
  sync();
  Object.assign(root, { trigger, menu, sync });
  return root;
}
