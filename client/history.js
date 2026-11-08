// History owns canvas document edits only. Camera, theme, project content, and
// the source catalog never enter a snapshot. A drag is committed once.
export function createHistory(capture, restore, limit = 100) {
  const undo = [], redo = [];
  return {
    checkpoint() { return capture(); },
    commit(before) {
      const after = capture();
      if (JSON.stringify([before.models,before.arrows,before.texts,before.objectOrder]) === JSON.stringify([after.models,after.arrows,after.texts,after.objectOrder])) return false;
      undo.push({before,after});
      if (undo.length > limit) undo.shift();
      redo.length = 0;
      return true;
    },
    undo() {
      const edit = undo.pop();
      if (!edit) return false;
      restore(edit.before);redo.push(edit);return true;
    },
    redo() {
      const edit = redo.pop();
      if (!edit) return false;
      restore(edit.after);undo.push(edit);return true;
    },
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
  };
}

// Never consume the native undo stack of an input, editor, or rename field.
export function historyShortcut(event) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey) return 'redo';
  return null;
}
