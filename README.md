# @geolonia/maps-core

Core library for Geolonia Maps. Extends [MapLibre GL JS](https://maplibre.org/) with Geolonia Maps platform integration.

Designed to be side-effect-free and DOM-independent, serving as the shared foundation for downstream packages such as maps-embed and maps-react.

## Install

```bash
npm install @geolonia/maps-core maplibre-gl
```

`maplibre-gl` is a peer dependency.

## Usage

```typescript
import 'maplibre-gl/dist/maplibre-gl.css';
import '@geolonia/maps-core/css';
import { GeoloniaMap } from '@geolonia/maps-core';

const map = new GeoloniaMap({
  container: '#map',
  apiKey: 'YOUR-API-KEY',
  style: 'geolonia/basic-v2',
  center: [139.7671, 35.6812],
  zoom: 14,
});
```

### Using External Styles Without API Key

```typescript
const map = new GeoloniaMap({
  container: '#map',
  style: 'https://tile.openstreetmap.jp/styles/osm-bright/style.json',
  center: [139.7671, 35.6812],
  zoom: 14,
});
```

Geolonia API key is only required when using Geolonia's hosted styles and tiles.

## API

### `GeoloniaMap`

Extends `maplibregl.Map`. Accepts `GeoloniaMapOptions`.

```typescript
const map = new GeoloniaMap({
  container: '#map',           // HTMLElement or CSS selector
  apiKey: 'YOUR-API-KEY',      // Geolonia API key
  style: 'geolonia/basic-v2',  // Style name or URL
  center: [139.77, 35.68],     // [lng, lat]
  zoom: 12,

  // All optional
  lang: 'auto',                 // 'ja' | 'en' | 'auto'
  stage: 'v1',                  // 'dev' | 'v1'
  marker: true,                 // Show default marker at center
  markerColor: '#E4402F',
  openPopup: false,             // Auto-open marker popup
  customMarker: '#my-marker',   // CSS selector for custom marker element
  customMarkerOffset: [0, -15],
  loader: true,                 // Loading animation
  gestureHandling: true,        // Gesture control on scrollable pages
  navigationControl: true,      // true | false | 'top-right' etc.
  geolocateControl: false,
  fullscreenControl: false,
  scaleControl: false,
  geoloniaControl: true,        // Geolonia logo
  geojson: 'https://example.com/data.geojson',
  cluster: true,
  clusterColor: '#ff0000',
  simpleVector: 'my-tileset',   // Vector tile URL or tileset ID
  '3d': false,
  errorMessage: undefined,      // Message shown when the map fails to initialize
});
```

#### `errorMessage`

When the map cannot be initialized (typically because WebGL is unavailable on the
device), the container is replaced with a message telling the visitor what to try:
restart the browser, restart the device, try another browser, update the graphics
driver, and contact the site owner if it still fails. The message is shortened, and
finally reduced to the headline alone, as the map container gets smaller.

Pass `errorMessage` to take that over:

```typescript
// Replace the wording. The value is rendered as plain text, not as HTML.
new GeoloniaMap({ container: '#map', errorMessage: 'Sorry, the map is unavailable.' });

// Show nothing at all, e.g. when the page renders its own fallback.
new GeoloniaMap({ container: '#map', errorMessage: false });
```

### `GeoloniaMarker`

Extends `maplibregl.Marker` with Geolonia's default marker style.

```typescript
import { GeoloniaMarker } from '@geolonia/maps-core';

new GeoloniaMarker({ color: '#0066FF' })
  .setLngLat([139.77, 35.68])
  .addTo(map);
```

### `SimpleStyle`

GeoJSON visualization based on [simplestyle-spec](https://github.com/mapbox/simplestyle-spec).

```typescript
import { SimpleStyle } from '@geolonia/maps-core';

const ss = new SimpleStyle(geojson, { cluster: true });
ss.addTo(map).fitBounds();
```

### `keyring`

API key and stage management.

```typescript
import { keyring } from '@geolonia/maps-core';

keyring.setApiKey('YOUR-API-KEY');
keyring.setStage('v1');
```

## Related Packages

| Package | Description |
|---------|-------------|
| `@geolonia/maps-embed` | HTML `data-*` attribute map embedding |
| `@geolonia/maps-react` | React components |

## Development

```bash
npm install
npm run build     # ESM + CJS + DTS
npm run test      # Vitest unit tests
npm run e2e       # Playwright E2E tests
npm run lint      # Biome
npm run dev       # Vite dev server (example/)
```

## License

MIT
