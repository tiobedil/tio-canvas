# Tio Canvas

A private board for your website. It shows the pages of your site side by side,
as real, working pages, so you can look at them together, compare them, move
them around, and add notes. It runs only on your own computer while you work.
Visitors of your site never see it.

It can also show a single component (a button, a card) alone in a frame, with a
control beside it for every option the component has, so you can try them all
without touching code. See [Components](docs/integration.md#components).

## Install it

Pick one way.

### Option 1: Ask an AI agent (easiest)

Open your project in a coding agent (Claude Code, Cursor, Codex, and so on),
paste this, and let it work:

```text
Install the @tio-canvas/canvas package in this project as a development tool.

1. Add it as a dev dependency with this project's package manager: @tio-canvas/canvas.
2. Read node_modules/@tio-canvas/canvas/docs/integration.md and follow its "Use it in a project" section.
3. Create dev/canvas/screens.js listing the real pages of this project (id, kind, title, src, x, y, width, height, preset). Give storageKey a name unique to this project. The file must not import anything.
4. Wire the dev server: serve the package client at /canvas with createCanvasHost from "@tio-canvas/canvas/server" (locate, projectModule, pageScripts, interfaceKitBundle, watchTargets). Do this for development only.
5. Do not link /canvas from any public page, and do not publish it unless I ask.
6. Start the dev server, open /canvas, and confirm every screen loads. Tell me the URL and anything you could not verify.
```

### Option 2: Install it yourself

This is for a website made of plain files (`index.html`, `about.html`, and so
on) in one folder. If your site is built with a tool like Next.js, Vite or
WordPress, use Option 1.

1. **Install Node.js.** It is a free program that runs the canvas on your
   computer. Download the version marked **LTS** from [nodejs.org](https://nodejs.org)
   and install it like any other app. You need version 22 or newer.
2. **Open the Terminal in your project folder.** The Terminal is a window where
   you type commands. On a Mac, right-click the folder in Finder and choose
   "New Terminal at Folder". On Windows, open the folder, click the address
   bar, type `cmd`, and press Enter.
3. **Check that Node.js works.** Type this and press Enter. You should see a
   number like `v22.12.0`.
   ```bash
   node -v
   ```
4. **Install the canvas.** Type these one at a time and press Enter after each.
   The first one creates a small list of what your project uses
   (`package.json`). The second one adds the canvas.
   ```bash
   npm init -y
   npm install --save-dev @tio-canvas/canvas
   ```
5. **Download two files** and put them in the same folder as your `index.html`
   (open each link, then save the page with the same name):
   - [`canvas-server.mjs`](https://raw.githubusercontent.com/tiobedil/tio-canvas/main/client/templates/canvas-server.mjs) starts your site with the canvas.
   - [`canvas-screens.mjs`](https://raw.githubusercontent.com/tiobedil/tio-canvas/main/client/templates/canvas-screens.mjs) lists the pages the canvas shows.
6. **Tell the canvas which pages to show.** Open `canvas-screens.mjs` in a text
   editor (Notepad, or a free editor such as Visual Studio Code; not Word). Each
   block between `{` and `}` is one page. Change `src` to the address of your
   page, for example `/about.html`. Copy a whole block to add another page.
   The notes at the top of the file explain every field. Save the file.
7. **Start it.** In the Terminal, type this and press Enter. Leave the window
   open, because closing it stops the canvas.
   ```bash
   node canvas-server.mjs
   ```
8. **Open the canvas.** Go to <http://localhost:4400/canvas/> in your browser.
   To stop it, click the Terminal and press Ctrl+C.

If a page shows "Not found", its `src` in `canvas-screens.mjs` does not match a
real file name. If you see a red error in the Terminal, read the last line: it
names the file and the problem. Still stuck? Use Option 1.

The same steps, with copy and download buttons, are in the canvas itself under
**More → Install in a project**.

## Update it

The canvas shows its version at the bottom of the **More** menu. A magenta dot
appears there when a newer version is out. Click **Update** for steps, or run
this in the Terminal in your project folder, then start the canvas again:

```bash
npm install --save-dev @tio-canvas/canvas@latest
```

## Something more advanced?

Using your own dev server, publishing the canvas with your site, page
thumbnails, and working on the package itself are covered in
[`docs/integration.md`](docs/integration.md).

## License

MIT
