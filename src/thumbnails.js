// Refresh the development-only page catalog snapshots with a running dev server:
//   tio-canvas thumbnails [http://localhost:4321] [--missing|--check] [--config dev/canvas/screens.js] [--out dev/canvas/thumbnails]
// Uses the existing Chromium cache, without adding a browser dependency.
import { spawn } from 'node:child_process';
import { access, mkdir, readdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolveProject, loadProject } from './project.js';

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
const cache = `${homedir()}/Library/Caches/ms-playwright`;
const shells = (await readdir(cache)).filter(name => name.startsWith('chromium_headless_shell-')).sort();
const binary = process.env.CHROME_BIN ?? `${cache}/${shells.at(-1)}/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const profile = await mkdtemp(`${tmpdir()}/canvas-thumbnails-`);
const chrome = spawn(binary, ['--headless', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chromium startup timed out.')), 10000);
    let output = '';
    chrome.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(new URL(match[1]).origin.replace('ws:', 'http:')); }
    });
    chrome.once('error', error => { clearTimeout(timer); reject(error); });
  });
  const page = (await (await fetch(`${endpoint}/json/list`)).json()).find(item => item.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`${method} timed out.`)); }, 15000);
    pending.set(key, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  await send('Page.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await mkdir(destination, { recursive: true });
  for (const source of targets) {
    await send('Emulation.setDeviceMetricsOverride', { width: source.width, height: source.height, deviceScaleFactor: 1, mobile: false });
    const url = new URL(source.src, base);
    url.searchParams.set('canvasScreen', '1');
    await send('Page.navigate', { url: url.href });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      await sleep(100);
      const result = await send('Runtime.evaluate', { expression: 'location.href === '+JSON.stringify(url.href)+' && document.readyState !== "loading"', returnByValue: true });
      if (result.result.value) { ready = true; break; }
    }
    if (!ready) throw new Error(`Page did not load: ${source.src}`);
    const settled = await send('Runtime.evaluate', { expression: '(async()=>{await document.fonts.ready;await Promise.race([Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,4000))]);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true})()', awaitPromise: true, returnByValue: true });
    if (settled.exceptionDetails) throw new Error(`Page did not settle: ${source.src}`);
    const { data } = await send('Page.captureScreenshot', { format: 'webp', quality: 80, clip: { x: 0, y: 0, width: source.width, height: source.height, scale: 160 / Math.min(source.width, source.height) } });
    await writeFile(new URL(`${source.id}.webp`, destination), Buffer.from(data, 'base64'));
    console.log(`Updated ${source.id}.webp`);
  }
} finally {
  socket?.close();
  const exited = new Promise(resolve => chrome.once('exit', resolve));
  chrome.kill();
  await exited;
  await rm(profile, { recursive: true, force: true });
}
