import type { MapOptions, ControlPosition } from 'maplibre-gl';

export type GeoloniaMapOptions = MapOptions & {
  /** Geolonia API key */
  apiKey?: string;
  /** API stage (e.g. 'dev', 'v1') */
  stage?: string;
  /** Map style name or URL. Default: 'geolonia/basic-v2' */
  style?: string;
  /** Language for style labels. Default: 'auto' */
  lang?: 'ja' | 'en' | 'auto';
  /** Show default marker at center */
  marker?: boolean;
  /** Marker color (CSS color string) */
  markerColor?: string;
  /** Show loader animation during map load */
  loader?: boolean;
  /** Enable gesture handling for scroll pages */
  gestureHandling?: boolean;
  /** Navigation control. true, false, or a position string */
  navigationControl?: boolean | ControlPosition;
  /** Geolocate control */
  geolocateControl?: boolean | ControlPosition;
  /** Fullscreen control */
  fullscreenControl?: boolean | ControlPosition;
  /** Scale control */
  scaleControl?: boolean | ControlPosition;
  /** Geolonia logo control */
  geoloniaControl?: boolean | ControlPosition;
  /** GeoJSON URL or object for SimpleStyle */
  geojson?: string | GeoJSON.GeoJSON;
  /** Enable clustering for GeoJSON points */
  cluster?: boolean;
  /** Cluster marker color */
  clusterColor?: string;
  /** Simple vector tile URL */
  simpleVector?: string;
  /** Enable 3D mode */
  '3d'?: boolean;
};
