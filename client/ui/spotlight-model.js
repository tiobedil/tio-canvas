// The logic of a Spotlight, with no DOM: what a query finds, and how the
// highlight and the selection move. ui/spotlight.js draws it.

const fold = text => String(text).toLowerCase();

/**
 * Where `query` sits in `text`, as [start, end], or null. Case does not matter.
 * Every letter of the query must appear in the text, in the same order, but letters
 * may be skipped: "updte" finds "update", "rn" finds "run"; "rum", "ra" and "rnu" do not.
 * The range runs from the first matched letter to the last.
 */
export function matchRange(text, query) {
  const needle = fold(query.trim());
  if (!needle) return null;
  const hay = fold(text);
  const whole = hay.indexOf(needle);
  if (whole >= 0) return [whole, whole + needle.length];
  const start = hay.indexOf(needle[0]);
  if (start < 0) return null;
  let at = start;
  for (let i = 1; i < needle.length; i++) {
    at = hay.indexOf(needle[i], at + 1);
    if (at < 0) return null;
  }
  return [start, at + 1];
}

/**
 * What a query finds. A query matches an item by its title, or a whole group by
 * its label (then every item of the group shows). Even one letter matches.
 *   groups  [{ id, label }] in display order      items  [{ id, group, title }]
 * Returns [{ group, range, items: [{ item, range }] }], empty groups left out.
 * A blank query returns everything.
 */
export function searchGroups(groups, items, query) {
  const results = [];
  for (const group of groups) {
    const members = items.filter(item => item.group === group.id);
    const range = matchRange(group.label, query);
    const found = [];
    for (const item of members) {
      const itemRange = matchRange(item.title, query);
      if (!query.trim() || range || itemRange) found.push({ item, range: itemRange });
    }
    if (found.length) results.push({ group, range, items: found });
  }
  return results;
}

/** The ids from `a` to `b` in `ids`, both ends included, in list order. */
export function between(ids, a, b) {
  const first = ids.indexOf(a), last = ids.indexOf(b);
  if (first < 0 || last < 0) return [];
  return ids.slice(Math.min(first, last), Math.max(first, last) + 1);
}

/**
 * The highlight (the row Enter would add) and the selection (the rows ticked).
 * Every method takes `ids`: the rows that can be reached now, in screen order.
 * A selected row that a query hides stays selected; `hidden(ids)` lists those.
 */
export function createSpotlightState() {
  let active = null, anchor = null, base = null;
  let selected = new Set();
  const state = {
    get active() { return active; },
    get selected() { return selected; },
    get size() { return selected.size; },
    /** A query or the list changed: the highlight goes to the first row. */
    reset(ids) { active = ids[0] ?? null; anchor = null; base = null; },
    /** The list changed but the highlight may stay where it is, if its row survived. */
    keep(ids) { if (!ids.includes(active)) state.reset(ids); },
    highlight(id) { active = id; },
    /** Arrow keys. `extend` (Shift) grows or shrinks a range from where it started, like Finder. */
    move(ids, to, extend = false) {
      if (!ids.length) return;
      const at = ids.indexOf(active);
      const index = to === 'home' ? 0 : to === 'end' ? ids.length - 1 : Math.max(0, Math.min(ids.length - 1, (at < 0 ? (to > 0 ? -1 : ids.length) : at) + to));
      if (extend) {
        if (!base) { base = new Set(selected); anchor = active ?? ids[index]; }
        active = ids[index];
        selected = new Set([...base, ...between(ids, anchor, active)]);
      } else {
        active = ids[index];
        for (const id of ids) selected.delete(id);
        anchor = null; base = null;
      }
    },
    remove(id) { selected.delete(id); base = null; },
    toggle(id) {
      if (!selected.delete(id)) selected.add(id);
      active = id; anchor = id; base = null;
    },
    /** Shift-click: everything from the last clicked row to this one. */
    rangeTo(ids, id) {
      const from = anchor && ids.includes(anchor) ? anchor : active ?? id;
      for (const value of between(ids, from, id)) selected.add(value);
      active = id; anchor = from; base = null;
    },
    selectAll(ids) { selected = new Set([...selected, ...ids]); base = null; },
    clear() { selected = new Set(); anchor = null; base = null; },
    hidden(ids) { return [...selected].filter(id => !ids.includes(id)); },
    unselectHidden(ids) { selected = new Set([...selected].filter(id => ids.includes(id))); base = null; },
  };
  return state;
}
