import { PACKAGE_NAME } from './update-check.js';
import { h, Button, Section, Callout, CodeBlock, CommandRow, CopyButton } from './ui/index.js';

export const updatePrompt = (current, latest) => `Update the ${PACKAGE_NAME} package in this project from ${current} to ${latest}.

1. Use this project's package manager (npm, pnpm or yarn) to install ${PACKAGE_NAME}@${latest}. Keep it a dev dependency.
2. After it is installed, read node_modules/${PACKAGE_NAME}/client/changelog.js for the entries between ${current} and ${latest}. If a release needs a change in this project (for example in the canvas screens file or the dev server), make it. If nothing needs changing, leave the project's files alone.
3. Restart the dev server, open /canvas, and confirm every screen still loads.
4. Tell me the version now installed, what changed in the release, and anything you could not verify.`;

const manualSteps = latest => [
  { title: 'Stop the canvas', text: 'Click the Terminal window where the canvas is running and press Ctrl+C. If you closed that window, skip this step.' },
  { title: 'Open the Terminal in your project folder', text: 'The Terminal is a window where you type commands. On a Mac: right-click your project folder in Finder and choose "New Terminal at Folder". On Windows: open the folder, click the address bar at the top, type cmd, and press Enter.' },
  { title: 'Install the new version', text: 'Type this and press Enter. Wait until the cursor comes back. If you set the project up with pnpm or yarn instead of npm, ask an agent with the prompt above.', command: `npm install --save-dev ${PACKAGE_NAME}@${latest}` },
  { title: 'Start the canvas again', text: 'Type this and press Enter. Leave the window open.', command: 'node canvas-server.mjs' },
  { title: 'Reload the canvas', text: 'In your browser, reload the canvas page. Open More, and the version at the bottom should now be the new one.' },
];

export function renderUpdate(body, { current, latest }) {
  body.replaceChildren();
  const list = h('ol', { class: 'install-steps' });
  for (const step of manualSteps(latest)) {
    const item = h('li', {}, h('strong', {}, step.title), h('p', {}, step.text));
    if (step.command) item.append(CommandRow(step.command));
    list.append(item);
  }
  body.append(
    Callout({ className: 'update-summary' }, 'Version ', h('strong', {}, latest), ` is available. You have ${current}.`),
    Section({ className: 'install-section' },
      h('div', { class: 'install-head' }, h('h3', {}, 'Ask an agent to do it'), CopyButton('Copy prompt', updatePrompt(current, latest))),
      h('p', {}, 'Paste this into your coding agent while it is in the project.'), CodeBlock(updatePrompt(current, latest))),
    Section({ title: 'Update it yourself', className: 'install-section' }, list));
}

export function renderUpdateMessage(body, { title, text, action }) {
  body.replaceChildren(h('div', { class: 'update-state' }, h('strong', {}, title), h('p', {}, text),
    action ? Button({ size: 'sm', onClick: action.run }, action.label) : null));
}
