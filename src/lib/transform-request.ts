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

/**
 * GeoloniaMap が MapLibre に渡す `transformRequest` を作る。
 */
export function createTransformRequest({
  apiKey,
  stage,
  sessionId,
  sourcesUrl,
  userTransformRequest,
}: TransformRequestContext): RequestTransformFunction {
  return (
    url: string,
    resourceType?: ResourceType,
  ): RequestParameters | Promise<RequestParameters> | undefined => {
    if (
      resourceType === "Source" &&
      url.startsWith("https://api.geolonia.com")
    ) {
      return { url: sourcesUrl };
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
      transformedUrl.match(/^https:\/\/api\.geolonia\.com\/(dev|v1)\/sprites\//)
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
}
