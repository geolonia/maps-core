import { describe, it, expect } from "vitest";
import { sanitizeDescription } from "../src/lib/util";

describe("sanitizeDescription", () => {
  it("should strip script tags", async () => {
    const input =
      '<script>alert("hello");</script>ここが集合場所です。13時までに集合してください。';
    expect(await sanitizeDescription(input)).toBe(
      "ここが集合場所です。13時までに集合してください。",
    );
  });

  it("should allow img tags but strip extra attributes", async () => {
    const input =
      '<img decoding="auto" src="hibiya-park.jpeg" /><br />ここが集合場所です。';
    const result = await sanitizeDescription(input);
    expect(result).toContain('<img src="hibiya-park.jpeg" />');
    expect(result).toContain("<br />");
  });

  it("should preserve class attributes", async () => {
    const input =
      '<span class="red">ここが集合場所です。</span>';
    expect(await sanitizeDescription(input)).toBe(
      '<span class="red">ここが集合場所です。</span>',
    );
  });
});
