import maplibregl, { type MarkerOptions } from "maplibre-gl";
import tinycolor from "tinycolor2";

const MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 67">
  <path class="left" d="M26 0C11.664 0 0 11.663 0 26c0 22.14 26 41 26 41V26h0C26 11.663 26 0 26 0z" fill="#E4402F"/>
  <path class="right" d="M26 0c14.336 0 26 11.663 26 26 0 22.14-26 41-26 41V26h0C26 11.663 26 0 26 0z" fill="#C1272D"/>
  <circle cx="26" cy="26" r="9" fill="#FFF"/>
</svg>`;

const DEFAULT_COLOR = "#E4402F";

/**
 * 地図上に配置する Geolonia デフォルトデザインの点マーカーです。
 *
 * MapLibre GL JS の `maplibregl.Marker` を継承しており、`setLngLat` や `addTo`、
 * `remove` などのメソッドはそのまま利用できます。オプションの `element` を
 * 指定しなかった場合は、Geolonia デフォルトの水滴形 SVG マーカーを自動生成して
 * 表示します。既定のマーカー色は `#E4402F` で、`color` オプションを指定すると
 * その色でマーカーを描画します。このとき水滴の右半分には、指定色を暗くした色が
 * 自動的に適用されます。また、`element` を指定しなかった場合の `offset` の既定値は
 * `[0, -15]` であり、水滴の先端が指定した座標を指すように配置されます。
 *
 * `element` を指定した場合は、上記のデフォルト生成、色の適用、`offset` の既定値の
 * いずれも適用されず、`maplibregl.Marker` の挙動がそのまま使われます。
 *
 * @example
 * ```typescript
 * const map = new GeoloniaMap({
 *   container: "#map",
 *   apiKey: "YOUR-API-KEY",
 *   center: [139.7671, 35.6812],
 *   zoom: 14,
 * });
 *
 * new GeoloniaMarker({ color: "#4A90D9" })
 *   .setLngLat([139.7671, 35.6812])
 *   .addTo(map);
 * ```
 */
export default class GeoloniaMarker extends maplibregl.Marker {
  /**
   * Geolonia マーカーを作成します。
   *
   * `options.element` が指定されていない場合は、Geolonia デフォルトの SVG マーカー
   * 要素を生成して `options.element` に設定し、`options.color`（未指定時は `#E4402F`）で
   * マーカーの色を適用したうえで、`options.offset` を `[0, -15]` に設定します。
   * `options.element` が指定されている場合は、これらの処理を行わず指定された要素を
   * そのまま使用します。
   *
   * @param options `maplibregl.Marker` の `MarkerOptions` です。`element` を省略すると
   *   Geolonia デフォルトのマーカーが生成され、`color` でその色を指定できます。
   *   省略した場合は空のオブジェクトが使われます。
   */
  constructor(options: MarkerOptions = {}) {
    if (!options.element) {
      const markerElement = document.createElement("div");
      markerElement.className = "geolonia-default-marker";
      markerElement.innerHTML = MARKER_SVG;

      markerElement.style.margin = "0";
      markerElement.style.padding = "0";
      markerElement.style.width = "26px";
      markerElement.style.height = "34px";

      const svg = markerElement.querySelector("svg");
      if (svg) {
        svg.style.width = "100%";
        svg.style.height = "100%";
      }

      options.element = markerElement;

      const color = options.color || DEFAULT_COLOR;
      const left = markerElement.querySelector(".left") as HTMLElement | null;
      const right = markerElement.querySelector(".right") as HTMLElement | null;
      if (left) left.style.fill = color;
      if (right) right.style.fill = tinycolor(color).darken().toString();

      options.offset = [0, -15];
    }

    super(options);
  }
}
