// Prototype for the canvas itself: the top-left Layers bar sizes to its content
// when there is nothing to list or it is collapsed, and its right edge drags to
// resize when expanded, rubber-banding past the min and max width. The spring
// back uses the shared bounce token (client/bounce.js), the same one the arrow
// "Reset to straight" uses. Not part of the published package.
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { DialRoot, useDialKit } from 'dialkit';
import 'dialkit/styles.css';
import { h, Panel, Header, Button, Icon } from '../../client/ui/index.js';
import { rubberBand } from '../../client/text-format.js';
import { BOUNCE, spring } from '../../client/bounce.js';
import { arrowGeometry } from '../../client/arrow-geometry.js';

const state = { min: 200, frames: 3, collapsed: false, width: 200, max: 420, pull: 48 };

const toggle = Button({ id: 'layers-toggle', icon: 'chevron-up', label: 'Minimize Layers' });
const list = h('ol', { id: 'layers-list' });
const grip = h('div', { class: 'layers-grip', 'aria-hidden': 'true' });
const drawer = Panel({ as: 'aside', id: 'layers', className: 'layers-drawer', 'aria-label': 'Screens' },
  Header({ title: [h('span', { class: 'layers-logo', role: 'img', 'aria-label': 'Tio' })], titleId: 'layers-title' },
    Button({ id: 'layers-more', icon: 'dots', iconOnly: true, label: 'More' }), toggle),
  list, grip);
document.body.append(drawer);

let stopSpring = null;
const empty = () => !state.frames;
const open = () => !empty() && !state.collapsed;
function paint() {
  drawer.toggleAttribute('data-empty', empty());
  drawer.toggleAttribute('data-collapsed', state.collapsed);
  list.hidden = !open(); grip.hidden = !open();
  drawer.style.width = open() ? `${state.width}px` : '';
  toggle.querySelector('svg')?.replaceWith(Icon(state.collapsed ? 'chevron-down' : 'chevron-up'));
  list.replaceChildren(...Array.from({ length: state.frames }, (_, i) =>
    h('li', {}, h('div', { class: 'ui-row layer-row' }, Icon('laptop'), h('span', {}, `Screen ${state.frames - i}`)))));
}

// Width and height move together on collapse and on frames appearing or going.
function morph(change) {
  const from = drawer.getBoundingClientRect(); change();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const to = drawer.getBoundingClientRect();
  if (from.width === to.width && from.height === to.height) return;
  list.hidden = false;
  const m = drawer.animate([{ width: `${from.width}px`, height: `${from.height}px` }, { width: `${to.width}px`, height: `${to.height}px` }], { duration: 160, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  m.onfinish = m.oncancel = () => { list.hidden = !open(); };
}
toggle.addEventListener('click', () => morph(() => { state.collapsed = !state.collapsed; paint(); }));

// Past a limit the edge gives less and less (the text box curve); on release it
// springs back to the limit with the shared bounce.
grip.addEventListener('pointerdown', event => {
  stopSpring?.(); grip.setPointerCapture(event.pointerId); document.body.dataset.resizing = '';
  const startX = event.clientX, startW = state.width;
  const move = e => {
    const raw = startW + e.clientX - startX;
    const w = raw > state.max ? state.max + rubberBand(raw - state.max, state.pull)
      : raw < state.min ? state.min - rubberBand(state.min - raw, state.pull) : raw;
    state.width = w; drawer.style.width = `${w}px`;
  };
  const up = () => {
    grip.removeEventListener('pointermove', move); delete document.body.dataset.resizing;
    const target = Math.min(state.max, Math.max(state.min, state.width));
    if (target !== state.width) stopSpring = spring(state.width, target, v => { state.width = v; drawer.style.width = `${v}px`; }, BOUNCE);
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up, { once: true });
});

// The arrow demo uses the same token, to show one change moves every bounce.
const ns = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 600 200'); svg.setAttribute('class', 'demo-arrow');
const path = document.createElementNS(ns, 'path'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', 4); path.setAttribute('stroke-linecap', 'round');
svg.append(path); document.body.append(svg);
const arrow = { start: { x: 40, y: 100 }, end: { x: 560, y: 100 }, bend: 80 };
const drawArrow = () => path.setAttribute('d', arrowGeometry(arrow, []).path);
let stopArrow = null;
function pluck() { stopArrow?.(); arrow.bend = 80; drawArrow(); stopArrow = spring(80, 0, v => { arrow.bend = v; drawArrow(); }, BOUNCE); }

function Controls() {
  const v = useDialKit('Layers bar', {
    // Empty: no frames on the canvas. Collapsed and expanded: three frames.
    state: { type: 'select', options: ['empty', 'collapsed', 'expanded'], default: 'expanded' },
    // Space between the logo and the first button, when the bar fits its content.
    emptyGap: [18, 0, 64, 1],
    collapsedGap: [18, 0, 64, 1],
    minWidth: [200, 160, 400, 10],
    maxWidth: [420, 280, 640, 10],
    farthestPull: [48, 8, 160, 1],
    bounce: { type: 'spring', visualDuration: BOUNCE.visualDuration, bounce: BOUNCE.bounce },
    theme: { type: 'select', options: ['light', 'dark'], default: 'light' },
    pluckArrow: { type: 'action', label: 'Spring the arrow' },
  }, { onAction: pluck });
  const first = useRef(true);
  useEffect(() => {
    // Editing the token edits it for every bounce at once.
    Object.assign(BOUNCE, { visualDuration: v.bounce.visualDuration ?? BOUNCE.visualDuration, bounce: v.bounce.bounce ?? BOUNCE.bounce });
  }, [v.bounce]);
  useEffect(() => {
    state.min = v.minWidth; state.max = Math.max(v.maxWidth, v.minWidth); state.pull = v.farthestPull;
    state.width = Math.min(state.max, Math.max(state.min, state.width));
    const change = () => { state.frames = v.state === 'empty' ? 0 : 3; state.collapsed = v.state === 'collapsed'; paint(); };
    if (first.current) { first.current = false; change(); drawArrow(); } else morph(change);
  }, [v.state, v.minWidth, v.maxWidth, v.farthestPull]);
  useEffect(() => {
    drawer.style.setProperty('--empty-gap', `${v.emptyGap}px`);
    drawer.style.setProperty('--collapsed-gap', `${v.collapsedGap}px`);
  }, [v.emptyGap, v.collapsedGap]);
  useEffect(() => { document.documentElement.toggleAttribute('data-dark', v.theme === 'dark'); }, [v.theme]);
  return <DialRoot theme={v.theme} />;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Controls />);
