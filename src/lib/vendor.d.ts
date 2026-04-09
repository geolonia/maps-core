declare module "@mapbox/point-geometry" {
  class Point {
    x: number;
    y: number;
    constructor(x: number, y: number);
  }
  export default Point;
}

declare module "@geolonia/mbgl-gesture-handling" {
  export default class GestureHandling {
    constructor(options?: { lang?: string });
    addTo(map: any): void;
  }
}
