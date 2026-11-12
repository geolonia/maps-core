import bbox from "@turf/bbox";
import type {
  FitBoundsOptions,
  GeoJSONSource,
  Map as MaplibreMap,
} from "maplibre-gl";
import type { MaskOptions } from "../types";
import { isURL } from "./util";

/** `mask` の `color` の既定値です。 */
export const DEFAULT_MASK_COLOR = "#000000";

/** `mask` の `opacity` の既定値です。 */
export const DEFAULT_MASK_OPACITY = 0.3;

/** 境界線の太さの既定値（ピクセル）です。 */
export const DEFAULT_MASK_OUTLINE_WIDTH = 2;

type Ring = GeoJSON.Position[];

/** 世界全体を覆う外周です。反時計回りにしてあります。 */
const WORLD: Ring = [
  [-180, -90],
  [180, -90],
  [180, 90],
  [-180, 90],
  [-180, -90],
];

/** リングの符号付き面積の 2 倍です。反時計回りなら正になります。 */
function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum;
}

/** リングを指定した向きにそろえます。元の配列は変えません。 */
function wind(ring: Ring, counterClockwise: boolean): Ring {
  return signedArea(ring) > 0 === counterClockwise ? ring : [...ring].reverse();
}

/** 閉じたリングとして扱える（4 点以上で面積がある）かどうかです。 */
function isRing(ring: unknown): ring is Ring {
  return (
    Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(
      (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    ) &&
    signedArea(ring) !== 0
  );
}

/** GeoJSON から Polygon と MultiPolygon の面を集めます。それ以外のジオメトリは無視します。 */
export function collectPolygons(
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection,
): Ring[][] {
  const features =
    geojson?.type === "FeatureCollection"
      ? (geojson.features ?? [])
      : geojson?.type === "Feature"
        ? [geojson]
        : [];
  const polygons: Ring[][] = [];
  for (const feature of features) {
    const geometry = feature?.geometry;
    if (geometry?.type === "Polygon") {
      polygons.push(geometry.coordinates);
    } else if (geometry?.type === "MultiPolygon") {
      polygons.push(...geometry.coordinates);
    }
  }
  return polygons
    .map((rings) => (Array.isArray(rings) ? rings.filter(isRing) : []))
    .filter((rings) => rings.length > 0);
}

/**
 * 世界全体を覆う面から、`polygons` の面をくり抜いた MultiPolygon を作ります。
 *
 * 各面の外周は世界の面の穴にします。面の穴（境界の中にある別の地域）は、その外側なので
 * 暗くする面として別に加えます。MapLibre はリングの向きで外周と穴を見分けるので、
 * 外周は反時計回り、穴は時計回りにそろえます。
 */
export function maskGeometry(polygons: Ring[][]): GeoJSON.MultiPolygon {
  const holes = polygons.map(([outer]) => wind(outer, false));
  const islands = polygons.flatMap(([, ...inner]) =>
    inner.map((ring) => [wind(ring, true)]),
  );
  return {
    type: "MultiPolygon",
    coordinates: [[WORLD, ...holes], ...islands],
  };
}

/** `mask` オプションを {@link MaskOptions} にそろえます。 */
export function normalizeMask(
  option: string | MaskOptions | undefined,
): MaskOptions | undefined {
  if (!option) return undefined;
  if (typeof option === "string") return { geojson: option };
  // 型のない呼び出し元から geojson なしで渡されても、地図の初期化を止めない
  return option.geojson ? option : undefined;
}

/**
 * 指定した範囲（市区町村の境界など）の外側を暗くするヘルパークラスです。
 *
 * 世界全体を覆う面から境界のポリゴンをくり抜いた面を、`fill` のレイヤーで塗ります。
 * レイヤーは、背景の地図の最初の文字（シンボル）のレイヤーと、`SimpleStyle` と
 * `SimpleStyleVector` のレイヤーのうち、いちばん下のものの下に入れます。地名のラベルと
 * GeoJSON の地物は、マスクより先に追加されていても後から追加されても、マスクの上に描かれます。
 *
 * @example
 * ```typescript
 * new Mask({ geojson: "./boundary.geojson", outline: true }).addTo(map);
 * ```
 */
export class Mask {
  /** URL から GeoJSON を取得しているときの Promise です。 */
  public _loadingPromise: Promise<void> | undefined;
  private readonly id = "geolonia-mask";
  private readonly options: MaskOptions;
  private polygons: Ring[][] | undefined;
  private map: MaplibreMap | undefined;
  private fitBoundsOptions: FitBoundsOptions | undefined;
  private removed = false;

  /**
   * @param option 境界の GeoJSON の URL、または {@link MaskOptions} です。
   */
  constructor(option: string | MaskOptions) {
    this.options = normalizeMask(option) ?? { geojson: "" };
  }

  /**
   * 地図にマスクを追加します。`geojson` が URL のときは、取得してから追加します。
   *
   * @returns メソッドチェーンのための `this` を返します。
   */
  addTo(map: MaplibreMap) {
    this.map = map;
    const { geojson } = this.options;
    if (typeof geojson === "string") {
      const url = isURL(geojson);
      if (!url) {
        console.error("[Geolonia] Invalid mask GeoJSON URL:", geojson); // eslint-disable-line no-console
        return this;
      }
      this._loadingPromise = this.load(url);
    } else {
      this.setPolygons(geojson);
    }
    return this;
  }

  /**
   * 境界の範囲に地図をフィットさせます。GeoJSON を取得中に呼び出したときは、取得後にフィットします。
   *
   * @param options `map.fitBounds` に渡すオプションです。既定値は `duration: 3000`、`padding: 30` です。
   * @returns メソッドチェーンのための `this` を返します。
   */
  fitBounds(options: FitBoundsOptions = {}) {
    this.fitBoundsOptions = { duration: 3000, padding: 30, ...options };
    if (this.polygons) this.applyFitBounds();
    return this;
  }

  /**
   * 地図からマスクのレイヤーとソースを取り除きます。取得中の GeoJSON が後から届いても追加しません。
   *
   * @returns メソッドチェーンのための `this` を返します。
   */
  remove() {
    this.removed = true;
    const map = this.map;
    if (!map) return this;
    for (const layer of [`${this.id}-outline`, this.id]) {
      if (map.getLayer(layer)) map.removeLayer(layer);
    }
    for (const source of [`${this.id}-outline`, this.id]) {
      if (map.getSource(source)) map.removeSource(source);
    }
    return this;
  }

  private async load(url: string) {
    try {
      const response = await window.fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      this.setPolygons(await response.json());
    } catch (error) {
      console.error("[Geolonia] Failed to load mask GeoJSON:", error); // eslint-disable-line no-console
    }
  }

  private setPolygons(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection) {
    if (this.removed || !this.map) return;
    const polygons = collectPolygons(geojson);
    if (polygons.length === 0) {
      console.error(
        "[Geolonia] The mask GeoJSON has no Polygon or MultiPolygon.",
      ); // eslint-disable-line no-console
      return;
    }
    this.polygons = polygons;
    this.addLayers(polygons);
    if (this.fitBoundsOptions) this.applyFitBounds();
  }

  private addLayers(polygons: Ring[][]) {
    const map = this.map as MaplibreMap;
    const before = layerAboveMask(map);
    const color = this.options.color ?? DEFAULT_MASK_COLOR;

    const data: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: maskGeometry(polygons),
    };
    const source = map.getSource(this.id) as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    } else {
      map.addSource(this.id, { type: "geojson", data });
      map.addLayer(
        {
          id: this.id,
          type: "fill",
          source: this.id,
          paint: {
            "fill-color": color,
            "fill-opacity": this.options.opacity ?? DEFAULT_MASK_OPACITY,
          },
        },
        before,
      );
    }

    const outline = this.options.outline;
    if (!outline || map.getSource(`${this.id}-outline`)) return;
    // 境界線はくり抜いた面ではなく元の面に引く。くり抜いた面に引くと、世界の外周（経度 ±180 度）にも線が出る
    map.addSource(`${this.id}-outline`, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiPolygon", coordinates: polygons },
      },
    });
    const style = typeof outline === "object" ? outline : {};
    map.addLayer(
      {
        id: `${this.id}-outline`,
        type: "line",
        source: `${this.id}-outline`,
        paint: {
          "line-color": style.color ?? color,
          "line-width": style.width ?? DEFAULT_MASK_OUTLINE_WIDTH,
        },
        layout: { "line-join": "round" },
      },
      before,
    );
  }

  private applyFitBounds() {
    const map = this.map;
    const polygons = this.polygons;
    if (!map || !polygons) return;
    const options = this.fitBoundsOptions;
    this.fitBoundsOptions = undefined;
    const bounds = bbox({
      type: "MultiPolygon",
      coordinates: polygons,
    }) as [number, number, number, number];
    window.requestAnimationFrame(() => {
      map.fitBounds(bounds, options);
    });
  }
}

/**
 * マスクをその下に入れるレイヤーの ID です。最初のシンボルのレイヤーか、SimpleStyle と
 * SimpleStyleVector のレイヤー（ID に `simple-style` を含む）のうち、いちばん下のものを返します。
 * SimpleStyle はポリゴンの塗りをシンボルより先に追加するので、シンボルだけを見ると塗りの上にマスクが入ります。
 * どちらも無いときは `undefined`（最前面に追加する）を返します。
 */
function layerAboveMask(map: MaplibreMap): string | undefined {
  return map
    .getLayersOrder()
    .find(
      (id) =>
        map.getLayer(id)?.type === "symbol" || id.includes("simple-style"),
    );
}
