// Guard: every bare import in the built dist must be declared in
// package.json (dependencies / peerDependencies / optionalDependencies).
import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
]);
const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

const files = ["../dist/npm/index.js", "../dist/npm/index.cjs"];
const re = /(?:from|require\()\s*["']([^"'][^"']*)["']/g;

const toPkgName = (spec) =>
  spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];

const validSpec = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:\/[a-z0-9._-]+)*$/;

const missing = new Set();
const seen = new Set();
for (const f of files) {
  const src = readFileSync(new URL(f, import.meta.url), "utf8");
  for (const [, spec] of src.matchAll(re)) {
    if (spec.startsWith(".") || spec.startsWith("node:")) continue;
    if (!validSpec.test(spec)) continue;
    const name = toPkgName(spec);
    if (builtins.has(name)) continue;
    seen.add(name);
    if (!declared.has(name)) missing.add(name);
  }
}

console.log("imported bare packages:", [...seen].sort().join(", "));
if (missing.size) {
  console.error(
    `\n✗ imported but NOT declared in package.json: ${[...missing].sort().join(", ")}`,
  );
  console.error("  → add them to dependencies or peerDependencies.");
  process.exit(1);
}
console.log("✓ all imported packages are declared");
