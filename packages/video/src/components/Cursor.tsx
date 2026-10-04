import { useCurrentFrame } from "remotion";
import { progress, tween } from "../lib/anim";
import { pressAt } from "./ui";

type Props = {
  /** Where the pointer starts, relative to its target (the target is at 0,0). */
  fromX: number;
  fromY: number;
  enterAt: number;
  arriveAt: number;
  clickAt: number;
};

/**
 * A macOS pointer that glides onto its target along a gentle arc and clicks.
 * Place it inside a `position: relative` box; the tip lands on that box's centre.
 */
export const Cursor: React.FC<Props> = ({ fromX, fromY, enterAt, arriveAt, clickAt }) => {
  const frame = useCurrentFrame();
  if (frame < enterAt) return null;
  const t = tween(frame, [enterAt, arriveAt], [0, 1]);
  // Quadratic Bézier through a control point below the straight line, for a hand-drawn arc.
  const cx = fromX * 0.35;
  const cy = fromY * 0.05 + 60;
  const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * cx;
  const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * cy;
  const press = pressAt(frame, clickAt);
  const ring = progress(frame, clickAt, 28);
  const opacity = progress(frame, enterAt, 14);

  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, zIndex: 10, pointerEvents: "none" }}>
      {frame >= clickAt ? (
        <div
          style={{
            position: "absolute",
            left: x - 40,
            top: y - 40,
            width: 80,
            height: 80,
            borderRadius: 40,
            border: "3px solid rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 2px rgba(15,23,42,0.12)",
            transform: `scale(${0.3 + ring * 1.1})`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
      <svg
        width={40}
        height={56}
        viewBox="0 0 20 28"
        style={{
          position: "absolute",
          left: x,
          top: y,
          opacity,
          transform: `scale(${1 - press * 0.14})`,
          transformOrigin: "0 0",
          filter: "drop-shadow(0 6px 10px rgba(15,23,42,0.35))",
          overflow: "visible",
        }}
      >
        <path d="M1 1 L1 21.5 L6.2 16.6 L9.6 24.6 L13 23.2 L9.7 15.4 L16.6 15.4 Z" fill="#111" stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
};
