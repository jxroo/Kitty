import { useCurrentFrame } from "remotion";
import { MaskLines, PunchWords, TrackIn, TypeOn } from "../components/TextFx";
import { WordReveal } from "../components/WordReveal";
import { reveal } from "../lib/anim";
import { C, fontFamily, headline } from "../theme";

export type HeadStyle = "blur" | "mask" | "track" | "punch" | "type";

export const PUNCH = { start: 8, stagger: 9 };

/** "01 · SAVINGS" above a headline and an optional grey line. Each chapter picks its own way in. */
export const ChapterHead: React.FC<{ n: number; kicker: string; title: string; sub?: string; look: HeadStyle }> = ({ n, kicker, title, sub, look }) => {
  const frame = useCurrentFrame();
  const h = headline(92, C.inkLight);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ fontFamily, fontSize: 24, fontWeight: 700, letterSpacing: "0.16em", color: C.emerald600, ...reveal(frame, 2, 34, 14) }}>
        0{n} · {kicker.toUpperCase()}
      </div>
      {look === "blur" ? <WordReveal start={8} stagger={5} style={h} lines={[title]} /> : null}
      {look === "mask" ? <MaskLines start={6} style={h} lines={[title]} /> : null}
      {look === "track" ? <TrackIn start={4} style={h} lines={[title]} /> : null}
      {look === "punch" ? <PunchWords start={PUNCH.start} stagger={PUNCH.stagger} style={h} lines={[title]} /> : null}
      {look === "type" ? <TypeOn start={6} cps={38} style={h} text={title} /> : null}
      {sub ? <MaskLines start={26} style={{ ...headline(40, C.grayLight), fontWeight: 500, letterSpacing: "-0.02em" }} lines={[sub]} /> : null}
    </div>
  );
};
