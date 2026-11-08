// Which keyboard the shortcut labels are written for. It follows the visitor's
// system until they choose, and the choice is remembered on this device.
const KEY = 'tio-canvas:shortcut-platform';
const detected = () => /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform || navigator.platform || '') ? 'mac' : 'win';
let current;
try { current = localStorage.getItem(KEY); } catch { /* storage blocked: the system's keyboard is used */ }
if (current !== 'mac' && current !== 'win') current = detected();

export const platform = () => current;
export function setPlatform(value) {
  if (value !== 'mac' && value !== 'win') return;
  try { localStorage.setItem(KEY, value); } catch { /* not remembered */ }
  if (value === current) return;
  current = value;
  window.dispatchEvent(new CustomEvent('tio-canvas:platform'));
}
