// Standalone development server for the canvas: `pnpm dev`, then open /canvas/.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvasHost } from "../src/server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canvas = createCanvasHost({ root, config: "dev/canvas/screens.js" });
const SITE = path.join(root, "dev", "site");
const port = Number(process.env.PORT ?? 4400);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://x").pathname);
  try {
    if (pathname === "/canvas" || pathname.startsWith("/canvas/")) {
      const { directory, localPath, project } = canvas.locate(pathname);
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
    const file = path.join(SITE, pathname);
    if (!file.startsWith(SITE + path.sep)) throw new Error("forbidden");
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(port, () => console.log(`http://localhost:${port}/canvas/`));
