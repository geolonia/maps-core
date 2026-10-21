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

describe("createTransformRequest: user transformRequest on Geolonia requests", () => {
  const TILESERVER_URL = "https://tileserver.geolonia.com/oneself/tiles.json";
  const TILESERVER_TRANSFORMED =
    "https://tileserver.geolonia.com/oneself/tiles.json?sessionId=test-session&key=test-key";

  it.each([
    ["Source", "https://api.geolonia.com/v1/sources", SOURCES_URL],
    ["Source", TILESERVER_URL, TILESERVER_TRANSFORMED],
    [
      "Source",
      "https://example.tiles.geolonia.com/tiles.json",
      "https://example.tiles.geolonia.com/tiles.json?sessionId=test-session&key=test-key",
    ],
    [
      "SpriteJSON",
      "https://api.geolonia.com/v1/sprites/basic-v2.json",
      "https://api.geolonia.com/v1/sprites/basic-v2.json?key=test-key",
    ],
    [
      "SpriteImage",
      "https://api.geolonia.com/v1/sprites/basic-v2.png",
      "https://api.geolonia.com/v1/sprites/basic-v2.png?key=test-key",
    ],
  ])(
    "calls the user function with the transformed %s URL (%s)",
    (t, url, transformed) => {
      const user = vi.fn(() => undefined);
      const transform = create({ userTransformRequest: user });
      transform(url, type(t));
      expect(user).toHaveBeenCalledTimes(1);
      expect(user).toHaveBeenCalledWith(transformed, t);
    },
  );

  it("uses the value returned by the user function", () => {
    const user = vi.fn((url: string) => ({
      url: url.replace("/oneself/", "/other/"),
    }));
    const transform = create({ userTransformRequest: user });
    expect(transform(TILESERVER_URL, type("Source"))).toEqual({
      url: "https://tileserver.geolonia.com/other/tiles.json?sessionId=test-session&key=test-key",
    });
  });

  it("keeps the maps-core result when the user function returns undefined", () => {
    const transform = create({ userTransformRequest: () => undefined });
    expect(transform(TILESERVER_URL, type("Source"))).toEqual({
      url: TILESERVER_TRANSFORMED,
    });
  });

  it("resolves to the value of a Promise returned by the user function", async () => {
    const transform = create({
      userTransformRequest: async (url) => ({
        url,
        headers: { "X-Test": "1" },
      }),
    });
    const result = transform(TILESERVER_URL, type("Source"));
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual({
      url: TILESERVER_TRANSFORMED,
      headers: { "X-Test": "1" },
    });
  });

  it("falls back to the maps-core result when a Promise resolves to undefined", async () => {
    const transform = create({
      // MapLibre の型では許されないが、実行時には起こりうる
      userTransformRequest: (async () =>
        undefined) as unknown as TransformRequestContext["userTransformRequest"],
    });
    await expect(transform(TILESERVER_URL, type("Source"))).resolves.toEqual({
      url: TILESERVER_TRANSFORMED,
    });
  });

  it("falls back to the input URL when a Promise resolves to undefined for other requests", async () => {
    const transform = create({
      userTransformRequest: (async () =>
        undefined) as unknown as TransformRequestContext["userTransformRequest"],
    });
    await expect(
      transform("https://example.com/tiles/0/0/0.pbf", type("Tile")),
    ).resolves.toEqual({ url: "https://example.com/tiles/0/0/0.pbf" });
  });

  it("propagates a rejected Promise from the user function", async () => {
    const transform = create({
      userTransformRequest: async () => {
        throw new Error("denied");
      },
    });
    await expect(transform(TILESERVER_URL, type("Source"))).rejects.toThrow(
      "denied",
    );
  });
});
