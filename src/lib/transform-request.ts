import type {
  RequestParameters,
  RequestTransformFunction,
  ResourceType,
} from "maplibre-gl";
import { isGeoloniaTilesHost } from "./util";

export type TransformRequestContext = {
  apiKey: string;
  stage: string;
  sessionId: string;
  /** Geolonia の `/sources` エンドポイントの URL。`key` と `sessionId` 付き */
  sourcesUrl: string;
  userTransformRequest?: RequestTransformFunction | null;
};

type GeoloniaTransformResult = {
  /** 利用者の `transformRequest` に渡す URL */
  url: string;
  /** maps-core が変換したリクエスト。対象外なら undefined */
  request?: RequestParameters;
};

/**
 * Geolonia のソースとスプライトのリクエストを変換する。
 */
function transformGeoloniaRequest(
  url: string,
  resourceType: ResourceType | undefined,
  { apiKey, stage, sessionId, sourcesUrl }: TransformRequestContext,
): GeoloniaTransformResult {
  if (resourceType === "Source" && url.startsWith("https://api.geolonia.com")) {
    return { url: sourcesUrl, request: { url: sourcesUrl } };
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
    const transformed = transformedUrlObj.toString();
    return { url: transformed, request: { url: transformed } };
  }

  if (
    (resourceType === "SpriteJSON" || resourceType === "SpriteImage") &&
    transformedUrl.match(/^https:\/\/api\.geolonia\.com\/(dev|v1)\/sprites\//)
  ) {
    const pathParts = transformedUrlObj.pathname.split("/");
    pathParts[1] = stage;
    transformedUrlObj.pathname = pathParts.join("/");
    transformedUrlObj.searchParams.set("key", apiKey);
    const transformed = transformedUrlObj.toString();
    return { url: transformed, request: { url: transformed } };
  }

  return { url: transformedUrl };
}

/**
 * GeoloniaMap が MapLibre に渡す `transformRequest` を作る。
 *
 * 利用者の `transformRequest` には、maps-core が変換した後の URL を渡す。
 * 利用者の関数が値を返したときはその値を、`undefined` を返したときは
 * maps-core の変換結果を使う。Promise を返したときも、解決値が `undefined`
 * なら同じく maps-core の変換結果を使う。
 */
export function createTransformRequest(
  context: TransformRequestContext,
): RequestTransformFunction {
  const { userTransformRequest } = context;
  return (
    url: string,
    resourceType?: ResourceType,
  ): RequestParameters | Promise<RequestParameters> | undefined => {
    const core = transformGeoloniaRequest(url, resourceType, context);
    if (typeof userTransformRequest !== "function") {
      return core.request;
    }

    const userResult = userTransformRequest(core.url, resourceType);
    if (userResult instanceof Promise) {
      // 解決値が undefined だと MapLibre は URL を取り出せないので、ここで補う
      return userResult.then(
        (resolved) => resolved ?? core.request ?? { url: core.url },
      );
    }
    return userResult ?? core.request;
  };
}
