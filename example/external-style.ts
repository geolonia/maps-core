import { GeoloniaMap } from '../src/index';

const EXTERNAL_STYLE_URL = 'https://tile.openstreetmap.jp/styles/osm-bright/style.json';

const map = new GeoloniaMap({
  container: '#map',
  style: EXTERNAL_STYLE_URL,
  center: [139.7671, 35.6812],
  zoom: 12,
  navigationControl: false,
  geoloniaControl: false,
  gestureHandling: false,
  loader: false,
});

(window as unknown as Record<string, unknown>).map = map;
(window as unknown as Record<string, unknown>).EXTERNAL_STYLE_URL = EXTERNAL_STYLE_URL;
