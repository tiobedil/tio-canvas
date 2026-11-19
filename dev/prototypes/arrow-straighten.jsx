// Prototype for the canvas itself: "Reset to straight" on a curved arrow springs
// back like a plucked string, overshooting past straight before it settles.
// Not part of the published package. Opens in the canvas as the "Arrow straighten" screen.
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { animate } from 'motion';
import { DialRoot, useDialKit } from 'dialkit';
import 'dialkit/styles.css';
import { arrowGeometry } from '../../client/arrow-geometry.js';

// One arrow in world units, drawn the way client/arrows.js draws it.
const arrow = { start: { x: 160, y: 300 }, end: { x: 760, y: 300 }, bend: 0 };
const ns = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => { const node = document.createElementNS(ns, name); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); return node; };

const svg = el('svg', { width: 920, height: 600, viewBox: '0 0 920 600', style: 'overflow:visible;touch-action:none' });
const defs = el('defs'), marker = el('marker', { id: 'head', orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse', overflow: 'visible', refX: 0, refY: 0, markerWidth: 40, markerHeight: 40 });
const head = el('path', { fill: 'none', stroke: 'context-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
marker.append(head); defs.append(marker);
const line = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'marker-end': 'url(#head)' });
const knob = el('circle', { r: 7, fill: 'var(--canvas-panel)', stroke: 'var(--canvas-accent)', 'stroke-width': 2, style: 'cursor:ns-resize' });
const hint = el('text', { x: 460, y: 560, 'text-anchor': 'middle', fill: 'currentColor', opacity: .5 }); hint.textContent = 'Drag the dot to bend, then press Reset to straight (or R)';
svg.append(defs, line, knob, hint); document.body.append(svg);

let width = 4;
function paint() {
  const g = arrowGeometry(arrow, []);
  line.setAttribute('d', g.path); line.setAttribute('stroke-width', width);
  const length = 6 + width * 2; head.setAttribute('d', `M ${-length} ${-length / 2} L 0 0 L ${-length} ${length / 2}`); head.setAttribute('stroke-width', width);
  knob.setAttribute('cx', g.middle.x); knob.setAttribute('cy', g.middle.y);
}

let motion = null;
knob.addEventListener('pointerdown', event => {
  motion?.stop(); knob.setPointerCapture(event.pointerId);
  const move = e => { const box = svg.getBoundingClientRect(); arrow.bend = (e.clientY - box.top) * (600 / box.height) - arrow.start.y; paint(); };
  knob.addEventListener('pointermove', move);
  knob.addEventListener('pointerup', () => knob.removeEventListener('pointermove', move), { once: true });
});

function Controls() {
  const settings = useRef();
  const values = useDialKit('Reset to straight', {
    spring: { type: 'spring', visualDuration: .2, bounce: .6 },
    scaleWithBend: true,
    startBend: [300, -300, 300, 1],
    width: [4, 2, 10, 2],
    theme: { type: 'select', options: ['light', 'dark'], default: 'light' },
    reset: { type: 'action', label: 'Reset to straight' },
    bendAgain: { type: 'action', label: 'Bend again' },
  }, { onAction: action => (action === 'reset' ? straighten : bend)() });
  settings.current = values;
  // Bigger bends ring a little longer when scaleWithBend is on, like a harder pluck.
  function straighten() {
    const { spring, scaleWithBend } = settings.current;
    const transition = { ...spring };
    if (scaleWithBend && transition.visualDuration) transition.visualDuration *= .8 + Math.min(Math.abs(arrow.bend) / 300, 1) * .4;
    motion?.stop();
    motion = animate(arrow.bend, 0, { ...transition, onUpdate: v => { arrow.bend = v; paint(); } });
  }
  function bend() { motion?.stop(); arrow.bend = settings.current.startBend; paint(); }
  useEffect(() => { width = values.width; paint(); }, [values.width]);
  useEffect(() => { arrow.bend = values.startBend; paint(); }, [values.startBend]);
  useEffect(() => { document.documentElement.toggleAttribute('data-dark', values.theme === 'dark'); }, [values.theme]);
  useEffect(() => {
    const key = e => { if (e.key === 'r') straighten(); if (e.key === 'b') bend(); };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, []);
  return <DialRoot theme={values.theme} />;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Controls />);
