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
 * One component as one browser script: the project's config (for its render
 * function), the file that exports the component, and the small runtime that
 * draws it and listens for the dials. Styles the component imports are added to
 * the page by the script itself, so a frame needs this one file only.
 *
 * React and react-dom are resolved from the project, never from this package:
 * a component and the root that draws it must share one copy of React.
 */
export async function bundleComponent(project, id, { production = false } = {}) {
  const { components } = await loadProject(project);
  const component = components.find(item => item.id === id);
  if (!component) throw new Error(`No canvas component "${id}" in ${project.configFile}.`);
  const react = (component.framework ?? "react") === "react";
  const entry = [
    `import * as config from ${JSON.stringify(project.configFile)};`,
    `import * as exports from ${JSON.stringify(component.module)};`,
    `import { startComponent } from ${JSON.stringify(RUNTIME)};`,
    react ? `import { createElement } from "react";\nimport { createRoot } from "react-dom/client";` : "",
    `startComponent({ id: ${JSON.stringify(id)}, config, exports, react: ${react ? "{ createElement, createRoot }" : "null"} });`,
  ].join("\n");
  const result = await build({
    stdin: { contents: entry, resolveDir: project.projectDir, sourcefile: `canvas-component-${id}.js`, loader: "js" },
    bundle: true, write: false, outdir: path.join(project.projectDir, ".canvas-out"), platform: "browser", format: "esm",
    jsx: "automatic", loader: { ".js": "jsx", ...ASSETS }, logLevel: "silent", minify: production,
    define: { "process.env.NODE_ENV": production ? '"production"' : '"development"' },
  });
  const script = result.outputFiles.find(file => file.path.endsWith(".js")).text;
  const css = result.outputFiles.filter(file => file.path.endsWith(".css")).map(file => file.text).join("\n");
  if (!css) return script;
  return `{ const style = document.createElement("style"); style.dataset.canvasComponent = ""; style.textContent = ${JSON.stringify(css)}; document.head.append(style); }\n${script}`;
}
