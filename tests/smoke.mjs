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

  // Components: located, built into one script each, and shipped by the build.
  await writeFile(path.join(root, "widget.js"), `import "./widget.css";\nexport function Widget({ label }) { const node = document.createElement("b"); node.textContent = label; return node; }\n`);
  await writeFile(path.join(root, "widget.css"), `b { color: rgb(1, 2, 3); }\n`);
  const component = `{ id: 'widget', title: 'Widget', module: '../../widget.js', export: 'Widget', framework: 'dom', controls: { label: 'Hi' } }`;
  await writeFile(path.join(root, "dev/canvas/screens.js"), `export const screens = [${screen("home")}];\nexport const components = [${component}];\n`);
  assert.equal(host.locate("/canvas/components/widget.js").component, "widget");
  assert.equal(host.locate("/canvas/components/../secret.js").component, undefined, "only a plain component id is a component");
  assert.equal((await loadProject(host.project)).components.length, 1);
  const script = await host.componentModule("widget");
  assert.match(script, /startComponent/, "the frame script carries the runtime");
  assert.match(script, /rgb\(1, 2, 3\)/, "styles the component imports travel inside its script");
  assert.match(await host.componentModule("nobody"), /could not be built/, "an unknown component answers with a script that shows the error");
  await writeFile(path.join(root, "dev/canvas/thumbnails/component-widget.webp"), "c");
  const shipped = path.join(root, "out-components");
  await copyCanvas({ root, target: shipped });
  assert.match(await readFile(path.join(shipped, "project.js"), "utf8"), /export const components = \[\{"id":"widget"/);
  assert.match(await readFile(path.join(shipped, "components/widget.js"), "utf8"), /component-root/);
  assert.deepEqual((await readdir(path.join(shipped, "thumbnails"))).sort(), ["component-widget.webp", "home.webp"], "a component's thumbnail is shipped with it");
  await writeFile(path.join(root, "dev/canvas/screens.js"), `export const screens = [];\nexport const components = [{ id: 'Bad Id', title: 'T', module: './x.js' }];\n`);
  await assert.rejects(loadProject(host.project), /lowercase letters/);

  await writeFile(path.join(root, "dev/canvas/screens.js"), `export const screens = [{ id: 'x', kind: 'nope', title: 'T' }];\n`);
  await assert.rejects(loadProject(host.project), /needs kind/);
  console.log("PASS server locate, project module, page scripts, components, build copy, validation");
} finally {
  await rm(root, { recursive: true, force: true });
}
