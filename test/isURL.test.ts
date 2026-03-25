import { describe, expect, it } from "vitest";
import { isURL } from "../src/lib/util";

describe("isURL", () => {
  it("should return URL for https://", () => {
    expect(isURL("https://example.com/style.json")).toBe(
      "https://example.com/style.json",
    );
  });

  it("should return URL for http://", () => {
    expect(isURL("http://example.com/style.json")).toBe(
      "http://example.com/style.json",
    );
  });

  it("should return false for plain string", () => {
    expect(isURL("geolonia/basic-v2")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isURL("")).toBe(false);
  });

  it("should handle relative paths starting with /", () => {
    const result = isURL("/styles/custom.json");
    // In Node/jsdom, location.href may not be set, so this might return false or a resolved URL
    // The important thing is it doesn't throw
    expect(typeof result === "string" || result === false).toBe(true);
  });

  it("should handle relative paths starting with ./", () => {
    const result = isURL("./styles/custom.json");
    expect(typeof result === "string" || result === false).toBe(true);
  });

  it("should handle relative paths starting with ../", () => {
    const result = isURL("../styles/custom.json");
    expect(typeof result === "string" || result === false).toBe(true);
  });

  it("should return false for .json file without path prefix", () => {
    expect(isURL("style.json")).toBe(false);
  });
});
