// Content of the "Install in a project" dialog: manual steps plus a prompt
// the person can copy and hand to a coding agent.
export const el = (tag, className = '', text = '') => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };

const template = name => new URL(`./templates/${name}`, import.meta.url).href;

// Written for someone who has never used a terminal. Each step says what to do,
// where, and what they should see. `command` gets a copy button, `download` a
// download button for a ready-made file.
const steps = [
  { title: 'Check that this fits your project', text: 'These steps are for a website made of plain files (index.html, about.html, and so on) in one folder. If your project is built with a tool like Next.js, Vite or WordPress, use "Ask an agent to do it" above instead.' },
  { title: 'Install Node.js', text: 'Node.js is a free program that runs the canvas on your computer. Download the version marked LTS from nodejs.org and install it like any other app. You need version 22 or newer.' },
  { title: 'Open the Terminal in your project folder', text: 'The Terminal is a window where you type commands. On a Mac: right-click your project folder in Finder and choose "New Terminal at Folder". On Windows: open the folder, click the address bar at the top, type cmd, and press Enter. A window with a blinking cursor opens.' },
  { title: 'Check Node.js works', text: 'Type this and press Enter. You should see a number like v22.12.0. If you see "not found", close the Terminal, reopen it, and try again.', command: 'node -v' },
  { title: 'Install the canvas', text: 'Type these two commands, one at a time, pressing Enter after each. The first creates a package.json file, which is a small list of what your project uses. The second adds the canvas. Wait until the cursor comes back.', commands: ['npm init -y', 'npm install --save-dev @tio-canvas/canvas'] },
  { title: 'Download two files into your project folder', text: 'Download both and move them into the same folder as your index.html. canvas-server.mjs starts your site with the canvas. canvas-screens.mjs lists the pages the canvas shows.', downloads: [['canvas-server.mjs', 'Download canvas-server.mjs'], ['canvas-screens.mjs', 'Download canvas-screens.mjs']] },
  { title: 'Tell the canvas which pages to show', text: 'Open canvas-screens.mjs in a text editor (Notepad on Windows, or a free editor such as Visual Studio Code; not Word). Each block between { and } is one page. Change src to the address of your page, for example /about.html. Copy a whole block to add another page. The notes at the top of the file explain every field. Save the file.' },
  { title: 'Start it', text: 'Back in the Terminal, type this and press Enter. Leave the window open: closing it stops the canvas.', command: 'node canvas-server.mjs' },
  { title: 'Open the canvas', text: 'In your browser, go to this address. Your pages appear on the canvas. To stop it later, click the Terminal and press Ctrl+C. To start it again, run the command from the previous step.', command: 'http://localhost:4400/canvas/' },
  { title: 'If something goes wrong', text: 'A page shows "Not found": its src in canvas-screens.mjs does not match a real file name. Nothing happens when you start it, or you see a red error: read the last line, it names the file and the problem. Still stuck: use "Ask an agent to do it" above.' },
];

export const agentPrompt = `Install the @tio-canvas/canvas package in this project as a development tool.

1. Add it as a dev dependency with this project's package manager: @tio-canvas/canvas.
2. Read node_modules/@tio-canvas/canvas/docs/integration.md and follow its "Use it in a project" section.
3. Create dev/canvas/screens.js listing the real pages of this project (id, kind, title, description, src, x, y, width, height, preset). Give storageKey a name unique to this project. The file must not import anything.
4. Wire the dev server: serve the package client at /canvas with createCanvasHost from "@tio-canvas/canvas/server" (locate, projectModule, pageScripts, interfaceKitBundle, watchTargets). Do this for development only.
5. Do not link /canvas from any public page, and do not publish it unless I ask.
6. Start the dev server, open /canvas, and confirm every screen loads. Tell me the URL and anything you could not verify.`;

export function codeBlock(code) {
  const pre = el('pre', 'install-code'); pre.append(el('code', '', code)); return pre;
}

export function copyButton(label, text) {
  const button = el('button', 'install-copy', label); button.type = 'button';
  button.onclick = async () => {
    try { await navigator.clipboard.writeText(text); button.textContent = 'Copied'; } catch { button.textContent = 'Copy failed'; }
    setTimeout(() => { button.textContent = label; }, 1600);
  };
  return button;
}

export function commandRow(command) {
  const row = el('div', 'install-command'); row.append(el('code', '', command), copyButton('Copy', command)); return row;
}

export function renderInstallGuide(body) {
  body.replaceChildren();
  const manual = el('section', 'install-section');
  manual.append(el('h3', '', 'Install it yourself'));
  const list = el('ol', 'install-steps');
  for (const step of steps) {
    const item = el('li'); item.append(el('strong', '', step.title), el('p', '', step.text));
    for (const command of step.commands ?? (step.command ? [step.command] : [])) item.append(commandRow(command));
    if (step.downloads) {
      const row = el('div', 'install-downloads');
      for (const [name, label] of step.downloads) {
        const link = el('a', 'install-copy', label); link.href = template(name); link.download = name; row.append(link);
      }
      item.append(row);
    }
    list.append(item);
  }
  manual.append(list);

  const agent = el('section', 'install-section');
  const head = el('div', 'install-head'); head.append(el('h3', '', 'Ask an agent to do it'));
  head.append(copyButton('Copy prompt', agentPrompt));
  agent.append(head, el('p', '', 'Paste this into your coding agent while it is in the project.'), codeBlock(agentPrompt));
  body.append(agent, manual);
}
