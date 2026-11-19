// Keeps the Components tab honest while the canvas stays open: which components
// are new since this browser last looked, and whether the project now has
// components this page does not know yet (a file added while the tab was open).

/** Ids in `now` that are not in `before`, and ids in `before` that are gone. */
export function componentChanges(before, now) {
  const old = new Set(before), fresh = new Set(now);
  return { added: now.filter(id => !old.has(id)), removed: before.filter(id => !fresh.has(id)) };
}

/** The banner line for components that changed after the page loaded. */
export function changesText({ added, removed }) {
  const parts = [];
  if (added.length) parts.push(`${added.length} new ${added.length === 1 ? 'component' : 'components'}`);
  if (removed.length) parts.push(`${removed.length} removed`);
  return `${parts.join(', ')} since this page opened.`;
}

/**
 * Which components this browser has seen in the picker, kept beside the layout.
 * The first visit sees everything as known, so nothing is "new" on day one.
 */
export function createSeen(storageKey, ids) {
  const key = `${storageKey}:seen-components`;
  let seen = null;
  try { const raw = JSON.parse(localStorage.getItem(key)); if (Array.isArray(raw)) seen = new Set(raw.filter(id => typeof id === 'string')); } catch { /* unreadable: start over */ }
  const first = !seen;
  seen ??= new Set(ids);
  const write = () => { try { localStorage.setItem(key, JSON.stringify([...seen].slice(-2000))); } catch { /* storage full or blocked */ } };
  if (first) write();
  return {
    isNew: id => !seen.has(id),
    /** Called when the picker closes: what was shown once is no longer new. */
    markAll() { let changed = false; for (const id of ids) if (!seen.has(id)) { seen.add(id); changed = true; } if (changed) write(); },
  };
}

/**
 * Ask the server for the project again when the canvas comes back into view, at
 * most every few seconds. Calls `onChange(changes)` when the component list moved.
 * A build has no server behind it; the same file comes back and nothing changes.
 */
export function watchComponents(known, onChange, { every = 3000 } = {}) {
  let last = 0, busy = false;
  async function check() {
    if (busy || document.visibilityState !== 'visible' || Date.now() - last < every) return;
    busy = true; last = Date.now();
    try {
      const project = await import(`/canvas/project.js?check=${Date.now()}`);
      const now = [...(project.components ?? []), ...(project.autoComponents ?? [])].map(item => item?.id).filter(id => typeof id === 'string');
      const changes = componentChanges(known, now);
      if (changes.added.length || changes.removed.length) onChange(changes);
    } catch { /* the server is restarting or gone: try on the next return */ }
    finally { busy = false; }
  }
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  return check;
}
