# @tio-canvas/canvas

A private exploration canvas for a web project. Pages of the project are laid out
as real, live documents (same-origin iframes) on a finite board that you can pan,
zoom, arrange, resize to device presets, rename, annotate with arrows and text,
and preview full screen. It is a development tool: it adds nothing to what a
visitor of the project downloads unless the project chooses to publish `/canvas`.

Plain HTML, CSS and JavaScript. No framework, no bundler for the canvas itself.
The only dependencies (`interface-kit`, `react`, `react-dom`, `esbuild`) exist to
build the optional development-only Interface Kit overlay and are never sent to
a browser except by the dev server, as one script, inside a framed screen.

The behaviour of the canvas is described in [`docs/exploration-canvas.md`](docs/exploration-canvas.md).

## Install

```bash
pnpm add -D @tio-canvas/canvas     # or: npm i -D @tio-canvas/canvas
```

## Use it in a project

### 1. List your screens

Create `dev/canvas/screens.js` (any path works; pass it as `config`). It is a
standalone ES module that the **browser loads as it stands**, so it must not
import anything.

```js
export const storageKey = 'my-project:canvas:v1'; // where the browser keeps the saved layout
export const screens = [
  { id: 'home', kind: 'production', title: 'Home', description: 'The live homepage.',
    src: '/', x: 160, y: 160, width: 1440, height: 900, preset: 'laptop' },
];
```

- `id` is stable: saved layouts refer to it. `kind` is `production` or `prototype`.
  `description` is required. Both are checked and a mistake throws.
- `preset` is a key of the device presets (`laptop`, `iphone-16`, `ipad-air`, …; see `client/registry.js`).
- `storageKey` is optional. Two projects served from one origin (for example
  `localhost:4321`) must not share a key, or they overwrite each other's layout.

Page thumbnails live in `dev/canvas/thumbnails/<id>.webp` (see `tio-canvas thumbnails`).

### 2. Serve it from your dev server

The package does not own a server. Your dev server asks it where things are:

```js
import { createCanvasHost } from '@tio-canvas/canvas/server';
const canvas = createCanvasHost({ root, config: 'dev/canvas/screens.js' });

// For a request under /canvas:
const { directory, localPath, project } = canvas.locate(pathname);   // which file to read
//   if (project) send `await canvas.projectModule()` as text/javascript instead of the file
// For an HTML page in development:
const { bridge, tools } = canvas.pageScripts(url, request.headers); // scripts to add before </body>
// For GET /__dev/interface-kit.js:
const script = await canvas.interfaceKitBundle();
// Reload the workspace when any of these change:
for (const dir of canvas.watchTargets()) watch(dir, { recursive: true }, notify);
```

`tio-web`'s `build/serve.mjs` is the reference integration.

### 3. Publish it with your site (optional)

```js
import { copyCanvas } from '@tio-canvas/canvas/build';
const screens = await copyCanvas({ root, config: 'dev/canvas/screens.js', target: 'dist/canvas' });
```

This writes the canvas, your screens as `project.js`, only the thumbnails of
screens that exist, and a `noindex` tag. Do not link to it from a public page.

### 4. Thumbnails

With the dev server running:

```bash
npx tio-canvas thumbnails http://localhost:4321 --missing
npx tio-canvas thumbnails --check          # fails when a screen has no thumbnail
```

Options: `--config <file>`, `--out <dir>`. It uses a Chromium from the Playwright
cache (`~/Library/Caches/ms-playwright`) or `CHROME_BIN`.

## Updating

Releases follow semver. A project updates with `pnpm update @tio-canvas/canvas`.
Nothing else needs to change as long as the major version stays the same.

## Development

```bash
pnpm install
pnpm test        # unit tests and a smoke test of the server and build helpers
```

`client/` is served at `/canvas/`. Its files are the canvas exactly as it ran
inside `tio-web` (the commit it was extracted from is in the first commit
message), with two changes: `screens.js` now reads `project.js` and
`registry.js`, and `canvas.js` takes its storage key from the project.

Publishing: `npm login`, then `npm publish` (the scope is public through
`publishConfig`). Bump the version first and tag it `vX.Y.Z`.
