// Starts your site on your own computer, with the canvas at /canvas.
// Run it with:  node canvas-server.mjs
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createCanvasHost } from "@tio-canvas/canvas/server";

const root = process.cwd();
const port = Number(process.env.PORT ?? 4400);
const canvas = createCanvasHost({ root, config: "canvas-screens.mjs" });
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};
const send = (response, body, file) =>
  response.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" }).end(body);

createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname === "/__dev/interface-kit.js") {
      response.writeHead(200, { "content-type": types[".js"] }).end(await canvas.interfaceKitBundle());
      return;
    }
    if (pathname === "/canvas" || pathname.startsWith("/canvas/")) {
      const { directory, localPath, project } = canvas.locate(pathname);
      if (project) {
        response.writeHead(200, { "content-type": types[".js"] }).end(await canvas.projectModule());
        return;
      }
      let file = path.join(directory, localPath === "/" ? "index.html" : localPath);
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      send(response, await readFile(file), file);
      return;
    }
    let file = path.join(root, pathname);
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error("outside the project");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    let body = await readFile(file);
    if (path.extname(file) === ".html") {
      const { bridge, tools } = canvas.pageScripts(url, request.headers);
      const html = body.toString("utf8");
      body = html.includes("</body>") ? html.replace("</body>", `${bridge}${tools}</body>`) : html + bridge + tools;
    }
    send(response, body, file);
  } catch {
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(port, () => console.log(`Canvas is ready: http://localhost:${port}/canvas/`));
