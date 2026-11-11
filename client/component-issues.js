import { h, Section, CodeBlock, CopyButton } from './ui/index.js';

// What the canvas found in the project's components that it could not settle by
// itself (the scan runs in the development server: src/component-scan.js). Every
// issue is certain, and every issue goes away once the config matches the source.
// One banner and one prompt cover all of them, however many there are.

const quoted = names => names.map(name => `"${name}"`).reduce((text, name, index) => (index === 0 ? name : index === names.length - 1 ? `${text} and ${name}` : `${text}, ${name}`), '');
const hint = item => item.options ? `${item.name} (one of ${item.options.map(option => JSON.stringify(option)).join(', ')})` : `${item.name} (${item.type})`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/** One line, in plain words, for the list in the dialog. */
export function describeIssue(issue) {
  switch (issue.kind) {
    case 'missing-file': return `${issue.title}: the file ${issue.module} is gone.`;
    case 'missing-export': return `${issue.title}: ${issue.module} no longer exports "${issue.export}".`;
    case 'controls-out-of-date': {
      const parts = [];
      if (issue.missing.length) parts.push(`has no control for ${quoted(issue.missing.map(item => item.name))}`);
      if (issue.extra.length) parts.push(`has controls for ${quoted(issue.extra)}, which the component no longer takes`);
      return `${issue.title}: ${parts.join(', and ')}.`;
    }
    case 'unlisted': return `${issue.file} has functions that may be components, but the canvas cannot tell what they return.`;
    case 'no-typescript': return `TypeScript is not installed in this project, so ${plural(issue.count, 'component has', 'components have')} no controls.`;
    default: return 'Something about the components needs a look.';
  }
}

/** The line that tells an agent what to do about one issue. */
function instruction(issue) {
  switch (issue.kind) {
    case 'missing-file': return `"${issue.id}" lists ${issue.module}, which does not exist. If the file moved or was renamed, update "module". If the component was deleted, remove its entry.`;
    case 'missing-export': return `"${issue.id}" lists "export: ${issue.export}" from ${issue.module}, which that file no longer exports. Update "export" to the new name, or remove the entry if the component is gone.`;
    case 'controls-out-of-date': {
      const lines = [`"${issue.id}" (${issue.module}) has controls that do not match the component's props.`];
      if (issue.missing.length) lines.push(`   - Add a control for: ${issue.missing.map(hint).join('; ')}. If a prop is left out on purpose, list its name in "ignore: [...]" on the entry instead.`);
      if (issue.extra.length) lines.push(`   - Remove the controls for ${quoted(issue.extra)}, or rename them to the prop they now are.`);
      return lines.join('\n');
    }
    case 'unlisted': return `${issue.file}: read it. If it exports a component, list it in "components" (id, title, module, export, controls). If it does not, add the file to "componentExclude" so the canvas stops asking.`;
    case 'no-typescript': return `Install TypeScript as a dev dependency with this project's package manager, so the canvas can read each component's props and add the controls itself.`;
    default: return 'Look into it.';
  }
}

/** The banner text in Add pages. */
export const issuesBanner = issues => `${plural(issues.length, 'thing to check', 'things to check')} in your components.`;

/** A prompt an agent can run, covering every issue so that none is left behind. */
export function componentIssuesPrompt(issues) {
  const list = issues.map((issue, index) => `${index + 1}. ${instruction(issue)}`).join('\n');
  return `This project uses the @tio-canvas/canvas package. Its canvas finds the project's components and reads their props by itself, and it has found ${plural(issues.length, 'thing', 'things')} that it cannot settle without you. Fix all of them so that the "to check" notice in the canvas's Add pages panel (Components tab) goes away.

1. Read node_modules/@tio-canvas/canvas/docs/integration.md, section "Components", first. It explains how components are found, how to list one by hand, and the options "componentDirs", "componentExclude" and "ignore".
2. Open the canvas config (dev/canvas/screens.js, or the file the dev server passes as "config" to createCanvasHost). It must stay a standalone ES module that imports nothing.
3. Fix each of these, reading the component's real source rather than guessing:

${list}

4. Restart the dev server if you changed anything outside the canvas folder, reload /canvas, press Cmd+K and open the Components tab. The notice must be gone and every component must draw. If something is still listed, fix it the same way.
5. Tell me what you changed and anything you could not verify.`;
}

export function renderComponentIssues(body, issues) {
  body.replaceChildren();
  const prompt = componentIssuesPrompt(issues);
  body.append(
    Section({ className: 'install-section' },
      h('p', {}, issuesBanner(issues).replace(/\.$/, ':')),
      h('ul', { class: 'issue-list' }, ...issues.map(issue => h('li', {}, describeIssue(issue))))),
    Section({ className: 'install-section' },
      h('div', { class: 'install-head' }, h('h3', {}, 'Ask an agent to fix them'), CopyButton('Copy prompt', prompt)),
      h('p', {}, 'Paste this into your coding agent while it is in the project. When it is done, reload the canvas and the notice goes away.'), CodeBlock(prompt)));
}
