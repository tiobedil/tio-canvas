import path from "node:path";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveProject, loadProject } from "./project.js";

const CLIENT = fileURLToPath(new URL("../client", import.meta.url));

/**
 * Copy the canvas into `<target>`, ready to be served at /canvas: the package's
 * files, the project's screens written as `project.js`, and only the thumbnails
 * of screens that exist. Returns the screens, so the project can add its own
 * checks (for example, that no production screen points at a prototype).
 */
export async function copyCanvas({ target, ...options }) {
  const project = resolveProject(options);
  const { screens, storageKey } = await loadProject(project);
  const keep = new Set(screens.map((screen) => `${screen.id}.webp`));
  await cp(CLIENT, target, { recursive: true });
  await writeFile(path.join(target, "project.js"), `export const screens = ${JSON.stringify(screens)};\nexport const storageKey = ${JSON.stringify(storageKey)};\n`);
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
