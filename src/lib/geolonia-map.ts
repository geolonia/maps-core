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
 * MapLibre GL JS の `Map` を拡張し、Geolonia 固有の機能を追加した地図クラスです。
 *
 * API キーによる認証、Geolonia のスタイルやタイルへの接続、PMTiles プロトコルの登録、
 * デフォルトマーカーや各種コントロール、SimpleStyle による GeoJSON 表示、
 * ジェスチャ操作、3D 表示などを、コンストラクタに渡す {@link GeoloniaMapOptions}
 * だけで有効にできます。
 *
 * コンストラクタには {@link GeoloniaMapOptions} オブジェクトを渡します。
 * ただし旧 embed API との後方互換のため、CSS セレクタ文字列や `HTMLElement`
 * を直接渡すこともできます。その場合はコンテナ要素の `data-*` 属性が
 * オプションとして読み込まれます。
 *
 * 同一のコンテナ要素に対して二重にインスタンスを生成しようとした場合は、
 * 新たに生成せず、既存のインスタンスをそのまま返します（シングルトン）。
 *
 * `Map` を継承しているため、`addLayer`、`addSource`、`on`、`getZoom` など
 * MapLibre GL JS の API はすべてそのまま利用できます。
 *
 * @example
 * ```typescript
 * const map = new GeoloniaMap({
 *   container: "#map",
 *   apiKey: "YOUR-API-KEY",
 *   style: "geolonia/basic-v2",
 *   center: [139.7671, 35.6812],
 *   zoom: 14,
 * });
 *
 * map.on("load", () => {
 *   console.log("地図の読み込みが完了しました");
 * });
 * ```
 *
 * @example
 * 後方互換の書き方として、コンテナのセレクタ文字列だけを渡すこともできます。
 * この場合は `data-*` 属性から設定を読み込みます。
 * ```typescript
 * // <div id="map" data-zoom="14" data-center="139.7671, 35.6812"></div>
 * const map = new GeoloniaMap("#map");
 * ```
 */
export default class GeoloniaMap extends maplibregl.Map {
  private geoloniaSourcesUrl!: URL;
  private __styleExtensionLoadRequired!: boolean;

  /**
   * 地図を生成します。
   *
   * `apiKey` や `stage` が指定されていればキーリングに設定し、スタイル
   * （既定は `"geolonia/basic-v2"`）を実際の style.json の URL に解決してから
   * MapLibre GL JS の `Map` を初期化します。あわせて Geolonia のロゴ、出典表示、
   * ナビゲーションなどのコントロールを追加し、読み込み完了後にはローディング表示の
   * 除去、デフォルトマーカーの配置、ジェスチャ操作やスタイル拡張の適用を行います。
   *
   * `arg` にコンテナを直接指定する後方互換の形式では、そのコンテナの `data-*`
   * 属性から設定を読み込みます。指定したコンテナに既に地図が生成済みの場合は、
   * 新規生成せず既存のインスタンスを返します。
   *
   * @param arg 地図の設定です。{@link GeoloniaMapOptions} オブジェクトのほか、
   *   後方互換としてコンテナを指す CSS セレクタ文字列や `HTMLElement` も指定できます。
   * @throws コンテナ要素が見つからない場合に `Error` を投げます。
   * @throws Geolonia のスタイルを API キーなしで使おうとした場合に `Error` を投げます。
   * @throws MapLibre GL JS の `Map` の初期化に失敗した場合、コンテナにエラー表示を
   *   行ったうえで、その例外を再スローします。
   *
   * @example
   * ```typescript
   * const map = new GeoloniaMap({
   *   container: "#map",
   *   apiKey: "YOUR-API-KEY",
   *   center: [139.7671, 35.6812],
   *   zoom: 14,
   * });
   * ```
   */
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
          // 内容が無い openPopup の場合はクリック可能としてマークするだけにする
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

  /**
   * 地図のスタイルを差し替えます。
   *
   * `style` が文字列の場合は、Geolonia のスタイル論理名（`"geolonia/basic-v2"`
   * など）、style.json の URL、相対パスのいずれかとして解釈し、実際の URL に
   * 解決してから適用します。解決の際の言語はブラウザ言語に従い、API キーは
   * キーリングに設定済みの値を使います。`StyleSpecification` オブジェクトを
   * 直接渡した場合はそのまま適用します。
   *
   * @param style 新しいスタイルです。スタイル論理名や URL などの文字列、または
   *   `StyleSpecification` オブジェクトを指定します。
   * @param options MapLibre GL JS に渡すスタイル差し替えオプションです。
   *   既定は空のオブジェクトです。
   * @returns メソッドチェーンのために自身を返します。
   * @throws Geolonia のスタイルを API キーなしで使おうとした場合に `Error` を投げます。
   *
   * @example
   * ```typescript
   * const map = new GeoloniaMap({ container: "#map", apiKey: "YOUR-API-KEY" });
   * map.setStyle("geolonia/gsi");
   * ```
   */
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

  /**
   * 地図を破棄し、関連するリソースやイベントリスナーを解放します。
   *
   * MapLibre GL JS の破棄処理に加えて、コンテナ要素に保持している地図インスタンスへの
   * 参照（`geoloniaMap`）も削除します。これにより、同じコンテナで再度
   * {@link GeoloniaMap} を生成した際に、破棄済みのインスタンスが返されることを防ぎます。
   *
   * @example
   * ```typescript
   * const map = new GeoloniaMap({ container: "#map", apiKey: "YOUR-API-KEY" });
   * // 不要になったら破棄します
   * map.remove();
   * ```
   */
  remove(): void {
    const container = this.getContainer() as Container;
    super.remove.call(this);
    delete container.geoloniaMap;
  }

  /**
   * 画像を読み込み、結果をコールバックで受け取ります（後方互換のコールバック形式）。
   *
   * 読み込みに成功すると `callback(null, image, expiry)`、失敗すると
   * `callback(error)` の形で呼び出されます。
   *
   * @param url 読み込む画像の URL です。
   * @param callback 読み込み結果を受け取るコールバックです。
   */
  loadImage(url: string, callback: GetImageCallback): void;
  /**
   * 画像を読み込み、`Promise` で結果を受け取ります。
   *
   * @param url 読み込む画像の URL です。
   * @returns 読み込んだ画像を含むレスポンスに解決される `Promise` を返します。
   */
  loadImage(
    url: string,
  ): Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>>;
  /**
   * 画像を読み込みます。
   *
   * `callback` を渡した場合は後方互換のコールバック形式で結果を受け取り、戻り値は
   * `undefined` になります。`callback` を省略した場合は `Promise` を返します。
   *
   * @param url 読み込む画像の URL です。
   * @param callback 省略可能です。指定した場合はコールバック形式で結果を受け取ります。
   * @returns `callback` を省略した場合は、読み込んだ画像を含むレスポンスに解決される
   *   `Promise` を返します。`callback` を指定した場合は `undefined` を返します。
   *
   * @example
   * ```typescript
   * const map = new GeoloniaMap({ container: "#map", apiKey: "YOUR-API-KEY" });
   * map.on("load", async () => {
   *   const image = await map.loadImage("https://example.com/marker.png");
   *   map.addImage("custom-marker", image.data);
   * });
   * ```
   */
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
