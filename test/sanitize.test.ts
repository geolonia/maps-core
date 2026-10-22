import { describe, expect, it } from "vitest";
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
    const input = '<span class="red">ここが集合場所です。</span>';
    expect(await sanitizeDescription(input)).toBe(
      '<span class="red">ここが集合場所です。</span>',
    );
  });
});

// description は GeoJSON の properties から来るので、地図の利用者が書いた
// HTML がそのまま入る。

// sanitize-html 2.18 で挙動が変わった点。2.17.7 に戻すと最初の 2 件が落ちる。
describe("sanitizeDescription: iframe (sanitize-html 2.18)", () => {
  it("keeps the fallback markup of a discarded iframe, sanitized", async () => {
    // 2.17.7 以前は中身がエスケープされて文字として残っていた。
    const input =
      '<iframe src="https://example.com"><b>代替</b>テキスト</iframe>';
    expect(await sanitizeDescription(input)).toBe("<b>代替</b>テキスト");
  });

  it("strips script tags inside the fallback markup of an iframe", async () => {
    const input = "<iframe><script>alert(1)</script><b>x</b></iframe>";
    expect(await sanitizeDescription(input)).toBe("<b>x</b>");
  });

  it("does not throw on deeply nested unclosed iframes", async () => {
    // 2.18.0 では入れ子の数だけ再帰して RangeError になった (GHSA-c9rx-x947-fp3h)。
    const input = `${"<iframe>".repeat(2000)}x`;
    const result = await sanitizeDescription(input);
    expect(result).toContain("x");
    expect(result).not.toContain("<iframe");
  });
});

// 許可していないタグや属性が取り除かれること。どの版でも同じ結果になる。
// 2.18 のセキュリティ修正の対象になった入力も含めている。
describe("sanitizeDescription: dangerous markup", () => {
  it("strips meta refresh", async () => {
    const input =
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">本文';
    expect(await sanitizeDescription(input)).toBe("本文");
  });

  it("strips svg animation elements", async () => {
    const input =
      '<svg><animate attributeName="href" to="javascript:alert(1)"/></svg>本文';
    expect(await sanitizeDescription(input)).toBe("本文");
  });

  it("strips javascript: URLs from links and srcset", async () => {
    expect(
      await sanitizeDescription('<a href="javascript:alert(1)">x</a>'),
    ).toBe("<a>x</a>");
    expect(
      await sanitizeDescription(
        '<img srcset="javascript:alert(1) 1x, ok.jpg 2x">',
      ),
    ).toBe('<img srcset="ok.jpg 2x" />');
  });

  it("strips event handler and style attributes", async () => {
    expect(
      await sanitizeDescription('<img src="x.jpg" onerror="alert(1)">'),
    ).toBe('<img src="x.jpg" />');
    expect(
      await sanitizeDescription('<p style="color:red" class="c">x</p>'),
    ).toBe('<p class="c">x</p>');
  });
});
