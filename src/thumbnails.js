// Refresh the development-only page catalog snapshots with a running dev server:
//   tio-canvas thumbnails [http://localhost:4321] [--missing|--check] [--config dev/canvas/screens.js] [--out dev/canvas/thumbnails]
// Uses a Chromium already on this computer, without adding a browser dependency.
// The dev server also makes a missing thumbnail on its own; this refreshes them all.
import { access, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolveProject, loadProject } from './project.js';
import { createCapturer } from './capture.js';

const args = process.argv.slice(2);
const option = (name) => { const at = args.indexOf(name); return at < 0 ? undefined : args.splice(at, 2)[1]; };
const config = option('--config'), out = option('--out');
const project = resolveProject({ config, thumbnails: out });
const { screens } = await loadProject(project);
const mode = args.includes('--check') ? 'check' : args.includes('--missing') ? 'missing' : 'all';
const base = args.find(arg => !arg.startsWith('--')) ?? 'http://localhost:4321';
const destination = pathToFileURL(project.thumbnailsDir + '/');
const missing = [];
for (const source of screens) {
  try { await access(new URL(`${source.id}.webp`, destination)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; missing.push(source); }
}
if (mode === 'check') {
  if (missing.length) throw new Error(`Missing canvas thumbnails: ${missing.map(source => source.id).join(', ')}`);
  console.log(`All ${screens.length} canvas thumbnails are present.`);
  process.exit(0);
}
const targets = mode === 'missing' ? missing : screens;
if (!targets.length) { console.log('No canvas thumbnails are missing.'); process.exit(0); }
if (!(await fetch(`${base}/canvas/`)).ok) throw new Error('Start the development server before generating thumbnails.');
const shots = createCapturer({ binary: process.env.CHROME_BIN });
try {
  await mkdir(destination, { recursive: true });
  for (const source of targets) {
    await writeFile(new URL(`${source.id}.webp`, destination), await shots.capture(source, base));
    console.log(`Updated ${source.id}.webp`);
  }
} finally {
  await shots.close();
}
