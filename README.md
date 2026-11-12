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
  choropleth: 'value',          // Color polygons by a property (see below)
  heatmap: 'weight',            // Draw points as a heatmap (see below)
  circle: { size: 'weight', color: 'category' }, // Size and color points (see below)
  extrusion: 'population',      // Extrude polygons by a property (see below)
  simpleVector: 'my-tileset',   // Vector tile URL or tileset ID
  mask: './boundary.geojson',   // Darken outside a boundary (see below)
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

#### `choropleth`, `heatmap` and `circle`

Style the `geojson` data by the values of its properties, without writing MapLibre expressions.

```typescript
// Color polygons by `value`. The range defaults to the min and max of the data.
new GeoloniaMap({ container: '#map', geojson, choropleth: 'value' });
new GeoloniaMap({
  container: '#map',
  geojson,
  choropleth: { property: 'value', colors: ['#FFF2CC', '#B3261E'], range: [0, 100] },
});

// Draw points as a heatmap. `true` weights every point equally.
new GeoloniaMap({ container: '#map', geojson, heatmap: 'weight' });

// Size points by `weight` and color them by `category`.
// Numeric values get a color ramp, other values one color per category.
new GeoloniaMap({ container: '#map', geojson, circle: { size: 'weight', color: 'category' } });
```

- These options take precedence over simplestyle properties such as `fill` and `marker-color`. Features without a numeric value fall back to the simplestyle look.
- `heatmap` and `circle` turn clustering off. `heatmap` also hides the point markers. `circle` draws every point as a circle, including points with `marker-symbol`, and hides the icons and titles.
- The range and categories are computed again when the GeoJSON is loaded from a URL or replaced with `updateData()`.
- `colors` is optional. The defaults are Geolonia's orange ramp and a categorical palette.
- With `choropleth`, polygons without a `fill-opacity` property are drawn at 0.7 opacity instead of 1, so that the base map shows through.
- With `circle.color`, a property is treated as numeric only when every value is a number. Numeric strings such as `"12"` count as categories. Objects and arrays are not colored.

#### `extrusion`

Draw the `geojson` polygons as 3D columns whose height follows a property. Set `pitch` as well, since the columns look flat from straight above.

```typescript
// Height and color both follow `population`.
new GeoloniaMap({ container: '#map', geojson, pitch: 60, extrusion: 'population' });

// Height follows `population`, color follows `aged_ratio`.
new GeoloniaMap({ container: '#map', geojson, pitch: 60, extrusion: { height: 'population', color: 'aged_ratio' } });

// Fine-grained settings.
new GeoloniaMap({
  container: '#map',
  geojson,
  pitch: 60,
  extrusion: {
    height: { property: 'population', heightScale: 0.1 }, // 0.1 m per unit
    color: { property: 'aged_ratio', colors: ['#FFF2CC', '#B3261E'], range: [0, 0.4] },
  },
});
```

- Height is set in one of two ways:
  - `maxHeight` (meters, default `3000`): the range is mapped proportionally to 0 to `maxHeight`, so the columns fit whatever the values are. The range defaults to 0 to the maximum of the data, or to the minimum and maximum when the minimum is negative. This is the default.
  - `heightScale`: meters per unit of the value. The height does not depend on the data range, so maps with different grid sizes or years can be compared at the same scale. When `heightScale` is set, `maxHeight` is ignored. Negative heights are drawn flat.
- A `range` whose minimum is not below its maximum is ignored, and the range is taken from the data.
- `color` defaults to the height property. Like `circle.color`, numeric values get a color ramp and other values one color per category.
- `extrusion` takes precedence over `choropleth` and the simplestyle `fill`. The flat polygon fill is not drawn, so the simplestyle `fill-opacity` and `stroke` do not apply either. The columns are drawn at 0.9 opacity.
- Polygons without a numeric height value are drawn flat.
- The range is computed again when the GeoJSON is loaded from a URL or replaced with `updateData()`.

#### `transformRequest`

Works like MapLibre's `transformRequest`, and is also called for the requests that maps-core rewrites itself: Geolonia sources (`api.geolonia.com` and the Geolonia tile hosts) and Geolonia sprites. For those, the function receives the URL after maps-core has added `key` and `sessionId`, so the parameters are kept as long as you build on the URL you are given.

- Return a `RequestParameters` object to use it as is.
- Return `undefined` to keep the request maps-core built.
- A `Promise` may be returned. If it resolves to `undefined`, the request maps-core built is used.

```typescript
new GeoloniaMap({
  container: '#map',
  transformRequest: (url, resourceType) => {
    // Load another tileset from the Geolonia tile server
    if (resourceType === 'Source' && url.includes('tileserver.geolonia.com/oneself/')) {
      return { url: url.replace('/oneself/', '/my-tileset/') };
    }
    return undefined;
  },
});
```

Replacing the function later with `map.setTransformRequest()` also removes the maps-core rewriting, including `key` and `sessionId`.

#### `mask`

Darken everything outside a boundary, such as a city's, so that the area inside stands out.

```typescript
// A GeoJSON URL with the boundary polygons.
new GeoloniaMap({ container: '#map', mask: './boundary.geojson' });

// Fine-grained settings.
new GeoloniaMap({
  container: '#map',
  mask: {
    geojson: boundary,   // URL, Feature, FeatureCollection or a Polygon/MultiPolygon/GeometryCollection geometry
    color: '#000000',    // default
    opacity: 0.3,        // default
    outline: true,       // draw the boundary line too; or { color: '#333333', width: 3 }
    beforeId: 'waterway-name', // optional: insert below this layer (the first label layer of geolonia/basic-v2)
  },
});
```

- `geojson` as a string is a URL starting with `http://` or `https://`, or a path starting with `/` or `.` (such as `./boundary.geojson`). The response may also be a bare Polygon, MultiPolygon or GeometryCollection geometry, and so may an object passed directly.
- Every Polygon and MultiPolygon, including those inside a GeometryCollection, is cut out, so exclaves and islands work. Holes inside a polygon, such as another area enclosed by the boundary, stay dark, and polygons inside such a hole (an island in a lake) are cut out again. Other geometries are ignored. A polygon whose outer ring is broken is skipped.
- The polygons should not overlap each other, or the cut-out may be drawn incorrectly. Polygons that cross the antimeridian (longitude ±180°), and polygons with coordinates outside longitude ±180° or latitude ±90° (such as projected coordinates), are not supported. A polygon whose outer ring has coordinates outside that range is skipped, and such a hole is dropped. MapLibre fills at most 500 rings of one polygon per tile, so when a tile contains more than about 500 boundary polygons, small ones may not be cut out.
- By default the mask is drawn above every layer of the base map, labels included, and below the first layer whose ID contains `simple-style` (the data of the `geojson` and `simpleVector` options), so place names outside the area are darkened too. To keep labels bright, set `beforeId` to the first label layer of the style; the mask is inserted below that layer, and every layer after it (including buildings and boundaries in some styles) stays bright. A `beforeId` that is not in the map logs an error and the default position is used. Layers added later without `beforeId` are drawn above the mask.
- The `geojson` layers are found by `simple-style` in their ID. A `SimpleStyle` added before the mask with a custom `id` that does not contain `simple-style` is drawn below it.
- The layers are `geolonia-mask` (fill) and `geolonia-mask-outline` (line). Use these IDs as `beforeId` to place your own layers above or below the mask.
- Adjacent polygons that share an edge may show a faint seam along the shared edge inside the area. Merge them into one polygon to avoid it.
- If `remove()` is called while the style is being reloaded or the WebGL context is lost (when the mask's source is temporarily gone), the mask's source and layer may come back when MapLibre restores the style, and they are no longer removed by that `Mask`.
- With `3d: true`, the mask is a flat fill drawn over the 3D buildings of the base map, so tall buildings inside the area may look darkened where they overlap the area outside. The look of 3D buildings with a mask is not guaranteed.
- A polygon enclosed by a hole of another polygon (such as an area enclosed by a city) is detected when all its vertices and the midpoints of its edges are inside the hole or on its edge, within about 0.2 m. Adjacent polygons should share their vertices or use coordinates rounded to 6 or more decimal places; otherwise an enclosed polygon may be darkened. With very detailed boundaries that have both holes and polygons inside them, this check takes more time.
- `outline: true` draws a 2-pixel line in the mask `color`.
- An `opacity` that is not a number from 0 to 1 logs an error and the default is used. If loading the URL (including the response body) does not finish within 30 seconds, it is aborted and an error is logged. Skipped polygons or holes are reported with a warning, or with an error when every polygon is skipped. If MapLibre rejects the fill layer (for example, a color it cannot parse), nothing is added and an error is logged. If only the outline is rejected, the fill is kept and an error is logged.
- Without `center`, `bounds`, `geojson` and `simpleVector`, the map fits to the boundary. This also happens again after `setStyle()`, since the mask is added again for the new style (unless `transformStyle` carried the mask's source and layer over to the new style, in which case it is kept as is). As with `geojson`, a position restored by `hash` or a `zoom` without `center` does not prevent the fit.

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
// Also accepts `choropleth`, `heatmap` and `circle` (see GeoloniaMap options)
ss.addTo(map).fitBounds();
```

### `Mask`

Darkens everything outside a boundary on an existing map. Takes the same value as the `mask` option. Call `addTo` after the style has loaded. After `map.setStyle()`, the mask is gone with the old style; call `addTo` again to add it to the new style (the `mask` option of `GeoloniaMap` does this for you). Only one mask can be added to a map; a second one, or a mask on a map that already has a source or layer named `geolonia-mask` or `geolonia-mask-outline` (even without `outline`), is not added and logs an error. Calling `addTo` before the style has loaded throws, as `addSource` does. A removed mask can be added again, and calling `addTo` on a mask that is already added moves it (if adding to the new map throws, for example because its style has not loaded, the mask is left on neither map).

```typescript
import { Mask } from '@geolonia/maps-core';

const mask = new Mask({ geojson: './boundary.geojson', outline: true });
mask.addTo(map).fitBounds();
mask.remove();
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
npm run build:umd # UMD bundle (dist/umd/), required by e2e/umd.spec.ts
npm run e2e       # Playwright E2E tests
npm run lint      # Biome
npm run dev       # Vite dev server (example/)
```

## License

MIT
