// Put the interface on the page. This runs first, before any module that looks
// for an element by id (tooltip.js, shortcuts.js, canvas.js).
import { buildShell } from './shell.js';

document.body.prepend(...buildShell());
