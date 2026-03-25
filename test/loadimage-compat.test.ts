import { describe, expect, it } from "vitest";
import { loadImageCompatibility } from "../src/lib/util";

describe("loadImageCompatibility", () => {
  it("should call callback with data on success", async () => {
    const mockResponse = {
      data: { width: 100, height: 100 } as unknown as HTMLImageElement,
      cacheControl: "max-age=3600",
      expires: "2026-01-01",
    };
    const promise = Promise.resolve(mockResponse);

    await new Promise<void>((resolve) => {
      loadImageCompatibility(promise, (error, data, expiry) => {
        expect(error).toBeNull();
        expect(data).toBe(mockResponse.data);
        expect(expiry).toEqual({
          cacheControl: "max-age=3600",
          expires: "2026-01-01",
        });
        resolve();
      });
    });
  });

  it("should call callback with error on failure", async () => {
    const mockError = new Error("Failed to load image");
    const promise = Promise.reject(mockError);

    await new Promise<void>((resolve) => {
      loadImageCompatibility(promise, (error) => {
        expect(error).toBe(mockError);
        resolve();
      });
    });
  });
});
