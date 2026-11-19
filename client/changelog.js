import { h, Section, Button, DialogFooter } from './ui/index.js';

// What changed for the person using the canvas, newest first. Only user-visible
// changes belong here: new things you can do, things that work differently,
// fixes you would have noticed, and speed. Build, release and refactor work
// never gets an entry. `type` is one of: new, improved, fixed, faster.
//
// An entry's `summary` is for the GitHub release notes only; this dialog does not show it.
//
// New items go in the `unreleased` entry on top. On release,
// scripts/stamp-changelog.mjs gives it the real version and date and adds a fresh
// empty one. Keep that entry's shape.
export const entries = [
  {
    unreleased: true,
    summary: '',
    items: [],
  },
  {
    version: '0.6.0',
    date: '2026-11-19T18:41:04.262Z',
    summary: 'The size toolbar under a selected screen stays on screen while you pan, so you can always reach it.',
    items: [
      { type: 'improved', text: 'The More button stays pressed in while its menu is open.' },
      { type: 'improved', text: 'The More menu sits a little further below the Layers bar, so it no longer crowds it.' },
      { type: 'improved', text: 'The Layers bar shrinks to fit its buttons when it is collapsed or there is nothing on the canvas.' },
      { type: 'new', text: 'Drag the right edge of the Layers panel to make it wider; the edge glows while you drag, stretches a little past its limits and springs back.' },
      { type: 'improved', text: 'Arrows spring back to straight with a slightly calmer bounce.' },
      { type: 'improved', text: 'The size toolbar under a selected screen stays inside the window when the screen is partly off screen.' },
      { type: 'new', text: 'When a selected screen is off screen, a line on the window edge shows which way it is.' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-19T04:28:19.216Z',
    summary: 'Component frames are safer: a renamed or deleted component no longer takes its frames with it, and a new component with the same name never takes over existing frames. Components that fail to draw are listed with their error, can be wrapped in your app\'s providers, and new components show up while the canvas is open, marked New. The Change log groups each release by kind.',
    items: [
      { type: 'improved', text: 'A component frame\'s controls switch to dark or light with the frame, from its own theme button or the canvas theme.' },
      { type: 'improved', text: 'Search results mark the matching letters in the accent colour instead of a highlight box.' },
      { type: 'improved', text: 'Reset to straight springs a curved arrow back like a plucked string, with a quick bounce past straight before it settles.' },
      { type: 'improved', text: 'Resizing a screen snaps its edges to the edges and centres of other objects, with the same guide lines as moving.' },
      { type: 'improved', text: 'With several screens selected, a screen\'s theme or orientation button changes all of them at once.' },
      { type: 'improved', text: 'The Change log groups each release by kind (Feature, Improved, Fixed, Faster), with a heading and a bullet list for each, instead of a label on every line.' },
      { type: 'fixed', text: 'Select menus in a component frame\'s controls no longer squeeze their options when the frame is small or zoomed out.' },
      { type: 'improved', text: 'An option too long for its select menu ends in an ellipsis, and hovering it shows the full text.' },
      { type: 'fixed', text: 'A component frame whose component was renamed, moved or deleted is no longer lost: it waits with its place and settings, comes back once the component is found again, and the Components tab lets you remove it.' },
      { type: 'fixed', text: 'Adding a second component with the same name no longer moves your existing frames over to the new one.' },
      { type: 'improved', text: 'An empty Components tab now says which folders it searched, or why the search failed.' },
      { type: 'improved', text: 'A component\'s picture in Add pages is redrawn after you change the component.' },
      { type: 'new', text: 'A component that cannot be drawn is now listed in the Components tab\'s things to check, with the error, so you see it without opening every frame.' },
      { type: 'new', text: 'Components that need your app\'s providers (theme, router, translations) can now be drawn: point componentPreview.wrapper at one file that wraps them.' },
      { type: 'fixed', text: 'A React component that throws while drawing now shows its error in the frame, instead of an empty frame.' },
      { type: 'new', text: 'Components added or removed while the canvas is open are noticed when you come back to its tab: a dot on the Add button and a Reload button in the Components tab.' },
      { type: 'new', text: 'Components found since your last visit are marked New in the Components tab, until you have seen them once.' },
      { type: 'faster', text: 'A published canvas loads React once for all its component frames, instead of once per component, so each frame opens with a file under a few kilobytes.' },
      { type: 'faster', text: 'A canvas with many component frames opens faster: the frames share one search of your project instead of each searching again.' },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-11-11T09:36:26.151Z',
    summary: '',
    items: [
      { type: 'improved', text: 'The empty Components tab now lists the ways to bring your components in as short numbered steps, instead of one long paragraph.' },
      { type: 'improved', text: 'The Add to canvas button in search now uses the same neutral button as the other main actions, instead of the pink accent color.' },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-11T08:17:33.626Z',
    summary: 'Components can now be previewed on the canvas: they are found in your project by themselves, each sits in a frame with a control for every prop, and one notice with a ready prompt covers anything the canvas cannot settle alone. Add pages gets tabs and a faster, more forgiving search.',
    items: [
      { type: 'new', text: 'Components can now be previewed on the canvas: each one sits alone in a frame you can resize, open fullscreen and switch to dark mode on its own.' },
      { type: 'new', text: 'A component frame has controls inside it for every prop, variant and state, so you can try them all without touching code. Minimize them into a floating button when they are in the way.' },
      { type: 'new', text: 'Add pages now has two small tabs, Pages and Components (under the search bar, below a divider; press Tab to switch). Each tab keeps its own selection.' },
      { type: 'new', text: 'Components are found automatically in your usual folders (src/components and a few more), and their controls are read from the code, so nothing has to be listed by hand.' },
      { type: 'new', text: 'When a component is new, moved or changed in a way the canvas cannot sort out, the Components tab shows one notice with a prompt for your coding agent that fixes everything at once.' },
      { type: 'new', text: 'Once you have checked something in Add pages, an Add to canvas button appears at the end of the search bar.' },
      { type: 'improved', text: 'Changing a component or its props updates the canvas without any extra step.' },
      { type: 'improved', text: 'The controls panel in a component frame now fills the frame height, and its select menus open as wide as their field.' },
      { type: 'improved', text: 'The Add pages panel is taller, so more results fit without scrolling.' },
      { type: 'improved', text: 'Search in Add pages now finds a page when you skip letters, like "updte" for "update".' },
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
const RELEASES_URL = 'https://github.com/tiobedil/tio-canvas/releases';
// The dialog lists the newest releases only; the rest is on GitHub.
const SHOWN_RELEASES = 7;
// Each release lists its items grouped by type, in this order, under the type as a heading.
// The GitHub release notes use the same grouping (scripts/release-notes.mjs).
const typeOrder = ['new', 'improved', 'fixed', 'faster'];

export const groupByType = items => {
  const types = [...typeOrder, ...new Set(items.map(item => item.type).filter(type => !typeOrder.includes(type)))];
  return types.map(type => [type, items.filter(item => item.type === type)]).filter(([, group]) => group.length);
};

/** The bar under the list, linking to every release on GitHub. */
export const ChangelogFooter = () => DialogFooter({},
  h('p', {}, 'Older releases are on GitHub.'),
  Button({ as: 'a', href: RELEASES_URL, target: '_blank', rel: 'noopener noreferrer', dataset: { align: 'end' } }, 'View all releases'));

export function renderChangelog(body, list = entries) {
  body.replaceChildren();
  if (!list.some(entry => entry.items.length)) { body.append(h('p', {}, 'Nothing to show yet.')); return; }
  let released = 0;
  for (const entry of list.filter(entry => entry.items.length)) {
    if (!entry.unreleased && ++released > SHOWN_RELEASES) break;
    const title = [entry.unreleased ? 'Unreleased' : entry.version];
    if (entry.date) title.push(h('time', { dateTime: entry.date }, formatDate(entry.date)));
    body.append(Section({ title, className: 'changelog-entry' },
      ...groupByType(entry.items).map(([type, items]) => h('div', { class: 'changelog-group' },
        h('h4', {}, labels[type] ?? type),
        h('ul', { class: 'changelog-items' }, ...items.map(item => h('li', {}, item.text)))))));
  }
}
