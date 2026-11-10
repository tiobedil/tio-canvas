// Runs inside a component frame (client/component.html), bundled with one
// component by ./component-bundle.js. It draws the component, then draws it again
// whenever the canvas sends new props or a theme.
import { normalizeControls, componentProps } from "../client/registry.js";

/** What a project gets when it names no theme function: the common dark-mode hooks. */
function defaultTheme(dark, doc) {
  doc.documentElement.classList.toggle("dark", dark);
  doc.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function startComponent({ id, config, exports, react }) {
  const definition = config.components.find(component => component.id === id);
  const preview = config.componentPreview ?? {};
  const root = document.getElementById("component-root");
  const controls = normalizeControls(definition.controls);
  let props = componentProps(controls), reactRoot = null, drawn = false;

  for (const href of preview.styles ?? []) {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    document.head.append(link);
  }
  if (preview.background) document.body.style.background = preview.background;
  root.toggleAttribute("data-fill", definition.fill === true);

  function fail(error) {
    const box = document.createElement("pre");
    box.setAttribute("role", "alert");
    box.style.cssText = "margin:0;padding:16px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:#b42318;";
    box.textContent = `${definition.title} could not be drawn.\n\n${error?.stack ?? error}`;
    reactRoot?.unmount(); reactRoot = null;
    root.replaceChildren(box);
  }

  function draw() {
    drawn = true;
    try {
      const name = definition.export ?? "default";
      let output;
      if (definition.render) output = definition.render(exports, props, react?.createElement);
      else if (typeof exports[name] !== "function") throw new Error(`"${definition.module}" has no export "${name}". Set "export" on the component, or give it a render function.`);
      else output = react ? react.createElement(exports[name], props) : exports[name](props);
      if (output instanceof Node) { reactRoot?.unmount(); reactRoot = null; root.replaceChildren(output); }
      else if (react && output !== null && typeof output === "object") (reactRoot ??= react.createRoot(root)).render(output);
      else root.textContent = output == null ? "" : String(output);
    } catch (error) { fail(error); }
  }

  function setTheme(dark) {
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    (preview.theme ?? defaultTheme)(dark, document);
  }

  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== "tio-canvas:component") return;
    props = componentProps(controls, event.data.props);
    setTheme(event.data.dark === true);
    draw();
  });
  window.addEventListener("error", event => { if (!drawn || !root.childNodes.length) fail(event.error ?? event.message); });

  // Inside the canvas the first drawing waits for the saved props, so a frame
  // never flashes its defaults. Opened on its own (a thumbnail, a new tab), or
  // when the canvas stays silent, it draws the defaults.
  if (parent === window) {
    setTheme(matchMedia("(prefers-color-scheme: dark)").matches); draw();
    // For its thumbnail a component is scaled to fill the picture: at its real size a button would be a dot.
    if (new URLSearchParams(location.search).has("thumbnail")) requestAnimationFrame(() => {
      const box = root.getBoundingClientRect(), side = Math.max(box.width, box.height);
      if (side > 0) root.style.zoom = String(Math.min(4, (Math.min(innerWidth, innerHeight) - 48) / side));
    });
    return;
  }
  parent.postMessage({ type: "tio-canvas:component-ready" }, location.origin);
  setTimeout(() => { if (!drawn) draw(); }, 400);
}
