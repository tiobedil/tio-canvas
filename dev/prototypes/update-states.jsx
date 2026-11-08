// Prototype for the canvas itself: the "update available" state of the top-left
// panel and the Update dialog. Not part of the published package.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DialRoot, useDialKit } from 'dialkit';
import 'dialkit/styles.css';
import { renderUpdate } from '../../client/update-guide.js';

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
    const dot = document.querySelector('#layers-more .update-dot');
    dot.style.translate = `calc(50% + ${x}px) calc(-50% + ${y}px)`;
  }, [x, y]);
  return <DialRoot theme={theme} />;
}

createRoot(document.body.appendChild(document.createElement('div'))).render(<Controls />);
