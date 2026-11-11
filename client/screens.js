// The canvas reads its screens and components from here. `project.js` is not a
// file of the package: the development server serves the project's own config in
// its place (and a build writes it), so both lists always belong to the project.
import * as project from './project.js';
import { screenKinds, presets, validateScreens, validateComponents } from './registry.js';
const { screens, storageKey } = project;
// Components are optional: a project that lists none shows an empty Components tab.
// The ones the canvas found by itself (autoComponents) come after the ones the project lists.
const components = [...(project.components ?? []), ...(project.autoComponents ?? [])];
// What the scan could not settle (see component-issues.js); only a development server sends any.
const componentIssues = project.componentIssues ?? [];
validateScreens(screens);
validateComponents(components);
export { screens, components, componentIssues, screenKinds, presets, storageKey };
