import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProject, loadProject } from '../../src/project.js';
import { componentWatchDirs } from '../../src/component-scan.js';

const fixture = fileURLToPath(new URL('../fixtures/scan', import.meta.url));
const load = async root => loadProject(resolveProject({ root }));
const byId = list => Object.fromEntries(list.map(item => [item.id, item]));
const kinds = issues => issues.map(issue => issue.kind).sort();

// With TypeScript (the repository's own, found from the fixture's root).
{
  const { autoComponents, componentIssues, components } = await load(fixture);
  const auto = byId(autoComponents);
  assert.deepEqual(Object.keys(auto).sort(), ['button', 'card', 'card-inner', 'gauge', 'input', 'legacy', 'panel', 'something', 'wrapped'],
    'every real component is listed: function, arrow, forwardRef, memo, class, default export, a folder added by componentDirs, a .jsx file');
  assert.equal(components.length, 4 + autoComponents.length, 'listed and found components are one list');
  for (const left of ['badge', 'helper', 'hidden', 'action', 'card-test', 'colors', 'palette'])
    assert.ok(!auto[left], `${left}: not a component (listed by hand, lowercase, a test, a hidden folder, server-only, or no function)`);

  assert.deepEqual(auto.button.controls, {
    variant: { type: 'select', options: ['primary', 'ghost', 'danger'], value: 'ghost' },
    size: { type: 'select', options: [1, 2, 3], value: 2 },
    disabled: { type: 'boolean', value: true },
    label: { type: 'text', value: 'Go' },
    count: { type: 'number', value: 4 },
    children: { type: 'text', value: 'Button' },
  }, 'props become dials, with defaults from the destructured parameters; functions, objects, className and HTML attributes get none');
  assert.equal(auto.button.export, 'Button');
  assert.equal(auto.button.module, '../../src/components/Button.tsx');
  assert.equal(auto.panel.export, undefined, 'a default export has no export name');
  assert.equal(auto.panel.title, 'Panel');
  assert.deepEqual(auto.card.controls, { tight: { type: 'boolean', value: false } });
  assert.equal(auto.input.group, 'Forms', 'a sub-folder is the group');
  assert.equal(auto.gauge.group, 'Components');

  const found = Object.fromEntries(componentIssues.map(issue => [issue.id ?? issue.kind, issue]));
  assert.deepEqual(kinds(componentIssues), ['controls-out-of-date', 'missing-export', 'missing-file']);
  assert.equal(found.gone.module, '../../src/components/Gone.tsx');
  assert.equal(found.nothing.export, 'Nothing');
  assert.deepEqual(found.badge.extra, ['gone'], 'a control for a prop the component no longer has');
  assert.deepEqual(found.badge.missing.map(item => item.name), ['text', 'extra'], 'a prop the component has and no control covers');
  assert.ok(!componentIssues.some(issue => issue.id === 'rendered'), 'an entry with its own render function is not second-guessed');
  assert.deepEqual(componentWatchDirs(resolveProject({ root: fixture })).map(dir => path.relative(fixture, dir)).sort(), ['src/components', 'src/widgets'], 'the folders to watch: the defaults that exist and componentDirs');
}

// Without TypeScript: components are still found, but with no dials, and the canvas says so.
{
  const root = await mkdtemp(path.join(tmpdir(), 'tio-canvas-scan-'));
  try {
    await cp(fixture, root, { recursive: true });
    const { autoComponents, componentIssues } = await load(root);
    const auto = byId(autoComponents);
    assert.ok(auto.button && auto.card && auto.panel && auto.gauge && auto.input && auto.legacy, 'written-like-a-component files are found without TypeScript');
    assert.ok(!auto.wrapped, 'a wrapped default export needs TypeScript to be certain, so it is not guessed');
    assert.deepEqual(auto.button.controls, {}, 'no dials without TypeScript');
    assert.ok(componentIssues.some(issue => issue.kind === 'no-typescript' && issue.count > 0));
    assert.ok(!componentIssues.some(issue => issue.kind === 'controls-out-of-date'), 'nothing is claimed about controls it cannot read');
    assert.ok(componentIssues.some(issue => issue.kind === 'missing-file') && componentIssues.some(issue => issue.kind === 'missing-export'), 'what does not need types is still checked');

    // Fixing the config clears every issue it raised.
    await writeFile(path.join(root, 'dev/canvas/screens.js'), `export const screens = [];\nexport const componentDirs = ['src/widgets'];\nexport const componentExclude = ['src/components/Nothing.tsx'];\nexport const components = [];\n`);
    const after = await load(root);
    assert.deepEqual(kinds(after.componentIssues), ['no-typescript'], 'an excluded file and removed entries leave nothing to report');
    assert.ok(!byId(after.autoComponents).something, 'an excluded file is not listed');
  } finally { await rm(root, { recursive: true, force: true }); }
}

await assert.rejects(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'tio-canvas-scan-'));
  try { await writeFile(path.join(root, 'screens.js'), `export const screens = [];\nexport const componentDirs = 'src';\n`); await loadProject(resolveProject({ root, config: 'screens.js' })); }
  finally { await rm(root, { recursive: true, force: true }); }
}, /componentDirs/);
