// The one element builder every component uses.
//   h('button', { class: 'x', dataset: { id: 1 }, hidden: true, onClick: fn }, 'text', child)
// Keys:  class, dataset, style (object), on<Event> listeners, DOM properties
// (hidden, disabled, value, id, type, popover, inert), everything else an attribute.
// false, null and undefined leave the attribute off; true writes an empty one.
const PROPERTIES = new Set(['hidden', 'disabled', 'value', 'id', 'type', 'popover', 'inert', 'draggable', 'tabIndex', 'textContent']);

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') { for (const [name, item] of Object.entries(value)) if (item !== undefined && item !== null && item !== false) node.dataset[name] = item === true ? '' : String(item); }
    else if (key === 'style') { for (const [name, item] of Object.entries(value)) name.startsWith('--') ? node.style.setProperty(name, item) : (node.style[name] = item); }
    else if (/^on[A-Z]/.test(key)) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (PROPERTIES.has(key)) node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.flat().filter(child => child !== false && child != null));
  return node;
}

/** Join class names, skipping empty ones. */
export const cx = (...names) => names.filter(Boolean).join(' ');

/** Move through a list with the arrow keys; wraps. Returns the item to focus. */
export function step(items, current, key, { forward = 'ArrowDown', back = 'ArrowUp' } = {}) {
  if (key === 'Home') return items[0];
  if (key === 'End') return items.at(-1);
  const index = items.indexOf(current);
  if (index < 0) return key === forward ? items[0] : items.at(-1);
  return items[(index + (key === forward ? 1 : -1) + items.length) % items.length];
}
