// Run by semantic-release to write the GitHub release notes (before the changelog is stamped):
//
//   node scripts/release-notes.mjs [previous-tag] [next-version]
//
// Layout: a short summary of the whole release, then every change a person would
// notice, grouped the same way as the in-app Change log (a heading per kind, in its
// order and with its names), then every commit since the previous release, with all
// the changes listed in its body.
//
// semantic-release runs generateNotes again after prepare has stamped the changelog,
// so the release's entry is either still "unreleased" or already carries next-version.
import { execFileSync } from "node:child_process";

const { entries, labels, groupByType } = await import(new URL("../client/changelog.js", import.meta.url).href);
const [previous, next] = process.argv.slice(2);
const pending = (next && entries.find(entry => entry.version === next)) || entries.find(entry => entry.unreleased) || { items: [] };

const out = [];
if (pending.summary?.trim()) out.push(pending.summary.trim());
for (const [type, items] of groupByType(pending.items)) {
  out.push(`### ${labels[type] ?? type}\n\n${items.map(item => `- ${item.text}`).join("\n")}`);
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
