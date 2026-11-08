// Text objects: sizes, the markup a text may hold, and reading saved texts.
// Markup is data from storage and from pasted content, so it is rebuilt from a
// small allow-list instead of being trusted.
export const TEXT_SIZES = { sm: 16, md: 24, lg: 40, xl: 64 };
export const TEXT_LINE_HEIGHT = 1.25;
export const TEXT_MAX_HTML = 20000;
export const TEXT_DEFAULT_WIDTH = 240;

const TAGS = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', BR: 'br', DIV: 'div', P: 'div' };
const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED']);

export function sanitizeHtml(html) {
  const source = new DOMParser().parseFromString(`<body>${String(html ?? '').slice(0, TEXT_MAX_HTML)}</body>`, 'text/html').body;
  const target = document.createElement('div');
  const walk = (from, to, depth) => {
    for (const node of from.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) { to.append(node.data); continue; }
      if (node.nodeType !== Node.ELEMENT_NODE || SKIPPED.has(node.tagName)) continue;
      const tag = TAGS[node.tagName];
      if (!tag || depth > 24) { walk(node, to, depth + 1); continue; }
      if (tag === 'br') { to.append(document.createElement('br')); continue; }
      const element = document.createElement(tag);
      walk(node, element, depth + 1); to.append(element);
    }
  };
  walk(source, target, 0);
  return target.innerHTML;
}

export const escapeHtml = value => String(value).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
export const plainToHtml = value => escapeHtml(String(value).replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>');

export function readTexts(value) {
  if (!Array.isArray(value)) return [];
  const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  const ids = new Set();
  return value.slice(0, 500).filter(t => {
    if (!t || typeof t.id !== 'string' || t.id.length > 100 || ids.has(t.id) || typeof t.html !== 'string'
      || !finite(t.x, -40000, 40000) || !finite(t.y, -40000, 40000) || !finite(t.width, 8, 8000)
      || !Object.hasOwn(TEXT_SIZES, t.size) || !(t.fit === true || finite(t.height, 8, 20000))) return false;
    ids.add(t.id); return true;
  }).map(t => ({ id: t.id, x: t.x, y: t.y, width: t.width, height: t.fit === true ? 0 : t.height, fit: t.fit === true, fitWidth: t.fitWidth === true, size: t.size, html: sanitizeHtml(t.html) }));
}

// A pull past a limit moves a fraction of the distance, with less and less
// give: the iOS scroll curve, c = .55.
export function rubberBand(distance, dimension = 48, c = .55) {
  return Math.sign(distance) * (1 - 1 / (Math.abs(distance) * c / dimension + 1)) * dimension;
}
