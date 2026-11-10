// Standalone development server for the canvas: `pnpm dev`, then open /canvas/.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createCanvasHost } from "../src/server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canvas = createCanvasHost({ root, config: "dev/canvas/screens.js" });
const SITE = path.join(root, "dev", "site");
const PROTOTYPES = path.join(root, "dev", "prototypes");
const port = Number(process.env.PORT ?? 4400);
// /prototypes/<name>.js and .css are built on request from dev/prototypes/<name>.jsx.
async function prototypeAsset(file) {
  const stem = file.replace(/\.(js|css)$/, "");
  const result = await build({
    entryPoints: [path.join(PROTOTYPES, `${stem}.jsx`)], bundle: true, write: false, outdir: path.join(PROTOTYPES, "out"),
    format: "esm", jsx: "automatic", nodePaths: [path.join(PROTOTYPES, "node_modules")], logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"' }
  });
  const output = result.outputFiles.find((item) => path.basename(item.path) === file);
  if (!output) throw new Error("no such prototype asset");
  return output.text;
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://x").pathname);
  try {
    if (pathname === "/canvas" || pathname.startsWith("/canvas/")) {
      await canvas.ensureThumbnail(pathname, `http://${request.headers.host}`);
      const { directory, localPath, project, component } = canvas.locate(pathname);
      if (component) {
        response.writeHead(200, { "content-type": TYPES[".js"] }).end(await canvas.componentModule(component));
        return;
      }
      if (project) {
        const module = await canvas.projectModule();
        response.writeHead(200, { "content-type": TYPES[".js"] }).end(module);
        return;
      }
      let file = path.join(directory, localPath === "/" || localPath === "" ? "index.html" : localPath);
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(body);
      return;
    }
    if (pathname.startsWith("/prototypes/")) {
      const name = path.basename(pathname);
      const text = await prototypeAsset(name);
      response.writeHead(200, { "content-type": TYPES[path.extname(name)] ?? "text/javascript; charset=utf-8" }).end(text);
      return;
    }
    const file = path.join(SITE, pathname);
    if (!file.startsWith(SITE + path.sep)) throw new Error("forbidden");
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    if (response.headersSent) {
      response.end();
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(port, () => console.log(`http://localhost:${port}/canvas/`));
