import { AbsoluteFill, random, useCurrentFrame } from "remotion";

const COLORS = ["16,185,129", "14,165,233", "99,102,241", "251,191,36"];

// Fixed, seeded lights: near ones are large, blurrier and drift faster than far ones (parallax).
const ORBS = Array.from({ length: 14 }, (_, i) => {
  const depth = random(`depth-${i}`); // 0 far … 1 near
  return {
    x: random(`x-${i}`) * 1920,
    y: random(`y-${i}`) * 1080,
    size: 60 + depth * 260,
    blur: 18 + depth * 46,
    speed: 0.15 + depth * 0.7,
    phase: random(`p-${i}`) * Math.PI * 2,
    alpha: 0.05 + (1 - depth) * 0.07,
    color: COLORS[i % COLORS.length],
  };
});

/** Out-of-focus lights behind the light act, drifting at different depths. */
export const Bokeh: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {ORBS.map((o, i) => {
        const x = (((o.x - frame * o.speed) % 2200) + 2200) % 2200 - 140;
        const y = o.y + Math.sin(frame / 90 + o.phase) * 30 * o.speed;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - o.size / 2,
              top: y - o.size / 2,
              width: o.size,
              height: o.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(${o.color},${o.alpha * 1.6}) 0%, rgba(${o.color},${o.alpha}) 45%, rgba(${o.color},0) 70%)`,
              filter: `blur(${o.blur}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
