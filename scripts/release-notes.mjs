// Run by semantic-release to write the GitHub release notes (before the changelog is stamped):
//
//   node scripts/release-notes.mjs [previous-tag]
//
// Layout: a short summary of the whole release, then every change a person would
// notice (the "unreleased" entry of client/changelog.js, grouped by type), then
// every commit since the previous release, with all the changes listed in its body.
import { execFileSync } from "node:child_process";

const { entries } = await import(new URL("../client/changelog.js", import.meta.url).href);
const [previous] = process.argv.slice(2);
const pending = entries[0]?.unreleased ? entries[0] : { items: [] };

const groups = [["new", "Features"], ["improved", "Improvements"], ["fixed", "Bug fixes"], ["faster", "Performance"]];
const out = [];
if (pending.summary?.trim()) out.push(pending.summary.trim());
for (const [type, title] of groups) {
  const items = pending.items.filter(item => item.type === type);
  if (items.length) out.push(`### ${title}\n\n${items.map(item => `- ${item.text}`).join("\n")}`);
}

const SEPARATOR = "\u001e", FIELD = "\u001f";
const range = previous && previous !== "undefined" && previous !== "null" ? `${previous}..HEAD` : "HEAD";
let log = "";
try { log = execFileSync("git", ["log", range, "--no-merges", `--format=%h${FIELD}%s${FIELD}%b${SEPARATOR}`], { encoding: "utf8" }); } catch { /* no history to list */ }
const commits = log.split(SEPARATOR).map(chunk => chunk.trim()).filter(Boolean).map(chunk => {
  const [hash, subject, body = ""] = chunk.split(FIELD);
  // A body line starting with "- " opens a change; a line that follows continues it (commit bodies are hard-wrapped).
  const changes = [];
  for (const line of body.split("\n").map(line => line.trim()).filter(Boolean)) {
    if (/^[-*]\s+/.test(line) || !changes.length) changes.push(line.replace(/^[-*]\s+/, ""));
    else changes[changes.length - 1] += ` ${line}`;
  }
  const lines = changes.map(change => `  - ${change}`);
  return { hash, subject, lines };
}).filter(commit => !/^chore\(release\)/.test(commit.subject));
if (commits.length) out.push(`### All commits\n\n${commits.map(commit => [`- ${commit.subject} (${commit.hash})`, ...commit.lines].join("\n")).join("\n")}`);

console.log(out.join("\n\n"));
