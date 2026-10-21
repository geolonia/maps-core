import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

// mode=record:  呼び出しを記録して undefined を返す（maps-core の変換結果を使う）
// mode=append:  Geolonia のリクエストに e2e=1 を付けて返す
// mode=promise: append と同じ変換を Promise で返す
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || "record";

type TransformCall = { url: string; resourceType?: string };
const calls: TransformCall[] = [];
(window as unknown as Record<string, unknown>).transformCalls = calls;

const isGeoloniaRequest = (url: string) =>
  /^https:\/\/([^/]+\.)?(tiles|tileserver|api)\.geolonia\.com\//.test(url);

const appendMarker = (url: string) => {
  const u = new URL(url);
  u.searchParams.set("e2e", "1");
  return { url: u.toString() };
};

const transformRequest: GeoloniaMapOptions["transformRequest"] = (
  url,
  resourceType,
) => {
  calls.push({ url, resourceType });
  if (mode === "record" || !isGeoloniaRequest(url)) return undefined;
  if (mode === "promise") return Promise.resolve(appendMarker(url));
  return appendMarker(url);
};

const options: GeoloniaMapOptions = {
  container: "#map",
  apiKey: params.get("apiKey") || "YOUR-API-KEY",
  style: "geolonia/basic-v2",
  center: [139.7671, 35.6812],
  zoom: 14,
  marker: false,
  gestureHandling: false,
  loader: false,
  transformRequest,
};

const map = new GeoloniaMap(options);

(window as unknown as Record<string, unknown>).map = map;
