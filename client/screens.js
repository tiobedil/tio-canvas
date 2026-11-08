// The canvas reads its screens from here. `project.js` is not a file of the
// package: the development server serves the project's own config in its place
// (and a build writes it), so the list of pages always belongs to the project.
import { screens, storageKey } from './project.js';
import { screenKinds, presets, validateScreens } from './registry.js';
validateScreens(screens);
export { screens, screenKinds, presets, storageKey };
