import maplibregl, { type MarkerOptions } from "maplibre-gl";
import tinycolor from "tinycolor2";

const MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 67">
  <path class="left" d="M26 0C11.664 0 0 11.663 0 26c0 22.14 26 41 26 41V26h0C26 11.663 26 0 26 0z" fill="#E4402F"/>
  <path class="right" d="M26 0c14.336 0 26 11.663 26 26 0 22.14-26 41-26 41V26h0C26 11.663 26 0 26 0z" fill="#C1272D"/>
  <circle cx="26" cy="26" r="9" fill="#FFF"/>
</svg>`;

const DEFAULT_COLOR = "#E4402F";

export default class GeoloniaMarker extends maplibregl.Marker {
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
