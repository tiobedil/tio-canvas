import path from "node:path";
import { pathToFileURL } from "node:url";
import { scanComponents } from "./component-scan.js";
import { validateScreens, validateComponents, presets, screenKinds } from "../client/registry.js";

export const DEFAULT_CONFIG = "dev/canvas/screens.js";
export const DEFAULT_STORAGE_KEY = "tio-canvas:v1";

/**
 * Where a project keeps what is its own: the list of screens and of components
 * (a standalone ES module the browser loads as it stands, so it must import
 * nothing) and the thumbnails beside it.
 */
export function resolveProject({ root = process.cwd(), config = DEFAULT_CONFIG, thumbnails } = {}) {
  const configFile = path.resolve(root, config);
  return {
    root: path.resolve(root),
    configFile,
    projectDir: path.dirname(configFile),
    thumbnailsDir: path.resolve(root, thumbnails ?? path.join(path.dirname(config), "thumbnails"))
  };
}

let loadCount = 0;

/**
 * Import the project's config afresh and refuse a screen or component the canvas cannot show.
 * `components` is the listed ones plus the ones found by scanning; `autoComponents` the found ones alone.
 */
export async function loadProject(project, { scan = true } = {}) {
  // A unique query per call defeats the module cache; Date.now() alone can repeat within one millisecond.
  const module = await import(`${pathToFileURL(project.configFile).href}?load=${Date.now()}-${++loadCount}`);
  if (!Array.isArray(module.screens)) throw new Error(`${project.configFile} must export "screens", an array.`);
  validateScreens(module.screens);
  const listed = module.components ?? [];
  validateComponents(listed);
  for (const name of ["componentDirs", "componentExclude"]) {
    if (module[name] !== undefined && !(Array.isArray(module[name]) && module[name].every(item => typeof item === "string"))) throw new Error(`${project.configFile} must export "${name}" as an array of folder names.`);
  }
  // The components the scan finds join the ones the config lists. A scan that fails never takes the canvas down.
  let auto = [], issues = [];
  if (scan) {
    try { ({ auto, issues } = await scanComponents(project, { dirs: module.componentDirs, exclude: module.componentExclude, manual: listed })); }
    catch (error) { console.warn(`tio-canvas: scanning for components failed: ${error?.message ?? error}`); }
  }
  return { screens: module.screens, components: [...listed, ...auto], autoComponents: auto, componentIssues: issues, storageKey: module.storageKey ?? DEFAULT_STORAGE_KEY, presets, screenKinds };
}
