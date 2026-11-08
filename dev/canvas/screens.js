export const storageKey = 'tio-canvas:demo:v1';
export const screens = [
  { id: 'home', kind: 'production', title: 'Home', description: 'Demo homepage.',
    src: '/home.html', x: 160, y: 160, width: 1440, height: 900, preset: 'laptop' },
  { id: 'sample', kind: 'prototype', title: 'Sample', description: 'Demo prototype page.',
    src: '/sample.html', x: 1700, y: 160, width: 390, height: 844, preset: 'iphone-16' },
  { id: 'update-states', kind: 'prototype', title: 'Update states', description: 'Update dot placement and the Update dialog.',
    src: '/update-states.html', x: 160, y: 1160, width: 1440, height: 900, preset: 'laptop' },
];
