import { useCurrentFrame } from "remotion";
import { reveal } from "../lib/anim";

export type Part = { text: string; color?: string; weight?: number };
type Line = string | Part[];

type Props = {
  lines: Line[];
  start?: number;
  /** Frames between consecutive words. */
  stagger?: number;
  dur?: number;
  style?: React.CSSProperties;
  align?: "left" | "center";
};

/** Words rise out of a blur one after another; colour and weight can change per part. */
export const WordReveal: React.FC<Props> = ({ lines, start = 0, stagger = 4, dur = 40, style, align = "center" }) => {
  const frame = useCurrentFrame();
  let index = 0;
  return (
    <div style={{ ...style, textAlign: align }}>
      {lines.map((line, li) => {
        const parts: Part[] = typeof line === "string" ? [{ text: line }] : line;
        const words = parts.flatMap((p) =>
          p.text
            .split(" ")
            .filter(Boolean)
            .map((w) => ({ w, color: p.color, weight: p.weight })),
        );
        return (
          <div key={li}>
            {words.map(({ w, color, weight }, wi) => {
              const s = reveal(frame, start + index++ * stagger, dur);
              return (
                <span key={wi}>
                  <span style={{ display: "inline-block", color, fontWeight: weight, ...s }}>{w}</span>
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
