import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const files = [...readdirSync(new URL("./unit", import.meta.url)).map((f) => `tests/unit/${f}`), "tests/smoke.mjs"];
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [file], { stdio: "inherit" });
  console.log(`${result.status === 0 ? "PASS" : "FAIL"} ${file}`);
  if (result.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
