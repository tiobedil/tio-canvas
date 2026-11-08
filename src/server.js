import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveProject, DEFAULT_STORAGE_KEY } from "./project.js";

const CLIENT = fileURLToPath(new URL("../client", import.meta.url));
const DEFAULT_STORAGE_EXPORT = /export\s+(?:const|let|var)\s+storageKey\b|export\s*\{[^}]*\bstorageKey\b/;

/**
 * The canvas as seen by a development server.
 *
 * It does not own a server. A host (the project's own `serve.mjs`) asks it four
 * things and keeps everything else, so the canvas never decides how a project is
 * served:
 *
 *   locate(pathname)         which directory, and which path inside it, holds a
 *                            file under /canvas
 *   projectModule()          the project's config, as the browser must receive it
 *   pageScripts(url, headers) the scripts to add to a page that is being framed
 *   interfaceKitBundle()     the development-only Interface Kit script
 *
 * Nothing here ships: a production build is `copyCanvas` in ./build.js.
 */
export function createCanvasHost(options = {}) {
  const project = resolveProject(options);
  let kit;

  return {
    project,
    clientDir: CLIENT,

    /** Directories to watch; a change in either reloads the workspace. */
    watchTargets: () => [CLIENT, project.projectDir],

    locate(pathname) {
      const local = pathname.slice("/canvas".length) || "/";
      if (local === "/project.js") return { directory: project.projectDir, localPath: `/${path.basename(project.configFile)}`, project: true };
      if (local.startsWith("/thumbnails/")) return { directory: project.thumbnailsDir, localPath: local.slice("/thumbnails".length) };
      return { directory: CLIENT, localPath: local };
    },

    /**
     * The project's config, plus the storage key when the config names none.
     * The key decides where a browser keeps the saved layout, so two projects
     * opened on one origin must not share one.
     */
    async projectModule() {
      const source = await readFile(project.configFile, "utf8");
      return DEFAULT_STORAGE_EXPORT.test(source) ? source : `${source}\nexport const storageKey = ${JSON.stringify(DEFAULT_STORAGE_KEY)};\n`;
    },

    /** `bridge` goes into every framed screen; `tools` only into one framed by the canvas itself. */
    pageScripts(url, headers) {
      const bridge = url.searchParams.get("canvasScreen") === "1" ? '<script type="module" src="/canvas/bridge.js"></script>' : "";
      const framed = bridge && headers["sec-fetch-dest"] === "iframe";
      const tools = framed ? '<script type="module" src="/__dev/interface-kit.js"></script>' : "";
      return { bridge, tools };
    },

    async interfaceKitBundle() {
      try {
        kit ??= (await import("./interface-kit-bundle.js")).bundleInterfaceKit();
        return await kit;
      } catch (error) {
        kit = undefined;
        throw error;
      }
    }
  };
}
