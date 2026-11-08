import { PACKAGE_NAME } from './update-check.js';
import { el, codeBlock, copyButton, commandRow } from './install-guide.js';

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
  const summary = el('p', 'update-summary');
  summary.append('Version ', el('strong', '', latest), ` is available. You have ${current}.`);

  const agent = el('section', 'install-section');
  const head = el('div', 'install-head'); head.append(el('h3', '', 'Ask an agent to do it'), copyButton('Copy prompt', updatePrompt(current, latest)));
  agent.append(head, el('p', '', 'Paste this into your coding agent while it is in the project.'), codeBlock(updatePrompt(current, latest)));

  const manual = el('section', 'install-section');
  manual.append(el('h3', '', 'Update it yourself'));
  const list = el('ol', 'install-steps');
  for (const step of manualSteps(latest)) {
    const item = el('li'); item.append(el('strong', '', step.title), el('p', '', step.text));
    if (step.command) item.append(commandRow(step.command));
    list.append(item);
  }
  manual.append(list);
  body.append(summary, agent, manual);
}

export function renderUpdateMessage(body, { title, text, action }) {
  body.replaceChildren();
  const state = el('div', 'update-state'); state.append(el('strong', '', title), el('p', '', text));
  if (action) { const button = el('button', 'install-copy', action.label); button.type = 'button'; button.onclick = action.run; state.append(button); }
  body.append(state);
}
