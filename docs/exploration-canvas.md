# Private exploration canvas and future interactive gallery

## Agreed scope

The canvas is a private workspace at `/canvas`, accessible only by typing its URL, in development and in production. It is not a portfolio page, has no site navigation link, carries `noindex`, and is not in the sitemap. `build/build.mjs` copies `dev/canvas/` to `dist/canvas/` with a generated `screens.js`. Prototype pages ship to `dist/prototypes/` too, but the Worker (`src/worker-gate.js`) serves them only to a frame inside the site: they open in the canvas, and a typed address is a 404. A command-line client can forge the headers, so this is not authentication. Interface Kit is injected by the dev server alone and never ships. The production canvas adds its own bridge script to the same-origin screens it frames (the dev server does that for development), and `public/_headers` allows same-origin framing (`X-Frame-Options: SAMEORIGIN`). `pnpm preview` serves `dist/canvas` exactly as a visitor gets it.

The canvas and public gallery are independent. Canvas experiments do not automatically appear in the gallery. Build the canvas first, then tackle the gallery using the requirements below without another requirements interview.

## Canvas behavior

- Finite 20,000 × 20,000 CSS-pixel workspace. Screen placement, resizing, and pan share the same 0–20,000 bounds: a frame at a workspace corner can meet the usable canvas corner when pan reaches that edge (to the right of the expanded Layers drawer), without extra outside whitespace. If a zoomed workspace axis is smaller than the usable viewport, center it on that axis. The expanded Layers drawer reserves its width plus the 10px outside gaps for pan limits and fit calculations; collapsing it restores the full canvas width. At an edge, this hard boundary takes priority over pointer-anchored zoom or centering a fit operation. Device presets move a frame inward if needed to preserve the exact preset size; custom resizing cannot extend past the workspace edge. Ordinary vertical and horizontal wheel/trackpad scrolling pans the canvas on both axes over the background or inactive screens. A single selected screen is active: ordinary scrolling inside it stays native and scrolls its own contents instead of the canvas. Clicking screen content or its title activates it; background selection clearing deactivates it. Multi-selection remains a group drag surface, not an active document. Command/Ctrl+wheel zooms around the pointer on the host and inside screens; trackpad pinch uses the browser's Ctrl+wheel event with a stronger zoom response. Plain scrolling must never change scale. Zoom range: 10–200%. Middle-button drag or Space + primary-button drag pans. Ordinary clicks belong to the screen. Command/Ctrl-modified wheel always zooms, including in an active screen; trackpad pinch zooms through the browser's Ctrl+wheel event. Ordinary active-screen scrolling, scrollbars, and keyboard scrolling remain available. Space+wheel pans even over active content. This is a canvas-only revision, not a change to the future public gallery scroll requirements.
- Screen document geometry uses whole CSS pixels: x, y, width, and height are always integers. Round restored legacy layouts, drag destinations, numeric dimensions, and spacing edits to the nearest pixel. Group movement rounds one shared translation so its internal gaps do not change. Magnetic edge/center/gap snapping is applied before pixel rounding; when an exact center alignment needs half a pixel, whole-pixel geometry wins. Restored fractional positions and custom dimensions are migrated back to storage. Camera pan/zoom and pointer measurements retain fractional precision; this does not constrain the document to device pixels at arbitrary zoom. Gap calculations use the integer document geometry, never transformed browser rectangles, so entering 50 stays exactly 50 rather than a floating-point remainder.
- Screen content is real HTML in a same-origin iframe, not a screenshot or an HTML canvas drawing. Each document owns its styles, fonts, responsive layout, and interaction state.
- Clicking content selects its screen without consuming the click. Shift+click toggles membership in the selection, including clicks inside screen documents. Drag on empty canvas to draw a selection rectangle; any positive-area intersection with a screen's content frame selects it, not just full containment. Shift+drag adds to the current selection. A background press starts with a hidden, cleared selection rectangle; only an actual drag draws it. A click must never redisplay the previous rectangle. Zero-area rectangles do not select screens. Middle-button and Space+drag remain pan gestures.
- Dragging a selected title moves the whole selection without changing its internal spacing. A multi-selection gets individual outlines plus a group bounding outline. Fit to screen and Cmd+D operate on the entire selection. The size inspector and resize handles are hidden for groups; resizing remains a single-screen operation. A group instead has an editable Gap toolbar centered beneath its bounding box, using the same styling and screen-space offset as the single-screen inspector. For a multi-selection, the entire group bounding box is a drag surface, including frame contents and empty gaps. This intentionally takes priority over embedded controls while the group is selected. Return to a single selection to interact with its controls. Shift+click within that surface can still deselect an individual member. Single-screen contents remain interactive, not a drag surface.
- Holding Shift while dragging a title or selection group constrains motion horizontally or vertically relative to the original position. The dominant initial movement chooses the axis, which stays fixed while Shift remains held. Release Shift for free movement; press it again to choose the current dominant axis. The locked coordinate does not magnetically snap away from its original value. A guide follows the original center line. Shift+click still toggles membership when no drag occurs.
- The group Gap toolbar shows Gap X for a predominantly horizontal arrangement or Gap Y for a predominantly vertical one, determined by the larger spread of screen origins (horizontal wins ties). It measures edge-to-edge spacing in workspace pixels, independent of zoom. Unequal distances show Mixed; overlapping equal distances show Overlap. Entering a nonnegative integer distributes the selected screens along that axis in spatial order, anchored at the first screen, while preserving each screen's other coordinate, dimensions, preset, stacking, and mounted document. This is one ordered row or column, not automatic grid packing. Zero gap is allowed. Values are capped to the room remaining in the finite workspace; if the selected sizes cannot fit after the anchor, the field is disabled. A change is one undoable, persisted position edit. Single selection restores the ordinary size inspector.
- While moving a frame or group, snap to other frames' edges/centers or matching gaps in the same row/column. The attraction distance is 6 screen pixels at any zoom. Gap values are measured from existing adjacent frames, not a hardcoded grid; insertion between two frames can also snap to equal gaps. Alignment/spacing guides appear during a move and clear on release/cancel. Equal-gap snapping draws labeled indicators both for the active gap and the existing reference gap. Insertion between two frames draws two separate equal-gap segments, not a line across the moving frame. Snapping does not change the selected frames' relative positions.
- Selected screen titles turn blue. Titles retain their screen-space font size but are ellipsized to the frame's visible width when zoomed out. The native title tooltip and accessible name keep the full name.
- Delete only through Delete/Backspace or the right-click context menu, from the host or a screen document, except while editing text. There is no Delete button in the toolbar. Clicking a screen title or starting a canvas gesture ends host field editing; selecting mobile content also releases a stale host field without taking focus from project editors. Forwarded shortcuts act on the current selection even if keyboard focus remains in an older iframe. Every selected instance can be deleted, including the last instance of a source. An empty canvas stays empty after refresh; removed originals and copies do not return. The source catalog remains available in Add pages without mounting hidden documents. This changes canvas instances only, never source files. Fit to screen stays visible but is disabled when no screen is selected.
- Double-click a screen title to rename it inline. The title editor hugs its text up to the existing title-width limit, with 4px padding on every side. It grows and shrinks as text changes instead of filling the screen width. Enter or blur commits; Escape cancels. A whitespace-only name restores the original source title without a duplicate number. Names are instance-specific, limited to 200 characters, persisted, and undoable. Renaming does not change source IDs, URLs, files, or the numeric naming of future default copies.
- The Layers drawer is on the **left**, inset 10px from the left and top, with a separate help/appearance toolbar beneath it. The toolbar sits 10px from the left and bottom, with a 10px gap between it and the expanded drawer. Minimizing the drawer never hides that toolbar. It uses the same container styling as the other canvas tools. One screen is one layer, shown with its current device icon; Custom uses a diagonal two-way arrow. The top row is the frontmost screen. Click to select, Shift+click to toggle membership, or drag across row labels to select a contiguous range. A muted grabber appears left of the device icon on hover or keyboard focus, without shifting the label. Its tint follows the canvas theme. Drag anywhere across the grabber, device icon, or their shared gap to reorder. Dragging a selected group preserves its relative order, with an insertion guide and automatic list scrolling at the edges. Escape cancels a layer drag. Cmd+[ / Cmd+] move the selection one layer backward/forward; Cmd+Shift+[ / Cmd+Shift+] send it to the bottom/top. These shortcuts also work from non-editing iframe contexts, while host fields and project editors keep native keyboard behavior. The header button sits at the right of the Layers heading and minimizes the drawer to a header of the same width. Rows have a 4px gap. Double-click a layer name to rename it inline; Enter or blur saves, and Escape cancels. Layer order and minimized state survive reload; order changes are undoable, while minimized state is a view preference outside history. Reordering changes stacking without moving iframe DOM nodes, so documents, scroll, and project state remain intact. Native layer buttons also support Tab, Enter, and Space.
- Canvas document history supports undo/redo for preset changes, numeric sizing, whole resize/move gestures, add/duplicate/delete, rename, and layer order. One drag is one edit. Use Cmd+Z / Cmd+Shift+Z on macOS, Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y elsewhere, or the toolbar buttons. Native text fields, inline rename editing, and project editors retain their own undo behavior. Theme, pan/zoom/fit, drawer minimization, selection-only changes, and new source registration are excluded. History is bounded to 100 edits and resets on refresh; final layout/names remain persisted. New source entries are added in `screens.js`, not through history; its dev reload starts a fresh history session.
- Undo restores canvas document state, not arbitrary project internals. Existing unchanged iframe documents remain mounted during history restoration. Undoing deletion or redoing a duplicate recreates that removed document, so its internal project content starts fresh. This avoids keeping every historically deleted document alive in memory.
- Resize changes the iframe's actual viewport dimensions. Device presets lock both numeric fields and resize handles. The user must explicitly choose Custom before resizing; dragging never switches presets automatically.
- Four corner nodes and four midpoint grabbers resize Custom frames. Midpoint grabbers appear on hover. The selected frame has a toolbar centered 10 screen pixels beneath it, with preset, width, and height. Controls, outline, handles, and the gap retain their screen-space size at every zoom.
- Custom select menus follow their fields on every canvas render, including pan and animated zoom. They open below or above according to available space, stay inside the viewport using `--canvas-panel-inset`, and keep that same clearance from visible fixed toolbars and the Layers drawer. An offscreen field does not hide its open menu: the menu follows as far as the visible free space allows. Long menus scroll within that space. Start/End arrow menus remain above their fields and content-sized; other selects have a 150px minimum width. Changing or clearing selection closes the menu immediately. Choosing an option releases focus rather than returning it to the field. `tests/canvas-menu-position.mjs` checks placement geometry; `tests/canvas-select-menus.mjs` checks live pan tracking, viewport boundaries, toolbar clearance, and menu lifecycle in the browser.
- Canvas toolbars share the Screens panel's 10px outside inset. The bottom-center editing toolbar holds Cursor, Arrow, and Add pages. Undo and Redo live in a separate top-right history toolbar. The bottom-right zoom toolbar holds, in order: Fit to screen, Fit all, Zoom to 100%, a divider, magnifying-glass minus, editable zoom percentage, and magnifying-glass plus. Minus and plus change zoom by 10 percentage points at or below 50%, and 20 points above 50%, clamped to 10–200%. The step uses the pending zoom target during an animation so rapid clicks correctly cross the threshold. Tooltips and accessible labels report the current step. Both buttons and Zoom to 100% use the same 260ms eased camera transition as Fit. Rapid clicks accumulate full steps toward the latest target while movement continues from the current camera; reduced motion applies the target immediately. Below 1100px the editing toolbar moves above the zoom toolbar with a 10px gap to avoid overlap. The bottom-left toolbar holds Keyboard shortcuts and the square icon-only theme toggle independently of drawer minimization. Fit all (Shift+1) and Fit selected screens (Shift+2) ease camera position and scale together over 260ms, including shortcuts forwarded from screen documents. Repeated fits retarget from the current camera; wheel zoom, field edits, or pan interrupts the movement. Reduced motion applies the final camera immediately. Fields, dialogs, and fullscreen previews keep their native keyboard behavior. Add pages opens the page picker. The native modal dialog has a scrim and a 500 × 700px footprint capped to the viewport. Its header matches the Layers header height; its middle section scrolls the registered page catalog; its entire footer is hidden until at least one page is checked. The footer places Select all then Unselect all on the left and Add page(s) on the right. Each row has a custom accessible checkbox with a muted outline and a 16px visual inside a 44px target (negative inline margins preserve the thumbnail position) to the left of its thumbnail. Only the checkbox toggles selection; clicking the rest of a card immediately adds that page alone, regardless of other checked pages. A pill shows the number of existing screens for a page without disabling it. Shift-click adds a contiguous range. Dragging from an unchecked checkbox checks a range with edge scrolling and preserves earlier checks; dragging from a checked checkbox unchecks that range. Multiple selected pages are added as independent new screens in one undoable edit, selected and fitted into view. The close button, Escape, or a scrim click closes without changes. Canvas shortcuts are inactive while a modal is open. Adding uses the same 200-copy safety limit as duplication, but its placement is separate: on an empty canvas the first added screen is centered at workspace coordinate (10,000, 10,000). Otherwise each new screen starts 100 workspace pixels beyond the furthest right edge of all existing screens, aligned to that screen’s top edge. Batch additions continue to the right with the same gap. A batch that cannot fit within the workspace is rejected in full; Add pages never wraps to another row. Reset view is intentionally removed. Buttons have gray surfaces and no border. Fields have 8px horizontal padding, centered numeric values, and the preset chevron has a 6px gap after its label.
- Cmd+D duplicates the selected screen(s) when not editing a text field, including when focus is inside that screen. Copies reuse one source URL but mount separate documents with fresh internal state. Names use the original source title plus `(1)`, `(2)`, and so on, even when duplicating a copy. Copies retain their own position, dimensions, and preset after refresh. A copy is placed to the right of the occupied row, selected, and fitted into view. Repeated shortcuts append beyond earlier copies even when keyboard focus stays in the original iframe. Group copies share one translation and preserve internal spacing. When the current row reaches the right workspace boundary, copies wrap to a free row below, then search earlier free rows if necessary. Placement stays inside the finite workspace and never overlaps existing frames. Duplication does nothing only if no candidate placement fits or the instance safety limit would be exceeded; a group is never partially duplicated. At most 200 duplicate instances are retained to bound storage and document count; this is a safety limit, not a performance promise.
- Position, dimensions, preset, name, layer order, minimized drawer state, and camera survive refresh using versioned localStorage. Malformed, oversized, and inaccessible storage falls back safely. Internal project state need not survive refresh.
- A screen is visible if any of its content frame intersects the viewport. Zoom level alone never replaces it with a preview. A not-yet-seen screen loads on its first intersection. Once loaded, it is never unloaded merely for leaving the viewport: input, component state, and scroll remain intact.
- Loaded screens receive visibility notifications, also accounting for a hidden browser tab. Their own animation/timer work must cooperate to pause. Arbitrary third-party code cannot be universally frozen while guaranteeing its state remains intact.
- Mobile exploration is deferred. No framework or dependency was approved for this implementation.

## Arrows

The bottom-center toolbar has Cursor (V), Arrow (A), and Add pages. Cursor keeps
normal screen interaction, selection, and dragging. In Arrow mode, drag from
empty space or a screen edge to create a connector. Completing an arrow returns
to Cursor and selects it. Escape cancels an unfinished gesture and returns to
Cursor. Space-drag and middle-button pan still work in either tool.

Arrows can remain free or bind either endpoint to any position along an object's
four edges. Bindings store an object ID, side, and normalized edge position, so
the geometry is not coupled to screens. The four side-center dots use the same
size and surface treatment as reorder dots. Center snapping has a 20 screen-pixel
capture zone and takes priority over the 12 screen-pixel edge capture zone.
A bound endpoint stays 8 workspace pixels outside its edge at every position;
zoom scales that distance with the object. Moving or resizing the object updates
the connector. Deleting the object leaves its endpoint at its last position.

Click an arrow to select it; Shift-click toggles membership. A background drag
selects every arrow stroke the rectangle intersects, alongside screens. Selection
uses the actual line or circular arc, not empty space inside its bounding box.
A selected arrow retains its normal ink with a 1px blue center stroke that stays
1px at every zoom. Its head keeps its ordinary ink.

A single arrow retains its two endpoint nodes and balanced-arc middle node. Drag
an endpoint to attach or detach it, its line to move it, or the middle node
perpendicular to its chord to bend it. Focused endpoint nodes accept arrow keys
(one workspace pixel, or ten with Shift); the middle node's arrow keys adjust
its bend. Multiple free arrows have a group box with four corner handles only.
Corner resizing scales endpoint positions and bend uniformly about the opposite
corner, preserving circular arcs; stroke thickness stays unchanged. If any arrow
in the group is bound, group movement and resizing are locked and configuration
remains editable. A mixed screen/arrow selection exposes configuration but not
arrow resize handles.

The arrow toolbar is docked directly above the main toolbar with the same 10px
outside margin as its vertical gap. It follows the main toolbar's responsive
position, keeping within the viewport. It contains two icon-only endpoint menus:
a horizontal line or a left arrow for the start, a horizontal line or a right
arrow for the end. Accessible names still identify each endpoint. After a divider,
line thickness offers exactly 2px, 4px, 6px, 8px, and 10px (default 4px), followed
by Solid/Dotted. Legacy thicknesses are normalized to the nearest allowed value.
A curved selection adds a final divider and the secondary Reset to straight
button. Configuration edits apply to every selected arrow in one history step;
unequal field values show Mixed. Nodes and tools retain their screen-space size.
Arrow tools are hidden in fullscreen previews without reloading the document.

Screens and arrows share one bottom-to-top object order. Command+[ / Command+]
move the selected objects backward/forward by one position; adding Shift sends
them to the back/front. This includes arrows even though the Layers drawer lists
only screens. Order is persisted and undoable. Every floating canvas toolbar
paints above the entire object stack, regardless of an object's position.

Creation, endpoint edits, movement, bending, styles, reset, and deletion participate
in canvas undo/redo. Delete/Backspace removes a selected arrow unless a field is
being edited. Final arrows and bindings persist alongside the existing layout;
selection and active tool do not. Up to 1,000 arrows can be restored, with
validation and a 1 MB total saved-document read limit. All arrow code is served
only by the development canvas and is excluded from production.

Verification: `node tests/canvas-arrow-geometry.mjs` checks geometry, validation,
and history. `node tests/canvas-arrows.mjs` checks the actual browser tools,
endpoint and middle-node dragging, circular midpoint, toolbar placement, styles,
reset, edge binding and detachment, screen movement/resizing, deletion, undo/redo,
reload persistence, cancellation, and the existing iframe/fullscreen flow.
`node tests/canvas-arrow-revisions.mjs` covers marquee and multi-selection,
proportional corner resize, binding locks, batch configuration, icon menus,
docked toolbar spacing, shared dropdown styling, 1px selection, shared-object
stacking, and persistence.

## Fullscreen screen preview

Every screen has a fullscreen icon immediately to the right of Refresh, whether
selected or not. Both icons stay visible without selecting the screen.
This is fullscreen within the browser viewport, not the browser Fullscreen API.
It hides all canvas tools and fills the viewport with the selected document.
The existing iframe stays mounted: page state, scroll, and inputs survive entry
and exit. The preview always follows the browser's viewport dimensions, including window
resizes, without changing the saved screen size. Canvas camera position and zoom
are preserved.

A dark, circular 36 × 36px hamburger button floats above the preview. Its resting
position is 16px from both edges of a corner. Dragging uses pointer capture and
works with mouse or touch. On release, the button's center chooses one of four
viewport quadrants, and the button travels to that corner over 260ms using a
transform transition. A new drag interrupts from the currently painted position.
Reduced motion snaps without travel. Dragging does not trigger a menu click.

The button toggles a controls panel containing only Back to canvas. Resolution
presets and custom W/H are available only in the canvas inspector, never in
fullscreen. The panel shares the canvas tools' surfaces, borders, and typography. The panel aligns with the button's outside edge and
opens below a top corner or above a bottom corner, separated by 8px. Its outer
edge stays 16px from the viewport edge; long panels scroll within the available
height. Clicking outside, including inside the preview document, closes it.
Escape inside the controls closes the panel and returns focus to the button;
Escape on the closed button returns to the canvas. Escape in the project only
closes the controls, leaving project keyboard handling intact.

Exiting restores the screen's canvas dimensions and camera without changing its
preset or adding a history edit. Floating position and fullscreen state are
session-only.

Fullscreen input stays native: the bridge does not intercept canvas keyboard
shortcuts, wheel zoom/pan, Space, or middle-button gestures, and simulated mobile
touch/hover overrides are disabled. Other loaded screens receive hidden-state
notifications while the fullscreen document is visible. Everything here lives
under `dev/canvas/` and is excluded from production output.

## Active screen input, touch preview, and refresh

The host sends each loaded screen its active state and preset input mode, then
resends them after a load, preset/selection change, or history restoration. Only
one selected screen is active. Its wheel listener does not prevent ordinary
scrolling, preserving the browser's own nested scroll containers and page scroll.
Command+wheel is always routed to canvas zoom. Inactive screens still forward
ordinary wheel to canvas pan. These policies remain development-only.

Phone and tablet presets (`touch: true` in `screens.js`) enable a lightweight
mouse touch preview in `touch-preview.js`. It reports pointer positions in iframe CSS pixels to a translucent contact
drawn by the host canvas. Its diameter is 24 logical CSS pixels, scaled with the
screen when the canvas zooms, unlike fixed-size tool chrome. Drawing outside the
iframe keeps the contact above native popovers and dialogs: their browser top
layer bypasses every ordinary `z-index` within that iframe. The host validates
the source window and maps coordinates through the current frame and camera. A primary-button drag on active
non-editor content scrolls eligible containers under the pointer on either
axis, respecting overflow locks and overscroll containment. A stationary tap
keeps normal click behavior; a drag suppresses the following click to prevent
accidental activation. Releasing a moving drag now starts simulated momentum on
the same scroll chain: recent pointer velocity decays exponentially (325ms time
constant), with a 3 CSS-pixels/ms speed cap and no overscroll bounce. Velocity
uses iframe CSS pixels and elapsed time, independent of canvas zoom and refresh
rate. Holding still before release produces no fling. A new press, wheel input,
keyboard input, lost capture, deactivation, preset change, hidden/offscreen
screen, or blur cancels the gesture/coast. `prefers-reduced-motion` retains direct
drag scrolling but omits the inertial tail. Text editors retain ordinary mouse editing, and Space /
middle-button gestures remain canvas pan. The contact hides on exit/blur;
preset changes, cancellation, loss of pointer capture, and hidden documents
release gestures.

This is not Chrome DevTools device emulation. It does not create trusted touch
events, change `pointerType` or touch/hover media queries, emulate multi-touch,
or reproduce native device momentum/physics exactly. The inertial tail is a
local simulation. Browser-native touch gestures and project-specific touch-only
handlers still require actual device/browser tooling.

Mobile presets also disable hover interaction in the preview. `hover-preview.js`
guards `:hover` selectors in readable preview stylesheets without increasing
specificity, including nested rules and styles loaded later. The guard becomes
inert when leaving the mobile preset, restoring desktop hover without reload.
Mouse hover/move handlers are suppressed while ordinary presses, taps, keyboard
focus, and editor drags remain available. This changes only the iframe's live
CSS rules/events, never source files or built production assets. It does not
change browser media-query capabilities; inaccessible cross-origin stylesheets
and closed shadow roots cannot be rewritten by this preview. Current portfolio
styles are same-origin and are covered by the browser regressions.

Simulated taps also suppress native focus outlines and the portfolio's separate
focus-ring overlay while using the pointer. The preview still moves actual focus
into the activity card; it does not blur controls or remove keyboard access.
A non-modifier key restores keyboard focus styling. Focused controls inside an
open popover get a native outline so their keyboard indicator is painted in the
same top layer, rather than behind the card. These overrides are inactive in
desktop presets and never enter the production stylesheets.

Each screen has a fixed-screen-size refresh icon at the right edge of its
name row. It loads a replacement document from that instance's registered source page,
resetting its internal state and scroll without refreshing the canvas or other
screens. The previous document stays painted until the replacement stylesheet,
fonts, and initial layout are ready. The pending frame is invisible, inert, and
hidden from accessibility tools; promotion removes the old frame. This avoids a
blank white navigation frame, including when refreshing a dark page. `screen-loader.js` owns creation, readiness, replacement, and cleanup. The bridge reports document/font readiness without waiting for images or weather; slow nonessential requests must not hold the refresh button locked. Native lazy loading keeps initial embedded media separate from host load completion. A 15-second refresh deadline preserves the previous document, removes the stalled replacement, unlocks retry, and reports an accessible error if readiness never arrives. The refresh
button is disabled while a replacement is pending, preventing stacked reloads.
Position, dimensions, preset, name, camera, and selection stay unchanged;
refresh is not a canvas history edit. Readiness notification restores active/touch
configuration automatically.

## Canvas tool appearance and isolation

The public [Untitled UI component catalog](https://www.untitledui.com/react/components),
[buttons](https://www.untitledui.com/react/components/buttons),
[inputs](https://www.untitledui.com/react/components/inputs), and
[select](https://www.untitledui.com/react/components/select) pages are visual references,
not installed libraries. The implementation is original native HTML/CSS/JavaScript:
neutral surfaces, compact rounded controls, subtle panel and screen shadows, muted labels,
and a clear keyboard focus ring. It is inspired by the reference, not an exact
port of its React components. No React, Tailwind, Untitled UI package, copied
proprietary component source, external stylesheet, or external font is used.

`dev/canvas/canvas.css` owns the canvas-only tokens and controls. It is loaded
only by the canvas document; iframe documents keep their own design systems.
No portfolio styles or tokens are changed. No tool assets reach production. The canvas background has a subtle dotted grid (muted ink at 12%, reduced from 28%), anchored to camera movement and zoom with minimum spacing to avoid a dense pattern at low zoom. Dots remain behind the iframe surfaces; each screen has a thin shadow to distinguish it from the workspace.

## Files and adding screens

All canvas code is in `dev/canvas/`, outside build inputs. The dev server explicitly serves this directory. Changes reload the development browser.

1. Put a local HTML exploration under `dev/prototypes/web-pages/<experiment>/` or `dev/prototypes/mini-projects/<project>/` (or use an existing local page, such as `/`). Use its `/prototypes/.../` URL. See `dev/prototypes/README.md` for promotion rules.
2. Add an entry in `dev/canvas/screens.js`: stable `id`, `kind` (`production` or `prototype`; the Add pages dialog groups pages by it in an accordion), `title`, a short required `description` (shown under the title in that dialog; the file throws without one), local `src`, `x`, `y`, `width`, `height`, and `preset`. The default is `id: 'web-page-prod'`, `kind: 'production'`, `title: 'Web Page'`, `src: '/'`, using the 1440 × 900 laptop preset. This renders the local production implementation of tioputrad.com, not the deployed remote domain. Future experiments should use distinct IDs such as `web-page-exp-1`, readable titles such as `Web Page (Exp 1)`, and their own local page. The first screen of a page has no number; its copies are named `Web Page (Exp 1) (1)`, `(2)`, and so on. If the first screen is deleted and the page is added again, the new screen is the unnumbered one. Display names are editable; stable IDs identify sources regardless of rename.
3. Use `custom` or a preset key from that file. Presets specify CSS viewport sizes, not full browser device emulation: no device pixel ratio, user-agent, capability/media-query, or browser-chrome emulation. Phone and tablet presets enable the limited touch preview described below.
4. Do not add production credentials, writes, or unsafe remote fixtures. The initial interaction study is local-only and makes no network calls beyond its local files. A real website preview may load its usual image/weather requests; review this before adding it.

The old Interaction study page is removed from the development canvas. Its small interactive fixture exists only under `tests/fixtures/` and is supplied through test-only browser request interception, never a server route or registered screen. The default portfolio can make its usual image/weather requests and has normal outbound links; it is the local website implementation, not a mock.

The dev server injects `bridge.js` into a screen requested with `?canvasScreen=1`. Its messages are checked by origin and iframe window identity. It forwards selection and canvas gestures without replacing component handlers. This is trusted-document style isolation, not a security sandbox. Do not run untrusted code here.

A cooperating exploration can listen to:

```js
window.addEventListener('canvasvisibilitychange', ({ detail: { visible } }) => {
  // Stop or resume this project's own animation or timer work.
});
```

It can also use `html[data-canvas-visible="false"]` to pause CSS animation. The fixture demonstrates this. No production component imports canvas code.

The canvas host owns the only live-reload EventSource connection. Embedded
`?canvasScreen=1` documents receive the bridge but no individual reload stream;
a host reload already refreshes every mounted screen. One stream per iframe
exhausts the browser's per-origin HTTP connection limit after a few screens and
can block later documents, assets, and refresh replacements indefinitely.

There is a real memory tradeoff: preserving every visited document retains its memory. Visibility notifications reduce active work, not retained memory. Measure realistic collections before claiming that any number of screens remains smooth.

## Future public gallery: preserved requirements

- Keep the existing square tiles and the site's settled layout/motion. Each project has an independent design system; its styles must not affect the portfolio or other projects.
- The primary direction is automatically interactive as a tile comes into view, without a manual activation click. Load only what is necessary near the visible gallery; avoid running every project's animation simultaneously.
- Some later projects may use an opening interaction that fills the main container. This is acknowledged but deferred; do not implement it in the canvas phase.
- Native nested scrolling should continue into the outer page when the inner project reaches its boundary. Test actual iframe/browser behavior before promising reliable scroll chaining.
- Mobile is deferred: possible static UI images instead of interactivity, or a different exploration flow. Do not commit to either yet.
- No custom project keyboard navigation is required. Preserve native buttons, typing, and an escape path from focus; do not deliberately disable native keyboard access.
- A preview must come from the same implementation, at matching dimensions and initial state. Keep it until the live view is ready. Account for fonts, assets, randomized data, and entrance animations so the handoff does not jump or restart visibly. Exact equivalence is not automatic.
- A framework may technically live inside one project's build and iframe without being imported by the portfolio. This is NOT approval to install one. Ask for approval per project and update the repo-wide runtime-dependency policy if an exception is agreed. Keep the portfolio framework-free.
- Measure built bytes, network downloads, frame behavior, and retained memory. Isolation does not remove the cost of frameworks or multiple loaded documents.

## Drag duplication and spatial reorder

Alt/Option can be held before a move or pressed after a screen or selection has
already started moving. The first press creates one copy of each selected screen,
restores the original positions, and continues the drag with the copies without
moving the camera or jumping the pointer. Repeated presses during the same drag
do not create more copies. The complete drag is one history edit. If the 200-added-
instance limit would be exceeded, no part of the group is copied and the original
move can continue.

A multi-selection arranged as a non-overlapping row, column, or complete aligned
grid shows pink center dots. Scattered or overlapping selections do not get dots;
reorder never silently tidies a selection. Drag a dot to insert that screen into
another spatial slot, shifting the screens in between. A blue outline previews
the drop position. Escape,
pointer cancellation, or window blur cancels a reorder and restores all positions.

Reorder changes positions, not the hierarchy in Layers, dimensions, preset, or
iframe identity. Existing horizontal and vertical gaps are preserved. With mixed
screen sizes, row heights and column widths follow the largest screen in each
band; an order that would exceed the workspace boundary is rejected. Each drag
is one undoable edit, and positions survive reload.

`dev/canvas/smart-selection.js` owns layout validation and pure slot planning.
`dev/canvas/smart-handles.js` owns the screen-space buttons and destination marker;
`canvas.js` owns gestures, model updates, and history. Neither module ships in the
production portfolio.

## Verification

Run `node tests/canvas-history.mjs` for history/shortcut checks, `node tests/canvas-geometry.mjs` for pure geometry checks and `node tests/canvas.mjs` after a build for browser checks. This uses the already installed Chromium headless shell and the Chrome DevTools Protocol, without adding a dependency. It checks development routing, preview denial, build exclusion, selection/click-through, preset locks, custom sizing, persistence, gestures, visibility/state retention, two-axis wheel pan and Command-modified inside-screen zoom, editable zoom, fit controls, duplicate shortcuts/restoration, toolbar spacing, multi-selection, partial/additive marquee selection, group movement, snap guides/equal gaps, protected deletion/restoration, title truncation, shared pan/frame bounds at several zoom levels, stale-marquee prevention, full-area group dragging, reference gap indicators, the real portfolio source, native active-screen scrolling, mobile contact scaling/drag/tap, vertical and nested horizontal inertia, deceleration and interruption, reduced-motion behavior, CSS/JavaScript hover suppression and desktop restoration, isolated refresh/configuration restoration, and repeated iframe duplication placement, document undo/redo and its exclusions, native text undo, rename/reset/cancel/persistence, hidden unavailable actions, and browser errors. Test physical trackpad/mouse behavior and platform-specific scrolling manually as well; automation does not replace those checks.

Run `node tests/canvas-activity.mjs` for the focused mobile activity regression. It opens the real portfolio card, compares a screenshot pixel with and without the cursor to prove paint order, checks that a tap has no focus ring, and verifies that Tab restores keyboard focus and a native top-layer outline.

Run `node tests/canvas-regressions.mjs` for field-to-screen Delete focus, native field editing, shortcuts from an older iframe, mobile selection focus, wide-screen row wrapping, seven fully loaded portfolio instances with one host reload stream, and a screenshot-pixel check during deliberately delayed refresh CSS. Pass `delete`, `duplicate`, `connections`, or `refresh` to run one case.

The focused `add-pages` regression covers modal dimensions, catalog indicators, adding duplicates, empty-canvas persistence and re-adding, add undo/redo, multi-page Shift-click and pointer-drag selection using a test-only catalog, and Layers pointer-drag selection. The `layers` regression uses device-icon drag handles for reordering and retains inline rename and iframe-state checks. The older `tests/canvas.mjs` suite still assumes last-instance deletion protection and includes wheel coordinates covered by the Layers drawer; it needs a separate update before its full result is meaningful.

Run `node tests/canvas-smart-selection.mjs` for row/column/grid reorder geometry,
mixed-size gap preservation, insertion, invalid layouts, and bounds.
The focused `node tests/canvas-regressions.mjs smart` browser case verifies dot
centering and hit targets, destination preview, Escape rollback, iframe retention,
plain insertion with modifiers held, absence of arrow-key position changes, and undo/redo. `node tests/canvas-regressions.mjs late-alt` checks
late modifier presses, stable moving-copy positions, group duplication, capacity
rejection, and history.
