/**
 * @vitest-environment jsdom
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MockMap } from "./helpers/mock-map";

beforeAll(() => {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock";
  }
  // jsdom does not implement matchMedia
  window.matchMedia = () =>
    ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList;
});

const originalCreateObjectURL = window.URL.createObjectURL;
const originalMatchMedia = window.matchMedia;

afterAll(() => {
  window.URL.createObjectURL = originalCreateObjectURL;
  window.matchMedia = originalMatchMedia;
});

/**
 * maplibre-gl は 5.11.0 で `style.sourceCaches` を `style.tileManagers` に改名した。
 * どちらの版でも帰属表示が壊れないことを確かめるため、両方の名前でテストする。
 */
const SOURCE_CONTAINER_KEYS = ["tileManagers", "sourceCaches"] as const;
type SourceContainerKey = (typeof SOURCE_CONTAINER_KEYS)[number];

/**
 * Extend MockMap with internal properties required by CustomAttributionControl.
 */
function createAttributionMap(
  opts: {
    canvasWidth?: number;
    sourceCaches?: Record<
      string,
      { used: boolean; usedForTerrain: boolean; attribution?: string }
    >;
    /**
     * ソース一覧を保持する `style` のプロパティ名。
     * 省略した場合は maplibre-gl 5.11.0 以降の `tileManagers` を使う。
     */
    sourceContainerKey?: SourceContainerKey;
  } = {},
) {
  const map = new MockMap();

  // Set canvas container width for compact detection
  Object.defineProperty(map.getCanvasContainer(), "offsetWidth", {
    value: opts.canvasWidth ?? 800,
    writable: true,
  });

  // Internal _getUIString used by _setElementTitle
  (map as unknown as Record<string, unknown>)._getUIString = (key: string) =>
    `ui:${key}`;

  // Internal style property holding the per-source tile managers
  const caches: Record<string, unknown> = {};
  for (const [id, sc] of Object.entries(opts.sourceCaches ?? {})) {
    caches[id] = {
      used: sc.used,
      usedForTerrain: sc.usedForTerrain,
      getSource: () => ({ attribution: sc.attribution }),
    };
  }
  (map as unknown as Record<string, unknown>).style = {
    [opts.sourceContainerKey ?? "tileManagers"]: caches,
  };

  return map;
}

describe("CustomAttributionControl", () => {
  let CustomAttributionControl: typeof import("../src/lib/controls/attribution").default;

  beforeAll(async () => {
    const mod = await import("../src/lib/controls/attribution");
    CustomAttributionControl = mod.default;
  });

  describe("getDefaultPosition", () => {
    it('should return "bottom-right"', () => {
      const ctrl = new CustomAttributionControl();
      expect(ctrl.getDefaultPosition()).toBe("bottom-right");
    });
  });

  describe("onAdd", () => {
    let map: MockMap;
    let container: HTMLDivElement;

    beforeEach(() => {
      map = createAttributionMap();
      const ctrl = new CustomAttributionControl();
      container = ctrl.onAdd(map as never);
    });

    it("should create a Shadow DOM", () => {
      expect(container.shadowRoot).not.toBeNull();
    });

    it("should have details + summary + div inside shadow", () => {
      const shadow = container.shadowRoot;
      expect(shadow).not.toBeNull();
      const details = shadow?.querySelector("details");
      expect(details).not.toBeNull();

      const summary = details?.querySelector("summary");
      expect(summary).not.toBeNull();
      expect(summary?.classList.contains("maplibregl-ctrl-attrib-button")).toBe(
        true,
      );

      const inner = details?.querySelector("div.maplibregl-ctrl-attrib-inner");
      expect(inner).not.toBeNull();
    });

    it("should register map events (styledata, sourcedata, terrain, resize, drag)", () => {
      const onSpy = vi.spyOn(map, "on");
      const ctrl = new CustomAttributionControl();
      ctrl.onAdd(map as never);

      const registeredEvents = onSpy.mock.calls.map((call) => call[0]);
      for (const event of [
        "styledata",
        "sourcedata",
        "terrain",
        "resize",
        "drag",
      ]) {
        expect(registeredEvents).toContain(event);
      }
    });
  });

  describe("onRemove", () => {
    let map: MockMap;
    let ctrl: InstanceType<typeof CustomAttributionControl>;
    let container: HTMLDivElement;

    beforeEach(() => {
      map = createAttributionMap();
      ctrl = new CustomAttributionControl();
      container = ctrl.onAdd(map as never);
      // Attach to DOM so DOM.remove can work
      document.body.appendChild(container);
    });

    it("should unregister all map events", () => {
      const offSpy = vi.spyOn(map, "off");
      ctrl.onRemove();

      const unregisteredEvents = offSpy.mock.calls.map((call) => call[0]);
      for (const event of [
        "styledata",
        "sourcedata",
        "terrain",
        "resize",
        "drag",
      ]) {
        expect(unregisteredEvents).toContain(event);
      }
    });

    it("should remove the container from DOM", () => {
      ctrl.onRemove();
      expect(document.body.contains(container)).toBe(false);
    });

    it("should unregister print media query listener", () => {
      const removeListenerSpy = vi.fn();
      window.matchMedia = () =>
        ({
          matches: false,
          media: "",
          addEventListener: vi.fn(),
          removeEventListener: removeListenerSpy,
        }) as unknown as MediaQueryList;

      const m = createAttributionMap();
      const c = new CustomAttributionControl();
      c.onAdd(m as never);
      c.onRemove();

      expect(removeListenerSpy).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });
  });

  describe("_updateAttributions", () => {
    it("should display custom attribution string", () => {
      const map = createAttributionMap();
      const ctrl = new CustomAttributionControl({
        customAttribution: "© Custom",
      });
      const container = ctrl.onAdd(map as never);
      const inner = container.shadowRoot?.querySelector(
        ".maplibregl-ctrl-attrib-inner",
      );
      expect(inner?.innerHTML).toBe("© Custom");
    });

    it('should join attribution array with " | "', () => {
      const map = createAttributionMap();
      const ctrl = new CustomAttributionControl({
        customAttribution: ["© A", "© B"],
      });
      const container = ctrl.onAdd(map as never);
      const inner = container.shadowRoot?.querySelector(
        ".maplibregl-ctrl-attrib-inner",
      );
      expect(inner?.innerHTML).toBe("© A | © B");
    });

    it("should deduplicate attributions", () => {
      const map = createAttributionMap();
      const ctrl = new CustomAttributionControl({
        customAttribution: ["© A", "© A"],
      });
      const container = ctrl.onAdd(map as never);
      const inner = container.shadowRoot?.querySelector(
        ".maplibregl-ctrl-attrib-inner",
      );
      // After dedup, only one "© A" should remain
      expect(inner?.innerHTML).toBe("© A");
    });

    // maplibre-gl 5.11.0 の `sourceCaches` → `tileManagers` 改名で
    // 帰属表示が空になった不具合の回帰テスト。
    for (const key of SOURCE_CONTAINER_KEYS) {
      describe(`with style.${key}`, () => {
        const sourceCaches = {
          src1: { used: true, usedForTerrain: false, attribution: "© Source1" },
          src2: { used: false, usedForTerrain: true, attribution: "© Source2" },
          src3: { used: false, usedForTerrain: false, attribution: "© Unused" },
        };

        it("should collect attributions from used sources", () => {
          const map = createAttributionMap({
            sourceContainerKey: key,
            sourceCaches,
          });
          const ctrl = new CustomAttributionControl();
          const container = ctrl.onAdd(map as never);
          const inner = container.shadowRoot?.querySelector(
            ".maplibregl-ctrl-attrib-inner",
          );
          expect(inner?.innerHTML).toContain("© Source1");
          expect(inner?.innerHTML).toContain("© Source2");
          expect(inner?.innerHTML).not.toContain("© Unused");
        });

        it("should render non-empty attribution text", () => {
          const map = createAttributionMap({
            sourceContainerKey: key,
            sourceCaches,
          });
          const ctrl = new CustomAttributionControl();
          const container = ctrl.onAdd(map as never);
          const inner = container.shadowRoot?.querySelector(
            ".maplibregl-ctrl-attrib-inner",
          );
          expect(inner?.textContent?.trim().length).toBeGreaterThan(0);
        });

        it("should not mark the control as empty", () => {
          const map = createAttributionMap({
            sourceContainerKey: key,
            sourceCaches,
          });
          const ctrl = new CustomAttributionControl();
          const container = ctrl.onAdd(map as never);
          const details = container.shadowRoot?.querySelector("details");
          expect(details?.classList.contains("maplibregl-attrib-empty")).toBe(
            false,
          );
        });

        it("should combine custom attribution with source attributions", () => {
          const map = createAttributionMap({
            sourceContainerKey: key,
            sourceCaches,
          });
          const ctrl = new CustomAttributionControl({
            customAttribution: "© Geolonia",
          });
          const container = ctrl.onAdd(map as never);
          const inner = container.shadowRoot?.querySelector(
            ".maplibregl-ctrl-attrib-inner",
          );
          expect(inner?.innerHTML).toContain("© Geolonia");
          expect(inner?.innerHTML).toContain("© Source1");
        });
      });
    }

    it("should tolerate a style without any source container", () => {
      const map = createAttributionMap();
      (map as unknown as Record<string, unknown>).style = {};
      const ctrl = new CustomAttributionControl({
        customAttribution: "© Geolonia",
      });
      const container = ctrl.onAdd(map as never);
      const inner = container.shadowRoot?.querySelector(
        ".maplibregl-ctrl-attrib-inner",
      );
      expect(inner?.innerHTML).toBe("© Geolonia");
    });

    it("should add maplibregl-attrib-empty class when no attributions", () => {
      const map = createAttributionMap();
      const ctrl = new CustomAttributionControl();
      const container = ctrl.onAdd(map as never);
      const details = container.shadowRoot?.querySelector("details");
      expect(details?.classList.contains("maplibregl-attrib-empty")).toBe(true);
    });
  });

  describe("_toggleAttribution", () => {
    it("should toggle compact-show class", () => {
      const map = createAttributionMap({ canvasWidth: 400 });
      const ctrl = new CustomAttributionControl({
        customAttribution: "© Test",
      });
      const container = ctrl.onAdd(map as never);
      const details = container.shadowRoot?.querySelector("details");

      // Initially compact + compact-show after onAdd with small canvas
      expect(details?.classList.contains("maplibregl-compact")).toBe(true);
      expect(details?.classList.contains("maplibregl-compact-show")).toBe(true);

      // First toggle: removes compact-show
      ctrl._toggleAttribution();
      expect(details?.classList.contains("maplibregl-compact-show")).toBe(
        false,
      );

      // Second toggle: adds compact-show back
      ctrl._toggleAttribution();
      expect(details?.classList.contains("maplibregl-compact-show")).toBe(true);
    });
  });

  describe("_updateCompact", () => {
    it("should add compact classes when canvas width ≤ 640", () => {
      const map = createAttributionMap({ canvasWidth: 400 });
      const ctrl = new CustomAttributionControl({
        customAttribution: "© Test",
      });
      const container = ctrl.onAdd(map as never);
      const details = container.shadowRoot?.querySelector("details");

      expect(details?.classList.contains("maplibregl-compact")).toBe(true);
    });

    it("should add compact classes when canvas width = 640", () => {
      const map = createAttributionMap({ canvasWidth: 640 });
      const ctrl = new CustomAttributionControl({
        customAttribution: "© Test",
      });
      const container = ctrl.onAdd(map as never);
      const details = container.shadowRoot?.querySelector("details");

      expect(details?.classList.contains("maplibregl-compact")).toBe(true);
    });

    it("should not add compact classes when canvas width > 640", () => {
      const map = createAttributionMap({ canvasWidth: 800 });
      const ctrl = new CustomAttributionControl({
        customAttribution: "© Test",
      });
      const container = ctrl.onAdd(map as never);
      const details = container.shadowRoot?.querySelector("details");

      expect(details?.classList.contains("maplibregl-compact")).toBe(false);
    });
  });

  describe("_updateCompactMinimize", () => {
    it("should remove compact-show on drag", () => {
      const map = createAttributionMap({ canvasWidth: 400 });
      const ctrl = new CustomAttributionControl({
        customAttribution: "© Test",
      });
      const container = ctrl.onAdd(map as never);
      const details = container.shadowRoot?.querySelector("details");

      // Initially compact-show is set
      expect(details?.classList.contains("maplibregl-compact-show")).toBe(true);

      // Simulate drag event
      map.fire("drag");
      expect(details?.classList.contains("maplibregl-compact-show")).toBe(
        false,
      );
    });
  });
});
