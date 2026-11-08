// Run by semantic-release before publishing: writes the release version into
// client/version.js so the canvas can show which version is installed.
//
//   node scripts/stamp-version.mjs <version>
import { writeFile } from "node:fs/promises";

const [version] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) { console.error("usage: stamp-version.mjs <major.minor.patch>"); process.exit(1); }
await writeFile(new URL("../client/version.js", import.meta.url), `// The installed version of the package. scripts/stamp-version.mjs rewrites it on release.\nexport const version = '${version}';\n`);
console.log(`version: stamped ${version}`);
