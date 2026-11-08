#!/usr/bin/env node
const [command, ...rest] = process.argv.slice(2);
const commands = {
  thumbnails: () => import("../src/thumbnails.js")
};
if (!commands[command]) {
  console.error(`Usage: tio-canvas thumbnails [base-url] [--missing|--check] [--config <file>] [--out <dir>]`);
  process.exit(command ? 1 : 0);
}
process.argv.splice(2, 1, ...rest);
process.argv.length = 2 + rest.length;
await commands[command]();
