import { beforeEach, describe, expect, it } from "vitest";
import { keyring } from "../src/lib/keyring";

describe("keyring", () => {
  beforeEach(() => {
    keyring.reset();
  });

  it("should have default values", () => {
    expect(keyring.apiKey).toBe("");
    // 既定は本番。dev だと stage を渡し忘れた npm 利用者が
    // tileserver-dev / api.geolonia.com/dev を黙って叩いてしまう。
    expect(keyring.stage).toBe("v1");
    expect(keyring.isGeoloniaStyle).toBe(true);
  });

  it("should not default to the dev stage", () => {
    expect(keyring.stage).not.toBe("dev");
  });

  it("should set and get apiKey", () => {
    keyring.setApiKey("test-api-key");
    expect(keyring.apiKey).toBe("test-api-key");
  });

  it("should set and get stage", () => {
    keyring.setStage("v1");
    expect(keyring.stage).toBe("v1");
  });

  it("should set and get isGeoloniaStyle", () => {
    keyring.isGeoloniaStyle = false;
    expect(keyring.isGeoloniaStyle).toBe(false);
  });

  it("should reset all values", () => {
    keyring.setApiKey("test");
    keyring.setStage("v1");
    keyring.isGeoloniaStyle = false;
    keyring.reset();
    expect(keyring.apiKey).toBe("");
    expect(keyring.stage).toBe("v1");
    expect(keyring.isGeoloniaStyle).toBe(true);
  });

  describe("isGeoloniaStyleCheck", () => {
    it("should return true for empty string", () => {
      expect(keyring.isGeoloniaStyleCheck("")).toBe(true);
    });

    it("should return true for Geolonia CDN URL", () => {
      expect(
        keyring.isGeoloniaStyleCheck(
          "https://cdn.geolonia.com/style/geolonia/basic-v2/ja.json",
        ),
      ).toBe(true);
    });

    it("should return true for Geolonia API URL", () => {
      expect(
        keyring.isGeoloniaStyleCheck("https://api.geolonia.com/v1/style"),
      ).toBe(true);
    });

    it("should return false for external HTTP URL", () => {
      expect(
        keyring.isGeoloniaStyleCheck("https://example.com/style.json"),
      ).toBe(false);
    });

    it("should return false for .json file", () => {
      expect(keyring.isGeoloniaStyleCheck("my-style.json")).toBe(false);
    });

    it("should return true for logical name", () => {
      expect(keyring.isGeoloniaStyleCheck("geolonia/basic-v2")).toBe(true);
      expect(keyring.isGeoloniaStyleCheck("geolonia/gsi")).toBe(true);
    });

    it('should return true for "geolonia://" prefix', () => {
      expect(keyring.isGeoloniaStyleCheck("geolonia://tiles/custom/test")).toBe(
        true,
      );
    });

    it('should return false for "pmtiles://" prefix', () => {
      expect(
        keyring.isGeoloniaStyleCheck("pmtiles://example.com/tiles.pmtiles"),
      ).toBe(false);
    });
  });
});
