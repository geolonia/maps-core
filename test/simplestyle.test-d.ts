import type { FitBoundsOptions } from "maplibre-gl";
import { describe, expectTypeOf, it } from "vitest";
import type { SimpleStyle } from "../src/lib/simplestyle";

describe("SimpleStyle.fitBounds の型", () => {
  it("options は MapLibre の FitBoundsOptions を受け取る", () => {
    expectTypeOf<SimpleStyle["fitBounds"]>()
      .parameter(0)
      .toEqualTypeOf<FitBoundsOptions | undefined>();
  });

  it("FitBoundsOptions に無いプロパティは型エラーになる", () => {
    const fit = (ss: SimpleStyle) => {
      // @ts-expect-error FitBoundsOptions に無いプロパティ
      ss.fitBounds({ notAnOption: 1 });
      ss.fitBounds({ padding: 10, duration: 0 });
    };
    expectTypeOf(fit).toBeFunction();
  });
});
