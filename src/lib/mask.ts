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

/** URL から境界の GeoJSON を取得するときの期限（ミリ秒）です。 */
export const MASK_FETCH_TIMEOUT = 30000;

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

/**
 * 閉じたリング（4 点以上で、先頭と末尾が同じ点で、面積がある）として扱えるかどうかです。
 * 経度 -180〜180 度、緯度 -90〜90 度の外にある点を含むリング（投影座標系の座標など）は扱いません。
 */
function isRing(ring: unknown): ring is Ring {
  return (
    Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(
      (p) =>
        Array.isArray(p) &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        Math.abs(p[0]) <= 180 &&
        Math.abs(p[1]) <= 90,
    ) &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1] &&
    signedArea(ring) !== 0
  );
}

/**
 * 点が線分の上にあるとみなす、線分からの距離の上限（度）です。約 0.2 メートルにあたります。
 * 座標を小数 6 桁に丸めたデータでは、各座標が最大 5e-7 度ずれます。頂点を共有しない接点（T 字の接点）では、
 * 点のずれ（斜めの辺で最大 約 7.1e-7 度）に線分の端点のずれ（同じく最大 約 7.1e-7 度）が加わり、
 * 線分からの距離は最大で 約 1.4e-6 度になるので、それを上回る値にしています。
 */
const ON_SEGMENT_TOLERANCE = 2e-6;

/** 点が線分の上にあるかどうかです。 */
function onSegment(
  [x, y]: GeoJSON.Position,
  [x1, y1]: GeoJSON.Position,
  [x2, y2]: GeoJSON.Position,
): boolean {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length === 0) return Math.hypot(x - x1, y - y1) <= ON_SEGMENT_TOLERANCE;
  // 外積を線分の長さで割ると、点と線分を含む直線との距離になる
  const distance =
    Math.abs((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) / length;
  const t = ON_SEGMENT_TOLERANCE;
  return (
    distance <= t &&
    Math.min(x1, x2) - t <= x &&
    x <= Math.max(x1, x2) + t &&
    Math.min(y1, y2) - t <= y &&
    y <= Math.max(y1, y2) + t
  );
}

/** 点がリングの線の上にあるかどうかです。 */
function onRing(point: GeoJSON.Position, ring: Ring): boolean {
  for (let i = 0; i < ring.length - 1; i++) {
    if (onSegment(point, ring[i], ring[i + 1])) return true;
  }
  return false;
}

/**
 * リング `inner` が、リング `outer` の内側（線の上を含む）に収まるかどうかです。
 * 隣り合う地域どうしは境界の線を共有するので、1 点だけで判定すると、線の上の点の扱いで結果がぶれます。
 * すべての頂点が内側か線の上にあるとき、収まるとみなします（`outer` と同じ座標のリングも収まる）。
 */
function ringWithin(inner: Ring, outer: Ring): boolean {
  return inner.every((point) => onRing(point, outer) || inRing(point, outer));
}

/** 外接矩形 `a` が外接矩形 `b` に収まるかどうかです。 */
function boundsWithin(
  [ax0, ay0, ax1, ay1]: [number, number, number, number],
  [bx0, by0, bx1, by1]: [number, number, number, number],
): boolean {
  return ax0 >= bx0 && ay0 >= by0 && ax1 <= bx1 && ay1 <= by1;
}

/** リングの外接矩形 `[西, 南, 東, 北]` です。 */
function ringBounds(ring: Ring): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** 点がリングの内側にあるかどうかです（偶奇判定）。線の上の点の結果は決まりません。 */
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
export function collectPolygons(geojson: unknown): Ring[][] {
  // GeoJSON の最上位には Feature と FeatureCollection のほか、ジオメトリも置ける（RFC 7946）
  const root = geojson as
    | { type?: unknown; features?: unknown; geometry?: unknown }
    | null
    | undefined;
  const geometries: unknown[] =
    root?.type === "FeatureCollection"
      ? Array.isArray(root.features)
        ? root.features.map((f: { geometry?: unknown } | null) => f?.geometry)
        : []
      : root?.type === "Feature"
        ? [root.geometry]
        : [root];
  const polygons: unknown[] = [];
  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i] as GeoJSON.Geometry | null | undefined;
    // GeometryCollection の中のジオメトリも順に見る
    if (
      geometry?.type === "GeometryCollection" &&
      Array.isArray(geometry.geometries)
    ) {
      for (const child of geometry.geometries) geometries.push(child);
      continue;
    }
    if (geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon") {
      continue;
    }
    // 型のない呼び出し元から coordinates の無いジオメトリが渡されても、地図の初期化を止めない
    if (!Array.isArray(geometry.coordinates)) continue;
    if (geometry.type === "Polygon") {
      polygons.push(geometry.coordinates);
    } else {
      // 面の数が非常に多いと、可変長引数のスプレッドは引数の上限を超えるので、1 つずつ積む
      for (const rings of geometry.coordinates) polygons.push(rings);
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
  // 穴ごとに、どの面の穴かを持っておく。自分の面の穴に自分の外周を入れないため
  // （利用者のデータが同じ配列を外周と穴で使い回していても、参照の同一性には頼らない）
  // 外接矩形と面積は先に 1 回だけ求める（面と穴の組ごとに求め直さない）
  const holes = polygons.flatMap(([, ...inner], owner) =>
    inner.map((ring) => ({
      ring,
      owner,
      bounds: ringBounds(ring),
      area: Math.abs(signedArea(ring)),
      cutouts: [] as Ring[],
    })),
  );
  const world: Ring[] = [];
  polygons.forEach(([outer], index) => {
    // 外周を囲む穴のうち、いちばん内側（面積が最小）のものにくり抜く
    const bounds = ringBounds(outer);
    let parent: (typeof holes)[number] | undefined;
    for (const hole of holes) {
      if (
        hole.owner !== index &&
        (!parent || hole.area < parent.area) &&
        // 外接矩形に収まらなければ、頂点ごとの判定をするまでもなく収まらない
        boundsWithin(bounds, hole.bounds) &&
        ringWithin(outer, hole.ring)
      ) {
        parent = hole;
      }
    }
    (parent ? parent.cutouts : world).push(outer);
  });
  return {
    type: "MultiPolygon",
    coordinates: [
      [WORLD, ...world],
      ...holes.map(({ ring, cutouts }) => [ring, ...cutouts]),
    ],
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
 * レイヤーは既定では、背景の地図のすべてのレイヤー（地名のラベルを含む）の上で、既定の ID の `SimpleStyle` と
 * `SimpleStyleVector` のレイヤー（ID に `simple-style` を含む最初のレイヤー）の下に入れます。範囲の外は、地名のラベルも含めて暗くなります。
 * {@link MaskOptions.beforeId} を指定すると、そのレイヤーの下に入れます（最初のラベルのレイヤーを指定すれば、ラベルを明るく残せます）。
 * マスクより後に `beforeId` を指定せずに追加したレイヤーは最前面に入るので、マスクの上に表示されます。
 *
 * ソースとレイヤーの ID は `geolonia-mask`（境界線は `geolonia-mask-outline`）に固定なので、1 つの地図に追加できる Mask は 1 つです。
 *
 * @example
 * ```typescript
 * new Mask({ geojson: "./boundary.geojson", outline: true }).addTo(map);
 * ```
 */
export class Mask {
  /** URL から GeoJSON を取得しているときの Promise です。 */
  public _loadingPromise: Promise<void> | undefined;
  private readonly options: MaskOptions | undefined;
  private polygons: Ring[][] | undefined;
  private map: MaplibreMap | undefined;
  private fitBoundsOptions: FitBoundsOptions | undefined;
  /**
   * addTo で追加したソースです。スタイルの差し替えの後に別の Mask が同じ ID のソースを追加しても、
   * そちらに書き込んだり消したりしないよう、同じオブジェクトのときだけ扱います。
   */
  private source: unknown;
  /** 取得中の GeoJSON の取得を止めます。remove で呼びます。 */
  private abortLoading: (() => void) | undefined;
  /** addTo と remove のたびに増やします。古い取得の結果を捨てるのに使います。 */
  private generation = 0;

  /**
   * @param option 境界の GeoJSON の URL、または {@link MaskOptions} です。
   */
  constructor(option: string | MaskOptions) {
    this.options = normalizeMask(option);
  }

  /**
   * 地図にマスクを追加します。`geojson` が URL のときは、空のソースとレイヤーを先に追加し、
   * 取得してから中身を入れます。スタイルの読み込みが終わってから呼び出します（MapLibre の `addSource` と同じ）。
   *
   * - この Mask を追加済みのときは、先に取り除いてから追加し直します。
   * - 同じ地図に別の Mask が追加済みのとき、`geojson` が指定されていないとき、`geojson` が URL として不正なときは、
   *   何も追加せずに `console.error` に出します。
   *
   * @returns メソッドチェーンのための `this` を返します。
   */
  addTo(map: MaplibreMap) {
    if (this.map) this.remove();
    if (!this.options) {
      console.error("[Geolonia] The mask option has no geojson.");
      return this;
    }
    // 同じ ID のソースかレイヤーが 1 つでも先にあると、追加に失敗したうえ、後の remove で他人のものを消してしまう
    const ids = [MASK_ID, `${MASK_ID}-outline`];
    if (ids.some((id) => map.getSource(id) || map.getLayer(id))) {
      console.error(
        "[Geolonia] A mask (or a source or layer with the same ID) has already been added to this map. Only one mask is supported per map.",
      );
      return this;
    }
    const { geojson } = this.options;
    const url = typeof geojson === "string" ? isURL(geojson) : undefined;
    if (url === false) {
      console.error("[Geolonia] Invalid mask GeoJSON URL:", geojson);
      return this;
    }
    const generation = ++this.generation;
    this.map = map;
    this.polygons = undefined;
    this.addLayers();
    if (!map.getLayer(MASK_ID)) {
      // MapLibre は不正な paint の値（解釈できない色など）のレイヤーを追加せず、error イベントで知らせるだけなので、
      // ここで気づいて取り除く。GeoloniaMap は error を購読しているので、コンソールには出ない
      console.error("[Geolonia] Failed to add the mask layer. Check `color`.");
      this.removeLayers(map);
      this.map = undefined;
      return this;
    }
    if (this.options.outline && !map.getLayer(`${MASK_ID}-outline`)) {
      // 境界線だけが追加できなかったときは、塗りのマスクは残す
      console.error(
        "[Geolonia] Failed to add the mask outline layer. Check `outline.color` and `outline.width`.",
      );
    }
    this.source = map.getSource(MASK_ID);

    if (url) {
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
    this.abortLoading?.();
    this.abortLoading = undefined;
    const map = this.map;
    this.map = undefined;
    this.polygons = undefined;
    this.fitBoundsOptions = undefined;
    const owned = !!map && this.owns(map);
    this.source = undefined;
    // スタイルが差し替えられて、同じ ID のソースが別の Mask のものになっていたら消さない
    if (!map || !owned) return this;
    this.removeLayers(map);
    return this;
  }

  /** マスクのレイヤーとソースを地図から取り除きます。 */
  private removeLayers(map: MaplibreMap) {
    for (const id of [`${MASK_ID}-outline`, MASK_ID]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of [`${MASK_ID}-outline`, MASK_ID]) {
      if (map.getSource(id)) map.removeSource(id);
    }
  }

  private async load(url: string, generation: number) {
    // 取得した JSON の形は分からないので、collectPolygons で確かめる
    let data: unknown;
    const controller = new AbortController();
    this.abortLoading = () => controller.abort();
    // 応答が返らないまま待ち続けないよう、期限を設ける
    const timer = setTimeout(
      () => controller.abort(new Error("Timed out")),
      MASK_FETCH_TIMEOUT,
    );
    try {
      const response = await window.fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      // remove や addTo のやり直しで捨てた取得の失敗は報告しない
      if (generation === this.generation) {
        console.error("[Geolonia] Failed to load mask GeoJSON:", error);
      }
      return;
    } finally {
      clearTimeout(timer);
    }
    // 取得中に remove や addTo がやり直されていたら、この結果は使わない
    if (generation !== this.generation) return;
    this.setPolygons(data);
  }

  /** 地図の `geolonia-mask` のソースが、この Mask が追加したものかどうかです。 */
  private owns(map: MaplibreMap): boolean {
    return this.source !== undefined && map.getSource(MASK_ID) === this.source;
  }

  /** 空のソースとレイヤーを追加します。 */
  private addLayers() {
    const map = this.map as MaplibreMap;
    const options = this.options as MaskOptions;
    const before = layerAboveMask(map, options.beforeId);
    const color = options.color ?? DEFAULT_MASK_COLOR;
    let opacity = options.opacity ?? DEFAULT_MASK_OPACITY;
    if (!(typeof opacity === "number" && opacity >= 0 && opacity <= 1)) {
      console.error(
        "[Geolonia] The mask opacity must be a number from 0 to 1. The default is used:",
        opacity,
      );
      opacity = DEFAULT_MASK_OPACITY;
    }

    map.addSource(MASK_ID, {
      type: "geojson",
      data: { ...EMPTY, features: [] },
    });
    map.addLayer(
      {
        id: MASK_ID,
        type: "fill",
        source: MASK_ID,
        paint: {
          "fill-color": color,
          "fill-opacity": opacity,
        },
      },
      before,
    );

    const outline = options.outline;
    if (!outline) return;
    // 境界線はくり抜いた面ではなく元の面に引く。くり抜いた面に引くと、世界の外周（経度 ±180 度）にも線が出る
    const style = typeof outline === "object" ? outline : {};
    map.addSource(`${MASK_ID}-outline`, {
      type: "geojson",
      data: { ...EMPTY, features: [] },
    });
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
  private setPolygons(geojson: unknown) {
    const map = this.map;
    if (!map || (map as { _removed?: boolean })._removed || !this.owns(map)) {
      return;
    }
    const source = map.getSource(MASK_ID) as GeoJSONSource;

    const polygons = collectPolygons(geojson);
    if (polygons.length === 0) {
      console.error(
        "[Geolonia] The mask GeoJSON has no Polygon or MultiPolygon.",
      );
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
      if ((map as { _removed?: boolean })._removed) return;
      map.fitBounds(bounds, options);
    });
  }
}

/**
 * マスクをその下に入れるレイヤーの ID です。
 *
 * `beforeId` が地図にあればそのレイヤーを返します。指定されていないときと、地図に無いときは、
 * ID に `simple-style` を含む最初のレイヤー（既定の ID の SimpleStyle と SimpleStyleVector のレイヤーを想定）を返します。
 * つまり既定では、背景の地図のすべてのレイヤーの上で、`geojson` と `simpleVector` の地物の下に入れます。
 * どちらも無いときは `undefined`（最前面に追加する）を返します。
 *
 * 背景の地図の中に入れる位置をスタイルの並びから決めないのは、Geolonia のスタイルでもラベルと線の並びがスタイルごとに違い、
 * どの規則でも一部のスタイルで期待どおりにならないためです。
 */
function layerAboveMask(
  map: MaplibreMap,
  beforeId: string | undefined,
): string | undefined {
  if (beforeId !== undefined) {
    if (map.getLayer(beforeId)) return beforeId;
    console.error(
      "[Geolonia] The mask beforeId layer does not exist. The default position is used:",
      beforeId,
    );
  }
  return map.getLayersOrder().find((id) => id.includes("simple-style"));
}
