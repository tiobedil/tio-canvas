// Prototype for the canvas itself: three layouts for the empty Components tab of
// Spotlight. Not part of the published package.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DialRoot, useDialKit } from 'dialkit';
import 'dialkit/styles.css';
import { h, Icon, Button, CopyButton } from '../../client/ui/index.js';
import { addComponentsPrompt } from '../../client/pages-empty.js';

const prompt = () => CopyButton('Copy prompt', addComponentsPrompt);
const code = text => h('code', {}, text);
const snippet = "export const componentDirs = ['src/ui'];";

// A. One headline, one sentence, one action. The "how" folds away.
const a = () => h('div', { class: 'center' },
  Icon('component'),
  h('strong', {}, 'No components found'),
  h('p', {}, 'Nothing in src/components or the other usual folders. Ask your coding agent to connect yours.'),
  prompt(),
  h('details', { style: { alignSelf: 'stretch', textAlign: 'left' } },
    h('summary', {}, 'Do it yourself'),
    h('p', {}, 'In ', code('dev/canvas/screens.js'), ' add your folder to ', code('componentDirs'), ', or list components one by one.')));

// B. Two clear paths as cards: the agent (primary) and by hand (with the line to paste).
const b = () => h('div', { class: 'cards' },
  h('div', {}, h('h4', {}, 'No components in this project yet'),
    h('p', {}, 'The canvas looked in src/components and a few other usual folders.')),
  h('div', { class: 'card primary' }, h('strong', {}, 'Ask your coding agent'),
    h('p', {}, 'It finds your components and adds a control for every prop.'), prompt()),
  h('div', { class: 'card' }, h('strong', {}, 'Or point the canvas at your folder'),
    h('p', {}, 'Add this to ', code('dev/canvas/screens.js'), ':'),
    h('pre', {}, snippet), CopyButton('Copy line', snippet)));

// C. Top-aligned numbered steps: reads like a short recipe, the prompt is the shortcut.
const c = () => h('div', { class: 'cards' },
  h('div', {}, h('h4', {}, 'No components in this project yet'),
    h('p', {}, 'Pick one way to bring them in:')),
  h('ol', {},
    h('li', {}, h('span', {}, 'Keep them in ', code('src/components'), ' (or another usual folder). The canvas finds them by itself.')),
    h('li', {}, h('span', {}, 'Or add your folder to ', code('componentDirs'), ' in ', code('dev/canvas/screens.js'), '.')),
    h('li', {}, h('span', {}, 'Or let your coding agent do it.')),
  ),
  h('div', { class: 'row' }, prompt()));

// D. C, left aligned and centered vertically in the empty area.
const d = () => c();

const variants = [['A. Centered, folded', a], ['B. Two paths', b], ['C. Steps', c], ['D. Steps, left, centered vertically', d]];
for (const [name, build] of variants) {
  const fig = document.createElement('figure');
  const root = h('div', { class: 'ui-spotlight' },
    h('div', { class: 'ui-spotlight-search' }, Icon('search'), h('input', { class: 'ui-input', placeholder: 'Search', disabled: true })),
    h('div', { class: 'ui-spotlight-tabs' }, h('button', { class: 'ui-spotlight-tab', 'aria-selected': 'false' }, 'Pages'), h('button', { class: 'ui-spotlight-tab', 'aria-selected': 'true' }, 'Components')),
    h('div', { class: `ui-spotlight-empty${name[0] === 'A' ? '' : name[0] === 'D' ? ' alt mid' : ' alt'}`, role: 'status' }, build()));
  fig.append(root, Object.assign(document.createElement('figcaption'), { textContent: name }));
  document.body.append(fig);
}

function Controls() {
  const { theme } = useDialKit('Empty components', { theme: { type: 'select', options: ['light', 'dark'], default: 'light' } });
  useEffect(() => { document.documentElement.toggleAttribute('data-dark', theme === 'dark'); }, [theme]);
  return <DialRoot theme={theme} />;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Controls />);
