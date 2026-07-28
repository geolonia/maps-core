// Runtime smoke: import the BUILT dist as native ESM (the path that
// dev/E2E via a bundler hides) and verify that all public exports exist.
// Catches named-export breakage from deps (e.g. maplibre-gl).
const m = await import(new URL("../dist/npm/index.js", import.meta.url));

const requiredClasses = ["GeoloniaMap", "GeoloniaMarker", "CustomAttributionControl", "GeoloniaControl", "SimpleStyle", "SimpleStyleVector"];
const requiredFunctions = ["getLang", "getStyle", "isGeoloniaTilesHost"];
const requiredValues = ["keyring", "coreVersion", "DEFAULT_STAGE"];

const missing = [];
for (const name of requiredClasses) {
  if (typeof m[name] !== "function") missing.push(`${name} (expected function, got ${typeof m[name]})`);
}
for (const name of requiredFunctions) {
  if (typeof m[name] !== "function") missing.push(`${name} (expected function, got ${typeof m[name]})`);
}
for (const name of requiredValues) {
  if (typeof m[name] === "undefined") missing.push(`${name} (undefined)`);
}

if (missing.length) {
  console.error(`✗ export problems:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ native-ESM import OK — ${requiredClasses.length + requiredFunctions.length + requiredValues.length} exports verified`);
