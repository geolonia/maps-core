import { vi } from "vitest";

type EventHandler = (...args: unknown[]) => void;

/**
 * Shared MockMap for unit testing without MapLibre GL dependency.
 *
 * Covers methods used across: simplestyle, simplestyle-vector, attribution, util.
 */
export class MockMap {
  bounds = false;
  layers: Record<string, unknown>[] = [];
  sources: Record<string, unknown> = {};
  removed = false;

  private _eventHandlers: Map<string, EventHandler[]> = new Map();
  private _layerEventHandlers: Map<string, EventHandler[]> = new Map();

  addSource(id: string, source: unknown) {
    this.sources[id] = source;
  }

  addLayer(layer: Record<string, unknown>) {
    this.layers.push(layer);
  }

  getSource(id: string) {
    const sources = this.sources;
    const raw = sources[id] as Record<string, unknown> | undefined;
    return raw
      ? {
          ...raw,
          setData(geojson: unknown) {
            sources[id] = { type: "geojson", data: geojson };
          },
        }
      : undefined;
  }

  getLayer(id: string) {
    return this.layers.find((l) => l.id === id);
  }

  removeLayer(id: string) {
    this.layers = this.layers.filter((l) => l.id !== id);
  }

  removeSource(id: string) {
    delete this.sources[id];
  }

  on(eventOrLayer: string, handlerOrLayer?: EventHandler | string, handler?: EventHandler) {
    if (typeof handlerOrLayer === "function") {
      // on(event, handler)
      const handlers = this._eventHandlers.get(eventOrLayer) || [];
      handlers.push(handlerOrLayer);
      this._eventHandlers.set(eventOrLayer, handlers);
    } else if (typeof handlerOrLayer === "string" && typeof handler === "function") {
      // on(event, layer, handler)
      const key = `${eventOrLayer}:${handlerOrLayer}`;
      const handlers = this._layerEventHandlers.get(key) || [];
      handlers.push(handler);
      this._layerEventHandlers.set(key, handlers);
    }
  }

  off(eventOrLayer: string, handlerOrLayer?: EventHandler | string, handler?: EventHandler) {
    if (typeof handlerOrLayer === "function") {
      // off(event, handler)
      const handlers = this._eventHandlers.get(eventOrLayer) || [];
      this._eventHandlers.set(
        eventOrLayer,
        handlers.filter((h) => h !== handlerOrLayer),
      );
    } else if (typeof handlerOrLayer === "string" && typeof handler === "function") {
      // off(event, layer, handler)
      const key = `${eventOrLayer}:${handlerOrLayer}`;
      const handlers = this._layerEventHandlers.get(key) || [];
      this._layerEventHandlers.set(
        key,
        handlers.filter((h) => h !== handler),
      );
    }
  }

  getCanvas() {
    return { style: { cursor: "" } };
  }

  getContainer() {
    return { dataset: {} } as unknown as HTMLElement;
  }

  getCanvasContainer() {
    return { offsetWidth: 800 } as unknown as HTMLElement;
  }

  fitBounds(..._args: unknown[]) {
    this.bounds = true;
  }

  queryRenderedFeatures(_point: unknown, _options?: unknown) {
    return [] as unknown[];
  }

  easeTo(_options: unknown) {}

  remove() {
    this.removed = true;
  }

  /** Fire registered event handlers (useful for testing event-driven behavior). */
  fire(event: string, data?: unknown) {
    const handlers = this._eventHandlers.get(event) || [];
    for (const handler of handlers) {
      handler(data);
    }
  }

  /** Fire registered layer-scoped event handlers. */
  fireLayerEvent(event: string, layer: string, data?: unknown) {
    const key = `${event}:${layer}`;
    const handlers = this._layerEventHandlers.get(key) || [];
    for (const handler of handlers) {
      handler(data);
    }
  }
}

/** Create a MockMap instance with all methods spied via vi.spyOn. */
export function createMockMap(): MockMap {
  const map = new MockMap();
  vi.spyOn(map, "addSource");
  vi.spyOn(map, "addLayer");
  vi.spyOn(map, "getSource");
  vi.spyOn(map, "getLayer");
  vi.spyOn(map, "removeLayer");
  vi.spyOn(map, "removeSource");
  vi.spyOn(map, "on");
  vi.spyOn(map, "off");
  vi.spyOn(map, "getCanvas");
  vi.spyOn(map, "getContainer");
  vi.spyOn(map, "getCanvasContainer");
  vi.spyOn(map, "fitBounds");
  vi.spyOn(map, "queryRenderedFeatures");
  vi.spyOn(map, "easeTo");
  vi.spyOn(map, "remove");
  return map;
}
