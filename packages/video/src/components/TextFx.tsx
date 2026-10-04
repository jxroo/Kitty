import { interpolate, useCurrentFrame } from "remotion";
import { progress } from "../lib/anim";
import { EASE_OUT } from "../theme";
import type { Part } from "./WordReveal";

type Line = string | Part[];
const parts = (line: Line): Part[] => (typeof line === "string" ? [{ text: line }] : line);

const Parts: React.FC<{ line: Line }> = ({ line }) => (
  <>
    {parts(line).map((p, i) => (
      <span key={i} style={{ color: p.color, fontWeight: p.weight }}>
        {i > 0 ? " " : ""}
        {p.text}
      </span>
    ))}
  </>
);

/** Each line rises from behind an invisible edge, crisp, no blur (a classic title-card move). */
export const MaskLines: React.FC<{ lines: Line[]; start?: number; stagger?: number; dur?: number; style?: React.CSSProperties }> = ({
  lines,
  start = 0,
  stagger = 8,
  dur = 34,
  style,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ ...style, textAlign: "center" }}>
      {lines.map((line, i) => {
        const p = progress(frame, start + i * stagger, dur);
        return (
          <div key={i} style={{ overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
            <div style={{ transform: `translateY(${(1 - p) * 110}%)` }}>
              <Parts line={line} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Letters start wide apart and close in to their final tracking while fading up. */
export const TrackIn: React.FC<{ lines: Line[]; start?: number; dur?: number; style?: React.CSSProperties }> = ({ lines, start = 0, dur = 56, style }) => {
  const frame = useCurrentFrame();
  const p = progress(frame, start, dur);
  const target = parseFloat(String(style?.letterSpacing ?? "-0.045em"));
  return (
    <div
      style={{
        ...style,
        textAlign: "center",
        letterSpacing: `${interpolate(p, [0, 1], [0.32, target])}em`,
        opacity: interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
      }}
    >
      {lines.map((line, i) => (
        <div key={i}>
          <Parts line={line} />
        </div>
      ))}
    </div>
  );
};

/** Words land one per beat, each with a short hard scale-in: punchy, for the climax. */
export const PunchWords: React.FC<{ lines: Line[]; start?: number; stagger?: number; style?: React.CSSProperties }> = ({ lines, start = 0, stagger = 10, style }) => {
  const frame = useCurrentFrame();
  let index = 0;
  return (
    <div style={{ ...style, textAlign: "center" }}>
      {lines.map((line, li) => {
        const words = parts(line).flatMap((p) => p.text.split(" ").map((w) => ({ w, color: p.color, weight: p.weight })));
        return (
          <div key={li}>
            {words.map(({ w, color, weight }, wi) => {
              const at = start + index++ * stagger;
              const s = interpolate(frame, [at, at + 8], [1.18, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
              return (
                <span key={wi}>
                  <span style={{ display: "inline-block", color, fontWeight: weight, opacity: frame >= at ? 1 : 0, transform: `scale(${s})` }}>{w}</span>
                  {wi < words.length - 1 ? " " : null}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

/** Typed out character by character with a blinking caret (string slicing, as a statement printer would). */
export const TypeOn: React.FC<{ text: string; start?: number; cps?: number; style?: React.CSSProperties }> = ({ text, start = 0, cps = 40, style }) => {
  const frame = useCurrentFrame();
  const shown = Math.max(0, Math.min(text.length, Math.floor(((frame - start) / 60) * cps)));
  const typing = shown < text.length;
  const caretOn = typing || Math.floor(frame / 16) % 2 === 0;
  return (
    <div style={{ ...style, textAlign: "center" }}>
      {text.slice(0, shown)}
      <span style={{ display: "inline-block", width: "0.06em", height: "0.85em", marginLeft: "0.04em", background: "currentColor", verticalAlign: "-0.08em", opacity: caretOn && frame >= start ? 1 : 0 }} />
    </div>
  );
};
