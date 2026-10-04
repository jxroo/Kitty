import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C, EASE_IN, EASE_IN_OUT, EASE_OUT, HEIGHT, WIDTH } from "../theme";

/**
 * How a shot arrives or leaves.
 * - dissolve: soft fade through a blur. fade: a clean opacity fade, no blur.
 * - fly: travels through depth (scale), no blur so nothing smears.
 * - push-up / slide-left / wipe: the outgoing and incoming shots move as one strip; give both sides the same frames.
 *   The outgoing shot plays them after its `dur`, overlapping the next shot's first frames.
 * - snap: arrives with a quick zoom settle. cut: no transition.
 */
export type Kind = "dissolve" | "fade" | "fly" | "push-up" | "slide-left" | "wipe" | "snap" | "cut";
export type Transition = { kind: Kind; frames: number };

const OVERLAPPING: Kind[] = ["push-up", "slide-left", "wipe"];

type Props = {
  name: string;
  from: number;
  dur: number;
  fadeIn?: number;
  fadeOut?: number;
  /** Slow camera push-in over the whole scene (0.03 = 3 %). */
  push?: number;
  /** Shorthand used by the teaser: dissolve or fly on both ends, with fadeIn / fadeOut frames. */
  move?: "dissolve" | "fly";
  enter?: Transition;
  exit?: Transition;
  children: React.ReactNode;
};

/** A shot on the timeline, with its entrance, exit and a slow drift toward the viewer. */
export const Scene: React.FC<Props> = ({ name, from, dur, fadeIn = 18, fadeOut = 14, push = 0.025, move = "dissolve", enter, exit, children }) => {
  const enterT = enter ?? { kind: fadeIn > 0 ? move : "cut", frames: fadeIn };
  const exitT = exit ?? { kind: fadeOut > 0 ? move : "cut", frames: fadeOut };
  const tail = OVERLAPPING.includes(exitT.kind) ? exitT.frames : 0;
  return (
    <Sequence name={name} from={from} durationInFrames={dur + tail}>
      <Shot dur={dur} push={push} enter={enterT} exit={exitT}>
        {children}
      </Shot>
    </Sequence>
  );
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Shot: React.FC<{ dur: number; push: number; enter: Transition; exit: Transition; children: React.ReactNode }> = ({ dur, push, enter, exit, children }) => {
  const frame = useCurrentFrame();
  const overlapping = OVERLAPPING.includes(exit.kind);
  const exitStart = overlapping ? dur : dur - exit.frames;
  const strip = OVERLAPPING.includes(enter.kind) || overlapping;

  const p = enter.kind === "cut" || enter.frames <= 0 ? 1 : interpolate(frame, [0, enter.frames], [0, 1], { ...clamp, easing: strip ? EASE_IN_OUT : EASE_OUT });
  const q =
    exit.kind === "cut" || exit.frames <= 0
      ? 0
      : interpolate(frame, [exitStart, exitStart + exit.frames], [0, 1], { ...clamp, easing: overlapping ? EASE_IN_OUT : EASE_IN });

  let opacity = 1;
  let blur = 0;
  let scale = 1 + (push * Math.min(frame, dur)) / dur;
  let tx = 0;
  let ty = 0;
  let clip: string | undefined;

  switch (enter.kind) {
    case "dissolve":
      opacity *= p;
      blur += (1 - p) * 8;
      scale *= 0.985 + 0.015 * p;
      break;
    case "fade":
      opacity *= p;
      break;
    case "fly":
      opacity *= p;
      scale *= 0.92 + 0.08 * p;
      break;
    case "push-up":
      ty += (1 - p) * HEIGHT;
      break;
    case "slide-left":
      tx += (1 - p) * WIDTH;
      break;
    case "wipe":
      clip = `inset(0 0 0 ${(1 - p) * 100}%)`;
      break;
    case "snap":
      scale *= 1 + 0.08 * (1 - p);
      break;
  }
  switch (exit.kind) {
    case "dissolve":
      opacity *= 1 - q;
      blur += q * 10;
      scale *= 1 + 0.02 * q;
      break;
    case "fade":
      opacity *= 1 - q;
      break;
    case "fly":
      opacity *= 1 - q;
      scale *= 1 + 0.1 * q;
      break;
    case "push-up":
      ty -= q * HEIGHT;
      break;
    case "slide-left":
      tx -= q * WIDTH;
      break;
    case "wipe":
      clip = `inset(0 ${q * 100}% 0 0)`;
      break;
  }

  return (
    <AbsoluteFill
      style={{
        opacity,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        clipPath: clip,
      }}
    >
      {enter.kind === "wipe" ? (
        <>
          {/* The page being drawn across is opaque while it moves, then melts into the shared stage. */}
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse 55% 55% at 82% 8%, rgba(16,185,129,0.12) 0%, rgba(245,245,247,0) 70%), ${C.light}`,
              opacity: 1 - interpolate(frame, [enter.frames, enter.frames + 24], [0, 1], clamp),
            }}
          />
          {p < 1 ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${(1 - p) * 100}%`,
                width: 3,
                background: C.emerald500,
                boxShadow: "0 0 24px 6px rgba(16,185,129,0.45)",
                zIndex: 5,
              }}
            />
          ) : null}
        </>
      ) : null}
      {children}
    </AbsoluteFill>
  );
};
