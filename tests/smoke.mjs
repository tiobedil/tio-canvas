import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCanvasHost, copyCanvas, loadProject } from "../src/index.js";

const root = await mkdtemp(path.join(tmpdir(), "tio-canvas-"));
try {
  await mkdir(path.join(root, "dev/canvas/thumbnails"), { recursive: true });
  const screen = (id, extra = "") => `{ id: '${id}', kind: 'production', title: 'T', src: '/', x: 0, y: 0, width: 800, height: 600, preset: 'custom'${extra} }`;
  await writeFile(path.join(root, "dev/canvas/screens.js"), `export const screens = [${screen("home")}];\n`);
  await writeFile(path.join(root, "dev/canvas/thumbnails/home.webp"), "a");
  await writeFile(path.join(root, "dev/canvas/thumbnails/gone.webp"), "b");

  const host = createCanvasHost({ root });
  assert.equal(host.locate("/canvas/canvas.js").directory, host.clientDir);
  assert.equal(host.locate("/canvas/project.js").directory, host.project.projectDir);
  assert.equal(host.locate("/canvas/thumbnails/home.webp").directory, host.project.thumbnailsDir);
  assert.match(await host.projectModule(), /export const storageKey = "tio-canvas:v1"/);

  assert.equal(await host.ensureThumbnail("/canvas/thumbnails/home.webp", "http://x"), true, "an existing thumbnail is left alone");
  assert.equal(await host.ensureThumbnail("/canvas/thumbnails/nobody.webp", "http://x"), false, "no thumbnail is made for a screen that does not exist");
  assert.equal(await host.ensureThumbnail("/canvas/canvas.js", "http://x"), false, "only thumbnails are made");

  await writeFile(path.join(root, "dev/canvas/screens.js"), `export const screens = [${screen("home")}];\nexport const storageKey = 'mine:v1';\n`);
  assert.doesNotMatch(await host.projectModule(), /tio-canvas:v1/);

  const url = (query) => new URL(`http://x/${query}`);
  assert.equal(host.pageScripts(url(""), {}).bridge, "");
  assert.match(host.pageScripts(url("?canvasScreen=1"), {}).bridge, /bridge\.js/);
  assert.equal(host.pageScripts(url("?canvasScreen=1"), {}).tools, "");
  assert.match(host.pageScripts(url("?canvasScreen=1"), { "sec-fetch-dest": "iframe" }).tools, /interface-kit/);

  const target = path.join(root, "out");
  const screens = await copyCanvas({ root, target });
  assert.equal(screens.length, 1);
  assert.deepEqual((await readdir(path.join(target, "thumbnails"))).sort(), ["home.webp"], "a thumbnail without a screen is not shipped");
  assert.match(await readFile(path.join(target, "project.js"), "utf8"), /storageKey = "mine:v1"/);
  assert.match(await readFile(path.join(target, "index.html"), "utf8"), /noindex, nofollow/);

  await writeFile(path.join(root, "dev/canvas/screens.js"), `export const screens = [{ id: 'x', kind: 'nope', title: 'T' }];\n`);
  await assert.rejects(loadProject(host.project), /needs kind/);
  console.log("PASS server locate, project module, page scripts, build copy, validation");
} finally {
  await rm(root, { recursive: true, force: true });
}
