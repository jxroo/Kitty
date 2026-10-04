import { Img, staticFile, useCurrentFrame } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Stage } from "../components/Stage";
import { progress, reveal, tween } from "../lib/anim";
import { C, headline } from "../theme";

const WINDOW_W = 1560;

/** The real app (a screenshot of the live devnet deployment) swings up into view and scrolls to the loan. */
export const Product: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = progress(frame, 0, 84);
  const scroll = tween(frame, [96, 232], [0, 470]);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 9);
  return (
    <Stage gap={44} style={{ justifyContent: "flex-start", paddingTop: 92 }}>
      <div style={{ ...headline(50, C.inkLight), fontWeight: 600, letterSpacing: "-0.025em", display: "flex", alignItems: "center", gap: 20, ...reveal(frame, 26) }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: C.emerald500,
            boxShadow: `0 0 0 ${6 + pulse * 6}px rgba(16,185,129,${0.25 - pulse * 0.12})`,
          }}
        />
        Live on Solana devnet.
      </div>
      <div style={{ perspective: 2200, perspectiveOrigin: "50% 0%" }}>
        <BrowserFrame
          width={WINDOW_W}
          height={980}
          url="web-production-ad49f.up.railway.app"
          style={{
            transformOrigin: "50% 100%",
            transform: `translateY(${(1 - rise) * 300}px) rotateX(${(1 - rise) * 30}deg) scale(${0.9 + 0.1 * rise})`,
            opacity: Math.min(1, rise * 2),
          }}
        >
          <Img src={staticFile("screens/06-overdue.png")} style={{ width: WINDOW_W, display: "block", transform: `translateY(${-scroll}px)` }} />
        </BrowserFrame>
      </div>
    </Stage>
  );
};
