# @geolonia/maps-core

Core library for Geolonia Maps. Extends [MapLibre GL JS](https://maplibre.org/) with Geolonia Maps platform integration.

Designed to be side-effect-free and DOM-independent, serving as the shared foundation for downstream packages such as maps-embed and maps-react.

## Install

```bash
npm install @geolonia/maps-core maplibre-gl
```

`maplibre-gl` is a peer dependency. v6.x is required (`^6.0.0`).

This package is ESM-only, following MapLibre GL JS v6. There is no `require()`
entry point. If you need a script-tag build, use the UMD bundle attached to each
[GitHub Release](https://github.com/geolonia/maps-core/releases) — it is
self-contained and needs no worker setup. It does run its worker from a Blob
URL, so a page with a Content-Security-Policy needs `worker-src blob:`.

### Worker setup

MapLibre GL JS v6 ships ESM-only and loads its worker from a real URL resolved
against `import.meta.url`. Most bundlers do not carry that file over on their
own, so the map silently never finishes loading unless you point MapLibre at
the worker yourself. Do this once, before the first map is created.

Two files are involved, not one: `maplibre-gl-worker.mjs` is a small shim that
imports `./maplibre-gl-shared.mjs` as a sibling. That splits the setups in two.
Run the worker through the bundler's own worker pipeline and it comes out as a
self-contained chunk, with nothing else to place. Copy or serve the shim
verbatim instead, and the sibling has to sit next to it in the output — miss it
and the worker dies on its first import, with no exception and no console error.

Vite has such a pipeline, and `?worker&url` is what routes the file through it:

```typescript
// Vite
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { setWorkerUrl } from 'maplibre-gl';

setWorkerUrl(workerUrl);
```

Plain `?url` is not enough — it emits the shim verbatim, which puts you in the
second case without the sibling.

webpack is in that second case: copy both files into the output and point at the
copy. Note that `new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url)`
does *not* work — webpack emits the shim on its own, leaving the sibling import
to 404.

```bash
npm install --save-dev copy-webpack-plugin
```

```js
// webpack.config.js
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'),
          to: 'maplibre-gl-worker.mjs',
        },
        {
          from: require.resolve('maplibre-gl/dist/maplibre-gl-shared.mjs'),
          to: 'maplibre-gl-shared.mjs',
        },
      ],
    }),
  ],
};
```

```typescript
import { setWorkerUrl } from 'maplibre-gl';

setWorkerUrl('maplibre-gl-worker.mjs');
```

For esbuild, Rollup and Turbopack, see
[the MapLibre docs](https://maplibre.org/maplibre-gl-js/docs/) — and work out
which of the two cases above your setup lands in.

Loading MapLibre from a CDN as an ES module needs no setup: the worker URL is
derived from the module's own URL. Cross-origin, MapLibre starts that worker
from a same-origin Blob URL, so the page needs `worker-src blob:`. If your CSP
cannot allow that, host the two worker files yourself and name the worker
explicitly before creating a map:

```typescript
import { setWorkerUrl } from 'maplibre-gl';

setWorkerUrl('/path/to/maplibre-gl-worker.mjs');
```

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
npm run build     # ESM + DTS
npm run test      # Vitest unit tests
npm run e2e       # Playwright E2E tests
npm run lint      # Biome
npm run dev       # Vite dev server (example/)
```

## License

MIT
