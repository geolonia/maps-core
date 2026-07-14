import maplibregl, {
  type ControlPosition,
  type GetResourceResponse,
  type StyleOptions,
  type StyleSpecification,
  type StyleSwapOptions,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import CustomAttributionControl from "./controls/attribution";
import { GeoloniaControl } from "./controls/geolonia-logo";
import GeoloniaMarker from "./geolonia-marker";

import { SimpleStyle } from "./simplestyle";
import SimpleStyleVector from "./simplestyle-vector";

// PMTiles protocol registration (once per runtime)
let pmtilesRegistered = false;
function ensurePMTiles(): void {
  if (pmtilesRegistered) return;
  pmtilesRegistered = true;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
}

import type { GeoloniaMapOptions } from "../types";
import { keyring } from "./keyring";
import { normalizeConstructorArg } from "./legacy-options";
import {
  type GetImageCallback,
  getLang,
  getSessionId,
  getStyle,
  handleErrorMode,
  handleRestrictedMode,
  isGeoloniaTilesHost,
  loadImageCompatibility,
  parseControlOption,
  parseSimpleVector,
} from "./util";

type Container = HTMLElement & {
  geoloniaMap?: GeoloniaMap;
};

/**
 * Geolonia Map - extends MapLibre GL Map with Geolonia-specific features.
 *
 * Accepts a {@link GeoloniaMapOptions} object, or — for backward compatibility
 * with the old embed API — a CSS selector string or an HTMLElement, in which
 * case the container's `data-*` attributes are read into options.
 */
export default class GeoloniaMap extends maplibregl.Map {
  private geoloniaSourcesUrl!: URL;
  private __styleExtensionLoadRequired!: boolean;

  // biome-ignore lint/correctness/noUnreachableSuper: intentional singleton pattern - returns existing map instance before super()
  constructor(arg: string | HTMLElement | GeoloniaMapOptions) {
    // Backward compatibility: accept a bare container (CSS selector string or
    // HTMLElement) like the old embed API. In that legacy form the container's
    // `data-*` attributes are read into options; the object form is unchanged.
    const options = normalizeConstructorArg(arg);

    // Register PMTiles protocol on first map creation
    ensurePMTiles();

    // Set API key and stage from options
    if (options.apiKey) {
      keyring.setApiKey(options.apiKey);
    }
    if (options.stage) {
      keyring.setStage(options.stage);
    }

    // Resolve language
    const lang =
      options.lang === "auto" || !options.lang ? getLang() : options.lang;

    // Resolve style
    const styleName = (options.style as string) || "geolonia/basic-v2";
    keyring.isGeoloniaStyle = keyring.isGeoloniaStyleCheck(styleName);
    const resolvedStyle = getStyle(styleName, {
      lang,
      apiKey: options.apiKey || keyring.apiKey,
    });

    // Resolve container
    const container = (
      typeof options.container === "string"
        ? document.querySelector(options.container) ||
          document.getElementById(options.container)
        : options.container
    ) as Container | null;

    if (!container) {
      throw new Error(
        `[Geolonia] No HTML elements found. Please ensure the map container element exists.`,
      );
    }

    if (container.geoloniaMap) {
      // biome-ignore lint/correctness/noConstructorReturn: intentional singleton pattern
      return container.geoloniaMap;
    }

    // Build MapLibre options
    const apiKey = options.apiKey || keyring.apiKey;
    const stage = options.stage || keyring.stage;
    const apiUrl = `https://api.geolonia.com/${stage}`;

    const sessionId = getSessionId(40);
    const sourcesUrl = new URL(`${apiUrl}/sources`);
    sourcesUrl.searchParams.set("key", apiKey);
    sourcesUrl.searchParams.set("sessionId", sessionId);

    const userTransformRequest = options.transformRequest;
    const transformRequest = (
      url: string,
      resourceType?: maplibregl.ResourceType,
    ) => {
      if (
        resourceType === "Source" &&
        url.startsWith("https://api.geolonia.com")
      ) {
        return { url: sourcesUrl.toString() };
      }

      let transformedUrl = url;
      if (url.startsWith("geolonia://")) {
        const tilesMatch = url.match(
          /^geolonia:\/\/tiles\/(?<username>.+)\/(?<customtileId>.+)/,
        );
        if (tilesMatch?.groups) {
          transformedUrl = `https://tileserver.geolonia.com/customtiles/${tilesMatch.groups.customtileId}/tiles.json`;
        }
      }

      const transformedUrlObj = new URL(transformedUrl);
      const geoloniaTilesHost = isGeoloniaTilesHost(transformedUrlObj);

      if (resourceType === "Source" && geoloniaTilesHost) {
        if (
          stage === "dev" &&
          transformedUrlObj.hostname === "tileserver.geolonia.com"
        ) {
          transformedUrlObj.hostname = "tileserver-dev.geolonia.com";
        }
        transformedUrlObj.searchParams.set("sessionId", sessionId);
        transformedUrlObj.searchParams.set("key", apiKey);
        return { url: transformedUrlObj.toString() };
      }

      if (
        (resourceType === "SpriteJSON" || resourceType === "SpriteImage") &&
        transformedUrl.match(
          /^https:\/\/api\.geolonia\.com\/(dev|v1)\/sprites\//,
        )
      ) {
        const pathParts = transformedUrlObj.pathname.split("/");
        pathParts[1] = stage;
        transformedUrlObj.pathname = pathParts.join("/");
        transformedUrlObj.searchParams.set("key", apiKey);
        return { url: transformedUrlObj.toString() };
      }

      if (typeof userTransformRequest === "function") {
        return userTransformRequest(transformedUrl, resourceType);
      }

      return undefined;
    };

    // Loading UI
    let loading: HTMLDivElement | undefined;
    const showLoader = options.loader !== false;
    if (showLoader) {
      loading = document.createElement("div");
      loading.className = "loading-geolonia-map";
      loading.innerHTML = `<div class="lds-grid"><div></div><div></div><div></div>
          <div></div><div></div><div></div><div></div><div></div><div></div></div>`;
      container.appendChild(loading);
    }

    const mapOptions = {
      ...options,
      container,
      style: resolvedStyle,
      hash: options.hash ?? false,
      localIdeographFontFamily:
        options.localIdeographFontFamily ?? "sans-serif",
      attributionControl: false as const,
      transformRequest,
    };

    // Remove Geolonia-specific options before passing to MapLibre
    for (const key of [
      "apiKey",
      "stage",
      "lang",
      "marker",
      "markerColor",
      "openPopup",
      "customMarker",
      "customMarkerOffset",
      "loader",
      "gestureHandling",
      "navigationControl",
      "geolocateControl",
      "fullscreenControl",
      "scaleControl",
      "geoloniaControl",
      "geojson",
      "cluster",
      "clusterColor",
      "simpleVector",
      "3d",
    ] as const) {
      delete (mapOptions as Record<string, unknown>)[key];
    }

    try {
      super(mapOptions);
    } catch (error) {
      handleErrorMode(container);
      throw error;
    }

    this.geoloniaSourcesUrl = sourcesUrl;
    this.__styleExtensionLoadRequired = true;

    // Controls
    // Note: GeoloniaControl should be placed before another controls.
    // Because this control should be "very" bottom-left(default) or the attributed position.
    const geoloniaCtrl = parseControlOption(options.geoloniaControl ?? true);
    this.addControl(
      new GeoloniaControl(),
      geoloniaCtrl.position as ControlPosition,
    );

    this.addControl(new CustomAttributionControl(), "bottom-right");

    const fullscreen = parseControlOption(options.fullscreenControl ?? false);
    if (fullscreen.enabled) {
      this.addControl(
        new maplibregl.FullscreenControl(),
        fullscreen.position as ControlPosition,
      );
    }

    const nav = parseControlOption(options.navigationControl ?? true);
    if (nav.enabled) {
      this.addControl(
        new maplibregl.NavigationControl(),
        nav.position as ControlPosition,
      );
    }

    const geolocate = parseControlOption(options.geolocateControl ?? false);
    if (geolocate.enabled) {
      this.addControl(
        new maplibregl.GeolocateControl({}),
        geolocate.position as ControlPosition,
      );
    }

    const scale = parseControlOption(options.scaleControl ?? false);
    if (scale.enabled) {
      this.addControl(
        new maplibregl.ScaleControl({}),
        scale.position as ControlPosition,
      );
    }

    // On load
    this.on("load", (event) => {
      const map = event.target;

      if (loading) {
        try {
          container.removeChild(loading);
        } catch {
          // Already removed
        }
      }

      // Gesture handling
      if (options.gestureHandling !== false) {
        import("@geolonia/maplibre-gesture-handling")
          .then(({ default: GestureHandling }) => {
            const body = document.body;
            const html = document.documentElement;
            const isScrollable =
              body.scrollHeight > body.clientHeight ||
              html.scrollHeight > html.clientHeight;
            if (isScrollable) {
              map.addControl(new GestureHandling({ lang }));
            }
          })
          .catch(() => {
            // gesture handling not available
          });
      }

      // Default marker
      if (options.marker && options.center) {
        const c = options.center;
        const center: [number, number] = Array.isArray(c)
          ? [c[0], c[1]]
          : "lng" in c
            ? [c.lng, c.lat]
            : [c.lon, c.lat];

        let marker: GeoloniaMarker;
        if (options.customMarker) {
          const customEl = document.querySelector(
            options.customMarker,
          ) as HTMLElement | null;
          if (customEl) {
            customEl.style.display = "block";
            marker = new GeoloniaMarker({
              element: customEl,
              offset: options.customMarkerOffset || [0, 0],
            })
              .setLngLat(center)
              .addTo(map);
          } else {
            marker = new GeoloniaMarker({ color: options.markerColor })
              .setLngLat(center)
              .addTo(map);
          }
        } else {
          marker = new GeoloniaMarker({ color: options.markerColor })
            .setLngLat(center)
            .addTo(map);
        }

        // Popup from container's inner HTML content
        const content = container.dataset?.popupContent;
        if (content) {
          const popup = new maplibregl.Popup({ offset: [0, -25] }).setHTML(
            content,
          );
          marker.setPopup(popup);
          if (options.openPopup) {
            marker.togglePopup();
          }
        } else if (options.openPopup) {
          // openPopup without content — just mark as clickable
        }

        marker.getElement().classList.add("geolonia-clickable-marker");
      }
    });

    // Style extensions (SimpleStyle, SimpleVector, 3D)
    this.on("styledata", async () => {
      if (!this.__styleExtensionLoadRequired) {
        return;
      }
      this.__styleExtensionLoadRequired = false;

      if (options.simpleVector) {
        const url = parseSimpleVector(options.simpleVector);
        new SimpleStyleVector(url).addTo(this);
      }

      if (options.geojson) {
        const ss = new SimpleStyle(options.geojson, {
          cluster: options.cluster !== false,
          clusterColor: options.clusterColor || "#ff0000",
        });
        ss.addTo(this);

        if (!options.center) {
          ss.fitBounds();
        }
      }

      if (options["3d"] === true) {
        const style = this.getStyle();
        if (style?.layers) {
          for (const layer of style.layers) {
            const metadata = (layer as { metadata?: Record<string, boolean> })
              .metadata;
            if (metadata?.["visible-on-3d"]) {
              this.setLayoutProperty(layer.id, "visibility", "visible");
            }
            if (metadata?.["hide-on-3d"]) {
              this.setLayoutProperty(layer.id, "visibility", "none");
            }
          }
        }
      }
    });

    // Handle server errors
    this.on("error", async (error) => {
      if (error.error && (error.error as { status?: number }).status === 402) {
        handleRestrictedMode(this);
      }
    });

    container.geoloniaMap = this;

    // biome-ignore lint/correctness/noConstructorReturn: intentional singleton pattern
    return this;
  }

  setStyle(
    style: string | StyleSpecification,
    options: StyleSwapOptions & StyleOptions = {},
  ): this {
    if (style !== null && typeof style === "string") {
      style = getStyle(style, { lang: getLang(), apiKey: keyring.apiKey });
    }

    this.__styleExtensionLoadRequired = true;
    super.setStyle.call(this, style, options);

    return this;
  }

  remove(): void {
    const container = this.getContainer() as Container;
    super.remove.call(this);
    delete container.geoloniaMap;
  }

  loadImage(url: string, callback: GetImageCallback): void;
  loadImage(
    url: string,
  ): Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>>;
  loadImage(
    url: string,
    callback?: GetImageCallback,
  ): Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>> | undefined {
    const promise = super.loadImage(url);

    if (callback) {
      loadImageCompatibility(promise, callback);
    } else {
      return promise;
    }
  }
}
