import assert from 'node:assert/strict';
import { componentIssuesPrompt, describeIssue, issuesBanner } from '../../client/component-issues.js';

const issues = [
  { kind: 'missing-file', id: 'gone', title: 'Gone', module: '../../src/Gone.tsx' },
  { kind: 'missing-export', id: 'nothing', title: 'Nothing', module: '../../src/Nothing.tsx', export: 'Nothing' },
  { kind: 'controls-out-of-date', id: 'badge', title: 'Badge', module: '../../src/Badge.tsx', missing: [{ name: 'tone', type: 'select', options: ['info', 'warn'] }, { name: 'text', type: 'text' }], extra: ['old'] },
  { kind: 'unlisted', file: 'src/components/Lazy.tsx' },
  { kind: 'no-typescript', count: 2 },
  { kind: 'missing-component', id: 'old-card', title: 'Old card', count: 2 },
  { kind: 'render-error', id: 'menu', title: 'Menu', module: '../../src/Menu.tsx', message: 'useTheme must be used inside ThemeProvider\n  at Menu' },
];

assert.equal(issuesBanner(issues), '7 things to check in your components.');
assert.equal(issuesBanner(issues.slice(0, 1)), '1 thing to check in your components.');
assert.match(describeIssue(issues[2]), /no control for "tone" and "text", and has controls for "old"/);

const prompt = componentIssuesPrompt(issues);
assert.match(prompt, /found 7 things/, 'one prompt for all of them');
for (const issue of issues) assert.ok(prompt.includes(issue.id ?? issue.file ?? 'TypeScript'), `the prompt covers ${issue.kind}`);
assert.match(prompt, /one of "info", "warn"/);
assert.match(prompt, /ignore: \[/, 'a prop left out on purpose has a way out');
assert.match(prompt, /componentExclude/, 'a file that is not a component has a way out');
assert.match(prompt, /notice must be gone/, 'it says what done looks like');

assert.match(describeIssue(issues[5]), /Old card: 2 frames on the canvas wait for it/);
assert.match(prompt, /id "old-card"/, 'a missing component is named by the id its frames wait for');

const { scanSummary } = await import('../../client/pages-empty.js');
{
  assert.equal(scanSummary(null), '');
  assert.match(scanSummary({ error: 'boom' }), /failed: boom/);
  assert.match(scanSummary({ folders: [], files: 0 }), /None of the usual/);
  assert.match(scanSummary({ folders: ['src/components'], files: 0 }), /Searched src\/components: no \.tsx/);
  assert.match(scanSummary({ folders: ['a', 'b', 'c', 'd'], files: 1 }), /a, b, c and 1 more: 1 file,/);
}

assert.equal(describeIssue(issues[6]), 'Menu: could not be drawn (useTheme must be used inside ThemeProvider).');
assert.match(prompt, /componentPreview\.wrapper/, 'a component that needs a provider has a way out');
