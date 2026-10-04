import { useCurrentFrame } from "remotion";
import { progress, tween } from "../lib/anim";

type CameraProps = {
  dur: number;
  /** Tilt around X/Y in degrees, from scene start to scene end (a slow orbit around the subject). */
  rx?: [number, number];
  ry?: [number, number];
  children: React.ReactNode;
  style?: React.CSSProperties;
};

/** Puts its content in 3D space and orbits slowly around it, like a camera on a slider. */
export const Camera: React.FC<CameraProps> = ({ dur, rx = [10, 3], ry = [-9, 7], children, style }) => {
  const frame = useCurrentFrame();
  const x = tween(frame, [0, dur], rx);
  const y = tween(frame, [0, dur], ry);
  return (
    <div style={{ perspective: 2000, perspectiveOrigin: "50% 40%", ...style }}>
      <div style={{ transform: `rotateX(${x}deg) rotateY(${y}deg)`, transformStyle: "preserve-3d" }}>{children}</div>
    </div>
  );
};

/** A band of light that glides across its (relatively positioned, rounded) parent once. */
export const LightSweep: React.FC<{ at: number; dur?: number; radius?: number; strength?: number }> = ({ at, dur = 50, radius = 36, strength = 0.55 }) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, dur);
  if (frame < at || p >= 1) return null;
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "-50%",
          bottom: "-50%",
          width: "28%",
          left: `${-40 + p * 150}%`,
          transform: "rotate(18deg)",
          background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${strength}) 50%, rgba(255,255,255,0) 100%)`,
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
};
