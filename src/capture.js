// Takes small snapshots of pages with a Chromium that is already on this
// computer (no browser dependency is added). Used by the dev server, which makes
// a missing thumbnail on demand, and by `tio-canvas thumbnails`.
import { spawn } from "node:child_process";
import { access, readdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

/** The short side of a thumbnail, in pixels. A row shows it at 28px, so this stays sharp on a 2x screen and weighs about a kilobyte. */
export const THUMBNAIL_SIZE = 96;
const QUALITY = 60;

/** A Chromium to drive: $CHROME_BIN, the Playwright cache, or an installed Chrome. Null when there is none. */
export async function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = [];
  const cache = `${homedir()}/Library/Caches/ms-playwright`;
  try {
    const shells = (await readdir(cache)).filter(name => name.startsWith("chromium_headless_shell-")).sort();
    if (shells.length) {
      const inside = (await readdir(`${cache}/${shells.at(-1)}`)).find(name => name.startsWith("chrome-headless-shell-"));
      if (inside) candidates.push(`${cache}/${shells.at(-1)}/${inside}/chrome-headless-shell`);
    }
  } catch { /* no Playwright cache */ }
  candidates.push(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
  );
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try the next */ }
  }
  return null;
}

/**
 * One headless Chromium, started on the first snapshot and stopped after `idle`
 * milliseconds without one, so it costs nothing while you work.
 *   const shots = createCapturer({ binary, idle: 4000 })
 *   const webp = await shots.capture({ src, width, height }, 'http://localhost:4400')
 * Snapshots are taken one at a time.
 */
export function createCapturer({ binary, idle = 4000 } = {}) {
  let session, timer, queue = Promise.resolve();

  async function start() {
    const exe = binary ?? await findChrome();
    if (!exe) throw new Error("No Chromium found. Install one or set CHROME_BIN.");
    const profile = await mkdtemp(`${tmpdir()}/canvas-thumbnails-`);
    const chrome = spawn(exe, ["--headless", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
    let socket;
    const stop = async () => {
      socket?.close();
      const exited = new Promise(resolve => chrome.once("exit", resolve));
      chrome.kill();
      await exited;
      await rm(profile, { recursive: true, force: true });
    };
    try {
      const endpoint = await new Promise((resolve, reject) => {
        const wait = setTimeout(() => reject(new Error("Chromium startup timed out.")), 10000);
        let output = "";
        chrome.stderr.on("data", chunk => {
          output += chunk;
          const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
          if (match) { clearTimeout(wait); resolve(new URL(match[1]).origin.replace("ws:", "http:")); }
        });
        chrome.once("error", error => { clearTimeout(wait); reject(error); });
      });
      const page = (await (await fetch(`${endpoint}/json/list`)).json()).find(item => item.type === "page");
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
        const wait = setTimeout(() => { pending.delete(key); reject(new Error(`${method} timed out.`)); }, 15000);
        pending.set(key, { resolve, reject, timer: wait });
        socket.send(JSON.stringify({ id: key, method, params }));
      });
      await send("Page.enable");
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      return { send, stop };
    } catch (error) {
      await stop();
      throw error;
    }
  }

  async function take(source, base) {
    session ??= start();
    const { send } = await session.catch(error => { session = undefined; throw error; });
    await send("Emulation.setDeviceMetricsOverride", { width: source.width, height: source.height, deviceScaleFactor: 1, mobile: false });
    const url = new URL(source.src, base);
    url.searchParams.set("canvasScreen", "1");
    await send("Page.navigate", { url: url.href });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      await sleep(100);
      const result = await send("Runtime.evaluate", { expression: `location.href === ${JSON.stringify(url.href)} && document.readyState !== "loading"`, returnByValue: true });
      if (result.result.value) { ready = true; break; }
    }
    if (!ready) throw new Error(`Page did not load: ${source.src}`);
    const settled = await send("Runtime.evaluate", { expression: "(async()=>{await document.fonts.ready;await Promise.race([Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,4000))]);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true})()", awaitPromise: true, returnByValue: true });
    if (settled.exceptionDetails) throw new Error(`Page did not settle: ${source.src}`);
    const { data } = await send("Page.captureScreenshot", { format: "webp", quality: QUALITY, clip: { x: 0, y: 0, width: source.width, height: source.height, scale: THUMBNAIL_SIZE / Math.min(source.width, source.height) } });
    return Buffer.from(data, "base64");
  }

  async function close() {
    clearTimeout(timer);
    const current = session; session = undefined;
    if (current) await (await current.catch(() => null))?.stop();
  }

  return {
    capture(source, base) {
      const run = queue.then(() => take(source, base));
      queue = run.catch(() => {}).then(() => { clearTimeout(timer); timer = setTimeout(close, idle); timer.unref?.(); });
      return run;
    },
    close,
  };
}
