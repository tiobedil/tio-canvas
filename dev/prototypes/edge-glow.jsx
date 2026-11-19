// Prototype for the canvas itself: while the Layers panel is resized, its right
// outline glows: transparent at the top, a very smooth blend into the colour
// around the middle, and back to transparent at the bottom.
// Not part of the published package.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DialRoot, useDialKit } from 'dialkit';
import 'dialkit/styles.css';
import { h, Panel, Header, Button, Icon } from '../../client/ui/index.js';
import { rubberBand } from '../../client/text-format.js';
import { BOUNCE, spring } from '../../client/bounce.js';

const MIN = 200, MAX = 420, PULL = 48;
const list = h('ol', { id: 'layers-list' });
const fillList = count => list.replaceChildren(...Array.from({ length: count }, (_, i) =>
  h('li', {}, h('div', { class: 'ui-row layer-row' }, Icon('laptop'), h('span', {}, `Screen ${count - i}`)))));
fillList(6);
const drawer = Panel({ as: 'aside', id: 'layers', className: 'layers-drawer', 'aria-label': 'Screens' },
  Header({ title: [h('span', { class: 'layers-logo', role: 'img', 'aria-label': 'Tio' })], titleId: 'layers-title' },
    Button({ id: 'layers-more', icon: 'dots', iconOnly: true, label: 'More' }),
    Button({ id: 'layers-toggle', icon: 'chevron-up', label: 'Minimize Layers' })),
  list, h('div', { class: 'layers-grip', 'aria-hidden': 'true' }));
// The outline is a box-shadow just outside the clipped panel, so the glow is its
// own line laid over the right outline. It covers only the straight part, between
// the rounded corners, so it never sticks out above or below the panel.
const glow = h('div', { class: 'edge-glow', 'aria-hidden': 'true' });
document.body.append(drawer, glow);
const grip = drawer.querySelector('.layers-grip');
document.body.append(grip); // straddles the edge, as in client/layers.js
const placeGrip = () => { const r = drawer.getBoundingClientRect(); Object.assign(grip.style, { left: `${r.right}px`, top: `${r.top}px`, height: `${r.height}px` }); };
new ResizeObserver(placeGrip).observe(drawer);

const settings = { center: 50, spread: 40, hold: 0, steps: 16, width: 1, fadeIn: 120, fadeOut: 240, alwaysShow: false, color: 'accent' };
// The glow colour: the magenta accent, or the dark neutral of the canvas text.
const COLORS = { accent: 'var(--canvas-accent)', 'neutral dark': 'var(--canvas-text)' };
const ease = t => t * t * (3 - 2 * t); // smoothstep: no visible band where the colours meet
// Transparent → colour → transparent (the outline shows through at the ends), with eased stops so the blend has no edge.
function gradient({ center, spread, hold, steps }) {
  const stops = [], half = hold / 2;
  const at = (p, mix) => stops.push(`color-mix(in oklch, ${COLORS[settings.color]} ${(mix * 100).toFixed(1)}%, transparent) ${p.toFixed(2)}%`);
  at(0, 0);
  for (let i = 0; i <= steps; i++) { const t = i / steps; at(center - half - spread * (1 - t), ease(t)); }
  for (let i = 0; i <= steps; i++) { const t = i / steps; at(center + half + spread * t, ease(1 - t)); }
  at(100, 0);
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}
function place() {
  const r = drawer.getBoundingClientRect(), w = settings.width;
  const radius = parseFloat(getComputedStyle(drawer).borderTopRightRadius) || 0;
  Object.assign(glow.style, { left: `${r.right}px`, top: `${r.top + radius}px`, height: `${Math.max(0, r.height - 2 * radius)}px`, width: `${w}px`, background: gradient(settings) });
}
function show(on) {
  glow.style.transition = `opacity ${on ? settings.fadeIn : settings.fadeOut}ms ease-out`;
  glow.style.opacity = on || settings.alwaysShow ? 1 : 0;
}

let stop = null, resizing = false;
const setWidth = w => { drawer.style.width = `${w}px`; place(); placeGrip(); };
grip.addEventListener('pointerdown', event => {
  stop?.(); grip.setPointerCapture(event.pointerId); document.body.dataset.layersResize = ''; resizing = true; place(); show(true);
  const startX = event.clientX, startW = drawer.getBoundingClientRect().width; let w = startW;
  const move = e => { const raw = startW + e.clientX - startX; w = raw > MAX ? MAX + rubberBand(raw - MAX, PULL) : raw < MIN ? MIN - rubberBand(MIN - raw, PULL) : raw; setWidth(w); };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('lostpointercapture', () => {
    grip.removeEventListener('pointermove', move); delete document.body.dataset.layersResize; resizing = false;
    const target = Math.min(MAX, Math.max(MIN, w));
    if (target !== w) stop = spring(w, target, setWidth, BOUNCE);
    show(false);
  }, { once: true });
});

function Controls() {
  const v = useDialKit('Resize edge glow', {
    layers: [6, 1, 20, 1],
    color: { type: 'select', options: ['accent', 'neutral dark'], default: 'accent' },
    center: [50, 0, 100, 1],
    spread: [40, 2, 50, 1],
    hold: [0, 0, 60, 1],
    steps: [16, 2, 32, 1],
    width: [1, .5, 4, .5],
    fadeIn: [120, 0, 600, 10],
    fadeOut: [240, 0, 1000, 10],
    // On: the glow stays visible to tune it. Off: it shows only while resizing, as in the real panel.
    alwaysShow: false,
    theme: { type: 'select', options: ['light', 'dark'], default: 'light' },
  });
  useEffect(() => { Object.assign(settings, v); place(); show(resizing); },
    [v.center, v.spread, v.hold, v.steps, v.width, v.fadeIn, v.fadeOut, v.alwaysShow, v.color]);
  // A taller panel shows how the glow stretches with the edge.
  useEffect(() => { fillList(v.layers); place(); }, [v.layers]);
  useEffect(() => { document.documentElement.toggleAttribute('data-dark', v.theme === 'dark'); }, [v.theme]);
  return <DialRoot theme={v.theme} />;
}
setWidth(260);
createRoot(document.body.appendChild(document.createElement('div'))).render(<Controls />);
