import type { ResourceType } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import {
  createTransformRequest,
  type TransformRequestContext,
} from "../src/lib/transform-request";

const SOURCES_URL =
  "https://api.geolonia.com/v1/sources?key=test-key&sessionId=test-session";

const create = (overrides: Partial<TransformRequestContext> = {}) =>
  createTransformRequest({
    apiKey: "test-key",
    stage: "v1",
    sessionId: "test-session",
    sourcesUrl: SOURCES_URL,
    ...overrides,
  });

const type = (t: string) => t as ResourceType;

describe("createTransformRequest: Geolonia requests", () => {
  it("rewrites api.geolonia.com sources to the sources endpoint", () => {
    const transform = create();
    expect(
      transform("https://api.geolonia.com/v1/sources", type("Source")),
    ).toEqual({ url: SOURCES_URL });
  });

  it("adds key and sessionId to tileserver sources", () => {
    const transform = create();
    expect(
      transform(
        "https://tileserver.geolonia.com/oneself/tiles.json",
        type("Source"),
      ),
    ).toEqual({
      url: "https://tileserver.geolonia.com/oneself/tiles.json?sessionId=test-session&key=test-key",
    });
  });

  it("adds key and sessionId to *.tiles.geolonia.com sources", () => {
    const transform = create();
    expect(
      transform(
        "https://example.tiles.geolonia.com/tiles.json",
        type("Source"),
      ),
    ).toEqual({
      url: "https://example.tiles.geolonia.com/tiles.json?sessionId=test-session&key=test-key",
    });
  });

  it("switches tileserver to tileserver-dev on the dev stage", () => {
    const transform = create({ stage: "dev" });
    expect(
      transform(
        "https://tileserver.geolonia.com/oneself/tiles.json",
        type("Source"),
      ),
    ).toEqual({
      url: "https://tileserver-dev.geolonia.com/oneself/tiles.json?sessionId=test-session&key=test-key",
    });
  });

  it("resolves geolonia:// custom tiles to tileserver", () => {
    const transform = create();
    expect(
      transform("geolonia://tiles/user/custom-id", type("Source")),
    ).toEqual({
      url: "https://tileserver.geolonia.com/customtiles/custom-id/tiles.json?sessionId=test-session&key=test-key",
    });
  });

  it.each(["SpriteJSON", "SpriteImage"])(
    "rewrites the stage and adds key to %s",
    (t) => {
      const transform = create({ stage: "dev" });
      expect(
        transform("https://api.geolonia.com/v1/sprites/basic-v2.json", type(t)),
      ).toEqual({
        url: "https://api.geolonia.com/dev/sprites/basic-v2.json?key=test-key",
      });
    },
  );
});

describe("createTransformRequest: other requests", () => {
  it("returns undefined without a user transformRequest", () => {
    const transform = create();
    expect(
      transform("https://example.com/tiles/0/0/0.pbf", type("Tile")),
    ).toBeUndefined();
  });

  it("passes other requests to the user transformRequest", () => {
    const user = vi.fn(() => ({ url: "https://example.com/rewritten" }));
    const transform = create({ userTransformRequest: user });
    expect(
      transform("https://example.com/tiles/0/0/0.pbf", type("Tile")),
    ).toEqual({ url: "https://example.com/rewritten" });
    expect(user).toHaveBeenCalledWith(
      "https://example.com/tiles/0/0/0.pbf",
      "Tile",
    );
  });

  it("passes the resolved URL of an unmatched geolonia:// request", () => {
    const user = vi.fn(() => undefined);
    const transform = create({ userTransformRequest: user });
    transform("geolonia://tiles/user/custom-id", type("Tile"));
    expect(user).toHaveBeenCalledWith(
      "https://tileserver.geolonia.com/customtiles/custom-id/tiles.json",
      "Tile",
    );
  });
});
