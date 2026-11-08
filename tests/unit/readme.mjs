import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { agentPrompt } from '../../client/install-guide.js';

const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
assert.ok(readme.includes(agentPrompt), 'the README shows the same agent prompt as the Install dialog');
const integration = await readFile(new URL('../../docs/integration.md', import.meta.url), 'utf8');
assert.match(integration, /## Use it in a project/, 'the prompt points at a section that exists');
assert.match(agentPrompt, /docs\/integration\.md/);
for (const name of ['canvas-server.mjs', 'canvas-screens.mjs']) await readFile(new URL(`../../client/templates/${name}`, import.meta.url));
console.log('PASS README: agent prompt matches the dialog, integration guide and templates exist');
