// Every client file must parse: one syntax error leaves the whole canvas blank, and most client files are never imported by other tests.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = new URL('../../client/', import.meta.url);
const files = readdirSync(dir, { recursive: true }).filter(file => /\.m?js$/.test(file));
const broken = files.filter(file => spawnSync(process.execPath, ['--check', fileURLToPath(new URL(file, dir))]).status !== 0);
if (broken.length) { console.error(`Syntax errors in: ${broken.join(', ')}`); process.exit(1); }
console.log(`PASS client syntax: ${files.length} files parse`);
