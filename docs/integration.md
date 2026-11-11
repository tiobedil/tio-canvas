# Using the canvas with your own dev server

This page is for developers who want to wire the canvas into an existing dev
server, or who work on the package itself. If you just want to try the canvas,
the [README](../README.md) has a beginner path.

The canvas is plain HTML, CSS and JavaScript. Its dependencies (`interface-kit`,
`react`, `react-dom`, `esbuild`) exist to build the optional development-only
Interface Kit overlay; `esbuild` also builds the frames of your components. The behaviour of the canvas is described
in [`exploration-canvas.md`](exploration-canvas.md).

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
  { id: 'home', kind: 'production', title: 'Home',
    src: '/', x: 160, y: 160, width: 1440, height: 900, preset: 'laptop' },
];
```

- `id` is stable: saved layouts refer to it. `kind` is `production` or `prototype`.
  Both are checked and a mistake throws.
- `preset` is a key of the device presets (`laptop`, `iphone-16`, `ipad-air`, …; see `client/registry.js`).
- `storageKey` is optional. Two projects served from one origin (for example
  `localhost:4321`) must not share a key, or they overwrite each other's layout.

Page thumbnails live in `dev/canvas/thumbnails/<id>.webp` and are made for you (see Thumbnails below).

### 2. Serve it from your dev server

The package does not own a server. Your dev server asks it where things are:

```js
import { createCanvasHost } from '@tio-canvas/canvas/server';
const canvas = createCanvasHost({ root, config: 'dev/canvas/screens.js' });

// For a request under /canvas:
const { directory, localPath, project, component } = canvas.locate(pathname);   // which file to read
//   if (project) send `await canvas.projectModule()` as text/javascript instead of the file
//   if (component) send `await canvas.componentModule(component)` as text/javascript instead of the file
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

This writes the canvas, your screens and components as `project.js`, one script
per component, only the thumbnails of screens and components that exist, and a
`noindex` tag. Do not link to it from a public page.

### 4. Thumbnails

The Add pages panel shows a small picture of each page and each component (about
1 KB, 96px on the short side; a component's file is `component-<id>.webp`). The dev server makes a missing one by itself the first time the
canvas asks for it, so a page you add to `screens.js` gets its thumbnail on the
next load. Pass the request to the host before you serve a file under `/canvas`:

```js
await canvas.ensureThumbnail(pathname, `http://${request.headers.host}`);
```

It starts one headless Chromium on demand, takes the pictures one at a time, and
stops it a few seconds later. It uses `$CHROME_BIN`, a Chromium from the
Playwright cache (`~/Library/Caches/ms-playwright`), or an installed Chrome. With
none of them the panel just shows no picture. A thumbnail is made once and kept;
to refresh them after a page changes, with the dev server running:

```bash
npx tio-canvas thumbnails http://localhost:4321            # all of them
npx tio-canvas thumbnails http://localhost:4321 --missing
npx tio-canvas thumbnails --check          # fails when a screen has no thumbnail
```

Options: `--config <file>`, `--out <dir>`.

## Components

The canvas can also show one component alone in a frame. The frame is resized by
hand (it has no device presets), opens fullscreen and has its own dark mode,
like a page. Inside it, on the right, sit the dials: one control for every prop,
variant and state you list. They are added from the same panel as pages (Cmd+K), in the
Components tab.

The canvas finds your components by itself and reads their props to build the
dials. You only write something down when it cannot be worked out. It never shows
its own components.

### 1. Finding components by themselves

In development the canvas scans these folders, relative to the project root:
`src/components`, `components`, `app/components`, `src/app/components`, `src/ui`,
`ui`, `src/shared/components` and `src/lib/components`. Add your own, and leave
files out, in the config file (both are lists of paths, and the file still imports nothing):

```js
export const componentDirs = ['src/widgets', 'packages/ui/src'];   // added to the folders above
export const componentExclude = ['src/components/legacy'];         // files or folders to leave alone
```

- **What counts as a component.** A `.tsx` or `.jsx` file (not a test, story or
  `.d.ts`, not marked server-only) whose export is written as a React component: a
  capitalised function, an arrow function, a class that extends `Component`, or a
  `forwardRef` / `memo` around one. With TypeScript installed in the project, any
  other export that TypeScript proves is a function returning an element counts too.
- **Dials come from the props.** With TypeScript, a union of literals becomes a
  choice, `boolean` a switch, `string` a text field, `number` a number field, and
  `children` a text field. Defaults come from the destructured parameters
  (`{ variant = 'ghost' }`). Functions, objects and the props an HTML element adds
  (`onClick`, `aria-*`) get no dial. TypeScript is the project's own, found from its
  root, never bundled. Without it, components are listed with no dials.
- **Changes show at once.** The component folders are part of `watchTargets()`, so a
  new component, a changed prop or an edit to the source reloads the workspace and
  the list and the dials are read again.
- A component you list by hand (below) is never listed twice, and the scan leaves
  it as you wrote it.

When something cannot be settled, the Components tab shows one notice, "N things
to check in your components", with a button that opens a prompt for your coding
agent. It covers every case at once, and the notice is gone as soon as the config
matches the source. The notice only appears for something certain:

- a listed component whose `module` file is gone, or no longer exports `export`;
- a listed component (without `render`) whose `controls` miss a prop the
  component has, or name a prop it no longer has. To leave a prop out on purpose,
  add `ignore: ['propName']` to the entry;
- a file with functions that may be components, but whose return type TypeScript
  cannot work out (list it by hand, or add it to `componentExclude`);
- TypeScript is not installed, so no dials could be built.

### 2. List a component by hand

Do this for a component the scan cannot draw as it stands (it needs a provider or
a `render` function), or to choose its dials yourself. Add `components` to the same config file as `screens`. The file still imports
nothing: you name the file that exports the component, and the canvas does the
importing when it builds the frame.

```js
export const components = [
  {
    id: 'button',                          // stable; lowercase letters, digits and dashes
    title: 'Button',
    group: 'Actions',                      // the heading it is listed under (default: Components)
    module: '../../src/components/Button.jsx',   // relative to this config file, or any path your project resolves
    export: 'Button',                      // the export to draw (default: the default export)
    controls: {
      variant: ['primary', 'secondary', 'ghost'],   // one of these; the first is the default
      size: ['md', 'sm'],
      disabled: false,                     // a switch
      children: 'Save changes',            // a text field
      radius: { type: 'number', min: 0, max: 24, step: 1, value: 8 },   // a slider
    },
  },
];
```

- **Controls are the component's real props.** Each key of `controls` is passed
  to the component under that name. List what the component actually accepts:
  its props, its variants and its states (`disabled`, `open`, `loading`, …).
  Add a control when you want one more thing to try.
- Short forms: an array is a choice, `true`/`false` a switch, a string a text
  field, a number a number field. The long form is
  `{ type: 'select' | 'boolean' | 'text' | 'number', value, label, options, min, max, step }`;
  a number with both `min` and `max` is a slider. Options may be strings, numbers
  or booleans, or `{ value, label }`.
- `ignore` is a list of prop names the controls leave out on purpose, so the
  notice does not ask for them.
- `width` and `height` set the size a new frame starts with (1100 × 600).
- `fill: true` stretches the component to the frame's width (a navigation bar,
  say). Without it the component keeps its own size and is centred in the room
  the dials leave (in the whole frame once they are minimized).
- `framework` is `'react'` (the default) or `'dom'`. A `dom` component is a
  function that returns a DOM node.
- `render` replaces the default drawing, for a component that needs more than
  its props: `render: (exports, props, createElement) => createElement(exports.Card, props, createElement(exports.CardTitle, null, props.title))`.
  `exports` is everything `module` exports. Return a React element, or a DOM node.
  There is no JSX here, because the browser also loads this file as it stands.

What a frame shows is saved with the layout, per frame, so the same component can
be on the canvas several times with different props.

### 3. Styles and theme

A frame is an empty page, so it needs your styles. Styles a component imports
(`import './button.css'`, CSS modules) come along by themselves. For global
styles, name the stylesheets your dev server already serves:

```js
export const componentPreview = {
  styles: ['/assets/site.css'],            // loaded into every component frame
  background: 'var(--page-background)',    // optional: the frame's background
  theme(dark, document) {                  // optional: how your site turns dark
    document.documentElement.classList.toggle('dark', dark);
  },
};
```

Without `theme`, the frame's theme button sets `color-scheme`, toggles the
`dark` class and sets `data-theme="dark" | "light"` on `<html>`.

### 4. Serve them

One more branch in your dev server (see the snippet in "Serve it from your dev
server"): a request for `/canvas/components/<id>.js` is answered with
`await canvas.componentModule(id)`. `locate()` names the id as `component`.

The script is built on request with esbuild, from your project: JSX and
TypeScript work, and `react` and `react-dom` are taken from your project, so the
component and the frame share one copy of React. A component that cannot be
built shows the error in its frame. `copyCanvas` writes one script per component
into `<target>/components/`.

Limits: the frame is not your app. A component that needs your framework's
runtime (a router, a server component, `next/image`) or a context provider needs
a `render` function that supplies it, or will not draw.

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
