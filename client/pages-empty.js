import { h, CopyButton } from './ui/index.js';

// What Add pages shows when the project lists no pages: how to add them, and a
// prompt for a coding agent that adds them or finds out why they do not show.
export const addPagesPrompt = `This project uses the @tio-canvas/canvas package, and the canvas shows no pages. Help me add them, or find out why they do not show.

1. Open dev/canvas/screens.js (or the file the dev server passes as "config" to createCanvasHost). It must stay a standalone ES module that imports nothing.
2. If I already have pages that do not show up, find the cause before adding anything. Check that this is the file the dev server loads, that it has no syntax error or import, that every entry has a "kind" of "production" or "prototype", that every "id" is unique, that every "src" opens in the browser, and that the dev server was restarted. Tell me what was wrong.
3. Otherwise add one entry to "screens" for each real page of this project: id (stable and unique), kind, title, src (for example /about.html), x, y, width, height and preset. The format is in node_modules/@tio-canvas/canvas/docs/integration.md, section "Use it in a project".
4. Reload /canvas, press Cmd+K and confirm every page is listed. Tell me what you changed.`;

export function emptyPages() {
  return h('div', {},
    h('strong', {}, 'No pages in this project yet'),
    h('p', {}, 'Add them in dev/canvas/screens.js, or ask your coding agent to. If you already added pages and they do not show, the same prompt finds out why.'),
    CopyButton('Copy prompt', addPagesPrompt));
}

// The same for the Components tab: a project lists its components in the same file.
export const addComponentsPrompt = `This project uses the @tio-canvas/canvas package. Its canvas can show single components, each in a frame with a control for every prop, but the Components tab is empty. Help me add my components, or find out why they do not show.

1. Read node_modules/@tio-canvas/canvas/docs/integration.md, section "Components", first. It has the format and the rules.
2. Open dev/canvas/screens.js (or the file the dev server passes as "config" to createCanvasHost). It must stay a standalone ES module that imports nothing. Components go in "export const components = [...]".
3. If I already listed components that do not show up, find the cause before adding anything. Check that the dev server answers /canvas/components/<id>.js with canvas.componentModule(id), that every "id" is unique and uses lowercase letters, digits and dashes, that every "module" path is right, and that the dev server was restarted. Tell me what was wrong.
4. Otherwise add one entry for each reusable component of this project (not for whole pages). Read each component's source and give it a control for every prop, variant and state it really has: a list of options for a variant, true or false for a state, a string for text. Do not invent props.
5. Reload /canvas, press Cmd+K, open the Components tab and add one component. Confirm it draws and that its controls change it. Tell me what you changed.`;

export function emptyComponents() {
  return h('div', {},
    h('strong', {}, 'No components in this project yet'),
    h('p', {}, 'List them in dev/canvas/screens.js, or ask your coding agent to. Each one gets a frame with a control for every prop.'),
    CopyButton('Copy prompt', addComponentsPrompt));
}
