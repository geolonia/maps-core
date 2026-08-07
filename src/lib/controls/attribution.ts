import type {
  ControlPosition,
  IControl,
  Map as MaplibreMap,
} from "maplibre-gl";
import { bindAll, DOM } from "../maplibre-util";

/**
 * Shadow DOM を用いたカスタム帰属表示コントロールの実装です。
 * maplibre-gl-js の AttributionControl をもとにしています。
 * https://github.com/maplibre/maplibre-gl-js/blob/main/src/ui/control/attribution_control.ts
 *
 * Shadow DOM で帰属表示のスタイルをホストページから隔離し、スタイルの衝突を防ぎます。
 * 地図の表示幅が小さい場合は "i" アイコンに折りたたみます。
 */

/**
 * {@link CustomAttributionControl} の生成時に渡すオプションです。
 */
export interface CustomAttributionControlOptions {
  /**
   * 帰属表示をコンパクト表示にするかどうかを指定します。
   * `true` を指定すると常に "i" アイコンに折りたたんだコンパクト表示になり、
   * `false` を指定すると常に展開したまま表示します。
   * 省略した場合は地図の表示幅に応じて自動的に切り替わります
   * （幅が 640px 以下のときにコンパクト表示になります）。
   */
  compact?: boolean;
  /**
   * ソース由来の帰属表示に加えて表示する、独自の帰属表示テキストです。
   * 文字列または文字列の配列で指定します。
   */
  customAttribution?: string | string[];
}

/**
 * 帰属表示の収集に必要な、ソースごとのタイル管理オブジェクトの最小形です。
 * maplibre-gl の `SourceCache` / `TileManager` のいずれにも当てはまります。
 */
interface AttributionSourceEntry {
  used: boolean;
  usedForTerrain: boolean;
  getSource(): { attribution?: string };
}

/**
 * MapLibre Map with internal properties used by this control.
 * These are internal APIs not in the public MapLibre type.
 * We use a type alias (not interface extends) to avoid conflicts
 * with MapLibre's `style` property type.
 *
 * `sourceCaches` は maplibre-gl 5.11.0 で `tileManagers` に改名されました。
 * どちらの版でも動くように、両方を optional として宣言します。
 * optional にしておくことで、参照側でフォールバックを省くと型エラーになります。
 */
type MapInternal = MaplibreMap & {
  _getUIString(key: string): string;
  style: MaplibreMap["style"] & {
    stylesheet?: { owner: string; id: string };
    /** maplibre-gl 5.11.0 以降のプロパティ名です。 */
    tileManagers?: Record<string, AttributionSourceEntry>;
    /** maplibre-gl 5.11.0 未満のプロパティ名です。 */
    sourceCaches?: Record<string, AttributionSourceEntry>;
  };
};

interface StyleDataEvent {
  sourceDataType?: string;
  dataType?: string;
  type?: string;
}

const ATTRIBUTION_CSS = `
.maplibregl-ctrl {
  font: 12px/20px Helvetica Neue,Arial,Helvetica,sans-serif;
  clear: both;
  pointer-events: auto;
  transform: translate(0);
}
.maplibregl-ctrl-attrib-button:focus,.maplibregl-ctrl-group button:focus {
  box-shadow: 0 0 2px 2px #0096ff
}
.maplibregl-ctrl.maplibregl-ctrl-attrib {
  background-color: hsla(0,0%,100%,.5);
  margin: 0;
  padding: 0 5px
}
@media screen {
  .maplibregl-ctrl-attrib.maplibregl-compact {
    background-color: #fff;
    border-radius: 12px;
    box-sizing: content-box;
    min-height: 20px;
    padding: 2px 24px 2px 0;
    position: relative;
    margin: 10px 10px 10px auto;
    width: 0;
  }
  .maplibregl-ctrl-attrib.maplibregl-compact-show {
    padding: 2px 28px 2px 8px;
    visibility: visible;
    width: auto;
  }
  .maplibregl-ctrl-bottom-left>.maplibregl-ctrl-attrib.maplibregl-compact-show,
  .maplibregl-ctrl-top-left>.maplibregl-ctrl-attrib.maplibregl-compact-show {
    border-radius: 12px;
    padding: 2px 8px 2px 28px
  }
  .maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-inner {
    display: none
  }
  .maplibregl-ctrl-attrib-button {
    background-color: hsla(0,0%,100%,.5);
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd'%3E%3Cpath d='M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0'/%3E%3C/svg%3E");
    border: 0;
    border-radius: 12px;
    box-sizing: border-box;
    cursor: pointer;
    display: none;
    height: 24px;
    outline: none;
    position: absolute;
    right: 0;
    top: 0;
    width: 24px
  }
  .maplibregl-ctrl-attrib summary.maplibregl-ctrl-attrib-button {
    appearance: none;
    list-style: none
  }
  .maplibregl-ctrl-attrib summary.maplibregl-ctrl-attrib-button::-webkit-details-marker {
    display: none
  }
  .maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib-button,
  .maplibregl-ctrl-top-left .maplibregl-ctrl-attrib-button {
    left: 0
  }
  .maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-button,
  .maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-inner {
    display: block
  }
  .maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-button {
    background-color: rgb(0 0 0/5%)
  }
  .maplibregl-ctrl-bottom-right>.maplibregl-ctrl-attrib.maplibregl-compact:after {
    bottom: 0; right: 0
  }
  .maplibregl-ctrl-top-right>.maplibregl-ctrl-attrib.maplibregl-compact:after {
    right: 0; top: 0
  }
  .maplibregl-ctrl-top-left>.maplibregl-ctrl-attrib.maplibregl-compact:after {
    left: 0; top: 0
  }
  .maplibregl-ctrl-bottom-left>.maplibregl-ctrl-attrib.maplibregl-compact:after {
    bottom: 0; left: 0
  }
}
@media screen and (-ms-high-contrast:active) {
  .maplibregl-ctrl-attrib.maplibregl-compact:after {
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' fill='%23fff'%3E%3Cpath d='M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0'/%3E%3C/svg%3E")
  }
}
@media screen and (-ms-high-contrast:black-on-white) {
  .maplibregl-ctrl-attrib.maplibregl-compact:after {
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd'%3E%3Cpath d='M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0'/%3E%3C/svg%3E")
  }
}
@media print {
  .maplibregl-ctrl-attrib-button {
    display: none !important;
  }
}
.maplibregl-ctrl-attrib a {
  color: rgba(0,0,0,.75);
  text-decoration: none;
  white-space: nowrap;
}
.maplibregl-ctrl-attrib a:hover {
  color: inherit;
  text-decoration: underline
}
.maplibregl-attrib-empty {
  display: none
}
`;

/**
 * 帰属表示（アトリビューション）を表示する、Geolonia 向けにカスタムしたコントロールです。
 *
 * MapLibre 標準の `AttributionControl` をもとにしており、`IControl` を実装します。
 * スタイルの衝突を防ぐためにコンテナを Shadow DOM で分離し、コントロール用の CSS を
 * その内部に閉じ込めます。地図の表示幅が狭いとき（またはオプション指定時）は "i" アイコンに
 * 折りたたむコンパクト表示に切り替わり、印刷時には自動的に展開表示へ切り替えます。
 *
 * @example
 * ```ts
 * map.addControl(new CustomAttributionControl(), "bottom-right");
 * ```
 */
class CustomAttributionControl implements IControl {
  private options: CustomAttributionControlOptions;
  private _map: MapInternal | undefined;
  private _compact: boolean | undefined;
  private _container: HTMLDivElement | undefined;
  private _shadowContainer: HTMLDetailsElement | undefined;
  private _innerContainer: HTMLElement | undefined;
  private _compactButton: HTMLElement | undefined;
  private _attribHTML: string | undefined;
  private printQuery: MediaQueryList | undefined;
  private onMediaPrintChange: ((e: MediaQueryListEvent) => void) | undefined;

  /**
   * コントロールを生成します。
   *
   * @param options 帰属表示の挙動を指定するオプションです。省略した場合は空のオブジェクトが使われます。
   */
  constructor(options: CustomAttributionControlOptions = {}) {
    this.options = options;

    bindAll(
      [
        "_toggleAttribution",
        "_updateData",
        "_updateCompact",
        "_updateCompactMinimize",
      ],
      this as unknown as Record<string, unknown>,
    );
  }

  /**
   * このコントロールの既定の表示位置を返します。
   *
   * @returns 既定の表示位置である `"bottom-right"` を返します。
   */
  getDefaultPosition(): ControlPosition {
    return "bottom-right";
  }

  /**
   * コントロールが地図に追加されるときに呼び出されます。
   *
   * Shadow DOM を持つコンテナ要素を生成し、その内部に帰属表示用の要素と CSS を組み立てます。
   * あわせて帰属表示の内容を初期化し、地図の各種イベント（`styledata`、`sourcedata`、`terrain`、
   * `resize`、`drag`）や印刷メディアクエリの変化を監視するリスナーを登録します。
   *
   * @param map このコントロールを追加する対象の地図です。
   * @returns 地図に挿入するコントロールのルート要素を返します。
   */
  onAdd(map: MaplibreMap): HTMLDivElement {
    this._map = map as MapInternal;
    this._compact = this.options.compact;
    this._container = DOM.create("div") as HTMLDivElement;

    const shadow = this._container.attachShadow({ mode: "open" });

    this._shadowContainer = DOM.create(
      "details",
      "maplibregl-ctrl maplibregl-ctrl-attrib",
    ) as HTMLDetailsElement;
    this._compactButton = DOM.create(
      "summary",
      "maplibregl-ctrl-attrib-button",
      this._shadowContainer,
    );
    this._compactButton.addEventListener("click", this._toggleAttribution);
    this._setElementTitle(this._compactButton, "ToggleAttribution");
    this._innerContainer = DOM.create(
      "div",
      "maplibregl-ctrl-attrib-inner",
      this._shadowContainer,
    );

    const style = document.createElement("style");
    style.textContent = ATTRIBUTION_CSS;

    this._updateAttributions();
    this._updateCompact();

    this._map.on("styledata", this._updateData);
    this._map.on("sourcedata", this._updateData);
    this._map.on("terrain", this._updateData);
    this._map.on("resize", this._updateCompact);
    this._map.on("drag", this._updateCompactMinimize);

    shadow.appendChild(style);
    shadow.appendChild(this._shadowContainer);

    this.printQuery = window.matchMedia("print");
    this.onMediaPrintChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        this._shadowContainer?.setAttribute("open", "");
        this._shadowContainer?.classList.remove("maplibregl-compact-show");
      }
    };
    this.printQuery.addEventListener("change", this.onMediaPrintChange);

    return this._container;
  }

  /**
   * コントロールが地図から取り除かれるときに呼び出されます。
   *
   * 生成したコンテナ要素を DOM から削除し、`onAdd` で登録した地図のイベントリスナーと
   * 印刷メディアクエリのリスナーを解除したうえで、内部で保持している状態を破棄します。
   */
  onRemove(): void {
    if (this._container) {
      DOM.remove(this._container);
    }

    if (this._map) {
      this._map.off("styledata", this._updateData);
      this._map.off("sourcedata", this._updateData);
      this._map.off("terrain", this._updateData);
      this._map.off("resize", this._updateCompact);
      this._map.off("drag", this._updateCompactMinimize);
    }

    if (this.printQuery && this.onMediaPrintChange) {
      this.printQuery.removeEventListener("change", this.onMediaPrintChange);
    }

    this._map = undefined;
    this._compact = undefined;
    this._attribHTML = undefined;
  }

  _setElementTitle(element: HTMLElement, title: string): void {
    if (!this._map) return;
    const str = this._map._getUIString(`AttributionControl.${title}`);
    element.title = str;
    element.setAttribute("aria-label", str);
  }

  _toggleAttribution(): void {
    if (!this._shadowContainer) return;
    if (this._shadowContainer.classList.contains("maplibregl-compact")) {
      if (this._shadowContainer.classList.contains("maplibregl-compact-show")) {
        this._shadowContainer.setAttribute("open", "");
        this._shadowContainer.classList.remove("maplibregl-compact-show");
      } else {
        this._shadowContainer.classList.add("maplibregl-compact-show");
        this._shadowContainer.removeAttribute("open");
      }
    }
  }

  _updateData(e: StyleDataEvent): void {
    if (
      e &&
      (e.sourceDataType === "metadata" ||
        e.sourceDataType === "visibility" ||
        e.dataType === "style" ||
        e.type === "terrain")
    ) {
      this._updateAttributions();
    }
  }

  _updateAttributions(): void {
    if (!this._map?.style) return;

    let attributions: string[] = [];

    if (this.options.customAttribution) {
      if (Array.isArray(this.options.customAttribution)) {
        attributions = attributions.concat(
          this.options.customAttribution.filter(
            (attr): attr is string => typeof attr === "string",
          ),
        );
      } else if (typeof this.options.customAttribution === "string") {
        attributions.push(this.options.customAttribution);
      }
    }

    // maplibre-gl 5.11.0 で `sourceCaches` が `tileManagers` に改名されたため、
    // どちらの版でも帰属表示を収集できるようにフォールバックします。
    const tileManagers =
      this._map.style.tileManagers ?? this._map.style.sourceCaches ?? {};
    for (const id in tileManagers) {
      const tileManager = tileManagers[id];
      if (tileManager.used || tileManager.usedForTerrain) {
        const source = tileManager.getSource();
        if (
          source.attribution &&
          attributions.indexOf(source.attribution) < 0
        ) {
          attributions.push(source.attribution);
        }
      }
    }

    // Remove whitespace-only entries
    attributions = attributions.filter((e) => String(e).trim());

    // Remove entries that are substrings of another entry
    attributions.sort((a, b) => a.length - b.length);
    attributions = attributions.filter((attrib, i) => {
      for (let j = i + 1; j < attributions.length; j++) {
        if (attributions[j].indexOf(attrib) >= 0) {
          return false;
        }
      }
      return true;
    });

    const attribHTML = attributions.join(" | ");
    if (attribHTML === this._attribHTML) return;

    this._attribHTML = attribHTML;

    if (attributions.length) {
      if (this._innerContainer) this._innerContainer.innerHTML = attribHTML;
      this._shadowContainer?.classList.remove("maplibregl-attrib-empty");
    } else {
      this._shadowContainer?.classList.add("maplibregl-attrib-empty");
    }
    this._updateCompact();
  }

  _updateCompact(): void {
    if (!this._map || !this._shadowContainer) return;
    if (this._map.getCanvasContainer().offsetWidth <= 640 || this._compact) {
      if (this._compact === false) {
        this._shadowContainer.setAttribute("open", "");
      } else if (
        !this._shadowContainer.classList.contains("maplibregl-compact") &&
        !this._shadowContainer.classList.contains("maplibregl-attrib-empty")
      ) {
        this._shadowContainer.setAttribute("open", "");
        this._shadowContainer.classList.add(
          "maplibregl-compact",
          "maplibregl-compact-show",
        );
      }
    } else {
      this._shadowContainer.setAttribute("open", "");
      if (this._shadowContainer.classList.contains("maplibregl-compact")) {
        this._shadowContainer.classList.remove(
          "maplibregl-compact",
          "maplibregl-compact-show",
        );
      }
    }
  }

  _updateCompactMinimize(): void {
    if (!this._shadowContainer) return;
    if (this._shadowContainer.classList.contains("maplibregl-compact")) {
      if (this._shadowContainer.classList.contains("maplibregl-compact-show")) {
        this._shadowContainer.classList.remove("maplibregl-compact-show");
      }
    }
  }
}

export default CustomAttributionControl;
