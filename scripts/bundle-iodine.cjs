"use strict";
const fs = require("fs");
const path = require("path");

const IODINE_ROOT = path.join(__dirname, "..", "node_modules", "iodine-gba");
const CORE_DIR = path.join(IODINE_ROOT, "IodineGBA");
const OUTPUT_FILE = path.join(__dirname, "..", "public", "iodine-gba.bundle.js");

function findJSFiles(dir, prefix) {
  const entries = {};
  let found = false;
  try { found = fs.statSync(dir).isDirectory(); } catch (e) { return entries; }
  if (!found) return entries;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = prefix + entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(entries, findJSFiles(fullPath, relPath + "/"));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      entries[relPath] = fullPath;
    }
  }
  return entries;
}

const coreFiles = findJSFiles(CORE_DIR, "");
const includeFiles = findJSFiles(path.join(CORE_DIR, "includes"), "includes/");
const allFiles = Object.assign({}, coreFiles, includeFiles);

const moduleIds = Object.keys(allFiles).sort();

const RE_REQUIRE = /require\s*\(\s*(['"])((?:\.\/|\.\.\/)[^'"]+)\1\s*\)/g;

function resolveRelative(modulePath, request) {
  const dir = path.dirname(modulePath).replace(/\\/g, "/");
  const resolved = path.posix.resolve("/", dir, request).replace(/^\//, "");
  if (request.endsWith(".js")) return resolved;
  return resolved + ".js";
}

const sourceCache = {};

for (const id of moduleIds) {
  const raw = fs.readFileSync(allFiles[id], "utf8");
  const replaced = [];
  let prev = 0;
  let match;
  while ((match = RE_REQUIRE.exec(raw)) !== null) {
    const relPath = match[2];
    const resolvedId = resolveRelative(id, relPath);
    if (!allFiles[resolvedId]) {
      console.warn(`  [WARN] ${id}: require('${relPath}') -> '${resolvedId}' not found in bundle. Skipping.`);
      continue;
    }
    replaced.push(raw.slice(prev, match.index));
    replaced.push(`__req__("${resolvedId}")`);
    prev = RE_REQUIRE.lastIndex;
  }
  replaced.push(raw.slice(prev));
  sourceCache[id] = replaced.join("");
}

const bundleLines = [
  `(function(){var __modules__={};function __def__(id,factory){__modules__[id]={factory:factory,exports:{}}}`,
  `function __req__(id){var m=__modules__[id];if(m.exports.__cached)return m.exports;var f=m.factory;f(m,m.exports,function(d){return __req__(d)});m.exports.__cached=true;return m.exports}`,
];

for (const id of moduleIds) {
  const code = sourceCache[id];
  bundleLines.push(`__def__("${id}",function(module,exports,require){${code}});`);
}

bundleLines.push(
  `window.IodineGBA=__req__("IodineGBA/IodineGBA/GameBoyAdvanceEmulatorCore.js");})();`
);

const bundle = bundleLines.join("\n");
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, bundle, "utf8");
console.log(`Created ${OUTPUT_FILE} (${(Buffer.byteLength(bundle) / 1024).toFixed(0)} KB, ${moduleIds.length} modules)`);
