// Run by semantic-release before publishing: turns the "unreleased" entry in
// client/changelog.js into a real release (version + date) and leaves a fresh
// empty "unreleased" entry on top for the next change.
//
//   node scripts/stamp-changelog.mjs <version> [ISO date or timestamp]
import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../client/changelog.js", import.meta.url);
const [version, date = new Date().toISOString()] = process.argv.slice(2);
if (!version) { console.error("usage: stamp-changelog.mjs <version> [date]"); process.exit(1); }

const { entries } = await import(file.href);
const pending = entries[0]?.unreleased ? entries[0] : null;
if (!pending || !pending.items.length) { console.log("changelog: nothing unreleased, left as is"); process.exit(0); }

const source = await readFile(file, "utf8");
const header = "export const entries = [\n";
if (!source.includes(header) || !source.split(header)[1]?.includes("unreleased: true,")) { console.error("changelog.js no longer matches the stamp format"); process.exit(1); }

const [head, rest] = source.split(header);
const stamped = `${head}${header}  {\n    unreleased: true,\n    summary: '',\n    items: [],\n  },\n${rest.replace("unreleased: true,", `version: '${version}',\n    date: '${date}',`)}`;
await writeFile(file, stamped);
console.log(`changelog: stamped ${version} (${date})`);
