import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { InterfaceKit } from 'interface-kit/react';
import { claimCorner } from '../client/corners.js';

const mount = document.createElement('div');
mount.dataset.interfaceKit = '';
document.body.append(mount);
window.__interfaceKitCorner = {
  claim(right, bottom) {
    const corner = claimCorner(mount, `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}`);
    return { right: corner.endsWith('right'), bottom: corner.startsWith('bottom') };
  },
  clear() { delete mount.dataset.floatingCorner; },
};
createRoot(mount).render(createElement(InterfaceKit, { enabled: true }));
