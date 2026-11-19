import path from "node:path";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { loadProject } from "./project.js";

const RUNTIME = fileURLToPath(new URL("./component-runtime.js", import.meta.url));
const ASSETS = Object.fromEntries([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".woff", ".woff2", ".ttf"].map(extension => [extension, "dataurl"]));

/** A script that shows `message` in the frame instead of the component. */
export function componentErrorModule(title, message) {
  return `const box = document.createElement("pre");
box.setAttribute("role", "alert");
box.style.cssText = "margin:0;padding:16px;max-width:100%;max-height:100%;overflow:auto;box-sizing:border-box;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:#b42318;place-self:start;";
box.textContent = ${JSON.stringify(`${title}\n\n${message}`)};
(document.getElementById("component-root") ?? document.body).replaceChildren(box);
`;
}

/**
 * One component as one browser script (in development, built on request): the project's config (for its render
 * function), the file that exports the component, and the small runtime that
 * draws it and listens for the dials. Styles the component imports are added to
 * the page by the script itself, so a frame needs this one file only.
 *
 * React and react-dom are resolved from the project, never from this package:
 * a component and the root that draws it must share one copy of React.
 *
 * `components` is the project's list when the caller already has it, so a page
 * of frames does not scan the project once per frame.
 */
/** The script that starts one component: the code esbuild bundles for its frame. */
function entrySource(project, component, wrapper) {
  const react = (component.framework ?? "react") === "react";
  return [
    `import * as config from ${JSON.stringify(project.configFile)};`,
    `import * as exports from ${JSON.stringify(component.module)};`,
    `import { startComponent } from ${JSON.stringify(RUNTIME)};`,
    // componentPreview.wrapper: a file whose default export wraps every React component (its providers).
    react && wrapper ? `import Wrapper from ${JSON.stringify(wrapper)};` : `const Wrapper = null;`,
    react ? `import { createElement } from "react";\nimport { createRoot } from "react-dom/client";` : "",
    `startComponent({ id: ${JSON.stringify(component.id)}, config, definition: ${component.auto ? JSON.stringify(component) : "null"}, exports, react: ${react ? "{ createElement, createRoot }" : "null"}, Wrapper });`,
  ].join("\n");
}

const options = production => ({
  bundle: true, platform: "browser", format: "esm", jsx: "automatic", loader: { ".js": "jsx", ...ASSETS }, logLevel: "silent", minify: production,
  define: { "process.env.NODE_ENV": production ? '"production"' : '"development"' },
});

/** Styles the component imports go into the page from its own script, so a frame loads one file. */
const withStyles = (script, css) => css ? `{ const style = document.createElement("style"); style.dataset.canvasComponent = ""; style.textContent = ${JSON.stringify(css)}; document.head.append(style); }\n${script}` : script;

export async function bundleComponent(project, id, { production = false, components, wrapper } = {}) {
  if (!components || wrapper === undefined) ({ components, componentWrapper: wrapper } = await loadProject(project));
  const component = components.find(item => item.id === id);
  if (!component) throw new Error(`No canvas component "${id}" in ${project.configFile}.`);
  const result = await build({
    ...options(production),
    stdin: { contents: entrySource(project, component, wrapper), resolveDir: project.projectDir, sourcefile: `canvas-component-${id}.js`, loader: "js" },
    write: false, outdir: path.join(project.projectDir, ".canvas-out"),
  });
  const script = result.outputFiles.find(file => file.path.endsWith(".js")).text;
  return withStyles(script, result.outputFiles.filter(file => file.path.endsWith(".css")).map(file => file.text).join("\n"));
}

/**
 * Every component for a production build, in one pass: `<id>.js` per component,
 * plus shared chunks, so React and anything else they share is shipped once
 * instead of once per component. Returns [{ path, text }] relative to `outdir`.
 */
export async function bundleComponents(project, { components, wrapper } = {}) {
  if (!components || wrapper === undefined) ({ components, componentWrapper: wrapper } = await loadProject(project));
  if (!components.length) return [];
  const outdir = path.join(project.projectDir, ".canvas-out");
  const prefix = "canvas-component:";
  const result = await build({
    ...options(true),
    entryPoints: components.map(component => ({ in: `${prefix}${component.id}`, out: component.id })),
    outdir, write: false, splitting: true, metafile: true, chunkNames: "chunks/[name]-[hash]",
    plugins: [{
      name: "canvas-components",
      setup(build) {
        build.onResolve({ filter: /^canvas-component:/ }, args => ({ path: args.path.slice(prefix.length), namespace: "canvas-component" }));
        build.onLoad({ filter: /.*/, namespace: "canvas-component" }, args => ({ contents: entrySource(project, components.find(item => item.id === args.path), wrapper), resolveDir: project.projectDir, loader: "js" }));
      },
    }],
  });
  const text = new Map(result.outputFiles.map(file => [path.relative(outdir, file.path).split(path.sep).join("/"), file.text]));
  const files = [];
  for (const [output, meta] of Object.entries(result.metafile.outputs)) {
    const name = path.relative(outdir, path.resolve(output)).split(path.sep).join("/");
    if (name.endsWith(".css")) continue;
    const css = meta.entryPoint && meta.cssBundle ? text.get(path.relative(outdir, path.resolve(meta.cssBundle)).split(path.sep).join("/")) : "";
    files.push({ path: name, text: meta.entryPoint ? withStyles(text.get(name), css) : text.get(name) });
  }
  return files;
}
