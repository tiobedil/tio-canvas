// What changed for the person using the canvas, newest first. Only user-visible
// changes belong here: new things you can do, things that work differently,
// fixes you would have noticed, and speed. Build, release and refactor work
// never gets an entry. `type` is one of: new, improved, fixed, faster.
//
// New items go in the `unreleased` entry on top. On release,
// scripts/stamp-changelog.mjs gives it the real version and date and adds a fresh
// empty one. Keep that entry's shape.
export const entries = [
  {
    unreleased: true,
    items: [
      { type: 'new', text: 'The More menu has an Install in a project guide with beginner-friendly steps, ready-to-download files and a prompt to copy for your agent.' },
      { type: 'fixed', text: 'A text box can no longer be dragged shorter than its lines, and its text is never clipped.' },
      { type: 'new', text: 'Each screen has a theme button next to refresh to preview it in dark or light mode.' },
      { type: 'improved', text: 'Icons that do not fit a narrow screen fold behind a ... button and slide in when you hover it.' },
    ],
  },
  {
    version: '0.1.2',
    date: '2026-11-08',
    items: [
      { type: 'new', text: 'A Change log in the More menu lists what changed in each release.' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-08',
    items: [
      { type: 'new', text: 'The exploration canvas is now its own package, so any project can lay its pages out on an infinite board.' },
      { type: 'new', text: 'A demo project ships with the canvas, so you can try it without setting anything up.' },
    ],
  },
];

export const labels = { new: 'Feature', improved: 'Improved', fixed: 'Fixed', faster: 'Faster' };

const formatDate = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

export function renderChangelog(body, list = entries) {
  body.replaceChildren();
  if (!list.some(entry => entry.items.length)) { body.append(el('p', '', 'Nothing to show yet.')); return; }
  for (const entry of list.filter(entry => entry.items.length)) {
    const section = el('section', 'changelog-entry');
    const heading = el('h3', '', entry.unreleased ? 'Unreleased' : entry.version);
    if (entry.date) {
      const time = el('time', '', formatDate(entry.date));
      time.dateTime = entry.date;
      heading.append(time);
    }
    const items = el('ul', 'changelog-items');
    for (const item of entry.items) {
      const row = el('li');
      const tag = el('span', 'changelog-tag', labels[item.type] ?? item.type);
      tag.dataset.type = item.type;
      row.append(tag, el('span', '', item.text));
      items.append(row);
    }
    section.append(heading, items);
    body.append(section);
  }
}
