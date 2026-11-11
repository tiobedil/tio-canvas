export const screens = [];
export const componentDirs = ['src/widgets'];
export const components = [
  // Listed by hand: the scan must leave it alone, and check it against the source.
  { id: 'badge', title: 'Badge', module: '../../src/components/Badge.tsx', export: 'Badge', controls: { tone: ['info', 'warn'], gone: false } },
  { id: 'gone', title: 'Gone', module: '../../src/components/Gone.tsx', controls: {} },
  { id: 'nothing', title: 'Nothing', module: '../../src/components/Nothing.tsx', export: 'Nothing', controls: {} },
  { id: 'rendered', title: 'Rendered', module: '../../src/components/Badge.tsx', render: () => null, controls: { anything: 1 } },
];
