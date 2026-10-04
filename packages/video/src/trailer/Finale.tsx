import { useCurrentFrame } from "remotion";
import { AppIcon } from "../components/AppIcon";
import { Stage } from "../components/Stage";
import { WordReveal } from "../components/WordReveal";
import { progress, reveal } from "../lib/anim";
import { C, headline } from "../theme";

export const FINALE_HIT = 6;

/** Back on black: the name, the promise, where to try it. */
export const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const p = progress(frame, FINALE_HIT, 56);
  return (
    <Stage gap={32}>
      <AppIcon
        size={168}
        glow={p * 0.8}
        style={{ opacity: p, transform: `scale(${0.7 + 0.3 * p})`, filter: p < 1 ? `blur(${(1 - p) * 14}px)` : undefined }}
      />
      <WordReveal
        start={18}
        stagger={7}
        dur={46}
        style={{ ...headline(128, C.inkDark), fontWeight: 800, letterSpacing: "-0.05em", paddingBottom: 8 }}
        lines={["Kasa bez zarządu"]}
      />
      <WordReveal
        start={50}
        stagger={6}
        style={{ ...headline(60, C.inkDark), fontWeight: 600, letterSpacing: "-0.025em" }}
        lines={[[{ text: "No bank." }, { text: "No board." }, { text: "No treasurer.", color: C.emerald300 }]]}
      />
      <WordReveal
        start={80}
        stagger={4}
        style={{ ...headline(38, C.grayDark), fontWeight: 500, letterSpacing: "-0.015em" }}
        lines={["Zero interest. No approval. Installments that pay themselves."]}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 30, ...reveal(frame, 116, 44, 20) }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.emerald300, letterSpacing: "-0.01em" }}>web-production-ad49f.up.railway.app</div>
        <div style={{ fontSize: 26, fontWeight: 500, color: C.grayDark }}>Built on Solana · Independent Finance · For Superteam Poland</div>
      </div>
    </Stage>
  );
};
