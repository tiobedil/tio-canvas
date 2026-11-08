import { menuPosition } from './menu-position.js';

const selectMenus = new Map();
const groupIcons = {
  Desktop: '<rect x="3" y="3" width="14" height="10" rx="1"/><path d="M10 13v4m-4 0h8"/>',
  Mobile: '<rect x="6" y="2" width="8" height="16" rx="2"/><path d="M9 15h2"/>',
  Tablet: '<rect x="4" y="2" width="12" height="16" rx="2"/><path d="M9 15h2"/>',
  Foldable: '<rect x="4" y="2" width="12" height="16" rx="2"/><path d="M10 2v16"/>',
};

export function closeSelectMenus() {
  for (const menu of selectMenus.keys()) if (menu.matches(':popover-open')) menu.hidePopover();
}

export function positionSelectMenus() {
  for (const [menu, position] of selectMenus) if (menu.matches(':popover-open')) position();
}

function connectMenu(button, menu, focusOption) {
  button.removeAttribute('popovertarget');
  button.setAttribute('aria-controls', menu.id);
  const position = () => {
    menu.style.removeProperty('max-height');
    const anchor = button.getBoundingClientRect(), box = menu.getBoundingClientRect();
    const style = getComputedStyle(menu);
    const margin = parseFloat(style.getPropertyValue('--canvas-panel-inset'));
    const gap = parseFloat(style.getPropertyValue('--canvas-menu-offset'));
    const owner = button.closest('.canvas-tools');
    const obstacles = [...document.querySelectorAll('.canvas-tools')]
      .filter(element => element !== owner && !element.hasAttribute('popover') && getComputedStyle(element).position === 'fixed' && element.checkVisibility())
      .map(element => element.getBoundingClientRect());
    const placement = menuPosition({ anchor, width: box.width, height: box.height,
      viewport: { width: innerWidth, height: innerHeight }, margin, gap, obstacles,
      aboveOnly: menu.classList.contains('endpoint-options') });
    if (!placement) return;
    menu.style.maxHeight = `${placement.height}px`;
    menu.style.left = `${placement.x}px`;
    menu.style.top = `${placement.y}px`;
    // Scale from the trigger: its centre on x, the edge facing it on y.
    menu.style.transformOrigin = `${anchor.left + anchor.width / 2 - placement.x}px ${placement.y >= anchor.bottom - 1 ? '0' : '100%'}`;
  };
  selectMenus.set(menu, position);
  // A popover="auto" menu is light-dismissed by the press that lands on its own
  // trigger, so by click time it is already closed and would reopen at once.
  let wasOpen = false;
  button.addEventListener('pointerdown', () => { wasOpen = menu.matches(':popover-open'); });
  button.addEventListener('click', () => {
    const pressedWhileOpen = wasOpen;
    wasOpen = false;
    if (pressedWhileOpen || menu.matches(':popover-open')) {
      if (menu.matches(':popover-open')) menu.hidePopover();
      // Closing with a pointer must not leave a keyboard ring on the trigger.
      if (pressedWhileOpen) button.blur();
      return;
    }
    closeSelectMenus();
    menu.showPopover();
    // Position in the opening task, before the browser can paint an old location.
    position();
    const option = focusOption();
    option?.focus({ preventScroll: true });
    option?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  });
  menu.addEventListener('beforetoggle', event => {
    button.setAttribute('aria-expanded', String(event.newState === 'open'));
  });
  window.addEventListener('resize', () => { if (menu.matches(':popover-open')) position(); });
}

// Icon menus share the preset field's padding, chevron, focus ring, and surface.
const icons = {
  line: 'M3 10h14',
  start: 'M17 10H3m5-5-5 5 5 5',
  end: 'M3 10h14m-5-5 5 5-5 5',
};
export function setupArrowFields(toolbar) {
  const menus = [];
  for (const button of toolbar.querySelectorAll('button[data-arrow-field]')) {
    const side = button.dataset.arrowField === 'startStyle' ? 'start' : 'end';
    const menu = document.createElement('div');menu.className = 'canvas-tools icon-options endpoint-options';menu.popover = 'auto';menu.setAttribute('role', 'menu');menu.setAttribute('aria-label', `${side === 'start' ? 'Start' : 'End'} style`);
    menu.id = `arrow-${side}-options`;button.setAttribute('popovertarget', menu.id);button.setAttribute('aria-haspopup', 'menu');
    for (const value of ['line', 'arrow']) {
      const option = document.createElement('button');option.type = 'button';option.dataset.value = value;option.setAttribute('role', 'menuitemradio');
      option.setAttribute('aria-label', value === 'line' ? 'Line' : `${side === 'start' ? 'Left' : 'Right'} arrow`);
      option.innerHTML = `<svg class="field-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="${icons[value === 'line' ? 'line' : side]}"/></svg>`;
      option.onclick = () => { button.value = value;button.dispatchEvent(new Event('change', { bubbles: true }));menu.hidePopover();document.activeElement?.blur(); };
      menu.append(option);
    }
    document.body.append(menu);menus.push({ button, menu, side });
    connectMenu(button, menu, () => menu.querySelector('[aria-checked="true"]') || menu.firstElementChild);
    menu.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
      event.preventDefault();event.stopPropagation();
      if (event.key === 'Escape') { menu.hidePopover();button.focus();return; }
      const options = [...menu.children], index = options.indexOf(document.activeElement);
      options[event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (index + 1) % 2].focus();
    });
  }
  return {
    update() {
      for (const field of toolbar.querySelectorAll('select[data-arrow-field]')) {
        const label = field.parentElement.previousElementSibling.querySelector('[data-field-label]');
        label.textContent = field.selectedOptions[0]?.textContent ?? 'Mixed';
      }
      for (const { button, menu, side } of menus) {
        button.querySelector('path').setAttribute('d', icons[button.value === 'arrow' ? side : 'line']);
        button.dataset.mixed = String(!button.value);
        button.setAttribute('aria-label', `${side === 'start' ? 'Start' : 'End'} style: ${button.value || 'Mixed'}`);
        for (const option of menu.children) option.setAttribute('aria-checked', String(option.dataset.value === button.value));
      }
    },
    close() { for (const { menu } of menus) if (menu.matches(':popover-open')) menu.hidePopover(); },
  };
}

// Keep select values as the data interface, never as the visible control.
export function setupSelectFields(root = document) {
  for (const select of root.querySelectorAll('.select-field select')) {
    const field = select.parentElement;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'select-field';
    button.setAttribute('aria-label', select.getAttribute('aria-label') || 'Preset');
    button.dataset.tooltip = button.getAttribute('aria-label');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    for (const child of [...field.children]) if (child !== select) button.append(child);
    field.before(button);
    select.hidden = true;
    field.hidden = true;
    const menu = document.createElement('div');
    menu.className = 'canvas-tools icon-options text-options';
    menu.popover = 'auto';
    menu.id = `select-options-${select.id || select.dataset.arrowField}`;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', button.getAttribute('aria-label'));
    button.setAttribute('popovertarget', menu.id);
    document.body.append(menu);
    const sync = () => {
      button.querySelector('span').textContent = select.selectedOptions[0]?.textContent || 'Mixed';
      for (const option of menu.querySelectorAll('button[data-value]')) option.setAttribute('aria-checked', String(option.dataset.value === select.value));
    };
    const rebuild = () => {
      menu.replaceChildren();
      let groupLabel;
      for (const item of select.options) {
        if (item.hidden || item.disabled) continue;
        const group = item.parentElement instanceof HTMLOptGroupElement ? item.parentElement.label : '';
        if (group && group !== groupLabel) {
          groupLabel = group;
          const heading = document.createElement('div'); heading.className = 'option-group-label';
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          icon.setAttribute('viewBox', '0 0 20 20'); icon.setAttribute('aria-hidden', 'true');
          icon.innerHTML = groupIcons[group] || groupIcons.Desktop;
          const label = document.createElement('span'); label.textContent = group;
          heading.append(icon, label); menu.append(heading);
        }
        const option = document.createElement('button');
        option.type = 'button';
        option.textContent = item.textContent;
        option.dataset.value = item.value;
        option.setAttribute('role', 'menuitemradio');
        option.onclick = () => {
          select.value = item.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          menu.hidePopover();
          document.activeElement?.blur();
          sync();
        };
        menu.append(option);
      }
      sync();
    };
    button.addEventListener('click', rebuild);
    select.addEventListener('change', sync);
    connectMenu(button, menu, () => {
      sync();
      return menu.querySelector('[aria-checked="true"]') || menu.querySelector('button[data-value]');
    });
    menu.addEventListener('keydown', event => {
      event.stopPropagation();
      const options = [...menu.querySelectorAll('button[data-value]')], index = options.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault();menu.hidePopover();button.focus();return; }
      if (event.key === 'Tab') { menu.hidePopover();button.focus();return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length]?.focus();
    });
    rebuild();
  }
}
