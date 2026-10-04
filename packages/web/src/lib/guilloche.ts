// Rose-engine guilloche, the engraving of the trailer's vault and the brand mark.
// Ported from packages/promo/src/gen/guilloche.ts (Next does not compile code from outside
// this package): the same curves, but built as an SVG path instead of drawn on a canvas.
// A band is a family of closed curves with offset phases that together weave a rope or a flower.

export type Band = {
  pattern: "rope" | "core";
  /** Inner and outer radius of the band, in viewBox units. */
  r0: number;
  r1: number;
  /** Number of curves. */
  curves: number;
  /** Lobes around the circle. */
  lobes: number;
};

const TAU = Math.PI * 2;

/** Radius of curve `i` at angle `theta`, between r0 and r1. */
function radius(b: Band, i: number, theta: number): number {
  const mid = (b.r0 + b.r1) / 2;
  const half = (b.r1 - b.r0) / 2;
  const phase = (i / b.curves) * TAU;
  if (b.pattern === "rope") return mid + half * 0.92 * Math.sin(b.lobes * theta + phase);
  return mid + half * (0.62 * Math.sin(b.lobes * theta + phase) + 0.3 * Math.sin(3 * b.lobes * theta - 2 * phase));
}

// 0.1 unit is far below a pixel at any size the mark is shown, and keeps the path short.
const round = (v: number) => Math.round(v * 10) / 10 || 0;

/** Points of every curve of the band, from 12 o'clock clockwise; each curve ends where it starts. */
export function bandPoints(b: Band, stepsPerLobe = 18): [number, number][][] {
  const steps = Math.max(360, b.lobes * stepsPerLobe);
  return Array.from({ length: b.curves }, (_, i) =>
    Array.from({ length: steps + 1 }, (_, s): [number, number] => {
      const theta = (s / steps) * TAU;
      const r = radius(b, i, theta);
      return [round(r * Math.cos(theta - Math.PI / 2)), round(r * Math.sin(theta - Math.PI / 2))];
    }),
  );
}

/** SVG path data for the band, centred on (0, 0): one `M` subpath per curve. */
export function bandPath(b: Band): string {
  return bandPoints(b)
    .map((pts) => "M" + pts.map(([x, y]) => `${x} ${y}`).join(" "))
    .join("");
}
