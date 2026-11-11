import assert from 'node:assert/strict';
import { componentIssuesPrompt, describeIssue, issuesBanner } from '../../client/component-issues.js';

const issues = [
  { kind: 'missing-file', id: 'gone', title: 'Gone', module: '../../src/Gone.tsx' },
  { kind: 'missing-export', id: 'nothing', title: 'Nothing', module: '../../src/Nothing.tsx', export: 'Nothing' },
  { kind: 'controls-out-of-date', id: 'badge', title: 'Badge', module: '../../src/Badge.tsx', missing: [{ name: 'tone', type: 'select', options: ['info', 'warn'] }, { name: 'text', type: 'text' }], extra: ['old'] },
  { kind: 'unlisted', file: 'src/components/Lazy.tsx' },
  { kind: 'no-typescript', count: 2 },
];

assert.equal(issuesBanner(issues), '5 things to check in your components.');
assert.equal(issuesBanner(issues.slice(0, 1)), '1 thing to check in your components.');
assert.match(describeIssue(issues[2]), /no control for "tone" and "text", and has controls for "old"/);

const prompt = componentIssuesPrompt(issues);
assert.match(prompt, /found 5 things/, 'one prompt for all of them');
for (const issue of issues) assert.ok(prompt.includes(issue.id ?? issue.file ?? 'TypeScript'), `the prompt covers ${issue.kind}`);
assert.match(prompt, /one of "info", "warn"/);
assert.match(prompt, /ignore: \[/, 'a prop left out on purpose has a way out');
assert.match(prompt, /componentExclude/, 'a file that is not a component has a way out');
assert.match(prompt, /notice must be gone/, 'it says what done looks like');
