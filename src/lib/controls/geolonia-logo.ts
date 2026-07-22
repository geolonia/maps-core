import type { ControlPosition, IControl } from "maplibre-gl";

/**
 * 地図上に Geolonia のロゴを表示するコントロールです。
 *
 * MapLibre の `IControl` を実装しており、`Map.addControl` で地図に追加できます。
 * 表示されるロゴは Geolonia のサイト（`https://geolonia.com/`）へのリンクになっており、
 * クリックすると同サイトを開きます。
 *
 * @example
 * ```ts
 * map.addControl(new GeoloniaControl(), "bottom-left");
 * ```
 */
export class GeoloniaControl implements IControl {
  private container!: HTMLDivElement;

  /**
   * コントロールの DOM 要素を生成して返します。
   *
   * `IControl` の実装として、`Map.addControl` で地図に追加された際に MapLibre から呼び出されます。
   * Geolonia のロゴ画像を含み、`https://geolonia.com/` へのリンクが設定された要素を組み立てて返します。
   *
   * @returns このコントロールのコンテナとなる `HTMLDivElement`。
   */
  onAdd() {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl";

    const img = document.createElement("img");
    img.src = "https://cdn.geolonia.com/logo/geolonia-symbol_1.png";
    img.style.width = "16px";
    img.style.height = "16px";
    img.style.display = "block";
    img.style.cursor = "pointer";
    img.style.padding = "0";
    img.style.margin = "0";
    img.style.border = "none";
    img.alt = "Geolonia";

    const link = document.createElement("a");
    link.href = "https://geolonia.com/";
    link.appendChild(img);
    link.title = "Powered by Geolonia";

    this.container.appendChild(link);

    return this.container;
  }

  /**
   * コントロールの DOM 要素を地図から除去します。
   *
   * `IControl` の実装として、`Map.removeControl` で地図から取り除かれた際に MapLibre から呼び出されます。
   * `onAdd` で生成したコンテナを親ノードから削除します。
   */
  onRemove() {
    this.container.parentNode?.removeChild(this.container);
  }

  /**
   * このコントロールの既定の表示位置を返します。
   *
   * `Map.addControl` で位置を明示しなかった場合に使用されます。
   *
   * @returns 既定の表示位置 `"bottom-left"`。
   */
  getDefaultPosition(): ControlPosition {
    return "bottom-left";
  }
}
