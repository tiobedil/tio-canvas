import path from "node:path";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveProject, loadProject, DEFAULT_STORAGE_KEY } from "./project.js";
import { createCapturer } from "./capture.js";
import { componentThumbnailId } from "../client/registry.js";
import { componentWatchDirs, resolveModule } from "./component-scan.js";
import { componentErrorModule } from "./component-bundle.js";

const CLIENT = fileURLToPath(new URL("../client", import.meta.url));
const DEFAULT_STORAGE_EXPORT = /export\s+(?:const|let|var)\s+storageKey\b|export\s*\{[^}]*\bstorageKey\b/;

const THUMBNAIL_FRAME = 200;

/** Components as the thumbnail maker sees them: a page to open and a size. */
export function componentFrames(components) {
  return components.map(component => ({
    id: componentThumbnailId(component.id),
    src: `/canvas/component.html?component=${encodeURIComponent(component.id)}&thumbnail=1`,
    // A small square, not the frame's own size, and the component scaled up to
    // fill it (component-runtime.js): in a picture of the whole frame a button would be a dot.
    width: THUMBNAIL_FRAME, height: THUMBNAIL_FRAME,
  }));
}

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
 *   componentModule(id)      the script of one component frame, for
 *                            /canvas/components/<id>.js (locate() names the id)
 *   ensureThumbnail(pathname, origin)
 *                            before serving /canvas/thumbnails/<id>.webp: makes it
 *                            when the screen has none yet (see below)
 *
 * Nothing here ships: a production build is `copyCanvas` in ./build.js.
 */
export function createCanvasHost(options = {}) {
  const project = resolveProject(options);
  let kit;
  // Thumbnails are made on demand, one browser at a time, and a failure is not retried for a while.
  const shots = createCapturer();
  const making = new Map(), failed = new Map();
  // The canvas page asks for project.js, then for every frame on it at once. The frames
  // reuse that scan instead of each scanning again; one it does not name scans afresh.
  let lastLoad = null;
  const load = () => (lastLoad = loadProject(project).catch(error => { lastLoad = null; throw error; }));
  const recent = () => lastLoad ?? load();

  /** A component thumbnail is stale once the component's file changed after it was made. */
  async function stale(id, file) {
    const component = (await recent()).components.find(item => componentThumbnailId(item.id) === id);
    if (!component || component.render) return false;
    const target = await resolveModule(project.projectDir, component.module);
    if (!target.file) return false;
    const [picture, source] = await Promise.all([stat(file), stat(target.file)]);
    return source.mtimeMs > picture.mtimeMs;
  }

  /** What a thumbnail id pictures: a screen, or a component in its frame. */
  async function thumbnailSource(id) {
    const find = ({ screens, components }) => screens.find(screen => screen.id === id) ?? componentFrames(components).find(frame => frame.id === id);
    return find(await recent()) ?? find(await load());
  }

  return {
    project,
    clientDir: CLIENT,

    /** Directories to watch; a change in any reloads the workspace (the components' folders included, so a changed component or prop shows at once). */
    watchTargets: () => [CLIENT, project.projectDir, ...componentWatchDirs(project)],

    locate(pathname) {
      const local = pathname.slice("/canvas".length) || "/";
      if (local === "/project.js") return { directory: project.projectDir, localPath: `/${path.basename(project.configFile)}`, project: true };
      const component = /^\/components\/([a-z0-9][a-z0-9-]*)\.js$/.exec(local);
      if (component) return { directory: CLIENT, localPath: local, component: component[1] };
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
      const { autoComponents, componentIssues, componentScan } = await load();
      const storage = DEFAULT_STORAGE_EXPORT.test(source) ? "" : `export const storageKey = ${JSON.stringify(DEFAULT_STORAGE_KEY)};\n`;
      return `${source}\n${storage}export const autoComponents = ${JSON.stringify(autoComponents)};\nexport const componentIssues = ${JSON.stringify(componentIssues)};\nexport const componentScan = ${JSON.stringify(componentScan)};\n`;
    },

    /** `bridge` goes into every framed screen; `tools` only into one framed by the canvas itself. */
    pageScripts(url, headers) {
      const bridge = url.searchParams.get("canvasScreen") === "1" ? '<script type="module" src="/canvas/bridge.js"></script>' : "";
      const framed = bridge && headers["sec-fetch-dest"] === "iframe";
      const tools = framed ? '<script type="module" src="/__dev/interface-kit.js"></script>' : "";
      return { bridge, tools };
    },

    /**
     * Make the thumbnail a request asks for, when it is missing and the screen exists.
     * Returns true when the file is there afterwards. Without a Chromium on this
     * computer it returns false and the canvas simply shows no picture.
     *   origin  where the dev server is, for example "http://localhost:4400"
     */
    async ensureThumbnail(pathname, origin) {
      const match = /^\/canvas\/thumbnails\/([^/]+)\.webp$/.exec(pathname);
      if (!match) return false;
      const id = match[1];
      const file = path.join(project.thumbnailsDir, `${id}.webp`);
      let had = false;
      try {
        await access(file); had = true;
        // A screen's picture stays until refreshed by hand; a component's is redrawn once its source changed.
        if (!id.startsWith("component-") || !(await stale(id, file).catch(() => false))) return true;
      } catch { /* missing: make it */ }
      // The old picture is better than none while a new one cannot be made.
      if (Date.now() - (failed.get(id) ?? 0) < 30000) return had;
      if (!making.has(id)) {
        making.set(id, (async () => {
          const source = await thumbnailSource(id);
          if (!source) return had;
          await mkdir(project.thumbnailsDir, { recursive: true });
          await writeFile(file, await shots.capture(source, origin));
          return true;
        })().catch(() => { failed.set(id, Date.now()); return had; }).finally(() => making.delete(id)));
      }
      return making.get(id);
    },

    /**
     * The script of one component frame. A component that cannot be built still
     * answers with a script: one that shows the error in the frame, where the
     * person looking at the canvas will see it.
     */
    async componentModule(id) {
      try {
        const { bundleComponent } = await import("./component-bundle.js");
        const known = lastLoad && (await lastLoad.catch(() => null))?.components;
        const loaded = known?.some(item => item.id === id) ? await lastLoad : await load();
        return await bundleComponent(project, id, { components: loaded.components, wrapper: loaded.componentWrapper });
      } catch (error) {
        return componentErrorModule(`Component "${id}" could not be built.`, error?.message ?? String(error));
      }
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
