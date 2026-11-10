// Every icon the canvas draws, by name. One 20x20 grid, drawn with a 1.5 stroke
// that takes the colour of the text around it. Shapes marked `data-solid` are
// filled instead. Draw an icon with Icon('name'); swap one with setIcon(svg, 'name').
const shapes = {
  // Tools
  cursor: '<path d="m4 3 12 8-6 1-3 5Z"/>',
  arrow: '<path d="M4 16 16 4M6 4h10v10"/>',
  text: '<path d="M4 5.5V4h12v1.5M10 4v12M7.5 16h5"/>',
  plus: '<path d="M10 4v12M4 10h12"/>',
  undo: '<path d="m7 4-4 4 4 4M3 8h8a5 5 0 0 1 0 10"/>',
  redo: '<path d="m13 4 4 4-4 4m4-4H9a5 5 0 0 0 0 10"/>',
  'zoom-out': '<circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4M6 8.5h5"/>',
  'zoom-in': '<circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4M6 8.5h5M8.5 6v5"/>',
  bold: '<path d="M6 4h5a3 3 0 0 1 0 6H6zm0 6h6a3 3 0 0 1 0 6H6z"/>',
  italic: '<path d="M8 4h6M6 16h6M11.5 4l-3 12"/>',
  // Arrow endings
  'end-line': '<path d="M3 10h14"/>',
  'end-start': '<path d="M17 10H3m5-5-5 5 5 5"/>',
  'end-finish': '<path d="M3 10h14m-5-5 5 5-5 5"/>',
  // Actions
  close: '<path d="m5 5 10 10M15 5 5 15"/>',
  dots: '<path d="M10 4.5h.01M10 10h.01M10 15.5h.01" stroke-width="2.5"/>',
  'dots-horizontal': '<circle cx="4.5" cy="10" r="1" data-solid/><circle cx="10" cy="10" r="1" data-solid/><circle cx="15.5" cy="10" r="1" data-solid/>',
  'chevron-up': '<path d="M5 12.5l5-5 5 5"/>',
  'chevron-down': '<path d="M5 7.5l5 5 5-5"/>',
  menu: '<path d="M4 5h12M4 10h12M4 15h12"/>',
  refresh: '<path d="M16 7a6.5 6.5 0 1 0 .3 5M16 3v4h-4"/>',
  fullscreen: '<path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/>',
  duplicate: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 7V3H3v9h4"/>',
  trash: '<path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12M8 8v6M12 8v6"/>',
  theme: '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 1 0 14Z" data-solid/>',
  book: '<path d="M10 5.5C8.6 4.4 6.6 4 3.5 4v11c3.1 0 5.1.4 6.5 1.5m0-11C11.4 4.4 13.4 4 16.5 4v11c-3.1 0-5.1.4-6.5 1.5m0-11v11"/>',
  help: '<circle cx="10" cy="10" r="7"/><path d="M8.2 8a1.9 1.9 0 1 1 2.9 1.6c-.7.4-1.1.8-1.1 1.6M10 14h.01"/>',
  document: '<path d="M5.5 3h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM7.5 7h5M7.5 10h5M7.5 13h3"/>',
  download: '<path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"/>',
  grabber: '<path d="M7 5h0m6 0h0M7 10h0m6 0h0M7 15h0m6 0h0"/>',
  mouse: '<rect x="5" y="2" width="10" height="16" rx="5"/><path d="M10 2v6"/>',
  // Devices
  phone: '<rect x="6" y="2" width="8" height="16" rx="2"/><path d="M9 15h2"/>',
  tablet: '<rect x="4" y="2" width="12" height="16" rx="2"/><path d="M9 15h2"/>',
  foldable: '<rect x="4" y="2" width="12" height="16" rx="2"/><path d="M10 2v16"/>',
  laptop: '<rect x="4" y="3" width="12" height="10" rx="1"/><path d="M2 15h16l-1 2H3Z"/>',
  desktop: '<rect x="3" y="3" width="14" height="10" rx="1"/><path d="M10 13v4m-4 0h8"/>',
  custom: '<path d="M4 10V4h6M4 4l12 12m0-6v6h-6"/>',
  portrait: '<rect x="5" y="2" width="10" height="16" rx="2"/>',
};
// The small caret that marks a control which opens something.
const chevron = '<path d="m3 4.5 3 3 3-3"/>';

const SVG = 'http://www.w3.org/2000/svg';
function draw(svg, markup) { svg.innerHTML = markup; return svg; }

export function Icon(name, { className = '' } = {}) {
  if (!(name in shapes)) throw new Error(`Unknown icon "${name}"`);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `ui-icon${className ? ` ${className}` : ''}`);
  svg.dataset.icon = name;
  return draw(svg, shapes[name]);
}

export function setIcon(svg, name) {
  if (!(name in shapes)) throw new Error(`Unknown icon "${name}"`);
  svg.dataset.icon = name;
  return draw(svg, shapes[name]);
}

export function Chevron() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ui-chevron');
  return draw(svg, chevron);
}

export const iconNames = Object.keys(shapes);
