// Prototype for the canvas itself: the "update available" state of the top-left
// panel and the Update dialog. Not part of the published package.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DialRoot, useDialKit } from 'dialkit';
import 'dialkit/styles.css';
import { renderUpdate } from '../../client/update-guide.js';
import { buildShell } from '../../client/shell.js';

// The canvas's own parts, built by the same components the canvas uses: the drawer
// with the update dot, the More menu open on an available update, and the dialog.
const parts = buildShell();
const pick = id => parts.find(node => node.id === id);
document.body.prepend(pick('layers'), pick('layers-menu'), pick('update'));
pick('layers').querySelector('#layers-toggle').hidden = true;
pick('layers').querySelector('#layers-list').hidden = true;
pick('layers').querySelector('.ui-badge').hidden = false;
pick('layers-menu').popover = 'manual';
pick('layers-menu').querySelector('#version-label').textContent = 'v0.1.3';
pick('layers-menu').querySelector('#update-open').dataset.variant = 'accent';
pick('layers-menu').querySelector('#update-open').textContent = 'Update';
pick('update').setAttribute('open', '');
renderUpdate(document.querySelector('.update-body'), { current: '0.1.3', latest: '0.2.0' });
document.querySelector('#layers-menu').showPopover();

function Controls() {
  // Offsets are measured from the button's top-right corner, in pixels.
  const { x, y, theme } = useDialKit('More button dot', {
    x: [-2, -16, 16, 1],
    y: [2, -16, 16, 1],
    theme: { type: 'select', options: ['light', 'dark'], default: 'light' },
  });
  useEffect(() => {
    document.documentElement.toggleAttribute('data-dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    const dot = document.querySelector('#layers-more .ui-badge');
    dot.style.translate = `calc(50% + ${x}px) calc(-50% + ${y}px)`;
  }, [x, y]);
  return <DialRoot theme={theme} />;
}

createRoot(document.body.appendChild(document.createElement('div'))).render(<Controls />);
