import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { readdir, readFile, stat } from "node:fs/promises";
import { build, transform } from "esbuild";

/**
 * Finds the components of a project by itself, and reports what it cannot settle.
 *
 * Two rules keep it honest:
 *  - A file is listed only on strong evidence (see `findComponents`).
 *  - An issue is reported only when it is certain: a file that is gone, an export
 *    that is gone, controls that name a prop the source no longer has. A guess
 *    never becomes an issue, and every issue can be cleared by editing the config.
 *
 * Props are read from TypeScript types. TypeScript is the project's own
 * (resolved from its root, never bundled with the canvas); without it components
 * are still listed, only without controls.
 */

/** Where components usually live, relative to the project root. A project adds more with `componentDirs`. */
export const DEFAULT_COMPONENT_DIRS = ["src/components", "components", "app/components", "src/app/components", "src/ui", "ui", "src/shared/components", "src/lib/components"];

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", "coverage", "__tests__", "__mocks__"]);
const SKIP_FILES = /\.(?:test|spec|stories|story|d)\.[jt]sx?$/;
const SOURCE_FILES = /\.(?:tsx|jsx)$/;
const RESOLVE_EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", ".mjs"];
const PASCAL = /^[A-Z](?=\w*[a-z])\w*$/;
const IGNORED_PROPS = new Set(["className", "style", "key", "ref"]);

const posix = file => file.split(path.sep).join("/");
const readable = file => stat(file).then(info => info.isFile(), () => false);
const isDirectory = dir => stat(dir).then(info => info.isDirectory(), () => false);

/** The directories to scan, as absolute paths: the defaults and the project's own. */
function scanDirectories(root, extra = []) {
  const names = [...new Set([...DEFAULT_COMPONENT_DIRS, ...extra])];
  return names.map(name => path.resolve(root, name));
}

/** The directories the host should watch, found without loading the config (the host asks synchronously). */
export function componentWatchDirs(project) {
  let extra = [];
  try {
    const source = readFileSync(project.configFile, "utf8");
    const list = /export\s+const\s+componentDirs\s*=\s*(\[[^\]]*\])/.exec(source)?.[1] ?? "";
    extra = [...list.matchAll(/(['"`])(.*?)\1/g)].map(match => match[2]);
  } catch { /* no config yet: the defaults will do */ }
  return scanDirectories(project.root, extra).filter(dir => existsSync(dir));
}

// ---- Reading a source file without running it ------------------------------------

/** Blank out comments, keeping every character offset. */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, (_, before) => before);
}

/** Does `( ... )` starting at `at` end in `=>`? (An arrow function, not a bracketed value.) */
function arrowAfter(text, at) {
  let depth = 0;
  for (let index = at; index < text.length; index++) {
    if (text[index] === "(") depth++;
    else if (text[index] === ")" && --depth === 0) return /^\s*(?::[^=;{]*?)?\s*=>/.test(text.slice(index + 1, index + 200));
  }
  return false;
}

/**
 * The React components a file declares and exports, found from how they are written:
 * a capitalised function, an arrow function, a class that extends Component, or a
 * forwardRef / memo around one. Returns { components, candidates, jsx }:
 *   components  [{ local, exportName }]   exportName is "default" for a default export
 *   candidates  capitalised names the file exports, whether or not they look like components
 */
export async function readSource(file, source) {
  let jsx = false;
  try {
    const output = (await transform(source, { loader: /\.tsx$/.test(file) ? "tsx" : "jsx", jsx: "automatic", sourcefile: file })).code;
    jsx = /\b_?jsxs?\(|\bjsxDEV\(|\bcreateElement\(/.test(output);
  } catch { return null; }
  const text = withoutComments(source);
  const declared = new Map();
  for (const match of text.matchAll(/^[ \t]*(export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Z]\w*)\s*[<(]/gm)) declared.set(match[2], { exported: match[1] });
  for (const match of text.matchAll(/^[ \t]*(export\s+)?class\s+([A-Z]\w*)\s+extends\s+(?:React\.)?(?:Pure)?Component\b/gm)) declared.set(match[2], { exported: match[1] });
  for (const match of text.matchAll(/^[ \t]*(export\s+)?(?:const|let|var)\s+([A-Z]\w*)\s*(?::[^=\n]+)?=\s*/gm)) {
    const rest = text.slice(match.index + match[0].length);
    const wrapped = /^(?:React\.)?(?:forwardRef|memo)\s*(?:<[^(]*?>)?\s*\(/.test(rest);
    const plain = /^(?:async\s+)?function\b/.test(rest) || /^(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/.test(rest) || (/^(?:async\s+)?\(/.test(rest) && arrowAfter(rest, rest.indexOf("(")));
    if (wrapped || plain) declared.set(match[2], { exported: match[1] });
  }
  const names = new Map(); // local name -> export name
  for (const [local, { exported }] of declared) if (exported) names.set(local, /default/.test(exported) ? "default" : local);
  for (const match of text.matchAll(/^[ \t]*export\s+default\s+([A-Z]\w*)\s*;?[ \t]*$/gm)) if (declared.has(match[1]) && !names.has(match[1])) names.set(match[1], "default");
  for (const match of text.matchAll(/^[ \t]*export\s*\{([^}]*)\}(?!\s*from)/gm)) {
    for (const part of match[1].split(",")) {
      const [local, as] = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
      if (local && declared.has(local) && !names.has(local)) names.set(local, as ?? local);
    }
  }
  const components = [...names].map(([local, exportName]) => ({ local, exportName })).filter(item => item.exportName === "default" || PASCAL.test(item.exportName));
  return { components, jsx, server: /["']use server["']|["']server-only["']/.test(text) };
}

// ---- Reading props from TypeScript ----------------------------------------------

function loadTypeScript(root) {
  try { return createRequire(path.join(root, "package.json"))("typescript"); } catch { return null; }
}

function literalValue(ts, node) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  return undefined;
}

/** `function Button({ variant = "primary" })`: the defaults written in the first parameter. */
function destructuredDefaults(ts, declaration) {
  const defaults = new Map();
  const find = node => {
    if (!node) return undefined;
    if (ts.isFunctionLike(node)) return node;
    if (ts.isVariableDeclaration(node)) return find(node.initializer);
    if (ts.isCallExpression(node)) for (const argument of node.arguments) { const found = find(argument); if (found) return found; }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return find(node.expression);
    return undefined;
  };
  const parameter = find(declaration)?.parameters?.[0];
  if (parameter && ts.isObjectBindingPattern(parameter.name)) {
    for (const element of parameter.name.elements) {
      const value = literalValue(ts, element.initializer);
      if (value !== undefined) defaults.set((element.propertyName ?? element.name).getText(), value);
    }
  }
  return defaults;
}

/** One prop as a dial, or null when a dial cannot set it (functions, objects, elements). */
function controlFor(ts, checker, name, type, fallback, title) {
  const flags = ts.TypeFlags;
  const plain = checker.getNonNullableType(type);
  if (name === "children") {
    const text = checker.typeToString(plain);
    return /ReactNode|ReactElement|JSX|string/.test(text) && !/=>/.test(text) ? { type: "text", value: title } : null;
  }
  if (plain.flags & flags.Boolean) return { type: "boolean", value: fallback === true };
  if (plain.flags & flags.String) return { type: "text", value: typeof fallback === "string" ? fallback : "" };
  if (plain.flags & flags.Number) return { type: "number", value: typeof fallback === "number" ? fallback : 0 };
  if (!plain.isUnion()) return null;
  const members = plain.types;
  if (members.every(member => member.isStringLiteral() || member.isNumberLiteral())) {
    const values = members.map(member => member.value);
    if (values.length < 2) return null;
    return { type: "select", options: values, value: values.includes(fallback) ? fallback : values[0] };
  }
  // "a" | "b" | (string & {}): any text, with suggestions
  if (members.every(member => member.isStringLiteral() || (member.flags & flags.Intersection && member.types.some(part => part.flags & flags.String)))) return { type: "text", value: typeof fallback === "string" ? fallback : "" };
  return null;
}

/**
 * What TypeScript says about every export of each file:
 *   Map(file -> Map(exportName -> { callable, readable, names, controls }))
 * `readable` is true only when the props type could be read completely.
 */
function readExports(ts, root, files, previous) {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  let options = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.NodeJs, esModuleInterop: true, strict: true };
  if (configPath) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!config.error) options = { ...options, ...ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options };
  }
  options = { ...options, jsx: options.jsx ?? ts.JsxEmit.ReactJSX, allowJs: true, noEmit: true, skipLibCheck: true, incremental: false, composite: false };
  const program = ts.createProgram({ rootNames: files, options, oldProgram: previous });
  const checker = program.getTypeChecker();
  const result = new Map();
  for (const file of files) {
    const source = program.getSourceFile(file);
    const symbol = source && checker.getSymbolAtLocation(source);
    const exports = new Map();
    result.set(file, exports);
    if (!symbol) continue;
    for (const exported of checker.getExportsOfModule(symbol)) {
      const symbolName = exported.getName();
      let target = exported;
      if (target.flags & ts.SymbolFlags.Alias) { try { target = checker.getAliasedSymbol(target); } catch { /* keep the alias */ } }
      const declaration = target.valueDeclaration ?? target.declarations?.[0] ?? exported.declarations?.[0];
      const type = checker.getTypeOfSymbolAtLocation(target, declaration ?? source);
      if (type.flags & ts.TypeFlags.Any) { exports.set(symbolName, { callable: null, readable: false, names: [], controls: [] }); continue; }
      const signature = type.getCallSignatures()[0] ?? type.getConstructSignatures()[0];
      if (!signature) { exports.set(symbolName, { callable: false, readable: false, names: [], controls: [] }); continue; }
      const returned = signature.getReturnType();
      const returns = returned.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown) ? "unknown" : /Element|ReactNode|ReactPortal/.test(checker.typeToString(returned)) ? "element" : "other";
      const info = { callable: true, returns, readable: false, names: [], controls: [], title: symbolName === "default" && target.getName() !== "default" ? target.getName() : symbolName };
      exports.set(symbolName, info);
      const parameter = signature.getParameters()[0];
      if (!parameter) { info.readable = true; continue; }
      const propsType = checker.getTypeOfSymbolAtLocation(parameter, parameter.valueDeclaration ?? source);
      if (propsType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) continue;
      info.readable = !propsType.getStringIndexType();
      const defaults = declaration ? destructuredDefaults(ts, declaration) : new Map();
      const title = info.title === "default" ? path.basename(file).replace(/\.\w+$/, "") : info.title;
      for (const prop of propsType.getProperties()) {
        const name = prop.getName();
        info.names.push(name);
        // Props the project declares itself, not the hundreds an HTML element adds.
        const places = prop.declarations ?? [];
        if (places.length && places.every(place => { const from = place.getSourceFile(); return program.isSourceFileFromExternalLibrary(from) || program.isSourceFileDefaultLibrary(from) || /[\\/]node_modules[\\/]/.test(from.fileName); })) continue;
        if (IGNORED_PROPS.has(name)) continue;
        const control = controlFor(ts, checker, name, checker.getTypeOfSymbolAtLocation(prop, places[0] ?? declaration ?? source), defaults.get(name), title);
        if (control) info.controls.push({ name, control });
      }
    }
  }
  return { result, program };
}

// ---- Which exports a module has (for the components a project lists itself) -------

const exportCache = new Map();

/** The export names of a module, or null when they cannot be known for certain. */
async function moduleExports(file) {
  const cached = exportCache.get(file);
  if (cached) {
    const same = await Promise.all(cached.inputs.map(async ([input, time]) => (await stat(input).catch(() => null))?.mtimeMs === time));
    if (same.every(Boolean)) return cached.names;
  }
  let names = null, inputs = [];
  try {
    const source = await readFile(file, "utf8");
    if (/export\s*\*\s*from\s*['"][^./]/.test(source)) return null; // names that live in a package
    const result = await build({ entryPoints: [file], bundle: true, write: false, metafile: true, format: "esm", packages: "external", outdir: path.dirname(file), jsx: "automatic", loader: { ".js": "jsx" }, logLevel: "silent" });
    names = Object.values(result.metafile.outputs)[0]?.exports ?? null;
    inputs = await Promise.all(Object.keys(result.metafile.inputs).map(async input => { const absolute = path.resolve(input); return [absolute, (await stat(absolute).catch(() => null))?.mtimeMs]; }));
  } catch { return null; }
  exportCache.set(file, { names, inputs });
  return names;
}

// ---- The scan -----------------------------------------------------------------------

async function walk(dir, files = []) {
  for (const entry of (await readdir(dir, { withFileTypes: true }).catch(() => [])).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) await walk(full, files); }
    else if (SOURCE_FILES.test(entry.name) && !SKIP_FILES.test(entry.name)) files.push(full);
  }
  return files;
}

const kebab = name => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
const pascal = text => text.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join("");
const titleCase = text => text.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");

/** The file a `module` path names, trying the extensions a bundler would; null for a name that is not a path. */
async function resolveModule(projectDir, specifier) {
  if (!/^\.{0,2}\//.test(specifier)) return { bare: true };
  const base = path.resolve(projectDir, specifier);
  for (const extension of RESOLVE_EXTENSIONS) if (await readable(base + extension)) return { file: base + extension };
  for (const extension of RESOLVE_EXTENSIONS.slice(1)) if (await readable(path.join(base, `index${extension}`))) return { file: path.join(base, `index${extension}`) };
  return { missing: true };
}

const caches = { files: new Map(), types: null };

/**
 * Scan a project for components.
 *   dirs     extra directories (from `componentDirs` in the config), beside the defaults
 *   exclude  files or folders (from `componentExclude`) the scan leaves alone
 *   manual   the components the config lists itself; the scan never lists these twice
 * Returns { auto, issues }: components to add to the list, and what needs a person.
 */
export async function scanComponents(project, { dirs = [], exclude = [], manual = [] } = {}) {
  const root = project.root;
  const excluded = exclude.map(item => path.resolve(root, item));
  const isExcluded = file => excluded.some(item => file === item || file.startsWith(item + path.sep));
  const found = new Set();
  for (const dir of scanDirectories(root, dirs)) if (await isDirectory(dir)) for (const file of await walk(dir)) found.add(file);
  const files = [...found].filter(file => !isExcluded(file)).sort();

  // What the config lists itself: where each entry points, and whether that file exists.
  const listed = [];
  const issues = [];
  for (const component of manual) {
    const target = await resolveModule(project.projectDir, component.module);
    if (target.bare) continue;
    if (target.missing) { issues.push({ kind: "missing-file", id: component.id, title: component.title, module: component.module }); continue; }
    listed.push({ component, file: target.file });
  }
  const listedFiles = new Set(listed.map(item => item.file));
  const undecided = new Set();
  const listedKeys = new Set(listed.map(item => `${item.file}\n${item.component.export ?? "default"}`));

  // Read each source file once; reuse the answer while the file is unchanged.
  const sources = new Map();
  for (const file of files) {
    const info = await stat(file);
    const cached = caches.files.get(file);
    if (cached && cached.time === info.mtimeMs && cached.size === info.size) { sources.set(file, cached.read); continue; }
    const read = await readSource(file, await readFile(file, "utf8"));
    caches.files.set(file, { time: info.mtimeMs, size: info.size, read });
    sources.set(file, read);
  }

  // Props, when the project has TypeScript.
  const ts = loadTypeScript(root);
  const checkedManual = listed.filter(item => !item.component.render && /\.[jt]sx?$/.test(item.file));
  const drawable = file => { const read = sources.get(file); return read && read.jsx && !read.server; };
  const toRead = [...new Set([...files.filter(drawable), ...checkedManual.map(item => item.file)])].sort();
  let types = new Map();
  if (ts && toRead.length) {
    const key = JSON.stringify(await Promise.all(toRead.map(async file => [file, (await stat(file)).mtimeMs])));
    if (caches.types?.key !== key) {
      const read = readExports(ts, root, toRead, caches.types?.program);
      caches.types = { key, result: read.result, program: read.program };
    }
    types = caches.types.result;
  }

  // Components found by the scan: those written like one, and any other export that
  // TypeScript proves is a function returning an element (a wrapper, a lazy component).
  const taken = new Set(manual.map(component => component.id));
  const auto = [];
  let withoutTypes = 0;
  const directories = scanDirectories(root, dirs);
  for (const file of files) {
    if (!drawable(file)) continue;
    const owner = directories.find(dir => file.startsWith(dir + path.sep));
    const folders = owner ? path.relative(owner, path.dirname(file)).split(path.sep).filter(Boolean) : [];
    const exported = types.get(file);
    const byName = new Map(sources.get(file).components.map(item => [item.exportName, item]));
    for (const [exportName, info] of exported ?? []) {
      if (byName.has(exportName) || (exportName !== "default" && !PASCAL.test(exportName))) continue;
      if (info.callable && info.returns === "element") byName.set(exportName, { local: info.title, exportName });
      else if (info.callable !== false && info.returns !== "other" && !listedFiles.has(file)) undecided.add(file);
    }
    for (const { local, exportName } of byName.values()) {
      const info = exported?.get(exportName);
      if (info && info.callable === false) continue; // TypeScript says it is not a component
      if (listedKeys.has(`${file}\n${exportName}`)) continue;
      const name = exportName === "default" ? (PASCAL.test(local) ? local : pascal(path.basename(file).replace(/\.\w+$/, ""))) : exportName;
      let id = kebab(name), n = 2;
      if (taken.has(id) && folders.length) id = kebab(`${folders.join("-")}-${name}`);
      while (taken.has(id)) id = `${kebab(name)}-${n++}`;
      taken.add(id);
      const controls = {};
      for (const { name: prop, control } of info?.controls ?? []) controls[prop] = control;
      auto.push({
        id, title: name, group: folders.length ? titleCase(folders[0]) : "Components", auto: true,
        module: relativeModule(project.projectDir, file), ...(exportName === "default" ? {} : { export: exportName }), controls,
      });
    }
    if (!ts && /\.tsx$/.test(file) && byName.size) withoutTypes++;
  }
  // Functions that return something TypeScript cannot name (an unresolved import, say): maybe components.
  for (const file of [...undecided].sort()) issues.push({ kind: "unlisted", file: posix(path.relative(root, file)) });
  if (withoutTypes) issues.push({ kind: "no-typescript", count: withoutTypes });

  // The components the config lists: does each still match its source?
  for (const { component, file } of listed) {
    if (component.render) continue;
    const exportName = component.export ?? "default";
    const names = await moduleExports(file);
    if (names && !names.includes(exportName)) { issues.push({ kind: "missing-export", id: component.id, title: component.title, module: component.module, export: exportName }); continue; }
    const info = types.get(file)?.get(exportName);
    if (!info?.callable || !info.readable) continue;
    const have = Object.keys(component.controls ?? {}), ignore = component.ignore ?? [];
    const extra = have.filter(name => !info.names.includes(name));
    const missing = info.controls.filter(item => !have.includes(item.name) && !ignore.includes(item.name)).map(item => ({ name: item.name, type: item.control.type, ...(item.control.options ? { options: item.control.options } : {}) }));
    if (extra.length || missing.length) issues.push({ kind: "controls-out-of-date", id: component.id, title: component.title, module: component.module, missing, extra });
  }
  return { auto, issues };
}

function relativeModule(fromDir, file) {
  const relative = posix(path.relative(fromDir, file));
  return relative.startsWith(".") ? relative : `./${relative}`;
}
