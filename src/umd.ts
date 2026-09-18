/**
 * UMD ビルド専用のエントリ。
 *
 * maplibre-gl v6 は worker を `import.meta.url` 基準の実URLとして読みますが、UMD
 * 出力では `import.meta` がビルド時に `{}` へ潰れるため worker を見つけられず、
 * 地図が例外もエラーも出さないまま読み込まれない状態になります。
 *
 * UMD バンドルは「1 ファイルを置くだけで動く」ことが利点なので、worker を別ファイル
 * として配るのではなくバンドルへ文字列として埋め込み、実行時に Blob URL 化して
 * maplibre に渡します。埋め込む中身は `vite.umd.config.ts` のプラグインが
 * esbuild で自己完結する 1 ファイルへ束ねたものです。
 */

import workerSource from "virtual:maplibre-worker-source";
import { setWorkerUrl } from "maplibre-gl";

setWorkerUrl(
  URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })),
);

export * from "./index";
