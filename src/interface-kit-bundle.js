import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Interface Kit 0.1.3 exposes no positioning API. Patch its development-only
// floating panel at bundle time, failing if an upgrade changes the seam.
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Interface Kit positioning patch no longer matches the installed version.');
  return source.replace(before, after);
}

const positioning = {
  name: 'interface-kit-positioning',
  setup(builder) {
    builder.onLoad({ filter: /interface-kit\/dist\/react\.js$/ }, async args => {
      let source = await readFile(args.path, 'utf8');
      // Keep Radix popovers inside Interface Kit's shadow root: its styles and
      // selection exclusions otherwise do not apply to the picker.
      source = replaceOnce(source, '  return /* @__PURE__ */ jsx20(dist_exports2.Portal, { children:', '  const container = usePortalContainer();\n  return /* @__PURE__ */ jsx20(dist_exports2.Portal, { container, children:');
      const start = source.indexOf('  const handlePointerDown = useCallback2(\n', source.indexOf('function FloatingPanel()'));
      const end = source.indexOf('  const handleCopy = async () => {', start);
      if (start < 0 || end < 0) throw new Error('Interface Kit drag handler not found.');
      source = source.slice(0, start) + `  const handlePointerDown = useCallback2((e) => {
    if (e.button !== 0 || (isExpanded && e.target.closest('button'))) return;
    const startX = e.clientX, startY = e.clientY;
    const startLeft = left.get(), startTop = top.get();
    const size = isExpanded ? PANEL_WIDTH : COLLAPSED_SIZE;
    let dragged = false;
    const el = containerRef.current;
    if (el) el.style.cursor = 'grabbing';
    const move = event => {
      const dx = event.clientX - startX, dy = event.clientY - startY;
      if (!dragged && Math.hypot(dx, dy) < 4) return;
      dragged = true;
      left.set(clamp(startLeft + dx, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerWidth - EDGE_MARGIN - size)));
      if (!isExpanded) top.set(clamp(startTop + dy, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerHeight - EDGE_MARGIN - COLLAPSED_SIZE)));
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      dragCleanupRef.current = null;
      if (el) el.style.cursor = '';
    };
    const finish = open => {
      cleanup();
      if (!dragged) { if (open && !isExpanded) handleOpen(); return; }
      let right = left.get() + size / 2 >= window.innerWidth / 2;
      let bottom = top.get() + COLLAPSED_SIZE / 2 >= window.innerHeight / 2;
      if (!isExpanded) ({ right, bottom } = window.__interfaceKitCorner.claim(right, bottom));
      if (isExpanded) setPanelSide(right ? 'right' : 'left');
      animateMotionValue(left, right ? Math.max(EDGE_MARGIN, window.innerWidth - EDGE_MARGIN - size) : EDGE_MARGIN, springTransition);
      animateMotionValue(top, !isExpanded && bottom ? Math.max(EDGE_MARGIN, window.innerHeight - EDGE_MARGIN - COLLAPSED_SIZE) : EDGE_MARGIN, springTransition);
    };
    const up = () => finish(true), cancel = () => finish(false);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    dragCleanupRef.current = cleanup;
  }, [isExpanded, left, top, handleOpen, setPanelSide]);
` + source.slice(end);
      source = replaceOnce(source, `    const targetX = (_a = saved == null ? void 0 : saved.x) != null ? _a : window.innerWidth - EDGE_MARGIN - COLLAPSED_SIZE;\n    const targetY = (_b = saved == null ? void 0 : saved.y) != null ? _b : EDGE_MARGIN;`, `    const chosen = window.__interfaceKitCorner.claim(side === 'right', false);\n    const targetX = chosen.right ? Math.max(EDGE_MARGIN, window.innerWidth - EDGE_MARGIN - COLLAPSED_SIZE) : EDGE_MARGIN;\n    const targetY = chosen.bottom ? Math.max(EDGE_MARGIN, window.innerHeight - EDGE_MARGIN - COLLAPSED_SIZE) : EDGE_MARGIN;`);
      source = replaceOnce(source, '  }, [left, top, widthMV, setActive, setSettingsOpen]);', '  }, [left, top, widthMV, setActive, setSettingsOpen, side]);');
      source = replaceOnce(source, '  const dragCleanupRef = useRef2(null);', '  const dragCleanupRef = useRef2(null);\n  const dockCornerRef = useRef2(null);\n  if (!dockCornerRef.current) dockCornerRef.current = window.__interfaceKitCorner.claim(false, true);');
      source = replaceOnce(source, 'typeof window !== "undefined" ? window.innerWidth - EDGE_MARGIN - COLLAPSED_SIZE : 0', 'dockCornerRef.current.right ? Math.max(EDGE_MARGIN, window.innerWidth - EDGE_MARGIN - COLLAPSED_SIZE) : EDGE_MARGIN');
      source = replaceOnce(source, '  const top = useMotionValue(EDGE_MARGIN);', '  const top = useMotionValue(dockCornerRef.current.bottom ? Math.max(EDGE_MARGIN, window.innerHeight - EDGE_MARGIN - COLLAPSED_SIZE) : EDGE_MARGIN);');
      source = replaceOnce(source, '    setActive(true);\n  }, [left, top, widthMV, side, setPanelSide, setActive]);', '    window.__interfaceKitCorner.clear();\n    setActive(true);\n  }, [left, top, widthMV, side, setPanelSide, setActive]);');
      source = replaceOnce(source, "      if (isExpanded) setPanelSide(right ? 'right' : 'left');", "      dockCornerRef.current = { right, bottom: isExpanded ? false : bottom };\n      if (isExpanded) setPanelSide(right ? 'right' : 'left');");
      source = replaceOnce(source, '    animateMotionValue(left, targetX, springTransition);\n    animateMotionValue(top, targetY, springTransition);', '    dockCornerRef.current = chosen;\n    animateMotionValue(left, targetX, springTransition);\n    animateMotionValue(top, targetY, springTransition);');
      source = replaceOnce(source, '  const handleCopy = async () => {', `  useEffect2(() => {
    const resize = () => {
      const size = isExpanded ? PANEL_WIDTH : COLLAPSED_SIZE;
      left.set(dockCornerRef.current.right ? Math.max(EDGE_MARGIN, window.innerWidth - EDGE_MARGIN - size) : EDGE_MARGIN);
      top.set(!isExpanded && dockCornerRef.current.bottom ? Math.max(EDGE_MARGIN, window.innerHeight - EDGE_MARGIN - COLLAPSED_SIZE) : EDGE_MARGIN);
    };
    const reconcile = () => {
      if (!isExpanded) dockCornerRef.current = window.__interfaceKitCorner.claim(dockCornerRef.current.right, dockCornerRef.current.bottom);
      resize();
    };
    window.addEventListener('resize', resize);
    window.addEventListener('canvas-corners-changed', reconcile);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('canvas-corners-changed', reconcile); };
  }, [isExpanded, left, top]);
  const handleCopy = async () => {`);
      source = replaceOnce(source, '      children: [\n        /* @__PURE__ */ jsx27("div", { className: "px-2 py-1.5 shrink-0"', `      children: [
        /* @__PURE__ */ jsx27("div", { role: "presentation", title: "Drag to move panel", style: { height: 20, flexShrink: 0, cursor: "grab", touchAction: "none", display: "grid", placeItems: "center" }, onPointerDown: e => {
          const toolbar = e.currentTarget.getRootNode().querySelector('[data-interface-kit][style*="border-radius: 22px"]');
          toolbar?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, button: 0, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId }));
        }, children: /* @__PURE__ */ jsx27("span", { style: { width: 28, height: 3, borderRadius: 3, background: "rgba(255,255,255,.35)", pointerEvents: "none" } }) }),
        /* @__PURE__ */ jsx27("div", { className: "px-2 py-1.5 shrink-0"`);
      source = replaceOnce(source, '          cursor: isExpanded ? void 0 : "grab"', '          cursor: isExpanded ? void 0 : "grab", touchAction: "none"');
      source = replaceOnce(source, '        onPointerDown: handlePointerDown,\n        children:', `        onPointerDown: handlePointerDown,\n        role: isExpanded ? void 0 : 'button',\n        tabIndex: isExpanded ? void 0 : 0,\n        'aria-label': isExpanded ? void 0 : 'Open Interface Kit',\n        onKeyDown: e => { if (!isExpanded && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleOpen(); } },\n        children:`);
      return { contents: source, loader: 'js', resolveDir: args.path.slice(0, args.path.lastIndexOf('/')) };
    });
  }
};

export async function bundleInterfaceKit() {
  const result = await build({ entryPoints: [fileURLToPath(new URL('./interface-kit-entry.js', import.meta.url))], bundle: true, write: false, platform: 'browser', format: 'esm', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [positioning] });
  return result.outputFiles[0].contents;
}
