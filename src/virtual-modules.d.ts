/**
 * `vite.umd.config.ts` のプラグインが提供する仮想モジュール。
 * maplibre-gl の worker を自己完結する 1 ファイルへ束ねたソースを返す。
 */
declare module "virtual:maplibre-worker-source" {
  const source: string;
  export default source;
}
