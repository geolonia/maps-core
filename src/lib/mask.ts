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

/** マスクのソースとレイヤーの ID です。境界線は `-outline` を付けた ID を使います。 */
export const MASK_ID = "geolonia-mask";

type Ring = GeoJSON.Position[];

/** 世界全体を覆う外周です。 */
const WORLD: Ring = [
  [-180, -90],
  [180, -90],
  [180, 90],
  [-180, 90],
  [-180, -90],
];

/** 何も描かない GeoJSON です。取得中のソースに入れておきます。 */
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** リングの符号付き面積の 2 倍です。 */
function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum;
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

/** 点がリングの内側にあるかどうかです（偶奇判定）。 */
function inRing([x, y]: GeoJSON.Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * GeoJSON から Polygon と MultiPolygon の面を集めます。それ以外のジオメトリは無視します。
 * 外周が閉じたリングとして扱えない面は、面ごと捨てます（穴が外周に繰り上がらないように）。
 * 穴のうち閉じたリングとして扱えないものは捨てます。
 */
export function collectPolygons(
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection,
): Ring[][] {
  const features =
    geojson?.type === "FeatureCollection"
      ? Array.isArray(geojson.features)
        ? geojson.features
        : []
      : geojson?.type === "Feature"
        ? [geojson]
        : [];
  const polygons: unknown[] = [];
  for (const feature of features) {
    const geometry = feature?.geometry;
    if (geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon") {
      continue;
    }
    // 型のない呼び出し元から coordinates の無いジオメトリが渡されても、地図の初期化を止めない
    if (!Array.isArray(geometry.coordinates)) continue;
    if (geometry.type === "Polygon") {
      polygons.push(geometry.coordinates);
    } else {
      polygons.push(...geometry.coordinates);
    }
  }
  return polygons.flatMap((rings) => {
    if (!Array.isArray(rings) || !isRing(rings[0])) return [];
    const [outer, ...inner] = rings;
    return [[outer, ...inner.filter(isRing)]];
  });
}

/**
 * 世界全体を覆う面から、`polygons` の面をくり抜いた MultiPolygon を作ります。
 *
 * 面の外周はくり抜く穴にします。面の穴（境界に囲まれた別の地域）は範囲の外なので、暗くする面として
 * 別に加えます。その穴の中にさらに別の面（湖の中の島など）があるときは、その面の外周を、
 * 世界の面ではなく、それを囲むいちばん内側の穴の面にくり抜きます。
 *
 * リングの向き（外周と穴の回り方）はそろえません。geojson ソースはタイルに切るときに、
 * 面の中での位置（先頭が外周、それ以降が穴）でリングの向きを直すためです。
 */
export function maskGeometry(polygons: Ring[][]): GeoJSON.MultiPolygon {
  const holes = polygons.flatMap(([, ...inner]) => inner);
  const cutouts = new Map<Ring, Ring[]>([[WORLD, []]]);
  for (const hole of holes) cutouts.set(hole, []);
  for (const [outer] of polygons) {
    // 外周を囲む穴のうち、いちばん内側（面積が最小）のものにくり抜く
    let parent = WORLD;
    for (const hole of holes) {
      if (
        hole !== outer &&
        inRing(outer[0], hole) &&
        (parent === WORLD ||
          Math.abs(signedArea(hole)) < Math.abs(signedArea(parent)))
      ) {
        parent = hole;
      }
    }
    cutouts.get(parent)?.push(outer);
  }
  return {
    type: "MultiPolygon",
    coordinates: [...cutouts].map(([ring, inner]) => [ring, ...inner]),
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
 * レイヤーは、背景の地図の最初の文字（シンボル）のレイヤーと、既定の ID の `SimpleStyle` と
 * `SimpleStyleVector` のレイヤー（ID に `simple-style` を含むもの）のうち、いちばん下のものの下に入れます。
 * そのため地名のラベルと、`GeoloniaMap` の `geojson` オプションの地物は、マスクの上に表示されます。
 * 利用者が自分で追加したレイヤーとの重なり順は、マスクを追加する前後で変わります。
 *
 * ソースとレイヤーの ID は {@link MASK_ID} に固定なので、1 つの地図に追加できる Mask は 1 つです。
 *
 * @example
 * ```typescript
 * new Mask({ geojson: "./boundary.geojson", outline: true }).addTo(map);
 * ```
 */
export class Mask {
  /** URL から GeoJSON を取得しているときの Promise です。 */
  public _loadingPromise: Promise<void> | undefined;
  private readonly options: MaskOptions;
  private polygons: Ring[][] | undefined;
  private map: MaplibreMap | undefined;
  private fitBoundsOptions: FitBoundsOptions | undefined;
  /** addTo と remove のたびに増やします。古い取得の結果を捨てるのに使います。 */
  private generation = 0;

  /**
   * @param option 境界の GeoJSON の URL、または {@link MaskOptions} です。
   */
  constructor(option: string | MaskOptions) {
    this.options = normalizeMask(option) ?? { geojson: "" };
  }

  /**
   * 地図にマスクを追加します。`geojson` が URL のときは、空のソースとレイヤーを先に追加し、
   * 取得してから中身を入れます。同じ地図に別の Mask が追加済みのときは、何もせずに `console.error` に出します。
   *
   * @returns メソッドチェーンのための `this` を返します。
   */
  addTo(map: MaplibreMap) {
    const generation = ++this.generation;
    if (map.getSource(MASK_ID)) {
      console.error(
        "[Geolonia] A mask has already been added to this map. Only one mask is supported per map.",
      ); // eslint-disable-line no-console
      return this;
    }
    this.map = map;
    this.polygons = undefined;
    this.addLayers();

    const { geojson } = this.options;
    if (typeof geojson === "string") {
      const url = isURL(geojson);
      if (!url) {
        console.error("[Geolonia] Invalid mask GeoJSON URL:", geojson); // eslint-disable-line no-console
        return this;
      }
      this._loadingPromise = this.load(url, generation);
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
    if (!this.map) return this;
    this.fitBoundsOptions = { duration: 3000, padding: 30, ...options };
    if (this.polygons) this.applyFitBounds();
    return this;
  }

  /**
   * 地図からマスクのレイヤーとソースを取り除きます。取得中の GeoJSON が後から届いても追加しません。
   * 取り除いた後に、もう一度 {@link Mask.addTo | addTo} で追加できます。
   *
   * @returns メソッドチェーンのための `this` を返します。
   */
  remove() {
    this.generation++;
    const map = this.map;
    this.map = undefined;
    this.polygons = undefined;
    this.fitBoundsOptions = undefined;
    if (!map) return this;
    for (const id of [`${MASK_ID}-outline`, MASK_ID]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of [`${MASK_ID}-outline`, MASK_ID]) {
      if (map.getSource(id)) map.removeSource(id);
    }
    return this;
  }

  private async load(url: string, generation: number) {
    let data: GeoJSON.Feature | GeoJSON.FeatureCollection;
    try {
      const response = await window.fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error("[Geolonia] Failed to load mask GeoJSON:", error); // eslint-disable-line no-console
      return;
    }
    // 取得中に remove や addTo がやり直されていたら、この結果は使わない
    if (generation !== this.generation) return;
    this.setPolygons(data);
  }

  /** 空のソースとレイヤーを追加します。 */
  private addLayers() {
    const map = this.map as MaplibreMap;
    const before = layerAboveMask(map);
    const color = this.options.color ?? DEFAULT_MASK_COLOR;

    map.addSource(MASK_ID, { type: "geojson", data: EMPTY });
    map.addLayer(
      {
        id: MASK_ID,
        type: "fill",
        source: MASK_ID,
        paint: {
          "fill-color": color,
          "fill-opacity": this.options.opacity ?? DEFAULT_MASK_OPACITY,
        },
      },
      before,
    );

    const outline = this.options.outline;
    if (!outline) return;
    // 境界線はくり抜いた面ではなく元の面に引く。くり抜いた面に引くと、世界の外周（経度 ±180 度）にも線が出る
    const style = typeof outline === "object" ? outline : {};
    map.addSource(`${MASK_ID}-outline`, { type: "geojson", data: EMPTY });
    map.addLayer(
      {
        id: `${MASK_ID}-outline`,
        type: "line",
        source: `${MASK_ID}-outline`,
        paint: {
          "line-color": style.color ?? color,
          "line-width": style.width ?? DEFAULT_MASK_OUTLINE_WIDTH,
        },
        layout: { "line-join": "round" },
      },
      before,
    );
  }

  /** 境界の面をソースに入れます。地図が破棄されたかスタイルが差し替えられてソースが無いときは、何もしません。 */
  private setPolygons(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection) {
    const map = this.map;
    if (!map || (map as { _removed?: boolean })._removed) return;
    const source = map.getSource(MASK_ID) as GeoJSONSource | undefined;
    if (!source) return;

    const polygons = collectPolygons(geojson);
    if (polygons.length === 0) {
      console.error(
        "[Geolonia] The mask GeoJSON has no Polygon or MultiPolygon.",
      ); // eslint-disable-line no-console
      return;
    }
    this.polygons = polygons;
    source.setData({
      type: "Feature",
      properties: {},
      geometry: maskGeometry(polygons),
    });
    (map.getSource(`${MASK_ID}-outline`) as GeoJSONSource | undefined)?.setData(
      {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiPolygon", coordinates: polygons },
      },
    );
    if (this.fitBoundsOptions) this.applyFitBounds();
  }

  private applyFitBounds() {
    const map = this.map;
    const polygons = this.polygons;
    const options = this.fitBoundsOptions;
    this.fitBoundsOptions = undefined;
    if (!map || !polygons) return;
    const generation = this.generation;
    const bounds = bbox({
      type: "MultiPolygon",
      coordinates: polygons,
    }) as [number, number, number, number];
    window.requestAnimationFrame(() => {
      // 次のフレームまでに remove されていたら、地図を動かさない
      if (generation !== this.generation) return;
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
