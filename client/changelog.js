import { h, Section, Tag } from './ui/index.js';

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
      { type: 'fixed', text: 'The empty search result in Add pages no longer repeats what you typed, so a long search no longer breaks the layout.' },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-10T09:55:44.504Z',
    items: [
      { type: 'improved', text: 'Add pages is now a search panel above the toolbar: press Cmd+K (Ctrl+K on Windows), type a page or group name, and add one or several pages with Enter.' },
      { type: 'new', text: 'Pages in Add pages now show a small thumbnail, made automatically for every page.' },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-11-09T17:28:39.331Z',
    items: [
      { type: 'fixed', text: 'In Add pages, once you have checked a page, clicking another page checks it instead of adding it right away.' },
      { type: 'fixed', text: 'The canvas keeps your last chosen light or dark mode after a refresh.' },
      { type: 'improved', text: 'Change log dates follow your device\'s time zone.' },
      { type: 'fixed', text: 'Dialogs always open scrolled to the top instead of where you left them.' },
      { type: 'fixed', text: 'Dark mode no longer flashes light when you open or refresh the canvas.' },
      { type: 'fixed', text: 'The Check for update button is now always in the More menu.' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-08',
    items: [
      { type: 'new', text: 'The More menu shows your version and tells you with a red dot when a new one is out, with steps and a prompt to update.' },
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

// A release is stamped with its exact time (UTC), shown here in the device's own time zone. Older entries only have a calendar date, which is shown as written.
const formatDate = value => {
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  return value.includes('T')
    ? new Date(value).toLocaleDateString('en-GB', options)
    : new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
};
const tagHues = { new: 150, improved: 250, fixed: 60, faster: 330 };

export function renderChangelog(body, list = entries) {
  body.replaceChildren();
  if (!list.some(entry => entry.items.length)) { body.append(h('p', {}, 'Nothing to show yet.')); return; }
  for (const entry of list.filter(entry => entry.items.length)) {
    const title = [entry.unreleased ? 'Unreleased' : entry.version];
    if (entry.date) title.push(h('time', { dateTime: entry.date }, formatDate(entry.date)));
    body.append(Section({ title, className: 'changelog-entry' },
      h('ul', { class: 'changelog-items' }, ...entry.items.map(item =>
        h('li', {}, Tag({ hue: tagHues[item.type] }, labels[item.type] ?? item.type), h('span', {}, item.text))))));
  }
}
