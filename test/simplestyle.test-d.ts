import type { FitBoundsOptions } from "maplibre-gl";
import { describe, expectTypeOf, it } from "vitest";
import type {
  ChoroplethOptions,
  CircleOptions,
  ColorMap,
  ExtrusionColorOptions,
} from "../src/index";
import type { SimpleStyle } from "../src/lib/simplestyle";

describe("SimpleStyle.fitBounds の型", () => {
  it("options は MapLibre の FitBoundsOptions を受け取る", () => {
    expectTypeOf<SimpleStyle["fitBounds"]>()
      .parameter(0)
      .toEqualTypeOf<FitBoundsOptions | undefined>();
    expectTypeOf<SimpleStyle["fitBounds"]>().toBeCallableWith({
      padding: 10,
      duration: 0,
    });
  });

  it("FitBoundsOptions に無いプロパティは型エラーになる", () => {
    // 呼び出さない関数の中に書き、型検査だけを行う
    const _call = (ss: SimpleStyle) =>
      // @ts-expect-error FitBoundsOptions に無いプロパティ
      ss.fitBounds({ notAnOption: 1 });
    expectTypeOf(_call).returns.toEqualTypeOf<SimpleStyle>();
  });
});

describe("data-driven の colors の型", () => {
  it("配列と値と色の対応表の両方を受け取る", () => {
    expectTypeOf<CircleOptions["colors"]>().toEqualTypeOf<
      string[] | ColorMap | undefined
    >();
    expectTypeOf<ChoroplethOptions["colors"]>().toEqualTypeOf<
      string[] | ColorMap | undefined
    >();
    expectTypeOf<ExtrusionColorOptions["colors"]>().toEqualTypeOf<
      string[] | ColorMap | undefined
    >();
    expectTypeOf<ColorMap>().toEqualTypeOf<Record<string, string>>();
  });
});
