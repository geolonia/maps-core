import 'maplibre-gl/dist/maplibre-gl.css';
import '../src/assets/style.css';
import { GeoloniaMap } from '../src/index';

const map = new GeoloniaMap({
  container: '#map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [139.7671, 35.6812],
  zoom: 12,
  navigationControl: false,
  geoloniaControl: false,
  gestureHandling: false,
  loader: false,
});

// Expose for e2e testing
(window as unknown as Record<string, unknown>).map = map;
