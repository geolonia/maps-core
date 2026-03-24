// Classes
export { default as GeoloniaMap } from './lib/geolonia-map';
export { default as GeoloniaMarker } from './lib/geolonia-marker';
export { SimpleStyle } from './lib/simplestyle';
export { default as SimpleStyleVector } from './lib/simplestyle-vector';

// Controls
export { default as CustomAttributionControl } from './lib/controls/attribution';
export { GeoloniaControl } from './lib/controls/geolonia-logo';

// Configuration
export { keyring } from './lib/keyring';

// Utilities
export { getStyle, getLang, isGeoloniaTilesHost } from './lib/util';

// Types
export type { GeoloniaMapOptions } from './types';

// Version
export { VERSION as coreVersion } from './version';
