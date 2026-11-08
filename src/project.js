import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateScreens, presets, screenKinds } from "../client/registry.js";

export const DEFAULT_CONFIG = "dev/canvas/screens.js";
export const DEFAULT_STORAGE_KEY = "tio-canvas:v1";

/**
 * Where a project keeps what is its own: the list of screens (a standalone ES
 * module the browser loads as it stands, so it must import nothing) and the page
 * thumbnails beside it.
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

/** Import the project's config afresh and refuse a screen the canvas cannot show. */
export async function loadProject(project) {
  const module = await import(`${pathToFileURL(project.configFile).href}?load=${Date.now()}`);
  if (!Array.isArray(module.screens)) throw new Error(`${project.configFile} must export "screens", an array.`);
  validateScreens(module.screens);
  return { screens: module.screens, storageKey: module.storageKey ?? DEFAULT_STORAGE_KEY, presets, screenKinds };
}
