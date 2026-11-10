import path from "node:path";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveProject, loadProject } from "./project.js";
import { componentFrames } from "./server.js";
import { bundleComponent } from "./component-bundle.js";

const CLIENT = fileURLToPath(new URL("../client", import.meta.url));

/**
 * Copy the canvas into `<target>`, ready to be served at /canvas: the package's
 * files, the project's screens and components written as `project.js`, one
 * script per component, and only the thumbnails of screens and components that
 * exist. Returns the screens, so the project can add its own
 * checks (for example, that no production screen points at a prototype).
 */
export async function copyCanvas({ target, ...options }) {
  const project = resolveProject(options);
  const { screens, components, storageKey } = await loadProject(project);
  const keep = new Set([...screens, ...componentFrames(components)].map((screen) => `${screen.id}.webp`));
  await cp(CLIENT, target, { recursive: true });
  // The canvas page needs what a component is called and which dials it has; its
  // render function travels inside the component's own script instead.
  await writeFile(path.join(target, "project.js"), `export const screens = ${JSON.stringify(screens)};\nexport const components = ${JSON.stringify(components)};\nexport const storageKey = ${JSON.stringify(storageKey)};\n`);
  if (components.length) await mkdir(path.join(target, "components"), { recursive: true });
  for (const component of components) {
    await writeFile(path.join(target, "components", `${component.id}.js`), await bundleComponent(project, component.id, { production: true }));
  }
  await mkdir(path.join(target, "thumbnails"), { recursive: true });
  if (existsSync(project.thumbnailsDir)) {
    await cp(project.thumbnailsDir, path.join(target, "thumbnails"), {
      recursive: true,
      filter: (source) => path.extname(source) !== ".webp" || keep.has(path.basename(source))
    });
  }
  const page = path.join(target, "index.html");
  const html = await readFile(page, "utf8");
  if (!html.includes("<head>")) throw new Error("canvas/index.html needs a <head> for the noindex tag.");
  await writeFile(page, html.replace("<head>", '<head>\n  <meta name="robots" content="noindex, nofollow">'));
  return screens;
}
