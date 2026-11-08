import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareVersions, isLocalHost, fetchLatestVersion } from '../../client/update-check.js';
import { version } from '../../client/version.js';

assert.equal(compareVersions('0.1.4', '0.1.3'), 1);
assert.equal(compareVersions('0.1.3', '0.1.3'), 0);
assert.equal(compareVersions('0.1.3', '0.2.0'), -1);
assert.equal(compareVersions('0.10.0', '0.9.9'), 1, 'numbers compare as numbers, not text');
assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
assert.equal(compareVersions('1.0.0-beta', '0.9.0'), 0, 'a value that is not major.minor.patch never raises an alert');
assert.equal(compareVersions('', '0.1.0'), 0);

assert.ok(isLocalHost('localhost') && isLocalHost('127.0.0.1') && isLocalHost('app.localhost'));
assert.ok(!isLocalHost('tio.example.com') && !isLocalHost('localhost.evil.com'));

const reply = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
assert.equal(await fetchLatestVersion(reply(200, { version: '0.2.0' })), '0.2.0');
await assert.rejects(fetchLatestVersion(reply(404, {})), /404/);
await assert.rejects(fetchLatestVersion(reply(200, { version: 'latest' })), /unexpected/);

assert.equal(version, JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version, 'client/version.js matches package.json');
console.log('PASS update check: version compare, local-only check, registry answers, version stamp');
