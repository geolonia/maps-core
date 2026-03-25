// Classes

// Controls
export { default as CustomAttributionControl } from "./lib/controls/attribution";
export { GeoloniaControl } from "./lib/controls/geolonia-logo";
export { default as GeoloniaMap } from "./lib/geolonia-map";
export { default as GeoloniaMarker } from "./lib/geolonia-marker";
// Configuration
export { keyring } from "./lib/keyring";
export { SimpleStyle } from "./lib/simplestyle";
export { default as SimpleStyleVector } from "./lib/simplestyle-vector";

// Utilities
export { getLang, getStyle, isGeoloniaTilesHost } from "./lib/util";

// Types
export type { GeoloniaMapOptions } from "./types";

// Version
export { VERSION as coreVersion } from "./version";
