import { AbsoluteFill, useCurrentFrame } from "remotion";
import { progress, tween } from "../lib/anim";
import { BLOOM, C, EASE_IN_OUT, TO_DARK } from "../theme";
import { Bokeh } from "./Bokeh";

type Range = { from: number; to: number };

type Props = {
  /** When the white bloom opens Act II. */
  bloom?: Range;
  /** When the light world fades back to black for Act III. */
  toDark?: Range;
  /** Soft out-of-focus lights drifting behind Act II, for depth. */
  bokeh?: boolean;
};

/**
 * One continuous stage under all scenes, so act changes are lighting changes, not cuts:
 * Act I on black, a white bloom opens into the light world of the app, Act III returns to black.
 */
export const Backdrop: React.FC<Props> = ({ bloom = BLOOM, toDark = TO_DARK, bokeh = false }) => {
  const frame = useCurrentFrame();
  const opening = progress(frame, bloom.from, bloom.to - bloom.from, EASE_IN_OUT);
  const bloomFade = 1 - progress(frame, bloom.to, 40);
  const lightOn = frame >= bloom.to ? 1 - tween(frame, [toDark.from, toDark.to], [0, 1]) : 0;
  const drift = Math.sin(frame / 240) * 40;

  return (
    <AbsoluteFill style={{ backgroundColor: C.black }}>
      {/* Act I / III: black with a barely-there lift in the middle, like a stage light. */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${C.night} 0%, ${C.black} 70%)` }} />
      {/* Act III gets a faint emerald glow behind the numbers. */}
      <AbsoluteFill
        style={{
          opacity: progress(frame, toDark.to, 60),
          background: "radial-gradient(ellipse 45% 40% at 50% 50%, rgba(16,185,129,0.10) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      {/* Act II: the light world of the app, with two slow-drifting tints from its palette. */}
      <AbsoluteFill style={{ opacity: lightOn, backgroundColor: C.light }}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 55% 55% at ${78 + drift / 40}% ${8 + drift / 60}%, rgba(16,185,129,0.13) 0%, rgba(245,245,247,0) 70%)`,
          }}
        />
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 50% 50% at ${12 - drift / 50}% ${95 - drift / 80}%, rgba(14,165,233,0.08) 0%, rgba(245,245,247,0) 70%)`,
          }}
        />
        {bokeh ? <Bokeh /> : null}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 85% at 50% 50%, rgba(0,0,0,0) 60%, rgba(15,23,42,0.06) 100%)" }} />
      </AbsoluteFill>

      {/* The bloom: a soft white sun that grows from the centre until it fills the frame. */}
      {frame >= bloom.from && frame < bloom.to + 40 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: bloomFade }}>
          <div
            style={{
              width: 2600,
              height: 2600,
              borderRadius: "50%",
              background: "radial-gradient(circle, #ffffff 0%, #ffffff 45%, rgba(255,255,255,0.85) 55%, rgba(255,255,255,0) 70%)",
              transform: `scale(${0.02 + opening * 1.6})`,
              flexShrink: 0,
            }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
