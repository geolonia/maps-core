import 'maplibre-gl/dist/maplibre-gl.css';
import '../src/assets/style.css';
import { GeoloniaMap } from '../src/index';

// Test 1: Default marker with openPopup
const map1 = new GeoloniaMap({
  container: '#map',
  style: 'https://tile.openstreetmap.jp/styles/osm-bright/style.json',
  center: [139.7671, 35.6812],
  zoom: 14,
  marker: true,
  markerColor: '#FF0000',
  openPopup: true,
  gestureHandling: false,
  geoloniaControl: false,
  loader: false,
});

// Set popup content via dataset (simulating embed behavior)
document.querySelector('#map')!.dataset.popupContent = '<p class="test-popup">Hello Tokyo</p>';

(window as unknown as Record<string, unknown>).map = map1;
