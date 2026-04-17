/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keyring } from "../src/lib/keyring";
import {
  getLang,
  getSessionId,
  getStyle,
  handleErrorMode,
  handleRestrictedMode,
  isGeoloniaTilesHost,
  parseControlOption,
  parseSimpleVector,
  resetSessionId,
} from "../src/lib/util";

describe("getStyle", () => {
  beforeEach(() => {
    keyring.reset();
    keyring.setApiKey("test-key");
  });

  it("should return default Japanese style for empty string", () => {
    expect(getStyle("", { lang: "ja", apiKey: "test-key" })).toBe(
      "https://cdn.geolonia.com/style/geolonia/basic-v2/ja.json",
    );
  });

  it("should return default English style", () => {
    expect(getStyle("", { lang: "en", apiKey: "test-key" })).toBe(
      "https://cdn.geolonia.com/style/geolonia/basic-v2/en.json",
    );
  });

  it("should resolve logical name to CDN URL", () => {
    expect(
      getStyle("geolonia/basic-v2", { lang: "ja", apiKey: "test-key" }),
    ).toBe("https://cdn.geolonia.com/style/geolonia/basic-v2/ja.json");
  });

  it("should pass through absolute HTTP URLs", () => {
    expect(getStyle("https://example.com/style.json", { lang: "ja" })).toBe(
      "https://example.com/style.json",
    );
  });

  it("should throw if Geolonia style is used without API key", () => {
    keyring.reset();
    expect(() =>
      getStyle("geolonia/basic-v2", { lang: "ja", apiKey: "" }),
    ).toThrow("API key is required");
  });
});

describe("isGeoloniaTilesHost", () => {
  it("should return true for tileserver.geolonia.com", () => {
    expect(isGeoloniaTilesHost("https://tileserver.geolonia.com/tiles")).toBe(
      true,
    );
  });

  it("should return true for *.tiles.geolonia.com", () => {
    expect(isGeoloniaTilesHost("https://custom.tiles.geolonia.com/tiles")).toBe(
      true,
    );
  });

  it("should return false for other domains", () => {
    expect(isGeoloniaTilesHost("https://example.com/tiles")).toBe(false);
  });

  it("should return false for invalid URL", () => {
    expect(isGeoloniaTilesHost("not-a-url")).toBe(false);
  });
});

describe("parseControlOption", () => {
  it("should parse boolean true", () => {
    expect(parseControlOption(true)).toEqual({
      enabled: true,
      position: undefined,
    });
  });

  it("should parse boolean false", () => {
    expect(parseControlOption(false)).toEqual({
      enabled: false,
      position: undefined,
    });
  });

  it("should parse position string", () => {
    expect(parseControlOption("top-right")).toEqual({
      enabled: true,
      position: "top-right",
    });
    expect(parseControlOption("bottom-left")).toEqual({
      enabled: true,
      position: "bottom-left",
    });
  });

  it("should return disabled for undefined", () => {
    expect(parseControlOption(undefined)).toEqual({
      enabled: false,
      position: undefined,
    });
  });
});

describe("parseSimpleVector", () => {
  it("should pass through full URLs", () => {
    expect(parseSimpleVector("https://example.com/tiles.json")).toBe(
      "https://example.com/tiles.json",
    );
  });

  it("should pass through geolonia:// URLs", () => {
    expect(parseSimpleVector("geolonia://tiles/custom/my-tiles")).toBe(
      "geolonia://tiles/custom/my-tiles",
    );
  });

  it("should wrap plain names in geolonia:// URL", () => {
    expect(parseSimpleVector("my-tiles")).toBe(
      "geolonia://tiles/custom/my-tiles",
    );
  });
});

describe("getSessionId", () => {
  beforeEach(() => {
    resetSessionId();
  });

  it("should generate a hex string of specified length", () => {
    const id = getSessionId(40);
    expect(id).toHaveLength(40);
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it("should return the same value on subsequent calls", () => {
    const id1 = getSessionId(40);
    const id2 = getSessionId(40);
    expect(id1).toBe(id2);
  });
});

describe("getLang", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should return "ja" when navigator.languages is ["ja"]', () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { languages: ["ja"], language: "ja" },
      writable: true,
      configurable: true,
    });
    expect(getLang()).toBe("ja");
  });

  it('should return "en" when navigator.languages is ["en-US"]', () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { languages: ["en-US"], language: "en-US" },
      writable: true,
      configurable: true,
    });
    expect(getLang()).toBe("en");
  });

  it('should return "en" when navigator is undefined', () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(getLang()).toBe("en");
  });
});

describe("handleRestrictedMode", () => {
  it("should call map.remove() on first invocation", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>existing content</p>";
    const removeSpy = vi.fn();
    const map = {
      getContainer: () => container,
      remove: removeSpy,
    };

    handleRestrictedMode(map);

    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe("");
    expect(
      container.classList.contains("geolonia__restricted-mode-image-container"),
    ).toBe(true);
  });

  it("should not call map.remove() on second invocation", () => {
    const container = document.createElement("div");
    const removeSpy = vi.fn();
    const map = {
      getContainer: () => container,
      remove: removeSpy,
    };

    handleRestrictedMode(map);
    handleRestrictedMode(map);

    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});

describe("handleErrorMode", () => {
  it("should generate error UI elements", () => {
    const container = document.createElement("div");
    handleErrorMode(container);

    const errorContainer = container.querySelector(
      ".geolonia__error-container",
    );
    expect(errorContainer).not.toBeNull();

    const h2 = errorContainer?.querySelector("h2");
    expect(h2?.textContent).toBe("Geolonia Maps");

    const desc = errorContainer?.querySelector(
      ".geolonia__error-message-description",
    );
    expect(desc).not.toBeNull();
  });
});
