// Run against a development server: node build/test-interface-kit.mjs http://localhost:4397
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const base = process.argv[2] ?? 'http://localhost:4321';
const cache = `${homedir()}/Library/Caches/ms-playwright`;
const shells = (await readdir(cache)).filter(name => name.startsWith('chromium_headless_shell-')).sort();
const binary = process.env.CHROME_BIN ?? `${cache}/${shells.at(-1)}/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const profile = await mkdtemp(`${tmpdir()}/interface-kit-test-`);
const chrome = spawn(binary, ['--headless', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chromium startup timed out.')), 10000);
    let output = '';
    chrome.stderr.on('data', chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(new URL(match[1]).origin.replace('ws:', 'http:')); } });
    chrome.once('error', error => { clearTimeout(timer); reject(error); });
  });
  const page = (await (await fetch(`${endpoint}/json/list`)).json()).find(item => item.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map();
  socket.onmessage = event => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); clearTimeout(request.timer); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error(`${method} timed out`)); }, 15000); pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const mouse = (type, x, y, buttons) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  const click = async (x, y) => { await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y, 0); };
  const drag = async (x, y, targetX, targetY) => { await mouse('mousePressed', x, y, 1); await mouse('mouseMoved', targetX, targetY, 1); await mouse('mouseReleased', targetX, targetY, 0); };
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/canvas/` }); await sleep(1800);
  await evaluate(`document.querySelector('[data-id="web-page-timewarp"] .screen-fullscreen').click()`); await sleep(2200);
  const doc = `document.querySelector('.screen[data-fullscreen] iframe').contentDocument`;
  const shadow = `[...${doc}.querySelectorAll('[data-interface-kit]')].find(e=>e.shadowRoot).shadowRoot`;
  await click(38, 862); await sleep(600);
  const paragraph = await evaluate(`(()=>{const r=${doc}.querySelector('.rail-profile p').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await click(paragraph.x, paragraph.y); await sleep(600);
  await evaluate(`[...${shadow}.querySelectorAll('button')].find(b=>b.textContent.startsWith('Color')).click()`); await sleep(600);
  const input = await evaluate(`(()=>{let e=${shadow}.querySelector('[data-slot="popover-content"] input');if(!e)return null;let r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  if (!input) throw new Error('Color picker did not appear inside the styled shadow root.');
  await click(input.x, input.y); await evaluate(`${shadow}.activeElement.select()`);
  await send('Input.insertText', { text: 'ff0000' });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' }); await sleep(400);
  const color = await evaluate(`${doc}.querySelector('.rail-profile p').style.color`);
  if (color !== 'rgb(255, 0, 0)') throw new Error(`Hex edit did not apply: ${color}`);
  const area = await evaluate(`(()=>{let e=${shadow}.querySelector('[data-slot="popover-content"] .cursor-crosshair');if(!e)return null;let r=e.getBoundingClientRect();return {x:r.x+r.width*.7,y:r.y+r.height*.7}})()`);
  if (!area) throw new Error('Color area is missing.');
  await click(area.x, area.y); await sleep(400);
  const picked = await evaluate(`${doc}.querySelector('.rail-profile p').style.color`);
  if (picked === color || !picked) throw new Error(`Color area did not apply a new color: ${picked}`);
  console.log('Hex picker and color area: passed');
  await send('Page.navigate', { url: `${base}/canvas/` }); await sleep(1800);
  await evaluate(`document.querySelector('[data-id="web-page-timewarp"] .screen-fullscreen').click()`); await sleep(2200);
  await evaluate(`document.querySelector('.screen[data-fullscreen] iframe').contentDocument.querySelector('.dialkit-panel-header .dialkit-folder-header-top').click()`); await sleep(800);
  const checkCorners = async () => {
    const state = await evaluate(`(()=>{const d=document.querySelector('.screen[data-fullscreen] iframe').contentDocument;return [document.querySelector('#fullscreen-tools').dataset.floatingCorner,d.querySelector('.dialkit-panel').dataset.floatingCorner,d.querySelector('body > [data-interface-kit]').dataset.floatingCorner]})()`);
    if (state.some(value => !value) || new Set(state).size !== 3) throw new Error(`Floating corner collision: ${state}`);
    return state;
  };
  const initial = await checkCorners();
  if (initial.join(',') !== 'top-left,bottom-right,bottom-left') throw new Error(`Unexpected defaults: ${initial}`);
  await drag(38, 862, 1400, 862); await sleep(800); await checkCorners();
  await drag(38, 38, 1400, 862); await sleep(800); await checkCorners();
  console.log('Floating corners: passed');
} finally {
  socket?.close(); const exited = new Promise(resolve => chrome.once('exit', resolve)); chrome.kill(); await exited; await rm(profile, { recursive: true, force: true });
}
