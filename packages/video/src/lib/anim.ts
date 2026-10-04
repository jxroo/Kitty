import { interpolate } from "remotion";
import { EASE_IN_OUT, EASE_OUT } from "../theme";

type EasingFn = (t: number) => number;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 between `start` and `start + dur`, clamped, eased. */
export const progress = (frame: number, start: number, dur: number, easing: EasingFn = EASE_OUT) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...CLAMP, easing });

/** Linear map with clamping and an Apple ease-in-out by default. */
export const tween = (frame: number, input: [number, number], output: [number, number], easing: EasingFn = EASE_IN_OUT) =>
  interpolate(frame, input, output, { ...CLAMP, easing });

/** The signature entrance: rises 28 px out of a 12 px blur. */
export const reveal = (frame: number, start: number, dur = 40, rise = 28): React.CSSProperties => {
  const p = progress(frame, start, dur);
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * rise}px)`,
    filter: p < 1 ? `blur(${(1 - p) * 12}px)` : undefined,
  };
};

/** Frames at which an eased count-up crosses each 1/n of its way (for counter ticks). */
export const tickFrames = (start: number, dur: number, n: number, easing: EasingFn = EASE_OUT) => {
  const out: number[] = [];
  let k = 1;
  for (let f = start; f <= start + dur && k < n; f++) {
    if (easing((f - start) / dur) >= k / n) {
      out.push(f);
      k++;
    }
  }
  return out;
};
